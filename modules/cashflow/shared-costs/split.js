// modules/cashflow/shared-costs/split.js -- PURE. Bills split with others (gap list next 60, item 17): costs shared with
// people outside the couple (roommates, friends, a trip), each bill split evenly, by shares or by exact amounts, and who
// owes whom, netted to the fewest payments. "Mark as settled" writes a payment into the same list, so the bills stay as
// history. Read only by this page's view: the page's compute() and every other page are unchanged by it, and the names
// typed here stay in the plan (no page result, no helper prompt, no shared link carries them).
//
// plan.splitBills (optional, docs/DATA_MODEL.md), in the order typed:
//   a bill     { id, what, on: "YYYY-MM-DD", amount, paidBy: who, split: "even" | "shares" | "exact", among: [{ who, share?, amount? }] }
//   a payment  { id, kind: "paid", on, from: who, to: who, amount }   ("Mark as settled")
//   who        "person:<id>" (a person in the plan; the first adult's is "you" on screen, and the form writes the first
//              adult this way so marking someone else "Me" later never moves a bill) | "me" (the first adult, written only
//              while the plan has no adult) | "name:<as typed>" (someone outside the plan; any case or spacing is one person)
// Money is worked in whole cents; the odd cents of a split go to whoever paid (README "Bills split with others").
import { coupleOf } from "./compute.js";
import { isYou, nameIn, NameIn, namesIn, verbFor } from "../../../core/words.js";

export const SPLITS = Object.freeze(["even", "shares", "exact"]);
/** The words in the form's "How it splits", in this order. */
export const SPLIT_LABELS = Object.freeze({ even: "Evenly", shares: "By shares", exact: "Exact amounts" });
/** Up to this many people with something owed, the fewest payments are searched exactly (3^12 subsets); above, largest to largest. */
export const EXACT_MAX = 12;
/** The longest name and bill title kept (characters). */
export const NAME_MAX = 40;
export const WHAT_MAX = 80;
/** The largest bill or payment kept, in dollars: far above any bill shared with friends, and small enough that every sum of
 * cents stays exact (Number.MAX_SAFE_INTEGER is about $90 trillion in cents). */
export const AMOUNT_MAX = 1e9;
export const ME = "me";
/** The part's words when nothing is typed yet. */
export const INTRO = "For costs you share with roommates, friends or on a trip: add each bill, and this works out who owes whom.";
/** One adult, or the empty plan: the page's hero is about bills split with others (splitting the month as a couple needs
 * two adults), its one filled button opens the add form, and adding a partner is a quiet link. */
export const SOLO = Object.freeze({
  head: "Split a bill with friends or roommates",
  say: "Add each bill you share, and this works out who owes whom.",
  add: "Add a bill",
  partner: "Sharing costs with a partner?",
  partnerLink: "Add them on People",
});
/** A person in the plan whose row is gone, as a sentence names them. */
export const GONE = "someone no longer in your plan";

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v) => (v === null || v === undefined || v === "" || typeof v === "boolean" || !Number.isFinite(Number(v)) ? null : Number(v));
const squeeze = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** A day of the calendar written YYYY-MM-DD ("2024-02-30" and "2026-13-40" are not). */
export function realDay(iso) {
  const t = String(iso ?? "");
  if (!ISO.test(t)) return false;
  const y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)), d = Number(t.slice(8, 10));
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return m >= 1 && m <= 12 && d >= 1 && d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

// ---------------------------------------------------------------- who is who
/** The plan's first adult (marked "Me", else the first adult): "me". */
const firstOf = (plan) => coupleOf(plan).a;
/** The plan's people, for matching a typed name. */
const peopleIn = (plan) => (plan?.household?.people ?? []).filter(isObj);

/**
 * canon(plan, who) -> the key a person is counted under, or null: "person:<first adult>" is "me"; a typed name that is "me"
 * or "you" is "me", one that is a person's in the plan (any case) is that person; any other typed name is
 * "name:<lower case, single spaces>".
 */
export function canon(plan, who) {
  if (typeof who !== "string") return null;
  if (who === ME) return ME;
  const first = firstOf(plan);
  if (who.startsWith("person:")) {
    const id = who.slice(7);
    if (!id) return null;
    return first && String(first.id) === id ? ME : `person:${id}`;
  }
  if (who.startsWith("name:")) {
    const typed = squeeze(who.slice(5)).slice(0, NAME_MAX);
    if (!typed) return null;
    const low = typed.toLowerCase();
    if (low === "me" || low === "you") return ME;
    const p = peopleIn(plan).find((x) => squeeze(x.name).toLowerCase() === low && !isYou(x.name));
    if (p) return first && p === first ? ME : `person:${p.id}`;
    return `name:${low}`;
  }
  return null;
}

/** The key for a name typed in the form ("Sam" -> "name:Sam" as stored; canon() then compares it). */
export const typedWho = (name) => `name:${squeeze(name).slice(0, NAME_MAX)}`;

/**
 * storeKey(plan, who) -> the key a bill or a payment is written under, or null. Someone in the plan is written by their id,
 * the first adult too ("person:<id>", never "me"), so marking another adult "Me" on People, or putting the people in
 * another order, never moves a bill from one person to another; "me" only while the plan has no adult with an id. A typed
 * name that is someone's in the plan is that person; any other typed name is kept as typed.
 */
export function storeKey(plan, who) {
  const k = canon(plan, who);
  if (!k) return null;
  if (k === ME) { const a = firstOf(plan); return a && a.id !== undefined && a.id !== null && String(a.id) !== "" ? `person:${a.id}` : ME; }
  if (k.startsWith("person:")) return k;
  return typedWho(String(who).slice(5));
}

/** Names typed in one box: "Sam, Lee and Kim" -> ["Sam", "Lee", "Kim"] (commas, "and", "&" or ";"; the same name once). */
export function namesFrom(text) {
  const out = [], seen = new Set();
  for (const raw of String(text ?? "").split(/\s*(?:,|;|&|\band\b)\s*/i)) {
    const n = squeeze(raw).slice(0, NAME_MAX);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out;
}

/**
 * nameFor(plan, key, spelled) -> the name a sentence uses for a key, as core/words.js reads it: the first adult's name
 * ("Me" or none reads "you"); a partner with no name "My partner" ("your partner"); a typed name as last spelled.
 */
export function nameFor(plan, key, spelled = {}) {
  if (key === ME) { const a = firstOf(plan); return a?.name ?? ""; }
  if (typeof key === "string" && key.startsWith("person:")) {
    const p = peopleIn(plan).find((x) => String(x.id) === key.slice(7));
    if (!p) return GONE;
    if (!isYou(p.name)) return String(p.name);
    return p.role === "partner" ? "My partner" : "someone in your plan";
  }
  if (typeof key === "string" && key.startsWith("name:")) return spelled[key] ?? key.slice(5);
  return "";
}

// ---------------------------------------------------------------- one entry
const centsOf = (amount) => { const n = num(amount); return n === null ? null : Math.round(n * 100); };
/** A bill or payment within AMOUNT_MAX (above it the cents are no longer exact): its cents, else null. */
const keptCents = (amount) => { const c = centsOf(amount); return c !== null && c <= AMOUNT_MAX * 100 ? c : null; };

/**
 * partsOf(plan, bill) -> { payer, cents, split, among: [{ who, share, cents }], parts: { [who]: cents } } | null.
 * The cents each person's part of one bill comes to, adding up to the bill (README "Bills split with others"):
 *   evenly between n people: everyone but the payer floor(A / n), the payer the rest;
 *   by shares s_i (S = the sum): everyone but the payer floor(A x s_i / S), the payer the rest (a blank share is 1);
 *   exact amounts: as typed, the payer the rest (the form refuses amounts that do not add up to A).
 * The payer's part includes the odd cents; a payer not in the split keeps only those. null when it cannot be worked
 * (no amount or one above AMOUNT_MAX, no payer, nobody in it, shares adding to 0, or exact amounts above the bill).
 */
export function partsOf(plan, bill) {
  if (!isObj(bill)) return null;
  const A = keptCents(bill.amount);
  const payer = canon(plan, bill.paidBy);
  if (!(A > 0) || !payer) return null;
  const split = SPLITS.includes(bill.split) ? bill.split : "even";
  const among = [];
  for (const x of Array.isArray(bill.among) ? bill.among : []) {
    const who = canon(plan, isObj(x) ? x.who : x);
    if (!who) continue;
    const share = isObj(x) ? num(x.share) : null, amt = isObj(x) ? centsOf(x.amount) : null;
    const had = among.find((y) => y.who === who);
    if (had) { had.share += share ?? 1; had.typed += amt ?? 0; continue; }
    among.push({ who, share: share ?? 1, typed: amt ?? 0 });
  }
  if (!among.length) return null;
  if (split === "shares" && among.some((y) => y.share < 0)) return null;
  if (split === "exact" && among.some((y) => y.typed < 0)) return null;
  const S = among.reduce((t, y) => t + y.share, 0);
  if (split === "shares" && !(S > 0)) return null;
  const parts = {};
  let others = 0;
  for (const y of among) {
    if (y.who === payer) continue;
    const c = split === "exact" ? y.typed : split === "shares" ? Math.floor((A * y.share) / S + 1e-9) : Math.floor(A / among.length);
    if (!Number.isSafeInteger(c)) return null;   // shares so large the sum is no longer exact
    parts[y.who] = c;
    others += c;
  }
  if (others > A) return null;
  if (A - others > 0 || among.some((y) => y.who === payer)) parts[payer] = A - others;
  return { payer, cents: A, split, among: among.map((y) => ({ who: y.who, share: y.share, cents: parts[y.who] ?? 0 })), parts };
}

/** A payment that settles: { from, to, cents } | null. */
export function paymentOf(plan, x) {
  if (!isObj(x) || x.kind !== "paid") return null;
  const from = canon(plan, x.from), to = canon(plan, x.to), cents = keptCents(x.amount);
  return from && to && from !== to && cents > 0 ? { from, to, cents } : null;
}

// ---------------------------------------------------------------- balances and the fewest payments
/** Add one entry to the balances (cents; above zero: is owed, below: owes). */
function apply(net, e) {
  const add = (k, c) => { net[k] = (net[k] ?? 0) + c; };
  if (e.kind === "paid") { add(e.from, e.cents); add(e.to, -e.cents); return; }
  add(e.payer, e.cents);
  for (const [k, c] of Object.entries(e.parts)) add(k, -c);
}

/**
 * fewestPayments(balances) -> [{ from, to, cents }]: the fewest payments that bring every balance to zero. The people with
 * a balance are split into the most groups that each add up to zero (a group of k needs k - 1 payments, so n - groups in
 * all, which no other way beats); within a group whoever owes most pays whoever is owed most, as much as either needs.
 * Exact for up to EXACT_MAX people (every subset, 3^n steps); above that, largest to largest over everyone (at most n - 1).
 */
export function fewestPayments(balances) {
  const items = Object.entries(balances ?? {}).filter(([, c]) => Number.isInteger(c) && c !== 0);
  if (!items.length) return [];
  const total = items.reduce((t, [, c]) => t + c, 0);
  const groups = items.length <= EXACT_MAX && total === 0 ? bestGroups(items) : [items];
  const out = [];
  for (const g of groups) out.push(...settleGroup(g));
  return out;
}

/** The most groups adding up to zero (each the people of `items` it holds). */
function bestGroups(items) {
  const n = items.length, full = (1 << n) - 1;
  const sum = new Array(full + 1).fill(0);
  for (let m = 1; m <= full; m++) { const low = m & -m; sum[m] = sum[m ^ low] + items[31 - Math.clz32(low)][1]; }
  const best = new Array(full + 1).fill(-1), pick = new Array(full + 1).fill(0);
  best[0] = 0;
  for (let m = 1; m <= full; m++) {
    if (sum[m] !== 0) continue;
    const low = m & -m;
    // a group holding the lowest person of m, adding up to zero, and the best of what is left
    for (let s = m; s > 0; s = (s - 1) & m) {
      if (!(s & low) || sum[s] !== 0 || best[m ^ s] < 0) continue;
      if (1 + best[m ^ s] > best[m]) { best[m] = 1 + best[m ^ s]; pick[m] = s; }
    }
  }
  if (best[full] < 0) return [items];
  const groups = [];
  for (let m = full; m; m ^= pick[m]) groups.push(items.filter((_, i) => pick[m] & (1 << i)));
  return groups;
}

/** Whoever owes most pays whoever is owed most, until every balance in the group is zero. */
function settleGroup(group) {
  const owe = group.filter(([, c]) => c < 0).map(([k, c]) => ({ k, c: -c }));
  const owed = group.filter(([, c]) => c > 0).map(([k, c]) => ({ k, c }));
  const out = [];
  const top = (xs) => xs.reduce((b, x) => (x.c > 0 && (!b || x.c > b.c) ? x : b), null);
  for (let guard = 0; guard < 4 * group.length; guard++) {
    const d = top(owe), c = top(owed);
    if (!d || !c) break;
    const x = Math.min(d.c, c.c);
    out.push({ from: d.k, to: c.k, cents: x });
    d.c -= x; c.c -= x;
  }
  return out;
}

// ---------------------------------------------------------------- the list
/** A day as a line says it: "Nov 14", with the year when it is not this year ("Dec 30, 2025"). */
export const dayWords = (iso, today) => {
  if (!realDay(iso)) return "";
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const y = iso.slice(0, 4), m = Number(iso.slice(5, 7)), d = Number(iso.slice(8, 10));
  return `${M[m - 1]} ${d}${today && String(today).slice(0, 4) !== y ? `, ${y}` : ""}`;
};

/**
 * splitOf(plan) -> { entries, open, settled, fix, balances, payments, people, spelled, last }
 *   entries   every entry as worked: { id, at (its place in the list), kind "bill" | "paid", on, what, cents, ok, payer,
 *             parts, split, among } for a bill, { id, at, kind, on, cents, ok, from, to } for a payment
 *   open      the entries after everyone was last square (all of them when never), in the order typed
 *   settled   the entries up to the last time every balance was zero after one
 *   fix       how many entries cannot be worked (a stored bill whose amounts are above it): left out, and said
 *   balances  { [who]: cents } (above zero: is owed); they add up to zero
 *   payments  fewestPayments(balances)
 *   people    every key known: "me", the plan's other adults, then each key used, in the order first used
 *   spelled   { "name:<key>": the name as last typed }
 *   last      the keys of the last bill's split (the form ticks them for the next bill), or ["me"]
 */
export function splitOf(plan) {
  const raw = Array.isArray(plan?.splitBills) ? plan.splitBills : [];
  // a name as last typed with a capital in it ("Sam" typed once and "sam" later is still "Sam")
  const spelled = {};
  const spell = (w) => {
    const k = canon(plan, w);
    if (!k?.startsWith("name:")) return;
    const t = squeeze(String(w).slice(5)).slice(0, NAME_MAX);
    if (!spelled[k] || t !== t.toLowerCase()) spelled[k] = t;
  };
  const entries = [];
  raw.forEach((x, at) => {
    if (!isObj(x)) return;
    const base = { id: x.id ?? null, at, on: realDay(x.on) ? x.on : "" };
    if (x.kind === "paid") {
      const p = paymentOf(plan, x);
      for (const w of [x.from, x.to]) spell(w);
      entries.push({ ...base, kind: "paid", ok: !!p, cents: p?.cents ?? centsOf(x.amount) ?? 0, from: p?.from ?? canon(plan, x.from), to: p?.to ?? canon(plan, x.to) });
      return;
    }
    for (const w of [x.paidBy, ...(Array.isArray(x.among) ? x.among.map((y) => (isObj(y) ? y.who : y)) : [])]) spell(w);
    const w = partsOf(plan, x);
    entries.push({ ...base, kind: "bill", what: squeeze(x.what).slice(0, WHAT_MAX), ok: !!w, cents: w?.cents ?? centsOf(x.amount) ?? 0,
      payer: w?.payer ?? canon(plan, x.paidBy), parts: w?.parts ?? {}, split: w?.split ?? (SPLITS.includes(x.split) ? x.split : "even"), among: w?.among ?? [] });
  });
  const net = {};
  let square = -1;
  entries.forEach((e, i) => {
    if (!e.ok) return;
    apply(net, e);
    if (Object.values(net).every((c) => c === 0)) square = i;
  });
  for (const k of Object.keys(net)) if (net[k] === 0) delete net[k];
  const people = [ME];
  const add = (k) => { if (k && !people.includes(k)) people.push(k); };
  const first = firstOf(plan);
  for (const p of peopleIn(plan)) if (p.role !== "dependent" && p !== first) add(`person:${p.id}`);
  for (const e of entries) { if (e.kind === "paid") { add(e.from); add(e.to); } else { add(e.payer); for (const y of e.among) add(y.who); } }
  const lastBill = [...entries].reverse().find((e) => e.kind === "bill" && e.ok);
  return {
    entries, open: entries.slice(square + 1), settled: entries.slice(0, square + 1), fix: entries.filter((e) => !e.ok).length,
    balances: net, payments: fewestPayments(net), people, spelled, last: lastBill ? lastBill.among.map((y) => y.who) : [ME],
  };
}

// ---------------------------------------------------------------- the form, checked
/**
 * readBill(plan, v, { cash }) -> { bill } | { error, words }: the form's values made into a bill, or the box to fix and
 * the plain words. v: { what, amount, on, paidBy, split, among: [who], shares: { [who]: n }, amounts: { [who]: $ } }.
 * error names the box: "amount", "among", "shares" or "exact". Every `who` is written as storeKey() gives it.
 */
export function readBill(plan, v, { cash = cashOf } = {}) {
  const A = centsOf(v?.amount);
  if (!(A > 0)) return { error: "amount", words: "Type how much the bill was." };
  if (A > AMOUNT_MAX * 100) return { error: "amount", words: `Type an amount up to ${cash(AMOUNT_MAX * 100)}.` };
  const split = SPLITS.includes(v.split) ? v.split : "even";
  const keys = [];
  for (const w of Array.isArray(v.among) ? v.among : []) if (typeof w === "string" && w && !keys.some((k) => canon(plan, k) === canon(plan, w)) && canon(plan, w)) keys.push(w);
  if (!keys.length) return { error: "among", words: "Check or type who shares it." };
  const among = keys.map((key) => {
    const who = storeKey(plan, key);
    if (split === "shares") { const s = num(v.shares?.[key]); return { who, share: s === null ? 1 : s }; }
    if (split === "exact") { const c = centsOf(v.amounts?.[key]); return { who, amount: c === null ? 0 : c / 100 }; }
    return { who };
  });
  if (split === "shares" && among.some((y) => y.share < 0)) return { error: "shares", words: "A share is 0 or more." };
  if (split === "shares" && !(among.reduce((t, y) => t + y.share, 0) > 0)) return { error: "shares", words: "Give at least one person a share." };
  if (split === "exact") {
    if (among.some((y) => y.amount < 0)) return { error: "exact", words: "An amount is 0 or more." };
    const sum = among.reduce((t, y) => t + Math.round(y.amount * 100), 0);
    if (sum !== A) return { error: "exact", words: `These add up to ${cash(sum, true)}, but the bill is ${cash(A, true)}. Change them so they add up to ${cash(A, true)}.` };
  }
  const paidBy = storeKey(plan, typeof v.paidBy === "string" && canon(plan, v.paidBy) ? v.paidBy : ME);
  const bill = { what: squeeze(v.what).slice(0, WHAT_MAX), on: realDay(v.on) ? v.on : "", amount: A / 100, paidBy, split, among };
  const w = partsOf(plan, bill);
  const payer = canon(plan, paidBy);
  if (!w || !Object.entries(w.parts).some(([k, c]) => k !== payer && c > 0)) {
    // someone else is in it with a part to pay, but every such part comes to less than a cent ($0.01 between two)
    const others = among.filter((y) => canon(plan, y.who) !== payer && (split === "even" || (split === "shares" ? y.share > 0 : y.amount > 0)));
    if (w && others.length) return { error: "amount", words: "This bill is too small to split: each part would be less than a cent." };
    return { error: "among", words: split === "even" ? "Check or type at least one other person to split it with." : "Give someone other than whoever paid a part of it." };
  }
  return { bill };
}

// ---------------------------------------------------------------- the words
/** Cents as money: "$42", "$42.50"; `two`: always two decimals ("$85.00"). The view passes its own (the plan's currency). */
export function cashOf(cents, two = false) {
  const n = (Number(cents) || 0) / 100;
  const whole = Number.isInteger(Math.round(n * 100) / 100) && !two;
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}

/** "Sam owes you", "You owe Lee", "Sam owes Lee" (names as nameFor gives them); `lead` false: inside a sentence ("you owe Lee"). */
export const owesWords = (from, to, lead = true) => `${lead ? NameIn(from) : nameIn(from)} ${verbFor(from, "owes", "owe")} ${nameIn(to)}`;
/** "Sam paid you", "You paid Lee"; `lead` false: inside a sentence. */
export const paidWords = (from, to, lead = true) => `${lead ? NameIn(from) : nameIn(from)} paid ${nameIn(to)}`;
/** A bill as a sentence names it: "Pizza night" in quotes, or "the $90 bill" when it has no name. */
export const billName = (e, cash = cashOf) => (e.what ? `"${e.what}"` : `the ${cash(e.cents)} bill`);

/**
 * afterWords(s, name, cash) -> who owes whom once the list is as `s` says: "Everyone is square.", "Sam owes you $42.",
 * "Sam owes you $30, and Lee owes you $30.", "3 payments settle it." (name: key -> name, as nameFor).
 */
export function afterWords(s, name, cash = cashOf) {
  const ps = orderPayments(s.payments);
  if (!ps.length) return "Everyone is square.";
  if (ps.length > 2) return `${ps.length} payments settle it.`;
  return `${ps.map((p, i) => `${owesWords(name(p.from), name(p.to), i === 0)} ${cash(p.cents)}`).join(", and ")}.`;
}

/** The payments as the page lists them: the ones with the first adult first, then the largest. */
export const orderPayments = (ps) => [...(ps ?? [])].sort((a, b) => Number(b.from === ME || b.to === ME) - Number(a.from === ME || a.to === ME) || b.cents - a.cents);

/** The part's status (20 characters at most, core/ui/more.js): "", "Sam owes you $42", "2 payments open", "all square". */
export function statusWords(s, name, cash = cashOf) {
  if (!s.entries.length) return "";
  const ps = orderPayments(s.payments);
  if (!ps.length) return "all square";
  if (ps.length === 1) {
    const one = `${owesWords(name(ps[0].from), name(ps[0].to))} ${cash(ps[0].cents)}`;
    if (one.length <= 20) return one;
  }
  return `${ps.length} payment${ps.length === 1 ? "" : "s"} open`;
}

/** The line under a bill: "Nov 14 · you paid · evenly between you, Sam and Lee". */
export function billSub(e, name, { cash = cashOf, today = null } = {}) {
  const day = dayWords(e.on, today);
  const who = e.among.map((y) => name(y.who));
  const how = e.split === "shares" ? `by shares: ${e.among.map((y) => `${nameIn(name(y.who))} ${y.share}`).join(", ")}`
    : e.split === "exact" ? `exact amounts: ${e.among.map((y) => `${nameIn(name(y.who))} ${cash(y.cents)}`).join(", ")}`
    : who.length === 1 ? `all of it for ${nameIn(who[0])}` : `evenly between ${namesIn(who)}`;
  return [day, `${nameIn(name(e.payer))} paid`, how].filter(Boolean).join(" · ");
}

/** A settled entry, one line: "Nov 2 · Pizza night · $36 · you paid", "Nov 16 · Sam paid you $42". */
export function historyLine(e, name, { cash = cashOf, today = null } = {}) {
  const day = dayWords(e.on, today);
  if (e.kind === "paid") return [day, `${paidWords(name(e.from), name(e.to))} ${cash(e.cents)}`].filter(Boolean).join(" · ");
  return [day, e.what || "A bill", cash(e.cents), `${nameIn(name(e.payer))} paid`].filter(Boolean).join(" · ");
}

/** The green line after a change (R7: it names the new answer). kind: "add" | "change" | "remove" | "settle"; `after` the list as it is now. */
export function savedWords(kind, e, after, name, cash = cashOf) {
  const now = afterWords(after, name, cash);
  if (kind === "settle") return `Settled: ${paidWords(name(e.from), name(e.to), false)} ${cash(e.cents)}. ${now}`;
  const it = e.kind === "paid" ? `"${paidWords(name(e.from), name(e.to))} ${cash(e.cents)}"` : billName(e, cash);
  return `${kind === "add" ? "Added" : kind === "change" ? "Saved" : "Removed"} ${it}. ${now}`;
}

/** The words after Undo. */
export function undoneWords(kind, e, name, cash = cashOf) {
  if (kind === "settle") return `Undone: ${owesWords(name(e.from), name(e.to), false)} ${cash(e.cents)} again.`;
  const it = e.kind === "paid" ? `"${paidWords(name(e.from), name(e.to))} ${cash(e.cents)}"` : billName(e, cash);
  return `Undone: ${it} is ${kind === "add" ? "off the list" : kind === "change" ? "back as it was" : "back on the list"}.`;
}

/** The question before a remove or a settle (ui.confirm). */
export function confirmWords(kind, e, name, cash = cashOf) {
  if (kind === "settle") return `Mark it settled: ${paidWords(name(e.from), name(e.to), false)} ${cash(e.cents)}? The bills stay in your history.`;
  const it = e.kind === "paid" ? `"${paidWords(name(e.from), name(e.to))} ${cash(e.cents)}"` : e.what ? `"${e.what}" (${cash(e.cents)})` : `the ${cash(e.cents)} bill`;
  return `Remove ${it}? Who owes whom is worked out again without it.`;
}

/** The line when a stored entry cannot be worked (never from the form). */
export const fixWords = (n) => `${n === 1 ? "One bill is" : `${n} bills are`} left out: ${n === 1 ? "its" : "their"} parts add up to more than the bill, or nobody is in the split. Change or remove ${n === 1 ? "it" : "them"}.`;
