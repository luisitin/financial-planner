import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { survival } from "../longevity/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withQuotes = (q) => { const p = familyPlan(TODAY); p.retirement.annuities = q; return p; };

test("not ready without the plan; no quotes, the plan alone", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
  const d = compute(familyPlan(TODAY), { today: TODAY, paths: 20 });
  assert.equal(d.ready, true); assert.equal(d.quotes.length, 0);
});

test("a quote: payout rate, the return over the likely lifetime, the bond ladder, the plan with it", () => {
  const d = compute(withQuotes([{ id: "q", name: "Q", personId: "p-ana", premium: 100000, monthly: 1150, startAge: 65 }]), { today: TODAY, paths: 30 });
  const q = d.quotes[0];
  near(q.payoutRate, 0.138);
  // the expected payments at that rate equal the premium
  let v = 0; for (let t = 0; t <= 115 - 36; t++) v += (36 + t >= 65 ? 13800 : 0) * survival(36, 36 + t) / Math.pow(1 + q.rate, t);
  near(v, 100000, 1e-3);
  let ladder = 0; for (let t = 0; 36 + t <= q.endAge; t++) ladder += (36 + t >= 65 ? 13800 : 0) / Math.pow(1 + d.bondRate, t);
  near(q.ladderCost, ladder); near(q.ladderSaving, ladder - 100000);
  assert.ok(q.withIt.endReal < d.base.endReal, "the premium leaves savings");
  assert.ok(q.floorAfter > q.floorBefore);
});

test("joint life pays while either lives: a lower monthly can still be worth as much; a later start lowers the bond ladder", () => {
  const d = compute(withQuotes([{ id: "s", personId: "p-ana", premium: 100000, monthly: 1000, startAge: 65 }, { id: "j", personId: "p-ana", premium: 100000, monthly: 1000, startAge: 65, joint: true }, { id: "late", personId: "p-ana", premium: 100000, monthly: 1000, startAge: 75 }]), { today: TODAY, paths: 0 });
  const [s, j, late] = d.quotes;
  assert.ok(j.rate > s.rate, "the same payment for longer"); assert.equal(j.partnerName, "Bo");
  assert.ok(late.ladderCost < s.ladderCost);
});
