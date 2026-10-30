import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, applyChanges, results, describe, LEVERS, MAX_SCENARIOS } from "./compute.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { project } from "../../../core/math/retirement.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("every lever reads the plan's own value; plan levers set, input levers apply", () => {
  const p = familyPlan(TODAY);
  for (const lv of LEVERS) assert.ok(typeof lv.get === "function", lv.key);
  assert.equal(LEVERS.find((l) => l.key === "retireAge").get(p, "p-ana"), 65);
  assert.equal(LEVERS.find((l) => l.key === "claimAge").get(p, "p-bo"), 67);
  assert.equal(LEVERS.find((l) => l.key === "spendingMonthly").get(p), 7000);
});

test("applyChanges: a copy of the plan, the original untouched; the engine inputs follow", () => {
  const p = familyPlan(TODAY);
  const before = JSON.stringify(p);
  const a = applyChanges(p, { "retireAge:p-ana": 60, spendingMonthly: 6000, extraSavingMonthly: 500, fee: 0.01, lumpSum: 50000, lumpYear: 2030 }, { today: TODAY });
  assert.equal(JSON.stringify(p), before);
  const base = buildInputs(p, { today: TODAY }).inputs;
  assert.equal(a.inputs.people[0].retireAge, 60); assert.equal(a.inputs.spending.yearly, 72000);
  assert.ok(a.inputs.contributions.some((c) => c.bucket === "taxable" && c.yearly === 6000));
  near(a.inputs.returns.stocks, base.returns.stocks - 0.01); near(a.inputs.returns.bonds, base.returns.bonds - 0.01);
  assert.deepEqual(a.inputs.events.at(-1), { year: 2030, amount: -50000, label: "one-off" });
  assert.equal(applyChanges(emptyPlan(), {}, { today: TODAY }).inputs, null);
});

test("results: the projection's own figures; the chance over simulated markets", () => {
  const I = buildInputs(familyPlan(TODAY), { today: TODAY }).inputs;
  const r = results(I, { paths: 50 });
  const p = project(I);
  assert.equal(r.success, p.success); near(r.endReal, p.endBalanceReal);
  assert.ok(r.chance >= 0 && r.chance <= 1); assert.equal(results(I, { paths: 0 }).chance, null);
});

test("describe: plain words for each change", () => {
  const p = familyPlan(TODAY);
  assert.deepEqual(describe(p, { "retireAge:p-ana": 60, extraSavingMonthly: 500, fee: 0.01, lumpSum: -20000, lumpYear: 2031, inflation: 0.035, spendingMonthly: "" }),
    ["Ana retires at 60", "save $500 more a month", "fees of 1% a year", "$20,000 is spent in 2031", "prices rise 3.5% a year"]);
});

test("the family's scenarios: retiring earlier and paying fees cost, saving more gains; at most four", () => {
  const p = familyPlan(TODAY);
  p.scenarios = [
    { id: "a", name: "60", changes: { "retireAge:p-ana": 60, "retireAge:p-bo": 60 } },
    { id: "b", name: "save", changes: { extraSavingMonthly: 500 } },
    { id: "c", name: "fee", changes: { fee: 0.01 } },
    { id: "d", name: "none", changes: {} },
    { id: "e", name: "fifth", changes: {} },
  ];
  const d = compute(p, { today: TODAY, paths: 60 });
  assert.equal(d.ready, true); assert.equal(d.scenarios.length, MAX_SCENARIOS);
  const by = Object.fromEntries(d.scenarios.map((s) => [s.id, s.results]));
  assert.ok(by.a.affordableMonthly < d.base.affordableMonthly); assert.ok(by.b.affordableMonthly > d.base.affordableMonthly); assert.ok(by.c.endReal < d.base.endReal);
  near(by.d.endReal, d.base.endReal);
  assert.equal(d.current["retireAge:p-bo"], 62);
});
