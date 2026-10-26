import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32, normal, simulate, percentile } from "../core/math/montecarlo.js";

test("seeded generator is reproducible", () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});
test("normal draws have roughly zero mean and unit variance", () => {
  const r = mulberry32(7); let s = 0, s2 = 0; const n = 20000;
  for (let i = 0; i < n; i++) { const x = normal(r); s += x; s2 += x * x; }
  assert.ok(Math.abs(s / n) < 0.03);
  assert.ok(Math.abs(s2 / n - 1) < 0.05);
});
test("percentile interpolates", () => { assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5); });
test("simulate: no volatility reproduces compound growth; withdrawals can fail", () => {
  const flat = simulate({ start: 1000, years: 10, meanReturn: 0.05, stdev: 0, paths: 10 });
  assert.ok(Math.abs(flat.final.p50 - 1000 * 1.05 ** 10) < 1e-6);
  assert.equal(flat.successRate, 1);
  const broke = simulate({ start: 1000, years: 10, meanReturn: 0.0, stdev: 0, paths: 10, flow: () => -200 });
  assert.equal(broke.successRate, 0);
  assert.equal(broke.final.p50, 0);
});
