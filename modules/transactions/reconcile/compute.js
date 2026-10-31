// modules/transactions/reconcile/compute.js -- PURE. A statement against the ledger: the change the statement shows
// from its starting to its ending balance, the change the account's transactions in the same dates add up to, the gap
// between them, and what could explain it (a line entered twice, a line just over the statement's edge, one or two
// lines of exactly the gap, the same amount under another account, a line with the wrong sign, two digits swapped, a
// starting balance that differs from where the last check ended, a missing line). A matching statement is saved as a
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
 * Every amount (in cents, keeping its sign) made by swapping two different digits of `c`, written with at least one
 * digit before the cents (5 cents is 0.05), never with a new leading 0. 86.40 -> 68.40, 46.80, 80.46, 86.04, ...
 */
export function digitSwaps(c) {
  const s = String(Math.abs(Math.round(c))).padStart(3, "0"), out = [];
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++)
      if (s[i] !== s[j] && !(i === 0 && s[j] === "0")) { const a = [...s]; [a[i], a[j]] = [a[j], a[i]]; out.push((c < 0 ? -1 : 1) * Number(a.join(""))); }
  return out;
}

/** Saved checks for one account, the newest saved first (records are added at the end, so a tie on the last day goes to the newer one). */
const savedFor = (plan, accountId) => [...(plan.reconciliations ?? [])].reverse().filter((x) => x?.accountId === accountId && isDate(x.to));

/**
 * Check one statement: { accountId, from (the first day it covers), to (the last day), startBalance (the balance
 * before its first day's lines), endBalance (after its last day's) } as printed (a card's balance is what you owe).
 * A card or loan with both balances typed at or below 0 is read as what is owed (the minus left out, as the rest of the
 * app reads a debt), unless the numbers as typed already agree (a card in credit at both ends).
 * The ledger's change = the sum of the account's lines dated from `from` to `to`, both days in; for a debt (a card, a loan) the
 * amount owed moves the other way: change = −sum. Gap = statement change − ledger change. `fix` = the one line (signed
 * as the ledger stores it, money in +) that would close the gap: the gap for an account you own, −gap for a debt.
 * -> { ready, why, account, liability, startBalance, endBalance (as read), minus (read as owed), lines (in the period,
 *      by date, same-day lines in the order on file, with `running` = the balance after it and `dayEnd` = the last line
 *      of its day), statementChange, ledgerChange, gap, fix, matches (gap under half a cent), newest (the account's
 *      latest transaction date, or null), overlaps (saved checks of this account sharing a day, `same` when the same
 *      dates), hints: [{ kind, text, ids, amount }] }
 */
export function reconcile(plan, input = {}) {
  const account = (plan.accounts ?? []).find((a) => a.id === input.accountId) ?? null;
  let start = num(input.startBalance), end = num(input.endBalance);
  if (!account) return { ready: false, why: "account" };
  if (!isDate(input.from) || !isDate(input.to) || input.from > input.to) return { ready: false, why: "dates" };
  if (start === null || end === null) return { ready: false, why: "balances" };
  const liability = isLiability(account.type);
  const sign = liability ? -1 : 1;
  const mine = (plan.transactions ?? []).filter((t) => t.accountId === account.id && isDate(t.date));
  const lines = mine.filter((t) => t.date >= input.from && t.date <= input.to).sort((a, b) => a.date.localeCompare(b.date));
  const ledgerC = sign * lines.reduce((s, t) => s + cents(t.amount), 0);
  // a debt typed with the minus sign: read it as what is owed, unless it already agrees as typed
  let minus = false;
  if (liability && cents(start) <= 0 && cents(end) <= 0 && (cents(start) < 0 || cents(end) < 0) && cents(end) - cents(start) !== ledgerC) { start = Math.abs(start); end = Math.abs(end); minus = true; }
  let run = cents(start);
  const shown = lines.map((t, i) => { run += sign * cents(t.amount); return { ...t, running: run / 100, dayEnd: lines[i + 1]?.date !== t.date }; });
  const statementC = cents(end) - cents(start);
  const gapC = statementC - ledgerC;
  const fixC = sign * gapC || 0;
  const newest = mine.reduce((m, t) => (!m || t.date > m ? t.date : m), null);
  const saved = savedFor(plan, account.id).filter((x) => isDate(x.from));
  const overlaps = saved.filter((x) => x.from <= input.to && x.to >= input.from).map((x) => ({ ...x, same: x.from === input.from && x.to === input.to }));
  const out = { ready: true, account, liability, startBalance: start, endBalance: end, minus, lines: shown, statementChange: statementC / 100, ledgerChange: ledgerC / 100, gap: gapC / 100, fix: fixC / 100, matches: gapC === 0, newest, overlaps, hints: [] };
  if (gapC === 0) return out;

  const hints = out.hints;
  // a hint is kept when its kind has room; a line is "used" only when its hint was kept
  const add = (kind, text, list, amount) => { if (hints.filter((h) => h.kind === kind).length >= MAX_HINTS) return false; hints.push({ kind, text, ids: list.map((t) => t.id), amount }); return true; };
  const usedOnce = new Set();
  // days inside another statement of this account already saved as matching: its lines were counted there
  const checked = saved.filter((x) => x.to < input.from || x.from > input.to);
  const inChecked = (day) => checked.some((x) => day >= x.from && day <= x.to);
  const prevChecked = inChecked(addDays(input.from, -1)), nextChecked = inChecked(addDays(input.to, 1));

  // entered twice: the duplicate finder's pairs whose copy is in the period and whose amount is the gap (the day
  // before the period is looked at too, for a pending line on the last day of the previous statement that posted again)
  const dupScope = mine.filter((t) => t.date >= addDays(input.from, -1) && t.date <= input.to);
  for (const p of findDuplicates(dupScope)) if (p.drop.date >= input.from && cents(p.drop.amount) === -fixC && add("twice", `probably entered twice (${p.why})`, [p.keep, p.drop], cents(p.drop.amount) / 100)) { usedOnce.add(p.keep.id); usedOnce.add(p.drop.id); }
  // just over the edge: a line dated in the days after the end (or before the start) that the statement counts,
  // or one inside the period, near an edge, that the statement left for the next (or the previous) one
  const after = addDays(input.to, NEAR_DAYS), before = addDays(input.from, -NEAR_DAYS);
  for (const t of mine) {
    const c = cents(t.amount);
    if (!usedOnce.has(t.id) && c === fixC && !inChecked(t.date) && ((t.date > input.to && t.date <= after) || (t.date < input.from && t.date >= before)) && add("edge", t.date > input.to ? "dated just after the statement ends: the bank may have counted it in this statement" : "dated just before the statement starts: the bank may have counted it in this statement", [t], c / 100)) usedOnce.add(t.id);
  }
  for (const t of lines) {
    const c = cents(t.amount);
    if (usedOnce.has(t.id) || c !== -fixC) continue;
    const nearEnd = !nextChecked && t.date > addDays(input.to, -NEAR_DAYS), nearStart = !prevChecked && t.date < addDays(input.from, NEAR_DAYS);
    if ((nearEnd || nearStart) && add("edge", nearEnd ? "dated in the last few days of this statement: the bank may have put it on the next one" : "dated in the first few days of this statement: the bank may have put it on the previous one", [t], c / 100)) usedOnce.add(t.id);
  }
  // one line of exactly the gap: on your ledger but not on the statement (pending, or not this account's)
  for (const t of lines) if (!usedOnce.has(t.id) && cents(t.amount) === -fixC) add("extra", "the same amount as the difference: check it is on the statement (it may still be pending, or belong to another account)", [t], cents(t.amount) / 100);
  // the same amount filed under another account (not a transfer between your own): it may belong to this one
  const nameOf = (id) => (plan.accounts ?? []).find((a) => a.id === id)?.name || "another account";
  for (const t of plan.transactions ?? []) if (t.accountId !== account.id && !t.transferId && isDate(t.date) && t.date >= input.from && t.date <= input.to && cents(t.amount) === fixC) add("elsewhere", `the same amount is in the app under ${nameOf(t.accountId)}: it may belong to this account instead`, [t], cents(t.amount) / 100);
  // the wrong sign: money in entered as money out (or back), which moves the balance by twice the line
  for (const t of lines) if (cents(t.amount) !== 0 && -2 * cents(t.amount) === fixC) add("sign", t.amount < 0 ? "half the difference: if this was really money in (a refund), it was entered as money out, which doubles the difference" : "half the difference: if this was really money out (a purchase), it was entered as money in, which doubles the difference", [t], cents(t.amount) / 100);
  // two lines that add up to the gap (a line of 0, such as a card check, is no part of a pair)
  const nz = lines.filter((t) => cents(t.amount) !== 0);
  for (let i = 0; i < nz.length && hints.filter((h) => h.kind === "pair").length < MAX_HINTS; i++)
    for (let j = i + 1; j < nz.length; j++)
      if (cents(nz[i].amount) + cents(nz[j].amount) === -fixC) { add("pair", "together they make the difference: check both are on the statement", [nz[i], nz[j]], -fixC / 100); break; }
  // two digits swapped: a line whose amount, with two digits the other way round, closes the gap; or one of the two
  // balances typed here (a swap changes a number by a multiple of 9, so only then is it looked for)
  if (Math.abs(fixC) % 9 === 0) for (const t of lines) { const c = cents(t.amount); if (digitSwaps(c).some((v) => v - c === fixC)) add("swap", "two digits of this amount may be the wrong way round (54 typed as 45, for example): check it against the statement", [t], c / 100); }
  if (Math.abs(gapC) % 9 === 0) {
    const sc = cents(start), ec = cents(end);
    if (digitSwaps(ec).some((v) => v - ec === -gapC) || digitSwaps(sc).some((v) => v - sc === gapC)) add("swap", "one of the balances typed here may have two digits the wrong way round (54 typed as 45, for example): check both against the statement", [], fixC / 100);
  }
  // the starting balance typed differently from where the last checked statement ended
  const prev = nextStart(plan, account.id);
  if (prev && prev.from === input.from && num(prev.startBalance) !== null && cents(prev.startBalance) - cents(start) === gapC) add("start", "the starting balance typed here differs from where your last checked statement ended: check it against the statement", [], fixC / 100);
  // nothing in the ledger explains it
  add("missing", fixC > 0 ? "money in of this amount (a deposit, refund or payment) may be on the statement but not in the app: import the statement, or add it on the Ledger page" : "money out of this amount (a purchase, fee or interest) may be on the statement but not in the app: import the statement, or add it on the Ledger page", [], fixC / 100);
  return out;
}

/** The record saved when a statement matches (its balances as read: a debt as what is owed). */
export const recordOf = (r, input, { id, today } = {}) => ({ id, accountId: input.accountId, from: input.from, to: input.to, startBalance: r.startBalance ?? num(input.startBalance), endBalance: r.endBalance ?? num(input.endBalance), lines: r.lines.length, at: today ?? null });

/** The saved checks after saving `rec`: it replaces one of the same account and dates, and goes at the end (the newest). */
export const saveRecord = (list, rec) => [...(list ?? []).filter((y) => !(y?.accountId === rec.accountId && y?.from === rec.from && y?.to === rec.to)), rec];

/** Where the next statement starts for an account: the day after the latest saved one's last day (the newest saved on a tie), at its ending balance; or nothing. */
export function nextStart(plan, accountId) {
  const last = savedFor(plan, accountId).sort((a, b) => b.to.localeCompare(a.to))[0];
  return last ? { from: addDays(last.to, 1), startBalance: last.endBalance } : null;
}

/**
 * compute(plan) -> { accounts: [{ id, name, type, label, liability, lines (transactions on file), last (latest saved
 * reconciliation, the newest saved on a tie) }] (accounts with transactions first), records: saved reconciliations,
 * latest first, with the account's name and whether it is a debt; ready (an account with transactions) }
 */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  const recs = plan.reconciliations ?? [];
  const accounts = (plan.accounts ?? []).filter((a) => a?.id).map((a) => {
    const mine = savedFor(plan, a.id).sort((x, y) => y.to.localeCompare(x.to));
    return { id: a.id, name: a.name || "Account", type: a.type, label: ACCOUNT_TYPES[a.type]?.label ?? "Account", liability: isLiability(a.type), lines: txs.filter((t) => t.accountId === a.id).length, last: mine[0] ?? null };
  }).sort((x, y) => (y.lines > 0) - (x.lines > 0));
  const of = (id) => accounts.find((a) => a.id === id);
  const records = [...recs].reverse().sort((x, y) => String(y.to).localeCompare(String(x.to))).map((x) => ({ ...x, accountName: of(x.accountId)?.name ?? "An account no longer in the plan", liability: of(x.accountId)?.liability ?? false }));
  return { accounts, records, ready: accounts.some((a) => a.lines > 0) };
}
