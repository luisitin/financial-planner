// modules/career/human-capital/compute.js -- PURE. What all the pay you are still going to earn is worth today
// (your "human capital"): each earner's pay to retirement, growing with raises, discounted at a rate that fits how
// steady the job is, before and after tax. Set against what you have saved, year by year until retirement (the
// savings rise as the future pay is used up, and cross over), and against the life insurance on each earner.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeRetirement } from "../../retirement/projection/compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";

/** How steady the pay is sets the discount: a steady job like a bond (the plan's bond return), an average one two points more, a volatile one (commission, a start-up) like stocks. */
export const RISK = {
  steady: { label: "Steady (government, tenured, long-standing employer)", add: 0 },
  average: { label: "Average", add: 0.02 },
  volatile: { label: "Volatile (commission, a start-up, your own business)", add: null },
};
const PAY_TYPES = ["salary", "bonus", "business"];

/** Present value of pay `pay0` a year for `years` years, growing `g` a year, discounted at `r` (all real), paid at each year's end. */
export function presentValue(pay0, years, g, r) {
  let pv = 0;
  for (let k = 0; k < years; k++) pv += pay0 * Math.pow(1 + g, k + 1) / Math.pow(1 + r, k + 1);
  return pv;
}

/**
 * compute(plan, { today }) -> {
 *   ready, people: [{ id, name, age, retireAge, years, pay, risk, rate (nominal discount), value (gross), afterTax, cover (life insurance), coverShare }],
 *   total, totalAfterTax, financial (investable now), share (human capital of total wealth), takeHome,
 *   path: [{ year, human, financial }] in today's money to the last retirement, crossYear, real: { growth, inflation },
 *   raiseGain (the extra pay from raises one point bigger every year, in today's money)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : 2026;
  const a = plan.assumptions ?? {};
  const inflation = Number(a.inflation ?? 0.03), growth = Number(a.salaryGrowth ?? 0.03), bonds = Number(a.returnBonds ?? 0.04), stocks = Number(a.returnStocks ?? 0.07);
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  const s = plan.whatIfs?.humanCapital ?? {};
  const realOf = (x) => (1 + x) / (1 + inflation) - 1;
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate).map((p) => {
    const pay = inc ? inc.active.filter((x) => PAY_TYPES.includes(x.type) && x.personId === p.id).reduce((t, x) => t + x.yearly, 0) : 0;
    const age = year - Number(p.birthDate.slice(0, 4));
    const retireAge = Number(p.retirementAge ?? a.retirementAge ?? 65);
    const years = Math.max(0, retireAge - age);
    const risk = RISK[s[p.id]] ? s[p.id] : "average";
    const rate = RISK[risk].add === null ? stocks : bonds + RISK[risk].add;
    return { id: p.id, name: p.name, age, retireAge, years, pay, risk, rate, realRate: realOf(rate), value: presentValue(pay, years, realOf(growth), realOf(rate)) };
  }).filter((p) => p.pay > 0);
  if (!people.length) return { ready: false, people: [] };

  // after tax: the household's federal and payroll tax as a share of its pay
  const nb = computeNext(plan, { today });
  const gross = nb.ready ? nb.spare.gross : 0;
  const takeHome = gross > 0 ? Math.max(0, 1 - (nb.spare.federalTax + nb.spare.payrollTax) / gross) : 0.75;
  // the life cover on each earner (term and permanent policies naming them)
  const policies = (plan.insurance?.policies ?? []).filter((x) => ["term", "whole", "universal", "life"].includes(x.kind));
  for (const p of people) {
    p.afterTax = p.value * takeHome;
    p.cover = policies.filter((x) => x.personId === p.id).reduce((t, x) => t + (Number(x.benefit) || 0), 0);
    p.coverShare = p.afterTax > 0 ? p.cover / p.afterTax : null;
  }
  const total = people.reduce((t, p) => t + p.value, 0), totalAfterTax = total * takeHome;
  const nw = computeNetWorth(plan, { today });
  const financial = nw.investable;

  // year by year to the last retirement: the pay still to come against the savings (both in today's money)
  const ret = computeRetirement(plan, { today });
  const horizon = Math.max(...people.map((p) => p.years));
  const path = [];
  for (let t = 0; t <= horizon; t++) {
    const human = people.reduce((sum, p) => sum + (t < p.years ? presentValue(p.pay * Math.pow(1 + realOf(growth), t), p.years - t, realOf(growth), p.realRate) : 0), 0);
    const row = ret.ready ? ret.rows.find((r) => r.year === year + t - 1) : null;
    path.push({ year: year + t, human, financial: t === 0 ? financial : row ? row.totalReal : null });
  }
  const cross = path.find((x) => x.financial !== null && x.financial >= x.human);
  // a raise of one point more a year, every year to retirement: the extra pay in today's money (not discounted)
  const raiseGain = people.reduce((sum, p) => { let t = 0; for (let k = 1; k <= p.years; k++) t += p.pay * (Math.pow(1 + realOf(growth) + 0.01, k) - Math.pow(1 + realOf(growth), k)); return sum + t; }, 0);
  return {
    ready: true, people, total, totalAfterTax, takeHome, financial, share: total + financial > 0 ? total / (total + financial) : null,
    path, crossYear: cross ? cross.year : null, real: { growth: realOf(growth), inflation }, raiseGain,
  };
}
