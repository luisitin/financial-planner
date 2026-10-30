import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, inputsOf, simulate, DEFAULTS } from "./compute.js";
import { planReturn, TAX_DRAG } from "../../insurance/term-vs-permanent/compute.js";
import { pmt } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withInputs = (s) => { const p = familyPlan("2026-10-30"); p.whatIfs = { rentVsBuy: s }; return p; };

test("the inputs: defaults, the plan's own return less the tax drag, saved values win", () => {
  const p = familyPlan("2026-10-30");
  const x = inputsOf(p);
  assert.equal(x.price, DEFAULTS.price); near(x.investReturn, planReturn(p) - TAX_DRAG);
  assert.equal(inputsOf(withInputs({ price: 500000, investReturn: 0.04, itemize: true, years: 99 })).price, 500000);
  assert.equal(inputsOf(withInputs({ investReturn: 0.04 })).investReturn, 0.04);
  assert.equal(inputsOf(withInputs({ years: 99 })).years, 40);
  assert.equal(inputsOf(emptyPlan()).rentMonthly, DEFAULTS.rentMonthly);
});

test("one year by hand: the mortgage, the costs, both pots, the buyer's money if sold", () => {
  const x = { ...inputsOf(familyPlan("2026-10-30")), investReturn: 0.05 };
  const { rows, monthlyPI, loan } = simulate(x, 1);
  assert.equal(loan, 320000); near(monthlyPI, pmt(0.065 / 12, 360, 320000));
  const r = rows[0];
  near(r.interest + r.principal, monthlyPI * 12, 1e-6);
  near(r.buyCost, monthlyPI * 12 + 400000 * (0.011 + 0.0035 + 0.01));
  near(r.rentCost, 2200 * 12 + 180);
  near(r.renterWealth, (80000 + 12000) * 1.05 + (r.buyCost - r.rentCost));
  near(r.value, 400000 * 1.03); near(r.buyerWealth, r.value * 0.94 - r.balance);
  near(r.ahead, r.buyerWealth - r.renterWealth);
});

test("itemizing saves tax at the marginal rate on interest and property tax", () => {
  const x = { ...inputsOf(familyPlan("2026-10-30")), itemize: true, marginalRate: 0.24 };
  const r = simulate(x, 1).rows[0];
  near(r.taxSaving, (r.interest + r.propertyTax) * 0.24);
});

test("the defaults: buying pulls ahead around year nine; the rent that makes them even", () => {
  const d = compute(familyPlan("2026-10-30"));
  assert.equal(d.atEnd.year, 10); assert.equal(d.atEnd.winner, d.atEnd.ahead >= 0 ? "buy" : "rent");
  assert.ok(d.breakevenYear >= 1 && d.breakevenYear <= 40);
  const even = compute(withInputs({ rentMonthly: d.rentEven }));
  assert.ok(Math.abs(even.atEnd.ahead) < 50, String(even.atEnd.ahead));
  assert.ok(compute(withInputs({ rentMonthly: 1200 })).atEnd.winner === "rent");
  assert.ok(compute(withInputs({ rentMonthly: 4000 })).atEnd.winner === "buy");
});
