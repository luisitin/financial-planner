import { manifests, pageList } from "$SP/wtouch/qa/touch-lib.mjs";
import fs from "node:fs";
const mods = await manifests();
const pl = pageList(mods).map((p) => p.page ?? p.key);
const C = { A: ["career", "household"], B: ["cashflow", "goals", "property", "reports"], C: ["taxes", "retirement", "overview", "debt", "transactions"], D: ["scenarios", "estate", "balance", "ai", "insurance", "investments", "system"] };
const all = new Set();
for (const [k, gs] of Object.entries(C)) { const ps = pl.filter((p) => gs.includes(p.split("/")[0])); ps.forEach((p) => all.add(p)); if (k === "D") ps.push("(menu)"); fs.writeFileSync(`$SP/touch/chunk-${k}.txt`, ps.join(",")); console.log(k, ps.length); }
console.log("missing", pl.filter((p) => !all.has(p)));
