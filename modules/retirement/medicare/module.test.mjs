import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, tierFor, enrollmentWindow } from "./compute.js";
import { TIERS, PART_B, PART_D_BASE } from "./data/medicare.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("the 2026 tiers: the standard premium first, rising to the top; the lines are inclusive", () => {
  for (const t of Object.values(TIERS)) { assert.equal(t[0][1], PART_B); assert.equal(t[0][2], 0); assert.equal(t.at(-1)[0], Infinity); for (let i = 1; i < t.length; i++) assert.ok(t[i][1] > t[i - 1][1]); }
  assert.equal(tierFor(218000, "married_joint").index, 0); assert.equal(tierFor(218001, "married_joint").index, 1);
  assert.equal(tierFor(109000, "single").partB, 202.90); assert.equal(tierFor(150000, "single").partB, 405.80); assert.equal(tierFor(150000, "single").partDAdd, 37.50);
  assert.equal(tierFor(600000, "head_of_household").partB, 689.90);
  assert.equal(tierFor(200000, "married_separate").partB, 649.20);
});

test("the sign-up window: three months either side of the 65th birthday month; a birthday on the 1st moves it", () => {
  assert.deepEqual(enrollmentWindow("1990-05-20"), { from: "2055-02", month: "2055-05", to: "2055-08" });
  assert.deepEqual(enrollmentWindow("1988-11-02"), { from: "2053-08", month: "2053-11", to: "2054-02" });
  assert.deepEqual(enrollmentWindow("1990-01-01"), { from: "2054-09", month: "2054-12", to: "2055-03" });
});

test("not ready without the plan; the windows still shown", () => {
  const p = emptyPlan(); p.household.people = [{ id: "a", name: "A", role: "self", birthDate: "1961-03-10" }];
  const d = compute(p, { today: TODAY });
  assert.equal(d.ready, false); assert.equal(d.people[0].medicareYear, 2026);
});

test("the family: each enrolled person pays, from the income two years before; working years from pay less pre-tax saving", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.status, "married_joint");
  const y = d.years[0];
  assert.equal(y.year, 2053); assert.equal(y.enrolled, 1); assert.equal(y.magiYear, 2051);
  near(y.magiReal, 3900 * 26 - 470 * 26, 1e-6);
  near(y.totalYearly, (PART_B + PART_D_BASE) * 12);
  assert.equal(d.years.find((x) => x.year === 2055).enrolled, 2);
  near(d.lifetime, d.years.reduce((s, x) => s + x.totalYearly, 0));
  assert.equal(d.surcharge, 0); assert.equal(d.firstSurcharge, null);
  near(d.roomNow.room, 218000 - y.magiReal);
});

test("big Roth conversions push income over a line: the surcharge two years later", () => {
  const p = familyPlan(TODAY); p.retirement.taxMode = "brackets"; p.retirement.rothConversion = { on: true, fillRate: 0.32 };
  p.retirement.medicare = { partDPremium: 50, supplementPremium: 150 };
  const d = compute(p, { today: TODAY });
  assert.ok(d.surcharge > 0 && d.surchargeYears > 0);
  assert.equal(d.firstSurcharge.magiYear, d.firstSurcharge.year - 2); assert.ok(d.firstSurcharge.conversion > 0);
  const hit = d.years.find((x) => x.tier > 0);
  near(hit.totalYearly, (hit.partBEach + 50 + hit.partDAddEach + 150) * 12 * hit.enrolled);
  near(hit.surchargeYearly, ((hit.partBEach - PART_B) + hit.partDAddEach) * 12 * hit.enrolled);
});

test("the 2027 drug-plan base premium is the 2026 one raised by the 6% yearly cap (CMS, July 28, 2026)", async () => {
  const { PART_D_BASE_NEXT } = await import("./data/medicare.js");
  assert.equal(PART_D_BASE_NEXT.year, 2027); assert.equal(PART_D_BASE_NEXT.amount, 41.33);
  assert.equal(Math.round(PART_D_BASE * 1.06 * 100) / 100, PART_D_BASE_NEXT.amount);
});
