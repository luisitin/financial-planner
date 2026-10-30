// qa/flows/seed-equity.js -- Ana works at an invented company, ACME: shares in the brokerage and her 401(k), an RSU grant and old options, for the SANDBOX family (after seed-family.js). Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-equity.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
const d = new Date(), iso = (x) => x.toISOString().slice(0, 10), monthsAgo = (n) => iso(new Date(d.getFullYear(), d.getMonth() - n, 1, 12));
plan.equity = { symbol: "ACME", price: 120, priceAsOf: iso(d), personId: "p-ana", grants: [
  { id: "g1", kind: "rsu", name: "New-hire RSU grant", granted: monthsAgo(20), vestStart: monthsAgo(20), shares: 800, strike: null, vestMonths: 48, cliffMonths: 12, every: 3 },
  { id: "g2", kind: "option", name: "Early options", granted: monthsAgo(112), vestStart: monthsAgo(112), shares: 2000, strike: 40, vestMonths: 48, cliffMonths: 12, every: 1 },
] };
plan.holdings = [
  { id: "eh1", accountId: "a-brk", symbol: "ACME", shares: 100, price: 118, priceAsOf: monthsAgo(0), costBasis: 6000, lots: [] },
  { id: "eh2", accountId: "a-401", symbol: "ACME", shares: 150, price: 118, priceAsOf: monthsAgo(0), costBasis: 9000, lots: [] },
];
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { grants: 2 };
