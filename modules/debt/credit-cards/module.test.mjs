// The full checks for this page are in tests/debt-pages.test.mjs (shared fixture qa/fixtures/debt-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { debtPlan } from "../../../qa/fixtures/debt-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("credit-cards: runs on the sample household and on an empty plan", () => {
  const d = compute(debtPlan(), { today: "2026-09-15" });
  assert.equal(d.count, 2); assert.ok(d.utilisation > 0.5);
  assert.ok(compute(emptyPlan(), { today: "2026-09-15" }));
});

test("what you really pay first, and how much less gets under 30% and 10% of the limits, and about when", async () => {
  const { underLines } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const today = "2026-11-02";
  const d = compute(familyPlan(today), { today });
  const visa = d.cards[0];
  // the family pays $400 on a $190 minimum: the Debts page's payment, date and interest
  assert.equal(visa.paying.payment, 400); assert.equal(visa.paying.endDate.slice(0, 7), "2028-07"); assert.equal(Math.round(visa.paying.interest), 1384);
  // $6,400 of a $15,000 limit: $1,900 less is 30%, $4,900 less is 10%; at $400 a month and 23.9% (by hand: 6,400 x (1 + 0.239/12) - 400 each
  // month) it is under $4,500 after 7 months and under $1,500 after 16
  assert.equal(Math.round(d.under.less30), 1900); assert.equal(Math.round(d.under.less10), 4900);
  assert.equal(d.under.date30, "2027-06-02"); assert.equal(d.under.date10, "2028-03-02");
  // already under: today; a card with no payment never gets there
  assert.equal(underLines([{ balance: 1000, rate: 0.2, payment: 50 }], 10000, today).date30, today);
  assert.equal(underLines([{ balance: 5000, rate: 0.2, payment: 0 }], 10000, today).date30, null);
  // paying only the minimum: no "you pay" line
  const min = familyPlan(today); min.debts = min.debts.map((x) => (x.accountId === visa.id ? { ...x, extra: 0, payment: undefined } : x));
  const m = compute(min, { today }).cards[0];
  if (m.payment <= m.minPayment + 0.5) assert.equal(m.paying, null);
});
