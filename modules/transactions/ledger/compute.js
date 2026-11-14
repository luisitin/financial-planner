// modules/transactions/ledger/compute.js -- PURE. Every transaction, filtered and totalled.
// Also the shared helpers other transaction pages use: the duplicate key, month labels,
// and the sign convention. Transaction shape (plan.transactions):
//   { id, date "YYYY-MM-DD", amount (+ in, - out), payee, rawPayee?, accountId, category ("" = none),
//     tags: [], note, transferId?, importId?, key, splits?: [{ category, amount }] }
// Gap #32 (2026-11-14), all optional: reimb? (true: a purchase that will be paid back; an id: the other line of the pair),
// exclude? (left out of reports), flag? (to look at later), refundOf? (the purchase this money in is a refund of).
// A purchase split across categories (gap #24, 2026-11-14) keeps its one amount; the pages that total by category read its
// parts through allLines(plan) / linesOf(t), whose amounts always add up to the purchase: nothing is ever counted twice.
import { normalizePayee, payeeWords } from "../rules/compute.js";
import { centsOf, splitsOf, linesOf, partsOf as partsIn, leftOut, leftOutIn, wholeCount, countOnce, mainCategory, cleanTags, tagsOf } from "../splits.js";
import { categoryLabel, categoryIcon, categoryById, categoriesOf } from "../categories/compute.js";

/** The identity of a bank line for duplicate detection: account + date + amount + cleaned payee. */
export const txKey = (t) => `${t.accountId ?? ""}|${t.date ?? ""}|${(Math.round((Number(t.amount) || 0) * 100) / 100).toFixed(2)}|${normalizePayee(t.rawPayee ?? t.payee)}`;
export const monthOf = (date) => String(date ?? "").slice(0, 7);
/**
 * A line typed by hand is asked which way the money went, never its sign (an iPhone's number pad has no minus key):
 * signedAmount("out", 4.5) = -4.5, signedAmount("in", 4.5) = 4.5. A typed minus still means money out, whatever the choice.
 * Blank or not a number is null.
 */
export function signedAmount(dir, typed) {
  if (typed === null || typed === undefined || typed === "" || !Number.isFinite(Number(typed))) return null;
  const n = Number(typed), size = Math.abs(n);
  if (size === 0) return 0;
  return n < 0 || dir !== "in" ? -size : size;
}
/** The way a stored amount went, for the edit form: "in" above zero, otherwise "out". */
export const directionOf = (amount) => (Number(amount) > 0 ? "in" : "out");
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
  if (!cov || from > to || cov.to < start || cov.from > end) return { ym, from: null, to: null, firstDay: 0, lastDay: 0, days: 0, daysInMonth, full: false, holes: [] };
  const firstDay = Number(from.slice(8, 10)), lastDay = Number(to.slice(8, 10));
  const over = !today || today > end;
  // one account's coverage (coverageByAccount) brings its own slack and its holes: a month with a hole in it is not whole
  const slack = Number.isFinite(cov.slack) ? cov.slack : COVER_SLACK;
  const holes = holesWithin(cov.holes, start, today && today < end ? today : end);
  return { ym, from, to, firstDay, lastDay, days: lastDay - firstDay + 1, daysInMonth, full: over && firstDay <= 1 + slack && lastDay >= daysInMonth - slack && !holes.length, holes };
}
/** Transfers between the owner's own accounts are neither income nor spending. */
export const isTransfer = (t, plan) => !!t.transferId || t.category === "transfer" || categoryById(plan, t.category)?.kind === "transfer";
/** isTransfer for many lines of one plan: the categories are looked up once, not once a line (verify 5, 2026-11-05). */
const transferTest = (plan) => { const kinds = new Set(categoriesOf(plan, { all: true }).filter((c) => c.kind === "transfer").map((c) => c.id)); return (t) => !!t.transferId || t.category === "transfer" || (!!t.category && kinds.has(t.category)); };

// ---------------------------------------------------------------- a purchase split across categories; tags (gap #24, 2026-11-14)
// splitsOf, linesOf, wholeCount, countOnce, mainCategory, cleanTags and tagsOf live in ../splits.js (it imports nothing)
export { splitsOf, linesOf, partsIn as partsOf, leftOut, leftOutIn, wholeCount, countOnce, mainCategory, cleanTags, tagsOf };
/**
 * allLines(plan) -> the lines to total by category (linesOf): every transaction but the ones left out of the totals (gap
 * #32: leftOut), a split purchase as one line per part; a line in a transfer category of the plan's own stays whole. With no
 * split and nothing left out it is plan.transactions itself, the very same array.
 */
export function allLines(plan) {
  const all = plan?.transactions ?? [];
  const isOut = leftOutIn(all);
  const split = all.some((t) => t?.splits), out = all.some(isOut);
  if (!split && !out) return all;
  const transfer = split ? transferTest(plan) : null;
  return all.flatMap((t) => (isOut(t) ? [] : t?.splits && !transfer(t) ? partsIn(t) : [t]));
}
/** counted(plan) -> the whole transactions that are not left out of the totals (leftOutIn), for a page that reads them
 * whole (bills that repeat, the month's check-in). With nothing left out it is plan.transactions itself. */
export function counted(plan) {
  const all = plan?.transactions ?? [], isOut = leftOutIn(all);
  return all.some(isOut) ? all.filter((t) => !isOut(t)) : all;
}
/**
 * everyLine(plan) -> every transaction, a split purchase as one line per part, the lines left out of the totals included
 * (a copy of the data: Reports > Export). With no split anywhere it is plan.transactions itself.
 */
export function everyLine(plan) {
  const all = plan?.transactions ?? [];
  if (!all.some((t) => t?.splits)) return all;
  const transfer = transferTest(plan);
  return all.flatMap((t) => (t?.splits && !transfer(t) ? partsIn(t) : [t]));
}
const dollars2 = (x) => `$${(Math.round(Math.abs(Number(x) || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/**
 * makeSplit({ amount (signed, as stored), category (the Category box: it keeps the rest), parts: [{ category, amount (typed,
 * its size) }], transfer }, { money, label }) -> { ok: true, splits: [...parts, the rest] | null, category } | { ok: false, error, at, on }
 * The parts typed come off the purchase and the Category box keeps the rest, so the parts always add up to the purchase:
 *   rest = |amount| - sum(parts), in cents; splits = the parts in the order typed, then { category, amount: rest }, signed as
 *   the purchase. Parts in one category are added together; a part in the Category box's own category goes back to the rest.
 * No part left (or none typed) -> splits null (one category again). `category` is what the transaction carries (mainCategory).
 * `empty`: how many parts were left with neither box filled and so left out (the green line says so).
 * Refused in words (`at`: which part, -1 = the Category box; `on`: its "amount" or its "category" box): no amount yet, a transfer, a part with no amount or no
 * category, no category for the rest, parts that take the whole amount or more.
 */
export function makeSplit({ amount, category = "", parts = [], transfer = false }, { money = dollars2, label = (id) => id } = {}) {
  const typed = (parts ?? []).filter((p) => p && (p.category || (p.amount !== null && p.amount !== undefined && p.amount !== "")));
  const empty = (parts ?? []).length - typed.length;
  if (!typed.length) return { ok: true, splits: null, category, empty };
  const total = centsOf(amount), size = Math.abs(total), sign = total < 0 ? -1 : 1;
  if (transfer) return { ok: false, at: -1, on: "category", error: "Money moved between your own accounts is not spending, so it cannot be split. Remove the parts, or pick another category." };
  if (!size) return { ok: false, at: -1, on: "category", error: "Type the amount first, then split it." };
  const by = new Map();
  let sum = 0;
  for (let i = 0; i < typed.length; i++) {
    const p = typed[i], c = Math.abs(centsOf(p.amount));
    if (!c) return { ok: false, at: i, on: "amount", error: p.category ? `Type how much of it was ${label(p.category)}, or remove that part.` : "Type how much the other part was, or remove it." };
    if (!p.category) return { ok: false, at: i, on: "category", error: `Pick a category for the ${money(c / 100)} part.` };
    sum += c;
    if (p.category !== category) by.set(p.category, (by.get(p.category) ?? 0) + c);
  }
  if (sum > size) return { ok: false, at: typed.length - 1, on: "amount", error: `The parts add up to ${money(sum / 100)}, more than the ${money(size / 100)} paid. Lower one of them.` };
  if (sum === size) return { ok: false, at: typed.length - 1, on: "amount", error: `The parts take the whole ${money(size / 100)}, so nothing is left for ${category ? label(category) : "the rest"}. Lower one of them, or remove one.` };
  if (!category) return { ok: false, at: -1, on: "category", error: `Pick a category above for the rest (${money((size - sum) / 100)}).` };
  if (!by.size) return { ok: true, splits: null, category, empty };
  let own = 0; for (const c of by.values()) own += c;
  const splits = [...[...by.entries()].map(([cat, c]) => ({ category: cat, amount: sign * c / 100 })), { category, amount: sign * (size - own) / 100 }];
  return { ok: true, splits, category: mainCategory(splits), empty };
}
/** What the form shows for a saved split: the Category box's category (the last part, which took the rest) and the others. */
export function splitForm(t) {
  const s = splitsOf(t);
  if (!s) return { category: t?.category ?? "", parts: [] };
  return { category: s[s.length - 1].category ?? "", parts: s.slice(0, -1).map((p) => ({ category: p.category ?? "", amount: Math.abs(centsOf(p.amount)) / 100 })) };
}
/** "Household $100.00, Groceries $200.00": a split purchase's parts in words ("" when it is not split). */
export function splitWords(t, { money = dollars2, label = (id) => id || "Uncategorized" } = {}) {
  const s = splitsOf(t);
  return s ? s.map((p) => `${label(p.category)} ${money(Math.abs(centsOf(p.amount)) / 100)}`).join(", ") : "";
}
/**
 * restWords({ total, taken, main }, { money, label }) -> the line under the parts as they are typed (sizes, not signed).
 * It says before Save what Save would refuse: no amount yet, no category above to keep the rest, nothing left over.
 */
export function restWords({ total = 0, taken = 0, main = "" }, { money = dollars2, label = (id) => id } = {}) {
  const all = centsOf(Math.abs(total)), out = centsOf(Math.abs(taken)), rest = all - out;
  if (!all) return "Type the amount above first.";
  if (rest <= 0) return `Nothing is left for the rest: the parts add up to ${money(out / 100)} of ${money(all / 100)}.`;
  return main ? `${label(main)} keeps the rest: ${money(rest / 100)}.` : `Pick a category above: it keeps the rest (${money(rest / 100)}).`;
}
/** How many split purchases have a part in category `id`: removing or hiding it takes their split off (dropCategory). */
export const splitsUsing = (plan, id) => (plan?.transactions ?? []).filter((t) => Array.isArray(t?.splits) && t.splits.some((p) => p?.category === id)).length;
/** The sentence the Categories page adds before a category goes, when split purchases use it ("" when none does). */
export const splitLossWords = (n) => (n > 0 ? ` ${n === 1 ? "One of them is a purchase split across categories: it" : `${n} of them are purchases split across categories: they`} will stop being split and wait for a category again, whole.` : "");
/** The same, after it is done, for the green line ("" when none was split). */
export const splitBackWords = (n) => (n > 0 ? ` ${n === 1 ? "One split purchase is" : `${n} split purchases are`} whole again and waiting for a category.` : "");
/** What linking as a transfer adds to its green line when a linked line was split ("" when none was). */
export const unsplitWords = (n) => (n > 0 ? ` ${n === 1 ? "One of them was split across categories; it is" : `${n} of them were split across categories; they are`} whole again, since a transfer is not spending.` : "");
/** A category that no longer exists comes off a transaction (the Categories page). A split purchase with a part in it
 * stops being split and waits for a category again, whole: no part is ever left without one. */
export function dropCategory(t, id) {
  if (Array.isArray(t.splits) && t.splits.some((p) => p?.category === id)) { delete t.splits; t.category = ""; }
  else if (t.category === id) t.category = "";
}
// ---------------------------------------------------------------- paid back later, left out, flagged, a refund (gap #32, 2026-11-14)
//   transactions[].reimb?     true: a purchase that will be paid back; an id: the other line of the pair (on the purchase,
//                             the money back; on the money back, the purchase). Both are left out of the totals (leftOut).
//   transactions[].exclude?   true: left out of reports (a one-time thing). In no total of money in or out.
//   transactions[].flag?      true: to look at later; Categorize lists it. Changes no figure.
//   transactions[].refundOf?  the id of the purchase this money in is a refund of. For display: the refund already comes
//                             off its category's spending (an expense kind counts as money out even when positive).
/** How far back "This is a refund of…" looks for spending at the same payee, in days. */
export const REFUND_DAYS = 120;
/** How many choices a picker lists at most (the newest first). */
export const PICK_MAX = 12;
/** The choices of "How this counts", in words. The two that name another line are offered only when there is one to pick. */
export const MARK_LABELS = Object.freeze({
  usual: "As usual", payback: "This will be paid back", back: "That's the money back",
  refund: "This is a refund of…", leave: "Leave out of reports" });
/**
 * markOf(t) -> { kind: "usual" | "payback" | "back" | "refund" | "leave", of: id | null }: what the form shows for a saved line.
 * Money out with `reimb` is "payback" (`of`: the money back once linked); money in with `reimb` an id is "back"; any other
 * line left out is "leave"; money in with `refundOf` is "refund". With the list (`transactions`), a line the mark names
 * that is gone is not shown: the purchase waits again (`of` null), the money back and the refund read "usual".
 */
const paired = (t) => t?.reimb === true || (typeof t?.reimb === "string" && t.reimb !== "");
export function markOf(t, transactions = null) {
  const has = (i) => !transactions || transactions.some((x) => x?.id === i);
  const out = Number(t?.amount) < 0, id = typeof t?.reimb === "string" && t.reimb && has(t.reimb) ? t.reimb : null;
  if (paired(t) && out) return { kind: "payback", of: id };
  if (id) return { kind: "back", of: id };
  if (transactions ? leftOutIn(transactions)(t) : leftOut(t)) return { kind: "leave", of: null };
  if (typeof t?.refundOf === "string" && t.refundOf && !out && has(t.refundOf)) return { kind: "refund", of: t.refundOf };
  return { kind: "usual", of: null };
}
const firstWord = (t) => payeeWords(t?.rawPayee ?? t?.payee).split(" ").find((w) => w.length > 2) ?? "";
const samePayee = (a, b) => { const x = normalizePayee(a?.payee), y = normalizePayee(b?.payee); return (!!x && x === y) || (!!firstWord(a) && firstWord(a) === firstWord(b)); };
const newest = (a, b) => String(b.date).localeCompare(String(a.date));
/**
 * markChoices(plan, line) -> { kinds: [kind], waiting: [purchase], refunds: [purchase] } for the form's line ({ id?, amount
 * (signed), date, payee, rawPayee? }; a new line has no id).
 *   waiting: the purchases marked "This will be paid back" that no money back is linked to yet (reimb === true, or an id
 *            whose line is gone), and the one this line is the money back for; newest first.
 *   refunds: money out at the same payee (the same cleaned name, or the same first word of the bank's line), not a transfer,
 *            dated on or up to REFUND_DAYS days before this line, and the one already picked; newest first, PICK_MAX at most.
 *   kinds:   money out: usual, payback, leave. Money in: usual, refund (when there are refunds), back (when a purchase
 *            waits), leave. Money moved between your own accounts has no choice (it is in no total already): [].
 */
export function markChoices(plan, line) {
  const all = plan?.transactions ?? [], out = Number(line?.amount) < 0;
  if (line?.transferId) return { kinds: [], waiting: [], refunds: [] };
  if (out) return { kinds: ["usual", "payback", "leave"], waiting: [], refunds: [] };
  const mine = line?.id ?? null, day = ISO.test(String(line?.date ?? "").slice(0, 10)) ? String(line.date).slice(0, 10) : null;
  const ids = new Set(all.map((t) => t?.id));
  const waiting = all.filter((t) => t && t.id !== mine && Number(t.amount) < 0 && paired(t) && (t.reimb === true || !ids.has(t.reimb) || (mine && t.reimb === mine))).sort(newest);
  const picked = line?.refundOf ?? null, transfer = transferTest(plan);
  const refunds = all.filter((t) => t && t.id !== mine && Number(t.amount) < 0 && !transfer(t) && (t.id === picked || (samePayee(t, line)
    && (!day || !ISO.test(String(t.date ?? "").slice(0, 10)) || (String(t.date).slice(0, 10) <= day && dayNo(day) - dayNo(String(t.date).slice(0, 10)) <= REFUND_DAYS))))).sort(newest).slice(0, PICK_MAX);
  return { kinds: ["usual", ...(refunds.length ? ["refund"] : []), ...(waiting.length ? ["back"] : []), "leave"], waiting, refunds };
}
// the other line of a pair counts again: a purchase waits to be paid back again, the money back is money in again
const release = (x, id) => { if (x?.reimb !== id) return false; if (Number(x.amount) < 0) x.reimb = true; else delete x.reimb; return true; };
/**
 * applyMark(transactions, id, { kind, of, flag }) -> { kind, partner, freed }: writes the mark on the line `id` of a draft's
 * list (the view calls it inside store.update), and keeps the pair true on both lines.
 *   usual:   reimb, exclude and refundOf come off.
 *   payback: reimb = the id of the money back when one is linked, else true.     leave: exclude = true.
 *   refund:  refundOf = of (a purchase in the list).
 *   back:    reimb = of (the purchase), and the purchase's reimb = id.
 * A kind that does not fit the line's direction, or names a line that is gone, is saved as usual (`kind` says what was
 * saved). `freed`: the line this one was paired with before and no longer is (released). `flag` true or false sets or
 * takes off the flag; undefined leaves it.
 */
export function applyMark(transactions, id, { kind = "usual", of = null, flag } = {}) {
  const by = (i) => (typeof i === "string" ? (transactions ?? []).find((x) => x?.id === i) ?? null : null);
  const t = by(id);
  if (!t) return { kind: "usual", partner: null, freed: null };
  const out = Number(t.amount) < 0, was = by(t.reimb);
  let partner = null;
  if (kind === "payback") { if (!out) kind = "usual"; else if (was && Number(was.amount) >= 0 && was.reimb === t.id) partner = was; }
  else if (kind === "back") { partner = by(of); if (out || !partner || partner.id === t.id || !(Number(partner.amount) < 0)) { kind = "usual"; partner = null; } }
  else if (kind === "refund") { if (out || !by(of) || of === id) kind = "usual"; }
  else if (kind !== "leave") kind = "usual";
  const freed = was && was !== partner && release(was, t.id) ? was : null;
  delete t.reimb; delete t.exclude; delete t.refundOf;
  if (kind === "payback") t.reimb = partner ? partner.id : true;
  else if (kind === "leave") t.exclude = true;
  else if (kind === "refund") t.refundOf = of;
  else if (kind === "back") {
    if (typeof partner.reimb === "string" && partner.reimb !== t.id) release(by(partner.reimb), partner.id);   // it had another money back
    delete partner.exclude; partner.reimb = t.id; t.reimb = partner.id;
  }
  if (flag === true) t.flag = true; else if (flag === false) delete t.flag;
  return { kind, partner, freed };
}
/**
 * unlinkGone(transactions, id) -> how many lines were changed: the line `id` is being deleted, so a pair it was half of
 * comes apart (the purchase waits again; the money back counts again) and a refund no longer names it.
 */
export function unlinkGone(transactions, id) {
  let n = 0;
  for (const x of transactions ?? []) { if (!x || x.id === id) continue; if (release(x, id)) n++; if (x.refundOf === id) { delete x.refundOf; n++; } }
  return n;
}
/** A line in a few words for a picker or a sentence: "Corner cafe, 11/3, $42.10". */
export const lineWords = (t, money = dollars2) => `${t?.payee || "A transaction"}${ISO.test(String(t?.date ?? "").slice(0, 10)) ? `, ${shortDate(String(t.date).slice(0, 10))}` : ""}, ${money(Math.abs(Number(t?.amount) || 0))}`;
/**
 * markPill(t, other) -> the few words a row carries for its mark, or null: "to be paid back", "paid back", "money back",
 * "left out". `other`: the line `reimb` names, when it is still there (a pair whose other line is gone reads "left out"
 * for the money back, "to be paid back" for the purchase).
 */
export function markPill(t, other = null) {
  if (!leftOut(t)) return null;
  const out = Number(t.amount) < 0;
  if (t.reimb && out) return typeof t.reimb === "string" && other ? "paid back" : "to be paid back";
  if (typeof t.reimb === "string" && other) return "money back";
  return "left out";
}
/**
 * markHelp(kind, { out, other, money }) -> the line under "How this counts" as it is picked, before Save. One sentence a case:
 * usual "" · payback (not linked) · payback (linked: names the money back) · back · refund · leave (money out / money in).
 */
export function markHelp(kind, { out = true, other = null, money = dollars2 } = {}) {
  if (kind === "payback") return other ? `Paid back: ${lineWords(other, money)}. Neither line is counted in your spending or income.`
    : "For money that work or a friend will pay back. Not counted in your spending. When the money comes in, open that line and pick “That's the money back”.";
  if (kind === "back") return "Pick the purchase it pays back. Neither line is then counted in your spending or income.";
  if (kind === "refund") return "Pick what was bought. The refund is filed under the same category, so it comes off that spending.";
  if (kind === "leave") return `For a one-time thing. Not counted in your ${out ? "spending" : "income"}; it still counts in the account's own balance.`;
  return "";
}
/**
 * backGap(amount, purchase, { money }) -> what the form says under "The purchase it pays back" as soon as a purchase is
 * picked, before Save, when the money back and the purchase are not the same amount; "" when they are (to the cent), or
 * with no amount typed yet. `amount`: this line's amount (either sign).
 *   more came back   "This line is $640.22; the purchase was $48.00. Is this the same purchase?"
 *   less came back   "This line is $80.00; the purchase was $120.00. The other $40.00 will not be counted as spending either."
 */
export function backGap(amount, purchase, { money = dollars2 } = {}) {
  const back = Math.abs(centsOf(amount)), paid = Math.abs(centsOf(purchase?.amount));
  if (!purchase || !back || !paid || back === paid) return "";
  const both = `This line is ${money(back / 100)}; the purchase was ${money(paid / 100)}.`;
  return back > paid ? `${both} Is this the same purchase?` : `${both} The other ${money((paid - back) / 100)} will not be counted as spending either.`;
}
/**
 * markSaid({ kind, was, out, line, other, freed, category, flag, flagWas }, { money }) -> what the green line adds after a
 * save, "" when nothing about the marks changed. One sentence a case (each has a test):
 *   payback, new             " Not counted in your spending. When the money comes in, open that line and pick “That's the money back”."
 *   back, same amounts       " Not counted in your spending or income."
 *   back, less came back     the same, then " Only $60.00 of the $100.00 came back; the other $40.00 is not counted either."
 *   back, more came back     the same, then " $20.00 more came back than you paid. Is this really the same purchase?"
 *   refund                   " Marked as a refund of <purchase>; it comes off <Category> spending." (or without the second half with no category)
 *   leave                    " Not counted in your spending." (or "income")
 * The form says the difference in amounts before Save (backGap); what to do when the rest was your own share is in the README.
 *   usual, after a mark      " It counts as usual again."
 *   a pair that came apart   " <the other line> waits to be paid back again." / " <the other line> counts as money in again."
 *   flag on / off            " Flagged to look at later: it waits on the Categorize page." / " The flag is off."
 */
export function markSaid({ kind = "usual", was = "usual", wasOf = null, of = null, out = true, line = null, other = null, freed = null, category = "", flag = false, flagWas = false } = {}, { money = dollars2 } = {}) {
  let s = "";
  const changed = kind !== was || (of ?? null) !== (wasOf ?? null);
  if (changed) {
    if (kind === "payback" && !other) s += " Not counted in your spending. When the money comes in, open that line and pick “That's the money back”.";
    else if (kind === "payback") s += " Not counted in your spending or income.";
    else if (kind === "back" && other) {
      s += " Not counted in your spending or income.";
      const paid = Math.abs(centsOf(other.amount)), back = Math.abs(centsOf(line?.amount));
      if (back < paid) s += ` Only ${money(back / 100)} of the ${money(paid / 100)} came back; the other ${money((paid - back) / 100)} is not counted either.`;
      else if (back > paid) s += ` ${money((back - paid) / 100)} more came back than you paid. Is this really the same purchase?`;
    }
    else if (kind === "refund" && other) s += ` Marked as a refund of ${lineWords(other, money)}${category ? `; it comes off ${category} spending` : ""}.`;
    else if (kind === "leave") s += ` Not counted in your ${out ? "spending" : "income"}.`;
    else if (kind === "usual") s += " It counts as usual again.";
  }
  if (freed) s += ` ${freed.payee || "The other line"} ${Number(freed.amount) < 0 ? "waits to be paid back again" : "counts as money in again"}.`;
  if (flag && !flagWas) s += " Flagged to look at later: it waits on the Categorize page.";
  else if (!flag && flagWas) s += " The flag is off.";
  return s;
}
/** The totals' own line for the lines in none of them, and the link that lists them: "2 not counted (paid back or left out)". */
export const notCounted = (n) => `${n} not counted (paid back or left out)`;
/** The lines flagged to look at later, newest first, each with what a row needs (Categorize lists them). */
export function flagged(plan) {
  const all = plan?.transactions ?? [];
  if (!all.some((t) => t?.flag)) return [];
  const by = new Map(all.map((t) => [t.id, t])), isOut = leftOutIn(all);
  return all.filter((t) => t?.flag).sort(newest).map((t) => ({ id: t.id, date: t.date, payee: t.payee, amount: Number(t.amount) || 0, note: t.note || "", accountId: t.accountId, categoryLabel: t.category ? categoryLabel(plan, t.category) : "",
    mark: isOut(t) ? markPill(t, by.get(t.reimb) ?? null) : null }));
}
/** Search text against tags: "#trip" finds a tag that starts with trip; plain words match inside a tag too. */
const tagHit = (t, qq) => { const tags = tagsOf(t); if (!tags.length) return false; const w = qq.replace(/^#+/, "").trim(); return qq.startsWith("#") ? !!w && tags.some((g) => g.startsWith(w)) : tags.some((g) => g.includes(qq)); };

// ---------------------------------------------------------------- coverage per account (2026-11-02)
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dayNo = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 864e5;
const isoOfDay = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const plusDays = (iso, n) => isoOfDay(dayNo(iso) + n);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
/** The holes (or parts of them) between `lo` and `hi`, clipped to those days. */
function holesWithin(holes, lo, hi) {
  return (holes ?? []).filter((h) => h.from <= hi && h.to >= lo).map((h) => { const from = h.from > lo ? h.from : lo, to = h.to < hi ? h.to : hi; return { from, to, days: dayNo(to) - dayNo(from) + 1, whole: { from: h.from, to: h.to, days: h.days } }; });
}
/**
 * Lines that came in without a record of their file (typed by hand, or imported before plan.imports kept from/to) only say the
 * account had activity on those days, not where a file started or stopped, and a quiet week is normal: between two of them
 * only more than a month with nothing at all counts as missing.
 */
export const LINE_GAP_DAYS = 31;
/** An account's usual spacing is known once it has lines on this many different days; with fewer it never gets a hole. */
export const RHYTHM_DAYS = 5;
/** Days with nothing that can be a quiet spell: a hole, lines that stop early or start late need more than this (and 2 x the usual spacing). */
export const SHORT_DAYS = 7;
/**
 * quietTooLong(days, spacing) -> true when `days` in a row with no line on an account are more than a quiet spell: more than
 * SHORT_DAYS and more than 2 x its usual spacing. Never for an account with no rhythm yet (spacing null). One rule for a hole
 * between two files, lines that stop early and lines that start late (re-check 4, 2026-11-02).
 */
export const quietTooLong = (days, spacing) => spacing !== null && spacing !== undefined && days > SHORT_DAYS && days > 2 * spacing;

// ---------------------------------------------------------------- usual payments (re-check 4, 2026-11-02)
/** Days before a usual payment's first line or after its last one that it can still be due (a month and a few days). */
export const USUAL_REACH = 35;
const ymDays = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
/**
 * usualPayments(plan, lines) -> [{ key, accountId, payee, rawPayee, category, amount, day, dates, first, last }]
 * The lines that recur monthly on about the same day: one account, one cleaned payee (normalizePayee), at least two lines whose
 * median spacing is 26 to 35 days with 60% of the spacings in that band, three or more lines or two of the very same amount
 * (within 2%), and amounts no more than 50% apart (median deviation); transfers between your own accounts left out. `day` is
 * the median day of the month of its dates, `amount` the median amount. The monthly rule of cashflow/recurring's
 * detectRecurring (which the ledger cannot import: recurring imports the ledger).
 */
export function usualPayments(plan, lines = plan.transactions ?? []) {
  const groups = new Map();
  for (const t of lines ?? []) {
    const d = String(t.date ?? "").slice(0, 10);
    if (!ISO.test(d) || isTransfer(t, plan)) continue;
    const key = `${t.accountId ?? ""}|${normalizePayee(t.rawPayee ?? t.payee)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)).push({ t, d });
  }
  const out = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const s = [...list].sort((a, b) => a.d.localeCompare(b.d));
    const gaps = []; for (let i = 1; i < s.length; i++) gaps.push(dayNo(s[i].d) - dayNo(s[i - 1].d));
    const mid = median(gaps);
    if (mid < 26 || mid > 35 || gaps.filter((g) => g >= 26 && g <= 35).length / gaps.length < 0.6) continue;
    const amounts = s.map((x) => Number(x.t.amount) || 0), typical = median(amounts);
    const spread = typical ? median(amounts.map((a) => Math.abs(a - typical))) / Math.abs(typical) : 0;
    if ((s.length < 3 && !(spread < 0.02)) || spread > 0.5) continue;
    const dom = s.map((x) => Number(x.d.slice(8, 10))).sort((a, b) => a - b);
    const last = s[s.length - 1].t;
    out.push({ key, accountId: last.accountId, payee: last.payee, rawPayee: last.rawPayee ?? last.payee, category: last.category ?? "", amount: Math.round(typical * 100) / 100,
      day: dom[Math.floor((dom.length - 1) / 2)], dates: s.map((x) => x.d), first: s[0].d, last: s[s.length - 1].d });
  }
  return out;
}
/** A usual payment is due on a day between from and to, in a month with none of its lines, within USUAL_REACH of its first or last line. */
function dueMissing(u, from, to) {
  for (let ym = from.slice(0, 7); ym <= to.slice(0, 7); ym = nextYm(ym)) {
    const due = `${ym}-${String(Math.min(u.day, ymDays(ym))).padStart(2, "0")}`;
    if (due < from || due > to || u.dates.some((x) => x.slice(0, 7) === ym)) continue;
    if (dayNo(due) < dayNo(u.first) - USUAL_REACH || dayNo(due) > dayNo(u.last) + USUAL_REACH) continue;
    return true;
  }
  return false;
}
/** What a usual payment is called in words: "your mortgage", "your rent", "a paycheck", else its payee. */
export function usualName(u) {
  const raw = `${u.rawPayee ?? ""} ${u.payee ?? ""}`.toLowerCase();
  if (u.amount > 0 && (u.category === "income-salary" || /\b(payroll|salary|direct dep)/.test(raw))) return "a paycheck";
  if (u.category === "housing" || /\b(mortgage|mtg|rent)\b/.test(raw)) return /\b(rent|apartments?|apts)\b/.test(raw) ? "your rent" : /\b(mortgage|mtg|home loan)\b/.test(raw) ? "your mortgage" : "your housing payment";
  return u.payee || "a payment";
}
/**
 * usualInDays(plan, accountId, from, to, add = []) -> [{ name, day, out, amount }]: the account's usual payments (usualPayments
 * over its lines and `add`) due on a day between `from` and `to` in a month where none of their lines is on file (a mortgage
 * paid late, on the 5th, is not missing), within USUAL_REACH of their first or last line; money out first, then the largest;
 * up to 3. The one test the holes (coverageByAccount), the Import page's warning and the "nothing happened" button all use.
 */
export function usualInDays(plan, accountId, from, to, add = []) {
  if (!accountId || !ISO.test(String(from ?? "")) || !ISO.test(String(to ?? "")) || from > to) return [];
  const lines = [...(plan.transactions ?? []), ...add].filter((t) => t.accountId === accountId);
  const seen = new Set();
  return usualPayments(plan, lines).filter((u) => dueMissing(u, from, to))
    .map((u) => ({ name: usualName(u), day: u.day, out: u.amount < 0, amount: Math.abs(u.amount) }))
    .sort((a, b) => (a.out === b.out ? b.amount - a.amount : a.out ? -1 : 1))
    .filter((u) => { const k = `${u.name}|${u.day}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3);
}
/**
 * coverageByAccount(plan) -> { [accountId]: { from, to, holes: [{ from, to, days }], slack, spacing, lineDays } }
 * Each account's own coverage. Its files are the import records (plan.imports[].from/to for that accountId) and, for lines no
 * record covers, runs of lines (a new run after more than max(LINE_GAP_DAYS, 2 x spacing) days with nothing). An import
 * record holds its file's first and last line dates, not the days the file was downloaded for, so a few quiet days at a file's
 * edge are normal (re-check 4, 2026-11-02): the days between two files (records or runs) are a hole only when they are more
 * than a quiet spell (quietTooLong: more than SHORT_DAYS and more than 2 x the account's usual spacing, the median days between
 * its line dates, `spacing`), or when one of its usual payments (usualPayments: a line that recurs monthly on about the same
 * day) is due in them with none of it that month; between two runs of loose lines the days are more than LINE_GAP_DAYS by
 * construction. An account with lines on fewer than RHYTHM_DAYS days (`lineDays`; savings interest, quarterly files) has no
 * rhythm (`spacing` null) and never gets a hole, from records or from lines.
 * `slack` = max(COVER_SLACK, 2 x spacing), or LINE_GAP_DAYS with no rhythm: how far from a month's ends monthCover lets this
 * account's own coverage start or stop.
 * Example: lines Jul 1 to Jul 30 with no record, then a file Aug 3 to Nov 1 whose mortgage is on the 2nd of September and
 * October -> hole Jul 31 to Aug 2 (3 days, August's mortgage is due in them); without that mortgage, no hole.
 */
export function coverageByAccount(plan) {
  const lines = new Map(), files = new Map(), txsOf = new Map();
  const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
  for (const t of plan.transactions ?? []) { const d = String(t.date ?? "").slice(0, 10); if (ISO.test(d)) { push(lines, t.accountId ?? "", d); push(txsOf, t.accountId ?? "", t); } }
  for (const im of plan.imports ?? []) {
    const f = String(im?.from ?? "").slice(0, 10), t = String(im?.to ?? "").slice(0, 10);
    if (ISO.test(f) && ISO.test(t) && f <= t) push(files, im.accountId ?? "", { from: f, to: t });
  }
  const out = {};
  for (const id of new Set([...lines.keys(), ...files.keys()])) {
    const dates = [...new Set(lines.get(id) ?? [])].sort();
    const recs = files.get(id) ?? [];
    const gaps = []; for (let i = 1; i < dates.length; i++) gaps.push(dayNo(dates[i]) - dayNo(dates[i - 1]));
    // an account with lines on only a few days has no rhythm to judge it by: only a month with nothing counts then
    const spacing = dates.length >= RHYTHM_DAYS ? median(gaps) : null;
    const slack = spacing === null ? LINE_GAP_DAYS : Math.max(COVER_SLACK, 2 * spacing), lineGap = Math.max(LINE_GAP_DAYS, slack);
    const segs = recs.map((r) => ({ from: r.from, to: r.to, fromFile: true, toFile: true }));
    let run = null;
    for (const d of dates) {
      if (recs.some((r) => d >= r.from && d <= r.to)) continue;
      if (run && dayNo(d) - dayNo(run.to) <= lineGap) run.to = d;
      else { if (run) segs.push(run); run = { from: d, to: d, fromFile: false, toFile: false }; }
    }
    if (run) segs.push(run);
    segs.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    const merged = [];
    for (const s of segs) {
      const last = merged[merged.length - 1];
      if (last && s.from <= last.to) { if (s.to > last.to) { last.to = s.to; last.toFile = s.toFile; } else if (s.to === last.to) last.toFile = last.toFile || s.toFile; }
      else merged.push({ ...s });
    }
    const holes = [];
    let usual = null;
    // a few lines only: no rhythm, never a hole
    if (spacing !== null) for (let i = 1; i < merged.length; i++) {
      const a = merged[i - 1], b = merged[i], days = dayNo(b.from) - dayNo(a.to) - 1;
      if (days < 1) continue;
      const from = plusDays(a.to, 1), to = plusDays(b.from, -1);
      const loose = !a.toFile && !b.fromFile;   // two runs of lines with no record: more than lineGap days apart already
      if (loose || quietTooLong(days, spacing) || (usual ??= usualPayments(plan, txsOf.get(id) ?? [])).some((u) => dueMissing(u, from, to))) holes.push({ from, to, days });
    }
    if (merged.length) out[id] = { from: merged[0].from, to: merged[merged.length - 1].to, holes, slack, spacing, lineDays: dates.length };
  }
  return out;
}
const accountName = (plan, id) => (plan.accounts ?? []).find((a) => a.id === id)?.name ?? "An account";
/**
 * monthHoles(plan, ym, today, covBy?) -> [{ accountId, name, from, to, days, whole: { from, to, days } }]: every account's holes
 * that reach into the month (up to today), clipped to it; `whole` is the full hole (it can start in the month before).
 */
export function monthHoles(plan, ym, today = null, covBy = coverageByAccount(plan)) {
  const y = Number(String(ym).slice(0, 4)), m = Number(String(ym).slice(5, 7));
  const start = `${ym}-01`, end = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const hi = today && today < end ? today : end;
  const out = [];
  for (const [accountId, c] of Object.entries(covBy ?? {})) for (const h of holesWithin(c.holes, start, hi)) out.push({ accountId, name: accountName(plan, accountId), ...h });
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

// ---------------------------------------------------------------- card files not imported (2026-11-02; rules made simpler in the re-check)
/** The spending line that stands in for a card whose own file is missing: its payments from your other accounts. */
export const CARD_UNIMPORTED = "card-unimported";
export const cardLineLabel = (name) => `${name || "Card"}, details not imported yet`;
/** A stand-in for a payment dated before the card's first line: "Visa card, before its file starts on 8/1" (re-check 4). */
export const beforeLabel = (name, first) => `${name || "Card"}, before its file starts on ${shortDate(first)}`;
// a bank line's words: "401(K)" is one word, and "AUTO PAY" is "autopay" (a payment, not a car loan)
const WORDS = (s) => String(s ?? "").toLowerCase().replace(/\b401\s*\(?\s*k\b\s*\)?/g, "401k ").replace(/\bauto\s*-?\s*pay(ment)?\b/g, "autopay ")
  .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
/** A card word: card, crd, or a word ending in "card" ("CREDIT CARD", "CHASE CREDIT CRD AUTOPAY", "APPLECARD"). */
const cardWord = (w) => w === "crd" || w === "card" || w === "cards" || (w.length > 4 && w.endsWith("card"));
/** A loan's or another account's word: a line with one is never a card's payment, whatever else it says. */
const NOT_CARD = new Set(["mortgage", "mtg", "auto", "loan", "loans", "lending", "brokerage", "savings", "529", "hsa", "ira", "401k", "retirement"]);
const notCardWord = (w) => NOT_CARD.has(w) || w.startsWith("invest");
/** The card networks a run of words names: visa, mastercard, amex (or "american express"), discover. */
function networksIn(ws) {
  const s = new Set(ws), out = new Set();
  if (s.has("visa")) out.add("visa");
  if (s.has("mastercard") || ws.some((w, i) => w === "master" && ws[i + 1] === "card")) out.add("mastercard");
  if (s.has("amex") || ws.some((w, i) => w === "american" && ws[i + 1] === "express")) out.add("amex");
  if (s.has("discover")) out.add("discover");
  return out;
}
const NETWORK_WORDS = new Set(["visa", "mastercard", "master", "amex", "american", "express", "discover"]);
const GENERIC = new Set(["card", "credit", "cards", "account", "bank", "the", "my", "and", "of", "financial", "services", "svcs", "inc", "corp", "company", "federal", "na"]);
/** The words that name an account or its bank ("Cy's 529" -> ["529"]: whose it is is not in a bank line). */
const keyWords = (s) => WORDS(String(s ?? "").replace(/[a-z0-9]+['’]s\b/gi, " ")).filter((w) => w.length > 2 && !GENERIC.has(w));
/**
 * A card's name word is in the line: the same word, or one the start of the other, both of 5 letters or more ("FREEDOMUNL");
 * four digits (the last four in the card's name) at the end of a word after letters only: "XXXX4321", "x4321", "*4321"
 * (re-check 4, 2026-11-02; a longer number, such as an ACH id ending in the same four digits, is not a card's last four).
 */
const inLine = (w, line) => line.has(w) || (/^\d{4}$/.test(w) ? [...line].some((x) => x.length > 4 && x.endsWith(w) && /^[a-z]+$/.test(x.slice(0, -4)))
  : w.length >= 5 && [...line].some((x) => x.length >= 5 && (x.startsWith(w) || w.startsWith(x))));
/** A bank's name is in the line: every one of its words, whole ("america" is never "american"; re-check 4, 2026-11-02). */
const bankIn = (bank, line) => bank.length > 0 && bank.every((w) => line.has(w));
/**
 * Wallet words (re-check 4, 2026-11-02): a line with one of these is money moved through a wallet, never a card's payment or
 * refund unless it also names the card's own name words or last four ("VISA DIRECT VENMO CASHOUT" names the Visa network, not
 * the card).
 */
const WALLET = [["visa", "direct"], ["apple", "cash"], ["cash", "app"], ["venmo"], ["zelle"], ["paypal", "transfer"], ["cashout"], ["cash", "out"]];
const hasPhrase = (ws, p) => ws.some((_, i) => p.every((x, j) => ws[i + j] === x));
const walletLine = (ws) => WALLET.some((p) => hasPhrase(ws, p));
/**
 * "transfer to" (or "xfer to") with no card word is money to another account; with one it is how many banks word paying their
 * own card ("TRANSFER TO CREDIT CARD", "ONLINE TRANSFER TO CITI CARD", "Online Banking transfer to CRD 1234"; re-check 5,
 * 2026-11-05: round 4 made every "transfer to" a wallet's words and lost those payments).
 */
const transferTo = (ws) => hasPhrase(ws, ["transfer", "to"]) || hasPhrase(ws, ["xfer", "to"]);
const transferWord = (line) => line.has("transfer") || line.has("xfer");
/** Money in from a card is less of what it bought only with one of these words (verify 5, 2026-11-05). */
const REFUND_WORDS = new Set(["refund", "refunds", "rfnd", "return", "returned", "reversal", "reversed"]);
/** Card networks that are not also a bank with savings accounts: they can name the card in a "transfer to" line. */
const BANKLESS_NETS = new Set(["visa", "mastercard"]);
/** Days between a line and the other side of it on another of your own accounts (a transfer posts on both within a few days). */
export const OWN_DAYS = 3;
/**
 * What names a card in a bank line: its own name's words other than its bank's and generic ones ("Freedom", "Sapphire", the
 * last four digits when the name has them), and its network (visa, mastercard, amex, discover, from its name or bank). The
 * bank's words (`bank`) never name it on their own; they only tell apart two cards a line could be (see cardPayments).
 */
function cardKey(c) {
  const bank = keyWords(c.institution);
  return { id: c.id, bank, nets: networksIn([...WORDS(c.name), ...WORDS(c.institution)]), name: keyWords(c.name).filter((w) => !bank.includes(w) && !NETWORK_WORDS.has(w)) };
}
const namesCard = (k, line, nets) => k.name.some((w) => inLine(w, line)) || [...k.nets].some((n) => nets.has(n));
/** Days between a payment from checking and the card's own line for it (the card side posts a day or a few later). */
export const MATCH_DAYS = 7;
/** A card account: a credit card, or an "other debt" whose name says card. Savings, loans and investments are never one. */
export const isCardAccount = (a) => a?.type === "credit" || (a?.type === "other_liability" && /\b(card|visa|mastercard|amex|discover)\b/i.test(String(a?.name ?? "")));
/** One account's own files (a coverageByAccount entry) cover every day within MATCH_DAYS of `date`, none of it after today. */
function coversAround(cov, date, today) {
  if (!cov) return false;
  const lo = plusDays(date, -MATCH_DAYS), hi = plusDays(date, MATCH_DAYS);
  if (today && hi > today) return false;
  return cov.from <= lo && cov.to >= hi && !(cov.holes ?? []).some((h) => h.from <= hi && h.to >= lo);
}
/**
 * ownPairs(plan, cardIds, pairs, cardish) -> Set of lines: transfers between two of your own accounts that are not cards, each
 * line paired with its other side (re-check 5, 2026-11-05). Lines: filed as transfers (isTransfer: a paycheck or a purchase
 * of the same amount is never the other side), dated, not 0, on an account that is not a card, and not already paired by a
 * transferId. Two lines pair when they are on different accounts, of the same amount the other way, within OWN_DAYS of each
 * other; each line pairs once. Pairs are taken in this order: neither line uses a card word nor names a card (`cardish`), then
 * one does, then both; then the nearest in days; then by date and id. So a card's payment ("CHASE CREDIT CRD AUTOPAY") yields
 * the other side to a savings transfer of the same amount the same day, whichever sorts first, and still takes one that
 * nothing else could (a card kept as an "other debt" the app does not know as a card).
 */
function ownPairs(plan, cardIds, pairs, cardish) {
  const ok = new Set((plan.accounts ?? []).filter((a) => !cardIds.has(a.id)).map((a) => a.id));
  const byCents = new Map(), lines = [], isT = transferTest(plan);
  for (const t of plan.transactions ?? []) {
    const date = String(t.date ?? "").slice(0, 10), cents = Math.round((Number(t.amount) || 0) * 100);
    if (!ok.has(t.accountId) || !ISO.test(date) || !cents || !isT(t)) continue;
    if (t.transferId && (pairs.get(t.transferId) ?? []).some((x) => x !== t && x.accountId !== t.accountId)) continue;
    const ws = WORDS(`${t.rawPayee ?? ""} ${t.payee ?? ""}`);
    const x = { t, date, id: String(t.id ?? ""), day: dayNo(date), cents, tier: cardish(ws, new Set(ws)) ? 1 : 0 };
    lines.push(x); (byCents.get(cents) ?? byCents.set(cents, []).get(cents)).push(x);
  }
  const cand = [];
  for (const a of lines) if (a.cents < 0) for (const b of byCents.get(-a.cents) ?? []) {
    const dd = Math.abs(a.day - b.day);
    if (b.t.accountId !== a.t.accountId && dd <= OWN_DAYS) cand.push({ a, b, tier: a.tier + b.tier, dd });
  }
  cand.sort((x, y) => x.tier - y.tier || x.dd - y.dd || x.a.date.localeCompare(y.a.date) || x.a.id.localeCompare(y.a.id) || x.b.date.localeCompare(y.b.date) || x.b.id.localeCompare(y.b.id));
  const out = new Set();
  for (const { a, b } of cand) if (!out.has(a.t) && !out.has(b.t)) { out.add(a.t); out.add(b.t); }
  return out;
}
/**
 * cardPayments(plan, ym, { today, covBy }) -> [{ t, cardId, out, matched, standIn, maybe? }]
 * Money filed as a transfer between a card and your other accounts in the month: `t` is the line on the non-card account (out:
 * money to the card; else money back from it, a returned autopay or a refund of a credit balance).
 * Which card (re-check 2026-11-02: these few rules replace the word scores):
 *   1. the other side of its transferId, when that is a card (a transferId to a non-card account is never a card's);
 *   2. your own accounts are never cards (re-check 4): a line paired with its other side on another of your accounts that is
 *      not a card is a transfer between them, never a card's (money to savings at the card's bank, Apple Cash, a PayPal
 *      account). ownPairs pairs transfer lines only (a paycheck of the same amount is never the other side; re-check 5,
 *      2026-11-05), the same amount the other way within OWN_DAYS, each line once, lines that neither use a card word nor
 *      name a card first, the nearest first, so a card's payment never takes the other side of a savings transfer made the
 *      same day. So is a line with no card word and "transfer" (or a wallet's words) that names another of your non-card
 *      accounts by its own name's words, every one, whole ("APPLE CASH TRANSFER" with an Apple Cash account; re-check 5), or
 *      with "transfer" that names the bank of one (every word, whole) and no card's own name words or last four;
 *   3. else the line must name a card (cardKey: its own name's words, the last four digits, its network) or use a card word
 *      (card, crd, credit card); a bank's name with "pmt" or "payment" is never enough, and a line with a loan's or another
 *      account's word (home lending, mortgage, mtg, auto, loan, lending, invest..., brokerage, savings, 529, hsa, ira, 401k,
 *      retirement) is never a card's. A line with a wallet's words (WALLET: visa direct, apple cash, cash app, venmo, zelle,
 *      paypal transfer, cashout), and money in or "transfer to" with no card word, count only for a card whose own name words
 *      or last four they name (re-check 4: "VISA DIRECT VENMO CASHOUT" is not a refund from the Visa card; re-check 5: with a
 *      card word, "TRANSFER TO CREDIT CARD" is a payment and "CHASE CREDIT CRD REFUND" a refund of a credit balance); one
 *      exception keeps a payment from counting twice: money in of the same amount on the same account within MATCH_DAYS
 *      after a payment counted for a card is that payment coming back (a returned autopay);
 *   4. the cards it could be: the ones it names, or every card when it uses a card word. Of those, the card with its own
 *      money-in line of the same amount within MATCH_DAYS has it (each line matched once; one the line names first, then the
 *      nearest); else a card whose own file covers every day around it without that line is not the one; of the rest, the only
 *      one left, else the only one the line names, else (the line names none of them) the only one whose bank's every word is
 *      in the line, whole ("america" is not "american"). Otherwise it is unsure: `cardId` null, `maybe` = the cards it could
 *      be, and it stands in for none (counted once; unsureCardPayments says so and keeps the month from counting as whole).
 * `standIn` (rule 2 of the re-check): the card has no lines of its own in the payment's month, or the payment is dated before
 * the card's first line ever. Never in a month the card's file covers in part: the payment paid purchases already listed or
 * about to be, and the month is left out of whole-month averages by monthGaps (its hole, late start or short end) instead.
 */
export function cardPayments(plan, ym, { today = null, covBy = null } = {}) {
  const accounts = plan.accounts ?? [];
  const cards = accounts.filter(isCardAccount);
  if (!cards.length) return [];
  const ids = new Set(cards.map((c) => c.id));
  const txs = plan.transactions ?? [];
  const cb = covBy ?? coverageByAccount(plan);
  const pairs = new Map();
  for (const t of txs) if (t.transferId) (pairs.get(t.transferId) ?? pairs.set(t.transferId, []).get(t.transferId)).push(t);
  const keys = new Map(cards.map((c) => [c.id, cardKey(c)]));
  const own = txs.filter((t) => ids.has(t.accountId) && ISO.test(String(t.date ?? "").slice(0, 10))).map((t) => ({ t, date: String(t.date).slice(0, 10), day: dayNo(String(t.date).slice(0, 10)), cents: Math.round((Number(t.amount) || 0) * 100) }));
  // the card's own lines: the months it has any, and its first day ever
  const first = new Map(), withLines = new Set();
  for (const x of own) { const id = x.t.accountId; if (!first.has(id) || x.date < first.get(id)) first.set(id, x.date); withLines.add(`${id}|${x.date.slice(0, 7)}`); }
  const standsIn = (id, date) => !!id && (!withLines.has(`${id}|${date.slice(0, 7)}`) || date < first.get(id));
  const used = new Set(), returned = new Set();
  // your other accounts that are not cards: their banks' words and their own names' words
  const otherBanks = accounts.filter((a) => !ids.has(a.id)).map((a) => ({ id: a.id, bank: keyWords(a.institution), name: keyWords(a.name) }));
  // lines paired with their other side on another of your accounts that is not a card (rule 2)
  const paired = ownPairs(plan, ids, pairs, (ws, line) => ws.some(cardWord) || cards.some((c) => namesCard(keys.get(c.id), line, networksIn(ws))));
  const cands = txs.filter((t) => monthOf(t.date) === ym && ISO.test(String(t.date)) && (Number(t.amount) || 0) !== 0 && !ids.has(t.accountId) && isTransfer(t, plan))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id ?? "").localeCompare(String(b.id ?? "")));
  const one = (list) => (list.length === 1 ? list[0] : null);
  const out = [];
  for (const t of cands) {
    let cardId = null, matched = false, maybe = null;
    const cents = Math.round(Number(t.amount) * 100), day = dayNo(t.date);
    if (t.transferId) {
      const other = (pairs.get(t.transferId) ?? []).find((x) => x !== t && x.accountId !== t.accountId);
      if (other) { if (!ids.has(other.accountId)) continue; cardId = other.accountId; matched = true; const o = own.find((x) => x.t === other); if (o) used.add(o); }
    }
    if (!cardId) {
      // paired with its other side on another of your own accounts that is not a card: money between your own accounts, never
      // a card's (savings at the card's bank; re-check 4, 2026-11-02; ownPairs, re-check 5)
      if (paired.has(t)) continue;
      const words = WORDS(`${t.rawPayee ?? ""} ${t.payee ?? ""}`), line = new Set(words);
      if (words.some(notCardWord)) continue;
      const cardy = words.some(cardWord);
      // a transfer or a wallet's words that name another of your non-card accounts by its own name (every word, whole) and no
      // card word: money to or from that account, even with no file of its own ("APPLE CASH TRANSFER" with an Apple Cash
      // account and an Apple Card; "PAYPAL TRANSFER" with a PayPal account and a PayPal Mastercard; re-check 5, 2026-11-05)
      if (!cardy && (transferWord(line) || walletLine(words)) && otherBanks.some((b) => b.id !== t.accountId && bankIn(b.name, line))) continue;
      // money in, or a wallet's or transfer's words: only the card's own name words or last four say it is the card's
      const ownName = cards.filter((c) => keys.get(c.id).name.some((w) => inLine(w, line)));
      // a transfer that names the bank of another of your accounts that is not a card (every word, whole), no card's own name
      // and no card word: money to that account ("AMERICAN EXPRESS NATIONAL BANK TRANSFER" with American Express savings;
      // re-check 4; "...TO WELLS FARGO VISA CARD" with a Wells Fargo mortgage is the card's, re-check 5)
      if (!ownName.length && !cardy && transferWord(line) && otherBanks.some((b) => b.id !== t.accountId && bankIn(b.bank, line))) continue;
      // with a card word, "transfer to" is a payment; money in is a refund of a credit balance only when it says so (refund,
      // return, reversal): "TRANSFER FROM CREDIT CARD" or "CASH ADVANCE" is money borrowed on the card, never less of what it
      // bought (verify 5, 2026-11-05)
      const refundy = words.some((w) => REFUND_WORDS.has(w));
      const strict = walletLine(words) || (cents > 0 ? !(cardy && refundy) : transferTo(words) && !cardy);
      const nets = networksIn(words);
      // "TRANSFER TO VISA 1234": a payment naming the card by its Visa or Mastercard network (never a bank's savings, unlike
      // Amex and Discover; verify 5)
      const toNet = !walletLine(words) && cents < 0 && strict ? cards.filter((c) => !ownName.includes(c) && [...keys.get(c.id).nets].some((n) => BANKLESS_NETS.has(n) && nets.has(n))) : [];
      const own2 = [...ownName, ...toNet];
      const named = strict ? own2 : cards.filter((c) => namesCard(keys.get(c.id), line, nets));
      const pool = strict ? own2 : words.some(cardWord) ? cards : named;
      if (!pool.length) {
        // a payment to a card coming back (a returned autopay): the same amount on the same account within MATCH_DAYS after a
        // payment counted for a card undoes that payment, so it is never counted twice
        const back = cents > 0 && !walletLine(words) ? out.find((f) => f.out && f.cardId && !returned.has(f) && f.t.accountId === t.accountId && Math.round(Number(f.t.amount) * 100) === -cents && day - dayNo(f.t.date) >= 0 && day - dayNo(f.t.date) <= MATCH_DAYS) : null;
        if (!back) continue;
        returned.add(back);
        out.push({ t, cardId: back.cardId, out: false, matched: false, standIn: standsIn(back.cardId, String(t.date).slice(0, 10)) });
        continue;
      }
      const hits = pool.map((c) => ({ c, x: own.filter((x) => x.t.accountId === c.id && !used.has(x) && x.cents === -cents && Math.abs(x.day - day) <= MATCH_DAYS).sort((a, b) => Math.abs(a.day - day) - Math.abs(b.day - day))[0] }))
        .filter((h) => h.x).sort((a, b) => Number(named.includes(b.c)) - Number(named.includes(a.c)) || Math.abs(a.x.day - day) - Math.abs(b.x.day - day));
      if (hits.length) { used.add(hits[0].x); cardId = hits[0].c.id; matched = true; }
      else {
        const live = pool.filter((c) => !coversAround(cb[c.id], t.date, today));
        const could = live.length ? live : pool;
        const namedHere = named.filter((c) => could.includes(c));
        const c = one(could) ?? (namedHere.length ? one(namedHere) : one(could.filter((x) => bankIn(keys.get(x.id).bank, line))));
        if (c) cardId = c.id; else maybe = could.map((x) => x.id);
      }
    }
    out.push({ t, cardId, out: cents < 0, matched, standIn: standsIn(cardId, String(t.date).slice(0, 10)), ...(maybe ? { maybe } : {}) });
  }
  return out;
}
/**
 * paymentsTo(plan, accountId, from, to, { today }) -> [lines]: the money that went to that account from your other accounts
 * between those days: the other side of a transferId on it, and for a card, every cardPayments line to it or that may be to
 * it (`maybe`). "Nothing happened on those days" is never offered for days with one of these in them (re-check 2026-11-02).
 */
export function paymentsTo(plan, accountId, from, to, { today = null, covBy = null } = {}) {
  if (!accountId || !ISO.test(String(from ?? "")) || !ISO.test(String(to ?? "")) || from > to) return [];
  const txs = plan.transactions ?? [];
  const hit = new Set();
  const inSpan = (t) => { const d = String(t.date ?? "").slice(0, 10); return d >= from && d <= to; };
  const onIt = new Set(txs.filter((t) => t.accountId === accountId && t.transferId).map((t) => t.transferId));
  for (const t of txs) if (t.transferId && onIt.has(t.transferId) && t.accountId !== accountId && (Number(t.amount) || 0) < 0 && inSpan(t)) hit.add(t);
  if (isCardAccount((plan.accounts ?? []).find((a) => a.id === accountId))) {
    const cb = covBy ?? coverageByAccount(plan);
    for (let ym = from.slice(0, 7); ym <= to.slice(0, 7); ym = nextYm(ym))
      for (const f of cardPayments(plan, ym, { today, covBy: cb })) if (f.out && inSpan(f.t) && (f.cardId === accountId || (f.maybe ?? []).includes(accountId))) hit.add(f.t);
  }
  return [...hit].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
const prevYm = (ym) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const nextYm = (ym) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };
const cents2 = (n) => Math.round(n * 100) / 100;
/** cardStandIns over cardPayments already worked out (missingCardFiles uses the same ones for its unsure cards). */
function standInsOf(plan, ym, flows) {
  const by = new Map();
  // a payment marked "Leave out of reports" (gap #32) stands in for nothing
  const isOut = leftOutIn(plan.transactions);
  for (const f of flows) if (f.standIn && !isOut(f.t)) (by.get(f.cardId) ?? by.set(f.cardId, { pays: [], backs: [] }).get(f.cardId))[f.out ? "pays" : "backs"].push(f.t);
  if (!by.size) return [];
  const has = new Set((plan.transactions ?? []).filter((t) => monthOf(t.date) === ym).map((t) => t.accountId));
  const out = [];
  for (const c of (plan.accounts ?? []).filter((a) => by.has(a.id))) {
    const { pays, backs } = by.get(c.id);
    const left = pays.map((t) => ({ t, amount: -(Number(t.amount) || 0) }));
    for (const b of backs) {
      let back = Number(b.amount) || 0;
      const same = left.find((l) => Math.abs(l.amount - back) < 0.005);
      if (same) { same.amount = 0; continue; }
      for (const l of [...left].reverse()) { if (back <= 0) break; const take = Math.min(l.amount, back); l.amount -= take; back -= take; }
    }
    const keep = left.filter((l) => l.amount > 0.004);
    const paid = cents2(keep.reduce((s, l) => s + l.amount, 0));
    const first = firstLineOf(plan, c.id);
    if (paid > 0) out.push({ accountId: c.id, name: c.name || "Card", paid, from: [...new Set(keep.map((l) => l.t.accountId))], lines: keep.map((l) => ({ ...l.t, amount: -cents2(l.amount) })), hasLines: has.has(c.id),
      first, before: !!first && keep.every((l) => String(l.t.date).slice(0, 10) < first) });
  }
  return out;
}
/**
 * cardStandIns(plan, ym, { today, covBy }) -> [{ accountId, name, paid, from: [payer accountIds], lines: [payments, amount < 0], hasLines, first, before }]
 * Per card, the payments to it in the month that stand in for its purchases (cardPayments standIn), less the money that came
 * back from it that stands in too: a return cancels a payment of the same amount, else comes off the latest payments; never
 * below 0 (a refund of a credit balance with nothing paid that month is not negative spending). `paid` = what is left, in
 * positive dollars; `lines` carry the amounts that are left; `hasLines`: the card has lines of its own in the month (the
 * payments are then dated before its first line ever); `first`: the card's first line ever (null with none); `before`: every
 * payment left is dated before it, so the pages say "before its file starts on 8/1", not "its file isn't in" (re-check 4).
 */
export function cardStandIns(plan, ym, { today = null, covBy = null } = {}) {
  return standInsOf(plan, ym, cardPayments(plan, ym, { today, covBy: covBy ?? coverageByAccount(plan) }));
}
/** The cards' gaps in one month from its cardPayments: the cards standing in (missingCardFiles) and the unsure payments. */
function cardGaps(plan, ym, flows) {
  const cards = standInsOf(plan, ym, flows).filter((c) => !c.hasLines).map(({ hasLines, ...c }) => c);
  const has = new Set((plan.transactions ?? []).filter((t) => monthOf(t.date) === ym).map((t) => t.accountId));
  const unsureFlows = flows.filter((f) => f.out && f.maybe && f.maybe.some((id) => !has.has(id)));
  if (!unsureFlows.length) return { cards, unsure: null };
  const accounts = plan.accounts ?? [];
  const maybe = [...new Set(unsureFlows.flatMap((f) => f.maybe))];
  const banks = new Set(maybe.map((id) => String(accounts.find((a) => a.id === id)?.institution ?? "").trim()));
  const lines = unsureFlows.map((f) => f.t);
  return { cards, unsure: { paid: cents2(-lines.reduce((s, t) => s + (Number(t.amount) || 0), 0)), count: lines.length, lines, maybe,
    cardIds: maybe.filter((id) => !has.has(id)), bank: banks.size === 1 ? [...banks][0] || null : null, from: [...new Set(lines.map((t) => t.accountId))] } };
}
/**
 * missingCardFiles(plan, ym, { today, covBy }) -> [{ accountId, name, paid, from: [payer accountIds], lines: [payment lines], first, before }]
 * Card accounts with no lines of their own in the month that money filed as a transfer went to from your other accounts
 * (paid > 0, after money that came back; cardStandIns): their purchases are missing from spending, and their payments stand in.
 * A card with nothing paid to it is not asked about here (a quiet month is normal; a card whose lines stop is monthGaps'
 * `short`); a payment that could be either of two cards is unsureCardPayments'.
 */
export function missingCardFiles(plan, ym, opts = {}) {
  return cardGaps(plan, ym, cardPayments(plan, ym, { ...opts, covBy: opts.covBy ?? coverageByAccount(plan) })).cards;
}
/**
 * unsureCardPayments(plan, ym, { today, covBy }) -> null | { paid, count, lines, maybe: [cardIds], cardIds: [those with no lines
 * this month], bank (their one institution, or null), from: [payer accountIds] }
 * The month's payments to a card counted for neither card (cardPayments `maybe`) while one of the cards they could be has no
 * lines that month: what they bought is in no total, so the month is not whole (monthGaps) and the pages say so in one
 * sentence (unsureWords; re-check 4, 2026-11-02).
 */
export function unsureCardPayments(plan, ym, opts = {}) {
  return cardGaps(plan, ym, cardPayments(plan, ym, { ...opts, covBy: opts.covBy ?? coverageByAccount(plan) })).unsure;
}
/**
 * unimportedCardLines(plan, ym, { today, covBy }) -> [stand-in lines]: one per payment left in cardStandIns, dated the payment,
 * money out, category CARD_UNIMPORTED, payee "<card>, details not imported yet", cardId the card, synthetic: true, `before`:
 * true when the payment is dated before the card's first line ever (`first`; payee "<card>, before its file starts on 8/1",
 * in any month before it, re-check 4 2026-11-02).
 * Never stored in the plan: Spending, the Income statement, Budget and bank-versus-plan add them for a month the card has no
 * lines in, and drop them once it has (its purchases count then; the payment stays a transfer).
 */
export function unimportedCardLines(plan, ym, opts = {}) {
  const out = [];
  for (const c of cardStandIns(plan, ym, opts)) for (const t of c.lines) {
    const before = !!c.first && String(t.date).slice(0, 10) < c.first;
    out.push({ id: `${CARD_UNIMPORTED}-${t.id}`, date: t.date, amount: t.amount, payee: before ? beforeLabel(c.name, c.first) : cardLineLabel(c.name), rawPayee: "", accountId: c.accountId, paidFrom: t.accountId, cardId: c.accountId, cardName: c.name, category: CARD_UNIMPORTED, tags: [], note: "", synthetic: true, before, first: c.first });
  }
  return out;
}
/** The stand-in lines for every month that has transactions (for pages that total many months). */
export function allUnimportedCardLines(plan, opts = {}) {
  if (!(plan.accounts ?? []).some(isCardAccount)) return [];
  const covBy = opts.covBy ?? coverageByAccount(plan);
  const months = [...new Set((plan.transactions ?? []).map((t) => monthOf(t.date)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort();
  return months.flatMap((ym) => unimportedCardLines(plan, ym, { ...opts, covBy }));
}
/** A card's first line ever (its own transactions), or null: a payment before it stands in (cardPayments). */
export function firstLineOf(plan, accountId) {
  let first = null;
  for (const t of plan.transactions ?? []) { const d = String(t.date ?? "").slice(0, 10); if (t.accountId === accountId && ISO.test(d) && (!first || d < first)) first = d; }
  return first;
}
// ---------------------------------------------------------------- the gaps in words (shared by the Monthly review, Spending, Budget)
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "7/31" (with the year when asked: the two ends of a span in different years). */
export const shortDate = (iso, withYear = false) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}${withYear ? `/${iso.slice(0, 4)}` : ""}`;
const ord = (n) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
/** usualInDays in words: "your mortgage usually goes out on the 2nd and a paycheck on the 1st" ("" with none). */
export function usualWords(usual) {
  const words = (usual ?? []).map((u, i) => (i ? `${u.name} on the ${ord(u.day)}` : `${u.name} usually ${u.out ? "goes out" : "comes in"} on the ${ord(u.day)}`));
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0] ?? "";
}
/**
 * A hole in one account's files: "Chase checking has no lines from 7/31 to 8/2: bring in a file that covers those days, or add
 * them by hand." (the whole hole); with the usual payments due in it (usualInDays): "Chase checking has no lines from 7/31 to
 * 8/2 (your mortgage usually goes out on the 2nd and a paycheck on the 1st): bring in ..." (re-check 4, 2026-11-02).
 */
export function holeWords(h, usual = []) {
  const w = h.whole ?? h, y = w.from.slice(0, 4) !== w.to.slice(0, 4), u = usualWords(usual), why = u ? ` (${u})` : "";
  return w.days === 1 ? `${h.name} has no lines on ${shortDate(w.from)}${why}: bring in a file that covers that day, or add it by hand.`
    : `${h.name} has no lines from ${shortDate(w.from, y)} to ${shortDate(w.to, y)}${why}: bring in a file that covers those days, or add them by hand.`;
}
/** "Visa card" -> "Visa": what the card's file is called ("Bring in the Visa file"); a bare "Credit card" -> null. */
export const fileWord = (name) => String(name ?? "").replace(/\s*\b(credit\s+)?card\b\s*$/i, "").trim() || null;
/** "Bring in the Visa file." */
export const bringWords = (name) => (fileWord(name) ? `Bring in the ${fileWord(name)} file.` : "Bring in that card's file.");
/** "the Visa card" ("Ana's Visa" and "My card" keep their own words). */
export const theCard = (name) => { const n = String(name || "Card"); return /^(the|my|our)\b/i.test(n) || /['’]s\b/.test(n) ? n : `the ${n}`; };
/** ["2026-07"] -> "July"; two -> "July and August"; three or more in a row -> "July to October"; with the year when they span two. */
export function monthsWords(yms) {
  const s = [...new Set(yms ?? [])].sort();
  if (!s.length) return "";
  const years = new Set(s.map((m) => m.slice(0, 4))).size > 1;
  const name = (m) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]}${years ? ` ${m.slice(0, 4)}` : ""}`;
  const next = (m) => { const y = Number(m.slice(0, 4)), n = Number(m.slice(5, 7)); return n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, "0")}`; };
  const run = s.length >= 3 && s.every((m, i) => !i || next(s[i - 1]) === m);
  if (run) return `${name(s[0])} to ${name(s[s.length - 1])}`;
  return s.length === 1 ? name(s[0]) : `${s.slice(0, -1).map(name).join(", ")} and ${name(s[s.length - 1])}`;
}
/** Whole dollars with commas, the pages' own way: "$2,610". */
const dollars = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
/**
 * A card whose own file is missing (a missingCardFiles entry): "Visa card: $2,610 went to it from checking in October, but its
 * own file isn't in, so what you bought on it is missing. Bring in the Visa file." Payers by kind (checking, savings) or name.
 * Paid before the card's first line ever (`before`): "Visa card: $640 went to it from checking in July, before its file starts
 * on 8/1, so what you bought on it then is missing. Bring in the Visa file for July." (re-check 4, 2026-11-02)
 */
export function cardWords(plan, c, month, money = dollars) {
  const mon = MONTH_NAMES[Number(String(month).slice(5, 7)) - 1];
  if (c.before && c.first) return `${c.name}: ${money(c.paid)} went to it from ${payerWords(plan, c.from)} in ${mon}, before its file starts on ${shortDate(c.first)}, so what you bought on it then is missing. ${bringWords(c.name).replace(/\.$/, ` for ${mon}.`)}`;
  return `${c.name}: ${money(c.paid)} went to it from ${payerWords(plan, c.from)} in ${mon}, but its own file isn't in, so what you bought on it is missing. ${bringWords(c.name)}`;
}
/**
 * One sentence for payments counted for neither card (unsureCardPayments; re-check 4, 2026-11-02): "$2,610 went to one of your
 * Chase cards in October; bring in the card files to see what it bought" (no full stop: gapIssues adds it to `text`). Several
 * payments: "your Chase cards"; only one of the cards has no lines that month: "bring in the Sapphire file".
 */
export function unsureWords(plan, u, month, money = dollars) {
  const mon = MONTH_NAMES[Number(String(month).slice(5, 7)) - 1];
  const where = `${u.count === 1 ? "one of your" : "your"} ${u.bank ? `${u.bank} ` : ""}cards`;
  const one = u.cardIds.length === 1 ? fileWord((plan.accounts ?? []).find((a) => a.id === u.cardIds[0])?.name) : null;
  return `${money(u.paid)} went to ${where} in ${mon}; bring in ${one ? `the ${one} file` : "the card files"} to see what it bought`;
}
/**
 * The same in a few words with no amount or month, for a note that names several months at once ("August to October 2026 are
 * left out: money went to your Chase cards, whose files aren't in"; re-check 5, 2026-11-05). Only one of the cards has no lines
 * that month: "money may have gone to the Sapphire card, whose file isn't in".
 */
export function unsureBrief(plan, u) {
  if (u.cardIds.length === 1) return `money may have gone to ${theCard((plan.accounts ?? []).find((a) => a.id === u.cardIds[0])?.name)}, whose file isn't in`;
  return `money went to your ${u.bank ? `${u.bank} ` : ""}cards, whose files aren't in`;
}
/** The accounts money went to a card from: "checking", "checking and savings", or their names. */
export function payerWords(plan, from) {
  const kind = (id) => { const a = (plan.accounts ?? []).find((x) => x.id === id); return a?.type === "checking" || a?.type === "savings" ? a.type : a?.name ?? "another account"; };
  return [...new Set((from ?? []).map(kind))].join(" and ") || "your other accounts";
}

/**
 * monthGaps(plan, ym, today, covBy?) -> { holes (monthHoles), short: [{ accountId, name, to }], late: [{ accountId, name, from }], cards (missingCardFiles), unsure (unsureCardPayments), whole, hi (the month's last day looked at: its end, or today) }
 * What keeps one month's bank files from being whole, account by account: a hole inside it; an account whose lines stop early
 * while it had lines the month before or in this one (an account closed long ago is not asked about): the days from its last
 * line to the month's end (or today, for the month still running) are more than a quiet spell (quietTooLong: more than
 * SHORT_DAYS and more than 2 x its usual spacing; never for an account with lines on fewer than RHYTHM_DAYS days); an account
 * whose lines (or files) start in the month after more than a quiet spell from the 1st (a card's 90-day file from the 20th;
 * re-check 4: the same rule as a stop); a card whose own file is missing; a payment counted for neither card (unsure).
 * `short` and `late` leave out the cards listed.
 * `whole`: no hole, no account short or late, no unsure payment (the cards' payments stand in for what is missing:
 * cardStandIns; an unsure one stands in for nothing), so the month's totals can be averaged; a month the files do not span is
 * never whole either (wholeMonth).
 */
export function monthGaps(plan, ym, today = null, covBy = coverageByAccount(plan)) {
  const y = Number(String(ym).slice(0, 4)), m = Number(String(ym).slice(5, 7));
  const start = `${ym}-01`, end = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const hi = today && today < end ? today : end;
  // a card with no lines this month that money went to stands in by its payments: it is listed here, never as stopping early
  const { cards, unsure } = cardGaps(plan, ym, cardPayments(plan, ym, { today, covBy }));
  const listed = new Set([...cards.map((c) => c.accountId), ...(unsure?.cardIds ?? [])]);
  const known = new Set((plan.accounts ?? []).map((a) => a.id));
  const mine = Object.entries(covBy ?? {}).filter(([id]) => known.has(id) && !listed.has(id));
  const short = mine.filter(([, c]) => c.from <= hi && c.to >= `${prevYm(ym)}-01` && c.to < hi && quietTooLong(dayNo(hi) - dayNo(c.to), c.spacing))
    .map(([accountId, c]) => ({ accountId, name: accountName(plan, accountId), to: c.to }));
  const late = mine.filter(([, c]) => c.from > start && c.from <= hi && quietTooLong(dayNo(c.from) - dayNo(start), c.spacing))
    .map(([accountId, c]) => ({ accountId, name: accountName(plan, accountId), from: c.from }));
  const holes = monthHoles(plan, ym, today, covBy).filter((h) => known.has(h.accountId));
  return { holes, short, late, cards, unsure, whole: !holes.length && !short.length && !late.length && !unsure, hi };
}
/**
 * wholeMonth(plan, ym, today, { cov, covBy }) -> true when the month can be counted as a whole month of bank files: it is over,
 * the files together reach both ends (monthCover of coverage) and no account's files have a hole in it, stop early or start
 * late (monthGaps). Spending's default month, Budget's suggestions, the Income statement's typical month and bank-versus-plan
 * all ask this one question (2026-11-02).
 */
export function wholeMonth(plan, ym, today = null, { cov = coverage(plan), covBy = coverageByAccount(plan) } = {}) {
  return monthCover(cov, ym, today).full && monthGaps(plan, ym, today, covBy).whole;
}
/**
 * gapIssues(plan, gaps, ym, money) -> [{ accountId, kind ("card"|"unsure"|"hole"|"short"|"late"), text, why, quiet: { accountId, from, to } | null, cardIds?, brief? }]
 * monthGaps in words, cards first: `text` says what to bring in, `why` is the short reason (Budget's "left out" note), `quiet` the
 * days the owner can mark as checked when nothing happened on them (markQuiet; a card money went to has none: its purchases
 * happened). An unsure payment is one issue (unsureWords), `cardIds` the cards whose files would say, `brief` its reason with
 * no amount or month (unsureBrief: a note naming several months says it once; re-check 5); a hole names the usual
 * payments due in it (usualInDays: "(your mortgage usually goes out on the 2nd and a paycheck on the 1st)").
 */
export function gapIssues(plan, gaps, ym, money = dollars) {
  const y = Number(String(ym).slice(0, 4)), m = Number(String(ym).slice(5, 7));
  // the days a short end can be marked quiet stop at today for the month still running (gaps.hi), never in the future
  const end = gaps?.hi ?? `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const mon = MONTH_NAMES[m - 1];
  return [
    ...(gaps?.cards ?? []).map((c) => ({ accountId: c.accountId, kind: "card", text: cardWords(plan, c, ym, money), why: c.before && c.first ? `${c.name}'s payment before its file starts on ${shortDate(c.first)}` : `${c.name}'s own file isn't in`, quiet: null })),
    ...(gaps?.unsure ? [(() => { const w = unsureWords(plan, gaps.unsure, ym, money); return { accountId: gaps.unsure.cardIds[0], kind: "unsure", cardIds: gaps.unsure.cardIds, text: `${w}.`, why: w, brief: unsureBrief(plan, gaps.unsure), quiet: null }; })()] : []),
    ...(gaps?.holes ?? []).map((h) => { const w = h.whole ?? h; return { accountId: h.accountId, kind: "hole", text: holeWords(h, usualInDays(plan, h.accountId, w.from, w.to)), why: holeWords(h).replace(/:.*$/, ""), quiet: { accountId: h.accountId, from: w.from, to: w.to }, from: w.from, to: w.to }; }),
    ...(gaps?.late ?? []).map((s) => ({ accountId: s.accountId, kind: "late", text: `${s.name}'s lines start on ${shortDate(s.from)}: bring in a file from ${shortDate(`${ym}-01`)}.`, why: `${s.name}'s lines start on ${shortDate(s.from)}`, quiet: { accountId: s.accountId, from: `${ym}-01`, to: plusDays(s.from, -1) } })),
    ...(gaps?.short ?? []).map((s) => ({ accountId: s.accountId, kind: "short", text: `${s.name}'s lines stop on ${shortDate(s.to)}: bring in the rest of ${mon}.`, why: `${s.name}'s lines stop on ${shortDate(s.to)}`, quiet: { accountId: s.accountId, from: plusDays(s.to, 1), to: end } })),
  ];
}
/**
 * markQuiet(draft, { accountId, from, to, at, id }) -- PURE plan change (the view passes it to store.update): nothing happened on
 * those days in that account, so they count as covered. One plan.imports entry with no lines (rows 0, added 0, fileName "");
 * the Import page lists it under Past imports, and its Undo removes it. No new field.
 */
export function markQuiet(draft, { accountId, from, to, at = null, id = null }) {
  if (!accountId || !ISO.test(String(from ?? "")) || !ISO.test(String(to ?? "")) || from > to) return draft;
  draft.imports = draft.imports ?? [];
  draft.imports.push({ id: id ?? `quiet-${accountId}-${from}-${to}`, at: at ?? `${to}T00:00:00.000Z`, accountId, fileName: "", rows: 0, added: 0, skipped: 0, bad: 0, from, to });
  return draft;
}
/** An import entry markQuiet wrote: days marked as checked with nothing on them. */
export const isQuietImport = (im) => !!im && !im.fileName && !Number(im.rows) && !Number(im.added);

/**
 * compute(plan, { month, accountId, category, q, limit, offset, today }) -> {
 *   rows: [{ ...tx, categoryLabel, icon, accountName, transfer }] (newest first, then largest),
 *   shown, matched, total (all transactions), in, out, net (over the matched set, transfers excluded, by the Income
 *   statement's rule: a line whose category is an income kind is money in even when negative, any other is money out, so a
 *   refund filed under groceries takes money out down; plus, with no category filter, the stand-in lines of cards whose own
 *   file is missing that match the month, account (the card) and search: allUnimportedCardLines, re-check 4 2026-11-02, so
 *   the Ledger, the Income statement and the Annual review give the same money out), cardsOut (that stand-in part of out;
 *   cardsOutNames the cards it went to),
 *   months: [{ ym, label, count }] newest first, accounts: [{ id, name, count }],
 *   uncategorised (matched set), uncategorisedAll, hasMore
 * }
 * Filters: month "YYYY-MM" ("" = all), accountId, category ("" = any, "none" = uncategorised), q (payee/note text),
 * dir ("" = both, "out" = amount < 0, "in" = amount > 0; a spending page's link counts money out only, review N3).
 * matchedIn / matchedOut: how many matched lines are money in (amount > 0) / money out (amount < 0); a $0.00 line is neither.
 * A split purchase (gap #24) is one row (`splitLabel` names its parts); it matches a category when one of its parts is in
 * it, and then only that part counts in `in` / `out`. With no category picked it counts whole: the parts add up to it.
 * Search also reads tags: "#trip" finds the lines tagged trip; plain words look in payee, note and tags.
 * Gap #32: a line left out of the totals (leftOut: to be paid back, the money back, left out of reports) stays in the list
 * and in `matched`, and is in neither `in` nor `out`; `leftOut` says how many of the matched lines are (the key is absent
 * with none). A row carries `mark` ("to be paid back", "paid back", "money back", "left out") and `refundLabel` when set.
 * `only: "left"` lists just those lines (the totals' "2 not counted" link); a line is left out as leftOutIn reads it.
 */
export function compute(plan, params = {}) {
  const { month = "", accountId = "", category = "", q = "", dir = "", only = "", limit = 100, offset = 0, today = null } = params;
  const all = plan.transactions ?? [];
  const isOut = leftOutIn(all);
  const accounts = plan.accounts ?? [];
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? "Unknown account";
  const qq = String(q).trim().toLowerCase();
  // a split purchase is in a category when one of its parts is, and its totals there are that part's (gap #24)
  const transfer = all.some((t) => t?.splits) ? transferTest(plan) : null;
  const partsOf = (t) => (transfer && t.splits && !transfer(t) ? partsIn(t) : [t]);
  const inCat = (l) => (category === "none" ? !l.category : l.category === category);
  const matched = all.filter((t) => (!month || monthOf(t.date) === month) && (!accountId || t.accountId === accountId)
    && (!category || (t.splits ? partsOf(t).some(inCat) : inCat(t)))
    && (dir !== "out" || Number(t.amount) < 0) && (dir !== "in" || Number(t.amount) > 0) && (only !== "left" || isOut(t))
    && (!qq || String(t.payee ?? "").toLowerCase().includes(qq) || String(t.rawPayee ?? "").toLowerCase().includes(qq) || String(t.note ?? "").toLowerCase().includes(qq) || tagHit(t, qq)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)));
  let inn = 0, out = 0, cardsOut = 0;
  const outCards = new Set();
  let outN = 0, ids = null;
  const byId = () => (ids ??= new Map(all.map((t) => [t.id, t])));
  for (const whole of matched) {
    if (isOut(whole)) { outN++; continue; }   // to be paid back, the money back, or left out of reports (gap #32)
    if (isTransfer(whole, plan)) continue;
    for (const t of partsOf(whole)) {
      if (category && whole.splits && !inCat(t)) continue;
      const a = Number(t.amount) || 0, kind = categoryById(plan, t.category)?.kind ?? (a >= 0 ? "income" : "expense");
      if (kind === "income") inn += a; else out += -a;
    }
  }
  if (!category) for (const t of allUnimportedCardLines(plan, { today })) {
    if ((month && monthOf(t.date) !== month) || (accountId && t.accountId !== accountId) || (qq && !String(t.payee).toLowerCase().includes(qq))) continue;
    out += -(Number(t.amount) || 0); cardsOut += -(Number(t.amount) || 0); outCards.add(t.cardId);
  }
  const monthMap = new Map();
  for (const t of all) { const ym = monthOf(t.date); monthMap.set(ym, (monthMap.get(ym) ?? 0) + 1); }
  const months = [...monthMap.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([ym, count]) => ({ ym, label: monthLabel(ym), count }));
  const acctMap = new Map();
  for (const t of all) acctMap.set(t.accountId, (acctMap.get(t.accountId) ?? 0) + 1);
  const rows = matched.slice(offset, offset + limit).map((t) => {
    const row = { ...t, categoryLabel: categoryLabel(plan, t.category), icon: categoryIcon(plan, t.category), accountName: name(t.accountId), transfer: isTransfer(t, plan) };
    const parts = t.splits ? partsOf(t) : null;
    // a split purchase names its parts ("Household + Groceries"; three or more: "Household + 2 more")
    if (parts && parts.length > 1) { const names = parts.map((l) => categoryLabel(plan, l.category)); row.splitLabel = names.length > 2 ? `${names[0]} + ${names.length - 1} more` : names.join(" + "); }
    // gap #32: what a row says about its mark; the keys are there only when a mark is set
    if (isOut(t)) row.mark = markPill(t, typeof t.reimb === "string" ? byId().get(t.reimb) ?? null : null);
    if (t.refundOf && Number(t.amount) >= 0) { const of = byId().get(t.refundOf); if (of) row.refundLabel = `refund of ${of.payee || "a purchase"}, ${shortDate(String(of.date).slice(0, 10))}`; }
    return row;
  });
  return {
    ...(outN ? { leftOut: outN } : {}),
    rows, shown: rows.length, matched: matched.length, matchedIn: matched.filter((t) => Number(t.amount) > 0).length, matchedOut: matched.filter((t) => Number(t.amount) < 0).length, total: all.length, in: inn, out, net: inn - out, cardsOut, cardsOutNames: [...outCards].map((id) => name(id)),
    months, accounts: [...acctMap.entries()].map(([id, count]) => ({ id, name: name(id), count })).sort((a, b) => b.count - a.count),
    // a line left out of the totals waits for no category (gap #32)
    uncategorised: matched.filter((t) => !t.category && !isOut(t)).length, uncategorisedAll: all.filter((t) => !t.category && !isOut(t)).length,
    hasMore: offset + limit < matched.length,
  };
}
