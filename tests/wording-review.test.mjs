// tests/wording-review.test.mjs -- the review findings on the wording follow-up (2026-11-07): the month is one figure even with uneven pay
// held back, estimates keep their own rounding, months are whole numbers on every page, the tax sentences say what is paid and what is
// owed, and the pages say what a person still needs in one way. Each test renders the page as a person reads it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pageText } from "../qa/fixtures/fake-dom.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { retiredCouplePlan } from "../qa/fixtures/retired-couple-plan.mjs";
import { renterDebtPlan } from "../qa/fixtures/renter-debt-plan.mjs";
import { highFreelancerPlan } from "../qa/fixtures/round8-households.mjs";
import { heldPlan } from "../qa/fixtures/held-plan.mjs";
import { needsWords, needItem } from "../core/words.js";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const T = "2026-11-07";
const computeOf = {};
for (const g of fs.readdirSync(path.join(ROOT, "modules"))) {
  if (g.startsWith("_") || !fs.statSync(path.join(ROOT, "modules", g)).isDirectory()) continue;
  for (const id of fs.readdirSync(path.join(ROOT, "modules", g))) {
    const f = path.join(ROOT, "modules", g, id, "compute.js");
    if (!fs.existsSync(f)) continue;
    try { const m = await import(pathToFileURL(f).href); if (m.compute) computeOf[`${g}/${id}`] = m.compute; } catch { /* needs the browser */ }
  }
}
const text = (page, plan) => pageText(new URL(`../modules/${page}/view.js`, import.meta.url), plan, T, { computeOf, computeRemote: computeOf });
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const heldFamily = () => { const p = familyPlan(T); const side = (p.income ?? []).find((i) => i.id === "i-side"); if (side) side.countOn = 250; return p; };

test("D1: uneven pay held back: the month is the Dashboard's dollar figure on every page; only the full-month sentence is 'about' to ten dollars", async () => {
  const plan = heldFamily();
  const dash = await text("cashflow/budget", plan);
  const left = /\$3,6\d\d/.exec(dash)?.[0];
  assert.ok(left, "Budget says the left-over month: " + dash.slice(0, 400));
  for (const p of ["overview/next-best-action", "overview/health-score", "reports/plan-summary"]) {
    const t = await text(p, plan);
    assert.ok(t.includes(left), `${p} says ${left}`);
    assert.ok(!t.includes(left.slice(0, -1) + "0") || left.endsWith("0"), `${p} rounds the held month to ten dollars`);
  }
  const nba = computeOf["overview/next-best-action"](plan, { today: T });
  assert.ok(nba.spare.held > 0.5);
  assert.ok(src("modules/overview/next-best-action/compute.js").includes("leaves about ${money(fullMonth)}"));
});

test("D2: Plan summary keeps the ten-dollar estimates its own pages show: goal targets, what the plan can carry", async () => {
  const t = await text("reports/plan-summary", familyPlan(T));
  assert.ok(!/\$26,719|\$127,374/.test(t), "goal targets are not to the dollar");
  const s = src("modules/reports/plan-summary/view.js");
  assert.ok(s.includes("get: (g) => est(g.target)") && s.includes("est(r.affordableMonthly)"));
  const h = src("modules/overview/health-score/compute.js");
  assert.ok(h.includes("can carry about ${est(pr.affordable / 12)}"));
});

test("D3: months of cash are whole numbers (one decimal only under 2) on Benchmarks, Health score and Next best action", async () => {
  const plan = retiredCouplePlan();
  const out = {};
  for (const p of ["overview/benchmarks", "overview/health-score", "overview/next-best-action"]) out[p] = await text(p, plan);
  for (const [p, t] of Object.entries(out)) { assert.ok(!/\d+\.\d months of the bills/.test(t) || /\b[01]\.\d months of the bills/.test(t), `${p}: ${/\d+\.\d months of the bills/.exec(t)?.[0]}`); }
  assert.match(out["overview/benchmarks"], /covers 26 months/);
  assert.match(out["overview/health-score"], /covers 26 months/);
  assert.match(out["overview/next-best-action"], /covers 26 months/);
  for (const f of ["modules/overview/alerts/compute.js", "modules/overview/health-score/compute.js", "modules/overview/next-best-action/compute.js", "modules/debt/ratios/view.js"]) assert.ok(!/Math\.round\([^)]*\* 10\) \/ 10\}? months/.test(src(f)), f);
  // monthsNear (core/words.js): the same words, with one decimal only when months short of the target would round up to it
  // (stress test 2026-11-11, j-first-family/x-2: "3 months" beside "Aim for 3")
  assert.ok(src("modules/overview/alerts/compute.js").includes("monthsNear(liq.runwayMonths ?? 0, liq.targetMonths)") && src("modules/insurance/disability/view.js").includes("fmt.monthsWords(e.wait.months)"));
});

test("D4: Tax report, filing separately: 'the next dollar', brackets (no 'your' on a spouse's return, no 'ladder')", async () => {
  const plan = familyPlan(T); plan.household.filingStatus = "married_separate";
  const t = await text("reports/tax", plan);
  assert.match(t, /on [A-Z][a-z]+'s return the next dollar of regular income is taxed at \d+%/);
  assert.ok(!/return your next dollar/.test(t) && !/ladder/i.test(t.replace(/The brackets/g, "")), t.slice(0, 300));
  assert.ok(t.includes("each of you has your own brackets: the ones for a separate return."));
});

test("D5, D11: 'That is about right', not 'even so, what you owe is'; 'not entered any estimated payments'", async () => {
  const f = src("modules/taxes/federal/view.js"), r = src("modules/reports/tax/view.js");
  for (const s of [f, r]) assert.ok(!s.includes("even so, what you owe is") && !s.includes(". What you owe is"));
  // the Federal estimate's about-right case is one written sentence after the year's tax and what is paid (opt C3: `${andPaid}`)
  assert.ok(f.includes("} That is about right: within a few hundred dollars of the tax.") && r.includes(". That is about right ("));
  assert.ok(f.includes("you have not entered any estimated payments yet") && !f.includes("you have made no estimated payments yet"));
  assert.ok(r.includes('"; " : ", so "}you can expect a refund'));
  const t = await text("taxes/federal", highFreelancerPlan());
  assert.ok(!t.includes("even so"), t.slice(0, 300));
});

test("D6: Health score does not say 'the last update was over 90 days ago' for an account that was never dated", async () => {
  const t = await text("overview/health-score", {});
  assert.ok(!t.includes("over 90 days ago"));
  assert.ok(src("modules/overview/health-score/compute.js").includes("update your balances (at least every 90 days)"));
});

test("D7: Risk page: 'The mix on Will the money last? (70% stocks...)', no punctuation after the question mark", async () => {
  const t = await text("investments/risk", heldPlan());
  assert.ok(!/last\?[,;:.)]/.test(t), /.{40}last\?[,;:.)].{20}/.exec(t)?.[0]);
});

test("D8, D9: capital gains name the surtax threshold of the filing status; prioritizer help reads", async () => {
  const plan = familyPlan(T); plan.household.filingStatus = "married_separate";
  const t = await text("taxes/capital-gains", plan);
  assert.match(t, /Above \$125,000 of income \(the amount for your filing status\), investment income pays an extra 3\.8%/);
  assert.ok(!/ordinary/.test(t), "no 'ordinary' on the page");
  assert.ok(src("modules/goals/prioritizer/view.js").includes("leave blank to use what your plan has left each month"));
});

test("D10: what a retirement page needs says the same on every page: no 'type it here' where there is no box", async () => {
  const spend = "what you will spend in retirement (a figure here, or your expenses on the Expenses page)";
  assert.equal(needItem(spend), "what you will spend in retirement (on the Expenses page, or on the Will the money last? page)");
  assert.equal(needsWords("First,", ["a person with a birth date on the People page", spend]), "First, two things: a birth date on the People page and what you will spend in retirement (on the Expenses page, or on the Will the money last? page).");
  for (const p of ["retirement/roth-conversions", "retirement/withdrawal-order", "taxes/projection", "retirement/cash-flow", "retirement/buckets"]) {
    const t = await text(p, {});
    assert.ok(!t.includes("a figure here") && !t.includes("type it here"), p);
  }
});

test("D12, D14: Plan summary names the state; the score is 'out of'; Roth conversions do not say 'changing each year'", async () => {
  const t = await text("reports/plan-summary", familyPlan(T));
  assert.ok(!/ · [A-Z]{2} · /.test(t), "state spelled out");
  const h = src("modules/overview/health-score/view.js");
  assert.ok(h.includes('"out of 100"') && h.includes("out of ${p.max}`") && !h.includes("of ${p.max}`, }"));
  assert.ok(!src("modules/retirement/roth-conversions/view.js").includes("changing each year"));
  assert.ok(src("modules/investments/allocation/view.js").includes("No kind of investment has drifted too far from its target."));
  assert.ok(!src("modules/overview/setup/compute.js").includes("${cov} of ${c.months} months"));
});

test("D13: tax sentences a layperson reads right: money for a tax year, taking gains, the payments due since", () => {
  // the date itself moves past a weekend or holiday (final check: "April 18, 2028" for 2027; tests/wording-verify.test.mjs)
  assert.ok(src("modules/taxes/hsa-fsa/view.js").includes("Money for a tax year can go in until that year's April tax deadline (for ${d.year}, until ${filingDeadline(d.year)})"));
  for (const f of ["modules/reports/tax/view.js", "modules/career/side-income/view.js"]) assert.ok(src(f).includes("of the payments due since"), f);
  assert.ok(!src("modules/reports/tax/view.js").includes("due from ${longDate"));
});

test("UX 1: Plan summary says 'not known yet' when retirement savings were not entered, as Will the money last? does", async () => {
  const plan = renterDebtPlan();
  const proj = await text("retirement/projection", plan);
  const sum = await text("reports/plan-summary", plan);
  if (/We don't know yet/.test(proj)) {
    assert.match(sum, /Retirement: not known yet/);
    assert.ok(!/the money runs out in|Chance it lasts/.test(sum), sum.slice(0, 600));
  }
});

test("UX 2, 3: Will the money last? links read as part of the sentence; a past retirement is in the past; 'already paid' is explained", async () => {
  const p = src("modules/retirement/projection/view.js");
  // with no savings on file the way on is one filled "Add what you own ›" button now (stress test 2026-11-11, F4)
  assert.ok(p.includes('"Add what you own ›"') && p.includes(".pj-link { display: inline; padding: 14px 0;"));
  assert.ok(p.includes('["(on the ", ui.h("a"') && p.includes('" page)"'));
  const t = await text("retirement/projection", retiredCouplePlan());
  assert.ok(/Retirement has already begun \(Ruth at 72\)/.test(t) && !/Social Security already paid/.test(t), t.slice(0, 500));
});

test("UX 4, 5: the Dashboard names who still needs Social Security, and one goal is 'Goal'", async () => {
  const S = await import("../modules/overview/setup/compute.js");
  const plan = familyPlan(T);
  const m = S.retirementMissing(plan);
  assert.ok(m === null || /^Social Security( for [^,]+)?$|birth/.test(m), String(m));
  assert.ok(src("modules/overview/dashboard/view.js").includes('=== 1 ? "Goal" : "Goals"'));
});

test("UX 6, 8, 9: Your plan says months of bills in cash with the aim in months; Health score names pages; the match step says $ once", async () => {
  assert.ok(src("modules/overview/plan/compute.js").includes("about ${months} of bills in cash (the aim is ${target} months)"));
  const h = src("modules/overview/health-score/compute.js");
  assert.ok(h.includes("Open the Goal seek page to see the amount that just makes it last.") && h.includes("the Stress tests page shows how much each shock is short.") && !h.includes('shows it on "Just last"') && !h.includes('shows each on'));
  const n = src("modules/overview/next-best-action/compute.js");
  assert.ok(n.includes("(${exact(x.match.perCheck)} a paycheck) to get") && !n.includes("less take-home pay) to get"));
});

test("(3) PC rule: no household-visible string says 'PC' outside the places docs/DESIGN_LOG.md keeps it", () => {
  // kept: the Settings fold ("PC connection", "PC address", "Ollama on the PC"), builder pages (Diagnostics, Docs), build-only lines
  // (ctx.view.build), the status pill's build wording, internal error text and comments
  const KEEP = [/^modules\/system\/(settings|diagnostics|docs)\//, /^core\/phases\.js$/, /^core\/api\.js$/, /^modules\/_template\//];
  const bad = [];
  const walk = (dir) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (!/^(node_modules|vendor|data|golden)$/.test(e.name)) walk(rel); continue; }
    if (!/\.js$/.test(e.name) || KEEP.some((k) => k.test(rel))) continue;
    const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n");
    lines.forEach((l, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
      const code = l.replace(/\/\/.*$/, "");
      // a build-only branch (the condition is on this line or just above) or a household/builder choice (userView() ?) is the builder's wording
      if (lines.slice(Math.max(0, i - 3), i + 1).some((x) => /view\.build\b/.test(x)) || /userView\(\)/.test(code)) return;
      for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) { const s = m[2].replace(/PC connection/g, ""); if (/\bPCs?\b/.test(s)) bad.push(`${rel}:${i + 1}: ${s.slice(0, 100)}`); }
    });
  } };
  walk("modules"); walk("core");
  assert.deepEqual(bad, []);
});
