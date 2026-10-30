import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, analyse, depreciation, lossAllowance, RECOVERY_YEARS, DEFAULTS } from "./compute.js";
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
  near(r.tax, r.taxable * (d.rates.marginal + d.rates.state)); near(r.afterTax, r.cashFlow - r.tax);
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
