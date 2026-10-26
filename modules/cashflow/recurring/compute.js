// modules/cashflow/recurring/compute.js -- PURE. Payments that come back: found in the
// transactions (same payee, steady gap between dates) and the ones typed on the Income and
// Expenses pages. Each gets a cadence, a typical amount, the next expected date and whether
// it looks missed. Forecast, Subscriptions and Irregular expenses read this.
import { normalizePayee } from "../../transactions/rules/compute.js";
import { isTransfer } from "../../transactions/ledger/compute.js";
import { categoryLabel, categoryIcon } from "../../transactions/categories/compute.js";
import { daysBetween, addMonths } from "../../../core/math/dates.js";
import { PERIODS, periodLabel } from "../../../core/math/periods.js";

// cadence: typical days between two occurrences and the band that counts as "steady"
export const CADENCES = {
  weekly:      { label: "every week",          days: 7,   min: 5,   max: 9 },
  biweekly:    { label: "every two weeks",     days: 14,  min: 12,  max: 16 },
  semimonthly: { label: "twice a month",       days: 15,  min: 13,  max: 17 },
  monthly:     { label: "every month",         days: 30,  min: 26,  max: 35 },
  quarterly:   { label: "every three months",  days: 91,  min: 80,  max: 100 },
  annual:      { label: "once a year",         days: 365, min: 340, max: 390 },
};
const GRACE_DAYS = 5;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

/** Next date after `from` on a cadence starting at `last`. */
export function nextAfter(last, cadence, from) {
  const c = CADENCES[cadence]; if (!c || !last) return null;
  let d = last;
  for (let i = 0; i < 400 && String(d) <= String(from); i++) d = cadence === "monthly" || cadence === "quarterly" || cadence === "annual" ? addMonths(d, cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : 12) : addDays(d, c.days);
  return d;
}
export const addDays = (iso, n) => { const [y, m, d] = String(iso).split("-").map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

/**
 * detectRecurring(txs, { today }) -> [{ key, payee, accountId, category, cadence, cadenceLabel, amount (typical, signed),
 *   count, first, last, next, missed, spread (how steady the amount is, 0 = identical), ids }]
 * A payee needs at least 3 lines (2 for equal-amount monthly or larger cadences); gaps must mostly fall in one cadence band.
 */
export function detectRecurring(txs, { today = null, plan = null } = {}) {
  const groups = new Map();
  for (const t of txs ?? []) {
    if (plan && isTransfer(t, plan)) continue;
    const key = `${t.accountId ?? ""}|${normalizePayee(t.rawPayee ?? t.payee)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)).push(t);
  }
  const out = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (sorted.length < 2) continue;
    const gaps = []; for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    const mid = median(gaps);
    const cadence = Object.entries(CADENCES).find(([, c]) => mid >= c.min && mid <= c.max)?.[0];
    if (!cadence) continue;
    const band = CADENCES[cadence];
    const steady = gaps.filter((g) => g >= band.min && g <= band.max).length / gaps.length;
    if (steady < 0.6) continue;
    const amounts = sorted.map((t) => Number(t.amount) || 0);
    const typical = median(amounts);
    const spread = typical ? median(amounts.map((a) => Math.abs(a - typical))) / Math.abs(typical) : 0;
    if (sorted.length < 3 && !(spread < 0.02 && band.days >= 26)) continue;   // two lines only count when the amount is identical and it is at least monthly
    if (spread > 0.5) continue;                                                // wildly different amounts: a shop, not a bill
    const last = sorted[sorted.length - 1];
    const next = today ? nextAfter(last.date, cadence, today) : nextAfter(last.date, cadence, last.date);
    const expected = today ? nextAfter(last.date, cadence, last.date) : null;   // the first occurrence after the last one
    const missed = !!(today && expected && daysBetween(expected, today) > GRACE_DAYS);
    out.push({ key, payee: last.payee, rawPayee: last.rawPayee ?? last.payee, accountId: last.accountId, category: last.category ?? "", cadence, cadenceLabel: CADENCES[cadence].label,
      amount: Math.round(typical * 100) / 100, count: sorted.length, first: sorted[0].date, last: last.date, next: missed ? expected : next, missed, spread: Math.round(spread * 100) / 100, ids: sorted.map((t) => t.id) });
  }
  return out.sort((a, b) => String(a.next ?? "9999").localeCompare(String(b.next ?? "9999")));
}
const perMonthDays = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1, quarterly: 1 / 3, annual: 1 / 12 };

/**
 * compute(plan, { today }) -> {
 *   detected: [...] (from transactions, minus the ones the owner dismissed),
 *   planned: [{ id, kind: "expense"|"income", name, category, amount (signed), period, periodLabel, monthly }] from the Income and Expenses pages,
 *   dueSoon: [{ ...item, days }] within 14 days (detected first), missed: [...], monthlyOut, monthlyIn (detected only), dismissed: n, total
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const dismissed = new Set(plan.recurringIgnored ?? []);
  const all = detectRecurring(plan.transactions ?? [], { today, plan });
  const detected = all.filter((r) => !dismissed.has(r.key)).map((r) => ({ ...r, categoryLabel: categoryLabel(plan, r.category), icon: categoryIcon(plan, r.category), monthly: Math.abs(r.amount) * perMonthDays[r.cadence] }));
  // F-026: only items that are live today count as expected; ended and not-yet-started ones are flagged
  const state = (x) => !today ? "active" : x.startDate && String(x.startDate) > today ? "upcoming" : x.endDate && String(x.endDate) < today ? "ended" : "active";
  const planned = [
    ...(plan.expenses ?? []).filter((e) => e.period !== "once").map((e) => ({ id: e.id, kind: "expense", name: e.name, category: e.category, amount: -(Number(e.amount) || 0), period: e.period, periodLabel: periodLabel(e.period), monthly: (Number(e.amount) || 0) * (PERIODS[e.period]?.perYear ?? 12) / 12, state: state(e), startDate: e.startDate || "", endDate: e.endDate || "" })),
    ...(plan.income ?? []).filter((i) => i.period !== "once").map((i) => ({ id: i.id, kind: "income", name: i.name, category: "", amount: Number(i.amount) || 0, period: i.period, periodLabel: periodLabel(i.period), monthly: (Number(i.amount) || 0) * (PERIODS[i.period]?.perYear ?? 12) / 12, state: state(i), startDate: i.startDate || "", endDate: i.endDate || "" })),
  ];
  const dueSoon = today ? detected.filter((r) => r.next && !r.missed && daysBetween(today, r.next) <= 14).map((r) => ({ ...r, days: daysBetween(today, r.next) })) : [];
  const missed = detected.filter((r) => r.missed);
  return {
    detected, planned, dueSoon, missed,
    monthlyOut: detected.filter((r) => r.amount < 0).reduce((s, r) => s + r.monthly, 0),
    monthlyIn: detected.filter((r) => r.amount > 0).reduce((s, r) => s + r.monthly, 0),
    dismissed: dismissed.size, total: (plan.transactions ?? []).length,
  };
}
