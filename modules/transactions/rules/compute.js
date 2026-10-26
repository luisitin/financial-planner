// modules/transactions/rules/compute.js -- PURE. A rule says: when the payee contains this
// text (and optionally: only in this account, only money in / only money out), give the
// transaction this category and, if you like, a cleaner payee name. Rules run on import,
// on demand from the Rules page, and are created by the Categorise page when you confirm a
// payee. Rule shape (plan.rules):
//   { id, contains, accountId?, direction?: "in"|"out"|"any", category, payee?, hits, createdAt }
import { categoryLabel } from "../categories/compute.js";

/** Lowercase, drop card-statement noise (numbers, dates, store codes, extra spaces) so "AMAZON MKTPL*2K3 09/01" and "Amazon Mktpl" compare equal. */
export function normalizePayee(s) {
  return String(s ?? "").toLowerCase()
    .replace(/\.(com|net|org|co|io)(\/\S*)?/g, " ")            // netflix.com, amzn.com/bill -> netflix, amzn
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ")     // dates inside descriptions
    .replace(/[#*][\w-]+/g, " ")                              // *2K3, #1234 store codes
    .replace(/\b(pos|debit|credit|purchase|payment|ach|web|online|recurring|autopay|card|visa|mastercard|chk|ref|id|txn|trans|des|pending|ppd|ccd|authorized|authorised|checkcard|conf|confirmation|indn|co)\b/g, " ")
    .replace(/\b[a-z]*\d[\w-]*\b/g, " ")                      // tokens with digits
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}
/** A short, capitalised payee name from a raw bank description ("AMAZON MKTPL*2K3 AMZN.COM/BILL WA" -> "Amazon Mktpl"). */
export function prettyPayee(raw) {
  const n = normalizePayee(raw).split(" ").filter((w) => w.length > 2).slice(0, 3);   // drops "to", "wa", "ca"
  return n.length ? n.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") : String(raw ?? "").trim();
}
export function matchRule(rule, tx) {
  if (!rule || !rule.contains) return false;
  if (rule.accountId && rule.accountId !== tx.accountId) return false;
  const amt = Number(tx.amount) || 0;
  if (rule.direction === "in" && amt < 0) return false;
  if (rule.direction === "out" && amt > 0) return false;
  const hay = normalizePayee(tx.rawPayee ?? tx.payee) + " " + normalizePayee(tx.payee);
  return hay.includes(normalizePayee(rule.contains));
}
/**
 * Apply rules to transactions. Returns { txs, changed, hits: { [ruleId]: n } }. Uncategorised
 * transactions get the first matching rule's category; already-categorised ones are left alone
 * unless `force`. A rule with `payee` also renames the payee (the raw text stays in rawPayee).
 */
export function applyRules(rules, txs, { force = false } = {}) {
  const hits = {}; let changed = 0;
  const out = txs.map((t) => {
    if (t.category && !force) return t;
    const r = (rules ?? []).find((x) => matchRule(x, t));
    if (!r) return t;
    hits[r.id] = (hits[r.id] ?? 0) + 1;
    const next = { ...t, category: r.category, rawPayee: t.rawPayee ?? t.payee };
    if (r.payee) next.payee = r.payee;
    if (next.category !== t.category || next.payee !== t.payee) changed++;
    return next;
  });
  return { txs: out, changed, hits };
}
/** The rule the Categorise page creates when a payee is confirmed. */
export const ruleFor = (rawPayee, category, extra = {}) => ({ contains: normalizePayee(rawPayee).split(" ").slice(0, 3).join(" "), category, payee: prettyPayee(rawPayee), direction: "any", hits: 0, ...extra });

/** compute(plan) -> { rules: [{ ...rule, categoryLabel, matches (over current transactions) }], count, uncategorised, wouldFix } */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  const rules = (plan.rules ?? []).map((r) => ({ ...r, categoryLabel: categoryLabel(plan, r.category), matches: txs.filter((t) => matchRule(r, t)).length }));
  const uncategorised = txs.filter((t) => !t.category);
  const wouldFix = applyRules(plan.rules ?? [], uncategorised).changed;
  return { rules, count: rules.length, uncategorised: uncategorised.length, wouldFix, total: txs.length };
}
