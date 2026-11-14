// modules/cashflow/recurring/compute.js -- PURE. Payments that come back: found in the
// transactions (same payee, steady gap between dates) and the ones typed on the Income and
// Expenses pages. Each gets a cadence, a typical amount, the next expected date and whether
// it looks missed. Forecast, Subscriptions and Irregular expenses read this.
import { normalizePayee } from "../../transactions/rules/compute.js";
import { isTransfer, counted } from "../../transactions/ledger/compute.js";
import { categoryLabel, categoryIcon } from "../../transactions/categories/compute.js";
import { CATEGORIES as EXPENSE_CATEGORIES } from "../expenses/compute.js";
import { daysBetween, addMonths } from "../../../core/math/dates.js";
import { PERIODS, periodLabel, payRhythm } from "../../../core/math/periods.js";

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
 *   dueSoon: [{ ...item, days }] within 14 days (detected first), missed: [...], monthlyOut, monthlyIn (detected only), dismissed: n, total,
 *   hidden: [{ key, payee }] (dismissed payees still found in the transactions)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const dismissed = new Set(plan.recurringIgnored ?? []);
  // a line left out of the totals (to be paid back, the money back, left out of reports) is no bill to expect (ledger counted, gap #32)
  const all = detectRecurring(counted(plan), { today, plan });
  const detected = all.filter((r) => !dismissed.has(r.key)).map((r) => ({ ...r, categoryLabel: categoryLabel(plan, r.category), icon: categoryIcon(plan, r.category), monthly: Math.abs(r.amount) * perMonthDays[r.cadence] }));
  // F-026: only items that are live today count as expected; ended and not-yet-started ones are flagged
  const state = (x) => !today ? "active" : x.startDate && String(x.startDate) > today ? "upcoming" : x.endDate && String(x.endDate) < today ? "ended" : "active";
  const planned = [
    ...(plan.expenses ?? []).filter((e) => e.period !== "once").map((e) => ({ id: e.id, kind: "expense", name: e.name, category: e.category, amount: -(Number(e.amount) || 0), period: e.period, periodLabel: periodLabel(e.period), monthly: (Number(e.amount) || 0) * (PERIODS[e.period]?.perYear ?? 12) / 12, state: state(e), startDate: e.startDate || "", endDate: e.endDate || "" })),
    ...(plan.income ?? []).filter((i) => i.period !== "once").map((i) => ({ id: i.id, kind: "income", name: i.name, category: "", amount: Number(i.amount) || 0, period: i.period, periodLabel: payRhythm(i, plan) ? `${i.period === "annual" ? "A year" : "Every three months"}, ${payRhythm(i, plan).words}` : periodLabel(i.period), monthly: (Number(i.amount) || 0) * (PERIODS[i.period]?.perYear ?? 12) / 12, state: state(i), startDate: i.startDate || "", endDate: i.endDate || "" })),
  ];
  const dueSoon = today ? detected.filter((r) => r.next && !r.missed && daysBetween(today, r.next) <= 14).map((r) => ({ ...r, days: daysBetween(today, r.next) })) : [];
  const missed = detected.filter((r) => r.missed);
  return {
    detected, planned, dueSoon, missed,
    monthlyOut: detected.filter((r) => r.amount < 0).reduce((s, r) => s + r.monthly, 0),
    monthlyIn: detected.filter((r) => r.amount > 0).reduce((s, r) => s + r.monthly, 0),
    dismissed: dismissed.size, total: (plan.transactions ?? []).length,
    // the payees hidden with "Not a bill" / "Not a subscription" that are still in the transactions, so they can be put back
    hidden: all.filter((r) => dismissed.has(r.key)).map((r) => ({ key: r.key, payee: r.payee })),
    // gap #6 (2026-11-13): what changed (a bill went up, a new regular charge) and which found bills the plan already
    // holds. Both are new keys after the old ones; with no bank lines both are empty, so nothing else moves.
    ...changesOf(plan, detected, { today }),
  };
}

// ---------------------------------------------------------------- what changed (gap #6, 2026-11-13; README "What changed")
/** A bill "went up" when its newest charge is at least $1 and at least 5% above the middle of the up to three before it. */
export const RISE = Object.freeze({ dollars: 1, share: 0.05, before: 3 });
/** A regular charge is "new" when its first charge is at most this many days old. */
export const NEW_DAYS = 70;
const EPS = 1e-9;   // 17.99 - 15.49 is 2.4999999999999982 in floating point: a rise exactly at the line counts
/** Expenses' period for a found cadence (the same keys: core/math/periods.js). */
export const PERIOD_OF = Object.freeze({ weekly: "weekly", biweekly: "biweekly", semimonthly: "semimonthly", monthly: "monthly", quarterly: "quarterly", annual: "annual" });

/**
 * wentUp(charges) -> null | { from, to, at, mid }: charges are one series' charges, oldest first, as { date, amount } with
 * amount in dollars (positive). `to` is the newest charge, `mid` the middle (median) of the up to three charges before it;
 * the newest counts as a rise when to - mid >= max($1, 5% of mid). It compares the newest only, so a one-off higher
 * charge between two usual ones is not a rise. `at` is the first charge at the new price (the run of charges above the
 * line that ends with the newest) and `from` the charge right before it. Builder's rule on top of the spec's: the charges
 * before the rise were steady (they spread over at most the same line), so a bill that moves from month to month with
 * the season (power, water) is not said to have gone up each time it is higher.
 */
export function wentUp(charges) {
  const c = (charges ?? []).map((x) => ({ date: x.date, amount: Math.abs(Number(x.amount) || 0) }));
  const n = c.length;
  if (n < 2) return null;
  const to = c[n - 1].amount;
  const mid = median(c.slice(Math.max(0, n - 1 - RISE.before), n - 1).map((x) => x.amount));
  const line = Math.max(RISE.dollars, RISE.share * mid);
  if (!(to - mid >= line - EPS)) return null;
  let s = n - 1;
  while (s > 0 && c[s - 1].amount - mid >= line - EPS) s--;
  if (s === 0) return null;
  const pre = c.slice(Math.max(0, s - RISE.before), s).map((x) => x.amount);
  if (Math.max(...pre) - Math.min(...pre) > line + EPS) return null;
  return { from: c[s - 1].amount, to, at: c[s].date, mid };
}

// the words two names must share to be the same bill: three letters or more, and not one every bill shares
const STOP = new Set(["the", "and", "for", "inc", "llc", "ltd", "corp", "company", "bill", "bills", "monthly", "service", "services", "pay", "payment", "payments",
  "membership", "auto", "loan", "loans", "card", "cards", "credit", "debt", "bank", "plan", "other", "fee", "fees"]);
const wordsOf = (...names) => [...new Set(names.flatMap((t) => normalizePayee(t).split(" ")).filter((w) => w.length >= 3 && !STOP.has(w)))];
const near = (a, b, share) => Math.abs(a - b) <= Math.max(1, share * Math.abs(b)) + EPS;

/**
 * inPlanOf(plan, bills, { today }) -> [{ key, how: "added" | "name" | "debt" | "amount", expenseId?, debtId? }] for the found
 * bills (detected rows going out) the plan already holds, so "Add to Expenses" never offers one twice. In this order:
 *   "added"  an expense row carries this bill's key in `payeeKey` (written by "Add to Expenses");
 *   "name"   a live expense row (not one-time, not ended, started) of the same kind shares a name word with the payee
 *            ("Netflix", "Gym", "water"; words every bill shares do not count);
 *   "debt"   a debt on Debts pays it: a name word of its account, else (a line filed as a loan payment, or not filed) the
 *            debt whose payment is closest, within 10% a month, as Expenses matches loan payments (matchDebts);
 *   "amount" a live expense row of the same kind costs the same a month, within $1 or 5%: the closest pairs first, each
 *            row once (typed "Rent $1,500" and "Oak Street Apartments -$1,500.00").
 * "Of the same kind": the bank line's category is the expense row's, or the line is not filed under one of Expenses' own
 * kinds (a "home" in "Car and home insurance" is not the mortgage to Wells Fargo Home).
 */
export function inPlanOf(plan, bills, { today = null } = {}) {
  const live = (plan.expenses ?? []).filter((e) => e && e.period !== "once" && (!today || ((!e.startDate || String(e.startDate) <= today) && (!e.endDate || String(e.endDate) >= today))));
  const sameKind = (r, e) => !CATEGORIES_OUT.has(r.category) || r.category === e.category;
  const out = new Map();
  for (const r of bills) {
    const byKey = (plan.expenses ?? []).find((e) => e?.payeeKey && e.payeeKey === r.key);
    if (byKey) { out.set(r.key, { key: r.key, how: "added", expenseId: byKey.id }); continue; }
    const w = wordsOf(r.payee, r.rawPayee);
    const byName = w.length ? live.find((e) => sameKind(r, e) && wordsOf(e.name).some((x) => w.includes(x))) : null;
    if (byName) out.set(r.key, { key: r.key, how: "name", expenseId: byName.id });
  }
  const accountName = (id) => (plan.accounts ?? []).find((a) => a.id === id)?.name ?? "";
  for (const r of bills) {
    if (out.has(r.key)) continue;
    const w = wordsOf(r.payee, r.rawPayee);
    const debts = plan.debts ?? [];
    let debt = w.length ? debts.find((d) => wordsOf(accountName(d.accountId)).some((x) => w.includes(x))) : null;
    if (!debt && (!r.category || r.category === "debt")) {
      let best = Infinity;
      for (const d of debts) {
        const pay = [Number(d.minPayment) || 0, (Number(d.minPayment) || 0) + (Number(d.extra) || 0)].filter((x) => x > 0);
        for (const x of pay) { const off = Math.abs(r.monthly - x) / x; if (off <= 0.1 + EPS && off < best) { best = off; debt = d; } }
      }
    }
    if (debt) out.set(r.key, { key: r.key, how: "debt", debtId: debt.id });
  }
  const used = new Set([...out.values()].map((x) => x.expenseId).filter(Boolean));
  const monthlyOf = (e) => (Number(e.amount) || 0) * (PERIODS[e.period]?.perYear ?? 12) / 12;
  const pairs = [];
  for (const r of bills) {
    if (out.has(r.key)) continue;
    for (const e of live) if (!used.has(e.id) && sameKind(r, e) && near(r.monthly, monthlyOf(e), 0.05)) pairs.push({ r, e, off: Math.abs(r.monthly - monthlyOf(e)) });
  }
  for (const { r, e } of pairs.sort((a, b) => a.off - b.off)) if (!out.has(r.key) && !used.has(e.id)) { used.add(e.id); out.set(r.key, { key: r.key, how: "amount", expenseId: e.id }); }
  return bills.filter((r) => out.has(r.key)).map((r) => out.get(r.key));
}
// Expenses' own kinds: a bank line filed under one of them is matched only with an expense row of the same kind
const CATEGORIES_OUT = new Set(Object.keys(EXPENSE_CATEGORIES));

/**
 * billFrom(r, rise?) -> the Expenses row "Add to Expenses" writes for a found bill (without its id): the payee's name, its
 * usual amount (the median; the newest price when it went up), how often it comes, the bank line's category when it is
 * one of Expenses' own (else "other") with that category's must-pay default (Expenses' own add does the same), and
 * `payeeKey` so the bill is known as on Expenses from then on.
 */
export function billFrom(r, rise = null) {
  const category = CATEGORIES_OUT.has(r.category) ? r.category : "other";
  const amount = Math.round((rise ? rise.to : Math.abs(Number(r.amount) || 0)) * 100) / 100;
  return { name: r.payee, category, amount, period: PERIOD_OF[r.cadence] ?? "monthly", essential: !!EXPENSE_CATEGORIES[category]?.essential, inflates: true, payeeKey: r.key };
}
/** Adds the found bill to the draft's Expenses (inside ctx.store.update) and returns the row it wrote. */
export function addBill(draft, r, id, rise = null) {
  draft.expenses = draft.expenses ?? [];
  const row = { id, ...billFrom(r, rise) };
  draft.expenses.push(row);
  return row;
}

/**
 * changesOf(plan, detected, { today }) -> { changes, inPlan }
 *   changes: [{ kind: "up", key, payee, from, to, at, cadence, expenseId?, updatedId? } | { kind: "new", key, payee, amount, at, cadence }],
 *     newest first. "up": an outgoing bill whose newest charge went up (wentUp); `expenseId` is the Expenses row that still
 *     holds the old price (found by its key or name, same period, within 50 cents), so one tap can bring it to the new one;
 *     `updatedId` is that row when it already holds the new price (within 50 cents), so the line can say it is done. "new": an
 *     outgoing bill whose first charge is at most NEW_DAYS old, that the plan does not hold yet (inPlanOf), when the bank
 *     file of its account goes back at least one of its gaps before that first charge (else the file only starts there,
 *     and every bill would look new).
 *   inPlan: inPlanOf over the outgoing found bills.
 * With no today, nothing is new. Dismissed bills are not in `detected`, so they never show here.
 */
export function changesOf(plan, detected, { today = null } = {}) {
  const bills = detected.filter((r) => r.amount < 0);
  if (!bills.length) return { changes: [], inPlan: [] };
  const inPlan = inPlanOf(plan, bills, { today });
  const held = new Map(inPlan.map((x) => [x.key, x]));
  // each bill's own charges, grouped as detectRecurring groups them (account + payee, transfers left out), oldest first;
  // and the first day each account's bank file covers
  const want = new Set(bills.map((r) => r.key));
  const series = new Map(), start = new Map();
  for (const t of plan.transactions ?? []) {
    const a = t.accountId ?? "";
    if (t.date && (!start.has(a) || String(t.date) < start.get(a))) start.set(a, String(t.date));
    const key = `${a}|${normalizePayee(t.rawPayee ?? t.payee)}`;
    if (want.has(key) && !isTransfer(t, plan)) (series.get(key) ?? series.set(key, []).get(key)).push(t);
  }
  const changes = [];
  for (const r of bills) {
    const fresh = !!today && !held.has(r.key) && (() => {
      const age = daysBetween(r.first, today);
      const before = daysBetween(start.get(r.accountId ?? "") ?? r.first, r.first);
      return age !== null && age >= 0 && age <= NEW_DAYS && before !== null && before >= CADENCES[r.cadence].min;
    })();
    if (fresh) { changes.push({ kind: "new", key: r.key, payee: r.payee, amount: Math.abs(r.amount), at: r.first, cadence: r.cadence }); continue; }
    const up = wentUp([...(series.get(r.key) ?? [])].sort((a, b) => String(a.date).localeCompare(String(b.date))));
    if (!up) continue;
    const h = held.get(r.key);
    const row = h?.expenseId && (h.how === "added" || h.how === "name") ? (plan.expenses ?? []).find((e) => e.id === h.expenseId) : null;
    const same = !!row && row.period === (PERIOD_OF[r.cadence] ?? "monthly");
    const stale = same && Math.abs((Number(row.amount) || 0) - up.from) < 0.5;
    const updated = same && !stale && Math.abs((Number(row.amount) || 0) - up.to) < 0.5;
    changes.push({ kind: "up", key: r.key, payee: r.payee, from: up.from, to: up.to, at: up.at, cadence: r.cadence, ...(stale ? { expenseId: row.id } : updated ? { updatedId: row.id } : {}) });
  }
  changes.sort((a, b) => String(b.at).localeCompare(String(a.at)) || String(a.payee).localeCompare(String(b.payee)));
  return { changes, inPlan };
}
