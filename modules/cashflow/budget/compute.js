// modules/cashflow/budget/compute.js -- PURE. Envelopes: a monthly amount per spending
// category, spent so far this month from the transactions, what is left, whether the pace
// is right for the day of the month, and what rolled over from last month. Suggested amounts
// come from the last three full months of real spending.
// plan.budgets: [{ id, category, amount, period ("monthly"), rollover: bool }]
import { isTransfer, monthOf } from "../../transactions/ledger/compute.js";
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
 *   suggestions: [{ category, label, icon, average, months }] for categories without an envelope, hasBudget, hasData
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const month = params.month ?? (today ? today.slice(0, 7) : null);
  if (!month) return { month: null, label: "", envelopes: [], totals: { amount: 0, available: 0, spent: 0, left: 0 }, unbudgeted: [], suggestions: [], hasBudget: false, hasData: false, dayOfMonth: 0, daysInMonth: 30, daysLeft: 30 };
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
  // suggestions: the average of the last three full months, per spending category not yet budgeted
  const sums = new Map(), seen = new Map();
  for (let k = 1; k <= 3; k++) { const ym = addMonths(`${month}-01`, -k).slice(0, 7); const m = byCat(spendingOf(plan, ym)); if (!m.size) continue; for (const [c, v] of m) { sums.set(c, (sums.get(c) ?? 0) + v); seen.set(c, (seen.get(c) ?? 0) + 1); } }
  const monthsSeen = Math.max(1, ...seen.values());
  const suggestions = [...sums.entries()].filter(([c, v]) => c && !budgeted.has(c) && v > 0 && categoriesOf(plan).some((x) => x.id === c && x.kind === "expense")).map(([category, total]) => ({ category, label: categoryLabel(plan, category), icon: categoryIcon(plan, category), average: Math.round(total / monthsSeen), months: seen.get(category) })).sort((a, b) => b.average - a.average);
  const totals = { amount: envelopes.reduce((s, e) => s + e.amount, 0), available: envelopes.reduce((s, e) => s + e.available, 0), spent: envelopes.reduce((s, e) => s + e.spent, 0) };
  totals.left = totals.available - totals.spent;
  return { month, label: `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`, dayOfMonth, daysInMonth, daysLeft, envelopes, totals, unbudgeted, suggestions, hasBudget: envelopes.length > 0, hasData: (plan.transactions ?? []).length > 0 };
}
