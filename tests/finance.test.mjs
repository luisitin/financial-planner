import { test } from "node:test";
import assert from "node:assert/strict";
import { fv, pv, pmt, pmtToReach, nper, amortization, cagr, realRate, inflate, deflate } from "../core/math/finance.js";

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("pmt matches a standard mortgage payment", () => { close(pmt(0.06 / 12, 360, 300000), 1798.65); });
test("pmt with zero rate is straight division", () => { close(pmt(0, 12, 1200), 100); });
test("fv of a lump sum and of monthly savings", () => {
  close(fv(0.05, 10, 0, 1000), 1628.89);
  close(fv(0.07 / 12, 120, 500, 0), 86542.30, 0.5);
});
test("pv inverts fv", () => { close(pv(0.05, 10, 0, fv(0.05, 10, 0, 1000)), 1000); });
test("pmtToReach hits the target", () => {
  const p = pmtToReach(0.005, 60, 20000, 5000);
  close(fv(0.005, 60, p, 5000), 20000);
});
// -ln(1 - 5000*0.02/300) / ln(1.02) = ln(1.5)/ln(1.02) = 20.475 periods
test("nper: months to pay a card", () => { close(nper(0.02, 300, 5000), 20.475, 0.01); assert.equal(nper(0.02, 50, 5000), Infinity); });
test("amortization totals and extra payments", () => {
  const a = amortization({ principal: 200000, annualRate: 0.05, years: 30 });
  close(a.payment, 1073.64);
  assert.equal(a.periods, 360);
  close(a.totalInterest, 186511.57, 2);
  const b = amortization({ principal: 200000, annualRate: 0.05, years: 30, extraPayment: 200 });
  assert.ok(b.periods < 300 && b.totalInterest < a.totalInterest);
  close(b.schedule[b.schedule.length - 1].balance, 0);
});
test("cagr, real rate, inflation helpers", () => {
  close(cagr(100, 200, 10), 0.0718, 0.0001);
  close(realRate(0.07, 0.03), 0.0388, 0.0001);
  close(inflate(100, 0.03, 10), 134.39);
  close(deflate(134.39, 0.03, 10), 100);
});

test("rateFor: the inverse of fv (an internal rate of return)", async () => {
  const { rateFor } = await import("../core/math/finance.js");
  for (const [r, n, p, v, due] of [[0.05, 10, 100, 1000, true], [0.07, 30, 5000, 0, true], [-0.03, 8, 200, 0, false], [0.12, 5, 0, 2500, false]]) {
    const target = fv(r, n, p, v, due);
    assert.ok(Math.abs(rateFor(target, n, p, v, due) - r) < 1e-9, `${r}`);
  }
  assert.ok(Math.abs(rateFor(1000 + 100 * 10, 10, 100, 1000)) < 1e-9, "no growth: 0%");
  assert.equal(rateFor(100, 0, 10), null); assert.equal(rateFor(0, 5, 10), null); assert.equal(rateFor(100, 5, 0, 0), null);
  assert.equal(rateFor(1e-9, 5, 100), null, "below what is left at -99%");
});
