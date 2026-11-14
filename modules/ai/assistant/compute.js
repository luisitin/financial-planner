// modules/ai/assistant/compute.js -- PURE. Builds the context the model is allowed to
// see: a compact summary, never the raw plan. Extend this carefully; every field added
// here is data sent to whatever model is configured.
//
// A change the helper proposes (gap design #39, 2026-11-14): when the person asks "what if we spend $6,000 a month?", the
// model may end its reply with ONE line `CHANGE: {"lever": ..., "value": ...}` naming a lever from a fixed list (ASK) and a
// value. The app reads that line (readReply), checks the lever and the range itself (propose), works out what it does with
// Scenario compare's own applyChanges and the projection (never a figure of the model's), and only a tap on Apply writes it,
// through Scenario compare's carry (the same writing as "Make this my plan") or one line of "Things that will happen".
import { isGuess } from "../../../core/estimate/index.js";
import { LEVERS, applyChanges, carry } from "../../scenarios/compare/compute.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { outcomeOf, answerOf } from "../../retirement/levers.js";
import { saveHappening, nextId, check as checkHappening, lineWords, homeFacts, listOf, roundMoney, drawSets, AMOUNT_CEILING, MONTHLY_CEILING } from "../../retirement/happenings.js";
import { compute as socialSecurity, ageWords } from "../../retirement/social-security/compute.js";
import { ASSUMPTIONS } from "../../system/assumptions/compute.js";
import { STRATEGIES, EASE_MAX } from "../../../core/math/retirement.js";
import { DESCRIPTIONS } from "../../retirement/withdrawal-strategy/compute.js";
import { NameIn, nameIn, verbFor } from "../../../core/words.js";

/** " (our guess)" after a figure the plan filled in where a box was left empty (core/estimate isGuess), else "" (C5 hand-off H4). */
const ours = (plan, path) => { try { return isGuess(plan, path) ? " (our guess)" : ""; } catch { return ""; } };

export function compute(plan) {
  const people = (plan.household?.people ?? []).map((p) => `${p.name ?? "someone"}${p.age ? ` (${p.age})` : ""}`);
  // a balance or a goal's amount that is our guess says so, so the model never passes it off as the person's own figure
  const accounts = (plan.accounts ?? []).map((a) => `${a.name}: ${a.type}, balance ${Math.round(Number(a.balance) || 0)}${ours(plan, `accounts[${a.id}].balance`)}`);
  const goals = (plan.goals ?? []).map((g) => `${g.name}: target ${g.target ?? "?"}${ours(plan, `goals[${g.id}].target`)} by ${g.targetDate ?? "?"}`);
  const a = plan.assumptions ?? {};
  const summary = [
    `Currency: ${plan.meta?.currency ?? "USD"}.`,
    `Household: ${people.length ? people.join(", ") : "not entered"}.`,
    `Accounts (${accounts.length}): ${accounts.join("; ") || "none"}.`,
    `Goals: ${goals.join("; ") || "none"}.`,
    `Assumptions: inflation ${a.inflation}, stock return ${a.returnStocks}, bond return ${a.returnBonds}, retirement age ${a.retirementAge}, plan to age ${a.planEndAge}.`,
  ].join("\n");
  return { summary, chars: summary.length };
}
export const SYSTEM_PROMPT = `You are the assistant inside a personal financial planning app that runs on the user's own computer.
Rules: be concise and plain; never invent numbers that are not in the context; a figure marked "(our guess)" is a typical figure the app filled in where the person left a box empty, not their own, so say so whenever you use it; when a question needs a calculation, point to the page of the app that does it, using ONLY the page names in the PAGES list (never invent a page name); do not add disclaimers about not being an advisor (the app already shows one).`;
/** The pages the model may name: ready ones only, "Title: purpose" per line. The view passes ctx.modules. */
export function pagesContext(modules) {
  const list = [...(modules?.values?.() ?? [])].filter((m) => m.status && m.status !== "planned").sort((a, b) => a.title.localeCompare(b.title));
  return list.length ? `PAGES (the only page names you may use):\n${list.map((m) => `- ${m.title}: ${m.purpose ?? ""}`).join("\n")}` : "";
}

// ---- a change the helper proposes (gap design #39) --------------------------------------------------------------------------
/** The highest retirement spending a month the plan tries: the ceiling of the box on Will the money last? (projection view SPEND_MONTHLY_CEILING). */
export const SPEND_MAX = 100000;
const leverOf = (key) => LEVERS.find((l) => l.key === key);
const assumed = (key) => { const x = ASSUMPTIONS.find((a) => a.key === key); return { min: x.min, max: x.max }; };
/**
 * The levers the helper may name, and nothing else (test: an unknown lever is refused). The first ten are Scenario compare's
 * LEVERS that "Make this my plan" writes into the plan (its extra saving and fees are what-ifs only there, so not here); the
 * last six are the kinds of "Things that will happen" (gap design #1). `unit`: how `value` is read; `min` / `max`: the range
 * the app tries, from the page that owns the figure (Compare's ages, Assumptions' boxes, happenings.js's ceilings).
 */
export const ASK = Object.freeze({
  spendingMonthly: { unit: "money", min: 1, max: SPEND_MAX },
  retireAge: { unit: "age", person: true, min: leverOf("retireAge").min, max: leverOf("retireAge").max },
  claimAge: { unit: "age", person: true, min: leverOf("claimAge").min, max: leverOf("claimAge").max },
  stocksNow: { unit: "share", min: 0, max: 1 },
  stocksRetired: { unit: "share", min: 0, max: 1 },
  returnStocks: { unit: "rate", ...assumed("returnStocks") },
  returnBonds: { unit: "rate", ...assumed("returnBonds") },
  inflation: { unit: "rate", ...assumed("inflation") },
  spendingEase: { unit: "rate", min: 0, max: EASE_MAX },
  strategy: { unit: "way" },
  in: { unit: "money", happening: true, min: 1, max: AMOUNT_CEILING },
  out: { unit: "money", happening: true, min: 1, max: AMOUNT_CEILING },
  spend: { unit: "signed", happening: true, min: -MONTHLY_CEILING, max: MONTHLY_CEILING },
  after: { unit: "money", happening: true, person: true, min: 1, max: MONTHLY_CEILING },
  less: { unit: "share", happening: true, person: true, min: 0, max: 1 },
  home: { unit: "money", happening: true, min: 1, max: AMOUNT_CEILING },
});
const dollars = (v) => `$${Math.abs(Math.round(Number(v))).toLocaleString("en-US")}`;
const pct = (v) => `${Number((Number(v) * 100).toFixed(1))}%`;
const A = ASK;
/**
 * The pages a card points to: where a change can be made by hand later (WHERE), and the next step of a sentence that says why
 * a change was not tried (`go`). Each is a page that is always there (usable), by its route.
 */
export const PAGES = Object.freeze({
  projection: { title: "Will the money last?", href: "#/retirement/projection" },
  people: { title: "People", href: "#/household/people" },
  ss: { title: "Social Security", href: "#/retirement/social-security" },
  assumptions: { title: "Assumptions", href: "#/system/assumptions" },
  strategy: { title: "How much to take out", href: "#/retirement/withdrawal-strategy" },
});
/** Where each lever's figure is kept, so it can be changed later by hand once Undo has gone (it lasts while the page is open). */
export const WHERE = Object.freeze({
  spendingMonthly: "projection", retireAge: "people", claimAge: "ss", stocksNow: "projection", stocksRetired: "projection",
  returnStocks: "assumptions", returnBonds: "assumptions", inflation: "assumptions", spendingEase: "projection", strategy: "strategy",
  in: "projection", out: "projection", spend: "projection", after: "projection", less: "projection", home: "projection",
});
/** Under the green line after Apply, before the link to the lever's page (WHERE): how long Undo lasts, and where to go after. */
export const LATER_WORDS = "Undo stays here until you leave this page. After that, change it here:";
/** Why a value is not tried, one written sentence per lever, with the next step (the figures are the ranges above). */
export const RANGE_WORDS = Object.freeze({
  spendingMonthly: `That number is outside what the plan can test (${dollars(A.spendingMonthly.min)} to ${dollars(A.spendingMonthly.max)} a month). Ask again with another number.`,
  retireAge: `That age is outside what the plan can test (a whole age from ${A.retireAge.min} to ${A.retireAge.max}). Ask again with another age.`,
  claimAge: `Social Security can start at a whole age from ${A.claimAge.min} to ${A.claimAge.max}. Ask again with an age in that range.`,
  stocksNow: "A share in stocks is from 0% to 100%. Ask again with another share.",
  stocksRetired: "A share in stocks is from 0% to 100%. Ask again with another share.",
  returnStocks: `That number is outside what the plan can test (stocks growing ${pct(A.returnStocks.min)} to ${pct(A.returnStocks.max)} a year). Ask again with another number.`,
  returnBonds: `That number is outside what the plan can test (bonds growing ${pct(A.returnBonds.min)} to ${pct(A.returnBonds.max)} a year). Ask again with another number.`,
  inflation: `That number is outside what the plan can test (prices rising ${pct(A.inflation.min)} to ${pct(A.inflation.max)} a year). Ask again with another number.`,
  spendingEase: `That number is outside what the plan can test (spending 0% to ${pct(A.spendingEase.max)} less each year as you age). Ask again with another number.`,
  strategy: "That is not one of the ways of taking money out the plan knows. Ask again naming one of the ways on How much to take out.",
  in: `That amount is outside what the plan can test (money coming in of ${dollars(A.in.min)} to ${dollars(A.in.max)}). Ask again with another amount.`,
  out: `That amount is outside what the plan can test (a cost of ${dollars(A.out.min)} to ${dollars(A.out.max)}). Ask again with another amount.`,
  spend: `That amount is outside what the plan can test (spending up or down by ${dollars(1)} to ${dollars(A.spend.max)} a month). Ask again with another amount.`,
  after: `That amount is outside what the plan can test (pay of ${dollars(A.after.min)} to ${dollars(A.after.max)} a month). Ask again with another amount.`,
  less: "The share of the usual pay kept is from 0% to 100%. Ask again with another share.",
  home: `That price is outside what the plan can test (a next home of ${dollars(A.home.min)} to ${dollars(A.home.max)}). Ask again with another price.`,
});
/** The other reasons a proposal is not tried, each a written sentence with the next step ("Will the money last?" ends a clause, never a sentence). */
export const NOT_TRIED = Object.freeze({
  nobody: "This change was not tried: the plan has no one on the People page yet. Add yourself there first, then ask again.",
  stranger: "This change was not tried: it names someone who is not in the plan. Ask again with the name of someone on the People page.",
  basics: "This change cannot be tried yet. Fill in the basics on Will the money last? first, then ask again.",
  rent: "This change was not tried. Selling to rent needs the rent a month: set it on Will the money last? under Things that will happen.",
  year: (from, to) => `This change was not tried: it needs a year. Ask again with a year from ${from} to ${to}, when the plan ends.`,
  check: (words) => `This change was not tried. ${words}`,
  claimed: (name) => `This change was not tried: ${nameIn(name)} already ${verbFor(name, "gets", "get")} Social Security, so the age it starts is set.`,
});
/** A CHANGE line the app cannot use: a lever not in ASK, more than one line, or one that is not a JSON object. */
export const UNKNOWN_WORDS = "The app could not turn this into one change it can test, so nothing was tried.";
/** The effect, when the plan cannot be run yet: no Apply then (nothing could be checked), only the next step. */
export const BASICS_WORDS = "What it does cannot be worked out yet. Fill in the basics on Will the money last? first, then ask again.";
/** Under a change of spending, when the plan's way of taking money out sets spending from what is saved (happenings.js drawSets). */
export const SETS_OWN_WORDS = "Your way of taking money out sets spending from what is saved, so a change of spending does little here (How much to take out).";
/** What the card says when the plan already has the value. */
export const ALREADY_WORDS = "Your plan already has this, so there is nothing to change.";
/** The line under every card: whose figure it is (AGENTS.md rule 5). */
export const TRUST_WORDS = "Worked out by the app from your plan, assuming markets do about average. The helper only suggested the change.";
/**
 * Under a change of spending while the plan's figure is Get started's own (`guide.setup.retireAuto`): Apply also makes it the
 * household's own figure (Compare's lever, as when it is typed on Will the money last?), so it stops following today's bills.
 */
export const AUTO_WORDS = Object.freeze({
  before: "Today this figure follows your bills (Get started set it). With this change it stays where you put it, and the plan still adds health insurance on top.",
  included: "Today this figure follows your bills (Get started set it). With this change it stays where you put it, health insurance included, as you said.",
});
/** The green line after Undo (ui.undoneWords adds the case where something was changed again since). */
export const UNDONE_WORDS = "Undone. Your plan is as it was before this change.";

const isWay = (v) => typeof v === "string" && Object.hasOwn(STRATEGIES, v) && Object.hasOwn(DESCRIPTIONS, v);
const yearOf = (today) => Number(String(today ?? "").slice(0, 4)) || new Date().getFullYear();
const lowerFirst = (t) => (/^(Sell|You|Your|Spending)\b/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
/** A year the helper gave: a whole number from 1900 to 2300, else null. */
const asYear = (v) => { const n = typeof v === "string" ? Number(v.trim()) : v; return Number.isInteger(n) && n >= 1900 && n <= 2300 ? n : null; };
const given = (v) => v !== undefined && v !== null && v !== "";

/**
 * valueOf(raw, unit) -> the value as the app reads it, or null. A number, or a string of one ("6,000", "$6,000", "5%").
 *   money, signed  whole dollars: Math.round(v)
 *   rate, share    a fraction; a figure written with "%", or above 1 and at most 100 in size, is a percentage and is / 100
 *                  ("5" and "5%" both read 0.05; 0.05 stays 0.05; exactly 1 is 100%)
 *   age            as given (it must be whole: checked with the range)
 *   way            the word, trimmed
 */
export function valueOf(raw, unit) {
  if (unit === "way") return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  let v = raw, percent = false;
  if (typeof v === "string") {
    const s = v.trim();
    percent = s.endsWith("%");
    const bare = s.replace(/[$,%\s]/g, "");
    if (!/^[-+]?\d+(\.\d+)?$/.test(bare)) return null;
    v = Number(bare);
  }
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (unit === "rate" || unit === "share") return Number(((percent || (Math.abs(v) > 1 && Math.abs(v) <= 100)) ? v / 100 : v).toPrecision(12));
  if (unit === "money" || unit === "signed") return Math.round(v);
  return v;
}

/**
 * readReply(content) -> { text, asked }: the reply as the person reads it, and the change it names (the object of its one
 * `CHANGE: {...}` line, from its first "{" to its last "}", with any bold, italic or code marks around it) or null. Every CHANGE line is taken out of `text` (with a code fence left empty by it); with none,
 * `text` is the reply exactly as it came and `asked` is null. Two or more CHANGE lines, or one that is not a JSON object:
 * `asked` is `{}`, which names no lever, so propose says in one line that nothing was tried (UNKNOWN_WORDS).
 */
const CHANGE_LINE = /^[\s>*_`-]*CHANGE[*_]*\s*:[*_\s`]*(\{.*\})?/i;
export function readReply(content) {
  const text = String(content ?? "");
  const found = [], keep = [];
  for (const line of text.split(/\r?\n/)) {
    const m = CHANGE_LINE.exec(line);
    if (m?.[1]) found.push(m[1]); else keep.push(line);
  }
  if (!found.length) return { text, asked: null };
  const shown = keep.join("\n").replace(/```[a-z]*\s*```/gi, "").replace(/\n{3,}/g, "\n\n").trim();
  let asked = {};
  if (found.length === 1) {
    try { const o = JSON.parse(found[0]); asked = o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch { asked = {}; }
  }
  return { text: shown, asked };
}

/** The adult a person lever is about: the helper's "who" (an id or a first name; "me", "I", "you" or nothing: the first adult). */
function whoOf(plan, asked) {
  const adults = (plan.household?.people ?? []).filter((p) => p && p.role !== "dependent");
  if (!adults.length) return { words: NOT_TRIED.nobody };
  const self = adults.find((p) => p.role === "self") ?? adults[0];
  const raw = asked.who ?? asked.personId ?? asked.person;
  const want = typeof raw === "string" ? raw.trim() : "";
  if (!want) return { id: self.id };
  const low = want.toLowerCase(), name = (p) => String(p.name ?? "").trim().toLowerCase();
  const hit = adults.find((p) => p.id === want) ?? adults.find((p) => name(p) === low) ?? adults.find((p) => name(p).split(/\s+/)[0] === low)
    ?? (["me", "i", "you", "myself", "self"].includes(low) ? self : null);
  return hit ? { id: hit.id } : { words: NOT_TRIED.stranger };
}
const nameOfId = (plan, id) => (plan.household?.people ?? []).find((p) => p.id === id)?.name;

/** The plan's own value of a plan lever (what Will the money last? and its pages show), or null when it has none of its own. */
function currentOf(plan, key, personId, today) {
  if (key === "spendingMonthly") {
    if (!(Number(plan.retirement?.spendingMonthly) > 0)) return null;   // it follows today's expenses
    let b = null;
    try { b = buildInputs(plan, { today, happenings: false }); } catch { b = null; }
    return Math.round(b?.figureMonthly ?? Number(plan.retirement.spendingMonthly));
  }
  if (key === "claimAge") return claimOf(plan, personId, today)?.claimAge ?? leverOf(key).get(plan, personId);
  return leverOf(key).get(plan, personId);
}
/**
 * The age the plan starts a person's Social Security at, as the projection counts it (social-security compute's people[]):
 * with no age saved, the full retirement age for the birth year (66 and 8 months for 1958), not Compare's 67.
 * `claimed`: already paid it. Null when that page cannot read the plan.
 */
function claimOf(plan, personId, today) {
  try { return socialSecurity(plan, { today }).people.find((x) => x.id === personId) ?? null; } catch { return null; }
}
const sameValue = (key, a, b) => (key === "strategy" ? a === b : a !== null && a !== undefined && Math.abs(Number(a) - Number(b)) < (ASK[key].unit === "money" ? 0.5 : 1e-9));

/**
 * changeWords(plan, p, { money }) -> "Change: ..." — the change in words, one written sentence per lever (and per case of
 * the plan's own value). `p`: propose's proposal (lever, value, now, personId, rec).
 */
export function changeWords(plan, p, { money = dollars } = {}) {
  const v = p.value, now = p.now, name = nameOfId(plan, p.personId);
  switch (p.lever) {
    case "spendingMonthly": return now === null
      ? `Change: spend ${money(v)} a month in retirement, in today's dollars, instead of what you spend today.`
      : `Change: spend ${money(v)} a month in retirement instead of ${money(now)}, in today's dollars.`;
    case "retireAge": return `Change: ${NameIn(name).replace(/^You\b/, "you")} ${verbFor(name, "stops", "stop")} work at ${v} instead of ${now}.`;
    case "claimAge": return `Change: ${NameIn(name).replace(/^You\b/, "you")} ${verbFor(name, "starts", "start")} Social Security at ${v} instead of ${ageWords(now)}.`;
    case "stocksNow": return `Change: ${pct(v)} in stocks now instead of ${pct(now)}.`;
    case "stocksRetired": return `Change: ${pct(v)} in stocks once retired instead of ${pct(now)}.`;
    case "returnStocks": return `Change: stocks grow ${pct(v)} a year instead of ${pct(now)}.`;
    case "returnBonds": return `Change: bonds grow ${pct(v)} a year instead of ${pct(now)}.`;
    case "inflation": return `Change: prices rise ${pct(v)} a year instead of ${pct(now)}.`;
    case "spendingEase": return v > 0
      ? `Change: spend ${pct(v)} less each year as you age, in today's dollars, instead of ${now > 0 ? `${pct(now)} less` : "the same every year"}.`
      : `Change: spend the same every year as you age, instead of ${pct(now)} less each year.`;
    case "strategy": return `Change: take money out by "${DESCRIPTIONS[v].name}" instead of "${DESCRIPTIONS[now].name}".`;
    case "in": case "out": {
      // a line of the same kind that year is already in the plan: this one adds to it, never replaces it
      const had = listOf(plan).filter((h) => h.kind === p.lever && Number(h.year) === p.rec.year).reduce((t, h) => t + (Number(h.amount) || 0), 0);
      const top = had > 0 ? `, on top of the ${money(had)} already in your plan that year` : "";
      return p.lever === "in" ? `Change: ${money(v)} ${had > 0 ? "more " : ""}comes into savings in ${p.rec.year}, in today's dollars${top}.`
        : `Change: a cost of ${money(v)} ${had > 0 ? "more " : ""}comes out of savings in ${p.rec.year}, in today's dollars${top}.`;
    }
    case "home": return listOf(plan).some((h) => h.kind === "home")
      ? `Change: ${lowerFirst(lineWords(p.rec, { money }))}, in today's dollars, in place of the home sale already in the plan.`
      : `Change: ${lowerFirst(lineWords(p.rec, { money }))}, in today's dollars.`;
    case "spend": return `Change: ${lowerFirst(lineWords(p.rec, { money }))}, in today's dollars.`;
    case "after": return `Change: ${lowerFirst(lineWords(p.rec, { people: plan.household?.people ?? [], money }))}, in today's dollars.`;
    case "less": return `Change: ${lowerFirst(lineWords(p.rec, { people: plan.household?.people ?? [], money }))}.`;
    default: return "";
  }
}

/**
 * effectWords(withIt, now, money) -> what the change does, against the plan as it is, at average markets: one written sentence
 * per case (levers.js outcomeOf's shape: { lasts, age, endAge, endReal }).
 */
export function effectWords(w, now, money = dollars) {
  if (!w || !now) return BASICS_WORDS;
  // "you would run out of money at 62": about the money, never read as the age work stops
  if (!w.lasts && !now.lasts) return w.age === now.age ? `With this change, you would still run out of money at ${w.age}.` : `With this change, you would run out of money at ${w.age} instead of ${now.age}.`;
  if (w.lasts && !now.lasts) return `With this change, the money would last to the end (age ${w.endAge}) instead of running out at ${now.age}.`;
  if (!w.lasts) return `With this change, you would run out of money at ${w.age} instead of it lasting to the end (age ${now.endAge}).`;
  const diff = w.endReal - now.endReal, r = roundMoney(Math.abs(diff));
  if (r < 100) return `With this change, the money still lasts to the end, with about the same left at ${w.endAge}.`;
  return diff > 0
    ? `With this change, the money still lasts to the end, with about ${money(r)} more left at ${w.endAge}, in today's dollars.`
    : `With this change, the money still lasts to the end, with about ${money(r)} less left at ${w.endAge}, in today's dollars.`;
}
/** The green line after Apply, naming the new answer (OPTIONAL.md R7): one written sentence per case. */
export function doneWords(answer, money = dollars) {
  if (!answer) return "Done. Will the money last? shows what it does once the plan has a few basics.";
  if (!answer.lasts) return `Done. If markets do about average, you now run out of money at ${answer.age}.`;
  const left = roundMoney(answer.endReal);
  return left >= 100
    ? `Done. If markets do about average, the money now lasts to the end (age ${answer.endAge}), with about ${money(left)} left in today's dollars.`
    : `Done. If markets do about average, the money now lasts to the end (age ${answer.endAge}).`;
}

/**
 * propose(plan, asked, { today, money }) -> null | { lever, refused } | { lever, value, already } | proposal
 *   null       nothing to show: no change named (no object)
 *   refused    { lever, refused, go? }: the one sentence why it was not tried, with its next step, and the key of the page that
 *              step is on (PAGES): a lever not in ASK (UNKNOWN_WORDS, lever null), a value outside the lever's range, a person
 *              not in the plan, someone already paid Social Security, a year outside the plan (happenings.js check), a plan
 *              that cannot be run yet for a thing that happens
 *   already    the plan has that value now: nothing to apply
 *   basics     { lever, value, personId?, now, change, effect: BASICS_WORDS, basics: true, go: "projection" }: a plan lever on a
 *              plan that cannot be run yet. Nothing could be checked, so nothing can be applied (no `changes`)
 *   proposal   { lever, value, personId?, now, changes (Scenario compare's `changes`) | rec (a "Things that will happen" line
 *              without an id), with, before (outcomeOf at average markets), change, effect, note? (SETS_OWN_WORDS: a change
 *              of spending under a way of taking money out that sets its own spending; AUTO_WORDS: a change of spending
 *              while the figure is Get started's own, which Apply makes the household's) }
 * The effect is the app's own: Scenario compare's applyChanges on a copy of the plan, then one projection (levers.js
 * outcomeOf), against the plan as it is (answerOf). Work after retiring and spending that changes for some years have no
 * Compare key: their line is put into a copy of the plan, which is then run the same way. The plan is never changed here.
 */
export function propose(plan, asked, { today = null, money = dollars } = {}) {
  if (!asked || typeof asked !== "object" || Array.isArray(asked)) return null;
  const key = typeof asked.lever === "string" ? asked.lever.trim() : "";
  if (!Object.hasOwn(ASK, key)) return { lever: null, refused: UNKNOWN_WORDS };
  const a = ASK[key];
  const no = (words, go) => ({ lever: key, refused: words, ...(go ? { go } : {}) });
  const value = valueOf(asked.value, a.unit);
  if (key === "home" && value === 0) return no(NOT_TRIED.rent, "projection");
  if (a.unit === "way" ? !isWay(value) : value === null || value < a.min || value > a.max || (a.unit === "age" && !Number.isInteger(value)) || (key === "spend" && value === 0)) return no(RANGE_WORDS[key]);
  let personId;
  if (a.person) { const w = whoOf(plan, asked); if (!w.id) return no(w.words, "people"); personId = w.id; }
  // someone already paid Social Security has no start age left to choose (the projection counts what is paid)
  if (key === "claimAge" && claimOf(plan, personId, today)?.claimed) return no(NOT_TRIED.claimed(nameOfId(plan, personId)), "ss");
  let p;
  if (!a.happening) {
    const now = currentOf(plan, key, personId, today);
    const changes = { [a.person ? `${key}:${personId}` : key]: value };
    p = { lever: key, value, personId, now, changes };
    if ((now !== null && sameValue(key, now, value)) || !carry(plan, changes, { today }).carried.length) return { lever: key, value, already: ALREADY_WORDS };
  } else {
    let b = null;
    try { b = buildInputs(plan, { today, happenings: false }); } catch { b = null; }
    if (!b?.inputs) return no(NOT_TRIED.basics, "projection");
    const nowYear = b.inputs.startYear, endYear = b.inputs.endYear;
    const year = given(asked.year) ? asYear(asked.year) : key === "in" || key === "out" ? nowYear : null;
    if (year === null) return no(NOT_TRIED.year(nowYear, endYear));
    const until = given(asked.until ?? asked.untilYear) ? asYear(asked.until ?? asked.untilYear) : null;
    if (until === null && given(asked.until ?? asked.untilYear)) return no(NOT_TRIED.year(nowYear, endYear));
    const rec = key === "in" || key === "out" ? { kind: key, year, amount: value }
      : key === "spend" ? { kind: "spend", year, untilYear: until, monthly: value }
      : key === "after" ? { kind: "after", personId, year, untilYear: until ?? year, monthly: value }
      : key === "less" ? { kind: "less", personId, year, untilYear: until ?? year, share: value }
      : { kind: "home", year, buyFor: value };
    const bad = checkHappening(rec, { nowYear, endYear, people: b.inputs.people ?? [], hasHome: key !== "home" || !!homeFacts(plan, { today }) });
    if (bad) return no(NOT_TRIED.check(bad.words));
    const changes = key === "in" ? { lumpSum: value, lumpYear: year } : key === "out" ? { lumpSum: -value, lumpYear: year }
      : key === "home" ? { homeYear: year, homeBuyFor: value }
      : key === "less" ? { lessWho: personId, lessFrom: year, lessUntil: rec.untilYear, lessShare: value } : null;
    p = { lever: key, value, personId, now: null, rec, ...(changes ? { changes } : {}) };
  }
  const before = answerOf(plan, { today }), withIt = withChange(plan, p, today);
  const change = changeWords(plan, p, { money });
  // nothing could be worked out: the change is said, with the next step, and there is nothing to apply
  if (!before || !withIt) return { lever: key, value, personId, now: p.now, change, effect: BASICS_WORDS, basics: true, go: "projection" };
  const sets = ["spendingMonthly", "spendingEase", "spend"].includes(key) && drawSets(leverOf("strategy").get(plan)) ? SETS_OWN_WORDS : null;
  // Compare's spending lever, under Get started's own figure, also makes the figure the household's (it stops following the bills)
  const auto = key === "spendingMonthly" && plan.guide?.setup?.retireAuto === true ? (plan.retirement?.healthIncluded === true ? AUTO_WORDS.included : AUTO_WORDS.before) : null;
  const note = [sets, auto].filter(Boolean).join(" ");
  return { ...p, with: withIt, before, change, effect: effectWords(withIt, before, money), ...(note ? { note } : {}) };
}
/** The answer with the change, at average markets: Scenario compare's applyChanges, or the plan with the one line in it. */
function withChange(plan, p, today) {
  if (p.changes) { const r = applyChanges(plan, p.changes, { today }); return r.inputs ? outcomeOf(r.inputs) : null; }
  const copy = JSON.parse(JSON.stringify(plan));
  saveHappening(copy, { ...p.rec, id: nextId(copy) });
  return answerOf(copy, { today });
}
/**
 * applyProposal(draft, p, { today }) -> true when it wrote: makes the proposal's one change in a store.update draft.
 * A plan lever and the lines Compare knows go through Scenario compare's carry (the writing of "Make this my plan", so the
 * plan then gives the card's answer); work after retiring and a spending change are one line of "Things that will happen".
 */
export function applyProposal(draft, p, { today = null } = {}) {
  if (!p || p.refused || p.already || p.basics || !(p.changes || p.rec)) return false;
  if (p.changes) {
    const c = carry(draft, p.changes, { today });
    if (!c.carried.length) return false;
    c.write(draft);
    return true;
  }
  saveHappening(draft, { ...p.rec, id: nextId(draft) });
  return true;
}
/** The answer on Will the money last? for a plan, at average markets (levers.js answerOf): for the green line after Apply. */
export const answerFor = (plan, { today = null } = {}) => answerOf(plan, { today });

/**
 * changesContext(plan) -> the CHANGES part of the system message: the levers the model may name, how to write the one line,
 * and the first names of the plan's adults (already in PLAN CONTEXT). No figure of the plan is in it.
 */
export function changesContext(plan) {
  const names = (plan?.household?.people ?? []).filter((p) => p && p.role !== "dependent" && p.name).map((p) => p.name);
  const ways = Object.keys(DESCRIPTIONS).filter(isWay).map((k) => `${k} (${DESCRIPTIONS[k].name})`).join(", ");
  return [
    "CHANGES: when the person asks what would happen if ONE thing in the list below changed, say in a sentence or two what that change is, but do not work out what it does to their money: the app works that out from the plan and shows it under your reply, with a button to make the change. Then end your reply with one line in exactly this form, and nothing after it:",
    'CHANGE: {"lever": "<a name from the list>", "value": <a number, or the word for strategy>}',
    `Add "who": "<first name>" for a change about one person${names.length ? ` (${names.join(", ")})` : ""}. Add "year" (and "until" for the last year) for something that happens. Money is in today's dollars. A percentage is a fraction: 5% is 0.05. Write no CHANGE line when the person asks no such question, and never more than one.`,
    "- spendingMonthly: what is spent a month in retirement",
    `- retireAge (who): the age a person stops work, ${A.retireAge.min} to ${A.retireAge.max}`,
    `- claimAge (who): the age a person starts Social Security, ${A.claimAge.min} to ${A.claimAge.max}`,
    "- stocksNow: the share in stocks now",
    "- stocksRetired: the share in stocks once retired",
    "- returnStocks: how much stocks grow a year",
    "- returnBonds: how much bonds grow a year",
    "- inflation: how much prices rise a year",
    `- spendingEase: how much less is spent each year with age, 0 to ${A.spendingEase.max}`,
    `- strategy: how money is taken out, one of: ${ways}`,
    "- in (year): money coming in once, in dollars",
    "- out (year): a big cost once, in dollars",
    "- spend (year, until): spending that goes up (+) or down (-) by this much a month for some years; no until means for good",
    "- after (who, year, until): work after retiring, pay a month",
    "- less (who, year, until): work less or take a break, the share of the usual pay kept (0 for a break, 0.5 for half-time)",
    "- home (year): sell the home and buy one for this price",
  ].join("\n");
}
