import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, presentValue, RISK } from "./compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { compute as computeRetirement } from "../../retirement/projection/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("presentValue: level pay at no growth and no discount is pay × years; discounting and growth by hand", () => {
  near(presentValue(1000, 10, 0, 0), 10000);
  near(presentValue(1000, 2, 0, 0.1), 1000 / 1.1 + 1000 / 1.21);
  near(presentValue(1000, 2, 0.05, 0.05), 2000);
  assert.equal(presentValue(1000, 0, 0.02, 0.05), 0);
});

test("no earners: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family: each earner's pay to retirement, an average job at the bond return plus two points", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  const ana = d.people.find((x) => x.name === "Ana"), bo = d.people.find((x) => x.name === "Bo");
  assert.equal(ana.years, 65 - 36); assert.equal(bo.years, 62 - 38);
  assert.equal(ana.risk, "average"); near(ana.rate, Number(p.assumptions.returnBonds ?? 0.04) + RISK.average.add, 1e-12);
  const infl = Number(p.assumptions.inflation ?? 0.03), g = (1 + Number(p.assumptions.salaryGrowth ?? 0.03)) / (1 + infl) - 1;
  near(ana.value, presentValue(ana.pay, 29, g, (1 + ana.rate) / (1 + infl) - 1));
  assert.equal(bo.pay, 62400 + 7200, "the photography business counts as Bo's pay");
  near(d.total, ana.value + bo.value);
  const s = computeNext(p, { today: TODAY }).spare;
  near(d.takeHome, 1 - (s.federalTax + s.payrollTax) / s.gross, 1e-9); near(d.totalAfterTax, d.total * d.takeHome);
  near(d.share, d.total / (d.total + d.financial));
});

test("a steadier job is worth more today; a volatile one less", () => {
  const steady = familyPlan(TODAY); steady.whatIfs = { humanCapital: { "p-ana": "steady" } };
  const volatile = familyPlan(TODAY); volatile.whatIfs = { humanCapital: { "p-ana": "volatile" } };
  const v = (p) => compute(p, { today: TODAY }).people.find((x) => x.name === "Ana").value;
  assert.ok(v(steady) > v(familyPlan(TODAY))); assert.ok(v(volatile) < v(familyPlan(TODAY)));
});

test("the path: pay still to come falls to nothing by the last retirement; savings follow the projection; they cross", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  assert.equal(d.path[0].year, 2026); near(d.path[0].human, d.total); near(d.path[0].financial, d.financial);
  assert.equal(d.path[d.path.length - 1].human, 0);
  for (let i = 1; i < d.path.length; i++) assert.ok(d.path[i].human <= d.path[i - 1].human + 1e-6);
  const rows = computeRetirement(p, { today: TODAY }).rows;
  near(d.path[5].financial, rows.find((r) => r.year === 2030).totalReal);
  assert.ok(d.crossYear > 2026); const c = d.path.find((x) => x.year === d.crossYear); assert.ok(c.financial >= c.human);
});

test("life cover against each earner's after-tax pay; the raise worth having", () => {
  const p = familyPlan(TODAY);
  p.insurance = { ...(p.insurance ?? {}), policies: [{ id: "t1", kind: "term", personId: "p-ana", benefit: 800000 }] };
  const d = compute(p, { today: TODAY });
  const ana = d.people.find((x) => x.name === "Ana");
  assert.equal(ana.cover, 800000); near(ana.coverShare, 800000 / ana.afterTax);
  assert.equal(d.people.find((x) => x.name === "Bo").cover, 0);
  assert.ok(d.raiseGain > 0);
});
