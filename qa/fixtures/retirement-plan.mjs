// qa/fixtures/retirement-plan.mjs -- a couple in their late fifties with retirement accounts,
// contributions, a pension and a Social Security figure, for the Phase 5 tests.
import { emptyPlan } from "../../core/schema/migrate.js";

export function retirementPlan() {
  const p = emptyPlan();
  p.household.people.push(
    { id: "sam", name: "Sam", role: "self", birthDate: "1968-04-10", retirementAge: 65 },   // 58 in 2026, retires 2033
    { id: "lee", name: "Lee", role: "partner", birthDate: "1970-08-22", retirementAge: 67 },  // 56 in 2026, retires 2037
  );
  p.accounts.push(
    { id: "chk", name: "Checking", type: "checking", balance: 12000 },
    { id: "sav", name: "Savings", type: "savings", balance: 40000 },
    { id: "brk", name: "Brokerage", type: "brokerage", balance: 150000 },
    { id: "k401", name: "Sam's 401(k)", type: "401k", balance: 520000 },
    { id: "ira", name: "Lee's IRA", type: "ira", balance: 210000 },
    { id: "roth", name: "Sam's Roth", type: "roth", balance: 90000 },
    { id: "home", name: "House", type: "property", balance: 450000 },
  );
  p.income.push({ id: "i1", name: "Sam's salary", type: "salary", personId: "sam", amount: 8000, period: "monthly", growth: 0.03 }, { id: "i2", name: "Lee's salary", type: "salary", personId: "lee", amount: 5500, period: "monthly", growth: 0.03 });
  p.expenses.push({ id: "e1", name: "Everything", category: "other", amount: 7000, period: "monthly", essential: true });
  p.retirement.spendingMonthly = 6500;
  p.retirement.contributions.push({ id: "c1", accountId: "k401", personId: "sam", amount: 1500, period: "monthly", employerMatch: 6000 }, { id: "c2", accountId: "roth", personId: "sam", amount: 7000, period: "annual", employerMatch: 0 }, { id: "c3", accountId: "ira", personId: "lee", amount: 7000, period: "annual", employerMatch: 0 });
  p.retirement.socialSecurity = { sam: { claimAge: 67, monthlyAtFRA: 2800 }, lee: { claimAge: 67, monthlyAtFRA: 2100 } };
  p.retirement.pensions.push({ id: "pn1", personId: "lee", name: "Lee's state pension", monthly: 900, startAge: 67, cola: true });
  return p;
}
