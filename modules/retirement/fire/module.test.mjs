// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

test("fire: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("years from nothing to independence by saving rate: the page's own growth and withdrawal rate", async () => {
  const { yearsFromZero } = await import("./compute.js");
  // 5% after inflation and 4% drawn: the pot after y years is rate x (1.05^y - 1) / 0.05 and must reach (1 - rate) / 0.04,
  // so half of income needs 1.05^y >= 2.25 (16.6, so 17 years) and a tenth 1.05^y >= 12.25 (51.3, so 52 years)
  assert.equal(yearsFromZero(0.5, 0.05, 0.04), 17); assert.equal(yearsFromZero(0.1, 0.05, 0.04), 52);
  // nothing grows: half saved needs 25 x half of income, 25 years
  assert.equal(yearsFromZero(0.5, 0, 0.04), 25); assert.equal(yearsFromZero(0, 0.05, 0.04), null);
});

test("round 5: the answer that counts Social Security is goal seek's earliest age, and the 25-times fields do not move", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { earliestRetireAge, compute: goalSeek } = await import("../../scenarios/goal-seek/compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const { project } = await import("../../../core/math/retirement.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: projection } = await import("../projection/compute.js");
  const today = "2026-11-02";
  const at = (p, id, a) => { const q = JSON.parse(JSON.stringify(p)); q.household.people.find((x) => x.id === id).retirementAge = a; return project(buildInputs(q, { today }).inputs); };
  for (const p of [retirementPlan(), familyPlan(today)]) {
    const d = compute(p, { today });
    const e = earliestRetireAge(p, { today });
    // one answer on both pages
    assert.equal(d.withIncome.earliestAge, e.age);
    assert.equal(goalSeek(p, { today }).levers.find((l) => l.id === "retire").value, e.age);
    // the earliest age works and the age before it does not, unless it is this year's (stopping now)
    assert.ok(at(p, e.personId, e.age).success);
    if (e.age > e.ageNow) assert.equal(at(p, e.personId, e.age - 1).success, false); else assert.equal(d.withIncome.now, true);
    // Social Security: every social income summed, from the first claim year; its share of retirement spending
    const I = buildInputs(p, { today }).inputs;
    const social = I.incomes.filter((x) => x.kind === "social");
    assert.equal(d.withIncome.ssYearly, social.reduce((s, x) => s + x.yearly, 0));
    assert.equal(d.withIncome.ssFrom, Math.min(...social.map((x) => I.people[x.personIndex ?? 0].birthYear + x.startAge)));
    assert.ok(Math.abs(d.withIncome.ssShare - d.withIncome.ssYearly / I.spending.yearly) < 1e-12);
    // pensions and other income never count anyone's pay (review: the partner's salary read as a pension)
    assert.equal(d.withIncome.otherYearly, I.incomes.filter((x) => x.kind !== "social" && !/'s pay$/.test(x.name)).reduce((s, x) => s + x.yearly, 0));
    // the money they stop with: the projection's row for the stop year, what Will the money last? shows "At retirement"
    // (review 2026-11-02: it took the year before, and today's balance when stopping now)
    const r = at(p, e.personId, e.age);
    assert.equal(d.withIncome.atAgeReal, r.rows.find((row) => row.year === d.withIncome.stopYear).totalReal);
    const q = JSON.parse(JSON.stringify(p)); q.household.people.find((x) => x.id === e.personId).retirementAge = e.age;
    if (e.personId === q.household.people.find((x) => x.role === "self").id) assert.equal(d.withIncome.atAgeReal, projection(q, { today }).atRetirement.totalReal);
    // every other field is the 25-times rule exactly as before (the frozen key tests/golden/retirement/fire.csv)
    const { withIncome, ...rest } = d;
    const { withIncome: none, ...before } = compute(p, { today, withIncome: false });
    assert.equal(none, null); assert.deepEqual(rest, before);
  }
  // the retirement fixture's partner is still paid: $66,000 of pay is not "pensions"; only the $10,800 pension is
  assert.equal(compute(retirementPlan(), { today }).withIncome.otherYearly, 10800);
  // everyone stopped: the plan's own verdict, no age to find
  const late = retirementPlan(); for (const q of late.household.people) q.retirementAge = 50;
  const lr = incomeAnswer(late, today);
  assert.equal(lr.retired, true); assert.equal(typeof lr.lasts, "boolean"); assert.equal(lr.earliestAge, null);
  assert.equal(incomeAnswer(retirementPlan(), null), null);
});

test("round 5 review: the search starts now and has no floor at 45; a legacy goal is the one Goal seek starts from", async () => {
  const { earliestRetireAge } = await import("../../scenarios/goal-seek/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const today = "2026-11-02";
  // a frugal family: the plan works long before 45; the answer is not the bottom of the search
  const p = familyPlan(today); p.retirement.spendingMonthly = 3000;
  const e = earliestRetireAge(p, { today });
  assert.ok(e.age < 45, `found ${e.age}`);
  // a $300,000 legacy: this page and Goal seek search with the same goal
  const q = familyPlan(today); q.estate = { ...(q.estate ?? {}), legacy: { bequests: [{ id: "b1", to: "Cy", amount: 300000 }] } };
  const d = compute(q, { today });
  assert.equal(d.withIncome.legacy, 300000);
  assert.equal(d.withIncome.earliestAge, earliestRetireAge(q, { today, legacy: 300000 }).age);
  assert.ok(d.withIncome.earliestAge >= earliestRetireAge(q, { today }).age);
});

// review of the FIRE answer (round 5, 2026-11-02): who still works by exact age, the 9-in-10 age, rent and dividends after work
const TODAY = "2026-11-02";
const oneAdult = (birthDate, retirementAge) => {
  const p = emptyPlan();
  p.household.people.push({ id: "s", name: "Sam", role: "self", birthDate, retirementAge });
  p.accounts.push({ id: "b", name: "Brokerage", type: "brokerage", balance: 900000 });
  p.retirement.spendingMonthly = 5000; p.retirement.socialSecurity = { s: { claimAge: 67, monthlyAtFRA: 2800 } };
  p.income.push({ id: "i", name: "Pay", type: "salary", personId: "s", amount: 6000, period: "monthly" });
  return p;
};

test("who still works is by exact age: 64 today and 65 in December still works, and both ages stop this year", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { earliestRetireAge, compute: goalSeek } = await import("../../scenarios/goal-seek/compute.js");
  const p = oneAdult("1961-12-20", 65);
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.retired, false, "not 'You have stopped work'");
  assert.equal(w.ageNow, 64); assert.equal(w.plannedStopYear, 2026);
  const e = earliestRetireAge(p, { today: TODAY });
  assert.equal(e.stopYear, 2026); assert.equal(e.yearsSooner, 0, "64 now and 65 in December both stop in 2026");
  const lever = goalSeek(p, { today: TODAY }).levers.find((l) => l.id === "retire");
  assert.equal(lever.sentence, "This year, as planned."); assert.equal(lever.status, "same"); assert.equal(lever.value, 65);
  // a couple: Sam 59 today, stopping at 60 in December, is the one asked about, not "already retired"
  const c = retirementPlan(); c.household.people[0].birthDate = "1966-12-20"; c.household.people[0].retirementAge = 60;
  const cw = incomeAnswer(c, TODAY);
  assert.equal(cw.name, "Sam"); assert.deepEqual(cw.others.map((o) => o.retired), [false]);
  assert.equal(goalSeek(c, { today: TODAY }).levers.find((l) => l.id === "retire").sentence, "This year, as planned.");
  // past the planned age by exact age: retired
  assert.equal(incomeAnswer(oneAdult("1961-10-20", 65), TODAY).retired, true);
});

test("the 9-in-10 age: the first age the money lasts in at least 1,800 of the careful figure's 2,000 paths, steady spending", async () => {
  const { incomeAnswer, carefulAge, carefulAgeSteps } = await import("./compute.js");
  const { spendingAtChance } = await import("../monte-carlo/compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(TODAY);
  const w = incomeAnswer(p, TODAY);
  const c = carefulAge(p, { today: TODAY, legacy: w.legacy, personId: w.personId, from: w.earliestAge, upTo: w.upTo });
  assert.ok(c.age > w.earliestAge, `9 in 10 at ${c.age}, average markets at ${w.earliestAge}`);
  // the same paths and seed as Will the money last?: retiring at that age, its planned share is at least 9 in 10; a year sooner, less
  const share = (a) => { const q = JSON.parse(JSON.stringify(p)); q.household.people.find((x) => x.id === w.personId).retirementAge = a; return spendingAtChance(buildInputs(q, { today: TODAY }).inputs).planned; };
  assert.equal(share(c.age), c.share); assert.ok(c.share >= 0.9); assert.ok(share(c.age - 1) < 0.9);
  // the money at that age is the projection's "At retirement" for it
  const q = JSON.parse(JSON.stringify(p)); q.household.people[0].retirementAge = c.age;
  const { compute: projection } = await import("../projection/compute.js");
  assert.equal(c.atAgeReal, projection(q, { today: TODAY }).atRetirement.totalReal); assert.equal(c.stopYear, 1990 + c.age);
  // a slice at a time, the same answer; compute() carries it only when asked (the page asks after it is drawn)
  const it = carefulAgeSteps(p, { today: TODAY, legacy: w.legacy, personId: w.personId, from: w.earliestAge, upTo: w.upTo });
  let r, n = 0; while (!(r = it.next()).done) n++;
  assert.deepEqual(r.value, c); assert.ok(n > 20);
  assert.equal(compute(p, { today: TODAY }).withIncome.careful, undefined);
  assert.deepEqual(compute(p, { today: TODAY, careful: true }).withIncome.careful, c);
  // even 75 does not reach 9 in 10: no age, and the share it does reach
  const hard = familyPlan(TODAY); hard.retirement.spendingMonthly = 12000;
  const hw = incomeAnswer(hard, TODAY);
  // 74 with the projection's health line on top of the $12,000 a month (73 before it: Medicare is spending too); 75 since the
  // seventh pass (2026-11-06), Medicare holding the national Medigap Plan G average of $194 a month each
  assert.equal(hw.earliestAge, 75, "average markets: 75");
  const hc = carefulAge(hard, { today: TODAY, legacy: hw.legacy, personId: hw.personId, from: hw.earliestAge, upTo: hw.upTo });
  assert.equal(hc.age, null, `9 in 10 never by ${hw.upTo}`); assert.ok(hc.share < 0.9); assert.equal(hc.upTo, 75);
});

test("rent, and other income to its end date, go on after work stops (dividends are not added); a partner's pay is pay only", async () => {
  const { buildInputs, incomeOther } = await import("../projection/compute.js");
  const { project } = await import("../../../core/math/retirement.js");
  const { incomeAnswer } = await import("./compute.js");
  const p = retirementPlan();   // Sam (self) retires in 2033, Lee (partner) in 2037
  p.income.push(
    { id: "r", name: "Rental duplex", type: "rental", personId: "lee", amount: 2000, period: "monthly", growth: 0.02 },
    { id: "d", name: "Dividends", type: "investment", personId: "", amount: 1200, period: "quarterly", growth: 0 },
    { id: "o", name: "Royalties", type: "other", personId: "sam", amount: 300, period: "monthly", growth: 0, endDate: "2040-12-31" },
    { id: "x", name: "One-off gift", type: "support", personId: "sam", amount: 5000, period: "once" });
  const I = buildInputs(p, { today: TODAY }).inputs;
  const line = (n) => I.incomes.find((x) => x.name === n);
  // Lee's pay is the salary alone; the rent is its own line, from the household's retirement year, for life
  assert.equal(line("Lee's pay").yearly, 66000);
  assert.deepEqual([line("Rental duplex").yearly, line("Rental duplex").startAge, line("Rental duplex").endAge, line("Rental duplex").cola], [24000, 2033 - 1970, undefined, true]);
  // the household's dividends are not added (recheck 2026-11-05: the accounts' growth holds them); Sam's royalties stop with
  // their end date; one-offs are left out
  assert.equal(line("Dividends"), undefined);
  assert.equal(line("Royalties").endAge, 2040 - 1968); assert.equal(line("One-off gift"), undefined);
  // the engine: the rent comes in after Lee stops work (2037) and Sam's royalties stop after 2040
  const rows = project(I).rows;
  const has = (year, n) => rows.find((r) => r.year === year).incomeLines.some((l) => l.name === n);
  assert.ok(!has(2030, "Rental duplex"), "before retirement the plan's saving is what goes in");
  assert.ok(has(2033, "Rental duplex") && has(2040, "Rental duplex") && has(2060, "Rental duplex"));
  assert.ok(has(2040, "Royalties") && !has(2041, "Royalties"));
  assert.ok(!has(2038, "Lee's pay"), "pay stops when Lee stops work");
  // incomeOther: a future start date counts from then; an ended item not at all
  const later = incomeOther({ income: [{ type: "rental", amount: 1000, period: "monthly", startDate: "2040-01-01" }, { type: "rental", amount: 1000, period: "monthly", endDate: "2020-01-01" }] }, I.people, 2033, TODAY);
  assert.equal(later.length, 1); assert.equal(later[0].startAge, 2040 - 1968);
  // Financial independence counts them as income that is not pay, by kind (the dividends as not added)
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.otherYearly, 10800 + 24000 + 3600);
  assert.deepEqual([...w.otherKinds].sort(), ["other", "pension", "rent"]);
  assert.deepEqual(w.left, [{ name: "Dividends", yearly: 4800, why: "growth" }]);
});

// recheck 2026-11-05
test("recheck 2026-11-05: an adult counts as still working only with pay or a contribution (the retired couple: Sam has neither)", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  // Sam is 69 with a retirement age of 70, but his salary ended in 2025 and nothing goes in: not "Sam could stop work now"
  const w = incomeAnswer(retiredCouplePlan(), TODAY);
  assert.equal(w.retired, true); assert.equal(w.earliestAge, null); assert.equal(w.lasts, true);
  // with pay still coming in, he is the one asked about
  const paid = retiredCouplePlan(); paid.income.push({ id: "j", name: "Sam's job", type: "salary", personId: "p-sam", amount: 3000, period: "monthly" });
  assert.equal(incomeAnswer(paid, TODAY).name, "Sam");
  // a contribution alone also counts as working
  const saving = retiredCouplePlan(); saving.retirement.contributions.push({ id: "c", accountId: "a-roth", personId: "p-sam", amount: 500, period: "monthly", employerMatch: 0 });
  assert.equal(incomeAnswer(saving, TODAY).name, "Sam");
  // a plan with nothing on the Income page and no contributions: by age, as before (nothing says they stopped)
  const blank = oneAdult("1980-01-01", 65); blank.income = [];
  assert.equal(incomeAnswer(blank, TODAY).retired, false);
  // the partner of someone still working: not working when they have no pay, even before their retirement age (the page says
  // "not working" for them: see "not working" below)
  const c = retirementPlan(); c.income = c.income.filter((x) => x.personId !== "lee"); c.retirement.contributions = c.retirement.contributions.filter((x) => x.personId !== "lee");
  assert.deepEqual(incomeAnswer(c, TODAY).others.map((o) => [o.name, o.retired]), [["Lee", true]]);
});

test("recheck 2026-11-05: Social Security typed on the Income page is 'already being paid'", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const w = incomeAnswer(retiredCouplePlan(), TODAY);
  assert.equal(w.ssFrom, 2026); assert.equal(w.ssPaidNow, true);
  // the Social Security page's claim at 67 is not paid yet
  assert.equal(incomeAnswer(retirementPlan(), TODAY).ssPaidNow, false);
  // one typed on Income with a start date to come is not paid yet either
  const later = retiredCouplePlan(); later.income.find((x) => x.id === "i-ss").startDate = "2027-03-01";
  assert.equal(incomeAnswer(later, TODAY).ssPaidNow, false);
});

test("recheck 2026-11-05: what is counted after work stops, and what is not, by kind", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const w = incomeAnswer(retiredCouplePlan(), TODAY);
  // the pension ($18,000) and the rent ($24,000); the dividends are not added (the brokerage's growth holds them)
  assert.equal(w.otherYearly, 18000 + 24000); assert.deepEqual([...w.otherKinds].sort(), ["pension", "rent"]);
  assert.deepEqual(w.left.map((x) => [x.name, x.yearly, x.why]), [["Dividends", 4800, "growth"]]);
  // help from parents with no end date: named as not counted after work stops, never as counted
  const p = retirementPlan(); p.income.push({ id: "h", name: "Help from parents", type: "support", personId: "", amount: 400, period: "monthly" });
  const v = incomeAnswer(p, TODAY);
  assert.equal(v.otherYearly, 10800); assert.deepEqual(v.left.map((x) => [x.name, x.yearly, x.why]), [["Help from parents", 4800, "work"]]);
  assert.equal(v.strategy, "fixed-real");
});

// recheck 2026-11-05, second pass (verify of the first pass): the first adult's planned age sets the year the plan starts
// spending from savings, so "no pay line" alone never makes them "stopped"; someone who said they stopped spends from now
test("recheck 2026-11-05: the first adult with no pay line before their planned age is still asked about (between jobs), never 'stopped'", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { compute: goalSeek } = await import("../../scenarios/goal-seek/compute.js");
  const { buildInputs } = await import("../projection/compute.js");
  const { project } = await import("../../../core/math/retirement.js");
  // Sam, 45, laid off: the salary ended last month, nothing saved since, retirement age 65 as planned
  const p = oneAdult("1981-03-01", 65); p.income[0].endDate = "2026-10-15";
  const w = incomeAnswer(p, TODAY);
  // the plan has no spending from savings until 2046: "You have stopped work, the money lasts" was worked out on that
  assert.equal(w.retired, false); assert.equal(w.name, "Sam");
  assert.equal(w.earliestAge, goalSeek(p, { today: TODAY }).levers.find((l) => l.id === "retire").value);
  // stopping now, the money runs out (the check the retired branch would have had to pass)
  const now = JSON.parse(JSON.stringify(p)); now.household.people[0].retirementAge = 45;
  assert.equal(project(buildInputs(now, { today: TODAY }).inputs).success, false);
  // a couple: Sam laid off, Lee working; Lee is not told "could stop work now" while Sam's planned age keeps the plan off savings
  const c = oneAdult("1981-03-01", 65); c.income[0].endDate = "2026-10-15";
  c.household.people.push({ id: "l", name: "Lee", role: "partner", birthDate: "1983-04-04", retirementAge: 65 });
  c.income.push({ id: "il", name: "Lee's pay", type: "salary", personId: "l", amount: 9000, period: "monthly" });
  const cw = incomeAnswer(c, TODAY);
  assert.equal(cw.name, "Sam"); assert.deepEqual(cw.others.map((o) => [o.name, o.retired]), [["Lee", false]]);
  // said "retired" in Get started: the retired answer spends from savings from this year, not from the 65 on file
  const r = oneAdult("1966-04-10", 65); r.income[0].endDate = "2026-06-30"; r.guide = { setup: { status: { s: "retired" } } };
  r.accounts[0].balance = 700000; r.retirement.spendingMonthly = 4500;
  const rw = incomeAnswer(r, TODAY);
  const r2 = JSON.parse(JSON.stringify(r)); r2.household.people[0].retirementAge = 60;
  const stop = project(buildInputs(r2, { today: TODAY }).inputs);
  assert.equal(rw.retired, true); assert.equal(rw.lasts, stop.success); assert.equal(rw.failYear, stop.failYear ?? null);
  assert.equal(rw.lasts, false);
  // the retired couple is unchanged: Sam (a partner, no pay) has stopped, and nothing moves for him
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const rc = incomeAnswer(retiredCouplePlan(), TODAY);
  assert.equal(rc.retired, true); assert.equal(rc.lasts, true);
});

test("recheck 2026-11-05: a partner under their retirement age with no pay is 'not working', not 'already retired'", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const c = retirementPlan(); c.income = c.income.filter((x) => x.personId !== "lee"); c.retirement.contributions = c.retirement.contributions.filter((x) => x.personId !== "lee");
  assert.deepEqual(incomeAnswer(c, TODAY).others.map((o) => [o.name, o.retired, o.notWorking]), [["Lee", true, true]]);
  // one who said "retired" in Get started is "already retired", whatever age is on file
  c.guide = { setup: { status: { lee: "retired" } } };
  assert.deepEqual(incomeAnswer(c, TODAY).others.map((o) => [o.name, o.retired, o.notWorking]), [["Lee", true, false]]);
});

test("recheck 2026-11-05: the first adult said 'retired' before their planned age and the partner works: the partner's age is worked out with the first adult stopped now", async () => {
  const { incomeAnswer, carefulAge, compute: fire } = await import("./compute.js");
  const { earliestRetireAge } = await import("../../scenarios/goal-seek/compute.js");
  // Pat (60, 65 still on file) said "retired" in Get started; Tom (58) works. With Pat's 65 on file the plan spends nothing
  // from savings until 2031, so Tom read "could stop work now ... with Pat already retired"; stopping both now runs out
  const p = emptyPlan();
  p.household.people.push({ id: "s", name: "Pat", role: "self", birthDate: "1966-04-10", retirementAge: 65 }, { id: "t", name: "Tom", role: "partner", birthDate: "1968-05-05", retirementAge: 65 });
  p.accounts.push({ id: "b", name: "Brokerage", type: "brokerage", balance: 700000 });
  p.retirement.spendingMonthly = 6000; p.retirement.socialSecurity = { s: { claimAge: 67, monthlyAtFRA: 2000 }, t: { claimAge: 67, monthlyAtFRA: 2200 } };
  p.income.push({ id: "i", name: "Pat's pay", type: "salary", personId: "s", amount: 6000, period: "monthly", endDate: "2026-06-30" }, { id: "j", name: "Tom's pay", type: "salary", personId: "t", amount: 7000, period: "monthly" });
  p.guide = { setup: { status: { s: "retired", t: "work" } } };
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.name, "Tom"); assert.deepEqual(w.stopNow, [{ personId: "s", age: 60 }]);
  const stopped = JSON.parse(JSON.stringify(p)); stopped.household.people[0].retirementAge = 60;
  const e = earliestRetireAge(stopped, { today: TODAY, personId: "t", legacy: w.legacy });
  assert.equal(w.earliestAge, e.age); assert.equal(w.now, false); assert.ok(w.earliestAge > 58);
  assert.deepEqual(w.others.map((o) => [o.name, o.retired, o.notWorking]), [["Pat", true, false]]);
  // the 9-in-10 age is searched on the same plan, on this machine (carefulAge with stopNow) and from compute
  const opts = { today: TODAY, legacy: w.legacy, personId: "t", from: w.earliestAge, upTo: w.upTo, paths: 200 };
  assert.deepEqual(carefulAge(p, { ...opts, stopNow: w.stopNow }), carefulAge(stopped, opts));
  assert.equal(fire(p, { today: TODAY, careful: true }).withIncome.careful.age, carefulAge(stopped, { ...opts, paths: undefined }).age);
  // nobody said they stopped: nothing is changed (the household's own plan, as Goal seek searches it)
  assert.deepEqual(incomeAnswer(retirementPlan(), TODAY).stopNow, []);
});

test("recheck 2026-11-05: Social Security typed on the Income page that starts later this year is not 'already being paid'", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const p = retiredCouplePlan(); p.income.find((x) => x.id === "i-ss").startDate = "2026-12-01";   // today is 2026-11-02
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.ssFrom, 2026); assert.equal(w.ssPaidNow, false);
  // from today it is
  p.income.find((x) => x.id === "i-ss").startDate = TODAY;
  assert.equal(incomeAnswer(p, TODAY).ssPaidNow, true);
});

// review 2026-11-06 (verify of the second pass)
const condoCouple = () => {
  // Dee (63, stops at 64) and Ray (64, stops at 64), working; their only other income is rent from a condo numbered 401B
  const p = emptyPlan();
  p.household.people.push({ id: "d", name: "Dee", role: "self", birthDate: "1963-09-01", retirementAge: 64 }, { id: "r", name: "Ray", role: "partner", birthDate: "1962-01-15", retirementAge: 64 });
  p.household.filingStatus = "married_joint";
  p.accounts.push({ id: "a1", name: "Dee's 401(k)", type: "401k", balance: 380000, ownerId: "d" }, { id: "a2", name: "Ray's IRA", type: "ira", balance: 220000, ownerId: "r" }, { id: "a3", name: "Savings", type: "savings", balance: 50000 });
  p.income.push({ id: "i1", name: "Dee's salary", type: "salary", personId: "d", amount: 5500, period: "monthly" }, { id: "i2", name: "Ray's salary", type: "salary", personId: "r", amount: 4000, period: "monthly" }, { id: "i3", name: "Rent from condo 401B", type: "rental", personId: "d", amount: 1800, period: "monthly", growth: 0.02 });
  p.retirement.spendingMonthly = 6500; p.retirement.socialSecurity = { d: { claimAge: 67, monthlyAtFRA: 2100 }, r: { claimAge: 67, monthlyAtFRA: 2300 } };
  return p;
};

test("review 2026-11-06: rent named by its unit ('Rent from condo 401B') counts after work stops: Dee could stop now, not work to 74", async () => {
  const { incomeAnswer, carefulAge } = await import("./compute.js");
  const { compute: projection } = await import("../projection/compute.js");
  // the second pass read the rent as a 401(k): "Runs out in 2049", carries $72,547, and "Dee would need to work until 74"
  // (average 66). An independent year-by-year model: the plan lasts, carries $94,147, $845,656 left in 2058, Dee 63 now
  const p = condoCouple();
  // those figures are the plan's spending with health cover in it ("My spending figure already includes health cover"); with the
  // projection's health line on top (review 2026-11-06: Medicare for both, $180,579 in all) it lasts and carries $88,504;
  // seventh pass (2026-11-06): Medicare holds a supplement too, the national Medigap Plan G average of $194 a month each
  // ($324,915 in all), so it carries $84,000, leaves $328,357, and lasts in 9 of 10 markets from 65 (63 before; with the
  // supplement set to $0 every figure is as before)
  const inc = condoCouple(); inc.retirement.healthIncluded = true;
  const d0 = projection(inc, { today: TODAY });
  assert.equal(d0.result.success, true); assert.equal(Math.round(d0.affordable), 94147); assert.equal(Math.round(d0.atEnd.totalReal), 845656);
  const d = projection(p, { today: TODAY });
  assert.equal(d.result.success, true); assert.equal(Math.round(d.affordable), 84000, "was 94,147 with no health line, 88,504 with no supplement"); assert.equal(Math.round(d.atEnd.totalReal), 328357);
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.otherYearly, 21600); assert.deepEqual(w.otherKinds, ["rent"]); assert.deepEqual(w.left, []);
  assert.equal(w.name, "Dee"); assert.equal(w.earliestAge, 63); assert.equal(w.now, true);
  assert.equal(carefulAge(p, { today: TODAY, legacy: w.legacy, personId: w.personId, from: w.earliestAge, upTo: w.upTo, stopNow: w.stopNow }).age, 65);
  // Ray (64, on salary, 64 on file) stops this year as planned: not "already retired" (fire-ver8b; seventh pass)
  assert.deepEqual(w.others, [{ name: "Ray", retireAge: 64, retired: true, notWorking: false, stoppingNow: true }]);
});

test("review 2026-11-06: other income that stops says when (child support to the child's 18th), and how much of it", async () => {
  const { incomeAnswer } = await import("./compute.js");
  // Sam (60, stops at 62) with Ben (born 2016): child support from 2028 with no end date runs to Ben's 18th, 2034. The page
  // said "plus $14,400 a year of other income", and at 71 none of it is paid
  const p = emptyPlan();
  p.household.people.push({ id: "s", name: "Sam", role: "self", birthDate: "1966-03-01", retirementAge: 62 }, { id: "b", name: "Ben", role: "dependent", birthDate: "2016-05-01" });
  p.accounts.push({ id: "k", name: "Brokerage", type: "brokerage", balance: 300000 });
  p.retirement.spendingMonthly = 4000; p.retirement.socialSecurity = { s: { claimAge: 67, monthlyAtFRA: 2300 } };
  p.income.push({ id: "i", name: "Pay", type: "salary", personId: "s", amount: 6000, period: "monthly" }, { id: "c", name: "Child support for Ben", type: "support", personId: "s", amount: 1200, period: "monthly", startDate: "2028-01-01" });
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.otherYearly, 14400); assert.deepEqual(w.otherEnding, { yearly: 14400, by: 2034, all: true, steps: [{ until: 2034, yearly: 14400 }] });
  // with a pension for life too, only part of it stops
  p.income.push({ id: "pn", name: "Army pension", type: "pension", personId: "s", amount: 1000, period: "monthly", startDate: "2028-03-01" });
  assert.deepEqual(incomeAnswer(p, TODAY).otherEnding, { yearly: 14400, by: 2034, all: false, steps: [{ until: 2034, yearly: 14400 }] });
  // rent and a pension for life: nothing stops
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  assert.equal(incomeAnswer(retiredCouplePlan(), TODAY).otherEnding, null);
});

test("review 2026-11-06: the first adult counted as stopped now while a later age is on file is named, with the year Will the money last? uses", async () => {
  const { incomeAnswer } = await import("./compute.js");
  // Sam (60) said "retired" in Get started with 65 still on file: this page spends savings from now ("runs short in 2052"),
  // Will the money last? from 2031 ("It lasts, just"), and nothing said why the two differ
  const r = oneAdult("1966-04-10", 65); r.income[0].endDate = "2026-06-30"; r.guide = { setup: { status: { s: "retired" } } };
  r.accounts[0].balance = 700000; r.retirement.spendingMonthly = 4500;
  const rw = incomeAnswer(r, TODAY);
  assert.equal(rw.retired, true); assert.equal(rw.lasts, false);
  // review 2026-11-06: Will the money last? now starts spending savings this year too (projection householdRetireYear: nobody
  // works), so the two pages agree and there is nothing to explain (was { s, Sam, 60, 65, 2031 })
  assert.equal(rw.plannedStop, null);
  const { compute: projection } = await import("../projection/compute.js");
  assert.equal(projection(r, { today: TODAY }).inputs.retireYear, 2026);
  // a partner asked about while the first adult said "retired": the same
  const p = emptyPlan();
  p.household.people.push({ id: "s", name: "Pat", role: "self", birthDate: "1966-04-10", retirementAge: 65 }, { id: "t", name: "Tom", role: "partner", birthDate: "1968-05-05", retirementAge: 65 });
  p.accounts.push({ id: "b", name: "Brokerage", type: "brokerage", balance: 700000 });
  p.retirement.spendingMonthly = 6000; p.retirement.socialSecurity = { s: { claimAge: 67, monthlyAtFRA: 2000 }, t: { claimAge: 67, monthlyAtFRA: 2200 } };
  p.income.push({ id: "i", name: "Pat's pay", type: "salary", personId: "s", amount: 6000, period: "monthly", endDate: "2026-06-30" }, { id: "j", name: "Tom's pay", type: "salary", personId: "t", amount: 7000, period: "monthly" });
  p.guide = { setup: { status: { s: "retired", t: "work" } } };
  const w = incomeAnswer(p, TODAY);
  // seventh pass (2026-11-06): Will the money last? starts spending this year too, with Tom's pay as income (projection
  // householdRetireYear), so there is nothing to explain (was { s, Pat, 60, 65, 2031 })
  assert.equal(w.name, "Tom"); assert.equal(w.plannedStop, null);
  const pt = projection(p, { today: TODAY });
  assert.equal(pt.inputs.retireYear, 2026); assert.deepEqual(pt.retireBy.working.map((x) => [x.name, x.untilYear]), [["Tom", 2032]]);
  // with the age on file matching (or nobody stopped early) there is nothing to say
  r.household.people[0].retirementAge = 60;
  assert.equal(incomeAnswer(r, TODAY).plannedStop, null);
  assert.equal(incomeAnswer(retirementPlan(), TODAY).plannedStop, null);
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  assert.equal(incomeAnswer(retiredCouplePlan(), TODAY).plannedStop, null);
});

test("review 2026-11-06 (verify): a first adult who said 'Not working now' is named as not working, not as stopped", async () => {
  const { incomeAnswer } = await import("./compute.js");
  // Elena (35, at home) said "Not working now" in Get started, which keeps 65 on file; Marcus works. The page said "This
  // counts Elena as stopped from this year ... If Elena has stopped, set Elena's retirement age to 35", a retirement age of 35
  // for a parent at home
  const p = emptyPlan();
  p.household.people.push({ id: "e", name: "Elena", role: "self", birthDate: "1991-03-03", retirementAge: 65 }, { id: "m", name: "Marcus", role: "partner", birthDate: "1989-05-05", retirementAge: 65 }, { id: "k", name: "Kai", role: "dependent", birthDate: "2020-01-01" });
  p.household.filingStatus = "married_joint";
  p.accounts.push({ id: "a1", name: "Marcus's 401(k)", type: "401k", balance: 90000, ownerId: "m" }, { id: "a2", name: "Savings", type: "savings", balance: 15000 });
  p.income.push({ id: "i1", name: "Marcus's salary", type: "salary", personId: "m", amount: 7500, period: "monthly", growth: 0.03 });
  p.retirement.contributions = [{ id: "c1", accountId: "a1", personId: "m", amount: 500, period: "monthly", employerMatch: 3000 }];
  p.retirement.spendingMonthly = 6000; p.retirement.socialSecurity = { e: { claimAge: 67, monthlyAtFRA: 1100 }, m: { claimAge: 67, monthlyAtFRA: 2600 } };
  p.guide = { setup: { status: { e: "none", m: "work" } } };
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.name, "Marcus");
  // review 2026-11-06: Will the money last? lived on Marcus's pay until he stopped at 65, in 2054 (plannedStop { e, Elena, 35, 65,
  // 2054, notWorking, by Marcus }); seventh pass: it started spending this year with his pay as income; its verify: Elena is a
  // parent at home under 55 (STOP_NOW_FROM_AGE), a one-earner family, so the household works until Marcus stops again (2054)
  assert.deepEqual(w.plannedStop, { personId: "e", name: "Elena", age: 35, plannedAge: 65, plannedYear: 2054, notWorking: true, by: { name: "Marcus", age: 65 } });
  const { compute: projection } = await import("../projection/compute.js");
  const pe = projection(p, { today: TODAY });
  assert.equal(pe.inputs.retireYear, 2054);
  // one who said "retired" is not "not working"
  p.guide.setup.status.e = "retired";
  assert.equal(projection(p, { today: TODAY }).retireBy.notWorking, false);
});

// review 2026-11-02: the projection takes a health premium out of today's expenses (its health line pays cover from
// retirement on); this page has no health line, so the FI number is still on all of today's spending, premium included
test("fire: a health premium on Expenses stays in the spending the FI number is worked on", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-11-02"); p.retirement.spendingMonthly = null;
  const before = compute(p, { today: "2026-11-02" });
  p.expenses.push({ id: "hi", name: "Health insurance", category: "health", amount: 600, period: "monthly", essential: true, inflates: true });
  const d = compute(p, { today: "2026-11-02" });
  assert.ok(Math.abs(d.spendingYearly - (before.spendingYearly + 7200)) < 0.01, `${d.spendingYearly} vs ${before.spendingYearly} + 7,200`);
  // fix round 1 (2026-11-11, money review D11): the spending that goes on for good is today's bills without the loan payments that
  // end (the mortgage, the Visa and the car loan: $33,480 a year, the last paid off by 2046; they are spent only until each
  // payoff): 77,116 - 33,480 = 43,636 (the reviewer's 77,116, 69,916 + 7,200, is the whole of today's bills). What is still owed on
  // those loans is added to the target instead, so the loans are counted once, at what it takes to pay them off
  assert.ok(Math.abs(d.spendingYearly - 43636) < 1, String(d.spendingYearly));
  assert.ok(Math.abs(d.spendingYearly + d.loansEnding.yearly - 77116) < 1, String(d.loansEnding.yearly));
  assert.ok(d.loansEnding.owed > 0);
  assert.ok(Math.abs(d.fiNumber - (d.spendingYearly / d.withdrawalRate + d.loansEnding.owed)) < 0.01);
});

// review 2026-11-02 (fifth pass): the rule of thumb's fold, and who the answer is about when Get started says the first adult
// does not work
test("fifth pass: the fold says the rule leaves out health insurance before Medicare, which the answer above counts", async () => {
  const { ruleWords } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const d = compute(familyPlan(TODAY), { today: TODAY, withIncome: false });
  assert.equal(d.healthAdded, true);
  assert.match(ruleWords(25, d.healthAdded), /leaves out Social Security, pensions, taxes and health insurance before Medicare, which the answer above counts, so it can come out sooner or later/);
  // "my spending figure already includes health cover": the rule's spending holds it, so no such words
  const q = familyPlan(TODAY); q.retirement.healthIncluded = true;
  assert.equal(compute(q, { today: TODAY, withIncome: false }).healthAdded, false);
  assert.match(ruleWords(25, false), /leaves out Social Security, pensions and taxes, so it can come out/);
});

test("fifth pass: with the first adult not working now, the answer is about the one who still works", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { earliestRetireAge, compute: goalSeek } = await import("../../scenarios/goal-seek/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(TODAY);
  p.income = p.income.filter((x) => x.personId !== "p-ana"); p.retirement.contributions = p.retirement.contributions.filter((c) => c.personId !== "p-ana");
  p.guide = { setup: { status: { "p-ana": "none" } } };
  // was: about Ana, whose retirement age no longer moves the household's retirement (Bo's stop starts it)
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.name, "Bo"); assert.equal(w.personId, "p-bo");
  assert.equal(earliestRetireAge(p, { today: TODAY }).personId, "p-bo");
  assert.equal(goalSeek(p, { today: TODAY }).levers.find((l) => l.id === "retire").title, "When Bo can retire");
  // nobody works: no age to find, the plan's own verdict
  const q = JSON.parse(JSON.stringify(p)); q.guide.setup.status["p-bo"] = "retired";
  assert.equal(incomeAnswer(q, TODAY).retired, true);
  assert.equal(earliestRetireAge(q, { today: TODAY }), null);
  assert.equal(goalSeek(q, { today: TODAY }).levers.find((l) => l.id === "retire"), undefined);
});

test("fifth pass: rent is told from pay by its kind, never its name: a rental called \"Lee's pay\" counts as rent", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const p = retirementPlan();
  p.income = p.income.filter((x) => x.personId !== "lee").concat({ id: "r", name: "Lee's pay", type: "rental", personId: "lee", amount: 1500, period: "monthly", growth: 0, taxable: true });
  const w = incomeAnswer(p, TODAY);
  // was: left out of "pensions, rent, dividends and other income" because its name ends in "'s pay"
  assert.equal(w.otherYearly, 10800 + 18000); assert.deepEqual([...w.otherKinds].sort(), ["pension", "rent"]);
  // a partner's real pay is still pay (kind "pay"), never counted as other income
  assert.equal(incomeAnswer(retirementPlan(), TODAY).otherYearly, 10800);
});

// ---- review 2026-11-06 (sixth pass, defect 2 of the health line's fifth-pass verify): one work rule with the health line and
// Goal seek (projection workingNow on workRule)
const couple6863 = (boAge = 66, said = true) => {
  // Ana (68, 60 on file) and Bo (63) with nothing on Income and no contributions; Get started has Ana "retired"
  const o = familyPlan(TODAY); o.household.people = o.household.people.filter((x) => x.role !== "dependent");
  o.household.people[0].birthDate = "1958-03-01"; o.household.people[1].birthDate = "1963-06-01";
  o.household.people[0].retirementAge = 60; o.household.people[1].retirementAge = boAge;
  o.income = []; o.retirement.contributions = []; o.retirement.spendingMonthly = null;
  o.expenses.push({ id: "mc", name: "Medicare Part B", category: "health", amount: 203, period: "monthly", essential: true, inflates: true });
  if (said) o.guide = { setup: { status: { "p-ana": "retired" } } };
  return o;
};

test("review 2026-11-06 (defect 2): a partner with no pay is not asked about, even with nothing on Income: the health line's and Goal seek's rule", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { compute: projection } = await import("../projection/compute.js");
  const { compute: healthcare } = await import("../healthcare/compute.js");
  const { compute: goalSeek } = await import("../../scenarios/goal-seek/compute.js");
  for (const said of [true, false]) {
    const p = couple6863(66, said);
    const w = incomeAnswer(p, TODAY), d = projection(p, { today: TODAY });
    // was "Even working to 75, the money runs short ... and Bo works until 75": Bo's age moves nothing in this plan
    assert.equal(w.retired, true, `said ${said}`); assert.equal(w.earliestAge, null); assert.deepEqual(w.others, []);
    assert.equal(w.lasts, d.result.success); assert.equal(w.failYear, d.shortYear ?? null);
    assert.equal(d.inputs.retireYear, 2026);
    assert.equal(goalSeek(p, { today: TODAY }).levers.some((l) => l.id === "retire"), false);
    assert.deepEqual(healthcare(p, { today: TODAY }).years.map((y) => [y.year, y.covered.join()]), [[2026, "Bo"], [2027, "Bo"]], "Bo is priced as not working");
  }
  // Lee with her salary taken out, rent and her IRA saving kept, Sam working: "Lee not working" (was "Lee stopping at 67 as
  // planned"), as the health line prices her own cover in 2033-2034
  const r = retirementPlan(); r.income = r.income.filter((x) => x.personId !== "lee").concat({ id: "rent", name: "Rental condo", type: "rental", personId: "lee", amount: 1500, period: "monthly", growth: 0.02, taxable: true });
  const lw = incomeAnswer(r, TODAY);
  assert.equal(lw.name, "Sam"); assert.deepEqual(lw.others.map((o) => [o.name, o.retired, o.notWorking]), [["Lee", true, true]]);
  assert.deepEqual(healthcare(r, { today: TODAY }).years.map((y) => [y.year, y.covered.join()]), [[2033, "Lee"], [2034, "Lee"]]);
});

test("review 2026-11-06: Financial independence and Goal seek ask about the same adult, on the same plan, and give one age", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { compute: goalSeek } = await import("../../scenarios/goal-seek/compute.js");
  const retireLever = (p) => goalSeek(p, { today: TODAY }).levers.find((l) => l.id === "retire") ?? null;
  // Pat (60, 65 on file) said "retired", Tom (58) works: both pages search Tom's age with Pat stopping now (Goal seek asked
  // about Pat, whose age could not move: the fifth pass about Tom, but on the plan with Pat working to 65)
  const p = emptyPlan();
  p.household.people.push({ id: "s", name: "Pat", role: "self", birthDate: "1966-04-10", retirementAge: 65 }, { id: "t", name: "Tom", role: "partner", birthDate: "1968-05-05", retirementAge: 65 });
  p.accounts.push({ id: "b", name: "Brokerage", type: "brokerage", balance: 700000 });
  p.retirement.spendingMonthly = 6000; p.retirement.socialSecurity = { s: { claimAge: 67, monthlyAtFRA: 2000 }, t: { claimAge: 67, monthlyAtFRA: 2200 } };
  p.income.push({ id: "i", name: "Pat's pay", type: "salary", personId: "s", amount: 6000, period: "monthly", endDate: "2026-06-30" }, { id: "j", name: "Tom's pay", type: "salary", personId: "t", amount: 7000, period: "monthly" });
  p.guide = { setup: { status: { s: "retired", t: "work" } } };
  const w = incomeAnswer(p, TODAY), l = retireLever(p);
  assert.equal(w.name, "Tom"); assert.equal(l.title, "When Tom can retire");
  assert.equal(l.value, w.earliestAge); assert.match(l.sentence, /This counts Pat as stopped from this year\.$/);
  // the first adult past their own age with no answer and a partner at work: the partner, on both (Goal seek had no lever)
  const q = retirementPlan(); q.household.people[0].birthDate = "1958-04-10";   // Sam 68, 65 on file
  assert.equal(incomeAnswer(q, TODAY).name, "Lee"); assert.equal(retireLever(q).title, "When Lee can retire");
  assert.equal(retireLever(q).value, incomeAnswer(q, TODAY).earliestAge);
  // nobody works: no question on either page; the family: Ana on both, as before
  assert.equal(retireLever(couple6863()), null);
  assert.equal(retireLever(familyPlan(TODAY)).title, "When Ana can retire"); assert.equal(incomeAnswer(familyPlan(TODAY), TODAY).name, "Ana");
});

test("review 2026-11-06: a partner who works by a Get started answer or saving alone is searched on the plan as it is (no pay to count with the first adult stopped)", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { compute: goalSeek } = await import("../../scenarios/goal-seek/compute.js");
  // the family with nothing on Income, Ana "not working now", Bo saving into his Roth: the household lives on Bo's work until he
  // stops (Will the money last? retires in 2050); with Ana stopping now his pay is in no line, so only his saving moved
  const p = familyPlan(TODAY); p.income = []; p.guide = { setup: { status: { "p-ana": "none" } } };
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.name, "Bo"); assert.deepEqual(w.stopNow, [], "was Ana stopping now: 'Not by 75'"); assert.equal(w.plannedStop, null);
  // (64 since the seventh pass: Medicare holds the national Medigap Plan G average, $194 a month each; 63 before)
  assert.equal(w.earliestAge, 64); assert.equal(goalSeek(p, { today: TODAY }).levers.find((l) => l.id === "retire").value, 64);
});

test("review 2026-11-06: the year Will the money last? starts spending is named by whose stop it is (plannedStop.by)", async () => {
  const { incomeAnswer, plannedStopWords } = await import("./compute.js");
  // Elena (35) said "Not working now", Marcus (37) works to 65 (2054): the projection lives on his pay until then
  const p = emptyPlan();
  p.household.people.push({ id: "e", name: "Elena", role: "self", birthDate: "1991-03-03", retirementAge: 65 }, { id: "m", name: "Marcus", role: "partner", birthDate: "1989-05-05", retirementAge: 65 });
  p.accounts.push({ id: "a1", name: "Marcus's 401(k)", type: "401k", balance: 90000, ownerId: "m" }, { id: "a2", name: "Savings", type: "savings", balance: 15000 });
  p.income.push({ id: "i1", name: "Marcus's salary", type: "salary", personId: "m", amount: 7500, period: "monthly", growth: 0.03 });
  p.retirement.contributions = [{ id: "c1", accountId: "a1", personId: "m", amount: 500, period: "monthly", employerMatch: 3000 }];
  p.retirement.spendingMonthly = 6000; p.retirement.socialSecurity = { e: { claimAge: 67, monthlyAtFRA: 1100 }, m: { claimAge: 67, monthlyAtFRA: 2600 } };
  p.guide = { setup: { status: { e: "none", m: "work" } } };
  // seventh pass (2026-11-06): the projection started spending this year with Marcus's pay as income; its verify: Elena is a
  // parent at home under 55, so the household lives on his pay until he stops (2054) again, and the words do not tell her to
  // set a retirement age of 35 (that would count the household as retired now)
  const ps = incomeAnswer(p, TODAY).plannedStop;
  assert.deepEqual(ps, { personId: "e", name: "Elena", age: 35, plannedAge: 65, plannedYear: 2054, notWorking: true, by: { name: "Marcus", age: 65 } });
  assert.equal(plannedStopWords(ps), "This counts Elena as not working now. Will the money last? counts the household as living on Marcus's pay until Marcus stops work at 65, so it starts spending savings only in 2054. Who works, and until what age, is on the ");
  // at 55 or over, "not working now" with a partner who has no pay is the case the old words were for
  assert.equal(plannedStopWords({ ...ps, age: 58 }), "This counts Elena as not working from this year on. Will the money last? counts the household as living on Marcus's pay until Marcus stops work at 65, so it starts spending savings only in 2054. If Elena does not go back to work, set Elena's retirement age to 58 on the ");
  // the year being the first adult's own: as before (Pat, 65 on file, Tom working to 65 in 2033)
  assert.equal(plannedStopWords({ personId: "s", name: "Pat", age: 60, plannedAge: 65, plannedYear: 2031 }), "This counts Pat as stopped from this year. Your plan still has Pat stopping work at 65, so Will the money last? starts spending savings only in 2031. If Pat has stopped, set Pat's retirement age to 60 on the ");
  assert.equal(plannedStopWords({ personId: "s", name: "Me", age: 60, plannedAge: 65, plannedYear: 2031 }).startsWith("This counts you as stopped from this year. Your plan still has you stopping"), true);
  assert.equal(plannedStopWords(null), "");
});

test("seventh pass (fire-ver8b): other income that stops in steps is said step by step, each year with what is still paid", async () => {
  const { incomeAnswer, otherEndWords } = await import("./compute.js");
  // Sam (60, stops at 62) with Ben (born 2016): child support $1,200 a month to Ben's 18th (2034) and alimony $1,500 a month to
  // the end of 2030. The page read "$32,400 a year of other income until 2034", while from 2031 only $14,400 is paid
  const p = emptyPlan();
  p.household.people.push({ id: "s", name: "Sam", role: "self", birthDate: "1966-03-01", retirementAge: 62 }, { id: "b", name: "Ben", role: "dependent", birthDate: "2016-05-01" });
  p.accounts.push({ id: "k", name: "Brokerage", type: "brokerage", balance: 300000 });
  p.retirement.spendingMonthly = 4000; p.retirement.socialSecurity = { s: { claimAge: 67, monthlyAtFRA: 2300 } };
  p.income.push({ id: "i", name: "Pay", type: "salary", personId: "s", amount: 6000, period: "monthly" },
    { id: "c", name: "Child support for Ben", type: "support", personId: "s", amount: 1200, period: "monthly" },
    { id: "a", name: "Alimony", type: "support", personId: "s", amount: 1500, period: "monthly", endDate: "2030-12-31" });
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.otherYearly, 32400);
  assert.deepEqual(w.otherEnding, { yearly: 32400, by: 2034, all: true, steps: [{ until: 2030, yearly: 18000 }, { until: 2034, yearly: 14400 }] });
  assert.equal(otherEndWords(w.otherEnding, w.otherYearly), " until 2030, then $14,400 until 2034");
  // with a pension for life too, only part of it stops: each part with its year
  p.income.push({ id: "pn", name: "Army pension", type: "pension", personId: "s", amount: 1000, period: "monthly" });
  const v = incomeAnswer(p, TODAY);
  assert.equal(otherEndWords(v.otherEnding, v.otherYearly), " ($18,000 of it only until 2030 and $14,400 only until 2034)");
  // one step, as before
  assert.equal(otherEndWords({ yearly: 14400, by: 2034, all: true, steps: [{ until: 2034, yearly: 14400 }] }, 14400), " until 2034");
  assert.equal(otherEndWords({ yearly: 14400, by: 2034, all: false }, 26400), " ($14,400 of it only until 2034)");
  assert.equal(otherEndWords(null, 0), "");
});

test("round 8 batch 6 verify: a rental's loan payment that the spending gives back after payoff is not rent; the rent counted is after its running costs", async () => {
  const { incomeAnswer } = await import("./compute.js");
  const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  // Condo: 2,100 x 12 = 25,200, less 5% empty months (1,260) and 12,700 of running costs = 11,240 a year. On the plan whose
  // spending (Get started's figure) holds the condo's $851, the projection also has "Condo's loan payment, back once the loan
  // is paid off" ($10,212 from 2051): the page said "$21,452 a year of rent", a figure on no other page
  const a = incomeAnswer(condoOnNetWorthPlan(), "2026-11-06");
  assert.equal(Math.round(a.otherYearly), 11240);
  assert.deepEqual(a.otherKinds, ["rent"]);
  // the same household with the loan typed only on Rental analysis: the same rent
  assert.equal(Math.round(incomeAnswer(condoOnlyRentalPlan(), "2026-11-06").otherYearly), 11240);
});

test("review round 1 N3: the waiting line keeps room for '(2 years past the 65 planned)' and holds its exact height", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.match(src, /slot\(ui, "\(2 years past the 65 planned\)"\)/);
  assert.match(src, /if \(pending\) for \(const el of \[h1, ledeEl\]\) el\.style\.minHeight = `\$\{el\.getBoundingClientRect\?\.\(\)\.height \?\? 0\}px`/);
});

// ---------------------------------------------------------------- years to independence at each saving rate (gap next-60 #53)
const T53 = "2026-11-14";
const { LADDER_RATES } = await import("./compute.js");
/** The years by the closed form of the page's yearly loop (pot x (1 + r) + S each year from what is invested): the first whole n
 * with I(1 + r)^n + S((1 + r)^n - 1) / r >= F, so n = ceil(ln((F + S/r) / (I + S/r)) / ln(1 + r)); null past 80. */
const closedYears = (I, S, r, F) => { if (I >= F) return 0; const n = Math.ceil(Math.log((F + S / r) / (I + S / r)) / Math.log(1 + r) - 1e-9); return n <= 80 ? n : null; };

test("#53 the ladder: 10% to 70% of take-home pay and the person's own rate, each by the page's own engine (a closed form agrees)", () => {
  const d = compute(familyPlan(T53), { today: T53, ladder: true });
  const l = d.ladder;
  assert.equal(l.why, null);
  assert.equal(l.takeHome, d.saving.takeHome);
  assert.equal(l.match, d.saving.match);
  assert.equal(l.own, d.saving.rate);
  // the listed rates, in order, with the person's own rate (51%) as a row of its own between 50% and 60%
  assert.deepEqual(l.rows.map((r) => [Math.round(r.rate * 1000) / 1000, r.own]), [[0.1, false], [0.2, false], [0.3, false], [0.4, false], [0.5, false], [Math.round(d.saving.rate * 1000) / 1000, true], [0.6, false], [0.7, false]]);
  for (const r of l.rows) {
    if (!r.own) assert.ok(Math.abs(r.saving - (r.rate * l.takeHome + l.match)) < 1e-6, `${r.rate}: saving`);
    assert.equal(r.years, closedYears(d.invested, r.saving, d.realReturn, d.fiNumber), `${r.rate}: years`);
    assert.equal(r.age, d.age + r.years); assert.equal(r.year, 2026 + r.years);
  }
  // the own row is the page's own "years to get there", to the year
  const mine = l.rows.find((r) => r.own);
  assert.equal(mine.saving, d.saving.yearly);
  assert.equal(mine.years, d.saving.yearsToFi);
  // more saving never takes longer
  for (let k = 1; k < l.rows.length; k++) assert.ok(l.rows[k].years <= l.rows[k - 1].years, `${l.rows[k].rate}`);
  // by hand for the 10% row: $177,000 invested, $17,425 a year in (10% of $143,747 plus the $3,050 match), 3.01% above prices,
  // to $2,100,000: 43 years (the pot is $2,047,537 after 42 and $2,126,586 after 43)
  assert.deepEqual([Math.round(d.invested), Math.round(l.rows[0].saving), Math.round(d.fiNumber), l.rows[0].years], [177000, 17425, 2100000, 43]);
  console.log(`# #53 family: take-home ${Math.round(l.takeHome)}, own ${(l.own * 100).toFixed(1)}%: ${l.rows.map((r) => `${Math.round(r.rate * 100)}% ${r.years}`).join(", ")}`);
});

test("#53 the ladder: a rate that rounds to a listed one takes its place; no pay, already there; never past 80 years", () => {
  const p = familyPlan(T53);
  const d = compute(p, { today: T53, ladder: true });
  // a person saving 20.4% of take-home pay: the 20% row is theirs
  const fake = { ...d.saving, rate: 0.204, yearly: 0.204 * d.saving.takeHome + d.saving.match };
  const L = (() => { const rows = LADDER_RATES.map((r) => ({ rate: r })); const k = rows.findIndex((x) => Math.round(x.rate * 100) === Math.round(fake.rate * 100)); rows[k] = { rate: fake.rate, own: true }; return rows; })();
  assert.deepEqual(L.map((r) => r.rate), [0.1, 0.204, 0.3, 0.4, 0.5, 0.6, 0.7]);
  // no pay in the plan: no rows, "noPay"
  const np = familyPlan(T53); np.income = [];
  const n = compute(np, { today: T53, ladder: true });
  if (n.ready) { assert.equal(n.ladder.why, "noPay"); assert.deepEqual(n.ladder.rows, []); assert.equal(n.ladder.own, null); }
  // already there: "already"
  const rich = familyPlan(T53); rich.accounts.push({ id: "big", name: "Brokerage", type: "brokerage", balance: 5000000 });
  const r = compute(rich, { today: T53, ladder: true });
  assert.equal(r.ladder.why, "already"); assert.deepEqual(r.ladder.rows, []);
  // without ladder: no key at all
  assert.equal("ladder" in compute(p, { today: T53 }), false);
});

test("#53 the words: one sentence per case over the rows, and the how", () => {
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`, pct = (x) => `${Math.round(x * 100)}%`;
  const R = (rate, years, own = false) => ({ rate, saving: 1, years, age: null, year: null, own });
  const L = (rows, why = null) => ({ takeHome: 1, match: 0, own: rows.find((r) => r.own)?.rate ?? null, why, rows });
  const fi = { fiNumber: 2100000 };
  const cases = [
    [L([R(0.1, 43), R(0.5, 19), R(0.514, 18, true), R(0.6, 17), R(0.7, 15)]), fi, "own", "At the 51% of your take-home pay you save now, savings reach the $2,100,000 you need to live on for good in about 18 years; at 60%, in about 17 years."],
    [L([R(0.1, 6), R(0.7, 2), R(0.701, 2, true)]), { fiNumber: 638042 }, "ownTop", "At the 70% of your take-home pay you save now, savings reach the $638,042 you need to live on for good in about 2 years."],
    [L([R(0.019, null, true), R(0.1, 64), R(0.2, 45)]), { fiNumber: 612000 }, "ownNever", "At the 2% of your take-home pay you save now, savings would not reach the $612,000 you need to live on for good within 80 years; at 10%, in about 64 years."],
    [L([R(0.03, null, true), R(0.1, null), R(0.7, null)]), fi, "ownNeverAll", "At the 3% of your take-home pay you save now, savings would not reach the $2,100,000 you need to live on for good within 80 years, nor at any rate up to 70%."],
    [L([R(0, null, true), R(0.1, 64)]), { fiNumber: 612000 }, "ownNone", "You save none of your take-home pay now; at 10%, savings would reach the $612,000 you need to live on for good in about 64 years."],
    [L([R(0, null, true), R(0.1, null)]), { fiNumber: 612000 }, "ownNone", "You save none of your take-home pay now, and even at 70% savings would not reach the $612,000 you need to live on for good within 80 years."],
    [L([R(0.2, 1, true), R(0.3, 1)]), fi, "own", "At the 20% of your take-home pay you save now, savings reach the $2,100,000 you need to live on for good in about 1 year; at 30%, in about 1 year."],
    [L([], "noPay"), fi, "noPay", "There is no pay in the plan, so there is no share of pay to save: add pay on the Income page to see the years at each saving rate."],
    [L([], "already"), { fiNumber: 834000 }, "already", "You already have the $834,000 you need to live on for good, so at any saving rate you are there now."],
  ];
  for (const [l, o, key, sentence] of cases) assert.deepEqual(view.ladderWords(l, o, money, pct), { key, sentence }, key);
  const d = compute(familyPlan(T53), { today: T53, ladder: true });
  const fmtPct = (x, n) => `${(x * 100).toFixed(n)}%`;
  // the lead (n1 fix P2): said first, before the sentence and the rows, when the page leads with the answer from the plan
  assert.equal(view.LADDER_LEAD, "A quick estimate, not your plan's answer: like the rule of thumb, these years leave out Social Security, pensions and taxes, so go by the answer at the top of the page.");
  // the figure at a row's right (n1 fix F1): the own row with nothing going in has no years, and says so
  assert.deepEqual([view.rowValue(R(0.5, 18, true)), view.rowValue(R(0.5, 1)), view.rowValue(R(0.1, null)), view.rowValue({ ...R(0, null, true), saving: 0 }), view.rowValue({ ...R(0.001, null, true), saving: 600 })],
    ["18 years", "1 year", "over 80 years", "nothing going in", "over 80 years"]);
  assert.equal(view.ladderHow(d, money, fmtPct), `How: each year what you have invested grows by 3.0% above prices (your stock and bond assumptions blended), and that share of your $143,747 a year of take-home pay goes in, with the $3,050 your employer adds, until the total reaches $2,100,000: your spending of ${money(d.spendingYearly)} a year over the 4% you would take out each year. Your spending is the same on every row; in life, saving more usually means spending less, which lowers the amount needed too, so the higher rows would come sooner and the lower ones later.`);
});

// ---------------------------------------------------------------- the page, drawn with the real kit on the fake DOM
const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const view = await import("./view.js");
function page(plan0) {
  const plan = migrate(structuredClone(plan0));
  const s = { saved: [] };
  s.root = new FakeElement("main");
  view.render(s.root, { ui, fmt: { ...fmt, today: () => T53 }, plan, view: { build: false }, module: { group: "retirement", id: "fire" }, route: { group: "retirement", id: "fire", rest: [], query: {} },
    store: { get: () => plan, backend: () => "local", update: (fn) => s.saved.push(fn) }, computeRemote: async () => null });
  return s;
}
const everything = (el) => [el, ...el.all()];
const partsOf = (root) => everything(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partOf = (root, id) => partsOf(root).find((e) => e.dataset.part === id) ?? null;
const opened = (d) => d.hasAttribute("open");
const rowsOf = (root) => partsOf(root).map((p) => [p.dataset.part, p.dataset.kind, p.querySelector(".fold-title").textContent, p.querySelector(".fold-status")?.textContent ?? "", opened(p)]);
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden || /^(STYLE)$/i.test(n.tagName ?? "") ? "" : n.tagName === "DETAILS" && !opened(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/​/g, "").replace(/\s+/g, " ").trim();
}

test("#53 the page: the rule of thumb and the years at each saving rate are two quiet rows of one card; no hand-written fold", () => {
  const s = page(familyPlan(T53));
  assert.deepEqual(rowsOf(s.root), [["rule", "more", "A quick rule of thumb", "25 times spending", false], ["rates", "more", "Years to independence at each saving rate", "", false]]);
  assert.equal(everything(s.root).filter((e) => e.dataset?.parts !== undefined).length, 1);
  assert.ok(!everything(s.root).some((e) => e.tagName === "DETAILS" && !e.dataset.part), "no hand-written fold");
  assert.match(seen(s.root), /A quick rule of thumb 25 times spending › Years to independence at each saving rate ›$/);
  // the rule's figures, moved as they were
  const rule = seen(partOf(s.root, "rule").querySelector(".fold-body"));
  assert.match(rule, /^A quick rule: savings of 25 times what you spend a year pay for life without a paycheck\./);
  assert.match(rule, /By this rule: about 18 years\. Spending \$84,000 a year needs about \$2,100,000 to live on for good.* \$2,100,000 Enough to live on 25 times yearly spending .* What moves it Spend less/);
  // the ladder: the sentence, a row per rate (the person's own marked), the how
  const d = compute(migrate(familyPlan(T53)), { today: T53, ladder: true });
  const body = seen(partOf(s.root, "rates").querySelector(".fold-body"));
  const pct0 = (x) => fmt.pct(x, 0), money = (n) => fmt.money(Math.round(n), "USD");
  // the lead first, then the sentence (n1 fix P2: the caveat was the small how's first line, under all eight rows)
  assert.ok(body.startsWith(`${view.LADDER_LEAD} ${view.ladderWords(d.ladder, { fiNumber: d.fiNumber }, money, pct0).sentence}`), body.slice(0, 300));
  assert.match(body, /10% of take-home pay 43 years \$17,400 a year: there at age 79, in 2069 20% of take-home pay 32 years/);
  assert.match(body, /51% of take-home pay \(what you save now\) 18 years \$76,900 a year: there at age 54, in 2044 60% of take-home pay 17 years/);
  assert.match(body, /the higher rows would come sooner and the lower ones later\.$/);
  assert.equal(body.match(/your plan's answer/g).length, 1, "the caveat said once, at the top");
  assert.ok(!/quick rule's years, for comparison/.test(body));
  assert.equal(everything(partOf(s.root, "rates")).filter((e) => e.tagName === "LI").length, 8);
});

test("#53 the page: with no rows to show, the one sentence is said with the rule's figures, never a part of one sentence", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const s = page(retiredCouplePlan(T53));
  assert.deepEqual(rowsOf(s.root).map((r) => r[0]), ["rule"]);
  // everyone has stopped work: no ladder at all, neither row nor sentence (n1 fix P1: "there is no pay to save from" sat right
  // under the rule's "Saving a year $36,041, 52% of take-home pay", what pensions and Social Security leave over)
  const rule = seen(partOf(s.root, "rule").querySelector(".fold-body"));
  assert.match(rule, /Saving a year/);
  assert.ok(!/no pay to save|stopped work, so|saving rate|take-home pay you save now/.test(rule), rule.slice(-300));
  assert.match(rule, /Real years are far more uneven\.$/);
  // no pay in the plan at all
  const np = familyPlan(T53); np.income = [];
  const t = page(np);
  if (partOf(t.root, "rule")) {
    assert.equal(partOf(t.root, "rates"), null);
    assert.match(seen(partOf(t.root, "rule").querySelector(".fold-body")), /There is no pay in the plan, so there is no share of pay to save: add pay on the Income page to see the years at each saving rate\.$/);
  }
});

test("#53 n1 fix F1: nothing going in: the own row has no years from growth alone, as the page shows none (M-6)", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const p = ARCHETYPES.find((a) => a.id === "11-self-employed").build();
  // $400,000 more invested: growth alone would reach the figure in 44 years (age 82), which the row used to say
  p.accounts.find((a) => a.type === "brokerage").balance += 400000;
  const d = compute(migrate(structuredClone(p)), { today: T53, ladder: true });
  assert.equal(d.ladder.why, null);
  assert.ok(!(d.saving.yearly > 0.5), "nothing goes in");
  assert.equal(d.saving.yearsToFi, null);
  const mine = d.ladder.rows.find((r) => r.own);
  assert.deepEqual([mine.rate, mine.years, mine.age, mine.year], [0, null, null, null]);
  // the listed rates still count their years (something goes in on each)
  assert.ok(d.ladder.rows.filter((r) => !r.own).every((r) => r.saving > 0.5 && r.years !== null));
  // on the page: the own row says "nothing going in", the sentence "You save none of your take-home pay now"
  const s = page(p);
  const body = seen(partOf(s.root, "rates").querySelector(".fold-body"));
  assert.match(body, /You save none of your take-home pay now; at 10%, savings would reach/);
  assert.match(body, /0% of take-home pay \(what you save now\) nothing going in \$0 a year 10% of take-home pay \d+ years/);
  assert.ok(!/0% of take-home pay \(what you save now\) \d+ years/.test(body), body);
});

test("S11: the page saves nothing; opening a part writes nothing and moves no other part", () => {
  const s = page(familyPlan(T53));
  const states = () => partsOf(s.root).map((p) => [p.dataset.part, opened(p)]);
  const r = partOf(s.root, "rates");
  r.setAttribute("open", ""); r.dispatch("toggle");
  assert.deepEqual(states(), [["rule", false], ["rates", true]]);
  assert.equal(s.saved.length, 0);
});
