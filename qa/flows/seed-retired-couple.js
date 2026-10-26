// qa/flows/seed-retired-couple.js -- Ruth (72, retired early at 62, plan to 100) and Sam (69,
// retires at 70 next year, plan to 90). Income from Social Security, a pension paid twice a
// month, quarterly dividends, rent with a 2% raise, a one-off inheritance, one income that has
// ended and one that has not started. Expenses with weekly/quarterly/annual periods, a one-off
// repair and an ended mortgage payment. One credit card with a rate. Three goals: behind,
// done, and undated, plus one pointing at a deleted account. Sandbox only.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("sandbox only");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox") || "null") || { schemaVersion: 1 };
Object.assign(plan, {
  household: {
    people: [
      { id: "p-ruth", name: "Ruth", role: "self", birthDate: "1954-03-10", retirementAge: 62, lifeExpectancy: 100 },
      { id: "p-sam", name: "Sam", role: "partner", birthDate: "1957-06-20", retirementAge: 70, lifeExpectancy: 90 },
    ],
    filingStatus: "married_joint", state: "AZ",
  },
  accounts: [
    { id: "a-chk", name: "Joint checking", type: "checking", balance: 8000, asOf: "2026-09-15", ownerId: "", history: [] },
    { id: "a-sav", name: "Joint savings", type: "savings", balance: 45000, asOf: "2026-09-15", ownerId: "", history: [] },
    { id: "a-brk", name: "Brokerage", type: "brokerage", balance: 120000, asOf: "2026-09-15", ownerId: "", history: [] },
    { id: "a-ira", name: "Ruth's IRA", type: "ira", balance: 310000, asOf: "2026-09-15", ownerId: "Ruth", history: [] },
    { id: "a-roth", name: "Sam's Roth", type: "roth", balance: 60000, asOf: "2026-09-15", ownerId: "Sam", history: [] },
    { id: "a-home", name: "House", type: "property", balance: 520000, asOf: "2026-09-15", ownerId: "", history: [] },
    { id: "a-car", name: "Car", type: "vehicle", balance: 12000, asOf: "2026-09-15", ownerId: "", history: [] },
    { id: "a-visa", name: "Visa", type: "credit", balance: 2300, asOf: "2026-09-15", ownerId: "", history: [] },
  ],
  income: [
    { id: "i-ss", name: "Ruth's Social Security", type: "social", personId: "p-ruth", amount: 2100, period: "monthly", growth: 0, taxable: true },
    { id: "i-pen", name: "Sam's pension", type: "pension", personId: "p-sam", amount: 750, period: "semimonthly", growth: 0, taxable: true },
    { id: "i-div", name: "Dividends", type: "investment", personId: "", amount: 1200, period: "quarterly", growth: 0, taxable: true },
    { id: "i-rent", name: "Rental duplex", type: "rental", personId: "p-sam", amount: 2000, period: "monthly", growth: 0.02, taxable: true },
    { id: "i-inh", name: "Inheritance", type: "other", personId: "p-ruth", amount: 15000, period: "once", growth: 0, taxable: false },
    { id: "i-old", name: "Sam's old salary", type: "salary", personId: "p-sam", amount: 6000, period: "monthly", growth: 0, taxable: true, endDate: "2025-12-31" },
    { id: "i-next", name: "Consulting (starts next year)", type: "business", personId: "p-ruth", amount: 900, period: "monthly", growth: 0, taxable: true, startDate: "2027-01-01" },
  ],
  expenses: [
    { id: "e-tax", name: "Property tax", category: "taxes", amount: 4800, period: "annual", essential: true, inflates: true },
    { id: "e-groc", name: "Groceries", category: "groceries", amount: 150, period: "weekly", essential: true, inflates: true },
    { id: "e-med", name: "Medicare premiums", category: "health", amount: 370, period: "monthly", essential: true, inflates: true },
    { id: "e-util", name: "Utilities", category: "utilities", amount: 210, period: "monthly", essential: true, inflates: true },
    { id: "e-ins", name: "Home and car insurance", category: "insurance", amount: 1200, period: "quarterly", essential: true, inflates: true },
    { id: "e-trav", name: "Travel", category: "travel", amount: 6000, period: "annual", essential: false, inflates: true },
    { id: "e-din", name: "Eating out", category: "dining", amount: 250, period: "monthly", essential: false, inflates: true },
    { id: "e-gift", name: "Gifts", category: "giving", amount: 100, period: "monthly", essential: false, inflates: false },
    { id: "e-roof", name: "Roof repair", category: "other", amount: 8000, period: "once", essential: false, inflates: false },
    { id: "e-mort", name: "Old mortgage payment", category: "housing", amount: 1500, period: "monthly", essential: true, inflates: false, endDate: "2024-06-30" },
  ],
  debts: [
    { id: "d-visa", accountId: "a-visa", rate: 0.219, minPayment: 75, extra: 0 },
  ],
  goals: [
    { id: "g-trip", name: "Grandkids' trip", icon: "✈️", target: 12000, targetDate: "2027-06-01", priority: 2, saved: 3000, fundedBy: [], monthly: 500, rate: null, inflates: false },
    { id: "g-car", name: "New car", icon: "🚗", target: 20000, targetDate: "2028-01-01", priority: 3, saved: 20000, fundedBy: [], monthly: 0, rate: null, inflates: false },
    { id: "g-boat", name: "Someday boat", icon: "⛵", target: 50000, targetDate: "", priority: 3, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false },
    { id: "g-ghost", name: "Roof fund", icon: "🏠", target: 10000, targetDate: "2027-03-01", priority: 1, saved: 0, fundedBy: ["a-deleted"], monthly: 200, rate: null, inflates: false },
  ],
});
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { seeded: true };
