// modules/cashflow/expenses/compute.js -- PURE. Regular spending on a monthly footing, split
// into what you must pay and what is nice to have, grouped by category, and compared with
// income. Liquidity, budget, forecast and retirement pages read these totals.
import { perMonth, perYear, activeOn, periodLabel } from "../../../core/math/periods.js";
import { compute as computeIncome } from "../income/compute.js";
import { money } from "../../../core/format.js";
import { roundShares } from "../../../core/math/shares.js";
import { compute as computeDebts } from "../../balance/liabilities/compute.js";

// essential: the default for "I must pay this" when a category is picked in the form.
export const CATEGORIES = {
  housing:        { label: "Rent or mortgage",        icon: "🏠", essential: true },
  utilities:      { label: "Utilities",               icon: "💡", essential: true },
  groceries:      { label: "Groceries",               icon: "🛒", essential: true },
  transport:      { label: "Car, gas, transit",       icon: "🚗", essential: true },
  insurance:      { label: "Insurance",               icon: "🛡️", essential: true },
  health:         { label: "Health and medical",      icon: "🩺", essential: true },
  debt:           { label: "Loan and card payments",  icon: "💳", essential: true },
  childcare:      { label: "Childcare and school",    icon: "🧒", essential: true },
  phone:          { label: "Phone and internet",      icon: "📱", essential: true },
  taxes:          { label: "Taxes not withheld",      icon: "🧾", essential: true },
  subscriptions:  { label: "Subscriptions",           icon: "📺", essential: false },
  dining:         { label: "Eating out",              icon: "🍽️", essential: false },
  fun:            { label: "Fun and hobbies",         icon: "🎉", essential: false },
  shopping:       { label: "Shopping and clothes",    icon: "🛍️", essential: false },
  travel:         { label: "Travel",                  icon: "✈️", essential: false },
  giving:         { label: "Gifts and giving",        icon: "🎁", essential: false },
  personal:       { label: "Personal care",           icon: "💇", essential: false },
  pets:           { label: "Pets",                    icon: "🐾", essential: false },
  other:          { label: "Other",                   icon: "📦", essential: false },
};

/**
 * compute(plan, { today }) -> {
 *   items: [{ ...expense, categoryLabel, icon, periodLabel, monthly, yearly, active, upcoming, ended, essential, inflates }],
 *   active, count, monthly, yearly, essentialMonthly, optionalMonthly, inflatingMonthly,
 *   byCategory: [{ category, label, icon, monthly, share }] (active, largest first),
 *   income: { monthly, yearly } | null, leftOver (income monthly - expenses monthly) | null, savingsRate | null,
 *   warnings: [text]
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const items = (plan.expenses ?? []).map((x) => {
    const c = CATEGORIES[x.category] ?? CATEGORIES.other;
    return {
      ...x, categoryLabel: c.label, icon: c.icon, periodLabel: periodLabel(x.period),
      monthly: perMonth(x.amount, x.period), yearly: perYear(x.amount, x.period),
      active: today ? activeOn(x, today) : true,
      upcoming: !!(today && x.startDate && String(x.startDate) > today),
      ended: !!(today && x.endDate && String(x.endDate) < today),
      essential: x.essential ?? c.essential,
      inflates: x.inflates !== false,
      oneTime: x.period === "once" ? Number(x.amount) || 0 : 0,
    };
  });
  const active = items.filter((x) => x.active);
  const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  // F-019: required debt payments live on the Debts page. Each debt is matched to its own expense here (round 4,
  // 2026-11-02): one whose payment is not listed is counted as a line of its own, so listing the car payment no longer
  // drops the card's. Before, any expense under "Loan and card payments" stopped every Debts payment from counting.
  const debts = (plan.debts ?? []).length ? computeDebts(plan, params) : null;
  // A mortgage's payment is often filed here under housing ("Mortgage payment"), not under loan payments. When a
  // housing expense is that payment (its name says mortgage, or it is within 10% of the mortgage's payment), the
  // mortgage is not added again from Debts. Set up my plan files "Home costs" besides the mortgage under housing, so
  // there the mortgage still comes from Debts. The check below accepts either way of filing it.
  const mortgagePay = debts ? (debts.rows ?? []).filter((r) => r.type === "mortgage").reduce((s, r) => s + (Number(r.payment) || 0), 0) : 0;
  const mortgageFiled = mortgagePay > 0 && active.some((x) => x.category === "housing" && (/mortgage/i.test(x.name ?? "") || Math.abs(x.monthly - mortgagePay) <= mortgagePay * 0.1));
  const allDebtPayments = debts ? debts.payments : 0;
  const debtPayments = allDebtPayments - (mortgageFiled ? mortgagePay : 0);
  const filedDebt = sum(active.filter((x) => x.category === "debt"), "monthly");
  const rows = (debts?.rows ?? []).filter((r) => (Number(r.payment) || 0) > 0 && !(mortgageFiled && r.type === "mortgage"));
  // a paid-off debt's payment still listed here is matched first (by name, or its typed payment), so it is said to have
  // ended and never stands in for another debt's missing payment
  const paidRows = (debts?.rows ?? []).filter((r) => r.paidOff && r.typedPayment > 0).map((r) => ({ ...r, payment: r.typedPayment, minPayment: r.typedPayment }));
  const debtItems = active.filter((x) => x.category === "debt");
  const pm = paidRows.length ? matchDebts(debtItems, paidRows) : { matched: new Map() };
  const endedIds = new Set([...pm.matched.values()].map((e) => e.id));
  const ended = [...pm.matched].map(([id, e]) => ({ debtId: id, debtName: paidRows.find((r) => r.id === id)?.name ?? "", id: e.id, name: e.name, monthly: e.monthly }));
  const m = matchDebts(debtItems.filter((x) => !endedIds.has(x.id)), rows);
  // what is filed but matches no debt (one line for all of them, or an amount out of date) covers the unmatched debts up to its amount
  const unmatchedRows = rows.filter((r) => !m.matched.has(r.id));
  const missingTotal = unmatchedRows.reduce((t, r) => t + r.payment, 0);
  const debtFromDebts = Math.max(0, missingTotal - m.spare);
  const fromDebts = debtFromDebts > 0.005 && m.spare <= 0.005 ? unmatchedRows.map((r) => ({ id: r.id, name: r.name, monthly: r.payment, required: Math.min(r.payment, Number(r.minPayment) || r.payment) })) : [];
  // the required part of a missing payment is a must-pay; an extra set on Debts is not
  const debtRequired = fromDebts.length ? fromDebts.reduce((t, x) => t + x.required, 0) : Math.min(debtFromDebts, unmatchedRows.reduce((t, r) => t + Math.min(r.payment, Number(r.minPayment) || r.payment), 0));
  const monthly = sum(active, "monthly") + debtFromDebts;
  const cat = new Map();
  for (const x of active) { const k = CATEGORIES[x.category] ? x.category : "other"; const e = cat.get(k) ?? { category: k, label: CATEGORIES[k].label, icon: CATEGORIES[k].icon, monthly: 0 }; e.monthly += x.monthly; cat.set(k, e); }
  if (debtFromDebts) { const had = cat.get("debt"); cat.set("debt", { category: "debt", label: had ? "Loan and card payments (some from Debts)" : "Loan and card payments (from Debts)", icon: CATEGORIES.debt.icon, monthly: (had?.monthly ?? 0) + debtFromDebts, virtual: true }); }
  const byCategory = [...cat.values()].filter((c) => c.monthly > 0).map((c) => ({ ...c, share: monthly ? c.monthly / monthly : 0 })).sort((a, b) => b.monthly - a.monthly);
  const percents = roundShares(byCategory.map((c) => c.monthly));   // F-009: whole percentages that add up to 100
  byCategory.forEach((c, i) => { c.percent = percents[i]; });
  const inc = (plan.income ?? []).length ? computeIncome(plan, params) : null;
  const income = inc ? { monthly: inc.monthly, yearly: inc.yearly, nextYear: inc.nextYear } : null;
  const leftOver = income ? income.monthly - monthly : null;
  const inflation = Number(plan.assumptions?.inflation ?? 0.03);
  const inflatingMonthly = sum(active.filter((x) => x.inflates), "monthly");
  const yearly = sum(active, "yearly") + debtFromDebts * 12;
  const nextYear = inflatingMonthly * 12 * (1 + inflation) + (yearly - inflatingMonthly * 12);   // F-018: next year's spending after inflation
  const leftOverNextYear = income ? income.nextYear - nextYear : null;
  const warnings = [];
  // the filed loan payments against the Debts payments they stand for (the ones not added above): far apart, one is out of date
  const covered = debtPayments - debtFromDebts;
  const off = (want) => want <= 0 || Math.abs(filedDebt - want) / want > 0.1;
  if (covered > 0 && filedDebt > 0 && off(covered)) warnings.push(`Loan and card payments here add up to ${money(filedDebt, plan.meta?.currency ?? "USD")} a month; the Debts page has ${money(covered, plan.meta?.currency ?? "USD")}${mortgageFiled ? " (not counting the mortgage, which is under housing)" : ""}${debtFromDebts ? ` for the same debts (${money(debtFromDebts, plan.meta?.currency ?? "USD")} more is counted from Debts)` : ""}. ${filedDebt < covered ? "A payment may be missing here" : "One may be out of date"}: check both.`);
  for (const x of items) {
    if (!(Number(x.amount) > 0)) warnings.push(`${x.name || "An expense"} has no amount.`);
    if (x.startDate && x.endDate && String(x.endDate) < String(x.startDate)) warnings.push(`${x.name || "An expense"} ends before it starts.`);
  }
  // pay before tax minus spending: a view that can work out the after-tax figure (Next best action) shows that instead
  const overspend = leftOver !== null && leftOver < 0 ? `You spend ${money(-leftOver, plan.meta?.currency ?? "USD")} more each month than comes in. Check the amounts, or this is the first thing the plan should fix.` : null;
  if (overspend) warnings.push(overspend);
  return {
    items, active, count: items.length, monthly, yearly,
    essentialMonthly: sum(active.filter((x) => x.essential), "monthly") + debtRequired,
    // an extra paid on a debt kept on Debts alone could be cut in a pinch: it is a nice-to-have, so the two add up to the total
    optionalMonthly: sum(active.filter((x) => !x.essential), "monthly") + (debtFromDebts - debtRequired),
    inflatingMonthly, nextYear, leftOverNextYear,
    debtPayments, debtFromDebts, debtRequired, fromDebts, ended, debtMatches: Object.fromEntries([...m.matched].map(([id, e]) => [id, e.id])),
    oneTime: sum(active, "oneTime"),
    byCategory, income, leftOver, savingsRate: income && income.monthly > 0 ? leftOver / income.monthly : null,
    warnings, overspend,
  };
}

/**
 * matchDebts(debtExpenses, debts) -> { matched: Map(debt id -> expense), spare (a month: filed loan payments that match no debt,
 *   and the part of a matched one more than 10% over its debt's payment, which pays other debts too) }
 * Which expense under "Loan and card payments" is which debt's payment: first by name (the expense names a word of the
 * debt's, "Visa payment" for "Visa card"; words every loan shares do not count), then by amount (within 10% of the payment
 * or the required minimum, the closest pairs first). Each expense pays one debt at most.
 */
const SHARED_WORDS = new Set(["loan", "loans", "card", "cards", "credit", "payment", "payments", "the", "and", "for", "debt", "monthly", "bill"]);
const words = (t) => String(t ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !SHARED_WORDS.has(w));
export function matchDebts(debtExpenses, debts) {
  const matched = new Map(), used = new Set();
  const free = (x) => !used.has(x.id);
  for (const d of debts) {
    const dw = words(d.name);
    const e = dw.length ? debtExpenses.find((x) => free(x) && words(x.name).some((w) => dw.includes(w))) : null;
    if (e) { used.add(e.id); matched.set(d.id, e); }
  }
  // by amount: the closest pairs first, so a $410 car payment goes to the $410 loan, not to a $400 card it is also near
  const pairs = [];
  for (const d of debts) {
    if (matched.has(d.id)) continue;
    for (const x of debtExpenses.filter(free)) {
      const off = Math.min(...[d.payment, d.minPayment].filter((p) => Number(p) > 0).map((p) => Math.abs(x.monthly - p) / Number(p)));
      if (off <= 0.1) pairs.push({ d, x, off });
    }
  }
  for (const { d, x } of pairs.sort((a, b) => a.off - b.off)) if (!matched.has(d.id) && free(x)) { used.add(x.id); matched.set(d.id, x); }
  // an expense well over its debt's payment ("Mortgage and car") pays others too: the part over counts as filed
  const over = [...matched].reduce((t, [id, e]) => { const d = debts.find((y) => y.id === id); const p = Number(d?.payment) || 0; return t + (e.monthly > p * 1.1 ? e.monthly - p : 0); }, 0);
  return { matched, spare: over + debtExpenses.filter(free).reduce((t, x) => t + (Number(x.monthly) || 0), 0) };
}

/**
 * closeGap(items, gap, { goalSaving }) -> { gap, picks: [{ id, name, monthly, period, amount, trimBy | null, trimTo | null }], covered, enough, niceTotal,
 *   bigMustPays: [{ id, name, monthly }] (when the nice-to-haves cannot close it), goalSaving }
 * The fewest nice-to-have expenses that close a monthly gap: the largest ones until one of the rest covers what is left,
 * then the smallest of those, so a big cut is never picked when a small one does it. The last pick says how much a
 * trim would be enough (trimBy, a month) when that is less than the whole amount, and the amount each time that leaves
 * (trimTo, in the expense's own period, rounded down to $5 so it closes the gap).
 */
export function closeGap(items, gap, opts = {}) {
  const pool = (items ?? []).filter((x) => x.active && !x.essential && x.period !== "once" && x.monthly > 0.5).sort((a, b) => b.monthly - a.monthly);
  const niceTotal = pool.reduce((t, x) => t + x.monthly, 0);
  const picks = [];
  let left = Math.max(0, Number(gap) || 0);
  const rest = [...pool];
  while (left > 0.5 && rest.length) {
    const fits = rest.filter((x) => x.monthly >= left);
    const x = fits.length ? fits[fits.length - 1] : rest[0];
    rest.splice(rest.indexOf(x), 1);
    const trimBy = x.monthly > left + 0.5 ? left : null;
    // the trim in the expense's own terms (its form asks for the amount each time): a yearly $3,000 trimmed by $220 a month is $360 a year
    const times = perYear(1, x.period) || 12;
    picks.push({ id: x.id, name: x.name, monthly: x.monthly, period: x.period, amount: Number(x.amount) || 0, trimBy, trimTo: trimBy === null ? null : Math.max(0, Math.floor(((Number(x.amount) || 0) - (trimBy * 12) / times) / 5) * 5) });
    left -= x.monthly;
  }
  const covered = picks.reduce((t, x) => t + x.monthly, 0);
  const enough = gap > 0 && covered >= gap - 0.5;
  const bigMustPays = enough ? [] : (items ?? []).filter((x) => x.active && x.essential && x.period !== "once" && x.monthly > 0.5 && !String(x.id ?? "").startsWith("debt")).sort((a, b) => b.monthly - a.monthly).slice(0, 3).map((x) => ({ id: x.id, name: x.name, monthly: x.monthly }));
  return { gap: Math.max(0, Number(gap) || 0), picks, covered, enough, niceTotal, bigMustPays, goalSaving: Math.max(0, Number(opts.goalSaving) || 0) };
}
