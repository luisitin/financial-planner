// modules/transactions/rules/compute.js -- PURE. A rule says: when the payee contains this
// text (and optionally: only in this account, only money in / only money out), give the
// transaction this category and, if you like, a cleaner payee name. Rules run on import,
// on demand from the Rules page, and are created by the Categorise page when you confirm a
// payee. Rule shape (plan.rules):
//   { id, contains, accountId?, direction?: "in"|"out"|"any", category, payee?, tag?, hits, createdAt }
// `tag` (gap #24, 2026-11-14): the rule also adds this tag to each line it files ("trip"; kept lower case, no "#").
// Gap next-60 #42 (2026-11-15), every field optional and read with a default, so a rule saved before does what it did:
//   match?: "starts" | "exact" (absent: contains), amount?: { is: "exactly"|"atLeast"|"atMost"|"between", value, to? },
//   anyOf?: [text] (more texts, matched the same way), tags?: [tag] (more tags after `tag`), and no `category` at all for a
//   rule that only renames or tags (a merge of payee names): the rules under it are still tried for the category.
import { categoryLabel } from "../categories/compute.js";
import { cleanTags, splitsOf } from "../splits.js";
import { money as fmtMoney } from "../../../core/format.js";

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
// ---------------------------------------------------------------- does a rule fit a line (gap next-60 #42)
/** The ways a rule's words can be matched; absent is "contains", as every rule saved before 2026-11-15. */
export const MATCH_KINDS = ["contains", "starts", "exact"];
/** The ways a rule can ask about the amount: the size of the line, money in or out alike (`direction` says which). */
export const AMOUNT_KINDS = ["exactly", "atLeast", "atMost", "between"];
const cents = (x) => Math.round(Math.abs(Number(x)) * 100);
/**
 * Does the amount of a line fit the rule's amount condition? `cond` absent or null: any amount. In cents, the size of the
 * line: exactly c = v; at least c >= v; at most c <= v; between min(v, to) <= c <= max(v, to). A condition this version
 * cannot read (an unknown kind, a value that is not a number) fits no line: a rule never files by a condition it cannot read.
 */
export function amountFits(cond, amount) {
  if (cond === undefined || cond === null) return true;
  if (typeof cond !== "object" || !AMOUNT_KINDS.includes(cond.is)) return false;
  const v = Number(cond.value), c = cents(amount);
  if (!Number.isFinite(v) || !Number.isFinite(c) || String(cond.value ?? "").trim() === "") return false;
  const lo = cents(v);
  if (cond.is === "exactly") return c === lo;
  if (cond.is === "atLeast") return c >= lo;
  if (cond.is === "atMost") return c <= lo;
  const t = Number(cond.to);
  if (!Number.isFinite(t) || String(cond.to ?? "").trim() === "") return false;
  const hi = cents(t);
  return c >= Math.min(lo, hi) && c <= Math.max(lo, hi);
}
/** One of a rule's texts against a line, by the rule's match kind. Contains is the code as it was (whole words for a rule
 * made from a bank line, any part for a typed one). Starts and exact read the line's two texts, payeeWords of the bank's text
 * and of the name shown (capitals, store numbers, card codes, dates and punctuation never count), and an empty text never fits. */
export function textFits(rule, text, tx) {
  const kind = rule.match ?? "contains";
  if (kind === "contains") {
    const hay = normalizePayee(tx.rawPayee ?? tx.payee) + " " + normalizePayee(tx.payee) + " | " + payeeWords(tx.rawPayee ?? tx.payee);
    // rules made from a bank line (Categorise) match whole words, so "shell" never files "ZELLE TO SHELLEY"; typed rules match any part
    if (rule.wholeWords) { const w = payeeWords(text); return !!w && ` ${hay.replace(/ \| /g, "  ")} `.includes(` ${w} `); }
    return hay.includes(normalizePayee(text));
  }
  if (kind !== "starts" && kind !== "exact") return false;   // a kind this version cannot read fits no line
  const w = payeeWords(text);
  if (!w) return false;
  return [payeeWords(tx.rawPayee ?? tx.payee), payeeWords(tx.payee)].some((c) => (kind === "exact" ? c === w
    : rule.wholeWords ? c === w || c.startsWith(`${w} `) : c.startsWith(w)));
}
/** A rule's other texts (a merge's other spellings), matched the same way as `contains`. */
export const alsoTexts = (rule) => (Array.isArray(rule?.anyOf) ? rule.anyOf.filter((x) => typeof x === "string" && x.trim()) : []);
/** Every condition of a rule against a line: the account, money in or out, the amount, then its words. */
export function fitsRule(rule, tx) {
  if (!rule || !rule.contains) return false;
  if (rule.accountId && rule.accountId !== tx.accountId) return false;
  const amt = Number(tx.amount) || 0;
  if (rule.direction === "in" && amt < 0) return false;
  if (rule.direction === "out" && amt > 0) return false;
  if (!amountFits(rule.amount, tx.amount)) return false;
  return textFits(rule, rule.contains, tx) || alsoTexts(rule).some((x) => textFits(rule, x, tx));
}
/** A rule files (gives a category) unless it has no `category` at all: then it only renames or tags. */
export const ruleFiles = (rule) => !!rule && rule.category !== undefined;
/** Would this rule file this line? (Categorise and the AI categorizer ask it.) The same as before for every rule with a
 * category; a rule that only renames files nothing. */
export const matchRule = (rule, tx) => ruleFiles(rule) && fitsRule(rule, tx);
/** The tags a rule adds: `tag` (its first piece, as before) then each of `tags`, cleaned, once each. */
export function ruleTags(rule) {
  const first = rule?.tag ? cleanTags([rule.tag])[0] : null;
  const out = first ? [first] : [];
  for (const t of cleanTags(Array.isArray(rule?.tags) ? rule.tags : [])) if (!out.includes(t)) out.push(t);
  return out;
}
/**
 * Apply rules to transactions. Returns { txs, changed, hits: { [ruleId]: n } }. The rules are tried from the top. A rule
 * that fits and gives a category files the line and no rule after it is tried (first match wins); a rule with `payee` also
 * renames the line (the raw text stays in rawPayee) and one with tags adds them (cleanTags; never twice). A rule with no
 * category (it only renames or tags: a merge) does its part and the rules under it are still tried; its name beats a later
 * rule's. Lines already categorised are left to the rename-only rules unless `force`. With no rename-only rule this is
 * exactly what it was: the first fitting rule, on uncategorised lines only.
 * A purchase split across categories keeps its parts and its category even under `force` (the pages that total by
 * category read the parts, so a new category on the whole would change nothing): the rule can still rename it or tag it,
 * and it counts as changed, and as a hit, only when it did.
 */
export function applyRules(rules, txs, { force = false } = {}) {
  const hits = {}; let changed = 0;
  const list = rules ?? [];
  const named = list.some((x) => !!x && !ruleFiles(x));
  const out = txs.map((t) => {
    const filed = !!t.category && !force;
    if (filed && !named) return t;
    // the walk: rename-only rules above the filing one give the name and add tags; the first filing rule ends it
    let r = null, name = null, nameBy = null;
    const adds = [], tagBy = [];
    for (const x of list) {
      if (ruleFiles(x)) { if (filed || !fitsRule(x, t)) continue; r = x; break; }
      if (!fitsRule(x, t)) continue;
      if (!name && x.payee) { name = x.payee; nameBy = x; }
      const before = adds.length;
      for (const g of ruleTags(x)) if (!adds.includes(g)) adds.push(g);
      if (adds.length > before) tagBy.push(x);
    }
    if (!r && !nameBy && !tagBy.length) return t;
    const split = !!t.splits && !!splitsOf(t);
    const next = r ? { ...t, category: split ? t.category : r.category, rawPayee: t.rawPayee ?? t.payee } : { ...t, rawPayee: t.rawPayee ?? t.payee };
    const nm = name ?? (r?.payee || null);
    if (nm) next.payee = nm;
    // "then add the tag" (gap #24): the rules' tags join the line's own, once
    if (r) for (const g of ruleTags(r)) if (!adds.includes(g)) adds.push(g);
    const had = Array.isArray(t.tags) ? t.tags : [];
    const fresh = adds.filter((g) => !cleanTags(had).includes(g));
    const tagged = fresh.length > 0;
    if (tagged) next.tags = [...had, ...fresh];
    const did = next.category !== t.category || next.payee !== t.payee || tagged;
    if (!r) {
      if (!did) return t;
      if (nameBy && next.payee !== t.payee) hits[nameBy.id] = (hits[nameBy.id] ?? 0) + 1;
      for (const x of tagBy) if (x !== nameBy && ruleTags(x).some((g) => fresh.includes(g))) hits[x.id] = (hits[x.id] ?? 0) + 1;
      changed++;
      return next;
    }
    if (split && !did) return t;
    hits[r.id] = (hits[r.id] ?? 0) + 1;
    if (nameBy && next.payee !== t.payee) hits[nameBy.id] = (hits[nameBy.id] ?? 0) + 1;
    for (const x of tagBy) if (x !== nameBy && ruleTags(x).some((g) => fresh.includes(g))) hits[x.id] = (hits[x.id] ?? 0) + 1;
    if (did) changed++;
    return next;
  });
  return { txs: out, changed, hits };
}
/**
 * The Rules page's "File N uncategorized transactions now": the rules over the lines with no category, and only the lines
 * a rule files are changed (a rule that only renames or tags does its part on those, as on import). A line no rule files,
 * and every line already filed, is left exactly as it is, so the button never renames a filed line, a name typed by hand
 * among them, without saying so (critic F2, 2026-11-15). A line counts as filed when the filing rules alone change it,
 * the very count `compute().wouldFix` shows on the button. With no rule that only renames or tags this is applyRules
 * itself, byte for byte (what the button ran before). -> { txs, changed, hits }
 */
export function fileOpen(rules, txs) {
  const list = rules ?? [], all = txs ?? [];
  if (!list.some((x) => !!x && !ruleFiles(x))) return applyRules(list, all);
  const filing = list.filter((x) => !x || ruleFiles(x));
  const files = all.filter((t) => !t.category && applyRules(filing, [t]).changed > 0);
  const r = applyRules(list, files);
  const by = new Map(files.map((t, i) => [t, r.txs[i]]));
  return { txs: all.map((t) => by.get(t) ?? t), changed: r.changed, hits: r.hits };
}
/** The rules with one moved a place up (by = -1) or down (by = +1): a new array; the same array when it cannot move. */
export function moveRule(rules, id, by) {
  const list = rules ?? [];
  const i = list.findIndex((r) => r?.id === id), j = i + Math.sign(by);
  if (i < 0 || j < 0 || j >= list.length || !by) return list;
  const out = list.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
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

// ---------------------------------------------------------------- the words the page says (gap next-60 #42; one per case, each tested)
/** A rule's dollar figure: cents only when it has them ("$15.49", "$100"). */
export const ruleMoney = (n) => fmtMoney(Math.abs(Number(n)), "USD", "en-US", Math.round(Math.abs(Number(n)) * 100) % 100 ? 2 : 0);
/** The amount condition in words for a rule's row: "exactly $15.49", "$100 or more", "$20 or less", "$10 to $20"; "" for
 * any amount; "an amount to fix" for one this version cannot read. */
export function amountWords(cond) {
  if (cond === undefined || cond === null) return "";
  if (typeof cond !== "object" || !AMOUNT_KINDS.includes(cond.is) || !Number.isFinite(Number(cond.value)) || String(cond.value ?? "").trim() === "") return "an amount to fix";
  const v = ruleMoney(cond.value);
  if (cond.is === "exactly") return `exactly ${v}`;
  if (cond.is === "atLeast") return `${v} or more`;
  if (cond.is === "atMost") return `${v} or less`;
  if (!Number.isFinite(Number(cond.to)) || String(cond.to ?? "").trim() === "") return "an amount to fix";
  const [a, b] = [Math.abs(Number(cond.value)), Math.abs(Number(cond.to))].sort((x, y) => x - y);
  return `${ruleMoney(a)} to ${ruleMoney(b)}`;
}
/** "a", "a and b", "a, b and c". */
export const andList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** A rule's words for its row title, before the arrow: "\"kroger\"" (contains, as before), "starts with \"amzn\"",
 * "exactly \"sq coffee\" or \"coffee\"". */
export function whenWords(rule) {
  const texts = [rule?.contains ?? "", ...alsoTexts(rule)].map((x) => `"${x}"`);
  const kind = rule?.match ?? "contains";
  const said = texts.length > 1 ? `${texts.slice(0, -1).join(", ")} or ${texts[texts.length - 1]}` : texts[0];
  return kind === "starts" ? `starts with ${said}` : kind === "exact" ? `exactly ${said}` : said;
}
/** The green line after a rule is saved, one per case: "Rule added." when it files and adds no tag (as before), the tag
 * sentence as before, and for a rule that files nothing, what it does and that the category is left to the other rules. */
export function savedWords({ added = true, files = true, name = "", tags = [] } = {}) {
  const head = added ? "Rule added." : "Rule saved.";
  const t = andList(tags.map((x) => `#${x}`));
  if (files) return tags.length ? `${head} It adds ${t} to each line it files from now on.` : head;
  if (name && tags.length) return `${head} It shows each line it fits as ${name} and adds ${t}; your other rules still pick the category.`;
  if (name) return `${head} It shows each line it fits as ${name}; your other rules still pick the category.`;
  return `${head} It adds ${t} to each line it fits; your other rules still pick the category.`;
}
/** The red lines a save can get, at the box they are about. (An amount typed under "Any amount" needs none: its box is
 * hidden then and not read.) */
export const REFUSED = {
  nothing: "Pick a category, a name to show or a tag: a rule needs something to do.",
  noAmount: "Type the amount, or pick “Any amount”.",
  noTo: "Type the second amount for “Between”.",
};
/** The green line after Move up or Move down: `at` is the rule's new place (0 = first) of `n` rules. */
export function movedWords(by, at, n) {
  if (by < 0) return at === 0 ? "Moved up. It is now the first rule, tried before all the others." : `Moved up. It is now rule ${at + 1} of ${n}.`;
  return at === n - 1 ? "Moved down. It is now the last rule, tried after all the others." : `Moved down. It is now rule ${at + 1} of ${n}.`;
}
/** The plain line over two rules or more; the second sentence only while a rule that only renames is on file. */
export const orderWords = (renames) => `Rules are tried from the top. The first one that fits a line files it.${renames ? " A rule that only renames, like a merge, lets the rules under it file the line." : ""}`;

/** compute(plan) -> { rules: [{ ...rule, categoryLabel, matches (over current transactions) }], count, uncategorised, wouldFix } */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  const rules = (plan.rules ?? []).map((r) => ({ ...r, categoryLabel: categoryLabel(plan, r.category), matches: txs.filter((t) => fitsRule(r, t)).length }));
  const uncategorised = txs.filter((t) => !t.category);
  const wouldFix = applyRules((plan.rules ?? []).filter((r) => !r || ruleFiles(r)), uncategorised).changed;   // what the rules would file (a rename alone is not filing)
  return { rules, count: rules.length, uncategorised: uncategorised.length, wouldFix, total: txs.length };
}
