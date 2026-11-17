// modules/balance/net-worth/worked.js -- PURE. An account in another currency, a part share of an account, a trust as its
// owner (gap list, next 60, items 18 and 19; README "Another currency, a part share, a trust").
//
// `balance` keeps its meaning everywhere: the household's own share, in the plan's currency. About 70 files read it, and none
// of them changes. What the person typed is kept beside it, and the balance is worked out from it once, here:
//   accounts[].currency?     the account's own currency (a code of CURRENCIES; absent or the plan's own: nothing converted)
//   accounts[].share?        the household's share, 0 < share < 1 (absent: all of it)
//   accounts[].fullBalance?  the whole account's balance in its own currency, as typed (what is owed, for a debt)
//   accounts[].trust?        the name of the trust that owns it (saved with ownerId "": per-person pages count it as joint;
//                            never on a 401(k), an IRA, a Roth or an HSA: NO_TRUST_TYPES)
//   accounts[].ownerBeforeTrust?  whose it was before the trust was named (Net worth's form gives it back when the trust goes)
//   currencyRates?           { [code]: { rate, asOf } }: the plan's currency for one unit, one rate per currency, typed (a
//                            section of its own, not in meta: Undo takes back a rate with the balances it moved)
// balance = fullBalance x rate x share, to the cent. Every writer of a balance in Net worth's lane comes here: Net worth's
// form (writeTyped), Update my balances and a bank file (balance/accounts saveBalance with `own`), Account detail and Voice
// notes (saveBalance in dollars: the whole is then worked back from the balance) and a new rate (setRate). A balance written
// in dollars by any other page (Get started, the statement reader) is read the same way: `fullBalance` no longer in step,
// the whole is worked back from the balance (`typed: false`, said "about"). A plan without these fields reads as before.
import { isLiability, countedBalance } from "./compute.js";

/** The currencies an account can be in: a short list of the common ones (and the US dollar, for a plan kept in another). */
export const CURRENCIES = Object.freeze([
  { code: "EUR", one: "euro", many: "euros" },
  { code: "GBP", one: "British pound", many: "British pounds" },
  { code: "CAD", one: "Canadian dollar", many: "Canadian dollars" },
  { code: "MXN", one: "Mexican peso", many: "Mexican pesos" },
  { code: "JPY", one: "Japanese yen", many: "Japanese yen" },
  { code: "CHF", one: "Swiss franc", many: "Swiss francs" },
  { code: "AUD", one: "Australian dollar", many: "Australian dollars" },
  { code: "INR", one: "Indian rupee", many: "Indian rupees" },
  { code: "CNY", one: "Chinese yuan", many: "Chinese yuan" },
  { code: "USD", one: "US dollar", many: "US dollars" },
].map(Object.freeze));
/** The shares a person picks before typing their own: the value the form's choice saves, the fraction, and the words. */
export const SHARES = Object.freeze([
  { value: "1/2", share: 1 / 2, words: "half", label: "Half" },
  { value: "1/3", share: 1 / 3, words: "third", label: "A third" },
  { value: "1/4", share: 1 / 4, words: "quarter", label: "A quarter" },
  { value: "2/3", share: 2 / 3, words: "two thirds", label: "Two thirds" },
  { value: "3/4", share: 3 / 4, words: "three quarters", label: "Three quarters" },
].map(Object.freeze));

const cents = (n) => Math.round(n * 100) / 100;
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const squeeze = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const known = (code) => CURRENCIES.find((c) => c.code === code) ?? null;

/** The plan's own currency code ("USD" when it names none). */
export const planCode = (plan) => String(plan?.meta?.currency || "USD").toUpperCase();
/** The account's own currency when it is one of the list and not the plan's, else null (counted as it stands). */
export function codeOf(plan, a) {
  const c = typeof a?.currency === "string" ? a.currency.trim().toUpperCase() : "";
  return c && c !== planCode(plan) && known(c) ? c : null;
}
/** The household's share of the account: a fraction above 0 and below 1, else 1 (all of it). */
export function shareOf(a) {
  const s = Number(a?.share);
  return a?.share !== null && a?.share !== undefined && a?.share !== "" && Number.isFinite(s) && s > 0 && s < 1 ? s : 1;
}
/** The kinds of account a trust can be named on: not a 401(k), an IRA, a Roth or an HSA. Those are held in one person's name,
 *  and the retirement pages (required withdrawals, early access) give each to one person, the first adult when it has no owner;
 *  a trust there would be counted as that person's, not as joint money (critic F3, 2026-11-17). */
export const NO_TRUST_TYPES = Object.freeze(["401k", "ira", "roth", "hsa"]);
export const trustAsked = (type) => !NO_TRUST_TYPES.includes(type);
/** The trust that owns the account, its name with spaces squeezed, or null. */
export const trustOf = (a) => (typeof a?.trust === "string" && squeeze(a.trust) ? squeeze(a.trust) : null);
/** Is the account's balance worked out from what was typed (another currency, or only part of it the household's)? */
export const isWorked = (plan, a) => !!a && typeof a === "object" && (!!codeOf(plan, a) || shareOf(a) < 1);
/** The plan's rate for a currency: { rate (the plan's currency for one unit, above 0), asOf } or null. */
export function rateOf(plan, code) {
  const r = plan?.currencyRates && typeof plan.currencyRates === "object" ? plan.currencyRates[code] : null;
  const n = Number(r?.rate);
  return r && typeof r === "object" && Number.isFinite(n) && n > 0 ? { rate: n, asOf: isDate(r.asOf) ? r.asOf : null } : null;
}

/**
 * THE formula. worked({ full, rate, share }) -> full x rate x share, to the cent (the sign of `full` kept: an overdrawn
 * account abroad stays below zero). EUR 12,000 at $1.08 = $12,960; half of it = $6,480.
 */
export const worked = ({ full, rate = 1, share = 1 }) => cents((Number(full) || 0) * Number(rate) * Number(share));

/** The terms an account's balance is worked out on: { code, rate (null: no rate on file), share }, or null for a plain one. */
export function termsOf(plan, a, { rate } = {}) {
  if (!isWorked(plan, a)) return null;
  const code = codeOf(plan, a);
  return { code, rate: code ? (Number(rate) > 0 ? Number(rate) : rateOf(plan, code)?.rate ?? null) : 1, share: shareOf(a) };
}

/**
 * workedOf(plan, account) -> null (a plain account), or { id, name, code, rate, rateAsOf, share, full, typed, balance, debt }:
 *   balance  the balance as the plan counts it (what is owed, for a debt)
 *   full     the whole in its own currency: as typed while the balance is still worked from it (`typed`), else worked back
 *            from the balance (|balance| / (rate x share), to the cent: a page that writes dollars changed it)
 *   rate     null when the currency has no rate on file (a plan edited by hand): then `full` is what was typed, if anything
 */
export function workedOf(plan, a) {
  if (!isWorked(plan, a)) return null;
  const code = codeOf(plan, a), share = shareOf(a), debt = isLiability(a.type);
  const r = code ? rateOf(plan, code) : null;
  const rate = code ? r?.rate ?? null : 1;
  const balance = countedBalance(a);
  const t = Number(a.fullBalance);
  const tf = a.fullBalance !== null && a.fullBalance !== undefined && a.fullBalance !== "" && Number.isFinite(t) ? (debt ? Math.abs(t) : t) : null;
  const base = { id: a.id, name: a.name ?? "", code, rate, rateAsOf: r?.asOf ?? null, share, debt, balance };
  if (rate === null) return { ...base, full: tf, typed: tf !== null };
  const typed = tf !== null && Math.abs(worked({ full: tf, rate, share }) - balance) < 0.005;
  return { ...base, full: typed ? tf : cents(balance / (rate * share)), typed };
}
/** The whole of the account in its own terms: workedOf's `full`, or the balance as counted for a plain account. */
export function fullOnFile(plan, a) {
  const w = workedOf(plan, a);
  return w ? w.full ?? w.balance : countedBalance(a);
}
/**
 * asItStands(plan, a, full) -> true when `full` is the whole worked back from the balance as it stands (a balance written in
 * dollars, not in step with a whole typed here): the whole on a page's box, saved untouched. The balance then stays to the
 * cent: worked out again from a whole rounded to the cent it could move by a cent or more (EUR 92.94 x 1.08 = $100.38 for a
 * balance of $100.37), which would be a change nobody made (critic F1, 2026-11-17).
 */
export function asItStands(plan, a, full) {
  const n = Number(full);
  const w = Number.isFinite(n) ? workedOf(plan, a) : null;
  return !!w && !w.typed && w.rate !== null && w.full !== null && Math.abs((w.debt ? Math.abs(n) : n) - w.full) < 0.005;
}
/** The balance to store for a whole typed in the account's own terms: worked out, a debt keeping the sign it is stored with.
 *  A plain account: the figure itself (with that sign). null when its currency has no rate. The whole worked back from the
 *  balance on file, typed again: that balance, unchanged (asItStands). */
export function toBalance(plan, a, full, { rate } = {}) {
  const n = Number(full);
  if (!Number.isFinite(n)) return null;
  const debt = isLiability(a?.type);
  const t = termsOf(plan, a, { rate });
  if (t && t.rate === null) return null;
  if (t && rate === undefined && asItStands(plan, a, n)) return Number(a.balance) || 0;
  const d = t ? worked({ full: debt ? Math.abs(n) : n, rate: t.rate, share: t.share }) : n;
  return debt ? (Number(a.balance) < 0 ? -Math.abs(d) : Math.abs(d)) : d;
}
/**
 * writeTyped(draft, account, full) -> the balance written, or null (no rate): the whole typed in the account's own terms
 * becomes its balance (worked out) and its `fullBalance` (kept as typed, what is owed for a debt). A plain account: only its
 * balance, as every writer wrote it before. Changes `account` (an account of `draft`) in place; reads draft.currencyRates.
 */
export function writeTyped(draft, a, full) {
  const b = toBalance(draft, a, full);
  if (b === null) return null;
  a.balance = b;
  // the whole is kept only while the balance is worked from it to the cent: a balance that stood as it was (asItStands, a cent
  // from what the whole rounded to the cent gives) keeps its whole worked back, said "about"
  const t = termsOf(draft, a), whole = cents(isLiability(a.type) ? Math.abs(Number(full)) : Number(full));
  if (t && Math.abs(worked({ full: whole, rate: t.rate, share: t.share }) - countedBalance(a)) < 0.005) a.fullBalance = whole;
  else delete a.fullBalance;
  return b;
}
/** A balance was written in dollars (Account detail, Voice notes): the whole typed earlier no longer stands for it, so it is
 *  dropped and read back from the balance ("about"). Nothing for a plain account. */
export function dollarsWritten(draft, a) {
  if (a && typeof a === "object" && "fullBalance" in a && !(isWorked(draft, a) && workedOf(draft, a)?.typed)) delete a.fullBalance;
}

/**
 * setRate(draft, code, rate, asOf) -> null (not a rate, not a currency of the list, or the plan's own), or { code, from, to,
 * moved: [{ id, name, from, to }] }: the plan's one rate for that currency, and every account in it priced again: its whole
 * on file (as typed, or worked back at the rate before) x the new rate x its share. `from` is the rate before (null: none).
 * The same rate again (Update my balances sends every rate box, left as it was): only its day moves; no account is priced
 * again, so a balance worked back from dollars keeps its cents (critic F1, 2026-11-17).
 */
export function setRate(draft, code, rate, asOf = null) {
  const c = String(code ?? "").toUpperCase(), r = Number(rate);
  if (!known(c) || c === planCode(draft) || !Number.isFinite(r) || !(r > 0)) return null;
  const before = rateOf(draft, c);
  if (before && Math.abs(before.rate - r) < 1e-12) {
    const day = isDate(asOf) ? asOf : before.asOf;
    draft.currencyRates = { ...draft.currencyRates, [c]: { rate: r, ...(day ? { asOf: day } : {}) } };
    return { code: c, from: before.rate, to: r, moved: [] };
  }
  const list = (Array.isArray(draft.accounts) ? draft.accounts : []).filter((a) => a && typeof a === "object" && codeOf(draft, a) === c);
  const wholes = list.map((a) => [a, workedOf(draft, a)?.full ?? null]);   // read at the rate before
  const rates = draft.currencyRates && typeof draft.currencyRates === "object" && !Array.isArray(draft.currencyRates) ? draft.currencyRates : {};
  draft.currencyRates = { ...rates, [c]: { rate: r, ...(isDate(asOf) ? { asOf } : {}) } };
  const moved = [];
  for (const [a, full] of wholes) {
    if (full === null) continue;
    const from = countedBalance(a);
    writeTyped(draft, a, full);
    moved.push({ id: a.id, name: a.name || "An account", from, to: countedBalance(a) });
  }
  return { code: c, from: before?.rate ?? null, to: r, moved };
}

/** The trusts named on accounts, each once (the first spelling; capitals and spaces not counted), a to z: { name, ids, names,
 *  count, assets, liabilities, net, hasDebts }, the accounts' balances counted as Net worth counts them. */
export function trustsOf(plan) {
  const out = [];
  for (const a of Array.isArray(plan?.accounts) ? plan.accounts : []) {
    const t = trustOf(a);
    if (!t) continue;
    let g = out.find((x) => x.name.toLowerCase() === t.toLowerCase());
    if (!g) { g = { name: t, ids: [], names: [], count: 0, assets: 0, liabilities: 0, net: 0, hasDebts: false }; out.push(g); }
    g.ids.push(a.id); g.names.push(a.name || "An account"); g.count++;
    if (isLiability(a.type)) { g.liabilities = cents(g.liabilities + countedBalance(a)); g.hasDebts = true; } else g.assets = cents(g.assets + countedBalance(a));
    g.net = cents(g.assets - g.liabilities);
  }
  return out.sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
}
/** spellTrust(name, plan) -> the name as the plan already spells it ("rivera family trust" typed: "Rivera Family Trust"). */
export function spellTrust(name, plan) {
  const t = squeeze(name);
  return trustsOf(plan).find((x) => x.name.toLowerCase() === t.toLowerCase())?.name ?? t;
}

// ---- words (pure: the page hands in how it writes the plan's money) ------------------------------------------------------
/** "euro" / "euros" for a code; the plan's own currency is "dollar" / "dollars" when it is the US dollar. */
export function currencyName(code, n = 2) {
  if (code === "USD") return n === 1 ? "dollar" : "dollars";
  const c = known(code);
  return c ? (n === 1 ? c.one : c.many) : code;
}
const digitsOf = (code) => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits; } catch { return 2; } };
/** An amount in the account's own currency, by its code: "EUR 12,000", "EUR 12,037.04", "JPY 1,000,000". */
export function ownMoney(code, n) {
  const x = Number(n) || 0, max = digitsOf(code);
  const min = max > 0 && Math.abs(Math.round(x * 100) - Math.round(x) * 100) > 0 ? max : 0;
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: code, currencyDisplay: "code", minimumFractionDigits: min, maximumFractionDigits: Math.max(min, max) }).format(x); }
  catch { return `${code} ${x.toFixed(min)}`; }
}
/** A rate in the plan's currency, with the decimals it was typed with (at least 2): "$1.08", "$0.0067", "$1.10". */
export function rateMoney(rate, plan) {
  const n = Number(rate) || 0;
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: planCode(plan), minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(n); }
  catch { return `$${n}`; }
}
/** The household's share in words: "half", "third", "quarter", "two thirds", "three quarters", else "40%". */
export function shareWords(share) {
  const s = Number(share);
  const hit = SHARES.find((x) => Math.abs(x.share - s) < 1e-6);
  if (hit) return hit.words;
  return `${Number((s * 100).toPrecision(10)).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/**
 * The account's line, one sentence per case (`money` writes the plan's money, whole):
 *   "EUR 12,000 at $1.08 = $12,960"               another currency
 *   "Your half of $40,000: $20,000"                part of it yours
 *   "Your half of EUR 12,000 at $1.08: $6,480"    both
 *   a debt says "owed" after the whole ("EUR 9,000 owed at $1.08 = $9,720"); a whole worked back from a balance written in
 *   dollars somewhere else says "about" ("About EUR 12,000 at $1.08 = $12,960"); a currency with no rate on file:
 *   "In euros: no rate on file. Tap Edit to type one."
 */
export function lineOf(w, money, plan) {
  if (!w) return null;
  if (w.code && w.rate === null) return `In ${currencyName(w.code)}: no rate on file. Tap Edit to type one.`;
  const whole = `${w.typed ? "" : "about "}${w.code ? ownMoney(w.code, w.full) : money(w.full)}${w.debt ? " owed" : ""}`;
  const at = w.code ? ` at ${rateMoney(w.rate, plan)}` : "";
  if (w.share < 1) return `Your ${shareWords(w.share)} of ${whole}${at}: ${money(w.balance)}`;
  return cap(`${whole}${at} = ${money(w.balance)}`);
}
/** The words under an account's box on Update my balances: what to type there. */
export function askWords(w, plan) {
  if (!w) return null;
  const inCur = w.code ? `in ${currencyName(w.code)}` : "";
  const whole = w.share < 1 ? `the whole ${w.debt ? "debt" : "account"}; your ${shareWords(w.share)} counts` : "";
  const at = w.code && w.rate !== null ? ` at ${rateMoney(w.rate, plan)} a ${currencyName(w.code, 1)}` : w.code ? ": no rate on file yet" : "";
  return `${[inCur, whole].filter(Boolean).join(", ")}${at}`;
}
/** The green line's words after a save of such an account (R7: the new figure): "Paris savings added. EUR 12,000 at $1.08 =
 *  $12,960." / "Lake cabin saved. Your half of $400,000: $200,000." */
export function savedWords(name, added, w, money, plan) {
  return `${name} ${added ? "added" : "saved"}. ${lineOf(w, money, plan)}.`;
}
/** What a rate change did, after the sentence of the account saved (empty when it was the first rate or the same rate):
 *  " The euro rate is now $1.10 (was $1.08)." / "...: Lyon flat moved with it, to $220,000." / "...: 2 other accounts in euros
 *  moved with it." `except`: the account the form saved (it is said already). */
export function rateWords(r, money, plan, except = null) {
  if (!r || r.from === null || Math.abs(r.from - r.to) < 1e-12) return "";
  const others = r.moved.filter((m) => m.id !== except);
  const head = ` The ${currencyName(r.code, 1)} rate is now ${rateMoney(r.to, plan)} (was ${rateMoney(r.from, plan)})`;
  if (!others.length) return `${head}.`;
  if (others.length === 1) return `${head}: ${others[0].name} moved with it, to ${money(others[0].to)}.`;
  return `${head}: ${others.length} other accounts in ${currencyName(r.code)} moved with it.`;
}
/** How a trust's accounts count between the adults of the household (`names`: theirs, in order): "as joint money, not as Ana's
 *  or Bo's" for two, "as joint money, not as one person's" for more; nothing for one adult (every page counts an account with no
 *  owner as that adult's, so nothing changes for them). */
export function jointWords(names = []) {
  const n = (Array.isArray(names) ? names : []).map((x) => squeeze(x));
  if (n.length < 2) return "";
  return n.length === 2 && n.every(Boolean) ? `as joint money, not as ${n[0]}'s or ${n[1]}'s` : "as joint money, not as one person's";
}
/** The words about a trust after a save: set or changed, taken off, or nothing. `names`: the household's adults (jointWords). */
export function trustWords(before, after, names = []) {
  const j = jointWords(names);
  if (after && (!before || before.toLowerCase() !== after.toLowerCase())) return ` Owned by ${after}${j ? `: counted ${j}` : ""}.`;
  if (!after && before) return ` No longer owned by ${before}.`;
  return "";
}
/** The status of the "How this is worked out" row: the one rate ("1 EUR = $1.08"), the number of currencies, or how many
 *  accounts are partly yours. At most 20 characters (docs/OPTIONAL.md R25). */
export function howStatus(plan, codes, shared) {
  if (codes.length === 1) { const r = rateOf(plan, codes[0]); const s = r ? `1 ${codes[0]} = ${rateMoney(r.rate, plan)}` : "no rate yet"; return s.length <= 20 ? s : `1 ${codes[0]} rate`; }
  if (codes.length > 1) return `${codes.length} currencies`;
  return `${shared} partly yours`;
}
/** The plain words of what the app does, and does not do, for a trust (README; IRS Instructions for Form 1041, read
 *  2026-11-17: a revocable living trust is treated as a grantor type trust, whose income is treated as the grantor's), after
 *  trustCounted's first sentence. */
export const TRUST_WORDS = "That fits a living trust you can change: for taxes it counts as yours. A trust that cannot be changed is often its own owner; then its money is not yours to count. This app does not keep the trust's papers, file its tax return or say who gets what from it.";
/** The first sentence of a trust's row: "Counted in what you own, as joint money, not as Ana's or Bo's." (one adult: "Counted in
 *  what you own."). */
export const trustCounted = (names = []) => `Counted in what you own${jointWords(names) ? `, ${jointWords(names)}` : ""}.`;
/** What converting does not cover (said in "How this is worked out"). */
export const NOT_COVERED = "Bank lines and investments in these accounts still count as dollars. A rate that moves is not counted as a gain or a loss.";
export const CHANGE_RATE = "To change a rate, tap Edit on one of its accounts, or type it on Update all balances: every account in that currency moves with it in one save, and you can undo it.";
