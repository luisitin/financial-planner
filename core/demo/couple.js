// core/demo/couple.js -- "A couple near retirement": both still working, a few years from stopping, large retirement
// accounts, a house that is nearly paid off and a small home-equity loan. Everything is invented. Copied from the test
// household qa/households/09-near-retirement/base/H-0801-base.md (MIT like the rest of the repo); added here so the
// retirement pages have something to show: what they put in each month, what Social Security wrote on their
// statements, and what they expect to spend. Every date and age is worked out from `today`.
import { emptyPlan } from "../schema/migrate.js";
import { bornOn, monthsFrom } from "./names.js";

export function couple(today) {
  const p = emptyPlan();
  const acct = (id, name, type, balance, ownerId = "") => ({ id, name, type, institution: "", balance, asOf: today, ownerId, history: [] });
  p.meta.name = "A pretend couple";
  p.household = {
    people: [
      { id: "p-gloria", name: "Gloria", role: "self", birthDate: bornOn(today, 61, 7, 14), retirementAge: 65 },
      { id: "p-frank", name: "Frank", role: "partner", birthDate: bornOn(today, 63, 3, 28), retirementAge: 66 },
    ],
    filingStatus: "married_joint", state: "NC",
  };
  p.accounts = [
    acct("a-chk", "Checking", "checking", 9500),
    acct("a-sav", "Savings", "savings", 38000),
    acct("a-brk", "Brokerage", "brokerage", 180000),
    acct("a-401g", "Gloria's 401(k)", "401k", 410000, "p-gloria"),
    acct("a-401f", "Frank's 401(k)", "401k", 520000, "p-frank"),
    acct("a-ira", "Frank's rollover IRA", "ira", 130000, "p-frank"),
    acct("a-roth", "Gloria's Roth IRA", "roth", 60000, "p-gloria"),
    acct("a-home", "House", "property", 610000),
    acct("a-car", "Two cars", "vehicle", 38000),
    acct("a-mort", "Mortgage (almost done)", "mortgage", 45000),
    acct("a-heloc", "Home-equity loan", "other_liability", 12000),
  ];
  p.income = [
    { id: "i-gloria", name: "Gloria's salary", type: "salary", personId: "p-gloria", amount: 6200, period: "monthly", growth: 0.02, taxable: true },
    { id: "i-frank", name: "Frank's salary", type: "salary", personId: "p-frank", amount: 7100, period: "monthly", growth: 0.02, taxable: true },
  ];
  p.expenses = [
    { id: "e-mort", name: "Mortgage payment", category: "housing", amount: 1100, period: "monthly", essential: true, inflates: false },
    { id: "e-util", name: "Utilities", category: "utilities", amount: 260, period: "monthly", essential: true, inflates: true },
    { id: "e-groc", name: "Groceries", category: "groceries", amount: 180, period: "weekly", essential: true, inflates: true },
    { id: "e-gas", name: "Gas", category: "transport", amount: 230, period: "monthly", essential: true, inflates: true },
    { id: "e-ins", name: "Insurance", category: "insurance", amount: 1400, period: "quarterly", essential: true, inflates: true },
    { id: "e-health", name: "Health premiums", category: "health", amount: 640, period: "monthly", essential: true, inflates: true },
    { id: "e-phone", name: "Phones", category: "phone", amount: 120, period: "monthly", essential: true, inflates: true },
    { id: "e-heloc", name: "Home-equity loan payment", category: "debt", amount: 150, period: "monthly", essential: true, inflates: false },
    { id: "e-sub", name: "Subscriptions", category: "subscriptions", amount: 60, period: "monthly", essential: false, inflates: true },
    { id: "e-din", name: "Eating out", category: "dining", amount: 400, period: "monthly", essential: false, inflates: true },
    { id: "e-trav", name: "Travel", category: "travel", amount: 8000, period: "annual", essential: false, inflates: true },
    { id: "e-give", name: "Giving", category: "giving", amount: 250, period: "monthly", essential: false, inflates: true },
  ];
  p.debts = [
    { id: "d-mort", accountId: "a-mort", rate: 0.0325, minPayment: 1100, extra: 0, termMonths: 180, startDate: monthsFrom(today, -136), securedBy: "the house" },
    { id: "d-heloc", accountId: "a-heloc", rate: 0.085, minPayment: 150, extra: 0 },
  ];
  p.goals = [
    { id: "g-retire", name: "Cash for the first retired year", icon: "🛟", target: 120000, targetDate: monthsFrom(today, 46, 14), priority: 1, saved: 0, fundedBy: ["a-sav"], monthly: 1500, rate: null, inflates: false },
    { id: "g-rv", name: "Camper van for the first year", icon: "🚐", target: 70000, targetDate: monthsFrom(today, 47), priority: 2, saved: 15000, fundedBy: [], monthly: 800, rate: 0.04, inflates: true },
  ];
  p.retirement.spendingMonthly = 6500;
  p.retirement.contributions = [
    { id: "c-gloria", accountId: "a-401g", personId: "p-gloria", amount: 1200, period: "monthly", employerMatch: 3700 },
    { id: "c-frank", accountId: "a-401f", personId: "p-frank", amount: 1500, period: "monthly", employerMatch: 4200 },
  ];
  p.retirement.socialSecurity = { "p-gloria": { claimAge: 67, monthlyAtFRA: 2500 }, "p-frank": { claimAge: 67, monthlyAtFRA: 2900 } };
  return p;
}
