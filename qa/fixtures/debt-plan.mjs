// qa/fixtures/debt-plan.mjs -- a household with a mortgage, two cards and a car loan, with
// rates, payments and limits, for the debt pages' tests.
import { pmt } from "../../core/math/finance.js";
import { emptyPlan } from "../../core/schema/migrate.js";

export function debtPlan() {
  const p = emptyPlan();
  p.accounts.push(
    { id: "home", name: "House", type: "property", balance: 380000 },
    { id: "mort", name: "Mortgage", type: "mortgage", balance: 265000 },
    { id: "visa", name: "Visa", type: "credit", balance: 6400 },
    { id: "store", name: "Store card", type: "credit", balance: 900 },
    { id: "car", name: "Car loan", type: "loan", balance: 14200 },
  );
  const mp = Math.round(pmt(0.0625 / 12, 360, 280000) * 100) / 100;   // 1724.0x on the original balance
  p.debts.push(
    { id: "d1", accountId: "mort", rate: 0.0625, minPayment: mp, extra: 0, termMonths: 360 },
    { id: "d2", accountId: "visa", rate: 0.239, minPayment: 190, extra: 0, creditLimit: 12000 },
    { id: "d3", accountId: "store", rate: 0.269, minPayment: 30, extra: 0, creditLimit: 2000 },
    { id: "d4", accountId: "car", rate: 0.049, minPayment: 410, extra: 0 },
  );
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 9000, period: "monthly" });
  p.debtPlan = { extra: 200, order: "avalanche" };
  return p;
}
