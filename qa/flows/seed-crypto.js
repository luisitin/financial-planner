// qa/flows/seed-crypto.js -- a crypto wallet with three coins (a gain held over a year, a recent loss, a stablecoin) and a bitcoin fund in the brokerage, for the SANDBOX family (after seed-family.js). Never run it with --real.
if (!new URLSearchParams(location.search).has("sandbox")) throw new Error("seed-crypto.js only runs in the sandbox");
const plan = JSON.parse(localStorage.getItem("planner.plan.sandbox"));
plan.accounts.push({ id: "a-cx", name: "Coin wallet", type: "crypto", institution: "An exchange", balance: 0, history: [] });
const d = new Date(), iso = (x) => x.toISOString().slice(0, 10), ago = (n) => iso(new Date(d.getTime() - n * 864e5));
plan.holdings = [
  { id: "c1", accountId: "a-cx", symbol: "BTC", name: "", shares: 0.12, price: 98000, priceAsOf: ago(1), costBasis: 4200, assetClass: "", lots: [{ id: "cl1", date: ago(900), shares: 0.08, cost: 2100 }, { id: "cl2", date: ago(330), shares: 0.04, cost: 2100 }] },
  { id: "c2", accountId: "a-cx", symbol: "ETH", name: "", shares: 1.5, price: 3200, priceAsOf: ago(12), costBasis: 6300, assetClass: "", lots: [{ id: "cl3", date: ago(120), shares: 1.5, cost: 6300 }] },
  { id: "c3", accountId: "a-cx", symbol: "USDC", name: "", shares: 800, price: 1, priceAsOf: ago(1), costBasis: 800, assetClass: "", lots: [] },
  { id: "c4", accountId: "a-brk", symbol: "IBIT", name: "", shares: 40, price: 55, priceAsOf: ago(1), costBasis: 1600, assetClass: "", lots: [{ id: "cl4", date: ago(500), shares: 40, cost: 1600 }] },
];
plan.accounts.find((a) => a.id === "a-cx").balance = 0.12 * 98000 + 1.5 * 3200 + 800;
localStorage.setItem("planner.plan.sandbox", JSON.stringify(plan));
return { coins: 3, funds: 1 };
