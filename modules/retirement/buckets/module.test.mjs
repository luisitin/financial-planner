import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, DEFAULTS } from "./compute.js";
import { compute as computeCashFlow } from "../cash-flow/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("not ready without the plan", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, false); assert.equal(d.cashYears, DEFAULTS.cashYears);
});

test("the family: cash for two years of withdrawals, bonds for eight (discounted), stocks the rest", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  const cf = computeCashFlow(p, { today: TODAY, real: true });
  const ret = cf.rows.filter((r) => r.retired);
  const draw = (r) => Math.max(0, r.out.spending + r.out.taxes - r.in.income);
  assert.equal(d.retireYear, 2055);
  near(d.savings, cf.rows.find((r) => r.year === 2054).end.total);
  near(d.buckets[0].amount, draw(ret[0]) + draw(ret[1]));
  let bonds = 0; for (let i = 2; i < 10; i++) bonds += draw(ret[i]) / Math.pow(1 + d.bondRealRate, i);
  near(d.buckets[1].amount, bonds);
  near(d.buckets[2].amount, d.savings - d.buckets[0].amount - d.buckets[1].amount);
  near(d.buckets.reduce((s, b) => s + b.share, 0), 1);
  near(d.impliedStocks, d.buckets[2].share); assert.equal(d.planStocks, 0.5);
  assert.deepEqual([d.buckets[1].from, d.buckets[1].to, d.buckets[2].from], [2057, 2064, 2065]);
});

test("more years in the safe buckets leave less in stocks; too many is flagged", () => {
  const p = familyPlan(TODAY); p.retirement.buckets = { cashYears: 3, bondYears: 15 };
  const d = compute(p, { today: TODAY });
  assert.ok(d.impliedStocks < compute(familyPlan(TODAY), { today: TODAY }).impliedStocks);
  p.retirement.spendingMonthly = 30000; p.retirement.buckets = { cashYears: 5, bondYears: 20 };
  const big = compute(p, { today: TODAY });
  assert.equal(big.short, true); assert.equal(big.buckets[2].amount, 0); assert.match(big.warnings[0], /would not fill/);
});
