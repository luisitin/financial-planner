// qa/flows/seed-sample.js -- put a small, realistic pretend household into the SANDBOX plan
// (this browser profile only), then let drive.mjs reload the page. Use it as the first
// --script and follow it with another --script or --eval that looks at the page:
//   node tools/drive.mjs goals/goals --script qa/flows/seed-sample.js --eval "return qa.pageText()" --shot goals-filled
// Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-sample.js only runs in the sandbox");
const today = new Date();
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const recent = iso(today.getFullYear(), today.getMonth() + 1, 1);
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox") || "null") || { schemaVersion: 1 };
Object.assign(plan, {
  household: { people: [
    { id: "p-ana", name: "Ana", role: "self", birthDate: "1990-05-20" },
    { id: "p-bo", name: "Bo", role: "partner", birthDate: "1988-11-02", retirementAge: 62 },
    { id: "p-cy", name: "Cy", role: "dependent", birthDate: "2020-03-03" },
  ], filingStatus: "married_joint", state: "TX" },
  accounts: [
    { id: "a-chk", name: "Chase checking", type: "checking", institution: "Chase", balance: 4200, asOf: recent, history: [] },
    { id: "a-sav", name: "Ally savings", type: "savings", institution: "Ally", balance: 11500, asOf: recent, history: [] },
    { id: "a-401", name: "Ana's 401(k)", type: "401k", institution: "Fidelity", balance: 86000, asOf: "2026-06-30", history: [] },
    { id: "a-roth", name: "Bo's Roth IRA", type: "roth", institution: "Vanguard", balance: 31000, asOf: recent, history: [] },
    { id: "a-brk", name: "Brokerage", type: "brokerage", institution: "Schwab", balance: 18000, asOf: recent, history: [] },
    { id: "a-home", name: "House", type: "property", balance: 380000, asOf: "2026-01-15", history: [] },
    { id: "a-mort", name: "Mortgage", type: "mortgage", institution: "Wells Fargo", balance: 265000, asOf: recent, history: [] },
    { id: "a-visa", name: "Visa card", type: "credit", institution: "Chase", balance: 6400, asOf: recent, history: [] },
    { id: "a-car", name: "Car loan", type: "loan", institution: "Toyota Financial", balance: 14200, asOf: recent, history: [] },
  ],
  income: [
    { id: "i-ana", name: "Ana's salary", type: "salary", personId: "p-ana", amount: 3900, period: "biweekly", growth: 0.03, taxable: true },
    { id: "i-bo", name: "Bo's salary", type: "salary", personId: "p-bo", amount: 5200, period: "monthly", growth: 0.03, taxable: true },
    { id: "i-side", name: "Weekend photography", type: "business", personId: "p-bo", amount: 600, period: "monthly", growth: 0, taxable: true },
  ],
  expenses: [
    { id: "e-mort", name: "Mortgage payment", category: "housing", amount: 1980, period: "monthly", essential: true, inflates: false },
    { id: "e-util", name: "Electric, water, gas", category: "utilities", amount: 260, period: "monthly", essential: true, inflates: true },
    { id: "e-groc", name: "Groceries", category: "groceries", amount: 220, period: "weekly", essential: true, inflates: true },
    { id: "e-car", name: "Car payment", category: "debt", amount: 410, period: "monthly", essential: true, inflates: false },
    { id: "e-gas", name: "Gas and tolls", category: "transport", amount: 180, period: "monthly", essential: true, inflates: true },
    { id: "e-ins", name: "Car and home insurance", category: "insurance", amount: 540, period: "quarterly", essential: true, inflates: true },
    { id: "e-day", name: "Daycare", category: "childcare", amount: 1150, period: "monthly", essential: true, inflates: true },
    { id: "e-phone", name: "Phones and internet", category: "phone", amount: 165, period: "monthly", essential: true, inflates: true },
    { id: "e-stream", name: "Streaming", category: "subscriptions", amount: 48, period: "monthly", essential: false, inflates: false },
    { id: "e-eat", name: "Eating out", category: "dining", amount: 350, period: "monthly", essential: false, inflates: true },
    { id: "e-fun", name: "Weekend stuff", category: "fun", amount: 200, period: "monthly", essential: false, inflates: true },
    { id: "e-trip", name: "Summer trip", category: "travel", amount: 3000, period: "annual", essential: false, inflates: true },
  ],
  debts: [
    { id: "d-mort", accountId: "a-mort", rate: 0.0625, minPayment: 1980, extra: 0, termMonths: 360, startDate: "2022-06-01", securedBy: "the house" },
    { id: "d-visa", accountId: "a-visa", rate: 0.239, minPayment: 190, extra: 210 },
  ],
  goals: [
    { id: "g-ef", name: "Emergency fund", icon: "🛟", target: 20000, targetDate: iso(today.getFullYear() + 1, 6, 30), priority: 1, saved: 0, fundedBy: ["a-sav"], monthly: 400, rate: null, inflates: false },
    { id: "g-car", name: "Replace Bo's car", icon: "🚗", target: 25000, targetDate: iso(today.getFullYear() + 3, 3, 1), priority: 2, saved: 3500, fundedBy: [], monthly: 300, rate: null, inflates: true },
    { id: "g-col", name: "Cy's college", icon: "🎓", target: 90000, targetDate: iso(2038, 8, 15), priority: 2, saved: 4000, fundedBy: [], monthly: 250, rate: 0.06, inflates: true },
    { id: "g-trip", name: "Japan trip", icon: "✈️", target: 8000, targetDate: iso(today.getFullYear() + 1, 10, 1), priority: 3, saved: 1200, fundedBy: [], monthly: 0, rate: null, inflates: false },
  ],
  netWorthHistory: [{ date: iso(today.getFullYear(), Math.max(1, today.getMonth() - 1), 1), assets: 528000, liabilities: 287000, netWorth: 241000 }],
});
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { seeded: true, people: plan.household.people.length, accounts: plan.accounts.length };
