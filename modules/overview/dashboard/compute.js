// modules/overview/dashboard/compute.js -- PURE. Setup steps, whether "Set up my plan" is finished, and whether the
// plan has enough in it to show money instead of a welcome. Where you stand and the next move come from
// overview/setup's standing() (view.js asks for it through ctx.computeOf). Readiness of pages (how many are built)
// is display logic done in view.js from ctx.modules. With a day (and the guesses registry merged from every module, as
// view.js asks), the cards about our guesses (spec 11.3; overview/guesses guessCards): "Fill in what you skipped", "Is
// something missing?" and "Better guesses are ready", the key `guesses` only while one of them applies.
import { guessCards, estimators as GUESS_ESTIMATORS } from "../guesses/compute.js";
import { progress as setupProgress, QUESTIONS, SCREENS as SETUP_SCREENS, estimators as SETUP_ESTIMATORS } from "../setup/compute.js";
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
  return { steps, doneCount, total: steps.length, next, setupFinished, hasMoney: (plan.accounts ?? []).length > 0, noteCount: Object.keys(plan.pageNotes ?? {}).length, ...(guesses ? { guesses } : {}) };
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
