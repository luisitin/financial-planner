// tests/followups-saving.test.mjs -- follow-ups F1 to F10 to the retirement-saving guesses (smart guesses step 4). Each test says what it was before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimators, TABLES, compute as guessList } from "../modules/overview/guesses/compute.js";
import { payOf } from "../modules/overview/guesses/estimators/saving.js";
import * as S from "../modules/overview/setup/compute.js";
import { compute as nextBest } from "../modules/overview/next-best-action/compute.js";
import { applyContributionEdit, contributionFormStart, fillBlankFromGuess } from "../modules/retirement/contributions/view.js";
import { removePerson } from "../modules/household/people/compute.js";
import { estimate, mergeEstimators, settle, isGuess } from "../core/estimate/index.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { jordan, patLee } from "../qa/fixtures/setup-personas.mjs";

const REG = mergeEstimators([{ from: "overview/guesses", estimators, tables: TABLES }, { from: "overview/setup", estimators: S.estimators }]);
const T0 = "2026-11-02", T6 = "2026-11-06";
const OPTS = { estimators: REG.estimators, tables: REG.tables, today: T0 };
const ME = "setup-self", PARTNER = "setup-partner";
const PUT = (pid) => `retirement.contributions[setup-contrib-${pid}].amount`, MATCH = (pid) => `retirement.contributions[setup-contrib-${pid}].employerMatch`;
const gx = (plan) => { const before = structuredClone(plan); return (key, opts = {}) => estimate(before, key, { ...OPTS, ...opts }); };
function q4b(plan, v, picks) { if (picks) S.applyHavePicks(plan, picks); S.applyHaveAmounts(plan, v, T0, { guess: gx(plan) }); return plan; }
const worker = (plan) => { plan.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 1400, period: "monthly", essential: true }, { id: "e-food", name: "Food", category: "food", amount: 500, period: "monthly", essential: true }]; return plan; };
const row = (plan, pid) => plan.retirement.contributions.find((c) => c.id === `setup-contrib-${pid}`);
const matchStep = (plan) => nextBest(plan, { today: T6 }).steps.find((s) => s.id === "match");
const est = (plan, key, path) => estimate(plan, key, { ...OPTS, path });
const kit = (pay = 50000, year = 1995) => {
  const c = migrate(emptyPlan()); S.applyYou(c, { name: "Kit", who: "spouse", partnerName: "Lee", kids: 0, state: "OH" });
  S.applyMoney(c, { people: { [ME]: { status: "work", amount: String(pay), period: "annual" }, [PARTNER]: { status: "work", amount: "52000", period: "annual" } } });
  S.applyAges(c, { people: { [ME]: { month: 3, year, stopAge: 65, ss: { mode: "estimate" } }, [PARTNER]: { month: 8, year: 1990, stopAge: 65, ss: { mode: "estimate" } } } }, T0);
  return worker(c);
};

test("F1: the done tile and the Dashboard ask for the 401(k) when only the balances are guessed", () => {
  const bal = S.retireGuessAsk({ retireGuessed: true, retireGuessedWhat: "balance" });
  assert.equal(bal.words, "Partly our guesses. Type your 401(k) ›");
  assert.equal(bal.id, "have-amounts");
  assert.equal(bal.dash, "Partly our guesses of your savings");
  const sp = S.retireGuessAsk({ retireGuessed: true, retireGuessedWhat: "spending" });
  assert.equal(sp.words, "Partly our guesses. Type what you spend ›");
  assert.equal(sp.id, "spend");
  assert.equal(sp.dash, "Partly our guesses of your spending");
});

test("F2: one usual match in a step: no 'about 4% of pay' beside the common 50% up to 6%", () => {
  const c = kit(); q4b(c, { "kind-setup-partner": "own" }, ["retire"]);
  const d = matchStep(c).detail;
  assert.match(d, /A common match, 50% of what you put in up to 6% of pay/);
  assert.doesNotMatch(d, /usually add about 4%/, "it said 4% in one sentence and 3% (50% of 6%) in the next");
  // alone (no one else asked), the raise keeps its words
  const j = worker(jordan()); q4b(j, {}, ["retire"]);
  assert.match(matchStep(j).detail, /plans usually add about 4% of pay/);
});

test("F3: 'By our guess' when what goes in and the match are both guesses", () => {
  const j = worker(jordan()); q4b(j, {}, ["retire"]);
  const d = matchStep(j).detail;
  assert.match(d, /^By our guess, Jordan puts money in and gets a match\./, "it said Jordan puts money in with a match, as a fact");
  // typed: the fact stands
  const t = worker(jordan()); q4b(t, { [`pct-${ME}`]: 0.08, [`contrib-${ME}`]: "387", [`match-${ME}`]: "150", [`matchMode-${ME}`]: "know" }, ["retire"]);
  assert.match(matchStep(t).detail ?? "", /^Jordan puts money in with a match\./);
});

test("F4: 'Type my own amount' opens with the guess gray; any save ends both guesses", () => {
  const j = worker(jordan()); q4b(j, {}, ["retire"]);
  const r = row(j, ME);
  const start = contributionFormStart(j, r);
  assert.equal(start.values.amount, "", "the box is empty, the guess is gray");
  assert.equal(start.amountHint, String(r.amount));
  assert.equal(start.matchHint, String(r.employerMatch));
  assert.equal(start.values.employerMatch, "");
  // a blank box saved: the grey figure is theirs now
  const filled = fillBlankFromGuess({ amount: "", employerMatch: null, period: "monthly" }, start);
  assert.equal(filled.amount, String(r.amount));
  assert.equal(filled.employerMatch, r.employerMatch);
  // saving with nothing changed still ends both
  applyContributionEdit(j, r.id, { accountId: r.accountId, personId: ME, amount: r.amount, period: "monthly", employerMatch: r.employerMatch });
  assert.equal(isGuess(j, PUT(ME)), false); assert.equal(isGuess(j, MATCH(ME)), false);
  // a typed row has nothing grey
  assert.equal(contributionFormStart(j, row(j, ME)).values.amount, row(j, ME).amount);
});

test("F5: a share chosen in Get started is kept on the row, so Contributions says '(5% of pay)'", () => {
  const j = jordan(); q4b(j, { [`pct-${ME}`]: 0.05, [`contrib-${ME}`]: String(S.pctToMonthly(0.05, 58000)) }, ["retire"]);
  assert.equal(row(j, ME).pctOfPay, 0.05, "it was not written");
  // dollars typed: no share
  const d = jordan(); q4b(d, { [`contrib-${ME}`]: "300" }, ["retire"]);
  assert.equal(row(d, ME).pctOfPay, undefined);
});

test("F7: two guesses read as a person's savings, not '<name>'s plan at work: retirement savings at work'", () => {
  const pl = patLee(); const before = structuredClone(pl);
  S.applyHavePicks(pl, ["retire"]);
  S.applyHaveAmounts(pl, { "retire-setup-self": "500000", joint: "both" }, T0, { guess: gx(before) });
  const labels = Object.fromEntries(guessList(pl, { today: T0 }).rows.map((r) => [r.path, r.label]));
  assert.equal(labels["accounts[setup-have-retire-setup-partner].balance"], "Lee's share of your $500,000 retirement savings");
  assert.equal(labels["accounts[setup-have-retire-setup-self].balance"], "Pat's share of your $500,000 retirement savings");
  const s = jordan(); q4b(s, {}, ["retire"]);
  const l2 = guessList(s, { today: T0 }).rows.find((r) => /retire.*balance/.test(r.path))?.label;
  assert.equal(l2, "Jordan's retirement savings at work");
});

test("F8: the contribution is guessed from the pay line the 401(k) belongs to, not combined pay", () => {
  const one = jordan(); q4b(one, {}, ["retire"]);
  const two = jordan(); two.income.push({ id: "second-job", name: "Second job", type: "salary", personId: ME, amount: 40000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true });
  q4b(two, {}, ["retire"]);
  assert.equal(row(two, ME).amount, row(one, ME).amount, "combined pay of 98,000 made it $490 instead of $270");
  assert.equal(row(two, ME).employerMatch, row(one, ME).employerMatch);
  // no Get started pay line (pay typed on Income): all the pay, as before
  const inc = jordan(); inc.income = inc.income.map((x) => ({ ...x, id: `inc-${x.id}` }));
  assert.ok(estimate(inc, "contrib.amount", { ...OPTS, path: PUT(ME) }).value > 0);
});

test("F9: pay kept as the household's after a partner goes does not move the remaining adult's guesses", () => {
  const pl = patLee(); q4b(pl, {}, ["retire"]);
  const own = payOf(pl, ME, T0);
  assert.equal(own, 85000);
  removePerson(pl, PARTNER, { keep: true });
  assert.equal(payOf(pl, ME, T0), 85000, "it became 125,000: the kept line counted as Pat's");
  // a lone adult whose pay lines were never assigned: theirs, as before
  const old = jordan(); for (const x of old.income) delete x.personId;
  assert.ok(payOf(old, ME, T0) > 0);
});

test("F10: after 'No' to the plan at work, a guessed balance is not left in '<name>'s plan at work'", () => {
  const mk = () => { const p = migrate(emptyPlan()); S.applyYou(p, { name: "Kit", who: "me", kids: 0, state: "OH" });
    S.applyMoney(p, { people: { [ME]: { status: "work", amount: "58000", period: "annual", plan: "yes" } } }, T0);
    S.applyAges(p, { people: { [ME]: { month: 6, year: 1985, stopAge: 65, ss: { mode: "estimate" } } } }, T0); return p; };
  const g = mk(); assert.ok(S.workPlanAcct(g, ME)); q4b(g, {});
  const acc = S.workPlanAcct(g, ME);
  assert.ok(acc && isGuess(g, `accounts[${acc.id}].balance`) && acc.balance > 0, "setup: a guessed balance sits in the plan at work");
  S.applyMoney(g, { people: { [ME]: { status: "work", amount: "58000", period: "annual", plan: "no" } } }, T0);
  assert.equal(g.accounts.some((a) => /plan at work/i.test(a.name) && a.balance > 0), false, "the guess stayed in the plan at work");
  assert.equal(g.accounts.some((a) => a.id === `setup-workplan-${ME}` && isGuess(g, `accounts[${a.id}].balance`)), false);
  // a typed balance moves to a plainly named account
  const t = mk(); q4b(t, { [`retire-${ME}`]: "26000" });
  S.applyMoney(t, { people: { [ME]: { status: "work", amount: "58000", period: "annual", plan: "no" } } }, T0);
  const kept = t.accounts.find((a) => a.balance === 26000);
  assert.ok(kept, "the typed 26,000 is kept");
  assert.doesNotMatch(kept.name, /plan at work/i);
});
