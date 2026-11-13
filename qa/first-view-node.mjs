// qa/first-view-node.mjs -- the first-view check (qa/first-view-lib.mjs) over every usable page in one run: what each
// page shows before any tap against its kind's budget (tests/first-view.kinds.mjs) and its entry in
// tests/first-view.known.json, the totals, and the time. `npm test` runs the same check as six shards
// (tests/first-view/1..6.test.mjs); this is the whole picture, and the way to rewrite the counts file.
//
//   node qa/first-view-node.mjs                     every usable page
//   node qa/first-view-node.mjs taxes/federal debt  some pages (a group name: every page in it)
//   node qa/first-view-node.mjs --write             rewrite the counts file from what is measured now (only the pages
//                                                   measured); read its diff like code: a count may only go down
//   node qa/first-view-node.mjs --json out.json     the raw drawings' counts and checks too
//   node qa/first-view-node.mjs --shards            each shard's pages and time (to rebalance the kinds file)
// Exit code 1 when a page fails the rule (claude-a's folders never do: to-do lines only).
import fs from "node:fs";
import { loadApp, measurePage, judge, entryFor, worst, readKnown, writeKnown, budgetFor } from "./first-view-lib.mjs";
import * as K from "../tests/first-view.kinds.mjs";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (n) => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const write = flag("--write"), shards = flag("--shards"), jsonOut = opt("--json");
const t0 = performance.now();
const app = await loadApp();
const pick = args.length ? app.usable.filter((k) => args.some((a) => k === a || k.split("/")[0] === a)) : app.usable;
const known = readKnown();
const results = {}, fails = [], rows = [];
const FIELDS = ["words", "figs", "boxes", "tiles", "filled", "parts"];
const cell = (v) => (v === null || v === undefined ? "-" : String(v));
for (const key of pick) {
  const [kind, shard] = K.KINDS[key] ?? ["answer", 0];
  const lane = K.CLAUDE_A_LANE.includes(key);
  const r = await measurePage(key, { moved: K.MOVED_NOTICES[key] ?? [] });
  results[key] = r;
  const v = judge(r, kind, lane ? null : known[key], K);
  const w = worst(r);
  const plan = FIELDS.map((f) => cell(w.plan[f]?.[0])).join("/"), budget = FIELDS.map((f) => cell(budgetFor(kind, K.BUDGETS, f, w.plan[f] ? r.households[w.plan[f][1]] : null))).join("/");
  const empty = FIELDS.map((f) => cell(w.empty[f]?.[0])).join("/");
  const state = lane ? (v.fails.length ? "to-do" : "ok") : v.fails.length ? "FAIL" : known[key] ? "entry" : "ok";
  rows.push({ key, kind, shard, state, plan, budget, empty, checks: r.checks.map((c) => c.id).join(" "), ms: Math.round(r.ms), lower: v.notes.filter((x) => x.startsWith("lower me")).length });
  if (!lane && v.fails.length) fails.push(`${key}:\n    ${v.fails.join("\n    ")}`);
  if (!K.KINDS[key]) fails.push(`${key}: no kind in tests/first-view.kinds.mjs`);
}
console.log(`page`.padEnd(32), "kind".padEnd(9), "sh", "state".padEnd(6), "plan worst w/f/b/t/fl/p".padEnd(26), "budget".padEnd(20), "empty".padEnd(20), "checks", "ms");
for (const x of rows) console.log(x.key.padEnd(32), x.kind.padEnd(9), String(x.shard).padEnd(2), x.state.padEnd(6), x.plan.padEnd(26), x.budget.padEnd(20), x.empty.padEnd(20), (x.checks || "-").padEnd(6), x.ms, x.lower ? `(lower me ${x.lower})` : "");
// totals: claude-a's folders are kept out of every total that may only go down
const mine = rows.filter((x) => !K.CLAUDE_A_LANE.includes(x.key));
const byKind = {};
for (const x of mine) { const k = (byKind[x.kind] ??= { pages: 0, entry: 0 }); k.pages++; if (known[x.key]?.plan) k.entry++; }
const overNow = (scope) => mine.filter((x) => { const r = results[x.key], w = worst(r); return FIELDS.some((f) => { const v = w[scope][f]; if (!v) return false; const b = scope === "empty" ? K.EMPTY_BUDGET[f] : budgetFor(x.kind, K.BUDGETS, f, r.households[v[1]]); return b !== null && b !== undefined && v[0] > b; }); }).length;
const behind = Object.values(results).reduce((s, r) => s + Math.max(0, ...Object.values(r.households).map((c) => c.behind ?? 0)), 0);
console.log(`\n${rows.length} pages (${rows.length - mine.length} in claude-a's folders, to-do only). Over their kind's budget now: ${overNow("plan")} of ${mine.length} with a plan, ${overNow("empty")} on the empty plan.`);
console.log(`With a plan entry in the counts file, by kind: ${Object.entries(byKind).map(([k, v]) => `${k} ${v.entry} of ${v.pages}`).join(", ")}.`);
console.log(`Words behind shut sections (the worst household of each page, summed): ${behind}.`);
const checks = {};
for (const r of Object.values(results)) for (const c of r.checks) checks[c.id] = (checks[c.id] ?? 0) + 1;
console.log(`Structure checks that found something: ${Object.entries(checks).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}.`);
if (shards) {
  const by = {};
  for (const x of rows) { const s = (by[x.shard] ??= { pages: 0, ms: 0 }); s.pages++; s.ms += x.ms; }
  for (const [s, v] of Object.entries(by)) console.log(`shard ${s}: ${v.pages} pages, ${(v.ms / 1000).toFixed(1)} s of drawing in this process`);
}
console.log(`Done in ${((performance.now() - t0) / 1000).toFixed(1)} s.`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results));
if (write) {
  const next = { ...known, _read: "Counts a page's first view may not rise above (tests/first-view.kinds.mjs has the budgets; qa/first-view-lib.mjs the rule). Only pages over a budget are here: plan = the worst of family, renterDebt, retiredCouple (words rounded up to the next ten), empty = the empty plan, checks = how often a structure check finds something (docs/OPTIONAL.md S1 to S16, L = an error after the draw), cannotDraw = households the page cannot be drawn for in Node yet. A count may only go down: lower it in the same commit as the change that brought it down. Rewritten by node qa/first-view-node.mjs --write; read the diff like code." };
  for (const key of pick) {
    if (K.CLAUDE_A_LANE.includes(key)) { delete next[key]; continue; }
    const e = entryFor(results[key], K.KINDS[key]?.[0] ?? "answer", K);
    if (e) next[key] = e; else delete next[key];
  }
  console.log(`wrote ${writeKnown(next)}${fails.length ? ": the counts below are written down now" : ""}`);
}
if (fails.length) { console.log(`\n${fails.length} page(s) fail the rule:\n  ${fails.join("\n  ")}`); if (!write) process.exitCode = 1; }
