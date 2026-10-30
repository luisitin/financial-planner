import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, parts, KINDS } from "./compute.js";
import { pmtToReach } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const TRIP = { id: "t", name: "Lake week", kind: "trip", date: "2027-07-10", people: 3, nights: 7, flightPerPerson: 420, lodgingPerNight: 210, foodPerPersonDay: 45, activities: 300, other: 150 };

test("a trip from its parts: flights per person, nights, meals per person a day for nights + 1 days", () => {
  const ps = parts(TRIP);
  assert.deepEqual(ps.map((x) => x.amount), [1260, 1470, 1080, 300, 150]);
  assert.equal(parts({ kind: "trip", people: 0, flightPerPerson: 100 })[0].amount, 100, "at least one person");
});

test("a wedding and a plain budget", () => {
  assert.deepEqual(parts({ kind: "wedding", guests: 80, perGuest: 90, venue: 6000, rings: 2000 }).map((x) => x.amount), [7200, 6000, 2000]);
  assert.deepEqual(parts({ kind: "other", other: 2500 }), [{ label: "Budget", amount: 2500 }]);
  for (const k of Object.values(KINDS)) assert.ok(k.icon && k.fields.length);
});

test("no events: nothing to set aside", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.events.length, 0); assert.equal(d.neededMonthly, 0); assert.equal(d.next, null);
});

test("events in date order, the monthly to pay in cash, a linked goal's money, past events left out of the total", () => {
  const p = familyPlan(TODAY);
  p.events = [{ id: "b", name: "Party", kind: "other", date: "2028-11-02", other: 2500, saved: 500 }, TRIP, { id: "old", name: "Last year", kind: "other", date: "2025-01-01", other: 999 }];
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.events.map((e) => e.id), ["old", "t", "b"]);
  const t = d.events[1];
  assert.equal(t.total, 4260); assert.equal(t.months, 8); near(t.neededMonthly, pmtToReach(0.02 / 12, 8, 4260, 0));
  near(d.events[2].neededMonthly, pmtToReach(0.02 / 12, 24, 2500, 500));
  assert.equal(d.events[0].past, true); assert.equal(d.upcoming, 2); near(d.neededMonthly, t.neededMonthly + d.events[2].neededMonthly);
  assert.equal(d.next.id, "t");
  p.events[1] = { ...TRIP, goalId: "g-trip" };
  const linked = compute(p, { today: TODAY }).events.find((e) => e.id === "t");
  assert.equal(linked.goal.id, "g-trip"); assert.equal(linked.saved, linked.goal.funded);
});
