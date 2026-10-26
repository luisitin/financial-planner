// tests/debt-pages.test.mjs -- the five debt pages on one household (kept here rather than
// per module so the same fixture serves all; each module also has a smaller module.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute as payoff } from "../modules/debt/payoff/compute.js";
import { compute as mortgage } from "../modules/debt/mortgage/compute.js";
import { compute as cards } from "../modules/debt/credit-cards/compute.js";
import { compute as ratios } from "../modules/debt/ratios/compute.js";
import { compute as refinance } from "../modules/debt/refinance/compute.js";
import { pmt, nper } from "../core/math/finance.js";
import { emptyPlan } from "../core/schema/migrate.js";
import { debtPlan } from "../qa/fixtures/debt-plan.mjs";

const TODAY = "2026-09-15";
const near = (a, b, tol = 0.02) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("payoff: every debt with detail is in, avalanche order, extra 200, dates, plus-100 delta, baseline", () => {
  const d = payoff(debtPlan(), { today: TODAY });
  assert.equal(d.hasData, true); assert.equal(d.debts.length, 4); assert.deepEqual(d.missing, []);
  assert.equal(d.order, "avalanche"); assert.equal(d.extra, 200);
  assert.deepEqual(d.chosen.debts.map((x) => x.name), ["Store card", "Visa", "Mortgage", "Car loan"], "highest rate first");
  assert.ok(Number.isFinite(d.chosen.months) && d.chosen.endDate);
  assert.ok(d.plans.avalanche.totalInterest <= d.plans.snowball.totalInterest + 0.01);
  assert.equal(d.best, "avalanche");
  assert.ok(d.plus100.months > 0 && d.plus100.interest > 0);
  assert.ok(d.baseline.months > d.chosen.months);
  const p2 = debtPlan(); p2.debts = p2.debts.filter((x) => x.accountId !== "car");
  assert.deepEqual(payoff(p2, { today: TODAY }).missing, ["Car loan"]);
  assert.equal(payoff(emptyPlan(), { today: TODAY }).hasData, false);
});
test("mortgage: base schedule, extra and biweekly savings, recast, insurance drop, year rows", () => {
  const d = mortgage(debtPlan(), { today: TODAY, extra: 200, lump: 20000 });
  assert.equal(d.hasData, true); assert.equal(d.mortgage.name, "Mortgage");
  assert.equal(d.base.months, Math.ceil(nper(0.0625 / 12, d.mortgage.payment, 265000) - 1e-9));
  assert.ok(d.withExtra.monthsSaved > 12 && d.withExtra.interestSaved > 10000);
  assert.ok(d.biweekly.monthsSaved > 12 && d.biweekly.interestSaved > 5000);
  assert.ok(d.recast.newPayment < d.mortgage.payment && d.recast.monthlySaving > 50);
  near(d.pmi.ltv, 265000 / 380000, 1e-6); assert.equal(d.pmi.monthsUntilDrop, 0, "already under 80%");
  assert.ok(d.schedule.length >= 20 && d.schedule[0].endBalance < 265000);
  const p2 = debtPlan(); p2.accounts.find((a) => a.id === "home").balance = 300000;
  const d2 = mortgage(p2, { today: TODAY });
  assert.ok(d2.pmi.monthsUntilDrop > 0 && d2.pmi.dateDrop, "265k on a 300k home is over 80%: a drop date");
  const p3 = debtPlan(); p3.debts = p3.debts.filter((x) => x.accountId !== "mort");
  assert.equal(mortgage(p3, { today: TODAY }).hasData, false);
});
test("credit cards: utilisation, the minimum-payment trap, the transfer comparison", () => {
  const d = cards(debtPlan(), { today: TODAY });
  assert.equal(d.count, 2); assert.equal(d.totalLimit, 14000); near(d.utilisation, 7300 / 14000, 1e-6);
  const visa = d.cards.find((c) => c.name === "Visa");
  near(visa.utilisation, 6400 / 12000, 1e-6);
  assert.ok(Number.isFinite(visa.trap.months) && visa.trap.months > 40, "190 a month on 6400 at 23.9% takes years");
  assert.ok(visa.transfer.saves > 0, "0% for 15 months beats a 3% fee at 23.9%");
  assert.equal(visa.transfer.promoMonths, 15);
  const d2 = cards(debtPlan(), { today: TODAY, promoMonths: 3, feePct: 0.05 });
  assert.ok(d2.cards.find((c) => c.name === "Visa").transfer.saves < 0, "a 5% fee for 3 months does not pay");
  assert.equal(cards(emptyPlan()).hasData, false);
});
test("ratios: debt-to-income, housing, utilisation, months of income owed, grades", () => {
  const d = ratios(debtPlan(), { today: TODAY });
  const payments = d.payments;
  near(d.dti, payments / 9000, 1e-9);
  assert.equal(d.grades.dti.level, d.dti <= 0.36 ? "ok" : d.dti <= 0.43 ? "warn" : "bad");
  near(d.housingRatio, debtPlan().debts[0].minPayment / 9000, 1e-9);
  assert.equal(d.grades.housing.label, "comfortable");
  assert.equal(d.grades.utilisation.label, "hurts a lot", "7,300 of 14,000 is 52%");
  near(d.monthsOfIncomeOwed, 286500 / 9000, 1e-6);
  const e = ratios(emptyPlan(), { today: TODAY });
  assert.equal(e.hasIncome, false); assert.equal(e.dti, null); assert.equal(e.rows[0].value, null);
});
test("refinance: needs an offer; then payment, break-even and the stay-years comparison", () => {
  let d = refinance(debtPlan(), { today: TODAY });
  assert.equal(d.hasData, true); assert.equal(d.needsOffer, true);
  d = refinance(debtPlan(), { today: TODAY, rate: 0.05, termYears: 30, closingCosts: 6000, yearsStaying: 7 });
  near(d.offer.payment, pmt(0.05 / 12, 360, 265000), 0.02);
  assert.ok(d.monthlySaving > 0);
  assert.equal(d.breakEvenMonths, Math.ceil(6000 / d.monthlySaving));
  assert.ok(d.interestWhileStaying.offer < d.interestWhileStaying.current);
  assert.equal(d.verdict, d.netWhileStaying > 3000 && d.netWhileStaying > 500 ? "worth it" : d.netWhileStaying > 0 ? "close call" : "not worth it");
  const bad = refinance(debtPlan(), { today: TODAY, rate: 0.07, termYears: 30, closingCosts: 6000, yearsStaying: 7 });
  assert.equal(bad.verdict, "not worth it"); assert.equal(bad.breakEvenMonths, null);
  assert.equal(refinance(emptyPlan(), { today: TODAY }).hasData, false);
});
