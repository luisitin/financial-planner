// tests/guesses-saving-verify.test.mjs -- the final check of C4 (retirement saving is never $0): what it still got wrong
// once the review fixes were in, one failing-first test per defect (V1 ... V5, as in est/c4/c4-verify.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimators, TABLES } from "../modules/overview/guesses/compute.js";
import * as S from "../modules/overview/setup/compute.js";
import { compute as contributions } from "../modules/retirement/contributions/compute.js";
import { verdictWords } from "../modules/retirement/contributions/view.js";
import { removePerson } from "../modules/household/people/compute.js";
import { estimate, mergeEstimators, settle, isGuess } from "../core/estimate/index.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { jordan, patLee } from "../qa/fixtures/setup-personas.mjs";

const REG = mergeEstimators([{ from: "overview/guesses", estimators, tables: TABLES }, { from: "overview/setup", estimators: S.estimators }]);
const T0 = "2026-11-02";
const OPTS = { estimators: REG.estimators, tables: REG.tables, today: T0 };
const ME = "setup-self", PARTNER = "setup-partner";
const WP = (pid) => `setup-workplan-${pid}`;
const PUT = (pid) => `retirement.contributions[setup-contrib-${pid}].amount`, MATCH = (pid) => `retirement.contributions[setup-contrib-${pid}].employerMatch`;
const gx = (plan) => { const before = structuredClone(plan); return (key, opts = {}) => estimate(before, key, { ...OPTS, ...opts }); };
const q4b = (plan, v, picks) => { if (picks) S.applyHavePicks(plan, picks); S.applyHaveAmounts(plan, v, T0, { guess: gx(plan) }); return plan; };
const row = (plan, pid) => plan.retirement.contributions.find((c) => c.id === `setup-contrib-${pid}`);
const acct = (plan, id) => plan.accounts.find((a) => a.id === id);
const said = (plan, answer) => S.applyMoney(plan, { people: { [ME]: { status: "work", amount: "58000", period: "annual", plan: answer } } }, T0);

test("V1: a guessed balance in the plan at work (Q2's Yes) reopens grey on question 4b, and Back then Continue keeps it ours", () => {
  const j = jordan(); said(j, "yes"); q4b(j, {}, ["retire"]);
  assert.equal(acct(j, WP(ME)).balance, 26000);
  assert.ok(isGuess(j, `accounts[${WP(ME)}].balance`));
  const v = S.valuesFor(j, "have-amounts", { today: T0 });
  assert.equal(v[`retire-${ME}`], "", "before: the box showed 26000 as typed text (spec P2: a saved guess reopens as the grey figure)");
  q4b(j, v);
  assert.ok(isGuess(j, `accounts[${WP(ME)}].balance`), "before: Continue with nothing typed made the $26,000 the person's own");
  // a figure typed in the plan at work still reopens as typed
  const t = jordan(); said(t, "yes"); q4b(t, { [`retire-${ME}`]: "31000" }, ["retire"]);
  assert.equal(S.valuesFor(t, "have-amounts", { today: T0 })[`retire-${ME}`], 31000);
});

test("V2: 'No' to the plan at work after 'Yes' ends the guessed contribution and match ($0 + $0), and they stay $0", () => {
  const j = jordan(); said(j, "yes"); q4b(j, {}, ["retire"]);
  assert.deepEqual([row(j, ME).amount, row(j, ME).employerMatch], [270, 2160]);
  said(j, "no"); settle(j, OPTS);
  assert.deepEqual([row(j, ME)?.amount ?? 0, row(j, ME)?.employerMatch ?? 0], [0, 0], "before: $270 a month and $2,160 a year kept going into a plan the person said does not exist");
  assert.equal(contributions(j, { today: T0 }).totalYearly ?? 0, 0);
  settle(j, { ...OPTS, today: "2027-03-15" });
  assert.equal(row(j, ME)?.amount ?? 0, 0);
});

test("V3: 'no match' said after the match was guessed (Contributions, or no money in the formula on Work benefits) takes the guessed match to $0", () => {
  const j = jordan(); q4b(j, {}, ["retire"]);
  j.retirement.workPlans = { [ME]: { match: false } };          // Contributions' "No match at this job"
  settle(j, OPTS);
  assert.equal(row(j, ME).employerMatch, 0, "before: the guessed $2,160 a year stayed (frozen)");
  assert.ok(isGuess(j, MATCH(ME)), "still ours: it moves again if the answer goes");
  assert.equal(row(j, ME).amount, 270, "what the person puts in is not touched");
  const k = jordan(); q4b(k, {}, ["retire"]);
  k.whatIfs = { benefits: { [ME]: { matchTiers: [{ rate: 0, upTo: 0.06 }] } } };   // Work benefits: a formula with no money in it
  settle(k, OPTS);
  assert.equal(row(k, ME).employerMatch, 0);
  // a match the person typed is theirs: left alone
  const t = jordan(); q4b(t, { [`match-${ME}`]: "100", [`matchMode-${ME}`]: "know" }, ["retire"]);
  t.retirement.workPlans = { [ME]: { match: false } }; settle(t, OPTS);
  assert.equal(row(t, ME).employerMatch, 1200);
  // question 4b's own answer replaces an earlier "no match": Not sure there writes our guess, and it stays
  const n = jordan(); n.retirement.workPlans = { [ME]: { match: false } };
  q4b(n, { [`matchMode-${ME}`]: null }, ["retire"]);
  assert.equal(row(n, ME).employerMatch, 2160);
  settle(n, OPTS);
  assert.equal(row(n, ME).employerMatch, 2160, "the screen said 'about $180 a month': settle keeps it");
  assert.notEqual(n.retirement.workPlans?.[ME]?.match, false);
});

test("V4: question 4 does not tell someone to tap a Retirement tile that is already ticked", () => {
  // question 4 not answered yet (the order of Get started): C4 ticks Retirement for a plan at work
  const j = migrate(emptyPlan());
  S.applyYou(j, { name: "Jordan", who: "me", kids: 0, state: "OH" });
  said(j, "yes");
  assert.deepEqual(S.valuesFor(j, "have"), ["retire"]);
  assert.doesNotMatch(S.workPlanLine(j), /Tap Retirement/, "before: 'Money in it already? Tap Retirement.' (a tap unticks it)");
  assert.equal(S.workPlanLine(j), "Your plan at work is added. Next we'll ask what is in it and what you put in.");
  // unticked on screen, or question 4 answered without it: tap it
  assert.equal(S.workPlanLine(j, { ticked: false }), "Your plan at work is added with $0. Money in it already? Tap Retirement.");
  const k = jordan(); said(k, "yes");
  assert.match(S.workPlanLine(k), /Tap Retirement\.$/);
});

test("V5: Contributions' 'will the money last' line waits while the retirement figures are our guesses (spec 8.1)", () => {
  const st = { retirementKnown: true, retire: { verdict: "short", shortAge: 81 }, retireGuessed: true, retireGuessedWhat: "spending" };
  const w = verdictWords(st);
  assert.doesNotMatch(w, /surest fix/, "before: 'At this rate the money runs out at about 81: saving more is the surest fix.'");
  assert.match(w, /^By our guesses, the money would run out at about 81\. /);
  assert.match(w, /type what you really spend/);
  assert.match(verdictWords({ ...st, retireGuessedWhat: "balance" }), /type what is in your retirement accounts/);
  assert.equal(verdictWords({ ...st, retireGuessed: false }), "At this rate the money runs out at about 81: saving more is the surest fix.");
  assert.equal(verdictWords({ retirementKnown: true, retire: { verdict: "on track" } }), "At this rate the money lasts to the end of the plan: you are on track.");
});

test("V6: a removed person's account kept as the household's keeps its guess (it does not jump to everyone's median)", () => {
  const pl = patLee(); q4b(pl, {});
  const was = acct(pl, `setup-have-retire-${PARTNER}`).balance;
  assert.equal(was, 29000);
  removePerson(pl, PARTNER, { keep: true }); settle(pl, OPTS);
  assert.equal(acct(pl, `setup-have-retire-${PARTNER}`).balance, was, "before: $44,000, everyone's median, once the person was gone");
});
