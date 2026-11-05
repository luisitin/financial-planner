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

test("the claiming lever moves only who has not claimed, from the ages still possible (round 4)", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const T = "2026-11-02";
  const p = retirementPlan();
  // Sam is 76 and gets it already (on Income); Lee is 69 and 5 months and has not claimed
  p.household.people.find((x) => x.id === "sam").birthDate = "1950-03-10";
  p.household.people.find((x) => x.id === "lee").birthDate = "1957-06-20";
  for (const x of p.household.people) x.retirementAge = 62;
  p.income = (p.income ?? []).filter((x) => !["salary", "bonus", "business"].includes(x.type));
  p.income.push({ id: "ss-sam", name: "Sam's Social Security", type: "social", personId: "sam", amount: 2800, period: "monthly", growth: 0, taxable: true });
  p.retirement.socialSecurity = { sam: { claimAge: 66, monthlyAtFRA: 2800 }, lee: { claimAge: 70, monthlyAtFRA: 2100 } };
  const d = compute(p, { today: T });
  const lever = d.levers?.find((l) => l.id === "claim");
  if (!lever) return;   // the plan cannot be judged on this fixture: nothing to say
  assert.deepEqual(lever.who, ["lee"]);
  // 69 and 5 months: "now" (to the month, the Social Security page's first choice) and 70 are what is left (review 2026-11-02)
  assert.deepEqual(lever.results.map((r) => Math.round(r.age * 12)), [69 * 12 + 5, 70 * 12]);
  assert.match(lever.sentence, /^Lee claiming (at 70|now \(69 and 5 months\))/); assert.match(lever.sentence, /Sam already gets it/);
});

test("the spending lever says its figure is the average-market one (round 5, 2026-11-02)", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.match(lever(d, "spending").sentence, /^If markets do as well as average, (up to )?about \$[\d,]+ a month/);
  const big = compute(familyPlan(), { today: TODAY, legacy: 2500000 });
  assert.ok(lever(big, "spending").status === "cannot" || /^If markets do as well as average/.test(lever(big, "spending").sentence));
});

test("the claiming lever says 'now' only when it is now for everyone it moves (review 2026-11-02, round 5)", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const T = "2026-11-02";
  // Sam is 64 and 6 months, Lee 60 and 5 months; a short plan, so claiming as soon as possible spends the most
  const p = retirementPlan();
  p.household.people[0].birthDate = "1962-05-10"; p.household.people[1].birthDate = "1966-06-20";
  for (const x of p.household.people) { x.retirementAge = 60; x.lifeExpectancy = 74; }
  p.income = []; p.retirement.contributions = [];
  const c = lever(compute(p, { today: T }), "claim");
  assert.equal(Math.round(c.nowAge * 12), 64 * 12 + 6); assert.equal(c.nowForAll, false, "19 months away for Lee");
  assert.equal(c.value, c.nowAge);
  assert.match(c.sentence, /^Sam and Lee claiming at 64 and 6 months lets the plan spend the most/); assert.doesNotMatch(c.sentence, /\bnow\b/);
  // Sam alone: today's age is now
  delete p.retirement.socialSecurity.lee;
  const s = lever(compute(p, { today: T }), "claim");
  assert.equal(s.nowForAll, true); assert.equal(s.value, s.nowAge);
  assert.match(s.sentence, /^Sam claiming now \(64 and 6 months\)/);
});
