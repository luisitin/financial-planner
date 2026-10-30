import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, DEFAULTS } from "./compute.js";
import { compute as computeRetirement } from "../../retirement/projection/compute.js";
import { payoffPlan } from "../../../core/math/payoff.js";
import { compute as computePayoff } from "../../debt/payoff/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("an empty plan: not ready, and says what is missing", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, false); assert.ok(d.missing.length > 0);
});

test("the family: today's net worth, then the retirement projection's savings, the home and the debts", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  assert.ok(d.ready);
  assert.equal(d.now.netWorth, 287100); assert.equal(d.now.homes, 380000); assert.equal(d.now.debts, 285600);
  near(d.now.invested + d.now.homes - d.now.debts, d.now.netWorth);
  const ret = computeRetirement(p, { today: TODAY });
  const r0 = d.rows[0];
  assert.equal(r0.year, 2026); near(r0.invested, ret.rows[0].total);
  near(r0.homes, 380000 * Math.pow(1 + DEFAULTS.homeGrowth, 2 / 12), 0.01);
  // two more payments this year (November and December) on the payoff plan
  const pay = computePayoff(p, { today: TODAY });
  const sched = payoffPlan(pay.debts, { extra: pay.extra, order: pay.order, customOrder: pay.customOrder });
  near(r0.debts, Object.values(sched.timeline[1].balances).reduce((a, b) => a + b, 0), 0.01);
  near(r0.netWorth, r0.invested + r0.homes - r0.debts);
  const r5 = d.rows[5];
  near(r5.homes, 380000 * Math.pow(1.035, (2 + 60) / 12), 0.01);
  near(r5.netWorthReal, r5.netWorth / r5.priceLevel);
});

test("the default horizon runs five years past retirement; a typed one is kept within 1 to 40", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.retireYear, 2055); assert.equal(d.settings.years, 2055 - 2026 + 6); assert.equal(d.rows.length, 35);
  const p = familyPlan(TODAY); p.whatIfs = { netWorth: { years: 99 } };
  assert.equal(compute(p, { today: TODAY }).rows.length, 40);
  p.whatIfs.netWorth.years = 3;
  assert.equal(compute(p, { today: TODAY }).rows.length, 3);
});

test("milestones: doubling, the mortgage with debt-free the same year, a million, retirement, the peak", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  const by = Object.fromEntries(d.milestones.map((m) => [m.kind, m]));
  assert.ok(by.double && by.mortgage && by.million && by.retire);
  assert.equal(by.mortgage.label, "Mortgage paid off: debt-free"); assert.ok(!by.debtfree, "one line when both fall in the same year");
  const dbl = d.rows.find((r) => r.netWorthReal >= 2 * 287100); assert.equal(by.double.year, dbl.year);
  const mortgageGone = d.rows.find((r) => r.mortgage < 0.5); assert.equal(by.mortgage.year, mortgageGone.year);
  assert.equal(by.retire.year, 2055);
  for (const r of d.rows) assert.ok(r.netWorthReal <= d.peak.netWorthReal);
  for (let i = 1; i < d.milestones.length; i++) assert.ok(d.milestones[i].year >= d.milestones[i - 1].year);
});

test("cars lose value; 529s grow; a debt with no payment stays put", () => {
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "a-car", name: "Car", type: "vehicle", balance: 20000, history: [] }, { id: "a-529", name: "Cy's 529", type: "529", balance: 10000, history: [] }, { id: "a-x", name: "Family loan", type: "other_liability", balance: -5000, history: [] });
  p.whatIfs = { netWorth: { vehicleLoss: 0.2 } };
  const d = compute(p, { today: TODAY });
  const r = d.rows[3];
  near(r.vehicles, 20000 * Math.pow(0.8, (2 + 36) / 12), 0.01);
  assert.ok(r.college > 10000);
  assert.ok(r.debts >= 5000 - 0.01, "the family loan is still owed");
  assert.ok(!d.milestones.some((m) => m.kind === "debtfree"), "never debt-free while a debt has no plan");
  assert.ok(d.notes.some((n) => n.includes("stay at today's balance")));
});

test("owing more than you own: the year it turns", () => {
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "a-big", name: "Business loan", type: "loan", balance: -400000, history: [] });
  p.debts.push({ id: "d-big", accountId: "a-big", rate: 0.06, minPayment: 4500, extra: 0 });
  const d = compute(p, { today: TODAY });
  assert.ok(d.now.netWorth < 0);
  const m = d.milestones.find((x) => x.kind === "positive");
  assert.ok(m); assert.equal(m.year, d.rows.find((r) => r.netWorth >= 0).year);
});
