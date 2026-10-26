// modules/cashflow/sinking-funds/compute.js -- PURE. The costs that do not come monthly:
// yearly insurance, quarterly taxes, gifts, the summer trip, a one-off roof. Each becomes a
// monthly amount to set aside so the money is there when the bill lands. Items come from the
// Expenses page (quarterly, yearly, one-time with a date) and from yearly payments found in
// the transactions.
import { compute as computeRecurring } from "../recurring/compute.js";
import { CATEGORIES } from "../expenses/compute.js";
import { monthsBetween } from "../../../core/math/dates.js";
import { PERIODS } from "../../../core/math/periods.js";

/**
 * compute(plan, { today }) -> {
 *   funds: [{ key, name, icon, source: "typed"|"found", amount (per occurrence), period, yearly, monthly (to set aside), next, monthsToNext, saveByThen }],
 *   monthly (total to set aside), yearly, dueNext (funds within 3 months), hasData
 * }
 * saveByThen: what needs to be there by the next due date at the monthly pace (amount when the date is unknown).
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const funds = [];
  for (const e of plan.expenses ?? []) {
    const amount = Number(e.amount) || 0; if (amount <= 0) continue;
    const c = CATEGORIES[e.category] ?? CATEGORIES.other;
    if (e.period === "quarterly" || e.period === "annual") {
      const yearly = amount * PERIODS[e.period].perYear;
      funds.push({ key: `typed-${e.id}`, name: e.name, icon: c.icon, source: "typed", amount, period: e.period, yearly, monthly: yearly / 12, next: e.startDate || null });
    } else if (e.period === "once" && e.startDate && (!today || e.startDate >= today)) {
      const months = today ? Math.max(1, monthsBetween(today, e.startDate)) : 12;
      funds.push({ key: `typed-${e.id}`, name: e.name, icon: c.icon, source: "typed", amount, period: "once", yearly: 0, monthly: amount / months, next: e.startDate });
    }
  }
  const rec = computeRecurring(plan, { today });
  for (const r of rec.detected) {
    if (r.amount >= 0 || (r.cadence !== "annual" && r.cadence !== "quarterly")) continue;
    if (funds.some((f) => f.source === "typed" && Math.abs(f.amount - Math.abs(r.amount)) < 1)) continue;   // already typed on Expenses
    const yearly = Math.abs(r.amount) * (r.cadence === "annual" ? 1 : 4);
    funds.push({ key: r.key, name: r.payee, icon: r.icon, source: "found", amount: Math.abs(r.amount), period: r.cadence, yearly, monthly: yearly / 12, next: r.next });
  }
  for (const f of funds) {
    f.monthsToNext = today && f.next ? Math.max(0, monthsBetween(today, f.next)) : null;
    f.saveByThen = f.amount;
  }
  funds.sort((a, b) => (a.monthsToNext ?? 99) - (b.monthsToNext ?? 99) || b.monthly - a.monthly);
  const monthly = funds.reduce((s, f) => s + f.monthly, 0);
  return { funds, monthly, yearly: funds.reduce((s, f) => s + f.yearly, 0), dueNext: funds.filter((f) => f.monthsToNext !== null && f.monthsToNext <= 3), hasData: funds.length > 0 };
}
