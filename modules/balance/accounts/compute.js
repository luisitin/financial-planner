// modules/balance/accounts/compute.js -- PURE. One account in detail: its balance over time (the points saved in
// `accounts[].history`, from Net worth's "save today's totals" or added here, plus the balance on file at its date),
// the change over that time, what went in and out of it from its transactions (the last 30 days and the last six
// months), its latest transactions, and its last checked statement with what the lines since then add up to.
import { ACCOUNT_TYPES, isLiability } from "../net-worth/compute.js";
import { isoOf, daysBetween } from "../../../core/math/dates.js";

/** Days counted as "the last 30 days". */
export const RECENT_DAYS = 30;
/** Months shown in the money in and out list. */
export const MONTHS = 6;

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""));
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const cents = (x) => Math.round((Number(x) || 0) * 100);
const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return isoOf(y, m, d + n); };

/**
 * The balance points, oldest first, one per day: the saved history, and the balance on file at its `asOf` date (it wins
 * on that day). A debt's balance is what is owed (kept positive, as Net worth counts it).
 */
export function points(account) {
  if (!account) return [];
  const liability = isLiability(account.type);
  const val = (b) => (liability ? Math.abs(b) : b);
  const byDay = new Map();
  for (const h of account.history ?? []) { const b = num(h?.balance); if (isDate(h?.date) && b !== null) byDay.set(h.date, val(b)); }
  const cur = num(account.balance);
  if (isDate(account.asOf) && cur !== null) byDay.set(account.asOf, val(cur));
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, balance]) => ({ date, balance }));
}

/** The change from the first point to the last: { from, to, amount, share (null when the first is 0), days }. */
export function change(pts) {
  if (!pts || pts.length < 2) return null;
  const a = pts[0], b = pts[pts.length - 1];
  const days = daysBetween(a.date, b.date);
  return { from: a, to: b, amount: (cents(b.balance) - cents(a.balance)) / 100, share: a.balance ? (b.balance - a.balance) / Math.abs(a.balance) : null, days };
}

/**
 * Money in and out of the account from its transactions (money in +, out −, as the ledger stores them; transfers
 * between your own accounts included, since they move this account's balance):
 * { recent: { in, out, net, count } over the RECENT_DAYS days to today, months: [{ month "YYYY-MM", in, out, net, count }]
 * for the MONTHS months to today's, newest first }
 */
export function flows(txs, today) {
  const from = addDays(today, -(RECENT_DAYS - 1));
  const sum = (list) => { let i = 0, o = 0; for (const t of list) { const c = cents(t.amount); if (c > 0) i += c; else o += c; } return { in: i / 100, out: o / 100, net: (i + o) / 100, count: list.length }; };
  const recent = sum(txs.filter((t) => isDate(t.date) && t.date >= from && t.date <= today));
  const [y, m] = today.split("-").map(Number);
  const months = Array.from({ length: MONTHS }, (_, k) => { const d = new Date(Date.UTC(y, m - 1 - k, 1)); const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; return { month: key, ...sum(txs.filter((t) => String(t.date).slice(0, 7) === key && t.date <= today)) }; });
  return { recent, months };
}

/**
 * Since the last checked statement (`reconciliations`, transactions/reconcile): its end balance, plus the lines dated
 * after its last day (− for a debt), is what the ledger says the balance is now; with the balance on file at a later
 * or equal date, the difference between the two. -> { check, lines, ledgerBalance, onFile, onFileDate, gap } | null
 */
export function sinceCheck(plan, account) {
  const check = (plan.reconciliations ?? []).filter((x) => x.accountId === account.id && isDate(x.to) && num(x.endBalance) !== null).sort((a, b) => b.to.localeCompare(a.to))[0];
  if (!check) return null;
  const sign = isLiability(account.type) ? -1 : 1;
  const onFileDate = isDate(account.asOf) && account.asOf >= check.to ? account.asOf : null;
  const lines = (plan.transactions ?? []).filter((t) => t.accountId === account.id && isDate(t.date) && t.date > check.to && (!onFileDate || t.date <= onFileDate));
  const ledgerC = cents(check.endBalance) + sign * lines.reduce((s, t) => s + cents(t.amount), 0);
  const cur = num(account.balance);
  const onFile = onFileDate && cur !== null ? (isLiability(account.type) ? Math.abs(cur) : cur) : null;
  return { check, lines: lines.length, ledgerBalance: ledgerC / 100, onFile, onFileDate, gap: onFile === null ? null : (cents(onFile) - ledgerC) / 100 };
}

/**
 * compute(plan, { today, accountId }) -> {
 *   accounts: [{ id, name, label, liability, balance, lines }] (for the picker),
 *   account: { id, name, type, label, liability, institution, owner, balance, asOf, notes } | null (the chosen one, or the first),
 *   points, change, flows, recent (the latest 5 transactions), lines (its transactions on file), since (sinceCheck)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const all = (plan.accounts ?? []).filter((a) => a?.id);
  const txs = plan.transactions ?? [];
  const people = plan.household?.people ?? [];
  const accounts = all.map((a) => ({ id: a.id, name: a.name || "Account", label: ACCOUNT_TYPES[a.type]?.label ?? "Account", liability: isLiability(a.type), balance: num(a.balance), lines: txs.filter((t) => t.accountId === a.id).length }));
  const a = all.find((x) => x.id === params.accountId) ?? all[0] ?? null;
  if (!a) return { accounts, account: null };
  const mine = txs.filter((t) => t.accountId === a.id);
  const owner = a.ownerId ? (people.find((p) => p.id === a.ownerId)?.name ?? a.ownerId) : null;
  const pts = points(a);
  return {
    accounts,
    account: { id: a.id, name: a.name || "Account", type: a.type, label: ACCOUNT_TYPES[a.type]?.label ?? "Account", liability: isLiability(a.type), institution: a.institution || null, owner, balance: num(a.balance), asOf: isDate(a.asOf) ? a.asOf : null, notes: String(a.notes ?? "") },
    points: pts, change: change(pts),
    flows: isDate(today) ? flows(mine, today) : null,
    recent: [...mine].filter((t) => isDate(t.date)).sort((x, y) => y.date.localeCompare(x.date) || String(y.id).localeCompare(String(x.id))).slice(0, 5),
    lines: mine.length,
    since: sinceCheck(plan, a),
  };
}

/** Add or replace (same day) a balance point on the plan draft's account; changes `draft` in place. -> true when done */
export function addPoint(draft, accountId, date, balance) {
  const a = (draft.accounts ?? []).find((x) => x.id === accountId);
  const b = num(balance);
  if (!a || !isDate(date) || b === null) return false;
  a.history = (a.history ?? []).filter((h) => h?.date !== date);
  a.history.push({ date, balance: b });
  a.history.sort((x, y) => String(x.date).localeCompare(String(y.date)));
  return true;
}
/** Remove the saved point of that day (the balance on file itself is changed on Net worth). -> true when one went */
export function removePoint(draft, accountId, date) {
  const a = (draft.accounts ?? []).find((x) => x.id === accountId);
  if (!a) return false;
  const n = (a.history ?? []).length;
  a.history = (a.history ?? []).filter((h) => h?.date !== date);
  return a.history.length < n;
}
