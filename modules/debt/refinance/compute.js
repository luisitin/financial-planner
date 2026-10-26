// modules/debt/refinance/compute.js -- PURE. The mortgage you have against the one you could
// get: new payment, monthly saving, how many months until the closing costs are paid back,
// and the total interest either way over the years you expect to stay. Inputs live in
// plan.debtPlan.refinance = { rate, termYears, closingCosts, yearsStaying }.
import { pmt, nper, amortization } from "../../../core/math/finance.js";
import { compute as computeMortgage } from "../mortgage/compute.js";

/**
 * compute(plan, { today, rate, termYears, closingCosts, yearsStaying }) -> {
 *   current: { balance, rate, payment, months, totalInterest }, offer: { rate, termYears, closingCosts, payment, months, totalInterest },
 *   monthlySaving, breakEvenMonths, yearsStaying, interestWhileStaying: { current, offer }, netWhileStaying (saved minus costs),
 *   verdict: "worth it" | "close call" | "not worth it" | null, hasData, missing
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const m = computeMortgage(plan, { today });
  const rf = plan.debtPlan?.refinance ?? {};
  const rate = Number(params.rate ?? rf.rate ?? NaN);
  const termYears = Math.max(1, Number(params.termYears ?? rf.termYears ?? 30));
  const closingCosts = Math.max(0, Number(params.closingCosts ?? rf.closingCosts ?? 0));
  const yearsStaying = Math.max(1, Number(params.yearsStaying ?? rf.yearsStaying ?? 7));
  if (!m.hasData) return { hasData: false, missing: m.mortgage ? "rate or payment" : "mortgage", current: null, offer: null };
  const balance = m.mortgage.balance;
  const current = { balance, rate: m.mortgage.rate, payment: m.mortgage.payment, months: m.base.months, totalInterest: m.base.totalInterest };
  if (!Number.isFinite(rate)) return { hasData: true, needsOffer: true, current, offer: null, termYears, closingCosts, yearsStaying };
  const n = Math.round(termYears * 12), r = rate / 12;
  const payment = Math.round(pmt(r, n, balance) * 100) / 100;
  const offerInterest = amortization({ principal: balance, annualRate: rate, years: termYears, payment }).totalInterest;
  const offer = { rate, termYears, closingCosts, payment, months: n, totalInterest: offerInterest };
  const monthlySaving = Math.round((current.payment - payment) * 100) / 100;
  const breakEvenMonths = monthlySaving > 0 ? Math.ceil(closingCosts / monthlySaving) : null;
  // interest paid over the years you expect to stay, both ways
  const stayMonths = Math.min(Math.round(yearsStaying * 12), 600);
  const interestOver = (principal, annualRate, pay, months) => { let b = principal, total = 0; const rr = annualRate / 12; for (let i = 0; i < months && b > 0.005; i++) { const it = b * rr; total += it; b = Math.max(0, b + it - pay); } return Math.round(total * 100) / 100; };
  const interestWhileStaying = { current: interestOver(balance, current.rate, current.payment, stayMonths), offer: interestOver(balance, rate, payment, stayMonths) };
  const netWhileStaying = Math.round((interestWhileStaying.current - interestWhileStaying.offer - closingCosts) * 100) / 100;
  const verdict = netWhileStaying > closingCosts * 0.5 && netWhileStaying > 500 ? "worth it" : netWhileStaying > 0 ? "close call" : "not worth it";
  return { hasData: true, needsOffer: false, current, offer, monthlySaving, breakEvenMonths, yearsStaying, interestWhileStaying, netWhileStaying, verdict, extraYears: Number.isFinite(current.months) ? Math.round((n - current.months) / 12 * 10) / 10 : null };
}
