// modules/scenarios/compare/compute.js -- PURE and heavy. Your plan and up to four copies of it with a few
// things changed (retire earlier, spend less, save more, claim Social Security later, different returns
// or inflation, a one-off sum, an advisor's fee), each run through the same engine: does the money last,
// the chance it lasts across simulated markets, what it could spend, what it holds at retirement and at
// the end. The changes live in plan.scenarios; the plan itself is never changed, until the person taps "Make this my plan"
// on one version (carry / makeMyPlan / putBack below: gap design #25, 2026-11-14), which writes that version's changes into
// the plan in one step and keeps what it did on the version, so the plan can be put back exactly.
import { project, affordableSpending, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { drawShocks, shapeSequences } from "../../retirement/monte-carlo/compute.js";
import { STRATEGIES, EASE_MAX } from "../../../core/math/retirement.js";
import { SPEND_RULES, EASE_CHIPS } from "../../retirement/projection/compute.js";
import { DESCRIPTIONS, guardWords } from "../../retirement/withdrawal-strategy/compute.js";
import { homeFacts, saveHappening, nextId, lineWords, check as checkHappening } from "../../retirement/happenings.js";
import { answerOf } from "../../retirement/levers.js";
import { changesOf, takeBack } from "../../../core/ui/undo.js";

export const MAX_SCENARIOS = 4;
export const PATHS = 400;

/** The levers a scenario can change. `person` levers take one value per adult. Plan levers change a copy of the plan; input levers change the engine's inputs. */
export const LEVERS = [
  { key: "retireAge", label: "Retire at age", type: "number", person: true, min: 40, max: 85, get: (p, id) => person(p, id)?.retirementAge ?? p.assumptions?.retirementAge ?? 65, set: (p, v, id) => { const x = person(p, id); if (x) x.retirementAge = v; } },
  { key: "claimAge", label: "Start Social Security at", type: "number", person: true, min: 62, max: 70, get: (p, id) => p.retirement?.socialSecurity?.[id]?.claimAge ?? 67, set: (p, v, id) => { p.retirement = p.retirement ?? {}; p.retirement.socialSecurity = p.retirement.socialSecurity ?? {}; p.retirement.socialSecurity[id] = { ...(p.retirement.socialSecurity[id] ?? {}), claimAge: v }; } },
  // a figure typed in a scenario is a typed figure (review 2026-11-02): no longer Get started's own (retireAuto), so a health
  // premium on Expenses is not taken out of it and health cover goes on top, as when it is typed on Will the money last?
  { key: "spendingMonthly", label: "Spend in retirement, a month", type: "money", get: (p) => p.retirement?.spendingMonthly ?? null, set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.spendingMonthly = v; if (p.guide?.setup?.retireAuto === true) { p.guide.setup.retireAuto = false; p.guide.setup.retireHeld = true; } } },   // (retireHeld: it still holds the loans Get started's figure held, fix round 1, 2026-11-11)
  { key: "extraSavingMonthly", label: "Save more each month (until retiring)", type: "money", copyOnly: true, get: () => 0, set: (p, v) => { const self = (p.household?.people ?? []).find((x) => x.role === "self") ?? (p.household?.people ?? [])[0]; p.retirement = p.retirement ?? {}; p.retirement.contributions = [...(p.retirement.contributions ?? []), { id: "scenario-extra", accountId: "", personId: self?.id ?? "", amount: v, period: "monthly", employerMatch: 0 }]; } },
  { key: "stocksNow", label: "Share in stocks now", type: "percent", get: (p) => p.retirement?.stocksNow ?? 0.7, set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.stocksNow = v; } },
  { key: "stocksRetired", label: "Share in stocks in retirement", type: "percent", get: (p) => p.retirement?.stocksRetired ?? 0.5, set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.stocksRetired = v; } },
  { key: "returnStocks", label: "Stock return a year", type: "percent", get: (p) => p.assumptions?.returnStocks ?? 0.07, set: (p, v) => { p.assumptions = { ...(p.assumptions ?? {}), returnStocks: v }; } },
  { key: "returnBonds", label: "Bond return a year", type: "percent", get: (p) => p.assumptions?.returnBonds ?? 0.04, set: (p, v) => { p.assumptions = { ...(p.assumptions ?? {}), returnBonds: v }; } },
  { key: "inflation", label: "Inflation a year", type: "percent", get: (p) => p.assumptions?.inflation ?? 0.03, set: (p, v) => { p.assumptions = { ...(p.assumptions ?? {}), inflation: v }; } },
  // gap design #25 (2026-11-14): two more of the plan's own fields. `choice`: offered as a short list, not a box; `text`: the value is a word
  { key: "spendingEase", label: "Spending as you age", type: "select", choice: true, min: 0, max: EASE_MAX, get: (p) => Math.min(Math.max(0, Number(p.retirement?.spendingEase) || 0), EASE_MAX), set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.spendingEase = Math.min(Math.max(0, v), EASE_MAX); } },
  { key: "strategy", label: "How money is taken out", type: "select", choice: true, text: true, get: (p) => (isWay(p.retirement?.strategy) ? p.retirement.strategy : "fixed-real"), set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.strategy = v; } },
  { key: "fee", label: "Advisor or fund fees a year", type: "percent", input: true, get: () => 0, apply: (I, v) => { I.returns = { ...I.returns, stocks: I.returns.stocks - v, bonds: I.returns.bonds - v }; } },
  { key: "lumpSum", label: "A one-time sum (+ in, − out)", type: "money", input: true, signed: true, get: () => 0, apply: (I, v, ch) => { I.events.push({ year: lumpYearOf(ch) ?? I.startYear, amount: -v, label: "one-time" }); } },
  { key: "lumpYear", label: "Year of the one-time sum", type: "number", input: true, min: 1990, max: 2150, get: () => null, apply: () => {} },
];
function person(p, id) { return (p.household?.people ?? []).find((x) => x.id === id); }

/** One of the ways of taking money out, by its own key (never a name every object has, like "constructor": critic M3, 2026-11-14). */
function isWay(v) { return typeof v === "string" && Object.hasOwn(STRATEGIES, v) && Object.hasOwn(DESCRIPTIONS, v); }
/** Is this a value a lever can use? A number for most; one of the ways' own words for "How money is taken out". */
const usable = (lv, v) => (lv.text ? isWay(v) : v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)));
const leverOf = (k) => { const [key, id] = String(k).split(":"); return { lv: LEVERS.find((l) => l.key === key), id }; };
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
/** The year a version gives its one-time sum, or null: a whole year above 0, as the engine reads it (anything else is "this year"). */
const lumpYearOf = (changes) => { const y = Math.round(num(changes?.lumpYear) ?? 0); return y > 0 ? y : null; };
const yearOf = (today) => Number(String(today ?? "").slice(0, 4)) || new Date().getFullYear();

/**
 * The keys of a version that are not one figure of the plan but one line of "Things that will happen" (Will the money last?,
 * modules/retirement/happenings.js): selling or downsizing the home, and working less for some years. Stored flat in
 * `changes` like every lever: homeYear, homeBuyFor, homeRent; lessWho (a person's id), lessFrom, lessUntil, lessShare.
 */
export const HAPPENING_KEYS = ["homeYear", "homeBuyFor", "homeRent", "lessWho", "lessFrom", "lessUntil", "lessShare"];
/**
 * happeningsOf(plan, changes) -> the lines a version adds, as happenings.js records without an id:
 *   home  { kind: "home", year: homeYear, buyFor: homeBuyFor or 0, rentMonthly: homeRent, or 0 when nothing is bought }
 *   less  { kind: "less", personId: lessWho or the first adult, year: lessFrom, untilYear: lessUntil or lessFrom, share: lessShare or 0 }
 * Nothing without a year: a price or a share alone adds no line.
 */
export function happeningsOf(plan, changes = {}) {
  const out = [];
  const homeYear = num(changes.homeYear), lessFrom = num(changes.lessFrom);
  if (homeYear !== null) {
    const buyFor = Math.max(0, num(changes.homeBuyFor) ?? 0);
    out.push({ kind: "home", year: Math.round(homeYear), buyFor, rentMonthly: buyFor > 0 ? null : Math.max(0, num(changes.homeRent) ?? 0) });
  }
  if (lessFrom !== null) {
    const adults = (plan.household?.people ?? []).filter((x) => x.role !== "dependent");
    const who = adults.find((x) => x.id === changes.lessWho) ?? adults.find((x) => x.role === "self") ?? adults[0];
    out.push({ kind: "less", personId: who?.id ?? null, year: Math.round(lessFrom), untilYear: Math.round(num(changes.lessUntil) ?? lessFrom), share: Math.min(1, Math.max(0, num(changes.lessShare) ?? 0)) });
  }
  return out;
}
/** Put a version's lines into p's "Things that will happen" (a home sold here takes the place of a home sold there: one home). */
function writeHappenings(p, items) {
  for (const h of items) {
    const homes = h.kind === "home" && Array.isArray(p.retirement?.happenings) ? p.retirement.happenings.filter((x) => x?.kind === "home") : [];
    if (homes.length > 1) p.retirement.happenings = p.retirement.happenings.filter((x) => x?.kind !== "home" || x === homes[0]);
    saveHappening(p, { ...h, id: homes[0]?.id ?? nextId(p) });   // in the place of the plan's own home line, when it has one
  }
}

/** The changes as stored ({ key or "key:personId": value }) applied to a copy of the plan and to its engine inputs. -> { plan, inputs, missing } */
export function applyChanges(plan, changes = {}, { today } = {}) {
  const p2 = JSON.parse(JSON.stringify(plan));
  for (const [k, v] of Object.entries(changes)) {
    const { lv, id } = leverOf(k);
    if (lv && !lv.input && usable(lv, v)) lv.set?.(p2, lv.text ? v : Number(v), id);
  }
  writeHappenings(p2, happeningsOf(p2, changes));
  const b = buildInputs(p2, { today });
  if (!b.inputs) return { plan: p2, inputs: null, missing: b.missing ?? [] };
  const I = copyInputs(b.inputs);
  for (const [k, v] of Object.entries(changes)) {
    const lv = LEVERS.find((l) => l.key === k);
    if (lv?.input && v !== null && v !== "" && Number.isFinite(Number(v)) && Number(v) !== 0) lv.apply(I, Number(v), changes);
  }
  return { plan: p2, inputs: I, missing: [] };
}

/** One run's key figures: does it last, the chance it lasts over simulated markets, what it could spend a month, at retirement, at the end (today's dollars). */
export function results(I, { paths = PATHS, shocks = null } = {}) {
  const r = project(I);
  const atRet = r.rows.find((x) => x.year === I.retireYear) ?? r.rows[0];
  let chance = null;
  if (paths > 0) {
    const years = I.endYear - I.startYear + 1;
    // `shocks`: the one draw of pretend years shared by the plan and its copies (compute below), sliced to this run's length;
    // without it, the same draw made here (seed 1), as before
    const luck = shocks && shocks.length >= paths && (shocks[0]?.length ?? 0) >= years ? shocks.slice(0, paths).map((p) => p.slice(0, years)) : drawShocks(paths, years, 1);
    const seqs = shapeSequences(luck, { stocks: I.returns.stocks, bonds: I.returns.bonds, stdevStocks: I.stdev?.stocks ?? 0.18, stdevBonds: I.stdev?.bonds ?? 0.06 });
    let ok = 0;
    for (const seq of seqs) if (project(I, { sequence: seq }).success) ok++;
    chance = ok / paths;
  }
  return { success: r.success, failYear: r.failYear ?? null, failAge: r.failAge ?? null, retireYear: I.retireYear, atRetirementReal: atRet?.totalReal ?? 0, endReal: r.endBalanceReal, affordableMonthly: affordableSpending(I) / 12, spendingMonthly: I.spending.yearly / 12, chance };
}

/**
 * chanceShown(planChance, copyChance, known) -> { value, text, about }: the chance a column of Compare shows (stress test
 * 2026-11-11, W7: the plan read 78% here and 80% on Chance the money lasts). Compare runs the plan and every copy on one
 * shared set of PATHS pretend futures, so the difference between a copy and the plan is fair; the plan's own figure on that
 * small set can still be a point or two off the Chance page's 2,000. So:
 * - `known` (the Chance page's own figure for this very plan, worked out on this visit): the plan shows it, and a copy shows it
 *   plus the copy's difference from the plan on the shared set (kept between 0 and 1);
 * - otherwise every column says "about" and is rounded to the nearest 5 points.
 * copyChance null = the plan's own column. value is what the "points" difference is taken from.
 */
export function chanceShown(planChance, copyChance = null, known = null) {
  const own = copyChance === null;
  if (planChance === null || planChance === undefined || (!own && (copyChance === null || copyChance === undefined))) return { value: null, text: "-", about: false };
  if (Number.isFinite(known)) {
    const v = own ? known : Math.min(1, Math.max(0, known + (copyChance - planChance)));
    // rounded as the Chance page's fmt.pct rounds (float noise cleared first), so 28.5% reads 29% on both (review of W7)
    const pct = Math.round(Number((v * 100).toPrecision(12)));
    return { value: pct / 100, text: `${pct}%`, about: false };
  }
  // to the nearest 5, but never "about 0%" or "about 100%" for a chance that is neither: those read as "none" or "every future"
  const raw = own ? planChance : copyChance;
  const pct = raw <= 0 ? 0 : raw >= 1 ? 100 : Math.min(95, Math.max(5, Math.round(Number((raw * 20).toPrecision(12))) * 5));
  return { value: pct / 100, text: `about ${pct}%`, about: true };
}

const pct = (v) => `${Math.round(Number(v) * 1000) / 10}%`;
const dollars = (v) => `$${Math.abs(Math.round(Number(v))).toLocaleString("en-US")}`;
const lowerFirst = (t) => (/^(Sell|You|Your)\b/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
const upperFirst = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
/** One change in words, or null when it changes nothing (a fee or a one-time sum of 0, a key this page does not know). */
function wordsFor(plan, key, id, v, changes) {
  const who = (plan.household?.people ?? []).find((x) => x.id === id)?.name ?? "Someone";
  const year = lumpYearOf(changes) ? ` in ${lumpYearOf(changes)}` : " this year";
  if (key === "strategy") return isWay(v) ? `money is taken out this way: ${DESCRIPTIONS[v].name}` : null;
  if (key === "spendingEase") return Number(v) > 0 ? `spending eases ${pct(Math.min(Number(v), EASE_MAX))} a year as you age` : "spending stays the same as you age";
  if ((key === "fee" || key === "lumpSum") && Number(v) === 0) return null;
  return {
    retireAge: `${who} retires at ${v}`, claimAge: `${who} starts Social Security at ${v}`, spendingMonthly: `spend ${dollars(v)} a month in retirement`,
    extraSavingMonthly: `save ${dollars(v)} more a month`, stocksNow: `${pct(v)} in stocks now`, stocksRetired: `${pct(v)} in stocks in retirement`,
    returnStocks: `stocks earn ${pct(v)} a year`, returnBonds: `bonds earn ${pct(v)} a year`, inflation: `prices rise ${pct(v)} a year`, fee: `fees of ${pct(v)} a year`,
    lumpSum: Number(v) >= 0 ? `${dollars(v)} arrives${year}` : `${dollars(v)} is spent${year}`,
  }[key] ?? null;
}
/** One line of "Things that will happen" in the words that page uses (happenings.js lineWords), fitted into a list. */
const happeningWords = (plan, h) => lowerFirst(lineWords(h, { people: plan.household?.people ?? [], money: dollars }));

/** The changes in words. */
export function describe(plan, changes = {}) {
  const out = [];
  for (const [k, v] of Object.entries(changes)) {
    const { lv, id } = leverOf(k);
    if (!lv || k === "lumpYear" || !usable(lv, v)) continue;
    const text = wordsFor(plan, lv.key, id, v, changes);
    if (text) out.push(text);
  }
  for (const h of happeningsOf(plan, changes)) out.push(happeningWords(plan, h));
  return out;
}

/**
 * notesOf(plan, changes, inputs, { today }) -> [sentence]: what of a version the sums leave out, one written sentence per case:
 * a line of "Things that will happen" that cannot be counted (happenings.js `check` says why), and spending that eases with
 * age under a way of taking money out that sets its own spending. `inputs`: the version's own engine inputs.
 */
export function notesOf(plan, changes = {}, inputs = null, { today } = {}) {
  const out = [];
  if (!inputs) return out;
  const facts = { nowYear: inputs.startYear, endYear: inputs.endYear, people: inputs.people ?? [] };
  let home;
  for (const h of happeningsOf(plan, changes)) {
    if (h.kind === "home" && home === undefined) home = homeFacts(plan, { today });
    const no = checkHappening(h, { ...facts, hasHome: h.kind !== "home" || !!home });
    if (no) out.push(h.kind === "home" ? `Selling the home is left out of this version. ${no.words}` : `Working less is left out of this version. ${no.words}`);
  }
  if (Number(changes.spendingEase) > 0 && !SPEND_RULES.includes(inputs.strategy)) out.push("Spending as you age is left out of this version: this way of taking money out sets its own spending.");
  return out;
}

// ---- make a version the plan (gap design #25) -------------------------------------------------------------------------------
/** Why a change of a version is not written into the plan, one sentence each. */
export const NOT_CARRIED = {
  fee: "Not carried: fees are set on the Fees page.",
  saving: "Not carried: saving more each month is set on the Retirement contributions page.",
};
/** The what-if-only changes of a version (extra saving, a fee), each as its sentence: the same before and after it is made the plan. */
export function whatIfOnly(changes = {}) {
  const out = [];
  for (const [k, v] of Object.entries(changes ?? {})) { const { lv } = leverOf(k); if (lv?.copyOnly && usable(lv, v) && Number(v) !== 0) out.push(NOT_CARRIED.saving); }
  if (num(changes?.fee)) out.push(NOT_CARRIED.fee);
  return out;
}
/**
 * carry(plan, changes, { today }) -> { carried: [words], same, not: [sentence], write(draft) }: what "Make this my plan" would
 * do with one version's changes.
 *   carried  the changes that would move something in the plan, in the words the version is described with
 *   same     how many the plan already has (retire at 65 in a plan that says 65): left out of the count
 *   not      what is not written, each with its reason: fees and extra saving (a what-if only, with no field of the plan that
 *            is theirs: NOT_CARRIED), and a line of "Things that will happen" the plan could not count (its year has passed)
 *   write    makes exactly the carried changes in a draft of the same plan
 * What is written: each plan lever through its own `set`, exactly as applyChanges sets it on the version's copy (so the plan
 * then gives the version's answer); a one-time sum as a line "money coming in once" / "a big cost once" of that year (this
 * year when the version names none), and the home and working-less lines, in `retirement.happenings`.
 */
export function carry(plan, changes = {}, { today } = {}) {
  const trial = JSON.parse(JSON.stringify(plan));
  const steps = [], carried = [], not = [];
  let same = 0;
  const step = (words, fn) => {
    const before = JSON.stringify(trial);
    fn(trial);
    if (JSON.stringify(trial) === before) { same++; return; }
    carried.push(words); steps.push(fn);
  };
  for (const [k, v] of Object.entries(changes)) {
    const { lv, id } = leverOf(k);
    if (!lv || lv.input || !usable(lv, v)) continue;
    if (lv.copyOnly) continue;   // extra saving: a what-if only (whatIfOnly below)
    if (lv.person && !person(plan, id)) continue;
    const value = lv.text ? v : Number(v);
    step(wordsFor(plan, lv.key, id, v, changes), (p) => lv.set(p, value, id));
  }
  not.push(...whatIfOnly(changes));
  const items = happeningsOf(plan, changes);
  const lump = num(changes.lumpSum);
  if (lump) items.push({ kind: lump > 0 ? "in" : "out", year: lumpYearOf(changes) ?? yearOf(today), amount: Math.abs(lump) });
  if (items.length) {
    // the years and the people as the plan would stand with the figures above (a retirement age decides the working years)
    const b = buildInputs(trial, { today, happenings: false });
    let home;
    for (const h of items) {
      const words = h.kind === "in" || h.kind === "out" ? wordsFor(plan, "lumpSum", null, lump, changes) : happeningWords(plan, h);
      if (h.kind === "home" && home === undefined) home = homeFacts(plan, { today });
      const no = b.inputs ? checkHappening(h, { nowYear: b.inputs.startYear, endYear: b.inputs.endYear, people: b.inputs.people ?? [], hasHome: h.kind !== "home" || !!home }) : { words: "The plan needs its basics first (Will the money last?)." };
      if (no) { not.push(`Not carried: ${words}. ${no.words}`); continue; }
      step(words, (p) => writeHappenings(p, [h]));
    }
  }
  return { carried, same, not, write: (draft) => { for (const fn of steps) fn(draft); } };
}
/**
 * askWords(c) -> the question "Make this my plan" asks before anything is written, one written sentence per case (c: carry's
 * answer): what changes, or why there is nothing to do.
 */
export function askWords(c) {
  const n = c.carried.length;
  if (n === 1) return `This changes 1 thing in your plan: ${c.carried[0]}. You can undo it.`;
  if (n > 1) return `This changes ${n} things in your plan: ${c.carried.join("; ")}. You can undo it.`;
  if (c.not.length) return "Nothing in this version can be put into your plan from here.";
  if (c.same > 0) return "Your plan already has everything in this version.";
  return "This version changes nothing yet. Tap Edit to change something first.";
}
/** The green line after "Make this my plan" (left: how many things were not carried, said so the answer is not taken for the version's): how many changes, and the new answer in the words of Will the money last? (`answer`: levers.js answerOf, or null). */
export function madeWords(name, n, answer, left = 0) {
  const lead = n === 1 ? `Your plan now has the 1 change from "${name}".` : `Your plan now has the ${n} changes from "${name}".`;
  if (!answer) return lead;
  // `left`: how many things of the version were not carried (a fee, extra saving): the plan's answer is then not the version's
  const tail = left > 0 ? " That is without what was not carried." : "";
  return (answer.lasts ? `${lead} At average markets the money now lasts to the end (age ${answer.endAge}).` : `${lead} At average markets the money now runs out at ${answer.age}.`) + tail;
}
/** The green line after the plan is put back (r: takeBack's { done, kept }). */
export function backWords(name, r) {
  if (r?.kept && r.done) return `Your plan is back as it was before "${name}", except what you changed after that: that was left as it is.`;
  if (r?.kept) return "Nothing to put back: all of it was changed again after that.";
  return `Your plan is back as it was before "${name}".`;
}
/**
 * makeMyPlan(draft, id, { today }) -> null (no such version) | { carried, same, not, changes, already? (it was made the plan before: nothing is written) }: writes the version's carried
 * changes into the draft (one store.update) and keeps on the version what that did, `madePlan: { on, words, changes }` (the day, the carried changes in words, and core/ui/undo.js
 * changesOf: each field with the value it had), so putBack can take exactly that back, today or after a reload. With nothing
 * to carry the draft is left as it is.
 */
export function makeMyPlan(draft, id, { today } = {}) {
  const s = (draft.scenarios ?? []).find((x) => x?.id === id);
  if (!s) return null;
  // already made the plan (a second tab, a stale screen): nothing is written twice and the first way back is kept
  if (s.madePlan) return { carried: [], same: 0, not: [], changes: [], already: true };
  const c = carry(draft, s.changes ?? {}, { today });
  if (!c.carried.length) return { carried: [], same: c.same, not: c.not, changes: [] };
  const before = JSON.parse(JSON.stringify(draft));
  c.write(draft);
  const changes = changesOf(before, draft);
  s.madePlan = { on: today ?? null, words: c.carried, changes };
  return { carried: c.carried, same: c.same, not: c.not, changes };
}
/**
 * putBack(draft, id) -> { done, kept }: takes back what makeMyPlan wrote for this version and forgets the record. Only what
 * still holds the value it wrote is put back (core/ui/undo.js takeBack): a figure changed again since is left alone and
 * counted in `kept`. With nothing changed in between, the plan is the plan of before, byte for byte.
 */
export function putBack(draft, id) {
  const s = (draft.scenarios ?? []).find((x) => x?.id === id);
  if (!s?.madePlan) return { done: 0, kept: 0 };
  const r = takeBack(draft, (Array.isArray(s.madePlan.changes) ? s.madePlan.changes : []).filter((c) => c && typeof c === "object" && Array.isArray(c.path)));   // a record edited by hand can hold anything
  delete s.madePlan;
  return r;
}
/** The answer on Will the money last? for a plan (levers.js answerOf), for the green line. */
export const answerFor = (plan, { today } = {}) => answerOf(plan, { today });

/**
 * offers(plan, { today }) -> what the version form can offer for this plan, beyond the figures in compute's `current`:
 *   { home (the plan has a home to sell), workers: [{ id, name, stops }] (adults still at work, with the year they stop),
 *     nowYear, endYear, ease (the plan's own, a fraction), strategy (the plan's own), easeUsed (the plan's way spends its figure),
 *     guard (the plan's own numbers for "Trim after bad years", or null: for its words) }
 * Not part of compute()'s output, so a plan with none of this reads exactly as before.
 */
export function offers(plan, { today } = {}) {
  const b = buildInputs(plan, { today, happenings: false });
  const nowYear = b.inputs?.startYear ?? yearOf(today), people = b.inputs?.people ?? [];
  const strategy = LEVERS.find((l) => l.key === "strategy").get(plan);
  return {
    home: !!homeFacts(plan, { today }), workers: people.filter((x) => x.birthYear + x.retireAge > nowYear + 1).map((x) => ({ id: x.id, name: x.name, stops: x.birthYear + x.retireAge })),
    nowYear, endYear: b.inputs?.endYear ?? null, ease: LEVERS.find((l) => l.key === "spendingEase").get(plan), strategy, easeUsed: SPEND_RULES.includes(strategy), guard: b.inputs?.guard ?? null,
  };
}
/** The choices of the two levers offered as a short list (the same chips and names their own pages use). */
export const EASE_CHOICES = EASE_CHIPS.map((c) => ({ value: String(c.value), label: c.label }));
export const STRATEGY_CHOICES = Object.keys(DESCRIPTIONS).map((k) => ({ value: k, label: DESCRIPTIONS[k].name }));

/**
 * compute(plan, { today, paths }) -> {
 *   ready, missing, base: results, scenarios: [{ id, name, changes, described: [text], results, missing, notes?: [sentence] }],
 *   current: { [lever key or key:personId]: the plan's own value }, adults: [{ id, name }]
 * }
 * current.spendingMonthly, while the plan's figure is Get started's own (retireAuto), is what the plan spends before health
 * cover (Get started's figure from today's bills, less a health premium among them): the figure a typed scenario is set against.
 */
const noted = (notes) => (notes.length ? { notes } : {});
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const paths = params.paths ?? PATHS;
  const b = buildInputs(plan, { today });
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent").map((p) => ({ id: p.id, name: p.name }));
  const current = {};
  for (const lv of LEVERS) if (lv.choice) continue; else if (lv.person) for (const a of adults) current[`${lv.key}:${a.id}`] = lv.get(plan, a.id); else current[lv.key] = lv.get(plan);
  if (!b.inputs) return { ready: false, missing: b.missing ?? [], scenarios: [], current, adults };
  if (b.health?.fromSetup) current.spendingMonthly = Math.round(b.spendingYearly / 12);
  // one draw of pretend years for the plan and every copy (same seed, same count; W7), as long as the longest of them
  const copies = (plan.scenarios ?? []).slice(0, MAX_SCENARIOS).map((s) => ({ s, a: applyChanges(plan, s.changes ?? {}, { today }) }));
  const years = Math.max(b.inputs.endYear - b.inputs.startYear + 1, ...copies.map(({ a }) => (a.inputs ? a.inputs.endYear - a.inputs.startYear + 1 : 0)));
  const shocks = paths > 0 ? drawShocks(paths, years, 1) : null;
  const base = results(b.inputs, { paths, shocks });
  const scenarios = copies.map(({ s, a }) => ({ id: s.id, name: s.name || "A scenario", changes: s.changes ?? {}, described: describe(plan, s.changes ?? {}), results: a.inputs ? results(a.inputs, { paths, shocks }) : null, missing: a.missing, ...noted(notesOf(plan, s.changes ?? {}, a.inputs, { today })) }));
  return { ready: true, missing: [], base, scenarios, current, adults };
}

/** The first choice of both lists: leave it as the plan has it (short enough for a 320 px screen; the plan's own is said under the box). */
export const SAME_AS_PLAN = "Same as my plan";
/**
 * choiceHelp(key, value, o) -> the one plain sentence under a short list of the version form, for the choice it shows now
 * (critic P2, 2026-11-14: the names alone did not say what each does). key: "strategy" | "spendingEase"; value: the list's
 * value ("" = same as my plan); o: offers(). The ways' words are their own page's (DESCRIPTIONS `short`; "Trim after bad
 * years" with the plan's own numbers, guardWords).
 *   strategy ""            -> "Your plan: same spending every year. Pick another to see what it does."
 *   strategy "percent"     -> "A set share of savings each year on top of your income, so it moves with markets."
 *   spendingEase ""        -> "Your plan: stays the same. Many people spend a little less each year as they get older."
 *   spendingEase 0         -> "You spend the same every year of retirement, raised with prices."
 *   spendingEase 0.01      -> "Each year you spend 1% less than the year before, in today's dollars. Health insurance is not eased."
 */
export function choiceHelp(key, value, o = {}) {
  const none = value === "" || value === null || value === undefined;
  if (key === "strategy") {
    if (none || !isWay(value)) return `Your plan: ${DESCRIPTIONS[isWay(o.strategy) ? o.strategy : "fixed-real"].name.toLowerCase()}. Pick another to see what it does.`;
    const short = value === "guardrails" && o.guard ? guardWords(o.guard).short : DESCRIPTIONS[value].short;
    return `${upperFirst(short)}.`;
  }
  const rate = Math.min(Math.max(0, Number(none ? o.ease : value) || 0), EASE_MAX);
  const label = EASE_CHIPS.find((x) => x.value === rate)?.label ?? `${Number((rate * 100).toFixed(1))}% less each year`;
  if (none) return `Your plan: ${label.toLowerCase()}. Many people spend a little less each year as they get older.`;
  return rate > 0 ? `Each year you spend ${Number((rate * 100).toFixed(1))}% less than the year before, in today's dollars. Health insurance is not eased.` : "You spend the same every year of retirement, raised with prices.";
}
