// tests/returns.test.mjs -- core/math/returns.js on hand-checked cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import { xirr, twr, cagr, growth, maxDrawdown, seriesStats, mixReturns } from "../core/math/returns.js";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("xirr: one deposit doubling in exactly two years is 41.42% a year; monthly deposits give a sensible rate; no sign change gives null", () => {
  near(xirr([{ date: "2024-01-01", amount: -1000 }, { date: "2026-01-01", amount: 2000 }]), Math.SQRT2 - 1, 2e-3);   // 731 days, not exactly two years
  near(xirr([{ date: "2025-01-01", amount: -1000 }, { date: "2026-01-01", amount: 1070 }]), 0.07, 2e-3);
  // 12 monthly deposits of 100, worth 1,260 at the end: about 9.9% a year (money was invested half a year on average)
  const flows = []; for (let m = 0; m < 12; m++) flows.push({ date: `2025-${String(m + 1).padStart(2, "0")}-01`, amount: -100 });
  flows.push({ date: "2026-01-01", amount: 1260 });
  const r = xirr(flows); assert.ok(r > 0.09 && r < 0.11, String(r));
  assert.equal(xirr([{ date: "2025-01-01", amount: -100 }, { date: "2026-01-01", amount: -100 }]), null);
  near(xirr([{ date: "2025-01-01", amount: -1000 }, { date: "2026-01-01", amount: 700 }]), -0.3, 2e-3);   // a loss
});

test("twr: deposits do not count as return; a big deposit before a good period does not flatter the figure", () => {
  const r = twr([{ date: "2025-01-01", value: 1000 }, { date: "2025-07-01", value: 1100 }, { date: "2026-01-01", value: 2200, flow: 1000 }]);
  near(r.total, 1.1 * (2200 - 1000) / 1100 - 1, 1e-9);   // +10% then +9.09%
  assert.equal(r.periods.length, 2);
  near(r.annualised, r.total, 2e-3);                        // a calendar year (365 of 365.25 days)
  assert.equal(twr([{ date: "2025-01-01", value: 1000 }]), null);
  const two = twr([{ date: "2024-01-01", value: 100 }, { date: "2026-01-01", value: 121 }]);
  near(two.annualised, 0.1, 1e-3);
});

test("cagr, growth, drawdown and the statistics", () => {
  near(cagr(100, 200, 10), Math.pow(2, 0.1) - 1);
  assert.deepEqual(growth([0.1, -0.5], 100).map((x) => Math.round(x)), [100, 110, 55]);
  const dd = maxDrawdown([100, 120, 90, 60, 80, 130]);
  near(dd.depth, 0.5); assert.equal(dd.peakIndex, 1); assert.equal(dd.troughIndex, 3); assert.equal(dd.recoveryIndex, 5);
  assert.equal(maxDrawdown([100, 110, 121]).depth, 0);
  assert.equal(maxDrawdown([100, 50]).recoveryIndex, null);
  const s = seriesStats([0.1, -0.1, 0.2]);
  near(s.mean, 0.2 / 3); assert.equal(s.best, 0.2); assert.equal(s.worst, -0.1); assert.equal(s.lossYears, 1); near(s.geometric, Math.pow(1.1 * 0.9 * 1.2, 1 / 3) - 1);
  assert.equal(seriesStats([]).n, 0);
  near(mixReturns([{ stocks: 0.1, bonds: 0.02, bills: 0.01 }], { stocks: 0.5, bonds: 0.5 })[0], 0.06);
});
