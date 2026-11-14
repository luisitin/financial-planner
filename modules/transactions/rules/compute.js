// modules/transactions/rules/compute.js -- PURE. A rule says: when the payee contains this
// text (and optionally: only in this account, only money in / only money out), give the
// transaction this category and, if you like, a cleaner payee name. Rules run on import,
// on demand from the Rules page, and are created by the Categorise page when you confirm a
// payee. Rule shape (plan.rules):
//   { id, contains, accountId?, direction?: "in"|"out"|"any", category, payee?, tag?, hits, createdAt }
// `tag` (gap #24, 2026-11-14): the rule also adds this tag to each line it files ("trip"; kept lower case, no "#").
import { categoryLabel } from "../categories/compute.js";
import { cleanTags, splitsOf } from "../splits.js";

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
/** normalizePayee keeping the shop after a payment service's star: "PAYPAL *NETFLIX" -> "paypal netflix" (normalizePayee gives
 * "paypal", which put every PayPal shop in one rule); "AMAZON MKTPL*2K3" -> "amazon mktpl" as before (the code has digits). */
export const payeeWords = (s) => normalizePayee(String(s ?? "").replace(/\*/g, " "));
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
  const hay = normalizePayee(tx.rawPayee ?? tx.payee) + " " + normalizePayee(tx.payee) + " | " + payeeWords(tx.rawPayee ?? tx.payee);
  // rules made from a bank line (Categorise) match whole words, so "shell" never files "ZELLE TO SHELLEY"; typed rules match any part
  if (rule.wholeWords) { const w = payeeWords(rule.contains); return !!w && ` ${hay.replace(/ \| /g, "  ")} `.includes(` ${w} `); }
  return hay.includes(normalizePayee(rule.contains));
}
/**
 * Apply rules to transactions. Returns { txs, changed, hits: { [ruleId]: n } }. Uncategorised
 * transactions get the first matching rule's category; already-categorised ones are left alone
 * unless `force`. A rule with `payee` also renames the payee (the raw text stays in rawPayee); a rule with `tag` also adds
 * that tag to the line (cleanTags; never twice). A rule without a tag does what it always did.
 * A purchase split across categories keeps its parts and its category even under `force` (the pages that total by
 * category read the parts, so a new category on the whole would change nothing): the rule can still rename it or tag it,
 * and it counts as changed, and as a hit, only when it did.
 */
export function applyRules(rules, txs, { force = false } = {}) {
  const hits = {}; let changed = 0;
  const out = txs.map((t) => {
    if (t.category && !force) return t;
    const r = (rules ?? []).find((x) => matchRule(x, t));
    if (!r) return t;
    const split = !!t.splits && !!splitsOf(t);
    const next = { ...t, category: split ? t.category : r.category, rawPayee: t.rawPayee ?? t.payee };
    if (r.payee) next.payee = r.payee;
    // "then add the tag" (gap #24): the rule's tag joins the line's own, once
    const tag = r.tag ? cleanTags([r.tag])[0] : null, had = Array.isArray(t.tags) ? t.tags : [];
    const tagged = !!tag && !cleanTags(had).includes(tag);
    if (tagged) next.tags = [...had, tag];
    const did = next.category !== t.category || next.payee !== t.payee || tagged;
    if (split && !did) return t;
    hits[r.id] = (hits[r.id] ?? 0) + 1;
    if (did) changed++;
    return next;
  });
  return { txs: out, changed, hits };
}
/** The rule the Categorise page creates when a payee is confirmed. */
/** Two-letter US state and territory codes a bank adds after the city ("KROGER #0388 DAYTON OH"). */
const STATE_CODES = new Set("al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy pr vi gu".split(" "));
/** First words that say what kind of line it is, not who: a rule needs the words after them ("transfer to sav", "zelle to sam"). */
const GENERIC_FIRST = new Set(["transfer", "xfer", "deposit", "check", "withdrawal", "atm", "zelle", "venmo", "paypal", "cash", "square", "sq", "tst", "sp", "the", "bill", "interest", "fee", "service", "mobile", "external", "wire", "payroll", "direct"]);
/** Common first words shared by many unrelated names ("AMERICAN AIRLINES", "AMERICAN EXPRESS"): a rule keeps the second word too. */
const COMMON_FIRST = new Set(["american", "united", "first", "great", "family", "national", "state", "city", "county", "home", "golden", "north", "south", "east", "west", "central", "pacific", "atlantic", "royal", "best", "general", "capital", "citizens", "public", "global", "southern", "northern", "western", "eastern", "metro", "regional", "community", "premier", "union", "express", "super", "super", "smart", "green", "blue", "little", "grand", "olive", "olde"]);
/**
 * The words a rule keeps from a bank line: the shop's own name, without the store number, city and state that change from
 * one branch or card to the next. The line is cut at its first word with a digit or # (store numbers, codes; a star only
 * separates a payment service from the shop); a trailing state code is dropped; a line cut at a code keeps the words before it,
 * two at most; a line with a city and state but no code keeps a web address alone, or one long uncommon word, else two words;
 * otherwise up to three words as before. "KROGER #0388 DAYTON OH" -> "kroger" (it was "kroger dayton oh", which missed
 * "KROGER #0421" on the card's file); "SHELL OIL 57442" -> "shell oil"; "SOUTHWEST AIRLINES 52621" -> "southwest airlines"
 * (never "southwest", which would file Southwest Gas); "NETFLIX.COM LOS GATOS CA" -> "netflix". A first word that only says what
 * kind of line it is (transfer, zelle, payroll, paypal...) keeps the first three words of the line. Fewer than four letters left:
 * the first three words of the whole line, as before.
 */
export function ruleText(rawPayee) {
  const raw = String(rawPayee ?? "").replace(/\*/g, " ");   // a star separates a payment service from the shop ("PAYPAL *NETFLIX")
  const whole = payeeWords(raw).split(" ").filter(Boolean);
  const before = () => whole.slice(0, 3).join(" ");
  const tokens = raw.trim().split(/\s+/);
  const at = tokens.findIndex((t) => /[\d#]/.test(t));
  let words = normalizePayee((at === -1 ? tokens : tokens.slice(0, at)).join(" ")).split(" ").filter(Boolean);
  if (!words.length) return before();
  const state = words.length > 1 && STATE_CODES.has(words[words.length - 1]);
  if (state) words = words.slice(0, -1);
  if (GENERIC_FIRST.has(words[0])) return before();
  // cut at a store number or code: the words before it, two at most ("shell oil", "southwest airlines": one word would also file
  // Southwest Gas). No code but a city and state after the name: the name alone when it is a web address ("NETFLIX.COM LOS GATOS
  // CA" -> "netflix"), else two words. Otherwise up to three words, as before.
  const web = /\.(com|net|org|co|io)\b/i.test(tokens[0] ?? "");
  words = at !== -1 ? words.slice(0, 2) : state ? (web || (words[0].length >= 5 && !COMMON_FIRST.has(words[0]) && words.length === 1) ? words.slice(0, 1) : words.slice(0, 2)) : words.slice(0, 3);
  const text = words.join(" ");
  return text.replace(/\s/g, "").length >= 4 ? text : before();
}
/** The name a rule gives the payee: the words it matches on, capitalised ("Kroger", not "Kroger Dayton" for every branch), without a
 * card processor's prefix ("SQ *BLUE BOTTLE" -> "Blue Bottle", "PAYPAL *NETFLIX" -> "Netflix"); the old three-word name when the
 * line only says what kind of line it is ("ONLINE TRANSFER TO SAV" -> "Transfer Sav", as before). */
const PROCESSORS = new Set(["sq", "tst", "sp", "square", "paypal"]);
export function ruleName(rawPayee) {
  const words = ruleText(rawPayee).split(" ").filter(Boolean);
  if (PROCESSORS.has(words[0]) && words.length > 1) words.shift();
  else if (!words.length || GENERIC_FIRST.has(words[0])) return prettyPayee(rawPayee);   // "transfer to sav": the old name
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
export const ruleFor = (rawPayee, category, extra = {}) => ({ contains: ruleText(rawPayee), wholeWords: true, category, payee: ruleName(rawPayee), direction: "any", hits: 0, ...extra });

/** compute(plan) -> { rules: [{ ...rule, categoryLabel, matches (over current transactions) }], count, uncategorised, wouldFix } */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  const rules = (plan.rules ?? []).map((r) => ({ ...r, categoryLabel: categoryLabel(plan, r.category), matches: txs.filter((t) => matchRule(r, t)).length }));
  const uncategorised = txs.filter((t) => !t.category);
  const wouldFix = applyRules(plan.rules ?? [], uncategorised).changed;
  return { rules, count: rules.length, uncategorised: uncategorised.length, wouldFix, total: txs.length };
}
