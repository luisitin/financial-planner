// modules/transactions/ledger/compute.js -- PURE. Every transaction, filtered and totalled.
// Also the shared helpers other transaction pages use: the duplicate key, month labels,
// and the sign convention. Transaction shape (plan.transactions):
//   { id, date "YYYY-MM-DD", amount (+ in, - out), payee, rawPayee?, accountId, category ("" = none),
//     tags: [], note, transferId?, importId?, key }
import { normalizePayee } from "../rules/compute.js";
import { categoryLabel, categoryIcon, categoryById } from "../categories/compute.js";

/** The identity of a bank line for duplicate detection: account + date + amount + cleaned payee. */
export const txKey = (t) => `${t.accountId ?? ""}|${t.date ?? ""}|${(Math.round((Number(t.amount) || 0) * 100) / 100).toFixed(2)}|${normalizePayee(t.rawPayee ?? t.payee)}`;
export const monthOf = (date) => String(date ?? "").slice(0, 7);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (ym) => { const m = /^(\d{4})-(\d{2})/.exec(String(ym ?? "")); return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(ym ?? ""); };
/** coverage(plan) -> { from, to } | null: the first and last transaction dates, the days the imported bank files cover. */
export function coverage(plan) {
  let from = null, to = null;
  for (const t of plan.transactions ?? []) { const d = String(t.date ?? ""); if (!/^\d{4}-\d{2}-\d{2}/.test(d)) continue; if (!from || d < from) from = d.slice(0, 10); if (!to || d > to) to = d.slice(0, 10); }
  return from ? { from, to } : null;
}
/** Days either end of a month the files may miss and still count as covering it: a file cut on the 29th, or a quiet 1st. */
export const COVER_SLACK = 3;
/**
 * monthCover(cov, ym, today) -> { ym, from, to, firstDay, lastDay, days, daysInMonth, full }
 * The part of a month the bank files cover: from the later of the 1st and the first transaction to the earlier of the month's
 * last day, the last transaction and today. `full` when it misses at most COVER_SLACK days at either end and the month is over.
 * Days are day-of-month numbers; days = 0 when the files do not reach the month.
 */
export function monthCover(cov, ym, today = null) {
  const y = Number(String(ym).slice(0, 4)), m = Number(String(ym).slice(5, 7));
  const daysInMonth = new Date(y, m, 0).getDate();
  const start = `${ym}-01`, end = `${ym}-${String(daysInMonth).padStart(2, "0")}`;
  let from = cov?.from && cov.from > start ? cov.from : start;
  let to = cov?.to && cov.to < end ? cov.to : end;
  if (today && today < to) to = today;
  if (!cov || from > to || cov.to < start || cov.from > end) return { ym, from: null, to: null, firstDay: 0, lastDay: 0, days: 0, daysInMonth, full: false };
  const firstDay = Number(from.slice(8, 10)), lastDay = Number(to.slice(8, 10));
  const over = !today || today > end;
  return { ym, from, to, firstDay, lastDay, days: lastDay - firstDay + 1, daysInMonth, full: over && firstDay <= 1 + COVER_SLACK && lastDay >= daysInMonth - COVER_SLACK };
}
/** Transfers between the owner's own accounts are neither income nor spending. */
export const isTransfer = (t, plan) => !!t.transferId || t.category === "transfer" || categoryById(plan, t.category)?.kind === "transfer";

/**
 * compute(plan, { month, accountId, category, q, limit, offset }) -> {
 *   rows: [{ ...tx, categoryLabel, icon, accountName, transfer }] (newest first, then largest),
 *   shown, matched, total (all transactions), in, out, net (over the matched set, transfers excluded),
 *   months: [{ ym, label, count }] newest first, accounts: [{ id, name, count }],
 *   uncategorised (matched set), uncategorisedAll, hasMore
 * }
 * Filters: month "YYYY-MM" ("" = all), accountId, category ("" = any, "none" = uncategorised), q (payee/note text).
 */
export function compute(plan, params = {}) {
  const { month = "", accountId = "", category = "", q = "", limit = 100, offset = 0 } = params;
  const all = plan.transactions ?? [];
  const accounts = plan.accounts ?? [];
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? "Unknown account";
  const qq = String(q).trim().toLowerCase();
  const matched = all.filter((t) => (!month || monthOf(t.date) === month) && (!accountId || t.accountId === accountId)
    && (!category || (category === "none" ? !t.category : t.category === category))
    && (!qq || String(t.payee ?? "").toLowerCase().includes(qq) || String(t.rawPayee ?? "").toLowerCase().includes(qq) || String(t.note ?? "").toLowerCase().includes(qq)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)));
  let inn = 0, out = 0;
  for (const t of matched) { if (isTransfer(t, plan)) continue; const a = Number(t.amount) || 0; if (a >= 0) inn += a; else out += -a; }
  const monthMap = new Map();
  for (const t of all) { const ym = monthOf(t.date); monthMap.set(ym, (monthMap.get(ym) ?? 0) + 1); }
  const months = [...monthMap.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([ym, count]) => ({ ym, label: monthLabel(ym), count }));
  const acctMap = new Map();
  for (const t of all) acctMap.set(t.accountId, (acctMap.get(t.accountId) ?? 0) + 1);
  const rows = matched.slice(offset, offset + limit).map((t) => ({ ...t, categoryLabel: categoryLabel(plan, t.category), icon: categoryIcon(plan, t.category), accountName: name(t.accountId), transfer: isTransfer(t, plan) }));
  return {
    rows, shown: rows.length, matched: matched.length, total: all.length, in: inn, out, net: inn - out,
    months, accounts: [...acctMap.entries()].map(([id, count]) => ({ id, name: name(id), count })).sort((a, b) => b.count - a.count),
    uncategorised: matched.filter((t) => !t.category).length, uncategorisedAll: all.filter((t) => !t.category).length,
    hasMore: offset + limit < matched.length,
  };
}
