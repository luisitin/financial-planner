// modules/cashflow/income/compute.js -- PURE. Every source of money coming in, put on the
// same footing (per month, per year) whatever its pay period, with who earns it and how it
// grows. Expenses, liquidity, retirement and taxes read these totals.
import { perMonth, perYear, activeOn, periodLabel } from "../../../core/math/periods.js";

export const INCOME_TYPES = {
  salary:     { label: "Pay from a job",           icon: "💼" },
  bonus:      { label: "Bonus or commission",      icon: "🎯" },
  business:   { label: "Self-employment / business", icon: "🛠️" },
  rental:     { label: "Rent you collect",         icon: "🏘️" },
  pension:    { label: "Pension",                  icon: "🏛️" },
  social:     { label: "Social Security",          icon: "🇺🇸" },
  investment: { label: "Dividends and interest",   icon: "📈" },
  support:    { label: "Support or gifts received", icon: "🎁" },
  other:      { label: "Other",                    icon: "💵" },
};

/**
 * compute(plan, { today }) -> {
 *   items: [{ ...income, typeLabel, icon, periodLabel, personName, monthly, yearly, active, upcoming, ended, nextYear }],
 *   active: [items that count today], count,
 *   monthly, yearly (active, recurring only), nextYear (yearly after each item's raise),
 *   taxableYearly, untaxedYearly, oneTime (sum of active one-offs, not in monthly/yearly),
 *   byType: { [type]: yearly }, byPerson: [{ personId, name, yearly, monthly }], warnings: [text]
 * }
 * `today` decides which items are active (start/end dates); without it everything counts.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const people = plan.household?.people ?? [];
  const nameOf = (id) => people.find((p) => p.id === id)?.name ?? (id ? "Someone" : "Household");
  const items = (plan.income ?? []).map((x) => {
    const t = INCOME_TYPES[x.type] ?? INCOME_TYPES.other;
    const active = today ? activeOn(x, today) : true;
    const yearly = perYear(x.amount, x.period);
    const growth = Number(x.growth) || 0;
    return {
      ...x, typeLabel: t.label, icon: t.icon, periodLabel: periodLabel(x.period), personName: nameOf(x.personId),
      monthly: perMonth(x.amount, x.period), yearly, active,
      upcoming: !!(today && x.startDate && String(x.startDate) > today),
      ended: !!(today && x.endDate && String(x.endDate) < today),
      nextYear: yearly * (1 + growth),
      oneTime: x.period === "once" ? Number(x.amount) || 0 : 0,
    };
  });
  const active = items.filter((x) => x.active);
  const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const byType = {};
  for (const x of active) byType[x.type ?? "other"] = (byType[x.type ?? "other"] ?? 0) + x.yearly;
  const byPersonMap = new Map();
  for (const x of active) { const k = x.personId || ""; const e = byPersonMap.get(k) ?? { personId: k, name: nameOf(k), yearly: 0, monthly: 0 }; e.yearly += x.yearly; e.monthly += x.monthly; byPersonMap.set(k, e); }
  const warnings = [];
  for (const x of items) {
    if (!(Number(x.amount) > 0)) warnings.push(`${x.name || "An income"} has no amount.`);
    if (x.startDate && x.endDate && String(x.endDate) < String(x.startDate)) warnings.push(`${x.name || "An income"} ends before it starts.`);
    if (Number(x.growth) > 0.25) warnings.push(`${x.name || "An income"} grows ${Math.round(Number(x.growth) * 100)}% a year. Raises are usually typed as 3, not 0.03 or 300.`);
  }
  return {
    items, active, count: items.length,
    monthly: sum(active, "monthly"), yearly: sum(active, "yearly"), nextYear: sum(active, "nextYear"),
    taxableYearly: sum(active.filter((x) => x.taxable !== false), "yearly"),
    untaxedYearly: sum(active.filter((x) => x.taxable === false), "yearly"),
    oneTime: sum(active, "oneTime"),
    byType, byPerson: [...byPersonMap.values()].sort((a, b) => b.yearly - a.yearly),
    warnings,
  };
}
