// modules/cashflow/spending/compute.js -- PURE. Where the money went in one month: by
// category with shares, against the month before, and the payees that took the most.
import { allLines, wholeCount, countOnce, tagsOf, isTransfer, monthOf, monthLabel, coverage, monthCover, coverageByAccount, monthHoles, monthGaps, gapIssues, unimportedCardLines, quietTooLong } from "../../transactions/ledger/compute.js";
import { categoryById, categoryLabel, categoryIcon, categoriesOf } from "../../transactions/categories/compute.js";
import { payeeWords } from "../../transactions/rules/compute.js";
import { addMonths } from "../../../core/math/dates.js";

const dayNo = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 864e5;

// the month's spending lines, plus one stand-in line per payment to a card on a day its own file does not cover (2026-11-02)
// (a purchase split across categories comes as one line per part: allLines, gap #24)
const spendingOf = (plan, ym, today, covBy) => [...allLines(plan).filter((t) => monthOf(t.date) === ym && !isTransfer(t, plan) && (categoryById(plan, t.category)?.kind ?? (Number(t.amount) >= 0 ? "income" : "expense")) === "expense"),
  ...unimportedCardLines(plan, ym, { today, covBy })];
/** The lines with the parts of one split purchase put back together (its spending parts added up; `splitNames` their
 * categories): "Biggest single lines" shows a purchase once. With no split it is the list itself. */
const wholeLines = (lines) => {
  if (!lines.some((t) => t.splitOf !== undefined)) return lines;
  const out = [], seen = new Map();
  for (const t of lines) {
    if (t.splitOf === undefined) { out.push(t); continue; }
    const w = seen.get(t.splitOf);
    if (w) { w.amount = Math.round((w.amount + (Number(t.amount) || 0)) * 100) / 100; w.splitNames.push(t.category || ""); }
    else { const first = { ...t, splitNames: [t.category || ""] }; seen.set(t.splitOf, first); out.push(first); }
  }
  return out;
};
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
 * Gap #13 (2026-11-13), only when there is something to say (a plan without them gets the result it got before):
 *   year: the last twelve whole months per category, and the categories that went up (twelveAndWatch);
 *   watch: the month's figure for each shop or category in plan.spendingWatch.
 */
export function compute(plan, params = {}) {
  const all = plan.transactions ?? [];
  const monthsWith = [...new Set(all.filter((t) => !isTransfer(t, plan) && Number(t.amount) < 0).map((t) => monthOf(t.date)))].sort().reverse();
  const today = params.today ?? null;
  const cov = coverage(plan), covBy = coverageByAccount(plan);
  const coverOf = (ym) => monthCover(cov, ym, today);
  const gapCache = new Map();   // monthGaps once a month (it is pure): the months' list, the default month and the twelve months ask it
  const gapsOf = (ym) => gapCache.get(ym) ?? gapCache.set(ym, monthGaps(plan, ym, today, covBy)).get(ym);
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
  const payees = new Map(), onePayee = countOnce();   // a split purchase counts once, whichever of its parts are spending
  for (const t of real) { const k = t.payee || "(no description)"; const p = payees.get(k) ?? { payee: k, total: 0, count: 0, category: t.category }; p.total -= Number(t.amount) || 0; p.count += onePayee(t); payees.set(k, p); }
  const daily = new Map();
  for (const t of txs) { const day = String(t.date).slice(8, 10); daily.set(day, (daily.get(day) ?? 0) + Math.abs(Number(t.amount) || 0)); }
  return {
    month, label: monthLabel(month), months: monthsWith.map((ym) => { const c = coverOf(ym), g = gapsIn(ym); return { ym, label: monthLabel(ym), full: c.full, firstDay: c.firstDay, lastDay: c.lastDay, holes: gapCount(g), cardOnly: onlyCard(g) }; }), total, count: wholeCount(real),
    previous: prevTxs.length ? { ym: prevYm, label: monthLabel(prevYm), total: prevTotal, current: curTotalCmp } : null, change: prevTotal && !cmpGap ? (curTotalCmp - prevTotal) / prevTotal : null, cmpGap,
    cover, sameDays: noOverlap ? null : sameDays, noOverlap, perDay: total / (cover.full ? cover.daysInMonth : Math.max(1, cover.days)),
    byCategory, topPayees: [...payees.values()].filter((p) => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
    biggest: wholeLines(real).filter((t) => Number(t.amount) < 0).sort((a, b) => Number(a.amount) - Number(b.amount)).slice(0, 5).map((t) => ({ ...t, categoryLabel: t.splitNames ? t.splitNames.map((c) => categoryLabel(plan, c)).join(" + ") : categoryLabel(plan, t.category) })),
    daily: [...daily.entries()].sort().map(([day, t]) => ({ day, total: t })), hasData: true,
    cards: curGaps.cards, unsure: curGaps.unsure, holes: monthHoles(plan, month, today, covBy), issues: gapIssues(plan, { ...curGaps, cards: [] }, month),
    // gap #13 (2026-11-13): only when there is something to say, so every result without them is what it was
    ...twelveAndWatch(plan, { month, today, txs, cov, covBy, gapsOf }),
    // gap #24 (2026-11-14): only when a line carries a tag
    ...tagTotals(plan, month),
  };
}

// ---------------------------------------------------------------- what each tag came to (gap #24)
/**
 * tagTotals(plan, month) -> {} with no tag anywhere, else { tags: [{ tag, total, count, all, allCount, first, last }] }:
 * per tag (ledger tagsOf: lower case, no "#"), the spending lines that carry it (money out in a spending category or with
 * none, refunds there taken off, transfers left out; the same lines the page's total counts, without the cards' stand-ins):
 *   total = their sum in `month`, count = how many purchases; all / allCount = the same over every month; first / last = the
 *   first and last month with one. A split purchase counts once (its parts add up to it); a purchase with two tags counts
 *   under each, so the tags do not add up to the month. Biggest this month first, then biggest in all.
 */
export function tagTotals(plan, month) {
  if (!(plan.transactions ?? []).some((t) => Array.isArray(t?.tags) && t.tags.length)) return {};
  const rows = new Map(), once = countOnce();   // after the filter below: a purchase whose first part is not spending still counts
  for (const t of allLines(plan)) {
    const tags = tagsOf(t);
    if (!tags.length || isTransfer(t, plan) || (categoryById(plan, t.category)?.kind ?? (Number(t.amount) >= 0 ? "income" : "expense")) !== "expense") continue;
    const ym = monthOf(t.date), out = -(Number(t.amount) || 0), one = once(t);
    for (const tag of tags) {
      const r = rows.get(tag) ?? rows.set(tag, { tag, total: 0, count: 0, all: 0, allCount: 0, first: ym, last: ym }).get(tag);
      r.all += out; r.allCount += one;
      if (ym === month) { r.total += out; r.count += one; }
      if (ym < r.first) r.first = ym;
      if (ym > r.last) r.last = ym;
    }
  }
  const tags = [...rows.values()].map((r) => ({ ...r, total: cents(r.total), all: cents(r.all) })).sort((a, b) => b.total - a.total || b.all - a.all || a.tag.localeCompare(b.tag));
  return tags.length ? { tags } : {};
}

// ---------------------------------------------------------------- a category over twelve months; watch one shop or category (gap #13)
/** Whole months a category's trend is read over, and how many of the latest of them are "lately". */
export const YEAR_MONTHS = 12, LATELY_MONTHS = 3;
/** A category is marked when its last 3 months' average is at least this share AND this many dollars a month above the 9 months
 * before (the gap spec's rule, design #13); the page shows at most MAX_JUMPS of them, the biggest rises in dollars first. */
export const JUMP_SHARE = 0.2, JUMP_MONTHLY = 50, MAX_JUMPS = 2;
/** The most shops and categories a person watches here (each is one line on the first view). */
export const MAX_WATCH = 5;
const EPS = 1e-9;
const cents = (x) => Math.round(x * 100) / 100 || 0;   // never -0
const ymOf = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
/** Calendar months from `to` back to `from` ("YYYY-MM"), newest first. */
function monthsBack(from, to) {
  const out = [];
  let y = Number(to.slice(0, 4)), m = Number(to.slice(5, 7));
  while (ymOf(y, m) >= from) { out.push(ymOf(y, m)); m--; if (m < 1) { m = 12; y--; } }
  return out;
}
/** One shop, whatever store code or number the bank adds: "Kroger #22" and "KROGER" are Kroger (transactions/rules payeeWords,
 * which keeps the shop after a payment service's star: "PayPal *Netflix" and "PayPal *Spotify" are two shops); a name that is
 * only numbers and codes is compared as typed. "Kroger Fuel" is another shop. */
export function samePayee(a, b) {
  const x = payeeWords(a), y = payeeWords(b);
  if (x || y) return x === y;
  const t = (s) => String(s ?? "").trim().toLowerCase();
  return !!t(a) && t(a) === t(b);
}
/** The plan's watch list (plan.spendingWatch), the usable entries only, each once. */
export function watchesOf(plan) {
  const out = [];
  for (const w of Array.isArray(plan?.spendingWatch) ? plan.spendingWatch : []) {
    if (!w || (w.kind !== "payee" && w.kind !== "category") || typeof w.key !== "string" || !w.key.trim()) continue;
    if (out.some((o) => o.kind === w.kind && (w.kind === "payee" ? samePayee(o.key, w.key) : o.key === w.key))) continue;
    out.push({ kind: w.kind, key: w.key });
  }
  return out;
}
/** The lines a watch counts: real bank lines in the category, or at the shop (samePayee, with the watched name read once). */
function matcher(w) {
  if (w.kind === "category") return (t) => !t.synthetic && (t.category || "") === w.key;
  const k = payeeWords(w.key), raw = w.key.trim().toLowerCase();
  return (t) => { if (t.synthetic) return false; const n = payeeWords(t.payee); return k || n ? n === k : String(t.payee ?? "").trim().toLowerCase() === raw; };
}
const outOf = (lines) => -lines.reduce((s, t) => s + (Number(t.amount) || 0), 0);

/**
 * The last YEAR_MONTHS whole months (newest first) and their spending lines: a month counts when it is over, the files cover it
 * end to end (monthCover `full`), no account's files miss days in it (monthGaps `whole`: no hole, no account stopping early or
 * starting late, no payment counted for neither card) and no card stands in for its purchases (a stand-in line: what the card
 * bought is not known by category). `left`: months between the first and last of them that did not count. Null with fewer.
 */
function wholeYear(plan, { today, cov, covBy, gapsOf = (ym) => monthGaps(plan, ym, today, covBy) }) {
  if (!cov) return null;
  const months = [], lines = new Map();
  let left = 0;
  for (const ym of monthsBack(cov.from.slice(0, 7), cov.to.slice(0, 7))) {
    if (months.length === YEAR_MONTHS) break;
    const ok = monthCover(cov, ym, today).full && gapsOf(ym).whole;
    const txs = ok ? spendingOf(plan, ym, today, covBy) : null;
    if (!txs || txs.some((t) => t.synthetic)) { if (months.length) left++; continue; }
    months.push(ym); lines.set(ym, txs);
  }
  return months.length === YEAR_MONTHS ? { months, lines, left } : null;
}
/**
 * year: { months (12, newest first), from, to, lately (the newest 3), left, rows, jumps } over the whole months (wholeYear):
 * rows [{ category, label, icon, average, recent, before, rise, trend, up, jump }] biggest average first, where per category
 * (a month with nothing in it counts $0; refunds filed in it come off, as on the page):
 *   average = the 12 months' total / 12; recent = the newest 3 months' / 3; before = the 9 before those / 9;
 *   rise = recent - before; trend = rise / before (null with nothing before); up = recent / average - 1 (what the line says);
 *   jump = trend >= JUMP_SHARE and rise >= JUMP_MONTHLY, never for lines not filed yet ("").
 * jumps: the marked rows, biggest rise in dollars first, at most MAX_JUMPS.
 * watch: [{ kind, at, key?, label?, icon, total, count, usual }] per usable plan.spendingWatch entry (watchesOf; `at` its place
 *   there): the month's total and lines at that shop (samePayee, real bank lines) or in that category, and `usual` the average
 *   month over the twelve (null without them). A category has its `key` and `label`; a shop's name stays in the plan only.
 */
function twelveAndWatch(plan, { month, today, txs, cov, covBy, gapsOf }) {
  const out = {};
  const whole = wholeYear(plan, { today, cov, covBy, gapsOf });
  if (whole) {
    const { months } = whole, n = months.length, late = LATELY_MONTHS;
    const per = new Map();   // category -> [total per month, newest first]
    months.forEach((ym, i) => {
      for (const t of whole.lines.get(ym)) {
        const k = t.category || "";
        if (!per.has(k)) per.set(k, new Array(n).fill(0));
        per.get(k)[i] -= Number(t.amount) || 0;
      }
    });
    const sum = (v) => v.reduce((s, x) => s + x, 0);
    const rows = [...per.entries()].map(([k, v]) => {
      const average = sum(v) / n, recent = sum(v.slice(0, late)) / late, before = sum(v.slice(late)) / (n - late), rise = recent - before;
      const trend = before > 0.005 ? rise / before : null;
      return { category: k, label: categoryLabel(plan, k), icon: categoryIcon(plan, k), average: cents(average), recent: cents(recent), before: cents(before), rise: cents(rise),
        trend, up: average > 0.005 ? recent / average - 1 : null, jump: k !== "" && trend !== null && trend >= JUMP_SHARE - EPS && rise >= JUMP_MONTHLY - 1e-6 };
    }).filter((r) => r.average > 0.005).sort((a, b) => b.average - a.average || a.label.localeCompare(b.label));
    out.year = { months, from: months[n - 1], to: months[0], lately: months.slice(0, late), left: whole.left, rows,
      jumps: rows.filter((r) => r.jump).sort((a, b) => b.rise - a.rise || b.average - a.average).slice(0, MAX_JUMPS) };
  }
  const watches = watchesOf(plan);
  // a shop's name is never in the result (`at` points into watchesOf(plan)): Explain this page's copy swaps payees on the bank
  // lines only, so a name read from the watch list would reach the AI helper as it is typed
  if (watches.length) out.watch = watches.map((w, at) => {
    const hit = matcher(w), mine = txs.filter(hit);
    return { kind: w.kind, at, ...(w.kind === "category" ? { key: w.key, label: categoryLabel(plan, w.key) } : {}), icon: w.kind === "category" ? categoryIcon(plan, w.key) : "🏪",
      total: cents(outOf(mine)), count: wholeCount(mine), usual: whole ? cents(whole.months.reduce((s, ym) => s + outOf(whole.lines.get(ym).filter(hit)), 0) / whole.months.length) : null };
  });
  return out;
}

/**
 * watchChoices(plan) -> { payees: [{ key, total, count }], categories: [{ key, label, icon }] }: what "Watch a shop or category"
 * offers. Shops: every spending line's payee (money out, not a transfer), one per shop (samePayee) named as most of its lines
 * are, by what they took in all, the 40 biggest; categories: the spending categories. What is watched already is left out.
 */
export function watchChoices(plan) {
  const watched = watchesOf(plan);
  const kinds = new Map(categoriesOf(plan, { all: true }).map((c) => [c.id, c.kind]));
  const groups = new Map(), once = countOnce();
  for (const t of allLines(plan)) {
    if (t.transferId || t.category === "transfer" || kinds.get(t.category) === "transfer") continue;
    if ((kinds.get(t.category) ?? (Number(t.amount) >= 0 ? "income" : "expense")) !== "expense") continue;
    const name = String(t.payee ?? "").trim();
    if (!name) continue;
    const k = payeeWords(name) || name.toLowerCase();
    const g = groups.get(k) ?? groups.set(k, { total: 0, count: 0, names: new Map() }).get(k);
    g.total -= Number(t.amount) || 0; g.count += once(t); g.names.set(name, (g.names.get(name) ?? 0) + 1);
  }
  const payees = [...groups.values()].filter((g) => g.total > 0.005)
    .map((g) => ({ key: [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0], total: cents(g.total), count: g.count }))
    .filter((x) => !watched.some((w) => w.kind === "payee" && samePayee(w.key, x.key)))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key)).slice(0, 40);
  const categories = categoriesOf(plan).filter((c) => c.kind === "expense" && !watched.some((w) => w.kind === "category" && w.key === c.id)).map((c) => ({ key: c.id, label: c.label, icon: c.icon }));
  return { payees, categories };
}
/** One tag's line: "#trip: $2,140 in Jul 2026" (`tagAllWords` is the line under it: what it came to over every month). */
// More refunded than spent under a tag reads "$20 back", never "-$20".
const outWords = (x, money) => (x < 0 ? `${money(-x)} back` : money(x));
export const tagWords = (t, label, money) => (t.count ? `#${t.tag}: ${outWords(t.total, money)} in ${label}` : `#${t.tag}: nothing in ${label}`);
export function tagAllWords(t, month, money) {
  const n = `${t.allCount} purchase${t.allCount === 1 ? "" : "s"}`;
  if (t.first === t.last) return t.first === month ? n : `${outWords(t.all, money)} in ${monthLabel(t.first)} · ${n}`;
  return `${outWords(t.all, money)} in all, ${monthLabel(t.first)} to ${monthLabel(t.last)} · ${n}`;
}
/** "See all 22, every month": the second link of a tag's row, only when the tag has purchases outside the month shown ("" otherwise). */
export const tagAllLink = (t) => (t.allCount > t.count ? `See all ${t.allCount}, every month` : "");
