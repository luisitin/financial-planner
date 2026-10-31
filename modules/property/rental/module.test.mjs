import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, analyse, depreciation, lossAllowance, passiveLosses, RECOVERY_YEARS, DEFAULTS } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const ELM = { id: "r1", kind: "rental", name: "Duplex on Elm", value: 320000, purchasePrice: 280000, purchaseDate: "2021-06-15", rentMonthly: 2600, propertyTax: 4200, insurance: 1500, cashIn: 70000, loanBalance: 190000, loanRate: 0.045, loanPayment: 1150 };

test("depreciation: 27.5 years straight-line, mid-month in the first year, and it stops at the basis", () => {
  near(depreciation(275000, "2026-01-10", 2026), 10000 * 11.5 / 12);
  near(depreciation(275000, "2026-12-01", 2026), 10000 * 0.5 / 12);
  near(depreciation(275000, "2021-06-15", 2026), 10000);
  assert.equal(depreciation(275000, "2027-01-01", 2026), 0);
  let total = 0; for (let y = 2000; y <= 2030; y++) total += depreciation(275000, "2000-03-01", y);
  near(total, 275000, 0.01);
  assert.equal(depreciation(275000, "2000-03-01", 2029), 0, "nothing after the 28th year");
});

test("the loss allowance: $25,000, half of every dollar over $100,000 off, gone at $150,000; halved for separate returns", () => {
  assert.equal(lossAllowance(90000), 25000); assert.equal(lossAllowance(120000), 15000); assert.equal(lossAllowance(150000), 0);
  assert.equal(lossAllowance(40000, { separate: true }), 12500); assert.equal(lossAllowance(75000, { separate: true }), 0);
});

test("no rentals: not ready", () => {
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).ready, false);
});

test("the duplex, line by line by hand", () => {
  const p = familyPlan(TODAY); p.property = [ELM];
  const d = compute(p, { today: TODAY });
  const r = d.rentals[0];
  near(r.rent, 31200); near(r.vacancy, 31200 * DEFAULTS.vacancy); near(r.income, 31200 * 0.95);
  near(r.opex, 4200 + 1500 + 320000 * DEFAULTS.maintenance);
  near(r.noi, r.income - r.opex); near(r.capRate, r.noi / 320000);
  const pay = yearOfPayments(190000, 0.045, 1150);
  near(r.debtService, pay.paid); near(r.interest, pay.interest); near(r.principal, pay.principal);
  near(r.cashFlow, r.noi - pay.paid); near(r.cashOnCash, r.cashFlow / 70000);
  near(r.dscr, r.noi / pay.paid); near(r.breakEven, (r.opex + pay.paid) / 31200);
  near(r.basis, 280000 * 0.8); near(r.depreciation, 224000 / RECOVERY_YEARS);
  near(r.taxable, r.income - r.opex - pay.interest - r.depreciation);
  near(r.tax, d.tax.total); near(r.afterTax, r.cashFlow - r.tax);   // one rental: the whole change in the year's tax
  near(r.equity, 130000); near(r.totalReturn, r.cashFlow + pay.principal + 320000 * DEFAULTS.appreciation);
});

test("a loss: usable up to the allowance, the rest carried; several rentals share one allowance", () => {
  const rates = { marginal: 0.22, state: 0, allowance: 5000, year: 2026 };
  const r = analyse({ ...ELM, rentMonthly: 1500 }, { balance: 190000, rate: 0.045, payment: 1150 }, rates);
  assert.ok(r.taxable < -5000);
  near(r.lossUsable, 5000); near(r.lossCarried, -r.taxable - 5000); near(r.tax, -5000 * 0.22);
  const p = familyPlan(TODAY);
  p.income = p.income.filter((x) => x.personId !== "p-bo");   // lower income: some allowance left
  p.property = [{ ...ELM, rentMonthly: 1500 }, { ...ELM, id: "r2", name: "Second", rentMonthly: 1500 }];
  const d = compute(p, { today: TODAY });
  assert.ok(d.lossRoom > 0);
  near(d.rentals[0].lossUsable + d.rentals[1].lossUsable, Math.min(d.lossRoom, -d.rentals[0].taxable - d.rentals[1].taxable));
});

test("a mortgage account and a property account stand in for the typed loan and value", () => {
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "a-rp", name: "Elm duplex", type: "property", balance: 330000, history: [] }, { id: "a-rm", name: "Elm mortgage", type: "mortgage", balance: -180000, history: [] });
  p.debts.push({ id: "d-rm", accountId: "a-rm", rate: 0.05, minPayment: 1200, extra: 0 });
  p.property = [{ ...ELM, accountId: "a-rp", loanAccountId: "a-rm" }];
  const r = compute(p, { today: TODAY }).rentals[0];
  assert.equal(r.value, 330000); assert.equal(r.loan.name, "Elm mortgage");
  near(r.debtService, yearOfPayments(180000, 0.05, 1200).paid);
});

test("no loan: the cash flow is the income after costs, nothing to cover", () => {
  const r = analyse({ ...ELM, loanBalance: 0 }, null, { marginal: 0.22, state: 0, allowance: 0, year: 2026 });
  near(r.cashFlow, r.noi); assert.equal(r.dscr, null); near(r.equity, 320000);
});

// one adult filing `status`, typed wages, no state (the answer key's household, tests/golden/property/RULES.md section 9)
function keyHousehold(status, year, wages, rentals, more = {}) {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult 1", role: "self", birthDate: "1980-01-01" }];
  p.household.filingStatus = status; p.household.state = "";
  p.taxes.year = year; p.taxes.thisYear.wages = wages;
  Object.assign(p.taxes, more);
  p.property = rentals.map((r, i) => ({ id: `r${i}`, kind: "rental", name: `Rental ${i + 1}`, ...r }));
  return p;
}
// Jun's two rentals (RULES.md 9.2): A +8,000 taxable, B -30,000
const JUN_A = { purchasePrice: 275000, purchaseDate: "2015-01-01", value: 300000, rentMonthly: 2000, propertyTax: 2800, insurance: 1000 };
const JUN_B = { purchasePrice: 400000, improvements: 10000, purchaseDate: "2012-06-01", value: 755000, rentMonthly: 2500, propertyTax: 9000, insurance: 2500, hoaMonthly: 300, management: 0.10, utilitiesMonthly: 200, otherMonthly: 50, loanBalance: 300000, loanRate: 0.06, loanPayment: 1500, cashIn: 80000 };

test("passive losses: profits absorb losses first, the allowance takes the net loss, the rest is spread by the size of each loss (IRC 469(d)(1), (i), (j)(4))", () => {
  const p = passiveLosses([8000, -30000], 25000);
  assert.deepEqual([p.netLoss, p.againstOther, p.allowed, p.suspended, p.net], [22000, 22000, 30000, 0, -22000]);
  const q = passiveLosses([8000, -30000], 10000);
  assert.deepEqual([q.againstOther, q.allowed, q.suspended, q.net], [10000, 18000, 12000, -10000]);
  // three losing rentals and 10,000 to share: 20/45, 15/45 and 10/45 of it (Form 8582 Part VI)
  const r = passiveLosses([-20000, -15000, -10000], 10000);
  near(r.shares[0].allowed, 4444.44); near(r.shares[1].allowed, 3333.33); near(r.shares[2].allowed, 2222.22);
  near(r.shares[0].suspended, 15555.56);
});

test("Jun's two rentals: at 90,000 all of B's loss counts and the tax falls 4,840; at 130,000 12,000 waits and it falls 2,364 (RULES.md 9.2)", () => {
  const a = compute(keyHousehold("single", 2026, 90000, [JUN_A, JUN_B]), { today: "2026-11-16" });
  near(a.rentals[0].taxable, 8000); near(a.rentals[1].taxable, -30000);
  near(a.rentals[1].lossUsable, 30000); near(a.rentals[1].lossCarried, 0);
  near(a.tax.total, -4840); near(a.rentals[0].tax + a.rentals[1].tax, -4840);
  const b = compute(keyHousehold("single", 2026, 130000, [JUN_A, JUN_B]), { today: "2026-11-16" });
  assert.equal(b.lossRoom, 10000);
  near(b.rentals[1].lossUsable, 18000); near(b.rentals[1].lossCarried, 12000);
  near(b.tax.total, -2364);   // 8,200 at 24% + 1,800 at 22%: it crosses the 105,700 line
});

test("filing separately while living together: no allowance, the whole loss waits; living apart all year, 7,500 counts (469(i)(5); RULES.md 9.3)", () => {
  const kit = { purchasePrice: 275000, purchaseDate: "2016-09-01", value: 350000, rentMonthly: 1500, propertyTax: 1500, insurance: 900, utilitiesMonthly: 100, loanBalance: 240000, loanRate: 0.05, loanPayment: 1000 };
  const together = compute(keyHousehold("married_separate", 2025, 60000, [kit]), { today: "2025-12-01" });
  near(together.rentals[0].taxable, -10000);
  assert.equal(together.separateTogether, true); assert.equal(together.lossRoom, 0);
  near(together.rentals[0].lossUsable, 0); near(together.rentals[0].lossCarried, 10000); near(together.tax.total, 0);
  const apart = compute(keyHousehold("married_separate", 2025, 60000, [kit], { livedApart: true }), { today: "2025-12-01" });
  near(apart.lossRoom, 7500); near(apart.rentals[0].lossCarried, 2500); near(apart.tax.total, -900);
});

test("rent is investment income: the 3.8% on it once income passes the line (IRC 1411(c)(1)(A)(i); RULES.md 9.4)", () => {
  const ivo = { purchasePrice: 400000, purchaseDate: "2019-03-01", improvements: 10000, value: 520000, rentMonthly: 3400, propertyTax: 6200, insurance: 1800, management: 0.08, utilitiesMonthly: 150, cashIn: 410000 };
  const d = compute(keyHousehold("married_joint", 2026, 300000, [ivo]), { today: "2026-11-16" });
  near(d.rentals[0].taxable, 8659.20);
  near(d.tax.niit, 329.05); near(d.tax.total, 2407.26);   // 2,078.21 at 24% + 3.8% x 8,659.20
  // single at 85,000: 22% on all of it, no 3.8% (RULES.md 9.1)
  const lo = compute(keyHousehold("single", 2026, 85000, [ivo]), { today: "2026-11-16" });
  near(lo.tax.total, 1905.02); near(lo.tax.niit, 0);
});

test("modified AGI for the allowance leaves out the IRA deduction (469(i)(3)(E))", () => {
  const p = keyHousehold("single", 2026, 110000, [JUN_B]);
  p.accounts = [{ id: "ira", name: "IRA", type: "ira", balance: 0 }];
  p.retirement = { contributions: [{ id: "c1", accountId: "ira", amount: 7000, period: "annual" }] };
  const d = compute(p, { today: "2026-11-16" });
  near(d.rates.magi, 110000); near(d.lossRoom, 20000);   // AGI is 103,000; the allowance is worked on 110,000
});

test("filing separately and living apart: the allowance is worked on the return the rentals are on, not both incomes (469(i)(5)(A))", () => {
  // two adults, typed wages 90,000 (45,000 on each return); Kit's -10,000 rental on Adult 1's return: 12,500 of room at 45,000
  const kit = { purchasePrice: 275000, purchaseDate: "2016-09-01", value: 350000, rentMonthly: 1500, propertyTax: 1500, insurance: 900, utilitiesMonthly: 100, loanBalance: 240000, loanRate: 0.05, loanPayment: 1000 };
  const p = keyHousehold("married_separate", 2025, 90000, [kit], { livedApart: true });
  p.household.people.push({ id: "a2", name: "Adult 2", role: "spouse", birthDate: "1980-01-01" });
  const d = compute(p, { today: "2025-12-01" });
  near(d.rates.magi, 45000); near(d.lossRoom, 12500); near(d.rentals[0].lossUsable, 10000);
  near(d.tax.total, -1200);   // 10,000 off 29,250 of taxable income, all in the 12% band (2025 separate)
  assert.deepEqual(d.rule, { max: 12500, from: 50000, to: 75000 });
});

test("each rental's tax stays steady when profits and losses nearly cancel: the profit's side alone, the rest on the losses", () => {
  // single at 160,000: +8,000 is 1,920 at 24% on its own; a -8,000 rental cancels it (net 0); at -7,999 the net is +1
  const plus = { value: 200000, rentMonthly: 1000, propertyTax: 4000, vacancy: 0, maintenance: 0 };
  const minus = (tax) => ({ value: 200000, rentMonthly: 1000, propertyTax: tax, vacancy: 0, maintenance: 0 });
  const even = compute(keyHousehold("single", 2026, 160000, [plus, minus(20000)]), { today: "2026-11-16" });
  near(even.rentals[0].taxable, 8000); near(even.rentals[1].taxable, -8000);
  near(even.tax.total, 0); near(even.rentals[0].tax, 1920); near(even.rentals[1].tax, -1920);
  const one = compute(keyHousehold("single", 2026, 160000, [plus, minus(19999)]), { today: "2026-11-16" });
  near(one.tax.total, 0.24); near(one.rentals[0].tax, 1920); near(one.rentals[1].tax, 0.24 - 1920);
  near(one.rentals[0].tax + one.rentals[1].tax, one.tax.total);
});

test("the 3.8% line comes from the engine: $250,000 for a qualifying surviving spouse (IRC 1411(b)(1))", () => {
  const p = keyHousehold("qualifying_surviving", 2026, 300000, [JUN_A]);
  p.household.people.push({ id: "k", name: "Child", role: "dependent", birthDate: "2015-01-01" });
  assert.equal(compute(p, { today: "2026-11-16" }).rates.niitLine, 250000);
  assert.deepEqual(compute(keyHousehold("single", 2026, 90000, [JUN_A]), { today: "2026-11-16" }).rule, { max: 25000, from: 100000, to: 150000 });
});
