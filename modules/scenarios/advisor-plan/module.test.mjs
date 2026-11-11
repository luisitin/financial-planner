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

test("review 2026-11-02: the advisor's spending figure is a typed figure, so a premium is not taken out of it", async () => {
  const { retireDefault } = await import("../../overview/setup/compute.js");
  const p = familyPlan(TODAY);
  p.expenses.push({ id: "hi", name: "Health insurance", category: "health", amount: 600, period: "monthly", essential: true, inflates: true });
  p.retirement.spendingMonthly = retireDefault(p, TODAY); p.guide = { setup: { retireAuto: true } };
  p.advisor = { firm: "Northgate", changes: { spendingMonthly: 6000 } };
  const d = compute(p, { today: TODAY, paths: 0 });
  near(d.yours.spendingMonthly, 4570, 1e-6); assert.equal(d.theirs.spendingMonthly, 6000, "was 5,400");
  near(d.effects.find((e) => e.key === "spendingMonthly").roomMonthly, -(6000 - 4570), 1e-6);
});

// review-w7 2 (stress test 2026-11-11): the table showed its own 400-future chance (78%) while Chance the money lasts said 80%
test("a quoted chance alone: the advisor's version runs on the same pretend futures as yours, so the two chances match", () => {
  const p = withAdvisor({ firm: "Northgate", quotedChance: 0.9 });
  const d = compute(p, { today: TODAY, paths: 60 });
  assert.ok(d.yours.chance !== null && d.theirs.chance !== null);
  assert.equal(d.theirs.chance, d.yours.chance, "nothing of theirs changes the plan, and the futures are shared");
});

test("the view shows the chance as Compare does: the Chance page's figure when known, else about, to the nearest 5", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.match(src, /knownChance\(ctx\)/);
  assert.match(src, /chanceShown\(y\.chance, null, known\)/);
  assert.match(src, /chanceShown\(y\.chance, t\.chance, known\)/);
  assert.doesNotMatch(src, /row\("Chance it lasts", pct\(/, "no raw chance of its own in the table");
  assert.doesNotMatch(src, /over 400 pretend futures/);
  // the quoted-chance card measures the gap from the figure shown in the table
  assert.match(src, /d\.quotedChance - ts\.value/);
});
