// modules/debt/consolidation/compute.js -- PURE. Rolling the cards and loans into one: against paying them
// as now (the same total payment, highest rate first), a personal loan (one rate, one end date, a fee taken
// out of the loan), a 0% balance-transfer card (a fee up front, no interest for a while, then the card's
// rate) and a home-equity line (a low rate, but the home secures it). What each costs in interest and fees,
// when you are debt-free, and the monthly payment.
import { pmt } from "../../../core/math/finance.js";
import { payoffPlan } from "../../../core/math/payoff.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";

export const DEFAULTS = { loanRate: 0.12, loanMonths: 36, loanFee: 0.05, btFee: 0.04, btMonths: 18, btApr: 0.24, helocRate: 0.085, helocMonths: 60 };
const EXCLUDE = ["mortgage", "student_loan"];
/** Debts at this rate or more are worth consolidating by default (the line Next best action calls high-rate). */
export const HIGH = 0.10;

/** One balance paid at a fixed payment: months to zero and the interest, with a 0% stretch first (`freeMonths`). */
export function payDown(balance, apr, payment, { freeMonths = 0, maxMonths = 600 } = {}) {
  let bal = balance, interest = 0, m = 0;
  while (bal > 0.005 && m < maxMonths) {
    const i = m < freeMonths ? 0 : bal * apr / 12;
    if (payment <= i) return { months: Infinity, interest: Infinity };
    interest += i; bal = bal + i - payment; m++;
  }
  return { months: bal <= 0.005 ? m : Infinity, interest };
}

/**
 * compute(plan, { today }) -> {
 *   ready, debts (the ones rolled together): [{ id, name, owed, rate, payment }], candidates (every debt that could be), owed, payment (the total a month now), weightedRate,
 *   options: [{ id, label, monthly, months, interest, fees, cost, note, risk }], best
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.whatIfs?.consolidation ?? {};
  const x = {};
  for (const [k, v] of Object.entries(DEFAULTS)) x[k] = s[k] === null || s[k] === undefined || s[k] === "" || !Number.isFinite(Number(s[k])) ? v : Number(s[k]);
  const li = computeLiabilities(plan, { today });
  // which debts: the ones chosen, else every one at 10% or more (folding a cheap loan into a dearer one never helps)
  const candidates = li.rows.filter((r) => !EXCLUDE.includes(r.type) && r.owed > 0).map((r) => ({ id: r.id, name: r.name, owed: r.owed, rate: r.rate ?? 0.2, payment: r.payment || r.owed * 0.03 }));
  const debts = candidates.filter((d) => (Array.isArray(s.include) ? s.include.includes(d.id) : d.rate >= HIGH));
  if (!debts.length) return { ready: false, inputs: x, debts: [], candidates };
  const owed = debts.reduce((t, d) => t + d.owed, 0);
  const payment = debts.reduce((t, d) => t + d.payment, 0);
  const weightedRate = debts.reduce((t, d) => t + d.owed * d.rate, 0) / owed;
  const now = payoffPlan(debts.map((d) => ({ id: d.id, name: d.name, balance: d.owed, rate: d.rate, minPayment: d.payment })), { order: "avalanche" });
  const options = [{ id: "now", label: "Keep paying as now", monthly: payment, months: now.months, interest: now.totalInterest, fees: 0, note: `${(weightedRate * 100).toFixed(1)}% on average, highest rate first`, risk: null }];
  // a personal loan: the fee comes out of the loan, so it is borrowed too
  const loan = owed / (1 - x.loanFee), loanPay = pmt(x.loanRate / 12, x.loanMonths, loan);
  options.push({ id: "loan", label: "Personal loan", monthly: loanPay, months: x.loanMonths, interest: loanPay * x.loanMonths - loan, fees: loan - owed, note: `${(x.loanRate * 100).toFixed(1)}% for ${x.loanMonths / 12} years, ${(x.loanFee * 100).toFixed(0)}% fee`, risk: null });
  // a balance-transfer card: the fee is added to the balance; the same monthly payment as now
  const bt = owed * (1 + x.btFee), btPaid = payDown(bt, x.btApr, payment, { freeMonths: x.btMonths });
  options.push({ id: "transfer", label: "0% balance-transfer card", monthly: payment, months: btPaid.months, interest: btPaid.interest, fees: owed * x.btFee, note: `0% for ${x.btMonths} months, then ${(x.btApr * 100).toFixed(0)}%; ${(x.btFee * 100).toFixed(0)}% fee`, risk: btPaid.months > x.btMonths ? `At the same payment it is not paid off in the ${x.btMonths} interest-free months; ${Math.round(bt / x.btMonths)} a month would clear it.` : null });
  // a home-equity line: low rate, the home is security
  const hPay = pmt(x.helocRate / 12, x.helocMonths, owed);
  options.push({ id: "heloc", label: "Home-equity line", monthly: hPay, months: x.helocMonths, interest: hPay * x.helocMonths - owed, fees: 0, note: `${(x.helocRate * 100).toFixed(1)}% over ${x.helocMonths / 12} years`, risk: "The home secures it: card debt that could be settled becomes debt the house answers for." });
  for (const o of options) o.cost = o.interest + o.fees;
  const best = options.filter((o) => Number.isFinite(o.cost)).reduce((a, o) => (o.cost < a.cost - 1 ? o : a));
  return { ready: true, inputs: x, debts, candidates, owed, payment, weightedRate, options, best: best.id };
}
