// qa/fixtures/held-plan.mjs -- the family plan with holdings and no target mix of their own: a 2055
// target-date fund, two US stock funds, VTI and BND (the experience round-3 walk-through's household),
// for the Allocation and Rebalance tests.
import { familyPlan } from "./family-plan.mjs";

export function heldPlan() {
  const p = familyPlan("2026-11-02"), t = "2026-11-02";
  p.holdings = [
    { id: "h1", accountId: "a-401", symbol: "FFFHX", name: "Fidelity Freedom 2055", shares: 3300, price: 16, priceAsOf: t, costBasis: 42000, assetClass: "", lots: [] },
    { id: "h2", accountId: "a-401", symbol: "FXAIX", name: "Fidelity 500 Index", shares: 150, price: 220, priceAsOf: t, costBasis: 25000, assetClass: "", lots: [] },
    { id: "h3", accountId: "a-roth", symbol: "VTI", name: "", shares: 100, price: 310, priceAsOf: t, costBasis: 22000, assetClass: "", lots: [] },
    { id: "h4", accountId: "a-bk401", symbol: "AGTHX", name: "American Funds Growth Fund of America", shares: 600, price: 70, priceAsOf: t, costBasis: 30000, assetClass: "us_stocks", lots: [] },
    { id: "h6", accountId: "a-brk", symbol: "BND", name: "", shares: 120, price: 72, priceAsOf: t, costBasis: 9000, assetClass: "", lots: [] },
  ];
  for (const [id, v] of [["a-401", 3300 * 16 + 150 * 220], ["a-roth", 31000], ["a-bk401", 42000], ["a-brk", 120 * 72]]) p.accounts.find((a) => a.id === id).balance = v;
  return p;
}
