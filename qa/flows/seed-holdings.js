// qa/flows/seed-holdings.js -- put the investments fixture's holdings into the sandbox plan
// (run after seed-sample.js, or on its own for a plan with just the accounts it needs).
//   node tools/drive.mjs investments/holdings --profile p7 --script qa/flows/seed-sample.js --script qa/flows/seed-holdings.js
const key = "planner.plan.sandbox";
const plan = JSON.parse(localStorage.getItem(key) || "null");
if (!plan) throw new Error("no sandbox plan; run seed-sample.js first");
const acct = (type, name) => { let a = (plan.accounts || []).find((x) => x.type === type); if (!a) { a = { id: "seed-" + type, name, type, balance: 0, history: [] }; plan.accounts.push(a); } return a; };
const brk = acct("brokerage", "Brokerage"), k401 = acct("401k", "401(k)"), ira = acct("ira", "IRA"), roth = acct("roth", "Roth IRA");
plan.holdings = [
  { id: "h1", accountId: brk.id, symbol: "VTI", name: "", shares: 300, price: 290, priceAsOf: "2026-09-16", costBasis: 60000, assetClass: "", expenseRatio: null, yield: null, lots: [{ id: "l1", date: "2021-03-10", shares: 200, cost: 38000 }, { id: "l2", date: "2026-05-02", shares: 100, cost: 32000 }] },
  { id: "h2", accountId: brk.id, symbol: "BND", name: "", shares: 700, price: 73, priceAsOf: "2026-09-16", costBasis: 56000, assetClass: "", expenseRatio: null, yield: null, lots: [] },
  { id: "h4", accountId: k401.id, symbol: "FXAIX", name: "", shares: 1500, price: 212, priceAsOf: "2026-09-16", costBasis: 240000, assetClass: "", expenseRatio: null, yield: null, lots: [] },
  { id: "h5", accountId: k401.id, symbol: "VFFVX", name: "Vanguard Target Retirement 2055", shares: 4000, price: 50, priceAsOf: "2026-09-16", costBasis: 150000, assetClass: "", expenseRatio: 0.0008, yield: null, lots: [] },
  { id: "h6", accountId: ira.id, symbol: "VTIAX", name: "", shares: 4000, price: 36, priceAsOf: "2026-09-16", costBasis: 120000, assetClass: "", expenseRatio: null, yield: null, lots: [] },
  { id: "h8", accountId: roth.id, symbol: "ACME", name: "Acme Robotics", shares: 500, price: 180, priceAsOf: "2026-09-16", costBasis: 40000, assetClass: "", expenseRatio: null, yield: null, lots: [] },
];
k401.balance = 1500 * 212 + 4000 * 50; ira.balance = 4000 * 36; roth.balance = 500 * 180;
brk.balance = 300 * 290 + 700 * 73; brk.history = [{ date: "2025-09-16", balance: 120000 }, { date: "2026-03-16", balance: 132000 }, { date: "2026-09-16", balance: brk.balance }];
plan.investments = Object.assign({}, plan.investments, { target: { us_stocks: 0.5, intl_stocks: 0.2, bonds: 0.25, cash: 0.05, real_estate: 0, other: 0 } });
localStorage.setItem(key, JSON.stringify(plan));
return { holdings: plan.holdings.length, accounts: plan.accounts.map((a) => a.type) };
