// tests/guesses-legacy.test.mjs -- the guesses Get started already makes (before the ledger) in commit C1: read as
// frozen guesses, listed on "Our guesses for you", never moved by settle; "That's about right" or a typed figure makes
// each the person's own, and the setup then leaves it alone. C2: the "Better guesses are ready" card (spec 11.5) offers
// the new figures; "Use the new guesses" writes them to the ledger (they follow the answers from then on), "Keep the old
// ones" moves nothing, and either way the card does not come back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, mergeEstimators, guessesInUse, confirmGuess, saveField, isGuess, getAt } from "../core/estimate/index.js";
import { compute, estimators as guessEstimators, TABLES, upgradeOffers, useNewGuesses, keepOldGuesses } from "../modules/overview/guesses/compute.js";
import * as S from "../modules/overview/setup/compute.js";
import { guessedPlan } from "../qa/fixtures/guessed-plan.mjs";

const T = "2026-11-01";
const REG = mergeEstimators([{ from: "overview/guesses", estimators: guessEstimators, tables: TABLES }, { from: "overview/setup", estimators: S.estimators }]);
const OPTS = { estimators: REG.estimators, tables: REG.tables, today: T };
const figures = (p) => JSON.stringify({ a: p.accounts.map((x) => [x.id, x.balance]), d: p.debts.map((x) => [x.id, x.rate, x.minPayment, x.rateGuessed, x.paymentGuessed]), ss: p.retirement.socialSecurity, r: p.retirement.spendingMonthly, g: p.goals.map((x) => [x.id, x.target, x.fundedBy]), s: p.guide.setup });
/** What store.update does with the hook registered: the page's change, then settle. */
const update = (p, fn) => { const next = structuredClone(p); fn(next); return { plan: next, settled: settle(next, OPTS) }; };

test("an unrelated change (renaming a goal) moves no figure and no flag", () => {
  const p = guessedPlan(T);
  const { plan, settled } = update(p, (d) => { d.goals[0].name = "Rainy day money"; });
  assert.deepEqual(settled, { changed: [], dropped: [] });
  assert.equal(figures(plan), figures(p));
  assert.equal("guesses" in plan, false);
  // a change the older guesses depend on does not move them either (frozen until C2's "Better guesses" card)
  const moved = update(p, (d) => { d.household.state = "AZ"; d.income[0].amount = Number(d.income[0].amount) * 2; });
  assert.deepEqual(moved.settled, { changed: [], dropped: [] });
  assert.equal(JSON.stringify(moved.plan.debts), JSON.stringify(p.debts));
});

test("the page lists today's older guesses: the typical rates and payments, Social Security from pay, retirement spending, the cushion", () => {
  const p = guessedPlan(T);
  const d = compute(p, { ...OPTS });
  assert.equal(d.count, 9);
  assert.equal(d.frozen, 0);
  assert.deepEqual(d.rows.map((r) => r.label), [
    "Mortgage: payment a month", "Mortgage: interest rate", "Credit cards: payment a month", "Credit cards: interest rate",
    "Ana's Social Security at full retirement age", "Bo's Social Security at full retirement age", "Spending a month once work stops",
    "Emergency fund: safety cushion to aim for", "Emergency fund: accounts that hold the cushion",
  ]);
  const row = (label) => d.rows.find((r) => r.label === label);
  assert.deepEqual([row("Mortgage: interest rate").value, row("Mortgage: interest rate").why, row("Mortgage: interest rate").sources], [0.0724, "the average rate on a new 30-year mortgage", ["mortgage_rate_pmms_weekly_2026"]]);
  assert.deepEqual([row("Credit cards: interest rate").value, row("Credit cards: interest rate").sources], [0.2236, ["cc_apr_fed_g19"]]);
  assert.deepEqual(row("Credit cards: payment a month").sources, ["cc_apr_fed_g19", "card_minimum_payment_rule_cfpb"]);
  assert.equal(row("Credit cards: payment a month").why, "the month's interest plus 1% of what you owe, a usual minimum");
  assert.equal(row("Mortgage: payment a month").why, "what pays off what you owe over 30 years at our rate guess");
  assert.equal(row("Mortgage: payment a month").stale, false, "the rate and the balance are the ones it was worked out from");
  assert.equal(row("Ana's Social Security at full retirement age").why, "worked out from the pay on file with Social Security's formula");
  assert.equal(row("Ana's Social Security at full retirement age").basis, "yours");
  assert.equal(row("Emergency fund: safety cushion to aim for").why, "3 months of your must-pay bills");
  assert.equal(row("Emergency fund: accounts that hold the cushion").kind, "list");
  assert.ok(d.rows.every((r) => r.legacy && r.why.length <= 70 && r.href), "each legacy, with a why of at most 70 characters and a page");
  assert.deepEqual([d.big.length, d.small.length], [7, 2]);
  assert.deepEqual(d.sources.used.map((s) => s.id), ["mortgage_rate_pmms_weekly_2026", "cc_apr_fed_g19", "card_minimum_payment_rule_cfpb"]);
  assert.equal(d.sources.all.length, Object.keys(TABLES).length);
  assert.equal(d.planEmpty, false);
  // a rate that is not the table's own figure (an older app's 7.17% on a mortgage) cites nothing
  const q = guessedPlan(T); const m = q.debts.find((x) => x.id === "setup-debt-mortgage"); m.rate = m.rateGuessed = 0.0717;
  const r = compute(q, { ...OPTS }).rows.find((x) => x.label === "Mortgage: interest rate");
  assert.deepEqual([r.why, r.sources], ["a typical rate filled in when the box was left empty", []]);
});

test("\"That's about right\" makes each older guess the person's own; the figures stay and the setup leaves them", () => {
  const p = guessedPlan(T);
  const before = compute(p, OPTS).rows.map((r) => [r.path, JSON.stringify(r.value)]);
  for (const r of compute(p, OPTS).rows) confirmGuess(p, r.path);
  assert.equal(guessesInUse(p).length, 0);
  assert.equal(compute(p, OPTS).count, 0);
  for (const [path, v] of before) assert.equal(JSON.stringify(getAt(p, path)), v, `${path} kept its figure`);
  const mort = p.debts.find((x) => x.id === "setup-debt-mortgage");
  assert.deepEqual([mort.rate, mort.minPayment, "rateGuessed" in mort, "paymentGuessed" in mort], [0.0724, 1261, false, false]);
  assert.equal(S.rateIsGuess(mort), false, "Liabilities and the setup read it as typed now");
  assert.deepEqual([p.guide.setup.ssWrote, p.guide.setup.retireAuto, p.guide.setup.cushionTarget, "cushionFunds" in p.guide.setup], [{}, false, null, false]);
  assert.equal(S.valuesFor(p, "spend", { today: T }).retireTyped, true, "retirement spending stays put when the bills change");
  // the setup run again: the kept cushion amount and the kept Social Security figure are not written over
  const ss = p.retirement.socialSecurity["setup-self"].monthlyAtFRA, target = p.goals.find((g) => g.id === "setup-goal-cushion").target;
  S.applyGoalDetails(p, { cushion: { months: 6 } }, T);
  assert.equal(p.goals.find((g) => g.id === "setup-goal-cushion").target, target);
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: "90k", period: "annual" }, "setup-partner": { status: "work", amount: "1,900", period: "biweekly" } } });
  S.applyAges(p, { people: { "setup-self": { month: 4, year: 1988, stopAge: 65, ss: { mode: "estimate" } }, "setup-partner": { month: 9, year: 1986, stopAge: 65, ss: { mode: "estimate" } } }, kids: { "setup-kid-1": 2019 } }, T);
  assert.equal(p.retirement.socialSecurity["setup-self"].monthlyAtFRA, ss);
  // while still a guess, the same setup run does follow (unchanged behaviour)
  const q = guessedPlan(T), t0 = q.goals.find((g) => g.id === "setup-goal-cushion").target;
  S.applyGoalDetails(q, { cushion: { months: 6 } }, T);
  assert.equal(q.goals.find((g) => g.id === "setup-goal-cushion").target, t0 * 2);
});

test("a figure typed on the page is the person's: the flag goes, and the setup keeps the typed figure", () => {
  const p = guessedPlan(T);
  saveField(p, "debts[setup-debt-mortgage].rate", { value: 0.0625, guessed: false }, null, T);
  saveField(p, "debts[setup-owe-credit].minPayment", { value: 150, guessed: false }, null, T);   // the account's spelling
  const mort = p.debts.find((x) => x.id === "setup-debt-mortgage"), card = p.debts.find((x) => x.id === "setup-debt-credit");
  assert.deepEqual([mort.rate, "rateGuessed" in mort, card.minPayment, "paymentGuessed" in card], [0.0625, false, 150, false]);
  assert.equal(isGuess(p, "debts[setup-debt-mortgage].rate"), false);
  assert.equal(isGuess(p, "debts[setup-debt-mortgage].minPayment"), true, "the payment is still ours");
  S.applyOweAmounts(p, { credit: { owed: 3600 }, mortgage: { owed: 185000, home: "260k" } }, T);   // Get started again, boxes still empty
  assert.deepEqual([mort.rate, card.minPayment], [0.0625, 150]);
  assert.equal("guesses" in p, false, "no ledger is written in C1");
  assert.equal(compute(p, OPTS).count, 7);
});

test("C2 Better guesses are ready: the older guesses that would change, each worked out after the ones before it", () => {
  const p = guessedPlan(T), before = JSON.stringify(p);
  const offers = upgradeOffers(p, OPTS);
  assert.equal(JSON.stringify(p), before, "offering writes nothing");
  assert.deepEqual(offers.map((x) => [x.label, x.from, x.to]), [
    // Ohio's average on mortgages people have (FHFA) in place of a new loan's national 7.24%
    ["Mortgage: interest rate", 0.0724, 0.046],
    // $185,000 at 4.6% = $948.4 + Ohio's tax on the $260,000 home ($265.0) + insurance ($98.3) = $1,311.7 -> $1,300
    ["Mortgage: payment a month", 1261, 1300],
    // not offered: spending once work stops would fall $4,100 -> $2,840 only because the new $1,300 (which holds Ohio's tax
    // and insurance) is counted as all loan payment, so the $185,000 "ends" in about 2044 instead of 2056 (C2 review, UX 1).
    // The card never lowers retirement spending; the older figure stays until the person types one.
    ["Emergency fund: safety cushion to aim for", 12000, 12100],
  ]);
  assert.ok(!offers.some((x) => x.k === "overview/setup:retireSpend"));
  // the card rate and payment are the same figures today: not offered; nor is Social Security (worked out from pay, unchanged)
  assert.ok(!offers.some((x) => /Credit cards|Social Security/.test(x.label)));
  // the guesses page carries them without the estimates behind them
  assert.deepEqual(compute(p, OPTS).offers.upgrade.map((x) => x.path), offers.map((x) => x.path));
});

test("C2 Use the new guesses: written as guesses (ledger and older flags), and from then on they follow the answers", () => {
  const p = guessedPlan(T);
  const n = useNewGuesses(p, OPTS);
  assert.equal(n, 3);
  const mort = p.debts.find((x) => x.id === "setup-debt-mortgage");
  assert.deepEqual([mort.rate, mort.rateGuessed, mort.minPayment, mort.paymentGuessed], [0.046, 0.046, 1300, 1300]);
  assert.deepEqual(Object.keys(p.guesses).sort(), ["debts[setup-debt-mortgage].minPayment", "debts[setup-debt-mortgage].rate", "goals[setup-goal-cushion].target"]);
  assert.equal(p.retirement.spendingMonthly, 4100, "retirement spending is not lowered by the card");
  assert.deepEqual(p.guide.guessUpgrade, { at: T, choice: "new" });
  assert.deepEqual(upgradeOffers(p, OPTS), [], "the card does not come back");
  assert.ok(compute(p, OPTS).rows.some((r) => r.label === "Mortgage: interest rate" && !r.legacy), "the same words as the older row");
  assert.deepEqual(settle(structuredClone(p), OPTS), { changed: [], dropped: [] }, "fresh as written");
  // moving to Arizona: the rate follows (4.3%), the payment with it
  const { plan } = update(p, (d) => { d.household.state = "AZ"; });
  assert.equal(plan.debts.find((x) => x.id === "setup-debt-mortgage").rate, 0.043);
  assert.notEqual(plan.debts.find((x) => x.id === "setup-debt-mortgage").minPayment, 1300);
});

test("C2 Keep the old ones: nothing moves, the older guesses stay frozen, and the card does not come back", () => {
  const p = guessedPlan(T), before = figures(p);
  keepOldGuesses(p, T);
  assert.equal(figures(p), before);
  assert.deepEqual(p.guide.guessUpgrade, { at: T, choice: "kept" });
  assert.equal("guesses" in p, false);
  assert.deepEqual(upgradeOffers(p, OPTS), []);
  assert.deepEqual(compute(p, OPTS).offers.upgrade, []);
  const { settled } = update(p, (d) => { d.household.state = "AZ"; });
  assert.deepEqual(settled, { changed: [], dropped: [] });
});
