// modules/cashflow/sinking-funds/compute.js -- PURE. The costs that do not come monthly:
// yearly insurance, quarterly taxes, gifts, the summer trip, a one-off roof. Each becomes a
// monthly amount to set aside so the money is there when the bill lands. Items come from the
// Expenses page (quarterly, yearly, one-time with a date) and from yearly payments found in
// the transactions.
import { compute as computeRecurring } from "../recurring/compute.js";
import { CATEGORIES } from "../expenses/compute.js";
import { monthsBetween, addMonths, isValidDate } from "../../../core/math/dates.js";
import { PERIODS } from "../../../core/math/periods.js";

/**
 * compute(plan, { today }) -> {
 *   funds: [{ key, name, icon, source: "typed"|"found", amount (per occurrence), period, yearly, monthly (to set aside), next, monthsToNext, saveByThen }],
 *   monthly (total to set aside), yearly, dueNext (funds within 3 months), hasData
 * }
 * saveByThen: what needs to be there by the next due date at the monthly pace (amount when the date is unknown).
 *
 * Gap #12 (H13, H12), all optional on the expense: `setAside` (what is already set aside for a quarterly or yearly bill),
 * `setAsideAt` (the day it was noted) and `nextDue` (the next due date; else the Expenses date rolled on by the cycle).
 * A bill with one of them has `next` rolled to its next due date on or after today; one with `setAside` also has
 * `aside` (asideOf below). With none of them a fund is what it always was, key for key.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const funds = [];
  for (const e of plan.expenses ?? []) {
    const amount = Number(e.amount) || 0; if (amount <= 0) continue;
    const c = CATEGORIES[e.category] ?? CATEGORIES.other;
    if (e.period === "quarterly" || e.period === "annual") {
      const yearly = amount * PERIODS[e.period].perYear;
      const fund = { key: `typed-${e.id}`, expenseId: e.id, name: e.name, icon: c.icon, source: "typed", amount, period: e.period, yearly, monthly: yearly / 12, next: e.startDate || null };
      const aside = setAsideOf(e), ownDue = isValidDate(e.nextDue) ? e.nextDue : null;
      if (aside !== null || ownDue) {
        // followed: the next due date on or after today, from the person's own date, else from the Expenses date
        const base = ownDue ?? e.startDate, at = isValidDate(e.setAsideAt) ? e.setAsideAt : null;
        fund.next = nextDueOn(base, CYCLE[e.period], today);
        // the bill the figure was noted for: the first due date on or after the day it was noted
        if (aside !== null) fund.aside = asideOf({ amount, cycle: CYCLE[e.period], setAside: aside, due: fund.next, today, at, noteFor: at ? nextDueOn(base, CYCLE[e.period], at) : null });
      }
      funds.push(fund);
    } else if (e.period === "once" && e.startDate && (!today || e.startDate >= today)) {
      const months = today ? Math.max(1, monthsBetween(today, e.startDate)) : 12;
      funds.push({ key: `typed-${e.id}`, expenseId: e.id, name: e.name, icon: c.icon, source: "typed", amount, period: "once", yearly: 0, monthly: amount / months, next: e.startDate });
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

/** Months between one bill and the next, for the bills that come back (a one-time cost is never followed). */
export const CYCLE = Object.freeze({ quarterly: 3, annual: 12 });
/** The expense's set-aside figure, or null when it has none (blank, not a number, or below zero). */
function setAsideOf(e) {
  if (e.setAside === null || e.setAside === undefined || e.setAside === "") return null;
  const n = Number(e.setAside);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
/**
 * nextDueOn(base, months, today): the first of base, base + 1 cycle, base + 2 cycles ... that is on or after today, each
 * counted from base (January 31 every three months stays on the 31st when the month has one); base itself without today;
 * null without a valid base.
 */
export function nextDueOn(base, months, today) {
  if (!isValidDate(base)) return null;
  if (!today || base >= today) return base;
  let k = Math.max(0, Math.floor((monthsBetween(base, today) ?? 0) / months));
  let d = addMonths(base, k * months);
  while (d < today) { k++; d = addMonths(base, k * months); }
  return d;
}
/**
 * asideOf({ amount A, cycle L, setAside s, due, today, at, noteFor }) -> { amount: s, at, due, months: n, cycle: L, needed, short, toFinish, extra, lastDue, state }
 * For a bill of A every L months, n whole months until it is due (monthsBetween, as "in 3 months" on the page):
 *   needed by now   = A x (L - n) / L, with L - n held between 0 and L (more than a cycle away: nothing yet)
 *   short           = max(0, needed - s)
 *   each month to finish = (A - s) / max(1, n)
 *   extra           = max(0, s - A)
 * state: "stale" (noteFor, the bill the figure was noted for, is before today: it was noted on or before a due date that
 * has passed, so it was for that bill and says nothing of the next one; lastDue = noteFor, and nothing is worked out),
 * "ready" (s >= A, with or without a date), "no-date" (no due date: the rest cannot be worked out), "short" (short rounds
 * to a dollar or more) or "on-track". Without `at` it cannot be told, and the figure counts. Sources: the README (YNAB's
 * yearly and "fill up to" targets; CFPB savings plan).
 */
export function asideOf({ amount, cycle, setAside, due = null, today = null, at = null, noteFor = null }) {
  const n = due && today ? Math.max(0, monthsBetween(today, due) ?? 0) : null;
  const out = { amount: setAside, at, due: due ?? null, months: n, cycle, needed: null, short: null, toFinish: null, extra: Math.max(0, setAside - amount), lastDue: null, state: "" };
  if (at && noteFor && today && noteFor < today) {
    out.lastDue = noteFor; out.extra = 0; out.state = "stale";
    return out;
  }
  if (n !== null) {
    out.needed = amount * Math.min(cycle, Math.max(0, cycle - n)) / cycle;
    out.short = Math.max(0, out.needed - setAside);
    out.toFinish = Math.max(0, amount - setAside) / Math.max(1, n);
  }
  out.state = setAside >= amount ? "ready" : n === null ? "no-date" : Math.round(out.short) >= 1 ? "short" : "on-track";
  if (out.state === "ready") out.toFinish = 0;
  return out;
}
