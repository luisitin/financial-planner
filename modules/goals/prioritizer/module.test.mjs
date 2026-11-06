import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { compute as computeGoals } from "../goals/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withAvailable = (n) => { const p = familyPlan(TODAY); p.whatIfs = { prioritizer: { available: n } }; return p; };

test("no goals: nothing to share", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).count, 0);
});

test("the family: must-haves first, then by date; everyone on time with money to spare", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.deepEqual(d.rows.map((r) => r.name), ["Emergency fund", "Replace Bo's car", "Cy's college", "Japan trip"]);
  const needs = Object.fromEntries(computeGoals(familyPlan(TODAY), { today: TODAY }).goals.map((g) => [g.id, g.neededMonthly]));
  for (const r of d.rows) { near(r.needed, needs[r.id]); near(r.allocated, r.needed); assert.equal(r.onTime, true); assert.equal(r.slipMonths, 0); }
  near(d.leftover, d.available - d.neededTotal); assert.equal(d.short, 0); assert.equal(d.override, null);
});

test("too little: the order decides who waits, and how long", () => {
  const d = compute(withAvailable(1500), { today: TODAY });
  const [ef, car, col, trip] = d.rows;
  near(ef.allocated, ef.needed); assert.equal(ef.onTime, true);
  near(car.allocated, 1500 - ef.needed); assert.equal(car.onTime, false); assert.ok(car.slipMonths > 0);
  assert.equal(col.allocated, 0); assert.equal(trip.allocated, 0);
  near(d.short, d.neededTotal - 1500); assert.equal(d.override, 1500); assert.equal(d.leftover, 0);
});

test("an undated goal gets what is left, up to a year's worth", () => {
  const p = withAvailable(10000); p.goals.push({ id: "g-x", name: "New sofa", target: 2400, targetDate: "", priority: 3, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false });
  const d = compute(p, { today: TODAY });
  const sofa = d.rows.find((r) => r.id === "g-x");
  assert.equal(sofa.noDate, true); near(sofa.allocated, 200); assert.equal(sofa.onTime, null);
});

test("round 8 item 18: a goal whose date has passed is due now: listed apart, never shared a month's money", async () => {
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.goals = [{ id: "old", name: "Child 2's college", target: 103000, targetDate: "2023-08-15", saved: 0, monthly: 0, inflates: true },
    { id: "car", name: "Car", target: 12000, targetDate: "2028-11-06", saved: 0, monthly: 0, inflates: false }];
  p.whatIfs = { prioritizer: { available: 1000 } };
  const d = compute(p, { today: "2026-11-06" });
  assert.deepEqual(d.rows.map((r) => r.id), ["car"]);
  assert.deepEqual(d.pastDue.map((x) => [x.id, x.dueNow]), [["old", 103000]]);
  assert.ok(d.rows[0].allocated > 0);
});

// Round 8 batch 2 review (UX 4): "mark it done" was said where no button does it
test("round 8 review UX 4: a goal whose date has passed says what Goals can do, not 'mark it done'", async () => {
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const p = emptyPlan();
  p.goals = [{ id: "old", name: "Boat", target: 8000, targetDate: "2026-06-01", saved: 0, monthly: 0, inflates: false },
    { id: "car", name: "Car", target: 12000, targetDate: "2028-11-06", saved: 0, monthly: 0, inflates: false }];
  p.whatIfs = { prioritizer: { available: 1000 } };
  const node = (tag, kids = [], extra = {}) => { const x = { tag, kids: [], style: {}, ...extra, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, remove() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l, fn) => node("button", [l], { onClick: fn }), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form"), uid: () => "x" };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => "2026-11-06" }, plan: p, store: { update() {} }, computeOf: () => null });
  const text = root.textContent.replace(/\s+/g, " ");
  assert.match(text, /Boat: its date has passed, with \$8,000 still to go\. Set a new date for it on Goals, or lower its amount if less is needed\./);
  assert.doesNotMatch(text, /mark it done/);
});
