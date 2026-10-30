import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, payPath, lifetime, keepOfRaise, useAverage, yearFraction, DEFAULTS, PAYROLL, ADDITIONAL_MEDICARE, HORIZON, RAISE_NOW } from "./compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("where a date falls in its year", () => {
  assert.equal(yearFraction("2026-01-01"), 0);
  near(yearFraction("2026-07-01"), 0.5);
  near(yearFraction(TODAY), (9 + 29 / 31) / 12);
  assert.equal(yearFraction("not a date"), 0);
});

test("the pay path: a raise each year after this one, compounding, deflated to today's money", () => {
  const rows = payPath({ pay: 50000, from: 2026, to: 2031, raise: 0.04, inflation: 0.02 });
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.year), [2026, 2027, 2028, 2029, 2030]);
  near(rows[0].pay, 50000); near(rows[4].pay, 50000 * 1.04 ** 4);
  near(rows[4].real, 50000 * 1.04 ** 4 / 1.02 ** 4);
  assert.ok(rows.every((r) => r.weight === 1));
  assert.equal(rows[0].growth, 0); assert.equal(rows[1].growth, 0.04);
});

test("promotions every few years add their bump on top of the raise", () => {
  const rows = payPath({ pay: 100, from: 2026, to: 2033, raise: 0.03, inflation: 0.03, promoEvery: 3, promoBump: 0.1 });
  assert.deepEqual(rows.filter((r) => r.promoted).map((r) => r.year), [2029, 2032]);
  near(rows[6].pay, 100 * 1.03 ** 6 * 1.1 ** 2);
  near(rows[6].real, 100 * 1.1 ** 2, 1e-9);
});

test("from the level-off age pay only keeps up with prices, and promotions stop", () => {
  const rows = payPath({ pay: 100, from: 2026, to: 2036, raise: 0.05, inflation: 0.02, promoEvery: 2, promoBump: 0.1, levelAge: 53, birthYear: 1976 });
  // 2026: 50, 2027: 51, 2028: 52 (promotion), 2029: 53 -> prices only from here
  assert.deepEqual(rows.filter((r) => r.promoted).map((r) => r.year), [2028]);
  assert.equal(rows.find((r) => r.year === 2029).growth, 0.02);
  near(rows.at(-1).real, rows.find((r) => r.year === 2028).real, 1e-9);
});

test("the first and last years count only the part still worked", () => {
  const rows = payPath({ pay: 1200, from: 2026.75, to: 2028.25, raise: 0, inflation: 0 });
  assert.deepEqual(rows.map((r) => r.weight), [0.25, 1, 0.25]);
  const l = lifetime(rows);
  near(l.nominal, 1200 * 1.5); near(l.real, 1200 * 1.5);
  assert.deepEqual(lifetime([]), { nominal: 0, real: 0 });
});

test("what a raise keeps: federal tax by the engine, Social Security only under the wage base, Medicare, the state's rate", () => {
  const p = familyPlan(TODAY);
  const t = taxInputs(p, { today: TODAY });
  const k = keepOfRaise(5000, { inputs: t.inputs, params: t.params, personWages: 100000, wageBase: 184500, stateRate: 0.05 });
  near(k.federal, federalTax({ ...t.inputs, wages: t.inputs.wages + 5000 }, t.params).totalTax - federalTax(t.inputs, t.params).totalTax);
  near(k.payroll, 5000 * (PAYROLL.ss + PAYROLL.medicare)); near(k.state, 250);
  near(k.keep, 5000 - k.federal - k.payroll - 250); near(k.share, k.keep / 5000);
  const capped = keepOfRaise(5000, { inputs: t.inputs, params: t.params, personWages: 182000, wageBase: 184500 });
  near(capped.payroll, 2500 * PAYROLL.ss + 5000 * PAYROLL.medicare);
  assert.equal(keepOfRaise(0, { inputs: t.inputs, params: t.params }).keep, 0);
});

test("the family: each salary to its holder's retirement birthday, from the Income page's raise", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.jobs.length, 2);
  const ana = d.jobs.find((j) => j.incomeId === "i-ana");
  assert.equal(ana.pay, 3900 * 26); assert.equal(ana.ageNow, 36); assert.equal(ana.retireYear, 2055);
  assert.equal(ana.raiseFrom, "income"); assert.equal(ana.settings.raise, 0.03); assert.equal(ana.settings.promoEvery, 0);
  assert.equal(ana.rows[0].year, 2026); assert.equal(ana.rows.at(-1).year, 2055);
  near(ana.rows[0].weight, 1 - yearFraction(TODAY)); near(ana.rows.at(-1).weight, yearFraction("1990-05-20"));
  near(ana.atEnd.pay, 101400 * 1.03 ** 29, 1e-6);
  near(ana.atEnd.real, 101400, 1e-6);   // a 3% raise against 3% prices: flat in today's money
  near(ana.realRaise, 0); near(ana.avgGrowth, 0.03, 1e-12);
  near(ana.lifetime.real, 101400 * ana.rows.reduce((s, r) => s + r.weight, 0), 1e-4);
  near(ana.raiseNowWorth, ana.lifetime.real * RAISE_NOW);
  assert.ok(ana.extraPercent > 0);
  near(ana.nextRaise.amount, 3042); near(ana.nextRaise.payroll, 3042 * 0.0765);
  assert.equal(ana.nextRaise.state, 0, "Texas has no wage tax");
  assert.equal(d.state.method, "none");
  const bo = d.jobs.find((j) => j.incomeId === "i-bo");
  assert.equal(bo.retireYear, 2050); assert.equal(bo.rows.at(-1).year, 2050);
  near(d.total.pay, 101400 + 62400); near(d.total.lifetimeReal, ana.lifetime.real + bo.lifetime.real);
  assert.deepEqual(d.warnings, []);
});

test("one more percent a year: the career's pay again at the higher raise, less the pay as it is", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  const bo = d.jobs.find((j) => j.incomeId === "i-bo");
  const from = 2026 + yearFraction(TODAY), to = 2050 + yearFraction("1988-11-02");
  const up = lifetime(payPath({ pay: 62400, from, to, raise: 0.04, inflation: 0.03, promoEvery: 0, promoBump: DEFAULTS.promoBump, levelAge: null, birthYear: 1988 })).real;
  near(bo.extraPercent, up - bo.lifetime.real, 1e-6);
});

test("typed settings win; the level-off age never speeds a raise up; a missing birth date is flagged", () => {
  const p = familyPlan(TODAY);
  p.whatIfs = { salary: { "i-ana": { raise: 0.02, promoEvery: 4, promoBump: 0.12, levelAge: 55 } } };
  p.household.people.find((x) => x.id === "p-bo").birthDate = "";
  p.income.find((x) => x.id === "i-bo").growth = 0;
  const d = compute(p, { today: TODAY });
  const ana = d.jobs.find((j) => j.incomeId === "i-ana");
  assert.equal(ana.raiseFrom, "typed"); assert.deepEqual(ana.settings, { raise: 0.02, promoEvery: 4, promoBump: 0.12, levelAge: 55 });
  assert.ok(ana.rows.some((r) => r.promoted));
  assert.ok(ana.rows.filter((r) => r.age >= 55).every((r) => !r.promoted && r.growth === 0.02), "2% is under prices: the age keeps it at 2%");
  const bo = d.jobs.find((j) => j.incomeId === "i-bo");
  assert.equal(bo.raiseFrom, "assumptions"); assert.equal(bo.settings.raise, 0.03);
  assert.equal(bo.knownAge, false); near(bo.rows.reduce((s, r) => s + r.weight, 0), HORIZON, 1e-9);
  assert.equal(d.warnings.length, 1); assert.ok(/no birth date/.test(d.warnings[0]));
});

test("average and real growth with promotions, by hand; the warning follows the average, not the base raise", () => {
  const p = familyPlan(TODAY);
  p.whatIfs = { salary: { "i-ana": { raise: 0.02, promoEvery: 3, promoBump: 0.1 }, "i-bo": { raise: 0.01 } } };
  const d = compute(p, { today: TODAY });
  const ana = d.jobs.find((j) => j.incomeId === "i-ana");
  const n = 2055 - 2026, promos = Math.floor(n / 3);
  near(ana.atEnd.pay, 101400 * 1.02 ** n * 1.1 ** promos, 1e-6);
  near(ana.avgGrowth, (1.02 ** n * 1.1 ** promos) ** (1 / n) - 1, 1e-12);
  near(ana.realGrowth, (1 + ana.avgGrowth) / 1.03 - 1, 1e-12);
  near(ana.realRaise, 1.02 / 1.03 - 1, 1e-12);
  const bo = d.jobs.find((j) => j.incomeId === "i-bo");
  near(bo.realGrowth, 1.01 / 1.03 - 1, 1e-12);
  assert.equal(d.warnings.length, 1, "only Bo, whose pay really falls behind");
  assert.ok(d.warnings[0].startsWith("Bo's salary rises less than prices"));
});

test("a raise won now is the whole path again at a higher pay", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  const ana = d.jobs.find((j) => j.incomeId === "i-ana");
  const from = 2026 + yearFraction(TODAY), to = 2055 + yearFraction("1990-05-20");
  const up = lifetime(payPath({ pay: 101400 * (1 + RAISE_NOW), from, to, raise: 0.03, inflation: 0.03, promoBump: DEFAULTS.promoBump, birthYear: 1990 })).real;
  near(ana.raiseNowWorth, up - ana.lifetime.real, 1e-4);
});

test("the next raise follows the path: a promotion next year counts, a level-off age already reached slows it", () => {
  const p = familyPlan(TODAY);
  p.whatIfs = { salary: { "i-ana": { promoEvery: 1, promoBump: 0.1 }, "i-bo": { raise: 0.05, levelAge: 30 } } };
  const d = compute(p, { today: TODAY });
  const ana = d.jobs.find((j) => j.incomeId === "i-ana"), bo = d.jobs.find((j) => j.incomeId === "i-bo");
  near(ana.nextRaise.amount, 101400 * (1.03 * 1.1 - 1)); assert.equal(ana.nextRaise.promoted, true);
  near(ana.nextRaise.rate, 1.03 * 1.1 - 1, 1e-12);
  near(bo.nextRaise.amount, 62400 * 0.03, 1e-6, "Bo is past 30: prices only");
});

test("a salary that ends before retirement stops at its end date; one linked to nobody is flagged as such", () => {
  const p = familyPlan(TODAY);
  p.income.find((x) => x.id === "i-ana").endDate = "2028-06-30";
  delete p.income.find((x) => x.id === "i-bo").personId;
  const d = compute(p, { today: TODAY });
  const ana = d.jobs.find((j) => j.incomeId === "i-ana");
  assert.equal(ana.rows.at(-1).year, 2028); near(ana.rows.at(-1).weight, yearFraction("2028-06-30"));
  assert.equal(ana.endsEarly, "2028-06-30");
  assert.ok(d.warnings.some((w) => /not linked to anyone/.test(w)));
  assert.ok(!d.warnings.some((w) => /birth date/.test(w)));
});

test("a holder already at retirement age has no years ahead", () => {
  const p = familyPlan(TODAY);
  p.household.people.find((x) => x.id === "p-bo").retirementAge = 30;
  const bo = compute(p, { today: TODAY }).jobs.find((j) => j.incomeId === "i-bo");
  assert.deepEqual(bo.rows, []); assert.equal(bo.atEnd, null); assert.equal(bo.nextRaise.amount, 0);
  assert.deepEqual(bo.lifetime, { nominal: 0, real: 0 }); assert.equal(bo.avgGrowth, bo.settings.raise);
});

test("the extra Medicare tax on a raise is worked on pay before 401(k) saving, and shown with Medicare", () => {
  const p = familyPlan(TODAY);
  const t = taxInputs(p, { today: TODAY });
  // household Medicare wages of 245,000 on a joint return (threshold 250,000): 10,000 more puts 5,000 over it
  const k = keepOfRaise(10000, { inputs: t.inputs, params: t.params, personWages: 0, wageBase: 184500, medicareWages: 245000 });
  near(k.extraMedicare, ADDITIONAL_MEDICARE * 5000);
  near(k.payroll, 10000 * (PAYROLL.ss + PAYROLL.medicare) + ADDITIONAL_MEDICARE * 5000);
  const plain = federalTax({ ...t.inputs, wages: t.inputs.wages + 10000 }, t.params), base = federalTax(t.inputs, t.params);
  near(k.federal, (plain.totalTax - plain.additionalMedicare) - (base.totalTax - base.additionalMedicare));
});

test("using the average on the Income page pins this page's raise, so pressing it again changes nothing", () => {
  const p = familyPlan(TODAY);
  p.whatIfs = { salary: { "i-ana": { promoEvery: 3, promoBump: 0.1 } } };
  const before = compute(p, { today: TODAY }).jobs.find((j) => j.incomeId === "i-ana");
  assert.equal(useAverage(p, before), true);
  assert.equal(p.income.find((x) => x.id === "i-ana").growth, Math.round(before.avgGrowth * 1000) / 1000);
  const after = compute(p, { today: TODAY }).jobs.find((j) => j.incomeId === "i-ana");
  near(after.atEnd.pay, before.atEnd.pay, 1e-6); assert.equal(after.raiseFrom, "typed");
  useAverage(p, after);
  near(compute(p, { today: TODAY }).jobs.find((j) => j.incomeId === "i-ana").atEnd.pay, before.atEnd.pay, 1e-6);
  assert.equal(useAverage(p, { incomeId: "none" }), false);
});

test("no salary: not ready; one-off and ended pay are left out", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
  const p = familyPlan(TODAY);
  p.income = [{ id: "x", name: "Signing bonus", type: "salary", personId: "p-ana", amount: 5000, period: "once" }, { id: "y", name: "Old job", type: "salary", personId: "p-ana", amount: 4000, period: "monthly", endDate: "2025-01-01" }];
  assert.equal(compute(p, { today: TODAY }).ready, false);
});
