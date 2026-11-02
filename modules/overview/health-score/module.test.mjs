import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, PARTS, BANDS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const part = (d, id) => d.parts.find((p) => p.id === id);

test("the weights add to 100 and the bands cover every score", () => {
  assert.equal(Object.values(PARTS).reduce((s, v) => s + v, 0), 100);
  for (const s of [0, 49, 50, 70, 85, 100]) assert.ok(BANDS.find((b) => s >= b.min));
});

test("an empty plan scores low and every part says what to add", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, true); assert.ok(d.score < 30, String(d.score));
  for (const id of ["cushion", "saving", "retirement", "protection", "goals"]) assert.equal(part(d, id).status, "unknown", id);
  assert.ok(d.parts.every((p) => p.fix || p.points === p.max));
});

test("the family: each part from its page, the total is the sum, the gains largest first", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.equal(d.score, Math.round(d.parts.reduce((s, p) => s + p.points, 0)));
  assert.equal(d.band, BANDS.find((b) => d.score >= b.min).label);
  const c = part(d, "cushion"); assert.ok(c.points < 3 && c.status === "bad", "0.9 months of 6");
  assert.equal(part(d, "retirement").points, 25, "133% of planned spending");
  assert.equal(part(d, "saving").points, 15);
  const pr = part(d, "protection"); assert.equal(pr.points, 10, "4 of 6 life shocks"); assert.match(pr.detail, /"Ana can never work again"/);
  assert.equal(part(d, "goals").points, 0);
  for (let i = 1; i < d.gains.length; i++) assert.ok(d.gains[i - 1].max - d.gains[i - 1].points >= d.gains[i].max - d.gains[i].points);
  assert.equal(d.gains[0].id, "cushion");
});

test("improving the plan raises the score: a full cushion and reviewed assumptions", () => {
  const before = compute(familyPlan(), { today: TODAY }).score;
  const p = familyPlan(); p.accounts.find((a) => a.id === "a-chk").balance = 40000; p.assumptions.reviewedAt = "2026-10-01";
  const d = compute(p, { today: TODAY });
  assert.equal(part(d, "cushion").points, 15); assert.equal(part(d, "knows").points, 10);
  assert.ok(d.score > before + 10, `${before} -> ${d.score}`);
});

test("no retirement verdict before Social Security is known: not scored, the top fix is to add it; Quick answers and the Timeline say nothing either way (round 4)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { answerFor } = await import("../quick/compute.js");
  const { compute: timeline } = await import("../timeline/compute.js");
  const { compute: next } = await import("../next-best-action/compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  p.retirement.socialSecurity = {};
  const d = compute(p, { today: T });
  const r = d.parts.find((x) => x.id === "retirement"), pr = d.parts.find((x) => x.id === "protection");
  assert.equal(r.status, "unknown"); assert.equal(r.points, 0); assert.match(r.detail, /^Not scored yet/); assert.doesNotMatch(r.detail, /runs out/);
  assert.match(r.fix, /Add Social Security for each adult/); assert.deepEqual(r.go, ["retirement", "social-security"]);
  assert.equal(pr.status, "unknown");
  assert.equal(d.gains[0].id, "retirement", "the biggest gain is adding Social Security, not spending less");
  assert.equal(answerFor("retire", p, { today: T }), null);
  const tl = timeline(p, { today: T });
  assert.ok(!tl.events.some((e) => e.id === "short" || e.id === "lasts")); assert.ok(tl.events.some((e) => e.id === "needs-ss"));
  // said as "none" for both, it is judged again
  p.guide = { setup: { ss: { "p-ana": "none", "p-bo": "none" } } };
  assert.notEqual(compute(p, { today: T }).parts.find((x) => x.id === "retirement").status, "unknown");
  // one adult: "An IRA of your own", not "for each of you"
  const one = familyPlan(T);
  one.household.people = one.household.people.filter((x) => x.id !== "p-bo");
  one.income = one.income.filter((x) => x.personId !== "p-bo");
  assert.equal(next(one, { today: T }).steps.find((s) => s.id === "ira")?.title, "An IRA of your own");
});
