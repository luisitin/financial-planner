// touch/cross.mjs -- the plain-Node half against the browser half, for the rules both check (not part of the repo)
//   node cross.mjs static.json sweep.json
import fs from "node:fs";
const [st, sw] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const norm = (c) => String(c ?? "").replace(/\s+/g, " ").slice(0, 60);
for (const rule of ["T-NAME", "T-KEYBOARD", "T-ONE-WAY", "T-LINK", "T-HEAD", "T-CANCEL"]) {
  const key = (b) => [b.household, b.page, norm(b.control), b.kind].join(" | ");
  const A = new Set(st.breaks.filter((b) => b.rule === rule).map(key)), B = new Set(sw.breaks.filter((b) => b.rule === rule).map(key));
  const both = [...A].filter((k) => B.has(k)).length;
  console.log(`${rule}: node ${st.breaks.filter((b) => b.rule === rule).length} (${A.size} distinct), browser ${sw.breaks.filter((b) => b.rule === rule).length} (${B.size} distinct), in both ${both}`);
  const onlyA = [...A].filter((k) => !B.has(k)), onlyB = [...B].filter((k) => !A.has(k));
  const group = (list) => { const m = {}; for (const k of list) { const [, page, , kind] = k.split(" | "); m[`${page} | ${kind}`] = (m[`${page} | ${kind}`] ?? 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  for (const [k, n] of group(onlyA).slice(0, 8)) console.log(`   node only    ${n} ${k}`);
  for (const [k, n] of group(onlyB).slice(0, 8)) console.log(`   browser only ${n} ${k}`);
}
