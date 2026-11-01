// modules/cashflow/spending/compute.js -- PURE. Where the money went in one month: by
// category with shares, against the month before, and the payees that took the most.
import { isTransfer, monthOf, monthLabel, coverage, monthCover } from "../../transactions/ledger/compute.js";
import { categoryById, categoryLabel, categoryIcon } from "../../transactions/categories/compute.js";
import { addMonths } from "../../../core/math/dates.js";

const spendingOf = (plan, ym) => (plan.transactions ?? []).filter((t) => monthOf(t.date) === ym && !isTransfer(t, plan) && (categoryById(plan, t.category)?.kind ?? (Number(t.amount) >= 0 ? "income" : "expense")) === "expense");

/**
 * compute(plan, { month, today }) -> {
 *   month, label, months: [{ ym, label, full, firstDay, lastDay }] (every month with spending, newest first), total, count, previous: { ym, label, total } | null, change,
 *   byCategory: [{ category, label, icon, total, share, count, previous, change }], topPayees: [{ payee, total, count, category }],
 *   biggest: [{ ...tx }] (5 largest), daily: [{ day, total }], hasData,
 *   cover: { from, to, firstDay, lastDay, days, daysInMonth, full } (the part of the month the bank files cover),
 *   sameDays: { lo, hi } | null (when either month is only partly covered: the days of the month both cover, which the change compares),
 *   noOverlap (the months cover no common days, so there is no change), perDay (total / days covered, or / days in the month when full)
 * }
 * `month` defaults to the latest month with spending that the bank files fully cover (else the latest month with spending).
 * Spending = transactions whose category is a spending kind (or uncategorised money out). A partly covered month (a file
 * downloaded mid-month) is compared with the same days of the month before, never with a whole month.
 */
export function compute(plan, params = {}) {
  const all = plan.transactions ?? [];
  const monthsWith = [...new Set(all.filter((t) => !isTransfer(t, plan) && Number(t.amount) < 0).map((t) => monthOf(t.date)))].sort().reverse();
  const today = params.today ?? null;
  const cov = coverage(plan);
  const coverOf = (ym) => monthCover(cov, ym, today);
  const month = params.month && monthsWith.includes(params.month) ? params.month : (monthsWith.find((ym) => coverOf(ym).full) ?? monthsWith[0] ?? null);
  if (!month) return { month: null, label: "", months: [], total: 0, count: 0, previous: null, change: null, byCategory: [], topPayees: [], biggest: [], daily: [], hasData: false, cover: null, sameDays: null, noOverlap: false, perDay: 0 };
  const txs = spendingOf(plan, month);
  const prevYm = addMonths(`${month}-01`, -1).slice(0, 7);
  const cover = coverOf(month), prevCover = coverOf(prevYm);
  // the change compares whole months only when the files cover both; otherwise the days of the month both cover
  const whole = cover.full && prevCover.full;
  const lo = Math.max(cover.full ? 1 : cover.firstDay, prevCover.full ? 1 : prevCover.firstDay);
  const hi = Math.min(cover.full ? cover.daysInMonth : cover.lastDay, prevCover.full ? prevCover.daysInMonth : prevCover.lastDay);
  const sameDays = whole || !prevCover.days ? null : { lo, hi };
  const noOverlap = !!sameDays && lo > hi;
  const inSameDays = (t) => { const day = Number(String(t.date).slice(8, 10)); return !sameDays || (day >= sameDays.lo && day <= sameDays.hi); };
  const prevTxs = noOverlap ? [] : spendingOf(plan, prevYm).filter(inSameDays);
  const curCmp = sameDays ? txs.filter(inSameDays) : txs;
  // signed: money out counts as spending, a refund filed under a spending category reduces it
  const sumAbs = (arr) => arr.reduce((s, t) => s - (Number(t.amount) || 0), 0);
  const total = sumAbs(txs), prevTotal = sumAbs(prevTxs), curTotalCmp = sumAbs(curCmp);
  const byCat = (arr) => { const m = new Map(); for (const t of arr) { const k = t.category || ""; const c = m.get(k) ?? { category: k, label: categoryLabel(plan, k), icon: categoryIcon(plan, k), total: 0, count: 0 }; c.total -= Number(t.amount) || 0; c.count++; m.set(k, c); } return m; };
  const cur = byCat(txs), prev = byCat(prevTxs), curW = byCat(curCmp);
  const byCategory = [...cur.values()].filter((c) => c.total > 0).map((c) => { const p = prev.get(c.category)?.total ?? 0, w = curW.get(c.category)?.total ?? 0; return { ...c, share: total ? c.total / total : 0, previous: p, change: p && !noOverlap ? (w - p) / p : null }; }).sort((a, b) => b.total - a.total);
  const payees = new Map();
  for (const t of txs) { const k = t.payee || "(no description)"; const p = payees.get(k) ?? { payee: k, total: 0, count: 0, category: t.category }; p.total -= Number(t.amount) || 0; p.count++; payees.set(k, p); }
  const daily = new Map();
  for (const t of txs) { const day = String(t.date).slice(8, 10); daily.set(day, (daily.get(day) ?? 0) + Math.abs(Number(t.amount) || 0)); }
  return {
    month, label: monthLabel(month), months: monthsWith.map((ym) => { const c = coverOf(ym); return { ym, label: monthLabel(ym), full: c.full, firstDay: c.firstDay, lastDay: c.lastDay }; }), total, count: txs.length,
    previous: prevTxs.length ? { ym: prevYm, label: monthLabel(prevYm), total: prevTotal, current: curTotalCmp } : null, change: prevTotal ? (curTotalCmp - prevTotal) / prevTotal : null,
    cover, sameDays: noOverlap ? null : sameDays, noOverlap, perDay: total / (cover.full ? cover.daysInMonth : Math.max(1, cover.days)),
    byCategory, topPayees: [...payees.values()].filter((p) => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
    biggest: txs.filter((t) => Number(t.amount) < 0).sort((a, b) => Number(a.amount) - Number(b.amount)).slice(0, 5).map((t) => ({ ...t, categoryLabel: categoryLabel(plan, t.category) })),
    daily: [...daily.entries()].sort().map(([day, t]) => ({ day, total: t })), hasData: true,
  };
}
