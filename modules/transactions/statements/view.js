// modules/transactions/statements/view.js -- DOM only. Pick the account, pick a statement
// (PDF or picture), have the PC read it, check the rows, import. Reading happens on the PC
// (server/statements.mjs); this page only sends the file and shows what came back.
import { compute, rowsToImport } from "./compute.js";
import { prepareRows } from "../import/compute.js";
import { txKey } from "../ledger/compute.js";
import { isLiability } from "../../balance/net-worth/compute.js";

export function render(root, ctx) {
  const { ui, fmt, store, plan, api, ai } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan);
  let accountId = d.accounts[0]?.id ?? "";
  let kind = d.accounts[0] && isLiability(d.accounts[0].type) ? "card" : "bank";
  let file = null, result = null, flipSign = false;

  const aiPill = ui.h("span", { class: "pill" }, "checking the AI...");
  ai.status().then((s) => {
    const ok = String(s).startsWith("on");
    aiPill.textContent = ok ? `AI ${s}` : s === "off" ? "AI off: only PDFs with real text can be read" : `AI ${s}: only PDFs with real text can be read`;
    aiPill.className = `pill ${ok ? "ok" : "warn"}`;
  }).catch(() => { aiPill.textContent = "AI not reachable"; aiPill.className = "pill warn"; });
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Read a statement"),
    ui.h("p", { class: "lede" }, "No file to download from your bank? Give the plan the statement itself: a PDF, or a photo or screenshot of the page with the transactions. The PC reads it and shows you the rows before anything is added."),
    ui.h("p", { class: "muted small" }, "A PDF with real text is read on the PC directly. A scan or photo needs the AI on your PC. Nothing leaves your PC unless you chose an online AI in Settings. ", aiPill),
  ));
  if (!store.backend || store.backend() !== "server") { root.append(ui.notice("warn", "This page needs the PC: the pill at the top should say Saved on PC. On the phone, connect to the PC in Settings first.")); }
  if (!d.accounts.length) { root.append(ui.notice("warn", ui.h("span", {}, "Add the account the statement belongs to first: ", ui.h("a", { href: "#/balance/net-worth" }, "Net worth")))); return; }

  const acctSel = ui.select(d.accounts.map((a) => ({ value: a.id, label: a.name })), accountId, { onChange: (e) => { accountId = e.target.value; const a = d.accounts.find((x) => x.id === accountId); kind = a && isLiability(a.type) ? "card" : "bank"; kindSel.value = kind; if (result) preview(); } });
  const kindSel = ui.select([{ value: "card", label: "Credit card statement" }, { value: "bank", label: "Bank account statement" }], kind, { onChange: (e) => { kind = e.target.value; } });
  // App-style pickers instead of the browser's file control; "Take a photo" opens the phone
  // camera directly (design log 2026-09-15, pass 2).
  const fileIn = ui.h("input", { type: "file", accept: ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*", "aria-label": "Statement file", style: { display: "none" } });
  const camIn = ui.h("input", { type: "file", accept: "image/*", capture: "environment", "aria-label": "Take a photo", style: { display: "none" } });
  const chosen = ui.h("span", { class: "muted small", style: { alignSelf: "center" } }, "No file chosen yet");
  const picked = (input) => { file = input.files?.[0] ?? null; result = null; readBtn.disabled = !file; chosen.textContent = file ? `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)` : "No file chosen yet"; preview(); };
  fileIn.addEventListener("change", () => picked(fileIn));
  camIn.addEventListener("change", () => picked(camIn));
  const readBtn = ui.button("Read the statement", () => read(), { disabled: true });
  root.append(ui.card("1. Which account, what kind", ui.h("div", { class: "form" }, ui.field("Account", acctSel), ui.field("Kind of statement", kindSel, "decides whether plain amounts are charges or deposits"))));
  root.append(ui.card("2. The statement",
    ui.row(ui.button("Choose a PDF or picture", () => fileIn.click(), { class: "secondary" }), ui.button("Take a photo", () => camIn.click(), { class: "secondary" }), chosen),
    fileIn, camIn,
    ui.h("p", { class: "muted small" }, "Up to a few pages; a photo works if the numbers are readable."),
    ui.row(readBtn)));

  const outCard = ui.card("3. Check and import");
  const outHost = ui.h("div");
  outCard.append(outHost);
  root.append(outCard);

  const read = async () => {
    if (!file) return;
    readBtn.disabled = true; readBtn.textContent = "Reading… this takes a minute or two for a photo";
    outHost.innerHTML = ""; outHost.append(ui.notice("info", `Reading ${file.name} on the PC...`));
    try {
      const dataBase64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(file); });
      result = await api.readStatement({ fileName: file.name, mime: file.type, dataBase64, kind, mode: "auto" });
      flipSign = false;
    } catch (e) { result = null; outHost.innerHTML = ""; outHost.append(ui.notice("error", `Could not read it: ${e.message}`)); }
    readBtn.disabled = false; readBtn.textContent = "Read the statement";
    if (result) preview();
  };

  const preview = () => {
    outHost.innerHTML = "";
    if (!result) { outHost.append(ui.muted(file ? "Press \"Read the statement\"." : "Pick a file first.")); return; }
    const how = { text: "read from the PDF's text, no AI", "text+ai": `read from the PDF's text with the AI's help (${result.model})`, vision: `read from the picture by the AI (${result.model})` }[result.method] ?? result.method;
    const prep = prepareRows(plan, rowsToImport(result.rows), { accountId, importId: "preview", flipSign });
    const ok = prep.add.length, dup = prep.skip.length, needCat = prep.add.filter((t) => !t.category).length;
    const flip = ui.h("input", { type: "checkbox", checked: flipSign ? true : null, onChange: (e) => { flipSign = e.target.checked; preview(); } });
    outHost.append(
      ui.h("p", { class: "muted small" }, `${result.pages} page${result.pages === 1 ? "" : "s"}, ${result.rows.length} row${result.rows.length === 1 ? "" : "s"} found, ${how}.${result.period?.to ? ` Statement period ${fmt.date(result.period.from)} to ${fmt.date(result.period.to)}.` : ""}${result.closingBalance !== null && result.closingBalance !== undefined ? ` Closing balance on the statement: ${fmt.money(result.closingBalance, cur, undefined, 2)}.` : ""}${result.dropped ? ` ${result.dropped} line${result.dropped === 1 ? "" : "s"} the AI returned could not be used.` : ""}`),
      ...(result.warnings ?? []).map((w) => ui.notice("warn", w)),
      ui.h("div", { class: "form" }, ui.field("Amounts look backwards", flip, "tick if spending shows as money in below")),
      ui.row(
        ui.stat("Will be added", String(ok), prep.dateFrom ? `${fmt.date(prep.dateFrom)} to ${fmt.date(prep.dateTo)}` : "nothing new"),
        ui.stat("Already on file", String(dup), "skipped as duplicates"),
        ui.stat("Filed by your rules", String(ok - needCat), `${needCat} will need a category`),
      ),
    );
    if (!result.rows.length) { outHost.append(ui.notice("warn", "No transaction lines were found. If this is a scan, make sure the AI is on; if it is a picture, retake it straight-on with the whole table in view.")); return; }
    if (ok) outHost.append(
      ui.h("p", { class: "small", style: { margin: "10px 0 4px" } }, `Money in ${fmt.money(prep.inTotal, cur)}, money out ${fmt.money(prep.outTotal, cur)}. Every row it will add:`),
      ui.h("ul", { class: "page-list" }, prep.add.map((t) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, t.payee), ui.h("div", { class: "d" }, `${fmt.date(t.date)} · statement says: ${t.rawPayee}`)),
        ui.h("span", { class: "st", style: { fontWeight: "600", color: t.amount > 0 ? "var(--ok)" : "inherit" } }, (t.amount > 0 ? "+" : "-") + fmt.money(Math.abs(t.amount), cur, undefined, 2))))),
      ui.row(ui.button(`Import ${ok} transaction${ok === 1 ? "" : "s"}`, () => {
        const importId = ui.uid(), acct = accountId, name = file?.name ?? "statement", when = new Date().toISOString(), rows = rowsToImport(result.rows), method = result.method, flipUsed = flipSign;
        store.update((p) => {
          p.transactions = p.transactions ?? [];
          const fresh = prepareRows(p, rows, { accountId: acct, importId, flipSign: flipUsed });
          for (const t of fresh.add) { t.id = ui.uid(); t.key = txKey(t); p.transactions.push(t); }
          p.imports = p.imports ?? [];
          p.imports.push({ id: importId, at: when, accountId: acct, fileName: name, rows: rows.length, added: fresh.add.length, skipped: fresh.skip.length, bad: 0, method });
          for (const r of p.rules ?? []) r.hits = (r.hits ?? 0) + (fresh.ruleHits[r.id] ?? 0);
        });
        ctx.go("transactions", "categorize");
      })),
    );
    else outHost.append(ui.notice("info", "Everything on this statement is already on file. Nothing to do."));
  };
  preview();

  if (d.imports.length) {
    const acctName = (id) => d.accounts.find((a) => a.id === id)?.name ?? "account";
    root.append(ui.card("Statements read so far",
      ui.h("ul", { class: "page-list" }, d.imports.slice(0, 20).map((im) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, im.fileName || "statement"), ui.h("div", { class: "d" }, `${fmt.date(String(im.at).slice(0, 10))} · ${acctName(im.accountId)} · ${im.added} added, ${im.skipped} skipped · ${im.method === "vision" ? "read from the picture" : im.method === "text+ai" ? "text with AI help" : "text"}`)),
        ui.h("span", { class: "st" }, ui.button("Undo", () => { if (ui.confirm(`Remove the ${im.added} transactions from ${im.fileName || "this statement"}?`)) store.update((p) => { p.transactions = (p.transactions ?? []).filter((t) => t.importId !== im.id); p.imports = (p.imports ?? []).filter((x) => x.id !== im.id); }); }, { class: "secondary small" }))))),
    ));
  }
}
