import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, ADVISOR_LEVERS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withAdvisor = (advisor) => { const p = familyPlan(TODAY); p.advisor = advisor; return p; };
const NORTHGATE = { firm: "Northgate", fee: 0.01, quotedChance: 0.92, changes: { returnStocks: 0.085, returnBonds: 0.045, inflation: 0.025, "retireAge:p-ana": 62, spendingMonthly: 7500, fee: 0.5, bogus: 3 } };

test("nothing entered: your plan alone", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY, paths: 40 });
  assert.equal(d.entered, false); assert.equal(d.theirs, null); assert.ok(d.yours);
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("their plan, the fee's cost, their quote against this app's, each assumption on its own", () => {
  const d = compute(withAdvisor(NORTHGATE), { today: TODAY, paths: 60 });
  assert.deepEqual(Object.keys(d.changes).sort(), ["inflation", "retireAge:p-ana", "returnBonds", "returnStocks", "spendingMonthly"], "only the advisor levers; the fee is its own field");
  assert.ok(ADVISOR_LEVERS.includes("spendingMonthly"));
  assert.equal(d.theirs.spendingMonthly, 7500);
  assert.ok(d.feeCost.endReal > 0 && d.feeCost.affordableMonthly > 0);
  near(d.feeCost.endReal, d.theirsNoFee.endReal - d.theirs.endReal);
  near(d.chanceGap, 0.92 - d.theirs.chance);
  const by = Object.fromEntries(d.effects.map((e) => [e.key, e.roomMonthly]));
  assert.ok(by.fee < 0 && by.returnStocks > 0 && by["retireAge:p-ana"] < 0 && by.inflation > 0);
  near(by.spendingMonthly, -500, 1e-6);
  for (let i = 1; i < d.effects.length; i++) assert.ok(Math.abs(d.effects[i - 1].roomMonthly) >= Math.abs(d.effects[i].roomMonthly));
});
