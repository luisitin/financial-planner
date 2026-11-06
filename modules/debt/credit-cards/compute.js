// modules/debt/credit-cards/compute.js -- PURE. Every card: how much of its limit is used,
// its rate, what the minimum-payment trap would cost, and whether a balance transfer with a
// promotional rate would help. Limits come from the Debts page detail (creditLimit), the rest
// from the accounts and their rate/payment.
import { minimumOnly, bankMinimum } from "../../../core/math/payoff.js";
import { compute as computeDebts } from "../../balance/liabilities/compute.js";
import { addMonths } from "../../../core/math/dates.js";

/**
 * compute(plan, { today, promoMonths = 15, feePct = 0.03 }) -> {
 *   cards: [{ id, name, balance, limit, utilisation, rate, minPayment, interestMonthly, trap: { months, interest } | null,
 *             bank: bankMinimum(...) | null, transfer: { fee, interestNow, interestPromo, saves, payToClear, atPay } | null,
 *             carried (a balance carried month to month) }],
 *   totalBalance, totalLimit, utilisation, interestMonthly, count, missing: [names without rate],
 *   transferPlan: { count, payToClear, paying, atPay: { saves, owedAfter } } | null, carried, hasData
 * }
 * transfer.atPay (round 8 review, 2026-11-06): at the card's payment now (the Debts page's, else the minimum), the interest the
 * card would charge over the promo months, `saves` = that less the fee, `owedAfter` = balance x (1 + fee) - payment x months
 * (at least 0), what is left on the 0% card when the promo months end. transferPlan sums the cards whose transfer saves.
 * Minimum-payment trap: paying the required amount only (the Debts page's minimum, or 2% of the balance with a 25 floor).
 * That is the answer key's reading (tests/golden/debt/RULES.md: a typed minimum held level), which the page now shows only
 * as "if you keep paying $150 a month". `bank` (round 8, 2026-11-06) is what the page leads with: paying only what the
 * bank asks as it shrinks with the balance (core/math/payoff.js bankMinimum: the month's interest plus a share of the
 * balance read from the typed minimum, else 1%, at least $40 / $25).
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
    const bank = rate !== null && balance > 0 ? bankMinimum(balance, rate, minPayment) : null;
    let transfer = null;
    if (rate !== null && balance > 0) {
      // interest during the promo months if nothing changes vs the transfer fee (promo rate 0%), same monthly payment
      const pay = Math.max(minPayment, balance / promoMonths);
      let b = balance, interestNow = 0;
      for (let m = 0; m < promoMonths && b > 0; m++) { const i = b * rate / 12; interestNow += i; b = Math.max(0, b + i - pay); }
      const fee = balance * feePct;
      // at what is paid on the card now (round 8 review, 2026-11-06): the interest the card would charge over the promo months
      // at that payment, less the fee, and what is still owed on the 0% card when they end
      const now = Math.max(0, r.payment ?? minPayment);
      let b2 = balance, interestAtPay = 0;
      for (let m = 0; m < promoMonths && b2 > 0; m++) { const i = b2 * rate / 12; interestAtPay += i; b2 = Math.max(0, b2 + i - now); }
      const atPay = { payment: now, interest: Math.round(interestAtPay * 100) / 100, saves: Math.round((interestAtPay - fee) * 100) / 100, owedAfter: Math.round(Math.max(0, balance * (1 + feePct) - now * promoMonths) * 100) / 100 };
      transfer = { fee: Math.round(fee * 100) / 100, interestNow: Math.round(interestNow * 100) / 100, interestPromo: 0, saves: Math.round((interestNow - fee) * 100) / 100, promoMonths, feePct, payToClear: Math.round((balance * (1 + feePct)) / promoMonths * 100) / 100, atPay };
    }
    // what is really paid (the Debts page's payment: the required amount plus any extra typed there), when it is more
    const paying = r.detail && rate !== null && balance > 0 && r.payment > minPayment + 0.5 ? { payment: r.payment, months: r.months, endDate: r.payoffDate ?? null, interest: r.totalInterest ?? null, never: !!r.neverPaysOff } : null;
    // a balance carried from month to month: something owed and a minimum under the whole balance (or none typed)
    const carried = balance > 0 && !(minPayment > 0 && minPayment >= balance - 0.005);
    return { id: r.id, name: r.name, balance, limit, utilisation: limit ? balance / limit : null, rate, minPayment, payment: r.payment ?? minPayment, paying, interestMonthly: r.interestMonthly, trap, bank, transfer, carried, hasDetail: !!r.detail, dueLater: trap && Number.isFinite(trap.months) && today ? addMonths(today, trap.months) : null };
  }).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.balance - a.balance);
  const totalBalance = cards.reduce((s, c) => s + c.balance, 0), totalLimit = cards.reduce((s, c) => s + (c.limit ?? 0), 0);
  const under = totalLimit > 0 ? underLines(cards, totalLimit, today) : null;
  // the cards whose transfer pays, together (round 8 review): what clearing them in the promo months takes a month, what is
  // paid on them now, and the saving and what is left at today's payments
  const pays = cards.filter((c) => c.carried && c.transfer && c.transfer.saves > 0);
  const sum = (f) => Math.round(pays.reduce((t, c) => t + f(c), 0) * 100) / 100;
  const transferPlan = pays.length ? { count: pays.length, payToClear: sum((c) => c.transfer.payToClear), paying: sum((c) => c.transfer.atPay.payment), atPay: { saves: sum((c) => c.transfer.atPay.saves), owedAfter: sum((c) => c.transfer.atPay.owedAfter) } } : null;
  return { cards, totalBalance, totalLimit, utilisation: totalLimit ? totalBalance / totalLimit : null, under, interestMonthly: cards.reduce((s, c) => s + (c.interestMonthly ?? 0), 0), count: cards.length, missing: cards.filter((c) => !c.hasDetail).map((c) => c.name), promoMonths, feePct, transferPlan, carried: cards.some((c) => c.carried), hasData: cards.length > 0 };
}

/**
 * underLines(cards, totalLimit, today) -> { less30, less10, date30, date10 }: how much less on the cards gets the share of
 * the limits in use under 30% (what lenders like to see) and under 10% (best for the credit score), and about when, at
 * what is paid on each card now (its Debts payment, interest monthly at its rate; a card with no rate or payment stays
 * as it is). A date is null when it is not reached within 50 years, today when already under. Round 4, 2026-11-02: the
 * page said "under 30% is what lenders like to see" with no amount or date.
 */
export function underLines(cards, totalLimit, today) {
  const balances = cards.map((c) => c.balance), sum = () => balances.reduce((t, b) => t + b, 0);
  const less30 = Math.max(0, sum() - 0.3 * totalLimit), less10 = Math.max(0, sum() - 0.1 * totalLimit);
  let date30 = less30 <= 0 ? today : null, date10 = less10 <= 0 ? today : null;
  for (let m = 1; m <= 600 && (!date30 || !date10); m++) {
    cards.forEach((c, i) => { if (c.rate === null || !(c.payment > 0) || balances[i] <= 0) return; balances[i] = Math.max(0, balances[i] * (1 + c.rate / 12) - c.payment); });
    const share = sum() / totalLimit;
    if (!date30 && share <= 0.3) date30 = today ? addMonths(today, m) : null;
    if (!date10 && share <= 0.1) date10 = today ? addMonths(today, m) : null;
  }
  return { less30, less10, date30, date10 };
}
