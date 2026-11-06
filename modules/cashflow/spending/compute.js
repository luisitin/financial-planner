// modules/cashflow/spending/compute.js -- PURE. Where the money went in one month: by
// category with shares, against the month before, and the payees that took the most.
import { isTransfer, monthOf, monthLabel, coverage, monthCover, coverageByAccount, monthHoles, monthGaps, gapIssues, unimportedCardLines, quietTooLong } from "../../transactions/ledger/compute.js";
import { categoryById, categoryLabel, categoryIcon } from "../../transactions/categories/compute.js";
import { addMonths } from "../../../core/math/dates.js";

const dayNo = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 864e5;

// the month's spending lines, plus one stand-in line per payment to a card on a day its own file does not cover (2026-11-02)
const spendingOf = (plan, ym, today, covBy) => [...(plan.transactions ?? []).filter((t) => monthOf(t.date) === ym && !isTransfer(t, plan) && (categoryById(plan, t.category)?.kind ?? (Number(t.amount) >= 0 ? "income" : "expense")) === "expense"),
  ...unimportedCardLines(plan, ym, { today, covBy })];
/** A line's group: its category, or for a card's stand-in line that card (two missing cards are two lines). */
const keyOf = (t) => (t.synthetic ? `${t.category}:${t.cardId}` : t.category || "");

/**
 * compute(plan, { month, today }) -> {
 *   month, label, months: [{ ym, label, full, firstDay, lastDay, holes, cardOnly }] (every month with spending, newest first; holes = how many
 *     gaps monthGaps finds in it: a hole, an account whose lines stop early or start late, a payment counted for neither card;
 *     cardOnly: that payment is the only one, so no day is missing and the picker says "card purchases not all in", re-check 5),
 *     total, count, previous: { ym, label, total } | null, change,
 *   byCategory: [{ category, label, icon, total, share, count, previous, change }], topPayees: [{ payee, total, count, category }],
 *   biggest: [{ ...tx }] (5 largest), daily: [{ day, total }], hasData,
 *   cover: { from, to, firstDay, lastDay, days, daysInMonth, full } (the part of the month the bank files cover),
 *   sameDays: { lo, hi } | null (when either month is only partly covered: the days of the month both cover, which the change compares),
 *   noOverlap (the months cover no common days, so there is no change), perDay (total / days covered, or / days in the month when full),
 *   cards: missingCardFiles (cards with no lines this month that money went to: their payments are in `total`, one byCategory
 *     entry per card: { category: "card-unimported", cardId, unimported: true, label "<card>, details not imported yet", icon 💳,
 *     before (every payment is dated before the card's first line `first`: "<card>, before its file starts on 8/1") }),
 *   unsure: unsureCardPayments (payments counted for neither card: in no total, said in one sentence; `issues` has it too),
 *   holes: monthHoles (days an account's files miss inside the month), issues: gapIssues (ledger) for the month's holes and the
 *     accounts whose lines stop early or start late while the others' do not (the span's own start or end is `cover`'s): the
 *     total is short by those days; `months[].holes` counts the same,
 *   cmpGap: { ym (this month or the one before: the one whose files miss some days, by `issues`' rule), prev, card (the only
 *     reason is a payment counted for neither card) } | null: then
 *     `change` and every category's `change` are null, since the difference would be the missing days (re-check 2026-11-02)
 * }
 * `month` defaults to the latest whole month with spending (the files span it and monthGaps finds no hole, no account stopping
 * early or starting late, no payment counted for neither card: ledger's wholeMonth), else the latest month the files span
 * (the rule before 2026-11-02), else the latest month with spending. Spending = transactions whose category is a spending kind (or uncategorised money out). A partly covered month (a
 * file downloaded mid-month) is compared with the same days of the month before, never with a whole month. `count`, the payees
 * and the biggest lines are real bank lines only; the card stand-ins count in the total, the categories and the change.
 */
export function compute(plan, params = {}) {
  const all = plan.transactions ?? [];
  const monthsWith = [...new Set(all.filter((t) => !isTransfer(t, plan) && Number(t.amount) < 0).map((t) => monthOf(t.date)))].sort().reverse();
  const today = params.today ?? null;
  const cov = coverage(plan), covBy = coverageByAccount(plan);
  const coverOf = (ym) => monthCover(cov, ym, today);
  const gapsOf = (ym) => monthGaps(plan, ym, today, covBy);
  // the gaps the files' span does not already say: a hole, a payment counted for neither card, or one account starting later
  // (or stopping sooner) than the others by more than a quiet spell (ledger quietTooLong, re-check 4: a second account whose
  // first line comes two days after the other's is not late); a single account's file from the 10th is the span's own start
  // ("from the 10th", compared on the same days)
  const spacingOf = (id) => covBy[id]?.spacing ?? null;
  const gapsIn = (ym) => { const g = gapsOf(ym), c = coverOf(ym); return { ...g, late: g.late.filter((x) => !c.from || quietTooLong(dayNo(x.from) - dayNo(c.from), spacingOf(x.accountId))), short: g.short.filter((x) => !c.to || quietTooLong(dayNo(c.to) - dayNo(x.to), spacingOf(x.accountId))) }; };
  const gapCount = (g) => g.holes.length + g.short.length + g.late.length + (g.unsure ? 1 : 0);
  // the latest whole month (ledger wholeMonth); with none, the latest month the files span (the rule before 2026-11-02), else the latest
  const month = params.month && monthsWith.includes(params.month) ? params.month
    : (monthsWith.find((ym) => coverOf(ym).full && gapsOf(ym).whole) ?? monthsWith.find((ym) => coverOf(ym).full) ?? monthsWith[0] ?? null);
  if (!month) return { month: null, label: "", months: [], total: 0, count: 0, previous: null, change: null, byCategory: [], topPayees: [], biggest: [], daily: [], hasData: false, cover: null, sameDays: null, noOverlap: false, perDay: 0, cards: [], unsure: null, holes: [], issues: [], cmpGap: null };
  const txs = spendingOf(plan, month, today, covBy);
  const prevYm = addMonths(`${month}-01`, -1).slice(0, 7);
  const cover = coverOf(month), prevCover = coverOf(prevYm);
  // the change compares whole months only when the files cover both; otherwise the days of the month both cover
  const whole = cover.full && prevCover.full;
  const lo = Math.max(cover.full ? 1 : cover.firstDay, prevCover.full ? 1 : prevCover.firstDay);
  const hi = Math.min(cover.full ? cover.daysInMonth : cover.lastDay, prevCover.full ? prevCover.daysInMonth : prevCover.lastDay);
  const sameDays = whole || !prevCover.days ? null : { lo, hi };
  const noOverlap = !!sameDays && lo > hi;
  const inSameDays = (t) => { const day = Number(String(t.date).slice(8, 10)); return !sameDays || (day >= sameDays.lo && day <= sameDays.hi); };
  const prevTxs = noOverlap ? [] : spendingOf(plan, prevYm, today, covBy).filter(inSameDays);
  const curCmp = sameDays ? txs.filter(inSameDays) : txs;
  // signed: money out counts as spending, a refund filed under a spending category reduces it
  const sumAbs = (arr) => arr.reduce((s, t) => s - (Number(t.amount) || 0), 0);
  const total = sumAbs(txs), prevTotal = sumAbs(prevTxs), curTotalCmp = sumAbs(curCmp);
  const byCat = (arr) => {
    const m = new Map();
    for (const t of arr) {
      const k = keyOf(t);
      const c = m.get(k) ?? (t.synthetic ? { category: t.category, cardId: t.cardId, unimported: true, label: t.payee, icon: "💳", total: 0, count: 0, before: true, first: t.first ?? null } : { category: k, label: categoryLabel(plan, k), icon: categoryIcon(plan, k), total: 0, count: 0 });
      c.total -= Number(t.amount) || 0; c.count++; if (t.synthetic && !t.before) { c.before = false; c.label = t.payee; } m.set(k, c);
    }
    return m;
  };
  const cur = byCat(txs), prev = byCat(prevTxs), curW = byCat(curCmp);
  // this month or the one before misses some days in an account's files: no change is worked out (it would be those days;
  // August missing the mortgage of the 2nd made September's mortgage "new this month"; re-check 2026-11-02)
  // (`card`: the reason is only a payment counted for neither card, not days missing)
  const prevGaps = gapsIn(prevYm), curGaps = gapsIn(month);
  const onlyCard = (g) => !!g.unsure && !(g.holes.length + g.short.length + g.late.length);
  const cmpGap = !prevTxs.length ? null : gapCount(curGaps) ? { ym: month, prev: prevYm, card: onlyCard(curGaps) } : gapCount(prevGaps) ? { ym: prevYm, prev: prevYm, card: onlyCard(prevGaps) } : null;
  const byCategory = [...cur.entries()].filter(([, c]) => c.total > 0).map(([k, c]) => { const p = prev.get(k)?.total ?? 0, w = curW.get(k)?.total ?? 0; return { ...c, share: total ? c.total / total : 0, previous: p, change: p && !noOverlap && !cmpGap ? (w - p) / p : null }; }).sort((a, b) => b.total - a.total);
  const real = txs.filter((t) => !t.synthetic);
  const payees = new Map();
  for (const t of real) { const k = t.payee || "(no description)"; const p = payees.get(k) ?? { payee: k, total: 0, count: 0, category: t.category }; p.total -= Number(t.amount) || 0; p.count++; payees.set(k, p); }
  const daily = new Map();
  for (const t of txs) { const day = String(t.date).slice(8, 10); daily.set(day, (daily.get(day) ?? 0) + Math.abs(Number(t.amount) || 0)); }
  return {
    month, label: monthLabel(month), months: monthsWith.map((ym) => { const c = coverOf(ym), g = gapsIn(ym); return { ym, label: monthLabel(ym), full: c.full, firstDay: c.firstDay, lastDay: c.lastDay, holes: gapCount(g), cardOnly: onlyCard(g) }; }), total, count: real.length,
    previous: prevTxs.length ? { ym: prevYm, label: monthLabel(prevYm), total: prevTotal, current: curTotalCmp } : null, change: prevTotal && !cmpGap ? (curTotalCmp - prevTotal) / prevTotal : null, cmpGap,
    cover, sameDays: noOverlap ? null : sameDays, noOverlap, perDay: total / (cover.full ? cover.daysInMonth : Math.max(1, cover.days)),
    byCategory, topPayees: [...payees.values()].filter((p) => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
    biggest: real.filter((t) => Number(t.amount) < 0).sort((a, b) => Number(a.amount) - Number(b.amount)).slice(0, 5).map((t) => ({ ...t, categoryLabel: categoryLabel(plan, t.category) })),
    daily: [...daily.entries()].sort().map(([day, t]) => ({ day, total: t })), hasData: true,
    cards: curGaps.cards, unsure: curGaps.unsure, holes: monthHoles(plan, month, today, covBy), issues: gapIssues(plan, { ...curGaps, cards: [] }, month),
  };
}
