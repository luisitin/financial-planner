// server/server.mjs -- the PC side. Zero dependencies (Node 20+).
//
//   node server/server.mjs            (or `npm run serve`)
//
// It does four jobs:
//   1. serves the app (index.html, core/, modules/) so any device on the LAN opens it
//   2. holds the ONE plan file, data/plan.json, shared by every device (with backups)
//   3. runs heavy compute on the PC:  POST /api/compute/<group>/<id>  (a module's compute.js)
//   4. proxies AI calls to Ollama (or an OpenAI-compatible endpoint) so phones never
//      need a direct line and the properties file stays here
//
// Configuration comes from planner.properties in the project root (key=value, see
// planner.properties.example). If the file is missing, the defaults below apply and
// GET /api/config says so, and the app falls back to its own Settings page.
//
// Security: financial data. Set auth.token in planner.properties before exposing
// this beyond your own LAN; every /api route except health and config then requires
// the X-Planner-Token header. Never publish this server through a tunnel without it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

const DEFAULTS = {
  "server.port": "8787", "server.bind": "0.0.0.0", "server.hosts": "",
  "auth.token": "", "auth.trustLocal": "true",
  "data.dir": "data", "data.backups": "50",
  "ai.provider": "ollama", "ai.host": "127.0.0.1", "ai.port": "11434", "ai.model": "", "ai.baseUrl": "", "ai.apiKey": "", "ai.timeoutMs": "180000",
  "ai.visionModel": "", "statements.maxMb": "25",
  "compute.maxPaths": "20000",
};
function loadProperties() {
  const file = path.join(ROOT, "planner.properties");
  const props = { ...DEFAULTS };
  let source = "defaults (planner.properties not found)";
  if (fs.existsSync(file)) {
    source = "planner.properties";
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const l = line.trim();
      if (!l || l.startsWith("#") || l.startsWith("!")) continue;
      const i = l.indexOf("=");
      if (i < 0) continue;
      props[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    }
  }
  return { props, source };
}
let { props, source } = loadProperties();
const P = (k) => props[k] ?? DEFAULTS[k] ?? "";
const DATA = path.resolve(ROOT, P("data.dir"));
const PLAN_FILE = path.join(DATA, "plan.json");
fs.mkdirSync(path.join(DATA, "backups"), { recursive: true });
const ROOT_REAL = fs.realpathSync.native(ROOT), DATA_REAL = fs.realpathSync.native(DATA);

// ---------------------------------------------------------------- helpers
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const DENY = [/^planner\.properties$/i, /^data(\/|$)/i, /^\.git(\/|$)/i, /^node_modules(\/|$)/i, /^\.env/i,
  /^private(\/|$)/i, /^ai-responses(\/|$)/i, /^shots(\/|$)/i, /^\.githooks(\/|$)/i, /^\.claude(\/|$)/i];
// Windows reads "a\b" as a\b, "x::$DATA" as x, "PLANNE~1.PRO" as planner.properties and drops trailing dots
// and spaces, so a path carrying any of those is refused before the deny list is even consulted.
const ODD_PATH = /[\\:~\0]|(^|\/)\.\.?(\/|$)|[. ](\/|$)/;
const denied = (rel) => ODD_PATH.test(rel) || DENY.some((re) => re.test(rel));
const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve, reject) => { const chunks = []; req.on("data", (c) => { chunks.push(c); if (chunks.reduce((n, b) => n + b.length, 0) > 50e6) reject(new Error("body too large")); }); req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8"))); req.on("error", reject); });
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const isLocal = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket?.remoteAddress);
// Names a browser on this network uses for the PC: IP addresses, one-word PC names (localhost too), the
// private suffixes below and any listed in server.hosts. A public name that leads here is a DNS-rebinding page.
const NETWORK_NAME = /^(\[[0-9a-f:.]+\]|\d{1,3}(\.\d{1,3}){3}|[a-z0-9-]+|[a-z0-9.-]+\.(local|lan|home\.arpa|internal|ts\.net))(:\d+)?$/;
function authorized(req) {
  const want = P("auth.token");
  // a page's request carries Origin; only this server's own pages may go without the token
  const host = String(req.headers.host || "").toLowerCase(), origin = String(req.headers.origin || "").toLowerCase();
  const ownPage = !origin || origin === `http://${host}` || origin === `https://${host}`;
  if (!want) {
    // no token (LAN only): still refuse other web sites open in a browser here, and names that are not this network's
    const extra = P("server.hosts").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    return ownPage && (NETWORK_NAME.test(host) || extra.includes(host.replace(/:\d+$/, "")));
  }
  // the PC itself (its browser, the tools) needs no token, but only when it asks for itself: a page from another
  // site open in the PC's browser (Origin is not this server) or a DNS name rebound to 127.0.0.1 (Host is not loopback) does
  const asksForItself = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host) && (!origin || origin === `http://${host}`);
  if (isLocal(req) && asksForItself && P("auth.trustLocal") !== "false") return true;
  const got = req.headers["x-planner-token"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return got === want;
}
function publicConfig() {
  const out = { source, authRequired: !!P("auth.token"), version: VERSION, ai: {}, features: {}, compute: { maxPaths: Number(P("compute.maxPaths")) } };
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("auth.") || k === "ai.apiKey") continue;
    if (k.startsWith("ai.")) out.ai[k.slice(3)] = k === "ai.port" ? Number(v) : v;
    if (k.startsWith("feature.")) out.features[k.slice(8)] = v !== "false";
  }
  if (!out.ai.model) delete out.ai.model;
  return out;
}
function readPlan() { try { return JSON.parse(fs.readFileSync(PLAN_FILE, "utf8")); } catch { return null; } }
function writePlan(plan) {
  if (fs.existsSync(PLAN_FILE)) {
    // copies are named to the second: a second save in the same second keeps the first copy (the plan before both),
    // so a copy never changes once made (system/backups and system/audit rely on that)
    try { fs.copyFileSync(PLAN_FILE, path.join(DATA, "backups", `plan-${stamp()}.json`), fs.constants.COPYFILE_EXCL); } catch (e) { if (e.code !== "EEXIST") throw e; }
    const keep = Number(P("data.backups")) || 50;
    const old = fs.readdirSync(path.join(DATA, "backups")).filter((f) => f.startsWith("plan-")).sort();
    for (const f of old.slice(0, Math.max(0, old.length - keep))) fs.unlinkSync(path.join(DATA, "backups", f));
  }
  const tmp = PLAN_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(plan, null, 2), "utf8");
  fs.renameSync(tmp, PLAN_FILE);
}

// ---------------------------------------------------------------- AI proxy
async function aiFetch(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), Number(P("ai.timeoutMs")) || 180000);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}
async function aiModels() {
  if (P("ai.provider") === "ollama") {
    const r = await aiFetch(`http://${P("ai.host")}:${P("ai.port")}/api/tags`);
    const j = await r.json(); return (j.models ?? []).map((m) => m.name);
  }
  if (P("ai.provider") === "openai") {
    const r = await aiFetch(`${P("ai.baseUrl").replace(/\/+$/, "")}/models`, { headers: { Authorization: `Bearer ${P("ai.apiKey")}` } });
    const j = await r.json(); return (j.data ?? []).map((m) => m.id);
  }
  return [];
}
async function aiChat({ messages, model, options }) {
  const provider = P("ai.provider");
  if (provider === "none") throw new Error("AI disabled in planner.properties (ai.provider=none)");
  const useModel = model || P("ai.model") || (await aiModels())[0];
  if (!useModel) throw new Error("no model available");
  if (provider === "ollama") {
    const r = await aiFetch(`http://${P("ai.host")}:${P("ai.port")}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: useModel, messages, stream: false, options: options ?? {} }) });
    if (!r.ok) throw new Error(`Ollama ${r.status}: ${await r.text()}`);
    const j = await r.json(); return { content: j.message?.content ?? "", model: useModel, provider };
  }
  if (provider === "openai") {
    const r = await aiFetch(`${P("ai.baseUrl").replace(/\/+$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${P("ai.apiKey")}` }, body: JSON.stringify({ model: useModel, messages }) });
    if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
    const j = await r.json(); return { content: j.choices?.[0]?.message?.content ?? "", model: useModel, provider };
  }
  throw new Error(`unknown ai.provider ${provider}`);
}

// ---------------------------------------------------------------- routes
async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);   // ["api", ...]
  const route = parts.slice(1).join("/");
  if (req.method === "GET" && route === "health") {
    let aiOk = null; try { aiOk = (await aiModels()).length > 0; } catch { aiOk = false; }
    return json(res, 200, { ok: true, version: VERSION, plan: fs.existsSync(PLAN_FILE), ai: { provider: P("ai.provider"), reachable: aiOk }, authRequired: !!P("auth.token") });
  }
  if (req.method === "GET" && route === "config") { ({ props, source } = loadProperties()); return json(res, 200, publicConfig()); }
  if (!authorized(req)) {
    if (P("auth.token")) return json(res, 401, { error: "missing or wrong X-Planner-Token" });
    console.warn(`refused ${req.method} /api/${route}: Host ${req.headers.host || "(none)"}, Origin ${req.headers.origin || "(none)"}`);
    return json(res, 401, { error: "This server only answers its own pages on this network. To use it from another page or address, set auth.token in planner.properties (or add the address to server.hosts)." });
  }

  if (route === "plan" && req.method === "GET") { const p = readPlan(); return p ? json(res, 200, p) : json(res, 404, { error: "no plan yet" }); }
  if (route === "plan" && req.method === "PUT") {
    let plan; try { plan = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: "invalid JSON" }); }
    if (!plan || typeof plan !== "object" || !("schemaVersion" in plan)) return json(res, 400, { error: "not a plan (schemaVersion missing)" });
    writePlan(plan); return json(res, 200, { ok: true, savedAt: new Date().toISOString() });
  }
  if (route === "plan/backups" && req.method === "GET") return json(res, 200, { backups: fs.readdirSync(path.join(DATA, "backups")).sort().reverse() });
  if (parts[1] === "plan" && parts[2] === "backups" && parts.length === 4 && req.method === "GET") {
    // one backup, for system/backups: served only when the name is in the folder's own list (never a path)
    let name = ""; try { name = decodeURIComponent(parts[3]); } catch { /* a malformed name is no backup */ }
    if (!fs.readdirSync(path.join(DATA, "backups")).includes(name) || !/^plan-[\w-]+\.json$/.test(name)) return json(res, 404, { error: "no such backup" });
    try { return json(res, 200, JSON.parse(fs.readFileSync(path.join(DATA, "backups", name), "utf8"))); } catch { return json(res, 422, { error: "that backup cannot be read" }); }
  }

  if (parts[1] === "compute" && req.method === "POST") {
    const [group, id] = [parts[2], parts[3]];
    if (!/^[a-z0-9-]+$/.test(group || "") || !/^[a-z0-9-]+$/.test(id || "")) return json(res, 400, { error: "bad module key" });
    const file = path.join(ROOT, "modules", group, id, "compute.js");
    if (!fs.existsSync(file)) return json(res, 404, { error: `no compute.js for ${group}/${id}` });
    let body = {}; try { body = JSON.parse((await readBody(req)) || "{}"); } catch { return json(res, 400, { error: "invalid JSON" }); }
    const plan = body.plan ?? readPlan();
    if (!plan) return json(res, 409, { error: "no plan on the server and none in the request" });
    const params = { ...(body.params ?? {}), maxPaths: Number(P("compute.maxPaths")) };
    try { const mod = await import(pathToFileURL(file).href); const out = await mod.compute(plan, params); return json(res, 200, out ?? {}); }
    catch (e) { return json(res, 500, { error: String(e) }); }
  }
  if (route === "ai/models" && req.method === "GET") { try { return json(res, 200, { models: await aiModels(), provider: P("ai.provider") }); } catch (e) { return json(res, 502, { error: String(e) }); } }
  if (route === "statement/read" && req.method === "POST") {
    // { fileName, mime, dataBase64, kind: "card"|"bank", mode: "auto"|"text"|"ai" } -> rows (see server/statements.mjs)
    let body; try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: "invalid JSON" }); }
    if (typeof body.dataBase64 !== "string" || !body.dataBase64) return json(res, 400, { error: "dataBase64 required" });
    const buffer = Buffer.from(body.dataBase64, "base64");
    const maxMb = Number(P("statements.maxMb")) || 25;
    if (buffer.length > maxMb * 1024 * 1024) return json(res, 413, { error: `The file is bigger than ${maxMb} MB.` });
    try {
      const { readStatement } = await import("./statements.mjs");
      const out = await readStatement({ buffer, mime: String(body.mime ?? ""), fileName: String(body.fileName ?? ""), kind: body.kind === "bank" ? "bank" : "card", mode: ["auto", "text", "ai"].includes(body.mode) ? body.mode : "auto" }, { P, aiFetch });
      return json(res, 200, out);
    } catch (e) { return json(res, 422, { error: e.message ?? String(e) }); }
  }
  if (route === "document/text" && req.method === "POST") {
    // { fileName, mime, dataBase64 } -> { text, pages }: a PDF's own text layer, for ai/reader (the file lives in memory for the request only)
    let body; try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: "invalid JSON" }); }
    if (typeof body.dataBase64 !== "string" || !body.dataBase64) return json(res, 400, { error: "dataBase64 required" });
    const buffer = Buffer.from(body.dataBase64, "base64");
    const maxMb = Number(P("statements.maxMb")) || 25;
    if (buffer.length > maxMb * 1024 * 1024) return json(res, 413, { error: `The file is bigger than ${maxMb} MB.` });
    if (!/pdf/i.test(String(body.mime ?? "")) && !/\.pdf$/i.test(String(body.fileName ?? ""))) return json(res, 415, { error: "Only PDFs can be read here. For a photo, copy the text from it, or use the Statements page." });
    try {
      const { pdfPages } = await import("./statements.mjs");
      const { pages, numPages } = await pdfPages(buffer);
      const text = pages.map((pg) => pg.text).join("\n");
      if (!text.trim()) return json(res, 422, { error: "This PDF has no text in it (it is a scan). Copy the text from it, or use the Statements page, which can read pictures with the AI." });
      return json(res, 200, { text, pages: numPages });
    } catch (e) { return json(res, 422, { error: /pdfjs/i.test(String(e)) ? "The PC cannot read PDFs yet: run npm install in the app's folder." : e.message ?? String(e) }); }
  }
  if (route === "ai/chat" && req.method === "POST") {
    let body; try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: "invalid JSON" }); }
    if (!Array.isArray(body.messages)) return json(res, 400, { error: "messages[] required" });
    try { return json(res, 200, await aiChat(body)); } catch (e) { return json(res, 502, { error: String(e) }); }
  }
  return json(res, 404, { error: `no route ${req.method} ${url.pathname}` });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  if (denied(rel)) { res.writeHead(403); return res.end("forbidden"); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("forbidden"); }
  // check again on the name the disk really uses (short names, case, junctions), and keep out a data.dir moved elsewhere
  fs.realpath.native(file, (err, real) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    const realRel = path.relative(ROOT_REAL, real).split(path.sep).join("/");
    if (realRel.startsWith("../") || path.isAbsolute(realRel) || denied(realRel) || (real + path.sep).toLowerCase().startsWith(DATA_REAL.toLowerCase() + path.sep)) { res.writeHead(403); return res.end("forbidden"); }
    fs.stat(real, (err2, st) => {
      if (err2 || !st.isFile()) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(real).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-cache" });
      fs.createReadStream(real).pipe(res);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("Access-Control-Allow-Origin", "*");     // a copy of the HTML opened elsewhere may call this server
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Planner-Token, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (e) { console.error(e); return json(res, 500, { error: String(e) }); }
});

const port = Number(P("server.port")) || 8787, bind = P("server.bind") || "0.0.0.0";
server.listen(port, bind, () => {
  console.log(`Planner server v${VERSION}  config: ${source}  data: ${DATA}`);
  console.log(`AI: ${P("ai.provider")} ${P("ai.provider") === "ollama" ? `at ${P("ai.host")}:${P("ai.port")}` : ""} model=${P("ai.model") || "(first available)"}   auth: ${P("auth.token") ? "token required" : "OPEN (LAN only!)"}`);
  const addrs = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a.address);
  for (const a of ["127.0.0.1", ...addrs]) console.log(`  http://${a}:${port}/`);
});
