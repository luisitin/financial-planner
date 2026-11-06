// modules/taxes/brackets/compute.js -- PURE. Where this year's taxable income sits in the
// federal brackets, how much room is left before the next rate, what more income would cost
// (the true marginal rate, which can exceed the bracket when benefits or gains get pulled
// along), and the ladder above you.
import { taxInputs, nextDollarOf } from "../federal/compute.js";
import { federalTax, bracketsFor } from "../../../core/math/tax.js";

/**
 * compute(plan, { today, extra }) -> {
 *   year, filingStatus, taxableIncome, ordinaryTaxable, bracketRate, roomInBracket, nextRate, marginal (the next dollar), careMoves (the child care credit moves it),
 *   careCoversTax (it moves it and alone covers all the income tax),
 *   ladder: [{ rate, from, to, width, filled (your ordinary taxable in it), tax, current }],
 *   above: [{ rate, amount, tax }] the next slices of income and what each costs,
 *   extra: { amount, tax, rate, bracketRate, taxableIncome } for `extra` more ordinary income,
 *   qualifiedTaxable, qualifiedNote, deduction, hasIncome, income, totalTax, effectiveRate (the household's),
 *   separate: [{ personId, name, taxableIncome, bracketRate, roomInBracket, totalTax, shown }] | null (filing separately: the
 *   ladder and the room are the return of the adult marked "Me", `whose`; this lists both)
 * }
 */
export function compute(plan, params = {}) {
  const b = taxInputs(plan, params);
  const all = federalTax(b.inputs, b.params);
  // filing separately: the ladder is one return's, so it shows the return that more income would land on (the adult
  // marked "Me"), and `separate` lists both
  const r = all.separate ? all.separate.find((x) => x.personId === all.separateTo) ?? all.separate[0] : all;
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
    const own2 = r2.separate ? r2.separate.find((x) => x.personId === r2.separateTo) ?? r2.separate[0] : r2;
    extra = { amount: extraAmount, tax: r2.totalTax - all.totalTax, rate: (r2.totalTax - all.totalTax) / extraAmount, bracketRate: own2.bracketRate, taxableIncome: own2.taxableIncome, keep: extraAmount - (r2.totalTax - all.totalTax) };
  }
  // the next dollar: the Federal estimate's one figure (nextDollarOf: over whole steps of the child care credit when it is in
  // play), so this page and the Federal estimate say the same cents (care fourth pass)
  const marginal = nextDollarOf(b.inputs, b.params);
  // whether the child care credit moves it (it shrinks as income rises, or covers the tax on more pay), so the page says so
  const careMoves = !!b.inputs.care && Math.abs(marginal - nextDollarOf({ ...b.inputs, care: null }, b.params)) > 0.0005;
  // the care credit alone covers all the income tax (it is held to the tax), as the Federal estimate words it: at a 0% next
  // dollar the page names it only then, else "the credits" (Review 2026-11-06: "covers part of the tax" was said at 0%)
  const careCoversTax = careMoves && (Number(r.credits?.careCredit) || 0) >= (Number(r.incomeTax) || 0) - 0.5;
  const qualifiedNote = r.qualifiedTaxable > 0 ? `${Math.round(r.qualifiedTaxable).toLocaleString("en-US")} of dividends and long-term gains sit on top at the gains rates, not in these brackets.` : null;
  const separate = all.separate ? all.separate.map((x) => ({ personId: x.personId, name: x.name, taxableIncome: x.taxableIncome, bracketRate: x.bracketRate, roomInBracket: x.roomInBracket, totalTax: x.totalTax, shown: x === r })) : null;
  return { separate, whose: all.separate ? r.name : null, year: b.year, filingStatus: b.filingStatus, taxableIncome: r.taxableIncome, ordinaryTaxable: r.ordinaryTaxable, qualifiedTaxable: r.qualifiedTaxable, qualifiedNote, bracketRate: r.bracketRate, roomInBracket: r.roomInBracket, nextRate: r.nextRate, marginal, careMoves, careCoversTax, ladder, above: above.slice(0, 4), extra, deduction: r.deduction.amount, hasIncome: all.income.gross > 0, income: all.income.gross, totalTax: all.totalTax, effectiveRate: all.effectiveRate, isIndexed: !!b.params.indexed };
}
