import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, savingsMultiple, ageGroup, RULES } from "./compute.js";
import { MEDIAN_NET_WORTH_BY_AGE } from "./data/scf.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const item = (d, id) => d.items.find((x) => x.id === id);

test("the tables: age groups cover every age; Fidelity's multiples and the line between them", () => {
  for (let a = 18; a <= 110; a++) assert.ok(ageGroup(a), String(a));
  assert.equal(ageGroup(34).label, "under 35"); assert.equal(ageGroup(35).label, "35 to 44"); assert.equal(ageGroup(80).median, MEDIAN_NET_WORTH_BY_AGE.at(-1).median);
  assert.equal(savingsMultiple(30), 1); assert.equal(savingsMultiple(40), 3); assert.equal(savingsMultiple(67), 10); assert.equal(savingsMultiple(75), 10); assert.equal(savingsMultiple(20), 0);
  assert.ok(Math.abs(savingsMultiple(36) - 2.2) < 1e-9, "between 35 (2x) and 40 (3x)");
});

test("no birth date: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family against the benchmarks", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.equal(d.age, 36); assert.equal(d.group.label, "35 to 44");
  const nw = item(d, "net-worth"); assert.equal(nw.verdict, "ahead"); assert.equal(nw.benchmark, 155600);
  const m = item(d, "savings-multiple"); assert.ok(Math.abs(m.you - 159000 / (163800 + 7200)) < 1e-9, "pay counts Bo's photography business"); assert.equal(m.verdict, "rule", "behind the guideline, but the plan lasts");
  const r = item(d, "saving-rate"); assert.ok(Math.abs(r.you - (470 * 26 + 3050 + 3600) / (163800 + 7200)) < 1e-9); assert.equal(r.verdict, "rule");
  assert.equal(item(d, "cash").verdict, "behind");
  const h = item(d, "housing"); assert.ok(Math.abs(h.you - 1980 / 14250) < 1e-9); assert.equal(h.verdict, "ahead");
  assert.equal(item(d, "debt").verdict, "ahead");
  assert.equal(d.ahead, 3); assert.equal(d.judged, 6);
  assert.equal(RULES.saving, 0.15);
});

test("the retirement rules of thumb read against the plan's own answer: behind but lasting is not amber", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { savingVerdict } = await import("../../retirement/projection/compute.js");
  const p = familyPlan("2026-11-02"), T = { today: "2026-11-02" };
  assert.equal(savingVerdict(p, T).verdict, "on track");
  const d = compute(p, T);
  for (const id of ["savings-multiple", "saving-rate"]) {
    const x = d.items.find((y) => y.id === id);
    assert.equal(x.verdict, "rule", id); assert.match(x.sentence, /Behind the rule of thumb, but your own plan lasts/);
  }
  // no Social Security yet: the plan has no answer, so the rule of thumb stands alone
  p.retirement.socialSecurity = {};
  assert.equal(savingVerdict(p, T), null);
  assert.equal(compute(p, T).items.find((y) => y.id === "saving-rate").verdict, "behind");
});

test("round 7 (2026-11-06): a birth date after today (a typo) waits for a real one instead of failing", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-11-06"); p.household.people.find((y) => y.id === "p-ana").birthDate = "2031-01-01";
  const d = compute(p, { today: "2026-11-06" });
  assert.equal(d.ready, false); assert.deepEqual(d.missing, ["a birth date before today on the People page"]);
});

test("round 8: a renter's debt payments against the renters' line (15 to 20% or less, rent not counted), with the housing figure", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const d = compute(renterDebtPlan(), { today: "2026-11-06" });
  const x = item(d, "debt");
  assert.equal(x.benchmark, 0.2); assert.equal(x.verdict, "behind");
  assert.match(x.sentence, /\(\$670 a month\) are 21% of income before tax; for renters the guideline is 20% or less, rent not counted/);
  assert.match(x.sentence, /like your \$950 rent and a lender would see 50% of your income going to debts: more than most lenders accept/);
  // the family (a mortgage): unchanged
  assert.equal(item(compute(familyPlan(), { today: TODAY }), "debt").benchmark, RULES.debt);
});

// --- round 8 (2026-11-06), widow-7: a retired household gets no pay-based rows; the cash aim is the plan's own ---------------
test("round 8: retired, the pay rows give way to the plan's own answer; cash is judged against the plan's aim", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const T = { today: "2026-11-06" };
  const p = retiredCouplePlan();
  p.household.people.find((x) => x.id === "p-sam").retirementAge = 65;   // both stopped: every adult retired
  p.accounts.find((a) => a.id === "a-sav").balance = 2150;                 // about 5 months of must-pay bills in cash
  // Sam's pension, no Social Security: said in Get started, so the plan's own answer can be read
  const unknown = item(compute(p, T), "retirement-money");
  assert.equal(unknown.verdict, "unknown"); assert.match(unknown.sentence, /once the plan has what it needs/);
  p.guide = { setup: { ss: { "p-sam": "none" } } };
  const d = compute(p, T);
  // no "Needs pay on the Income page" a retiree can never fill, no saving-rate row
  assert.equal(item(d, "savings-multiple"), undefined); assert.equal(item(d, "saving-rate"), undefined);
  assert.ok(!d.items.some((x) => /Needs pay/.test(x.sentence)));
  const own = item(d, "retirement-money");
  assert.equal(own.verdict, "lasts"); assert.deepEqual(own.go, ["retirement", "projection"]); assert.match(own.sentence, /Will the money last\?/);
  // the cash aim is the plan's (assumptions.emergencyMonths, 6 by default): 5 months is "on par", not "ahead" of 3
  const cash = item(d, "cash");
  assert.ok(cash.you > 4.5 && cash.you < 5.5, String(cash.you));
  assert.equal(cash.benchmark, 6); assert.equal(cash.verdict, "on par");
  assert.match(cash.sentence, /your plan aims for 6/);
  p.assumptions.emergencyMonths = 4;
  assert.equal(item(compute(p, T), "cash").verdict, "ahead", "at or past the plan's own aim");
  // still working: the pay rows as before
  assert.ok(item(compute(retiredCouplePlan(), T), "savings-multiple"));
});

// --- round 8 review (2026-11-06): D3 required payments, D7 the percent shown, one rule for "over the line", a lasting plan ------
test("review D3 and D7: a renter's debt row is of the required payments, graded at the percent shown", async () => {
  const { renterDebtPlan, renterPayingExtraPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const x = item(compute(renterPayingExtraPlan(), { today: "2026-11-06" }), "debt");
  assert.ok(Math.abs(x.you - 320 / 3250) < 1e-12); assert.equal(x.verdict, "ahead");
  assert.match(x.sentence, /^Required payments on loans and cards \(\$320 a month\) are 10% of income before tax/);
  assert.match(x.sentence, /lender would see 39% of your income going to debts/);
  const p = renterDebtPlan(); p.debts.find((d) => d.id === "setup-debt-credit").minPayment = 140;   // 20.3%, shown as 20%
  assert.equal(item(compute(p, { today: "2026-11-06" }), "debt").verdict, "on par");
});

test("review UX: one rule on every row: over the line is behind (housing at 29% against 28%, a homeowner's debts at 37% against 36%)", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  // $950 rent on $3,250: 29.2%
  const h = item(compute(renterDebtPlan(), { today: "2026-11-06" }), "housing");
  assert.equal(h.verdict, "behind");
  // a homeowner (a home on file) paying $1,203 of $3,250 to debts: 37.0%
  const q = renterDebtPlan(); q.accounts.push({ id: "home", name: "Home", type: "property", balance: 150000 });
  q.debts.find((d) => d.id === "setup-debt-car-loan").minPayment = 883;
  assert.equal(item(compute(q, { today: "2026-11-06" }), "debt").verdict, "behind");
  // at the line, shown as 28%: on par
  const r = renterDebtPlan(); r.expenses.find((x) => x.category === "housing").amount = 920;
  assert.equal(item(compute(r, { today: "2026-11-06" }), "housing").verdict, "on par");
});

test("review UX: retired and the plan lasts: counted as ahead, in green", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const p = retiredCouplePlan();
  p.household.people.find((x) => x.id === "p-sam").retirementAge = 65;
  p.guide = { setup: { ss: { "p-sam": "none" } } };
  const d = compute(p, { today: "2026-11-06" });
  const own = item(d, "retirement-money");
  assert.equal(own.verdict, "lasts");
  assert.equal(d.ahead, d.items.filter((x) => x.verdict === "ahead" || x.verdict === "lasts").length);
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const t = await pageText(new URL("./view.js", import.meta.url), p, "2026-11-06");
  assert.match(t, new RegExp(`Ahead on ${d.ahead} of ${d.judged}`));
});

// --- verify (2026-11-06): retired, and the plan lasts only just ("It lasts, just" on Will the money last?) ---------------------------
test("verify: retired and the plan lasts only just: on par, not ahead", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { savingVerdict } = await import("../../retirement/projection/compute.js");
  const T = { today: "2026-11-06" };
  const p = retiredCouplePlan();
  p.household.people.find((x) => x.id === "p-sam").retirementAge = 65;
  p.guide = { setup: { ss: { "p-sam": "none" } } };
  // $6,000 a month against about $6,330 it can carry (105%): the projection's "tight" (lasts, under 115%; "It lasts, just")
  p.retirement.spendingMonthly = 6000;
  const v = savingVerdict(p, T);
  assert.equal(v.verdict, "tight"); assert.ok(v.affordable / v.spendingYearly > 1 && v.affordable / v.spendingYearly < 1.15);
  const d = compute(p, T), own = item(d, "retirement-money");
  assert.equal(own.verdict, "on par");
  assert.match(own.sentence, /lasts, but only just/);
  assert.equal(d.ahead, d.items.filter((x) => x.verdict === "ahead" || x.verdict === "lasts").length);
});

test("the emergency fund's bar says the months as the sentence does: 5.7 is never 'you 6 months' beside 'aim 6' (review 2026-11-11 N17)", async () => {
  const fs = await import("node:fs");
  const { monthsNear } = await import("../../../core/words.js");
  const view = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(view.includes('x.unit === "months" ? monthsNear(v, x.benchmark)') && !view.includes("fmt.monthsWords"), "the bar's labels use monthsNear");
  assert.equal(monthsNear(5.7, 6), "5.7 months");
  assert.equal(monthsNear(6.42, 6), "6.4 months");
  assert.equal(monthsNear(6, 6), "6 months");
});

// --- plain words (spec 13.1, C10, 2026-11-13): the share first, then the line; no "Fannie Mae's limit for loans checked by hand",
// no "debt-to-income"; "income before tax" stays (the figure is every income, rent and pensions too, not only pay) --------------
test("C10 plain words: housing and debt rows lead with what they are, then the share of income before tax; figures and verdicts unchanged", async () => {
  const fam = compute(familyPlan(), { today: TODAY });
  const h = item(fam, "housing"), dt = item(fam, "debt");
  assert.equal(h.sentence, "Housing ($1,980 a month) is 14% of income before tax; lenders like 28% or less.");
  assert.equal(h.source, "The lenders' housing guideline: 28% or less of income before tax");
  assert.ok(Math.abs(h.you - 1980 / 14250) < 1e-9); assert.equal(h.benchmark, 0.28); assert.equal(h.verdict, "ahead");
  assert.equal(dt.sentence, "Loan and card payments ($2,790 a month) are 20% of income before tax; under 36% is comfortable.");
  assert.equal(dt.source, "Mortgage lenders' usual guideline: 36% or less of income before tax. Many approve up to 43 to 50% with good credit and savings, but above 43% payments get tight.");
  assert.equal(dt.benchmark, RULES.debt); assert.equal(dt.verdict, "ahead");
  for (const x of fam.items) assert.doesNotMatch(`${x.sentence} ${x.source}`, /Fannie Mae|checked by hand|front-end|back-end|gross income|debt-to-income/i, x.id);
  // the renter: required payments, the renters' line, the home lender's figure after it (words from Debts, unchanged)
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const r = compute(renterDebtPlan(), { today: "2026-11-06" });
  const rd = item(r, "debt");
  assert.match(rd.sentence, /^Required payments on loans and cards \(\$670 a month\) are 21% of income before tax; for renters the guideline is 20% or less, rent not counted\. /);
  assert.equal(rd.source, "Consumer Financial Protection Bureau's guide to debt payments: renters 15 to 20% or less, rent not counted");
  assert.equal(rd.benchmark, 0.2); assert.equal(rd.verdict, "behind");
  assert.equal(item(r, "housing").sentence, "Housing ($950 a month) is 29% of income before tax; lenders like 28% or less.");
  // the page: "These comparisons", never "Benchmarks are"
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const t = await pageText(new URL("./view.js", import.meta.url), familyPlan(), TODAY);
  assert.match(t, /These comparisons are a compass, not a grade/); assert.doesNotMatch(t, /Benchmarks are/);
});

// --- critic C10 #3 (2026-11-13): the homeowner's grey line under Debt payments says which line ("usual line" alone did not) -----------
test("critic C10 #3: the debt row's grey line names the 36% line, for a family and for a retired couple with no debt; figures unchanged", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const LINE = "Mortgage lenders' usual guideline: 36% or less of income before tax. Many approve up to 43 to 50% with good credit and savings, but above 43% payments get tight.";
  const fam = item(compute(familyPlan(), { today: TODAY }), "debt");
  assert.equal(fam.source, LINE); assert.equal(fam.benchmark, 0.36); assert.equal(fam.verdict, "ahead");
  const rc = compute(retiredCouplePlan(), { today: TODAY });
  const dt = item(rc, "debt");
  assert.ok(dt, "the retired couple has a debt row");
  assert.equal(dt.source, LINE);
  assert.match(dt.sentence, /^Loan and card payments \(\$[\d,]+ a month\) are \d+% of income before tax; under 36% is comfortable\.$/);
  for (const x of rc.items) assert.doesNotMatch(x.source, /usual line\b/, x.id);
});
