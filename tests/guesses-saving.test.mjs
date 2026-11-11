// tests/guesses-saving.test.mjs -- C4 of the smart-guesses build: retirement saving is never $0 (spec 7.B, 7.H, 10 Q4b, 14.3-14.4).
// The estimators E12-E17 and E40 (modules/overview/guesses/estimators/saving.js), Get started's Q4b with our guesses
// (applyHaveAmounts with { guess }: the chips, the couple's "both of ours", the slip question, the account always made),
// Next best action's match step words, Contributions' "6%", and batch 3's UX 6 (a plan said at Get started is not "a job left").
// The three walks are the invented households of qa/fixtures/setup-personas.mjs; every figure has its arithmetic in a comment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimators, TABLES } from "../modules/overview/guesses/compute.js";
import { vanguardBalance, deferralRate, participation, deferralSigma, deferralLimit, matchTerms, payOf, VG_PAY_CENTRES } from "../modules/overview/guesses/estimators/saving.js";
import * as S from "../modules/overview/setup/compute.js";
import { compute as nextBest } from "../modules/overview/next-best-action/compute.js";
import { readAmountOrShare } from "../modules/retirement/contributions/view.js";
import { estimate, mergeEstimators, settle, isGuess, clearGuess } from "../core/estimate/index.js";
import { typoCheck } from "../core/math/estimate.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { sam, jordan, patLee } from "../qa/fixtures/setup-personas.mjs";

const REG = mergeEstimators([{ from: "overview/guesses", estimators, tables: TABLES }, { from: "overview/setup", estimators: S.estimators }]);
const T0 = "2026-11-02";
const OPTS = { estimators: REG.estimators, tables: REG.tables, today: T0 };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""}: ${a} vs ${b}`);
const ME = "setup-self", PARTNER = "setup-partner";
const BAL = (pid) => `accounts[setup-have-retire-${pid}].balance`, PUT = (pid) => `retirement.contributions[setup-contrib-${pid}].amount`, MATCH = (pid) => `retirement.contributions[setup-contrib-${pid}].employerMatch`;
/** ctx.guess for a plan: the plan as it was before the save (the view's store.get()). */
const gx = (plan) => { const before = structuredClone(plan); return (key, opts = {}) => estimate(before, key, { ...OPTS, ...opts }); };
/** Q4b answered through the apply function with our guesses (the view's own call). */
function q4b(plan, v, picks) {
  if (picks) S.applyHavePicks(plan, picks);
  S.applyHaveAmounts(plan, v, T0, { guess: gx(plan) });
  return plan;
}
const est = (plan, key, path, args) => estimate(plan, key, { ...OPTS, path, args });
const row = (plan, pid) => plan.retirement.contributions.find((c) => c.id === `setup-contrib-${pid}`);
const acct = (plan, id) => plan.accounts.find((a) => a.id === id);

// ---- E12: a 401(k) balance by pay and age
test("E12 7.H: a 401(k) through work is $3,400 at 24 on $48,000, $27,000 at 41 on $58,000 and $28,000 at 59 on $40,000", () => {
  // R2 on Vanguard (end of 2025): everyone's median $44,115 x the pay ratio x the age ratio left once the age group's typical pay is
  // taken out. The age ratio is read on straight lines of the log between the groups' middles (22, 30, 40, 50, 60, 70; guess-sanity
  // sr.saving.no-cliff, 2026-11-07): Sam at 24 is a little over a quarter of the way from the <25 group ($2,234) to 25-34, so
  // $3,364.3 (the band-exact $3,064.9 before); Jordan at 41 $27,357.8; Lee at 59 $28,343.6
  const s = vanguardBalance({ pay: 48000, age: 24 });
  near(s.value, 3364.3, 0.5, "Sam");
  near(s.sigma, 1.535, 0.001, "spread from the group's average $7,259 over its median $2,234: sqrt(2 ln 3.25)");
  near(vanguardBalance({ pay: 58000, age: 41 }).value, 27357.8, 0.5, "Jordan");
  near(vanguardBalance({ pay: 40000, age: 59 }).value, 28343.6, 0.5, "Lee");
  // the rounded figures (R11: two figures, the spread is above 0.15)
  const sam0 = sam(); S.applyHavePicks(sam0, ["retire"]);
  const e = est(sam0, "account.retire.balance", BAL(ME));
  assert.equal(e.value, 3400);
  assert.deepEqual([e.low, e.high], [1200, 9500], "7.H: the middle half $1,200 to $9,500");
  assert.equal(e.why, "typical in a work plan at 24 on your pay");
  assert.ok(e.why.length <= 70);
  const jo = jordan(); S.applyHavePicks(jo, ["retire"]);
  assert.equal(est(jo, "account.retire.balance", BAL(ME)).value, 27000);
  const pl = patLee(); S.applyHavePicks(pl, ["retire"]);
  assert.equal(est(pl, "account.retire.balance", BAL(PARTNER)).value, 28000);
});

test("E12: a missing pay or age falls back to the next row down, and a pay at a band edge moves the guess by almost nothing", () => {
  // no pay: the age group's own median ($2,234 at 24); no age: the pay ratio alone; neither: everyone's median ($44,115)
  near(vanguardBalance({ age: 24 }).value, 3801.5, 0.5);   // the <25 group's $2,234 and 25-34's, on the log line at 24
  near(vanguardBalance({ pay: 58000 }).value, 26089.3, 0.5, "pay alone");
  assert.equal(vanguardBalance({}).value, 44115);
  // monotone: a higher pay never lowers it
  let last = 0;
  for (let pay = 5000; pay <= 400000; pay += 2500) { const v = vanguardBalance({ pay, age: 41 }).value; assert.ok(v >= last - 1e-6, `pay ${pay}`); last = v; }
  // a $1 change at a band edge ($50,000) moves it by under 0.1%
  const a = vanguardBalance({ pay: 49999, age: 41 }).value, b = vanguardBalance({ pay: 50000, age: 41 }).value;
  assert.ok(Math.abs(a - b) / a < 0.001);
  // the pay centres are one per Vanguard pay group, rising
  assert.equal(VG_PAY_CENTRES.length, 7);
  assert.deepEqual(VG_PAY_CENTRES.map(([, m]) => m), [...VG_PAY_CENTRES.map(([, m]) => m)].sort((x, y) => x - y));
});

// ---- E13: what you put in
test("E13 7.H: Sam puts in about 5.0% ($200), Jordan 5.5% ($270), Pat 8.4% ($600), Lee 6.3% ($210)", () => {
  // the share of pay: Vanguard's average by pay and age (R2: all 7.6% x pay ratio x age ratio with the age group's typical pay out)
  // x median / average (6.6 / 7.6 = 0.868), to 0.1 point (R11), then the month's dollars: 5.0% x 48,000 / 12 = $200.0
  near(deferralRate({ pay: 48000, age: 24 }), 0.05047, 0.00005, "Sam");
  near(deferralRate({ pay: 58000, age: 41 }), 0.05476, 0.00005, "Jordan");
  near(deferralRate({ pay: 85000, age: 61 }), 0.08448, 0.00005, "Pat");
  near(deferralRate({ pay: 40000, age: 59 }), 0.06259, 0.00005, "Lee");
  const get = (plan, pid) => est(plan, "contrib.amount", PUT(pid));
  assert.equal(get(sam(), ME).value, 200);                       // 5.0% x 48,000 / 12 = 200.0
  const jo = get(jordan(), ME);
  assert.equal(jo.value, 270);                                   // 5.5% x 58,000 / 12 = 265.8 -> $10
  assert.equal(jo.why, "people your age on your pay usually put in about 5.5%");
  const pl = patLee();
  assert.equal(get(pl, ME).value, 600);                          // 8.4% x 85,000 / 12 = 595 -> 600
  assert.equal(get(pl, PARTNER).value, 210);                     // 6.3% x 40,000 / 12 = 210
  assert.equal(jo.measured, false, "no range is printed for a spread worked from a bucketed table");
  near(jo.sigma, 0.6356, 0.001, "the spread: ln(q75 / q25) / 1.349 of Vanguard's distribution of participants");
});

test("E13: participation decides first (Sam is 0.5 to 0.6); under half put anything in, the guess is nothing yet; a higher pay is capped at the IRS limit", () => {
  const p = participation({ pay: 48000, age: 24 });
  assert.ok(p > 0.4 && p < 0.6, `Sam's p ${p}`);
  assert.ok(p >= 0.5, "a guess is written for Sam");
  // a 22-year-old on $12,000 (log-odds: everyone 83%, the lowest pay group 43%, the youngest group 54%): under half
  const plan = migrate(emptyPlan());
  S.applyYou(plan, { name: "Kit", who: "me", kids: 0, state: "OH" });
  S.applyMoney(plan, { people: { [ME]: { status: "work", amount: "12000", period: "annual" } } });
  S.applyAges(plan, { people: { [ME]: { month: 3, year: 2004, stopAge: 65, ss: { mode: "estimate" } } } }, T0);
  S.applyHavePicks(plan, ["retire"]);
  assert.ok(participation({ pay: 12000, age: 22 }) < 0.5);
  const e = est(plan, "contrib.amount", PUT(ME));
  assert.equal(e.value, 0);
  assert.equal(e.why, "about half of people your age on your pay don't put money in yet");
  assert.ok(e.why.length <= 70);
  // the IRS limit for 2026 ($24,500, Notice 2025-67; from 50 the catch-up $8,000, 60 to 63 $11,250): a guess never goes past it
  assert.equal(deferralLimit(41, 2026), 24500); assert.equal(deferralLimit(55, 2026), 32500); assert.equal(deferralLimit(61, 2026), 35750);
  const rich = migrate(emptyPlan());
  S.applyYou(rich, { name: "Rae", who: "me", kids: 0, state: "OH" });
  S.applyMoney(rich, { people: { [ME]: { status: "work", amount: "900000", period: "annual" } } });
  S.applyAges(rich, { people: { [ME]: { month: 3, year: 1985, stopAge: 65, ss: { mode: "estimate" } } } }, T0);
  S.applyHavePicks(rich, ["retire"]);
  const big = est(rich, "contrib.amount", PUT(ME));
  assert.equal(big.value, 2040, "24,500 / 12 = 2,042 to $50: the limit, not 8.6% of $900,000");
});

// ---- E14: what the employer adds
test("E14 7.H: the employer adds about $130 a month for Sam, $180 for Jordan, $280 for Pat and $130 for Lee (stored a year, x12)", () => {
  // the usual match is worth 4% of pay when you put in 6% (Vanguard's medians): 4% x min(1, share / 6%) x pay / 12, to $10 a month.
  // Sam puts in $200 (5.0%): 4% x 0.833 x 48,000 / 12 = $133 -> $130
  const m = (plan, pid) => est(plan, "contrib.match", MATCH(pid));
  assert.equal(m(sam(), ME).value, 1560);
  assert.equal(m(jordan(), ME).value, 2160);                      // $270 is 5.59%: 4% x 0.931 x 58,000 / 12 = $180
  const pl = patLee();
  assert.equal(m(pl, ME).value, 3360);                            // 8.4% is past 6%: 4% x 85,000 / 12 = $283 -> $280
  assert.equal(m(pl, PARTNER).value, 1560);                       // 6.3%: 4% x 40,000 / 12 = $133 -> $130
  assert.equal(m(jordan(), ME).why, "most work plans add about 4% of pay when you put in 6%");
  assert.deepEqual(matchTerms(), { value: 0.04, needed: 0.06 });
  // nothing goes in, nothing is matched; a typed 6% gets all of it; "no match at this job" (Contributions) gets no guess
  const j = jordan();
  assert.equal(est(j, "contrib.match", MATCH(ME), { contrib: { [ME]: 0 } }).value, 0);
  assert.equal(est(j, "contrib.match", MATCH(ME), { contrib: { [ME]: 290 } }).value, 2280, "6% of 58,000 / 12 = 290: 4% x 58,000 / 12 = 193 -> 190, x12");
  j.retirement.workPlans = { [ME]: { match: false } };
  assert.equal(est(j, "contrib.match", MATCH(ME)), null);
});

// ---- E15-E17, E40
test("E15, E16, E17 and E40: an IRA, investments outside retirement, checking and savings, and a car, from the Survey of Consumer Finances", () => {
  const s = sam(); S.applyHavePicks(s, ["retire", "invest", "car"]);
  // E15 (7.H "S had he picked On my own"): $6,800 (SCF 2025 cell: holders under 35 on the survey's 60-80% income group; the two medians multiplied gave $13,000), the middle half $2,900 to $16,000
  const ira = est(s, "account.ira.balance", BAL(ME));
  assert.equal(ira.value, 6800); assert.deepEqual([ira.low, ira.high], [2900, 16000]);
  assert.equal(ira.why, "typical for households your age on your income who have one");
  assert.ok(est(s, "account.invest.balance", "accounts[setup-have-invest].balance").value > 0);
  // E40: the survey's vehicles for a household like this over the vehicles a household that age has: $12,000
  assert.equal(est(s, "account.car.value", "accounts[setup-have-car].balance").value, 12000);
  // E17 (J: $2,800, shared $1,400 / $1,400 when both are picked and both blank)
  const j = jordan(); S.applyHavePicks(j, ["checking", "savings"]);
  assert.equal(est(j, "account.cash", "accounts[setup-have-checking].balance").value, 1400);
  assert.equal(est(j, "account.cash", "accounts[setup-have-savings].balance").value, 1400);
  const one = jordan(); S.applyHavePicks(one, ["checking"]);
  assert.equal(est(one, "account.cash", "accounts[setup-have-checking].balance").value, 2800, "only one picked: it gets all of it");
  // one typed: the other gets what is left of the total, if that is $100 or more, else nothing
  assert.equal(est(j, "account.cash", "accounts[setup-have-savings].balance", { checking: 1000 }).value, 1800);
  assert.equal(est(j, "account.cash", "accounts[setup-have-savings].balance", { checking: 2750 }), null);
});

test("E12s 7.H: Pat's $500,000 for both of them is split by pay: Pat $340,000, Lee $160,000", () => {
  const pl = patLee();
  q4b(pl, { [`retire-${ME}`]: "500000", joint: "both", checking: "28000", home: "450000" });
  // 500,000 x 85 / 125 = 340,000 and 500,000 x 40 / 125 = 160,000
  assert.equal(acct(pl, `setup-have-retire-${ME}`).balance, 340000);
  assert.equal(acct(pl, `setup-have-retire-${PARTNER}`).balance, 160000);
  assert.equal(pl.guesses[BAL(ME)].k, "account.retire.split"); assert.equal(pl.guesses[BAL(PARTNER)].k, "account.retire.split");
  assert.deepEqual(pl.guide.setup.taps["retire-joint"], { pid: ME, total: 500000 });
  // the split follows pay: a raise for Lee shifts the shares on the next change (settle), and the typed total is kept
  const e = est(pl, "account.retire.split", BAL(PARTNER));
  assert.equal(e.why, "your $500,000 split by pay"); assert.equal(e.basis, "yours");
  // typed over, the other half is no longer tied to it: Lee's entry stays frozen (the estimate is null once Pat's guess is gone)
  const typed = structuredClone(pl);
  typed.accounts.find((a) => a.id === `setup-have-retire-${ME}`).balance = 400000;
  settle(typed, { ...OPTS });
  assert.equal(typed.guesses?.[BAL(ME)], undefined, "Pat's own figure is hers now");
  assert.equal(est(typed, "account.retire.split", BAL(PARTNER)), null);
  // "Pat's alone": no split, Lee gets her own guess ($29,000), Pat's $500,000 stays typed
  const alone = patLee();
  q4b(alone, { [`retire-${ME}`]: "500000", joint: "alone", checking: "28000", home: "450000" });
  assert.equal(acct(alone, `setup-have-retire-${ME}`).balance, 500000);
  assert.equal(acct(alone, `setup-have-retire-${PARTNER}`).balance, 28000);
  assert.equal(alone.guide.setup.taps?.["retire-joint"], undefined);
  // the question itself is E12's ask, shown only for a couple with one box typed and the other blank
  const g = gx(patLee())("account.retire.balance", { path: BAL(PARTNER), args: S.haveArgs(patLee(), { [`retire-${ME}`]: "500000" }, T0) });
  assert.equal(g.ask.key, "retire-joint");
  assert.equal(g.ask.question, "Is the $500,000 Pat's alone, or both of yours?");
  assert.deepEqual(g.ask.options.map((o) => o.value), ["alone", "both"]);
  assert.equal(gx(patLee())("account.retire.balance", { path: BAL(PARTNER), args: S.haveArgs(patLee(), { [`retire-${ME}`]: "500000", joint: "both" }, T0) }).ask, undefined, "answered: asked no more");
  assert.equal(gx(patLee())("account.retire.balance", { path: BAL(PARTNER), args: S.haveArgs(patLee(), { [`retire-${ME}`]: "500000", [`retire-${PARTNER}`]: "100000" }, T0) }).ask, undefined, "both typed: nothing to ask");
});

test("E12s: with no pay for either, a joint figure is split in two; a single adult has no split at all", () => {
  const pl = patLee();
  pl.income = pl.income.filter((x) => !String(x.id).startsWith("setup-pay-"));
  q4b(pl, { [`retire-${ME}`]: "500000", joint: "both" });
  assert.equal(acct(pl, `setup-have-retire-${ME}`).balance, 250000);
  assert.equal(est(sam(), "account.retire.split", BAL(ME)), null);
});

// ---- the gate
test("the gate: outside the U.S. and EUR plans get no guess from any retirement-saving key", () => {
  const away = jordan(); S.applyHavePicks(away, ["retire", "checking", "car"]); away.guide.setup.outsideUS = true;
  const eur = jordan(); S.applyHavePicks(eur, ["retire", "checking", "car"]); eur.meta.currency = "EUR";
  for (const p of [away, eur]) for (const [k, path] of [["account.retire.balance", BAL(ME)], ["account.ira.balance", BAL(ME)], ["account.cash", "accounts[setup-have-checking].balance"], ["account.car.value", "accounts[setup-have-car].balance"], ["contrib.amount", PUT(ME)], ["contrib.match", MATCH(ME)]]) assert.equal(est(p, k, path), null, k);
  // and Get started's Q4b then does what it did before the guesses: a blank box makes no account
  const q = jordan(); S.applyHavePicks(q, ["retire", "checking"]); q.guide.setup.outsideUS = true;
  q4b(q, {});
  assert.equal(q.accounts.filter((a) => a.id.startsWith("setup-have-")).length, 0);
  assert.equal(q.guesses, undefined);
});

// ---- Q4b: the walks
test("Q4b 7.H Sam: a 401(k) left blank gets $3,100, $200 a month and $130 from the employer, all marked; typed checking and savings stay his", () => {
  const s = sam(); S.applyHavePicks(s, ["checking", "savings", "retire"]);
  q4b(s, { checking: "1,200", savings: "800", [`kind-${ME}`]: "work" });
  assert.equal(acct(s, `setup-have-retire-${ME}`).balance, 3400);
  assert.deepEqual([row(s, ME).amount, row(s, ME).employerMatch, row(s, ME).period], [200, 1560, "monthly"]);
  assert.deepEqual(Object.keys(s.guesses).sort(), [BAL(ME), MATCH(ME), PUT(ME)].sort());
  assert.deepEqual([s.guesses[BAL(ME)].k, s.guesses[PUT(ME)].k, s.guesses[MATCH(ME)].k], ["account.retire.balance", "contrib.amount", "contrib.match"]);
  assert.equal(acct(s, "setup-have-checking").balance, 1200);
  assert.equal(isGuess(s, "accounts[setup-have-checking].balance"), false);
  // preview equals written: settle (which runs after the save) changes nothing
  const copy = structuredClone(s);
  assert.deepEqual(settle(copy, { ...OPTS }), { changed: [], dropped: [] });
  assert.deepEqual(copy, s);
  // the screen reopens with the boxes empty (the grey figures), never the guess as typed text
  const v = S.valuesFor(s, "have-amounts", { today: T0 });
  assert.equal(v[`retire-${ME}`], ""); assert.equal(v[`contrib-${ME}`], ""); assert.equal(v[`match-${ME}`], ""); assert.equal(v[`pct-${ME}`], null);
});

test("Q4b 7.H Jordan: $26,000, $270 and $180; the account is made even though nothing was typed; the match step is open", () => {
  const j = jordan(); S.applyHavePicks(j, ["checking", "retire", "home"]);
  q4b(j, {});
  assert.equal(acct(j, `setup-have-retire-${ME}`).balance, 27000);
  assert.deepEqual([row(j, ME).amount, row(j, ME).employerMatch], [270, 2160]);
  assert.equal(acct(j, "setup-have-checking").balance, 2800, "E17");
  assert.equal(acct(j, "setup-have-home").balance, 210000, "E18 asked here");
  // her typed "5" in the dollars box: 5% of her pay, about $240 a month (7.H)
  const g = gx(j)("contrib.amount", { path: PUT(ME), args: { retire: {}, contrib: { [ME]: null } } });
  const slip = typoCheck(5, { value: g.value, sigma: g.sigma }, [{ id: "pct-of-pay", map: (x) => x / 100 * 58000 / 12, words: (x, m) => `Did you mean ${x}% of your pay, about $${Math.round(m / 10) * 10} a month?` }]);
  assert.equal(slip.slip, "pct-of-pay");
  assert.equal(slip.words, "Did you mean 5% of your pay, about $240 a month?");
  assert.equal(typoCheck(250, { value: g.value, sigma: g.sigma }, [{ id: "pct-of-pay", map: (x) => x / 100 * 58000 / 12 }]), null, "$250 is no slip");
});

test("Q4b 7.H Pat and Lee: Lee's $29,000, $600 and $280 for Pat, $210 and $130 for Lee; Pat's $500,000 stays his typed figure", () => {
  const pl = patLee();
  q4b(pl, { [`retire-${ME}`]: "500000", checking: "28000", home: "450000" });
  assert.equal(acct(pl, `setup-have-retire-${PARTNER}`).balance, 28000);
  assert.equal(isGuess(pl, BAL(ME)), false);
  assert.deepEqual([row(pl, ME).amount, row(pl, ME).employerMatch / 12], [600, 280]);
  assert.deepEqual([row(pl, PARTNER).amount, row(pl, PARTNER).employerMatch / 12], [210, 130]);
});

// ---- Q4b: typing over, chips, the slip question
test("a typed balance is the person's: the guess goes, the same figure typed counts, and clearing it brings the guess back", () => {
  const s = sam(); S.applyHavePicks(s, ["retire"]);
  q4b(s, {});
  assert.equal(s.guesses[BAL(ME)].v, 3400);
  q4b(s, { [`retire-${ME}`]: "3100" });
  assert.equal(s.guesses?.[BAL(ME)], undefined, "typing the same figure over the guess makes it his");
  assert.equal(S.valuesFor(s, "have-amounts", { today: T0 })[`retire-${ME}`], 3100);
  q4b(s, { [`retire-${ME}`]: "" });
  assert.equal(s.guesses[BAL(ME)].k, "account.retire.balance", "cleared: ours again");
  assert.equal(acct(s, `setup-have-retire-${ME}`).balance, 3400);
});

test("the chips: 6% is a share of pay, None and No match are typed zeros, Not sure is our guess; Back reopens the chip", () => {
  const j = jordan(); S.applyHavePicks(j, ["retire"]);
  // 6% of 58,000 / 12 = $290
  q4b(j, { [`pct-${ME}`]: 0.06, [`contrib-${ME}`]: "290", [`kind-${ME}`]: "work" });
  assert.equal(row(j, ME).amount, 290);
  assert.equal(isGuess(j, PUT(ME)), false);
  assert.equal(j.guide.setup.saving[ME].pct, 0.06);
  // the match is still our guess and follows what is typed: 6% gets the whole usual match, 4% x 58,000 / 12 = 193 -> $190 a month
  assert.equal(j.guesses[MATCH(ME)].k, "contrib.match"); assert.equal(row(j, ME).employerMatch, 2280);
  const v = S.valuesFor(j, "have-amounts", { today: T0 });
  assert.equal(v[`pct-${ME}`], 0.06); assert.equal(v[`contrib-${ME}`], 290); assert.equal(v[`match-${ME}`], "");
  // a raise on Income makes the dollars no longer 6%: the screen then shows the dollars, not the chip
  j.income.find((x) => x.id === `setup-pay-${ME}`).amount = 70000;
  assert.equal(S.valuesFor(j, "have-amounts", { today: T0 })[`pct-${ME}`], null);
  // None: a typed 0, the match then 0 too (nothing to match), and it reopens as None
  const n = jordan(); S.applyHavePicks(n, ["retire"]);
  q4b(n, { [`pct-${ME}`]: 0, [`contrib-${ME}`]: "0" });
  assert.equal(row(n, ME).amount, 0); assert.equal(isGuess(n, PUT(ME)), false);
  assert.equal(n.guesses[MATCH(ME)].v, 0);
  assert.equal(S.valuesFor(n, "have-amounts", { today: T0 })[`contrib-${ME}`], "0");
  // No match: a typed 0 a year, and the answer Contributions keeps ("no match at this job"), so Next best action stops asking
  const m = jordan(); S.applyHavePicks(m, ["retire"]);
  q4b(m, { [`pct-${ME}`]: 0.05, [`contrib-${ME}`]: "242", [`match-${ME}`]: "0", [`matchMode-${ME}`]: "none" });
  assert.equal(row(m, ME).employerMatch, 0); assert.equal(isGuess(m, MATCH(ME)), false);
  assert.equal(m.retirement.workPlans[ME].match, false);
  assert.equal(S.valuesFor(m, "have-amounts", { today: T0 })[`matchMode-${ME}`], "none");
  // taking No match back (Not sure) takes the answer it wrote back
  q4b(m, { [`pct-${ME}`]: 0.05, [`contrib-${ME}`]: "242", [`match-${ME}`]: "" });
  assert.equal(m.retirement.workPlans, undefined);
  assert.equal(m.guesses[MATCH(ME)].k, "contrib.match");
  // "I know it": the person's monthly figure, x12
  const k = jordan(); S.applyHavePicks(k, ["retire"]);
  q4b(k, { [`match-${ME}`]: "150", [`matchMode-${ME}`]: "know" });
  assert.equal(row(k, ME).employerMatch, 1800); assert.equal(isGuess(k, MATCH(ME)), false);
});

test("a retirement tile always makes the account; with a plan said at work the guess goes into that account; 'no plan' gets no contribution guess", () => {
  // question 2's "Yes" made a $0 401(k) (setup-workplan-<id>); ticking Retirement and leaving it blank puts our guess in it
  const w = jordan();
  S.applyMoney(w, { people: { [ME]: { status: "work", amount: "58000", period: "annual", plan: "yes" } } }, T0);
  assert.ok(acct(w, `setup-workplan-${ME}`), "Q2 made the plan at work");
  S.applyHavePicks(w, ["retire"]);
  q4b(w, {});
  assert.equal(acct(w, `setup-workplan-${ME}`).balance, 27000);
  assert.equal(acct(w, `setup-have-retire-${ME}`), undefined, "no second 401(k)");
  assert.equal(w.guesses[`accounts[setup-workplan-${ME}].balance`].k, "account.retire.balance");
  assert.equal(row(w, ME).accountId, `setup-workplan-${ME}`);
  // said no plan at work: the balance is guessed, what goes in is not
  const n = jordan(); n.retirement.workPlans = { [ME]: { plan: false, match: false } };
  S.applyHavePicks(n, ["retire"]);
  q4b(n, {});
  assert.equal(acct(n, `setup-have-retire-${ME}`).balance, 27000);
  assert.equal(row(n, ME), undefined);
  // paid by their own business: no pay from an employer, so no contribution guess, but the balance is still guessed
  const b = migrate(emptyPlan());
  S.applyYou(b, { name: "Bea", who: "me", kids: 0, state: "OH" });
  S.applyMoney(b, { people: { [ME]: { status: "work", who: "self", amount: "60000", period: "annual" } } });
  S.applyAges(b, { people: { [ME]: { month: 3, year: 1985, stopAge: 65, ss: { mode: "estimate" } } } }, T0);
  S.applyHavePicks(b, ["retire"]);
  q4b(b, { [`kind-${ME}`]: "own" });
  assert.equal(acct(b, `setup-have-retire-${ME}`).type, "ira");
  assert.equal(b.guesses[BAL(ME)].k, "account.ira.balance");
  assert.equal(row(b, ME), undefined);
});

test("'Not sure' where it is kept counts as through work; the answer on screen decides the guess's key", () => {
  const j = jordan(); S.applyHavePicks(j, ["retire"]);
  q4b(j, { [`kind-${ME}`]: "unsure" });
  assert.equal(acct(j, `setup-have-retire-${ME}`).type, "401k");
  assert.equal(j.guesses[BAL(ME)].k, "account.retire.balance");
});

test("Q4b 'Got it' counts what is ours: 'about $X saved and invested in all. 2 of the 3 are our guesses'", () => {
  const s = sam(); S.applyHavePicks(s, ["checking", "retire"]);
  q4b(s, { checking: "1200" });
  const r = S.reflect(s, "have-amounts");
  assert.equal(r.guessed, 1); assert.equal(r.of, 2);
  assert.equal(r.total, 1200 + 3400);
  const t = sam(); S.applyHavePicks(t, ["checking", "savings"]);
  q4b(t, { checking: "1200", savings: "800" });
  assert.equal(S.reflect(t, "have-amounts").guessed, undefined, "all typed: nothing to count");
});

// ---- plans from before C4
test("plans made before C4 compute as they did: applyHaveAmounts without { guess } is the old function, and nothing is marked", () => {
  const s = sam(); S.applyHavePicks(s, ["retire"]);
  S.applyHaveAmounts(s, { [`retire-${ME}`]: 38000, [`contrib-${ME}`]: 400, [`match-${ME}`]: 150 }, T0);
  assert.equal(s.guesses, undefined);
  assert.deepEqual([row(s, ME).amount, row(s, ME).employerMatch], [400, 1800]);
  S.applyHaveAmounts(s, { [`retire-${ME}`]: "" }, T0);
  assert.equal(acct(s, `setup-have-retire-${ME}`), undefined, "a blank box without guesses makes no account, as before");
});

// ---- Next best action
function worker(plan) {
  plan.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 1400, period: "monthly", essential: true }, { id: "e-food", name: "Food", category: "food", amount: 500, period: "monthly", essential: true }];
  return plan;
}
const matchStep = (plan, today = "2026-11-06") => nextBest(plan, { today }).steps.find((s) => s.id === "match");

test("Next best action: a guessed contribution short of 6% reads 'put in 6% ($290 a month) ... to likely get about $190 a month'", () => {
  const j = worker(jordan()); S.applyHavePicks(j, ["retire"]);
  q4b(j, {});
  const m = matchStep(j);
  assert.ok(m, "the match step is there");
  assert.notEqual(m.status, "done");
  // 6% of 58,000 / 12 = $290 (about $20 more than the $270 guessed); the usual match, 4% x 58,000 / 12 = 193 -> $190
  assert.match(m.detail, /Jordan's 401\(k\): put in 6% of pay \(\$290 a month, about \$20 more than the \$270 we guess goes in now\) to likely get about \$190 a month from the employer \(plans usually add about 4% of pay\)\./);
  const a = m.ask.find((x) => x.kind === "guessed");
  assert.deepEqual([a.personId, a.wantMonthly, a.wantMatch, a.rowId], [ME, 290, 190, `setup-contrib-${ME}`]);
  // typed, the contribution keeps the old words (no "we guess")
  const t = worker(jordan()); S.applyHavePicks(t, ["retire"]);
  q4b(t, { [`pct-${ME}`]: 0.05, [`contrib-${ME}`]: "242" });
  assert.doesNotMatch(matchStep(t)?.detail ?? "", /we guess/);
  assert.equal(matchStep(t)?.ask?.find((x) => x.kind === "guessed"), undefined);
  // at 6% or more (Pat: 8.4%) the step stays done
  const pl = worker(patLee()); q4b(pl, {}, ["retire"]);
  assert.equal(matchStep(pl)?.status ?? "done", "done");
});

test("Next best action: a guess of nothing yet (under half put in) is not 'contributing': the match is still asked about", () => {
  const k = worker(migrate(emptyPlan()));
  S.applyYou(k, { name: "Kit", who: "me", kids: 0, state: "OH" });
  S.applyMoney(k, { people: { [ME]: { status: "work", amount: "12000", period: "annual" } } });
  S.applyAges(k, { people: { [ME]: { month: 3, year: 2004, stopAge: 65, ss: { mode: "estimate" } } } }, T0);
  q4b(k, {}, ["retire"]);
  assert.equal(row(k, ME).amount, 0);
  const m = matchStep(k);
  assert.ok(m && m.status === "check", `status ${m?.status}`);
  assert.match(m.detail, /has a 401\(k\) and pay but no contribution on file/);
});

test("UX 6 (batch 3): a plan said at Get started is not 'a job left' -- the words say what was said, and the former-job clause and button go", () => {
  const w = worker(jordan());
  S.applyMoney(w, { people: { [ME]: { status: "work", amount: "58000", period: "annual", plan: "yes" } } }, T0);
  assert.equal(w.retirement.workPlans[ME].plan, true);
  assert.equal(acct(w, `setup-workplan-${ME}`).balance, 0);
  const m = matchStep(w);
  assert.ok(m && m.status === "check");
  assert.match(m.detail, /^Jordan's job has a retirement plan \(you said so in Set up my plan\), but nothing goes into it yet\. Check whether the employer matches, and put in at least enough to get all of it\. If there is no match, say so on Retirement contributions\./);
  assert.doesNotMatch(m.detail, /job left/);
  assert.equal(m.ask[0].saidPlan, true);
  // a 401(k) the person typed on Net worth keeps the old words and the clause
  const o = worker(jordan());
  o.accounts.push({ id: "a-401", name: "My 401(k)", type: "401k", balance: 12000, ownerId: ME, asOf: "2026-11-01", history: [] });
  const d = matchStep(o);
  assert.match(d.detail, /If the 401\(k\) is from a job you left, or there is no match, say so on Retirement contributions\./);
  assert.equal(d.ask[0].saidPlan, undefined);
  // the empty $0 401(k) of Get started with no plan answer on file (an older plan) counts as said too
  const e = worker(jordan());
  e.accounts.push({ id: `setup-workplan-${ME}`, name: "My plan at work", type: "401k", balance: 0, ownerId: ME, asOf: "2026-11-01", history: [] });
  assert.equal(matchStep(e).ask[0].saidPlan, true);
  // money in it makes it an ordinary 401(k) again
  e.accounts.find((a) => a.id === `setup-workplan-${ME}`).balance = 5000;
  assert.equal(matchStep(e).ask[0].saidPlan, undefined);
});

// ---- Contributions: "6%"
test("Contributions accepts '6%': a share of pay, otherwise dollars (4.5k works), otherwise an error in plain words", () => {
  assert.deepEqual(readAmountOrShare("6%"), { pct: 0.06 });
  assert.deepEqual(readAmountOrShare(" 6.5 % "), { pct: 0.065 });
  assert.deepEqual(readAmountOrShare("270"), { amount: 270 });
  assert.deepEqual(readAmountOrShare("$1,200"), { amount: 1200 });
  assert.deepEqual(readAmountOrShare("1.5k"), { amount: 1500 });
  assert.equal(readAmountOrShare(""), null);
  assert.deepEqual(readAmountOrShare("six percent"), { bad: true });
  assert.deepEqual(readAmountOrShare("-5"), { bad: true });
  // 6% of 58,000 a year, paid monthly: 290; a paycheck every two weeks: 133.85
  const pay = payOf(jordan(), ME, T0);
  assert.equal(pay, 58000);
  assert.equal(Math.round(0.06 * pay / 12 * 100) / 100, 290);
  assert.equal(Math.round(0.06 * pay / 26 * 100) / 100, 133.85);
});

// ---- the small things
test("the spread of what people put in is worked from the published shares of participants; the settle that follows a save changes nothing", () => {
  // 22% put in under 3.9%, 21% 4.0 to 6.0, 32% 6.1 to 9.9, 18% 10.0 to 14.9, 7% 15%+ (Vanguard 2026): the quarter point is 4.2%, the three quarters 9.9%
  near(deferralSigma(), Math.log(9.9 / 4.2) / 1.349, 0.01);
  for (const make of [sam, jordan, patLee]) {
    const p = make(); S.applyHavePicks(p, ["checking", "savings", "retire", "invest", "car"]);
    q4b(p, {});
    const copy = structuredClone(p);
    assert.deepEqual(settle(copy, { ...OPTS }), { changed: [], dropped: [] }, make.name);
    assert.deepEqual(copy, p);
    // a raise on Income: the guesses follow, in tier order (balance, then what goes in, then the match), and a guess typed over stays put
    const raise = structuredClone(p);
    raise.income.find((x) => x.id === `setup-pay-${ME}`).amount *= 1.5;
    const res = settle(raise, { ...OPTS });
    assert.ok(res.changed.some((c) => c.k === "contrib.amount"), `${make.name}: what goes in follows pay`);
    assert.ok(res.changed.findIndex((c) => c.k === "account.retire.balance") < res.changed.findIndex((c) => c.k === "contrib.amount"));
  }
  // clearGuess keeps the value
  const s = sam(); S.applyHavePicks(s, ["retire"]); q4b(s, {});
  clearGuess(s, BAL(ME));
  assert.equal(s.guesses[BAL(ME)], undefined);
  assert.equal(acct(s, `setup-have-retire-${ME}`).balance, 3400);
});
