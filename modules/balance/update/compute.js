// modules/balance/update/compute.js -- PURE. "Update my balances": every account on one screen with the balance on
// file and how old it is; saving dates each typed balance today (a point in the account's history, the balance on
// file, its "as of"), and records today's totals on Net worth's history, in one step.
import { ACCOUNT_TYPES, isLiability, countedBalance, compute as netWorthOf } from "../net-worth/compute.js";
import { saveBalance, addPoint } from "../accounts/compute.js";
import { daysBetween, isValidDate } from "../../../core/math/dates.js";

/** A balance older than this many days is shown as needing an update (the monthly review's rhythm). */
export const STALE_DAYS = 31;

/**
 * params.today ("YYYY-MM-DD"). -> { rows: [{ id, name, typeLabel, debt, balance (as typed: what is owed for a debt),
 * asOf, days, stale }], stale, count, oldest, netWorth, lastSaved }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const accounts = plan.accounts ?? [];
  const rows = accounts.map((a) => {
    const debt = isLiability(a.type);
    const asOf = isValidDate(a.asOf) ? a.asOf : null;
    const days = asOf && today ? Math.max(0, daysBetween(asOf, today)) : null;
    return {
      id: a.id, name: a.name || "Unnamed account", typeLabel: (ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset).label, debt,
      balance: debt ? countedBalance(a) : Number(a.balance) || 0,
      asOf, days, stale: days === null || days > STALE_DAYS,
    };
  });
  // what you own first, biggest first; then what you owe
  rows.sort((x, y) => Number(x.debt) - Number(y.debt) || Math.abs(y.balance) - Math.abs(x.balance));
  const dated = rows.filter((r) => r.asOf).map((r) => r.asOf).sort();
  const nw = netWorthOf(plan, { today });
  const history = nw.history;
  return {
    rows, count: rows.length, stale: rows.filter((r) => r.stale).length,
    oldest: dated[0] ?? null, netWorth: nw.netWorth,
    lastSaved: history.length ? history[history.length - 1] : null,
  };
}

/**
 * The balance on file counts as a point on its own date (Account detail's chart); before it is replaced by a newer one,
 * keep it as a history point of that day (unless that day already has one, or it is not before `today`), so the chart
 * keeps the old balance.
 */
export function keepOnFile(draft, a, today) {
  if (!a || !isValidDate(a.asOf) || a.balance === null || a.balance === undefined || a.balance === "") return false;
  if (today && !(a.asOf < today)) return false;   // today's is replaced anyway; a future date is a typo, not history
  if ((a.history ?? []).some((h) => h?.date === a.asOf)) return false;
  return addPoint(draft, a.id, a.asOf, Number(a.balance));
}

/**
 * looksLikeSlip(was, now) -> true when the two whole-dollar figures are one key slip apart: one digit added or dropped
 * (115,000 for 11,500; 105,000 for 15,000), two zeros added or dropped (100,000 for 1,000), or two neighbouring digits
 * swapped (51,000 for 15,000, at least 15% apart). Both must be at least $100. Signs are ignored (a debt is typed as what
 * is owed). Decided on the digits, not the ratio (review 2026-11-02: a ratio of about 10 flagged ordinary months, a card
 * paid from 2,500 to 250 beside checking from 600 to 5,400, and missed 15,000 for 105,000). Some real changes still look
 * like a slip (6,400 to 640), so the pages ask with "it changed" as the default answer.
 */
export function looksLikeSlip(was, now) {
  const a = Math.abs(Number(was)), b = Math.abs(Number(now));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 100 || b < 100 || Math.abs(a - b) < 0.5) return false;
  const x = String(Math.round(a)), y = String(Math.round(b));
  if (x === y) return false;
  const [long, short] = x.length >= y.length ? [x, y] : [y, x];
  // one digit added or dropped
  if (long.length === short.length + 1) for (let i = 0; i < long.length; i++) if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  // two zeros added or dropped
  if (long.length === short.length + 2) for (let i = 0; i < long.length; i++) for (let j = i + 1; j < long.length; j++)
    if (long[i] === "0" && long[j] === "0" && long.slice(0, i) + long.slice(i + 1, j) + long.slice(j + 1) === short) return true;
  // two neighbours swapped
  if (x.length === y.length && Math.abs(a - b) / Math.max(a, b) >= 0.15) {
    const diff = [...x].map((c, i) => c !== y[i] ? i : -1).filter((i) => i >= 0);
    if (diff.length === 2 && diff[1] === diff[0] + 1 && x[diff[0]] === y[diff[1]] && x[diff[1]] === y[diff[0]]) return true;
  }
  return false;
}

/**
 * correctSlip(draft, accountId, value) -> { fixed (points and saved totals changed), wrong (the figure on file, as
 * counted), from (the first day it stood, or null) }. The balance on file was a typing mistake and `value` (typed as
 * counted: what is owed, for a debt) is what it always was. The account's points that carry the wrong figure, from the
 * day it was typed on (the balance on file's date, or the earliest of the run of equal points ending the history),
 * take the right one, and Net worth's saved totals from that day on move by the difference, so no fall or jump is drawn
 * and "since" compares true figures. The balance on file becomes `value` with its date unchanged; callers date it.
 * Changes `draft` in place.
 */
export function correctSlip(draft, accountId, value) {
  const a = (draft.accounts ?? []).find((x) => x.id === accountId);
  const v = Math.abs(Number(value));
  if (!a || !Number.isFinite(v)) return { fixed: 0, wrong: null, from: null };
  const debt = isLiability(a.type);
  const wrong = debt ? countedBalance(a) : Number(a.balance) || 0;
  const right = debt ? v : Number(value);
  const sameAs = (h) => Math.abs((debt ? Math.abs(Number(h.balance) || 0) : Number(h.balance) || 0) - wrong) < 0.005;
  const pts = [...(a.history ?? [])].filter((h) => isValidDate(h?.date)).sort((x, y) => String(x.date).localeCompare(String(y.date)));
  let from = isValidDate(a.asOf) ? a.asOf : null;
  for (let i = pts.length - 1; i >= 0 && sameAs(pts[i]); i--) if (!from || pts[i].date < from) from = pts[i].date;
  let fixed = 0;
  const signed = (n) => debt ? (Number(a.balance) < 0 ? -Math.abs(n) : Math.abs(n)) : n;
  if (from) for (const h of a.history ?? []) if (isValidDate(h?.date) && h.date >= from && sameAs(h)) { h.balance = signed(right); fixed++; }
  const delta = right - wrong;
  // saved totals move only from the day the wrong figure was typed (typedOn), not from a back-dated "as of": a total saved
  // before it was typed never held it (review 2026-11-02: a fake dip and recovery). Today's total is refreshed whenever a
  // balance is typed (markTyped), so a total on the typed day holds it.
  const since = isValidDate(a.typedOn) && (!from || a.typedOn > from) ? a.typedOn : from;
  if (since && Math.abs(delta) > 0.004) for (const s of draft.netWorthHistory ?? []) {
    if (!isValidDate(s?.date) || s.date < since) continue;
    if (debt) { s.liabilities = (Number(s.liabilities) || 0) + delta; s.netWorth = (Number(s.netWorth) || 0) - delta; }
    else { s.assets = (Number(s.assets) || 0) + delta; s.netWorth = (Number(s.netWorth) || 0) + delta; }
    fixed++;
  }
  a.balance = signed(right);
  return { fixed, wrong, from };
}

/**
 * markTyped(draft, accountId, today): the balance on file was typed today. Records `typedOn` (correctSlip then moves
 * saved totals only from that day) and refreshes today's saved total if there is one, so a total never holds an older
 * figure than the balances on file that day (Account detail and Net worth's edit form call it; saveAll does both itself).
 */
export function markTyped(draft, accountId, today) {
  const a = (draft.accounts ?? []).find((x) => x.id === accountId);
  if (!a || !isValidDate(today)) return;
  a.typedOn = today;
  const i = (draft.netWorthHistory ?? []).findIndex((h) => h?.date === today);
  if (i >= 0) { const t = netWorthOf(draft, { today }); draft.netWorthHistory[i] = { ...draft.netWorthHistory[i], assets: t.assets, liabilities: t.liabilities, netWorth: t.netWorth }; }
}

/**
 * slipsIn(plan, typed) -> [{ id, name, was, now }]: the boxes on Update my balances whose new figure looks like a slip
 * of the keys next to the one on file (looksLikeSlip), so the page can ask before saving.
 */
export function slipsIn(plan, typed) {
  const out = [];
  for (const a of plan.accounts ?? []) {
    if (!Object.prototype.hasOwnProperty.call(typed ?? {}, a.id)) continue;
    const v = typed[a.id];
    if (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) continue;
    const was = isLiability(a.type) ? countedBalance(a) : Number(a.balance) || 0;
    if (looksLikeSlip(was, v)) out.push({ id: a.id, name: a.name || "Account", was, now: Number(v) });
  }
  return out;
}

/**
 * Save the balances typed on the page, all dated `today`. typed: { [accountId]: number | null } (null or missing = the box
 * was cleared or never shown: that account is left alone). A balance typed the same as the one on file still counts:
 * it says "still right today", so its date moves to today. A debt is typed as what is owed and keeps its stored sign.
 * Then today's totals go on Net worth's history (replacing an earlier save of the same day). Changes `draft` in place.
 * `corrections`: account ids whose figure on file the person said was a typing mistake (correctSlip first; the wrong
 * figure is not kept as a point). -> { saved: number of accounts dated today, changed: number whose amount changed
 * (a corrected one counts as unchanged), corrected, netWorth, before (the last history point before today, or null) }
 */
export function saveAll(draft, typed, today, { corrections = [] } = {}) {
  if (!isValidDate(today)) return { saved: 0, changed: 0, corrected: 0, netWorth: null, before: null };
  let saved = 0, changed = 0, corrected = 0;
  for (const a of draft.accounts ?? []) {
    if (!Object.prototype.hasOwnProperty.call(typed ?? {}, a.id)) continue;
    const v = typed[a.id];
    if (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) continue;
    // a figure on file that was a typing mistake: fix it where it stood instead of keeping it as a point (no fake fall)
    if (corrections.includes(a.id)) { correctSlip(draft, a.id, Number(v)); corrected++; }
    const was = isLiability(a.type) ? countedBalance(a) : Number(a.balance) || 0;
    if (!corrections.includes(a.id)) keepOnFile(draft, a, today);
    const r = saveBalance(draft, a.id, today, Number(v));
    if (!r.saved) continue;
    if (!r.onFile) { a.balance = isLiability(a.type) ? (Number(a.balance) < 0 ? -Math.abs(Number(v)) : Math.abs(Number(v))) : Number(v); a.asOf = today; }
    a.typedOn = today;
    saved++;
    if (Math.abs(Number(v) - was) > 0.004) changed++;
  }
  const before = [...(draft.netWorthHistory ?? [])].filter((h) => String(h.date) < today).sort((x, y) => String(x.date).localeCompare(String(y.date))).pop() ?? null;
  let netWorth = null;
  if (saved) {
    const t = netWorthOf(draft, { today });
    netWorth = t.netWorth;
    draft.netWorthHistory = (draft.netWorthHistory ?? []).filter((h) => h.date !== today);
    draft.netWorthHistory.push({ date: today, assets: t.assets, liabilities: t.liabilities, netWorth: t.netWorth });
  }
  return { saved, changed, corrected, netWorth, before };
}
