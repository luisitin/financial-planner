// qa/fixtures/family-plan.mjs -- the sample household from qa/flows/seed-sample.js (Ana, Bo and
// their child Cy: two salaries, a mortgage, a card, a car loan, four goals) made whole for the
// Phase 9 pages: retirement contributions, Social Security figures, loan details, retirement
// spending. All invented. Runs in Node (tests) and in the browser (qa/flows/seed-family.js
// imports it to fill the sandbox), so it uses nothing but the plan shape.
import { emptyPlan } from "../../core/schema/migrate.js";

/** familyPlan(today = "2026-10-30") -> a complete plan; balances are dated `today`. */
export function familyPlan(today = "2026-10-30") {
  const p = emptyPlan();
  const year = Number(today.slice(0, 4));
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  p.meta.name = "Ana and Bo";
  p.household = {
    people: [
      { id: "p-ana", name: "Ana", role: "self", birthDate: "1990-05-20", retirementAge: 65 },
      { id: "p-bo", name: "Bo", role: "partner", birthDate: "1988-11-02", retirementAge: 62 },
      { id: "p-cy", name: "Cy", role: "dependent", birthDate: "2020-03-03" },
    ],
    filingStatus: "married_joint", state: "TX",
  };
  p.accounts = [
    { id: "a-chk", name: "Chase checking", type: "checking", institution: "Chase", balance: 4200, asOf: today, ownerId: "", history: [] },
    { id: "a-sav", name: "Ally savings", type: "savings", institution: "Ally", balance: 11500, asOf: today, ownerId: "", history: [] },
    { id: "a-401", name: "Ana's 401(k)", type: "401k", institution: "Fidelity", balance: 86000, asOf: today, ownerId: "p-ana", history: [] },
    { id: "a-roth", name: "Bo's Roth IRA", type: "roth", institution: "Vanguard", balance: 31000, asOf: today, ownerId: "p-bo", history: [] },
    { id: "a-bk401", name: "Bo's old 401(k)", type: "401k", institution: "Empower", balance: 42000, asOf: today, ownerId: "p-bo", history: [] },
    { id: "a-brk", name: "Brokerage", type: "brokerage", institution: "Schwab", balance: 18000, asOf: today, ownerId: "", history: [] },
    { id: "a-home", name: "House", type: "property", balance: 380000, asOf: today, ownerId: "", history: [] },
    { id: "a-mort", name: "Mortgage", type: "mortgage", institution: "Wells Fargo", balance: 265000, asOf: today, ownerId: "", history: [] },
    { id: "a-visa", name: "Visa card", type: "credit", institution: "Chase", balance: 6400, asOf: today, ownerId: "", history: [] },
    { id: "a-car", name: "Car loan", type: "loan", institution: "Toyota Financial", balance: 14200, asOf: today, ownerId: "", history: [] },
  ];
  p.income = [
    { id: "i-ana", name: "Ana's salary", type: "salary", personId: "p-ana", amount: 3900, period: "biweekly", growth: 0.03, taxable: true },
    { id: "i-bo", name: "Bo's salary", type: "salary", personId: "p-bo", amount: 5200, period: "monthly", growth: 0.03, taxable: true },
    { id: "i-side", name: "Weekend photography", type: "business", personId: "p-bo", amount: 600, period: "monthly", growth: 0, taxable: true },
  ];
  p.expenses = [
    { id: "e-mort", name: "Mortgage payment", category: "housing", amount: 1980, period: "monthly", essential: true, inflates: false },
    { id: "e-util", name: "Electric, water, gas", category: "utilities", amount: 260, period: "monthly", essential: true, inflates: true },
    { id: "e-groc", name: "Groceries", category: "groceries", amount: 220, period: "weekly", essential: true, inflates: true },
    { id: "e-car", name: "Car payment", category: "debt", amount: 410, period: "monthly", essential: true, inflates: false },
    { id: "e-gas", name: "Gas and tolls", category: "transport", amount: 180, period: "monthly", essential: true, inflates: true },
    { id: "e-ins", name: "Car and home insurance", category: "insurance", amount: 540, period: "quarterly", essential: true, inflates: true },
    { id: "e-day", name: "Daycare", category: "childcare", amount: 1150, period: "monthly", essential: true, inflates: true, endDate: iso(2026, 8, 31) },
    { id: "e-school", name: "After-school care", category: "childcare", amount: 450, period: "monthly", essential: true, inflates: true, startDate: iso(2026, 9, 1) },
    { id: "e-phone", name: "Phones and internet", category: "phone", amount: 165, period: "monthly", essential: true, inflates: true },
    { id: "e-stream", name: "Streaming", category: "subscriptions", amount: 48, period: "monthly", essential: false, inflates: false },
    { id: "e-eat", name: "Eating out", category: "dining", amount: 350, period: "monthly", essential: false, inflates: true },
    { id: "e-fun", name: "Weekend stuff", category: "fun", amount: 200, period: "monthly", essential: false, inflates: true },
    { id: "e-trip", name: "Summer trip", category: "travel", amount: 3000, period: "annual", essential: false, inflates: true },
  ];
  p.debts = [
    { id: "d-mort", accountId: "a-mort", rate: 0.0625, minPayment: 1980, extra: 0, termMonths: 360, startDate: "2022-06-01", securedBy: "the house" },
    { id: "d-visa", accountId: "a-visa", rate: 0.239, minPayment: 190, extra: 210, creditLimit: 15000 },
    { id: "d-car", accountId: "a-car", rate: 0.059, minPayment: 410, extra: 0, termMonths: 60, startDate: "2024-03-01" },
  ];
  p.goals = [
    { id: "g-ef", name: "Emergency fund", icon: "🛟", target: 20000, targetDate: iso(year + 1, 6, 30), priority: 1, saved: 0, fundedBy: ["a-sav"], monthly: 400, rate: null, inflates: false },
    { id: "g-car", name: "Replace Bo's car", icon: "🚗", target: 25000, targetDate: iso(year + 3, 3, 1), priority: 2, saved: 3500, fundedBy: [], monthly: 300, rate: null, inflates: true },
    { id: "g-col", name: "Cy's college", icon: "🎓", target: 90000, targetDate: iso(2038, 8, 15), priority: 2, saved: 4000, fundedBy: [], monthly: 250, rate: 0.06, inflates: true },
    { id: "g-trip", name: "Japan trip", icon: "✈️", target: 8000, targetDate: iso(year + 1, 10, 1), priority: 3, saved: 1200, fundedBy: [], monthly: 0, rate: null, inflates: false },
  ];
  p.retirement.spendingMonthly = 7000;
  p.retirement.contributions = [
    { id: "c-ana", accountId: "a-401", personId: "p-ana", amount: 470, period: "biweekly", employerMatch: 3050 },
    { id: "c-bo", accountId: "a-roth", personId: "p-bo", amount: 300, period: "monthly", employerMatch: 0 },
  ];
  p.retirement.socialSecurity = { "p-ana": { claimAge: 67, monthlyAtFRA: 2650 }, "p-bo": { claimAge: 67, monthlyAtFRA: 2900 } };
  p.netWorthHistory = [{ date: iso(year, 1, 1), assets: 548000, liabilities: 291000, netWorth: 257000 }];
  return p;
}
