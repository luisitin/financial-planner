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
