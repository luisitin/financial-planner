// modules/cashflow/budget/compute.js -- PURE. Envelopes: a monthly amount per spending
// category, spent so far this month from the transactions, what is left, whether the pace
// is right for the day of the month, and what rolled over from last month. Suggested amounts
// come from the last three months the bank files fully cover.
// plan.budgets: [{ id, category, amount, period ("monthly"), rollover: bool }]
import { isTransfer, monthOf, coverage, monthCover, COVER_SLACK } from "../../transactions/ledger/compute.js";
import { categoriesOf, categoryById, categoryLabel, categoryIcon } from "../../transactions/categories/compute.js";
import { addMonths } from "../../../core/math/dates.js";

const spendingOf = (plan, ym) => (plan.transactions ?? []).filter((t) => monthOf(t.date) === ym && !isTransfer(t, plan) && (categoryById(plan, t.category)?.kind ?? (Number(t.amount) >= 0 ? "income" : "expense")) === "expense");
const byCat = (txs) => { const m = new Map(); for (const t of txs) m.set(t.category || "", (m.get(t.category || "") ?? 0) - (Number(t.amount) || 0)); return m; };
const daysIn = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();

/**
 * compute(plan, { today, month }) -> {
 *   month, label, dayOfMonth, daysInMonth, daysLeft,
 *   envelopes: [{ id, category, label, icon, amount, rollover, carried, available, spent, left, share, pace ("under"|"on"|"over"), expectedByNow }],
 *   totals: { amount, available, spent, left }, unbudgeted: [{ category, label, icon, spent }] (spending this month with no envelope),
 *   suggestions: [{ category, label, icon, average, months }] for categories without an envelope, hasBudget, hasData,
 *   suggestFrom: [ym] (the whole months the suggestions average over), cover: { from, to } | null (the days the bank files cover),
 *   stale (the files stop more than COVER_SLACK days before today in this month, so "spent so far" is missing the latest days)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const month = params.month ?? (today ? today.slice(0, 7) : null);
  if (!month) return { month: null, label: "", envelopes: [], totals: { amount: 0, available: 0, spent: 0, left: 0 }, unbudgeted: [], suggestions: [], hasBudget: false, hasData: false, dayOfMonth: 0, daysInMonth: 30, daysLeft: 30, suggestFrom: [], cover: null, stale: false };
  const daysInMonth = daysIn(month);
  const dayOfMonth = today && today.slice(0, 7) === month ? Number(today.slice(8, 10)) : (today && today.slice(0, 7) > month ? daysInMonth : 0);
  const daysLeft = daysInMonth - dayOfMonth;
  const spent = byCat(spendingOf(plan, month));
  const prevYm = addMonths(`${month}-01`, -1).slice(0, 7);
  const prev = byCat(spendingOf(plan, prevYm));
  const budgets = (plan.budgets ?? []).filter((b) => b.category);
  const envelopes = budgets.map((b) => {
    const amount = Number(b.amount) || 0;
    const carried = b.rollover ? Math.max(0, amount - (prev.get(b.category) ?? 0)) : 0;   // last month's unspent, never a debt
    const available = amount + carried;
    const sp = spent.get(b.category) ?? 0;
    const left = available - sp;
    const expectedByNow = available * (dayOfMonth / daysInMonth);
    const pace = sp > available ? "over" : sp > expectedByNow * 1.1 + 1 ? "ahead" : "on";
    return { id: b.id, category: b.category, label: categoryLabel(plan, b.category), icon: categoryIcon(plan, b.category), amount, rollover: !!b.rollover, carried, available, spent: sp, left, share: available ? Math.min(1, sp / available) : 0, pace, expectedByNow };
  }).sort((a, b) => b.available - a.available);
  const budgeted = new Set(budgets.map((b) => b.category));
  const unbudgeted = [...spent.entries()].filter(([c, v]) => !budgeted.has(c) && v > 0).map(([category, sp]) => ({ category, label: categoryLabel(plan, category), icon: categoryIcon(plan, category), spent: sp })).sort((a, b) => b.spent - a.spent);
  // suggestions: per spending category not yet budgeted, the average over the last three months the bank files cover from
  // start to end (a month cut by the file would read low), divided by the number of those months, so "average of N months" is
  // the N it was divided by; a month with nothing in a category counts as nothing spent
  const cov = coverage(plan);
  const suggestFrom = [];
  for (let k = 1; k <= 3; k++) { const ym = addMonths(`${month}-01`, -k).slice(0, 7); if (monthCover(cov, ym, today).full) suggestFrom.push(ym); }
  const sums = new Map();
  for (const ym of suggestFrom) for (const [c, v] of byCat(spendingOf(plan, ym))) sums.set(c, (sums.get(c) ?? 0) + v);
  const n = suggestFrom.length;
  const suggestions = n ? [...sums.entries()].filter(([c, v]) => c && !budgeted.has(c) && v > 0 && categoriesOf(plan).some((x) => x.id === c && x.kind === "expense")).map(([category, total]) => ({ category, label: categoryLabel(plan, category), icon: categoryIcon(plan, category), average: Math.round(total / n), months: n })).sort((a, b) => b.average - a.average) : [];
  // this month's "spent so far" is short when the files stop more than COVER_SLACK days before today
  const dayNo = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 864e5;
  const stale = !!(cov && today && today.slice(0, 7) === month && dayNo(today) - dayNo(cov.to) > COVER_SLACK);
  const totals = { amount: envelopes.reduce((s, e) => s + e.amount, 0), available: envelopes.reduce((s, e) => s + e.available, 0), spent: envelopes.reduce((s, e) => s + e.spent, 0) };
  totals.left = totals.available - totals.spent;
  return { month, label: `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`, dayOfMonth, daysInMonth, daysLeft, envelopes, totals, unbudgeted, suggestions, hasBudget: envelopes.length > 0, hasData: (plan.transactions ?? []).length > 0, suggestFrom, cover: cov, stale };
}
