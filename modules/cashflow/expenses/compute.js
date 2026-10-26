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
  // F-019: required debt payments live on the Debts page. When no expense is filed under "Loan and card
  // payments", they are counted here as a must-pay line so the totals and the emergency-fund target are right.
  const debts = (plan.debts ?? []).length ? computeDebts(plan, params) : null;
  const debtPayments = debts ? debts.payments : 0;
  const filedDebt = sum(active.filter((x) => x.category === "debt"), "monthly");
  const debtFromDebts = debtPayments > 0 && filedDebt === 0 ? debtPayments : 0;
  const monthly = sum(active, "monthly") + debtFromDebts;
  const cat = new Map();
  for (const x of active) { const k = CATEGORIES[x.category] ? x.category : "other"; const e = cat.get(k) ?? { category: k, label: CATEGORIES[k].label, icon: CATEGORIES[k].icon, monthly: 0 }; e.monthly += x.monthly; cat.set(k, e); }
  if (debtFromDebts) cat.set("debt", { category: "debt", label: "Loan and card payments (from Debts)", icon: CATEGORIES.debt.icon, monthly: debtFromDebts, virtual: true });
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
  if (debtPayments > 0 && filedDebt > 0 && Math.abs(filedDebt - debtPayments) / debtPayments > 0.1) warnings.push(`Loan and card payments here (${money(filedDebt, plan.meta?.currency ?? "USD")} a month) differ from the Debts page (${money(debtPayments, plan.meta?.currency ?? "USD")}). One of them is out of date.`);
  for (const x of items) {
    if (!(Number(x.amount) > 0)) warnings.push(`${x.name || "An expense"} has no amount.`);
    if (x.startDate && x.endDate && String(x.endDate) < String(x.startDate)) warnings.push(`${x.name || "An expense"} ends before it starts.`);
  }
  if (leftOver !== null && leftOver < 0) warnings.push(`You spend ${money(-leftOver, plan.meta?.currency ?? "USD")} more each month than comes in. Check the amounts, or this is the first thing the plan should fix.`);
  return {
    items, active, count: items.length, monthly, yearly,
    essentialMonthly: sum(active.filter((x) => x.essential), "monthly") + debtFromDebts,
    optionalMonthly: sum(active.filter((x) => !x.essential), "monthly"),
    inflatingMonthly, nextYear, leftOverNextYear,
    debtPayments, debtFromDebts,
    oneTime: sum(active, "oneTime"),
    byCategory, income, leftOver, savingsRate: income && income.monthly > 0 ? leftOver / income.monthly : null,
    warnings,
  };
}
