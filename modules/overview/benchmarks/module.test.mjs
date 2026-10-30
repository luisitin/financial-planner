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
  const m = item(d, "savings-multiple"); assert.ok(Math.abs(m.you - 159000 / 163800) < 1e-9); assert.equal(m.verdict, "behind");
  const r = item(d, "saving-rate"); assert.ok(Math.abs(r.you - (470 * 26 + 3050 + 3600) / 163800) < 1e-9); assert.equal(r.verdict, "behind");
  assert.equal(item(d, "cash").verdict, "behind");
  const h = item(d, "housing"); assert.ok(Math.abs(h.you - 1980 / 14250) < 1e-9); assert.equal(h.verdict, "ahead");
  assert.equal(item(d, "debt").verdict, "ahead");
  assert.equal(d.ahead, 3); assert.equal(d.judged, 6);
  assert.equal(RULES.saving, 0.15);
});
