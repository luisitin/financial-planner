// modules/debt/payoff/compute.js -- PURE. The payoff plan for every debt at once: the same
// budget (required payments plus whatever extra you choose) paid in three orders, with the
// month each debt ends, the total interest, and what an extra 100 a month would change.
// Debts come from the Debts page (liability accounts with a rate and a required payment).
import { payoffPlan, ORDERS } from "../../../core/math/payoff.js";
import { compute as computeDebts } from "../../balance/liabilities/compute.js";
import { addMonths } from "../../../core/math/dates.js";
import { HIGH_RATE, MODERATE_RATE } from "../../overview/next-best-action/compute.js";

/**
 * compute(plan, { today, extra?, order? }) -> {
 *   debts: [{ id, name, type, balance, rate, minPayment, required, extraSet }] (only ones with a rate and a payment; minPayment is
 *   the Debts page's payment: its minimum `required` plus any `extraSet` there), missing: [names without detail],
 *   extra, extraSaved (an extra was ever saved here), order, budget, required (the minimums), alreadyExtra (extras set on the Debts page),
 *   tie (every order ends the same month at the same interest), rollover: [{ id, name, planEnd, ownEnd }] (debts that end sooner
 *   because finished debts' payments move to them),
 *   plans: { avalanche, snowball, custom } each { months, endDate, totalInterest, totalPaid, debts: [{ id, name, months, endDate, interest }] },
 *   chosen (the one for plan.debtPlan.order), best (least interest), plus100 (months and interest saved by 100 more a month),
 *   baseline (required payments only), hasData
 * }
 * `params.extra` and `params.order` try another extra or order without saving it (the page's live preview and its offer).
 * `plan.debtPlan.targets` (or `params.targets`): ids the extra is aimed at; it goes to them only and stops once they are paid off
 * (`targets` lists the ones still owed; `targetsDone` when all are paid, and then `extra` is 0 and `extraTyped` keeps the amount).
 */

/**
 * offer(plan, { today, amount, stepId }) -> { amount, targets: [{ id, name }], soon, now, interestSaved, debtFree } | null
 * Next best action's debt step as one tap: `amount` a month aimed at the step's debts (stepId "high-debt": rate HIGH_RATE or
 * more; "mid-debt": MODERATE_RATE up to HIGH_RATE; mortgages never, as Next best action counts them), in the chosen order.
 * soon / now: when the last of them is gone with it / without it; null when it would not end them sooner (nothing to offer).
 */
export function offer(plan, { today = null, amount = 0, stepId = "" } = {}) {
  const amt = Math.floor((Number(amount) || 0) / 10) * 10;
  if (amt < 25 || (stepId !== "high-debt" && stepId !== "mid-debt")) return null;
  const base = compute(plan, { today });
  if (!base.hasData) return null;
  const targets = base.debts.filter((x) => x.type !== "mortgage" && x.rate !== null && (stepId === "high-debt" ? x.rate >= HIGH_RATE : x.rate >= MODERATE_RATE && x.rate < HIGH_RATE));
  if (!targets.length) return null;
  const ids = targets.map((x) => x.id);
  const withIt = compute(plan, { today, extra: amt, targets: ids });
  const endOf = (r) => ids.map((id) => r.chosen.debts.find((y) => y.id === id)?.endDate).filter(Boolean).sort().pop() ?? null;
  const interestOf = (r) => ids.reduce((t, id) => t + (r.chosen.debts.find((y) => y.id === id)?.interest ?? 0), 0);
  const soon = endOf(withIt), now = endOf(base);
  if (!soon || (now && soon.slice(0, 7) >= now.slice(0, 7))) return null;
  return { amount: amt, targets: targets.map((x) => ({ id: x.id, name: x.name })), soon, now, interestSaved: Math.max(0, Math.round((interestOf(base) - interestOf(withIt)) * 100) / 100), debtFree: withIt.chosen.endDate };
}
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const dp = plan.debtPlan ?? {};
  const extraSaved = dp.extra !== undefined && dp.extra !== null && dp.extra !== "";
  const extraTyped = Math.max(0, Number(params.extra ?? dp.extra) || 0);
  const order = ORDERS[params.order] ? params.order : ORDERS[dp.order] ? dp.order : "avalanche";
  const customOrder = Array.isArray(dp.customOrder) ? dp.customOrder : [];
  const li = computeDebts(plan, { today });
  const inPlan = li.rows.filter((r) => r.detail && r.owed > 0 && r.payment > 0);
  // an extra aimed at some debts (the offer below, from Next best action's step) goes to them only and stops when they are paid off
  const aimedAt = Array.isArray(params.targets) ? params.targets : Array.isArray(dp.targets) ? dp.targets : [];
  const targets = aimedAt.filter((id) => inPlan.some((r) => r.id === id));
  const targetsDone = aimedAt.length > 0 && !targets.length;   // every debt it was aimed at is paid off: the extra has stopped
  const debts = inPlan.map((r) => ({ id: r.id, name: r.name, type: r.type, balance: r.owed, rate: r.rate, minPayment: r.payment, required: r.minPayment, extraSet: r.extra, ...(targets.includes(r.id) ? { takesExtra: true } : {}) }));
  const extra = targetsDone ? 0 : extraTyped;
  const missing = li.rows.filter((r) => r.owed > 0 && !(r.detail && r.payment > 0)).map((r) => r.name);
  const required = inPlan.reduce((t, r) => t + r.minPayment, 0), alreadyExtra = inPlan.reduce((t, r) => t + r.extra, 0);
  if (!debts.length) return { debts, missing, extra, extraTyped, extraSaved, order, targets, targetsDone, budget: 0, required, alreadyExtra, tie: false, rollover: [], plans: {}, chosen: null, best: null, plus100: null, baseline: null, hasData: false };
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
  // the orders tie when they end the same month at the same interest (to the dollar): then "least interest" means nothing
  const keys = ["avalanche", "snowball", "custom"];
  const tie = keys.every((k) => plans[k].months === chosen.months && Math.abs(plans[k].totalInterest - chosen.totalInterest) < 1);
  // a debt that ends months sooner in the plan than on its own payment (the Debts page's date): finished debts' payments moved to it
  const rollover = inPlan.map((r) => {
    const planEnd = chosen.debts.find((x) => x.id === r.id)?.endDate ?? null;
    return { id: r.id, name: r.name, type: r.type, planEnd, ownEnd: r.payoffDate ?? null };
  }).filter((x) => x.planEnd && x.ownEnd && x.planEnd.slice(0, 7) < x.ownEnd.slice(0, 7) && extra === 0);
  return { debts, missing, extra, extraTyped, extraSaved, order, customOrder, targets, targetsDone, budget: chosen ? debts.reduce((s, d) => s + d.minPayment, 0) + extra : 0, required, alreadyExtra, tie, rollover, plans, chosen, best: best.k, plus100, baseline, hasData: true };
}

/**
 * savedPlan(plan, { today }) -> { extra, ids, names, until, months, ends } | null: the saved debt plan's extra a month on top of the
 * required payments (money already spoken for until the debts it is aimed at are gone: all of them when it is aimed at
 * none, as it rolls from one to the next), the debts it goes to, and when the last of them is gone (`until`, `months`; null
 * when one never ends; `ends`: the chosen order's row for each of them, { id, name, months, endDate, ... }). null without a
 * saved extra, or once the debts it was aimed at are paid off. The one reading of it
 * that Next best action's left-over figure and Budget (50/30/20) both take, so they leave the same money (review
 * 2026-11-02, round 5: Budget left the extra out and said "about $1,200" where every other page said "about $1,050").
 */
export function savedPlan(plan, params = {}) {
  let pay = null;
  try { pay = compute(plan, { today: params.today ?? null }); } catch { pay = null; }
  if (!pay?.hasData || !(pay.extra > 0)) return null;
  const ids = pay.targets.length ? pay.targets : pay.debts.map((x) => x.id);
  const ends = ids.map((id) => pay.chosen.debts.find((x) => x.id === id)).filter(Boolean);
  const last = ends.length === ids.length && ends.every((x) => Number.isFinite(x.months)) ? ends.reduce((a, b) => (b.months > a.months ? b : a)) : null;
  return { extra: pay.extra, ids, names: ids.map((id) => pay.debts.find((x) => x.id === id)?.name).filter(Boolean), until: last?.endDate ?? null, months: last ? last.months : null, ends };
}

/**
 * twoDates(plan, { today }) -> { [debtId]: { own, plan, from: [names], extra } }: for each debt that the payoff plan finishes
 * at least a month sooner than its own payment does, both dates and why. `own` is the Debts page's date (its own payment
 * alone); `plan` is this page's (each finished debt's payment moves onto the next, plus any extra a month); `from` names the
 * debts the plan finishes first, whose payments move onto it. Round 4, 2026-11-02: Debts and Mortgage said January 2046
 * for the family's mortgage while the Timeline, Plan summary and Quick answers said March 2039, with no word on why.
 */
export function twoDates(plan, params = {}) {
  let P = null;
  try { P = compute(plan, params); } catch { P = null; }
  if (!P?.hasData || !P.chosen) return {};
  let li = null;
  try { li = computeDebts(plan, params); } catch { li = null; }
  const out = {};
  for (const d of P.chosen.debts) {
    const own = li?.rows.find((r) => r.id === d.id)?.payoffDate ?? null;
    if (!own || !d.endDate || d.endDate.slice(0, 7) >= own.slice(0, 7)) continue;
    const from = P.chosen.debts.filter((x) => x.id !== d.id && x.endDate && x.endDate < d.endDate).map((x) => x.name).filter(Boolean);
    out[d.id] = { own, plan: d.endDate, from, extra: P.extra };
  }
  return out;
}
