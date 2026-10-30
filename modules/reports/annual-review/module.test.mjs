import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, defaultYear } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";

const TODAY = "2026-10-30";

test("the year a review is about: last year in January and February", () => {
  assert.equal(defaultYear("2027-01-15"), 2026); assert.equal(defaultYear("2027-03-01"), 2027);
});

test("net worth over the year starts from the last point before it; reviews and their notes; the year so far", () => {
  const p = familyPlan();
  p.netWorthHistory = [{ date: "2025-12-01", assets: 1, liabilities: 0, netWorth: 240000 }, { date: "2026-03-01", assets: 1, liabilities: 0, netWorth: 250000 }, { date: "2026-10-01", assets: 1, liabilities: 0, netWorth: 270000 }];
  p.reviews = [{ month: "2026-02", at: "2026-02-28", note: "a" }, { month: "2025-12", at: "2025-12-30", note: "old" }, { month: "2026-09", at: "2026-09-30", note: "" }];
  const d = compute(p, { today: TODAY, year: 2026 });
  assert.equal(d.partial, true);
  assert.equal(d.netWorth.first.netWorth, 240000, "December's point starts the year"); assert.equal(d.netWorth.change, 30000);
  assert.deepEqual(d.reviews.months.map((r) => r.month), ["2026-02", "2026-09"]);
  assert.equal(d.ahead.year, 2027); assert.ok(d.ahead.moments.every((m) => Number(String(m.date ?? "2027").slice(0, 4)) === 2027));
});

test("the bank files: the year's months and where the money went", () => {
  const d = compute(samplePlan(), { today: TODAY, year: 2026 });
  assert.ok(d.money.months.length >= 2);
  assert.ok(Math.abs(d.money.in - d.money.out - d.money.net) < 0.01);
  assert.ok(d.categories.length > 0); assert.ok(Math.abs(d.categories.reduce((s, c) => s + c.share, 0) - 1) < 1e-9);
});
