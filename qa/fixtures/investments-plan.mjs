// qa/fixtures/investments-plan.mjs -- the tax couple (Sam and Lee) with holdings in four
// accounts: a taxable brokerage with lots, Sam's 401(k), Lee's IRA, Sam's Roth; balance
// points a year apart on the brokerage for the Performance page.
import { taxPlan } from "./tax-plan.mjs";

export function investmentsPlan() {
  const p = taxPlan();
  p.holdings.push(
    { id: "h1", accountId: "brk", symbol: "VTI", name: "", shares: 300, price: 290, priceAsOf: "2026-09-16", costBasis: 60000, assetClass: "", expenseRatio: null, yield: null, lots: [{ id: "l1", date: "2021-03-10", shares: 200, cost: 38000 }, { id: "l2", date: "2026-05-02", shares: 100, cost: 32000 }] },
    { id: "h2", accountId: "brk", symbol: "BND", name: "", shares: 700, price: 73, priceAsOf: "2026-09-16", costBasis: 56000, assetClass: "", expenseRatio: null, yield: null, lots: [] },
    { id: "h3", accountId: "brk", symbol: "SPAXX", name: "Fidelity Government Money Market", shares: 12900, price: 1, priceAsOf: "2026-09-16", costBasis: 12900, assetClass: "cash", expenseRatio: null, yield: null, lots: [] },
    { id: "h4", accountId: "k401", symbol: "FXAIX", name: "", shares: 1500, price: 212, priceAsOf: "2026-09-16", costBasis: 240000, assetClass: "", expenseRatio: null, yield: null, lots: [] },
    { id: "h5", accountId: "k401", symbol: "VFFVX", name: "Vanguard Target Retirement 2055", shares: 4000, price: 50, priceAsOf: "2026-09-16", costBasis: 150000, assetClass: "", expenseRatio: 0.0008, yield: null, lots: [] },
    { id: "h6", accountId: "ira", symbol: "VTIAX", name: "", shares: 4000, price: 36, priceAsOf: "2026-09-16", costBasis: 120000, assetClass: "", expenseRatio: null, yield: null, lots: [] },
    { id: "h7", accountId: "ira", symbol: "VNQ", name: "", shares: 700, price: 95, priceAsOf: "2026-09-16", costBasis: 60000, assetClass: "", expenseRatio: null, yield: null, lots: [] },
    { id: "h8", accountId: "roth", symbol: "ACME", name: "Acme Robotics", shares: 500, price: 180, priceAsOf: "2026-09-16", costBasis: 40000, assetClass: "", expenseRatio: null, yield: null, lots: [] },
  );
  const brk = p.accounts.find((a) => a.id === "brk");
  brk.balance = 300 * 290 + 700 * 73 + 12900;   // 151,000
  brk.history = [{ date: "2025-09-16", balance: 120000 }, { date: "2026-03-16", balance: 132000 }, { date: "2026-09-16", balance: 151000 }];
  p.retirement.contributions.push({ id: "c4", accountId: "brk", personId: "sam", amount: 1000, period: "monthly", employerMatch: 0 });
  p.investments.target = { us_stocks: 0.5, intl_stocks: 0.2, bonds: 0.25, cash: 0.05, real_estate: 0, other: 0 };
  return p;
}
