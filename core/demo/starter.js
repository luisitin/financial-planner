// core/demo/starter.js -- "Someone starting out": one person in a first job, sharing a flat, with student loans, a
// credit card and a small start on saving. Everything is invented. Copied from the test household
// qa/households/10-student-and-starter/base/H-0901-base.md (MIT like the rest of the repo); added here: what goes into
// the 401(k) each payday. Every date and age is worked out from `today`.
import { emptyPlan } from "../schema/migrate.js";
import { bornOn, monthsFrom } from "./names.js";

export function starter(today) {
  const p = emptyPlan();
  const acct = (id, name, type, balance, ownerId = "") => ({ id, name, type, institution: "", balance, asOf: today, ownerId, history: [] });
  p.meta.name = "A pretend person";
  p.household = { people: [{ id: "p-jordan", name: "Jordan", role: "self", birthDate: bornOn(today, 24, 10, 9), retirementAge: 67 }], filingStatus: "single", state: "IL" };
  p.accounts = [
    acct("a-chk", "Checking", "checking", 900),
    acct("a-sav", "Savings", "savings", 1200),
    acct("a-401k", "401(k)", "401k", 2100, "p-jordan"),
    acct("a-fed", "Federal student loans", "student_loan", 31000),
    acct("a-priv", "Private student loan", "student_loan", 9000),
    acct("a-visa", "Credit card", "credit", 2600),
  ];
  p.income = [
    { id: "i-pay", name: "Jordan's pay", type: "salary", personId: "p-jordan", amount: 1900, period: "biweekly", growth: 0.05, taxable: true },
    { id: "i-gig", name: "Weekend bartending", type: "business", personId: "p-jordan", amount: 300, period: "monthly", growth: 0, taxable: true },
  ];
  p.expenses = [
    { id: "e-rent", name: "Rent (share)", category: "housing", amount: 900, period: "monthly", essential: true, inflates: true },
    { id: "e-util", name: "Utilities (share)", category: "utilities", amount: 60, period: "monthly", essential: true, inflates: true },
    { id: "e-groc", name: "Groceries", category: "groceries", amount: 75, period: "weekly", essential: true, inflates: true },
    { id: "e-loan", name: "Student loan payments", category: "debt", amount: 440, period: "monthly", essential: true, inflates: false },
    { id: "e-transit", name: "Transit pass", category: "transport", amount: 90, period: "monthly", essential: true, inflates: true },
    { id: "e-ins", name: "Renter's insurance", category: "insurance", amount: 40, period: "monthly", essential: true, inflates: true },
    { id: "e-phone", name: "Phone", category: "phone", amount: 55, period: "monthly", essential: true, inflates: true },
    { id: "e-sub", name: "Subscriptions", category: "subscriptions", amount: 35, period: "monthly", essential: false, inflates: true },
    { id: "e-din", name: "Eating out", category: "dining", amount: 260, period: "monthly", essential: false, inflates: true },
    { id: "e-fun", name: "Going out", category: "fun", amount: 150, period: "monthly", essential: false, inflates: true },
  ];
  p.debts = [
    { id: "d-fed", accountId: "a-fed", rate: 0.055, minPayment: 320, extra: 0 },
    { id: "d-priv", accountId: "a-priv", rate: 0.099, minPayment: 120, extra: 0 },
    { id: "d-visa", accountId: "a-visa", rate: 0.269, minPayment: 80, extra: 0 },
  ];
  p.goals = [
    { id: "g-ef", name: "Emergency fund", icon: "🛟", target: 5000, targetDate: monthsFrom(today, 12), priority: 1, saved: 0, fundedBy: ["a-sav"], monthly: 150, rate: null, inflates: false },
    { id: "g-solo", name: "Move out on my own", icon: "🏠", target: 3000, targetDate: monthsFrom(today, 6), priority: 2, saved: 400, fundedBy: [], monthly: 100, rate: null, inflates: false },
  ];
  p.retirement.contributions = [{ id: "c-jordan", accountId: "a-401k", personId: "p-jordan", amount: 76, period: "biweekly", employerMatch: 1480 }];
  return p;
}
