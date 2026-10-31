// modules/ai/critic/compute.js -- PURE. The plan critic: a fact sheet of what the plan's own pages already work out
// (the health score's seven parts, the next-best-action steps, the will and other legal papers), worked out on a copy
// of the plan in which people are "Adult 1", "Child 1"... and accounts are called by their kind, so the app's own
// sentences never go through a search-and-replace; typed text (goal, income and expense names) has those names swapped
// too. Then the question that asks the AI for the gaps and risks it sees, each tied to a page the facts point to, and
// its answer read back, names put back, pages it may not name dropped.
// The AI explains; nothing it says is saved in the plan or changes a number (AGENTS.md rule 5).
import { compute as computeHealth } from "../../overview/health-score/compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { compute as computeDocs } from "../../estate/documents/compute.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { ageOn } from "../../../core/math/dates.js";

/** At most this many points from the AI, and the longest title and "why" kept (in characters). */
export const MAX_POINTS = 8, MAX_TITLE = 200, MAX_WHY = 600;
export const LEVELS = { high: "Do now", medium: "Do soon", low: "When you can" };
/** Pages the AI may always point to, besides the ones the health score's parts and the next steps link to. */
export const ALWAYS_PAGES = ["estate/documents", "overview/health-score", "overview/next-best-action"];
/** Typed text that names two people of the same name (or first name) gets this instead of either stand-in. */
export const SOMEONE = "someone in the household";
/** Each account kind as the noun the fact sheet uses ("the credit card", "401(k) 2"); other kinds: their label. */
export const KIND_NOUNS = {
  checking: "checking account", savings: "savings account", cash: "cash on hand", brokerage: "brokerage account",
  "401k": "401(k)", ira: "traditional IRA", roth: "Roth account", hsa: "health savings account", "529": "529 plan",
  crypto: "crypto account", property: "property", credit: "credit card", loan: "loan", mortgage: "mortgage", student_loan: "student loan",
  other_liability: "other debt",
};

const STATUS_WORDS = { single: "single", married_joint: "married filing jointly", married_separate: "married filing separately", head_of_household: "head of household", qualifying_surviving: "qualifying surviving spouse" };
const PART_STATUS = { ok: "fine", warn: "needs attention", bad: "a problem" };
const PAPER_LABELS = { hipaa: "Medical records release (HIPAA)" };
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nfc = (s) => String(s ?? "").normalize("NFC");
const chars = (s) => Array.from(String(s)).length;
const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const and = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const peopleOf = (plan) => (plan.household?.people ?? []).filter(Boolean);
/** Whole words only, in any alphabet: "Jo" is not found inside "Joël", "Ana" not inside "Anaïs" or "Anagram". */
const wordsRegExp = (words) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${words.map((w) => `(${esc(w)})`).join("|")})(?![\\p{L}\\p{N}_])`, "giu");
const whichGroup = (args, n) => args.slice(1, n + 1).findIndex((g) => g !== undefined);

/**
 * People's stand-ins, one per person in household order, named or not: adults "Adult 1", "Adult 2"...; a dependent
 * "Child 1"... when under 18 or with no birth date, else "Dependent 1"... -> [{ name (as typed, trimmed), alias, kind }]
 */
export function aliases(plan, { today } = {}) {
  let a = 0, c = 0, d = 0;
  return peopleOf(plan).map((p) => {
    const name = nfc(p.name).trim();
    if (p.role !== "dependent") return { name, alias: `Adult ${++a}`, kind: "person" };
    const age = today && p.birthDate ? ageOn(p.birthDate, today) : null;
    return { name, alias: age === null || age < 18 ? `Child ${++c}` : `Dependent ${++d}`, kind: "person" };
  });
}

/** Accounts' stand-ins, one per account in plan order: "the credit card" when it is the only one of its kind, else "credit card 1", "credit card 2"... */
export function accountAliases(plan) {
  const accounts = plan.accounts ?? [];
  const noun = (a) => KIND_NOUNS[a.type] ?? (ACCOUNT_TYPES[a.type] ? lowerFirst(ACCOUNT_TYPES[a.type].label) : "account");
  const count = {}, seen = {};
  for (const a of accounts) if (a) count[noun(a)] = (count[noun(a)] ?? 0) + 1;
  return accounts.map((a) => {
    if (!a) return null;
    const k = noun(a);
    return { name: nfc(a.name).trim(), alias: count[k] > 1 ? `${k} ${(seen[k] = (seen[k] ?? 0) + 1)}` : `the ${k}`, kind: "account" };
  });
}
/** An account name that says nothing more than its stand-in ("Mortgage" for "the mortgage") is not swapped back. */
const saysNothing = (a) => !a.name || a.alias.toLowerCase().includes(a.name.toLowerCase());

/**
 * The words hidden in typed text, in the order they are tried: people's whole names, then their first names (2 or more
 * letters, when the first name is not someone's whole name; a name two people share becomes SOMEONE), longest first;
 * then account names (2 or more letters; not one that is a person's name, says nothing more than its kind, or is
 * also a goal's name, so a goal called like its account keeps its meaning). -> [{ term, alias }]
 */
export function hideTerms(people, accounts = [], { keep = [] } = {}) {
  const key = (s) => s.toLowerCase();
  const whole = new Map(), first = new Map();
  for (const p of people) {
    if (chars(p.name) < 2) continue;
    const had = whole.get(key(p.name));
    whole.set(key(p.name), { term: p.name, alias: had && had.alias !== p.alias ? SOMEONE : p.alias });
  }
  for (const p of people) {
    const f = p.name.split(/\s+/)[0] ?? "";
    if (f === p.name || chars(f) < 2 || whole.has(key(f))) continue;
    const had = first.get(key(f));
    first.set(key(f), { term: f, alias: had && had.alias !== p.alias ? SOMEONE : p.alias });
  }
  const persons = [...whole.values(), ...first.values()].sort((x, y) => chars(y.term) - chars(x.term));
  const taken = new Set(persons.map((t) => key(t.term)));
  const kept = new Set(keep.map((k) => nfc(k).trim().toLowerCase()));
  const accts = [];
  for (const a of accounts) {
    if (!a || chars(a.name) < 2 || saysNothing(a) || taken.has(key(a.name)) || kept.has(key(a.name))) continue;
    taken.add(key(a.name)); accts.push({ term: a.name, alias: a.alias });
  }
  return [...persons, ...accts.sort((x, y) => chars(y.term) - chars(x.term))];
}

/** Typed text with every term swapped for its stand-in: whole words, any letter case, any alphabet ("Bo's" too). */
export function hide(text, terms = []) {
  const s = nfc(text);
  const list = (terms ?? []).filter((t) => t?.term);
  if (!list.length) return s;
  return s.replace(wordsRegExp(list.map((t) => t.term)), (...args) => list[whichGroup(args, list.length)].alias);
}

/**
 * The stand-ins put back in what the AI wrote, in any letter case: "Adult 1" (or "adult 1") becomes the person's name;
 * an account's stand-in keeps its words and gets the account's name after it: "the credit card (Visa card)".
 * Unnamed people and accounts whose name says nothing more stay as stand-ins.
 */
export function restore(text, names = []) {
  const s = String(text ?? "");
  const list = (names ?? []).filter((n) => n?.alias && String(n.name ?? "").trim() && !(n.kind === "account" && saysNothing(n))).sort((x, y) => y.alias.length - x.alias.length);
  if (!list.length) return s;
  return s.replace(wordsRegExp(list.map((n) => n.alias)), (...args) => {
    const n = list[whichGroup(args, list.length)];
    return n.kind === "account" ? `${args[0]} (${n.name})` : n.name;
  });
}

/**
 * The copy of the plan the fact sheet is worked out on: people named by their stand-in, accounts by theirs, and goal,
 * income and expense names with people's and accounts' names hidden. No number changes, only names.
 * -> { plan (the copy), names: [{ name, alias, kind }] to put back (people with a name, then accounts) }
 */
export function anonymise(plan, { today } = {}) {
  const people = aliases(plan, { today });
  const accounts = accountAliases(plan);
  const terms = hideTerms(people, accounts, { keep: (plan.goals ?? []).filter(Boolean).map((g) => String(g.name ?? "")) });
  const m = structuredClone(plan);
  if (m.household?.people) m.household.people = m.household.people.filter(Boolean).map((p, i) => ({ ...p, name: people[i].alias }));
  if (Array.isArray(m.accounts)) m.accounts = m.accounts.map((a, i) => (a ? { ...a, name: accounts[i].alias } : a));
  for (const key of ["goals", "income", "expenses"]) {
    if (Array.isArray(m[key])) m[key] = m[key].map((x) => (x && typeof x.name === "string" ? { ...x, name: hide(x.name, terms) } : x));
  }
  return { plan: m, names: [...people.filter((p) => p.name), ...accounts.filter((a) => a && a.name)] };
}

/**
 * Plain words for a few builder phrases in the health score's text, until that page says them this way itself (its
 * owner is asked to, see README). A phrase that is no longer there is simply not found.
 */
const PLAIN = [
  [/\bPayments take (\d+)% of gross income/g, "Debt payments take $1% of pay before tax"],
  [/ of gross income\b/g, " of pay before tax"],
  [/ earns these points back fastest\./g, " first helps most."],
  [/The plan can carry about (\S+) a month against the (\S+) it plans \((\d+)%\)\./g, "In retirement your savings could pay about $1 a month; the plan needs $2 ($3%)."],
  [/Life and disability insurance are what close these gaps; the stress tests show how much each shock is short\./g, "Life and disability insurance close these gaps; the Stress tests page shows how short each one is."],
  [/The stress tests show what each shock is short\./g, "The Stress tests page shows how short each one is."],
  [/ more each month \(Goals\)\./g, " more each month (see the Goals page)."],
  [/\bassumptions looked over in the last year/g, "the app's guesses for inflation and investment growth looked over in the last year"],
  [/\bthe score leans on\b/g, "the score needs"],
];
export const plainWords = (text) => PLAIN.reduce((s, [re, to]) => s.replace(re, to), String(text ?? ""));

/** One health-score part as a line: "Debt (fine): ... Could still improve: ..." or "... (a problem): ... To fix: ...". */
export function partLine(p) {
  const fix = p.fix ? ` ${p.status === "ok" ? "Could still improve" : "To fix"}: ${String(p.fix).replace(/^Still to do:\s*/i, "")}` : "";
  return plainWords(`${p.title} (${PART_STATUS[p.status] ?? "not known yet"}): ${p.detail ?? ""}${fix}`).replace(/\s+/g, " ").trim();
}

/** The will and other legal papers as one line: how many are done, then what is missing for whom. */
export function papersLine(d, adultCount) {
  const byKind = new Map();
  for (const x of d.items ?? []) {
    if (x.optional || x.status === "done") continue;
    const k = byKind.get(x.kind) ?? { label: PAPER_LABELS[x.kind] ?? x.label, who: [] };
    if (x.personId) k.who.push(x.personName);
    byKind.set(x.kind, k);
  }
  const groups = new Map();   // "for whom" -> labels, in the order the papers come
  for (const k of byKind.values()) {
    const whom = adultCount < 2 ? "" : !k.who.length ? " for the household" : k.who.length >= adultCount ? " for each adult" : ` for ${and(k.who)}`;
    groups.set(whom, [...(groups.get(whom) ?? []), k.label]);
  }
  const rank = (whom) => (whom === " for the household" ? 2 : whom === "" || whom === " for each adult" ? 0 : 1);
  const ordered = [...groups].sort((x, y) => rank(x[0]) - rank(y[0]));
  return [`Will and other legal papers: ${d.done} of ${d.required} done.`, ...ordered.map(([whom, labels]) => `Missing${whom}: ${and(labels)}.`)].join(" ");
}

/**
 * The fact sheet: plain lines the AI reads, nothing else from the plan. Each line comes from a page that works it out,
 * run on the anonymised copy: the household (stand-ins and ages only), the health score's parts (status, what it
 * found, what would fix it), the next-best-action steps to do now or check, and the will and other legal papers.
 * -> { lines: [string], names: [{ name, alias, kind }], related: [page key], ready }
 * related: the pages those lines point to (the parts' and steps' links) plus ALWAYS_PAGES.
 */
export function factSheet(plan, { today } = {}) {
  const { plan: m, names } = anonymise(plan, { today });
  const people = peopleOf(m);
  const adults = people.filter((p) => p.role !== "dependent"), kids = people.filter((p) => p.role === "dependent");
  const lines = [], related = new Set(ALWAYS_PAGES);
  if (!adults.length) return { lines, names, related: [], ready: false };
  const age = (p) => (today && p.birthDate ? ageOn(p.birthDate, today) : null);
  lines.push(`Household: ${[...adults, ...kids].map((p) => `${p.name}${age(p) !== null ? ` (age ${age(p)})` : ""}`).join(", ")}${STATUS_WORDS[m.household?.filingStatus] ? `; files taxes as ${STATUS_WORDS[m.household.filingStatus]}` : ""}${m.household?.state ? `; lives in ${m.household.state}` : ""}.`);
  const link = (go) => { if (Array.isArray(go) && go.length === 2) related.add(go.join("/")); };
  const safe = (f) => { try { return f(); } catch { return null; } };
  const h = safe(() => computeHealth(m, { today }));
  if (h?.ready) {
    lines.push(`Plan health score: ${h.score} of 100 (${h.band}).`);
    for (const p of h.parts) { lines.push(partLine(p)); link(p.go); }
  }
  const n = safe(() => computeNext(m, { today }));
  for (const s of (n?.steps ?? []).filter((x) => x.status === "now" || x.status === "check")) {
    lines.push(plainWords(`Next step (${s.status === "now" ? "do now" : "check"}): ${s.title}. ${s.detail}`));
    link(s.go);
  }
  const d = safe(() => computeDocs(m, { today }));
  if (d && d.required) {
    lines.push(papersLine(d, adults.length));
    for (const w of d.warnings ?? []) lines.push(`Warning about the legal papers: ${w}`);
  }
  return { lines, names, related: [...related], ready: true };
}

/**
 * The pages the AI may point to: built ones (usable or partly built), not this one; with `related`, only those.
 * pages: [{ key, title, purpose, status }]
 */
export const allowedPages = (pages, related = null) => {
  const only = related ? new Set(related) : null;
  return (pages ?? []).filter((m) => m && m.key !== "ai/critic" && (m.status === "usable" || m.status === "stub") && (!only || only.has(m.key)));
};

/** The question: the fact sheet and the allowed pages in, a JSON list of points out. -> { system, user } */
export function buildPrompt(lines, pages) {
  return {
    system: `You review a household's financial plan for gaps and risks, for someone who is not a finance person. Use only the facts given; never invent numbers or facts. People are called Adult 1, Adult 2, Child 1 and so on, and accounts by their kind; use those same words. Answer with JSON only: an array of at most ${MAX_POINTS} objects {"title": <a short plain sentence naming the gap>, "why": <one or two plain sentences on why it matters, using the facts>, "page": <one page key from the PAGES list where it can be fixed>, "level": "high" | "medium" | "low"}, most important first. No advice to buy a named product. No prose outside the JSON.`,
    user: `FACTS:\n${lines.map((l) => `- ${l}`).join("\n")}\n\nPAGES (key: title, what it does):\n${pages.map((p) => `${p.key}: ${p.title}, ${p.purpose ?? ""}`).join("\n")}`,
  };
}

/** From index `a` (a "["), the index of the bracket that closes it, counting [ ] and { } outside JSON strings; -1 if none. */
function closing(s, a) {
  let depth = 0, inString = false;
  for (let i = a; i < s.length; i++) {
    const ch = s[i];
    if (inString) { if (ch === "\\") i++; else if (ch === '"') inString = false; continue; }
    if (ch === '"') inString = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}
const hasItems = (v) => Array.isArray(v) && (v.length === 0 || v.some((x) => typeof x === "string" || (x && typeof x === "object")));
/**
 * The list in the AI's reply, or null: a reasoning model's <think> part and ``` fences dropped; then the whole reply
 * as JSON (a list, or an object holding one); else the first bracketed list that parses, brackets inside quoted
 * text skipped, trying at most 20 openings; a list wrapped in one more list ([[...]]) unwrapped.
 */
export function findList(text) {
  let s = String(text ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  const end = s.toLowerCase().lastIndexOf("</think>");
  if (end >= 0) s = s.slice(end + 8);
  s = s.replace(/```[\w-]*/g, "").trim();
  const unwrap = (v) => (v.length === 1 && Array.isArray(v[0]) ? v[0] : v);
  try {
    const v = JSON.parse(s);
    const list = Array.isArray(v) ? v : v && typeof v === "object" ? (Object.values(v).find(Array.isArray) ?? (v.title ? [v] : null)) : null;
    if (list) return unwrap(list);
  } catch { /* not JSON as a whole: look inside */ }
  let tries = 0;
  for (let a = s.indexOf("["); a >= 0 && tries < 20; a = s.indexOf("[", a + 1), tries++) {
    const b = closing(s, a);
    if (b < 0) continue;
    try { const v = JSON.parse(s.slice(a, b + 1)); if (hasItems(v)) return unwrap(v); } catch { /* the next opening */ }
  }
  return null;
}

/** Text cut to `max` characters (whole characters, so an emoji is never halved), with "…" when cut. */
export const cut = (t, max) => { const a = Array.from(String(t)); return a.length > max ? a.slice(0, max - 1).join("").trimEnd() + "…" : String(t); };
const str = (v) => (typeof v === "string" || typeof v === "number" ? String(v) : Array.isArray(v) ? v.filter((t) => typeof t === "string").join(" ") : "");

/**
 * The answer read back: at most MAX_POINTS points with a title, in the order given; a plain string counts as a title;
 * "why" optional; a page not in the allowed list becomes null ("#/" and spaces around a key are forgiven); a level
 * other than high/medium/low (any letter case) becomes "medium"; stand-ins put back.
 * -> [{ title, why, page, level }]; [] when the AI sent an empty list (nothing to flag); null when there is no list
 * to read, or none of its entries could be used.
 */
export function readAnswer(text, pages, names = []) {
  const arr = findList(text);
  if (!arr) return null;
  const keys = new Set((pages ?? []).map((p) => p.key));
  const flat = (v) => str(v).replace(/\s+/g, " ").trim();
  const clean = (v, max) => cut(restore(flat(v), names), max);
  const out = [], seen = new Set();
  for (const x of arr) {
    const item = typeof x === "string" ? { title: x } : x;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const key = flat(item.title).toLowerCase();
    if (!key || seen.has(key)) continue;   // untitled, or a repeat (any case, as the AI wrote it)
    seen.add(key);
    const lv = String(item.level ?? "").trim().toLowerCase();
    const pg = String(item.page ?? "").trim().replace(/^#?\/*/, "");
    out.push({ title: clean(item.title, MAX_TITLE), why: clean(item.why, MAX_WHY), page: keys.has(pg) ? pg : null, level: Object.hasOwn(LEVELS, lv) ? lv : "medium" });
    if (out.length >= MAX_POINTS) break;
  }
  return out.length || !arr.length ? out : null;
}

/** compute(plan) -> { ready (an adult in the household), people, adults }. The fact sheet is built only when asked (it runs the health score). */
export function compute(plan) {
  const people = peopleOf(plan);
  const adults = people.filter((p) => p.role !== "dependent").length;
  return { ready: adults > 0, people: people.length, adults };
}
