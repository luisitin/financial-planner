import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInputs, compute, BUCKET_OF } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-16";
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("an empty plan says what is missing", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, false); assert.ok(d.missing.length >= 2);
});
test("buildInputs: people, buckets, contributions, incomes, years", () => {
  const b = buildInputs(retirementPlan(), { today: TODAY });
  assert.equal(b.inputs.startYear, 2026); assert.equal(b.inputs.retireYear, 2033, "Sam 65 in 2033"); assert.equal(b.inputs.endYear, 2065, "Lee reaches 95 in 2065");
  assert.deepEqual(b.inputs.people.map((p) => p.name), ["Sam", "Lee"]);
  near(b.inputs.balances.cash, 52000); near(b.inputs.balances.taxable, 150000); near(b.inputs.balances.deferred, 730000); near(b.inputs.balances.free, 90000);
  assert.equal(BUCKET_OF.property, undefined, "the house is not retirement money");
  const c = b.inputs.contributions;
  near(c.find((x) => x.name === "Sam's 401(k)").yearly, 18000 + 6000); assert.equal(c.find((x) => x.name === "Sam's 401(k)").bucket, "deferred");
  near(c.find((x) => x.name === "Lee's IRA").yearly, 7000); assert.equal(c.find((x) => x.name === "Lee's IRA").personIndex, 1);
  const names = b.inputs.incomes.map((i) => i.name);
  assert.ok(names.includes("Sam's Social Security") && names.includes("Lee's Social Security") && names.includes("Lee's state pension") && names.includes("Lee's pay"));
  const leePay = b.inputs.incomes.find((i) => i.name === "Lee's pay");
  assert.equal(leePay.startAge, 56); assert.equal(leePay.endAge, 66); near(leePay.yearly, 66000);
  near(b.inputs.spending.yearly, 78000); assert.equal(b.spendingSource, "typed");
  assert.equal(b.inputs.rmd.birthYear, 1968); assert.equal(b.inputs.rmd.startAge, 75);
  assert.deepEqual(b.inputs.rmd.owners.map((o) => [o.personIndex, Math.round(o.share * 730), o.startAge]), [[0, 730, 75], [1, 0, 75]], "accounts with no owner belong to the first person");
});
test("the projection runs, retires in 2033, and gives an affordable figure and a verdict", () => {
  const d = compute(retirementPlan(), { today: TODAY });
  assert.equal(d.ready, true);
  assert.equal(d.rows.length, 40); assert.equal(d.atRetirement.year, 2033); assert.equal(d.atRetirement.age, 65);
  assert.ok(d.atRetirement.totalReal > 1000000, "1.02m plus 7 years of growth and contributions");
  assert.equal(d.atEnd.year, 2065);
  assert.ok(["on track", "tight", "short"].includes(d.verdict));
  assert.ok(d.affordable > 0);
  const r2033 = d.rows.find((r) => r.year === 2033);
  assert.ok(r2033.income > 0, "Lee's pay in 2033 (she works to 67)");
  const r2037 = d.rows.find((r) => r.year === 2037);
  assert.ok(r2037.incomeLines.some((l) => l.name === "Lee's state pension"), "pension from 67");
  const r2043 = d.rows.find((r) => r.year === 2043);
  assert.ok(r2043.rmd > 0, "Sam is 75 in 2043: RMDs start");
  assert.ok(d.coverage > 0 && d.coverage < 1);
});
test("spending falls back to today's expenses when nothing is typed", () => {
  const p = retirementPlan(); p.retirement.spendingMonthly = null;
  const b = buildInputs(p, { today: TODAY });
  assert.equal(b.spendingSource, "expenses"); near(b.inputs.spending.yearly, 84000);
});
test("a pension typed on the Income page counts in retirement (F-028)", () => {
  const p = retirementPlan(); p.retirement.pensions = []; p.retirement.socialSecurity = {};
  p.income.push({ id: "i3", name: "Teachers' pension", type: "pension", personId: "sam", amount: 2000, period: "monthly", growth: 0.02, startDate: "2033-05-01", taxable: true });
  const b = buildInputs(p, { today: TODAY });
  const pn = b.inputs.incomes.find((i) => i.name === "Teachers' pension");
  assert.ok(pn, "the Income page's pension reaches the engine");
  near(pn.yearly, 24000); assert.equal(pn.personIndex, 0); assert.equal(pn.startAge, 2033 - 1968); assert.equal(pn.cola, true); assert.equal(pn.endAge, undefined);
  const d = compute(p, { today: TODAY });
  assert.ok(d.rows.find((r) => r.year === 2034).incomeLines.some((l) => l.name === "Teachers' pension"), "paid in retirement");
  const without = compute((() => { const q = retirementPlan(); q.retirement.pensions = []; q.retirement.socialSecurity = {}; return q; })(), { today: TODAY });
  assert.ok(d.affordable > without.affordable + 15000, "the pension raises what the plan can spend");
});
test("Income-page pensions: already paid, ended, one-off, fixed and duplicates", () => {
  const p = retirementPlan();
  p.income.push(
    { id: "a", name: "Army pension", type: "pension", personId: "lee", amount: 600, period: "monthly", growth: 0 },
    { id: "b", name: "Old pension", type: "pension", personId: "lee", amount: 300, period: "monthly", endDate: "2025-12-31" },
    { id: "c", name: "Lump sum", type: "pension", personId: "sam", amount: 50000, period: "once" },
    { id: "d", name: "Lee's state pension", type: "pension", personId: "lee", amount: 900, period: "monthly", growth: 0.02, startDate: "2037-09-01" },
    { id: "e", name: "Union pension", type: "pension", personId: "sam", amount: 12000, period: "annual", growth: 0.01, startDate: "2030-01-01", endDate: "2050-06-30", taxable: false },
  );
  const got = buildInputs(p, { today: TODAY }).inputs.incomes.filter((i) => i.source === "income");
  assert.deepEqual(got.map((i) => i.name).sort(), ["Army pension", "Union pension"], "ended, one-off and the duplicate of the Pensions entry are left out");
  const army = got.find((i) => i.name === "Army pension");
  assert.equal(army.startAge, 2026 - 1970, "already paid: counts from now"); assert.equal(army.personIndex, 1); assert.equal(army.cola, false, "no rise typed: a fixed amount");
  const union = got.find((i) => i.name === "Union pension");
  assert.equal(union.startAge, 62); assert.equal(union.endAge, 82); assert.equal(union.taxable, false); near(union.yearly, 12000);
});
test("required withdrawals are worked per owner, at each owner's age; cash value has none", () => {
  const p = retirementPlan();
  p.household.people[1].birthDate = "1958-08-22";   // Lee starts at 73 in 2031, before Sam (75 in 2043)
  for (const a of p.accounts) if (a.id === "k401") a.ownerId = "sam"; else if (a.id === "ira") a.ownerId = "lee";
  p.accounts.push({ id: "cv", name: "Whole life", type: "cash_value_life", balance: 40000 });
  const b = buildInputs(p, { today: TODAY });
  near(b.inputs.balances.deferred, 770000);
  const d = compute(p, { today: TODAY });
  const r2031 = d.rows.find((r) => r.year === 2031);
  assert.ok(r2031.rmdBy[1] > 0 && r2031.rmdBy[0] === 0, "only Lee's IRA has a required withdrawal in 2031");
  const lee2031 = r2031.rmdBy[1];
  const r2043 = d.rows.find((r) => r.year === 2043);
  assert.ok(r2043.rmdBy[0] > 0, "Sam's starts at 75");
  near(r2043.rmd, r2043.rmdBy[0] + r2043.rmdBy[1], 0.01);
  assert.ok(lee2031 < r2031.balances.deferred / 26.5, "Lee's is worked on her own IRA, not the whole pre-tax bucket");
});
