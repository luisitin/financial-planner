// modules/overview/setup/module.test.mjs -- Set up my plan: every writer, the safety rules (no duplicates, nothing
// pointed at is removed, a Continue that changes nothing saves nothing), the Social Security estimate, the typical
// rates and where you stand. C2 (smart guesses, spec 14.4): Q5b with `guess` injected keeps every picked debt, writes
// our guesses as guesses (the ledger), and what the screen shows grey is what is saved.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as S from "./compute.js";
import { estimateBenefit, claimFactor, fullRetirementAge, LAST_AWI_YEAR } from "../../retirement/social-security/compute.js";
import { WAGE_INDICES } from "../../retirement/social-security/data/ssa.js";
import { compute as expenses } from "../../cashflow/expenses/compute.js";
import { compute as goals } from "../../goals/goals/compute.js";
import { compute as dashboard } from "../dashboard/compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { detailed } from "../guide/journeys.js";
import { estimate, mergeEstimators, settle, isGuess, getAt } from "../../../core/estimate/index.js";
import { estimators as guessEstimators, TABLES as GUESS_TABLES } from "../guesses/compute.js";
import { jordan, patLee, sam, PERSONA_TODAY } from "../../../qa/fixtures/setup-personas.mjs";
import { compute as netWorth } from "../../balance/net-worth/compute.js";
import { compute as timeline } from "../timeline/compute.js";
import { compute as payoff } from "../../debt/payoff/compute.js";
import { compute as nextBest } from "../next-best-action/compute.js";

const T = "2026-11-01";
const empty = () => migrate(emptyPlan());
const HERE = fileURLToPath(new URL("./", import.meta.url));
/** A household made through the whole conversation: two working adults, two children, a card, a car loan, a mortgage. */
function family() {
  const p = empty();
  S.applyYou(p, { name: "Ana", who: "spouse", partnerName: "Bo", kids: 2, state: "OH" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: "72k", period: "annual" }, "setup-partner": { status: "work", amount: "2,100", period: "biweekly" } }, other: { kind: "support", amount: 300 } });
  S.applyAges(p, { people: { "setup-self": { month: 4, year: 1988, stopAge: 62, ss: { mode: "estimate" } }, "setup-partner": { month: 9, year: 1986, stopAge: 65, ss: { mode: "statement", amount: "1,850" } } }, kids: { "setup-kid-1": 2017, "setup-kid-2": "" } }, T);
  S.applyHavePicks(p, ["checking", "savings", "retire", "car"]);
  S.applyHaveAmounts(p, { checking: 3200, savings: 8500, "retire-setup-self": 41000, "kind-setup-partner": "own", "retire-setup-partner": "12000", "contrib-setup-self": 500, "match-setup-self": 250, car: 14000 }, T);
  S.applyOwePicks(p, ["credit", "car-loan", "mortgage"]);
  S.applyOweAmounts(p, { credit: { owed: 4200, payment: 150 }, "car-loan": { owed: 9000, payment: 320 }, mortgage: { owed: 210000, payment: 1650, rate: 6.25 } }, T);
  S.applySpend(p, { mode: "rows", rows: { housing: 450, utilities: 380, groceries: 900, transport: 300, insurance: 250, childcare: 600, dining: 400, shopping: 500 }, retireMonthly: 2800 });
  S.applyGoalPicks(p, ["cushion", "debt", "home", "trip"]);
  S.applyGoalDetails(p, { cushion: { months: 4 }, home: { target: 60000, years: 3 }, trip: { target: 4000, date: "2027-08-01" } }, T);
  S.applyGuesses(p, T);
  S.markAt(p, "done", T);
  return p;
}
// life cover on both adults, more than any need, so the protection step is done
const covered = (p) => { p.insurance = { ...(p.insurance ?? {}), policies: p.household.people.filter((x) => x.role !== "dependent").map((x, i) => ({ id: `pol-${i}`, kind: "term", personId: x.id, benefit: 3000000, premium: 30, period: "monthly" })) }; return p; };
const acct = (p, id) => p.accounts.find((a) => a.id === id);
const inc = (p, id) => p.income.find((a) => a.id === id);

test("money boxes: $, commas, k and m work; blank and nonsense save nothing", () => {
  assert.deepEqual(["$4,000", "4000.50", "4k", "1.2m", " 950 ", "6.5%", "", "abc", null].map(S.parseMoney), [4000, 4000.5, 4000, 1200000, 950, 6.5, null, null, null]);
});

test("Social Security estimate: past pay follows the national average wage from 22, then the app's own benefit formula", () => {
  // by hand: the same record the Quick Calculator method builds, through estimateBenefit
  const birthYear = 1988, pay = 72000, last = LAST_AWI_YEAR;
  const record = [];
  for (let y = birthYear + 22; y <= Math.min(2025, last); y++) record.push({ year: y, earnings: Math.round(pay * WAGE_INDICES[y] / WAGE_INDICES[last]) });
  const fra = fullRetirementAge(birthYear);
  const want = Math.round(estimateBenefit(record, { birthYear, claimAge: fra.asYears, futureEarnings: "same", stopYear: birthYear + 62 - 1, today: T }).pia);
  assert.equal(S.estimateSocialSecurity({ birthYear, yearlyPay: pay, stopAge: 62, today: T }), want);
  assert.ok(want > 1500 && want < 4000, `a plausible benefit (${want})`);
  assert.ok(S.estimateSocialSecurity({ birthYear, yearlyPay: 120000, stopAge: 62, today: T }) > want, "more pay, more benefit");
  assert.equal(S.estimateSocialSecurity({ birthYear: null, yearlyPay: pay, today: T }), null);
  assert.equal(S.estimateSocialSecurity({ birthYear, yearlyPay: 0, today: T }), null);
});

test("who the plan is for: a spouse files jointly, one adult with children is head of household, a partner files single", () => {
  const p = empty();
  S.applyYou(p, { name: "Ana", who: "spouse", partnerName: "Bo", kids: 1, state: "OH" });
  assert.equal(p.household.filingStatus, "married_joint");
  assert.deepEqual(p.household.people.map((x) => [x.id, x.role, x.relation]), [["setup-self", "self", undefined], ["setup-partner", "partner", "spouse"], ["setup-kid-1", "dependent", undefined]]);
  assert.equal(p.household.state, "OH");
  const q = empty(); S.applyYou(q, { who: "me", kids: 2 });
  assert.equal(q.household.filingStatus, "head_of_household");
  assert.equal(q.household.people[0].name, "Me", "a blank name is Me");
  const r = empty(); S.applyYou(r, { name: "Cy", who: "partner", partnerName: "Di", kids: 0 });
  assert.equal(r.household.filingStatus, "single");
  assert.equal(r.household.people[1].relation, "partner");
});

test("a filing status chosen on its own page stays when the answer that decides it did not change", () => {
  const p = empty();
  S.applyYou(p, { name: "Ana", who: "spouse", partnerName: "Bo", kids: 0 });
  p.household.filingStatus = "married_separate";
  S.applyYou(p, { name: "Ana", who: "spouse", partnerName: "Bo", kids: 1 });
  assert.equal(p.household.filingStatus, "married_separate");
  S.applyYou(p, { name: "Ana", who: "me", kids: 1 });
  assert.equal(p.household.filingStatus, "head_of_household", "a changed answer sets it again");
});

test("removing the partner removes everything the setup made for them, in the same change", () => {
  const p = family();
  assert.ok(inc(p, "setup-pay-setup-partner") && acct(p, "setup-have-retire-setup-partner") && p.retirement.socialSecurity["setup-partner"]);
  const kept = S.applyYou(p, { name: "Ana", who: "me", kids: 2 });
  assert.deepEqual(kept, []);
  assert.equal(p.household.people.some((x) => x.id === "setup-partner"), false);
  assert.equal(inc(p, "setup-pay-setup-partner"), undefined);
  assert.equal(acct(p, "setup-have-retire-setup-partner"), undefined);
  assert.equal(p.retirement.socialSecurity["setup-partner"], undefined);
  assert.equal(p.guide.setup.status["setup-partner"], undefined);
});

test("a partner other pages use is kept, and the screen is told why", () => {
  const p = family();
  p.income.push({ id: "bonus", name: "Bo's bonus", type: "bonus", personId: "setup-partner", amount: 2000, period: "annual" });
  const kept = S.applyYou(p, { name: "Ana", who: "me", kids: 2 });
  assert.equal(kept.length, 1);
  assert.match(kept[0].reason, /Income/);
  assert.ok(p.household.people.some((x) => x.id === "setup-partner"));
  assert.equal(p.household.filingStatus, "married_joint");
});

test("a household typed on People is left alone (only the state is saved)", () => {
  const p = migrate(familyPlan(T));
  const before = JSON.stringify(p.household.people);
  S.applyYou(p, { name: "X", who: "me", kids: 0, state: "TX" });
  assert.equal(JSON.stringify(p.household.people), before);
  assert.equal(p.household.state, "TX");
});

test("what comes in: pay before tax, a pension, other money as its Income type; child support is not taxed", () => {
  const p = family();
  assert.deepEqual([inc(p, "setup-pay-setup-self").name, inc(p, "setup-pay-setup-self").amount, inc(p, "setup-pay-setup-self").period], ["Ana's pay", 72000, "annual"]);
  assert.equal(inc(p, "setup-pay-setup-partner").period, "biweekly");
  assert.deepEqual([inc(p, "setup-other").type, inc(p, "setup-other").taxable, inc(p, "setup-other").name], ["support", false, "Child support"]);
  const q = empty(); S.applyYou(q, { who: "me" });
  S.applyMoney(q, { people: { "setup-self": { status: "work", amount: 5000, period: "monthly" } }, other: { kind: "business", amount: 800 } });
  assert.equal(inc(q, "setup-pay-setup-self").name, "My pay", "the person named Me");
  assert.deepEqual([inc(q, "setup-other").type, inc(q, "setup-other").personId, inc(q, "setup-other").taxable], ["business", "setup-self", true]);
  S.applyMoney(q, { people: { "setup-self": { status: "retired", pension: 1200 } }, other: {} });
  assert.equal(inc(q, "setup-pay-setup-self"), undefined, "retired: no pay");
  assert.equal(inc(q, "setup-pension-setup-self").amount, 1200);
  assert.equal(inc(q, "setup-other"), undefined, "a cleared box removes the setup's own line");
});

test("pay already on Income is not asked again or doubled", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  p.income.push({ id: "job", name: "Job", type: "salary", personId: "setup-self", amount: 90000, period: "annual" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: 50000 } } });
  assert.equal(p.income.length, 1);
});

test("ages: birth dates on the 15th; the age to stop saved only when it differs from the plan's; already retired = today's age", () => {
  const p = family();
  assert.equal(p.household.people[0].birthDate, "1988-04-15");
  assert.equal(p.household.people[0].retirementAge, 62);
  assert.equal(p.household.people[1].retirementAge, null, "65 is the plan's own age");
  assert.equal(p.household.people[2].birthDate, "2017-07-15", "a child's year alone");
  const r = empty(); S.applyYou(r, { who: "me" });
  S.applyAges(r, { people: { "setup-self": { month: 3, year: 1958, retired: true, ss: { mode: "none" } } } }, T);
  assert.equal(r.household.people[0].retirementAge, 68);
  const n = empty(); S.applyYou(n, { who: "me" });
  S.applyAges(n, { people: { "setup-self": { retired: true } } }, T);
  assert.equal(n.household.people[0].retirementAge, null, "no birth date, no age written");
});

test("already getting Social Security: the full-retirement amount is today's payment over the claim factor, and this month counts it", () => {
  const r = empty(); S.applyYou(r, { who: "me" });
  S.applyAges(r, { people: { "setup-self": { month: 3, year: 1958, retired: true, ss: { mode: "getting", amount: 2300, started: 64 } } } }, T);
  const ss = r.retirement.socialSecurity["setup-self"];
  assert.equal(ss.claimAge, 64);
  assert.ok(Math.abs(ss.monthlyAtFRA * claimFactor(1958, 64) - 2300) < 1, "round trip");
  assert.deepEqual([inc(r, "setup-ss-setup-self").type, inc(r, "setup-ss-setup-self").amount], ["social", 2300]);
  assert.equal(S.retirementKnown(r), true);
  S.applyAges(r, { people: { "setup-self": { month: 3, year: 1958, retired: true, ss: { mode: "none" } } } }, T);
  assert.equal(inc(r, "setup-ss-setup-self"), undefined);
});

test("a pasted ssa.gov record is never overwritten", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  p.retirement.socialSecurity["setup-self"] = { record: [{ year: 2020, earnings: 50000 }], claimAge: 67 };
  S.applyAges(p, { people: { "setup-self": { month: 1, year: 1980, ss: { mode: "statement", amount: 3000 } } } }, T);
  assert.deepEqual(p.retirement.socialSecurity["setup-self"], { record: [{ year: 2020, earnings: 50000 }], claimAge: 67 });
});

test("what you have: one account each, retirement per adult, through work (401(k), match) or on your own (IRA)", () => {
  const p = family();
  assert.deepEqual(["setup-have-checking", "setup-have-savings", "setup-have-car"].map((id) => acct(p, id).balance), [3200, 8500, 14000]);
  assert.deepEqual([acct(p, "setup-have-retire-setup-self").type, acct(p, "setup-have-retire-setup-partner").type], ["401k", "ira"]);
  assert.equal(acct(p, "setup-have-retire-setup-self").ownerId, "setup-self");
  const c = p.retirement.contributions.find((x) => x.id === "setup-contrib-setup-self");
  assert.deepEqual([c.amount, c.period, c.employerMatch, c.accountId], [500, "monthly", 3000, "setup-have-retire-setup-self"]);
});

test("a kind of account the plan already has is not asked again", () => {
  const p = empty(); S.applyYou(p, { who: "spouse", name: "Ana", partnerName: "Bo" });
  p.accounts.push({ id: "chk", name: "Joint checking", type: "checking", balance: 900 }, { id: "k", name: "Ana's 401(k)", type: "401k", balance: 5, ownerId: "setup-self" });
  assert.deepEqual(S.askOwners(p, "checking"), []);
  assert.deepEqual(S.askOwners(p, "retire"), ["setup-partner"]);
  S.applyHavePicks(p, ["checking", "retire"]);
  assert.deepEqual(p.guide.setup.picks.have, ["retire"]);
  S.applyHaveAmounts(p, { checking: 100, "retire-setup-self": 7, "retire-setup-partner": 3000 }, T);
  assert.equal(acct(p, "setup-have-checking"), undefined);
  assert.equal(acct(p, "setup-have-retire-setup-self"), undefined);
  assert.equal(acct(p, "setup-have-retire-setup-partner").balance, 3000);
});

test("an account something points at is never removed: kept, with the reason", () => {
  const p = family();
  p.transactions = [{ id: "t1", accountId: "setup-have-checking", amount: -5, date: T }];
  const kept = S.applyHavePicks(p, ["savings", "retire", "car"]);
  assert.equal(kept.length, 1);
  assert.deepEqual([kept[0].name, kept[0].reason], ["Checking", "it has transactions"]);
  assert.ok(acct(p, "setup-have-checking"));
  S.applyHavePicks(p, ["checking", "savings", "retire"]);
  assert.equal(acct(p, "setup-have-car"), undefined, "the car had nothing pointing at it");
  for (const [k, v] of [["holdings", [{ id: "h", accountId: "setup-have-savings" }]], ["goals", [{ id: "g", fundedBy: ["setup-have-savings"] }]], ["contacts", [{ id: "c", accountIds: ["setup-have-savings"] }]]]) {
    const q = family(); q[k] = [...(q[k] ?? []), ...v];
    assert.ok(S.referenced(q, "setup-have-savings"), k);
  }
});

test("what you owe: an account and a Liabilities row each; a blank rate gets the typical one, kept as a guess", () => {
  const p = family();
  const d = (k) => p.debts.find((x) => x.id === `setup-debt-${k}`);
  assert.deepEqual([acct(p, "setup-owe-credit").balance, d("credit").minPayment, d("credit").rate, d("credit").rateGuessed], [4200, 150, 0.2236, 0.2236]);
  assert.equal(d("car-loan").rate, S.TYPICAL_RATES["car-loan"]);
  assert.equal(d("mortgage").rate, 0.0625);
  assert.equal("rateGuessed" in d("mortgage"), false);
  assert.equal(S.rateIsGuess(d("credit")), true);
  assert.equal(S.rateIsGuess(d("mortgage")), false);
});

test("loan payments are counted once, by Expenses from the Liabilities rows (no spending line is made for them)", () => {
  const p = family();
  assert.equal(p.expenses.some((x) => x.category === "debt"), false);
  const e = expenses(p, {});
  assert.equal(e.debtFromDebts, 150 + 320 + 1650);
  assert.equal(S.spendBase(p).loanPayments, 2120);
});

test("a rate typed later on What you owe survives going back through the setup with the box blank", () => {
  const p = family();
  const row = p.debts.find((x) => x.id === "setup-debt-credit");
  row.rate = 0.189; row.extra = 100;   // typed on Liabilities (its form keeps unknown fields)
  const v = S.valuesFor(p, "owe-amounts");
  assert.equal(v.credit.rate, 18.9, "shown as typed");
  S.applyOweAmounts(p, { ...v, credit: { ...v.credit, rate: "" } }, T);
  assert.deepEqual([row.rate, row.extra, "rateGuessed" in row], [0.189, 100, false]);
});

test("a card paid in full every month is not a debt", () => {
  const c = empty(); S.applyOwePicks(c, ["credit"]); S.applyOweAmounts(c, { credit: { paidInFull: true, owed: 900, payment: 900 } }, T);
  assert.deepEqual([c.accounts.length, c.debts.length, c.expenses.length], [0, 0, 0]);
  assert.deepEqual(S.reflect(c, "owe-amounts"), { kind: "paid-in-full" });
});

test("spending: must-pay from the group; rows the plan already has are not asked; one rough total replaces the rows", () => {
  const p = family();
  const x = (k) => p.expenses.find((e) => e.id === `setup-x-${k}`);
  assert.deepEqual([x("groceries").essential, x("dining").essential, x("housing").name], [true, false, "Home costs"]);
  const q = empty(); q.expenses.push({ id: "e1", name: "Rent", category: "housing", amount: 1500, period: "monthly", essential: true });
  assert.equal(S.spendRows(q).some((s) => s.key === "housing"), false);
  assert.equal(S.spendRows(q).some((s) => s.key === "childcare"), false, "no children");
  S.applySpend(p, { mode: "total", total: 4000 });
  assert.deepEqual(p.expenses.map((e) => [e.id, e.amount, e.essential]), [["setup-x-total", 4000, true]]);
});

test("spending once work stops: starts from today's bills without loans and childcare; saved as Retirement's figure", () => {
  const p = family();
  assert.equal(p.retirement.spendingMonthly, 2800);
  assert.equal(S.retireDefault(p), 450 + 380 + 900 + 300 + 250 + 400 + 500);
  const r = empty(); S.applyYou(r, { who: "me" }); S.applyMoney(r, { people: { "setup-self": { status: "retired" } } });
  S.applySpend(r, { mode: "rows", rows: { groceries: 500 }, retireMonthly: 3000 });
  assert.ok(!(Number(r.retirement.spendingMonthly) > 0), "everyone retired: not asked");
});

test("the safety cushion: months x must-pay bills, no date, drawn from savings, and the plan's emergency months agree", () => {
  const p = family();
  const g = p.goals.find((x) => x.id === "setup-goal-cushion");
  const essential = expenses(p, {}).essentialMonthly;
  assert.equal(g.target, Math.round((4 * essential) / 100) * 100);
  assert.deepEqual([g.targetDate, g.isEmergencyFund, g.fundedBy, p.assumptions.emergencyMonths], ["", true, ["setup-have-checking", "setup-have-savings"], 4], "the money Emergency fund counts as usable today");
  assert.equal("saved" in g && g.saved, 0);
  const st = goals(p, { today: T }).goals.find((x) => x.id === "setup-goal-cushion").status;
  assert.notEqual(st, "behind", "no date: it never asks for money a month");
});

test("goals: dates from the chips or a picked date; an emergency fund already on Goals adds nothing", () => {
  const p = family();
  assert.deepEqual(p.goals.filter((g) => g.id !== "setup-goal-cushion").map((g) => [g.name, g.target, g.targetDate]), [["House down payment", 60000, "2029-11-01"], ["Big trip", 4000, "2027-08-01"]]);
  const q = empty(); q.goals.push({ id: "ef", name: "Rainy day fund", target: 9000 });
  S.applyGoalPicks(q, ["cushion", "trip"]);
  assert.deepEqual(q.guide.setup.picks.goals, ["trip"]);
  S.applyGoalDetails(q, { cushion: { months: 3 }, trip: {} }, T);
  assert.deepEqual(q.goals.map((g) => [g.id, g.target]), [["ef", 9000], ["setup-goal-trip", 0]]);
});

test("going back and changing an answer updates the same records and only the fields that screen asks for", () => {
  const p = family();
  acct(p, "setup-have-checking").name = "Credit union checking";   // renamed on Net worth
  inc(p, "setup-pay-setup-self").growth = 0.04;                    // a raise set on Income
  p.goals.find((g) => g.id === "setup-goal-home").monthly = 500;    // money a month set on Goals
  const counts = () => [p.accounts.length, p.debts.length, p.income.length, p.expenses.length, p.goals.length];
  const before = counts();
  S.applyHaveAmounts(p, { ...S.valuesFor(p, "have-amounts"), checking: 3500 }, T);
  S.applyMoney(p, { ...S.valuesFor(p, "money"), people: { ...S.valuesFor(p, "money").people, "setup-self": { status: "work", amount: 75000, period: "annual" } } });
  S.applyGoalDetails(p, { ...S.valuesFor(p, "goal-details", { today: T }), home: { target: 65000, date: "2029-11-01" } }, T);
  assert.deepEqual(counts(), before, "no duplicates");
  assert.deepEqual([acct(p, "setup-have-checking").name, acct(p, "setup-have-checking").balance], ["Credit union checking", 3500]);
  assert.deepEqual([inc(p, "setup-pay-setup-self").growth, inc(p, "setup-pay-setup-self").amount], [0.04, 75000]);
  const home = p.goals.find((g) => g.id === "setup-goal-home");
  assert.deepEqual([home.monthly, home.target], [500, 65000]);
});

test("a Continue that changes nothing saves nothing", () => {
  const p = family();
  const same = [
    (d) => S.applyYou(d, S.valuesFor(p, "you")),
    (d) => S.applyMoney(d, S.valuesFor(p, "money")),
    (d) => S.applyAges(d, S.valuesFor(p, "ages", { today: T }), T),
    (d) => S.applyHavePicks(d, S.valuesFor(p, "have")),
    (d) => S.applyHaveAmounts(d, S.valuesFor(p, "have-amounts"), T),
    (d) => S.applyOwePicks(d, S.valuesFor(p, "owe")),
    (d) => S.applyOweAmounts(d, S.valuesFor(p, "owe-amounts"), T),
    (d) => S.applySpend(d, S.valuesFor(p, "spend")),
    (d) => S.applyGoalPicks(d, S.valuesFor(p, "goals")),
    (d) => S.applyGoalDetails(d, S.valuesFor(p, "goal-details", { today: T }), T),
    (d) => S.markAt(d, "have", T),
  ];
  same.forEach((fn, i) => assert.equal(S.wouldChange(p, fn), false, `writer ${i}`));
  assert.equal(S.wouldChange(p, (d) => S.applyHaveAmounts(d, { ...S.valuesFor(p, "have-amounts"), savings: 9000 }, T)), true);
});

test("screens: follow-ups only when they apply; an address whose screen no longer applies moves to the next that does", () => {
  const p = empty();
  assert.deepEqual(S.visibleScreens(p).map((s) => s.id), ["welcome", "you", "money", "ages", "have", "owe", "spend", "goals", "done"]);
  S.applyOwePicks(p, ["none"]);
  assert.equal(S.resolveScreen(p, "owe-amounts"), "spend");
  assert.equal(S.nextScreen(p, "owe"), "spend");
  S.applyOwePicks(p, ["credit"]);
  assert.equal(S.nextScreen(p, "owe"), "owe-amounts");
  assert.equal(S.resolveScreen(p, "nonsense"), "welcome");
  assert.equal(S.barShare("owe-amounts"), 4.5 / 7);
});

test("where you are: the furthest screen reached, so going back never moves 'pick up where you left off'", () => {
  const p = empty();
  S.markAt(p, "spend", T); S.markAt(p, "money", T);
  assert.deepEqual([p.guide.setup.at, p.guide.setup.startedAt, p.guide.setup.finishedAt], ["spend", T, undefined]);
  S.markAt(p, "done", T);
  assert.equal(p.guide.setup.finishedAt, T);
  assert.equal(S.progress(p).finished, true);
});

test("where you stand: read from the pages' own computes; the first move is Next best action's; no 'your choice' step", () => {
  const p = family();
  // two earners and two children with no life cover on file: protecting them comes right after the starter cushion
  const st0 = S.standing(p, { today: T });
  assert.equal(st0.moves[0].id, "protect");
  assert.match(st0.moves[0].title, /^Get life insurance on /);
  covered(p);
  const st = S.standing(p, { today: T });
  assert.equal(st.netWorth, 3200 + 8500 + 41000 + 12000 + 14000 - 4200 - 9000 - 210000);
  assert.equal(st.moves[0].id, "high-debt", "the 22% card, once both are covered");
  assert.ok(st.moves.length === 3 && st.moves.every((m) => m.id !== "rest"));
  assert.ok(st.moves.some((m) => m.id === "guide-home"), "the home goal brings its guide");
  assert.deepEqual(st.guessed.map((g) => g.name), ["Credit cards", "Car loan"]);
  // Ohio's flat rate is known, so its income tax comes off the left-over figure and nothing is said to be missing
  // (2026-11-02); a state whose rate must be typed is still asked for
  assert.ok(!st.later.some((l) => l.key === "state"), "Ohio's tax is counted"); assert.equal(st.stateTaxCounted, true);
  const ca = family(); covered(ca); ca.household.state = "CA";
  const sc = S.standing(ca, { today: T });
  assert.ok(sc.later.some((l) => l.key === "state" && /^California's income tax: type its rate on the State page/.test(l.label)), "California's graduated rate is typed there");
  assert.equal(sc.stateTaxCounted, false);
  assert.equal(dashboard(p).doneCount, dashboard(p).total, "the dashboard's setup steps are all done");
});

test("retirement is never called short before Social Security is known", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: 60000 } } });
  S.applyAges(p, { people: { "setup-self": { month: 1, year: 1980, stopAge: 65, ss: { mode: "unsure" } } } }, T);
  const st = S.standing(p, { today: T });
  assert.equal(st.retirementKnown, false);
  assert.equal(st.retire, null);
  assert.ok(st.later.some((l) => /Social Security/.test(l.label)));
});

test("every typical rate is in the README with its source", () => {
  const readme = fs.readFileSync(`${HERE}README.md`, "utf8");
  for (const [k, r] of Object.entries(S.TYPICAL_RATES)) assert.ok(readme.includes(`${(r * 100).toFixed(2)}%`), `${k} ${(r * 100).toFixed(2)}%`);
  for (const src of ["G.19", "Freddie Mac", "studentaid.gov"]) assert.ok(readme.includes(src), src);
});

test("the debt guide's rates step stays open while a rate is the setup's guess", () => {
  const p = family();
  assert.equal(detailed(p), false, "the card and car loan rates are guesses");
  for (const d of p.debts) if (S.rateIsGuess(d)) d.rate = d.rate + 0.01;   // typed on What you owe
  assert.equal(detailed(p), true);
  const q = empty(); S.applyOwePicks(q, ["mortgage"]); S.applyOweAmounts(q, { mortgage: { owed: 200000, rate: 6.5 } }, T);
  assert.equal(detailed(q), false, "a guessed payment keeps it open too");
  q.debts[0].minPayment = 1400;
  assert.equal(detailed(q), true);
});

/** Every screen's Continue with nothing touched, as the view does it (values read back, then written). */
function noOpPass(p) {
  S.applyYou(p, S.valuesFor(p, "you"));
  S.applyMoney(p, S.valuesFor(p, "money"));
  S.applyAges(p, S.valuesFor(p, "ages", { today: T }), T);
  S.applyHavePicks(p, S.valuesFor(p, "have"));
  S.applyHaveAmounts(p, S.valuesFor(p, "have-amounts"), T);
  S.applyOwePicks(p, S.valuesFor(p, "owe"));
  S.applyOweAmounts(p, S.valuesFor(p, "owe-amounts"), T);
  S.applySpend(p, S.valuesFor(p, "spend"));
  S.applyGoalPicks(p, S.valuesFor(p, "goals"));
  S.applyGoalDetails(p, S.valuesFor(p, "goal-details", { today: T }), T);
}

test("a record of the same kind added later on its own page never removes the setup's own", () => {
  const p = family();
  p.accounts.push({ id: "a-joint", name: "Joint checking", type: "checking", balance: 900 }, { id: "a-store", name: "Store card", type: "credit", balance: 300 }, { id: "a-roth", name: "Ana's Roth", type: "roth", balance: 5000, ownerId: "setup-self" });
  p.income.push({ id: "i-2", name: "Ana's second job", type: "salary", personId: "setup-self", amount: 800, period: "monthly" });
  p.goals.push({ id: "g-trip", name: "Trip to Lisbon", target: 3000 });
  const ids = (q) => ["accounts", "debts", "income", "expenses", "goals"].map((k) => q[k].map((x) => x.id).join()).join("|") + q.retirement.contributions.map((c) => c.id).join();
  const before = ids(p);
  noOpPass(p);
  for (const id of ["setup-have-checking", "setup-owe-credit", "setup-have-retire-setup-self"]) assert.ok(acct(p, id), id);
  assert.ok(p.debts.find((d) => d.id === "setup-debt-credit"));
  assert.ok(p.retirement.contributions.find((c) => c.id === "setup-contrib-setup-self"), "the 401(k) saving stays");
  assert.ok(inc(p, "setup-pay-setup-self"), "the setup's pay stays beside the second job");
  assert.ok(p.goals.find((g) => g.id === "setup-goal-trip"));
  assert.equal(ids(p), before, "nothing added or removed (the estimate follows the second job's pay; the cushion counts the new checking)");
});

test("fields set on the real pages survive a Continue: a Roth, a yearly match, an Income type, a rate to the thousandth", () => {
  const p = family();
  acct(p, "setup-have-retire-setup-partner").type = "roth";                       // changed on Net worth
  p.retirement.contributions.find((c) => c.id === "setup-contrib-setup-self").employerMatch = 1000;   // typed yearly on Contributions
  Object.assign(inc(p, "setup-other"), { type: "investment", taxable: false });     // changed on Income
  p.debts.find((d) => d.id === "setup-debt-mortgage").rate = 0.06875;               // typed on Liabilities
  noOpPass(p);
  assert.equal(acct(p, "setup-have-retire-setup-partner").type, "roth");
  assert.equal(p.retirement.contributions.find((c) => c.id === "setup-contrib-setup-self").employerMatch, 1000);
  assert.deepEqual([inc(p, "setup-other").type, inc(p, "setup-other").taxable], ["investment", false]);
  assert.equal(p.debts.find((d) => d.id === "setup-debt-mortgage").rate, 0.06875);
  assert.equal(S.valuesFor(p, "owe-amounts").mortgage.rate, 6.875, "shown as typed");
  // the setup itself takes 6.125%, and a kind changed on the screen still changes the type
  S.applyOweAmounts(p, { ...S.valuesFor(p, "owe-amounts"), mortgage: { ...S.valuesFor(p, "owe-amounts").mortgage, rate: "6.125" } }, T);
  assert.equal(p.debts.find((d) => d.id === "setup-debt-mortgage").rate, 0.06125);
  S.applyHaveAmounts(p, { ...S.valuesFor(p, "have-amounts"), "kind-setup-self": "own" }, T);
  assert.equal(acct(p, "setup-have-retire-setup-self").type, "ira", "401(k) to on my own: an IRA");
});

test("a blank payment gets a typical one, so the debt's cost is counted; a real one typed later wins", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  S.applyOwePicks(p, ["mortgage", "credit"]);
  S.applyOweAmounts(p, { mortgage: { owed: 300000 }, credit: { owed: 4200 } }, T);
  const m = p.debts.find((d) => d.id === "setup-debt-mortgage"), c = p.debts.find((d) => d.id === "setup-debt-credit");
  // by hand: 300,000 at 7.24% over 360 months = 300000 x r / (1 - (1 + r)^-360), r = 0.0724 / 12
  const r = 0.0724 / 12, byHand = Math.round(300000 * r / (1 - (1 + r) ** -360));
  assert.deepEqual([m.minPayment, m.paymentGuessed, byHand], [2044, 2044, 2044]);
  assert.equal(c.minPayment, Math.round(4200 * 0.2236 / 12 + 42), "a month's interest plus 1% of the balance");
  assert.equal(expenses(p, {}).debtFromDebts, m.minPayment + c.minPayment, "counted in spending");
  assert.equal(S.valuesFor(p, "owe-amounts").mortgage.payment, "", "a guess is not shown as typed");
  assert.deepEqual(S.standing(p, { today: T }).guessed.map((g) => [g.name, g.payment]), [["Credit cards", c.minPayment], ["Mortgage", 2044]]);
  // the owed amount changes: the guess follows; a payment typed on Liabilities then stays
  S.applyOweAmounts(p, { ...S.valuesFor(p, "owe-amounts"), mortgage: { owed: 200000 } }, T);
  assert.equal(m.minPayment, S.typicalPayment("mortgage", 200000, 0.0724));
  m.minPayment = 1500;
  S.applyOweAmounts(p, S.valuesFor(p, "owe-amounts"), T);
  assert.deepEqual([m.minPayment, "paymentGuessed" in m], [1500, false]);
});

test("a mortgage with no home asks the home's value, and net worth then has both sides", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  S.applyHavePicks(p, ["checking"]); S.applyHaveAmounts(p, { checking: 2000 }, T);
  S.applyOwePicks(p, ["mortgage"]);
  assert.equal(S.askHomeWithMortgage(p), true);
  assert.equal(S.standing(p, { today: T }).homeMissing, false, "no mortgage yet");
  S.applyOweAmounts(p, { mortgage: { owed: 210000, payment: 1650, rate: 6.25 } }, T);
  assert.equal(S.standing(p, { today: T }).homeMissing, true, "the done screen says the home is not in");
  S.applyOweAmounts(p, { mortgage: { owed: 210000, payment: 1650, rate: 6.25, home: "300k" } }, T);
  assert.deepEqual([acct(p, "setup-have-home").type, acct(p, "setup-have-home").balance], ["property", 300000]);
  assert.ok(S.picks(p, "have").includes("home"), "the have screens show it too");
  assert.equal(S.standing(p, { today: T }).netWorth, 2000 + 300000 - 210000);
  assert.equal(S.askHomeWithMortgage(p), true, "still asked there, where it was typed");
  const q = family(); q.accounts.push({ id: "h", name: "House", type: "property", balance: 350000 });
  assert.equal(S.askHomeWithMortgage(q), false, "a home on Net worth: not asked");
});

test("spending once work stops follows the bills until typed, and counts a loan still paid after work stops", () => {
  const p = family();
  S.applySpend(p, { ...S.valuesFor(p, "spend"), retireMonthly: S.retireDefault(p, T), retireAuto: true });
  assert.equal(S.valuesFor(p, "spend").retireTyped, false, "the screen's own figure: it follows the rows");
  S.applySpend(p, { ...S.valuesFor(p, "spend"), retireMonthly: 2500, retireAuto: false });
  assert.equal(S.valuesFor(p, "spend").retireTyped, true, "typed: it stays");
  // a 30-year mortgage at 52: still paid at 65
  const q = empty(); S.applyYou(q, { who: "me" });
  S.applyMoney(q, { people: { "setup-self": { status: "work", amount: 80000 } } });
  S.applyAges(q, { people: { "setup-self": { month: 1, year: 1974, stopAge: 65, ss: { mode: "unsure" } } } }, T);
  S.applyOwePicks(q, ["mortgage", "car-loan"]);
  S.applyOweAmounts(q, { mortgage: { owed: 280000, payment: 1900, rate: 6.5 }, "car-loan": { owed: 9000, payment: 320, rate: 7 } }, T);
  S.applySpend(q, { mode: "rows", rows: { groceries: 600 } });
  assert.equal(S.retireDefault(q, T), 600 + 1900, "the mortgage runs past 65, the car loan does not");
  assert.equal(S.retireDefault(q), 600, "no date: no loan added");
});

test("the cushion's money follows the accounts while it is the setup's choice; no bills, no amount", () => {
  const p = family();
  S.applyHavePicks(p, [...S.picks(p, "have"), "savings"]);
  p.accounts.push({ id: "a-cash", name: "Cash at home", type: "cash", balance: 300 });
  S.applyGoalDetails(p, S.valuesFor(p, "goal-details", { today: T }), T);
  const g = p.goals.find((x) => x.id === "setup-goal-cushion");
  assert.ok(g.fundedBy.includes("a-cash"), "a new cash account counts");
  g.fundedBy = ["setup-have-savings"];   // chosen on Goals
  S.applyGoalDetails(p, S.valuesFor(p, "goal-details", { today: T }), T);
  assert.deepEqual(g.fundedBy, ["setup-have-savings"]);
  // loans but no bills: no cushion amount made of loan payments alone
  const q = empty(); S.applyYou(q, { who: "me" });
  S.applyOwePicks(q, ["car-loan"]); S.applyOweAmounts(q, { "car-loan": { owed: 9000, payment: 400 } }, T);
  assert.equal(S.cushion(q).essential, 0);
  S.applyGoalPicks(q, ["cushion"]); S.applyGoalDetails(q, { cushion: { months: 6 } }, T);
  assert.equal(q.goals.find((x) => x.id === "setup-goal-cushion").target, 0);
});

test("the headline never contradicts the cards under it", () => {
  const head = (p) => S.standing(p, { today: T }).headline;
  assert.match(head(family()), /^Life cover for the people who count on you comes first/, "protection is move 1");
  assert.match(head(covered(family())), /costly debt comes first/, "the 22% card is move 1 once both are covered");
  // no pay at all: never "your month works"
  const n = empty(); S.applyYou(n, { who: "me" }); S.applyMoney(n, { people: { "setup-self": { status: "none" } } });
  S.applyHavePicks(n, ["checking"]); S.applyHaveAmounts(n, { checking: 500 }, T); S.applySpend(n, { mode: "total", total: 3000 });
  assert.doesNotMatch(head(n), /month works/);
  // a thin cushion with a good month
  const w = empty(); S.applyYou(w, { who: "me" }); S.applyMoney(w, { people: { "setup-self": { status: "work", amount: 90000 } } });
  S.applyHavePicks(w, ["checking"]); S.applyHaveAmounts(w, { checking: 6000 }, T); S.applySpend(w, { mode: "total", total: 3000 });
  assert.match(head(w), /Building your cushion|then a bigger cushion/);
  const firstId = S.standing(w, { today: T }).moves[0]?.id;
  if (firstId && firstId !== "starter" && firstId !== "full-fund") assert.match(head(w), /The move below comes first/, "the sentence never names a different first step than the button");
  S.applyHaveAmounts(w, { checking: 30000 }, T);
  assert.match(head(w), /good shape|Retirement/);
  // nothing at all: no figure, no echo of the title
  const z = empty(); S.markAt(z, "done", T);
  assert.deepEqual([S.standing(z, { today: T }).netWorth, head(z)], [null, "A few more answers will fill this in."]);
});

test("someone retired living on savings is told calmly, with the retirement check first", () => {
  const p = empty(); S.applyYou(p, { name: "Rosa", who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "retired", pension: 1800 } } });
  S.applyAges(p, { people: { "setup-self": { month: 3, year: 1956, retired: true, ss: { mode: "getting", amount: 1400, started: 66 } } } }, T);
  S.applyHavePicks(p, ["savings", "retire"]); S.applyHaveAmounts(p, { savings: 34000, "retire-setup-self": 380000, "kind-setup-self": "own" }, T);
  S.applySpend(p, { mode: "total", total: 4800 });
  const st = S.standing(p, { today: T });
  assert.equal(st.drawing, true);
  assert.match(st.headline, /^You draw about \$[\d,]+ a month from savings \(\$414,000 saved\)/);
  assert.equal(st.moves[0].id, "guide-retire");
  assert.ok(!st.moves.some((m) => m.title === "Spend less than comes in"));
});

test("the first moves are in plain words: no 'each of you' for one adult, no 'backdoor', a guessed rate says so", () => {
  const p = empty(); S.applyYou(p, { name: "Rosa", who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: 60000 } } });
  S.applyHavePicks(p, ["checking"]); S.applyHaveAmounts(p, { checking: 20000 }, T);
  S.applyOwePicks(p, ["credit"]); S.applyOweAmounts(p, { credit: { owed: 4200, payment: 150 } }, T);
  S.applySpend(p, { mode: "total", total: 2500 });
  const moves = S.standing(p, { today: T }).moves;
  const text = moves.map((m) => `${m.title} ${m.detail ?? ""}`).join(" | ");
  // $20,000 in checking is more than six months of her $2,500 bills: the card is paid from savings today (2026-11-02)
  assert.equal(moves[0].title, "Pay off the cards from your savings");
  assert.match(moves[0].detail, /from savings now: you would still have [\d.]+ months of must-pay bills in cash.*The rate is a typical one: type yours on What you owe\./);
  // with no cash above the cushion, the card is paid down from the monthly left-over, in the same plain words
  const low = S.revealWords({ id: "high-debt", detail: "x" }, p);
  assert.equal(low.title, "Pay down the cards first");
  assert.match(low.detail, /22\.4% a year \(a typical rate: type yours on What you owe\)/);
  assert.doesNotMatch(text, /each of you|backdoor|for sure/);
  assert.ok(moves.some((m) => m.id === "ira" && m.title === "A retirement account of your own (an IRA)"));
  assert.equal(S.revealWords({ id: "full-fund", title: "A full emergency fund (4 months)", detail: "x" }, p).title, "Build your cushion to 4 months");
  const f = S.standing(family(), { today: T }).moves.find((m) => m.id === "ira");
  if (f) assert.match(f.title, /each of you/);
  // a 401(k) with nothing going in is a question first: it may be an old job's, or the job may not match
  assert.equal(S.revealWords({ id: "match", status: "check", ask: [{ personId: "p-bo", name: "Bo", accounts: ["a"] }] }, p).title, "Check if Bo's job matches retirement saving");
  assert.equal(S.revealWords({ id: "match", status: "check", ask: [{ personId: "s", name: "Me", accounts: ["a"] }] }, p).title, "Check if your job matches retirement saving");
  assert.equal(S.revealWords({ id: "match", status: "check", ask: [{ name: "Ana" }, { name: "Bo" }] }, p).title, "Check if your jobs match retirement saving");
  assert.equal(S.revealWords({ id: "match", status: "done", ask: [] }, p).title, "Get all of your employer's match");
});

test("what is not counted yet names only what is missing, an unmarried couple's tax and an estimated Social Security", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: 60000 } } });
  S.applyAges(p, { people: { "setup-self": { month: 1, year: 1980, stopAge: 65, ss: { mode: "unsure" } } } }, T);
  assert.equal(S.retirementMissing(p), "Social Security", "the birth date was typed");
  const q = empty(); S.applyYou(q, { who: "me" }); S.applyAges(q, { people: { "setup-self": { ss: { mode: "none" } } } }, T);
  assert.equal(S.retirementMissing(q), "your birth date");
  const c = empty(); S.applyYou(c, { who: "partner", partnerName: "Sam" });
  S.applyMoney(c, { people: { "setup-self": { status: "work", amount: 65000 }, "setup-partner": { status: "work", amount: 65000 } } });
  assert.ok(S.standing(c, { today: T }).later.some((l) => l.key === "couple"));
  assert.ok(!S.standing(family(), { today: T }).later.some((l) => l.key === "couple"), "spouses file together");
  const f = family();
  assert.ok(S.standing(f, { today: T }).later.some((l) => l.key === "ss-estimate" && /Ana's pay/.test(l.label)));
  f.retirement.socialSecurity["setup-self"].monthlyAtFRA = 2500;   // typed from the statement
  assert.ok(!S.standing(f, { today: T }).later.some((l) => l.key === "ss-estimate"));
});

test("Social Security set on its own page stays: a typed figure, a claim age; an estimate refreshes only its own figure", () => {
  const p = family();
  const ss = p.retirement.socialSecurity;
  ss["setup-partner"].claimAge = 68;            // chosen on Social Security
  S.applyAges(p, S.valuesFor(p, "ages", { today: T }), T);
  assert.equal(ss["setup-partner"].claimAge, 68);
  inc(p, "setup-pay-setup-self").amount = 120000;   // a raise on Income
  const was = ss["setup-self"].monthlyAtFRA;
  S.applyAges(p, S.valuesFor(p, "ages", { today: T }), T);
  assert.ok(ss["setup-self"].monthlyAtFRA > was, "the setup's estimate follows the pay");
  ss["setup-self"].monthlyAtFRA = 2222;             // typed from the statement on Social Security
  S.applyAges(p, S.valuesFor(p, "ages", { today: T }), T);
  assert.equal(ss["setup-self"].monthlyAtFRA, 2222);
});

test("a retired person under 62 who gets Social Security gets it unreduced (disability), at full retirement age", () => {
  const p = empty(); S.applyYou(p, { who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "retired" } } });
  S.applyAges(p, { people: { "setup-self": { month: 3, year: 1966, retired: true, ss: { mode: "getting", amount: 1500 } } } }, T);
  const r = p.retirement.socialSecurity["setup-self"];
  assert.deepEqual([r.monthlyAtFRA, r.claimAge], [1500, 67]);
});

test("a partner named on another page's records is kept", () => {
  const p = family();
  p.estate = { beneficiaries: [{ accountId: "a1", primary: [{ personId: "setup-partner", share: 100 }] }] };
  assert.match(S.personReferenced(p, "setup-partner"), /beneficiary/);
  const kept = S.applyYou(p, { ...S.valuesFor(p, "you"), who: "me" });
  assert.ok(kept.some((k) => k.name === "Bo"));
  assert.ok(p.household.people.some((x) => x.id === "setup-partner"));
});

test("ssMissingFor: adults with no Social Security figure who have not said they get none (the retirement pages' notice)", async () => {
  const { ssMissingFor } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1980-01-01" }, { id: "b", name: "Bo", role: "partner", birthDate: "1979-01-01" }, { id: "c", name: "Cy", role: "dependent", birthDate: "2015-01-01" });
  assert.deepEqual(ssMissingFor(p).map((x) => x.id), ["a", "b"], "children are never asked");
  p.retirement.socialSecurity = { a: { monthlyAtFRA: 2400 } };
  assert.deepEqual(ssMissingFor(p).map((x) => x.id), ["b"]);
  p.guide = { setup: { ss: { b: "none" } } };
  assert.deepEqual(ssMissingFor(p), [], "saying none counts as known");
});
test("a Social Security figure typed after saying none wins: going through the ages screen keeps it", async () => {
  const S2 = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const T2 = "2026-11-01";
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1980-01-01" }, { id: "b", name: "Bo", role: "partner", birthDate: "1979-01-01" });
  p.guide = { setup: { ss: { b: "none" } } };
  p.retirement.socialSecurity = { a: { monthlyAtFRA: 2400, claimAge: 67 }, b: { monthlyAtFRA: 2900, claimAge: 67 } };
  const v = S2.valuesFor(p, "ages", { today: T2 });
  assert.equal(v.people.b.ss.mode, "statement", "the typed $2,900 is shown, not the earlier none");
  S2.applyAges(p, v, T2);
  assert.equal(p.retirement.socialSecurity.b.monthlyAtFRA, 2900, "and is not erased");
});

test("review: a plan made without names says 'yourself' and 'your spouse', never 'Me' or 'My spouse' in the life cover move", () => {
  const p = family();
  for (const x of p.household.people) { if (x.role === "self") x.name = "Me"; else if (x.role === "partner") x.name = "My spouse"; }
  const st = S.standing(p, { today: T });
  const m = st.moves.find((x) => x.id === "protect");
  assert.ok(m, "the protection move is there");
  assert.doesNotMatch(`${m.title} ${m.detail}`, /\bMe\b|My spouse/, `${m.title} | ${m.detail}`);
  assert.match(m.title, /yourself|your spouse/);
});

test("where you stand: a debt step the saved debt plan pays off is not a move, and the left-over figure says where the extra goes", () => {
  const p = familyPlan(T);
  p.insurance = { ...(p.insurance ?? {}), policies: [{ id: "t1", kind: "term", personId: "p-ana", benefit: 400000, premium: 25, period: "monthly", throughWork: false }] };
  p.accounts.find((a) => a.id === "a-chk").balance += 6000;
  const before = S.standing(p, { today: T });
  assert.ok(before.moves.some((m) => m.id === "high-debt"), "the cards are a move before any plan is saved");
  assert.equal(before.debtExtra, 0); assert.equal(before.debtOn, null);
  p.debtPlan = { extra: 410, order: "avalanche", targets: ["a-visa"] };
  const st = S.standing(p, { today: T });
  assert.ok(!st.moves.some((m) => m.id === "high-debt"), "under way: not a move");
  assert.equal(st.debtExtra, 410); assert.equal(st.debtOn, "Visa card"); assert.match(st.debtUntil, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Math.abs(st.spare - (before.spare - 410)) < 0.01);
});

test("who pays: working for yourself saves business income, not a salary, and the tax pages follow (round 4)", async () => {
  const { taxAnswer } = await import("../../taxes/withholding/compute.js");
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const T = "2026-11-02";
  const q = empty(); S.applyYou(q, { who: "me" });
  q.household.people.find((x) => x.id === "setup-self").birthDate = "1990-05-01";
  S.applyMoney(q, { people: { "setup-self": { status: "work", by: "self", amount: 78000, period: "annual" } }, other: {} });
  const r = inc(q, "setup-pay-setup-self");
  assert.deepEqual([r.type, r.name, r.amount, r.period, r.personId], ["business", "My business", 78000, "annual", "setup-self"]);
  assert.equal(S.valuesFor(q, "money").people["setup-self"].by, "self", "asked again, the answer stays");
  // no paycheck: nothing is assumed withheld, and self-employment tax is in the total
  const t = taxAnswer(q, { today: T });
  assert.ok(!(t?.withheld > 0), "no withholding from a paycheck that does not exist");
  assert.ok(estimated(q, { today: T }).needsEstimates, "quarterly payments are needed");
  // changed to an employer: a salary, and the name follows while it is still the setup's own
  S.applyMoney(q, { people: { "setup-self": { status: "work", by: "employer", amount: 78000, period: "annual" } }, other: {} });
  assert.deepEqual([inc(q, "setup-pay-setup-self").type, inc(q, "setup-pay-setup-self").name], ["salary", "My pay"]);
});

test("someone paid by their own business: the name follows after they are named, and retirement starts 'On my own' (review 2026-11-02)", () => {
  const q = empty(); S.applyYou(q, { who: "me" });
  S.applyMoney(q, { people: { "setup-self": { status: "work", by: "employer", amount: 78000, period: "annual" } }, other: {} });
  assert.equal(inc(q, "setup-pay-setup-self").name, "My pay");
  // named in between, then the answer changes to "Myself"
  q.household.people.find((x) => x.id === "setup-self").name = "Dee";
  S.applyMoney(q, { people: { "setup-self": { status: "work", by: "self", amount: 78000, period: "annual" } }, other: {} });
  assert.deepEqual([inc(q, "setup-pay-setup-self").type, inc(q, "setup-pay-setup-self").name], ["business", "Dee's business"]);
  // a name typed on Income that is not the setup's shape stays
  inc(q, "setup-pay-setup-self").name = "Dee Design Studio";
  S.applyMoney(q, { people: { "setup-self": { status: "work", by: "employer", amount: 78000, period: "annual" } }, other: {} });
  assert.equal(inc(q, "setup-pay-setup-self").name, "Dee Design Studio");
  // retirement savings: no employer plan for a business owner, so "On my own" comes first
  S.applyMoney(q, { people: { "setup-self": { status: "work", by: "self", amount: 78000, period: "annual" } }, other: {} });
  assert.equal(S.valuesFor(q, "have-amounts")["kind-setup-self"], "own");
  S.applyMoney(q, { people: { "setup-self": { status: "work", by: "employer", amount: 78000, period: "annual" } }, other: {} });
  assert.equal(S.valuesFor(q, "have-amounts")["kind-setup-self"], "work");
});

test("a pay's name typed on Income stays when the money answers are saved again unchanged; setup's own unnamed names follow (round 5)", () => {
  const q = empty(); S.applyYou(q, { who: "spouse", name: "Sam", partnerName: "Lena", kids: 0, state: "CO" });
  const money = { people: { "setup-self": { status: "work", by: "employer", amount: 60000, period: "annual" }, "setup-partner": { status: "work", by: "self", amount: 40000, period: "annual" } }, other: {} };
  S.applyMoney(q, money);
  assert.deepEqual([inc(q, "setup-pay-setup-self").name, inc(q, "setup-pay-setup-partner").name], ["Sam's pay", "Lena's business"]);
  inc(q, "setup-pay-setup-self").name = "My day job's pay";
  inc(q, "setup-pay-setup-partner").name = "My wife's business";
  S.applyMoney(q, S.valuesFor(q, "money"));
  assert.deepEqual([inc(q, "setup-pay-setup-self").name, inc(q, "setup-pay-setup-partner").name], ["My day job's pay", "My wife's business"], "names typed on Income stay");
  // the setup's own names for someone not named yet follow once they are named
  const r = empty(); S.applyYou(r, { who: "spouse", kids: 0, state: "CO" });
  S.applyMoney(r, money);
  assert.deepEqual([inc(r, "setup-pay-setup-self").name, inc(r, "setup-pay-setup-partner").name], ["My pay", "My spouse's business"]);
  r.household.people.find((x) => x.id === "setup-self").name = "Sam";
  r.household.people.find((x) => x.id === "setup-partner").name = "Lena";
  S.applyMoney(r, S.valuesFor(r, "money"));
  assert.deepEqual([inc(r, "setup-pay-setup-self").name, inc(r, "setup-pay-setup-partner").name], ["Sam's pay", "Lena's business"]);
});

test("someone paid by their own business is asked what estimated tax is paid so far; it is spread over the quarters due (review 2026-11-02)", async () => {
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const T = "2026-11-02";
  const q = empty(); S.applyYou(q, { who: "me" });
  q.household.people.find((x) => x.id === "setup-self").birthDate = "1990-05-01";
  S.applyMoney(q, { people: { "setup-self": { status: "work", by: "self", amount: 78000, period: "annual" } }, other: {}, taxPaid: "8,400", today: T });
  assert.deepEqual(q.taxes.estimated.paid, [2800, 2800, 2800, 0], "three quarters were due by November 2");
  assert.equal(q.taxes.estimated.typedAt, T);
  assert.equal(S.valuesFor(q, "money").taxPaid, 8400, "asked again, the answer stays");
  const e = estimated(q, { today: T });
  assert.equal(e.paidTyped, true); assert.equal(e.paid, 8400);
  // an uneven total: the cents land on the last quarter due
  S.applyMoney(q, { people: { "setup-self": { status: "work", by: "self", amount: 78000, period: "annual" } }, other: {}, taxPaid: "1000", today: T });
  assert.deepEqual(q.taxes.estimated.paid, [333.33, 333.33, 333.34, 0]);
  // blank: nothing written (the pages ask later); an employee is never asked
  const r = empty(); S.applyYou(r, { who: "me" });
  S.applyMoney(r, { people: { "setup-self": { status: "work", by: "self", amount: 78000, period: "annual" } }, other: {}, taxPaid: "", today: T });
  assert.equal(r.taxes?.estimated?.typedAt, undefined);
  const w = empty(); S.applyYou(w, { who: "me" });
  S.applyMoney(w, { people: { "setup-self": { status: "work", by: "employer", amount: 78000, period: "annual" } }, other: {}, taxPaid: "500", today: T });
  assert.equal(w.taxes?.estimated?.typedAt, undefined);
  assert.equal(S.valuesFor(w, "money").taxPaid, "");
});

test("Get started's pay question after a raise from a later date saved on Income: today's pay, before and after the start date (round 5)", async () => {
  const { changeFrom, compute: income } = await import("../../cashflow/income/compute.js");
  const D = "2026-11-02";
  const near = (a, b, tol = 0.01, msg) => assert.ok(Math.abs(a - b) <= tol, msg ?? `${a} vs ${b}`);
  const p = empty(); S.applyYou(p, { name: "Ana", who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", by: "employer", amount: 60000, period: "annual" } }, other: {} });
  // a raise to $66,000 from January, saved on Income (its split: the pay that ends keeps the setup's id)
  const was = inc(p, "setup-pay-setup-self");
  const ch = changeFrom(was, { ...was, amount: 66000, startDate: "2027-01-01" }, D);
  const i = p.income.indexOf(was);
  p.income[i] = ch.old; p.income.splice(i + 1, 0, { id: "raise-2027", ...ch.next });
  const pays = (q, day) => income(q, { today: day }).active.filter((x) => x.personId === "setup-self").map((x) => [x.id, x.amount]);
  // before the start date: today's pay is shown, and a new answer changes it and keeps the raise
  const v = S.valuesFor(p, "money", { today: D });
  assert.deepEqual([v.people["setup-self"].amount, v.people["setup-self"].period], [60000, "annual"]);
  const q = structuredClone(p); v.people["setup-self"].amount = 62000; S.applyMoney(q, { ...v, today: D });
  assert.deepEqual(pays(q, D), [["setup-pay-setup-self", 62000]]);
  assert.deepEqual(pays(q, "2027-02-01"), [["raise-2027", 66000]]);
  // the summary line counts today's pay once, not both halves
  near(S.reflect(p, "money", { today: D }).monthly, 5000);
  near(S.reflect(p, "money").monthly, 5000 + 5500, 1e-6, "without a day, every line (as before)");
  // after the start date: the new pay is today's pay, shown and changed; the pay that ended stays as it was
  const L8 = "2027-02-01";
  const w = S.valuesFor(p, "money", { today: L8 });
  assert.equal(w.people["setup-self"].amount, 66000);
  const r = structuredClone(p); w.people["setup-self"].amount = 70000; S.applyMoney(r, { ...w, today: L8 });
  assert.deepEqual(pays(r, L8), [["raise-2027", 70000]]);
  assert.deepEqual([inc(r, "setup-pay-setup-self").amount, inc(r, "setup-pay-setup-self").endDate], [60000, "2026-12-31"]);
  // its name follows the answer as the setup's own names do (an employer, then their own business)
  w.people["setup-self"].by = "self"; S.applyMoney(r, { ...w, today: L8 });
  assert.deepEqual([inc(r, "raise-2027").type, inc(r, "raise-2027").name, inc(r, "setup-pay-setup-self").type], ["business", "Ana's business", "salary"]);
  // the raise is the setup's own pay carried on, not pay "already in your plan": the question still asks for it
  assert.deepEqual(S.existingPay(p, "setup-self"), []);
  // a box cleared, or "Not working now", removes the setup's pay and the raise that carries it on; other pay stays
  const c = structuredClone(p); c.income.push({ id: "gig", name: "Gig", type: "business", personId: "setup-self", amount: 300, period: "monthly" });
  S.applyMoney(c, { people: { "setup-self": { status: "none" } }, other: {}, today: D });
  assert.deepEqual(c.income.map((x) => x.id), ["gig"]);
  // payLineNow: the setup's line without a day, or before the start; the line carrying it on after
  assert.equal(S.payLineNow(p.income, "setup-self").id, "setup-pay-setup-self");
  assert.equal(S.payLineNow(p.income, "setup-self", D).id, "setup-pay-setup-self");
  assert.equal(S.payLineNow(p.income, "setup-self", L8).id, "raise-2027");
  assert.equal(S.payLineNow(p.income, "nobody", L8), null);
});

test("short only in a lean month (Side income's count on): the done screen's sentence and figure say so (review 2026-11-02, round 5)", async () => {
  const { compute: next } = await import("../next-best-action/compute.js");
  const D = "2026-11-02";
  const near = (a, b, tol = 0.01, msg) => assert.ok(Math.abs(a - b) <= tol, msg ?? `${a} vs ${b}`);
  // the family's $600 of photography counted at $0; spending set so a full month leaves `left`
  const base = () => { const p = familyPlan(D); p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const at = (left) => { const p = base(); const s = next(p, { today: D }).spare; p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s.full - left, period: "monthly", essential: false }); return p; };
  const good = at(150), s = next(good, { today: D }).spare, st = S.standing(good, { today: D });
  assert.ok(st.spare < 0 && s.held > 0.5);
  assert.deepEqual(st.lean, { full: s.full, about: s.fullAbout, kind: "ahead" });
  near(st.lean.full, 150, 0.01); assert.equal(st.lean.about, 150);
  assert.equal(st.headline, "Counting your uneven pay at what you can count on, more goes out than comes in. Good months make up for it; the moves below start with the lean months.");
  const bad = S.standing(at(-120), { today: D });
  assert.ok(bad.lean && bad.lean.full < 0);
  assert.equal(bad.headline, "More goes out than comes in each month, even when uneven pay brings its full amount. That's the first thing to fix, and the moves below start there.");
  // nothing held back: the plain sentence, no lean figure
  const p = familyPlan(D); const s0 = next(p, { today: D }).spare;
  p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s0.monthly + 100, period: "monthly", essential: false });
  const plain = S.standing(p, { today: D });
  assert.equal(plain.lean, null); assert.match(plain.headline, /^More goes out than comes in each month\. That's the first thing to fix/);
  // the done screen shows the lean figure on the left-over tile; the Dashboard reads the same sentence and figure
  const view = fs.readFileSync(`${HERE}view.js`, "utf8");
  assert.ok(view.includes("● Short in a lean month") && view.includes("st.lean.about"));
  const dash = fs.readFileSync(`${HERE}../dashboard/view.js`, "utf8");
  assert.ok(dash.includes("st.lean") && dash.includes("st.headline") && !dash.includes("Counting your uneven pay"), "the Dashboard has no sentence of its own");
});

// A raise from a later date saved on Income, as the Income page saves it: the line that ends keeps its id, the new pay
// gets one and `continues` the line it carries on (cashflow/income changeFrom; review 2026-11-02, round 5)
async function raiseOnIncome(p, id, values, today, newId) {
  const { changeFrom } = await import("../../cashflow/income/compute.js");
  const was = inc(p, id);
  const ch = changeFrom(was, { ...was, ...values }, today);
  assert.equal(ch.split, true);
  const i = p.income.indexOf(was);
  p.income[i] = ch.old; p.income.splice(i + 1, 0, { id: newId, ...ch.next });
  return p;
}

test("Get started after the ended half of a raise is removed on Income: it shows the pay coming in, never deletes or doubles it (round 5)", async () => {
  const { compute: income } = await import("../../cashflow/income/compute.js");
  const D = "2026-11-02", L8 = "2027-02-01";
  const p = empty(); S.applyYou(p, { name: "Ana", who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", by: "employer", amount: 60000, period: "annual" } }, other: {}, today: D });
  await raiseOnIncome(p, "setup-pay-setup-self", { amount: 66000, startDate: "2027-01-01" }, D, "raise-2027");
  // February: the pay that ended is tidied away on Income ("Remove"); only the raise is left
  p.income = p.income.filter((x) => x.id !== "setup-pay-setup-self");
  const ids = (q) => q.income.map((x) => [x.id, x.amount]);
  const now = (q) => income(q, { today: L8 }).monthly;
  assert.equal(now(p), 5500);
  // the question shows the pay coming in, and still asks for it (it is the setup's pay carried on)
  const v = S.valuesFor(p, "money", { today: L8 });
  assert.deepEqual([v.people["setup-self"].status, v.people["setup-self"].amount, v.people["setup-self"].period], ["work", 66000, "annual"]);
  assert.deepEqual(S.existingPay(p, "setup-self"), []);
  assert.equal(S.payLineNow(p.income, "setup-self", L8).id, "raise-2027");
  // Continue as shown keeps the pay (it used to delete it: income 0)
  const a = structuredClone(p); S.applyMoney(a, { ...structuredClone(v), today: L8 });
  assert.deepEqual(ids(a), [["raise-2027", 66000]]); assert.equal(now(a), 5500);
  // and a Continue that changes nothing saves nothing
  assert.equal(S.wouldChange(p, (d) => S.applyMoney(d, { ...structuredClone(v), today: L8 })), false);
  // a new figure changes that line in place: no second setup line beside it (it used to double: $11,000 a month)
  const b = structuredClone(p); const vb = structuredClone(v); vb.people["setup-self"].amount = 70000; S.applyMoney(b, { ...vb, today: L8 });
  assert.deepEqual(ids(b), [["raise-2027", 70000]]); assert.equal(Math.round(now(b)), Math.round(70000 / 12));
  // "who pays you" changed there too, with the name the setup gave it
  const c = structuredClone(p); const vc = structuredClone(v); vc.people["setup-self"].by = "self"; S.applyMoney(c, { ...vc, today: L8 });
  assert.deepEqual([inc(c, "raise-2027").type, inc(c, "raise-2027").name, c.income.length], ["business", "Ana's business", 1]);
  // a cleared box or "Not working now" still removes it, as before
  const e = structuredClone(p); S.applyMoney(e, { people: { "setup-self": { status: "none" } }, other: {}, today: L8 });
  assert.deepEqual(e.income, []);
  // before the start date with the setup's own line removed instead: the raise to come is shown and changed, not doubled
  const f = empty(); S.applyYou(f, { name: "Ana", who: "me" });
  S.applyMoney(f, { people: { "setup-self": { status: "work", by: "employer", amount: 60000, period: "annual" } }, other: {}, today: D });
  await raiseOnIncome(f, "setup-pay-setup-self", { amount: 66000, startDate: "2027-01-01" }, D, "raise-2027");
  f.income = f.income.filter((x) => x.id !== "setup-pay-setup-self");
  const vf = S.valuesFor(f, "money", { today: D });
  assert.equal(vf.people["setup-self"].amount, 66000);
  S.applyMoney(f, { ...vf, today: D });
  assert.deepEqual(ids(f), [["raise-2027", 66000]]);
  // the tax paid so far is still asked of someone whose pay carried on is their own business
  const g = structuredClone(c); S.applyMoney(g, { ...structuredClone(S.valuesFor(g, "money", { today: L8 })), taxPaid: 900, today: L8 });
  assert.equal(g.taxes.estimated.typedAt, L8);
  // and the retirement screen starts "On my own" for them, as for the setup's own business line
  assert.equal(S.valuesFor(g, "have-amounts", { today: L8 })["kind-setup-self"], "own");
});

test("Get started's pension and other money after a raise from a later date: the line in force today is read and changed (round 5)", async () => {
  const { compute: income } = await import("../../cashflow/income/compute.js");
  const D = "2026-11-02", L8 = "2027-02-01";
  const p = empty(); S.applyYou(p, { name: "Lee", who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "retired", pension: 2000 } }, other: { kind: "rental", amount: 900 }, today: D });
  await raiseOnIncome(p, "setup-pension-setup-self", { amount: 2100, startDate: "2027-01-01" }, D, "pension-2027");
  await raiseOnIncome(p, "setup-other", { amount: 1000, startDate: "2027-01-01" }, D, "other-2027");
  const now = (q, day = L8) => income(q, { today: day }).monthly;
  // before the start date: today's amounts; after it: the new ones (it showed 2000 and 900 while 2100 and 1000 came in)
  const v0 = S.valuesFor(p, "money", { today: D });
  assert.deepEqual([v0.people["setup-self"].pension, v0.other.amount], [2000, 900]);
  const v = S.valuesFor(p, "money", { today: L8 });
  assert.deepEqual([v.people["setup-self"].status, v.people["setup-self"].pension, v.other.kind, v.other.amount], ["retired", 2100, "rental", 1000]);
  // re-answered after the start date: the line coming in changes, the one that ended stays as it was
  const q = structuredClone(p); const vq = structuredClone(v); vq.people["setup-self"].pension = 2200; vq.other.amount = 1100; S.applyMoney(q, { ...vq, today: L8 });
  assert.deepEqual([inc(q, "pension-2027").amount, inc(q, "setup-pension-setup-self").amount, inc(q, "other-2027").amount, inc(q, "setup-other").amount], [2200, 2000, 1100, 900]);
  assert.equal(now(q), 3300);
  // re-answered before it: today's line changes and the raise stays
  const r = structuredClone(p); const vr = structuredClone(v0); vr.people["setup-self"].pension = 1950; S.applyMoney(r, { ...vr, today: D });
  assert.deepEqual([now(r, D), now(r, L8)], [1950 + 900, 2100 + 1000]);
  // the ended halves removed on Income: Continue as shown keeps both (it used to leave nothing), a new figure is no double
  const t = structuredClone(p); t.income = t.income.filter((x) => x.endDate !== "2026-12-31");
  const vt = S.valuesFor(t, "money", { today: L8 });
  assert.deepEqual([vt.people["setup-self"].pension, vt.other.kind, vt.other.amount], [2100, "rental", 1000]);
  const a = structuredClone(t); S.applyMoney(a, { ...structuredClone(vt), today: L8 });
  assert.deepEqual(a.income.map((x) => [x.id, x.amount]), [["pension-2027", 2100], ["other-2027", 1000]]);
  const b = structuredClone(t); const vb = structuredClone(vt); vb.other.amount = 1200; vb.other.kind = "support"; S.applyMoney(b, { ...vb, today: L8 });
  assert.deepEqual(b.income.map((x) => [x.id, x.amount, x.type]), [["pension-2027", 2100, "pension"], ["other-2027", 1200, "support"]]);
  assert.equal(inc(b, "other-2027").name, "Child support");
});

test("Social Security already coming in, after a raise from a later date: the ages screen reads and changes the line in force (round 5)", async () => {
  const D = "2026-11-02", L8 = "2027-02-01";
  const p = empty(); S.applyYou(p, { name: "Lee", who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "retired" } }, other: {}, today: D });
  S.applyAges(p, { people: { "setup-self": { month: 3, year: 1956, retired: true, ss: { mode: "getting", amount: 2400, started: 67 } } } }, D);
  await raiseOnIncome(p, "setup-ss-setup-self", { amount: 2470, startDate: "2027-01-01" }, D, "ss-2027");
  p.income = p.income.filter((x) => x.id !== "setup-ss-setup-self");
  const v = S.valuesFor(p, "ages", { today: L8 });
  assert.equal(v.people["setup-self"].ss.amount, 2470);
  S.applyAges(p, v, L8);
  assert.deepEqual(p.income.map((x) => [x.id, x.amount]), [["ss-2027", 2470]], "kept, and not doubled");
  // the money screen keeps it too (Social Security is the ages screen's)
  S.applyMoney(p, { ...S.valuesFor(p, "money", { today: L8 }), today: L8 });
  assert.deepEqual(p.income.map((x) => x.id), ["ss-2027"]);
});

test("removing the partner removes their setup pay and the raise that carries it on, as the README says (round 5)", async () => {
  const D = "2026-11-02";
  const p = empty(); S.applyYou(p, { name: "Ana", who: "partner", partnerName: "Bo" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", by: "employer", amount: 60000, period: "annual" }, "setup-partner": { status: "work", by: "self", amount: 40000, period: "annual" } }, other: {}, today: D });
  await raiseOnIncome(p, "setup-pay-setup-partner", { amount: 48000, startDate: "2027-01-01" }, D, "bo-2027");
  assert.equal(S.personReferenced(p, "setup-partner"), null, "the raise is the setup's own pay carried on");
  const kept = S.applyYou(p, { name: "Ana", who: "me" });
  assert.deepEqual(kept, []);
  assert.deepEqual(p.household.people.map((x) => x.id), ["setup-self"]);
  assert.deepEqual(p.income.map((x) => x.id), ["setup-pay-setup-self"]);
  // pay typed on Income for them still keeps them
  const q = empty(); S.applyYou(q, { name: "Ana", who: "partner", partnerName: "Bo" });
  q.income.push({ id: "gig", name: "Bo's gig", type: "business", personId: "setup-partner", amount: 300, period: "monthly" });
  assert.equal(S.personReferenced(q, "setup-partner"), "Income lists their pay");
});

test("'who pays you' changed before a raise's start date goes on to the raise (round 5: it stayed a salary)", async () => {
  const D = "2026-11-02";
  const p = empty(); S.applyYou(p, { name: "Ana", who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", by: "employer", amount: 60000, period: "annual" } }, other: {}, today: D });
  await raiseOnIncome(p, "setup-pay-setup-self", { amount: 66000, startDate: "2027-01-01" }, D, "raise-2027");
  const v = S.valuesFor(p, "money", { today: D }); v.people["setup-self"].by = "self";
  S.applyMoney(p, { ...v, today: D });
  const line = (id) => [inc(p, id).type, inc(p, id).name, inc(p, id).amount];
  assert.deepEqual(line("setup-pay-setup-self"), ["business", "Ana's business", 60000]);
  assert.deepEqual(line("raise-2027"), ["business", "Ana's business", 66000], "the raise is paid the same way, its amount kept");
  // and back to an employer: both again, and a careful figure for business pay goes from both
  inc(p, "raise-2027").countOn = 3000; inc(p, "setup-pay-setup-self").countOn = 3000;
  const w = S.valuesFor(p, "money", { today: D }); w.people["setup-self"].by = "employer";
  S.applyMoney(p, { ...w, today: D });
  assert.deepEqual([line("setup-pay-setup-self"), line("raise-2027")], [["salary", "Ana's pay", 60000], ["salary", "Ana's pay", 66000]]);
  assert.equal(p.income.some((x) => "countOn" in x), false);
  // a raise typed on Income as another kind on purpose stays as it is when "who pays you" is not changed
  inc(p, "raise-2027").type = "bonus";
  S.applyMoney(p, { ...S.valuesFor(p, "money", { today: D }), today: D });
  assert.equal(inc(p, "raise-2027").type, "bonus");
});

test("the money answer is reported when all pay has ended or starts later: it was answered (round 5)", async () => {
  const D = "2026-11-02";
  const p = empty(); S.applyYou(p, { name: "Ana", who: "me" });
  S.applyMoney(p, { people: { "setup-self": { status: "work", by: "employer", amount: 60000, period: "annual" } }, other: {}, today: D });
  // a new job from January, nothing before it
  inc(p, "setup-pay-setup-self").startDate = "2027-01-04";
  assert.deepEqual(S.reflect(p, "money", { today: D }), { kind: "money", monthly: 5000, from: "2027-01-04" });
  // pay that has ended, nothing after it
  inc(p, "setup-pay-setup-self").startDate = ""; inc(p, "setup-pay-setup-self").endDate = "2026-10-31";
  assert.deepEqual(S.reflect(p, "money", { today: D }), { kind: "money", monthly: 0, ended: true });
  // pay coming in today: as before
  inc(p, "setup-pay-setup-self").endDate = "";
  assert.deepEqual(S.reflect(p, "money", { today: D }), { kind: "money", monthly: 5000 });
  // nothing on Income: not answered
  assert.equal(S.reflect(empty(), "money", { today: D }), null);
  // the view words both ("from January 4, 2027"; "Nothing comes in now")
  const view = fs.readFileSync(`${HERE}view.js`, "utf8");
  assert.ok(view.includes("Nothing comes in now: the pay on Income has ended") && view.includes("a month before tax from ${dayWords(r.from)}"));
});

test("the done screen's lean month within $5 of $0: 'only just about breaks even', never 'about $0' (round 5)", async () => {
  const { compute: next } = await import("../next-best-action/compute.js");
  const D = "2026-11-02";
  const base = () => { const p = familyPlan(D); p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const at = (left) => { const p = base(); const s = next(p, { today: D }).spare; p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s.full - left, period: "monthly", essential: false }); return p; };
  for (const left of [3, -2]) {
    const st = S.standing(at(left), { today: D });
    assert.equal(st.lean.kind, "even");
    assert.equal(st.headline, "Counting your uneven pay at what you can count on, more goes out than comes in, and a month that brings all of it only just about breaks even. That's the first thing to fix, and the moves below start there.");
  }
  assert.equal(S.standing(at(8), { today: D }).lean.kind, "ahead");
  assert.equal(S.standing(at(-8), { today: D }).lean.kind, "short");
  const view = fs.readFileSync(`${HERE}view.js`, "utf8"), dash = fs.readFileSync(`${HERE}../dashboard/view.js`, "utf8");
  assert.ok(view.includes('st.lean.kind === "even" ? "it only just about breaks even"') && dash.includes('lean.kind === "even" ? "it only just about breaks even"'));
});

test("recheck 2026-11-05: a new amount for an unmarked benefit the Social Security page reads as unreduced is its new full-age amount; the age on file stays", async () => {
  const { compute: ss } = await import("../../retirement/social-security/compute.js");
  const T2 = "2026-11-02";
  // Ana, 62 and 8 months, on a disability benefit set up before the mark existed: $1,800 at full age, 67 on file, $1,800 on
  // Income (the page reads it as unreduced: the line pays the full-age amount); Sam $900 at 67
  const ana = (line = 1800) => {
    const p = emptyPlan();
    p.household.people = [{ id: "a", name: "Ana", role: "self", birthDate: "1964-03-15" }, { id: "s", name: "Sam", role: "partner", birthDate: "1966-06-15" }];
    p.retirement.socialSecurity = { a: { claimAge: 67, monthlyAtFRA: 1800 }, s: { claimAge: 67, monthlyAtFRA: 900 } };
    p.income = [{ id: "setup-ss-a", name: "Ana's Social Security", type: "social", personId: "a", amount: line, period: "monthly", startDate: "", endDate: "" }];
    p.guide = { setup: { ss: { a: "getting", s: "statement" } } };
    return p;
  };
  const again = (p, started, amount) => S.applyAges(p, { people: { a: { year: 1964, month: 3, stopAge: 55, retired: true, ss: { mode: "getting", amount, started } }, s: { year: 1966, month: 6, stopAge: 67, ss: { mode: "statement", amount: 900 } } } }, T2);
  // the yearly letter says $1,850: given back with the age as the screen shows it (62, its stepper's floor) or as on file
  for (const started of [62, 67]) {
    const p = ana(); again(p, started, 1850);
    // before: { claimAge 62, monthlyAtFRA 2,642.90 }, a $2,180.30 survivor figure and a $421.40 top-up for Sam
    assert.deepEqual(p.retirement.socialSecurity.a, { claimAge: 67, monthlyAtFRA: 1850 }, String(started));
    assert.equal(p.income.find((x) => x.id === "setup-ss-a").amount, 1850);
    const d = ss(p, { today: T2 });
    assert.equal(d.people[0].monthly, 1850); assert.equal(d.people[0].pia, 1850);
    assert.equal(d.couple.survivorMonthly.s, 1850); assert.equal(d.couple.spousal.s, 25, "half of 1,850 less Sam's 900");
  }
  // the old line clearly below the full-age amount (a reduced early claim, as the page reads it): not this branch
  const reduced = ana(1500); again(reduced, 62, 1550);
  assert.notDeepEqual(reduced.retirement.socialSecurity.a, { claimAge: 67, monthlyAtFRA: 1550 });
});

// ---- C2: what you owe with our guesses (spec 14.4)
const REG = mergeEstimators([{ from: "overview/guesses", estimators: guessEstimators, tables: GUESS_TABLES }, { from: "overview/setup", estimators: S.estimators }]);
const GO = { estimators: REG.estimators, tables: REG.tables, today: PERSONA_TODAY };
const BOXES = (kind, askHome) => [["owed", `debt.${kind}.owed`, `accounts[setup-owe-${kind}].balance`], ["payment", `debt.${kind}.payment`, `debts[setup-debt-${kind}].minPayment`], ["rate", `debt.${kind}.rate`, `debts[setup-debt-${kind}].rate`], ...(kind === "mortgage" && askHome ? [["home", "home.value", "accounts[setup-have-home].balance"]] : [])];
/**
 * Q5b saved as the screen saves it: ctx.guess reads the plan before the save, with the screen's answers as args. Returns
 * the grey figure the screen showed in each blank box (path -> value).
 */
function oweWithGuesses(p, values, today = PERSONA_TODAY) {
  const before = structuredClone(p);
  const guess = (k, o = {}) => estimate(before, k, { ...GO, today, ...o });
  const askHome = S.askHomeWithMortgage(before), grey = {};
  for (const kind of S.picks(before, "owe").filter((k) => k !== "none")) {
    const args = S.oweArgs(before, values[kind] ?? {}, kind, { askHome });
    for (const [box, key, path] of BOXES(kind, askHome)) if (args[box] === null) grey[path] = guess(key, { path, args })?.value ?? null;
  }
  S.applyOweAmounts(p, values, today, { guess });
  return grey;
}
const debtRow = (p, kind) => p.debts.find((d) => d.id === `setup-debt-${kind}`);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""}: ${a} vs ${b}`);

test("C2 a picked debt with only a payment is kept: what is owed and the rate are our guesses, the older flags mirrored", () => {
  const j = jordan();
  // before C2 the mortgage was dropped: no balance typed, nothing saved
  const old = structuredClone(j); S.applyOweAmounts(old, { mortgage: { payment: "1,100" } }, PERSONA_TODAY);
  assert.equal(acct(old, "setup-owe-mortgage"), undefined);
  oweWithGuesses(j, { mortgage: { payment: "1,100" } });
  assert.equal(acct(j, "setup-owe-mortgage").balance, 110000, "7.H $111,000, rounded to two figures (R11)");
  assert.equal(acct(j, "setup-have-home").balance, 210000, "the home Q5b asked about, left blank: our guess");
  const d = debtRow(j, "mortgage");
  assert.equal(d.rate, 0.046, "Ohio's rate, not the old national 7.24%");
  assert.equal(d.minPayment, 1100);
  assert.equal(d.rateGuessed, 0.046, "the debt pages' older flag follows the ledger");
  assert.equal(d.paymentGuessed, undefined, "the typed payment is the person's");
  assert.equal(isGuess(j, "accounts[setup-owe-mortgage].balance"), true);
  assert.equal(isGuess(j, "debts[setup-debt-mortgage].rate"), true);
  assert.equal(isGuess(j, "debts[setup-debt-mortgage].minPayment"), false);
  assert.equal(isGuess(j, "accounts[setup-have-home].balance"), true);
  assert.equal(j.guesses["accounts[setup-owe-mortgage].balance"].k, "debt.mortgage.owed");
  assert.equal(j.guesses["accounts[setup-owe-mortgage].balance"].d, PERSONA_TODAY);
});

test("C2 the mortgage rate is the state's: Ohio 4.6%, Arizona 4.3% (the 7.24% case is only the old test's, with no guess)", () => {
  const j = jordan(); oweWithGuesses(j, { mortgage: { payment: 1100 } });
  const n = patLee(); oweWithGuesses(n, { mortgage: { payment: 1600 } });
  assert.equal(debtRow(j, "mortgage").rate, 0.046);
  assert.equal(debtRow(n, "mortgage").rate, 0.043);
  const old = jordan(); S.applyOweAmounts(old, { mortgage: { owed: 150000 } }, PERSONA_TODAY);
  assert.equal(debtRow(old, "mortgage").rate, 0.0724, "no guess passed: today's behaviour");
});

test("C2 the grey figure is what is saved, and the settle after the save moves nothing (three walks and a skip-all)", () => {
  const skipAll = jordan(); S.applyOwePicks(skipAll, ["mortgage", "credit", "car-loan"]);
  const walks = [
    ["Jordan", jordan(), { mortgage: { payment: "1,100" } }],
    ["Jordan, the 2010s tap", jordan(), { mortgage: { payment: "1,100", start: "2010s" } }],
    ["Pat and Lee", patLee(), { mortgage: { payment: "1,600" } }],
    ["Sam", sam(), { "car-loan": { payment: 420 }, credit: { owed: "3,000" } }],
    ["every box skipped", skipAll, { mortgage: {}, credit: {}, "car-loan": {} }],
  ];
  for (const [name, p, values] of walks) {
    const grey = oweWithGuesses(p, values);
    assert.ok(Object.keys(grey).length > 0, name);
    for (const [path, want] of Object.entries(grey)) {
      assert.ok(want !== null, `${name}: ${path} has a grey figure`);
      assert.equal(getAt(p, path), want, `${name}: ${path}`);
    }
    const after = structuredClone(p);
    const st = settle(after, GO);
    assert.deepEqual([st.changed, st.dropped], [[], []], `${name}: the settle moves nothing`);
  }
});

test("C2 Skip: use our guesses keeps every picked debt, with our figures (the skip-all walk)", () => {
  const p = jordan(); S.applyOwePicks(p, ["mortgage", "credit", "car-loan"]);
  const before = structuredClone(p);
  S.applyOweAmounts(p, S.valuesFor(p, "owe-amounts"), PERSONA_TODAY, { guess: (k, o) => estimate(before, k, { ...GO, ...o }) });
  const got = (kind) => [Math.abs(acct(p, `setup-owe-${kind}`).balance), debtRow(p, kind).rate, debtRow(p, kind).minPayment];
  // card: SCF card balance at 41 and $58,000 = $1,830 -> $1,800; 1% + 22.4%/12 of it = $51.6 -> $50
  assert.deepEqual(got("credit"), [1800, 0.224, 50]);
  // car loan: SCF vehicle loans $14,306 -> $14,000 (a used car by its size: 11.2%); pmt(11.2%/12, 33.93, 14,000) = $483 -> $480
  assert.deepEqual(got("car-loan"), [14000, 0.112, 480]);
  // mortgage: $110,000 at 4.6% = $563.9 + tax $214.0 + insurance $98.3 = $876 -> $880
  assert.deepEqual(got("mortgage"), [110000, 0.046, 880]);
  assert.equal(acct(p, "setup-have-home").balance, 210000);
  assert.equal(Object.keys(p.guesses).length, 10, "3 boxes x 3 debts + the home");
});

test("C2 typing over a guess makes it yours: its ledger entry goes, and the guesses that read it follow", () => {
  const p = jordan(); S.applyOwePicks(p, ["mortgage", "credit", "car-loan"]);
  oweWithGuesses(p, { mortgage: {}, credit: {}, "car-loan": {} });
  const n = Object.keys(p.guesses).length;
  const values = S.valuesFor(p, "owe-amounts");
  assert.deepEqual([values.mortgage.owed, values.mortgage.payment, values.mortgage.rate, values.mortgage.home], ["", "", "", ""], "a saved guess reopens as a grey figure, never typed text");
  oweWithGuesses(p, { ...values, mortgage: { ...values.mortgage, owed: "150,000" } });
  settle(p, GO);
  assert.equal(Object.keys(p.guesses).length, n - 1);
  assert.equal(isGuess(p, "accounts[setup-owe-mortgage].balance"), false);
  assert.equal(acct(p, "setup-owe-mortgage").balance, 150000);
  // the payment guess reads the typed balance: pmt(4.6%/12, 360, 150,000) = 769.0 + 312.3 = $1,081 -> $1,100
  assert.equal(debtRow(p, "mortgage").minPayment, 1100);
  assert.equal(isGuess(p, "debts[setup-debt-mortgage].minPayment"), true);
  // a rate typed later on What you owe is the person's: going back through Q5b with the box blank keeps it
  debtRow(p, "mortgage").rate = 0.05125; delete p.guesses["debts[setup-debt-mortgage].rate"]; delete debtRow(p, "mortgage").rateGuessed;
  const again = S.valuesFor(p, "owe-amounts");
  assert.equal(again.mortgage.rate, 5.125);
  oweWithGuesses(p, again);
  assert.equal(debtRow(p, "mortgage").rate, 0.05125);
  assert.equal(isGuess(p, "debts[setup-debt-mortgage].rate"), false);
});

test("C2 the start tap is saved with the answers and comes back on the screen", () => {
  const p = jordan();
  oweWithGuesses(p, { mortgage: { payment: 1100, start: "2010s" } });
  assert.deepEqual(p.guide.setup.taps, { "mortgage-start": "2010s" });
  assert.equal(acct(p, "setup-owe-mortgage").balance, 116000, "worked back from the payment since January 2015");
  assert.equal(S.valuesFor(p, "owe-amounts").mortgage.start, "2010s");
});

test("C2 outside the U.S. or not in dollars: Q5b behaves as it did (no figure typed, nothing saved; the typical rate)", () => {
  for (const make of [(p) => { p.guide.setup.outsideUS = true; }, (p) => { p.meta.currency = "EUR"; }]) {
    const a = jordan(); make(a);
    const b = structuredClone(a);
    const values = { mortgage: { payment: "1,100" }, credit: { owed: 900 } };
    S.applyOwePicks(a, ["mortgage", "credit"]); S.applyOwePicks(b, ["mortgage", "credit"]);
    S.applyOweAmounts(a, values, PERSONA_TODAY);
    oweWithGuesses(b, values);
    assert.deepEqual(b, a);
    assert.equal(b.guesses, undefined);
  }
});

test("C2 Pat and Lee: the blank mortgage is counted on net worth, Timeline, Next best action and Pay off debts", () => {
  const spend = { mode: "rows", rows: { housing: 120, utilities: 560, groceries: 780, transport: 960, insurance: 910, dining: 1000, shopping: 930 } };
  const old = patLee(); S.applyOweAmounts(old, { mortgage: { payment: "1,600" } }, PERSONA_TODAY); S.applySpend(old, spend);
  const p = patLee(); oweWithGuesses(p, { mortgage: { payment: "1,600" } }); S.applySpend(p, spend);
  const o = { today: PERSONA_TODAY };
  // they owe more than $100,000: $450,000 x Arizona's loan-to-value 47.6% = $214,200 -> $210,000
  assert.equal(acct(p, "setup-owe-mortgage").balance, 210000);
  assert.ok(acct(p, "setup-owe-mortgage").balance > 100000);
  // net worth was overstated by the whole mortgage: $978,000 -> $768,000, "partly our guesses"
  assert.equal(netWorth(old, o).netWorth, 978000);
  const nw = netWorth(p, o);
  assert.equal(nw.netWorth, 768000);
  assert.deepEqual([nw.guessedAssets, nw.guessedLiabilities, nw.partlyGuessed], [0, 210000, true]);
  // Timeline was "debt-free now"
  assert.equal(timeline(old, o).headline.debtFreeYear, null);
  assert.equal(timeline(p, o).headline.debtFreeYear, 2041);
  // Pay off debts had nothing to pay off
  assert.deepEqual(payoff(old, o).debts, []);
  assert.deepEqual(payoff(p, o).debts.map((d) => [d.name, d.balance, d.minPayment]), [["Mortgage", 210000, 1600]]);
  // Next best action: the $1,600 a month is spoken for (spending $5,260 -> $6,860)
  const before = nextBest(old, o).spare, after = nextBest(p, o).spare;
  assert.equal(after.spending - before.spending, 1600);
  near(before.monthly - after.monthly, 1600, 0.01);
});

test("C2 the done screen: net worth partly our guesses, the guessed debts listed, the debts answer counts them", () => {
  const j = jordan(); oweWithGuesses(j, { mortgage: { payment: 1100 } });
  const st = S.standing(j, { today: PERSONA_TODAY });
  assert.equal(st.netWorth, 100000, "home $210,000 - mortgage $110,000, both our guesses");
  assert.equal(st.netWorthGuessed, true);
  assert.deepEqual(st.guessed.find((g) => g.name === "Mortgage"), { name: "Mortgage", rate: 0.046, payment: null, owed: 110000 });
  assert.deepEqual(S.reflect(j, "owe-amounts"), { kind: "owe", total: 110000, guessed: 1, of: 1 });
  // Sam: the card balance typed, the car loan's ours
  const s = sam(); oweWithGuesses(s, { "car-loan": { payment: 420 }, credit: { owed: "3,000" } });
  const ss = S.standing(s, { today: PERSONA_TODAY });
  assert.deepEqual(ss.guessed.map((g) => [g.name, g.owed ?? null, g.payment]), [["Credit cards", null, 90], ["Car loan", 12000, null]]);
  assert.equal(netWorth(s, { today: PERSONA_TODAY }).netWorth, -13000, "$2,000 in the bank - $3,000 - $12,000");
  // a plan with every figure typed carries none of the new keys
  const f = family();
  assert.equal("netWorthGuessed" in S.standing(f, { today: T }), false);
  assert.equal("guessed" in S.reflect(f, "owe-amounts"), false);
});

// ---- C2 review (money): odd inputs on Q5b
test("C2 review: a 0 typed in Still owed is the person's: no debt, no guess (as before the guesses)", () => {
  const p = jordan(); const grey = oweWithGuesses(p, { mortgage: { owed: "0" } });
  assert.equal(acct(p, "setup-owe-mortgage"), undefined);
  assert.equal(grey["accounts[setup-owe-mortgage].balance"], undefined, "a box holding 0 shows no grey figure");
  assert.equal(p.guesses?.["accounts[setup-owe-mortgage].balance"], undefined);
  // a $0 payment typed (a loan on hold) is kept as typed, not replaced by our guess
  const s = sam(); oweWithGuesses(s, { "car-loan": { owed: 8000, payment: "0" } });
  assert.equal(debtRow(s, "car-loan").minPayment, 0);
  assert.equal(isGuess(s, "debts[setup-debt-car-loan].minPayment"), false);
});

test("C2 review: a higher mortgage payment never means less still owed (no cliff at the usual tax and insurance)", () => {
  let last = -1;
  for (const pay of [100, 200, 300, 312, 313, 320, 350, 400, 500, 600, 625, 700, 800, 1100]) {
    const p = jordan(); oweWithGuesses(p, { mortgage: { payment: pay } });
    const owed = acct(p, "setup-owe-mortgage").balance;
    assert.ok(owed >= last, `${pay} a month: ${owed} after ${last}`);
    last = owed;
  }
  // Jordan's 7.H key is unchanged: 1,100 - 312 = 788 is more than half the payment
  const j = jordan(); oweWithGuesses(j, { mortgage: { payment: 1100 } });
  assert.equal(acct(j, "setup-owe-mortgage").balance, 110000);
});

test("C2 review: a start tap with a blank payment never makes a steep payment on a typical balance", () => {
  // car loan "5 or more years ago", payment blank: the typical 13,000 over half a usual term, not over 6 months (2,250)
  const s = sam(); S.applyOwePicks(s, ["car-loan"]); oweWithGuesses(s, { "car-loan": { start: "5+" } });
  assert.ok(debtRow(s, "car-loan").minPayment < 600, `${debtRow(s, "car-loan").minPayment}`);
  const j = jordan(); oweWithGuesses(j, { mortgage: { start: "pre2010" } });
  assert.equal(debtRow(j, "mortgage").minPayment, 880, "the typical 110,000 over 30 years plus tax and insurance");
  // a balance typed with the tap still uses the months the tap leaves
  const t = jordan(); oweWithGuesses(t, { mortgage: { owed: 60000, start: "pre2010" } });
  assert.ok(debtRow(t, "mortgage").minPayment > 800);
});

test("C2 review: a card's usual minimum is never more than what is owed, after rounding", () => {
  for (const owed of [20, 25, 28, 35, 39, 45, 1400, 3000]) {
    const s = sam(); S.applyOwePicks(s, ["credit"]); oweWithGuesses(s, { credit: { owed } });
    assert.ok(debtRow(s, "credit").minPayment <= owed, `${owed}: ${debtRow(s, "credit").minPayment}`);
  }
  const s = sam(); oweWithGuesses(s, { "car-loan": { payment: 420 }, credit: { owed: "3,000" } });
  assert.equal(debtRow(s, "credit").minPayment, 90, "Sam's 7.H card payment");
});

test("C2 review: the home Q5b guessed stays a grey box on Q5b (never 'from question 4')", () => {
  const j = jordan(); oweWithGuesses(j, { mortgage: { payment: 1100 } });
  assert.equal(S.askHomeWithMortgage(j), true);
  assert.equal(S.valuesFor(j, "owe-amounts").mortgage.home, "");
  oweWithGuesses(j, S.valuesFor(j, "owe-amounts"));
  assert.equal(acct(j, "setup-have-home").balance, 210000);
  assert.equal(isGuess(j, "accounts[setup-have-home].balance"), true);
  const t = jordan(); oweWithGuesses(t, { mortgage: { payment: 1100 } });
  const tv = S.valuesFor(t, "owe-amounts");
  oweWithGuesses(t, { ...tv, mortgage: { ...tv.mortgage, home: "250,000" } });
  assert.equal(acct(t, "setup-have-home").balance, 250000);
  assert.equal(isGuess(t, "accounts[setup-have-home].balance"), false);
  assert.equal(S.askHomeWithMortgage(t), false, "typed: back to the line");
});

test("C2 review: tax and insurance typed on Home move the mortgage guesses (settle)", () => {
  const j = jordan(); oweWithGuesses(j, { mortgage: { payment: 900 } });
  assert.equal(acct(j, "setup-owe-mortgage").balance, 110000, "900 - Ohio's usual 312 = 588: pv = 114,700, so the 111,000 prior");
  j.property = [{ id: "h1", kind: "home", accountId: "setup-have-home", name: "Home", value: 210000, propertyTax: 3600, insurance: 1200 }];
  settle(j, GO);
  // P&I = 900 - 300 - 100 = 500; pv(4.6%/12, 360, 500) = 97,537 -> 98,000
  assert.equal(acct(j, "setup-owe-mortgage").balance, 98000);
  const k = jordan(); oweWithGuesses(k, { mortgage: {} });
  k.property = [{ id: "h1", kind: "home", accountId: "setup-have-home", name: "Home", value: 210000, propertyTax: 6000, insurance: 2400 }];
  settle(k, GO);
  // pmt(4.6%/12, 360, 110,000) = 563.9 + 700 = 1,263.9 -> 1,250
  assert.equal(debtRow(k, "mortgage").minPayment, 1250);
});

// ---- C2 fixes after the two reviews (est/c2/c2-fix.md): each written before its fix and failing on C2 as built
test("C2 fix (D1): a $0 payment typed stays the person's when Q5b is opened again and saved", () => {
  const s = sam(); oweWithGuesses(s, { "car-loan": { owed: 8000, payment: "0" } });
  const again = S.valuesFor(s, "owe-amounts");
  assert.equal(again["car-loan"].payment, 0, "the box reopens holding the 0 typed, not empty with our grey figure");
  oweWithGuesses(s, again);
  assert.equal(debtRow(s, "car-loan").minPayment, 0);
  assert.equal(isGuess(s, "debts[setup-debt-car-loan].minPayment"), false);
  // a plan with no guesses reads as before: a $0 payment there is still shown blank and filled with the typical one
  const old = sam(); S.applyOweAmounts(old, { "car-loan": { owed: 8000, payment: "0" } }, PERSONA_TODAY);
  assert.ok(debtRow(old, "car-loan").minPayment > 0);
});

test("C2 fix (D6): question 4b shows our guessed home grey (never typed text) and keeps it when its box stays empty", () => {
  const j = jordan(); oweWithGuesses(j, { mortgage: { payment: 1100 } });
  const v = S.valuesFor(j, "have-amounts");
  assert.equal(v.home, "", "a saved guess reopens empty (the screen draws it grey)");
  S.applyHaveAmounts(j, v, PERSONA_TODAY);
  assert.equal(acct(j, "setup-have-home").balance, 210000, "Continue with the box empty keeps our guess, so the mortgage never stands alone");
  assert.equal(isGuess(j, "accounts[setup-have-home].balance"), true);
  // typed, even the same figure, it is the person's
  S.applyHaveAmounts(j, { ...v, home: "210,000" }, PERSONA_TODAY);
  assert.equal(acct(j, "setup-have-home").balance, 210000);
  assert.equal(isGuess(j, "accounts[setup-have-home].balance"), false);
  // and with no guesses at all, an empty home box still drops the home as before
  const p = patLee(); S.applyHaveAmounts(p, { ...S.valuesFor(p, "have-amounts"), home: "" }, PERSONA_TODAY);
  assert.equal(acct(p, "setup-have-home"), undefined);
});

test("C2 fix (D8): a plan from before the guesses keeps one mortgage payment when it goes back through Q5b", () => {
  // made before C2: the mortgage was dropped (no balance typed), so Q6's housing row was asked and named "Rent"
  const j = jordan(); S.applyOweAmounts(j, { mortgage: { payment: "1,100" } }, PERSONA_TODAY);
  S.applySpend(j, { mode: "rows", rows: { housing: 1100, groceries: 600 } });
  assert.equal(expenses(j, { today: PERSONA_TODAY }).monthly, 1700);
  // back through Q5b with C2, leaving everything as it is: the mortgage is kept with our $880 payment
  oweWithGuesses(j, S.valuesFor(j, "owe-amounts"));
  assert.equal(debtRow(j, "mortgage").minPayment, 880);
  assert.equal(j.expenses.find((x) => x.id === "setup-x-housing").name, "Rent or mortgage");
  assert.equal(expenses(j, { today: PERSONA_TODAY }).monthly, 1700, "the $1,100 typed under housing is the mortgage payment, counted once");
  // question 6 answered again, now asked as the costs besides the mortgage: $120 of them, and the $880 counts from Debts
  S.applySpend(j, { mode: "rows", rows: { housing: 120, groceries: 600 } });
  assert.equal(j.expenses.find((x) => x.id === "setup-x-housing").name, "Home costs");
  assert.equal(expenses(j, { today: PERSONA_TODAY }).monthly, 1600);
});

test("C2 fix: a mortgage payment typed that fits the typical balance says so (it was read, not ignored)", () => {
  const j = jordan(); const grey = oweWithGuesses(j, { mortgage: { payment: 1450 } });
  const est = estimate(jordan(), "debt.mortgage.owed", { ...GO, path: "accounts[setup-owe-mortgage].balance", args: S.oweArgs(jordan(), { payment: 1450 }, "mortgage", { askHome: true }) });
  assert.equal(grey["accounts[setup-owe-mortgage].balance"], est.value);
  assert.match(est.why, /your payment covers it/);
  assert.ok(est.why.length <= 70, est.why);
  // the payment worked back still names it: $300 is far below what the typical balance needs
  const low = estimate(jordan(), "debt.mortgage.owed", { ...GO, path: "accounts[setup-owe-mortgage].balance", args: S.oweArgs(jordan(), { payment: 300 }, "mortgage", { askHome: true }) });
  assert.match(low.why, /worked back from your \$300 payment/);
});
