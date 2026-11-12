// touch/mkreport.mjs -- build.md from the first full sweep (not part of the repo).
//   node mkreport.mjs sweep-first.json [second.json ...] > build.md
import fs from "node:fs";
const ROOT = "$SP/wtouch";
const DIR = "$SP/touch";
const rules = JSON.parse(fs.readFileSync(`${ROOT}/qa/touch-rules.json`, "utf8"));
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const first = read(process.argv[2] ?? `${DIR}/sweep-first.json`);
const extra = JSON.parse(fs.existsSync(`${DIR}/report-extra.json`) ? fs.readFileSync(`${DIR}/report-extra.json`, "utf8") : "{}");
const out = [];
const p = (s = "") => out.push(s);
const min = (s) => `${Math.floor(s / 60)} min ${s % 60} s`;
p("# Touch and input sweep: build report (2026-11-11)");
p();
p("Base 1dd3773 (claude/creative-build-b531q0). Tools and tests only: no page, no `core/*`, no CSS was changed. Nothing committed, nothing pushed.");
p();
p("## What was built");
p("- `qa/touch-rules.json`: 22 rules as data (id, concern, the check in exact terms, threshold, source with address, the day it was read, where it runs) and 8 rules that are by hand only, each with how to check it.");
p("- `qa/touch-sweep.mjs`: the browser sweep (Playwright, a 390 x 844 phone with touch). It starts the app's own server from a copy in a temporary folder on a free port, uses `?sandbox=1`, and says plainly when Playwright is missing. Options: `--fast`, `--pages`, `--households`, `--rules`, `--json`, `--shots`, `--workers`, `--every`, `--port`, `--stats`.");
p("- `qa/touch-page.mjs` (what runs inside the page: census, snapshot, settle, one action's before and after), `qa/touch-lib.mjs` (households, pages, the judges both halves share, the tally), `qa/touch-static.mjs` (the plain-Node half on the fake DOM; also a command).");
p("- `tests/touch-rules.test.mjs`: inside `npm test`: the rules file is well formed and sourced, every rule is checked somewhere, the judges, and the five static rules over every page x six households with KNOWN counts that may only go down.");
p("- `qa/README.md` \"Touch and input sweep\", one paragraph in `docs/CONVENTIONS.md` (\"Touch and input\"), one sentence in AGENTS.md rule 13.");
p();
p(`## The first full sweep`);
p(`${first.households.length} households x ${first.pages.length} pages, phone ${first.phone.width} x ${first.phone.height}, the day pinned to ${first.day}. **It took ${min(first.seconds)}** with 3 browsers at once on a 4-CPU machine that 26 other agents were using (load average ${extra.load ?? "about 10"}); the fast spread (20 pages x 2 households) took ${extra.fastSeconds ? min(extra.fastSeconds) : "about 4 minutes"} under the same load. JSON: \`${DIR}/sweep-first.json\`.`);
p();
p("Households: " + first.households.map((h) => `${h.id} (${h.what})`).join("; ") + ".");
p();
p("| Rule | Concern | Runs in | Households x pages | Checked | Breaks | By kind |");
p("|---|---|---|---|---|---|---|");
const cellsOf = (id) => { const s = new Set(), pg = new Set(); for (const b of first.breaks) if (b.rule === id) { s.add(b.household); pg.add(b.page); } return [s.size, pg.size]; };
let total = 0;
for (const r of rules.rules) {
  const n = first.counts[r.id] ?? 0; total += n;
  const kinds = Object.entries(first.byKind[r.id] ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join("; ");
  const reach = first.reach?.[r.id] ?? "";
  p(`| ${r.id} | ${r.concern} | ${r.where} | ${reach} | ${first.checked[r.id] ?? 0} | **${n}** | ${kinds || "-"} |`);
}
p();
p(`**${total} breaks in all.** A break is one control failing one rule in one state for one household: one cause in the shell (the page is drawn from the top on Back) shows as hundreds of D-BACK breaks. Listed, not counted: ${first.anotherName.length} links whose words are another name for the page they open (its search words or purpose) and money boxes that keep the letters keyboard on purpose.`);
p();
p("## The ten worst pages per rule");
for (const r of rules.rules) {
  const w = first.worst[r.id] ?? [];
  if (!w.length) continue;
  p(`- **${r.id}**: ${w.map(([pg, n]) => `${pg} ${n}`).join(", ")}`);
}
p();
p("## Examples (the first break of each kind)");
const seen = new Set();
for (const b of first.breaks) {
  const k = `${b.rule}|${b.kind}`;
  if (seen.has(k)) continue; seen.add(k);
  p(`- ${b.rule}, ${b.kind}: ${b.household}, ${b.page}, ${b.state}, ${b.control}: ${String(b.measured).slice(0, 260)}`);
}
p();
p("## Same tree, same counts: the proof");
p(extra.determinism ?? "(to be filled in)");
p();
p("## What a machine could not check");
p("By hand only (qa/touch-rules.json `byHandOnly`, each with how):");
for (const h of rules.byHandOnly) p(`- ${h.id} (${h.concern}): ${h.what} Why not by machine: ${h.why}`);
p();
p("Not acted on in this sweep, and why (from the JSON's `notChecked`):");
const whys = {};
for (const u of first.notChecked) { const k = u.why.replace(/one of \d+ like/, "one of N like").replace(/in one of \d+ like/, "in one of N like").replace(/\(.*?\)/g, "").replace(/:.*$/, "").trim().slice(0, 110); whys[k] = (whys[k] ?? 0) + 1; }
for (const [k, n] of Object.entries(whys).sort((a, b) => b[1] - a[1])) p(`- ${n}: ${k}`);
p();
p(extra.limits ?? "");
p();
p("## Every threshold, its source and the day it was read");
p(`The phone: ${rules.phone.width} x ${rules.phone.height}, top bar ${rules.phone.topBar} px, pretend keyboard ${rules.phone.keyboard} px. ${rules.phone.source} Checked ${rules.phone.checked}.`);
p();
p("| Rule | Threshold | Source | Source dated | Read |");
p("|---|---|---|---|---|");
for (const r of rules.rules) p(`| ${r.id} | ${r.threshold} | ${r.source.replace(/\|/g, "/")} | ${r.sourceDate} | ${r.checked} |`);
p();
p("Marked \"ours\" (no published source could be verified): the 16 px zoom line as a figure (widely observed, no Apple or WebKit page states it), the 336 px keyboard, the 60 px jump line, the 100 px Back line, the two-screens line of D-KEYBOARD-UP, the one-shared-word line of T-LINK, D-TWICE and D-ERROR.");
p();
p(extra.checks ?? "");
console.log(out.join("\n"));
