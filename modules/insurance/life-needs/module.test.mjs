import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, familyMaximum, familyBenefits, shareUnder, lifetimeEarnings, EARNINGS_TEST_EXEMPT, FUNERAL } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withCover = (anaCover, boCover = 0) => {
  const p = familyPlan(TODAY);
  p.insurance = { policies: [
    ...(anaCover ? [{ id: "a", name: "Ana's term", kind: "term", personId: "p-ana", benefit: anaCover, premium: 30, period: "monthly" }] : []),
    ...(boCover ? [{ id: "b", name: "Bo's group life", kind: "term", personId: "p-bo", benefit: boCover, premium: 0, period: "monthly", throughWork: true }] : []),
  ] };
  return p;
};

test("the family maximum: 150/272/134/175% over 2026's bend points (1979's 230/332/433 scaled by the 2024 wage index: 1,643, 2,371, 3,093)", () => {
  near(familyMaximum(2650, 2026), 4818.5);   // 1.5*1643 + 2.72*728 + 1.34*279 = 4818.52, to the dime below
  near(familyMaximum(4000, 2026), 6999.3);   // + 1.34*722 + 1.75*907
  near(familyMaximum(1000, 2026), 1500);
});

test("the share of a year someone is under an age", () => {
  near(shareUnder("2020-03-03", 18, 2037), 1); near(shareUnder("2020-03-03", 18, 2038), 2 / 12); assert.equal(shareUnder("2020-03-03", 18, 2039), 0);
  near(shareUnder("2020-01-15", 16, 2036), 0);
});

test("the family's Social Security: 75% of the PIA each, the parent's held back $1 for $2 over the exempt amount, the family maximum shared out", () => {
  const one = familyBenefits({ pia: 2650, year: 2027, deathYear: 2026, children: [{ birthDate: "2020-03-03" }], parentPay: 69600 });
  near(one.children, 0.75 * 2650 * 12);
  near(one.parent, 0.75 * 2650 * 12 - (69600 - EARNINGS_TEST_EXEMPT) / 2);
  const three = familyBenefits({ pia: 2000, year: 2027, deathYear: 2026, children: [{ birthDate: "2015-01-01" }, { birthDate: "2017-01-01" }, { birthDate: "2019-01-01" }], parentPay: 0 });
  const fm = familyMaximum(2000, 2026);
  near(three.familyMaxMonthly, fm);
  near(three.children + three.parent, fm * 12, 1e-6);
  near(three.children / three.parent, 3);
  const grown = familyBenefits({ pia: 2000, year: 2040, deathYear: 2026, children: [{ birthDate: "2015-01-01" }], parentPay: 0 });
  assert.equal(grown.children, 0); assert.equal(grown.parent, 0);
});

test("lifetime earnings: the family's share of the take-home pay, discounted", () => {
  const flat = lifetimeEarnings({ pay: 100000, years: 2, realGrowth: 0, realDiscount: 0 });
  near(flat.yearly, 100000 * 0.75 * 0.75); near(flat.total, 2 * flat.yearly);
  const disc = lifetimeEarnings({ pay: 100000, years: 2, realGrowth: 0, realDiscount: 0.05 });
  near(disc.total, flat.yearly * (1 + 1 / 1.05));
});

test("not ready without the plan's basics", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family: the plan's answer, DIME and lifetime earnings for each of them", () => {
  const d = compute(withCover(0), { today: TODAY });
  assert.equal(d.ready, true);
  const [ana, bo] = d.people;
  assert.equal(ana.survivorName, "Bo"); assert.equal(bo.survivorName, "Ana");
  assert.equal(ana.method, "plan");
  assert.ok(ana.need > 100000 && ana.need < 400000, String(ana.need));
  assert.equal(ana.need % 1000, 0);
  assert.equal(bo.need, 0, "Ana's pay and the savings carry the household without Bo");
  near(ana.plan.benefits.childMonthly, 0.75 * 2650); near(ana.plan.benefits.parentMonthly, (0.75 * 2650 * 12 - (69600 - EARNINGS_TEST_EXEMPT) / 2) / 12);
  assert.equal(ana.plan.benefits.childUntil, 2038);
  assert.equal(ana.dime.debts, 6400 + 14200); assert.equal(ana.dime.mortgage, 265000); assert.equal(ana.dime.education, 90000 - 4000); assert.equal(ana.dime.finalExpenses, FUNERAL);
  near(ana.dime.total, ana.dime.debts + ana.dime.finalExpenses + ana.dime.income + ana.dime.mortgage + ana.dime.education);
  near(ana.dime.income, ana.pay * ana.dime.incomeYears);
  assert.ok(ana.dime.incomeYears > 11 && ana.dime.incomeYears < 11.5);
  assert.equal(ana.lifetime.years, 65 - 36);
  assert.equal(ana.gap, ana.need); assert.equal(ana.cover, 0);
  assert.deepEqual(ana.termUntil, { year: 2042, why: "Cy turns 22" });
});

test("the plan's answer is the smallest cover that works: a little less and the survivor's money runs out", () => {
  const need = compute(withCover(0), { today: TODAY }).people[0].need;
  const enough = compute(withCover(need), { today: TODAY }).people[0];
  assert.equal(enough.plan.withCover.success, true); assert.equal(enough.gap, 0);
  const less = compute(withCover(need - 5000), { today: TODAY }).people[0];
  assert.equal(less.plan.withCover.success, false); assert.equal(less.gap, 5000);
});

test("cover through work: the gap if the job ends", () => {
  const d = compute(withCover(0, 125000), { today: TODAY });
  const bo = d.people[1];
  assert.equal(bo.cover, 125000); assert.equal(bo.coverWork, 125000); assert.equal(bo.spare, 125000); assert.equal(bo.gapIfJobEnds, 0);
});

test("one adult and no children: no one depends on the income", () => {
  const p = familyPlan(TODAY);
  p.household.people = p.household.people.filter((q) => q.id === "p-ana");
  const d = compute(p, { today: TODAY });
  const [ana] = d.people;
  assert.equal(d.people.length, 1); assert.equal(ana.dependants, false); assert.equal(ana.plan, null);
  assert.equal(ana.dime.income, 0); assert.equal(ana.dime.education, 0);
});

test("the earnings test by the plan's first year (SSA: $24,480 in 2026, $25,560 in 2027; later years hold the newest)", async () => {
  const { earningsTestExempt } = await import("./compute.js");
  assert.equal(earningsTestExempt(2026), 24480); assert.equal(earningsTestExempt(2027), 25560); assert.equal(earningsTestExempt(2035), 25560);
  const in2027 = familyBenefits({ pia: 2650, year: 2028, deathYear: 2027, children: [{ birthDate: "2020-03-03" }], parentPay: 69600 });
  near(in2027.parent, 0.75 * 2650 * 12 - (69600 - 25560) / 2);
});
