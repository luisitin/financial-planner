import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, seTax, SE } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("self-employment tax: 15.3% of 92.35% of profit; Social Security only up to the wage base after wages; nothing under $400", () => {
  const a = seTax(10000, { wages: 0, wageBase: 184500 });
  near(a.base, 9235); near(a.ss, 9235 * 0.124); near(a.medicare, 9235 * 0.029); near(a.half, a.total / 2);
  const b = seTax(50000, { wages: 170000, wageBase: 184500 });
  near(b.ss, 0.124 * 14500, 1e-6); near(b.medicare, 50000 * SE.base * 0.029);
  assert.equal(seTax(400, { wageBase: 184500 }).total, 0, "92.35% of 400 is under 400");
});

test("no business: nothing to show", () => {
  const p = familyPlan(TODAY); p.income = p.income.filter((x) => x.type !== "business");
  assert.equal(compute(p, { today: TODAY }).ready, false);
});

test("Bo's photography: the SE tax, the half deduction, the 20% deduction, the room for retirement", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  const bo = d.people[0];
  assert.equal(bo.id, "p-bo"); assert.equal(bo.net, 7200); assert.equal(bo.wages, 62400);
  near(d.seTotal, 7200 * 0.9235 * 0.153, 1e-6);
  near(d.qbi, 0.2 * (7200 - d.half), 1e-6);
  near(bo.sepRoom, 0.2 * (7200 - d.half), 1e-6);
  near(bo.soloRoom, 0.2 * (7200 - d.half) + (7200 - d.half), 1e-6, "the deferral is capped by earnings");
  assert.ok(d.businessTax > d.seTotal && d.effectiveRate > 0.25 && d.effectiveRate < 0.4);
  near(d.quarterly, d.businessTax / 4);
  assert.ok(d.keepPer100 > 60 && d.keepPer100 < 75);
});

test("expenses come off the profit; a big business may hit the deduction's limits", () => {
  const p = familyPlan(TODAY); p.whatIfs = { selfEmployment: { expenses: 2000 } };
  assert.equal(compute(p, { today: TODAY }).net, 5200);
  p.income.find((x) => x.id === "i-side").amount = 40000; p.whatIfs = {};
  const big = compute(p, { today: TODAY });
  assert.equal(big.qbiMayBeLimited, true); assert.ok(big.warnings.some((w) => w.includes("can be limited")));
});
