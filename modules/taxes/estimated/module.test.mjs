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
  assert.ok(t.includes("Payments from the 1st quarter") && !t.includes("payments from the 1st quarter"), t.slice(0, 600));
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
