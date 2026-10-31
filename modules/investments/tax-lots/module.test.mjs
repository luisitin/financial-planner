// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("tax-lots: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

import { lotsOf, longOn } from "./compute.js";

const oneLot = (date) => ({ price: 10, shares: 1, costBasis: 5, lots: [{ id: "l1", date, shares: 1, cost: 5 }] });

test("tax-lots: long-term means held more than one year by the calendar (IRS Pub 550), leap years included", () => {
  // counting starts the day after the buy, so the first long-term day is the day after the first anniversary
  assert.equal(longOn("2026-03-15"), "2027-03-16");
  assert.equal(longOn("2027-03-15"), "2028-03-16");   // a February 29 in between: day 366 is still short-term
  assert.equal(longOn("2024-02-29"), "2025-03-01");   // no February 29 next year: the anniversary is February 28
  assert.equal(longOn("2025-12-31"), "2027-01-01");
  const at = (date, today) => { const l = lotsOf(oneLot(date), today)[0]; return [l.term, l.daysToLong]; };
  assert.deepEqual(at("2027-03-15", "2028-03-15"), ["short", 1]);   // the anniversary itself (366 days held)
  assert.deepEqual(at("2027-03-15", "2028-03-16"), ["long", 0]);
  assert.deepEqual(at("2026-03-15", "2027-03-15"), ["short", 1]);   // 365 days held
  assert.deepEqual(at("2026-03-15", "2027-03-16"), ["long", 0]);
  assert.deepEqual(at("2024-02-29", "2025-02-28"), ["short", 1]);
  assert.deepEqual(at("2024-02-29", "2025-03-01"), ["long", 0]);
  assert.deepEqual(at("2026-10-31", "2026-10-31"), ["short", 366]);  // bought today: 2027-11-01 is 366 days away
  assert.equal(lotsOf(oneLot(null), "2026-10-31")[0].term, "long");  // no date: counted as long-term
});

test("tax-lots: the rates on a gain include the 3.8% on investment income, and a true 0% stays 0%", () => {
  const nothing = compute(emptyPlan(), { today: "2026-10-31" });
  assert.equal(nothing.marginal, 0);   // no income: a short-term gain is under the standard deduction
  assert.equal(nothing.gainsRate, 0);
  const p = emptyPlan();
  p.household.people = [{ id: "p1", name: "Adult A", birthDate: "1980-01-01", role: "self" }];
  p.income = [{ id: "i1", name: "Pay", type: "salary", personId: "p1", amount: 400000, period: "annual", taxable: true }];
  // single, $400,000 of pay: taxable income $383,900 is in the 35% bracket and under the 20% gains line; over the
  // $200,000 line for the 3.8% on investment income (IRC 1411)
  const d = compute(p, { today: "2026-10-31" });
  assert.ok(Math.abs(d.marginal - (0.35 + 0.038)) < 1e-9, String(d.marginal));
  assert.ok(Math.abs(d.gainsRate - (0.15 + 0.038)) < 1e-9, String(d.gainsRate));
});
