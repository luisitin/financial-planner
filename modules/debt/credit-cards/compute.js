// modules/debt/credit-cards/compute.js -- PURE. Every card: how much of its limit is used,
// its rate, what the minimum-payment trap would cost, and whether a balance transfer with a
// promotional rate would help. Limits come from the Debts page detail (creditLimit), the rest
// from the accounts and their rate/payment.
import { minimumOnly } from "../../../core/math/payoff.js";
import { compute as computeDebts } from "../../balance/liabilities/compute.js";
import { addMonths } from "../../../core/math/dates.js";

/**
 * compute(plan, { today, promoMonths = 15, feePct = 0.03 }) -> {
 *   cards: [{ id, name, balance, limit, utilisation, rate, minPayment, interestMonthly, trap: { months, interest } | null,
 *             transfer: { fee, interestNow, interestPromo, saves } | null }],
 *   totalBalance, totalLimit, utilisation, interestMonthly, count, missing: [names without rate], hasData
 * }
 * Minimum-payment trap: paying the required amount only (the Debts page's minimum, or 2% of the balance with a 25 floor).
 * Balance transfer: interest over the promo months at the card's rate vs the fee, paying the same amount each month.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const promoMonths = Math.max(1, Number(params.promoMonths ?? plan.debtPlan?.transfer?.months ?? 15));
  const feePct = Math.max(0, Number(params.feePct ?? plan.debtPlan?.transfer?.feePct ?? 0.03));
  const li = computeDebts(plan, { today });
  const cards = li.rows.filter((r) => r.type === "credit").map((r) => {
    const limit = Number(r.detail?.creditLimit) || null;
    const balance = r.owed, rate = r.rate;
    const minPayment = r.detail ? r.minPayment : 0;
    const trap = rate !== null && balance > 0 ? (minPayment > 0 ? minimumOnly(balance, rate, minPayment) : minimumOnly(balance, rate, 0, { percentOfBalance: 0.02, floor: 25 })) : null;
    let transfer = null;
    if (rate !== null && balance > 0) {
      // interest during the promo months if nothing changes vs the transfer fee (promo rate 0%), same monthly payment
      const pay = Math.max(minPayment, balance / promoMonths);
      let b = balance, interestNow = 0;
      for (let m = 0; m < promoMonths && b > 0; m++) { const i = b * rate / 12; interestNow += i; b = Math.max(0, b + i - pay); }
      const fee = balance * feePct;
      transfer = { fee: Math.round(fee * 100) / 100, interestNow: Math.round(interestNow * 100) / 100, interestPromo: 0, saves: Math.round((interestNow - fee) * 100) / 100, promoMonths, feePct, payToClear: Math.round((balance * (1 + feePct)) / promoMonths * 100) / 100 };
    }
    return { id: r.id, name: r.name, balance, limit, utilisation: limit ? balance / limit : null, rate, minPayment, interestMonthly: r.interestMonthly, trap, transfer, hasDetail: !!r.detail, dueLater: trap && Number.isFinite(trap.months) && today ? addMonths(today, trap.months) : null };
  }).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.balance - a.balance);
  const totalBalance = cards.reduce((s, c) => s + c.balance, 0), totalLimit = cards.reduce((s, c) => s + (c.limit ?? 0), 0);
  return { cards, totalBalance, totalLimit, utilisation: totalLimit ? totalBalance / totalLimit : null, interestMonthly: cards.reduce((s, c) => s + (c.interestMonthly ?? 0), 0), count: cards.length, missing: cards.filter((c) => !c.hasDetail).map((c) => c.name), promoMonths, feePct, hasData: cards.length > 0 };
}
