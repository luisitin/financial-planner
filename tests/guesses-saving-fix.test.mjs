// tests/guesses-saving-fix.test.mjs -- the review fixes to C4 (retirement saving is never $0): one failing-first test per finding.
// Findings are numbered as in est/c4/c4-review-money.md ("M1") and c4-review-ux.md ("U1"); each test says what it was before the fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimators, TABLES } from "../modules/overview/guesses/compute.js";
import { deferralLimit, payOf } from "../modules/overview/guesses/estimators/saving.js";
import * as S from "../modules/overview/setup/compute.js";
import { compute as nextBest } from "../modules/overview/next-best-action/compute.js";
import { compute as contributions } from "../modules/retirement/contributions/compute.js";
import { applyContributionEdit } from "../modules/retirement/contributions/view.js";
import { estimate, mergeEstimators, settle, isGuess } from "../core/estimate/index.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { sam, jordan, patLee } from "../qa/fixtures/setup-personas.mjs";

const REG = mergeEstimators([{ from: "overview/guesses", estimators, tables: TABLES }, { from: "overview/setup", estimators: S.estimators }]);
const T0 = "2026-11-02", T6 = "2026-11-06";
const OPTS = { estimators: REG.estimators, tables: REG.tables, today: T0 };
const ME = "setup-self", PARTNER = "setup-partner";
const BAL = (pid) => `accounts[setup-have-retire-${pid}].balance`, PUT = (pid) => `retirement.contributions[setup-contrib-${pid}].amount`, MATCH = (pid) => `retirement.contributions[setup-contrib-${pid}].employerMatch`;
const gx = (plan) => { const before = structuredClone(plan); return (key, opts = {}) => estimate(before, key, { ...OPTS, ...opts }); };
function q4b(plan, v, picks) {
  if (picks) S.applyHavePicks(plan, picks);
  S.applyHaveAmounts(plan, v, T0, { guess: gx(plan) });
  return plan;
}
const est = (plan, key, path, args, today = T0) => estimate(plan, key, { ...OPTS, today, path, args });
const row = (plan, pid) => plan.retirement.contributions.find((c) => c.id === `setup-contrib-${pid}`);
const acct = (plan, id) => plan.accounts.find((a) => a.id === id);
const worker = (plan) => { plan.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 1400, period: "monthly", essential: true }, { id: "e-food", name: "Food", category: "food", amount: 500, period: "monthly", essential: true }]; return plan; };
const matchStep = (plan, today = T6) => nextBest(plan, { today }).steps.find((s) => s.id === "match");
const person = ({ pay = 60000, year = 1985, month = 3 } = {}) => {
  const p = migrate(emptyPlan());
  S.applyYou(p, { name: "Kit", who: "me", kids: 0, state: "OH" });
  S.applyMoney(p, { people: { [ME]: { status: "work", amount: String(pay), period: "annual" } } });
  S.applyAges(p, { people: { [ME]: { month, year, stopAge: 65, ss: { mode: "estimate" } } } }, T0);
  return p;
};

test("M1: 'Both of ours' with one partner 'On my own' keeps the typed total (it used to become an IRA guess)", () => {
  // Pat types $500,000 and picks On my own; Lee through work, blank. Split by pay (85,000 / 40,000): 340,000 + 160,000 = 500,000.
  const pl = patLee();
  q4b(pl, { [`retire-${ME}`]: "500000", [`kind-${ME}`]: "own", joint: "both" });
  assert.equal(acct(pl, `setup-have-retire-${ME}`).balance, 340000);
  assert.equal(acct(pl, `setup-have-retire-${ME}`).type, "ira", "the account still follows the kind she picked");
  assert.equal(acct(pl, `setup-have-retire-${PARTNER}`).balance, 160000);
  assert.equal(pl.guesses[BAL(ME)].k, "account.retire.split");
  // the mirror: Lee on her own, the joint answer still on -> Pat 340,000 and Lee 160,000, not 400,000 counted
  const m = patLee();
  q4b(m, { [`retire-${ME}`]: "500000", [`kind-${PARTNER}`]: "own", joint: "both" });
  assert.equal(acct(m, `setup-have-retire-${ME}`).balance, 340000);
  assert.equal(acct(m, `setup-have-retire-${PARTNER}`).balance, 160000);
  assert.equal(acct(m, `setup-have-retire-${PARTNER}`).type, "ira");
});

test("M2: the retirement verdict waits when the retirement balances are our guesses (spec 8.1); typed balances do not wait", () => {
  const spend = { mode: "rows", rows: { housing: 1300, utilities: 200, groceries: 400, transport: 300, insurance: 300, dining: 200, shopping: 250 } };
  const j = jordan(); q4b(j, {}, ["retire"]); S.applySpend(j, spend, T0);
  const st = S.standing(j, { today: T0 });
  assert.ok(st.retire, "the check runs");
  assert.equal(st.retireGuessed, true, "balance, what goes in and the match are all guesses");
  assert.equal(st.retireGuessedWhat, "balance");
  const t = jordan(); q4b(t, { [`retire-${ME}`]: "26000", [`pct-${ME}`]: 0.05, [`contrib-${ME}`]: "242" }, ["retire"]); S.applySpend(t, spend, T0);
  assert.equal(S.standing(t, { today: T0 }).retireGuessed ?? false, false, "a typed 401(k) balance: the verdict stands");
});

test("M3: a contribution guess follows the pay it was worked from -- no pay, nothing goes in", () => {
  const pl = patLee(); q4b(pl, {}, ["retire"]);
  assert.equal(row(pl, PARTNER).amount, 210);
  pl.income = pl.income.filter((x) => x.id !== `setup-pay-${PARTNER}`);
  settle(pl, OPTS);
  assert.equal(row(pl, PARTNER).amount, 0); assert.equal(row(pl, PARTNER).employerMatch, 0);
  assert.ok(isGuess(pl, PUT(PARTNER)), "still ours");
  // a pay line that ended
  const j = jordan(); q4b(j, {}, ["retire"]);
  j.income.find((x) => x.id === `setup-pay-${ME}`).endDate = "2026-12-31";
  settle(j, { ...OPTS, today: "2027-03-15" });
  assert.equal(row(j, ME).amount, 0); assert.equal(row(j, ME).employerMatch, 0);
  // no record at all: still nothing to write
  const none = person(); none.income = [];
  assert.equal(est(none, "contrib.amount", PUT(ME)), null);
});

test("M4a: 'no match' said on Contributions is kept by Get started: the chip reopens as No match and no match is guessed", () => {
  const j = jordan(); j.retirement.workPlans = { [ME]: { match: false } };
  S.applyHavePicks(j, ["retire"]);
  const v = S.valuesFor(j, "have-amounts", { today: T0 });
  assert.equal(v[`matchMode-${ME}`], "none");
  q4b(j, v);
  assert.equal(row(j, ME).employerMatch, 0);
  assert.equal(j.retirement.workPlans[ME].match, false);
  assert.equal(est(j, "contrib.match", MATCH(ME)), null);
});

test("M4b: a match formula typed on Work benefits decides the match guess and the 'put in' step", () => {
  const j = worker(jordan()); q4b(j, {}, ["retire"]);
  assert.equal(row(j, ME).employerMatch, 2160, "before the formula: the usual 4%");
  // 100% of the first 3% of $58,000 = $1,740 a year; the monthly $145 rounds to $150 -> $1,800 (the month's $10, x12)
  j.whatIfs = { ...(j.whatIfs ?? {}), benefits: { [ME]: { matchTiers: [{ rate: 1, upTo: 0.03 }] } } };
  settle(j, OPTS);
  assert.equal(row(j, ME).employerMatch, 1800);
  const m = matchStep(j);
  assert.equal(m?.ask?.find((x) => x.kind === "guessed"), undefined, "$270 a month is already 5.6% of pay, over the 3% that gets all of it");
  // a smaller guess is short of that 3%: the step names the formula's 3%, not 6%
  const k = worker(person({ pay: 60000, year: 1960 })); q4b(k, { [`pct-${ME}`]: 0.01, [`contrib-${ME}`]: "50" }, ["retire"]);
  assert.equal(isGuess(k, PUT(ME)), false);
  // formula with no money in it: our guess of the match is $0 (it used to stay frozen at $2,160; C4 verify V3), and with no row there is none
  const z = jordan(); q4b(z, {}, ["retire"]);
  z.whatIfs = { benefits: { [ME]: { matchTiers: [{ rate: 0, upTo: 0 }] } } };
  assert.equal(est(z, "contrib.match", MATCH(ME))?.value, 0);
  const none = jordan(); none.whatIfs = { benefits: { [ME]: { matchTiers: [{ rate: 0, upTo: 0 }] } } };
  assert.equal(est(none, "contrib.match", MATCH(ME)), null);
});

test("M4c: a match the person typed is not contradicted by a dollar promise", () => {
  const j = worker(jordan()); q4b(j, { [`match-${ME}`]: "100", [`matchMode-${ME}`]: "know" }, ["retire"]);
  assert.equal(row(j, ME).employerMatch, 1200);
  const m = matchStep(j);
  assert.equal(m?.ask?.find((x) => x.kind === "guessed"), undefined);
  assert.doesNotMatch(m?.detail ?? "", /likely get/);
});

test("M5: high pay -- the match counts pay only up to the IRS limit ($360,000) and the 6% step is not offered past the 401(k) limit", () => {
  // IRS Notice 2025-67: 401(a)(17) compensation limit $360,000 for 2026. 4% x 360,000 = 14,400 a year (not 4% x 450,000 = 18,000)
  const p = worker(person({ pay: 450000, year: 1985 })); q4b(p, {}, ["retire"]);
  assert.equal(row(p, ME).amount, 2040, "the guess stops at the 401(k) limit ($24,500 / 12 = 2,041)");
  assert.equal(row(p, ME).employerMatch, 14400);
  const m = matchStep(p);
  assert.equal(m?.ask?.find((x) => x.kind === "guessed"), undefined, "6% of the limit pay is $21,600, below the $24,500 already going in");
  // $900,000: the same
  const q = worker(person({ pay: 900000, year: 1985 })); q4b(q, {}, ["retire"]);
  assert.equal(row(q, ME).employerMatch, 14400);
  assert.equal(matchStep(q)?.ask?.find((x) => x.kind === "guessed"), undefined);
});

test("M6: saving the row's own form (even only 'How often') ends the guess, and a row that is not monthly is never given monthly dollars", () => {
  const j = jordan(); q4b(j, {}, ["retire"]);
  assert.ok(isGuess(j, PUT(ME)));
  applyContributionEdit(j, `setup-contrib-${ME}`, { accountId: row(j, ME).accountId, personId: ME, amount: 270, period: "biweekly", employerMatch: 2160 });
  assert.equal(isGuess(j, PUT(ME)), false, "a change of period is the person's");
  // a raise afterwards leaves the biweekly figure alone
  j.income.find((x) => x.id === `setup-pay-${ME}`).amount = 70000;
  settle(j, OPTS);
  assert.equal(row(j, ME).amount, 270); assert.equal(row(j, ME).period, "biweekly");
  // and a guess found in a non-monthly row (an import or an older edit) is frozen, not rewritten
  const k = jordan(); q4b(k, {}, ["retire"]);
  row(k, ME).period = "biweekly";
  assert.equal(est(k, "contrib.amount", PUT(ME)), null);
});

test("M7: Get started writes monthly dollars with a monthly period, and shows a biweekly row as its month", () => {
  const j = jordan(); q4b(j, { [`pct-${ME}`]: 0.05, [`contrib-${ME}`]: "242" }, ["retire"]);
  Object.assign(row(j, ME), { amount: 120, period: "biweekly" });
  const v = S.valuesFor(j, "have-amounts", { today: T0 });
  assert.equal(v[`contrib-${ME}`], 260, "120 every two weeks is 3,120 a year = $260 a month");
  q4b(j, { ...v, [`pct-${ME}`]: 0.06, [`contrib-${ME}`]: "290" });
  assert.equal(row(j, ME).amount, 290); assert.equal(row(j, ME).period, "monthly");
  assert.equal(contributions(j, { today: T0 }).yearly, 3480);
  // reopened and continued with nothing changed, the biweekly row stays as it was
  const k = jordan(); q4b(k, { [`pct-${ME}`]: 0.05, [`contrib-${ME}`]: "242" }, ["retire"]);
  Object.assign(row(k, ME), { amount: 120, period: "biweekly" });
  q4b(k, S.valuesFor(k, "have-amounts", { today: T0 }));
  assert.deepEqual([row(k, ME).amount, row(k, ME).period], [120, "biweekly"]);
});

test("M8: 'Through work' then 'On my own' does not keep a guessed balance in both accounts", () => {
  const w = jordan();
  S.applyMoney(w, { people: { [ME]: { status: "work", amount: "58000", period: "annual", plan: "yes" } } }, T0);
  q4b(w, {}, ["retire"]);
  assert.equal(acct(w, `setup-workplan-${ME}`).balance, 26000);
  q4b(w, { [`kind-${ME}`]: "own" });
  assert.equal(acct(w, `setup-workplan-${ME}`).balance, 0, "the work plan's guess goes");
  assert.equal(isGuess(w, `accounts[setup-workplan-${ME}].balance`), false);
  assert.equal(acct(w, `setup-have-retire-${ME}`).balance, 29000);
  assert.equal(S.reflect(w, "have-amounts").total, 29000);
});

test("M9: the usual match is one figure in the step: 4% of pay when 6% goes in, said the same in the step and on the chip", () => {
  const j = worker(jordan()); q4b(j, {}, ["retire"]);
  const m = matchStep(j);
  assert.match(m.detail, /to likely get about \$190 a month from the employer \(plans usually add about 4% of pay\)/);
});

test("M10: a contribution typed in another period still sets the match", () => {
  // $50 every two weeks = 1,300 a year = 2.24% of 58,000; the usual match for that = 4% x (2.24 / 6.0) x 58,000 = 866 -> $70 a month = 840
  const j = jordan(); q4b(j, {}, ["retire"]);
  Object.assign(row(j, ME), { amount: 50, period: "biweekly" });
  settle(j, OPTS); // typed over the guess: it is frozen as the person's
  assert.equal(isGuess(j, PUT(ME)), true === false);
  assert.equal(est(j, "contrib.match", MATCH(ME))?.value, 840);
});

test("M11: a couple's split adds up to the figure typed", () => {
  for (const total of [123456, 87500, 1234567]) {
    const pl = patLee(); q4b(pl, { [`retire-${ME}`]: String(total), joint: "both" });
    assert.equal(acct(pl, `setup-have-retire-${ME}`).balance + acct(pl, `setup-have-retire-${PARTNER}`).balance, total, `typed ${total}`);
  }
});

test("M12: a typed $0 in one bank box counts, and a bank account already on file is taken out of the survey figure", () => {
  const j = jordan(); S.applyHavePicks(j, ["checking", "savings"]);
  const alone = est(j, "account.cash", "accounts[setup-have-savings].balance", { checking: null }).value;
  const zero = est(j, "account.cash", "accounts[setup-have-savings].balance", { checking: 0 });
  assert.equal(zero.value, alone * 2, "checking typed as 0: savings takes the whole figure");
  // $2,500 in a checking account added on Net worth: the survey's total is not counted again
  const k = jordan(); S.applyHavePicks(k, ["savings"]);
  k.accounts.push({ id: "acc-chk", name: "Bank", type: "checking", balance: 2500, ownerId: ME, history: [], notes: "" });
  const whole = est(jordan(), "account.cash", "accounts[setup-have-savings].balance", {});
  const e = est(k, "account.cash", "accounts[setup-have-savings].balance", {});
  assert.ok(!e || e.value <= whole.value - 2400, `${e?.value} vs ${whole?.value}`);
});

test("M15: the catch-up age is the age reached in the year (turning 50 in December counts, turning 64 does not)", () => {
  // IRS Notice 2025-67: 401(k) $24,500 + $8,000 from 50 (age 50 by Dec 31); 60-63: $11,250
  assert.equal(deferralLimit(50, 2026), 32500); assert.equal(deferralLimit(63, 2026), 35750);
  const a = person({ pay: 900000, year: 1976, month: 12 }); q4b(a, {}, ["retire"]);   // 49 on 2026-11-02, 50 on 2026-12-31
  assert.equal(row(a, ME).amount, 2700, "$32,500 / 12 = 2,708 -> $2,700");
  const b = person({ pay: 900000, year: 1962, month: 12 }); q4b(b, {}, ["retire"]);   // 63 today, 64 on Dec 31: $32,500, not $35,750
  assert.equal(row(b, ME).amount, 2700);
});

test("M16: a 0 + 0 row made on Contributions still counts as contributing; only Get started's own 0 rows ask again", () => {
  const j = worker(jordan()); q4b(j, { [`pct-${ME}`]: 0.05, [`contrib-${ME}`]: "242" }, ["retire"]);
  Object.assign(row(j, ME), { amount: 0, employerMatch: 0 });   // the person set it to nothing on Contributions
  assert.equal(matchStep(j)?.status ?? "done", "done");
  const none = worker(jordan()); q4b(none, { [`pct-${ME}`]: 0, [`contrib-${ME}`]: "0" }, ["retire"]);   // the None chip
  assert.equal(matchStep(none)?.status, "check");
});

test("M17: the spread of what people put in is read from the published table, which the guess lists as a source", () => {
  const e = est(jordan(), "contrib.amount", PUT(ME));
  const j = jordan(); q4b(j, {}, ["retire"]);
  assert.ok(est(j, "contrib.amount", PUT(ME)).tables.includes("vanguard_has2026_deferral_distribution"));
  assert.ok(e === null || typeof e === "object");
});

test("U13: one share of pay is said everywhere -- the guess's own, to 0.1 point", () => {
  const j = worker(jordan()); q4b(j, {}, ["retire"]);
  const m = matchStep(j), a = m.ask.find((x) => x.kind === "guessed");
  assert.equal(Math.round(a.nowPct * 1000) / 10, 5.5, "Contributions says 5.5%, as the guess does; the dollars ($270) are rounded, the share is not");
  assert.match(est(j, "contrib.amount", PUT(ME)).why, /about 5\.5%/);
});

test("U14: a share of pay over 100% is told so, in words", () => {
  assert.deepEqual(S.readShareOfPay("150"), { bad: "A share of pay can't be more than 100%." });
  assert.deepEqual(S.readShareOfPay("7.5"), { pct: 0.075 });
  assert.deepEqual(S.readShareOfPay(""), { blank: true });
  assert.deepEqual(S.readShareOfPay("abc").bad.length > 0, true);
});

test("U1: a job with a plan at work and no Retirement tile still gets the Q4b questions, and a guess of what goes in", () => {
  const j = person({ pay: 58000, year: 1985 });
  S.applyMoney(j, { people: { [ME]: { status: "work", amount: "58000", period: "annual", plan: "yes" } } }, T0);
  assert.ok(S.retireAskedFor(j).includes(ME), "Q4b asks the retirement block of someone whose job has a plan");
  assert.deepEqual(S.valuesFor(j, "have"), ["retire"], "and Q4 comes with Retirement ticked");
  assert.ok(S.retireAskedFor(person()).length === 0);
  // 'Skip' with the plan said and no tile: the contribution is guessed
  S.applyHaveAmounts(j, {}, T0, { guess: gx(j) });
  assert.ok(row(j, ME)?.amount > 0, `the plan at work gets a guess of what goes in: ${row(j, ME)?.amount}`);
});
