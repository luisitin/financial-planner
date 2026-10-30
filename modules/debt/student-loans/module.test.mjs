import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, simulate, rapRate, PSLF_PAYMENTS } from "./compute.js";
import { pmt } from "../../../core/math/finance.js";
import { povertyLine } from "../../retirement/healthcare/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withLoan = (whatIf) => { const p = familyPlan(TODAY); p.accounts.push({ id: "a-sl", name: "Loans", type: "student_loan", balance: 38000 }); p.debts.push({ id: "d-sl", accountId: "a-sl", rate: 0.055, minPayment: 412 }); if (whatIf) p.whatIfs = { studentLoans: whatIf }; return p; };
const BASE = { balance: 38000, rate: 0.055, agi: 60000, growth: 0, inflation: 0, size: 3, dependents: 1, discount: 0 };

test("RAP's share of income: 1% per $10,000 over $10,000, at most 10%", () => {
  assert.equal(rapRate(9000), 0); assert.equal(rapRate(10001), 0.01); assert.equal(rapRate(55000), 0.05); assert.equal(rapRate(100000), 0.09); assert.equal(rapRate(250000), 0.10);
});

test("standard: the 10-year payment pays it off in 120 months", () => {
  const s = simulate({ ...BASE, plan: "standard" });
  near(s.monthly, pmt(0.055 / 12, 120, 38000)); assert.equal(s.months, 120); near(s.forgiven, 0, 1e-6); near(s.paid, s.monthly * 120, 1e-6);
});

test("IBR: 10% of income over 150% of the poverty line, the rest forgiven after 20 years", () => {
  const s = simulate({ ...BASE, plan: "ibr" });
  near(s.monthly, 0.1 * (60000 - 1.5 * povertyLine(3)) / 12); assert.equal(s.months, 240); assert.ok(s.forgiven > 0);
  const rich = simulate({ ...BASE, plan: "ibr", agi: 500000 });
  near(rich.monthly, pmt(0.055 / 12, 120, 38000), 1e-9, "never more than the standard payment");
});

test("RAP: the share of income less $50 per child, at least $10; unpaid interest waived; forgiven after 30 years", () => {
  const s = simulate({ ...BASE, plan: "rap" });
  near(s.monthly, 60000 * 0.05 / 12 - 50);
  const poor = simulate({ ...BASE, plan: "rap", agi: 8000 });
  assert.equal(poor.monthly, 10); assert.equal(poor.months, 360);
  assert.ok(poor.forgiven < 38000, "the $10 still lowers the balance: interest waived, principal falls");
});

test("public service: income-driven payments for 120 months, the rest forgiven tax-free", () => {
  const s = simulate({ ...BASE, plan: "ibr", pslf: true });
  assert.equal(s.months, PSLF_PAYMENTS); assert.ok(s.forgiven > 0);
  const d = compute(withLoan({ pslf: true, agi: 60000 }), { today: TODAY });
  const p = d.plans.find((x) => x.id === "pslf");
  assert.equal(p.taxOnForgiven, 0); assert.equal(d.best, "pslf");
});

test("the family: no loans, nothing to compare; with a loan, every plan and the tax on forgiveness", () => {
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).ready, false);
  const d = compute(withLoan({ agi: 60000 }), { today: TODAY });
  assert.equal(d.balance, 38000); near(d.rate, 0.055); assert.equal(d.plans.length, 3);
  const ibr = d.plans.find((x) => x.id === "ibr");
  near(ibr.taxOnForgiven, ibr.forgiven * d.marginal); near(ibr.total, ibr.paid + ibr.taxOnForgiven);
  assert.ok(d.plans.every((x) => x.today <= x.total + 1e-6), "today's money is never more than the total");
});
