// modules/debt/payoff/compute.js -- PURE. The payoff plan for every debt at once: the same
// budget (required payments plus whatever extra you choose) paid in three orders, with the
// month each debt ends, the total interest, and what an extra 100 a month would change.
// Debts come from the Debts page (liability accounts with a rate and a required payment).
import { payoffPlan, ORDERS } from "../../../core/math/payoff.js";
import { compute as computeDebts } from "../../balance/liabilities/compute.js";
import { addMonths } from "../../../core/math/dates.js";

/**
 * compute(plan, { today }) -> {
 *   debts: [{ id, name, balance, rate, minPayment }] (only ones with a rate and a payment), missing: [names without detail],
 *   extra, order, budget,
 *   plans: { avalanche, snowball, custom } each { months, endDate, totalInterest, totalPaid, debts: [{ id, name, months, endDate, interest }] },
 *   chosen (the one for plan.debtPlan.order), best (least interest), plus100 (months and interest saved by 100 more a month),
 *   baseline (required payments only), hasData
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const dp = plan.debtPlan ?? {};
  const extra = Math.max(0, Number(dp.extra) || 0);
  const order = ORDERS[dp.order] ? dp.order : "avalanche";
  const customOrder = Array.isArray(dp.customOrder) ? dp.customOrder : [];
  const li = computeDebts(plan, { today });
  const debts = li.rows.filter((r) => r.detail && r.owed > 0 && r.payment > 0).map((r) => ({ id: r.id, name: r.name, balance: r.owed, rate: r.rate, minPayment: r.payment }));
  const missing = li.rows.filter((r) => r.owed > 0 && !(r.detail && r.payment > 0)).map((r) => r.name);
  if (!debts.length) return { debts, missing, extra, order, budget: 0, plans: {}, chosen: null, best: null, plus100: null, baseline: null, hasData: false };
  const run = (o, ex) => {
    const r = payoffPlan(debts, { extra: ex, order: o, customOrder });
    const date = (m) => today && Number.isFinite(m) ? addMonths(today, m) : null;
    return { months: r.months, endDate: date(r.months), totalInterest: r.totalInterest, totalPaid: r.totalPaid, neverPaysOff: r.neverPaysOff, debts: r.debts.map((d) => ({ ...d, endDate: date(d.months) })), timeline: r.timeline };
  };
  const plans = { avalanche: run("avalanche", extra), snowball: run("snowball", extra), custom: run("custom", extra) };
  const chosen = plans[order];
  const best = ["avalanche", "snowball", "custom"].map((k) => ({ k, ...plans[k] })).sort((a, b) => a.totalInterest - b.totalInterest)[0];
  const more = run(order, extra + 100);
  const plus100 = Number.isFinite(chosen.months) && Number.isFinite(more.months) ? { months: chosen.months - more.months, interest: Math.round((chosen.totalInterest - more.totalInterest) * 100) / 100 } : null;
  const baseline = run(order, 0);
  return { debts, missing, extra, order, customOrder, budget: chosen ? debts.reduce((s, d) => s + d.minPayment, 0) + extra : 0, plans, chosen, best: best.k, plus100, baseline, hasData: true };
}
