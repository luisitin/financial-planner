import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, savingsMultiple, ageGroup, RULES } from "./compute.js";
import { MEDIAN_NET_WORTH_BY_AGE } from "./data/scf.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const item = (d, id) => d.items.find((x) => x.id === id);

test("the tables: age groups cover every age; Fidelity's multiples and the line between them", () => {
  for (let a = 18; a <= 110; a++) assert.ok(ageGroup(a), String(a));
  assert.equal(ageGroup(34).label, "under 35"); assert.equal(ageGroup(35).label, "35 to 44"); assert.equal(ageGroup(80).median, MEDIAN_NET_WORTH_BY_AGE.at(-1).median);
  assert.equal(savingsMultiple(30), 1); assert.equal(savingsMultiple(40), 3); assert.equal(savingsMultiple(67), 10); assert.equal(savingsMultiple(75), 10); assert.equal(savingsMultiple(20), 0);
  assert.ok(Math.abs(savingsMultiple(36) - 2.2) < 1e-9, "between 35 (2x) and 40 (3x)");
});

test("no birth date: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family against the benchmarks", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.equal(d.age, 36); assert.equal(d.group.label, "35 to 44");
  const nw = item(d, "net-worth"); assert.equal(nw.verdict, "ahead"); assert.equal(nw.benchmark, 155600);
  const m = item(d, "savings-multiple"); assert.ok(Math.abs(m.you - 159000 / 163800) < 1e-9); assert.equal(m.verdict, "rule", "behind the guideline, but the plan lasts");
  const r = item(d, "saving-rate"); assert.ok(Math.abs(r.you - (470 * 26 + 3050 + 3600) / 163800) < 1e-9); assert.equal(r.verdict, "rule");
  assert.equal(item(d, "cash").verdict, "behind");
  const h = item(d, "housing"); assert.ok(Math.abs(h.you - 1980 / 14250) < 1e-9); assert.equal(h.verdict, "ahead");
  assert.equal(item(d, "debt").verdict, "ahead");
  assert.equal(d.ahead, 3); assert.equal(d.judged, 6);
  assert.equal(RULES.saving, 0.15);
});

test("the retirement rules of thumb read against the plan's own answer: behind but lasting is not amber", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { savingVerdict } = await import("../../retirement/projection/compute.js");
  const p = familyPlan("2026-11-02"), T = { today: "2026-11-02" };
  assert.equal(savingVerdict(p, T).verdict, "on track");
  const d = compute(p, T);
  for (const id of ["savings-multiple", "saving-rate"]) {
    const x = d.items.find((y) => y.id === id);
    assert.equal(x.verdict, "rule", id); assert.match(x.sentence, /Behind the rule of thumb, but your own plan lasts/);
  }
  // no Social Security yet: the plan has no answer, so the rule of thumb stands alone
  p.retirement.socialSecurity = {};
  assert.equal(savingVerdict(p, T), null);
  assert.equal(compute(p, T).items.find((y) => y.id === "saving-rate").verdict, "behind");
});
