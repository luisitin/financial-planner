// modules/transactions/splits.js -- PURE, imports nothing. A purchase split across categories, and tags (gap #24,
// 2026-11-14). The pieces every transaction page shares; modules/transactions/ledger/compute.js exports them again next to
// allLines(plan), makeSplit and the words (it knows the plan's categories; this file does not, so the Categories page's
// compute can read it without a circle).
//   transactions[].splits?: [{ category, amount }]   amounts signed as the purchase, adding up to it to the cent
//   transactions[].tags: ["trip", "kids"]            lower case, no "#"
export const centsOf = (x) => Math.round((Number(x) || 0) * 100);
/**
 * splitsOf(t) -> t.splits when they can be used, else null (the purchase then counts whole, under its own category).
 * Usable: two or more parts, each with an amount that is not zero and goes the same way as the purchase, adding up to the
 * purchase to the cent; never for a transfer between your own accounts (a linked pair, or the "transfer" category).
 */
export function splitsOf(t) {
  const s = t?.splits;
  if (!Array.isArray(s) || s.length < 2 || t.transferId || t.category === "transfer") return null;
  const total = centsOf(t.amount);
  if (!total) return null;
  let sum = 0;
  for (const p of s) { const c = centsOf(p?.amount); if (!c || Math.sign(c) !== Math.sign(total)) return null; sum += c; }
  return sum === total ? s : null;
}
/**
 * linesOf(t) -> the lines a page that totals by category counts for one transaction: the transaction itself, or one line per
 * part of a split purchase ({ ...t, category, amount, splitOf: t.id, splitIndex }, without `splits`, so a line never
 * splits again). Sum of the lines' amounts = t.amount, always (splitsOf).
 */
export function linesOf(t) {
  const s = splitsOf(t);
  if (!s) return [t];
  const { splits, ...whole } = t;
  return s.map((p, i) => ({ ...whole, category: p.category ?? "", amount: centsOf(p.amount) / 100, splitOf: t.id, splitIndex: i }));
}
/**
 * countOnce() -> (line) => 1 the first time a purchase is met, 0 for every other part of it. A list of lines that was
 * filtered (only the spending parts, only one category) may have lost a purchase's first part, so the count goes by the
 * purchase (`splitOf`, its id), never by which part came first: a purchase with any part kept counts once.
 */
export function countOnce() {
  const seen = new Set();
  return (t) => {
    if (t?.splitIndex === undefined) return 1;
    const k = t.splitOf ?? `${t.key ?? ""}|${t.date}|${t.accountId}|${t.payee}`;
    if (seen.has(k)) return 0;
    seen.add(k); return 1;
  };
}
/** How many whole transactions a list of lines holds: the parts of one split purchase count once (countOnce). */
export const wholeCount = (lines) => { const one = countOnce(); return lines.reduce((n, t) => n + one(t), 0); };
/** The category a split purchase carries for a page that reads whole transactions: its biggest part's (the last of equals,
 * the one that took the rest). */
export function mainCategory(splits) {
  let best = null;
  for (const p of splits ?? []) if (!best || Math.abs(centsOf(p.amount)) >= Math.abs(centsOf(best.amount))) best = p;
  return best?.category ?? "";
}
/**
 * cleanTags(text or list) -> tags as they are kept: lower case, no "#", no doubles, in the order typed. Typed with commas
 * ("trip, kids") or as "#trip #kids"; a tag may hold spaces ("summer trip") when commas separate. A list is read the same
 * way, entry by entry, so "x, y" kept as one entry is two tags.
 */
export function cleanTags(x) {
  const pieces = (Array.isArray(x) ? x : [x]).flatMap((p) => String(p ?? "").split(/,|\s+(?=#)/));
  const out = [];
  for (const p of pieces) { const tag = String(p ?? "").replace(/#/g, " ").replace(/\s+/g, " ").trim().toLowerCase(); if (tag && !out.includes(tag)) out.push(tag); }
  return out;
}
/** A transaction's tags, cleaned (rows typed before 2026-11-14 kept them as typed). */
export const tagsOf = (t) => (Array.isArray(t?.tags) && t.tags.length ? cleanTags(t.tags) : []);
