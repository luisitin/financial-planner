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

// ---- round 8, Batch 1 (landlord-1): the Income page's rent is not in the allowance's income
test("round 8 item 5: the loss allowance is worked on income without the Income page's gross rent (MAGI 154,400, not 179,600)", async () => {
  const { landlordPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const d = compute(landlordPlan(), { today: "2026-11-06" });
  // wages 167,000 less 12,600 to the 401(k)s; the 25,200 of rent on Income left out
  assert.equal(d.rates.magi, 154400); assert.equal(d.incomeRent, 25200); assert.equal(d.lossRoom, 0);
  assert.ok(Math.abs(d.passive.suspended - 1546.79) < 0.01); assert.equal(d.tax.federal, 0);
  // the same household with the rent only on Rental analysis computes the same
  const q = landlordPlan(); q.income = q.income.filter((x) => x.type !== "rental");
  const e = compute(q, { today: "2026-11-06" });
  assert.equal(e.rates.magi, 154400); assert.equal("incomeRent" in e, false);
});

test("round 8 review 1: Rental analysis takes the allowance, its modified AGI and the netting from the Federal estimate's figures", async () => {
  const { landlordBusinessPlan, landlordPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const { known, knownWithout } = await import("../../taxes/federal/known.js");
  const T = "2026-11-06";
  // the business at its profit (140,000), the half of its self-employment tax left in modified AGI: 5,000 of the loss counts,
  // on both pages (it read MAGI 170,000 and 0 here, 130,109 and 9,945 on the Federal estimate)
  const p = landlordBusinessPlan(), d = compute(p, { today: T }), k = known(p, { today: T });
  assert.ok(Math.abs(d.rates.magi - 140000) < 0.01, String(d.rates.magi)); assert.ok(Math.abs(d.lossRoom - 5000) < 0.01);
  assert.ok(Math.abs(d.passive.net - k.rental.net) < 1e-9); assert.equal(d.incomeRent, 14400);
  // what the rentals add is the Federal estimate's year's tax with them less without their result
  const w = knownWithout(p, { today: T }, null, "rental");
  assert.ok(Math.abs(d.tax.federal - (k.total - w.total)) < 1e-6, `${d.tax.federal} vs ${k.total - w.total}`);
  // 5,000 less income at 22%, less the 1,000 it takes off the 20% business deduction (held to 20% of taxable income): 880
  assert.ok(Math.abs(d.tax.federal - -0.22 * 4000) < 1, String(d.tax.federal));
  // the tester's landlord is unchanged: MAGI 154,400 and the 1,547 loss waits
  const l = compute(landlordPlan(), { today: T });
  assert.equal(l.rates.magi, 154400); assert.equal(l.lossRoom, 0);
});

// ---- round 8 batch 6: a rental is entered once and counted once (landlord-2) -------------------------------------------
const T6 = "2026-11-06";
const rentalMod = () => import("./compute.js");
const runningMod = () => import("./running.js");
let seq = 0;
const uid = () => `new-${++seq}`;

test("batch 6: the condo's rent after its running costs is 11,240 a year ($937 a month), Rental analysis's own line", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const R = await runningMod();
  const p = condoOnNetWorthPlan(), r = p.property[0];
  // 2,100 x 12 = 25,200; empty months 5%: 1,260; tax 4,700 + insurance 1,200 + dues 350 x 12 + upkeep 1% of 260,000
  const run = R.runningOf(r, 260000);
  near(run.rent, 25200); near(run.vacancy, 1260); near(run.opex, 4700 + 1200 + 4200 + 2600); near(run.noi, 11240);
  near(run.noi / 12, 936.67, 0.005);
  // the same figure as Rental analysis's "Income after running costs"
  const d = compute(p, { today: T6 });
  near(d.rentals[0].noi, run.noi, 1e-9);
});

test("batch 6: a mortgage picked with no rate or payment on Debts keeps the loan typed for it (it was dropped)", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const p = condoOnNetWorthPlan();
  p.debts = p.debts.filter((x) => x.accountId !== "condo-loan");   // "Condo mortgage" on Net worth, nothing on Debts
  const d = compute(p, { today: T6 });
  const pay = yearOfPayments(150000, 0.045, 851);
  near(d.rentals[0].debtService, pay.paid); near(d.rentals[0].interest, pay.interest);
  assert.equal(d.rentals[0].loanInDebts, false);
});

test("batch 6: keepLoanDetails puts the typed rate and payment on Debts for a picked mortgage that has none, and leaves one that has", async () => {
  const R = await rentalMod();
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const p = condoOnNetWorthPlan();
  p.debts = p.debts.filter((x) => x.accountId !== "condo-loan");
  assert.equal(R.keepLoanDetails(p, p.property[0], uid), true);
  const row = p.debts.find((x) => x.accountId === "condo-loan");
  assert.equal(row.rate, 0.045); assert.equal(row.minPayment, 851);
  assert.equal(R.keepLoanDetails(p, { ...p.property[0], loanPayment: 999 }, uid), false, "a row with a payment is kept");
  assert.equal(p.debts.find((x) => x.accountId === "condo-loan").minPayment, 851);
  assert.equal(R.keepLoanDetails(p, { ...p.property[0], loanAccountId: "gone" }, uid), false, "an account no longer there writes nothing");
});

test("batch 6: Add it to net worth puts the condo on Net worth once, with its loan on Debts (net worth 618,000)", async () => {
  const R = await rentalMod();
  const { condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const { compute: netWorth } = await import("../../balance/net-worth/compute.js");
  const { compute: debts } = await import("../../balance/liabilities/compute.js");
  const { compute: assets } = await import("../../balance/assets/compute.js");
  const p = condoOnlyRentalPlan();
  assert.equal(netWorth(p, { today: T6 }).netWorth, 508000, "before: the condo is left out");
  const before = compute(p, { today: T6 }).rentals[0];
  assert.equal(before.onNetWorth, false); assert.equal(before.accountId, null);
  const res = R.addToNetWorth(p, "r-condo", { today: T6, uid });
  assert.deepEqual(res.made, ["value", "loan"]);
  const acct = p.accounts.find((a) => a.id === res.accountId), loan = p.accounts.find((a) => a.id === res.loanAccountId);
  assert.deepEqual([acct.name, acct.type, acct.balance, acct.asOf], ["Condo", "property", 260000, T6]);
  assert.deepEqual([loan.name, loan.type, loan.balance], ["Condo mortgage", "mortgage", 150000]);
  // 8,000 + 25,000 + 180,000 + 120,000 + 410,000 + 15,000 + 260,000 - 250,000 - 150,000
  assert.equal(netWorth(p, { today: T6 }).netWorth, 618000);
  // Debts: no "needs details" (every loan has its rate and payment)
  const li = debts(p, { today: T6 });
  assert.equal(li.rows.filter((x) => !x.detail).length, 0);
  const row = li.rows.find((x) => x.id === res.loanAccountId);
  assert.equal(row.rate, 0.045); assert.equal(row.payment, 851);
  // What you own lists the condo once, insured by the condo's policy
  const a = assets(p, { today: T6 });
  assert.deepEqual(a.homes.map((h) => [h.name, h.value, h.policy?.name]), [["Home", 410000, "Home policy"], ["Condo", 260000, "Condo landlord policy"]]);
  // Rental analysis reads the same figures, now from Net worth
  const after = compute(p, { today: T6 }).rentals[0];
  assert.equal(after.onNetWorth, true); assert.equal(after.value, 260000);
  near(after.debtService, before.debtService); near(after.noi, before.noi);
  // a second tap adds nothing
  assert.deepEqual(R.addToNetWorth(p, "r-condo", { today: T6, uid }).made, []);
  assert.equal(p.accounts.length, 9);
});

test("batch 6: a rental not linked but listed on Net worth under its name is asked about (twin), never linked by itself", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const p = condoOnNetWorthPlan();
  const r = compute(p, { today: T6 }).rentals[0];
  assert.deepEqual(r.twin, { id: "condo", name: "Condo", value: 260000 });
  assert.equal(r.accountId, null); assert.equal(r.onNetWorth, false);
  // linked ("Yes, it's this one"): counted once, no twin
  p.property[0].accountId = "condo";
  const s = compute(p, { today: T6 }).rentals[0];
  assert.equal(s.twin, null); assert.equal(s.onNetWorth, true);
  // another name, or an account another entry names: no twin
  const q = condoOnNetWorthPlan(); q.property[0].name = "Duplex";
  assert.equal(compute(q, { today: T6 }).rentals[0].twin, null);
});

test("batch 6: matchRent is the Federal estimate's rule: by name, then by amount within 2%, then the rest in proportion", async () => {
  const R = await runningMod();
  // by name, at most what the rental collects
  let m = R.matchRent([{ name: "Rent from the condo", yearly: 30000 }, { name: "Garage", yearly: 1200 }], [{ name: "Condo", rent: 25200 }]);
  assert.deepEqual(m.removed, [25200, 0]); assert.deepEqual(m.left, [4800, 1200]);
  // by amount
  m = R.matchRent([{ name: "Rent coming in", yearly: 25200 }, { name: "Garage", yearly: 1200 }], [{ name: "Condo", rent: 25000 }]);
  assert.deepEqual(m.removed, [25000, 0]);
  // in proportion, shared among the rentals by what each still collects
  m = R.matchRent([{ name: "Rent", yearly: 10000 }, { name: "More rent", yearly: 30000 }], [{ name: "A", rent: 12000 }, { name: "B", rent: 8000 }]);
  near(m.removed[0], 5000); near(m.removed[1], 15000); near(m.takes[1][0], 9000); near(m.takes[1][1], 6000);
  // the Federal estimate takes the same rent out (known.js withoutIncomeRent reads matchRent)
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const { withoutIncomeRent } = await import("../../taxes/federal/known.js");
  const { compute: federal } = await import("../../taxes/federal/compute.js");
  const p = condoOnNetWorthPlan();
  assert.equal(withoutIncomeRent(p, federal(p, { today: T6 }), { today: T6 }).removed, 25200);
});

// ---- round 8 batch 6 review (UX 1 to 3): never the home you live in; a home named otherwise on Net worth is asked about --------
test("batch 6 review: 'Its value on Net worth' and the question leave out the home you live in; an account named otherwise is offered first when its value is close", async () => {
  const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const R = await import("./compute.js");
  const T = "2026-11-06";
  // Get started's home account, one named "Home", one a Your home entry names
  const p = condoOnlyRentalPlan();
  assert.deepEqual([...R.livedIn(p)], ["setup-have-home"]);
  assert.deepEqual(R.candidateAccounts(p, p.property[0]), [], "was: Home ($410,000), which made the home you live in the rental");
  p.property.push({ id: "h", kind: "home", name: "Our house", accountId: "acc-house" }); p.accounts.push({ id: "acc-house", name: "Our house", type: "property", balance: 500000 });
  assert.ok(R.livedIn(p).has("acc-house"));
  // the review's renamed account: Net worth's "Rental condo on Elm" at 260,000, not linked; a cabin at 90,000
  const q = condoOnNetWorthPlan(); q.accounts.find((a) => a.id === "condo").name = "Rental condo on Elm";
  q.accounts.push({ id: "cabin", name: "Cabin", type: "property", balance: 90000 });
  assert.deepEqual(R.candidateAccounts(q, q.property[0]).map((a) => [a.name, a.likely]), [["Rental condo on Elm", true], ["Cabin", false]]);
  const d = R.compute(q, { today: T }).rentals[0];
  assert.equal(d.twin, null); assert.deepEqual(d.candidates.map((a) => a.id), ["condo", "cabin"]);
  // what "Add it to net worth" would add: its value less its loan typed here (260,000 - 150,000), against today's 508,000
  const v = R.compute(condoOnlyRentalPlan(), { today: T });
  assert.equal(v.rentals[0].wouldAdd, 110000); assert.equal(v.netWorth, 508000);
  // the tester's plan: its loan is on Net worth already, so only the value would be added
  assert.equal(R.compute(condoOnNetWorthPlan(), { today: T }).rentals[0].wouldAdd, 260000);
});

// round 8 batch 6 review (UX 9, item 26's next step): the depreciation taken so far, the part of a sale's gain taxed at up to 25%
test("batch 6 review: depreciation taken so far: 168,000 / 27.5 a year from August 2019, mid-month, to November 2026 is about 44,291", async () => {
  const R = await import("./compute.js");
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  // 2019: 4.5 months (2,290.91); 2020 to 2025: 6 x 6,109.09; 2026 to mid-November: 10.5 months (5,345.45)
  near(R.depreciationTaken(168000, "2019-08-01", "2026-11-06"), 168000 / 27.5 * (4.5 / 12 + 6 + 10.5 / 12), 0.01);
  near(R.depreciationTaken(168000, "2019-08-01", "2019-11-20"), 168000 / 27.5 * 3 / 12, 0.01);
  assert.equal(R.depreciationTaken(168000, "2019-08-01", "2019-08-20"), 0);
  assert.equal(R.depreciationTaken(168000, "1990-01-01", "2026-11-06"), 168000, "never more than the building's cost");
  assert.equal(R.depreciationTaken(0, "2019-08-01", "2026-11-06"), 0);
  near(R.compute(condoOnNetWorthPlan(), { today: "2026-11-06" }).rentals[0].depreciationTaken, 44290.91, 0.01);
});

// ---------------------------------------------------------------- the year's books from the ledger, laid out like Schedule E
// (gap list, next 60, item 20; books.js). The invented landlord couple Sam and Lee and their Condo (round 8): 2,100 a month of
// rent, bought for 210,000 and first rented in August 2019 (land 20%), its mortgage 150,000 at 4.5% with 851 a month.
const BOOKS_TODAY = "2026-11-16";
const tx = (id, date, amount, category, tags = ["condo"], extra = {}) => ({ id, date, amount, payee: id, accountId: "chk", category, tags, note: "", ...extra });
/** Sam and Lee's bank lines: ten months of 2026 and the last two of 2025, most tagged "condo", a few of their own home. */
async function landlordBooksPlan() {
  const { landlordPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const p = migrate(landlordPlan());
  p.categories = [{ id: "hoa", label: "HOA dues", kind: "expense", icon: "🏢" }, { id: "rrep", label: "Rental repairs", kind: "expense", icon: "🔧" },
    { id: "clean", label: "Cleaning", kind: "expense", icon: "🧽" }, { id: "taxprep", label: "Tax prep", kind: "expense", icon: "🧾" }];
  const t = [];
  for (let m = 1; m <= 10; m++) {
    const mm = String(m).padStart(2, "0");
    t.push(tx(`rent-${mm}`, `2026-${mm}-01`, 2100, "income-rental", []));           // one rental: "Rent you collect" is its rent, untagged
    t.push(tx(`loan-${mm}`, `2026-${mm}-03`, -851, "housing"));                    // a loan payment: not on the form
    t.push(tx(`hoa-${mm}`, `2026-${mm}-05`, -350, "hoa"));                         // a name no line of the form reads: Other
  }
  t.push(tx("late-fee", "2026-03-09", 50, "", ["condo"]));                           // money in with no category: rent
  t.push(tx("insurer", "2026-02-10", -1200, "insurance"));
  t.push(tx("county-1", "2026-04-10", -2350, "taxes", ["Condo"]));                   // letter case aside
  t.push(tx("county-2", "2026-10-10", -2350, "taxes", ["#condo"]));
  t.push(tx("plumber", "2026-05-20", -480, "rrep"));
  t.push(tx("plumber-back", "2026-06-02", 80, "rrep"));                              // money back on a repair takes off the line
  t.push(tx("cleaner", "2026-07-01", -150, "clean"));
  t.push(tx("hardware", "2026-07-15", -64.5, "shopping"));
  t.push(tx("preparer", "2026-03-30", -300, "taxprep"));
  t.push(tx("power", "2026-08-12", -90, "utilities"));
  t.push(tx("store", "2026-09-04", -200, "shopping", ["condo"], { splits: [{ category: "shopping", amount: -120 }, { category: "utilities", amount: -80 }] }));
  t.push(tx("to-savings", "2026-09-30", -1000, "transfer"));                         // a move between their own accounts: not counted
  t.push(tx("left-out", "2026-09-30", -999, "other", ["condo"], { exclude: true }));  // left out of the totals: not counted
  t.push(tx("groceries", "2026-06-10", -40, "groceries", []));                       // their own spending, untagged
  t.push(tx("home-power", "2026-06-11", -110, "utilities", []));
  t.push(tx("rent-2025-11", "2025-11-01", 2100, "income-rental", []), tx("rent-2025-12", "2025-12-01", 2100, "income-rental", []));
  p.transactions = t;
  return p;
}

test("books: Sam and Lee's 2026 lands on the lines of Schedule E by category, by hand", async () => {
  const B = await import("./books.js");
  const { yearOfPayments: year12 } = await import("../../../core/math/finance.js");
  const p = await landlordBooksPlan();
  const before = JSON.stringify(p);
  const b = B.books(p, { today: BOOKS_TODAY });
  assert.equal(JSON.stringify(p), before, "books() writes nothing");
  assert.deepEqual([b.ready, b.year, b.thisYear, b.years, b.case], [true, 2026, 2026, [2026, 2025], "some"]);
  const r = b.rentals[0];
  assert.equal(r.tag, "condo");
  // 10 rents, the late fee, 10 loan payments, 10 dues, insurance, 2 tax bills, 2 repair lines, cleaning, hardware, the
  // preparer, power and the split purchase (once): 41 bank lines; the transfer, the line left out and their own two are not
  assert.equal(r.count, 41); assert.equal(b.lines, 41);
  const interest = year12(150000, 0.045, 851).interest;
  const by = Object.fromEntries(r.rows.map((x) => [x.line, x.amount]));
  near(by["3"], 21050); near(by["7"], 150); near(by["9"], 1200); near(by["10"], 300); near(by["12"], interest);
  near(by["14"], 400); near(by["15"], 184.5); near(by["16"], 4700); near(by["17"], 170); near(by["18"], 168000 / 27.5); near(by["19"], 3500);
  assert.deepEqual(r.rows.map((x) => x.line), ["3", "7", "9", "10", "12", "14", "15", "16", "17", "18", "19"], "the form's order, only lines with an amount");
  assert.deepEqual(r.rows.find((x) => x.line === "15").from, ["Shopping and clothes"]);
  assert.deepEqual(r.rows.find((x) => x.line === "17").from, ["Utilities"]);
  assert.equal(r.rows.find((x) => x.line === "12").about, true);
  near(r.loanPaid, 8510);
  // line 20 = lines 5 to 19; line 21 = line 3 less line 20
  const costs = 150 + 1200 + 300 + interest + 400 + 184.5 + 4700 + 170 + 168000 / 27.5 + 3500;
  near(r.expenses, costs); near(r.net, 21050 - costs);
  assert.deepEqual([Math.round(r.expenses), Math.round(r.net)], [23391, -2341], "the README's example");
  assert.equal(B.rentalSentence(r, b.year, undefined, b.thisYear), "Condo's books for 2026 so far (bank lines for January to October) show a loss of $2,341: $21,050 of rent less $23,391 of costs, among them all of 2026's depreciation and loan interest.");
  assert.deepEqual([r.months, r.start, r.whole], [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1, false], "the year still running is never whole");
  assert.deepEqual([r.dep.state, r.mortgage.state], ["counted", "loan"]);
  assert.deepEqual(b.untied, { count: 0, total: 0, outCount: 0, out: 0 });
});

test("books: which line a category goes to (built-in ids, the words of a category's name, money in and out)", async () => {
  const { lineFor } = await import("./books.js");
  const c = (id, label, kind = "expense") => ({ id, label, kind });
  const cases = [
    [null, 2100, "rents"], [null, -40, "other"], [c("transfer", "Transfer between my accounts", "transfer"), -10, null],
    [c("income-rental", "Rent you collect", "income"), 2100, "rents"], [c("income-other", "Other", "income"), -100, "rents"],
    [c("housing", "Rent or mortgage"), -851, "loan"], [c("housing", "Rent or mortgage"), 2100, "rents"], [c("debt", "Loan and card payments"), -500, "loan"],
    [c("utilities", "Utilities"), -90, "utilities"], [c("phone", "Phone and internet"), -60, "utilities"], [c("insurance", "Insurance"), -1200, "insurance"],
    [c("taxes", "Taxes not withheld"), -2350, "taxes"], [c("transport", "Car, gas, transit"), -45, "auto"], [c("travel", "Travel"), -300, "auto"],
    [c("shopping", "Shopping and clothes"), -64.5, "supplies"], [c("groceries", "Groceries"), -40, "other"], [c("other", "Other"), -10, "other"],
    [c("x1", "Mortgage interest"), -500, "mortgage"], [c("x2", "Advertising"), -25, "advertising"], [c("x3", "Lawn care"), -60, "cleaning"],
    [c("x4", "Leasing commission"), -900, "commissions"], [c("x5", "Attorney"), -400, "legal"], [c("x6", "Tax prep"), -300, "legal"],
    [c("x7", "Property management"), -210, "management"], [c("x8", "Credit card interest"), -30, "interest"], [c("x9", "Electrician"), -250, "repairs"],
    [c("x10", "Supplies"), -20, "supplies"], [c("x11", "Water and sewer"), -70, "utilities"], [c("x12", "Mileage"), -35, "auto"], [c("x13", "HOA dues"), -350, "other"],
    [c("utilities", "Electric bill"), -90, "utilities"], [c("other", "Repairs"), -100, "repairs"],   // a built-in renamed goes by its new name
  ];
  for (const [cat, amount, want] of cases) assert.equal(lineFor(cat, amount), want, `${cat?.label ?? "none"} ${amount}`);
});

test("books: a line is tied by the rental's name as a tag (case, spaces and dashes aside); with one rental also by \"rental\" and Rent you collect", async () => {
  const { tieOf, rentalTag, tagKey } = await import("./books.js");
  assert.equal(rentalTag({ name: "Duplex on Elm" }), "duplex on elm"); assert.equal(rentalTag({ name: "" }), "rental"); assert.equal(tagKey("Duplex-on Elm"), "duplexonelm");
  const one = tieOf([{ name: "Condo" }]);
  assert.equal(one({ tags: ["CONDO"] }), 0); assert.equal(one({ tags: ["rental"] }), 0); assert.equal(one({ tags: [], category: "income-rental" }), 0); assert.equal(one({ tags: ["trip"], category: "groceries" }), -1);
  const two = tieOf([{ name: "Condo" }, { name: "Duplex on Elm" }]);
  assert.equal(two({ tags: ["duplex-on-elm"] }), 1); assert.equal(two({ tags: ["duplexonelm"] }), 1); assert.equal(two({ tags: ["condo"] }), 0);
  assert.equal(two({ tags: ["rental"] }), -1, "with two rentals \"rental\" says which one no more"); assert.equal(two({ tags: [], category: "income-rental" }), -1);
});

test("books, review F1 and F3: each rental gets a tag of its own from its whole name, in any script; two names that give one tag are told apart", async () => {
  const B = await import("./books.js");
  // "Unit #1" and "Unit #2" both gave "unit" (Transactions reads "#" as the start of another tag): the second got nothing
  assert.deepEqual(B.rentalTags([{ name: "Unit #1" }, { name: "Unit #2" }]), ["unit 1", "unit 2"]);
  assert.deepEqual([B.rentalTag({ name: "Mom & Pop #2" }), B.rentalTag({ name: "A,B" }), B.rentalTag({ name: "  Duplex on Elm " })], ["mom & pop 2", "a b", "duplex on elm"]);
  // a name with letters of another script ties by them; one with no letter or digit at all gets "rental"
  assert.equal(B.rentalTag({ name: "アパート" }), "アパート"); assert.equal(B.tagKey("アパート"), "アパート");
  assert.deepEqual([B.rentalTag({ name: "🏠" }), B.rentalTag({ name: "" }), B.rentalTag({})], ["rental", "rental", "rental"]);
  // two names that give one tag: the second gets the first free number no other rental's name gives
  assert.deepEqual(B.rentalTags([{ name: "Condo" }, { name: "condo" }, { name: "Condo 2" }]), ["condo", "condo 3", "condo 2"]);
  assert.deepEqual(B.rentalTags([{ name: "" }, { name: "🏠" }]), ["rental", "rental 2"]);
  const { emptyPlan: empty } = await import("../../../core/schema/migrate.js");
  const p = empty();
  p.property = [{ id: "a", kind: "rental", name: "Unit #1" }, { id: "b", kind: "rental", name: "Unit #2" }, { id: "c", kind: "rental", name: "アパート" }];
  p.transactions = [tx("u1", "2026-03-01", 1000, "income-rental", ["unit 1"]), tx("u2", "2026-03-01", 1200, "income-rental", ["Unit-2"]), tx("u", "2026-03-01", 900, "income-rental", ["unit"]),
    tx("jp", "2026-03-02", 800, "", ["アパート"])];
  const b = B.books(p, { today: BOOKS_TODAY });
  assert.deepEqual(b.rentals.map((r) => [r.tag, r.rents]), [["unit 1", 1000], ["unit 2", 1200], ["アパート", 800]]);
  assert.deepEqual([b.untied.count, b.untied.total], [1, 900], "a line tagged only \"unit\" says which of the two no more: said as not tied");
  assert.match(B.booksSentence({ ...b, case: "noneTied" }), /\(“unit 1”, “unit 2”, “アパート”\)/, "the page asks for the tags that tie");
});

test("books, review F2: a category named for the loan's interest is mortgage interest (line 12), not a loan payment; the estimate then steps aside", async () => {
  const B = await import("./books.js");
  const c = (label) => ({ id: "x", label, kind: "expense" });
  for (const label of ["Loan interest", "Interest on mortgage", "Home loan interest", "Mortgage interest", "Interest on the loan", "HELOC interest"]) assert.equal(B.lineFor(c(label), -600), "mortgage", label);
  for (const label of ["Car loan interest", "Credit card interest", "Student loan interest", "Interest"]) assert.equal(B.lineFor(c(label), -30), "interest", label);
  for (const label of ["Mortgage", "Loan payment", "Rent or mortgage"]) assert.equal(B.lineFor(c(label), -851), "loan", label);
  assert.equal(B.lineFor(c("Loan interest"), 25), "mortgage", "money back on interest takes off line 12, it is not rent");
  // the critic's case: $600 filed as "Loan interest" in 2026 with a loan on the page: line 12 is the $600, no estimate
  const p = await landlordBooksPlan();
  p.categories.push({ id: "li", label: "Loan interest", kind: "expense" });
  p.transactions.push(tx("li-1", "2026-10-31", -600, "li"));
  const r = B.books(p, { today: BOOKS_TODAY }).rentals[0];
  assert.deepEqual([r.mortgage.state, r.rows.find((x) => x.line === "12").amount, r.rows.find((x) => x.line === "12").about], ["lines", 600, undefined]);
  near(r.loanPaid, 8510, 1e-9, "the $600 is not a loan payment");
});

test("books, review F4, F7 and F8: costs for no single rental are said; a $0.00 line is not a line; a land share over 100% is not a negative building; odd plans do not throw", async () => {
  const B = await import("./books.js");
  const { emptyPlan: empty } = await import("../../../core/schema/migrate.js");
  const p = empty();
  p.property = [{ id: "a", kind: "rental", name: "Condo" }, { id: "b", kind: "rental", name: "Duplex" }];
  p.transactions = [tx("rent", "2025-01-05", 1800, "income-rental", ["rental"]), tx("fix", "2025-01-06", -500, "insurance", ["rental"]), tx("dup", "2025-01-07", 900, "", ["duplex"])];
  let b = B.books(p, { today: BOOKS_TODAY, year: 2025 });
  assert.deepEqual(b.untied, { count: 1, total: 1800, outCount: 1, out: 500 }, "the -500 tagged rental no longer vanishes");
  assert.match(B.untiedSentence(b), /^2 bank lines for 2025 \(\$1,800 in, \$500 out\) are not tied to one rental/);
  // a $0.00 line (or one with no number) ties nothing: no count, no year, no depreciation
  const one = empty();
  one.property = [{ id: "a", kind: "rental", name: "Condo", purchasePrice: 200000, purchaseDate: "2020-05-01" }];
  one.transactions = [tx("zero", "2025-01-01", 0, "insurance"), tx("nan", "2025-02-01", "abc", "insurance")];
  b = B.books(one, { today: BOOKS_TODAY, year: 2025 });
  assert.deepEqual([b.case, b.lines, b.years, b.rentals[0].count, b.rentals[0].expenses], ["noneTied", 0, [], 0, 0]);
  // land's share kept between 0 and 100%
  const d = B.depOf({ purchasePrice: 100000, purchaseDate: "2020-05-01", landShare: 1.5 }, 2025);
  assert.deepEqual([d.state, d.basis, d.amount], ["done", 0, 0]);
  near(B.depOf({ purchasePrice: 100000, purchaseDate: "2020-05-01", landShare: -0.5 }, 2025).basis, 100000);
  // transactions that are not a list, a property entry that is null: read as none, no throw
  assert.equal(B.books({ property: [{ kind: "rental", name: "a" }], transactions: "x" }, { today: BOOKS_TODAY }).case, "noLines");
  const odd = empty(); odd.property = [null, { id: "a", kind: "rental", name: "Condo", value: 200000, rentMonthly: 1500 }];
  odd.transactions = [tx("r", "2026-02-01", 1500, "", ["condo"])];
  assert.equal(B.books(odd, { today: BOOKS_TODAY }).rentals[0].rents, 1500);
});

test("books, review P1 and F5: the months with bank lines; a year that is over with months missing is said not to be whole, in the sentence and the file", async () => {
  const B = await import("./books.js");
  const { parseCsv } = await import("../../../core/csv.js");
  const p = await landlordBooksPlan();
  const last = B.books(p, { today: BOOKS_TODAY, year: 2025 });
  const r = last.rentals[0];
  assert.deepEqual([r.months, r.start, r.whole], [[11, 12], 1, false]);
  const notes = parseCsv(B.booksCsv(last)).rows.find((x) => x[0] === "3")[3];
  assert.equal(notes, "not the whole year: bank lines in 2 of its months only, 11/2025 to 12/2025");
  // the rest of 2025's rents: whole, and the old verdict (a profit) with no note
  for (let m = 1; m <= 10; m++) p.transactions.push(tx(`r25-${m}`, `2025-${String(m).padStart(2, "0")}-01`, 2100, "income-rental", []));
  const full = B.books(p, { today: BOOKS_TODAY, year: 2025 });
  assert.equal(full.rentals[0].whole, true);
  assert.equal(B.rentalSentence(full.rentals[0], 2025, undefined, full.thisYear), "Condo's books for 2025 show a profit of $19,091: $25,200 of rent less $6,109 of costs.");
  assert.equal(parseCsv(B.booksCsv(full)).rows.find((x) => x[0] === "3")[3], "");
  // first rented in August 2025: August to December is the whole of its year
  const aug = await landlordBooksPlan();
  aug.property[0].purchaseDate = "2025-08-10";
  aug.transactions = [8, 9, 10, 11, 12].map((m) => tx(`a${m}`, `2025-${String(m).padStart(2, "0")}-01`, 2100, "income-rental", []));
  const a = B.books(aug, { today: BOOKS_TODAY, year: 2025 }).rentals[0];
  assert.deepEqual([a.start, a.whole, a.dep.state], [8, true, "first"]);
});

test("books: depreciation against a hand calculation (Pub 527's own example; the condo by year; not counted, and why)", async () => {
  const { depOf } = await import("./books.js");
  // IRS Publication 527 (2025), Table 2-2d's example: a $160,000 building placed in service in February: $5,091 (3.182%)
  const pub = depOf({ purchasePrice: 185000, landShare: 25000 / 185000, purchaseDate: "2025-02-08" }, 2025);
  near(pub.basis, 160000, 1e-6); near(pub.amount, 160000 / 27.5 * 10.5 / 12); assert.equal(Math.round(pub.amount), 5091); assert.equal(pub.state, "first");
  // the condo: 210,000 less 20% land = 168,000 over 27.5 years = 6,109.09 a year; 2019 from mid-August: 4.5 months = 2,290.91
  const condo = { purchasePrice: 210000, purchaseDate: "2019-08-01", landShare: 0.2 };
  near(depOf(condo, 2026).amount, 6109.09); assert.equal(depOf(condo, 2026).state, "counted");
  near(depOf(condo, 2019).amount, 2290.91); assert.equal(depOf(condo, 2019).state, "first");
  assert.equal(depOf(condo, 2018).state, "notYet");
  near(depOf(condo, 2047).amount, 168000 - 2290.91 - 6109.0909 * 27, 0.01);   // what is left in the last year
  assert.deepEqual([depOf(condo, 2048).state, depOf(condo, 2048).amount], ["done", 0]);
  near(depOf({ ...condo, landShare: null, improvements: 12000 }, 2026).amount, 180000 / 27.5);   // the default 20% land, improvements added
  assert.equal(depOf({ ...condo, purchasePrice: null, value: 260000 }, 2026).state, "noPrice", "today's value is not a cost: not counted");
  assert.equal(depOf({ ...condo, purchaseDate: "" }, 2026).state, "noDate");
});

test("books: a year with no tied lines says what to do first (no bank lines at all; lines but none tied), one rental and two", async () => {
  const B = await import("./books.js");
  const { landlordPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const p = landlordPlan();
  let b = B.books(p, { today: BOOKS_TODAY });
  assert.equal(b.case, "noLines"); assert.equal(B.booksStatus(b), "none tied yet");
  assert.equal(B.booksSentence(b), "No bank lines are in the plan yet. Add them on Transactions, then type “condo” in the Tags box of Condo's lines: its rent and costs add up here, ready for the tax form for rental income.");
  p.transactions = [tx("groceries", "2026-06-10", -40, "groceries", [])];
  b = B.books(p, { today: BOOKS_TODAY });
  assert.equal(b.case, "noneTied"); assert.equal(B.booksStatus(b), "none tied yet");
  assert.equal(B.booksSentence(b), "No bank lines are tied to Condo for 2026 yet. On Transactions, type “condo” in the Tags box of its rent and bills (a rule can do it for you): they then add up here, ready for the tax form for rental income.");
  p.property.push({ id: "r2", kind: "rental", name: "Duplex on Elm", value: 320000, rentMonthly: 2600 });
  b = B.books(p, { today: BOOKS_TODAY });
  assert.equal(B.booksSentence(b), "No bank lines are tied to your rentals for 2026 yet. On Transactions, type each rental's word in the Tags box of its rent and bills (“condo”, “duplex on elm”): they then add up here, ready for the tax form for rental income.");
  p.transactions = [];
  assert.equal(B.booksSentence(B.books(p, { today: BOOKS_TODAY })), "No bank lines are in the plan yet. Add them on Transactions, then type each rental's word in the Tags box of its lines (“condo”, “duplex on elm”): their rent and costs add up here, ready for the tax form for rental income.");
  // lines tied to last year only: in January the year shown is last year's (a preparer asks for it)
  p.transactions = [tx("rent-2025", "2025-12-01", 2100, "", ["condo"])];
  b = B.books(p, { today: "2026-01-20" });
  assert.deepEqual([b.year, b.case, B.booksSentence(b)], [2025, "some", null]);
  assert.equal(B.books(p, { today: "2026-01-20", year: 2026 }).case, "noneTied", "a year picked is the year shown");
  assert.equal(B.books(emptyPlan(), { today: BOOKS_TODAY }).ready, false);
});

test("books: every sentence, one per case (R5)", async () => {
  const B = await import("./books.js");
  const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = (over) => ({ name: "Condo", tag: "condo", count: 3, rents: 12000, expenses: 9000, net: 3000, loanPaid: 0, dep: { state: "counted", amount: 6109.09, basis: 168000, from: { year: 2019, month: 8 } }, mortgage: { state: "none", amount: 0 }, months: ALL, start: 1, whole: true, ...over });
  // a year that is over, every month with lines
  assert.equal(B.rentalSentence(r({}), 2025, undefined, 2026), "Condo's books for 2025 show a profit of $3,000: $12,000 of rent less $9,000 of costs.");
  assert.equal(B.rentalSentence(r({ expenses: 14300, net: -2300 }), 2025, undefined, 2026), "Condo's books for 2025 show a loss of $2,300: $12,000 of rent less $14,300 of costs.");
  assert.equal(B.rentalSentence(r({ expenses: 12000, net: 0.2 }), 2025, undefined, 2026), "Condo's books for 2025 break even: $12,000 of rent and $12,000 of costs.");
  // the year still running: so far, the months the lines cover, and what is the whole year's (F5)
  const now = { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], whole: false };
  assert.equal(B.rentalSentence(r({ ...now }), 2026, undefined, 2026), "Condo's books for 2026 so far (bank lines for January to October) show a profit of $3,000: $12,000 of rent less $9,000 of costs, among them all of 2026's depreciation.");
  assert.equal(B.rentalSentence(r({ ...now, expenses: 14300, net: -2300, mortgage: { state: "loan", amount: 6677.7 } }), 2026, undefined, 2026), "Condo's books for 2026 so far (bank lines for January to October) show a loss of $2,300: $12,000 of rent less $14,300 of costs, among them all of 2026's depreciation and loan interest.");
  assert.equal(B.rentalSentence(r({ ...now, expenses: 12000, net: 0, dep: { state: "noPrice", amount: 0 }, mortgage: { state: "loan", amount: 600 } }), 2026, undefined, 2026), "Condo's books for 2026 so far (bank lines for January to October) break even: $12,000 of rent and $12,000 of costs, among them all of 2026's loan interest.");
  assert.equal(B.rentalSentence(r({ ...now, months: [3], dep: { state: "noDate", amount: 0 } }), 2026, undefined, 2026), "Condo's books for 2026 so far (bank lines for March) show a profit of $3,000: $12,000 of rent less $9,000 of costs.");
  // a year that is over with months missing: not called a profit or a loss (P1)
  assert.equal(B.rentalSentence(r({ rents: 4200, expenses: 6109.09, net: -1909.09, months: [11, 12], whole: false }), 2025, undefined, 2026), "Only 2 months of 2025 have bank lines for Condo (November and December), so these are not the whole year's books: $4,200 of rent less $6,109 of costs, among them all of 2025's depreciation.");
  assert.equal(B.rentalSentence(r({ months: [5], whole: false, dep: { state: "noPrice", amount: 0 } }), 2024, undefined, 2026), "Only one month of 2024 has bank lines for Condo (May), so these are not the whole year's books: $12,000 of rent less $9,000 of costs.");
  assert.equal(B.monthWords([1, 2, 3, 5]), "January to May, with gaps"); assert.equal(B.monthWords([]), "");
  assert.equal(B.rentalSentence(r({ count: 0, name: "Duplex on Elm", tag: "duplex on elm" }), 2026, undefined, 2026), "No bank lines are tied to Duplex on Elm for 2026 yet: type “duplex on elm” in the Tags box of its lines on Transactions.");
  assert.equal(B.depSentence(r({}), 2026), "Depreciation (line 18): $6,109 for 2026, the building's $168,000 over 27.5 years.");
  assert.equal(B.depSentence(r({ dep: { state: "first", amount: 2290.91, basis: 168000, from: { year: 2019, month: 8 } } }), 2019), "Depreciation (line 18): $2,291 for 2019, its first year: 4.5 of 12 months, from the middle of August.");
  assert.equal(B.depSentence(r({ dep: { state: "noPrice", amount: 0 } }), 2026), "Depreciation (line 18) is not counted: it needs what you paid for Condo, under Change Condo.");
  assert.equal(B.depSentence(r({ dep: { state: "noDate", amount: 0 } }), 2026), "Depreciation (line 18) is not counted: it needs the month Condo was first rented out, under Change Condo.");
  assert.equal(B.depSentence(r({ dep: { state: "notYet", amount: 0, from: { year: 2027, month: 3 } } }), 2026), "No depreciation for 2026: Condo was first rented out in 2027.");
  assert.equal(B.depSentence(r({ dep: { state: "done", amount: 0 } }), 2050), "No depreciation for 2050: the building's cost was written off over 27.5 years.");
  assert.equal(B.mortgageSentence(r({ mortgage: { state: "lines", amount: 6500 } }), 2026), "Mortgage interest (line 12): $6,500, from your lines filed as mortgage interest.");
  assert.equal(B.mortgageSentence(r({ mortgage: { state: "loan", amount: 6677.7 } }), 2026), "Mortgage interest (line 12): about $6,678, a year of payments on the loan as it stands; the lender's Form 1098 (box 1) has the exact figure.");
  assert.equal(B.mortgageSentence(r({ mortgage: { state: "noLoan", amount: 0 } }), 2026), "Mortgage interest is not counted: this page has no loan for Condo. Add it under Change Condo, or copy the interest from box 1 of the lender's Form 1098.");
  assert.equal(B.mortgageSentence(r({ mortgage: { state: "form1098", amount: 0 } }), 2025), "Mortgage interest for 2025 is not counted here: copy it from box 1 of the lender's Form 1098 for 2025.");
  assert.equal(B.mortgageSentence(r({}), 2026), null);
  assert.equal(B.loanSentence(r({ loanPaid: 8510 })), "Loan payments of $8,510 are not on the form: only their interest counts (line 12).");
  assert.equal(B.loanSentence(r({})), null);
  const b = { year: 2026, rentals: [{ tag: "condo" }, { tag: "duplex on elm" }], untied: { count: 3, total: 6300, outCount: 0, out: 0 } };
  assert.equal(B.untiedSentence(b), "3 rent lines for 2026 ($6,300) are not tied to one rental: type the rental's word in their Tags box (“condo”, “duplex on elm”).");
  assert.equal(B.untiedSentence({ ...b, untied: { count: 1, total: 2100, outCount: 0, out: 0 } }), "One rent line for 2026 ($2,100) is not tied to one rental: type the rental's word in its Tags box (“condo”, “duplex on elm”).");
  // money out too (F4): a cost tagged "rental" with two rentals is said, not dropped
  assert.equal(B.untiedSentence({ ...b, untied: { count: 0, total: 0, outCount: 1, out: 500 } }), "One cost line for 2026 ($500) is not tied to one rental: type the rental's word in its Tags box (“condo”, “duplex on elm”).");
  assert.equal(B.untiedSentence({ ...b, untied: { count: 0, total: 0, outCount: 2, out: 740 } }), "2 cost lines for 2026 ($740) are not tied to one rental: type the rental's word in their Tags box (“condo”, “duplex on elm”).");
  assert.equal(B.untiedSentence({ ...b, untied: { count: 3, total: 6300, outCount: 2, out: 500 } }), "5 bank lines for 2026 ($6,300 in, $500 out) are not tied to one rental: type the rental's word in their Tags box (“condo”, “duplex on elm”).");
  assert.equal(B.untiedSentence({ ...b, untied: { count: 0, total: 0, outCount: 0, out: 0 } }), null);
  assert.match(B.PASSIVE_LINE, /^A rental loss may not all count this year: the passive activity rules \(Form 8582\)/);
  assert.equal(B.booksStatus({ case: "some", year: 2026, lines: 1 }), "2026 · 1 line");
  assert.ok(B.booksStatus({ case: "some", year: 2026, lines: 41 }).length <= 20, "a status fits one row at 320 px");
});

test("books: past years count no interest from today's loan (Form 1098), two rentals keep their own lines, rent tied to neither is said", async () => {
  const B = await import("./books.js");
  const p = await landlordBooksPlan();
  const last = B.books(p, { today: BOOKS_TODAY, year: 2025 });
  assert.deepEqual([last.case, last.lines, last.rentals[0].mortgage.state, last.rentals[0].rents], ["some", 2, "form1098", 4200]);
  near(last.rentals[0].expenses, 168000 / 27.5, 0.001);   // only the year's depreciation
  p.property.push({ id: "r2", kind: "rental", name: "Duplex on Elm", value: 320000, purchasePrice: 280000, purchaseDate: "2021-06-15", rentMonthly: 2600 });
  p.transactions.push(tx("elm-rent", "2026-05-01", 2600, "income-rental", ["duplex-on-elm"]), tx("elm-roof", "2026-05-20", -900, "rrep", ["duplex on elm"]));
  const b = B.books(p, { today: BOOKS_TODAY });
  const [condo, elm] = b.rentals;
  near(condo.rents, 50, 1e-9, "with two rentals the untagged rent is no one's: only the late fee tagged condo");
  assert.deepEqual([elm.count, elm.rents, elm.rows.find((x) => x.line === "14").amount], [2, 2600, 900]);
  assert.equal(elm.mortgage.state, "none", "no loan, no loan payments: nothing said");
  assert.deepEqual(b.untied, { count: 10, total: 21000, outCount: 0, out: 0 });
  // a loan payment tied to a rental with no loan on the page, this year
  p.transactions.push(tx("elm-loan", "2026-06-01", -1150, "housing", ["duplex on elm"]));
  assert.equal(B.books(p, { today: BOOKS_TODAY }).rentals[1].mortgage.state, "noLoan");
  // lines filed under a "Mortgage interest" category of their own are line 12 as they are, not our estimate
  p.categories.push({ id: "mi", label: "Mortgage interest", kind: "expense" });
  p.transactions.push(tx("condo-mi", "2026-10-31", -5500, "mi"));
  const m = B.books(p, { today: BOOKS_TODAY }).rentals[0];
  assert.deepEqual([m.mortgage.state, m.rows.find((x) => x.line === "12").amount, m.rows.find((x) => x.line === "12").about], ["lines", 5500, undefined]);
});

test("books: the CSV for a tax preparer: the form's lines 3 and 5 to 21, a column per rental, blank where the form is empty, the names guarded", async () => {
  const B = await import("./books.js");
  const { parseCsv } = await import("../../../core/csv.js");
  const p = await landlordBooksPlan();
  const b = B.books(p, { today: BOOKS_TODAY });
  const csv = B.booksCsv(b);
  assert.equal(B.booksFile(b), "rental-books-2026.csv");
  const { headers, rows } = parseCsv(csv);
  assert.deepEqual(headers, ["Line", "Schedule E for 2026", "Condo", "Notes"]);
  assert.deepEqual(rows.map((r) => r[0]), ["3", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21"]);
  const row = (line) => rows.find((r) => r[0] === line);
  assert.deepEqual(row("3"), ["3", "Rents received", "21050.00", "the year so far: bank lines 01/2026 to 10/2026"]);
  assert.deepEqual(row("5"), ["5", "Advertising", "", ""], "blank where the form would be empty");
  assert.deepEqual(row("12").slice(0, 2), ["12", "Mortgage interest paid to banks, etc."]);
  assert.match(row("12")[3], /^about: a year of payments on the loan typed on Rental analysis; the lender's Form 1098 \(box 1\) has the exact figure$/);
  assert.deepEqual(row("18"), ["18", "Depreciation expense or depletion", "6109.09", "27.5 years straight line, mid-month, from 08/2019; basis 168000.00"]);
  assert.deepEqual(row("19"), ["19", "Other (list)", "3500.00", "HOA dues"]);
  assert.equal(row("20")[2], b.rentals[0].expenses.toFixed(2)); assert.equal(row("21")[2], (Math.round(b.rentals[0].net * 100) / 100).toFixed(2));
  assert.ok(Number(row("21")[2]) < 0, "a loss with a minus");
  // two rentals with lines: a column each, the notes say whose; a name a spreadsheet would run is guarded (Tax lots' csvText)
  p.property.push({ id: "r2", kind: "rental", name: "=Elm", value: 320000, rentMonthly: 2600 });
  p.transactions.push(tx("elm-rent", "2026-05-01", 2600, "", ["elm"]));
  const two = parseCsv(B.booksCsv(B.books(p, { today: BOOKS_TODAY })));
  assert.deepEqual(two.headers, ["Line", "Schedule E for 2026", "Condo", "'=Elm", "Notes"]);
  assert.deepEqual(two.rows.find((r) => r[0] === "18").slice(2), ["6109.09", "", "Condo: 27.5 years straight line, mid-month, from 08/2019; basis 168000.00; =Elm: not counted: the price paid is not in the plan"]);
  assert.deepEqual(two.rows.find((r) => r[0] === "3").slice(2, 4), ["50.00", "2600.00"], "with two rentals the untagged rent is no one's: only the late fee tagged condo");
});

test("books invariance: nothing typed, nothing changes: compute() is the same with the ledger tied or not, and a rental saved with its boxes left empty counts the same as with the defaults typed", async () => {
  const { familyPlan: fam } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const B = await import("./books.js");
  const R = await import("./compute.js");
  const plans = [["family", fam(BOOKS_TODAY)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan()], ["empty", emptyPlan()], ["cardGap", cardGapPlan("2026-11-02")],
    ["condoOnNetWorth", condoOnNetWorthPlan()], ["condoOnly", condoOnlyRentalPlan()], ["landlordBooks", await landlordBooksPlan()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  assert.ok(plans.length >= 22);
  const DEF = { vacancy: 0.05, maintenance: 0.01, landShare: 0.2, appreciation: 0.035 };
  for (const [name, p0] of plans) {
    const p = migrate(structuredClone(p0));
    const was = JSON.stringify(p);
    const c0 = JSON.stringify(R.compute(p, { today: BOOKS_TODAY })), f0 = JSON.stringify(R.rentalsFor(p, { today: BOOKS_TODAY, year: 2026 }));
    B.books(p, { today: BOOKS_TODAY }); B.books(p, { today: BOOKS_TODAY, year: 2025 });
    assert.equal(JSON.stringify(p), was, `${name}: books() writes nothing`);
    assert.equal(JSON.stringify(R.compute(p, { today: BOOKS_TODAY })), c0, `${name}: compute() unchanged after books()`);
    // every line of the ledger tagged with each rental's name: the page's own figures do not read the ledger
    const q = structuredClone(p);
    const tags = (q.property ?? []).filter((x) => x?.kind === "rental").map((r) => B.rentalTag(r));
    for (const t of q.transactions ?? []) t.tags = [...(t.tags ?? []), ...tags];
    assert.equal(JSON.stringify(R.compute(q, { today: BOOKS_TODAY })), c0, `${name}: tagging the ledger changes no figure of the page`);
    assert.equal(JSON.stringify(R.rentalsFor(q, { today: BOOKS_TODAY, year: 2026 })), f0, `${name}: nor the Federal estimate's rentals`);
    // a rental added with the four boxes left empty (the form now) counts what one added with them typed (the form before)
    const blank = structuredClone(p), typed = structuredClone(p);
    const add = (x, extra) => { x.property = [...(x.property ?? []), { id: "inv-r", kind: "rental", name: "Invariance flat", value: 240000, purchasePrice: 200000, purchaseDate: "2020-03-01", rentMonthly: 1900, propertyTax: 3000, insurance: 900, loanBalance: 0, ...extra }]; };
    add(blank, { vacancy: null, maintenance: null, landShare: null, appreciation: null, management: null }); add(typed, DEF);
    const strip = (d) => JSON.stringify(d, (k, v) => (k === "id" ? undefined : v));
    assert.equal(strip(R.compute(blank, { today: BOOKS_TODAY })), strip(R.compute(typed, { today: BOOKS_TODAY })), `${name}: empty boxes count the defaults`);
  }
});

// ---------------------------------------------------------------- the page, drawn with the real kit on the fake DOM
async function drawRental(plan0, extra = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const p = migrate(structuredClone(plan0)); const saved = []; const root = new FakeElement("main");
  const ctx = { ui: { ...ui, uid: () => "new-rental", confirm: () => true }, fmt: { ...fmt, today: () => BOOKS_TODAY }, plan: p, route: { rest: [], query: {} }, module: { group: "property", id: "rental" }, computeOf: () => null,
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } }, ...extra };
  render(root, ctx);
  return { root, saved, textOf, plan: p, ctx };
}
const partsOpen = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));
const partEl = (root, id) => root.querySelectorAll("details").find((x) => x.dataset.part === id);
const shutFold = (el) => { for (let a = el.parentNode; a; a = a.parentNode) if (a.tagName === "DETAILS" && !a.hasAttribute("open")) return a; return null; };
const buttonNamed = (root, words) => root.querySelectorAll("button").find((b) => b.textContent === words);
const visibleBoxes = (root) => root.all().filter((b) => /^(INPUT|SELECT|TEXTAREA)$/.test(b.tagName) && b.getAttribute("type") !== "hidden" && !shutFold(b)).map((b) => b.getAttribute("name"));

test("the page: one quiet row \"The year's rent and costs\", shut, its status the year and the lines; no fold by hand; opening writes nothing", async () => {
  const { root, saved, textOf } = await drawRental(await landlordBooksPlan());
  assert.deepEqual(partsOpen(root), { books: false });
  const part = partEl(root, "books");
  assert.equal(textOf(part.querySelector(".fold-title")), "The year's rent and costs");
  assert.equal(textOf(part.querySelector(".fold-status")), "2026 · 41 lines");
  assert.equal(root.querySelectorAll("details").filter((x) => !x.dataset.part && !x.className.includes("form-more")).length, 0, "no fold by hand (R10)");
  assert.ok(buttonNamed(root, "Change Condo") && buttonNamed(root, "+ Add another rental"), "the rental's details and another rental open under outlined buttons");
  assert.equal(visibleBoxes(root).length, 0, "a list with rows shows no box (R20)");
  const t = textOf(part);
  assert.match(t, /Condo's books for 2026 so far \(bank lines for January to October\) show a loss of \$[\d,]+: \$21,050 of rent less \$[\d,]+ of costs, among them all of 2026's depreciation and loan interest\./);
  assert.match(t, /Depreciation \(line 18\): \$6,109 for 2026, the building's \$168,000 over 27\.5 years\./);
  assert.match(t, /Loan payments of \$8,510 are not on the form: only their interest counts \(line 12\)\./);
  assert.match(t, /A rental loss may not all count this year/);
  for (const words of ["Save as a spreadsheet (CSV)", "Print this list"]) assert.equal(buttonNamed(part, words)?.className, "secondary", `${words}: outlined`);
  assert.equal(part.querySelectorAll("a").find((a) => /See Condo's lines on Transactions/.test(textOf(a)))?.getAttribute("href"), "#/transactions/ledger?q=%23condo");
  part.setAttribute("open", ""); part.dispatch("toggle"); part.removeAttribute("open"); part.dispatch("toggle");
  assert.equal(saved.length, 0, "opening and shutting writes nothing");
  assert.match(textOf(root), /More on this/);
});

test("the page with no rental: Add a rental shows five boxes, every required one among them; the rest wait under More details (optional) with nothing typed in them", async () => {
  const { landlordPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const none = landlordPlan(); none.property = []; none.accounts = none.accounts.filter((a) => a.type !== "property");
  const { root, textOf } = await drawRental(none);
  assert.deepEqual(visibleBoxes(root), ["name", "value", "rentMonthly", "propertyTax", "insurance"]);
  const more = root.querySelectorAll("details").find((x) => x.className.includes("form-more"));
  assert.ok(more && !more.hasAttribute("open"), "More details (optional) starts shut on a new rental");
  for (const k of ["vacancy", "maintenance", "landShare", "appreciation"]) assert.equal(root.querySelector(`[name="${k}"]`).value ?? "", "", `${k}: no default typed in`);
  const t = textOf(root);
  assert.match(t, /Left empty, we count 5% of the rent\./); assert.match(t, /Left empty, we count 1% of the value a year\./); assert.match(t, /Left empty, we count 20%\./); assert.match(t, /Left empty, we count 3\.5% a year\./);
  assert.deepEqual(partsOpen(root), {}, "no books row before there is a rental");
  // with a home on Net worth to pick, "Its value on Net worth" takes the fifth place and insurance folds
  const withHome = await drawRental(landlordPlan());
  const add = buttonNamed(withHome.root, "+ Add another rental"); add.click();
  const form = withHome.root.querySelectorAll("form").at(-1);
  assert.deepEqual(visibleBoxes(form), ["name", "value", "accountId", "rentMonthly", "propertyTax"]);
});

test("S11 (R17): saving a rental's changes opens no part and shuts none; the green line says it saved; a new rental's empty boxes save as empty", async () => {
  const a = await drawRental(await landlordBooksPlan());
  buttonNamed(a.root, "Change Condo").click();
  const form = a.root.querySelectorAll("form").find((f) => f.querySelector('[name="rentMonthly"]'));
  form.querySelector('[name="rentMonthly"]').value = "2,150";
  form.dispatch("submit");
  assert.equal(a.saved.length, 1);
  assert.equal(a.saved[0].property[0].rentMonthly, 2150);
  assert.deepEqual(a.saved[0].transactions, a.plan.transactions, "the ledger is untouched");
  const b = await drawRental(a.saved[0]);
  assert.deepEqual(partsOpen(b.root), { books: false }, "no part opens or shuts after the save");
  assert.match(b.textOf(b.root), /Saved\./);
  // a new rental: the boxes left empty save as nothing typed (null), which every page counts as the defaults
  const c = await drawRental(await landlordBooksPlan());
  buttonNamed(c.root, "+ Add another rental").click();
  const f2 = c.root.querySelectorAll("form").at(-1);
  f2.querySelector('[name="name"]').value = "Duplex on Elm"; f2.querySelector('[name="value"]').value = "320000"; f2.querySelector('[name="rentMonthly"]').value = "2600";
  f2.dispatch("submit");
  const added = c.saved[0].property.find((x) => x.id === "new-rental");
  assert.deepEqual([added.name, added.value, added.rentMonthly, added.vacancy, added.maintenance, added.landShare, added.appreciation], ["Duplex on Elm", 320000, 2600, null, null, null, null]);
  const d = await drawRental(c.saved[0]);
  assert.match(d.textOf(d.root), /Duplex on Elm added\./);
  assert.equal(d.textOf(partEl(d.root, "books").querySelector(".fold-status")), "2026 · 31 lines", "with two rentals the untagged rent is no one's");
});

test("the year's chips: picking 2025 shows 2025 and keeps the part open; the plan is not touched", async () => {
  const a = await drawRental(await landlordBooksPlan());
  const part = partEl(a.root, "books");
  const chip = part.querySelectorAll("button").find((x) => x.className.includes("chip") && x.textContent === "2025");
  assert.ok(chip, "a chip for each year with lines");
  chip.click();
  assert.equal(a.saved.length, 0, "a year picked is never saved");
  assert.deepEqual(partsOpen(a.root), { books: true }, "the part just used stays open (R17)");
  const p2 = partEl(a.root, "books");
  assert.equal(a.textOf(p2.querySelector(".fold-status")), "2025 · 2 lines");
  assert.match(a.textOf(p2), /Only 2 months of 2025 have bank lines for Condo \(November and December\), so these are not the whole year's books: \$4,200 of rent less \$6,109 of costs, among them all of 2025's depreciation\./);
  assert.doesNotMatch(a.textOf(p2), /show a loss/, "two months of rent against a year of depreciation is not called a loss (P1)");
  assert.match(a.textOf(p2), /Mortgage interest for 2025 is not counted here: copy it from box 1 of the lender's Form 1098 for 2025\./);
  // back to 2026 for the other tests of this file (the pick is kept for the visit)
  p2.querySelectorAll("button").find((x) => x.className.includes("chip") && x.textContent === "2026").click();
});

test("review F6: a year picked is for the visit: a new arrival, another plan, or a year with no lines left starts from the year shown by itself", async () => {
  const plan = await landlordBooksPlan();
  const route = { rest: [], query: {} };
  const a = await drawRental(plan, { route });
  partEl(a.root, "books").querySelectorAll("button").find((x) => x.className.includes("chip") && x.textContent === "2025").click();
  assert.equal(a.textOf(partEl(a.root, "books").querySelector(".fold-status")), "2025 · 2 lines", "picked: the same visit keeps it");
  // the same arrival drawn again (a save's redraw): still 2025
  const same = await drawRental(plan, { route });
  assert.equal(same.textOf(partEl(same.root, "books").querySelector(".fold-status")), "2025 · 2 lines");
  // another plan loaded in the same tab (the pretend plan, another household): the pick goes
  const other = structuredClone(plan); other.meta.createdAt = "2020-01-01T00:00:00.000Z";
  const o = await drawRental(other, { route });
  assert.equal(o.textOf(partEl(o.root, "books").querySelector(".fold-status")), "2026 · 41 lines");
  // a new arrival (the menu, a link, Back): the year shown by itself
  const next = await drawRental(plan, { route: { rest: [], query: {} } });
  assert.equal(next.textOf(partEl(next.root, "books").querySelector(".fold-status")), "2026 · 41 lines");
  // picked again, then the 2025 lines are gone on the same visit: back to the year shown by itself, never "nothing tied"
  partEl(next.root, "books").querySelectorAll("button").find((x) => x.className.includes("chip") && x.textContent === "2025").click();
  const gone = structuredClone(plan); gone.transactions = gone.transactions.filter((t) => !t.date.startsWith("2025"));
  const after = await drawRental(gone, { route: next.ctx.route });
  assert.equal(after.textOf(partEl(after.root, "books").querySelector(".fold-status")), "2026 · 41 lines");
});

test("the books row with nothing tied says what to do first, and links to Transactions", async () => {
  const { landlordPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const { root, textOf } = await drawRental(landlordPlan());
  const part = partEl(root, "books");
  assert.equal(textOf(part.querySelector(".fold-status")), "none tied yet");
  assert.match(textOf(part), /› No bank lines are in the plan yet\. Add them on Transactions, then type “condo” in the Tags box of Condo's lines/);
  assert.equal(part.querySelectorAll("a").find((x) => textOf(x) === "Open Transactions ›")?.getAttribute("href"), "#/transactions/ledger");
  assert.equal(buttonNamed(part, "Save as a spreadsheet (CSV)"), undefined, "no file before there is a line");
});
