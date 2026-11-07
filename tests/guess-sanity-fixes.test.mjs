// tests/guess-sanity-fixes.test.mjs -- one test per guess the sanity check (qa/guess-sanity.mjs) found a layperson would not
// believe for their own household, fixed 2026-11-07. Each builds the household the way Get started does (qa/guess-sanity.mjs
// walk) and checks the figure against the line the rule holds it to; the sources are in qa/guess-sanity-rules.json and in
// modules/overview/guesses/data/cells.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { walk, Household, loadPages, TODAY } from "../qa/guess-sanity.mjs";
import * as S from "../modules/overview/setup/compute.js";
import { crossMedian, homeRatios } from "../modules/overview/guesses/estimators/common.js";
import { insuranceYear } from "../modules/overview/guesses/estimators/home.js";
import { takeHome } from "../modules/overview/guesses/estimators/spend.js";
import { compute as glide } from "../modules/investments/glide-path/compute.js";
import { migrate, emptyPlan } from "../core/schema/migrate.js";

await loadPages();
const base = { state: "OH", tenure: "rent", typed: {}, debts: [], kind: "work", taps: {}, kids: [] };
const house = (o) => { const s = { src: "test", ...base, status: (o.ages ?? [30]).map(() => "work"), ...o }; const w = walk(s); return new Household(w.plan, { ...s, preview: w.preview }, { tier: "B" }); };
const planWith = (people, income = [], extra = {}) => { const p = migrate(emptyPlan()); p.household.people = people; p.income = income; Object.assign(p, extra); return p; };

test("SF-GOAL-EDU: the Education goal is dated the year the first child under 18 turns 18, not ten years out", () => {
  const kid = (id, born) => ({ id, name: id, role: "dependent", birthDate: `${born}-06-15` });
  assert.equal(S.educationDate(planWith([kid("a", 2013), kid("b", 2015)]), "2026-11-07"), "2031-08-15", "the older child, 13, starts in 2031");
  assert.equal(S.educationDate(planWith([kid("n", 2026)]), "2026-11-07"), "2044-08-15", "a newborn");
  assert.equal(S.educationDate(planWith([{ id: "x", role: "self", birthDate: "1990-01-15" }]), "2026-11-07"), null, "no children: the usual chips");
  // a child who turns 18 this year after the fall bill has passed: a year out, never a date in the past
  assert.equal(S.educationDate(planWith([kid("t", 2008)]), "2026-11-07"), "2027-11-07");
  // through Get started: the goal on Goals carries that date
  const h = house({ who: "spouse", ages: [40, 38], pays: [90000, 60000], kids: [13, 15] });
  const goals = S.valuesFor(h.plan, "goal-details", { today: TODAY });
  assert.equal(goals.education.date, "2029-08-15", "the 15-year-old turns 18 in 2029");
  assert.equal(goals.education.years, null);
});

test("sr.emergency.months-default: Get started's cushion is the Emergency fund page's own advice (3 with two incomes, 6 with one), unless the person chose", () => {
  const adult = (id) => ({ id, name: id, role: id === "a" ? "self" : "partner", birthDate: "1990-01-15" });
  const pay = (personId) => ({ id: `i-${personId}`, personId, type: "salary", name: "Pay", amount: 60000, period: "annual", startDate: "", endDate: "" });
  const two = () => planWith([adult("a"), adult("b")], [pay("a"), pay("b")]), one = () => planWith([adult("a")], [pay("a")]);
  assert.equal(two().assumptions.emergencyMonths, 6, "a new plan carries the schema's starting 6: nobody chose it");
  assert.equal(S.defaultCushionMonths(two(), TODAY), 3);
  assert.equal(S.cushionMonths(two(), TODAY), 3);
  assert.equal(S.cushionMonths(one(), TODAY), 6);
  assert.equal(S.defaultCushionMonths(planWith([adult("a")], [{ ...pay("a"), type: "business" }]), TODAY), 9, "pay that goes up and down");
  // a figure chosen on the Assumptions page (not the starting 6) or saved from the cushion question wins
  const chosen = two(); chosen.assumptions.emergencyMonths = 5;
  assert.equal(S.cushionMonths(chosen, TODAY), 5);
  const said = two(); said.guide = { setup: { cushionSaid: true } };
  assert.equal(S.cushionMonths(said, TODAY), 6);
  // through Get started with the box left blank: the plan gets 3, and the Emergency fund page agrees
  const h = house({ who: "spouse", ages: [30, 30], pays: [50000, 50000] });
  assert.equal(h.plan.assumptions.emergencyMonths, 3);
  assert.equal(h.ok("goals/emergency-fund").months, h.ok("goals/emergency-fund").suggested.months);
  // a couple who type 6 themselves keep 6, and so does a later visit
  const typed6 = structuredClone(h.plan); S.applyGoalDetails(typed6, { cushion: { months: 6 } }, TODAY);
  assert.equal(typed6.assumptions.emergencyMonths, 6); assert.equal(S.cushionMonths(typed6, TODAY), 6);
  const solo = house({ who: "me", ages: [30], pays: [50000] });
  assert.equal(solo.plan.assumptions.emergencyMonths, 6);
});

test("pt.ss.not-zero-when-retired: a retired person gets the average retired worker's benefit for their age, not $0", () => {
  assert.equal(S.averageRetiredBenefit(61), null, "before 62 it is disability or survivor money, not this average");
  assert.equal(S.averageRetiredBenefit(67, 1959), 1967, "SSA Annual Statistical Supplement 2026, Table 5.B9, 65-69: $1,967");
  assert.equal(S.averageRetiredBenefit(72, 1954), 2225);
  assert.equal(S.averageRetiredBenefit(95, 1931), 1897);
  for (let a = 68; a < 94; a++) assert.ok(Math.abs(S.averageRetiredBenefit(a, 2026 - a) - S.averageRetiredBenefit(a + 1, 2025 - a)) < 120, `no jump at ${a}`);
  assert.ok(S.estimateSocialSecurity({ birthYear: 1964, yearlyPay: 0, stopAge: 62, today: TODAY }) > 1500, "62 and retired");
  assert.equal(S.estimateSocialSecurity({ birthYear: 1990, yearlyPay: 0, stopAge: 65, today: TODAY }), null, "still working with no pay typed: nothing to go on");
  // "Estimate it for me" with no pay: the screen offers it to someone who ticks "Already retired" on the ages question (one who
  // said retired on question 2 is asked "I already get it" instead, and a blank amount there is still $0: verify 2026-11-07)
  const h = house({ who: "me", ages: [66], status: ["retired"], pays: [null], tenure: "own", state: "CA", ss: "estimate" });
  const rec = Object.values(h.plan.retirement.socialSecurity)[0];
  assert.ok(rec.monthlyAtFRA >= 1800 && rec.monthlyAtFRA <= 2200, `a retired 66-year-old: ${rec.monthlyAtFRA}`);
  // Our guesses for you says where the figure comes from: SSA's average for retired workers that age, not "the pay on file"
  const est = h.est("overview/setup:ss", { path: "retirement.socialSecurity.setup-self.monthlyAtFRA" });
  assert.equal(est?.value, rec.monthlyAtFRA);
  assert.match(est.why, /average Social Security of retired workers your age/);
  assert.deepEqual(est.tables, ["ssa_retired_worker_benefit_by_age_sex_2025"]);
});

test("sr.emergency.months-default (verify): a cushion typed on Assumptions after Get started is the person's, 6 included", () => {
  const h = house({ who: "spouse", ages: [35, 35], pays: [60000, 55000] });
  assert.equal(h.plan.assumptions.emergencyMonths, 3, "Get started's own figure for two steady incomes");
  assert.equal(h.plan.guide.setup.cushionWrote, 3);
  for (const typed of [6, 4]) {
    const p = structuredClone(h.plan); p.assumptions.emergencyMonths = typed;   // the Assumptions page's form
    const shown = S.valuesFor(p, "goal-details", { today: TODAY }).cushion.months;
    assert.equal(shown, typed, `the goal screen shows the ${typed} typed`);
    const d = structuredClone(p); S.applyGoalDetails(d, { cushion: { months: shown } }, TODAY);
    assert.equal(d.assumptions.emergencyMonths, typed, `saved again as shown, ${typed} stays`);
    const d2 = structuredClone(p); S.applyGoalDetails(d2, {}, TODAY);
    assert.equal(d2.assumptions.emergencyMonths, typed, `saved with the box untouched, ${typed} stays`);
  }
  // nothing typed: the figure still follows the household (one income now: 6)
  const p = structuredClone(h.plan); p.income = p.income.filter((x) => x.personId !== "setup-partner");
  assert.equal(S.cushionMonths(p, TODAY), 6);
  const d = structuredClone(p); S.applyGoalDetails(d, {}, TODAY);
  assert.equal(d.assumptions.emergencyMonths, 6); assert.equal(d.guide.setup.cushionWrote, 6);
});

test("HD-HOMEINS: home insurance follows the home's value (a $64,000 home is not insured like the state's average one)", () => {
  const small = insuranceYear("MS", 64000), typical = insuranceYear("MS", null), big = insuranceYear("MS", 400000);
  assert.ok(small / 64000 <= 0.0161, `${small}`);
  assert.ok(small < typical && typical < big);
  assert.ok(small >= 350, "a policy has a floor");
  assert.ok(big / 400000 >= 0.001);
});

test("HD-HOME-VALUE-INCOME and HD-MORT-UNDERWATER: the guessed home stays inside what owners like you hold, and above a typed mortgage", () => {
  const young = house({ who: "me", ages: [20], pays: [20000], state: "NY", tenure: "mortgage" });
  const r = young.home.value / 20000, lim = homeRatios(20);
  assert.ok(r <= lim.p95 + 1e-9 && r >= lim.p5 - 1e-9, `value over income ${r.toFixed(2)} (SCF 2025 owners under 35: ${lim.p5}..${lim.p95})`);
  const owed = house({ who: "me", ages: [58], pays: [50000], state: "MS", tenure: "mortgage", typed: { owed: 394000 } });
  assert.ok(owed.home.value >= 394000, `a typed $394,000 balance, home guessed at ${owed.home.value}`);
});

test("sr.balance.like-you and sr.retire.like-you: balances come from the survey's age x income cells, smooth across ages", () => {
  // SCF 2025 holders under 35 in the bottom 60% by income: median $2,900 of investments (the old guess for $40,000 was $32,000)
  assert.ok(crossMedian("invest", { income: 40000, age: 20 }) < 6000);
  assert.ok(crossMedian("retire", { income: 40000, age: 30 }) > 3000 && crossMedian("retire", { income: 40000, age: 30 }) < 30000);
  for (const kind of ["invest", "retire"]) for (const income of [30000, 60000, 120000, 300000]) for (let a = 22; a < 85; a++) {
    const x = crossMedian(kind, { income, age: a }), y = crossMedian(kind, { income, age: a + 1 });
    assert.ok(Math.abs(y / x - 1) < 0.2, `${kind} $${income}: ${a} -> ${a + 1} moves ${(100 * (y / x - 1)).toFixed(0)}%`);
  }
  const ohio = (age) => house({ who: "me", ages: [age], pays: [40000] });
  const a = ohio(34), b = ohio(35), invest = (H) => H.plan.accounts.filter((x) => ["brokerage", "crypto"].includes(x.type)).reduce((s, x) => s + (Number(x.balance) || 0), 0);
  assert.ok(invest(b) <= 1.3 * Math.max(invest(a), 1000), `a birthday at 35 moved investments ${invest(a)} -> ${invest(b)}`);
});

test("SF-SPEND-CHILD-MONO and SF-HEALTH-AGE: a child never lowers a guessed row (but food), and health cover follows age", () => {
  const rows = (H) => Object.fromEntries(Object.entries(H.spendRows).map(([k, r]) => [k, r.monthly ?? 0]));
  const none = rows(house({ who: "spouse", ages: [25, 25], pays: [30000, 30000] })), one = rows(house({ who: "spouse", ages: [25, 25], pays: [30000, 30000], kids: [3], taps: { childcare: "no" } }));
  for (const k of ["utilities", "groceries", "transport", "insurance", "dining", "shopping"]) assert.ok(one[k] >= 0.95 * none[k] - 10, `${k}: ${none[k]} -> ${one[k]}`);
  const young = rows(house({ who: "spouse", ages: [30, 30], pays: [60000, 60000] })), old = rows(house({ who: "spouse", ages: [60, 60], pays: [60000, 60000] }));
  assert.ok(old.insurance >= 1.3 * young.insurance, `health ${young.insurance} at 30, ${old.insurance} at 60 (CE 2025: $4,347 a year at 25-34, $7,317 at 55-64)`);
});

test("sr.verdict.monotone: saving more before tax does not raise the guessed spending", () => {
  const h = house({ who: "me", ages: [45], pays: [90000] });
  const p = structuredClone(h.plan);
  const bare = takeHome(p, TODAY, null, { sizing: true });
  const acct = p.accounts.find((a) => a.type === "401k") ?? { id: "k", type: "401k", name: "401k", balance: 1000 };
  if (!p.accounts.includes(acct)) p.accounts.push(acct);
  p.retirement.contributions = [{ id: "c1", personId: p.household.people[0].id, accountId: acct.id, amount: 1500, period: "monthly", employerMatch: 0 }];
  assert.equal(takeHome(p, TODAY, null, { sizing: true }).a, bare.a, "sizing ignores the saving");
  assert.ok(takeHome(p, TODAY, null).a > bare.a, "the tax estimate itself still shows the saving's tax cut");
});

test("pt.pension.age-window: a household with no birth date is never told an age on Glide path", () => {
  const h = house({ who: "me", ages: [50], noAges: true, pays: [70000] });
  const g = glide(h.plan, { today: TODAY });
  assert.equal(g.ageNow, null);
  assert.ok(g.rows.length > 0, "the path is still drawn, from 20 years before the plan's retirement age");
});

test("sr.saving.no-cliff and sr.saving.monotone: turning 35 moves no balance guess by a step (401(k), cash, investments)", () => {
  const at = (age) => house({ who: "me", ages: [age], pays: [40000], taps: {} });
  const sum = (H, types) => H.plan.accounts.filter((x) => types.includes(x.type)).reduce((s, x) => s + (Number(x.balance) || 0), 0);
  for (const [a, b] of [[24, 25], [34, 35], [44, 45], [54, 55], [64, 65]]) {
    const x = at(a), y = at(b);
    for (const types of [["checking", "savings"], ["401k", "403b", "ira", "roth_ira"]]) {
      const p = sum(x, types), q = sum(y, types);
      if (p > 0 && q > 0) assert.ok(q / p < 1.5 && q / p > 0.75, `${types[0]}: ${a} -> ${b} is ${p} -> ${q}`);
    }
  }
});

test("SF-SPEND-CHILD-MONO: a child never lowers the rent guess, and an adult of 65 is guessed at least Medicare's Part B and Part D base", () => {
  const rows = (H) => Object.fromEntries(Object.entries(H.spendRows).map(([k, r]) => [k, r.monthly ?? 0]));
  const none = rows(house({ who: "spouse", ages: [33, 33], pays: [60000, 60000] })), kid = rows(house({ who: "spouse", ages: [33, 33], pays: [60000, 60000], kids: [8], taps: { childcare: "no" } }));
  assert.ok(kid.housing >= none.housing - 10, `rent ${none.housing} -> ${kid.housing}`);
  const old = rows(house({ who: "me", ages: [70], pays: [30000] }));
  assert.ok(old.insurance >= 241.89, `Part B + Part D base is $241.89 a month in 2026; guessed ${old.insurance}`);
  const poor = rows(house({ who: "me", ages: [70], pays: [12000] }));
  assert.ok(poor.insurance < 241.89, "below the Medicare Savings Program limit the state pays Part B: no floor");
});
