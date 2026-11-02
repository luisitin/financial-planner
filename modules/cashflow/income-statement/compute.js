// modules/cashflow/income-statement/compute.js -- PURE. Month by month: what came in, what
// went out, what was kept, from the transactions (transfers excluded). Next to it, what the
// Income and Expenses pages say should happen each month, so the two can be compared.
import { isTransfer, monthOf, monthLabel, coverage, monthCover } from "../../transactions/ledger/compute.js";
import { categoryById, categoryLabel, categoryIcon } from "../../transactions/categories/compute.js";
import { compute as computeIncome } from "../income/compute.js";
import { compute as computeExpenses, CATEGORIES } from "../expenses/compute.js";
import { compute as computePayoff } from "../../debt/payoff/compute.js";
import { takeHome } from "../paycheck/compute.js";

/** Plan versus real: money in from the bank more than this share below the plan's take-home is a gap worth a look (two paychecks in a month of a pay every two weeks are 12/13 of the average month, 7.7% below). */
export const IN_BAND = 0.1;

/**
 * compute(plan, { months = 12, today }) -> {
 *   rows: [{ ym, label, in, out, net, rate, count, uncategorised, complete }] newest first (`complete` = a full month before today),
 *   totals: { in, out, net, rate } over the rows, average: { in, out, net } over complete months,
 *   planned: { in (before tax), takeHomeIn (salaries at take-home, Paycheck page), takeHome (true when that differs), out, net (before tax) } | null
 *     (from the Income/Expenses pages), inGap: average money in from the bank minus takeHomeIn | null, inShort: inGap below IN_BAND of takeHomeIn,
 *   byCategory: { in: [...], out: [...] } over the rows,
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
  // the bank sees pay after tax: the plan's money in is compared at take-home (each salary at its earner's share)
  const th = inc ? takeHome(plan, { today }) : null;
  const takeHomeIn = th ? th.monthly : 0;
  const planned = inc || exp ? { in: inc?.monthly ?? 0, takeHomeIn, takeHome: !!th && Math.abs(takeHomeIn - (inc?.monthly ?? 0)) > 0.5, out: exp?.monthly ?? 0, net: (inc?.monthly ?? 0) - (exp?.monthly ?? 0) } : null;
  const inGap = planned && average && inc ? average.in - takeHomeIn : null;
  const inShort = inGap !== null && inGap < 0 && -inGap > Math.max(50, IN_BAND * takeHomeIn);
  const top = (map) => [...map.values()].sort((a, b) => b.total - a.total);
  return { rows, totals, average, planned, inGap, inShort, byCategory: { in: top(cat.in), out: top(cat.out) }, hasData: rows.length > 0, monthsWanted: want };
}

/** Bank versus plan: the bank shows more going out than Expenses lists by at least this much a month, and this share of it. */
export const BANK_OVER = { dollars: 200, share: 0.1, minMonths: 2, maxMonths: 6, lineAtLeast: 50 };
/**
 * bankVsPlan(plan, { today }) -> null | { months, bankOut, planOut, gap, over, lines: [{ category, label, icon, essential, bank, plan, more }],
 *   unfiled } (all a month)
 * What the bank files show going out, on average over the whole months they cover (the last BANK_OVER.maxMonths, at least
 * minMonths; transfers between your own accounts left out), against what the Expenses page lists (plus a saved Pay off
 * debts extra). Taxes are left out on both sides (they come off income elsewhere). `over` when the bank shows at least
 * BANK_OVER.dollars and BANK_OVER.share more; that direction is safe, since a card or account whose file is missing makes
 * the bank show less, never more. `lines`: each spending kind the bank shows at least lineAtLeast a month more of than
 * Expenses lists, largest first; `unfiled`: bank spending not filed under a kind yet. Round 4 (2026-11-02): the Dashboard,
 * Next best action and the Forecast were worked out from the typed Expenses only, so a household whose bank showed it
 * short was told "Your month works".
 */
export function bankVsPlan(plan, params = {}) {
  const today = params.today ?? null;
  const txs = (plan.transactions ?? []).filter((t) => !isTransfer(t, plan));
  if (!txs.length || !today || !(plan.expenses ?? []).length) return null;
  const cov = coverage(plan);
  const thisMonth = String(today).slice(0, 7);
  const yms = [...new Set(txs.map((t) => monthOf(t.date)).filter((m) => m && m < thisMonth))].sort().reverse()
    .filter((ym) => monthCover(cov, ym, today).full).slice(0, BANK_OVER.maxMonths);
  if (yms.length < BANK_OVER.minMonths) return null;
  const inWindow = new Set(yms);
  const byCat = new Map();
  let out = 0, unfiled = 0;
  for (const t of txs) {
    if (!inWindow.has(monthOf(t.date))) continue;
    const amt = Number(t.amount) || 0;
    const c = categoryById(plan, t.category);
    const kind = c?.kind ?? (amt >= 0 ? "income" : "expense");
    if (kind !== "expense") continue;
    const key = CATEGORIES[t.category] ? t.category : t.category ? "other" : "";
    if (key === "taxes") continue;
    out += -amt;
    if (!key) unfiled += -amt; else byCat.set(key, (byCat.get(key) ?? 0) - amt);
  }
  const n = yms.length;
  const exp = computeExpenses(plan, { today });
  const planCat = new Map(exp.byCategory.map((c) => [c.category, c.monthly]));
  let extra = 0;
  try { const pay = computePayoff(plan, { today }); extra = pay?.hasData && pay.extra > 0 ? pay.extra : 0; } catch { extra = 0; }
  const planOut = exp.monthly - (planCat.get("taxes") ?? 0) + extra;
  const bankOut = out / n;
  const gap = bankOut - planOut;
  const lines = [...byCat].map(([category, total]) => {
    const bank = total / n, planned = (planCat.get(category) ?? 0) + (category === "debt" ? extra : 0);
    return { category, label: CATEGORIES[category].label, icon: CATEGORIES[category].icon, essential: CATEGORIES[category].essential, bank, plan: planned, more: bank - planned };
  }).filter((x) => x.more >= BANK_OVER.lineAtLeast).sort((a, b) => b.more - a.more);
  return { months: n, bankOut, planOut, gap, over: gap >= Math.max(BANK_OVER.dollars, BANK_OVER.share * planOut), lines, unfiled: unfiled / n };
}
