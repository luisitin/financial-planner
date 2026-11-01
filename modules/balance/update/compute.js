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
 * Save the balances typed on the page, all dated `today`. typed: { [accountId]: number | null } (null or missing = the box
 * was cleared or never shown: that account is left alone). A balance typed the same as the one on file still counts:
 * it says "still right today", so its date moves to today. A debt is typed as what is owed and keeps its stored sign.
 * Then today's totals go on Net worth's history (replacing an earlier save of the same day). Changes `draft` in place.
 * -> { saved: number of accounts dated today, changed: number whose amount changed, netWorth, before (the last
 * history point before today, or null) }
 */
export function saveAll(draft, typed, today) {
  if (!isValidDate(today)) return { saved: 0, changed: 0, netWorth: null, before: null };
  let saved = 0, changed = 0;
  for (const a of draft.accounts ?? []) {
    if (!Object.prototype.hasOwnProperty.call(typed ?? {}, a.id)) continue;
    const v = typed[a.id];
    if (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) continue;
    const was = isLiability(a.type) ? countedBalance(a) : Number(a.balance) || 0;
    keepOnFile(draft, a, today);
    const r = saveBalance(draft, a.id, today, Number(v));
    if (!r.saved) continue;
    if (!r.onFile) { a.balance = isLiability(a.type) ? (Number(a.balance) < 0 ? -Math.abs(Number(v)) : Math.abs(Number(v))) : Number(v); a.asOf = today; }
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
  return { saved, changed, netWorth, before };
}
