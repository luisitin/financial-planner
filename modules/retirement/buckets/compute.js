// modules/retirement/buckets/compute.js -- PURE. The bucket strategy: in retirement, keep the next few
// years of withdrawals in cash, the years after in bonds, and the rest in stocks, so a market fall never
// forces selling stocks low. The withdrawals come from the plan itself (spending and tax, less guaranteed
// income, year by year from retiring); the buckets are sized in years of them; the stock share they leave
// is set against the plan's own.
import { compute as computeCashFlow } from "../cash-flow/compute.js";

export const DEFAULTS = { cashYears: 2, bondYears: 8 };

/**
 * compute(plan, { today }) -> {
 *   ready, missing, retireYear, savings (at retirement, today's dollars), cashYears, bondYears,
 *   draws: [{ year, age, draw }] (the first years' withdrawals: spending + tax - guaranteed income),
 *   buckets: [{ key: "cash"|"bonds"|"stocks", label, from, to, amount, share }], impliedStocks, planStocks, short (savings below buckets 1 and 2), bondRealRate, warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.retirement?.buckets ?? {};
  const cashYears = Number(s.cashYears) > 0 ? Math.round(Number(s.cashYears)) : DEFAULTS.cashYears;
  const bondYears = Number(s.bondYears) >= 0 && s.bondYears !== null && s.bondYears !== "" && s.bondYears !== undefined ? Math.round(Number(s.bondYears)) : DEFAULTS.bondYears;
  const cf = computeCashFlow(plan, { today, real: true });
  if (!cf.ready) return { ready: false, missing: cf.missing ?? [], cashYears, bondYears };
  const a = plan.assumptions ?? {};
  const bondRealRate = (1 + Number(a.returnBonds ?? 0.04)) / (1 + Number(a.inflation ?? 0.03)) - 1;
  const retired = cf.rows.filter((r) => r.retired);
  const atRetire = cf.rows.find((r) => r.year === cf.retireYear) ?? retired[0];
  // savings as retirement starts: the year before's end (or this year's start)
  const before = cf.rows.find((r) => r.year === (atRetire?.year ?? 0) - 1);
  const savings = before ? before.end.total : (atRetire ? atRetire.end.total + atRetire.out.spending + atRetire.out.taxes - atRetire.in.income : 0);
  const draws = retired.map((r) => ({ year: r.year, age: r.age, draw: Math.max(0, r.out.spending + r.out.taxes - r.in.income) }));
  const sumDraws = (from, to, discount) => draws.slice(from, to).reduce((t, d, i) => t + d.draw / (discount ? Math.pow(1 + bondRealRate, i + from) : 1), 0);
  const cash = sumDraws(0, cashYears, false);
  const bonds = sumDraws(cashYears, cashYears + bondYears, true);
  const stocks = Math.max(0, savings - cash - bonds);
  const total = cash + bonds + stocks;
  const firstYear = draws[0]?.year ?? cf.retireYear;
  const buckets = [
    { key: "cash", label: "Cash: the next years' withdrawals", from: firstYear, to: firstYear + cashYears - 1, amount: cash },
    { key: "bonds", label: "Bonds: the years after", from: firstYear + cashYears, to: firstYear + cashYears + bondYears - 1, amount: bonds },
    { key: "stocks", label: "Stocks: the rest, for the long run", from: firstYear + cashYears + bondYears, to: null, amount: stocks },
  ].map((x) => ({ ...x, share: total > 0 ? x.amount / total : 0 }));
  const planStocks = Number(plan.retirement?.stocksRetired ?? 0.5);
  const impliedStocks = total > 0 ? stocks / total : 0;
  const warnings = [];
  const short = savings < cash + bonds;
  if (short) warnings.push(`At retirement the savings (about ${Math.round(savings).toLocaleString("en-US")}) would not fill the cash and bond buckets: fewer years in each, or a later retirement.`);
  if (!draws.length) warnings.push("The plan has no retirement years.");
  return { ready: true, missing: [], retireYear: firstYear, savings, cashYears, bondYears, draws: draws.slice(0, cashYears + bondYears + 2), buckets, impliedStocks, planStocks, short, bondRealRate, warnings };
}
