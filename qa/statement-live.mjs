// qa/statement-live.mjs -- send a statement file to the running server's reader and print what
// came back. The one test that needs the real model, so it is run by hand, not by npm test.
//   node qa/statement-live.mjs shots/statement-card.pdf card            (text layer: no AI)
//   node qa/statement-live.mjs shots/statement-card-desktop.png card    (vision model)
//   node qa/statement-live.mjs some.pdf bank ai                          (force the model on the text)
// Make the PDF and PNG first: node tools/shot.mjs --pdf --desktop-only file:///C:/FinancialPlanner/qa/fixtures/statement-card.html
import fs from "node:fs";
import path from "node:path";

const [file, kind = "card", mode = "auto"] = process.argv.slice(2);
if (!file) { console.error("usage: node qa/statement-live.mjs <file.pdf|png|jpg> [card|bank] [auto|text|ai]"); process.exit(2); }
const buf = fs.readFileSync(file);
const mime = /\.pdf$/i.test(file) ? "application/pdf" : /\.png$/i.test(file) ? "image/png" : "image/jpeg";
const t0 = Date.now();
const r = await fetch("http://127.0.0.1:8787/api/statement/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: path.basename(file), mime, dataBase64: buf.toString("base64"), kind, mode }) });
const j = await r.json();
console.log(`HTTP ${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (!r.ok) { console.log(j); process.exit(1); }
console.log(`method=${j.method} model=${j.model} pages=${j.pages} rows=${j.rows.length} textRows=${j.textRows} dropped=${j.dropped} period=${JSON.stringify(j.period)} closing=${j.closingBalance}`);
for (const w of j.warnings ?? []) console.log("warning:", w);
for (const row of j.rows) console.log(` ${row.date}  ${String(row.amount).padStart(9)}  ${row.description}`);
