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

// review 2026-11-02: "Guaranteed income covers" is against the first retirement year's spending and its health cover, as
// on Will the money last? (it read the spending alone, so it no longer matched the projection's own share)
test("the share guaranteed income covers matches the projection's, health cover included", async () => {
  const { compute: projection } = await import("../projection/compute.js");
  const p = withQuotes([{ id: "q", name: "Q", personId: "p-ana", premium: 100000, monthly: 1150, startAge: 65 }]);
  const d = compute(p, { today: TODAY, paths: 0 }), pr = projection(p, { today: TODAY });
  assert.ok(pr.rows.find((r) => r.year === pr.inputs.retireYear).eventSpending > 0, "health cover in the first retirement year");
  near(d.quotes[0].floorBefore, pr.coverage, 1e-9);
});

test("joint life pays while either lives: a lower monthly can still be worth as much; a later start lowers the bond ladder", () => {
  const d = compute(withQuotes([{ id: "s", personId: "p-ana", premium: 100000, monthly: 1000, startAge: 65 }, { id: "j", personId: "p-ana", premium: 100000, monthly: 1000, startAge: 65, joint: true }, { id: "late", personId: "p-ana", premium: 100000, monthly: 1000, startAge: 75 }]), { today: TODAY, paths: 0 });
  const [s, j, late] = d.quotes;
  assert.ok(j.rate > s.rate, "the same payment for longer"); assert.equal(j.partnerName, "Bo");
  assert.ok(late.ladderCost < s.ladderCost);
});

// round 8 batch 6 review: a line with calendar bounds (a rental's loan payment that comes back only after the loan is paid off,
// fromYear 2051) counted in the first retirement year (2045), so the share no longer matched the projection's
test("batch 6: guaranteed income keeps a line's calendar years (the condo's loan payment back only from 2051)", async () => {
  const { compute: projection } = await import("../projection/compute.js");
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  const p = condoOnNetWorthPlan(); p.retirement.annuities = [{ id: "q", name: "Q", personId: "setup-self", premium: 100000, monthly: 600, startAge: 65 }];
  const pr = projection(p, { today: T });
  assert.ok(pr.inputs.incomes.some((x) => x.part === "loan back" && x.fromYear === 2051));
  near(compute(p, { today: T, paths: 0 }).quotes[0].floorBefore, pr.coverage, 1e-9);
});

// stress test 2026-11-11, RC-9: a quote dearer than all the savings on file is said, not run to 0% and $0
test("a quote that costs more than the savings on file is marked tooBig and not run", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-11-11");
  p.retirement = { ...(p.retirement ?? {}), annuities: [{ id: "big", name: "Q", personId: p.household.people[0].id, premium: 5e7, monthly: 1200, startAge: 65 }, { id: "ok", name: "Small", personId: p.household.people[0].id, premium: 1000, monthly: 6, startAge: 65 }] };
  const d = compute(p, { today: "2026-11-11", paths: 20 });
  const big = d.quotes.find((q) => q.id === "big"), ok = d.quotes.find((q) => q.id === "ok");
  assert.equal(big.tooBig, true); assert.equal(big.withIt, null); assert.ok(big.savings > 0 && big.savings < 5e7);
  assert.equal(ok.tooBig, false); assert.ok(ok.withIt);
});
