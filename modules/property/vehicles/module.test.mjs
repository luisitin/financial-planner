import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, yearCost, compare, valueAfter, DEFAULTS } from "./compute.js";
import { pmt } from "../../../core/math/finance.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const SEDAN = { milesYear: 11000, mpg: 27, fuelPrice: 3.4, insuranceYear: 1300, maintenanceYear: 1400, registrationYear: 180, loss: 0.12 };
const withCar = () => {
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "a-veh", name: "Sedan", type: "vehicle", balance: 9000, history: [] });
  p.property = [{ id: "v1", kind: "vehicle", accountId: "a-veh", ...SEDAN, loanAccountId: "a-car" }];
  return p;
};

test("valueAfter: a used car at a steady rate; a new one steeper in its first year", () => {
  near(valueAfter(10000, 2, { loss: 0.1 }), 8100);
  near(valueAfter(40000, 1, { first: 0.2, after: 0.15 }), 32000);
  near(valueAfter(40000, 3, { first: 0.2, after: 0.15 }), 40000 * 0.8 * 0.85 * 0.85);
  assert.equal(valueAfter(40000, 0, { first: 0.2, after: 0.15 }), 40000);
});

test("yearCost: every line by hand, and per mile", () => {
  const loan = { balance: 14200, rate: 0.059, payment: 410 };
  const y = yearCost({ ...SEDAN, value: 9000 }, loan);
  const get = (k) => y.lines.find((l) => l.key === k).amount;
  near(get("loss"), 1080); near(get("fuel"), 11000 / 27 * 3.4); near(get("interest"), yearOfPayments(14200, 0.059, 410).interest);
  near(y.total, 1080 + 11000 / 27 * 3.4 + 1300 + 1400 + 180 + get("interest"));
  near(y.perMile, y.total / 11000); near(y.monthly, y.total / 12);
  const ev = yearCost({ value: 20000, electric: true, milesYear: 10000, kwhPerMile: 0.3, kwhPrice: 0.2, insuranceYear: 0, maintenanceYear: 0, registrationYear: 0 }, null);
  near(ev.lines.find((l) => l.key === "fuel").amount, 600);
});

test("no cars: not ready", () => {
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).ready, false);
});

test("the family's sedan: its loan from Debts; keep, buy and lease over five years", () => {
  const d = compute(withCar(), { today: TODAY });
  assert.equal(d.cars.length, 1); assert.equal(d.cars[0].loan.balance, 14200);
  const c = d.comparison, x = d.inputs;
  assert.equal(c.years, 5); near(c.tradeIn, 9000 - 14200);
  const price = x.newPrice * (1 + x.newSalesTax);
  near(c.financed, price - x.newDown); near(c.newPayment, pmt(x.newRate / 12, x.newTermMonths, c.financed));
  const keep = c.options.find((o) => o.id === "keep"), buy = c.options.find((o) => o.id === "buy"), lease = c.options.find((o) => o.id === "lease");
  near(keep.back, 9000 * Math.pow(0.88, 5)); near(buy.back, valueAfter(x.newPrice, 5, { first: 0.2, after: 0.15 }));
  assert.equal(lease.back, 0); assert.equal(lease.terms, 2);
  // the keep side by hand: loan payments for 5 years (it is paid off sooner), running costs with upkeep rising
  let b = 14200, paid = 0; for (let m = 0; m < 60 && b > 0.005; m++) { const i = b * 0.059 / 12, p = Math.min(410, b + i); paid += p; b = b + i - p; }
  let run = 0; for (let t = 0; t < 5; t++) run += 11000 / 27 * 3.4 + 1300 + 180 + 1400 * Math.pow(1.1, t);
  near(keep.out, paid + run);
  for (const o of c.options) { near(o.cost, o.out - o.back); near(o.monthly, o.cost / 60); }
  assert.equal(d.best, "keep");
});

test("a short comparison leaves part of the new loan owed, taken off what the new car is worth", () => {
  const p = withCar(); p.whatIfs = { vehicles: { years: 2 } };
  const buy = compute(p, { today: TODAY }).comparison.options.find((o) => o.id === "buy");
  assert.ok(buy.owedAtEnd > 0); near(buy.back, buy.endValue - buy.owedAtEnd);
});

test("a car with no account, typed on its own", () => {
  const p = familyPlan(TODAY); p.property = [{ id: "v2", kind: "vehicle", name: "Old truck", value: 6000, ...SEDAN }];
  const d = compute(p, { today: TODAY });
  assert.equal(d.cars[0].name, "Old truck"); assert.equal(d.cars[0].value, 6000); assert.equal(d.cars[0].loan, null);
});
