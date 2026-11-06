// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

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
  assert.equal(hw.earliestAge, 73, "average markets: 73");
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
  const d = projection(p, { today: TODAY });
  assert.equal(d.result.success, true); assert.equal(Math.round(d.affordable), 94147); assert.equal(Math.round(d.atEnd.totalReal), 845656);
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.otherYearly, 21600); assert.deepEqual(w.otherKinds, ["rent"]); assert.deepEqual(w.left, []);
  assert.equal(w.name, "Dee"); assert.equal(w.earliestAge, 63); assert.equal(w.now, true);
  assert.equal(carefulAge(p, { today: TODAY, legacy: w.legacy, personId: w.personId, from: w.earliestAge, upTo: w.upTo, stopNow: w.stopNow }).age, 63);
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
  assert.equal(w.otherYearly, 14400); assert.deepEqual(w.otherEnding, { yearly: 14400, by: 2034, all: true });
  // with a pension for life too, only part of it stops
  p.income.push({ id: "pn", name: "Army pension", type: "pension", personId: "s", amount: 1000, period: "monthly", startDate: "2028-03-01" });
  assert.deepEqual(incomeAnswer(p, TODAY).otherEnding, { yearly: 14400, by: 2034, all: false });
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
  assert.deepEqual(rw.plannedStop, { personId: "s", name: "Sam", age: 60, plannedAge: 65, plannedYear: 2031 });
  // a partner asked about while the first adult said "retired": the same
  const p = emptyPlan();
  p.household.people.push({ id: "s", name: "Pat", role: "self", birthDate: "1966-04-10", retirementAge: 65 }, { id: "t", name: "Tom", role: "partner", birthDate: "1968-05-05", retirementAge: 65 });
  p.accounts.push({ id: "b", name: "Brokerage", type: "brokerage", balance: 700000 });
  p.retirement.spendingMonthly = 6000; p.retirement.socialSecurity = { s: { claimAge: 67, monthlyAtFRA: 2000 }, t: { claimAge: 67, monthlyAtFRA: 2200 } };
  p.income.push({ id: "i", name: "Pat's pay", type: "salary", personId: "s", amount: 6000, period: "monthly", endDate: "2026-06-30" }, { id: "j", name: "Tom's pay", type: "salary", personId: "t", amount: 7000, period: "monthly" });
  p.guide = { setup: { status: { s: "retired", t: "work" } } };
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.name, "Tom"); assert.deepEqual(w.plannedStop, { personId: "s", name: "Pat", age: 60, plannedAge: 65, plannedYear: 2031 });
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
  assert.deepEqual(w.plannedStop, { personId: "e", name: "Elena", age: 35, plannedAge: 65, plannedYear: 2056, notWorking: true });
  // one who said "retired" has no notWorking (the earlier test's deepEqual)
  p.guide.setup.status.e = "retired";
  assert.equal(incomeAnswer(p, TODAY).plannedStop.notWorking, undefined);
});
