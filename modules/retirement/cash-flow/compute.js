// modules/retirement/cash-flow/compute.js -- PURE. The year-by-year table behind the projection:
// for every year, ages, what comes in (pay contributions, Social Security, pensions), what goes
// out (spending, taxes), what is taken from which bucket, and the balances at year end, in
// today's dollars or in the dollars of the year. Modelled on the Bogleheads Retiree Portfolio
// Model's yearly ledger; the numbers come from the Projection page's engine run.
import { compute as computeProjection } from "../projection/compute.js";

/**
 * compute(plan, { today, real = true }) -> { ready, missing, real, rows: [{ year, age, ages, retired, in: { contributions, income, lines }, out: { spending, taxes }, from: { cash, taxable, deferred, free }, rmd, end: { cash, taxable, deferred, free, total }, shortfall }], totals, retireYear }
 */
export function compute(plan, params = {}) {
  const pr = computeProjection(plan, params);
  if (!pr.ready) return { ready: false, missing: pr.missing, rows: [] };
  const real = params.real !== false;
  const k = (row, v) => real ? v / row.priceLevel : v;
  const rows = pr.rows.map((r) => ({
    year: r.year, age: r.ages[0], ages: r.ages, retired: r.retired, priceLevel: r.priceLevel,
    in: { contributions: k(r, r.contributions), income: k(r, r.income), lines: r.incomeLines.map((l) => ({ name: l.name, amount: k(r, l.amount) })) },
    out: { spending: k(r, r.spending), taxes: k(r, r.taxes) },
    from: { cash: k(r, r.withdrawn.cash), taxable: k(r, r.withdrawn.taxable), deferred: k(r, r.withdrawn.deferred), free: k(r, r.withdrawn.free) },
    rmd: k(r, r.rmd), returnPct: r.portfolioReturn,
    end: { cash: k(r, r.balances.cash), taxable: k(r, r.balances.taxable), deferred: k(r, r.balances.deferred), free: k(r, r.balances.free), total: k(r, r.total) },
    shortfall: k(r, r.shortfall),
  }));
  const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
  return { ready: true, real, rows, retireYear: pr.inputs.retireYear, people: pr.people, totals: { contributions: sum((r) => r.in.contributions), income: sum((r) => r.in.income), spending: sum((r) => r.out.spending), taxes: sum((r) => r.out.taxes), withdrawn: sum((r) => r.from.cash + r.from.taxable + r.from.deferred + r.from.free) }, verdict: pr.verdict, shortYear: pr.shortYear };
}
