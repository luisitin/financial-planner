// server/statements.mjs -- read a bank or card statement (PDF, PNG, JPG) into transaction
// rows for POST /api/statement/read. Runs on the PC so the heavy parts (pdf.js, page
// rendering, the model) stay off the phone. The file lives in memory for the request only.
//
// Order of attempts, cheapest first:
//   1. PDF text layer (pdfjs-dist) -> parseStatementText (no model at all);
//   2. if that found too little and a text model is available -> the text model reads the text;
//   3. images, and scanned PDFs rendered page by page with @napi-rs/canvas -> a vision model.
// Which model: ai.visionModel from planner.properties, else the first Ollama model whose
// /api/show lists the "vision" capability (qwen3.5 and gemma4 have it), else none.
import { parseStatementText, buildTextPrompt, buildVisionPrompt, parseModelRows } from "../modules/transactions/statements/compute.js";

const MAX_PAGES = 12;
const MIN_TEXT_ROWS = 3;

export async function pdfPages(buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // rebuild lines from positioned glyph runs: same baseline (y) = same line, ordered by x
    const items = content.items.filter((it) => it.str !== undefined).map((it) => ({ str: it.str, x: it.transform[4], y: Math.round(it.transform[5]) }));
    const lines = new Map();
    for (const it of items) { const key = it.y; (lines.get(key) ?? lines.set(key, []).get(key)).push(it); }
    const text = [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, run]) => run.sort((a, b) => a.x - b.x).map((r) => r.str).join(" ").replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
    pages.push({ n: i, text, page });
  }
  return { doc, pages, numPages: doc.numPages };
}
export async function renderPage(page, scale = 2) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toBuffer("image/png");
}

/** Ollama: the first model that lists the vision capability (or the configured one). */
export async function pickVisionModel(P, aiFetch) {
  const want = P("ai.visionModel");
  if (want) return want;
  if (P("ai.provider") !== "ollama") return P("ai.model") || null;   // an OpenAI-compatible endpoint: the configured model must accept images
  const base = `http://${P("ai.host")}:${P("ai.port")}`;
  const tags = await (await aiFetch(`${base}/api/tags`, {})).json();
  const names = (tags.models ?? []).map((m) => m.name);
  const preferred = [P("ai.model"), ...names].filter(Boolean);
  for (const name of preferred) {
    try { const j = await (await aiFetch(`${base}/api/show`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: name }) })).json(); if ((j.capabilities ?? []).includes("vision")) return name; } catch { /* next */ }
  }
  return null;
}
async function askModel({ P, aiFetch, model, system, user, imagePng }) {
  const provider = P("ai.provider");
  if (provider === "ollama") {
    const messages = [{ role: "system", content: system }, { role: "user", content: user, ...(imagePng ? { images: [imagePng.toString("base64")] } : {}) }];
    const r = await aiFetch(`http://${P("ai.host")}:${P("ai.port")}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, stream: false, format: "json", options: { temperature: 0, num_ctx: 16384 } }) });
    if (!r.ok) throw new Error(`Ollama ${r.status}: ${await r.text()}`);
    return (await r.json()).message?.content ?? "";
  }
  if (provider === "openai") {
    const content = imagePng ? [{ type: "text", text: user }, { type: "image_url", image_url: { url: `data:image/png;base64,${imagePng.toString("base64")}` } }] : user;
    const r = await aiFetch(`${P("ai.baseUrl").replace(/\/+$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${P("ai.apiKey")}` }, body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content }], temperature: 0 }) });
    if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
    return (await r.json()).choices?.[0]?.message?.content ?? "";
  }
  throw new Error("AI is turned off (ai.provider=none)");
}

/**
 * readStatement({ buffer, mime, fileName, kind, mode }, { P, aiFetch }) -> {
 *   method: "text" | "text+ai" | "vision", model, pages, rows, period, closingBalance, warnings: [text], textRows, dropped
 * }
 * mode: "auto" (default), "text" (never call a model), "ai" (always use the model on the text / pages).
 */
export async function readStatement({ buffer, mime = "", fileName = "", kind = "card", mode = "auto" }, { P, aiFetch }) {
  const warnings = [];
  const aiOn = P("ai.provider") !== "none" && mode !== "text";
  const isPdf = /pdf/i.test(mime) || /\.pdf$/i.test(fileName) || buffer.subarray(0, 5).toString() === "%PDF-";
  const isImage = /^image\//i.test(mime) || /\.(png|jpe?g|webp)$/i.test(fileName);
  if (!isPdf && !isImage) throw new Error("Only PDF, PNG, JPG and WEBP files can be read.");

  const merge = (rowsPerPage) => { const seen = new Set(); const out = []; for (const r of rowsPerPage.flat()) { const k = `${r.date}|${r.amount}|${r.description.toLowerCase()}`; if (!seen.has(k)) { seen.add(k); out.push(r); } } return out; };

  if (isPdf) {
    const { pages, numPages } = await pdfPages(buffer);
    if (numPages > MAX_PAGES) warnings.push(`Only the first ${MAX_PAGES} of ${numPages} pages were read.`);
    const text = pages.map((p) => p.text).join("\n\n");
    const parsed = parseStatementText(text, { kind });
    if (parsed.rows.length >= MIN_TEXT_ROWS && mode !== "ai") {
      return { method: "text", model: null, pages: pages.length, rows: parsed.rows, period: parsed.period, closingBalance: parsed.closingBalance, warnings, textRows: parsed.rows.length, dropped: 0 };
    }
    const hasText = text.replace(/\s+/g, "").length > 200;
    if (hasText && aiOn) {
      // a text layer the line parser could not follow: let the text model read it, page by page
      const model = P("ai.model") || (await pickVisionModel(P, aiFetch));
      if (!model) throw new Error("No model available. Check ai.model in planner.properties.");
      const perPage = [];
      let dropped = 0;
      for (const p of pages) {
        if (!p.text.trim()) continue;
        const pr = buildTextPrompt(p.text, { kind });
        const got = parseModelRows(await askModel({ P, aiFetch, model, system: pr.system, user: pr.user }), { kind });
        perPage.push(got.rows); dropped += got.dropped;
        if (got.period.to && !parsed.period.to) parsed.period = got.period;
        if (got.closingBalance !== null && parsed.closingBalance === null) parsed.closingBalance = got.closingBalance;
      }
      const rows = merge(perPage);
      if (parsed.rows.length && rows.length < parsed.rows.length) warnings.push(`The line reader found ${parsed.rows.length} rows and the model ${rows.length}; the model's list is shown.`);
      return { method: "text+ai", model, pages: pages.length, rows, period: parsed.period, closingBalance: parsed.closingBalance, warnings, textRows: parsed.rows.length, dropped };
    }
    if (hasText && !aiOn) {
      if (parsed.rows.length) warnings.push("Only a few lines could be read without the AI. Turn the AI on in Settings for a better read, or use the bank's CSV export.");
      else throw new Error("This PDF's text does not look like a list of transactions, and the AI is off. Turn it on in Settings, or use the bank's CSV export.");
      return { method: "text", model: null, pages: pages.length, rows: parsed.rows, period: parsed.period, closingBalance: parsed.closingBalance, warnings, textRows: parsed.rows.length, dropped: 0 };
    }
    // no text layer: a scan. Render pages and use the vision model.
    if (!aiOn) throw new Error("This PDF is a scan (no text inside) and the AI is off. Turn it on in Settings, or ask the bank for a CSV.");
    const model = await pickVisionModel(P, aiFetch);
    if (!model) throw new Error("This PDF is a scan and no model on this PC can read pictures. Pull one with: ollama pull qwen3.5:9b (or gemma4), or set ai.visionModel.");
    const perPage = []; let dropped = 0; const period = { from: null, to: null }; let closingBalance = null;
    for (const p of pages) {
      const png = await renderPage(p.page, 2);
      const pr = buildVisionPrompt({ kind, page: p.n, pages: pages.length });
      const got = parseModelRows(await askModel({ P, aiFetch, model, system: pr.system, user: pr.user, imagePng: png }), { kind });
      perPage.push(got.rows); dropped += got.dropped;
      if (got.period.to && !period.to) Object.assign(period, got.period);
      if (got.closingBalance !== null && closingBalance === null) closingBalance = got.closingBalance;
    }
    return { method: "vision", model, pages: pages.length, rows: merge(perPage), period, closingBalance, warnings, textRows: 0, dropped };
  }

  // an image
  if (!aiOn) throw new Error("A picture needs the AI to read it, and the AI is off. Turn it on in Settings.");
  const model = await pickVisionModel(P, aiFetch);
  if (!model) throw new Error("No model on this PC can read pictures. Pull one with: ollama pull qwen3.5:9b (or gemma4), or set ai.visionModel in planner.properties.");
  let png = buffer;
  if (!/png/i.test(mime) && !/\.png$/i.test(fileName)) {
    // re-encode JPG/WEBP to PNG so both providers get the same thing
    const { loadImage, createCanvas } = await import("@napi-rs/canvas");
    const img = await loadImage(buffer);
    const c = createCanvas(img.width, img.height); c.getContext("2d").drawImage(img, 0, 0);
    png = c.toBuffer("image/png");
  }
  const pr = buildVisionPrompt({ kind, page: 1, pages: 1 });
  const got = parseModelRows(await askModel({ P, aiFetch, model, system: pr.system, user: pr.user, imagePng: png }), { kind });
  return { method: "vision", model, pages: 1, rows: got.rows, period: got.period, closingBalance: got.closingBalance, warnings, textRows: 0, dropped: got.dropped };
}
