// modules/insurance/cash-value/compute.js -- PURE. A permanent life policy you already own, as an
// investment: the return it has earned on the premiums so far, what cashing it in would leave after
// tax, the return from here if you keep paying (from the insurer's in-force illustration), and keep it
// against cashing in, buying term for the same cover and investing the rest.
import { fv, rateFor } from "../../../core/math/finance.js";
import { compute as computePolicies } from "../policies/compute.js";
import { planReturn, TAX_DRAG, CLOSE } from "../term-vs-permanent/compute.js";

export const DEFAULT_LATER_YEARS = 10;
/** The tax rate on a gain when cashing in (it is ordinary income): the plan's own rate, this if it has none. */
export const DEFAULT_TAX_RATE = 0.22;

/**
 * compute(plan) -> { items: [{
 *   id, name, personName, benefit, premiumYearly, cashValue, yearsPaid, surrender, basis, gain, tax, netCash,
 *   pastReturn (on the premiums so far, to the surrender value; null without the years paid),
 *   laterYears, cashValueLater, termQuote,
 *   keepReturn (the return from here: the surrender value left in plus the premiums still to pay, to the illustrated value),
 *   altValue (cash in after tax, pay term, invest the rest: what it grows to by then), breakeven (the return at which that matches keeping),
 *   verdict: "cash-in" | "keep" | "close" | null, missing: [text] }], count, returnRate, taxRate }
 */
export function compute(plan) {
  const pol = computePolicies(plan, {});
  const taxRate = Number(plan.retirement?.taxRate) > 0 ? Number(plan.retirement.taxRate) : DEFAULT_TAX_RATE;
  const returnRate = planReturn(plan) - TAX_DRAG;
  const items = pol.items.filter((x) => x.kind === "whole" && !x.ended).map((x) => {
    const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
    const premiumYearly = x.premiumYearly;
    const cashValue = num(x.cashValue) ?? 0;
    const yearsPaid = num(x.yearsPaid);
    const surrender = num(x.surrenderValue) ?? cashValue;
    const basis = num(x.basis) ?? (yearsPaid !== null ? premiumYearly * yearsPaid : null);
    const gain = basis !== null ? surrender - basis : null;
    const tax = gain !== null ? Math.max(0, gain) * taxRate : 0;
    const netCash = surrender - tax;
    const pastReturn = yearsPaid > 0 && surrender > 0 && premiumYearly > 0 ? rateFor(surrender, yearsPaid, premiumYearly, 0, true) : null;
    const laterYears = num(x.laterYears) > 0 ? Math.round(num(x.laterYears)) : DEFAULT_LATER_YEARS;
    const cashValueLater = num(x.cashValueLater);
    const termQuote = num(x.termQuote);
    const missing = [];
    if (yearsPaid === null) missing.push("the years you have paid premiums");
    if (!(surrender > 0)) missing.push("what cashing it in would pay today (the surrender value)");
    if (!(cashValueLater > 0)) missing.push(`the cash value in ${laterYears} years from an in-force illustration`);
    if (termQuote === null) missing.push("a term quote for the same cover");
    let keepReturn = null, altValue = null, breakeven = null, verdict = null;
    if (cashValueLater > 0 && (surrender > 0 || premiumYearly > 0)) keepReturn = rateFor(cashValueLater, laterYears, premiumYearly, surrender, true);
    if (cashValueLater > 0 && termQuote !== null) {
      const rest = Math.max(0, premiumYearly - termQuote);
      altValue = fv(returnRate, laterYears, rest, netCash, true);
      breakeven = rest > 0 || netCash > 0 ? rateFor(cashValueLater, laterYears, rest, netCash, true) : null;
      verdict = breakeven === null ? "keep" : returnRate > breakeven + CLOSE ? "cash-in" : returnRate < breakeven - CLOSE ? "keep" : "close";
    }
    return { id: x.id, name: x.name, personName: x.personName, benefit: Number(x.benefit) || 0, premiumYearly, cashValue, yearsPaid, surrender, basis, gain, tax, netCash, pastReturn, laterYears, cashValueLater, termQuote, keepReturn, altValue, breakeven, verdict, missing };
  });
  return { items, count: items.length, returnRate, taxRate };
}
