// qa/fixtures/renter-debt-plan.mjs -- an invented single renter of 24 in Ohio on $39,000 a year, with three cards near
// their limits, a car loan, $1,000 in the bank and a saved debt plan of $50 extra a month, highest rate first: the round-8
// tester's household (2026-11-06), as Get started leaves it, for the debt pages', the ratios' and the score's tests.
import { emptyPlan } from "../../core/schema/migrate.js";

export function renterDebtPlan() {
  const p = emptyPlan();
  p.household = { people: [{ id: "setup-self", name: "Riley", role: "self", birthDate: "2002-03-15", retirementAge: null, lifeExpectancy: null }], filingStatus: "single", state: "OH" };
  const acct = (id, name, type, balance) => ({ id, name, type, institution: "", asOf: "2026-11-06", ownerId: "", history: [], notes: "", balance });
  p.accounts.push(
    acct("setup-have-checking", "Checking", "checking", 400), acct("setup-have-savings", "Savings", "savings", 600), acct("setup-have-car", "Car", "vehicle", 12000),
    acct("setup-owe-credit", "Visa card", "credit", 4500), acct("setup-owe-car-loan", "Car loan", "loan", 14000),
    acct("mc", "Mastercard", "credit", 3300), acct("store", "Store card", "credit", 2000), acct("k401", "Work 401(k)", "401k", 0),
  );
  const debt = (id, accountId, rate, minPayment, creditLimit) => ({ id, accountId, rate, minPayment, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit });
  p.debts.push(debt("setup-debt-credit", "setup-owe-credit", 0.29, 150, 5000), debt("setup-debt-car-loan", "setup-owe-car-loan", 0.09, 350, null),
    debt("d-mc", "mc", 0.24, 100, 4000), debt("d-store", "store", 0.27, 70, 2500));
  p.debtPlan = { extra: 50, order: "avalanche" };
  p.income.push({ id: "setup-pay-setup-self", name: "Riley's pay", personId: "setup-self", type: "salary", amount: 39000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true });
  const x = (id, name, category, amount, essential = true) => ({ id, name, category, essential, period: "monthly", inflates: true, startDate: "", endDate: "", amount });
  p.expenses.push(x("setup-x-housing", "Rent", "housing", 950), x("setup-x-utilities", "Utilities and phone", "utilities", 180), x("setup-x-groceries", "Groceries", "groceries", 300),
    x("setup-x-transport", "Car, gas and transit", "transport", 250), x("setup-x-insurance", "Insurance and health", "insurance", 60), x("setup-x-dining", "Eating out and fun", "dining", 150, false),
    x("setup-x-shopping", "Shopping and everything else", "shopping", 150, false));
  p.goals.push({ id: "setup-goal-cushion", name: "Emergency fund", icon: "🛟", target: 14500, targetDate: "", priority: 1, saved: 0, fundedBy: ["setup-have-checking", "setup-have-savings"], monthly: 0, rate: null, inflates: false, isEmergencyFund: true });
  p.retirement = { ...p.retirement, spendingMonthly: 2040, stocksNow: 0.7, stocksRetired: 0.5, taxRate: 0.15, strategy: "fixed-real", withdrawalRate: 0.04, contributions: [], socialSecurity: { "setup-self": { monthlyAtFRA: 1817 } } };
  p.assumptions = { ...p.assumptions, emergencyMonths: 6 };
  p.guide = { setup: { at: "done", startedAt: "2026-11-06", finishedAt: "2026-11-06", who: "me", status: { "setup-self": "work" } } };
  p.whatIfs = { benefits: { "setup-self": { matchTiers: [{ rate: 1, upTo: 0.03 }], paychecks: 26, planYear: 2027 } } };
  return p;
}

/**
 * The same renter with the car loan paid off and $400 a month extra on the Visa card (the Debts page's extra): $320 of
 * required card payments, $720 paid. Round 8 review (2026-11-06): a home lender counts the required $320, not what is chosen
 * on top (Fannie Mae B3-6-05), so the renter's share is 9.8%, not 22%.
 */
export function renterPayingExtraPlan() {
  const p = renterDebtPlan();
  p.accounts = p.accounts.filter((a) => a.id !== "setup-owe-car-loan");
  p.debts = p.debts.filter((d) => d.accountId !== "setup-owe-car-loan");
  p.debts.find((d) => d.id === "setup-debt-credit").extra = 400;
  return p;
}
