import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, largestWhere, smallestWhere } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { project, copyInputs } from "../../../core/math/retirement.js";

const TODAY = "2026-10-30";
const lever = (d, id) => d.levers.find((l) => l.id === id);
const I = buildInputs(familyPlan(), { today: TODAY }).inputs;
const meets = (inputs, legacy = 0) => { const r = project(inputs); return r.success && r.endBalanceReal >= legacy - 0.5; };

test("the search helpers: largest and smallest where a test holds, the bracket grown when needed", () => {
  assert.ok(Math.abs(largestWhere((x) => x <= 1234.5, 0, 10, 0.01) - 1234.5) < 0.01, "grows past hi");
  assert.equal(largestWhere((x) => x < 0, 0, 10), null);
  assert.ok(Math.abs(smallestWhere((x) => x >= 77.25, 0, 1000, 0.01) - 77.25) < 0.01);
  assert.equal(smallestWhere((x) => x >= 0, 0, 10), 0); assert.equal(smallestWhere(() => false, 0, 10), null);
});

test("an empty plan says what is missing", () => {
  const e = compute(emptyPlan(), { today: TODAY });
  assert.equal(e.ready, false); assert.ok(e.missing.length);
});

test("just lasting: every lever has room, and each answer is the edge (it works there and not a step beyond)", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.equal(d.meets, true);
  assert.deepEqual(d.levers.map((l) => l.id), ["spending", "retire", "saving", "returns", "lump", "claim"]);
  for (const l of d.levers) assert.equal(l.status === "room" || l.status === "same", true, l.id);
  const s = lever(d, "spending").value * 12;
  assert.ok(meets({ ...copyInputs(I), spending: { yearly: s } }) && !meets({ ...copyInputs(I), spending: { yearly: s + 24 } }), "spending edge");
  const retire = lever(d, "retire").value;
  const at = (a) => { const p = familyPlan(); p.household.people[0].retirementAge = a; return buildInputs(p, { today: TODAY }).inputs; };
  assert.ok(meets(at(retire)) && !meets(at(retire - 1)), "earliest retirement age");
  const room = lever(d, "lump").value;
  const out = (x) => { const c = copyInputs(I); c.events.push({ year: 2026, amount: x }); return c; };
  assert.ok(meets(out(room)) && !meets(out(room + 200)), "room today");
});

test("leaving $3 million is out of reach for spending and retiring alone; saving, returns and a lump sum say how much", () => {
  const d = compute(familyPlan(), { today: TODAY, legacy: 3000000 });
  assert.equal(d.meets, false); assert.equal(d.legacy, 3000000);
  assert.equal(lever(d, "spending").status, "cannot"); assert.equal(lever(d, "retire").status, "cannot");
  const save = lever(d, "saving");
  assert.equal(save.status, "needs"); assert.ok(save.value > save.current);
  const extra = (save.value - save.current) * 12;
  const c = copyInputs(I); c.contributions.push({ bucket: "deferred", yearly: extra, personIndex: 0, name: "extra" });
  assert.ok(meets(c, 3000000), "the extra saving reaches it");
  const ret = lever(d, "returns"); assert.equal(ret.status, "needs"); assert.ok(ret.value > ret.current);
  const lump = lever(d, "lump"); assert.equal(lump.title, "What it is short today"); assert.ok(lump.value > 0);
  const l = copyInputs(I); l.events.push({ year: 2026, amount: -lump.value });
  assert.ok(meets(l, 3000000));
});

test("Social Security: the claiming age that leaves the most to spend, with the curve of all nine", () => {
  const d = compute(familyPlan(), { today: TODAY });
  const c = lever(d, "claim");
  assert.equal(c.results.length, 9); assert.deepEqual(c.results.map((r) => r.age), [62, 63, 64, 65, 66, 67, 68, 69, 70]);
  const best = c.results.reduce((a, r) => (r.monthly > a.monthly ? r : a));
  assert.equal(c.value, best.age);
});
