// touch/mkbuild.mjs -- build.md from the full sweep, two fast runs, the plain-Node half and a few facts (not part of the repo)
//   node mkbuild.mjs > build.md      (reads the files named in FILES and extra.json)
import fs from "node:fs";
const ROOT = "$SP/wtouch";
const DIR = "$SP/touch";
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const rules = read(`${ROOT}/qa/touch-rules.json`);
const extra = read(`${DIR}/extra.json`);
const full = read(`${DIR}/sweep-first.json`);
const fa = read(`${DIR}/${extra.fastA}`), fb = read(`${DIR}/${extra.fastB}`);
const st = read(`${DIR}/static-final.json`);
const out = [];
const p = (s = "") => out.push(s);
const min = (s) => `${Math.floor(s / 60)} min ${s % 60} s`;
const kindsOf = (j, id) => Object.entries(j.byKind[id] ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join("; ");

p("# Touch and input sweep: build report");
p();
p(`2026-11-11, claude-b. Base c385e41 (claude/creative-build-b531q0), worktree \`${ROOT}\`. Tools, tests and docs only: no page, no \`core/*\`, no CSS changed. Nothing committed, nothing pushed. Patch: \`${DIR}/patch.diff\`.`);
p();
p("## What is in the change");
p(`- \`qa/touch-rules.json\`: ${rules.rules.length} rules as data (id, concern, the check in exact terms, threshold, source with its address, the date of the source, the day it was read, where it runs: browser, node or both) and ${rules.byHandOnly.length} rules that are by hand only (\`where: "by hand"\`, what, why not by machine, how to check).`);
p("- `qa/touch-sweep.mjs`: the browser sweep. Playwright (not a dependency: it says so and stops when missing), Chromium as a 390 x 844 touch phone. It copies the app to a temporary folder, starts the app's own server there on a free local port, uses `?sandbox=1`, and pins the clock to the rules file's day. `--fast`, `--pages`, `--households`, `--rules`, `--json`, `--shots`, `--workers`, `--every`, `--port`, `--no-menu`, `--stats`, `--help`.");
p("- `qa/touch-page.mjs` (runs inside the page: census of controls, settle, one action's before and after, Back and Forward, the pretend keyboard), `qa/touch-lib.mjs` (households, pages, the judges both halves share, the tally), `qa/touch-static.mjs` (the plain-Node half on the repo's fake DOM; also a command: `node qa/touch-static.mjs --list RULE`).");
p("- `tests/touch-rules.test.mjs` inside `npm test`: the rules file is complete and sourced, every rule is checked somewhere, the judges on hand-made cases, and the six node/both rules over every offered page x six households with a KNOWN count per rule that may only go down.");
p("- `qa/README.md` section \"Touch and input sweep\"; one paragraph in `docs/CONVENTIONS.md` (\"Touch and input\"); one sentence in AGENTS.md rule 13.");
p();
p("### What this session changed in the first agent's unfinished work (resume)");
for (const x of extra.resume) p(`- ${x}`);
p();

p("## The full sweep");
p(`${full.households.length} households x ${full.pages.length} pages, plus the menu and top bar once per household (${full.households.length * full.pages.length + full.households.length} jobs). Households: ${full.households.map((h) => `${h.id} (${h.what})`).join("; ")}.`);
p();
p(`**It took ${min(full.seconds)}** with 3 browsers at once on a 4-CPU machine shared with other agents' browsers (load average ${extra.load}). ${full.runAgain ? `${full.runAgain} pages were run again from the start after the browser went away under them (launched again ${full.browserLaunchedAgain} times).` : "No page had to be run again (the browser never went away)."} JSON: \`${DIR}/sweep-first.json\`.`);
p();
p("| Rule | Concern | Runs in | Households x pages | Checked | Breaks | By kind |");
p("|---|---|---|---|---|---|---|");
let total = 0;
for (const r of rules.rules) {
  const n = full.counts[r.id] ?? 0; total += n;
  p(`| ${r.id} | ${r.concern} | ${r.where} | ${full.reach?.[r.id] ?? "-"} | ${full.checked[r.id] ?? 0} | **${n}** | ${kindsOf(full, r.id) || "-"} |`);
}
p();
p(`**${total} breaks in all.** A break is one control failing one rule in one state (as it opens, with every fold open, after tapping an opener) for one household, so one cause shows as many breaks: the worst pages say where to look. Listed in the JSON's \`listed\`, not counted: ${full.listed.length} (${Object.entries(full.listed.reduce((m, x) => ((m[x.kind] = (m[x.kind] ?? 0) + 1), m), {})).map(([k, v]) => `${v} ${k}`).join("; ")}).`);
for (const x of extra.afterTotal ?? []) p(`- ${x}`);
p();
p("## The ten worst pages per rule");
for (const r of rules.rules) {
  const w = full.worst[r.id] ?? [];
  if (!w.length) { p(`- **${r.id}**: none`); continue; }
  p(`- **${r.id}**: ${w.map(([pg, n]) => `${pg} ${n}`).join(", ")}`);
}
p();
p("## One example of each kind of break");
const seen = new Set();
for (const b of full.breaks) {
  const k = `${b.rule}|${b.kind}`;
  if (seen.has(k)) continue; seen.add(k);
  p(`- ${b.rule}, ${b.kind}: ${b.household}, ${b.page}, ${b.state}, ${b.control}${b.at ? ` at ${b.at.x},${b.at.y} (${b.at.w} x ${b.at.h})` : ""}: ${String(b.measured).slice(0, 240)}`);
}
p();

p("## The part inside `npm test` (plain Node, no browser)");
p(`${extra.staticSeconds}. Every offered page x the six households, drawn with \`qa/fixtures/fake-dom.mjs\` as each opens and once more for each "+ Add", Edit or Write button tapped (${extra.openedParts}). KNOWN (tests/touch-rules.test.mjs) is set to today's counts:`);
p();
p("| Rule | Checked | Breaks = KNOWN | Where |");
p("|---|---|---|---|");
const stw = {};
for (const b of st.breaks) { (stw[b.rule] ??= {}); stw[b.rule][b.page] = (stw[b.rule][b.page] ?? 0) + 1; }
for (const id of Object.keys(st.counts)) p(`| ${id} | ${Object.values(st.checkedBy[id] ?? {}).reduce((a, b) => a + b, 0)} | ${st.counts[id]} | ${Object.entries(stw[id] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([pg, n]) => `${pg} ${n}`).join(", ") || "-"} |`);
p();
for (const x of extra.staticNotes) p(`- ${x}`);
p();

p("## Same tree, same counts: the proof");
for (const x of extra.determinism) p(x);
p();
p("| Rule | fast run 1 | fast run 2 |");
p("|---|---|---|");
for (const r of rules.rules) p(`| ${r.id} | ${fa.counts[r.id] ?? 0} (of ${fa.checked[r.id] ?? 0}) | ${fb.counts[r.id] ?? 0} (of ${fb.checked[r.id] ?? 0}) |`);
p();
p("## How long it takes");
for (const x of extra.timing) p(`- ${x}`);
p();

p("## What a machine could not check");
p("By hand only (`byHandOnly` in qa/touch-rules.json, each with how to check it):");
for (const h of rules.byHandOnly) p(`- **${h.id}** (${h.concern}): ${h.what} Why not by machine: ${h.why} How: ${h.how}`);
p();
p("Not acted on in the full sweep, and why (the JSON's `notChecked`, grouped):");
const whys = {};
for (const u of full.notChecked) { const k = u.why.replace(/\d+ like/g, "N like").replace(/\(.*?\)/g, "").replace(/:.*$/, "").trim().slice(0, 110); whys[k] = (whys[k] ?? 0) + 1; }
for (const [k, n] of Object.entries(whys).sort((a, b) => b[1] - a[1])) p(`- ${n}: ${k}`);
p();
for (const x of extra.limits) p(`- ${x}`);
p();

p("## Every threshold, its source and the day it was read");
p(`The phone: ${rules.phone.width} x ${rules.phone.height}, top bar ${rules.phone.topBar} px, pretend keyboard ${rules.phone.keyboard} px. ${rules.phone.source} Read ${rules.phone.checked}.`);
p();
p("| Rule | Threshold | Source | Source dated | Read |");
p("|---|---|---|---|---|");
for (const r of rules.rules) p(`| ${r.id} | ${r.threshold.replace(/\|/g, "\\|")} | ${r.source.replace(/\|/g, "/")} | ${r.sourceDate} | ${r.checked} |`);
p();
for (const x of extra.sourceNotes) p(`- ${x}`);
p();
p("## Checks run on the worktree");
for (const x of extra.checks) p(`- ${x}`);
process.stdout.write(out.join("\n") + "\n");
