// qa/fixtures/guess-walk.mjs -- two invented households made by walking Get started (overview/setup) the way its screens save,
// with the boxes a layperson does not know left empty, so the plan holds today's guesses ledger (core/estimate): the gray
// figures each screen showed, written and marked, then kept fresh by settle after every save. Used by the verdict ranges and
// the guesses ranking (tests/guess-verdicts.test.mjs) and their screenshots. Every name and figure is invented.
//   alex    single renter in Ohio, 31, pays typed ($52,000); checking, spending and the cushion left to us (nearly empty)
//   rivera  married in Texas, two children (4 and 9), one pay typed and one left to us, both 401(k)s, checking and savings,
//           the home, the mortgage, a card and a car loan left to us, spending left to us with "yes" to child care (full)
// Not named *-plan.mjs on purpose: tests/guesses-invariance.test.mjs holds every *-plan.mjs fixture to "no ledger".
import * as S from "../../modules/overview/setup/compute.js";
import { estimators as guessEstimators, TABLES } from "../../modules/overview/guesses/compute.js";
import { estimate, settle, mergeEstimators } from "../../core/estimate/index.js";
import { emptyPlan, migrate } from "../../core/schema/migrate.js";

export const WALK_TODAY = "2026-11-13";
/** The registry Get started's screens read (the guesses page's core set and the setup's own). */
export const WALK_REGISTRY = mergeEstimators([{ from: "overview/guesses", estimators: guessEstimators, tables: TABLES }, { from: "overview/setup", estimators: S.estimators }]);

function walker(today) {
  const GO = { estimators: WALK_REGISTRY.estimators, tables: WALK_REGISTRY.tables, today };
  // each screen's save: the gray figures are worked out on the plan before the save (ctx.guess), then settle runs (store.update)
  return (p, fn) => { const before = structuredClone(p); const guess = (k, o = {}) => estimate(before, k, { ...GO, ...o }); fn(guess); settle(p, GO); };
}

export function alex(today = WALK_TODAY) {
  const p = migrate(emptyPlan());
  const step = walker(today);
  S.applyYou(p, { name: "Alex", who: "me", kids: 0, state: "OH" });
  step(p, (guess) => S.applyMoney(p, { people: { "setup-self": { status: "work", amount: "52,000", period: "annual" } }, today }, today, { guess }));
  step(p, (guess) => S.applyAges(p, { people: { "setup-self": { month: 5, year: 1995, stopAge: 65, ss: { mode: "estimate" } } } }, today, { guess }));
  S.applyHavePicks(p, ["checking"]);
  step(p, (guess) => S.applyHaveAmounts(p, {}, today, { guess }));
  S.applyOwePicks(p, ["none"]);
  step(p, (guess) => S.applyOweAmounts(p, {}, today, { guess }));
  step(p, (guess) => S.applySpend(p, { mode: "rows", rows: {} }, today, { guess }));
  S.applyGoalPicks(p, ["cushion"]);
  step(p, (guess) => S.applyGoalDetails(p, { cushion: { months: 3 } }, today, null, { guess }));
  S.markAt(p, "done", today);
  return p;
}

export function rivera(today = WALK_TODAY) {
  const p = migrate(emptyPlan());
  const step = walker(today);
  S.applyYou(p, { name: "Sam", who: "spouse", partnerName: "Jo", kids: 2, state: "TX" });
  step(p, (guess) => S.applyMoney(p, { people: { "setup-self": { status: "work", amount: "78,000", period: "annual" }, "setup-partner": { status: "work", amount: "" } }, today }, today, { guess }));
  step(p, (guess) => S.applyAges(p, { people: { "setup-self": { month: 3, year: 1986, stopAge: 65, ss: { mode: "estimate" } }, "setup-partner": { month: 8, year: 1988, stopAge: 65, ss: { mode: "estimate" } } }, kids: { "setup-kid-1": 2022, "setup-kid-2": 2017 } }, today, { guess }));
  S.applyHavePicks(p, ["checking", "savings", "retire", "home"]);
  step(p, (guess) => S.applyHaveAmounts(p, {}, today, { guess }));
  S.applyOwePicks(p, ["mortgage", "credit", "car-loan"]);
  step(p, (guess) => S.applyOweAmounts(p, {}, today, { guess }));
  p.guide.setup.taps = { ...(p.guide.setup.taps ?? {}), childcare: "yes" };
  step(p, (guess) => S.applySpend(p, { mode: "rows", rows: {} }, today, { guess }));
  S.applyGoalPicks(p, ["cushion", "retire"]);
  step(p, (guess) => S.applyGoalDetails(p, { cushion: { months: 6 } }, today, null, { guess }));
  S.markAt(p, "done", today);
  return p;
}
