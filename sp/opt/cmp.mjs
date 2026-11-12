// opt/cmp.mjs -- do two census files say the same? node cmp.mjs a.json b.json
import fs from "node:fs";
const [fa, fb] = process.argv.slice(2);
const a = JSON.parse(fs.readFileSync(fa, "utf8")).rows, b = JSON.parse(fs.readFileSync(fb, "utf8")).rows;
const key = (r) => r.household + ":" + r.page; const A = new Map(a.map((r) => [key(r), r]));
let same = 0; const diff = []; const ks = ["px", "pxOpen", "loadFirst", "loadWhole", "loadOpen"];
for (const r of b) { const x = A.get(key(r)); if (!x) continue; const d = ks.filter((k) => x[k] !== r[k]); const fd = JSON.stringify(x.folds.map((f) => [f.sum, f.open0])) !== JSON.stringify(r.folds.map((f) => [f.sum, f.open0])); if (!d.length && !fd && JSON.stringify(x.first) === JSON.stringify(r.first) && JSON.stringify(x.whole) === JSON.stringify(r.whole)) same++; else diff.push(key(r) + " " + d.map((k) => k + " " + x[k] + "->" + r[k]).join(", ") + (fd ? " folds differ" : "") + (!d.length && !fd ? " counts differ: " + Object.keys(x.first).filter((k) => x.first[k] !== r.first[k] || x.whole[k] !== r.whole[k]).map((k) => `${k} ${x.first[k]}/${x.whole[k]}->${r.first[k]}/${r.whole[k]}`).join(", ") : "")); }
console.log(`${fa} vs ${fb}: same ${same} of ${b.length}`); console.log(diff.join("\n"));
