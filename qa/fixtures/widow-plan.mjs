// qa/fixtures/widow-plan.mjs -- round 8's widow (2026-11-06) as a plan for Node tests: Ruth, 74 in 2026, single, retired, a
// $1,900 pension and $2,300 of Social Security a month ($50,400 a year), $12,000 in checking and $410,000 in a traditional IRA
// (this year's required withdrawal $16,078 = 410,000 / 25.5), renting, the seven spending lines Get started writes ($3,000 a
// month), the projection on its quick flat 15% tax setting and the same spending every year. Invented, as every qa household.
import { emptyPlan } from "../../core/schema/migrate.js";

export function widowPlan() {
  const p = emptyPlan();
  p.household.people.push({ id: "p-ruth", name: "Ruth", role: "self", birthDate: "1952-03-15", retirementAge: 74, lifeExpectancy: null });
  p.household.filingStatus = "single"; p.household.state = "FL";
  p.accounts.push(
    { id: "a-chk", name: "Checking", type: "checking", balance: 12000, asOf: "2026-11-06", ownerId: "" },
    { id: "a-ira", name: "Ruth's retirement", type: "ira", balance: 410000, asOf: "2026-11-06", ownerId: "p-ruth" },
    { id: "a-home", name: "Home", type: "property", balance: 380000, asOf: "2026-11-06", ownerId: "" },
  );
  p.income.push(
    { id: "i-pen", name: "Ruth's pension", type: "pension", personId: "p-ruth", amount: 1900, period: "monthly", growth: 0, taxable: true },
    { id: "i-ss", name: "Ruth's Social Security", type: "social", personId: "p-ruth", amount: 2300, period: "monthly", growth: 0, taxable: true },
  );
  const line = (id, name, category, amount, essential = true) => ({ id, name, category, essential, period: "monthly", inflates: true, amount });
  p.expenses.push(
    line("x-rent", "Rent", "housing", 700), line("x-util", "Utilities and phone", "utilities", 350), line("x-food", "Groceries", "groceries", 500),
    line("x-car", "Car, gas and transit", "transport", 300), line("x-ins", "Insurance and health", "insurance", 500),
    line("x-fun", "Eating out and fun", "dining", 250, false), line("x-shop", "Shopping and everything else", "shopping", 400, false),
  );
  Object.assign(p.retirement, { taxMode: "flat", taxRate: 0.15, strategy: "fixed-real", withdrawalRate: 0.04, socialSecurity: { "p-ruth": { claimAge: 65, monthlyAtFRA: 2464.3 } } });
  p.guide = { ...(p.guide ?? {}), setup: { status: { "p-ruth": "retired" }, ss: { "p-ruth": "getting" }, at: "done" } };
  return p;
}
