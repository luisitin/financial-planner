import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, NUDGE, SS_PAYABLE_IF_DEPLETED } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { affordableSpending, copyInputs } from "../../../core/math/retirement.js";

const TODAY = "2026-10-30";
const d = compute(familyPlan(), { today: TODAY });
const row = (id) => d.rows.find((r) => r.id === id);

test("an empty plan says what is missing", () => {
  const e = compute(emptyPlan(), { today: TODAY });
  assert.equal(e.ready, false); assert.ok(e.missing.length);
});

test("eleven inputs for the family, sorted by swing, the biggest first", () => {
  assert.equal(d.ready, true);
  assert.deepEqual(d.rows.map((r) => r.id).sort(), ["bonds", "claim", "end", "inflation", "mix", "raises", "retire", "saving", "ss-cut", "stocks", "tax"]);
  for (let i = 1; i < d.rows.length; i++) assert.ok(d.rows[i - 1].swing >= d.rows[i].swing);
  assert.equal(d.biggest, d.rows[0]);
  near(d.base.spendingMonthly, 7000);
});

test("each end is the plan with exactly one thing changed (checked against a hand-made change)", () => {
  const I = buildInputs(familyPlan(), { today: TODAY }).inputs;
  const s = copyInputs(I); s.returns.stocks -= NUDGE.returns;
  near(row("stocks").low.affordableMonthly, affordableSpending(s) / 12, 1);
  const c = copyInputs(I); for (const x of c.incomes) if (x.kind === "social") x.yearly *= SS_PAYABLE_IF_DEPLETED;
  near(row("ss-cut").low.affordableMonthly, affordableSpending(c) / 12, 1);
  near(row("ss-cut").high.affordableMonthly, d.base.affordableMonthly, 1);
  assert.equal(row("retire").low.label, "age 63"); assert.equal(row("retire").high.label, "age 67");
  assert.equal(row("saving").baseLabel.startsWith("$"), true);
});

test("the directions make sense: more return, later retirement, saving more and later claiming help; more inflation and a longer plan hurt", () => {
  for (const id of ["stocks", "bonds", "retire", "saving", "claim", "raises"]) assert.equal(row(id).worse, "low", id);
  for (const id of ["inflation", "end", "tax"]) assert.equal(row(id).worse, "high", id);
});

test("no flat tax row in brackets mode; no retirement row once retired", () => {
  const p = familyPlan(); p.retirement.taxMode = "brackets";
  assert.equal(compute(p, { today: TODAY }).rows.some((r) => r.id === "tax"), false);
  const q = familyPlan(); q.household.people[0].birthDate = "1958-01-01";
  assert.equal(compute(q, { today: TODAY }).rows.some((r) => r.id === "retire"), false);
});

function near(a, b, tol = 0.5) { assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`); }
