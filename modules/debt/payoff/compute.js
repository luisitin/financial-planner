// modules/debt/payoff/compute.js -- PURE. The payoff plan for every debt at once: the same
// budget (required payments plus whatever extra you choose) paid in three orders, with the
// month each debt ends, the total interest, and what an extra 100 a month would change.
// Debts come from the Debts page (liability accounts with a rate and a required payment).
import { payoffPlan, ORDERS } from "../../../core/math/payoff.js";
import { compute as computeDebts } from "../../balance/liabilities/compute.js";
import { addMonths, monthsBetween, isValidDate } from "../../../core/math/dates.js";
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

// ---------------------------------------------------------------- against the plan (gap #29)
/** A dollar or less either way is "on track": balances are typed to the cent, the plan rounds to the cent. Ours. */
export const ON_TRACK_DOLLARS = 1;
/**
 * stampStart(draft, today): the day the plan started counting, `debtPlan.startedAt`, set the first time the plan is saved
 * (only when absent; "Start counting from today" sets it again with `again: true`). Changes `draft` in place.
 */
export function stampStart(draft, today, { again = false } = {}) {
  if (!draft || !isValidDate(today)) return;
  const dp = draft.debtPlan ?? {};
  if (!again && isValidDate(dp.startedAt)) return;
  draft.debtPlan = { ...dp, startedAt: today };
}
/** An account's balances by date, oldest first: its history points and the balance on file (that one wins a shared day). */
function pointsOf(a) {
  const pts = new Map();
  for (const h of Array.isArray(a?.history) ? a.history : []) if (isValidDate(h?.date) && Number.isFinite(Number(h.balance))) pts.set(h.date, Math.abs(Number(h.balance)));
  if (isValidDate(a?.asOf) && Number.isFinite(Number(a.balance))) pts.set(a.asOf, Math.abs(Number(a.balance)));
  return [...pts.entries()].map(([date, balance]) => ({ date, balance })).sort((x, y) => x.date.localeCompare(y.date));
}
/**
 * against(plan, { today }) -> null | { since, waiting, debts, left, total } (gap #29, 2026-11-13)
 * How the debts stand against the payoff plan since `debtPlan.startedAt`. null without a start day, or before a month has
 * gone by (nothing to compare yet: the page shows no row).
 *   since    the start day
 *   waiting  true when no debt has a balance dated after the start: "Update your balances to see this"
 *   debts    [{ id, name, startBal, owedNow, nowDate, months, planned, diff, ahead, more }] for each debt in the plan that has a
 *            balance on or before the start and one after it: `months` whole months from the start to the newer balance's
 *            day, `planned` the plan's balance for it by then, `diff` = planned - owedNow (above 0: less owed than planned),
 *            `ahead` = the month the plan comes down to today's balance less `months`, to the nearest whole month (above 0
 *            ahead, below 0 behind, 0 on track: within ON_TRACK_DOLLARS of the plan, or under half a month either way; the
 *            month is read in a straight line between the plan's months on either side; null with `more: true` when more is
 *            owed than at the start)
 *   left     [{ id, name }] debts left out (no balance from on or before the start, e.g. added later)
 *   total    { owedNow, planned, diff, ahead, more } the same for all of them together, on the plan's total and the
 *            latest newer balance's month
 * The plan is the one saved today (extra, order, own order, one-time payments, debts it is aimed at), run from the balances
 * on the start day with today's payments; a one-time payment is placed by months from the start.
 */
export function against(plan, { today = null } = {}) {
  const dp = plan?.debtPlan ?? {};
  const since = isValidDate(dp.startedAt) ? dp.startedAt : null;
  if (!since || !isValidDate(today) || since > today || !(monthsBetween(since, today) >= 1)) return null;
  let li = null;
  try { li = computeDebts(plan, { today }); } catch { li = null; }
  const accounts = new Map((plan.accounts ?? []).map((a) => [a.id, a]));
  const rows = [], left = [];
  for (const r of li?.rows ?? []) {
    if (!r.detail || r.rate === null) continue;
    const pay = (Number(r.detail.minPayment) || 0) + (Number(r.detail.extra) || 0);
    if (!(pay > 0)) continue;
    const pts = pointsOf(accounts.get(r.id));
    const before = [...pts].reverse().find((p) => p.date <= since) ?? null;
    const latest = pts.at(-1) ?? null;
    if (!before) { if (r.owed > 0) left.push({ id: r.id, name: r.name }); continue; }
    if (!(before.balance > 0)) continue;   // nothing owed at the start: not in the plan then
    rows.push({ id: r.id, name: r.name, rate: r.rate, minPayment: pay, escrow: Number(r.detail.escrowMonthly) || 0, startBal: before.balance, latest: latest && latest.date > since ? latest : null });
  }
  if (!rows.length) return null;   // no debt in the plan has a balance from the start: nothing to compare
  const newer = rows.filter((x) => x.latest);
  if (!newer.length) return { since, waiting: true, debts: [], left, total: null };
  const order = ORDERS[dp.order] ? dp.order : "avalanche";
  const customOrder = Array.isArray(dp.customOrder) ? dp.customOrder : [];
  const aimed = Array.isArray(dp.targets) ? dp.targets : [];
  const lumps = lumpsOf(plan).map((l) => ({ ...l, at: lumpMonth(l.month, since) })).filter((l) => l.at !== null && l.at >= 0)
    .map((l) => ({ id: l.id, month: Math.max(1, l.at), amount: l.amount, debtId: l.debtId }));
  const run = payoffPlan(rows.map((x) => ({ id: x.id, name: x.name, balance: x.startBal, rate: x.rate, minPayment: x.minPayment, escrow: x.escrow, ...(aimed.includes(x.id) ? { takesExtra: true } : {}) })),
    { extra: Math.max(0, Number(dp.extra) || 0), order, customOrder, ...(lumps.length ? { lumps } : {}) });
  const tl = run.timeline ?? [];
  const at = (m, get, start) => (m <= 0 ? start : tl[m - 1] ? get(tl[m - 1]) : 0);   // after the plan's last month: nothing owed
  // months ahead (above 0) or behind (below 0) of the plan, to the nearest whole month: within a dollar of the plan's balance is
  // on track; else the month the plan's balance comes down to what is owed now, read between the plan's two months on either
  // side of it, less the months gone by; null when more is owed than at the start
  const aheadOf = (owed, get, start, months) => {
    if (Math.abs(at(months, get, start) - owed) <= ON_TRACK_DOLLARS) return 0;
    if (owed > start + ON_TRACK_DOLLARS) return null;
    let k = 0;
    while (k < tl.length && at(k, get, start) > owed) k++;
    const hi = k > 0 ? at(k - 1, get, start) : start, lo = at(k, get, start);
    const t = k > 0 && hi > lo ? k - 1 + (hi - owed) / (hi - lo) : k;
    return Math.round(t - months) || 0;
  };
  const cents = (v) => Math.round(v * 100) / 100;
  const debts = newer.map((x) => {
    const months = Math.max(0, monthsBetween(since, x.latest.date) ?? 0);
    const get = (row) => row.balances[x.id] ?? 0;
    const planned = cents(at(months, get, x.startBal)), owedNow = x.latest.balance;
    const ahead = aheadOf(owedNow, get, x.startBal, months);
    return { id: x.id, name: x.name, startBal: x.startBal, owedNow, nowDate: x.latest.date, months, planned, diff: cents(planned - owedNow), ahead, more: ahead === null };
  });
  // all together: the debts with a newer balance, at the latest of those days (the others as the plan has them)
  const months = Math.max(...debts.map((x) => x.months));
  const ids = new Set(debts.map((x) => x.id));
  const startTotal = debts.reduce((s, x) => s + x.startBal, 0), owedNow = cents(debts.reduce((s, x) => s + x.owedNow, 0));
  const getT = (row) => [...ids].reduce((s, id) => s + (row.balances[id] ?? 0), 0);
  const planned = cents(at(months, getT, startTotal));
  const ahead = aheadOf(owedNow, getT, startTotal, months);
  return { since, waiting: false, debts, left, total: { owedNow, planned, diff: cents(planned - owedNow), ahead, more: ahead === null, months } };
}
/** A few words for the row beside "Against your plan": "2 months ahead", "on track", "1 month behind", "owe more". */
export function againstSays(a) {
  if (!a) return "";
  if (a.waiting) return "update balances";
  const t = a.total;
  if (t.more) return "owe more";
  if (t.ahead === 0) return "on track";
  const n = Math.abs(t.ahead);
  return `${n} month${n === 1 ? "" : "s"} ${t.ahead > 0 ? "ahead" : "behind"}`;
}
