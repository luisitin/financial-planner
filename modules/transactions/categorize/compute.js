// modules/transactions/categorize/compute.js -- PURE. The review queue: uncategorised
// transactions grouped by payee, most frequent first, each with the best guess the plan can
// make on its own (a rule, or what the same payee got last time). Also the prompt for the
// optional AI suggestion, kept here so it is testable and visible. The model only ever sees
// payee names and the category list, never amounts, dates or account names.
import { normalizePayee, payeeWords, matchRule } from "../rules/compute.js";
import { categoriesOf, categoryLabel } from "../categories/compute.js";
import { isCardAccount, flagged, leftOutIn } from "../ledger/compute.js";

/**
 * Well-known shops and billers, so a first bank file is not every payee picked by hand: the word in the bank line (matched on
 * whole words of the normalised line) and the category it usually is. A guess only: the page says "usual for this kind of
 * shop" and the person confirms it. Kept short and unambiguous on purpose (no Target or Amazon, which sell everything).
 */
export const SHOPS = [
  [["kroger", "safeway", "publix", "aldi", "wegmans", "albertsons", "heb", "meijer", "trader joe", "whole foods", "food lion", "giant eagle", "sprouts", "winco", "hy vee", "stop shop", "piggly wiggly", "harris teeter", "fry s food", "ralphs", "vons", "jewel osco", "shoprite"], "groceries"],
  [["shell", "chevron", "exxon", "exxonmobil", "mobil", "bp", "sunoco", "speedway", "valero", "citgo", "arco", "wawa", "sheetz", "circle k", "quiktrip", "racetrac", "phillips 66", "texaco", "uber trip", "lyft"], "transport"],
  [["netflix", "spotify", "hulu", "disney plus", "disneyplus", "hbo", "hbomax", "peacock", "paramount plus", "audible", "youtube premium", "apple music", "siriusxm", "patreon", "dropbox", "icloud", "adobe"], "subscriptions"],
  [["starbucks", "mcdonald s", "mcdonalds", "chipotle", "subway", "dunkin", "panera", "chick fil", "taco bell", "wendy s", "burger king", "domino s", "pizza hut", "doordash", "grubhub", "ubereats", "uber eats"], "dining"],
  [["comcast", "xfinity", "spectrum internet", "spectrum mobile", "charter spectrum", "verizon", "t mobile", "tmobile", "at t", "cox comm", "frontier comm"], "phone"],
  [["duke energy", "pg e", "con ed", "coned", "dominion energy", "xcel energy", "georgia power", "fpl", "water dept", "city utilities"], "utilities"],
  [["geico", "state farm", "progressive ins", "allstate", "liberty mutual", "usaa ins", "farmers ins", "nationwide ins"], "insurance"],
  [["cvs", "walgreens", "rite aid"], "health"],
];
/** The category a well-known shop's bank line usually is, or null (whole words only: "shell" is not "shelley"). */
// every name, longest first across the kinds, so "uber eats" (eating out) is tried before a shorter name inside it
const SHOP_WORDS = SHOPS.flatMap(([words, category]) => words.map((w) => [w, category])).sort((a, b) => b[0].length - a[0].length);
export function shopGuess(raw) {
  const line = ` ${payeeWords(raw)} `;
  for (const [w, category] of SHOP_WORDS) if (line.includes(` ${w} `)) return category;
  return null;
}
/**
 * Money moved to your own savings, or a card's payment from checking: a transfer, but only when the plan has such an account.
 * `onCard`: the lines are on a card account; money in there with a payment's words ("AUTOMATIC PAYMENT - THANK", "PAYMENT
 * RECEIVED", "AUTOPAY") is that payment arriving, the other side of the checking line already filed as a transfer: left
 * unfiled it would count as income (2026-11-02). A shop's refund on the card ("AMAZON RETURN") has no such words.
 */
export function transferGuess(raw, plan, isIn, { onCard = false } = {}) {
  const t = String(raw ?? "").toLowerCase();
  const types = new Set((plan.accounts ?? []).map((a) => a.type));
  if (!isIn && types.has("savings") && /\btransfer\b.*\b(sav|savings)\b|\bto sav(ings)?\b/.test(t)) return true;
  // a card's payment ("CHASE CREDIT CRD AUTOPAY"), never a loan's ("CREDIT UNION LOAN PMT" is a loan payment, which is spending)
  if (!isIn && types.has("credit") && !/\b(loan|mortgage|union)\b/.test(t) && /\b(crd|card)\b.*\b(autopay|epay|payment|pmt)\b|\bpayment thank you\b/.test(t)) return true;
  if (isIn && onCard && !/\b(refund|return|reversal|cashback|cash back|reward|rewards|interest)\b/.test(t) && /\b(payment|pymt|pmt|autopay|epay|epayment)\b/.test(t)) return true;
  return false;
}

/**
 * compute(plan) -> {
 *   groups: [{ key, payee, rawPayee, count, total, ids: [txId], first, last, suggestion: { category, label, why } | null }],
 *   uncategorised, total, done (categorised count), share (done / total),
 *   flagged?: [{ id, date, payee, amount, note, accountId, categoryLabel, mark }]   the lines flagged to look at later (gap
 *     #32; ledger flagged), newest first; the key is absent when none is flagged
 * }
 */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  // a line left out of the totals (to be paid back, the money back, left out of reports: ledger leftOut, gap #32) waits for no category
  const isOut = leftOutIn(txs);
  const open = txs.filter((t) => !t.category && !isOut(t));
  const known = new Map();   // normalized payee -> { category, n } from categorised transactions
  for (const t of txs) {
    if (!t.category) continue;
    const k = payeeWords(t.rawPayee ?? t.payee);
    const e = known.get(k) ?? { counts: {} };
    e.counts[t.category] = (e.counts[t.category] ?? 0) + 1;
    known.set(k, e);
  }
  const groups = new Map();
  for (const t of open) {
    // the shop after a payment service's star is part of the payee: PAYPAL *NETFLIX and PAYPAL *EBAY are two payees
    const k = payeeWords(t.rawPayee ?? t.payee) || String(t.payee ?? "").toLowerCase();
    const g = groups.get(k) ?? { key: k, payee: t.payee, rawPayee: t.rawPayee ?? t.payee, count: 0, total: 0, ids: [], first: t.date, last: t.date };
    g.count++; g.total += Number(t.amount) || 0; g.ids.push(t.id);
    if (String(t.date) < String(g.first)) g.first = t.date;
    if (String(t.date) > String(g.last)) g.last = t.date;
    groups.set(k, g);
  }
  const rules = plan.rules ?? [];
  const txOf = new Map(open.map((t) => [t.id, t])), acctOf = new Map((plan.accounts ?? []).map((a) => [a.id, a]));
  const list = [...groups.values()].map((g) => {
    const sample = open.find((t) => t.id === g.ids[0]);
    const rule = rules.find((r) => matchRule(r, sample));
    let suggestion = null;
    if (rule) suggestion = { category: rule.category, label: categoryLabel(plan, rule.category), why: "a rule matches" };
    else if (known.has(g.key)) { const c = Object.entries(known.get(g.key).counts).sort((a, b) => b[1] - a[1])[0]; suggestion = { category: c[0], label: categoryLabel(plan, c[0]), why: `${c[1]} earlier ${c[1] === 1 ? "one was" : "were"} filed there` }; }
    // a guess from the line itself when nothing in the plan says: money moved between your own accounts, a well-known shop
    const onCard = g.ids.every((id) => isCardAccount(acctOf.get(txOf.get(id)?.accountId)));
    if (!suggestion && transferGuess(g.rawPayee, plan, g.total >= 0, { onCard })) suggestion = { category: "transfer", label: categoryLabel(plan, "transfer"), why: onCard && g.total >= 0 ? "it looks like a payment to the card from your other accounts" : "it looks like money moved between your own accounts", guess: true };
    if (!suggestion && g.total < 0) { const c = shopGuess(g.rawPayee); if (c) suggestion = { category: c, label: categoryLabel(plan, c), why: "usual for this kind of business", guess: true }; }
    return { ...g, suggestion, in: g.total >= 0 };
  }).sort((a, b) => b.count - a.count || Math.abs(b.total) - Math.abs(a.total));
  const flags = flagged(plan);
  return { ...(flags.length ? { flagged: flags } : {}), groups: list, uncategorised: open.length, total: txs.length, done: txs.length - open.length, share: txs.length ? (txs.length - open.length) / txs.length : 1 };
}

/** The status beside "Flagged to look at later": "1 line", "3 lines". */
export const flaggedSays = (n) => `${n} line${n === 1 ? "" : "s"}`;
/** The green line after a flag is taken off: "The flag is off Corner cafe, 11/3." */
export const unflagSaid = (f) => `The flag is off ${f?.payee || "that line"}${/^\d{4}-\d{2}-\d{2}/.test(String(f?.date ?? "")) ? `, ${Number(String(f.date).slice(5, 7))}/${Number(String(f.date).slice(8, 10))}` : ""}.`;
/** Where a flagged line opens: the Transactions page on its month, with that line's own form open (`?edit=<id>`). */
export const flaggedHref = (f) => `#/transactions/ledger${/^\d{4}-\d{2}/.test(String(f?.date ?? "")) ? `/month/${String(f.date).slice(0, 7)}` : "/all"}?edit=${encodeURIComponent(String(f?.id ?? ""))}`;
/** The AI prompt: payee names in, a JSON list of { payee, category } out. Pure so it can be tested and read. */
export function buildPrompt(plan, groups) {
  const cats = categoriesOf(plan).filter((c) => c.kind !== "transfer");
  const lines = groups.slice(0, 40).map((g) => `- ${g.rawPayee || g.payee}${g.in ? " (money in)" : ""}`);
  return {
    system: "You sort bank transaction descriptions into spending or income categories. Answer with JSON only: an array of objects {\"payee\": <the description exactly as given>, \"category\": <one id from the list>, \"confidence\": <0 to 1>}. Use \"other\" when unsure. No prose.",
    user: `Categories (id: meaning):\n${cats.map((c) => `${c.id}: ${c.label}`).join("\n")}\n\nDescriptions:\n${lines.join("\n")}`,
    max: Math.min(40, groups.length),
  };
}
/** Read the model's answer back into { payee -> { category, confidence } }; anything not in the category list is dropped. */
export function parseSuggestions(plan, text) {
  const ids = new Set(categoriesOf(plan).map((c) => c.id));
  const m = /\[[\s\S]*\]/.exec(String(text ?? ""));
  if (!m) return {};
  let arr; try { arr = JSON.parse(m[0]); } catch { return {}; }
  const out = {};
  for (const x of Array.isArray(arr) ? arr : []) if (x && typeof x.payee === "string" && ids.has(x.category)) out[payeeWords(x.payee)] = { category: x.category, confidence: Number(x.confidence) || 0.5 };
  return out;
}
