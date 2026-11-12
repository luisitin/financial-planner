// touch/subset.mjs -- the full sweep's breaks on the pages and households of a smaller run, against that run (not part of the repo)
//   node subset.mjs full.json small.json
import fs from "node:fs";
const [full, small] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const hh = new Set(small.households.map((h) => h.id)), pg = new Set([...small.pages, "(menu)"]);
const inSmall = (x) => hh.has(x.household) && pg.has(x.page);
const key = (x) => [x.rule, x.household, x.page, x.state, x.control, x.kind].join(" | ");
const count = (list) => { const m = new Map(); for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + 1); return m; };
const A = count(full.breaks.filter(inSmall)), B = count(small.breaks);
const onlyFull = [...A.keys()].filter((k) => A.get(k) !== B.get(k)), onlySmall = [...B.keys()].filter((k) => !A.has(k));
const byRule = (list) => list.reduce((m, x) => ((m[x.rule] = (m[x.rule] ?? 0) + 1), m), {});
console.log("full sweep, the small run's cells:", JSON.stringify(byRule(full.breaks.filter(inSmall))));
console.log("small run:                       ", JSON.stringify(byRule(small.breaks)));
console.log(`breaks only in the full sweep (or counted differently): ${onlyFull.length}; only in the small run: ${onlySmall.length}`);
for (const k of onlyFull.slice(0, 20)) console.log("  full : " + k.slice(0, 240));
for (const k of onlySmall.slice(0, 20)) console.log("  small: " + k.slice(0, 240));
const nc = (list) => list.filter(inSmall).map((u) => `${u.household}|${u.page}|${u.control ?? ""}|${u.why}`).sort().join("\n");
console.log(`not checked on these cells: ${full.notChecked.filter(inSmall).length} and ${small.notChecked.length}${nc(full.notChecked) === nc(small.notChecked) ? " (the same list)" : " (the lists differ)"}`);
console.log(onlyFull.length + onlySmall.length === 0 ? "SAME" : "DIFFERENT");
