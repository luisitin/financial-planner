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

test("rent, dividends and other income that is not pay do not stop when work does; a partner's pay is pay only", async () => {
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
  // the household's dividends belong to the first adult; Sam's royalties stop with their end date; one-offs are left out
  assert.deepEqual([line("Dividends").yearly, line("Dividends").personIndex, line("Dividends").startAge, line("Dividends").cola], [4800, 0, 2033 - 1968, false]);
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
  // Financial independence counts them as income that is not pay, by kind
  const w = incomeAnswer(p, TODAY);
  assert.equal(w.otherYearly, 10800 + 24000 + 4800 + 3600);
  assert.deepEqual([...w.otherKinds].sort(), ["dividends", "other", "pension", "rent"]);
});
