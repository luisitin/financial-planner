// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs) and
// tests/golden-limits.test.mjs (the answer key, tests/golden/limits/RULES.md). Here: one test per formula, with the
// invented people of RULES.md section 10.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, payrollTaxSaved, withoutHsaPayroll } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import fs from "node:fs";

const near = (a, b, tol = 0.011) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);

/** One plan: adults with pay, pre-tax 401(k), traditional IRA and HSA money (each as a Contributions row on their own account). */
function planOf({ status = "single", cover, coveredId, fsa = 0, people }) {
  const p = emptyPlan();
  p.household.filingStatus = status;
  p.household.people = people.map((x, i) => ({ id: x.id, name: x.name, role: i ? "partner" : "self", birthDate: x.birth }));
  p.income = people.filter((x) => x.pay).map((x) => ({ id: `pay-${x.id}`, name: "Pay", type: "salary", personId: x.id, amount: x.pay, period: "annual", growth: 0, taxable: true }));
  p.accounts = []; p.retirement.contributions = [];
  for (const x of people) for (const [key, type] of [["k401", "401k"], ["ira", "ira"], ["hsa", "hsa"]]) {
    const amount = x[key] ?? 0, match = key === "hsa" ? x.hsaEmployer ?? 0 : 0;
    if (!(amount > 0 || match > 0)) continue;
    p.accounts.push({ id: `${key}-${x.id}`, name: key, type, balance: 0, ownerId: x.id });
    p.retirement.contributions.push({ id: `c-${key}-${x.id}`, accountId: `${key}-${x.id}`, personId: x.id, amount, period: "annual", employerMatch: match });
  }
  const sum = (k) => people.reduce((s, x) => s + (x[k] ?? 0), 0);
  p.taxes.hsa = { coverage: cover, contribution: sum("hsa"), employer: sum("hsaEmployer"), fsa, fsaSpent: 0 };
  if (coveredId) p.taxes.hsa.coveredId = coveredId;
  return p;
}
const kai = (pay, extra = {}) => planOf({ cover: "self", ...extra, people: [{ id: "kai", name: "Kai", birth: "1981-06-01", pay, k401: 24500, hsa: 4400, ...(extra.kai ?? {}) }] });

test("hsa-fsa: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("payroll tax saved: 6.2% only below the Social Security pay limit, 1.45% on all (3101(a), (b)(1); 3121(a)(1))", () => {
  const below = payrollTaxSaved(95000, 90000, 184500);
  near(below.socialSecurity, 310); near(below.medicare, 72.5); near(below.total, 382.5);
  // RULES.md 10.5: Kai at 210,000 stays above the base: Medicare only; at 186,000 the money straddles it
  const above = payrollTaxSaved(210000, 205600, 184500);
  near(above.socialSecurity, 0); near(above.medicare, 63.8);
  const across = payrollTaxSaved(186000, 181600, 184500);
  near(across.socialSecurity, 179.8); near(across.total, 243.6);
  near(payrollTaxSaved(-500, -900, 184500).total, 0);   // wages from 0 up
});

test("tax saved, Kai above the wage base (RULES.md 10.5): income tax 1,056 + additional Medicare 39.60; payroll tax 63.80, not 336.60", () => {
  const d = compute(kai(210000), { today: "2026-06-01" });
  near(d.wageBase, 184500, 0);
  near(d.hsa.taxSaved, 1056 + 39.6, 0.02);   // the Medicare wages fall by the money too, so the 0.9% tax is in the saving
  near(d.hsa.ficaSaved, 63.8); near(d.hsa.socialSecuritySaved, 0);
  assert.deepEqual(d.hsa.aboveWageBase, ["Kai"]);
  const e = compute(kai(186000), { today: "2026-06-01" });
  near(e.hsa.taxSaved, 1056, 0.02); near(e.hsa.ficaSaved, 243.6);
  const f = compute(kai(95000, { kai: { k401: 0 } }), { today: "2026-06-01" });
  near(f.hsa.ficaSaved, 336.6); assert.deepEqual(f.hsa.aboveWageBase, []);
});

test("only money within the limit saves tax (106(d)(1); Pub. 15-B 'Up to specified dollar limits')", () => {
  // 5,000 through pay against a 4,400 self-only limit: 600 over, taxed as pay
  const d = compute(kai(95000, { kai: { k401: 0, hsa: 5000 } }), { today: "2026-06-01" });
  near(d.hsa.limit, 4400, 0); near(d.hsa.over, 600, 0); near(d.hsa.excess, 600, 0); near(d.hsa.deducted, 4400, 0);
  near(d.hsa.taxSaved, 0.22 * 4400, 0.02); near(d.hsa.ficaSaved, 0.0765 * 4400);
  assert.ok(d.notes.some((n) => /over the 2026 limit by \$600/.test(n)));
  // the 600 has to come out, so only 4,400 a year grows to 65
  near(d.hsa.kept, 4400, 0); near(d.hsa.futureContributions, 4400 * d.hsa.years, 0);
  near(d.hsa.futureValue, 4400 * (Math.pow(1 + d.hsa.growthRate, d.hsa.years) - 1) / d.hsa.growthRate);
});

test("no high-deductible plan: the limit is 0, nothing saves tax, and the page warns (223(b)(1), (c)(1))", () => {
  const d = compute(kai(95000, { cover: "none", kai: { k401: 0, hsa: 3000 } }), { today: "2026-06-01" });
  assert.equal(d.hsa.coverage, "none");
  near(d.hsa.limit, 0, 0); near(d.hsa.catchUp, 0, 0); near(d.hsa.room, 0, 0); near(d.hsa.over, 3000, 0); near(d.hsa.excess, 3000, 0);
  near(d.hsa.taxSaved, 0, 0.02); near(d.hsa.ficaSaved, 0); near(d.hsa.kept, 0, 0); near(d.hsa.futureValue, 0, 0);
  assert.ok(d.notes.some((n) => /no high-deductible health plan/.test(n)));
  // nothing going in: no warning, the limit is still 0
  const e = compute(kai(95000, { cover: "none", kai: { k401: 0, hsa: 0 } }), { today: "2026-06-01" });
  near(e.hsa.limit, 0, 0); assert.equal(e.notes.length, 0);
  // left out, the cover reads as self-only, the old default
  const p = kai(95000); delete p.taxes.hsa.coverage;
  near(compute(p, { today: "2026-06-01" }).hsa.limit, 4400, 0);
});

test("self-only coverage: only the covered adult's catch-up, and a spouse outside the plan saves nothing (223(b)(3); Pub. 969)", () => {
  const people = [{ id: "ana", name: "Ana", birth: "1986-02-01", pay: 90000, hsa: 2000 }, { id: "ben", name: "Ben", birth: "1968-02-01", pay: 60000 }];
  const d = compute(planOf({ status: "married_joint", cover: "self", people }), { today: "2026-06-01" });
  near(d.hsa.catchUp, 0, 0); near(d.hsa.limit, 4400, 0);   // Ben is 58 but not on Ana's plan
  assert.equal(d.hsa.coveredId, "ana");
  // the plan covers Ben instead: his catch-up counts, and Ana's 2,000 is not allowed
  const e = compute(planOf({ status: "married_joint", cover: "self", coveredId: "ben", people }), { today: "2026-06-01" });
  near(e.hsa.catchUp, 1000, 0); near(e.hsa.limit, 5400, 0); near(e.hsa.excess, 2000, 0);
  near(e.hsa.ficaSaved, 0); near(e.hsa.taxSaved, 0, 0.02);
  assert.ok(e.notes.some((n) => /Ana is not on the self-only health plan/.test(n)));
});

test("family coverage, married: the 2026 family limit plus each catch-up from 55 (RULES.md 10.4)", () => {
  const people = [{ id: "ana", name: "Ana", birth: "1970-02-01", pay: 90000, hsa: 3000, hsaEmployer: 1000 }, { id: "ben", name: "Ben", birth: "1974-02-01", pay: 80000, hsa: 5000, hsaEmployer: 500 }];
  const d = compute(planOf({ status: "married_joint", cover: "family", people }), { today: "2026-06-01" });
  near(d.hsa.limit, 9750, 0); near(d.hsa.total, 9500, 0); near(d.hsa.room, 250, 0); near(d.hsa.over, 0, 0);
  near(d.hsa.ficaSaved, 0.0765 * 8000);
});

test("2027: the HSA limits of Rev. Proc. 2026-24 (4,500 / 9,000), the FSA still 2026's", () => {
  const d = compute(kai(95000, { kai: { k401: 0 } }), { today: "2027-03-01" });
  assert.equal(d.limitsYear, 2027); assert.equal(d.fsaYear, 2026);
  near(d.hsa.limit, 4500, 0); near(d.hsa.room, 100, 0);
  const e = compute(kai(95000, { cover: "family", kai: { k401: 0 } }), { today: "2027-03-01" });
  near(e.hsa.limit, 9000, 0);
});

test("the health FSA is out of wages and payroll-tax wages, so the HSA saving is worked on what is left (125; 3121(a)(5)(G))", () => {
  // single 2026, pay 70,000, FSA 3,400, HSA 4,400: taxable without the HSA 50,500, with it 46,100 -> 100 at 22% + 4,300 at 12%
  const d = compute(kai(70000, { fsa: 3400, kai: { k401: 0 } }), { today: "2026-06-01" });
  near(d.hsa.taxSaved, 100 * 0.22 + 4300 * 0.12, 0.02);
  // pay 186,000 with the FSA: payroll-tax wages 182,600 without, 178,200 with, all under the 184,500 base
  const e = compute(kai(186000, { fsa: 3400, kai: { k401: 0 } }), { today: "2026-06-01" });
  near(e.hsa.socialSecuritySaved, 0.062 * 4400); near(e.hsa.ficaSaved, 0.0765 * 4400);
});

test("pre-tax 401(k) money over the limit is income, so the saving is at the higher rate (402(g)(1)(A))", () => {
  // pay 148,300, pre-tax 30,000 (5,500 over): wages 123,800, taxable without the HSA 107,700 -> 2,000 at 24% + 2,400 at 22%
  const d = compute(kai(148300, { kai: { k401: 30000 } }), { today: "2026-06-01" });
  near(d.hsa.taxSaved, 2000 * 0.24 + 2400 * 0.22, 0.02);
});

test("traditional IRA money over its limit is not deducted, so the saving is at the higher rate (219(b)(1))", () => {
  // pay 75,000, traditional IRA 10,000 (7,500 deducted): taxable without the HSA 51,400 -> 1,000 at 22% + 3,400 at 12%
  const d = compute(kai(75000, { kai: { k401: 0, ira: 10000 } }), { today: "2026-06-01" });
  near(d.hsa.taxSaved, 1000 * 0.22 + 3400 * 0.12, 0.02);
});

test("no pay on the Income page: the money within the limit saves the full 7.65%", () => {
  const p = emptyPlan(); p.taxes.hsa = { coverage: "self", contribution: 3000, employer: 0, fsa: 0, fsaSpent: 0 };
  near(compute(p, { today: "2026-06-01" }).hsa.ficaSaved, 229.5);
});

test("the return without the HSA money: own money from pay set to 0, the employer's kept, the plan untouched", () => {
  const p = kai(95000, { kai: { hsaEmployer: 500 } });
  const q = withoutHsaPayroll(p);
  assert.equal(q.taxes.hsa.contribution, 0); assert.equal(q.taxes.hsa.employer, 500);
  const row = q.retirement.contributions.find((c) => c.accountId === "hsa-kai");
  assert.equal(row.amount, 0); assert.equal(row.employerMatch, 500);
  assert.equal(p.taxes.hsa.contribution, 4400); assert.equal(p.retirement.contributions.find((c) => c.accountId === "hsa-kai").amount, 4400);
  assert.equal(q.retirement.contributions.find((c) => c.accountId === "k401-kai").amount, 24500);
});

test("typed wages are W-2 box 1, which already leaves the HSA money out: not deducted again, and added back for the return without it", async () => {
  const { compute: federal } = await import("../federal/compute.js");
  const auto = kai(150000), typed = kai(150000);
  const fa = federal(auto, { today: "2026-10-30" });
  typed.taxes.thisYear.wages = fa.inputs.wages - 4400;   // box 1: pay less the 401(k) and the HSA money from pay
  const ft = federal(typed, { today: "2026-10-30" });
  near(ft.inputs.adjustments, 0); near(ft.result.agi, fa.result.agi); near(ft.result.totalTax, fa.result.totalTax);
  // the HSA page's tax saved is the same whichever way the wages come in
  const a = compute(auto, { today: "2026-10-30" }), t = compute(typed, { today: "2026-10-30" });
  assert.ok(a.hsa.taxSaved > 0); near(t.hsa.taxSaved, a.hsa.taxSaved);
  assert.equal(withoutHsaPayroll(typed, { wagesAddBack: 4400 }).taxes.thisYear.wages, typed.taxes.thisYear.wages + 4400);
  assert.equal(withoutHsaPayroll(auto, { wagesAddBack: 4400 }).taxes.thisYear.wages ?? null, auto.taxes.thisYear.wages ?? null);   // nothing typed: untouched
});

test("each spouse elects their own health FSA, up to the limit each (IRC 125(i); Notice 2012-40)", async () => {
  const { compute: federal } = await import("../federal/compute.js");
  const two = () => planOf({ status: "married_joint", cover: "family", people: [
    { id: "ana", name: "Ana", birth: "1985-02-01", pay: 120000 }, { id: "bo", name: "Bo", birth: "1984-03-01", pay: 90000 }] });
  const base = federal(two(), { today: "2026-10-30" }).inputs.wages;
  const p = two(); p.taxes.hsa.fsa = 3400; p.taxes.hsa.fsaPartner = 3400;
  const f = federal(p, { today: "2026-10-30" });
  near(f.inputs.wages, base - 6800);   // both within the 2026 limit of 3,400: 6,800 off pay, not 3,400
  assert.deepEqual(f.fsa.people.map((x) => [x.id, x.excluded]), [["ana", 3400], ["bo", 3400]]);
  // Bo elects 5,000: only 3,400 of it comes off his pay, and the note names him
  p.taxes.hsa.fsaPartner = 5000;
  const g = federal(p, { today: "2026-10-30" });
  near(g.inputs.wages, base - 6800); assert.ok(g.notes.some((n) => /^Bo's health FSA election is over/.test(n)));
  const d = compute(p, { today: "2026-10-30" });
  assert.equal(d.fsa.election, 8400); assert.equal(d.fsa.excluded, 6800); assert.equal(d.fsa.over, 1600);
  assert.deepEqual(d.fsa.people.map((x) => [x.name, x.over]), [["Ana", 0], ["Bo", 1600]]);
  // the saving: income tax on 6,800 at their 22% bracket, and 7.65% payroll tax on each person's own 3,400
  near(d.fsa.incomeTaxSaved, 6800 * 0.22, 0.5); near(d.fsa.payrollTaxSaved, 6800 * 0.0765, 0.01);
  // each person's payroll-tax wages come down by their own FSA
  assert.equal(d.hsa.people.find((x) => x.id === "bo").fsaOff, 3400);
});

test("Review 2026-11-06 (round 7): the notes say you/your for the unnamed first adult and your spouse for the partner", async () => {
  const people = [{ id: "me", name: "Me", birth: "1986-02-01", pay: 90000, hsa: 2000 }, { id: "sp", name: "My spouse", birth: "1968-02-01", pay: 60000, hsa: 1000 }];
  // the plan covers the spouse: the first adult's 2,000 is not allowed
  const d = compute(planOf({ status: "married_joint", cover: "self", coveredId: "sp", people }), { today: "2026-06-01" });
  assert.ok(d.notes.some((n) => n.startsWith("You are not on the self-only health plan, so the $2,000 going into your HSA is not allowed")), d.notes.join(" | "));
  // the plan covers the first adult: the spouse's 1,000 is not allowed
  const e = compute(planOf({ status: "married_joint", cover: "self", coveredId: "me", people }), { today: "2026-06-01" });
  assert.ok(e.notes.some((n) => n.startsWith("Your spouse is not on the self-only health plan, so the $1,000 going into your spouse's HSA is not allowed")), e.notes.join(" | "));
  // each health FSA over the limit, by name
  const p = planOf({ status: "married_joint", cover: "family", people: people.map((x) => ({ ...x, hsa: 0 })) });
  p.taxes.hsa.fsa = 5000; p.taxes.hsa.fsaPartner = 5000;
  const f = compute(p, { today: "2026-10-30" });
  assert.ok(f.notes.some((n) => n.startsWith("Your FSA election is over the 2026 limit")) && f.notes.some((n) => n.startsWith("Your spouse's FSA election is over the 2026 limit")), f.notes.join(" | "));
  const { compute: federal } = await import("../federal/compute.js");
  const g = federal(p, { today: "2026-10-30" });
  assert.ok(g.notes.some((n) => /^Your health FSA election is over this year's limit of \$3,400: only \$3,400 comes off your pay before tax\./.test(n)), g.notes.join(" | "));
  assert.ok(g.notes.some((n) => /^Your spouse's health FSA election is over this year's limit of \$3,400: only \$3,400 comes off your spouse's pay before tax\./.test(n)));
  assert.ok(![...d.notes, ...e.notes, ...f.notes, ...g.notes].some((n) => /\bMe's\b|\bMe (is|are)\b|My spouse/.test(n)));
});

// ---------------------------------------------------------------- gap #16: receipts to pay yourself back later
// IRS Pub. 969 (for 2025 returns) and Notice 2004-50 A-39 ("there is no time limit on when the distribution must occur"),
// both read 2026-11-13: a bill paid from your own pocket after the HSA was set up can be paid back from it, tax-free, at
// any time, if it was not paid back or deducted elsewhere. Invented figures only.
const withReceipts = (receipts, openedOn) => {
  const p = kai(95000, { kai: { k401: 0 } });
  p.taxes.hsa.receipts = receipts;
  if (openedOn !== undefined) p.taxes.hsa.openedOn = openedOn;
  return p;
};
const R3 = [
  { id: "r1", date: "2025-02-10", amount: 120, what: "Dentist", proof: "Photo in the Receipts album" },
  { id: "r2", date: "2025-06-01", amount: 45.5, what: "Glasses", proof: "" },
  { id: "r3", date: "2026-03-15", amount: 1074.5, what: "Knee scan", proof: "Folder in the desk" },
];

test("gap #16 receipts: what can be paid back is the sum of the bills not paid back yet", () => {
  const d = compute(withReceipts(R3), { today: "2026-11-13" });
  near(d.receipts.canPayBack, 1240, 0);
  assert.equal(d.receipts.waiting, 3);
  assert.equal(d.receipts.openedOn, null);   // blank: the page says "if paid after you opened the HSA"
  near(d.receipts.before.amount, 0, 0);
  // an amount of 0 or less, or a row with no date, is not money waiting
  const e = compute(withReceipts([...R3, { id: "r4", date: "2026-04-01", amount: 0, what: "Nothing" }, { id: "r5", date: "", amount: 50, what: "No date" }]), { today: "2026-11-13" });
  near(e.receipts.canPayBack, 1240, 0); assert.equal(e.receipts.waiting, 3);
});

test("gap #16 receipts: bills from before the HSA was opened are left out (Pub. 969: not qualified medical expenses)", () => {
  const d = compute(withReceipts(R3, "2025-03-01"), { today: "2026-11-13" });
  assert.equal(d.receipts.openedOn, "2025-03-01");
  near(d.receipts.canPayBack, 1120, 0);           // the dentist of February 2025 came before
  assert.equal(d.receipts.before.n, 1); near(d.receipts.before.amount, 120, 0);
  assert.equal(d.receipts.beforePaid.n, 0);
  // a bill from before the HSA marked paid back: what the HSA paid for it is taxed (Pub. 969: "If you don't use a
  // distribution from your HSA for qualified medical expenses, you must pay tax on the distribution"; 20% more before 65)
  const paidEarly = compute(withReceipts(R3.map((r) => (r.id === "r1" ? { ...r, reimbursedOn: "2026-01-02" } : r)), "2025-03-01"), { today: "2026-11-13" });
  assert.equal(paidEarly.receipts.beforePaid.n, 1); near(paidEarly.receipts.beforePaid.amount, 120, 0);
  near(paidEarly.receipts.canPayBack, 1120, 0); assert.equal(paidEarly.receipts.paidBack.n, 0);
  // the day it was opened counts (a bill "after you establish the HSA": the same day is in)
  near(compute(withReceipts(R3, "2025-02-10"), { today: "2026-11-13" }).receipts.canPayBack, 1240, 0);
});

test("gap #16 receipts: bills already paid back are left out", () => {
  const paid = R3.map((r) => (r.id === "r3" ? { ...r, reimbursedOn: "2026-04-02" } : r));
  const d = compute(withReceipts(paid), { today: "2026-11-13" });
  near(d.receipts.canPayBack, 165.5, 0);
  assert.equal(d.receipts.waiting, 2);
  assert.equal(d.receipts.paidBack.n, 1); near(d.receipts.paidBack.amount, 1074.5, 0);
});

test("gap #16 receipts: a day that is not on the calendar (2025-02-30, from an edited plan file) is no day", () => {
  const odd = [...R3, { id: "r6", date: "2025-02-30", amount: 50, what: "Typed by hand" }];
  const d = compute(withReceipts(odd, "2025-02-31"), { today: "2026-11-13" });
  assert.equal(d.receipts.openedOn, null);                 // an opening day not on the calendar is blank, not "before" every bill
  near(d.receipts.canPayBack, 1240, 0); assert.equal(d.receipts.waiting, 3);
  assert.equal(d.receipts.before.n, 0);
  const r6 = d.receipts.list.find((r) => r.id === "r6");
  assert.equal(r6.date, null); assert.equal(r6.counts, false);   // like a blank day: not counted, its row says "on a day not given"
  // a leap day is a day only in a leap year
  const leap = compute(withReceipts([{ id: "a", date: "2024-02-29", amount: 10, what: "A" }, { id: "b", date: "2025-02-29", amount: 20, what: "B" }]), { today: "2026-11-13" });
  near(leap.receipts.canPayBack, 10, 0);
  // a paid-back mark with a day not on the calendar still counts as paid back (never invite paying one bill back twice),
  // with no day shown
  const e = compute(withReceipts(R3.map((r) => (r.id === "r3" ? { ...r, reimbursedOn: "2026-02-30" } : r))), { today: "2026-11-13" });
  near(e.receipts.canPayBack, 165.5, 0);
  const r3 = e.receipts.list.find((r) => r.id === "r3");
  assert.equal(r3.paidBack, true); assert.equal(r3.reimbursedOn, null);
});

test("gap #16 receipts: left invested 20 years at the plan's real return (the page's mix over inflation)", () => {
  const p = withReceipts(R3);
  p.assumptions = { ...p.assumptions, returnStocks: 0.07, returnBonds: 0.04, inflation: 0.03 }; p.retirement.stocksNow = 0.7;
  const d = compute(p, { today: "2026-11-13" });
  // nominal 0.7 x 7% + 0.3 x 4% = 6.1%; real (1.061 / 1.03) - 1 = 3.0097%; 1,240 x 1.030097^20 = 2,244.05
  near(d.receipts.realReturn, 1.061 / 1.03 - 1, 1e-12);
  assert.equal(d.receipts.years, 20);
  near(d.receipts.grows, 1240 * Math.pow(1.061 / 1.03, 20), 1e-6);
  near(d.receipts.grows, 2244.05, 0.5);
  // nothing waiting: nothing grows
  near(compute(withReceipts([]), { today: "2026-11-13" }).receipts.grows, 0, 0);
});

test("gap #16 invariance: with no receipts and no opening date, compute() keeps exactly its old keys; adding them changes nothing else", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const T = "2026-11-13";
  const plans = [["family", familyPlan(T)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan()], ["empty", emptyPlan()], ["tax", taxPlan()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  assert.ok(plans.length >= 19);
  for (const [name, p0] of plans) {
    const p = migrate(structuredClone(p0));
    const before = compute(p, { today: T, iraAsAssumed: false });
    assert.deepEqual(Object.keys(before), ["year", "limitsYear", "fsaYear", "wageBase", "hsa", "fsa", "hasHsa", "hasFsa", "notes", "selfName"], name);
    const q = structuredClone(p); q.taxes.hsa = { ...q.taxes.hsa, openedOn: "2024-01-15", receipts: R3 };
    const { receipts, ...rest } = compute(q, { today: T, iraAsAssumed: false });
    assert.ok(receipts && receipts.canPayBack === 1240, name);
    assert.equal(JSON.stringify(rest), JSON.stringify(before), `${name}: receipts change nothing else`);
  }
});

// ---------------------------------------------------------------- the room left, and what it would save (the headline)
test("what putting the room in would save: the return worked again with the room added (income tax and payroll tax)", async () => {
  const { roomSaving } = await import("./compute.js");
  // Kai, 95,000 of pay, 3,000 in: 1,400 of room, all in the 22% bracket, from pay: 22% + 7.65%
  const p = kai(95000, { kai: { k401: 0, hsa: 3000 } });
  const r = roomSaving(p, { today: "2026-06-01" });
  near(r.room, 1400, 0);
  near(r.saves, 1400 * (0.22 + 0.0765), 0.05);
  // nothing in yet, no pay on file: the whole 4,400 saves the full 7.65% payroll tax and no income tax
  const e = emptyPlan(); e.taxes.hsa = { coverage: "self", contribution: 0, employer: 0, fsa: 0, fsaSpent: 0 };
  near(roomSaving(e, { today: "2026-06-01" }).saves, 4400 * 0.0765, 0.01);
  // full, over, or no high-deductible plan: no room, nothing to save
  assert.deepEqual(roomSaving(kai(95000, { kai: { k401: 0 } }), { today: "2026-06-01" }), { room: 0, saves: 0 });
  assert.deepEqual(roomSaving(kai(95000, { cover: "none", kai: { k401: 0, hsa: 0 } }), { today: "2026-06-01" }), { room: 0, saves: 0 });
  // the plan itself is not changed
  assert.equal(p.taxes.hsa.contribution, 3000);
});

test("what the room would save puts each spouse's part in their own HSA (a catch-up from 55 fits only there, 223(b)(3))", async () => {
  const { roomSaving } = await import("./compute.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const o = { today: "2026-11-13", iraAsAssumed: false };
  // Sam (58) and Lee (56), family cover: 8,000 of Sam's money and 1,000 from the employer against 10,750; of the 1,750 left,
  // 750 fits on Sam and 1,000 is Lee's own catch-up
  const p = migrate(taxPlan()); p.taxes.hsa.contribution = 8000;
  const d = compute(p, o);
  near(d.hsa.room, 1750, 0);
  const r = roomSaving(p, o, d);
  // by hand: Lee's 1,000 as her own Contributions row, the household's own money 9,750 (Sam's part 8,750)
  const q = structuredClone(p); q.taxes.hsa.contribution = 9750;
  q.accounts.push({ id: "hsa-lee", name: "HSA", type: "hsa", balance: 0, ownerId: "lee" });
  q.retirement.contributions.push({ id: "c-hsa-lee", accountId: "hsa-lee", personId: "lee", amount: 1000, period: "annual", employerMatch: 0 });
  const e = compute(q, o);
  near(e.hsa.excess, 0, 0); near(e.hsa.total, 10750, 0);
  near(r.saves, e.hsa.savedTotal - d.hsa.savedTotal, 0.01);
  assert.ok(r.saves > 1750 * 0.22, `${r.saves}: none of the room is wasted as money over a limit`);
});

test("what the room would save is the same whether pay comes from the Income page or typed W-2 wages", async () => {
  const { roomSaving } = await import("./compute.js");
  const { compute: federal } = await import("../federal/compute.js");
  const auto = kai(95000, { kai: { k401: 0, hsa: 3000 } }), typed = kai(95000, { kai: { k401: 0, hsa: 3000 } });
  typed.taxes.thisYear.wages = federal(auto, { today: "2026-06-01" }).inputs.wages - 3000;   // box 1 leaves the HSA money out
  near(roomSaving(typed, { today: "2026-06-01" }).saves, roomSaving(auto, { today: "2026-06-01" }).saves, 0.05);
});

// ---------------------------------------------------------------- the page, drawn with the real kit on the fake DOM
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
// a browser writes "null" for a null handed to append(); the stand-in skips it, so here it fails instead
const appendOf = FakeElement.prototype.append;
FakeElement.prototype.append = function (...ns) {
  if (ns.some((n) => n === null || n === undefined)) throw new Error(`append(${ns.map((n) => (n === null || n === undefined ? String(n) : typeof n)).join(", ")}): a browser would write "${String(ns.find((n) => n == null))}"`);
  return appendOf.apply(this, ns);
};
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const { render, answerFor } = await import("./view.js");
const { roomSaving } = await import("./compute.js");
const { widowPlan } = await import("../../../qa/fixtures/widow-plan.mjs");
const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
const DAY = "2026-11-13";
/** Draw the page as the shell does: store.update keeps the draft and draws again; ctx.redraw draws again. */
function page(plan0, { today = DAY } = {}) {
  let plan = migrate(structuredClone(plan0));
  const s = { saved: [], root: null };
  const ctx = () => ({ ui, fmt: { ...fmt, today: () => today }, plan, route: { group: "taxes", id: "hsa-fsa", rest: [], query: {} },
    store: { get: () => plan, update: (fn) => { const dr = structuredClone(plan); fn(dr); s.saved.push(dr); plan = dr; draw(); } },
    redraw: () => draw() });
  const draw = () => { s.root = new FakeElement("main"); render(s.root, ctx()); };
  draw();
  s.plan = () => plan;
  return s;
}
const everything = (el) => [el, ...el.all()];
const partsOf = (root) => everything(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partOf = (root, id) => partsOf(root).find((e) => e.dataset.part === id) ?? null;
const opened = (d) => d.hasAttribute("open");
const titleOf = (d) => d.querySelector(".fold-title").textContent;
const statusOf = (d) => d.querySelector(".fold-status")?.textContent ?? "";
const rowsOf = (root) => partsOf(root).map((p) => [p.dataset.part, p.dataset.kind, titleOf(p), statusOf(p), opened(p)]);
/** The words a person sees without opening anything: a shut part shows only its summary. */
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !opened(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/​/g, "").replace(/\s+/g, " ").trim();
}
const buttonOf = (root, words) => everything(root).find((e) => e.tagName === "BUTTON" && e.textContent === words) ?? null;
function fill(form, values) {
  for (const [k, v] of Object.entries(values)) form.querySelector(`[name="${k}"]`).value = v;
  form.dispatch("submit");
}
const formWith = (root, name) => everything(root).find((e) => e.tagName === "FORM" && e.querySelector(`[name="${name}"]`)) ?? null;
/** Kai, 95,000 of pay, an HSA account on Net worth, `hsa` going in for 2026. */
const kaiHsa = (hsa = 3000) => { const p = kai(95000, { kai: { k401: 0, hsa } }); if (!p.accounts.some((a) => a.type === "hsa")) p.accounts.push({ id: "hsa-kai", name: "hsa", type: "hsa", balance: 0, ownerId: "kai" }); return p; };
const said = (plan) => { const p = migrate(structuredClone(plan)); const o = { today: DAY, iraAsAssumed: false }; const d = compute(p, o); return answerFor(d, (n) => fmt.money(n, "USD"), { roomSaves: roomSaving(p, o, d).saves, hasAccount: p.accounts.some((a) => a.type === "hsa") }); };

test("simple first (R3 to R5): one written sentence per case, the headline saying what happens to you", () => {
  const widowWith = (hsa) => { const w = widowPlan(); w.accounts.push({ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "p-ruth" }); w.taxes.hsa = { coverage: "self", contribution: hsa, employer: 0, fsa: 0, fsaSpent: 0 }; return w; };
  const ada = () => { const r = emptyPlan(); r.household.filingStatus = "single"; r.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: "1964-05-05" }];
    r.income = [{ id: "pen", name: "Pension", type: "pension", personId: "a", amount: 14000, period: "annual", growth: 0, taxable: true }];
    r.accounts = [{ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "a" }]; r.taxes.hsa = { coverage: "self", contribution: 2000, employer: 0, fsa: 0, fsaSpent: 0 }; return r; };
  const none = (hsa) => { const p = kaiHsa(hsa); p.taxes.hsa.coverage = "none"; return p; };
  const boss = (hsa, employer) => { const p = kaiHsa(hsa); p.taxes.hsa.employer = employer; return p; };
  const cases = [
    [widowWith(4400), "medicare", "Once you're on Medicare you can't add to an HSA", "The $4,400 typed for 2026 is too much and gets no tax break, so it saves nothing. You can still spend what is in the account on medical bills, tax-free."],
    [widowWith(0), "medicare", "Once you're on Medicare you can't add to an HSA", "You can still spend what is in the account on medical bills, tax-free."],
    [none(3000), "noPlanMoney", "HSA money needs a high-deductible health plan", "You said you have no high-deductible health plan, so the $3,000 going into an HSA for 2026 saves no tax. If you do have such a plan, change the coverage under \"This year's figures\"."],
    [none(0), "noPlan", "Without a high-deductible health plan, no money can go into an HSA", "Money already in an HSA can still pay medical bills tax-free. If you pick such a plan, change the coverage under \"This year's figures\"."],
    [kaiHsa(5000), "over", "You are putting $600 more in your HSA than the 2026 limit allows", "What fits within the limit saves you about $1,305 of tax. Take the extra out before the tax filing deadline."],
    [kaiHsa(3000), "room", "You could put $1,400 more in your HSA this year and save about $415 of tax", "What goes in now, $3,000, saves you about $890."],
    // the saving is on your own money (the employer's goes in tax-free either way): the sentence names your own money, not the total
    [boss(2000, 1000), "room", "You could put $1,400 more in your HSA this year and save about $415 of tax", "What you put in now, $2,000, saves you about $593."],
    [boss(0, 1000), "room", "You could put $3,400 more in your HSA this year and save about $1,008 of tax", "Your employer puts in $1,000, tax-free."],
    [ada(), "roomNoSaving", "You have $3,400 of room left in your HSA this year", "At this income it saves no tax now, but it grows untaxed for medical bills."],
    [kaiHsa(4400), "full", "Your HSA is full for 2026 and saves you about $1,305 of tax", "$4,400 goes in, the most allowed this year."],
    [kaiHsa(0), "startHsa", "You could put up to $4,400 in your HSA this year and save about $1,305 of tax", "That needs a high-deductible health plan this year. Type what goes in below."],
    [emptyPlan(), "start", "An HSA can cut your tax three ways", "With a high-deductible health plan you can put up to $4,400 in 2026 into a health savings account: no tax going in, while it grows, or when it pays medical bills. Type what goes in below."],
  ];
  for (const [plan, key, title, lede] of cases) assert.deepEqual(said(plan), { key, title, lede }, key);
  // the room's saving is the return worked again: 1,400 x (22% + 7.65%) = 415.10
  near(roomSaving(migrate(kaiHsa(3000)), { today: DAY, iraAsAssumed: false }).saves, 415.1, 0.05);
});

test("simple first: the first view is the answer, the alarms and one card of parts; every figure moved, none deleted", () => {
  const s = page(kaiHsa(3000));
  const t = seen(s.root);
  assert.match(t, /^You could put \$1,400 more in your HSA this year and save about \$415 of tax What goes in now, \$3,000, saves you about \$890\. 4 more numbers › This year's figures set by you · \$3,000 › Receipts to pay back none yet › How this is worked out › More on this /, t);
  assert.deepEqual(rowsOf(s.root), [
    ["numbers", "more", "4 more numbers", "", false], ["figures", "own", "This year's figures", "set by you · $3,000", false],
    ["receipts", "own", "Receipts to pay back", "none yet", false], ["how", "how", "How this is worked out", "", false]]);
  assert.equal(everything(s.root).filter((e) => e.dataset?.parts !== undefined).length, 1, "the parts are rows of one card");
  assert.ok(!/stat/.test(everything(s.root).filter((e) => !e.closest("details")).map((e) => e.className).join(" ")), "no tile on the first view");
  // moved, not deleted: the tiles, the limit sentence, the growth, the payroll line, why an HSA comes first
  const all = textOf(s.root);
  for (const w of ["2026 limit", "Room left", "Tax saved", "At 65", "against a limit of $4,400", "this year's money alone is worth about", "Money that comes out of your paycheck also skips most payroll tax (7.65%", "Why an HSA comes first", "(for 2026, until April 15, 2027)"]) assert.ok(all.includes(w), w);
  // the empty plan asks first: its form is open under "The figures", no receipts part, at most five boxes, one filled button
  const e = page(emptyPlan());
  assert.deepEqual(rowsOf(e.root), [["figures", "figures", "The figures", "not set yet", true], ["how", "how", "How this is worked out", "", false]]);
  const shown = everything(e.root).filter((x) => ["INPUT", "SELECT"].includes(x.tagName) && !x.closest(".form-more") && x.closest("details")?.hasAttribute("open"));
  assert.deepEqual(shown.map((x) => x.getAttribute("name")), ["coverage", "contribution", "employer"]);
  assert.ok(seen(e.root).split(" ").length < 140, `${seen(e.root).split(" ").length} words on the first view (387 before)`);
});

test("gap #16, test 5: no HSA gives no receipts part; an HSA account, a balance or money going in gives it", () => {
  for (const p of [emptyPlan(), renterDebtPlan(), kai(95000, { kai: { k401: 0, hsa: 0 } })]) assert.equal(partOf(page(p).root, "receipts"), null);
  const bal = emptyPlan(); bal.accounts = [{ id: "h", name: "HSA", type: "hsa", balance: 2500, ownerId: "" }];
  assert.ok(partOf(page(bal).root, "receipts"));
  assert.ok(partOf(page(kai(95000, { kai: { k401: 0, hsa: 1000 } })).root, "receipts"));
  // on Medicare with an HSA: the receipts are there (paying old bills is what is left to do), the form keeps its pinned title
  const w = widowPlan(); w.accounts.push({ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "p-ruth" });
  assert.deepEqual(rowsOf(page(w).root).map((r) => r.slice(0, 3)), [["numbers", "more", "4 more numbers"], ["figures", "own", "Change what you typed"], ["receipts", "own", "Receipts to pay back"]]);
});

test("the Tax saved tile with a balance and nothing going in says so, not that there is no income tax to save at this income", () => {
  const p = kaiHsa(0); p.accounts.find((a) => a.type === "hsa").balance = 2500;
  const all = textOf(page(p).root);
  assert.match(all, /\$0 Tax saved nothing going in this year/);
  assert.ok(!/no income tax to save at this income/.test(all), all.slice(0, 900));
});

test("gap #16 receipts: add one, the status names what can be paid back, mark it paid back, bills before the HSA are left out with words", () => {
  const s = page(kaiHsa(3000));
  let r = partOf(s.root, "receipts");
  // an empty list keeps its add form open at four boxes, "Paid back on" under More details (optional)
  const f = formWith(r, "amount");
  assert.deepEqual(f.all().filter((x) => x.tagName === "INPUT" && !x.closest(".form-more")).map((x) => x.getAttribute("name")), ["date", "amount", "what", "proof"]);
  assert.ok(f.querySelector('[name="reimbursedOn"]').closest(".form-more"));
  // a receipt needs its day, its amount and what it was for: without one nothing is saved
  fill(f, { date: "2025-02-10", amount: "", what: "Dentist", proof: "" });
  fill(f, { date: "", amount: "120", what: "Dentist", proof: "" });
  fill(f, { date: "2025-02-10", amount: "120", what: "  ", proof: "" });
  assert.equal(s.saved.length, 0);
  fill(f, { date: "2025-02-10", amount: "120", what: "Dentist", proof: "Photo in the Receipts album" });
  const row = s.plan().taxes.hsa.receipts[0];
  assert.deepEqual({ ...row, id: undefined }, { id: undefined, date: "2025-02-10", amount: 120, what: "Dentist", proof: "Photo in the Receipts album" });
  r = partOf(s.root, "receipts");
  assert.ok(opened(r), "the saved part stays open");
  assert.equal(statusOf(r), "$120");
  assert.match(textOf(r), /^Receipts to pay back \$120 › Receipt added: Dentist, \$120\. You can pay yourself back \$120 in all\./);
  assert.match(textOf(r), /You can pay yourself back \$120 tax-free, if paid after you opened the HSA\./);
  assert.match(textOf(r), /Left invested 20 years at your plan's return, \$120 grows to about \$217 in today's dollars, and you can still pay yourself back the \$120 tax-free whenever you like\./);
  assert.ok(buttonOf(r, "+ Add another receipt"), "a list with rows folds its add form");
  assert.equal(formWith(r, "amount"), null);
  // a second one, with cents
  buttonOf(r, "+ Add another receipt").click();
  fill(formWith(partOf(s.root, "receipts"), "amount"), { date: "2026-03-15", amount: "45.50", what: "Glasses", proof: "" });
  r = partOf(s.root, "receipts");
  assert.equal(statusOf(r), "$165.50");
  // paid back: one tap, the status falls, the row says when
  buttonOf(r, "Mark paid back").click();
  assert.equal(s.plan().taxes.hsa.receipts.find((x) => x.what === "Glasses").reimbursedOn, DAY);
  r = partOf(s.root, "receipts");
  assert.equal(statusOf(r), "$120");
  assert.match(textOf(r), /Marked paid back today: Glasses, \$45\.50\. Paid back on another day\? Tap Change to set it\. You can pay yourself back \$120 in all\./);
  assert.match(textOf(r), /Paid back (11\/13\/2026|Nov 13, 2026|November 13, 2026)/);
  // the day the HSA was opened: the dentist bill came before it
  fill(formWith(r, "openedOn"), { openedOn: "2025-03-01" });
  assert.equal(s.plan().taxes.hsa.openedOn, "2025-03-01");
  r = partOf(s.root, "receipts");
  assert.equal(statusOf(r), "all paid back");
  assert.match(textOf(r), /the HSA was opened (3\/1\/2025|[A-Z][a-z]+ 1, 2025)\. Nothing is waiting to be paid back\./);
  assert.match(textOf(r), /1 receipt \(\$120\) is from before you opened the HSA on (3\/1\/2025|[A-Z][a-z]+ 1, 2025), so the HSA cannot pay it back tax-free\./);
  assert.ok(!/if paid after you opened the HSA/.test(textOf(r)));
  assert.ok(/Before the HSA/.test(textOf(r)));
  // nothing else in the plan moved
  assert.equal(s.plan().taxes.hsa.contribution, 3000);
});

test("gap #16: a bill from before the HSA marked paid back is an alarm on the first view, and its part opens saying 1 to fix", () => {
  const p = kaiHsa(3000);
  p.taxes.hsa.openedOn = "2025-03-01";
  p.taxes.hsa.receipts = [{ id: "r1", date: "2025-02-10", amount: 120, what: "Dentist", proof: "", reimbursedOn: "2026-01-02" }, { id: "r2", date: "2025-06-01", amount: 45.5, what: "Glasses", proof: "" }];
  const s = page(p);
  const t = seen(s.root);
  assert.match(t, /1 receipt \(\$120\) from before you opened the HSA on (3\/1\/2025|[A-Z][a-z]+ 1, 2025) is marked paid back\. Money the HSA paid out for it is taxed as income, plus an extra 20% unless you were 65 or older or disabled\. If a date is wrong, fix it under "Receipts to pay back"\./, t);
  const r = partOf(s.root, "receipts");
  assert.ok(opened(r)); assert.equal(statusOf(r), "1 to fix · $45.50");
  assert.ok(/Paid back, but from before the HSA/.test(textOf(r)));
  // the other one still waits
  assert.match(textOf(r), /You can pay yourself back \$45\.50 tax-free\./);
});

test("gap #16: the opening day's box says an HSA filled from an older one counts from the older one's day (Pub. 969)", () => {
  const r = partOf(page(kaiHsa(3000)).root, "receipts");
  const box = formWith(r, "openedOn").querySelector('[name="openedOn"]');
  const help = box.closest(".field").querySelector(".help")?.textContent ?? "";
  assert.equal(help, "only bills paid on or after this day can be paid back tax-free. Moved money in from an older HSA? Then use the day the older one was opened.");
});

test("gap #16: Mark paid back says it used today and how to set another day; Change shows that day without opening anything", () => {
  const p = kaiHsa(3000);
  p.taxes.hsa.receipts = [{ id: "r1", date: "2026-03-15", amount: 45.5, what: "Glasses", proof: "" }];
  const s = page(p);
  buttonOf(partOf(s.root, "receipts"), "Mark paid back").click();
  let r = partOf(s.root, "receipts");
  assert.match(textOf(r), /Marked paid back today: Glasses, \$45\.50\. Paid back on another day\? Tap Change to set it\. Nothing is waiting to be paid back\./);
  buttonOf(r, "Change").click();
  r = partOf(s.root, "receipts");
  const box = formWith(r, "reimbursedOn").querySelector('[name="reimbursedOn"]');
  assert.equal(box.value, DAY);
  assert.ok(box.closest(".form-more").hasAttribute("open"), "the paid-back day is on screen, its fold open by itself");
  fill(formWith(r, "reimbursedOn"), { reimbursedOn: "2026-10-02" });
  assert.equal(s.plan().taxes.hsa.receipts[0].reimbursedOn, "2026-10-02");
  assert.match(textOf(partOf(s.root, "receipts")), /Paid back (10\/2\/2026|Oct 2, 2026|October 2, 2026)/);
});

test("S11 (R17): after a save only the saved part changes; the green line names the new answer (R7)", () => {
  const s = page(kaiHsa(3000));
  const before = rowsOf(s.root).map(([id, , , , open]) => [id, open]);
  assert.deepEqual(before, [["numbers", false], ["figures", false], ["receipts", false], ["how", false]]);
  // save inside "This year's figures": it stays open, nothing else opens or shuts
  fill(formWith(partOf(s.root, "figures"), "contribution"), { contribution: "4400" });
  assert.deepEqual(rowsOf(s.root).map(([id, , , , open]) => [id, open]), [["numbers", false], ["figures", true], ["receipts", false], ["how", false]]);
  assert.match(seen(s.root), /^Your HSA is full for 2026 and saves you about \$1,305 of tax \$4,400 goes in, the most allowed this year\. Saved\. Your HSA is full for 2026 and saves you about \$1,305 of tax\. /);
  // the next draw is quiet again (the confirmation is said once)
  s.root = null; const t = page(s.plan());
  assert.ok(!/Saved\./.test(seen(t.root)));
  // a save inside the receipts part keeps it open and leaves This year's figures shut
  fill(formWith(partOf(t.root, "receipts"), "amount"), { date: "2026-01-05", amount: "80", what: "Prescription", proof: "" });
  assert.deepEqual(rowsOf(t.root).map(([id, , , , open]) => [id, open]), [["numbers", false], ["figures", false], ["receipts", true], ["how", false]]);
  // the same headline after a save: just "Saved."
  const u = page(kaiHsa(3000));
  fill(formWith(partOf(u.root, "figures"), "contribution"), { contribution: "3000" });
  assert.match(seen(u.root), /\. Saved\. 4 more numbers/);
});

test("the view draws its parts with the helper: no hand-written <details>", () => {
  const src = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(!/h\(\s*"details"/.test(src), "parts come from core/ui/more.js");
  assert.ok(src.includes("Money for a tax year can go in until that year's April tax deadline (for ${d.year}, until ${filingDeadline(d.year)})"));
});
