// modules/transactions/reconcile/compute.js -- PURE. A statement against the ledger: the change the statement shows
// from its starting to its ending balance, the change the account's transactions in the same dates add up to, the gap
// between them, and what could explain it (a line just over the statement's edge, a line entered twice, a line with
// the wrong sign, one or two lines of exactly the gap, two digits swapped). A matching statement is saved as a
// reconciliation, so the next one starts where it ended.
import { ACCOUNT_TYPES, isLiability } from "../../balance/net-worth/compute.js";
import { findDuplicates } from "../duplicates/compute.js";
import { isoOf } from "../../../core/math/dates.js";

/** Lines dated this many days after the statement's end (or before its start) may have posted on either side of it. */
export const NEAR_DAYS = 3;
/** At most this many hints of one kind. */
export const MAX_HINTS = 3;

const cents = (x) => Math.round((Number(x) || 0) * 100);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""));
const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return isoOf(y, m, d + n); };
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Check one statement: { accountId, from (the first day it covers), to (the last day), startBalance (the balance
 * before its first day's lines), endBalance (after its last day's) } as printed (a card's balance is what you owe).
 * The ledger's change = the sum of the account's lines dated from `from` to `to`, both days in; for a debt (a card, a loan) the
 * amount owed moves the other way: change = −sum. Gap = statement change − ledger change. `fix` = the one line (signed
 * as the ledger stores it, money in +) that would close the gap: the gap for an account you own, −gap for a debt.
 * -> { ready, why, account, liability, lines (in the period, by date, with `running` = the balance after it),
 *      statementChange, ledgerChange, gap, fix, matches (gap under half a cent), hints: [{ kind, text, ids, amount }] }
 */
export function reconcile(plan, input = {}) {
  const account = (plan.accounts ?? []).find((a) => a.id === input.accountId) ?? null;
  const start = num(input.startBalance), end = num(input.endBalance);
  if (!account) return { ready: false, why: "account" };
  if (!isDate(input.from) || !isDate(input.to) || input.from > input.to) return { ready: false, why: "dates" };
  if (start === null || end === null) return { ready: false, why: "balances" };
  const liability = isLiability(account.type);
  const sign = liability ? -1 : 1;
  const mine = (plan.transactions ?? []).filter((t) => t.accountId === account.id && isDate(t.date));
  const lines = mine.filter((t) => t.date >= input.from && t.date <= input.to).sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
  let run = cents(start);
  const shown = lines.map((t) => { run += sign * cents(t.amount); return { ...t, running: run / 100 }; });
  const ledgerC = sign * lines.reduce((s, t) => s + cents(t.amount), 0);
  const statementC = cents(end) - cents(start);
  const gapC = statementC - ledgerC;
  const fixC = sign * gapC || 0;
  const out = { ready: true, account, liability, lines: shown, statementChange: statementC / 100, ledgerChange: ledgerC / 100, gap: gapC / 100, fix: fixC / 100, matches: gapC === 0, hints: [] };
  if (gapC === 0) return out;

  const hints = out.hints;
  const add = (kind, text, list, amount) => { if (hints.filter((h) => h.kind === kind).length < MAX_HINTS) hints.push({ kind, text, ids: list.map((t) => t.id), amount }); };
  const usedOnce = new Set();
  // just over the edge: a line dated in the days after the end (or before the start) that the statement counts,
  // or one inside the period, near an edge, that the statement left for the next one
  const after = addDays(input.to, NEAR_DAYS), before = addDays(input.from, -NEAR_DAYS);
  for (const t of mine) {
    const c = cents(t.amount);
    if (c === fixC && ((t.date > input.to && t.date <= after) || (t.date < input.from && t.date >= before))) { add("edge", t.date > input.to ? "dated just after the statement ends: the bank may have counted it in this statement" : "dated just before the statement starts: the bank may have counted it in this statement", [t], c / 100); usedOnce.add(t.id); }
  }
  for (const t of lines) {
    const c = cents(t.amount);
    if (c === -fixC && (t.date > addDays(input.to, -NEAR_DAYS) || t.date < addDays(input.from, NEAR_DAYS))) { add("edge", "near the edge of the statement: the bank may have counted it in the next or the last statement", [t], c / 100); usedOnce.add(t.id); }
  }
  // entered twice: the duplicate finder's pairs in the period whose amount is the gap
  for (const p of findDuplicates(lines)) if (cents(p.drop.amount) === -fixC) { add("twice", `probably entered twice (${p.why})`, [p.keep, p.drop], cents(p.drop.amount) / 100); usedOnce.add(p.drop.id); }
  // one line of exactly the gap: on your ledger but not on the statement (pending, or not this account's)
  for (const t of lines) if (!usedOnce.has(t.id) && cents(t.amount) === -fixC) add("extra", "the same amount as the gap: check it is on the statement (it may still be pending, or belong to another account)", [t], cents(t.amount) / 100);
  // the wrong sign: money in entered as money out (or back), which moves the balance by twice the line
  for (const t of lines) if (cents(t.amount) !== 0 && -2 * cents(t.amount) === fixC) add("sign", t.amount < 0 ? "half the gap: if it was money in, entering it as money out made the gap" : "half the gap: if it was money out, entering it as money in made the gap", [t], cents(t.amount) / 100);
  // two lines that add up to the gap
  for (let i = 0; i < lines.length && hints.filter((h) => h.kind === "pair").length < MAX_HINTS; i++)
    for (let j = i + 1; j < lines.length; j++)
      if (cents(lines[i].amount) + cents(lines[j].amount) === -fixC) { add("pair", "together they make the gap: check both are on the statement", [lines[i], lines[j]], -fixC / 100); break; }
  // two digits swapped in a typed amount: the difference then divides by 9 (in cents)
  if (Math.abs(gapC) % 9 === 0) add("swap", "the gap divides by 9: an amount typed by hand may have two digits swapped (54 typed as 45, for example)", [], gapC / 100);
  // nothing in the ledger explains it
  add("missing", fixC > 0 ? "a line of money in (or a refund) of the gap may be missing from your ledger: import the statement, or add it" : "a line of money out (or a fee or interest) of the gap may be missing from your ledger: import the statement, or add it", [], fixC / 100);
  return out;
}

/** The record saved when a statement matches. */
export const recordOf = (r, input, { id, today } = {}) => ({ id, accountId: input.accountId, from: input.from, to: input.to, startBalance: num(input.startBalance), endBalance: num(input.endBalance), lines: r.lines.length, at: today ?? null });

/** Where the next statement starts for an account: the day after the latest saved one's last day, at its ending balance; or nothing. */
export function nextStart(plan, accountId) {
  const last = (plan.reconciliations ?? []).filter((x) => x.accountId === accountId && isDate(x.to)).sort((a, b) => b.to.localeCompare(a.to))[0];
  return last ? { from: addDays(last.to, 1), startBalance: last.endBalance } : null;
}

/**
 * compute(plan) -> { accounts: [{ id, name, type, label, liability, lines (transactions on file), last (latest saved
 * reconciliation) }] (accounts with transactions first), records: saved reconciliations, newest first, with the
 * account's name; ready (an account with transactions) }
 */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  const recs = plan.reconciliations ?? [];
  const accounts = (plan.accounts ?? []).filter((a) => a?.id).map((a) => {
    const mine = recs.filter((x) => x.accountId === a.id && isDate(x.to)).sort((x, y) => y.to.localeCompare(x.to));
    return { id: a.id, name: a.name || "Account", type: a.type, label: ACCOUNT_TYPES[a.type]?.label ?? "Account", liability: isLiability(a.type), lines: txs.filter((t) => t.accountId === a.id).length, last: mine[0] ?? null };
  }).sort((x, y) => (y.lines > 0) - (x.lines > 0));
  const nameOf = (id) => accounts.find((a) => a.id === id)?.name ?? "An account no longer in the plan";
  const records = [...recs].sort((x, y) => String(y.to).localeCompare(String(x.to))).map((x) => ({ ...x, accountName: nameOf(x.accountId) }));
  return { accounts, records, ready: accounts.some((a) => a.lines > 0) };
}
