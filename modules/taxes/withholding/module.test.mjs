// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, yearTax } from "./compute.js";
import { compute as computeFederal } from "../federal/compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("withholding: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

import { paychecksLeft } from "./compute.js";

// a single filer with 30,000 of interest: 2026 tax = 10% x 12,400 + 12% x (13,900 - 12,400) = 1,420
const interestPlan = (fill) => {
  const p = emptyPlan(); p.household.filingStatus = "single";
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1980-01-01" });
  p.taxes.thisYear.otherOrdinary = 30000;
  fill(p); return p;
};

test("withholding: paychecks left are a full year before the year, none once it is over (IRC 31(a)(2))", () => {
  assert.equal(paychecksLeft("biweekly", "2025-12-01", 2026), 26);
  assert.equal(paychecksLeft("biweekly", "2027-01-10", 2026), 0);   // January's paychecks count for 2027
  assert.equal(paychecksLeft("monthly", "2026-10-01", 2026), 2);    // floor(91 / 365.25 x 12)
  const p = interestPlan((q) => { q.taxes.year = 2026; q.taxes.withholding = { self: { perPaycheck: 100, period: "monthly" } }; q.taxes.thisYear.withheld = 900; });
  assert.equal(compute(p, { today: "2027-01-10" }).withholding.projected, 900);   // what was withheld in 2026, nothing more
});

test("withholding: a typed 0 so far is a figure (the Federal estimate page sets withheldTyped), a blank runs the whole year", () => {
  const blank = interestPlan((q) => { q.taxes.withholding = { self: { perPaycheck: 100, period: "monthly" } }; });
  assert.equal(compute(blank, { today: "2026-10-01" }).withholding.projected, 1200);
  const zero = interestPlan((q) => { q.taxes.withholding = { self: { perPaycheck: 100, period: "monthly" } }; q.taxes.thisYear.withheld = 0; q.taxes.thisYear.withheldTyped = true; });
  assert.equal(compute(zero, { today: "2026-10-01" }).withholding.projected, 200);   // 0 so far + 2 paychecks left
});

test("withholding: the $1,000 test counts withholding only, not estimated payments (IRC 6654(e)(1))", () => {
  // tax 1,420 + 4,500 more interest at 12%: 30,000 -> 34,500 interest gives 1,420 + 540 = 1,960; withheld 900 -> 1,060 short of the tax
  const p = interestPlan((q) => { q.taxes.thisYear.otherOrdinary = 34500; q.taxes.thisYear.withheld = 900; q.taxes.estimated.paid = [200, 0, 0, 0]; });
  const d = compute(p, { today: "2026-12-31" });
  assert.equal(Math.round(d.totalTax), 1960);
  assert.ok(d.balance < 1000);                       // 1,960 - 900 - 200 = 860 after the estimate
  assert.equal(d.penaltyRisk, true);                 // but tax less withholding is 1,060 and 1,100 paid misses 90% (1,764)
});
test("withholding: an amount so far with no paycheck figure says the figure is missing, not that nothing is withheld", () => {
  const p = interestPlan((q) => { q.taxes.thisYear.otherOrdinary = 34500; q.taxes.thisYear.withheld = 900; });
  const d = compute(p, { today: "2026-06-30" });
  assert.equal(d.verdict, "owe");
  assert.equal(d.suggestion.kind, "estimates");
  assert.match(d.suggestion.text, /^No paycheck figure is typed yet/);
  assert.match(d.suggestion.text, /What a paycheck withholds/);
});

test("one answer to refund or owe: typed figures, else withholding estimated from pay; every page reads the same balance", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: estimated } = await import("../estimated/compute.js");
  const { withholdingEstimate, taxAnswer } = await import("./compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  const e = withholdingEstimate(p, { today: T });
  assert.equal(e.from, "paycheck", "no pay stub figure typed: estimated from pay");
  assert.ok(e.projected > 0); assert.equal(e.people.length, 2);
  assert.ok(Math.abs(e.projected - e.people.reduce((t, x) => t + x.yearly, 0)) < 0.01);
  const d = compute(p, { today: T });
  assert.equal(d.verdict, "unknown", "the typed-only verdict is unchanged (the answer key checks it)");
  assert.equal(d.estimate.verdict, d.estimate.balance >= 500 ? "owe" : d.estimate.balance <= -500 ? "refund" : "about right");
  const a = taxAnswer(p, { today: T });
  const est = estimated(p, { today: T });
  assert.ok(Math.abs(a.balance - est.balanceAtFiling) < 0.01, "Estimated payments and the tax answer agree");
  assert.ok(Math.abs(a.balance - d.estimate.balance) < 0.01, "Withholding check and the tax answer agree");
  assert.equal(est.withholdingFrom, "paycheck");
  // a typed paycheck figure wins
  p.taxes.withholding = { self: { perPaycheck: 400, period: "biweekly" }, partner: { perPaycheck: 500, period: "monthly" } };
  const t = withholdingEstimate(p, { today: T });
  assert.equal(t.from, "typed"); assert.equal(t.projected, compute(p, { today: T }).withholding.projected);
  assert.equal(taxAnswer(p, { today: T }).from, "typed");
  // no income: no answer
  assert.equal(taxAnswer(emptyPlan(), { today: T }), null);
});

test("review: one earner typed, only the year so far typed, other payments: never an earner at $0, and paid counts", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { withholdingEstimate, taxAnswer, paychecksLeft } = await import("./compute.js");
  const T = "2026-11-02";
  const base = taxAnswer(familyPlan(T), { today: T });
  // Ana's stub typed at about the estimate, Bo blank: Bo stays estimated from pay
  const p = familyPlan(T);
  const anaEst = withholdingEstimate(p, { today: T }).people.find((x) => x.name === "Ana");
  p.taxes.withholding = { self: { perPaycheck: Math.round(anaEst.perPaycheck), period: "biweekly" } };
  const mixed = withholdingEstimate(p, { today: T });
  assert.equal(mixed.from, "mixed");
  assert.deepEqual(mixed.people.map((x) => [x.name, x.estimated]), [["Ana", false], ["Bo", true]]);
  assert.ok(Math.abs(taxAnswer(p, { today: T }).balance - base.balance) < 50, "about the same April bill, not $8,728");
  // only the year so far typed: the paychecks left still count, estimated from pay
  const q = familyPlan(T);
  q.taxes.thisYear = { ...(q.taxes.thisYear ?? {}), withheld: 8000, withheldTyped: true };
  const so = withholdingEstimate(q, { today: T });
  assert.equal(so.from, "mixed");
  const rest = so.people.reduce((t, x) => t + x.perPaycheck * paychecksLeft(x.period, T, 2026), 0);
  assert.ok(rest > 0); assert.ok(Math.abs(so.projected - (8000 + rest)) < 0.01);
  // other payments typed on the Federal estimate count as paid
  const r = familyPlan(T);
  r.taxes.thisYear = { ...(r.taxes.thisYear ?? {}), paid: 3000 };
  const a = taxAnswer(r, { today: T });
  assert.ok(Math.abs(a.balance - (base.balance - 3000)) < 0.01); assert.equal(a.paid, 3000);
  // the W-4 change on the estimate is per paycheck, on the main earner's paychecks left
  const s = compute(familyPlan(T), { today: T }).estimate.suggestion;
  assert.equal(s.kind, "add"); assert.ok(s.paychecks > 0); assert.equal(s.perPaycheck, Math.ceil(base.balance / s.paychecks));
});

test("review: the year's tax counts self-employment tax on business income, as the Self-employment page works it out", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: fedOf } = await import("../federal/compute.js");
  const { compute: seOf } = await import("../self-employment/compute.js");
  const { taxAnswer } = await import("./compute.js");
  const { compute: estOf } = await import("../estimated/compute.js");
  const T = { today: "2026-11-02" };
  const p = familyPlan("2026-11-02");   // Bo's weekend photography: $600 a month of business income
  const d = compute(p, T), fed = fedOf(p, T).result.totalTax, se = seOf(p, T);
  assert.ok(se.ready && se.seTotal > 0);
  // the business at its profit with its 20% deduction after AGI (Form 1040 line 13: the Federal estimate's figures, known.js,
  // round 8 item 20); the Self-employment page takes the deduction off AGI, so its AGI is 1,338 lower and the family's child
  // care credit one point higher: 30 less tax than the law gives (taxes/federal README, care section)
  const { known } = await import("../federal/known.js");
  assert.equal(d.incomeTax, fed); assert.equal(d.totalTax, known(p, T).total); assert.ok(Math.abs(d.totalTax - (se.taxWith + 30)) < 0.01);
  assert.ok(d.seTax > 0 && d.seTax < se.seTotal, "the 15.3% tax less what its two deductions save");
  assert.equal(taxAnswer(p, T).seTax, d.seTax);
  assert.equal(estOf(p, T).totalTax, d.totalTax, "Estimated payments uses the same year's tax");
  p.income = p.income.filter((x) => x.type !== "business");
  const n = compute(p, T);
  assert.equal(n.seTax, 0); assert.equal(n.totalTax, fedOf(p, T).result.totalTax, "no business: the Federal estimate's total");
});

// ---- the walk ends at the whole tax (round 4, 2026-11-02)
import { fullSteps, taxAnswer, takeHomeMore, separateBusiness, addJanuary, addJanuaryWords } from "./compute.js";
import { compute as fedOf } from "../federal/compute.js";
import { familyPlan as famOf } from "../../../qa/fixtures/family-plan.mjs";
test("fullSteps: the business rows go in before Federal tax, which ends at yearTax's total; no business, no change", () => {
  const p = famOf("2026-11-02"), fed = fedOf(p, { today: "2026-11-02" });
  const f = fullSteps(p, fed, { today: "2026-11-02" });
  const labels = f.steps.map((x) => x.label);
  // round 8 item 20: the walk is worked with the business at its profit (half its self-employment tax under Adjustments, the
  // 20% deduction after the standard one), so the "Tax saved by business deductions" patch line is gone
  assert.deepEqual(labels.slice(-3), ["Child and dependent care credit", "Self-employment tax", "Federal tax"]);
  assert.ok(labels.includes("Business deduction (20%)")); assert.ok(!labels.includes("Tax saved by business deductions"));
  const ft = f.steps[f.steps.length - 1];
  assert.equal(ft.amount, taxAnswer(p, { today: "2026-11-02" }).totalTax); assert.equal(f.total, ft.amount);
  // the rows add up: the income tax after the credits, plus the self-employment tax
  const credits = f.steps.filter((x) => /credit/i.test(x.label)).reduce((t, x) => t + x.amount, 0);
  const incomeTax = f.steps.find((x) => x.label === "Income tax").amount, se = f.steps[f.steps.length - 2].amount;
  assert.ok(Math.abs(incomeTax + credits + se - f.total) < 0.01);
  assert.equal(fed.steps.find((x) => x.label === "Federal tax").amount, fed.result.totalTax, "the engine's own walk is untouched");
  p.income = p.income.filter((x) => x.type !== "business");
  const g = fullSteps(p, fedOf(p, { today: "2026-11-02" }), { today: "2026-11-02" });
  assert.equal(g.se, null); assert.ok(!g.steps.some((x) => x.label === "Self-employment tax"));
});

/** Jo, the single parent (the reviewer's plan): head of household in Ohio, 62,000 of pay, a child born 2022-07-15, 900 a
 * month of daycare; `acct` a child care account for 2026 on Benefits elections. */
function jo({ pay = 62000, acct = 0, care = 900, kids = 1 } = {}) {
  const p = emptyPlan();
  p.household.filingStatus = "head_of_household"; p.household.state = "OH";
  p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  if (kids > 1) p.household.people.push({ id: "kid2", name: "Lou", role: "dependent", birthDate: "2019-09-01" });
  p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: pay, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "rent", name: "Rent", category: "housing", amount: 1300, period: "monthly", essential: true }];
  if (care) p.expenses.push({ id: "care", name: "Childcare and school", category: "childcare", amount: care, period: "monthly", essential: true });
  if (acct) p.whatIfs = { benefits: { jo: { dcfsaElect: acct, planYear: 2026 } } };
  return p;
}

test("withholding: a refund counts the credits past the tax; the headline, the walk and the check agree (the reviewer's page #6)", () => {
  const NOV = "2026-11-02";
  // Jo at 30,000: income tax 585, the care credit takes it all, and 1,700 of the child tax credit is refundable: the walk ends
  // at -1,700. Withholding estimated from pay is 585 (the paychecks' 10% on 5,850), so the refund is 585 + 1,700 = 2,285 (the
  // page said 585)
  const plan = jo({ pay: 30000 });
  const fed = computeFederal(plan, { today: NOV });
  assert.equal(fed.result.totalTax, -1700);
  const full = fullSteps(plan, fed, { today: NOV });
  assert.equal(full.total, -1700); assert.equal(full.steps.find((s) => s.label === "Federal tax").amount, -1700);
  const yt = yearTax(plan, fed, { today: NOV });
  assert.deepEqual([yt.total, yt.owed, yt.back], [-1700, 0, 1700]);
  const a = taxAnswer(plan, { today: NOV });
  assert.equal(a.totalTax, 0); assert.equal(a.creditsBack, 1700); assert.equal(a.verdict, "refund");
  near(a.balance, -1700 - a.projected); near(a.projected, 585, 1); near(a.balance, -2285, 1);
  const d = compute(plan, { today: NOV });
  near(d.estimate.balance, a.balance);
  // two children and a 5,000 account: the walk's -1,162; refund 3,588 withheld + 1,162 = 4,750
  const two = jo({ acct: 5000, kids: 2 });
  const t2 = taxAnswer(two, { today: NOV });
  assert.equal(computeFederal(two, { today: NOV }).result.totalTax, -1162); near(t2.balance, -1162 - t2.projected); near(t2.balance, -4750, 1);
});

test("could take home more per paycheck: never the refundable credits, never more than a paycheck withholds (care fourth pass)", () => {
  const NOV = "2026-11-02";
  // Jo at 30,000: the refund is 585 withheld + 1,700 of refundable credit. The credit comes back whatever the W-4 says, so the
  // W-4 can give back only the 585, and no paycheck can withhold less than nothing: 22.50 each, 4 paychecks left -> 22 (the
  // page said "$571 a paycheck lent to the IRS")
  const low = compute(jo({ pay: 30000 }), { today: NOV }).estimate;
  const each = low.people[0].perPaycheck;
  near(each, 22.5, 0.01); assert.equal(low.people[0].left, 4);
  assert.deepEqual([low.suggestion.kind, low.suggestion.perPaycheck, low.suggestion.all], ["cut", 22, true]);
  // two children and a 5,000 account: 4,750 back, 1,162 of it credits; 138 withheld a paycheck: 138 (the page said 1,187)
  const two = compute(jo({ acct: 5000, kids: 2 }), { today: NOV }).estimate;
  near(two.balance, -4750, 1); assert.equal(two.suggestion.perPaycheck, Math.floor(two.people[0].perPaycheck)); assert.equal(two.suggestion.perPaycheck, 138);
  // Jo with no account: no refundable credit, but 3,250 back over 4 paychecks would be 812 a paycheck, more than the 161.08 each
  // withholds: 161
  const no = compute(jo(), { today: NOV }).estimate;
  near(no.balance, -3250, 1); assert.equal(no.suggestion.perPaycheck, 161); assert.ok(no.suggestion.perPaycheck <= no.people[0].perPaycheck);
  // Step 3 is a yearly amount: 161 x 26 paychecks
  assert.equal(no.suggestion.step3, 161 * 26);
  // the helper: nothing over the tax, nothing to cut; a cut under each paycheck's withholding is not capped
  assert.equal(takeHomeMore(0, { left: 4, perPaycheck: 100 }), null); assert.equal(takeHomeMore(-50, { left: 4, perPaycheck: 100 }), null);
  assert.deepEqual(takeHomeMore(200, { left: 4, perPaycheck: 100, period: "biweekly" }), { perPaycheck: 50, step3: 1300, january: 200, one: true, all: false });
  // typed paychecks: what the page says (`takeHome`) follows the same rule (credits out, capped at the typed figure); the
  // answer key's `perPaycheck` (tests/golden-estimated) stays the refund over the paychecks left
  const typed = jo({ pay: 30000 }); typed.taxes = { ...(typed.taxes ?? {}), withholding: { self: { perPaycheck: 25, period: "biweekly" } } };
  const t = compute(typed, { today: NOV });
  assert.equal(t.verdict, "refund"); assert.equal(t.suggestion.kind, "cut"); assert.equal(t.suggestion.takeHome, 25);
  assert.equal(t.suggestion.perPaycheck, Math.floor(-t.balance / t.suggestion.paychecks));
  assert.match(t.suggestion.text, /^You are lending the IRS about \$25 a paycheck, all of what each paycheck takes out\./);
});

test("filing separately: the business on its owner's return, each return's 0.9%; the two returns add up to the year's tax (care fourth pass)", () => {
  const NOV = "2026-11-02";
  // the family filing separately, 3,750 each: Ana 7,764.60; Bo 5,500.37 + 1,017.33 of self-employment tax; 14,282.30 (the law;
  // the Self-employment page's household figure was 14,157.45, its deductions on Ana's return and 59.84 of extra Medicare)
  const p = famOf(NOV); p.household.filingStatus = "married_separate";
  p.whatIfs = { benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } };
  const fed = fedOf(p, { today: NOV });
  const yt = yearTax(p, fed, { today: NOV });
  near(yt.total, 14282.30, 0.02);
  const f = fullSteps(p, fed, { today: NOV });
  near(f.total, 14282.30, 0.02);
  const ana = f.returns.find((x) => x.personId === "p-ana"), bo = f.returns.find((x) => x.personId === "p-bo");
  near(ana.total, 7764.60, 0.02); near(bo.incomeTax, 5500.37, 0.02); near(bo.se, 1017.33, 0.01); near(bo.addl, 0, 1e-9); near(ana.se, 0, 1e-9);
  // "the tax above is the two added up": exactly
  near(f.returns.reduce((t, x) => t + x.total, 0), f.total, 1e-6);
  const s = separateBusiness(p, fed, { today: NOV });
  near(s.addlMedicare, 0, 1e-9); near(s.taxWith, 14282.30, 0.02);
  // no accounts: 15,682.61 and no extra Medicare (the Self-employment page: 15,742.45, 59.84 of it)
  const q = famOf(NOV); q.household.filingStatus = "married_separate";
  near(yearTax(q, fedOf(q, { today: NOV }), { today: NOV }).total, 15682.61, 0.02);
  // filing jointly the Self-employment page's figure stays (the 30 gap is that page's: care fourth pass note for claude-a)
  const j = famOf(NOV), fj = fedOf(j, { today: NOV });
  assert.equal(separateBusiness(j, fj, { today: NOV }).separate, undefined);
  assert.equal(fullSteps(j, fj, { today: NOV }).returns, null);
});

test("Withholding check says the rate with the one rounding (ratePct): 4,268 of 88,000 is 4.9%, as the Federal estimate (care fourth pass)", async () => {
  const NOV = "2026-11-02";
  const plan = jo({ pay: 88000 });
  const d = compute(plan, { today: NOV });
  near(d.totalTax, 4268, 0.5); near(d.effectiveRate, 4268 / 88000, 1e-4);
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, querySelector() { return null; }, scrollIntoView() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form") };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => NOV }, plan, store: { update() {} } });
  const text = root.textContent.replace(/\s+/g, " ");
  assert.ok(text.includes("4.9% of income"), text.slice(0, 600)); assert.ok(!text.includes("4.8%"));
  // Jo at 30,000: the cut is 22 a paycheck, all of what each takes out, and the 1,700 of credits is said to come back anyway
  const r2 = node("root");
  render(r2, { ui, fmt: { ...fmt, today: () => NOV }, plan: jo({ pay: 30000 }), store: { update() {} } });
  const t2 = r2.textContent.replace(/\s+/g, " ");
  assert.ok(t2.includes("That is about $22 a paycheck lent to the IRS, all of what each paycheck takes out"), t2.slice(0, 800));
  assert.ok(t2.includes("(the $1,700 of credits comes back whatever the W-4 says)"));
  assert.ok(!t2.includes("$571"));
});

// --- Review 2026-11-06 -----------------------------------------------------------------------------------------------------
/** A page's text with a stand-in for the UI kit (`view` relative to this folder, e.g. "./view.js" or "../estimated/view.js"). */
async function viewText(plan, today, view = "./view.js") {
  const { render } = await import(view);
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, replaceChildren() { x.kids = []; }, querySelector() { return null; }, scrollIntoView() {}, addEventListener() {}, setAttribute() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const base = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form") };
  const ui = new Proxy(base, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => typeof x !== "object" || x === null || Array.isArray(x) || "kids" in x))) });
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update() {} } });
  return root.textContent.replace(/\s+/g, " ");
}
const NOV6 = "2026-11-02";
const typedJo = (per, soFar = null, o = {}) => { const p = jo(o); p.taxes = { ...(p.taxes ?? {}), ...(soFar !== null ? { thisYear: { ...(p.taxes?.thisYear ?? {}), withheld: soFar, withheldTyped: true } } : {}), withholding: { self: { perPaycheck: per, period: "biweekly" } } }; return p; };
const mfsOf = (elect = true, withholding = null) => {
  const p = famOf(NOV6); p.household.filingStatus = "married_separate";
  if (elect) p.whatIfs = { ...(p.whatIfs ?? {}), benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } };
  if (withholding) p.taxes = { ...(p.taxes ?? {}), withholding };
  return p;
};

test("Review 2026-11-06: the W-4 Step 3 figure for the paychecks left, and the whole year's figure for January (never more than the year's over-withholding)", async () => {
  // Jo, 62,000, no account, 900 a month of care, 161 a paycheck typed: 938 of tax, 4,186 withheld over the year, 3,248 over.
  // With 4 paychecks left the cut is all 161 of each: 4,186 in Step 3 for the rest of the year. A W-4 stays in force, so
  // 4,186 in Step 3 all next year would take her withholding to 0, 938 short of her tax; January's figure is the year's 3,248
  const d = compute(typedJo(161), { today: NOV6 });
  assert.equal(d.verdict, "refund"); near(d.totalTax, 938, 0.5);
  assert.equal(d.suggestion.takeHome, 161); assert.equal(d.suggestion.step3, 4186); assert.equal(d.suggestion.january, 3248); assert.equal(d.suggestion.one, false);
  assert.match(d.suggestion.text, /For the 4 paychecks left this year, about \$4,186 in Step 3 of a new W-4 \(credits\), or the matching amount in Step 4\(b\) \(deductions\), brings take-home up and the refund down\./);
  assert.match(d.suggestion.text, /In January 2027, change Step 3 to about \$3,248, or next year's paychecks would take out too little/);
  // a whole next year at January's figure still covers the tax; at the rest-of-year figure it falls 938 short
  const yearly = d.withholding.people[0].yearly;
  assert.ok(yearly - d.suggestion.january >= d.totalTax - 0.5); near(d.totalTax - Math.max(0, yearly - d.suggestion.step3), 938, 0.5);
  // 3,544 withheld so far: 4,188 by December, 3,250 over; a whole year at 161 is 4,186, 3,248 over: January's is the smaller
  const s = compute(typedJo(161, 3544), { today: NOV6 });
  near(-s.balance, 3250, 0.5); assert.equal(s.suggestion.january, 3248);
  // never more than the year's over-withholding (credits left out), the whole year's at today's rate, or what a year of
  // paychecks withholds: a grid of cases
  for (const over of [0.5, 40, 900, 3250, 12000]) for (const left of [1, 4, 13, 26]) for (const each of [0, 20, 161, 900]) for (const full of [-500, 0, 300, 3248, 50000]) {
    const t = takeHomeMore(over, { left, perPaycheck: each, period: "biweekly" }, full);
    if (!t) continue;
    assert.ok(t.january <= over + 0.5 && t.january <= Math.max(0, full) + 0.5 && t.january <= each * 26 + 0.5 && t.january >= 0, JSON.stringify({ over, left, each, full, t }));
    // one figure only when January's, kept for the paychecks left, leaves under 500 of refund
    assert.equal(t.one, over - Math.min(each, t.january / 26) * left < 500);
  }
  // on January 2 (25 paychecks left) January's figure leaves 125 of refund this year: one figure, for this year and next
  const jan = compute(typedJo(161), { today: "2026-01-02" });
  assert.equal(jan.suggestion.one, true); assert.doesNotMatch(jan.suggestion.text, /In January/);
  assert.match(jan.suggestion.text, /About \$3,248 in Step 3 of a new W-4 \(credits\), or the matching amount in Step 4\(b\) \(deductions\), brings take-home up and the refund down, this year and next\./);
  // the estimate from pay (no stub typed): 161.08 a paycheck, 4,188 over the year, 3,250 over; the page now gives both figures
  const e = compute(jo(), { today: NOV6 }).estimate.suggestion;
  assert.equal(e.kind, "cut"); assert.equal(e.step3, 161 * 26); assert.equal(e.january, 3250);
  const text = await viewText(jo(), NOV6);
  assert.ok(text.includes("For the 4 paychecks left this year, about $4,186 in Step 3 of Jo's new W-4 brings take-home up and the refund down. In January 2027, change Step 3 to about $3,250, or next year's paychecks would take out too little"), text.slice(0, 900));
});

test("Review 2026-11-06: more withheld for the paychecks left comes with the figure for January too", () => {
  // Jo at 88,000 with 100 a paycheck typed: 4,268 of tax, 2,600 withheld, 1,668 to pay: 417 more on each of the 4 paychecks
  // left. Left on the W-4 all next year, 417 x 26 would over-withhold by about 9,200; a whole year needs 1,668 / 26 -> 65
  const d = compute(typedJo(100, null, { pay: 88000 }), { today: NOV6 });
  assert.equal(d.suggestion.kind, "add"); assert.equal(d.suggestion.perPaycheck, 417); assert.equal(d.suggestion.january, 65);
  assert.match(d.suggestion.text, /In January 2027, change the extra to about \$65 a paycheck: a W-4 stays until you change it\./);
  // within 500 a year of the rest-of-year figure, one figure does: no January words
  assert.equal(addJanuary(1668, { period: "biweekly" }, 65), null); assert.equal(addJanuary(1668, { period: "biweekly" }, 70), null);
  assert.equal(addJanuary(0, { period: "monthly" }, 900), 0); assert.equal(addJanuaryWords(0, 2026), "In January 2027, take the extra off again: a W-4 stays until you change it.");
});

test("Review 2026-11-06: filing separately, each return settles on its own (Ana 2,200 back, Bo owes 1,659.70 and his own penalty test)", async () => {
  // the family filing separately, 3,750 each, withholding estimated from pay. Ana's return: 7,764.60 of tax, 9,964.60
  // withheld from her pay: 2,200 back. Bo's: 6,517.70, 4,858 withheld: he owes 1,659.70, and 4,858 is under 90% of his own
  // tax (5,866): his own Form 2210 risk. The pages added the two: "You would likely get about $540 back"
  const d = compute(mfsOf(), { today: NOV6 });
  near(d.estimate.balance, -540.30, 0.02);   // the household figure the answer key reads stays
  const [ana, bo] = ["p-ana", "p-bo"].map((id) => d.estimate.returns.find((x) => x.personId === id));
  near(ana.tax, 7764.60, 0.02); near(ana.withheld, 9964.60, 0.02); near(ana.balance, -2200, 0.02); assert.equal(ana.verdict, "refund");
  near(bo.tax, 6517.70, 0.02); near(bo.withheld, 4858, 0.02); near(bo.balance, 1659.70, 0.02); assert.equal(bo.verdict, "owe");
  near(bo.harbour.required, 0.9 * 6517.70, 0.02); assert.equal(bo.penaltyRisk, true); assert.equal(bo.needsEstimates, true); near(bo.toPayByEstimates, 0.9 * 6517.70 - 4858, 0.02);
  assert.equal(ana.penaltyRisk, false); assert.equal(ana.needsEstimates, false);
  near(ana.balance + bo.balance, d.estimate.balance, 1e-6);
  // the W-4 change goes on the return that needs it: more on Bo's one monthly paycheck left; Ana's cut, with January's figure
  assert.deepEqual([bo.suggestion.kind, bo.suggestion.name, bo.suggestion.perPaycheck, bo.suggestion.paychecks], ["add", "Bo", 1660, 1]);
  assert.equal(ana.suggestion.kind, "cut"); assert.equal(ana.suggestion.january, 2200);
  // no accounts: Bo owes 1,785.01
  const none = compute(mfsOf(false), { today: NOV6 }).estimate.returns.find((x) => x.personId === "p-bo");
  near(none.balance, 1785.01, 0.02);
  // pay stubs typed (Ana 420 every two weeks, Bo 405 a month): Ana 3,155.40 back, Bo owes 1,657.70
  const typed = compute(mfsOf(true, { self: { perPaycheck: 420, period: "biweekly" }, partner: { perPaycheck: 405, period: "monthly" } }), { today: NOV6 });
  near(typed.estimate.returns[0].balance, 7764.60 - 10920, 0.02); near(typed.estimate.returns[1].balance, 6517.70 - 4860, 0.02);
  // the household's "so far" is shared by each paycheck's rate (13,000: Ana 10,920 / 15,780 of it), the paychecks left on top
  const soFar = mfsOf(true, { self: { perPaycheck: 420, period: "biweekly" }, partner: { perPaycheck: 405, period: "monthly" } });
  soFar.taxes.thisYear = { ...(soFar.taxes.thisYear ?? {}), withheld: 13000, withheldTyped: true };
  const sf = compute(soFar, { today: NOV6 }).estimate;
  near(sf.returns[0].withheld, 13000 * 10920 / 15780 + 420 * 4, 0.01); near(sf.returns[1].withheld, 13000 * 4860 / 15780 + 405, 0.01);
  near(sf.returns[0].withheld + sf.returns[1].withheld, sf.projected, 1e-6);
  // payments go to the return that owes first (Pub. 505: the couple divides them as they agree)
  const paid = mfsOf(); paid.taxes = { ...(paid.taxes ?? {}), estimated: { paid: [1000, 0, 0, 0] } };
  const pr = compute(paid, { today: NOV6 }).estimate.returns;
  near(pr[1].paid, 1000, 1e-6); near(pr[0].paid, 0, 1e-9); near(pr[1].balance, 659.70, 0.02);
  // filing jointly: one return, no split
  assert.equal(compute(famOf(NOV6), { today: NOV6 }).estimate.returns, null);
  // the page says who owes and who gets money back, and the change on each return
  const text = await viewText(mfsOf(), NOV6);
  assert.ok(text.includes("Bo would likely owe about $1,660 in April; Ana would likely get about $2,200 back"), text.slice(0, 600));
  assert.ok(text.includes("one return's refund cannot pay the other's bill"));
  assert.ok(text.includes("Asking for $1,660 more on the one paycheck left on Bo's W-4 (Step 4(c), \"extra withholding\") clears it."), text.slice(0, 2000));
  assert.ok(text.includes("Bo's pay takes out less than the safe amount for this return ($5,866, 90% of its tax)"));
  assert.ok(!text.includes("get about $540 back"));
});

test("Review 2026-11-06: Estimated payments, filing separately: Bo's own return needs payments though the household's does not", async () => {
  const { compute: estOf } = await import("../estimated/compute.js");
  const e = estOf(mfsOf(), { today: NOV6 });
  assert.equal(e.needsEstimates, false);   // the household's (the answer key's) figure stays
  const bo = e.returns.find((x) => x.personId === "p-bo"), ana = e.returns.find((x) => x.personId === "p-ana");
  assert.equal(bo.needsEstimates, true); near(bo.toPayByEstimates, 1007.93, 0.01); near(bo.perQuarter, 1007.93 / 4, 0.01);
  near(bo.behind, 1007.93 * 3 / 4, 0.01); assert.deepEqual(bo.quarters.map((q) => q.status), ["short", "short", "short", "upcoming"]);
  assert.equal(ana.needsEstimates, false); assert.deepEqual(ana.quarters.map((q) => q.status), ["none", "none", "none", "none"]);
  // a payment typed goes to Bo's return, box by box
  const p = mfsOf(); p.taxes = { ...(p.taxes ?? {}), estimated: { paid: [600, 0, 0, 0], typedAt: NOV6 } };
  const e2 = estOf(p, { today: NOV6 }), bo2 = e2.returns.find((x) => x.personId === "p-bo");
  near(bo2.paid, 600, 1e-6); near(bo2.quarters[0].paid, 600, 1e-6); near(bo2.remaining, 407.93, 0.01);
  const text = await viewText(mfsOf(), NOV6, "../estimated/view.js");
  assert.ok(text.includes("Bo: about $1,008 more withheld this year"), text.slice(0, 600));
  assert.ok(text.includes("The four payments for 2026, on Bo's return"));
  assert.ok(text.includes("Ana's return none needed"));
  assert.ok(!text.startsWith("No estimated payments needed"));
});

test("Review 2026-11-06: Withholding check says the self-employment tax itself, as the Federal estimate does ($1,017, not $796)", async () => {
  // the family filing separately, 3,750 each: 1,017.33 of self-employment tax on Bo's photography; 795.70 is the business's whole
  // effect (its deductions save 221.63), which seTax keeps for alerts and the answer keys
  const d = compute(mfsOf(), { today: NOV6 });
  near(d.seOwn, 1017.33, 0.01); near(d.seTax, 795.70, 0.01);
  const fed = fedOf(mfsOf(), { today: NOV6 });
  near(d.seOwn, fullSteps(mfsOf(), fed, { today: NOV6 }).se.tax, 1e-6);
  const text = await viewText(mfsOf(), NOV6);
  assert.ok(text.includes("$1,017 of it self-employment tax"), text.slice(0, 2400)); assert.ok(!text.includes("$796"));
  // filing jointly: 1,017 too (the business's effect is 611: 581 before round 8, when the 20% deduction came off AGI and
  // raised the child care credit by 30)
  const j = compute(famOf(NOV6), { today: NOV6 });
  near(j.seOwn, 1017.33, 0.01); near(j.seTax, 611.01, 0.01);
  assert.ok((await viewText(famOf(NOV6), NOV6)).includes("$1,017 of self-employment tax"));
});

test("Review 2026-11-06: Estimated payments, when the credits are more than the tax, says no tax and the credits that come back (not \"$0 of federal tax\")", async () => {
  const text = await viewText(jo({ pay: 30000 }), NOV6, "../estimated/view.js");
  assert.ok(text.includes("no federal tax, and about $1,700 of credits come back on top of the $585 withheld from pay"), text.slice(0, 500));
  assert.ok(!text.includes("about $0 of federal tax"));
});

// ---- round 8, Batch 1: stock vesting's withholding counts (taxes/federal known.js stockStep)
test("round 8 item 12 (equity-2): what is held back from vesting stock counts toward the year's withholding", async () => {
  const { equityPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const { withholdingEstimate } = await import("./compute.js");
  const T8 = { today: "2026-11-06" };
  const p = equityPlan(), d = compute(p, T8);
  const noStock = equityPlan(); noStock.equity.grants = [];
  const pay = withholdingEstimate(noStock, T8).projected;
  // the whole year: 22% of 105,000 and the 0.9% Medicare tax on the 105,000 past Mo's 200,000 of pay (945)
  assert.ok(Math.abs(d.estimate.projected - (pay + 23100 + 945)) < 0.01);
  assert.ok(Math.abs(d.totalTax - 53643) < 0.01); assert.equal(d.estimate.verdict, "owe");
  assert.ok(Math.abs(d.estimate.balance - (53643 - pay - 24045)) < 0.01);
  // the year so far typed (it holds the vests already paid): only the December vest's is added
  const y = equityPlan(); y.taxes.thisYear.withheld = 40000; y.taxes.thisYear.withheldTyped = true;
  const so = withholdingEstimate(y, T8), base = withholdingEstimate((() => { const q = equityPlan(); q.taxes.thisYear.withheld = 40000; q.taxes.thisYear.withheldTyped = true; q.equity.grants = []; return q; })(), T8);
  assert.ok(Math.abs(so.projected - (base.projected + 0.22 * 15000 + 0.009 * 15000)) < 0.01);
});

test("round 8 review 3: the share of income on Withholding check and Quick answers is the Federal estimate's (with the withdrawal, the stock pay)", async () => {
  const { widowPlan, equityPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const { known } = await import("../federal/known.js");
  const T = "2026-11-06";
  // the widow: 3,964.52 of 22,800 + 16,078 + 27,600 = 66,478 of income, 6.0% (it read 1.1%, the keys' return without the withdrawal)
  const a = taxAnswer(widowPlan(), { today: T });
  assert.ok(Math.abs(a.effectiveRate - 3964.52 / 66478) < 1e-4, String(a.effectiveRate));
  assert.equal(a.effectiveRate, known(widowPlan(), { today: T }).rate);
  // the stock couple: 53,643 of 318,000 + the rest, 16.9% (it read 13.2%)
  const e = taxAnswer(equityPlan(), { today: T });
  assert.ok(Math.abs(e.effectiveRate - known(equityPlan(), { today: T }).rate) < 1e-12); assert.ok(e.effectiveRate > 0.165 && e.effectiveRate < 0.172, String(e.effectiveRate));
});

test("round 8 review 4: a retiree living on IRA withdrawals has income on Withholding check (no 'No income on file')", async () => {
  const { earlyRetireePlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const d = compute(earlyRetireePlan(), { today: "2026-11-06" });
  assert.equal(d.hasIncome, true); assert.ok(!d.notes.some((n) => /No income on file/.test(n)));
  assert.ok(taxAnswer(earlyRetireePlan(), { today: "2026-11-06" }) !== null);
});
