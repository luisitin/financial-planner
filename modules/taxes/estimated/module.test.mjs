// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("estimated: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("estimated: a due date on a weekend or holiday moves to the next business day (IRC 7503)", async () => {
  const { QUARTERS } = await import("./compute.js");
  // 2026: Wednesday April 15, Monday June 15, Tuesday September 15, Friday January 15, 2027: none move
  assert.deepEqual(QUARTERS(2026).map((q) => q.due), ["2026-04-15", "2026-06-15", "2026-09-15", "2027-01-15"]);
  // 2027's last payment: Saturday January 15, 2028, then Martin Luther King Jr. Day on the 17th: Tuesday the 18th
  assert.equal(QUARTERS(2027)[3].due, "2028-01-18");
  // 2028: April 15 is a Saturday and Emancipation Day (Sunday the 16th) is kept on Monday the 17th: Tuesday the 18th;
  // September 15, 2029 is a Saturday: Monday the 17th
  assert.equal(QUARTERS(2028)[0].due, "2028-04-18"); assert.equal(QUARTERS(2029)[2].due, "2029-09-17");
  // the page passes the plan's state, and its tax year's dates reach the quarters it shows
  const p = taxPlan(); p.taxes = { ...(p.taxes ?? {}), year: 2027 };
  assert.equal(compute(p, { today: "2027-03-01" }).quarters[3].due, "2028-01-18");
});

test("estimated: with no withholding typed, the Paycheck page's estimate; what is behind, then the next payment", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: paycheck } = await import("../../cashflow/paycheck/compute.js");
  const p = familyPlan("2026-10-31");
  const pc = paycheck(p, { today: "2026-10-31" });
  const d = compute(p, { today: "2026-10-31" });
  assert.equal(d.withholdingFrom, "paycheck");
  assert.ok(Math.abs(d.withholding - pc.people.reduce((s, x) => s + x.yearly.federal, 0)) < 1e-6);
  assert.ok(d.notes.some((n) => /Paycheck page/.test(n)));
  // on October 31 three quarters are past: three shares are behind, the fourth is due January 15
  assert.equal(d.needsEstimates, true);
  assert.ok(Math.abs(d.behind - 3 * d.perQuarter) < 0.01); assert.equal(d.overdue.due, "2026-04-15");
  assert.equal(d.nextDue.due, "2027-01-15"); assert.ok(Math.abs(d.nextDue.amount - d.perQuarter) < 0.01);
  // the first two paid: only the third is behind
  p.taxes = { ...(p.taxes ?? {}), estimated: { paid: [d.perQuarter, d.perQuarter, 0, 0] } };
  const e = compute(p, { today: "2026-10-31" });
  assert.ok(Math.abs(e.behind - e.perQuarter) < 0.01); assert.equal(e.overdue.due, "2026-09-15");
  // before the first due date nothing is behind
  const f = compute(familyPlan("2026-03-01"), { today: "2026-03-01" });
  assert.equal(f.behind, 0); assert.equal(f.overdue, null); assert.equal(f.nextDue.due, "2026-04-15");
  // withholding typed on the Withholding check page wins
  p.taxes.withholding = { self: { perPaycheck: 400, period: "biweekly" } };
  assert.equal(compute(p, { today: "2026-10-31" }).withholdingFrom, "mixed", "Bo's withholding is still estimated from pay, never $0");
  p.taxes.withholding.partner = { perPaycheck: 500, period: "monthly" };
  assert.equal(compute(p, { today: "2026-10-31" }).withholdingFrom, "typed");
});

import { QUARTERS } from "./compute.js";

test("estimated: Patriots' Day does not move an estimated payment (Rev. Rul. 2015-13); D.C.'s holidays do", () => {
  assert.equal(QUARTERS(2024, "MA")[0].due, "2024-04-15");   // the return moved to April 17 in MA and ME; the payment did not
  assert.equal(QUARTERS(2027)[3].due, "2028-01-18");         // Saturday the 15th, Martin Luther King Jr. Day on the 17th
});

test("estimated: a quarter's status counts everything paid; a payment made late still flags the penalty for its quarter", () => {
  // single, 30,000 of interest: tax 1,420; safe amount 90% = 1,278, a quarter 319.50 (no withholding)
  const plan = (paid) => { const p = emptyPlan(); p.household.filingStatus = "single"; p.taxes.thisYear.otherOrdinary = 30000; p.taxes.estimated.paid = paid; return p; };
  // July 20: nothing in the first box, 700 typed in the second: both past quarters are covered by the total
  const d = compute(plan([0, 700, 0, 0]), { today: "2026-07-20" });
  assert.deepEqual(d.quarters.map((q) => q.status), ["paid", "paid", "upcoming", "upcoming"]);
  assert.equal(d.behind, 0); assert.equal(d.overdue, null);
  assert.equal(d.nextDue.due, "2026-09-15"); assert.ok(Math.abs(d.nextDue.amount - (958.5 - 700)) < 1e-9);   // never a $0 next payment
  // the first quarter's own box was empty on April 15: late, so the penalty note shows, though nothing is behind now
  assert.equal(d.quarters[0].late, true); assert.equal(d.lateQuarter.n, 1); assert.equal(d.penaltyRisk, true);
  // the whole year paid: nothing left to warn about
  assert.equal(compute(plan([0, 1278, 0, 0]), { today: "2026-07-20" }).penaltyRisk, false);
});

// a freelancer of one: design work $78,000 a year, no paycheck, $16,900 in cash, a $1,800 card (invented)
const freelancer = (paid) => {
  const p = emptyPlan();
  p.household = { people: [{ id: "p-rae", name: "Rae", role: "self", birthDate: "1986-06-15", retirementAge: 65 }], filingStatus: "single", state: "CO" };
  p.accounts = [{ id: "a-chk", name: "Business checking", type: "checking", balance: 7400, asOf: "2026-11-02", history: [] }, { id: "a-sav", name: "Savings", type: "savings", balance: 9500, asOf: "2026-11-02", history: [] }, { id: "a-card", name: "Card", type: "credit", balance: 1800, asOf: "2026-11-02", history: [] }];
  p.debts = [{ id: "d-card", accountId: "a-card", rate: 0.229, minPayment: 60, extra: 0 }];
  p.income = [{ id: "i-fl", name: "Freelance design", type: "business", personId: "p-rae", amount: 6500, period: "monthly", growth: 0, taxable: true }];
  p.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 1900, period: "monthly", essential: true }, { id: "e-food", name: "Food", category: "groceries", amount: 600, period: "monthly", essential: true }, { id: "e-fun", name: "Fun", category: "fun", amount: 700, period: "monthly", essential: false }];
  p.taxes = { ...(p.taxes ?? {}), estimated: { paid }, priorYear: { tax: 11200, agi: 70000 } };   // last year's tax sets the safe amount: $2,800 a quarter
  return p;
};

test("taxOwedNow: a freelancer's tax on the year's earnings so far, less what is paid; nobody whose pay withholds most of it", async () => {
  const { taxOwedNow } = await import("./compute.js");
  const today = "2026-11-02";
  const plan = freelancer([2800, 2800, 2800, 0]);
  const e = compute(plan, { today });
  const t = taxOwedNow(plan, { today });
  assert.ok(t && e.needsEstimates && e.withholding === 0);
  assert.equal(t.earnedShare, 10 / 12, "January to October are gone on November 2");
  assert.ok(Math.abs(t.owedNow - ((e.totalTax - e.withholding) * 10 / 12 - 8400)) < 0.01);
  assert.ok(Math.abs(t.monthly - (e.totalTax - e.withholding) / 12) < 0.01);
  assert.equal(t.overdue, null); assert.equal(t.nextDue.due, "2027-01-15");
  // nothing paid: everything earned so far is owed, and the past quarters are past due
  const u = taxOwedNow(freelancer([0, 0, 0, 0]), { today });
  assert.ok(Math.abs(u.owedNow - (e.totalTax - e.withholding) * 10 / 12) < 0.01); assert.ok(u.overdue.amount > 0);
  // paid ahead of what is earned: nothing owed now, never below zero
  assert.equal(taxOwedNow(freelancer([9000, 9000, 0, 0]), { today }).owedNow, 0);
  // a paycheck that withholds most of the tax: left alone (the Withholding check page is the place for it)
  const w = freelancer([0, 0, 0, 0]); w.income.push({ id: "i-job", name: "Job", type: "salary", personId: "p-rae", amount: 120000, period: "annual", taxable: true });
  w.taxes.withholding = { self: { perPaycheck: 1100, paychecksPerYear: 26 } };
  const we = compute(w, { today });
  if (we.withholding >= we.totalTax / 2) assert.equal(taxOwedNow(w, { today }), null);
  // no business income, no date, another year: null
  const nb = freelancer([0, 0, 0, 0]); nb.income[0].type = "salary";
  assert.equal(taxOwedNow(nb, { today }), null);
  assert.equal(taxOwedNow(plan, {}), null);
  const jan = taxOwedNow(plan, { today: "2027-02-01" }); assert.ok(jan === null || (jan.year === 2027 && jan.earnedShare === 1 / 12));
});

// --- Review 2026-11-06 (verifier) ------------------------------------------------------------------------------------------
test("Review 2026-11-06 (verifier): filing separately, both returns behind on their payments: the line starts with a capital", async () => {
  // Gus 90,000 and Hal 30,000 of business profit, filing separately, no pay, 3,000 paid in the 1st quarter: both returns need
  // estimates and both are behind; the page's line read "... other's bill. payments from the 1st quarter ..."
  const p = emptyPlan();
  p.household.filingStatus = "married_separate"; p.household.state = "TX";
  p.household.people = [{ id: "g", name: "Gus", role: "self", birthDate: "1984-04-04" }, { id: "h", name: "Hal", role: "partner", birthDate: "1986-06-06" }, { id: "k", name: "Bea", role: "dependent", birthDate: "2025-03-03" }];
  p.income = [{ id: "b1", name: "Gus's design work", type: "business", personId: "g", amount: 90000, period: "annual", growth: 0, taxable: true }, { id: "b2", name: "Hal's tutoring", type: "business", personId: "h", amount: 30000, period: "annual", growth: 0, taxable: true }];
  p.taxes = { ...(p.taxes ?? {}), year: 2026, estimated: { paid: [3000, 0, 0, 0], typedAt: "2026-04-10" } };
  const d = compute(p, { today: "2026-11-06" });
  assert.equal(d.returns.filter((x) => x.needsEstimates).length, 2);
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, querySelector() { return null; }, addEventListener() {}, setAttribute() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const base = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form") };
  const ui = new Proxy(base, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => typeof x !== "object" || x === null || Array.isArray(x) || "kids" in x))) });
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => "2026-11-06" }, plan: p, store: { update() {} } });
  const t = root.textContent.replace(/\s+/g, " ");
  assert.ok(t.includes("Both returns need estimated payments"), t.slice(0, 600));
  assert.ok(t.includes("behind starting with the 1st quarter") && !t.includes("payments from the 1st quarter"), t.slice(0, 600));
});

test("Review 2026-11-06: filing separately, the safe-amount words say 75,000 of last year's income, not 150,000 (IRC 6654(d)(1)(C))", async () => {
  // the math (safeHarbour) already used 75,000 for a married person filing separately; the help and the fold said 150,000
  const page = async (status) => {
    const p = taxPlan(); p.household.filingStatus = status;
    const { render } = await import("./view.js");
    const fmt = await import("../../../core/format.js");
    const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, querySelector() { return null; }, addEventListener() {}, setAttribute() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
    const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
    const base = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: (fields) => node("form", fields.map((f) => `${f.label} ${f.help ?? ""}`)) };
    const ui = new Proxy(base, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => typeof x !== "object" || x === null || Array.isArray(x) || "kids" in x))) });
    const root = node("root");
    render(root, { ui, fmt: { ...fmt, today: () => "2026-11-06" }, plan: p, store: { update() {} } });
    return root.textContent.replace(/\s+/g, " ");
  };
  const sep = await page("married_separate"), joint = await page("married_joint");
  assert.equal(compute((() => { const p = taxPlan(); p.household.filingStatus = "married_separate"; p.taxes.priorYear = { tax: 10000, agi: 80000 }; return p; })(), { today: "2026-11-06" }).harbour.priorShare, 1.1);
  assert.ok(sep.includes("110% if last year's income was over $75,000") && sep.includes("over $75,000 raises") && !sep.includes("$150,000"), sep);
  assert.ok(joint.includes("110% if last year's income was over $150,000") && joint.includes("over $150,000 raises") && !joint.includes("$75,000"), joint);
});

// ---- round 8, Batch 1: the year's tax is the Federal estimate's with what the plan knows (taxes/federal known.js)
const R8 = "2026-11-06";
const H8 = () => import("../../../qa/fixtures/round8-households.mjs");
const near8 = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("round 8 item 5 (landlord-1): the condo counted after its costs: 14,108 of tax, a safe amount of 12,697, about 2,889 more to pay in", async () => {
  const { landlordPlan } = await H8();
  const d = compute(landlordPlan(), { today: R8 });
  near8(d.totalTax, 14108); near8(d.harbour.required, 0.9 * 14108);
  // the paychecks' withholding is estimated from pay; the safe amount less it is what the estimates must bring
  near8(d.toPayByEstimates, 0.9 * 14108 - d.withholding); assert.ok(d.toPayByEstimates > 2800 && d.toPayByEstimates < 3000);
  near8(d.balanceAtFiling, 14108 - d.withholding); assert.ok(d.balanceAtFiling > 4250 && d.balanceAtFiling < 4350, "about 4,300 in April, not the 9,844 the gross rent made it");
});

test("money review (2026-11-07): the hold-back is capped at the part of the withdrawal still to come, not the whole year's", async () => {
  const { widowPlan } = await import("../../../qa/fixtures/widow-plan.mjs");
  // the widow spends more than her income, so savings pay on top of the required withdrawal; the required $16,078 is marked taken:
  // of the year's $19,764 withdrawal only $3,686 is still to come, so at most $3,687 can be held back (it was $4,400, the amount
  // the tax short of the safe amount rounds to, against a withdrawal that could not carry it)
  const { migrate } = await import("../../../core/schema/migrate.js");
  const p = migrate(widowPlan()); p.expenses.forEach((e) => { e.amount = e.amount * 2.2; });
  p.retirement.rmdTaken = { 2026: { "p-ruth": "2026-10-01" } };
  const d = compute(p, { today: R8 });
  near8(d.holdBack.withdrawal, 19764, 1); assert.equal(d.holdBack.amount, 3687); assert.equal(d.holdBack.whole, 3687);
});

test("round 8 item 6 (widow-2): the required withdrawal's tax needs paying in: have about 3,600 held back from the IRA withdrawal", async () => {
  const { widowPlan } = await H8();
  const d = compute(widowPlan(), { today: R8 });
  near8(d.totalTax, 3964.5, 1); assert.equal(d.needsEstimates, true, "not \"No estimated payments needed\"");
  // nothing withheld: the safe amount is 90% of 3,964.5 = 3,568, rounded up to 3,600 to hold back from the withdrawal
  near8(d.harbour.required, 0.9 * d.totalTax); assert.equal(d.holdBack.amount, 3600); assert.equal(d.holdBack.withdrawal, 16078);
  // the withdrawal already marked taken, and nothing else coming out: no hold-back to ask for
  const t = widowPlan(); t.retirement.rmdTaken = { 2026: { me: "2026-10-01" } };
  assert.equal(compute(t, { today: R8 }).holdBack, undefined);
  // no withdrawal at all: none either (the key stays out of the result)
  assert.equal("holdBack" in compute(taxPlan(), { today: R8 }), false);
});

test("round 8 items 12 and 23: stock pay and student loan interest reach the quarterly figures", async () => {
  const { equityPlan, studentLoanPlan } = await H8();
  const e = compute(equityPlan(), { today: R8 });
  // 53,643 of tax against the pay's withholding plus 24,045 held back from the vests: about 6,338 still to pay
  near8(e.totalTax, 53643); assert.ok(e.withholding > 24045);
  const s = compute(studentLoanPlan(), { today: R8 });
  near8(s.totalTax, 9980); assert.ok(s.balanceAtFiling > 4000 && s.balanceAtFiling < 4100, "about 4,060 in April");
});

test("round 8 review 4: a household living on IRA withdrawals before 59½ is told the tax with the extra 10%, not 'No income on file'", async () => {
  const { earlyRetireePlan } = await H8();
  const d = compute(earlyRetireePlan(), { today: R8 });
  assert.equal(d.hasIncome, true); assert.ok(!d.notes.some((n) => /No income on file/.test(n)));
  assert.ok(Math.abs(d.totalTax - 14126.52) < 2, String(d.totalTax));
  // no required withdrawal at 50: the hold-back names the draw, required 0 (the page's button then says "Your IRA withdrawals")
  assert.equal(d.holdBack.required, 0); assert.ok(d.holdBack.withdrawal > 60000);
});

test("round 8 review UX 11: the widow is told what to hold back to clear the penalty and what leaves nothing to pay in April", async () => {
  const { widowPlan } = await H8();
  const d = compute(widowPlan(), { today: R8 });
  assert.equal(d.holdBack.amount, 3600); assert.equal(d.holdBack.whole, 4000);
});

// ==== gap #15 (2026-11-13): what paying late costs, the rate table, and the page simple first (opt C12) ===================
// Penalty = the amount late x the rate x days late / days in the year, day by day at each quarter's rate (IRC 6654(a),
// (b)(2); Form 2210 instructions, penalty worksheet: "Underpayment ... x Number of days ... / 365 x 0.07", /366 in a leap
// year). The rate: the federal short-term rate + 3 points, set each quarter (IRC 6621(a)(2)); data/rates.js.
import { rateOn, lateCharge, lateCosts } from "./compute.js";
import { UNDERPAYMENT_RATES } from "./data/rates.js";
import * as fmt from "../../../core/format.js";

const G = "2026-11-13";
const close = (a, b, tol = 0.005, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const rae = (paid, prior = 11200) => { const p = freelancer(paid); p.taxes.priorYear = { tax: prior, agi: 70000 }; return p; };
const interest = (paid, prior = null) => { const p = emptyPlan(); p.household.filingStatus = "single"; p.taxes.thisYear.otherOrdinary = 30000; p.taxes.estimated.paid = paid; if (prior) p.taxes.priorYear = prior; return p; };

test("gap #15, test 3: the rate on a day is the newest quarter on or before it; past the table, the newest, said as 'the rate through'", () => {
  // the IRS table as read 2026-11-13: 8% all of 2024, 7% all of 2025, 2026 7%, 6%, 7%, 7%
  assert.deepEqual(Object.entries(UNDERPAYMENT_RATES).filter(([k]) => k.startsWith("2026")), [["2026Q1", 0.07], ["2026Q2", 0.06], ["2026Q3", 0.07], ["2026Q4", 0.07]]);
  assert.deepEqual(rateOn(G), { rate: 0.07, quarter: "2026Q4", known: true, through: "2026-12-31" });
  assert.deepEqual(rateOn("2026-05-01"), { rate: 0.06, quarter: "2026Q2", known: true, through: "2026-12-31" });
  assert.equal(rateOn("2026-07-01").rate, 0.07); assert.equal(rateOn("2026-06-30").rate, 0.06); assert.equal(rateOn("2024-06-30").rate, 0.08);
  // the first quarter of 2027 was not published on 2026-11-13: the newest known rate, not known for that day
  assert.deepEqual(rateOn("2027-01-15"), { rate: 0.07, quarter: "2026Q4", known: false, through: "2026-12-31" });
  // a gap in a table: the newest at or before the day, never a later one
  const T = { "2026Q1": 0.07, "2026Q3": 0.05 };
  assert.equal(rateOn("2026-05-01", T).rate, 0.07); assert.equal(rateOn("2026-05-01", T).known, false); assert.equal(rateOn("2026-08-01", T).rate, 0.05);
  // before the table: its first rate, not known
  assert.deepEqual(rateOn("2023-12-31"), { rate: 0.08, quarter: "2024Q1", known: false, through: "2026-12-31" });
});

test("gap #15, test 1: $2,100 x 7% x 31 days / 365 = $12.48 for the January payment one month late", () => {
  const c = lateCharge(2100, "2027-01-15", "2027-02-15");
  assert.equal(c.days, 31); close(c.cost, 2100 * 0.07 * 31 / 365); close(c.cost, 12.48);
  assert.deepEqual(c.parts.map((x) => [x.from, x.to, x.days, x.rate, x.yearDays]), [["2027-01-15", "2027-02-15", 31, 0.07, 365]]);
  // across a change of rate: March 15 to April 15, 2026 is 17 days at 7% and 14 at 6%
  close(lateCharge(1000, "2026-03-15", "2026-04-15").cost, 1000 * (0.07 * 17 + 0.06 * 14) / 365, 1e-9);
  // a leap year counts 366 days (Form 2210 for 2024: "x (61 / 366) x 0.08"); across a year end, each year its own
  close(lateCharge(1000, "2024-02-15", "2024-03-15").cost, 1000 * 0.08 * 29 / 366, 1e-9);
  close(lateCharge(1000, "2024-12-17", "2025-01-16").cost, 1000 * (0.08 * 15 / 366 + 0.07 * 15 / 365), 1e-9);
  // nothing late, nothing owed
  assert.equal(lateCharge(0, "2026-04-15", "2026-05-15").cost, 0); assert.equal(lateCharge(500, "2026-05-15", "2026-04-15").cost, 0);
});

test("gap #15, test 2: no payment due gives no part (no estimates needed, or nothing earned)", () => {
  assert.equal(lateCosts(compute(emptyPlan(), { today: G }), { today: G }), null);
  const d = compute(interest([0, 0, 0, 0], { tax: 0, agi: 30000 }), { today: G });   // no tax last year: nothing to pay in (IRC 6654(e)(2))
  assert.equal(d.needsEstimates, false); assert.equal(lateCosts(d, { today: G }), null);
  assert.equal(lateCosts({ needsEstimates: false, quarters: [] }, { today: G }), null);
});

test("gap #15, the next payment: paying the $2,100 due January 15 one month late costs about $12", async () => {
  const { lateWords } = await import("./view.js");
  const d = compute(rae([2100, 2100, 2100, 0], 8400), { today: G });
  assert.equal(d.perQuarter, 2100); assert.equal(d.nextDue.due, "2027-01-15");
  const L = lateCosts(d, { today: G });
  assert.equal(L.case, "next"); assert.equal(L.next.amount, 2100); assert.equal(L.next.days, 31); close(L.next.cost, 12.48);
  assert.equal(L.rate.rate, 0.07); assert.equal(L.rate.known, false, "January 2027's rate is not published yet");
  const w = lateWords(L, { money: (n) => fmt.money(n), money2: (n) => fmt.money(n, "USD", "en-US", 2), date: fmt.date });
  assert.equal(w.lead, "Paying the $2,100 due 1/15/2027 one month late costs about $12.");
  assert.equal(w.says, "about $12");
  assert.ok(w.lines.some((l) => l === "$2,100 × 7% × 31 days ÷ 365 = $12.48"), w.lines.join(" | "));
  assert.ok(w.lines.some((l) => l.startsWith("7%, the rate through 12/31/2026. The IRS sets each quarter's rate a few weeks ahead")), w.lines.join(" | "));
  assert.ok(w.lines.includes("From the IRS Form 2210 instructions and the IRS quarterly interest rates, read 11/13/2026."), w.lines.join(" | "));
  // a day whose quarter is in the table names it
  const k = lateWords(lateCosts(compute(rae([0, 0, 0, 0]), { today: "2026-03-01" }), { today: "2026-03-01" }), { money: (n) => fmt.money(n), money2: (n) => fmt.money(n, "USD", "en-US", 2), date: fmt.date });
  assert.equal(k.lead, "Paying the $2,800 due 4/15/2026 one month late costs about $14.");   // 2,800 x 6% x 30 / 365 = 13.81
  assert.ok(k.lines.includes("6% is the rate for April to June 2026. It is set each quarter: what the government pays to borrow for a short time, plus 3 points."), k.lines.join(" | "));
});

test("gap #15, behind: what the payments behind have cost so far, day by day at each quarter's rate, and what each month adds", async () => {
  const { lateWords } = await import("./view.js");
  // Rae paid nothing: 2,800 due April 15, 5,600 from June 15, 8,400 from September 15 (worked by hand, not by the code):
  //   Apr 15-Jun 14: 2,800 x 6% x 61 / 365 = 28.0767        Jun 15-30: 5,600 x 6% x 16 / 365 = 14.7288
  //   Jul 1-Sep 14: 5,600 x 7% x 76 / 365 = 81.6219         Sep 15-30: 8,400 x 7% x 16 / 365 = 25.7753
  //   Oct 1-Nov 1: 8,400 x 7% x 32 / 365 = 51.5507          so far, on November 2: 201.7534
  const d = compute(rae([0, 0, 0, 0]), { today: "2026-11-02" });
  const L = lateCosts(d, { today: "2026-11-02" });
  assert.equal(L.case, "behind"); assert.equal(L.behind.amount, 8400); assert.equal(L.behind.since, "2026-04-15");
  close(L.behind.soFar, 28.0767 + 14.7288 + 81.6219 + 25.7753 + 51.5507, 0.001);
  close(L.behind.perMonth.cost, 8400 * 0.07 * 30 / 365, 1e-9);   // November 2 to December 2
  const w = lateWords(L, { money: (n) => fmt.money(n), money2: (n) => fmt.money(n, "USD", "en-US", 2), date: fmt.date });
  assert.equal(w.lead, "Paying late has cost about $202 since 4/15/2026, and the $8,400 behind adds about $48 for each month it waits.");
  assert.equal(L.behind.from, "2026-04-15"); assert.deepEqual(L.behind.earlier, [], "no quarter paid late and covered since");
  assert.equal(w.says, "about $202 so far");
  assert.ok(w.lines.includes("Paying the $2,800 due 1/15/2027 one month late costs about $17."), w.lines.join(" | "));
  // two quarters paid: only the third is behind, since September 15 (Sep 15-30 at 7%, then October at 7%)
  const e = lateCosts(compute(rae([2800, 2800, 0, 0]), { today: "2026-11-02" }), { today: "2026-11-02" });
  assert.equal(e.case, "behind"); assert.equal(e.behind.since, "2026-09-15"); close(e.behind.soFar, 2800 * 0.07 * 48 / 365, 1e-6);
  // a day after the due date: less than a dollar, said so
  const f = lateCosts(compute(rae([2800, 2800, 0, 0]), { today: "2026-09-16" }), { today: "2026-09-16" });
  assert.equal(lateWords(f, { money: (n) => fmt.money(n), money2: (n) => fmt.money(n, "USD", "en-US", 2), date: fmt.date }).lead, "Paying late has cost less than $1 since 9/15/2026, and the $2,800 behind adds about $16 for each month it waits.");
});

test("gap #15, after the return is due: the charge for paying late stopped on April 15 of the next year", async () => {
  const { lateWords } = await import("./view.js");
  const p = rae([0, 0, 0, 0]); p.taxes.year = 2026;
  const L = lateCosts(compute(p, { today: "2027-05-03" }), { today: "2027-05-03" });
  assert.equal(L.case, "after"); assert.equal(L.stops, "2027-04-15");
  // to April 15, 2027: the 201.75 by November 2 plus 11,200 from January 15 ... worked from the pieces
  const by = (amt, a, b) => lateCharge(amt, a, b).cost;
  close(L.behind.soFar, by(2800, "2026-04-15", "2026-06-15") + by(5600, "2026-06-15", "2026-09-15") + by(8400, "2026-09-15", "2027-01-15") + by(11200, "2027-01-15", "2027-04-15"), 1e-6);
  assert.equal(lateWords(L, { money: (n) => fmt.money(n), money2: (n) => fmt.money(n, "USD", "en-US", 2), date: fmt.date }).lead,
    `Paying late cost about ${fmt.money(L.behind.soFar)} up to 4/15/2027; after that, unpaid tax costs interest and a late-payment charge instead.`);
});

test("critic F1 (2026-11-13): a quarter short on its date and covered since: 'so far' counts from that date and the words say so", async () => {
  const { lateWords } = await import("./view.js");
  const W = { money: (n) => fmt.money(n), money2: (n) => fmt.money(n, "USD", "en-US", 2), date: fmt.date };
  const { freelancerPlan } = await H8();
  // Jo (invented) typed 1,333.33, 1,333.33 and 1,333.34 against a share of about 3,577.15 a quarter (s). By hand, each box
  // paid on its own quarter's due date, payments going to the earliest quarter first:
  //   Apr 15-Jun 14: s - 1,333.33 = 2,243.82 late x 6% x 61 / 365 = 22.50   (the 1st quarter: short until September 15)
  //   Jun 15-30: 2s - 2,666.66 = 4,487.64 x 6% x 16 / 365 = 11.80           Jul 1-Sep 14: 4,487.64 x 7% x 76 / 365 = 65.41
  //   Sep 15-Nov 12: 3s - 4,000 = 6,731.45 x 7% x 59 / 365 = 76.17          so far, on November 13: 175.88
  // The 1st quarter is paid now (the three boxes reach its share) but was late: the charge began April 15, not June 15.
  const d = compute(freelancerPlan(), { today: G });
  const s = d.perQuarter;
  assert.deepEqual(d.quarters.map((q) => [q.status, q.late]), [["paid", true], ["short", true], ["short", true], ["upcoming", false]]);
  const L = lateCosts(d, { today: G });
  assert.equal(L.case, "behind"); assert.equal(L.behind.since, "2026-06-15", "behind now from the 2nd quarter");
  assert.equal(L.behind.from, "2026-04-15", "the charge began on the 1st quarter's date");
  assert.equal(L.behind.earlier.length, 1); assert.equal(L.behind.earlier[0].label, "1st quarter"); assert.equal(L.behind.earlier[0].due, "2026-04-15");
  close(L.behind.earlier[0].short, s - 1333.33, 1e-9);
  close(L.behind.soFar, (s - 1333.33) * 0.06 * 61 / 365 + (2 * s - 2666.66) * (0.06 * 16 + 0.07 * 76) / 365 + (3 * s - 4000) * 0.07 * 59 / 365, 1e-6);
  close(L.behind.soFar, 175.88, 0.005);
  const w = lateWords(L, W);
  assert.equal(w.lead, "Paying late has cost about $176 since 4/15/2026, and the $6,731 behind adds about $39 for each month it waits.");
  assert.equal(w.lines[0], "The 1st quarter is paid now, but it was $2,244 short on 4/15/2026: the days until later payments covered it count too.");
  // two quarters short and covered since by a third box: both named, the charge from the first
  const two = lateCosts(compute(rae([0, 0, 7000, 0]), { today: G }), { today: G });
  assert.equal(two.case, "behind"); assert.equal(two.behind.since, "2026-09-15"); assert.equal(two.behind.from, "2026-04-15");
  assert.deepEqual(two.behind.earlier.map((x) => x.label), ["1st quarter", "2nd quarter"]);
  const tw = lateWords(two, W);
  assert.match(tw.lead, /^Paying late has cost about \$\d+ since 4\/15\/2026, and the \$1,400 behind adds about \$\d+ for each month it waits\.$/);
  assert.equal(tw.lines[0], "The 1st and 2nd quarters are paid now, but each was short on its due date: the days until later payments covered them count too.");
  close(two.behind.soFar, lateCharge(2800, "2026-04-15", "2026-06-15").cost + lateCharge(5600, "2026-06-15", "2026-09-15").cost + lateCharge(1400, "2026-09-15", G).cost, 1e-6);
  // after the return's due date: the same, up to April 15
  const p = freelancerPlan(); p.taxes.year = 2026;
  const a = lateCosts(compute(p, { today: "2027-05-03" }), { today: "2027-05-03" });
  assert.equal(a.case, "after"); assert.equal(a.behind.from, "2026-04-15");
  const aw = lateWords(a, W);
  assert.match(aw.lead, /^Paying late cost about \$\d+ up to 4\/15\/2027; after that, unpaid tax costs interest and a late-payment charge instead\.$/);
  assert.equal(aw.lines[0], "The 1st quarter is paid now, but it was $2,244 short on 4/15/2026: the days until later payments covered it count too.");
});

test("gap #15, a payment made late and caught up since: what each month late cost", async () => {
  const { lateWords } = await import("./view.js");
  // 1,420 of tax, safe amount 1,278, 319.50 a quarter: nothing in the first box on April 15, 700 in the second
  const d = compute(interest([0, 700, 0, 0]), { today: "2026-07-20" });
  const L = lateCosts(d, { today: "2026-07-20" });
  assert.equal(L.case, "late"); assert.equal(L.late.label, "1st quarter"); assert.equal(L.late.due, "2026-04-15"); close(L.late.short, 319.5, 1e-9);
  close(L.late.perMonth.cost, 319.5 * 0.06 * 30 / 365, 1e-9);   // April 15 to May 15 at the second quarter's 6%
  const w = lateWords(L, { money: (n) => fmt.money(n), money2: (n) => fmt.money(n, "USD", "en-US", 2), date: fmt.date });
  assert.equal(w.lead, "The 1st quarter's payment came after 4/15/2026: about $2 for each month it was late.");
  assert.equal(w.says, "about $2 a month");
  assert.ok(w.lines.includes("Paying the $259 due 9/15/2026 one month late costs about $1."), w.lines.join(" | "));
});

test("gap #15, test 4: the safe amount paid in time: no penalty, by last year's tax or this year's", async () => {
  const { lateWords } = await import("./view.js");
  const W = { money: (n) => fmt.money(n), money2: (n) => fmt.money(n, "USD", "en-US", 2), date: fmt.date };
  const last = lateCosts(compute(interest([250, 250, 250, 250], { tax: 1000, agi: 30000 }), { today: "2026-11-02" }), { today: "2026-11-02" });
  assert.equal(last.case, "met"); assert.equal(lateWords(last, W).lead, "No penalty: you paid in 100% of last year's tax in time.");
  assert.equal(lateWords(last, W).says, "no penalty");
  const high = lateCosts(compute(interest([275, 275, 275, 275], { tax: 1000, agi: 160000 }), { today: "2026-11-02" }), { today: "2026-11-02" });
  assert.equal(lateWords(high, W).lead, "No penalty: you paid in 110% of last year's tax in time.");
  const now = lateCosts(compute(interest([319.5, 319.5, 639, 0]), { today: "2026-11-02" }), { today: "2026-11-02" });
  assert.equal(now.case, "met"); assert.equal(lateWords(now, W).lead, "No penalty: you paid in 90% of this year's tax in time.");
});

test("gap #15, paying through withholding or a withdrawal instead: no penalty if it is held back by December 31", async () => {
  const { lateWords } = await import("./view.js");
  const W = { money: (n) => fmt.money(n), money2: (n) => fmt.money(n, "USD", "en-US", 2), date: fmt.date };
  const d = compute(rae([0, 0, 0, 0]), { today: "2026-11-02" });
  const pay = lateCosts(d, { today: "2026-11-02", via: "pay" }), wd = lateCosts(d, { today: "2026-11-02", via: "withdrawal" });
  assert.equal(pay.case, "withheld"); assert.equal(wd.case, "withheld");
  assert.equal(lateWords(pay, W).lead, "No penalty if the extra is taken from pay before December 31: the IRS counts tax withheld from pay as paid evenly through the year.");
  assert.equal(lateWords(wd, W).lead, "No penalty if the extra is held back from your IRA withdrawal before December 31: the IRS counts it as paid evenly through the year.");
  assert.equal(lateWords(pay, W).says, "none if withheld"); assert.equal(lateWords(wd, W).says, "none if held back");
});

test("gap #15: every case's words fill the part (forty words or more) and its status fits 20 characters", async () => {
  const { lateWords } = await import("./view.js");
  const W = { money: (n) => fmt.money(n), money2: (n) => fmt.money(n, "USD", "en-US", 2), date: fmt.date };
  const cases = [
    lateCosts(compute(rae([2100, 2100, 2100, 0], 8400), { today: G }), { today: G }),
    lateCosts(compute(rae([0, 0, 0, 0]), { today: "2026-11-02" }), { today: "2026-11-02" }),
    lateCosts(compute(interest([0, 700, 0, 0]), { today: "2026-07-20" }), { today: "2026-07-20" }),
    lateCosts(compute(interest([250, 250, 250, 250], { tax: 1000, agi: 30000 }), { today: "2026-11-02" }), { today: "2026-11-02" }),
    lateCosts(compute(rae([0, 0, 0, 0]), { today: "2026-11-02" }), { today: "2026-11-02", via: "pay" }),
    (() => { const p = rae([0, 0, 0, 0]); p.taxes.year = 2026; return lateCosts(compute(p, { today: "2027-05-03" }), { today: "2027-05-03" }); })(),
  ];
  assert.deepEqual(cases.map((c) => c.case), ["next", "behind", "late", "met", "withheld", "after"]);
  for (const c of cases) {
    const w = lateWords(c, W);
    const words = [w.lead, ...w.lines].join(" ").split(/\s+/).length;
    assert.ok(words >= 40, `${c.case}: ${words} words`); assert.ok(w.says.length <= 20, w.says);
    assert.ok(!/undefined|NaN|null/.test([w.lead, ...w.lines, w.says].join(" ")), [w.lead, ...w.lines].join(" | "));
  }
});


// ---- the page, drawn with the real kit on the fake DOM (opt C12: the next payment first; the rest one tap away)
const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
const appendOf = FakeElement.prototype.append;
FakeElement.prototype.append = function (...ns) {
  if (ns.some((n) => n === null || n === undefined)) throw new Error(`append(${ns.map((n) => (n === null || n === undefined ? String(n) : typeof n)).join(", ")}): a browser would write "${String(ns.find((n) => n == null))}"`);
  return appendOf.apply(this, ns);
};
const kit = await import("../../../core/ui/dom.js");
const { migrate: migrated } = await import("../../../core/schema/migrate.js");
const { render: drawPage } = await import("./view.js");
/** Draw the page as the shell does: store.update records the draft and draws again. */
function page(plan0, today = G) {
  let plan = migrated(structuredClone(plan0));
  const s = { saved: [], root: null };
  const ctx = () => ({ ui: kit, fmt: { ...fmt, today: () => today }, plan, route: { group: "taxes", id: "estimated", rest: [], query: {} },
    store: { get: () => plan, update: (fn) => { const dr = structuredClone(plan); fn(dr); s.saved.push(dr); plan = dr; draw(); } }, redraw: () => draw() });
  const draw = () => { s.root = new FakeElement("main"); drawPage(s.root, ctx()); };
  draw();
  s.plan = () => plan;
  return s;
}
const every = (el) => [el, ...el.all()];
const partsOf = (root) => every(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partOf = (root, id) => partsOf(root).find((e) => e.dataset.part === id) ?? null;
const isOpen = (el) => el.hasAttribute("open");
const titleOf = (el) => el.querySelector(".fold-title")?.textContent ?? "";
const statusIn = (el) => el.querySelector(".fold-status")?.textContent ?? "";
/** The words a person sees without opening anything: a shut part shows only its summary. */
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !isOpen(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/\s+/g, " ").trim();
}
const shutAround = (e) => { for (let p = e.parentNode; p; p = p.parentNode) if (p.tagName === "DETAILS" && !isOpen(p)) return true; return false; };
const filled = (root) => every(root).filter((e) => (e.tagName === "BUTTON" || (e.tagName === "A" && /\bbtn\b/.test(e.className))) && !/secondary|chip|link|ghost|small|danger/.test(e.className) && !shutAround(e));
const boxesSeen = (root) => every(root).filter((e) => e.tagName === "INPUT" && !shutAround(e));

test("gap #15 / opt C12: Rae (no tax taken from pay, the next payment due): the next payment first, three more one tap away, one parts card", () => {
  const s = page(rae([2100, 2100, 2100, 0], 8400));
  const t = seen(s.root);
  assert.match(t, /^\$2,100 due by 1\/15\/2027 /, t.slice(0, 200));
  // the next payment's row on the first view, the other three under "3 more payments"
  const more = partOf(s.root, "payments");
  assert.equal(titleOf(more), "3 more payments"); assert.ok(!isOpen(more));
  const list = t.slice(t.indexOf("The four payments for 2026"));
  assert.ok(list.includes("4th quarter") && list.includes("due 1/15/2027"), list);
  assert.ok(!/1st quarter|2nd quarter|3rd quarter/.test(list), list);
  // the parts card: 4 more numbers, What you paid, Last year's return, What paying late costs, in that order, all shut
  const card = every(s.root).find((e) => e.dataset?.parts !== undefined);
  assert.deepEqual(partsOf(card).map((e) => [e.dataset.part, titleOf(e), isOpen(e)]), [
    ["numbers", "4 more numbers", false], ["paid", "What you paid", false], ["prior", "Last year's return", false], ["late", "What paying late costs", false]]);
  assert.equal(statusIn(partOf(s.root, "paid")), "$6,300 paid"); assert.equal(statusIn(partOf(s.root, "prior")), "tax $8,400");
  assert.equal(statusIn(partOf(s.root, "late")), "about $12");
  assert.ok(partOf(s.root, "late").textContent.includes("Paying the $2,100 due 1/15/2027 one month late costs about $12."));
  // at most one filled button and no box on the first view; nothing was lost (the tiles and the forms are inside)
  assert.ok(filled(s.root).length <= 1, filled(s.root).map((b) => b.textContent).join(", "));
  assert.equal(boxesSeen(s.root).length, 0);
  for (const w of ["Safe amount", "Withholding covers", "By estimates", "At filing time", "Save payments", "Last year's total tax"]) assert.ok(s.root.textContent.includes(w), w);
  for (const p of partsOf(s.root)) assert.ok(statusIn(p).length <= 20, statusIn(p));
  // March 1: the first payment is next; the other three wait under "3 more payments"
  const m = page(rae([0, 0, 0, 0]), "2026-03-01");
  assert.equal(titleOf(partOf(m.root, "payments")), "3 more payments");
  assert.match(seen(m.root), /^\$2,800 due by 4\/15\/2026 /);
});

test("gap #15 / opt C12: behind with nothing typed yet (where Needs attention sends you to type it): What you paid is open, Save payments the one filled button", () => {
  const s = page(rae([0, 0, 0, 0]), "2026-11-02");
  const paid = partOf(s.root, "paid");
  assert.ok(isOpen(paid)); assert.equal(statusIn(paid), "not set yet");
  assert.deepEqual(filled(s.root).map((b) => b.textContent), ["Save payments"]);
  // the three past-due quarters and the next one stay in sight (a deadline is never folded): no "more payments" part
  assert.equal(partOf(s.root, "payments"), null);
  const t = seen(s.root);
  for (const q of ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]) assert.ok(t.includes(q), q);
  assert.ok(partOf(s.root, "late").textContent.includes("Paying late has cost about $202 since 4/15/2026, and the $8,400 behind"));
  // once something is typed, the part waits shut again ("$2,800 paid")
  const r = page(rae([2800, 0, 0, 0]), "2026-11-02");
  assert.ok(!isOpen(partOf(r.root, "paid"))); assert.equal(statusIn(partOf(r.root, "paid")), "$2,800 paid");
});

test("gap #15 / opt C12 (R7, R17): a save names the new answer in the green line and keeps its own part open", () => {
  const s = page(rae([2100, 2100, 2100, 0], 8400));
  const f = partOf(s.root, "paid").querySelector("form");
  f.querySelector('[name="q3"]').value = "2100";
  f.dispatch("submit");
  assert.deepEqual(s.plan().taxes.estimated.paid, [2100, 2100, 2100, 2100]);
  const t = seen(s.root);
  // all four in: the headline says so (it said "Estimated payments"), and the green line names it
  assert.match(t, /^All four payments for 2026 are in /);
  assert.ok(t.includes("Payments saved. All four payments for 2026 are in."), t.slice(-300));
  assert.ok(isOpen(partOf(s.root, "paid")), "the saved part stays open");
  assert.ok(!isOpen(partOf(s.root, "prior")) && !isOpen(partOf(s.root, "numbers")), "no other part opens");
  assert.equal(statusIn(partOf(s.root, "late")), "no penalty");
  // a save that changes nothing in the answer says only that it saved
  const u = page(rae([2100, 2100, 2100, 0], 8400));
  const g = partOf(u.root, "paid").querySelector("form"); g.querySelector('[name="q0"]').value = "2100"; g.dispatch("submit");
  assert.ok(seen(u.root).includes("Payments saved.") && !seen(u.root).includes("Payments saved. $2,100"), seen(u.root).slice(-200));
});

test("S11: after a save only the saved part changes: What you paid after Save payments, Last year's return after its Save", () => {
  const openOf = (root) => Object.fromEntries(partsOf(root).map((e) => [e.dataset.part, isOpen(e)]));
  // every part drawn after the save is as it was before it (a part drawn new comes shut), but the one saved in: open
  const onlySaved = (before, after, saved) => {
    assert.equal(after[saved], true, `${saved} stays open`);
    for (const [id, o] of Object.entries(after)) if (id !== saved) assert.equal(o, before[id] ?? false, `${id} did not move`);
  };
  const s = page(rae([2100, 2100, 2100, 0], 8400));
  const before = openOf(s.root);
  assert.deepEqual(before, { payments: false, numbers: false, paid: false, prior: false, late: false });
  const f = partOf(s.root, "paid").querySelector("form");
  f.querySelector('[name="q3"]').value = "1000";
  f.dispatch("submit");
  assert.equal(s.saved.length, 1);
  onlySaved(before, openOf(s.root), "paid");
  const t = page(rae([2100, 2100, 2100, 0], 8400));
  const was = openOf(t.root);
  const g = partOf(t.root, "prior").querySelector("form");
  g.querySelector('[name="tax"]').value = "8000";
  g.dispatch("submit");
  assert.equal(t.saved.length, 1);
  onlySaved(was, openOf(t.root), "prior");
});

test("gap #15 / opt C12 (R7): last year's figures saved: the green line names the new safe amount or the new answer", () => {
  const s = page(rae([2100, 2100, 2100, 0], 8400));
  const f = partOf(s.root, "prior").querySelector("form");
  f.querySelector('[name="tax"]').value = "8000";
  f.dispatch("submit");
  assert.equal(s.plan().taxes.priorYear.tax, 8000);
  assert.ok(isOpen(partOf(s.root, "prior")), "the saved part stays open");
  // 8,000 of last year's tax: 2,000 a quarter, all four now covered by the 6,300 paid? no: 8,000 - 6,300 = 1,700 next
  assert.ok(seen(s.root).includes("Last year's figures saved. $1,700 due by 1/15/2027."), seen(s.root).slice(-300));
});

test("gap #15 / opt C12: no estimates needed: no payments card, no late part; nothing earned: Add your income and last year's return only", () => {
  const s = page(interest([0, 0, 0, 0], { tax: 0, agi: 30000 }), "2026-11-02");
  assert.match(seen(s.root), /^No estimated payments needed /);
  assert.equal(partOf(s.root, "late"), null); assert.ok(!seen(s.root).includes("The four payments"));
  assert.deepEqual(partsOf(s.root).map((x) => x.dataset.part), ["numbers", "paid", "prior"]);
  const e = page(emptyPlan());
  assert.deepEqual(partsOf(e.root).map((x) => [x.dataset.part, statusIn(x)]), [["prior", "not set yet"]]);
  assert.deepEqual(filled(e.root).map((b) => b.textContent), ["Add your income"]);
});

test("gap #15 / opt C12: paying through pay (the family) or an IRA withdrawal (the widow): one filled button, the late part says no penalty", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const fam = page(familyPlan("2026-11-13"), "2026-11-13");
  const d = compute(migrated(familyPlan("2026-11-13")), { today: "2026-11-13" });
  assert.ok(d.needsEstimates && d.withholding > 0 && d.remaining > 0, "the family pays its tax through pay");
  {
    assert.deepEqual(filled(fam.root).map((b) => b.textContent), ["Work out the W-4 change"]);
    assert.ok(!isOpen(partOf(fam.root, "paid")));
    assert.ok(partOf(fam.root, "late").textContent.includes("No penalty if the extra is taken from pay before December 31"));
    // the quarters "not paid" are no deadline on this route: the next payment shows, the others wait under "3 more payments"
    assert.equal(titleOf(partOf(fam.root, "payments")), "3 more payments");
  }
  const { widowPlan } = await H8();
  const w = page(widowPlan(), R8);
  assert.ok(seen(w.root).startsWith("Have about $3,600 of tax held back from your IRA withdrawal"), seen(w.root).slice(0, 120));
  assert.ok(filled(w.root).length <= 1, filled(w.root).map((b) => b.textContent).join(", "));
  assert.ok(partOf(w.root, "late").textContent.includes("No penalty if the extra is held back from your IRA withdrawal before December 31"));
});

test("critic F1 (2026-11-13): a quarter covered after its due date says 'paid late' on its row; on the pay route, 'paid'", async () => {
  const rows = (root) => every(root).filter((e) => /\brec-title\b/.test(e.className ?? "")).map((e) => e.textContent.replace(/\s+/g, " ").trim());
  const { freelancerPlan } = await H8();
  assert.deepEqual(rows(page(freelancerPlan(), G).root).sort(), ["1st quarter paid late", "2nd quarter behind", "3rd quarter behind", "4th quarter upcoming"]);
  // the late case: nothing in the first box on April 15, 700 in the second
  assert.deepEqual(rows(page(interest([0, 700, 0, 0]), "2026-07-20").root).sort(), ["1st quarter paid late", "2nd quarter paid", "3rd quarter upcoming", "4th quarter upcoming"]);
  // the family pays its tax through pay: withholding raised before December 31 counts for the earlier quarters too (IRC 6654(g))
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const fp = familyPlan(G); const per = compute(migrated(structuredClone(fp)), { today: G }).perQuarter;
  fp.taxes.estimated = { paid: [0, Math.round(per * 2), 0, 0], typedAt: G };
  assert.equal(compute(migrated(structuredClone(fp)), { today: G }).quarters[0].late, true);
  assert.ok(rows(page(fp, G).root).includes("1st quarter paid"), "paid, not paid late, on the pay route");
});

// ---- invariance (gap spec 3.5): the design adds no plan field, and compute() is what it was
test("gap #15 invariance: compute() keeps its keys over the invented households and the fixture plans; lateCosts changes nothing it reads", async () => {
  const { familyPlan: fp } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const KEYS = ["year", "filingStatus", "totalTax", "creditsBack", "seTax", "withholding", "withholdingFrom", "withholdingDetail", "harbour", "toPayByEstimates", "perQuarter", "quarters", "paid", "remaining", "behind", "overdue", "nextDue", "balanceAtFiling", "lateQuarter", "penaltyRisk", "needsEstimates", "paidTyped", "hasPrior", "priorTax", "priorAgi", "notes", "hasIncome", "balanceAfterWithholding", "returns"];
  const plans = [["family", fp(G)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan()], ["empty", emptyPlan()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  assert.ok(plans.length >= 18);
  for (const [name, p0] of plans) {
    const p = migrated(structuredClone(p0));
    const d = compute(p, { today: G });
    assert.deepEqual(Object.keys(d).filter((k) => k !== "holdBack"), KEYS, name);
    const before = JSON.stringify(d);
    const L = lateCosts(d, { today: G });
    assert.equal(JSON.stringify(d), before, `${name}: lateCosts reads, never writes`);
    assert.equal(JSON.stringify(compute(p, { today: G })), before, `${name}: the same output again`);
    if (L) assert.ok(["next", "behind", "late", "met", "after", "withheld"].includes(L.case), name);
  }
});
