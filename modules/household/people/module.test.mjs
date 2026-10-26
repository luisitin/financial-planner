import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const planWith = (people, extra = {}) => { const p = emptyPlan(); p.household.people = people; Object.assign(p.household, extra); return p; };

test("empty plan: no people, no warnings, no horizon", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.horizonYears, null); assert.deepEqual(d.warnings, []); assert.equal(d.self, null);
});
test("ages, retirement and plan-end dates use the plan's defaults", () => {
  const d = compute(planWith([{ id: "a", name: "Ana", role: "self", birthDate: "1990-05-20" }]), { today: TODAY });
  const me = d.people[0];
  assert.equal(me.age, 36);
  assert.equal(me.retirementAge, 65);
  assert.equal(me.retirementDate, "2055-05-20");
  assert.equal(me.yearsToRetirement, 29);
  assert.equal(me.retired, false);
  assert.equal(me.planEndAge, 95);
  assert.equal(me.planEndDate, "2085-05-20");
  assert.equal(me.yearsLeft, 59);
  assert.equal(d.horizonYears, 59);
  assert.equal(d.self.id, "a");
});
test("a person's own retirement age and plan age win over the defaults", () => {
  const d = compute(planWith([{ id: "a", name: "Ana", role: "self", birthDate: "1990-05-20", retirementAge: 55, lifeExpectancy: 100 }]), { today: TODAY });
  assert.equal(d.people[0].retirementAge, 55);
  assert.equal(d.people[0].yearsToRetirement, 19);
  assert.equal(d.people[0].planEndAge, 100);
  assert.equal(d.horizonYears, 64);
});
test("dependents have no retirement; the horizon follows the adults", () => {
  const d = compute(planWith([
    { id: "a", name: "Ana", role: "self", birthDate: "1990-05-20" },
    { id: "b", name: "Bo", role: "partner", birthDate: "1985-01-01" },
    { id: "c", name: "Cy", role: "dependent", birthDate: "2020-03-03" },
  ], { filingStatus: "married_joint" }), { today: TODAY });
  assert.equal(d.adults, 2); assert.equal(d.dependents, 1);
  assert.equal(d.people[2].retirementAge, null);
  assert.equal(d.people[2].yearsToRetirement, null);
  assert.equal(d.people[2].age, 6);
  assert.equal(d.horizonYears, 59, "Ana (36 -> 95) is the longer horizon; Bo is 41 -> 95 = 54");
  assert.deepEqual(d.warnings, []);
  assert.equal(d.filingLabel, "Married, filing together");
});
test("warnings: nobody is Me, two adults filing single, future birth date, retirement past plan end", () => {
  let d = compute(planWith([{ id: "b", name: "Bo", role: "partner", birthDate: "1985-01-01" }]), { today: TODAY });
  assert.ok(d.warnings.some((w) => w.includes('"Me"')));
  d = compute(planWith([{ id: "a", name: "Ana", role: "self" }, { id: "b", name: "Bo", role: "partner" }]), { today: TODAY });
  assert.ok(d.warnings.some((w) => w.includes("Single")));
  d = compute(planWith([{ id: "a", name: "Ana", role: "self", birthDate: "2030-01-01" }]), { today: TODAY });
  assert.ok(d.warnings.some((w) => w.includes("future")));
  d = compute(planWith([{ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01", retirementAge: 96 }]), { today: TODAY });
  assert.ok(d.warnings.some((w) => w.includes("past the plan")));
});
test("without today, ages are null and nothing crashes", () => {
  const d = compute(planWith([{ id: "a", name: "Ana", role: "self", birthDate: "1990-05-20" }]));
  assert.equal(d.people[0].age, null); assert.equal(d.people[0].yearsToRetirement, null); assert.equal(d.horizonYears, null);
});
