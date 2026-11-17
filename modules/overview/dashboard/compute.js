// modules/overview/dashboard/compute.js -- PURE. Setup steps, whether "Set up my plan" is finished, and whether the
// plan has enough in it to show money instead of a welcome. Where you stand and the next move come from
// overview/setup's standing() (view.js asks for it through ctx.computeOf). Readiness of pages (how many are built)
// is display logic done in view.js from ctx.modules. With a day (and the guesses registry merged from every module, as
// view.js asks), the cards about our guesses (spec 11.3; overview/guesses guessCards): "Fill in what you skipped", "Is
// something missing?" and "Better guesses are ready", the key `guesses` only while one of them applies.
import { guessCards, estimators as GUESS_ESTIMATORS, compute as guessesPage, newSinceLooked } from "../guesses/compute.js";
import { progress as setupProgress, QUESTIONS, SCREENS as SETUP_SCREENS, estimators as SETUP_ESTIMATORS, retireGuessAsk } from "../setup/compute.js";
import { compute as projection } from "../../retirement/projection/compute.js";
import { smallChangesHelp } from "../plan/words.js";
import { guessesInUse, mergeEstimators } from "../../../core/estimate/index.js";

// the two modules that make guesses today; the view passes the registry merged from every module when it has it
const OWN = mergeEstimators([{ from: "overview/guesses", estimators: GUESS_ESTIMATORS }, { from: "overview/setup", estimators: SETUP_ESTIMATORS }]).estimators;
/**
 * A big guess in use (an estimator's weight "big": one that can move a verdict; a key no module has any more counts as big,
 * so an old figure is never waved through). Ledger entries and the older flags alike (guessesInUse). C5 B7.
 */
export function bigGuessInUse(plan, estimators = null) {
  const est = estimators ?? OWN;
  return guessesInUse(plan).some((e) => (est[e.k]?.weight ?? "big") === "big");
}

/**
 * "Make our guesses yours" (spec 11.3, C8): while a guess that changes the answers is in use and was made or moved since the
 * last "These look fine" (guide.guessesLookedAt and guessesSeen; overview/guesses newSinceLooked), how many to name. ranked:
 * the guesses page's measured ranking (its view's memo, rankedFor), tiers 1 and 2; without it, the guesses whose estimator is
 * "big" (the static weight, spec 11.3: "the Dashboard uses the static weight until the memo matches"). A frozen guess (its
 * estimator gone) is not counted here: it leads the guesses page. The numbers the card says are the page's own (critic F5: the
 * card said 22, the page 32): `total` its "N to look over" (our rows, not the bank files'), `top` how many of them the ranking
 * found change an answer (only with the ranking).
 * -> { count, shown: min(count, 3), from: "ranked" | "weight", total, top? } | null. Nothing is written.
 */
export function makeYours(plan, { estimators = null, tables = null, today = null, ranked = null } = {}) {
  const est = estimators ?? OWN;
  let inUse = [];
  try { inUse = guessesInUse(plan); } catch { inUse = []; }
  const known = inUse.filter((e) => Object.prototype.hasOwnProperty.call(est, e.k));
  const most = ranked ? known.filter((e) => ranked[e.path] && ranked[e.path].tier <= 2) : known.filter((e) => est[e.k]?.weight === "big");
  if (!most.some((e) => newSinceLooked(plan, e))) return null;
  let total = most.length, top = null;
  try {
    const g = guessesPage(plan, { ...(estimators ? { estimators, tables } : {}), today, ...(ranked ? { ranked } : {}) });
    const rows = [...g.big, ...g.small];
    if (rows.length) total = rows.length;
    if (ranked) top = rows.filter((r) => ranked[r.path] && ranked[r.path].tier <= 2).length;
  } catch { /* the count of the guesses that matter stands in */ }
  return { count: most.length, shown: Math.min(3, most.length), from: ranked ? "ranked" : "weight", total, ...(top !== null ? { top } : {}) };
}

const somethingIn = (plan) => ["accounts", "income", "expenses", "transactions", "goals"].some((k) => (plan?.[k] ?? []).length > 0);

export function compute(plan, params = {}) {
  const steps = [
    { key: "accounts", label: "Add your accounts and balances", done: (plan.accounts ?? []).length > 0, go: ["balance", "net-worth"] },
    { key: "people", label: "Add the people in your household", done: (plan.household?.people ?? []).length > 0, go: ["household", "people"] },
    { key: "income", label: "Enter what comes in each month", done: (plan.income ?? []).length > 0, go: ["cashflow", "income"] },
    { key: "expenses", label: "Enter what goes out, or import transactions", done: (plan.expenses ?? []).length > 0 || (plan.transactions ?? []).length > 0, go: ["cashflow", "expenses"] },
    { key: "goals", label: "Set your first goal", done: (plan.goals ?? []).length > 0, go: ["goals", "goals"] },
    // "Look over our guesses" (C5 B7; the key stays `assumptions` so every reader of it keeps its place): done once "These look
    // fine" was tapped on Our guesses for you, or when no big guess is in use in a plan that holds something; the market
    // assumptions are planning choices, one tap away from that page (its fold), not a step of their own
    { key: "assumptions", label: "Look over our guesses", done: !!plan.guide?.guessesLookedAt || (!bigGuessInUse(plan, params.estimators) && somethingIn(plan)), go: ["overview", "guesses"] },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done) ?? null;
  // "Set up my plan" finished: the checklist folds to one line even while a step (the assumptions) is open; that
  // step stays a to-do on Needs attention, and the page's one filled button becomes your next move
  const setupFinished = !!plan.guide?.setup?.finishedAt;
  // nothing is written here: each card lists what its one tap would write (the view's buttons write it through store.update)
  const guesses = params.today ? guessCards(plan, { today: params.today, estimators: params.estimators, tables: params.tables }) : null;
  // "Make our guesses yours" (spec 11.3, C8): only while one applies (the key is absent otherwise)
  const yours = params.today ? makeYours(plan, { estimators: params.estimators, tables: params.tables, today: params.today, ranked: params.ranked ?? null }) : null;
  return { steps, doneCount, total: steps.length, next, setupFinished, hasMoney: (plan.accounts ?? []).length > 0, noteCount: Object.keys(plan.pageNotes ?? {}).length, ...(guesses ? { guesses } : {}), ...(yours ? { yours } : {}) };
}

// ---------------------------------------------------------------- where you stand, in Get started's words (C5 follow-ups)
/**
 * What the left-over waits for (setup's standing().spareWaitsOn: "spending", "pay" or "both"; critic M1), in the words of Get
 * started's summary tile (setup/view.js SPARE_WAITS, the same strings: a test reads both), and the question its link opens.
 */
export const SPARE_WAITS = { spending: { value: "Depends on your spending", with: "With our spending guesses", type: "Type yours ›", at: "spend" }, pay: { value: "Depends on your pay", with: "With our pay guess", type: "Type your pay ›", at: "money" }, both: { value: "Depends on your pay and spending", with: "With our guesses of your pay and spending", type: "Type your pay ›", at: "money" } };
/**
 * The left-over row while it waits on our guesses: { s, v, at } ("Depends on your pay. With our pay guess, about $1,370 spare",
 * "Type your pay ›", the question "money"). The figure to the nearest $10, "short" below zero (never a minus sign). The tile's
 * two lines become one sentence here, so "both" names the pay and spending once.
 */
export function spareWaitsRow(st, money) {
  const w = SPARE_WAITS[st?.spareWaitsOn] ?? SPARE_WAITS.spending;
  const spare = Number(st?.spare) || 0;
  // on one line "pay and spending" is said once: "Depends on your pay and spending. With our guesses, about $300 spare"
  const withW = st?.spareWaitsOn === "both" ? "With our guesses" : w.with;
  return { s: `${w.value}. ${withW}, about ${money(Math.round(Math.abs(spare) / 10) * 10)} ${spare < 0 ? "short" : "spare"}${st?.childcareMissing ? ". Childcare is not counted yet" : ""}`, v: w.type, at: w.at };
}
/** A tile's reason (standing().tileWhy: "Needs your savings.") as a row's line, which ends without a period. */
export const rowWords = (t) => String(t ?? "").replace(/\.$/, "");
/**
 * A row's screen-reader label, one sentence stop each (z1 (c)): "Left over each month: $3,003. After tax, bills and saving. That
 * builds up about $36,040 a year in checking and savings." The line under the row may already end with a period (the year's
 * saving sentence does): it is said once, never "..". An open row says "not known yet" for its figure; a row with no figure
 * (the check-in done row) says its name and line only; an empty line adds nothing.
 */
export function rowLabel(r) {
  // (`said`: an open row's own spoken figure, when it is not "not known yet": the retirement row that lasts on what is listed
  // while the list may be short says "see below"; retireWaitRow, z1 fix round P1)
  const k = String(r?.k ?? "").trim(), v = r?.open ? String(r?.said ?? "not known yet") : String(r?.v ?? "").trim(), s = String(r?.s ?? "").replace(/[.\s]+$/, "");
  return `${v ? `${k}: ${v}.` : `${k}.`}${s ? ` ${s}.` : ""}`;
}

// ---------------------------------------------------------------- one next step (stress test 2026-11-11, FL-HOME)
/** The checklist's short button words, by step key. */
export const SHORT_LABEL = { accounts: "Add your accounts", people: "Add your household", income: "Enter what comes in", expenses: "Enter what goes out", goals: "Set your first goal", assumptions: "Look over our guesses" };

/**
 * homeNext({ setupOn, hasMoney, path, setup, steps, move }) -> { kind, label, href, line } | null: the Dashboard's one
 * filled button, so the Dashboard, Get started and Your plan name one next thing with one count.
 *   path    guide/compute.js pathSummary(plan) (null when the setup page is off)
 *   setup   start/compute.js setupCard(plan): "new" | "started" (question q of total) | "done"
 *   steps   this module's compute(plan) (the six basics)
 *   move    setup's standing().moves[0] (what to do with money), or null
 * Kinds, first that applies:
 *   questions  the path is at its first step and the questions were started: "Continue your plan: question 3 of 7"
 *   basics     the path is at its first step, the questions never opened and the plan built by hand: the first missing basic
 *              (the path's first step is done by the five basics, so this is the same step in the plan's own words)
 *   path       the path under way: "Continue your plan: Your month", with "Your plan: step 2 of 8" above it
 *   move       the path complete: the next move with money; "plan" ("See your plan") when there is no move
 *   setup      nothing in the plan and the questions not started: "Set up my plan"
 *   checklist  the setup page is off on this device: "Do step N: ..." of the six basics (design log 2026-09-15, round 1)
 */
export function homeNext({ setupOn = false, hasMoney = false, path = null, setup = null, steps = null, move = null } = {}) {
  const basicNext = steps?.next ?? null;
  const basicIdx = basicNext ? steps.steps.indexOf(basicNext) : -1;
  if (setupOn && path?.started && !path.complete && path.next) {
    if (path.next.key === "answers") {
      if (!hasMoney && setup?.state === "new") return { kind: "setup", label: "Set up my plan", href: "#/overview/setup", line: null };
      if (setup?.state === "started") return { kind: "questions", label: `Continue your plan: question ${setup.q} of ${setup.total}`, href: setup.href, line: null };
      if (hasMoney && basicNext && basicNext.key !== "assumptions" && setup?.state !== "done") return { kind: "basics", label: `Continue your plan: ${SHORT_LABEL[basicNext.key] ?? basicNext.label}`, href: `#/${basicNext.go.join("/")}`, line: null };
    }
    return { kind: "path", label: `Continue your plan: ${path.next.name}`, href: path.next.href, line: `Your plan: step ${path.step} of ${path.total}` };
  }
  if (setupOn && path?.complete) return move ? { kind: "move", label: `Your next move: ${move.title}`, href: move.href, line: null } : { kind: "plan", label: "See your plan", href: path.planHref, line: null };
  if (setupOn && !hasMoney) return setup?.state === "started" ? { kind: "questions", label: `Continue your plan: question ${setup.q} of ${setup.total}`, href: setup.href, line: null } : { kind: "setup", label: "Set up my plan", href: "#/overview/setup", line: null };
  if (setupOn && move) return { kind: "move", label: `Your next move: ${move.title}`, href: move.href, line: null };
  if (basicNext) return { kind: "checklist", label: `Do step ${basicIdx + 1}: ${SHORT_LABEL[basicNext.key] ?? basicNext.label}`, href: `#/${basicNext.go.join("/")}`, line: null };
  return null;
}

/**
 * firstStep(plan) -> the path's first step ("The questions") said one way on every page (review 2026-11-11, N4 and N5):
 *   { kind: "questions", q, total, label, href }  the questions started and not finished: "Continue your plan: question 5 of 7"
 *   { kind: "basics", key, label, href }           never opened, the plan built on the pages: the first missing basic,
 *                                                  "Continue your plan: Enter what goes out" (homeNext's basics branch)
 *   { kind: "start", label, href }                 never opened and no accounts yet: "Set up my plan"
 *   null                                           otherwise (the questions finished, or every basic in)
 * The Dashboard (homeNext), Your plan, Get started and the quiet row at the bottom of every page (guide continueFor) all ask it.
 */
export function firstStep(plan) {
  const sp = setupProgress(plan);
  if (sp.started && !sp.finished) {
    const mid = sp.at && sp.at !== "welcome";
    // the number of the screen the link opens, as Get started's setupCard says it: progress() steps past a screen with
    // nothing to ask but keeps that screen's number (attack: "question 4 of 7" here, "question 5 of 7" there, both to owe)
    const q = mid ? SETUP_SCREENS.find((x) => x.id === sp.at)?.q ?? sp.q ?? 1 : 1;
    return { kind: "questions", q, total: QUESTIONS, label: `Continue your plan: question ${q} of ${QUESTIONS}`, href: `#/overview/setup/${mid ? sp.at : "you"}` };
  }
  if (sp.started || sp.finished) return null;
  const d = compute(plan);
  const b = d.next;
  // no accounts yet (pay alone, or nothing): the questions, "Set up my plan" (attack on N5: four pages, four next steps)
  if (!d.hasMoney) return { kind: "start", label: "Set up my plan", href: "#/overview/setup" };
  if (!b || b.key === "assumptions") return null;
  return { kind: "basics", key: b.key, label: `Continue your plan: ${SHORT_LABEL[b.key] ?? b.label}`, href: `#/${b.go.join("/")}` };
}

/**
 * calmHeadline(headline, { underWay }) -> the where-you-stand sentence as the Dashboard shows it. The setup's sentence was
 * written for its reveal, which once listed the moves: on the Dashboard nothing "below" is a list of moves (j-first-family/F4),
 * and while the path is under way the filled button continues the path, so the sentence gives the verdict without naming a
 * different next thing (j-debt-fixer/D4). Words only: nothing is worked out here.
 */
export function calmHeadline(headline, { underWay = false } = {}) {
  let s = String(headline ?? "");
  s = s.replace(/; the moves below start with the lean months\./, ".")
    .replace(/, and the moves below start there\./, ".")
    .replace(/ The moves below start there\./, underWay ? "" : " Your next move starts there.")
    // the setup's own sentence says it so since left2 (W b): while the path is under way its button is the next move
    .replace(/ Your next move starts there\.$/, underWay ? "" : " Your next move starts there.");
  if (underWay) {
    s = s.replace(/ The first move fixes that\.$/, "")
      .replace(/^Your month works\. (The move below comes first, then a bigger emergency fund for surprises|Building your emergency fund is next)\.$/, "Your month works. Your emergency fund is thin.")
      .replace(/^(The move below comes first, then an emergency fund for surprises|An emergency fund is the thing to build first)\.$/, "Your emergency fund is thin.")
      .replace(/ Here's how to make it even better\.$/, "")
      // "X comes first" beside a button that continues the path elsewhere: the same fact, said as how things stand (retest)
      .replace(/^Paying off costly debt comes first\.$/, "You have costly debt to pay off.")
      .replace(/^Life insurance for the people who count on you comes first\.$/, "The people who count on you would be short if an earner died.")
      .replace(/ That's the first thing to fix\.$/, "");
  }
  return s;
}

// ---------------------------------------------------------------- the retirement row (gy1, 2026-11-16; z1)
const SETUP_BACK = (id) => `#/overview/setup/${id}?back=done`;
/**
 * retireRow(st, { plan, today, back, proj }) -> the Dashboard's retirement row { dot, k: "Retirement", s, v, open?, href }
 * from Get started's standing() `st`: the view's branches, moved here as they were so a test can read them (gy1). While Social
 * Security is the only gap and Will the money last? says the money lasts without it, standing() already carries that answer
 * (overview/setup lastsWithoutSs, the one rule every overview page asks since z1; this file kept its own copy before) with
 * `withoutSs`, and the row says whose Social Security it leaves out ("The money lasts, even without Sam's Social Security" /
 * "On track", or "Partly our guesses of your spending, without Sam's Social Security" while our guesses carry it; gy1 fix F2,
 * P2). `back(id)`: the link to a Get started question (the view's picks the questions up where they stopped).
 */
export function retireRow(st0, { plan, today = null, back = SETUP_BACK, proj = null } = {}) {
  const st = st0 ?? {};
  const why = st.tileWhy ?? {};
  const pj = () => { if (proj) return proj; try { return projection(plan, { today }); } catch { return null; } };
  // Social Security and the birth dates known, the forecast still waits: on the spending (j-first-renter/x-1: it said the
  // ages were missing and sent them back to the question they had just answered)
  // (tileWhy.retire: the check's own gap, the savings or the spending, as the summary tile says it; tileAt.retire: the
  // question it waits for. "A few more of your figures" opens Will the money last?, which lists them)
  if (!st.retire && why.retire) { const known = st.retirementKnown ?? !st.retirementMissing, s = rowWords(why.retire); return { dot: "", k: "Retirement", s, v: "Add ›", open: true, href: !known ? back("ages") : /a few more of your figures/.test(s) ? "#/retirement/projection" : back(st.tileAt?.retire ?? "spend") }; }
  if (!st.retire && !st.retirementMissing && !(plan?.expenses ?? []).length) return { dot: "", k: "Retirement", s: "Needs what you spend each month", v: "Add ›", open: true, href: back("spend") };
  if (!st.retire && !st.retirementMissing) return { dot: "", k: "Retirement", s: "Needs a few more of your figures", v: "Add ›", open: true, href: "#/retirement/projection" };
  if (!st.retire) return { dot: "", k: "Retirement", s: `Needs ${st.retirementMissing}`, v: "Add ›", open: true, href: back("ages") };
  // the tick for a retirement account is on "What do you have?", not on the amounts screen (j-first-renter/x-2)
  if (st.retireSavingsUnknown) return { dot: "", k: "Retirement", s: "Add your retirement savings to see", v: "Not known yet", open: true, href: back("have") };
  // (an answer without the Social Security not in yet says so: "..., without Sam's Social Security"; gy1 fix P2)
  if (st.retireGuessed) return { dot: "", k: "Retirement", s: `${retireGuessAsk(st).dash}${st.withoutSs ? `, without ${st.withoutSs}` : ""}`, v: st.retire.verdict === "on track" ? "On track" : st.retire.verdict === "tight" ? "Tight" : "Needs a look", href: "#/retirement/projection" };
  // "Small changes help" only when they would (the plan carries 85% or more of the spending: plan/words.js smallChangesHelp);
  // else "Check the numbers first", landing on "What this answer rests on" (retirement spec D1, L12)
  const ok = st.retire.verdict === "on track", small = ok || smallChangesHelp(pj());
  return { dot: ok ? "ok" : "warn", k: "Retirement", s: ok ? (st.withoutSs ? `The money lasts, even without ${st.withoutSs}` : "The money lasts") : small ? "Small changes help" : "Check the numbers first", v: ok ? "On track" : st.retire.verdict === "tight" ? "Tight" : st.retire.shortAge ? `Short at ${st.retire.shortAge}` : "Needs a look", href: small ? "#/retirement/projection" : "#/retirement/projection?check=1" };
}
/**
 * retireWaitRow(row, wait) -> what the retirement row (retireRow) takes while a card under "where you stand" waits on the
 * spending or the debts (C7 UX reviews 2 and 4: no coloured dot, "See below ›", a tap that scrolls to the card; the view adds
 * the tap). wait: "missing" ("Is something missing?": the list may be short), "spend" (spending skipped), "debts" (what you
 * owe not all in). It said "Depends on the figures below" whatever it waited on, and while the list may be short it held back
 * the answer every other overview page gives (z1 fix round, critic P1: Ruth and Sam read "Depends on the figures below" here
 * and "The money lasts" one tap away). Now, while the list may be short, an answer that lasts is said on what is listed ("The
 * money lasts on what you listed", spoken "Retirement: see below. ..."); any other answer, and a skipped figure, says what it
 * waits on. Open rows keep their own words. -> { dot, s, v, open, said? } | null
 */
export function retireWaitRow(row, wait) {
  if (!row || row.open) return null;
  const lasts = wait === "missing" && row.dot === "ok";
  const s = lasts ? "The money lasts on what you listed" : wait === "missing" ? "Depends on your spending list. Check it below" : wait === "spend" ? "Depends on your spending: not counted yet" : "Depends on what you owe: not all counted yet";
  return { dot: "", s, v: "See below ›", open: true, ...(lasts ? { said: "see below" } : {}) };
}
