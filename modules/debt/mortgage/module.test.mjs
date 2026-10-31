// The full checks for this page are in tests/debt-pages.test.mjs (shared fixture qa/fixtures/debt-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { debtPlan } from "../../../qa/fixtures/debt-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("mortgage: runs on the sample household and on an empty plan", () => {
  const d = compute(debtPlan(), { today: "2026-09-15" });
  assert.equal(d.hasData, true); assert.ok(Number.isFinite(d.base.months));
  assert.ok(compute(emptyPlan(), { today: "2026-09-15" }));
});

test("mortgage insurance from the price paid: ask to end it at 80%, it ends by itself at 78% on the schedule (12 U.S.C. 4902)", async () => {
  const { nper } = await import("../../../core/math/finance.js");
  const p = debtPlan();
  // the home is worth $380,000 today but was bought for $310,000: $265,000 owed is 85.5% of the price
  p.property = [{ id: "h", kind: "home", accountId: "home", value: 380000, purchasePrice: 310000, purchaseDate: "2021-05-01" }];
  const d = compute(p, { today: "2026-09-15" }), r = d.mortgage.rate / 12;
  assert.equal(d.pmi.basis, "price"); assert.equal(d.pmi.basisValue, 310000);
  assert.ok(Math.abs(d.pmi.ltv - 265000 / 310000) < 1e-9);
  assert.equal(d.pmi.dropAtBalance, 248000); assert.ok(Math.abs(d.pmi.autoAtBalance - 241800) < 1e-6);
  // the months until the balance reaches each line at the required payment (no extra here): the same as the closed form
  const to = (line) => Math.ceil(nper(r, d.mortgage.payment, 265000) - nper(r, d.mortgage.payment, line) - 1e-9);
  assert.equal(d.pmi.monthsUntilDrop, to(248000)); assert.equal(d.pmi.monthsUntilAuto, to(241800));
  assert.ok(d.pmi.monthsUntilAuto > d.pmi.monthsUntilDrop && d.pmi.dateAuto > d.pmi.dateDrop);
  // no price entered: today's value stands in, and the page says to enter the price
  assert.equal(compute(debtPlan(), { today: "2026-09-15" }).pmi.basis, "today");
});
