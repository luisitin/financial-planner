// modules/insurance/term-vs-permanent/compute.js -- PURE. Whole (or universal) life against "buy term and
// invest the difference", from the whole-life illustration's own numbers: the same death benefit, the
// term premium, and the difference put into an investment account every year. Which one is ahead at the
// end of the term, what the family gets along the way, and the return the investments would have to fall
// below for whole life to come out ahead.
import { fv, rateFor } from "../../../core/math/finance.js";
import { perYear } from "../../../core/math/periods.js";

/** Tax drag on an investment account outside retirement accounts: dividends and gains taxed along the way (an assumption; about 0.5% a year for a broad index fund). */
export const TAX_DRAG = 0.005;
/** Within this many percentage points of each other the two are called close. */
export const CLOSE = 0.0025;
export const DEFAULT_TERM_YEARS = 20;

/** The plan's own expected return on the invested difference: its stock share now on its stock and bond returns. */
export function planReturn(plan) {
  const a = plan.assumptions ?? {};
  const s = Number(plan.retirement?.stocksNow ?? 0.7);
  return s * Number(a.returnStocks ?? 0.07) + (1 - s) * Number(a.returnBonds ?? 0.04);
}

/** The comparison as stored, with defaults: a whole-life policy on Policies gives the death benefit and premium. */
export function scenarioOf(plan) {
  const c = plan.insurance?.compare ?? {};
  const whole = (plan.insurance?.policies ?? []).find((x) => x.kind === "whole");
  const termYears = Number(c.termYears) > 0 ? Math.round(Number(c.termYears)) : DEFAULT_TERM_YEARS;
  const taxed = c.taxed !== false;
  return {
    deathBenefit: Number(c.deathBenefit) > 0 ? Number(c.deathBenefit) : whole ? Number(whole.benefit) || 0 : 0,
    wholePremium: Number(c.wholePremium) > 0 ? Number(c.wholePremium) : whole ? perYear(whole.premium, whole.period ?? "monthly") : 0,
    termPremium: Number(c.termPremium) > 0 ? Number(c.termPremium) : 0,
    termYears, cashValue: Number(c.cashValue) > 0 ? Number(c.cashValue) : 0, cashValueGuaranteed: Number(c.cashValueGuaranteed) > 0 ? Number(c.cashValueGuaranteed) : 0,
    taxed, returnRate: Number.isFinite(Number(c.returnRate)) && c.returnRate !== null && c.returnRate !== "" ? Number(c.returnRate) : planReturn(plan) - (taxed ? TAX_DRAG : 0),
    fromPolicy: !!whole && !(Number(c.deathBenefit) > 0 && Number(c.wholePremium) > 0),
  };
}

/**
 * compute(plan) -> {
 *   ready, missing: [text], scenario, difference (a year), rows: [{ year, sideFund, deathTerm, deathWhole }],
 *   atEnd: { sideFund, cashValue, cashValueGuaranteed, ahead (side fund - projected cash value) },
 *   breakeven (the return at which the invested difference only matches the projected cash value), breakevenGuaranteed,
 *   wholeReturn (the projected cash value as a return on every whole-life premium), wholeReturnGuaranteed,
 *   verdict: "term" | "whole" | "close"
 * }
 * Premiums are paid at the start of each year; the difference is invested the same day.
 */
export function compute(plan) {
  const s = scenarioOf(plan);
  const missing = [];
  if (!(s.deathBenefit > 0)) missing.push("the death benefit");
  if (!(s.wholePremium > 0)) missing.push("the whole-life premium a year");
  if (!(s.termPremium > 0)) missing.push("a term premium a year for the same cover");
  if (!(s.cashValue > 0)) missing.push(`the illustration's cash value after ${s.termYears} years`);
  if (missing.length) return { ready: false, missing, scenario: s };
  const difference = s.wholePremium - s.termPremium;
  if (!(difference > 0)) return { ready: false, missing: ["a term premium below the whole-life premium (term should cost much less)"], scenario: s };
  const N = s.termYears, r = s.returnRate;
  const rows = [];
  for (let t = 1; t <= N; t++) {
    const side = fv(r, t, difference, 0, true);
    rows.push({ year: t, sideFund: side, deathTerm: s.deathBenefit + side, deathWhole: s.deathBenefit });
  }
  const sideFund = rows[N - 1].sideFund;
  const breakeven = rateFor(s.cashValue, N, difference, 0, true);
  const breakevenGuaranteed = s.cashValueGuaranteed > 0 ? rateFor(s.cashValueGuaranteed, N, difference, 0, true) : null;
  const wholeReturn = rateFor(s.cashValue, N, s.wholePremium, 0, true);
  const wholeReturnGuaranteed = s.cashValueGuaranteed > 0 ? rateFor(s.cashValueGuaranteed, N, s.wholePremium, 0, true) : null;
  const verdict = breakeven === null ? "term" : r > breakeven + CLOSE ? "term" : r < breakeven - CLOSE ? "whole" : "close";
  return {
    ready: true, missing: [], scenario: s, difference, rows,
    atEnd: { sideFund, cashValue: s.cashValue, cashValueGuaranteed: s.cashValueGuaranteed || null, ahead: sideFund - s.cashValue },
    breakeven, breakevenGuaranteed, wholeReturn, wholeReturnGuaranteed, verdict,
  };
}
