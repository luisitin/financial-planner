import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { pmtToReach, fv, inflate } from "../../../core/math/finance.js";

const TODAY = "2026-09-15";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("empty plan", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.neededMonthly, 0); assert.equal(d.totalTarget, 0);
});
test("a two-year goal uses the cash rate; needed monthly matches pmtToReach; status behind without contributions", () => {
  const p = emptyPlan();
  p.goals.push({ id: "g", name: "Car", target: 12000, targetDate: "2028-09-15", saved: 2000, monthly: 0, inflates: false });
  const d = compute(p, { today: TODAY });
  const g = d.goals[0];
  assert.equal(g.monthsLeft, 24);
  assert.equal(g.rate, 0.02, "under 3 years: the plan's cash return");
  assert.equal(g.targetThen, 12000);
  assert.equal(g.funded, 2000);
  near(g.neededMonthly, pmtToReach(0.02 / 12, 24, 12000, 2000));
  assert.equal(g.status, "behind");
  near(g.progress, 2000 / 12000, 1e-9);
});
test("a five-year inflating goal uses the bond rate and grows the target; enough monthly means on track", () => {
  const p = emptyPlan();
  p.goals.push({ id: "g", name: "Down payment", target: 60000, targetDate: "2031-09-15", saved: 10000, monthly: 900, inflates: true });
  const d = compute(p, { today: TODAY });
  const g = d.goals[0];
  assert.equal(g.rate, 0.04);
  near(g.targetThen, inflate(60000, 0.03, 5));
  near(g.projected, fv(0.04 / 12, 60, 900, 10000));
  assert.equal(g.status, g.projected >= g.targetThen ? "on track" : "behind");
  assert.ok(g.projected > g.targetThen, "900/mo for 5 years from 10k beats ~69.6k");
});
test("money in a linked account counts; missing account warns; done when funded", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 15000 });
  p.goals.push({ id: "g1", name: "Emergency fund", target: 15000, fundedBy: ["s"] }, { id: "g2", name: "Ghost", target: 100, fundedBy: ["gone"] });
  const d = compute(p, { today: TODAY });
  assert.equal(d.goals[0].funded, 15000);
  assert.equal(d.goals[0].status, "done");
  assert.deepEqual(d.goals[0].fundedFrom, ["Savings"]);
  assert.equal(d.done, 1);
  assert.ok(d.warnings.some((w) => w.includes("no longer exists")));
  assert.equal(d.goals[1].status, "no date");
});
test("past due, no amount, own rate, and totals", () => {
  const p = emptyPlan();
  p.goals.push(
    { id: "a", name: "Late", target: 1000, targetDate: "2026-01-01", saved: 100 },
    { id: "b", name: "Blank", target: 0 },
    { id: "c", name: "Own rate", target: 1200, targetDate: "2027-09-15", rate: 0, monthly: 100 },
  );
  const d = compute(p, { today: TODAY });
  assert.equal(d.goals[0].status, "past due");
  assert.ok(d.warnings.some((w) => w.includes("date has passed")));
  assert.equal(d.goals[1].status, "no amount");
  assert.equal(d.goals[2].rate, 0);
  assert.equal(d.goals[2].neededMonthly, 100);
  assert.equal(d.goals[2].status, "on track");
  assert.equal(d.totalTarget, 2200);
  assert.equal(d.totalFunded, 100);
  assert.equal(d.contributing, 100);
  near(d.neededMonthly, 900 + 100, 1e-9, "past-due goal needs the whole remainder now (n = 0)");
});
