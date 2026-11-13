// core/demo/family.js -- "A family with children": two working parents, two children, a mortgage, a car loan and a
// credit card. Everything is invented. Copied from the repo's own sample family (qa/fixtures/family-plan.mjs and
// qa/fixtures/demo-household.mjs, MIT like the rest of the repo) with the bank names taken out and every date and age
// worked out from `today`, so the family is the same age whenever it is opened.
import { emptyPlan } from "../schema/migrate.js";
import { bornOn, monthsFrom, iso } from "./names.js";

export function family(today) {
  const p = emptyPlan();
  const year = Number(today.slice(0, 4));
  const acct = (id, name, type, balance, ownerId = "") => ({ id, name, type, institution: "", balance, asOf: today, ownerId, history: [] });
  p.meta.name = "A pretend family";
  const cy = bornOn(today, 6, 3, 3);
  p.household = {
    people: [
      { id: "p-ana", name: "Ana", role: "self", birthDate: bornOn(today, 36, 5, 20), retirementAge: 65 },
      { id: "p-bo", name: "Bo", role: "partner", birthDate: bornOn(today, 38, 11, 2), retirementAge: 62 },
      { id: "p-dee", name: "Dee", role: "dependent", birthDate: bornOn(today, 9, 9, 12) },
      { id: "p-cy", name: "Cy", role: "dependent", birthDate: cy },
    ],
    filingStatus: "married_joint", state: "TX",
  };
  p.accounts = [
    acct("a-chk", "Checking", "checking", 4200),
    acct("a-sav", "Savings", "savings", 11500),
    acct("a-401", "Ana's 401(k)", "401k", 86000, "p-ana"),
    acct("a-roth", "Bo's Roth IRA", "roth", 31000, "p-bo"),
    acct("a-bk401", "Bo's old 401(k)", "401k", 42000, "p-bo"),
    acct("a-brk", "Brokerage", "brokerage", 18000),
    acct("a-home", "House", "property", 380000),
    acct("a-car1", "Family car", "vehicle", 21000),
    acct("a-car2", "Bo's truck", "vehicle", 14500, "p-bo"),
    acct("a-mort", "Mortgage", "mortgage", 265000),
    acct("a-visa", "Credit card", "credit", 6400),
    acct("a-car", "Car loan", "loan", 14200),
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
    { id: "e-school", name: "After-school care", category: "childcare", amount: 450, period: "monthly", essential: true, inflates: true },
    { id: "e-phone", name: "Phones and internet", category: "phone", amount: 165, period: "monthly", essential: true, inflates: true },
    { id: "e-stream", name: "Streaming", category: "subscriptions", amount: 48, period: "monthly", essential: false, inflates: false },
    { id: "e-eat", name: "Eating out", category: "dining", amount: 350, period: "monthly", essential: false, inflates: true },
    { id: "e-fun", name: "Weekend stuff", category: "fun", amount: 200, period: "monthly", essential: false, inflates: true },
    { id: "e-trip", name: "Summer trip", category: "travel", amount: 3000, period: "annual", essential: false, inflates: true },
  ];
  // each loan's start is set so that the months left on its term are the months its balance, rate and payment take
  // (the qa fixture's dates did not agree with its balances; tests/demo.test.mjs checks every pretend loan)
  p.debts = [
    { id: "d-mort", accountId: "a-mort", rate: 0.0625, minPayment: 1980, extra: 0, termMonths: 360, startDate: monthsFrom(today, -130), securedBy: "the house" },
    { id: "d-visa", accountId: "a-visa", rate: 0.239, minPayment: 190, extra: 210, creditLimit: 15000 },
    { id: "d-car", accountId: "a-car", rate: 0.059, minPayment: 410, extra: 0, termMonths: 60, startDate: monthsFrom(today, -22) },
  ];
  p.goals = [
    { id: "g-ef", name: "Emergency fund", icon: "🛟", target: 20000, targetDate: monthsFrom(today, 8, 28), priority: 1, saved: 0, fundedBy: ["a-sav"], monthly: 400, rate: null, inflates: false },
    { id: "g-car", name: "Replace Bo's truck", icon: "🚗", target: 25000, targetDate: monthsFrom(today, 28), priority: 2, saved: 3500, fundedBy: [], monthly: 300, rate: null, inflates: true },
    { id: "g-col", name: "Cy's college", icon: "🎓", target: 90000, targetDate: iso(Number(cy.slice(0, 4)) + 18, 8, 15), priority: 2, saved: 4000, fundedBy: [], monthly: 250, rate: 0.06, inflates: true },
    { id: "g-trip", name: "Japan trip", icon: "✈️", target: 8000, targetDate: monthsFrom(today, 11), priority: 3, saved: 1200, fundedBy: [], monthly: 0, rate: null, inflates: false },
  ];
  p.retirement.spendingMonthly = 7000;
  p.retirement.contributions = [
    { id: "c-ana", accountId: "a-401", personId: "p-ana", amount: 470, period: "biweekly", employerMatch: 3050 },
    { id: "c-bo", accountId: "a-roth", personId: "p-bo", amount: 300, period: "monthly", employerMatch: 0 },
  ];
  p.retirement.socialSecurity = { "p-ana": { claimAge: 67, monthlyAtFRA: 2650 }, "p-bo": { claimAge: 67, monthlyAtFRA: 2900 } };
  p.netWorthHistory = [{ date: iso(year, 1, 1), assets: 583500, liabilities: 291000, netWorth: 292500 }];
  return p;
}
