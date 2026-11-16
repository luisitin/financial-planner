// modules/cashflow/income/one-figure.js -- PURE. "One figure or item by item" on Income (gap list, next 60, item 11; research
// Ux8): a kind of income of one person (a SECTION: Bo's business income, Dividends and interest) kept as one figure, typed and changed
// in one place, or listed source by source. Going to one figure replaces the section's lines with one line holding their
// total (after a question, with Undo); going back to item by item keeps that one line as the first of the list. The choice
// is the optional mark `income[].oneFigure` (docs/DATA_MODEL.md); no total reads it.
//
// A section is one KIND of one PERSON, and a line joins the one kept only when it is paid on the same schedule, with the same
// raise, dates, tax and payday (README "One figure or item by item"): the retirement plan reads pay by person and dates, the
// tax pages by kind, person and tax, Next year by the raise, the Forecast and the paydays by the schedule. Lines alike in all
// of that give every page the same answer as one line with their total. Pay from a job is never put together: two jobs are
// two employers, and Paycheck takes Social Security and the extra Medicare from each employer's pay on its own (up to the
// wage base each), so one line for two jobs would change take-home pay above the wage base (seen on the invented
// high-earning household). Rent, a pension and Social Security are never put together either (other pages match them line
// by line: Rental analysis by name and amount, Pensions by amount, Social Security by person), nor a one-time amount.
// The retirement plan also reads the NAME of support and other income (projection otherIncome): child support stops when the
// child it names (or the youngest) turns 18, money named as coming out of the household's own accounts is never added on top,
// and How much to take out names pensions and Social Security by their words. A support or other line whose name says any of
// that stays on its own, and the put-together line's own name is never one the plan reads (`sectionName`: "Sofia's support
// or gifts" names a child, so a dependent's lines become "Sofia's gifts and help"), so it is read as each line was.
import { perMonth, PERIODS } from "../../../core/math/periods.js";
import { isGuess } from "../../../core/estimate/index.js";
import { ownAccountMoney } from "../../retirement/projection/compute.js";

/** The kinds a person can keep as one figure. */
export const ONE_FIGURE_KINDS = Object.freeze(["bonus", "business", "investment", "support", "other"]);
const NAMES = { bonus: "Bonus", business: "Business income", investment: "Dividends and interest", support: "Support or gifts", other: "Other income" };
const people = (plan) => (Array.isArray(plan?.household?.people) ? plan.household.people : []);
const lines = (plan) => (Array.isArray(plan?.income) ? plan.income : []).filter((x) => x && typeof x === "object");
const whoOf = (x) => (typeof x?.personId === "string" ? x.personId : "");
const periodOf = (x) => (PERIODS[x?.period] ? x.period : "monthly");
/** "Ana's", "My" (the person named "Me"), or null (the household's, or a person not on file). */
export function possessive(plan, id) {
  const p = id ? people(plan).find((y) => y && y.id === id) : null;
  if (!p) return null;
  const n = String(p.name ?? "").trim();
  return !n ? null : n === "Me" ? "My" : `${n}'s`;
}
/** sectionKey(line) -> "type|personId", or null (a kind never put together, or a one-time amount). */
export function sectionKey(x) {
  if (!x || !ONE_FIGURE_KINDS.includes(x.type) || periodOf(x) === "once") return null;
  return `${x.type}|${whoOf(x)}`;
}
const partsOf = (key) => { const [type, personId] = String(key).split("|"); return { type, personId: personId ?? "" }; };
/**
 * "Ana's bonus", "My business income", "Dividends and interest": the kind's name, which the put-together line takes. Never a
 * name the retirement plan reads (`nameRead`; review 2026-11-16, F1): "Sofia's support or gifts", with "support" and a
 * dependent's first name, would be child support there and stop when Sofia turns 18, so it is "Sofia's gifts and help", else
 * the kind's name alone ("Gifts and help" and "Other income" say nothing to the plan).
 */
export function sectionName(plan, key) {
  const { type, personId } = partsOf(key);
  const base = NAMES[type] ?? "Income";
  const who = possessive(plan, personId);
  const low = (x) => `${x[0].toLowerCase()}${x.slice(1)}`;
  const alt = type === "support" ? "Gifts and help" : null;
  const tries = [...(who ? [`${who} ${low(base)}`, ...(alt ? [`${who} ${low(alt)}`] : [])] : []), base, ...(alt ? [alt] : [])];
  return tries.find((name) => !nameRead(plan, { type, name })) ?? base;
}
/** "One figure for Ana's business income" / "...for your dividends and interest" (the section's name, as the line is called). */
export function sectionNoun(plan, key) {
  const name = sectionName(plan, key);
  const who = possessive(plan, partsOf(key).personId);
  return who && name.startsWith(`${who} `) ? name : `your ${name[0].toLowerCase()}${name.slice(1)}`;
}

// ---- what else the plan keeps under a line's id (a scan, so a new place is never missed)
const PLACES = { "whatIfs.salary": "Salary keeps its raises under it", "whatIfs.sideIncome": "Side income keeps its months under it",
  "whatIfs.business": "Small business works from it", guide: "it is an answer in Get started" };
const OTHER_PLACE = "another page keeps something about it";
// a line whose id is missing or shared with another line: the plan cannot say which line a change is for (review 2026-11-16,
// F3: two lines with the id "x" put together removed both)
const SAME_ID = "the app cannot tell it apart from another income on your list";
const SKIP = new Set(["income", "guesses", "meta", "schemaVersion"]);
const placeOf = (path) => (["whatIfs", "retirement", "taxes"].includes(path[0]) && path[1] ? `${path[0]}.${path[1]}` : path[0]);
/**
 * pointedAt(plan, id) -> the places outside `income` that hold this line's id: as a value anywhere, or as a key under
 * `whatIfs` (Salary's and Side income's records are kept by a line's id). Each place once.
 */
export function pointedAt(plan, id) {
  if (typeof id !== "string" || !id) return [];
  const found = new Set();
  const walk = (x, path, keys) => {
    if (typeof x === "string") { if (x === id) found.add(placeOf(path)); return; }
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) { for (const y of x) walk(y, path, keys); return; }
    for (const [k, v] of Object.entries(x)) { if (keys && k === id) found.add(placeOf([...path, k])); walk(v, [...path, k], keys); }
  };
  for (const [k, v] of Object.entries(plan ?? {})) if (!SKIP.has(k)) walk(v, [k], k === "whatIfs");
  return [...found];
}
const isSetup = (id) => typeof id === "string" && id.startsWith("setup-");
// the retirement plan's own reading of a support or other line's name (projection otherIncome childSupport, CHILD_WORDS; every
// dependent counted, so the check is never narrower than the plan's)
const CHILD_WORDS = /\b(child|children|kids?)\b/i;
const NAMED_INCOME = /\b(pension|social security)\b/i;
/** nameRead(plan, line) -> why the retirement plan reads this support or other line by its name, or null. */
export function nameRead(plan, x) {
  if (!["support", "other"].includes(x?.type)) return null;
  const n = String(x.name ?? "");
  if (ownAccountMoney(n)) return "its name says it is money from your own accounts";
  const words = n.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const namesChild = people(plan).some((p) => p && p.role === "dependent" && words.includes(String(p.name ?? "").trim().split(/\s+/)[0].toLowerCase()));
  if ((/\bsupport\b/i.test(n) && (CHILD_WORDS.test(n) || namesChild)) || (x.type === "support" && CHILD_WORDS.test(n))) return "it is child support: the retirement plan stops it when the child turns 18";
  if (NAMED_INCOME.test(n)) return "its name tells the retirement plan what it is";
  return null;
}
const has = (v) => v !== undefined && v !== null && v !== "";
/** Why a line cannot go into one figure on its own account, or null. */
function ownWhy(plan, x, places, seen) {
  if (typeof x.id !== "string" || !x.id || seen.get(x.id) > 1) return SAME_ID;
  const p = places.find((y) => y !== "guide");
  if (p) return PLACES[p] ?? OTHER_PLACE;
  if (has(x.countOn)) return "Side income plans with a careful figure for it";
  if (has(x.continues) || lines(plan).some((y) => y !== x && y.continues === x.id)) return "it is part of a raise from a later date";
  if (typeof x.id === "string" && !/[.[\]]/.test(x.id) && isGuess(plan, `income[${x.id}].amount`)) return "its amount is our guess for now: type the real one first";
  return nameRead(plan, x);
}
/** Why a line cannot join the kept one (it is paid or counted differently), or null. */
function alikeWhy(x, k) {
  if (periodOf(x) !== periodOf(k)) return "it is paid on another schedule";
  if ((Number(x.growth) || 0) !== (Number(k.growth) || 0)) return "it has a raise of its own";
  if (String(x.startDate ?? "") !== String(k.startDate ?? "") || String(x.endDate ?? "") !== String(k.endDate ?? "")) return "it has dates of its own";
  if ((x.taxable !== false) !== (k.taxable !== false)) return "income tax applies to it differently";
  if (String(x.payday ?? "") !== String(k.payday ?? "")) return "it has its own payday";
  if (!!x.typicalYear !== !!k.typicalYear) return "it is a typical year of uneven pay";
  return null;
}
const monthlyOf = (x) => perMonth(x.amount, periodOf(x));

/**
 * sectionsOf(plan, { all = false }) -> [{ key, type, personId, name, noun, ids, count, monthly, mode, keep, join, held,
 * changes, marked }] for each section with two or more lines or a line marked one figure (all: every section with a line).
 *   monthly  what the section's lines bring in a month (every line, going today or not); kept: the keeper's alone;
 *            together: the keeper's and the joining lines' (what one figure would bring in)
 *   keep     the line that holds (or would hold) the figure: the line marked, else Get started's, else the biggest
 *   join     the lines alike with it that would go into it; held: [{ id, name, why }] the lines that stay on their own
 *   mode     "one" when a line is marked and every other stays on its own; changes: the choice can change something
 * The biggest section first.
 */
export function sectionsOf(plan, { all = false } = {}) {
  const groups = new Map(), seen = new Map();
  for (const x of lines(plan)) {
    if (typeof x.id === "string") seen.set(x.id, (seen.get(x.id) ?? 0) + 1);
    const k = sectionKey(x); if (k) (groups.get(k) ?? groups.set(k, []).get(k)).push(x);
  }
  const out = [];
  for (const [key, rows] of groups) {
    const marked = rows.find((x) => x.oneFigure === true) ?? null;
    if (!all && rows.length < 2 && !marked) continue;
    const places = new Map(rows.map((x) => [x, pointedAt(plan, x.id)]));
    const why = new Map(rows.map((x) => [x, ownWhy(plan, x, places.get(x), seen)]));
    const pool = rows.filter((x) => !why.get(x));
    const big = (xs) => xs.reduce((m, x) => (monthlyOf(x) > monthlyOf(m) ? x : m), xs[0]);
    const keeper = (marked && pool.includes(marked) ? marked : null) ?? pool.find((x) => isSetup(x.id)) ?? (pool.length ? big(pool) : null);
    const held = [], join = [];
    let together = keeper ? monthlyOf(keeper) : 0;
    for (const x of rows) {
      if (x === keeper) continue;
      const w = why.get(x) ?? ((places.get(x) ?? []).includes("guide") || isSetup(x.id) ? PLACES.guide : null) ?? (keeper ? alikeWhy(x, keeper) : OTHER_PLACE);
      if (w) held.push({ id: x.id, name: x.name || "An income", why: w }); else { join.push(x.id); together += monthlyOf(x); }
    }
    const { type, personId } = partsOf(key);
    const mode = marked && marked === keeper && join.length === 0 ? "one" : "items";
    out.push({ key, type, personId, name: sectionName(plan, key), noun: sectionNoun(plan, key), ids: rows.map((x) => x.id), count: rows.length,
      monthly: rows.reduce((t, x) => t + monthlyOf(x), 0), together, kept: keeper ? monthlyOf(keeper) : 0, mode, keep: keeper?.id ?? null, join, held, changes: join.length > 0 || mode === "one", marked: marked?.id ?? null });
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}

const cents = (n) => Math.round(n * 100) / 100;
/**
 * asOne(draft, key) -> { kept, gone: [ids], names, monthly, name } | null: the section kept as one figure. The lines alike with
 * the kept one become it: amount = the sum of their amounts (the same schedule, so a year and a month add up the same), the
 * section's name (one the retirement plan does not read: sectionName), and the mark; the others (those very lines, never a
 * line that shares an id) are removed. A section of one line is only marked.
 */
export function asOne(draft, key) {
  const s = sectionsOf(draft, { all: true }).find((x) => x.key === key);
  if (!s || !s.keep) return null;
  const rows = lines(draft);
  const kept = rows.find((x) => x.id === s.keep);
  const going = rows.filter((x) => x !== kept && s.join.includes(x.id));
  for (const x of rows) if (x !== kept && sectionKey(x) === key) delete x.oneFigure;
  if (!going.length) { kept.oneFigure = true; return { kept: kept.id, gone: [], names: [kept.name], monthly: monthlyOf(kept), name: kept.name }; }
  const all = [kept, ...going];
  const names = all.map((x) => x.name || "An income");
  kept.amount = cents(all.reduce((t, x) => t + (Number(x.amount) || 0), 0));
  if (!nameRead(draft, { type: kept.type, name: s.name })) kept.name = s.name;   // (sectionName never gives one it reads)
  kept.oneFigure = true;
  const gone = going.map((x) => x.id);
  const goingSet = new Set(going);
  draft.income = draft.income.filter((x) => !goingSet.has(x));
  return { kept: kept.id, gone, names, monthly: monthlyOf(kept), name: kept.name };
}
/** itemize(draft, key) -> { kept, name, monthly } | null: the section listed item by item again; its one line stays first. */
export function itemize(draft, key) {
  let hit = null;
  for (const x of lines(draft)) if (sectionKey(x) === key && x.oneFigure === true) { delete x.oneFigure; hit = hit ?? x; }
  return hit ? { kept: hit.id, name: hit.name, monthly: monthlyOf(hit) } : null;
}
/** unmarkOnAdd(draft, line) -> the name of the section that was one figure and is item by item again now that `line` is
 * added beside it, or null. */
export function unmarkOnAdd(draft, line) {
  const k = sectionKey(line);
  if (!k) return null;
  let was = null;
  for (const x of lines(draft)) if (x !== line && x.id !== line?.id && sectionKey(x) === k && x.oneFigure === true) { delete x.oneFigure; was = sectionName(draft, k); }
  return was;
}
/** The line's words on the list when it holds its section's figure ("One figure for Ana's business income"), else null. */
export function rowLine(plan, line, sections = sectionsOf(plan)) {
  const s = sections.find((x) => x.marked === line?.id && x.mode === "one");
  return s ? `One figure for ${s.noun}` : null;
}

// ---- the words, one sentence per case (README "One figure or item by item"); money(n) -> "$150"
const names = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
export const INTRO = "Keep a kind of income as one figure, typed and changed in one place, or list each source on its own. Either way what comes in counts the same, and so does every plan that reads it.";
export const PART_TITLE = "One figure or item by item";
/** The part's status: "2 as one figure" / "1 can be one figure" / "" (nothing to choose). */
export function statusWords(sections) {
  const one = sections.filter((s) => s.mode === "one").length;
  if (one) return `${one} as one figure`;
  const can = sections.filter((s) => s.changes).length;
  return can ? `${can} can be one figure` : "";
}
/** "3 sources, $190 a month in all" / "2 of 3 sources can be one figure, $150 a month" (some stay on their own: the line says
 * what one figure would bring in, review 2026-11-16 P1) / "One figure: $150 a month" / "One figure: $150 a month, with 1 more on its own". */
export function sectionLine(s, money) {
  const n = s.held.length;
  if (s.mode === "one") return `One figure: ${money(s.kept)} a month${n ? `, with ${n} more on ${n === 1 ? "its" : "their"} own` : ""}`;
  if (n && s.join.length) return `${s.join.length + 1} of ${s.count} sources can be one figure, ${money(s.together)} a month`;
  return `${s.count} source${s.count === 1 ? "" : "s"}, ${money(s.monthly)} a month in all`;
}
export const holdWords = (h) => `${h.name} stays on its own: ${h.why}.`;
const joiningOf = (plan, s) => { const ids = [s.keep, ...s.join]; return lines(plan).filter((x) => ids.includes(x.id)); };
/** What the lines that would go together bring in a month. */
export const joinMonthly = (plan, s) => joiningOf(plan, s).reduce((t, x) => t + monthlyOf(x), 0);
/** The question before lines are replaced: one sentence per case (all of them; some stay on their own). */
export function askWords(plan, s, money, monthlyTotal) {
  const rows = joiningOf(plan, s);
  const ask = `Replace ${names(rows.map((x) => x.name || "An income"))} with one line, ${s.name}: ${money(joinMonthly(plan, s))} a month?`;
  const stay = s.held.length ? ` ${names(s.held.map((h) => h.name))} ${s.held.length === 1 ? "stays on its own" : "stay on their own"}.` : "";
  return `${ask}${stay} What comes in stays ${money(monthlyTotal)} a month.`;
}
/** The green line after: "Dividends and interest is one figure now: $150 a month, in place of 2 sources. Bond interest stays on
 * its own. What comes in is still $14,440 a month." (the lines of the kind that stay on their own named: review 2026-11-16 P1) */
export function doneWords(r, s, money, monthlyTotal) {
  const stay = r.gone.length && s?.held?.length ? ` ${names(s.held.map((h) => h.name))} ${s.held.length === 1 ? "stays on its own" : "stay on their own"}.` : "";
  if (!r.gone.length) return `${r.name} is one figure now: ${money(r.monthly)} a month. What comes in is still ${money(monthlyTotal)} a month.`;
  return `${r.name} is one figure now: ${money(r.monthly)} a month, in place of ${r.names.length} sources.${stay} What comes in is still ${money(monthlyTotal)} a month.`;
}
/** The green line after Item by item (short, for a phone: review 2026-11-16 P4). */
export const itemizeWords = (r) => `${r.name} is item by item now. List each one: tap its line to rename it, then + Add another income.`;
export const undoneWords = (r, money, monthlyTotal) => (r.gone?.length ? `Put back: ${names(r.names)}. What comes in is still ${money(monthlyTotal)} a month.` : `Back as it was: ${r.name}. What comes in is still ${money(monthlyTotal)} a month.`);
export const addWords = (name) => `${name} is item by item again: each source is on the list.`;
