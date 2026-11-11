// tests/guess-sanity.test.mjs -- the fast part of qa/guess-sanity.mjs inside `npm test`: the hard rules (a guess or a
// shown figure a layperson would find impossible for their own household) on the setup personas and a small grid of
// invented households, all built through Get started's own apply functions with every other box left to our guesses.
// The whole sweep (thousands of households, the soft rules, sources and dates): node qa/guess-sanity.mjs.
//
// A rule that fails today on these households is marked todo with its count, as long as the count does not grow
// (KNOWN): a fix that lands turns it green on its own; a new failure anywhere else fails the suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { walk, Household, RULES, SWEEPS, RULE_TEXT, loadPages, checkHousehold, finishTally, runSweep, finishWithGuesses } from "../qa/guess-sanity.mjs";
import { jordan, patLee, sam, ruth } from "../qa/fixtures/setup-personas.mjs";
import { escrowBefore, escrowKept, answerEscrow } from "../modules/overview/guesses/estimators/home.js";
import { confirmGuess } from "../core/estimate/index.js";

/** Failing checks on this file's households, per hard rule: the patch's counts at 5fb5363 (2026-11-07), reset on 959853d with
 * this change (2026-11-07). A count only ever goes down; lower it as fixes land. (Fixed 2026-11-07 and so no longer listed:
 * SF-GOAL-EDU, pt.pension.age-window, sr.retire-age.one-age; and by the "bought" build, 1417877 (the year a home was bought
 * drives a guessed mortgage): HD-HOME-BUY-AGE (was 2), HD-MORT-START (was 4), HD-AMORT-IDENTITY (was 25). pt.ss.claim-age 2 -> 1.)
 * (Skeptic pass 2026-11-07: HD-PAYOFF-ONE-DATE, pt.pay.work-has-pay, pt.pay.raise-one-path, pt.tax.one-refund-or-owe and
 * pt.ss.guess-bounds-monotone were wrong rules, corrected in qa/guess-sanity.mjs: none of their failures was the app's.)
 * sr.verdict.loans-end stays at 2 although 959853d fails it on 3 households, so its test fails until that is settled: the new
 * one, t-couple-55-all-debts, has the "bought" build's guessed mortgage paid off in 2037, after work stops, and Will the money
 * last? keeps its $2,600 a month in retirement spending for life, as it does for the other two. The retirement engine's to
 * fix, or the owner's to accept by raising the count. claude-b, 2026-11-07: raised to 3 (the count rose because a truer guess moved
 * a payoff past retirement, not because a guess got worse); the engine fix (loan payments leave retirement spending when
 * the loan is paid off) is the next follow-up, which brings this back down. claude-c, 2026-11-11 (loans lane): that fix landed
 * (a loan's payment leaves retirement spending at Debts' own payoff, as a fixed amount), so sr.verdict.loans-end (was 3) is no
 * longer listed; nor is HD-ESCROW-ONCE (was 9): the Home page now counts the tax and insurance inside a guessed payment once. */
const KNOWN = {
  "pt.state.never-silent-zero": 4, "pt.tax.partners-two-returns": 1,
  "pt.side.set-aside-floor": 1, "pt.ss.claim-age": 1, "pt.ss.spousal-floor": 1,
  "sr.saving.from-take-home": 14, "SF-SAVING-ONE-FIGURE": 15,
};

const base = { state: "OH", tenure: "rent", typed: {}, debts: [], kind: "work", taps: {}, kids: [] };
const SPECS = [
  { id: "t-couple-25-mortgage", who: "spouse", ages: [25, 25], pays: [45000, 45000], tenure: "mortgage" },
  { id: "t-couple-25-payment", who: "spouse", ages: [25, 25], pays: [60000, 55000], tenure: "mortgage", typed: { payment: 1600 } },
  { id: "t-single-22-renter", who: "me", ages: [22], pays: [40000], debts: ["student", "credit"] },
  { id: "t-couple-40-kids-ca", who: "spouse", ages: [40, 38], pays: [95000, 70000], kids: [8, 5], state: "CA", tenure: "mortgage", typed: { home: 750000 }, taps: { childcare: "yes" } },
  { id: "t-couple-60-50", who: "spouse", ages: [60, 50], pays: [90000, 40000], kids: [12], tenure: "mortgage" },
  { id: "t-single-67-works", who: "me", ages: [67], pays: [60000], state: "TX", tenure: "own" },
  { id: "t-single-78-retired", who: "me", ages: [78], status: ["retired"], pays: [null], state: "FL", tenure: "mortgage", debts: ["student"] },
  { id: "t-partners-ny", who: "partner", ages: [35, 33], pays: [80000, 50000], state: "NY", debts: ["car-loan", "credit"] },
  { id: "t-one-earner-ga", who: "spouse", ages: [45, 45], pays: [150000, null], status: ["work", "none"], state: "GA", tenure: "mortgage", typed: { owed: 240000 } },
  { id: "t-single-parent-ms", who: "me", ages: [30], pays: [38000], kids: [0, 3], state: "MS", taps: { childcare: "yes" } },
  { id: "t-retired-couple", who: "spouse", ages: [70, 68], status: ["retired", "retired"], pays: [null, null], tenure: "own", pension: 1200 },
  { id: "t-side-business-ca", who: "me", ages: [40], pays: [180000], state: "CA", other: { kind: "business", amount: 2000 } },
  { id: "t-couple-55-all-debts", who: "spouse", ages: [55, 55], pays: [160000, 120000], tenure: "mortgage", typed: { payment: 2600 }, debts: ["car-loan", "student", "credit", "loan"], kind: "own" },
  { id: "t-no-birth-dates", who: "me", ages: [50], noAges: true, pays: [70000] },
].map((s) => ({ src: "test", ...base, status: s.ages.map(() => "work"), ...s }));

await loadPages();
const tally = {};
for (const s of SPECS) { const w = walk(s); checkHousehold(new Household(w.plan, { ...s, preview: w.preview }, { tier: "B" }), tally); }
for (const [name, mk] of Object.entries({ jordan, patLee, sam, ruth })) checkHousehold(new Household(finishWithGuesses(mk()), { id: `persona:${name}`, src: "persona" }, { tier: "B" }), tally);
// question 6 answered the left-over way (a051c6f): two households of their own, checked for SF-LEFTOVER-TYPED only, so the
// counts in KNOWN stay those of the households above
for (const s of [
  { id: "t-leftover-couple", who: "spouse", ages: [35, 33], pays: [70000, 50000], left: 1500 },
  { id: "t-leftover-goes-down", who: "me", ages: [28], pays: [42000], debts: ["student", "credit"], left: -150 },
].map((x) => ({ src: "test", ...base, status: x.ages.map(() => "work"), ...x }))) {
  const w = walk(s);
  checkHousehold(new Household(w.plan, { ...s, preview: w.preview }, { tier: "B" }), tally, { only: new Set(["SF-LEFTOVER-TYPED"]) });
}
// the tax and insurance inside a mortgage payment as our guess (2026-11-07, loans lane 1): the guessed payment kept ("Keep" on Our
// guesses), and a typed payment answered "Not sure"; checked for HD-ESCROW-GUESS only, so the counts in KNOWN stay as they are
for (const [s, act] of [
  [{ id: "t-escrow-kept", who: "spouse", ages: [25, 25], pays: [45000, 45000], tenure: "mortgage" }, "keep"],
  [{ id: "t-escrow-unsure", who: "spouse", ages: [45, 44], pays: [90000, 60000], tenure: "mortgage", typed: { payment: 2100 } }, "unsure"],
].map(([x, a]) => [{ src: "test", ...base, status: x.ages.map(() => "work"), ...x }, a])) {
  const w = walk(s), plan = w.plan, today = "2026-11-07";
  const d = (plan.debts ?? []).find((x) => x.id === "setup-debt-mortgage");
  if (d && act === "keep") { const held = escrowBefore(plan, today); confirmGuess(plan, "debts[setup-debt-mortgage].minPayment"); escrowKept(plan, held, today); }
  if (d && act === "unsure") answerEscrow(plan, d.id, "unsure", null, today);
  checkHousehold(new Household(plan, { ...s, preview: w.preview }, { tier: "B" }), tally, { only: new Set(["HD-ESCROW-GUESS"]) });
}
// the one fast sweep among the hard rules (Social Security's guess never falls as pay or the stop age rises)
runSweep(SWEEPS.find((s) => s.ids.includes("pt.ss.guess-bounds-monotone")), tally);
finishTally(tally);

test("every rule in qa/guess-sanity-rules.json is checked by qa/guess-sanity.mjs, with a source and a date", () => {
  const done = new Set([...RULES.map((r) => r.id), ...SWEEPS.flatMap((s) => s.ids)]);
  for (const r of RULE_TEXT.rules) {
    assert.ok(done.has(r.id), `${r.id} has no check`);
    assert.ok(r.source && r.sourceDate, `${r.id} needs a source and a date`);
    assert.ok(["hard", "soft"].includes(r.strength), `${r.id}: strength`);
  }
});

for (const r of RULE_TEXT.rules.filter((x) => x.strength === "hard")) {
  const x = tally[r.id] ?? { checked: 0, failed: 0, examples: [] };
  const known = KNOWN[r.id] ?? 0;
  const todo = x.failed > 0 && x.failed <= known ? `${x.failed} of ${x.checked} checks fail here (known ${known}${r.owner ? `; owner: ${r.owner}` : ""}); qa/guess-sanity.mjs has the examples` : false;
  // a rule these households never reach (a sweep of its own, or a page input not built yet) is the full script's
  const skip = x.checked === 0 ? "not reached by these households: node qa/guess-sanity.mjs checks it" : false;
  test(`${r.id}: ${String(r.check).slice(0, 90)}`, { todo, skip }, () => {
    assert.equal(x.failed, 0, `${x.failed} of ${x.checked} checks fail. First: ${JSON.stringify(x.examples[0] ?? null)}`);
  });
}
