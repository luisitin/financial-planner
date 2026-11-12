// touch/same.mjs -- two sweep JSONs of the same tree: same counts, same breaks? (not part of the repo)
//   node same.mjs a.json b.json
import fs from "node:fs";
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const id = (x, withMeasure) => [x.rule, x.household, x.page, x.state, x.control, x.kind, withMeasure && x.rule !== "D-TIME" ? x.measured : ""].join(" | ");
const rules = [...new Set([...Object.keys(a.counts), ...Object.keys(b.counts)])];
let same = true;
console.log("rule             run 1   run 2   checked 1   checked 2");
for (const r of rules) {
  const ok = (a.counts[r] ?? 0) === (b.counts[r] ?? 0) && (a.checked[r] ?? 0) === (b.checked[r] ?? 0);
  if (!ok) same = false;
  console.log(`${r.padEnd(16)} ${String(a.counts[r] ?? 0).padStart(5)}   ${String(b.counts[r] ?? 0).padStart(5)}   ${String(a.checked[r] ?? 0).padStart(9)}   ${String(b.checked[r] ?? 0).padStart(9)}${ok ? "" : "   <-- differs"}`);
}
for (const strict of [false, true]) {
  const A = new Map(), B = new Map();
  for (const x of a.breaks) A.set(id(x, strict), (A.get(id(x, strict)) ?? 0) + 1);
  for (const x of b.breaks) B.set(id(x, strict), (B.get(id(x, strict)) ?? 0) + 1);
  const onlyA = [...A.keys()].filter((k) => A.get(k) !== B.get(k)), onlyB = [...B.keys()].filter((k) => A.get(k) !== B.get(k) && !A.has(k));
  console.log(`\n${strict ? "the same breaks with the same measurements (D-TIME's milliseconds left out)" : "the same breaks (rule, household, page, state, control, kind)"}: ${onlyA.length + onlyB.length === 0 ? "yes, all " + a.breaks.length : `no: ${onlyA.length} differ or are only in run 1, ${onlyB.length} only in run 2`}`);
  for (const k of onlyA.slice(0, 12)) console.log(`   run 1: ${k.slice(0, 260)}`);
  for (const k of onlyB.slice(0, 12)) console.log(`   run 2: ${k.slice(0, 260)}`);
  if (onlyA.length + onlyB.length) same = false;
}
// measurements that differ: by how much? (a pixel either way is the browser's rounding of a scroll position)
{
  const key = (x) => [x.rule, x.household, x.page, x.state, x.control, x.kind].join(" | ");
  const B = new Map(b.breaks.map((x) => [key(x), x]));
  let off = 0, small = 0, timing = 0;
  for (const x of a.breaks) {
    const y = B.get(key(x)); if (!y || y.measured === x.measured) continue;
    if (x.rule === "D-TIME") { timing++; continue; }
    off++;
    const na = String(x.measured).match(/-?\d+(\.\d+)?/g) ?? [], nb = String(y.measured).match(/-?\d+(\.\d+)?/g) ?? [];
    if (String(x.measured).replace(/-?\d+(\.\d+)?/g, "#") === String(y.measured).replace(/-?\d+(\.\d+)?/g, "#") && na.every((n, i) => Math.abs(Number(n) - Number(nb[i])) <= 2)) small++;
  }
  console.log(`\nmeasurements: ${off} of the shared breaks read differently, ${small} of them by 2 px or less; ${timing} D-TIME figures differ in their milliseconds`);
  if (off === small) same = a.breaks.length === b.breaks.length && rules.every((r) => (a.counts[r] ?? 0) === (b.counts[r] ?? 0) && (a.checked[r] ?? 0) === (b.checked[r] ?? 0)) && a.breaks.every((x) => B.has(key(x)));
}
const nc = (x) => x.notChecked.map((u) => `${u.household}|${u.page}|${u.control ?? ""}|${u.why}`).sort().join("\n");
console.log(`\nnot checked: ${a.notChecked.length} and ${b.notChecked.length}${nc(a) === nc(b) ? " (the same list)" : " (the lists differ)"}`);
console.log(`run 1 took ${a.seconds} s, run 2 ${b.seconds} s`);
console.log(same ? "\nSAME: the same counts, the same things checked, the same breaks" : "\nDIFFERENT");
