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
 *   debts: [{ id, name, type, balance, rate, minPayment, escrow, required, extraSet }] (only ones with a rate and a payment; minPayment is
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
 * `plan.debtPlan.lumps` (gap #3, 2026-11-13): one-time payments [{ id, month: "YYYY-MM", amount (> 0 paid on top that month,
 * < 0 that much less paid that month), debtId ("" = the next debt in the order) }]. Every plan here (the three orders, the
 * $100 more) carries them, so every page that reads this compute shows the same debt-free month; `baseline` ("nothing more
 * than today's payments") leaves them out, and the roll-over note is not given with them. Only when at least one is saved,
 * the result gains `lumps` (the ones still to come, as core/math/payoff.js takes them: other pages pass them on),
 * `lumpLines` (each saved one with its effect, lumpLine below) and `lumpEffect` (all of them on the chosen order). A month
 * before today's is left out of the math ("past"); today's month counts with the plan's first payment, next month.
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
  const savedOrder = Array.isArray(dp.customOrder) ? dp.customOrder : [];
  const li = computeDebts(plan, { today });
  const inPlan = li.rows.filter((r) => r.detail && r.owed > 0 && r.payment > 0);
  // "My own order" starts from the order the page showed before it was picked (the saved order, else highest rate first), and a
  // debt the saved own order does not have yet goes in at its place in that order: unsorted debts used to fall into A to Z order
  // (core/math/payoff.js ranks an unknown id last, names breaking the tie), which read as a reshuffle and cost more interest
  const startFrom = dp.order === "snowball" ? (a, b) => a.owed - b.owed : (a, b) => (b.rate ?? 0) - (a.rate ?? 0);
  const customOrder = [...savedOrder.filter((id) => inPlan.some((r) => r.id === id)), ...[...inPlan].sort(startFrom).map((r) => r.id).filter((id) => !savedOrder.includes(id))];
  // an extra aimed at some debts (the offer below, from Next best action's step) goes to them only and stops when they are paid off
  const aimedAt = Array.isArray(params.targets) ? params.targets : Array.isArray(dp.targets) ? dp.targets : [];
  const targets = aimedAt.filter((id) => inPlan.some((r) => r.id === id));
  const targetsDone = aimedAt.length > 0 && !targets.length;   // every debt it was aimed at is paid off: the extra has stopped
  const debts = inPlan.map((r) => ({ id: r.id, name: r.name, type: r.type, balance: r.owed, rate: r.rate, minPayment: r.payment, escrow: r.escrow ?? 0, required: r.minPayment, extraSet: r.extra, ...(targets.includes(r.id) ? { takesExtra: true } : {}) }));
  const extra = targetsDone ? 0 : extraTyped;
  const missingRows = li.rows.filter((r) => r.owed > 0 && !(r.detail && r.payment > 0)).map((r) => ({ id: r.id, name: r.name }));
  const missing = missingRows.map((r) => r.name);
  const required = inPlan.reduce((t, r) => t + r.minPayment, 0), alreadyExtra = inPlan.reduce((t, r) => t + r.extra, 0);
  if (!debts.length) return { debts, missing, missingRows, extra, extraTyped, extraSaved, order, targets, targetsDone, budget: 0, required, alreadyExtra, tie: false, rollover: [], plans: {}, chosen: null, best: null, plus100: null, baseline: null, hasData: false };
  // one-time payments: the saved ones placed in the plan's months (a past month is left out; today's counts with the first)
  const saved = lumpsOf(plan);
  const placed = saved.map((l) => ({ ...l, at: lumpMonth(l.month, today) }));
  const active = placed.filter((l) => l.at !== null && l.at >= 0).map((l) => ({ id: l.id, month: Math.max(1, l.at), amount: l.amount, debtId: l.debtId }));
  const run = (o, ex, once = active) => {
    const r = payoffPlan(debts, { extra: ex, order: o, customOrder, ...(once.length ? { lumps: once } : {}) });
    const date = (m) => today && Number.isFinite(m) ? addMonths(today, m) : null;
    return { months: r.months, endDate: date(r.months), totalInterest: r.totalInterest, totalPaid: r.totalPaid, neverPaysOff: r.neverPaysOff, debts: r.debts.map((d) => ({ ...d, endDate: date(d.months) })), timeline: r.timeline, ...(r.lumpEffect ? { lumpEffect: r.lumpEffect } : {}) };
  };
  const plans = { avalanche: run("avalanche", extra), snowball: run("snowball", extra), custom: run("custom", extra) };
  const chosen = plans[order];
  const best = ["avalanche", "snowball", "custom"].map((k) => ({ k, ...plans[k] })).sort((a, b) => a.totalInterest - b.totalInterest)[0];
  const more = run(order, extra + 100);
  const plus100 = Number.isFinite(chosen.months) && Number.isFinite(more.months) ? { months: chosen.months - more.months, interest: Math.round((chosen.totalInterest - more.totalInterest) * 100) / 100 } : null;
  // "nothing more than today's payments": no extra and no one-time payments
  const baseline = run(order, 0, []);
  // the orders tie when they end the same month at the same interest (to the dollar): then "least interest" means nothing
  const keys = ["avalanche", "snowball", "custom"];
  const tie = keys.every((k) => plans[k].months === chosen.months && Math.abs(plans[k].totalInterest - chosen.totalInterest) < 1);
  // a debt that ends months sooner in the plan than on its own payment (the Debts page's date): finished debts' payments moved to it
  // (not with an extra or a one-time payment here: they speed the debts too, and the note would give one reason of two)
  const rollover = inPlan.map((r) => {
    const planEnd = chosen.debts.find((x) => x.id === r.id)?.endDate ?? null;
    return { id: r.id, name: r.name, type: r.type, planEnd, ownEnd: r.payoffDate ?? null };
  }).filter((x) => x.planEnd && x.ownEnd && x.planEnd.slice(0, 7) < x.ownEnd.slice(0, 7) && extra === 0 && !active.length);
  const out = { debts, missing, missingRows, extra, extraTyped, extraSaved, order, customOrder, targets, targetsDone, budget: chosen ? debts.reduce((s, d) => s + d.minPayment, 0) + extra : 0, required, alreadyExtra, tie, rollover, plans, chosen, best: best.k, plus100, baseline, hasData: true };
  if (!saved.length) return out;
  // each saved line against the same plan without it (so every line's "debt-free by" is the headline's)
  out.lumps = active;
  out.lumpEffect = chosen.lumpEffect ?? { monthsSooner: 0, interestSaved: 0 };
  out.lumpLines = placed.map((l) => lumpLine(l, { chosen, without: l.at !== null && l.at >= 0 ? run(order, extra, active.filter((x) => x.id !== l.id)) : null, debts }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return out;
}

// ---------------------------------------------------------------- one-time payments (gap #3)
/** The most one line takes: a slip of the thumb is held at the box (10,000,000), not saved. Ours, not a rule. */
export const LUMP_MAX = 10000000;
/**
 * lumpMonth("YYYY-MM", today) -> months from today's month to that month (next month 1, this month 0, last month -1), or null
 * when the month or today cannot be read.
 */
export function lumpMonth(month, today) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month ?? "").trim()), t = /^(\d{4})-(\d{2})/.exec(String(today ?? ""));
  if (!m || !t || +m[2] < 1 || +m[2] > 12) return null;
  return (+m[1] * 12 + +m[2]) - (+t[1] * 12 + +t[2]);
}
/** The saved one-time payments that can be read: [{ id, month, amount, debtId }] (a line without a month or an amount is left out). */
export function lumpsOf(plan) {
  const list = Array.isArray(plan?.debtPlan?.lumps) ? plan.debtPlan.lumps : [];
  return list.map((l, i) => ({ id: String(l?.id ?? `lump-${i}`), month: String(l?.month ?? "").trim(), amount: Number(l?.amount), debtId: String(l?.debtId ?? "") }))
    .filter((l) => /^\d{4}-(0[1-9]|1[0-2])$/.test(l.month) && Number.isFinite(l.amount) && l.amount !== 0);
}
/**
 * lumpLine(line, { chosen, without, debts }) -> { id, month, amount, debtId, debtName, at, kind, endDate, endWithout,
 * months, monthsWithout, interestDelta }: what one saved line does to the chosen plan (with every line) against the same
 * plan without it. `interestDelta` = interest without it less interest with it (more than 0: it saves interest). `kind`,
 * the first that applies:
 *   past     its month is before today's: left out of the math
 *   after    the plan without it is over before its month: it changes nothing
 *   never    the plan with every line never ends
 *   ends     the plan ends only with it
 *   sooner / later   the debt-free month moves
 *   same     the same month, a dollar or more of interest either way
 *   nothing  the same month and less than a dollar (a month with nothing above the debts' own payments to hold back)
 */
export function lumpLine(l, { chosen, without, debts = [] }) {
  const debtName = (l.debtId && debts.find((x) => x.id === l.debtId)?.name) || null;
  const base = { id: l.id, month: l.month, amount: l.amount, debtId: l.debtId, debtName, at: l.at };
  if (l.at === null || l.at < 0 || !without) return { ...base, kind: "past", endDate: chosen.endDate, endWithout: chosen.endDate, months: chosen.months, monthsWithout: chosen.months, interestDelta: 0 };
  const fin = (m) => Number.isFinite(m);
  const interestDelta = fin(chosen.months) && fin(without.months) ? Math.round((without.totalInterest - chosen.totalInterest) * 100) / 100 : 0;
  const at = Math.max(1, l.at);
  const kind = fin(without.months) && at > without.months ? "after"
    : !fin(chosen.months) ? "never"
    : !fin(without.months) ? "ends"
    : chosen.months < without.months ? "sooner"
    : chosen.months > without.months ? "later"
    : Math.abs(interestDelta) >= 1 ? "same" : "nothing";
  return { ...base, kind, endDate: chosen.endDate, endWithout: without.endDate, months: chosen.months, monthsWithout: without.months, interestDelta };
}
/**
 * monthByMonth(x, today) -> [{ month: "YYYY-MM", paid, interest, once, balances: { [id]: balance }, total }]: the chosen plan of
 * compute(plan, { today }) month by month, for the printed sheet (Q8). `once` is the one-time money of the month (0 without).
 */
export function monthByMonth(x, today) {
  if (!x?.hasData || !x.chosen || !today) return [];
  return x.chosen.timeline.map((r) => ({ month: String(addMonths(today, r.month)).slice(0, 7), paid: r.paid, interest: r.interest, once: r.once ?? 0, balances: r.balances, total: r.total }));
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
