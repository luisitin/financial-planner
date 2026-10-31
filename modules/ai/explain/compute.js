// modules/ai/explain/compute.js -- PURE. "Explain this page": a page's own numbers (its compute() run on a copy of the
// plan with people and accounts renamed, see ai/critic's anonymise, and every other name typed into the plan swapped
// for a stand-in, see scrub) turned into a short list of lines the AI reads, the question asked, and the answer read
// back with the real names put back. The AI explains; it never works out a number the app shows (AGENTS.md rule 5),
// and its answer is labelled as not checked.
import { anonymise, restore, hide, hideTerms, aliases, accountAliases, outsiders, cut, SOMEONE } from "../critic/compute.js";
import { classify } from "../../investments/holdings/compute.js";
import { looksSecret } from "../../estate/digital/compute.js";
import { ESTATE } from "../../estate/beneficiaries/compute.js";
import { defaultCategories } from "../../transactions/categories/compute.js";
import { ageOn } from "../../../core/math/dates.js";

export { anonymise, restore };

/** Pages never offered: the app's own machinery, the AI pages, pages that hold other people's details or where papers are kept, and the list of all pages (no numbers of its own). */
export const NOT_OFFERED = new Set(["household/contacts", "household/documents", "overview/pages"]);
const NOT_GROUPS = new Set(["system", "ai"]);
/**
 * Keys never sent: ids and links (no meaning to the AI; any key ending in "Id" or "Ids" too), free text and contact
 * details (could say anything about anyone), the bank's own text and what a rule looks for in it, the names of banks,
 * insurers and firms, file names, where a receipt is kept, birth dates (the age is sent) and tax tables.
 */
export const SKIP = new Set([
  "id", "ids", "key", "keys", "accountId", "accountIds", "personId", "policyId", "goalId", "policyIds", "importId", "transferId", "rawPayee", "contains",
  "go", "href", "url", "sourceUrl", "icon", "color", "class", "css", "dataset", "error", "seeds",
  "note", "notes", "phone", "email", "address", "last4", "where", "who", "copy",
  "institution", "insurer", "firm", "contact", "fileName", "proof", "birthDate", "params",
]);
const ID_KEY = /^(id|ids)$|Ids?$/;
/** An id as the app makes them (core/ui/dom.js uid, crypto.randomUUID): a key or a value holding one is never sent. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export const MAX_LINES = 80, MAX_CHARS = 6000, MAX_ITEMS = 6, MAX_DEPTH = 4, MAX_TEXT = 160, MAX_QUESTION = 300, MAX_ANSWER = 3000;

/** "netWorth" -> "net worth", "dti_ratio" -> "dti ratio". */
export const words = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
/** Money to the cent; a number under 1 (a rate, a share) to 4 significant digits, so 0.0625 stays 0.0625. */
const num = (n) => (Math.abs(n) < 1 ? String(Number(n.toPrecision(4))) : String(Math.round(n * 100) / 100));
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const esc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const squash = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const typed = (v) => typeof v === "string" && squash(v) !== "";
/** How the estate pages tell people apart (estate/gifting keys a recipient so): trimmed, any case. */
const lower = (s) => String(s ?? "").trim().toLowerCase();

/** The letters rooms are named with: no "I", which is a word ("the room I painted"). */
const ABC = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
/**
 * Room letters that sort the way they are handed out ("A" ... "Z", "ZA" ... "ZZ", "ZZA"...): the home inventory sorts
 * by room, so "room 10" before "room 2" would change its order. A lettered stand-in is put back only with its letters
 * in capitals (ai/critic restore), so the AI's own "room a bit lower" stays its words.
 */
export const roomLetters = (i) => "Z".repeat(Math.floor(i / ABC.length)) + ABC[i % ABC.length];

const MONTH = "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)";
const ISO_DATE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
const MONTH_DAY = new RegExp(`\\b${MONTH}\\.? (\\d{1,2})(?:st|nd|rd|th)?\\b(,? (\\d{4})\\b)?`, "g");
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)? ${MONTH}\\b(,? (\\d{4})\\b)?`, "g");
const US_DATE = /(?<![\d/])(\d{1,2})\/(\d{1,2})\/(\d{4})(?![\d/])/g;
const isDay = (d) => Number(d) >= 1 && Number(d) <= 31;
const isMonth = (m) => Number(m) >= 1 && Number(m) <= 12;
/**
 * Text with the day left out of every date in it: "2055-05-20" -> "2055-05", "May 20, 2055" -> "May 2055",
 * "20 May" -> "May", "5/20/2055" -> "5/2055". For a page that shows a date worked out from someone's birth date
 * (sheetFor), so the AI gets the month and the year of the day someone turns 65, never the day it falls on.
 */
export function dayless(text) {
  const t = String(text);
  if (!/\d/.test(t)) return t;
  return t
    .replace(ISO_DATE, (all, y, m) => (isMonth(m) ? `${y}-${m}` : all))
    .replace(MONTH_DAY, (all, mo, d, rest, y) => (isDay(d) ? `${mo}${y ? ` ${y}` : ""}` : all))
    .replace(DAY_MONTH, (all, d, mo, rest, y) => (isDay(d) ? `${mo}${y ? ` ${y}` : ""}` : all))
    .replace(US_DATE, (all, m, d, y) => (isMonth(m) && isDay(d) ? `${m}/${y}` : all));
}

/** A key the digest never sends (SKIP, or ending in "Id"/"Ids"). */
const skipKey = (k) => SKIP.has(k) || ID_KEY.test(k);
/** Visits every text a page's result could send, values and keys, at any depth, but none under a key never sent. */
function eachText(v, f, seen = new WeakSet()) {
  if (typeof v === "string") { f(v); return; }
  if (!v || typeof v !== "object" || seen.has(v)) return;
  seen.add(v);
  if (Array.isArray(v)) { v.forEach((x) => eachText(x, f, seen)); return; }
  for (const [k, x] of Object.entries(v)) if (!skipKey(k)) { f(k); eachText(x, f, seen); }
}
/** Every date written in a page's result, in the order found ("2055-05-20", "May 20", "20 May", "5/20/2055"). */
function datesIn(v) {
  const out = [];
  eachText(v, (s) => { if (/\d/.test(s)) for (const re of [ISO_DATE, MONTH_DAY, DAY_MONTH, US_DATE]) for (const m of s.matchAll(re)) out.push(m[0]); });
  return out;
}

/**
 * The copy with each birth date moved a few days within its own month (a week on or back, else a day or two), so
 * everyone keeps their age today (`today`) and their month and year of birth: a date a page works out from a birth
 * date (the day someone turns 65 or 59 and a half) moves with it, a date the page takes from anywhere else (a tax
 * due date, a bill, today) does not. -> the moved copy; null when nobody has a birth date; true when one cannot be
 * read as a date (then no date keeps its day).
 */
export function movedBirths(copy, today) {
  const c = structuredClone(copy);
  let any = false;
  for (const p of Array.isArray(c?.household?.people) ? c.household.people.filter(isObj) : []) {
    const b = typeof p.birthDate === "string" ? p.birthDate.trim() : "";
    if (!b) continue;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return true;
    any = true;
    const d = Number(m[3]), last = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
    const on = (x) => `${m[1]}-${m[2]}-${String(x).padStart(2, "0")}`;
    const age = today ? ageOn(b, today) : null;
    const days = [d + 7, d - 7, d + 1, d - 1, d + 2, d - 2, d + 3, d - 3].filter((x) => x >= 1 && x <= last);
    p.birthDate = on(days.find((x) => age === null || ageOn(on(x), today) === age) ?? days[0]);
  }
  return any ? c : null;
}

const PROPERTY_NOUNS = { home: "home", rental: "rental", vehicle: "vehicle", purchase: "purchase" };
const POLICY_NOUNS = { term: "term life policy", whole: "whole life policy", disability: "disability policy", ltc: "long-term care policy", health: "health policy", home: "home policy", auto: "car policy", umbrella: "umbrella policy" };
const EVENT_NOUNS = { trip: "trip", wedding: "wedding" };
const ROLE_NOUNS = { person: "Person", charity: "Charity", giver: "Giver", contact: "Contact" };

/** A name that is only someone in the household ("Cy", "CY GARCIA"): their stand-in (SOMEONE when two share it), else null. */
const homeAlias = (text, people, mine) => { const h = hide(squash(text), mine); return h === SOMEONE || people.some((p) => p.alias === h) ? h : null; };

/**
 * The people outside the household the plan names (ai/critic outsiders: gift and bequest recipients, beneficiaries,
 * givers, digital-legacy and other contacts), one stand-in each by role and order: "Person 1", "Charity 1",
 * "Giver 1", "Contact 1". The same name (any case, any spaces) is the same stand-in everywhere; a household member's
 * name and "the estate" are not outsiders. -> [{ name, alias }]
 */
export function outsiderAliases(plan, { today } = {}) {
  const people = aliases(plan, { today }), mine = hideTerms(people, [], { surnames: true });
  const seen = new Map(), count = {};
  for (const o of outsiders(plan)) {
    const k = lower(o.name);
    if (seen.has(k) || ESTATE.test(o.name) || homeAlias(o.name, people, mine)) continue;
    seen.set(k, { name: o.name, alias: `${ROLE_NOUNS[o.role]} ${(count[o.role] = (count[o.role] ?? 0) + 1)}` });
  }
  return [...seen.values()];
}

/** The app's own category names and ids ("Groceries", "utilities", "Pension"): a payee typed as one of them says nothing private, and its stand-in would also replace the category's name on the pages. */
const APP_WORDS = new Set(defaultCategories().flatMap((c) => [c.id, c.label]).map(lower));
/**
 * The payees' stand-ins, "Payee 1", "Payee 2"..., one per payee as typed (spaces tidied; "Netflix" and "NETFLIX" stay
 * two, as on Spending), in the order the transactions and then the rules' new payee names give them; not a payee
 * typed as one of the app's category names ("Groceries"). -> [{ name, alias, kind: "other" }]
 */
export function payeeAliases(plan) {
  const seen = new Map();
  const add = (t) => { if (typed(t) && !APP_WORDS.has(lower(squash(t))) && !seen.has(squash(t))) seen.set(squash(t), `Payee ${seen.size + 1}`); };
  for (const t of (plan?.transactions ?? []).filter(isObj)) add(t.payee);
  for (const r of (plan?.rules ?? []).filter(isObj)) add(r.payee);
  return [...seen].map(([name, alias]) => ({ name, alias, kind: "other" }));
}

/**
 * What the digest says instead of a payee (`payees`: payeeAliases): each payee as typed, and the bank's own text of
 * each transaction (its payee's stand-in, or one of its own), as text -> stand-in. -> Map
 */
export function payeeSwap(plan, payees = payeeAliases(plan)) {
  const swap = new Map(payees.map((x) => [x.name, x.alias]));
  let n = payees.length;
  for (const t of (plan?.transactions ?? []).filter(isObj)) {
    const raw = squash(t.rawPayee);
    if (!raw || swap.has(raw) || APP_WORDS.has(lower(raw))) continue;
    swap.set(raw, swap.get(squash(t.payee)) ?? `Payee ${++n}`);
  }
  return swap;
}

/** A payee of two or more words, as typed and as whole words, inside a longer text (`swap`: payeeSwap); null when there is none. One word alone could be the app's own ("Rent", "Target"). */
function payeesInside(swap, flags = "gu") {
  const long = [...swap.keys()].filter((t) => t.includes(" ")).sort((a, b) => b.length - a.length);
  return long.length ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${long.map(esc).join("|")})(?![\\p{L}\\p{N}_])`, flags) : null;
}
/** Whether a page's result says a payee's text anywhere it could be sent (as a whole text or a key, or inside a text). */
function saysPayee(derived, swap) {
  if (!swap.size) return false;
  const inside = payeesInside(swap, "u");
  let found = false;
  eachText(derived, (s) => { if (!found && (swap.has(squash(s)) || inside?.test(s))) found = true; });
  return found;
}
/**
 * The copy with no payee left in it: every payee, bank text and rule's new payee name that has a stand-in becomes
 * a made-up word of letters, one per stand-in ("Zqa", "Zqb"...; no digit, which the payee pages drop when they
 * compare payees). The texts a page says on this copy are its own words (an account's kind, the budget's Needs,
 * Wants and Savings, a goal's name): a payee typed the same is not what the page means there (sheetFor). Only read
 * for those words: its figures can differ from the page's (Repeat payments groups "Netflix" and "NETFLIX" as one).
 */
export function payeeFree(copy, swap) {
  const c = structuredClone(copy), made = new Map();
  const word = (alias) => { if (!made.has(alias)) { let n = made.size, w = ""; do { w = String.fromCharCode(97 + (n % 26)) + w; n = Math.floor(n / 26) - 1; } while (n >= 0); made.set(alias, `Zq${w}`); } return made.get(alias); };
  const swapped = (t) => (typed(t) && swap.has(squash(t)) ? word(swap.get(squash(t))) : t);
  for (const t of Array.isArray(c?.transactions) ? c.transactions.filter(isObj) : []) { t.payee = swapped(t.payee); t.rawPayee = swapped(t.rawPayee); }
  for (const r of Array.isArray(c?.rules) ? c.rules.filter(isObj) : []) r.payee = swapped(r.payee);
  return c;
}
/** Every text a page's result says where it could be sent, values and keys, spaces tidied. -> Set */
function textsOf(derived) {
  const out = new Set();
  eachText(derived, (s) => { out.add(s); out.add(squash(s)); });
  return out;
}

/**
 * Every other name typed into the plan, swapped in the anonymised copy (changed in place) for a stand-in by kind and
 * order, so the AI never reads a payee, someone outside the household, an address, an employer, a bank or insurer,
 * a serial number, a file name or the plan's own name. Each stand-in is one per name as typed, so the pages'
 * groupings and totals stay the same:
 * - payees stay as typed in the copy, and so does the bank's own text: the pages read them (Subscriptions looks for
 *   "Netflix" in a payee, Transfers for "to" or "transfer", a rule for its words, Repeat payments groups by the
 *   bank's text), so a stand-in there would change their figures. The digest says each payee as its stand-in instead
 *   (payeeAliases, payeeSwap) and the bank's text is never sent (SKIP); so does an account's bank (Home and car
 *   insurance spots a car loan by it); the names come back in the answer from `payeeAliases`;
 * - tags "tag 1"...; custom category names with the names hidden;
 * - people outside the household as `outsiderAliases` names them (a household member's name is their stand-in);
 * - homes, rentals and vehicles "home 1", "rental 1", "vehicle 1" (a loan secured by one names it; any other "secured
 *   by" text is dropped); belongings by kind ("jewelry 1", else "belonging 1"), rooms "room A"... in the same order
 *   (roomLetters), no details, the proof
 *   only as "noted"; a holding by its symbol ("holding 1" without one), keeping "target 2050" or "cash" when that is
 *   how the page knows what it is;
 * - grants, pensions, annuities, policies (by kind: "term life policy 1"), health plans, trips and big days,
 *   reminders (their notes dropped), sales, the payers of tax forms, scenarios, job offers, the business and its
 *   costs, a planned purchase, a renovation project, digital accounts ("login 1"); insurers, the advisor's firm,
 *   contacts' firms and import file names dropped; page notes and the plan's notes only as "noted".
 * `people`: the household's stand-ins (aliases); `others`: outsiderAliases; `terms`: the words to hide in custom
 * category names. -> [{ name, alias, kind: "other" }] to put back in the answer (the payees' too)
 */
export function scrub(copy, { people = [], others = [], terms = [] } = {}) {
  const names = [], counters = {};
  const back = (name, alias) => { if (typed(name) && !names.some((n) => n.alias === alias)) names.push({ name: squash(name), alias, kind: "other" }); return alias; };
  const nth = (noun) => `${noun} ${(counters[noun] = (counters[noun] ?? 0) + 1)}`;
  const named = (x, key, noun) => { if (typed(x[key])) x[key] = back(x[key], nth(noun)); };
  const list = (v) => (Array.isArray(v) ? v.filter(isObj) : []);
  /** One stand-in per text as typed, numbered: "tag 1". */
  const byText = (prefix) => { const m = new Map(); return (t) => { if (!m.has(t)) m.set(t, `${prefix} ${m.size + 1}`); return back(t, m.get(t)); }; };
  const mine = hideTerms(people, [], { surnames: true });
  const away = new Map(others.map((o) => [lower(o.name), o.alias]));
  for (const o of others) { const i = o.alias.lastIndexOf(" "), noun = o.alias.slice(0, i); counters[noun] = Math.max(counters[noun] ?? 0, Number(o.alias.slice(i + 1)) || 0); }
  /** Someone named by text: a household member's stand-in, else the outsider's (a new one of this role if need be); "the estate" stays. */
  const who = (t, role) => {
    const home = homeAlias(t, people, mine);
    if (home) return home;
    if (ESTATE.test(squash(t))) return squash(t);
    if (!away.has(lower(t))) away.set(lower(t), nth(ROLE_NOUNS[role]));
    return back(t, away.get(lower(t)));
  };

  if (isObj(copy.meta)) copy.meta.name = "";
  if (typed(copy.notes)) copy.notes = "noted";
  if (isObj(copy.pageNotes)) for (const k of Object.keys(copy.pageNotes)) if (typed(copy.pageNotes[k])) copy.pageNotes[k] = "noted";
  for (const x of payeeAliases(copy)) back(x.name, x.alias);   // the payees stay as typed: the digest swaps them
  const tag = byText("tag");
  for (const t of list(copy.transactions)) if (Array.isArray(t.tags)) t.tags = t.tags.map((x) => (typed(x) ? tag(x) : x));
  for (const c of list(copy.categories)) if (typed(c.label)) c.label = hide(c.label, terms);
  for (const i of list(copy.imports)) if (typed(i.fileName)) i.fileName = "";

  const homes = new Map();   // a property's name as typed -> its stand-in, for the loan secured by it
  for (const p of list(copy.property)) if (typed(p.name)) { const a = back(p.name, nth(PROPERTY_NOUNS[p.kind] ?? "property")); homes.set(lower(p.name), a); p.name = a; }
  for (const d of list(copy.debts)) if (typed(d.securedBy)) d.securedBy = homes.get(lower(d.securedBy)) ?? "";
  const rooms = [...new Set(list(copy.belongings).map((b) => b.room).filter(typed))].sort((x, y) => x.localeCompare(y));
  for (const b of list(copy.belongings)) {
    named(b, "name", b.kind && b.kind !== "other" ? b.kind : "belonging");
    if (typed(b.room)) b.room = back(b.room, `room ${roomLetters(rooms.indexOf(b.room))}`);
    if (typed(b.details)) b.details = "";
    if (typed(b.proof)) b.proof = "noted";   // the page only asks whether there is one
  }
  for (const h of list(copy.holdings)) {
    if (!typed(h.name)) continue;
    // what the holdings page makes of the name (class, mix, target year; any year will do, it is only compared)
    const read = (name) => ({ ...classify(h.symbol, name, 2000, h.assetClass), name: "" }), was = read(h.name);
    const sym = String(h.symbol ?? "").trim().replace(/\*+$/, "").toUpperCase(), base = sym || back(h.name, nth("holding"));
    h.name = [base, `${base} target ${was.targetYear}`, `${base} cash`].find((n) => JSON.stringify(read(n)) === JSON.stringify(was)) ?? base;
  }

  for (const g of list(copy.equity?.grants)) named(g, "name", "grant");
  for (const x of list(copy.retirement?.pensions)) named(x, "name", "pension");
  for (const x of list(copy.retirement?.annuities)) { named(x, "name", "annuity"); if (typed(x.insurer)) x.insurer = ""; }
  for (const x of list(copy.insurance?.policies)) { named(x, "name", POLICY_NOUNS[x.kind] ?? "policy"); if (typed(x.insurer)) x.insurer = ""; }
  for (const x of list(copy.insurance?.health?.plans)) named(x, "name", "health plan");
  for (const x of list(copy.events)) named(x, "name", EVENT_NOUNS[x.kind] ?? "event");
  for (const x of list(copy.reminders)) { named(x, "name", "reminder"); if (typed(x.note)) x.note = ""; }
  for (const x of list(copy.taxes?.gains)) named(x, "name", "sale");
  const payer = new Map();
  for (const x of list(copy.taxes?.extraDocuments)) if (typed(x.from)) { if (!payer.has(x.from)) payer.set(x.from, back(x.from, nth("payer"))); x.from = payer.get(x.from); }
  for (const x of list(copy.scenarios)) named(x, "name", "scenario");
  if (isObj(copy.advisor) && typed(copy.advisor.firm)) copy.advisor.firm = "";
  const w = isObj(copy.whatIfs) ? copy.whatIfs : {};
  for (const x of list(w.offers?.offers)) named(x, "name", "offer");
  if (isObj(w.business)) { named(w.business, "name", "business"); for (const x of list(w.business.expenses)) named(x, "name", "business cost"); }
  if (isObj(w.purchase)) named(w.purchase, "name", "purchase");
  if (isObj(w.renovation)) named(w.renovation, "project", "project");

  const e = isObj(copy.estate) ? copy.estate : {};
  const byId = new Map(list(copy.household?.people).map((p) => [p.id, p.name]));
  for (const g of list(e.gifts)) if (typed(g.to)) g.to = who(g.to, "person");
  for (const b of list(e.legacy?.bequests)) if (typed(b.to)) b.to = who(b.to, b.kind === "charity" ? "charity" : "person");
  for (const b of list(e.beneficiaries)) for (const side of ["primary", "contingent"]) {
    if (typed(b[side])) b[side] = who(b[side], "person");
    for (const x of list(b[side])) if (typed(x.name)) x.name = byId.get(x.personId) ?? who(x.name, "person");
  }
  for (const i of list(e.inheritance?.items)) if (typed(i.from)) i.from = who(i.from, "giver");
  for (const d of list(e.digital)) {
    // the page warns when a password seems typed in: it reads the notes, never sent, so the warning stays the same
    if (looksSecret(d.name) || looksSecret(d.contact)) d.notes = [d.notes, d.name, d.contact].filter(typed).join(" ");
    named(d, "name", "login");
    if (typed(d.contact)) d.contact = who(d.contact, "contact");
  }
  for (const c of list(copy.contacts)) { if (typed(c.name)) c.name = who(c.name, "contact"); if (typed(c.firm)) c.firm = ""; }
  return [...others.map((o) => ({ name: o.name, alias: o.alias, kind: "other" })).filter((o) => !names.some((n) => n.alias === o.alias)), ...names];
}

/** Every id in the copy (category ids aside: they are words the pages use) -> the name of what it stands for (a stand-in), or null when that has no name. */
function idNames(copy) {
  const ids = new Map();
  const walk = (v, top = false) => {
    if (Array.isArray(v)) { v.forEach((x) => walk(x)); return; }
    if (!isObj(v)) return;
    if (typeof v.id === "string" && v.id && !ids.has(v.id)) ids.set(v.id, typed(v.name) ? squash(v.name) : null);
    for (const [k, x] of Object.entries(v)) if (!(top && k === "categories")) walk(x);
  };
  walk(copy, true);
  return ids;
}

/**
 * A page's compute() result as lines the AI reads: "net worth: 257000", "accounts (10 in all): 1. name checking
 * account 1; balance 4200 ...". Breadth first: the top part's own numbers and short lists of values, then those of
 * every inner part one level down, and so on, then the lists of records in the order they were found, so a big inner
 * part (a tax table) never crowds out the figures of the parts after it. Numbers to the cent, numbers under 1 (rates,
 * shares) to 4 significant digits; yes/no; text cut to MAX_TEXT. Lists of records: how many, then the first MAX_ITEMS
 * one per line (a field with a "<field>Label" beside it gives way to the label); a list sent once is named, not
 * repeated; a long list of numbers: how many, first, last, lowest and highest. Keys in SKIP or ending in "Id"/"Ids"
 * are left out, and so is anything deeper than MAX_DEPTH. `ids` (from the copy): an id used as a key or a value
 * ("balances.<accountId>", "retireAge:<personId>", "from: <personId>") is said as the stand-in of what it names, or
 * left out when that has none; anything else that looks like an app-made id is left out. `swap` (payeeSwap): a text
 * that is a payee as typed (or a bank's text) is said as its stand-in, and a payee of two or more words inside a
 * longer text too (as typed, whole words), unless the text is one of `own`, the page's own words (the texts it says
 * with no payee in the plan, see payeeFree): "Mortgage" as an account's kind stays "Mortgage" when a payee is
 * typed so. `keepDays` false: every date is said without its day (dayless). At most MAX_LINES lines and MAX_CHARS
 * characters, then a line saying more was left out. -> { lines, cut (true when something was left out) }
 */
export function digest(derived, { ids = new Map(), swap = new Map(), own = new Set(), keepDays = true } = {}) {
  const lines = [];
  const seen = new Map();   // a list already sent (as JSON) -> where, so a second copy is named, not repeated
  let chars = 0, over = false;
  const add = (l) => {
    if (over) return;
    if (lines.length >= MAX_LINES || chars + l.length > MAX_CHARS) { over = true; return; }
    lines.push(l); chars += l.length + 1;
  };
  const skip = skipKey;
  const inside = payeesInside(swap);
  const days = (t) => (keepDays ? t : dayless(t));
  /** A key in words; an id key is its stand-in, "lever:<id>" "lever <stand-in>"; null to leave it out. */
  const keyWords = (k) => {
    if (ids.has(k)) return ids.get(k);
    if (swap.has(k) && !own.has(k)) return swap.get(k);
    const i = k.lastIndexOf(":"), tail = k.slice(i + 1);
    if (i > 0 && ids.has(tail)) return ids.get(tail) === null ? null : `${words(k.slice(0, i))} ${ids.get(tail)}`;
    return UUID.test(k) || UUID.test(tail) ? null : words(days(k));
  };
  const said = new Map();   // text -> as sent, worked out once
  const text = (v) => {
    const t = v.replace(/\s+/g, " ").trim();
    if (ids.has(t)) return ids.get(t);
    const mine = own.has(t);   // the page says it with no payee in the plan: its own words, whatever a payee is called
    if (swap.has(t) && !mine) return swap.get(t);
    if (!t || UUID.test(t)) return null;
    return cut(days(inside && !mine ? t.replace(inside, (m) => swap.get(m)) : t), MAX_TEXT);
  };
  const scalar = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? num(v) : null;
    if (typeof v === "boolean") return v ? "yes" : "no";
    if (typeof v === "string") { if (!said.has(v)) said.set(v, text(v)); return said.get(v); }
    return null;
  };
  const values = (x) => Array.isArray(x) && x.every((y) => y === null || y === undefined || scalar(y) !== null);
  /** One record as one line: its plain fields "name Visa card; balance 640", one level of nested fields "rate apr 0.2"; a label ending in a number gets a colon ("balances credit card 1: 6127.47"). */
  const recordLine = (x) => {
    const parts = [], field = (label, s) => `${label}${/\d$/.test(label) ? ":" : ""} ${s}`;
    for (const [k, v] of Object.entries(x)) {
      if (skip(k) || `${k}Label` in x) continue;   // "type salary" adds nothing next to "type label Pay from a job"
      const w = keyWords(k);
      if (w === null) continue;
      const s = scalar(v);
      if (s !== null) { parts.push(field(w, s)); continue; }
      if (isObj(v)) for (const [k2, v2] of Object.entries(v)) { if (skip(k2)) continue; const w2 = keyWords(k2), s2 = scalar(v2); if (w2 !== null && s2 !== null) parts.push(field(`${w} ${w2}`, s2)); }
    }
    return parts.join("; ");
  };
  const recordList = (items, label) => {
    const json = JSON.stringify(items);
    if (seen.has(json)) { add(`${label}: the same ${items.length} as ${seen.get(json)}`); return; }
    seen.set(json, label);
    add(`${label} (${items.length} in all):`);
    items.slice(0, MAX_ITEMS).forEach((x, i) => {
      if (isObj(x)) { const r = recordLine(x); if (r) add(`  ${i + 1}. ${r}`); }
      else if (Array.isArray(x)) add(`  ${i + 1}. a list of ${x.length}`);
      else { const t = scalar(x); if (t !== null) add(`  ${i + 1}. ${t}`); }
    });
    if (items.length > MAX_ITEMS) add(`  and ${items.length - MAX_ITEMS} more`);
  };
  /** A number, a word or a short list of them: said on one line. -> false when it is a part or a list of records. */
  const plain = (v, label) => {
    const s = scalar(v);
    if (s !== null) { if (label) add(`${label}: ${s}`); return true; }
    if (!Array.isArray(v)) return false;
    const items = v.filter((x) => x !== null && x !== undefined);
    if (!items.length) return true;
    if (items.every((x) => typeof x === "number" && Number.isFinite(x))) {
      if (items.length <= 10) add(`${label}: ${items.map(num).join(", ")}`);
      else add(`${label}: ${items.length} values, first ${num(items[0])}, last ${num(items[items.length - 1])}, lowest ${num(Math.min(...items))}, highest ${num(Math.max(...items))}`);
      return true;
    }
    if (values(items)) { const said = items.map(scalar).filter((x) => x !== null); if (said.length) add(`${label}: ${said.slice(0, 10).join(", ")}${said.length > 10 ? ` and ${said.length - 10} more` : ""}`); return true; }
    return false;
  };
  const records = [];   // lists of records, in the order found: [items, label]
  let level = [];
  if (isObj(derived)) level.push([derived, []]);
  else if (Array.isArray(derived) && !plain(derived, "")) records.push([derived.filter((x) => x !== null && x !== undefined), ""]);
  for (let depth = 1; level.length && depth <= MAX_DEPTH + 1; depth++) {
    const next = [];
    for (const [v, path] of level) {
      // a part's own numbers and short lists of values first; its inner parts one level down; its lists of records last
      const keys = Object.keys(v).filter((k) => !skip(k) && keyWords(k) !== null && v[k] !== null && v[k] !== undefined);
      const rank = (x) => (scalar(x) !== null ? 0 : values(x) ? 1 : 2);
      for (const k of keys.map((k, i) => [k, i]).sort((a, b) => rank(v[a[0]]) - rank(v[b[0]]) || a[1] - b[1]).map(([k]) => k)) {
        const p = [...path, keyWords(k)], label = p.join(" › "), x = v[k];
        if (scalar(x) === null && depth > MAX_DEPTH) continue;
        if (plain(x, label)) continue;
        if (isObj(x)) next.push([x, p]);
        else if (Array.isArray(x)) records.push([x.filter((y) => y !== null && y !== undefined), label]);
      }
    }
    level = next;
  }
  for (const [items, label] of records) recordList(items, label);
  if (over) lines.push("(more numbers on the page were left out)");
  return { lines, cut: over };
}

/**
 * The copy of the plan a page is worked out on: anonymise's (people, accounts; goal, income and expense names with
 * the names hidden) with the outsiders' stand-ins, then scrub()'s, so nothing typed reaches a page's own sentences.
 * -> { copy, names (every stand-in with its real name, to put back in the answer), terms (the words hidden in the
 * question: people's names and their parts, outsiders, accounts, and names of two or more words such as an address
 * or a payee, each as its stand-in), swap (payeeSwap: the payees, which stay as typed in the copy, as the digest says
 * them) }
 */
export function copyFor(plan, { today } = {}) {
  const people = aliases(plan, { today });
  const others = outsiderAliases(plan, { today });
  const { plan: copy, names: base, terms: own } = anonymise(plan, { today, outsiders: others });
  const things = scrub(copy, { people, others, terms: own }).filter((t) => !base.some((b) => b.alias === t.alias));
  const keep = (plan.goals ?? []).filter(Boolean).map((g) => String(g.name ?? ""));
  // names of two or more words, the first stand-in for a name winning (an outsider's own, before a rule naming them as a payee)
  const known = new Set(others.map((o) => lower(o.name)));
  const long = things.filter((t) => / /.test(t.name) && !known.has(lower(t.name)) && known.add(lower(t.name)));
  return { copy, names: [...base, ...things], terms: hideTerms(people, accountAliases(plan, { numbered: true }).filter(Boolean), { keep, outsiders: [...others, ...long], surnames: true }), swap: payeeSwap(plan) };
}

/**
 * Everything the AI reads for one page: { lines, names, terms, ok, why, cut }. `run(copy)` runs the page's compute on
 * copyFor's copy (the view passes the module's compute with today's date). The lines are never searched for people's
 * or accounts' names afterwards, so the app's own words ("Will", "Roth IRA", "TX") stay as they are. Two more looks
 * at the page, each only when it can matter, decide what the digest changes:
 * - payees: when the page says a payee's text, it is worked out once more on payeeFree's copy; a text it says there
 *   too is its own word and goes as it is (a payee typed "Mortgage" or "Savings" never turns the mortgage's kind or
 *   the budget's Savings into "Payee 1"); any other payee's text goes as its stand-in;
 * - birth dates: when the page has dates and someone a birth date, it is worked out once more with each birth date
 *   moved a few days in its month (movedBirths); if any date on the page moves, every date on the page goes without
 *   its day, else every date keeps it. Whether the days go depends on the page showing a date worked out from a
 *   birth date, never on which day someone was born, so no missing day points at a birthday (a tax due date on the
 *   15th keeps its day on the tax page, whoever was born on the 15th).
 * A second look that fails counts against sending: the payees go as stand-ins, the dates without their day.
 * why: "error" (the page's compute failed), "empty" (no numbers to explain yet, or the page says it is not ready).
 */
export function sheetFor(plan, run, { today } = {}) {
  const { copy, names, terms, swap } = copyFor(plan, { today });
  const spare = structuredClone(copy);   // for the second looks, whatever the page's compute does with its copy
  let derived;
  try { derived = run(copy); } catch { return { lines: [], names, terms, ok: false, why: "error" }; }
  if (isObj(derived) && typeof derived.error === "string" && Object.keys(derived).length === 1) return { lines: [], names, terms, ok: false, why: "error" };
  if (isObj(derived) && derived.ready === false) return { lines: [], names, terms, ok: false, why: "empty" };
  const again = (c) => { try { return { ok: true, v: run(c) }; } catch { return { ok: false }; } };
  let own = new Set();
  if (saysPayee(derived, swap)) { const b = again(payeeFree(spare, swap)); if (b.ok) own = textsOf(b.v); }
  let keepDays = true;
  const dates = datesIn(derived);
  if (dates.length) {
    const moved = movedBirths(spare, today);
    if (moved === true) keepDays = false;
    else if (moved) { const b = again(moved); keepDays = b.ok && JSON.stringify(datesIn(b.v)) === JSON.stringify(dates); }
  }
  const d = digest(derived, { ids: idNames(copy), swap, own, keepDays });
  const numbers = d.lines.filter((l) => /\d/.test(l)).length;
  return { lines: d.lines, names, terms, ok: numbers > 0, why: numbers > 0 ? null : "empty", cut: d.cut };
}

/** The pages that can be explained: built (usable or partly built), with a compute, not system or AI pages, not NOT_OFFERED. pages: [{ key, group, title, purpose, status, hasCompute }] */
export const explainable = (pages) => (pages ?? []).filter((m) => m && m.hasCompute && (m.status === "usable" || m.status === "stub") && !NOT_GROUPS.has(m.group) && !NOT_OFFERED.has(m.key));

/**
 * The messages for the AI: the page's title and purpose, its numbers, and the person's own question (names in it
 * hidden, cut to MAX_QUESTION characters) or the default: what the page shows, what the main numbers mean, what is
 * worth noticing. -> [{ role, content }]
 */
export function buildMessages({ title, purpose, lines, question = "", terms = [] }) {
  const q = cut(hide(String(question ?? "").replace(/\s+/g, " ").trim(), terms), MAX_QUESTION);
  return [
    { role: "system", content: "You explain one page of a household's money app to someone who is not a finance person. Use only the numbers given and never invent any; do not work out new totals, rates or projections, and say so if a question needs one. Money amounts are in dollars; fractions such as 0.05 are rates (5%). People are called Adult 1, Adult 2, Child 1 and so on; accounts by their kind and a number (credit card 1, 401(k) 2); payees, people outside the household and other names by stand-ins such as Payee 1, Person 1 or home 1. Use those names exactly as written, number included. A date given as a year and a month only (2055-05) has its day left out on purpose. Write in plain words, short sentences, no jargon left unexplained, no product recommendations, at most 200 words. Start with what the page shows, then what the main numbers mean for this household, then one or two things worth noticing." },
    { role: "user", content: `PAGE: ${title}${purpose ? ` (${purpose})` : ""}\nNUMBERS ON THE PAGE:\n${(lines ?? []).map((l) => `- ${l}`).join("\n")}\n\nQUESTION: ${q || "What does this page tell me about my money?"}` },
  ];
}

/** The answer as shown: a reasoning model's <think> part dropped, the real names put back, spaces tidied, cut to MAX_ANSWER. "" when there is nothing. */
export function readAnswer(text, names = []) {
  let s = String(text ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  const end = s.toLowerCase().lastIndexOf("</think>");
  if (end >= 0) s = s.slice(end + 8);
  s = s.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return s ? cut(restore(s, names), MAX_ANSWER) : "";
}

/** compute(plan) -> { ready (anything in the plan to explain: people, accounts, income or expenses) }. */
export function compute(plan) {
  const n = (plan?.household?.people ?? []).length + (plan?.accounts ?? []).length + (plan?.income ?? []).length + (plan?.expenses ?? []).length;
  return { ready: n > 0 };
}
