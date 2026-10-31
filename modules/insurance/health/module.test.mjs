import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, outOfPocket, yearCost, QUIET, BAD, FICA, HDHP, HDHP_BY_YEAR, hdhpYear, hsaEligible } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const PPO = { id: "ppo", name: "Gold PPO", premium: 640, deductible: 1000, oopMax: 6000, coinsurance: 0.2, hsa: false };
const HSA = { id: "hsa", name: "Bronze HSA plan", premium: 390, deductible: 3400, oopMax: 8000, coinsurance: 0.2, hsa: true, employerHsa: 1000 };
const HMO = { id: "hmo", name: "Silver HMO", premium: 520, deductible: 500, oopMax: 7000, coinsurance: 0.1, hsa: false };
const planWith = (health) => { const p = familyPlan("2026-10-30"); p.insurance.health = health; return p; };

test("out of pocket: the deductible, then your share, capped at the maximum", () => {
  assert.equal(outOfPocket(PPO, 500), 500); assert.equal(outOfPocket(PPO, 1000), 1000);
  near(outOfPocket(PPO, 6000), 1000 + 0.2 * 5000); assert.equal(outOfPocket(PPO, 100000), 6000);
  assert.equal(outOfPocket({ deductible: 2000, coinsurance: 0 }, 50000), 2000, "no maximum entered, nothing after the deductible");
});

test("a year's cost: premiums less the employer's HSA money plus care less the tax saved through the HSA (up to the limit's room)", () => {
  const opts = { hsaRoom: 8750, taxRate: 0.22 + FICA };
  const c = yearCost(HSA, 6000, opts);
  near(c.oop, 3400 + 0.2 * 2600); near(c.taxSaved, c.oop * (0.22 + FICA)); near(c.total, 390 * 12 - 1000 + c.oop - c.taxSaved);
  const bad = yearCost(HSA, BAD, opts);
  near(bad.taxSaved, (8750 - 1000) * (0.22 + FICA), 1e-9);
  const p = yearCost(PPO, 6000, opts); assert.equal(p.taxSaved, 0); assert.equal(p.employer, 0);
});

test("no plans: nothing to compare; the defaults", () => {
  const d = compute(emptyPlan(), { today: "2026-10-30" });
  assert.equal(d.count, 0); assert.equal(d.tier, "self"); assert.equal(d.expected, 5000); assert.equal(d.hsaLimit, 4400);
});

test("the family's three plans: the cheapest for the usual year, the three years, where another wins", () => {
  const d = compute(planWith({ tier: "family", expected: 6000, plans: [PPO, HSA, HMO] }), { today: "2026-10-30" });
  assert.equal(d.hsaLimit, 8750); near(d.marginal, 0.22); near(d.taxRate, 0.22 + FICA);
  assert.equal(d.best, "hsa");
  const x = Object.fromEntries(d.plans.map((p) => [p.id, p]));
  near(x.ppo.usual.total, 7680 + 2000); near(x.hmo.usual.total, 6240 + 500 + 0.1 * 5500);
  near(x.ppo.quiet.total, 7680 + QUIET); near(x.ppo.bad.total, 7680 + 6000); assert.equal(x.ppo.worst, x.ppo.bad.total);
  const cross = Object.fromEntries(d.crossovers.map((c) => [c.id, c.ranges]));
  assert.deepEqual(cross.ppo, []);
  assert.equal(cross.hmo.length, 1); assert.ok(cross.hmo[0].from > 20000 && cross.hmo[0].to < 30000);
});

test("HSA eligibility: a plan ticked as HSA with too low a deductible is warned", () => {
  const d = compute(planWith({ tier: "self", plans: [{ ...HSA, deductible: 1500 }] }), { today: "2026-10-30" });
  assert.equal(d.plans[0].eligible, false); assert.match(d.warnings[0], /deductible under \$1,700/);
  assert.equal(HDHP.family.maxOop, 17000);
});

test("HSA plan rules by year (Rev. Proc. 2025-19 for 2026, 2026-24 for 2027); no out-of-pocket maximum entered", () => {
  assert.deepEqual(HDHP_BY_YEAR[2026].self, { minDeductible: 1700, maxOop: 8500, hsa: 4400 });
  assert.deepEqual(HDHP_BY_YEAR[2027].family, { minDeductible: 3500, maxOop: 17400, hsa: 9000 });
  assert.equal(hdhpYear(2026), 2026); assert.equal(hdhpYear(2027), 2027); assert.equal(hdhpYear(2031), 2027); assert.equal(hdhpYear(2024), 2026);
  const self26 = HDHP_BY_YEAR[2026].self, fam26 = HDHP_BY_YEAR[2026].family;
  assert.equal(hsaEligible({ deductible: 3000, oopMax: 6000, coinsurance: 0.2 }, self26), "yes");
  assert.equal(hsaEligible({ deductible: 1600, oopMax: 6000, coinsurance: 0.2 }, self26), "no");
  assert.equal(hsaEligible({ deductible: 3000, oopMax: 9000, coinsurance: 0.2 }, self26), "no");
  // no maximum entered: with a share after the deductible the most out of pocket is not known; with none it is the deductible
  assert.equal(hsaEligible({ deductible: 3000, coinsurance: 0.2 }, self26), "unknown");
  assert.equal(hsaEligible({ deductible: 3000, coinsurance: 0 }, self26), "yes");
  assert.equal(hsaEligible({ deductible: 18000, coinsurance: 0 }, fam26), "no");
  // 2027: a $1,700 self-only deductible no longer qualifies; the 2027 limits are shown and used
  const p = planWith({ tier: "self", plans: [{ id: "h", name: "Bronze HSA plan", premium: 300, deductible: 1700, oopMax: 8000, coinsurance: 0.2, hsa: true }] });
  const d26 = compute(p, { today: "2026-10-30" }), d27 = compute(p, { today: "2027-03-01" });
  assert.deepEqual([d26.year, d26.plans[0].eligible, d26.hsaLimit], [2026, true, 4400]);
  assert.deepEqual([d27.year, d27.plans[0].eligible, d27.hdhp.minDeductible, d27.hsaLimit], [2027, false, 1750, 4500]);
  p.insurance.health.plans[0] = { ...p.insurance.health.plans[0], deductible: 3000, oopMax: "" };
  assert.match(compute(p, { today: "2026-10-30" }).warnings.join(" "), /enter its out-of-pocket maximum/);
});
