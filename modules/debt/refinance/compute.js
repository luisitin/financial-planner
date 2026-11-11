// modules/debt/refinance/compute.js -- PURE. The mortgage you have against the one you could
// get: new payment, monthly saving, how many months until the closing costs are paid back,
// and the total interest either way over the years you expect to stay. Inputs live in
// plan.debtPlan.refinance = { rate, termYears, closingCosts, yearsStaying }.
import { pmt, nper, amortization } from "../../../core/math/finance.js";
import { compute as computeMortgage } from "../mortgage/compute.js";

/**
 * compute(plan, { today, rate, termYears, closingCosts, yearsStaying }) -> {
 *   current: { balance, rate, payment, toLoan, escrow, months, totalInterest }, offer: { rate, termYears, closingCosts, payment, toLoan,
 *   months, totalInterest } (payment: the whole a month, the tax and insurance in today's kept on the offer; toLoan: the part that pays the loan),
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
  if (!m.hasData) return { hasData: false, missing: m.mortgage ? "rate or payment" : "mortgage", mortgageId: m.mortgage?.id ?? null, current: null, offer: null };
  const balance = m.mortgage.balance;
  // the tax and insurance inside the payment (debt/mortgage's escrow, while the balance or payment is our guess) stay on the new
  // loan's payment too: the two payments are compared whole, and only the loan part pays interest and principal (verify 2026-11-07:
  // a guessed $1,900 with $384 of tax and insurance was set against the offer's bare $1,379, "$521 less than now")
  const escrow = Math.max(0, Number(m.mortgage.escrow) || 0), toLoan = m.mortgage.toLoan ?? m.mortgage.payment;
  const current = { balance, rate: m.mortgage.rate, payment: m.mortgage.payment, toLoan, escrow, months: m.base.months, totalInterest: m.base.totalInterest };
  if (!Number.isFinite(rate)) return { hasData: true, needsOffer: true, current, offer: null, termYears, closingCosts, yearsStaying };
  const n = Math.round(termYears * 12), r = rate / 12;
  const pi = Math.round(pmt(r, n, balance) * 100) / 100, payment = Math.round((pi + escrow) * 100) / 100;
  const offerInterest = amortization({ principal: balance, annualRate: rate, years: termYears, payment: pi }).totalInterest;
  const offer = { rate, termYears, closingCosts, payment, toLoan: pi, months: n, totalInterest: offerInterest };
  const monthlySaving = Math.round((current.payment - payment) * 100) / 100;
  const breakEvenMonths = monthlySaving > 0 ? Math.ceil(closingCosts / monthlySaving) : null;
  // interest paid over the years you expect to stay, both ways
  const stayMonths = Math.min(Math.round(yearsStaying * 12), 600);
  const interestOver = (principal, annualRate, pay, months) => { let b = principal, total = 0; const rr = annualRate / 12; for (let i = 0; i < months && b > 0.005; i++) { const it = b * rr; total += it; b = Math.max(0, b + it - pay); } return Math.round(total * 100) / 100; };
  const interestWhileStaying = { current: interestOver(balance, current.rate, toLoan, stayMonths), offer: interestOver(balance, rate, pi, stayMonths) };
  const netWhileStaying = Math.round((interestWhileStaying.current - interestWhileStaying.offer - closingCosts) * 100) / 100;
  const verdict = netWhileStaying > closingCosts * 0.5 && netWhileStaying > 500 ? "worth it" : netWhileStaying > 0 ? "close call" : "not worth it";
  return { hasData: true, needsOffer: false, current, offer, monthlySaving, breakEvenMonths, yearsStaying, interestWhileStaying, netWhileStaying, verdict, extraYears: Number.isFinite(current.months) ? Math.round((n - current.months) / 12 * 10) / 10 : null };
}
