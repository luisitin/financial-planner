// touch/same-part.mjs -- the whole sweep against a second run of some of its pages: are that part's breaks the same? (not part of the repo)
//   node same-part.mjs sweep-first.json proof.json
import fs from "node:fs";
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const pages = new Set([...b.pages, ...(b.breaks.some((x) => x.page === "(menu)") || b.notChecked.some((x) => x.page === "(menu)") || true ? ["(menu)"] : [])]);
const part = (x) => x.filter((y) => pages.has(y.page));
const key = (x) => [x.rule, x.household, x.page, x.state, x.control, x.kind].join(" | ");
const A = part(a.breaks), B = part(b.breaks);
const count = (l) => l.reduce((m, x) => { m[x.rule] = (m[x.rule] ?? 0) + 1; return m; }, {});
const ca = count(A), cb = count(B);
console.log(`${b.households.length} households x ${b.pages.length} pages (every fourth page) and the menu: the whole sweep's breaks on these pages against a second run of only these pages\n`);
console.log("rule             whole sweep   second run");
let same = true;
for (const r of [...new Set([...Object.keys(ca), ...Object.keys(cb)])]) { const ok = (ca[r] ?? 0) === (cb[r] ?? 0); if (!ok) same = false; console.log(`${r.padEnd(16)} ${String(ca[r] ?? 0).padStart(11)}   ${String(cb[r] ?? 0).padStart(10)}${ok ? "" : "   <-- differs"}`); }
const ma = new Map(), mb = new Map();
for (const x of A) ma.set(key(x), (ma.get(key(x)) ?? 0) + 1);
for (const x of B) mb.set(key(x), (mb.get(key(x)) ?? 0) + 1);
const onlyA = [...ma.keys()].filter((k) => ma.get(k) !== mb.get(k)), onlyB = [...mb.keys()].filter((k) => !ma.has(k));
console.log(`\nthe same breaks (rule, household, page, state, control, kind): ${onlyA.length + onlyB.length === 0 ? `yes, all ${A.length}` : `no: ${onlyA.length} only in the whole sweep (or counted differently), ${onlyB.length} only in the second run`}`);
for (const k of onlyA.slice(0, 15)) console.log(`   whole sweep: ${k.slice(0, 240)}`);
for (const k of onlyB.slice(0, 15)) console.log(`   second run:  ${k.slice(0, 240)}`);
if (onlyA.length + onlyB.length) same = false;
const nk = (u) => `${u.household}|${u.page}|${u.control ?? ""}|${u.why}`;
const na = part(a.notChecked).map(nk).sort().join("\n"), nb = part(b.notChecked).map(nk).sort().join("\n");
console.log(`not checked on these pages: ${part(a.notChecked).length} and ${part(b.notChecked).length}${na === nb ? " (the same list)" : " (the lists differ)"}`);
if (na !== nb) { same = false; const sa = new Set(na.split("\n")), sb = new Set(nb.split("\n")); for (const x of [...sa].filter((y) => !sb.has(y)).slice(0, 6)) console.log("   whole sweep only: " + x.slice(0, 220)); for (const x of [...sb].filter((y) => !sa.has(y)).slice(0, 6)) console.log("   second run only:  " + x.slice(0, 220)); }
console.log(same ? "\nSAME" : "\nDIFFERENT");
