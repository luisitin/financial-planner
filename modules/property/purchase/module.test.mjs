import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, giveWay, DEFAULTS } from "./compute.js";
import { pmt, pmtToReach } from "../../../core/math/finance.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withPurchase = (purchase) => { const p = familyPlan(TODAY); p.whatIfs = { purchase }; return p; };

test("the example until a purchase is typed", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.total, DEFAULTS.price); assert.equal(d.save, null, "no date, no saving plan");
  near(d.finance.payment, pmt(DEFAULTS.apr / 12, DEFAULTS.termMonths, DEFAULTS.price));
});

test("save up: the monthly amount that, with interest, reaches the price with tax by the date", () => {
  const p = withPurchase({ name: "Sofa", price: 3500, salesTax: 0.06, when: "2027-06-01", saved: 500 });
  const d = compute(p, { today: TODAY });
  near(d.total, 3710); assert.equal(d.months, 7);
  const r = Number(p.assumptions?.returnCash ?? 0.02) / 12;
  near(d.save.monthly, pmtToReach(r, 7, 3710, 500)); near(d.save.earned, 3710 - 500 - d.save.monthly * 7);
});

test("finance: a level payment, all 0%, and 0% for a while then the rate", () => {
  const plain = compute(withPurchase({ price: 3000, apr: 0.2, termMonths: 24 }), { today: TODAY }).finance;
  near(plain.payment, pmt(0.2 / 12, 24, 3000)); near(plain.interest, plain.payment * 24 - 3000);
  const free = compute(withPurchase({ price: 2400, termMonths: 12, promoMonths: 12 }), { today: TODAY }).finance;
  near(free.payment, 200); assert.equal(free.interest, 0);
  const mixed = compute(withPurchase({ price: 2400, termMonths: 24, promoMonths: 12, apr: 0.24 }), { today: TODAY }).finance;
  let b = 2400; for (let m = 0; m < 24; m++) b = (m < 12 ? b : b * 1.02) - mixed.payment;
  near(b, 0, 0.01); assert.ok(mixed.interest > 0 && mixed.payment < plain.payment + 100);
});

test("a small purchase fits in the money left; no goal gives way", () => {
  const d = compute(withPurchase({ price: 1200, when: "2027-04-01", apr: 0.2, termMonths: 12 }), { today: TODAY });
  assert.equal(d.effect.save.list.length, 0); assert.equal(d.effect.finance.list.length, 0);
  near(d.spare, computeNext(familyPlan(TODAY), { today: TODAY }).spare.monthly);
});

test("giveWay: least important first, then the latest due; paused when nothing is left; the rest uncovered", () => {
  const goals = [
    { id: "a", name: "Must", priority: 1, monthly: 300, targetDate: "2027-01-01", funded: 0, target: 3000, rate: 0, status: "on track" },
    { id: "b", name: "Nice soon", priority: 3, monthly: 100, targetDate: "2027-01-01", funded: 0, target: 1200, rate: 0, status: "on track" },
    { id: "c", name: "Nice later", priority: 3, monthly: 200, targetDate: "2030-01-01", funded: 0, target: 2400, rate: 0, status: "on track" },
    { id: "d", name: "Done", priority: 3, monthly: 50, status: "done" },
  ];
  const g = giveWay(goals, 250);
  assert.deepEqual(g.list.map((x) => [x.id, x.from]), [["c", 200], ["b", 50]]);
  assert.ok(g.list[0].paused); assert.equal(g.list[1].monthsLater, 24 - 12, "1,200 at 50 a month instead of 100");
  assert.equal(g.uncovered, 0);
  const all = giveWay(goals, 1000);
  assert.deepEqual(all.list.map((x) => x.id), ["c", "b", "a"]); near(all.uncovered, 400);
});

test("a boat: saving up by June squeezes the goals; the cash is not there", () => {
  const d = compute(withPurchase({ name: "Boat", price: 42000, salesTax: 0.0625, when: "2027-06-01", saved: 2000, apr: 0.089, termMonths: 84 }), { today: TODAY });
  assert.ok(d.effect.save.list.length > 0 && d.effect.save.uncovered > 0);
  near(d.effect.save.list.reduce((t, g) => t + g.from, 0) + d.effect.save.uncovered, d.save.monthly - d.spare);
  assert.equal(d.cash.fits, false);
});
