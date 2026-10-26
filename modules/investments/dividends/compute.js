// modules/investments/dividends/compute.js -- PURE. The income your holdings throw off each
// year (value x yield, from the fund table or what you typed), by holding, by account and by
// tax bucket, what it covers of your spending, and how much of it is taxed this year.
import { compute as computeHoldings } from "../holdings/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";

/**
 * compute(plan, { today }) -> {
 *   ready, total (a year), monthly, yieldOverall, items: [{ symbol, name, account, bucket, value, yield, income, known }],
 *   byAccount: [{ name, income }], taxable (income in taxable accounts), sheltered, coversShare (of monthly expenses), expensesMonthly,
 *   qualifiedGuess (the part likely qualified: stock funds in taxable accounts), unknownCount, notes
 * }
 */
export function compute(plan, params = {}) {
  const h = computeHoldings(plan, params);
  const items = h.items.map((x) => ({ symbol: x.symbol, name: x.name, account: x.accountName, bucket: x.bucket, cls: x.cls, value: x.value, yield: x.yield, income: x.incomeYearly, known: x.yield !== null })).sort((a, b) => b.income - a.income);
  const total = items.reduce((s, x) => s + x.income, 0);
  const byAccountMap = new Map();
  for (const x of items) byAccountMap.set(x.account, (byAccountMap.get(x.account) ?? 0) + x.income);
  const byAccount = [...byAccountMap.entries()].map(([name, income]) => ({ name, income })).sort((a, b) => b.income - a.income);
  const taxable = items.filter((x) => x.bucket === "taxable").reduce((s, x) => s + x.income, 0);
  const qualifiedGuess = items.filter((x) => x.bucket === "taxable" && (x.cls === "us_stocks" || x.cls === "intl_stocks" || x.cls === "balanced")).reduce((s, x) => s + x.income, 0);
  const ex = (plan.expenses ?? []).length ? computeExpenses(plan, { today: params.today ?? null }) : null;
  const expensesMonthly = ex?.monthly ?? 0;
  const notes = [];
  const unknownCount = items.filter((x) => !x.known).length;
  if (unknownCount) notes.push(`${unknownCount} holding${unknownCount === 1 ? " has" : "s have"} no yield on file; type one on the Holdings page (the fund page or the last year's distributions divided by the price).`);
  if (taxable > 0) notes.push(`${Math.round(taxable).toLocaleString("en-US")} of it lands in taxable accounts and is taxed every year even when reinvested; type the qualified part on the Federal estimate page (about ${Math.round(qualifiedGuess).toLocaleString("en-US")} looks qualified) and the rest as other ordinary income.`);
  return { ready: h.hasData, total, monthly: total / 12, yieldOverall: h.total > 0 ? total / h.total : 0, items, byAccount, taxable, sheltered: total - taxable, coversShare: expensesMonthly > 0 ? total / 12 / expensesMonthly : null, expensesMonthly, qualifiedGuess, unknownCount, notes, portfolio: h.total };
}
