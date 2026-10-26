// qa/flows/seed-warnings.js -- a household built to trip every warning path at once:
// two people marked "Me", three adults filing Single, someone born in 1900, a baby born today,
// a retirement age past the plan's end age, someone turning exactly 65 today, an income with a
// 30% raise, one that ends before it starts, zero amounts, spending above income, a card whose
// payment does not cover its interest, a goal with a negative amount, one past due, one behind
// with nothing going in, and an account with no "as of" date. Sandbox only.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("sandbox only");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox") || "null") || { schemaVersion: 1 };
Object.assign(plan, {
  household: {
    people: [
      { id: "p-al", name: "Al", role: "self", birthDate: "1961-09-15" },
      { id: "p-bea", name: "Bea", role: "self", birthDate: "1900-01-01" },
      { id: "p-cal", name: "Cal", role: "partner", birthDate: "1980-03-01", retirementAge: 90, lifeExpectancy: 85 },
      { id: "p-dot", name: "Dot", role: "dependent", birthDate: "2026-09-15" },
    ],
    filingStatus: "single", state: "NY",
  },
  accounts: [
    { id: "a-chk", name: "No-date checking", type: "checking", balance: 1000, asOf: "", ownerId: "", history: [] },
    { id: "a-card", name: "Store card", type: "credit", balance: 10000, asOf: "2026-09-15", ownerId: "", history: [] },
  ],
  income: [
    { id: "i-al", name: "Al's pay", type: "salary", personId: "p-al", amount: 5000, period: "monthly", growth: 0.3, taxable: true },
    { id: "i-bad", name: "Bad dates", type: "other", personId: "", amount: 1000, period: "monthly", growth: 0, taxable: true, startDate: "2026-05-01", endDate: "2026-04-01" },
    { id: "i-zero", name: "Zero income", type: "other", personId: "", amount: 0, period: "monthly", growth: 0, taxable: true },
  ],
  expenses: [
    { id: "e-rent", name: "Rent", category: "housing", amount: 4000, period: "monthly", essential: true, inflates: true },
    { id: "e-groc", name: "Groceries", category: "groceries", amount: 1500, period: "monthly", essential: true, inflates: true },
    { id: "e-zero", name: "Zero expense", category: "other", amount: 0, period: "monthly", essential: false, inflates: true },
  ],
  debts: [
    { id: "d-card", accountId: "a-card", rate: 0.24, minPayment: 150, extra: 0 },
  ],
  goals: [
    { id: "g-silent", name: "Silent goal", icon: "🎯", target: 20000, targetDate: "2028-09-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false },
    { id: "g-neg", name: "Negative goal", icon: "🎯", target: -500, targetDate: "", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false },
    { id: "g-late", name: "Late goal", icon: "🎯", target: 5000, targetDate: "2025-01-01", priority: 1, saved: 100, fundedBy: [], monthly: 50, rate: null, inflates: false },
  ],
});
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { seeded: true };
