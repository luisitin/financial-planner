// modules/cashflow/income-statement/compute.js -- PURE. Month by month: what came in, what
// went out, what was kept, from the transactions (transfers excluded). Next to it, what the
// Income and Expenses pages say should happen each month, so the two can be compared.
import { isTransfer, monthOf, monthLabel } from "../../transactions/ledger/compute.js";
import { categoryById, categoryLabel, categoryIcon } from "../../transactions/categories/compute.js";
import { compute as computeIncome } from "../income/compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";

/**
 * compute(plan, { months = 12, today }) -> {
 *   rows: [{ ym, label, in, out, net, rate, count, uncategorised, complete }] newest first (`complete` = a full month before today),
 *   totals: { in, out, net, rate } over the rows, average: { in, out, net } over complete months,
 *   planned: { in, out, net } | null (from the Income/Expenses pages), byCategory: { in: [...], out: [...] } over the rows,
 *   hasData
 * }
 * Income = money in; spending = money out; a transaction whose category is an income kind counts as income even if negative (a refund of income), and vice versa.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const want = Math.max(1, Number(params.months ?? 12));
  const txs = (plan.transactions ?? []).filter((t) => !isTransfer(t, plan));
  const months = new Map();
  const cat = { in: new Map(), out: new Map() };
  for (const t of txs) {
    const ym = monthOf(t.date); if (!ym) continue;
    const m = months.get(ym) ?? { ym, label: monthLabel(ym), in: 0, out: 0, count: 0, uncategorised: 0 };
    const amt = Number(t.amount) || 0;
    const kind = categoryById(plan, t.category)?.kind ?? (amt >= 0 ? "income" : "expense");
    if (kind === "income") m.in += amt; else m.out += -amt;
    m.count++; if (!t.category) m.uncategorised++;
    months.set(ym, m);
    const side = kind === "income" ? "in" : "out";
    const key = t.category || "";
    const c = cat[side].get(key) ?? { category: key, label: categoryLabel(plan, key), icon: categoryIcon(plan, key), total: 0, count: 0 };
    c.total += side === "in" ? amt : -amt; c.count++;
    cat[side].set(key, c);
  }
  const thisMonth = today ? String(today).slice(0, 7) : null;
  const rows = [...months.values()].sort((a, b) => b.ym.localeCompare(a.ym)).slice(0, want)
    .map((m) => ({ ...m, net: m.in - m.out, rate: m.in > 0 ? (m.in - m.out) / m.in : null, complete: thisMonth ? m.ym < thisMonth : true }));
  const sum = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const totals = { in: sum(rows, "in"), out: sum(rows, "out") };
  totals.net = totals.in - totals.out; totals.rate = totals.in > 0 ? totals.net / totals.in : null;
  const full = rows.filter((r) => r.complete);
  const average = full.length ? { in: sum(full, "in") / full.length, out: sum(full, "out") / full.length, net: (sum(full, "in") - sum(full, "out")) / full.length, months: full.length } : null;
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  const exp = (plan.expenses ?? []).length ? computeExpenses(plan, { today }) : null;
  const planned = inc || exp ? { in: inc?.monthly ?? 0, out: exp?.monthly ?? 0, net: (inc?.monthly ?? 0) - (exp?.monthly ?? 0) } : null;
  const top = (map) => [...map.values()].sort((a, b) => b.total - a.total);
  return { rows, totals, average, planned, byCategory: { in: top(cat.in), out: top(cat.out) }, hasData: rows.length > 0, monthsWanted: want };
}
