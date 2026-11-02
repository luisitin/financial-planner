import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, MILESTONE_YEARS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { compute as timeline } from "../../overview/timeline/compute.js";
import { compute as health } from "../../overview/health-score/compute.js";

const TODAY = "2026-10-30";

test("no people: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family's summary carries each page's own figures", () => {
  const d = compute(familyPlan(), { today: TODAY, maxPaths: 300 });
  assert.equal(d.ready, true);
  assert.deepEqual(d.household.people.map((p) => `${p.name} ${p.age}`), ["Ana 36", "Bo 37", "Cy 6"]);
  assert.equal(Math.round(d.netWorth.netWorth), 287100);
  assert.equal(d.retirement.retireYear, 2055); assert.equal(d.retirement.lastsTo, 2085); assert.equal(d.retirement.paths, 300, "the PC's cap is respected");
  assert.ok(d.retirement.chance > 0.5 && d.retirement.chance <= 1);
  assert.equal(d.health.score, health(familyPlan(), { today: TODAY }).score);
  assert.equal(d.protection.total, 12); assert.equal(d.protection.failing.length, d.protection.total - d.protection.passed);
  assert.equal(d.goals.length, 4); assert.equal(d.debts.length, 3);
  assert.equal(d.nextSteps[0].title, "A starter emergency fund");
});

test("debt payoff dates agree with the timeline; milestones stop ten years out", () => {
  const d = compute(familyPlan(), { today: TODAY, maxPaths: 100 });
  const t = timeline(familyPlan(), { today: TODAY });
  assert.equal(d.debts.find((x) => x.name === "Mortgage").payoffDate, t.events.find((e) => e.id === "debt-a-mort").date);
  assert.ok(d.milestones.every((m) => m.year <= 2026 + MILESTONE_YEARS)); assert.ok(d.milestones.length <= 10);
});

test("debts: the payoff plan's date, and the own-payment date where it is later (the Debts page's)", () => {
  const today = "2026-11-02";
  const d = compute(familyPlan(today), { today });
  const m = d.debts.find((x) => x.name === "Mortgage");
  assert.equal(m.payoffDate.slice(0, 7), "2039-03"); assert.equal(m.ownPayoffDate.slice(0, 7), "2046-01");
  assert.equal(d.debts.find((x) => x.name === "Visa card").ownPayoffDate, null);
});

test("a goal waiting its turn on Next best action reads 'starts later' with its month, not 'behind' (review 2026-11-02)", () => {
  const T = "2026-11-02";
  const p = familyPlan(T);
  p.goals = p.goals.filter((g) => g.id === "g-col" || g.id === "g-car");
  p.goals.find((g) => g.id === "g-col").monthly = 0; p.goals.find((g) => g.id === "g-car").monthly = 900;
  const d = compute(p, { today: T, maxPaths: 100 });
  const col = d.goals.find((g) => g.name === "Cy's college");
  assert.equal(col.status, "starts later"); assert.match(col.startsIn, /^\w+ \d{4}$/);
  assert.equal(d.goals.find((g) => g.name === "Replace Bo's car").status, "on track");
  assert.doesNotMatch(JSON.stringify(d.nextSteps), /college needs more each month/);
});
