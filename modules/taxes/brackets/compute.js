// modules/taxes/brackets/compute.js -- PURE. Where this year's taxable income sits in the
// federal brackets, how much room is left before the next rate, what more income would cost
// (the true marginal rate, which can exceed the bracket when benefits or gains get pulled
// along), and the ladder above you.
import { taxInputs } from "../federal/compute.js";
import { federalTax, bracketsFor, marginalRate } from "../../../core/math/tax.js";

/**
 * compute(plan, { today, extra }) -> {
 *   year, filingStatus, taxableIncome, ordinaryTaxable, bracketRate, roomInBracket, nextRate, marginal,
 *   ladder: [{ rate, from, to, width, filled (your ordinary taxable in it), tax, current }],
 *   above: [{ rate, amount, tax }] the next slices of income and what each costs,
 *   extra: { amount, tax, rate, bracketRate, taxableIncome } for `extra` more ordinary income,
 *   qualifiedTaxable, qualifiedNote, deduction, hasIncome
 * }
 */
export function compute(plan, params = {}) {
  const b = taxInputs(plan, params);
  const r = federalTax(b.inputs, b.params);
  const rows = bracketsFor(b.filingStatus, b.params);
  const ladder = rows.map((x) => {
    const width = Number.isFinite(x.to) ? x.to - x.from : null;
    const filled = Math.max(0, Math.min(r.ordinaryTaxable, Number.isFinite(x.to) ? x.to : Infinity) - x.from);
    return { rate: x.rate, from: x.from, to: x.to, width, filled, tax: filled * x.rate, current: x.rate === r.bracketRate && r.ordinaryTaxable >= x.from && (r.ordinaryTaxable < x.to || !Number.isFinite(x.to)) };
  });
  const above = [];
  let at = r.ordinaryTaxable;
  for (const x of rows) {
    if (!Number.isFinite(x.to) || x.to <= at) { if (!Number.isFinite(x.to) && x.from <= at) above.push({ rate: x.rate, amount: Infinity, tax: Infinity }); continue; }
    const amount = x.to - Math.max(at, x.from);
    above.push({ rate: x.rate, amount, tax: amount * x.rate });
    at = x.to;
  }
  const extraAmount = Math.max(0, Number(params.extra) || 0);
  let extra = null;
  if (extraAmount > 0) {
    const r2 = federalTax({ ...b.inputs, otherOrdinary: (b.inputs.otherOrdinary || 0) + extraAmount }, b.params);
    extra = { amount: extraAmount, tax: r2.totalTax - r.totalTax, rate: (r2.totalTax - r.totalTax) / extraAmount, bracketRate: r2.bracketRate, taxableIncome: r2.taxableIncome, keep: extraAmount - (r2.totalTax - r.totalTax) };
  }
  const marginal = marginalRate(b.inputs, b.params);
  const qualifiedNote = r.qualifiedTaxable > 0 ? `${Math.round(r.qualifiedTaxable).toLocaleString("en-US")} of dividends and long-term gains sit on top at the gains rates, not in these brackets.` : null;
  return { year: b.year, filingStatus: b.filingStatus, taxableIncome: r.taxableIncome, ordinaryTaxable: r.ordinaryTaxable, qualifiedTaxable: r.qualifiedTaxable, qualifiedNote, bracketRate: r.bracketRate, roomInBracket: r.roomInBracket, nextRate: r.nextRate, marginal, ladder, above: above.slice(0, 4), extra, deduction: r.deduction.amount, hasIncome: r.income.gross > 0, income: r.income.gross, totalTax: r.totalTax, effectiveRate: r.effectiveRate, isIndexed: !!b.params.indexed };
}
