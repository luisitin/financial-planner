// tests/retirement-pages.test.mjs -- the Phase 5 computes on the shared couple (qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute as contributions } from "../modules/retirement/contributions/compute.js";
import { compute as cashFlow } from "../modules/retirement/cash-flow/compute.js";
import { compute as monteCarlo, drawSequences } from "../modules/retirement/monte-carlo/compute.js";
import { compute as historical, replayAll } from "../modules/retirement/historical/compute.js";
import { compute as strategies } from "../modules/retirement/withdrawal-strategy/compute.js";
import { compute as sequenceRisk } from "../modules/retirement/sequence-risk/compute.js";
import { compute as rmd } from "../modules/retirement/rmd/compute.js";
import { compute as longevity, survival, lifeExpectancy, ageAtSurvival } from "../modules/retirement/longevity/compute.js";
import { compute as fire } from "../modules/retirement/fire/compute.js";
import { buildInputs } from "../modules/retirement/projection/compute.js";
import { retirementPlan } from "../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../core/schema/migrate.js";

const TODAY = "2026-09-16";
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("contributions: totals, match, limits with catch-up, over-limit warning", () => {
  const p = retirementPlan();
  let d = contributions(p, { today: TODAY });
  near(d.yearly, 18000 + 7000 + 7000); near(d.matchYearly, 6000); near(d.totalYearly, 38000);
  const sam = d.byPerson.find((x) => x.name === "Sam");
  assert.equal(sam.age, 58); assert.equal(d.limitsYear, 2026);
  const k = sam.limits.find((l) => l.kind === "401k");
  assert.equal(k.limit, 24500 + 8000, "over 50: catch-up"); assert.equal(k.used, 18000); assert.equal(k.over, 0);
  assert.deepEqual(d.warnings, []);
  p.retirement.contributions[0].amount = 3000;   // 36,000 a year into the 401(k)
  d = contributions(p, { today: TODAY });
  assert.ok(d.warnings.some((w) => w.includes("over the 2026 limit")));
  assert.equal(contributions(emptyPlan(), { today: TODAY }).hasData, false);
});
test("cash-flow table: real by default, nominal on request, totals add up", () => {
  const d = cashFlow(retirementPlan(), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.rows.length, 40); assert.equal(d.real, true);
  const r = d.rows.find((x) => x.year === 2040);
  near(r.out.spending, 78000, 0.5, "real spending stays at today's figure");
  const n = cashFlow(retirementPlan(), { today: TODAY, real: false }).rows.find((x) => x.year === 2040);
  assert.ok(n.out.spending > 78000 * 1.4, "nominal spending has 14 years of inflation in it");
  assert.ok(d.totals.withdrawn > 0 && d.totals.income > 0);
});
test("monte carlo: seeded and repeatable, bands in order, a sensible success rate", () => {
  const seqs = drawSequences(3, 5, { stocks: 0.07, bonds: 0.04, stdevStocks: 0.15, stdevBonds: 0.05, seed: 7 });
  assert.equal(seqs.length, 3); assert.equal(seqs[0].length, 5);
  assert.deepEqual(drawSequences(1, 3, { stocks: 0.07, bonds: 0.04, stdevStocks: 0.15, stdevBonds: 0.05, seed: 7 })[0], seqs[0].slice(0, 3).map((x) => x));
  const big = drawSequences(4000, 1, { stocks: 0.07, bonds: 0.04, stdevStocks: 0.15, stdevBonds: 0.05, seed: 3 }).map((s) => s[0].stocks);
  const mean = big.reduce((s, x) => s + x, 0) / big.length;
  assert.ok(Math.abs(mean - 0.07) < 0.01, `mean stock draw ${mean}`);
  const d = monteCarlo(retirementPlan(), { today: TODAY, paths: 300, seed: 1 });
  assert.equal(d.ready, true); assert.equal(d.paths, 300);
  assert.ok(d.successRate >= 0 && d.successRate <= 1);
  const last = d.bands[d.bands.length - 1];
  assert.ok(last.p10 <= last.p50 && last.p50 <= last.p90);
  assert.equal(d.bands.length, 40); assert.equal(d.byAge[0].funded, 1);
  assert.equal(monteCarlo(retirementPlan(), { today: TODAY, paths: 300, seed: 1 }).successRate, d.successRate, "same seed, same answer");
  assert.equal(monteCarlo(retirementPlan(), { today: TODAY, paths: 5000, maxPaths: 400 }).paths, 400, "the server's cap wins");
});
test("historical: every start year with enough history; worst starts named; safe spending under the planned figure", () => {
  const b = buildInputs(retirementPlan(), { today: TODAY });
  const runs = replayAll(b.inputs);
  assert.equal(runs.length, 98 - 40 + 1);
  const d = historical(retirementPlan(), { today: TODAY, quick: true });
  assert.equal(d.ready, true); assert.equal(d.windows, 59); assert.equal(d.safeSpending, null);
  assert.ok(d.successRate > 0.5); assert.equal(d.worst.length, 5); assert.deepEqual(d.dataRange, [1928, 2025]);
  const full = historical(retirementPlan(), { today: TODAY });
  assert.ok(full.safeSpending > 0 && full.safeSpending < 200000);
});
test("withdrawal strategies: four rows, expected and worst-history runs, percent never fails", () => {
  const d = strategies(retirementPlan(), { today: TODAY });
  assert.equal(d.rows.length, 4); assert.ok(d.worstStartYear >= 1928);
  const pct = d.rows.find((r) => r.key === "percent");
  assert.equal(pct.worst.success, true, "a share of what is left cannot run out");
  assert.ok(pct.worst.lowest < pct.expected.firstYear);
  const fixed = d.rows.find((r) => r.key === "fixed-real");
  near(fixed.expected.firstYear, 78000, 0.5);
  assert.equal(d.chosen, "fixed-real");
});
test("sequence risk: same years, three orders; worst-first ends lowest, best-first highest", () => {
  const d = sequenceRisk(retirementPlan(), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.runs.length, 3);
  const by = (k) => d.runs.find((r) => r.key === k);
  assert.ok(by("best-first").endReal >= by("actual").endReal - 1);
  assert.ok(by("worst-first").endReal <= by("actual").endReal + 1);
  assert.ok(d.average.stocks > -0.5 && d.average.stocks < 0.5);
});
test("rmd: start ages by birth year, the first required withdrawal from the projection, the table", () => {
  const d = rmd(retirementPlan(), { today: TODAY });
  const sam = d.people.find((p) => p.name === "Sam");
  assert.equal(sam.startAge, 75); assert.equal(sam.startYear, 2043); assert.equal(sam.yearsUntil, 17);
  assert.ok(sam.firstRmd > 0 && sam.firstRmdReal > 0 && sam.firstRmdReal < sam.firstRmd);
  assert.equal(d.schedule[0].year, 2043); assert.equal(d.schedule[0].factor, 24.6);
  assert.equal(d.table[0].age, 72); assert.equal(d.hasDeferred, true);
});
test("longevity: the curve, expectancy, plan-to ages, a couple's either-alive chance", () => {
  assert.equal(survival(60, 60), 1);
  assert.ok(survival(65, 90, { sex: "f" }) > survival(65, 90, { sex: "m" }), "women live longer");
  assert.ok(survival(65, 90, { health: "better" }) > survival(65, 90) && survival(65, 90, { health: "worse" }) < survival(65, 90));
  const le = 65 + lifeExpectancy(65, { sex: "m" });
  assert.ok(le > 80 && le < 86, `male life expectancy at 65 about 82-84, got ${le}`);
  const p90 = ageAtSurvival(65, 0.1, { sex: "f" });
  assert.ok(p90 >= 93 && p90 <= 100, `a woman of 65 has a 10% chance of reaching about ${p90}`);
  const d = longevity(retirementPlan(), { today: TODAY });
  assert.equal(d.people.length, 2); assert.ok(d.either); assert.ok(d.either.planTo > d.people[0].planTo - 1);
  assert.ok(d.suggestion.includes("at least one of you"));
});
test("fire: the number, progress, years to FI and the coast figure", () => {
  const d = fire(retirementPlan(), { today: TODAY });
  assert.equal(d.ready, true);
  near(d.fiNumber, 78000 / 0.04, 0.5);
  near(d.invested, 150000 + 730000 + 90000, 0.5);
  assert.ok(d.progress > 0.4 && d.progress < 0.6);
  assert.ok(d.yearsToFi !== null && d.yearsToFi > 0 && d.yearsToFi < 30);
  assert.ok(d.coast.number < d.fiNumber && d.coast.number > 0);
  assert.equal(d.retireAge, 65); assert.equal(d.age, 58);
  assert.equal(fire(emptyPlan(), { today: TODAY }).ready, false);
});
