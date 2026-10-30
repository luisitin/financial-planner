import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, amt, amtRoom, stockPayTax, esppSale, saleTax, isoSplit, dayAfter, ISO_LIMIT, PAYROLL } from "./compute.js";
import { AMT, amtFor } from "./data/amt.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { federalTax, taxOnQualified, paramsFor } from "../../../core/math/tax.js";
import { FEDERAL } from "../../taxes/federal/data/federal.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const fedOnly = (r) => r.totalTax - r.additionalMedicare;
const RSU = { id: "r", kind: "rsu", name: "New hire units", granted: "2025-01-15", vestStart: "2025-01-15", shares: 2400, vestMonths: 48, cliffMonths: 12, every: 3 };
const ISO = { id: "i", kind: "option", optionType: "iso", name: "Incentive options", granted: "2023-03-01", vestStart: "2023-03-01", shares: 4000, strike: 20, vestMonths: 48, cliffMonths: 12, every: 3 };
const NSO = { id: "n", kind: "option", name: "Options", granted: "2024-03-01", vestStart: "2024-03-01", shares: 1000, strike: 30, vestMonths: 48, cliffMonths: 12, every: 3 };
const LOT = { id: "e1", offeringDate: "2025-01-01", purchaseDate: "2025-06-30", shares: 100, fmvOffering: 40, fmvPurchase: 45, price: 34, discount: 0.15 };
const withEquity = (grants, espp = [], extra = {}) => { const p = familyPlan(TODAY); p.equity = { symbol: "ACME", price: 50, priceAsOf: TODAY, personId: "p-ana", grants, espp, ...extra }; return p; };
const ti = (p = familyPlan(TODAY)) => taxInputs(p, { today: TODAY });

test("the AMT tables: 2026's exemptions, the phase-out at 50 cents a dollar, the 28% line", () => {
  const A = amtFor(2026);
  assert.equal(A.exemption.married_joint, 140200); assert.equal(A.exemption.single, 90100); assert.equal(A.exemption.married_separate, 70100);
  assert.equal(A.phaseOutStart.married_joint, 1000000); assert.equal(A.phaseOutRate, 0.5); assert.equal(A.rate28From.all, 244500); assert.equal(A.rate28From.married_separate, 122250);
  assert.equal(amtFor(2025).phaseOutRate, 0.25); assert.equal(amtFor(2025).exemption.married_joint, 137000);
  assert.equal(amtFor(2031), AMT[2026]); assert.equal(amtFor(2020), AMT[2025]);
  // the complete phase-out the revenue procedure prints: start + exemption / rate
  assert.equal(A.phaseOutStart.married_joint + A.exemption.married_joint / A.phaseOutRate, 1280400);
  assert.equal(A.phaseOutStart.single + A.exemption.single / A.phaseOutRate, 680200);
});

test("the AMT by hand: AGI less the deduction, plus the standard deduction and the spread, less the exemption, 26% and 28%", () => {
  const t = ti();
  const r = federalTax(t.inputs, t.params);
  const A = amtFor(2026);
  const a = amt(t.inputs, t.params, A, { preference: 105000 });
  near(a.amti, r.agi - r.deduction.amount + r.deduction.standard + 105000);
  near(a.exemption, 140200); near(a.excess, a.amti - 140200);
  near(a.tentative, 0.26 * a.excess); near(a.regular, r.incomeTax); near(a.amt, 0.26 * a.excess - r.incomeTax);
  const big = amt(t.inputs, t.params, A, { preference: 1200000 });
  near(big.exemption, Math.max(0, 140200 - 0.5 * (big.amti - 1000000)));
  near(big.tentative, 0.26 * 244500 + 0.28 * (big.excess - 244500));
  assert.equal(amt(t.inputs, t.params, A).amt, 0);
  const sep = amt({ ...t.inputs, filingStatus: "married_separate" }, t.params, A, { preference: 400000 });
  near(sep.tentative, 0.26 * 122250 + 0.28 * (sep.excess - 122250));   // a separate return: the 28% line is half
});

test("the AMT with no pay: AMT income is the spread, not the spread plus an unused deduction", () => {
  const t = ti(emptyPlan());
  const inputs = { ...t.inputs, filingStatus: "married_joint", wages: 0, otherOrdinary: 0 };
  const a = amt(inputs, t.params, amtFor(2026), { preference: 300000 });
  near(a.amti, 300000); near(a.amt, 0.26 * (300000 - 140200));
});

test("Part III: qualified dividends keep their rates, stacked on the regular ordinary taxable income", () => {
  const t = ti();
  const inputs = { ...t.inputs, qualifiedIncome: 40000 };
  const A = amtFor(2026);
  const r = federalTax(inputs, t.params);
  const a = amt(inputs, t.params, A, { preference: 200000 });
  const q = Math.min(40000, a.excess);
  const flat = (x) => 0.26 * Math.min(x, 244500) + 0.28 * Math.max(0, x - 244500);
  near(a.tentative, Math.min(flat(a.excess), flat(a.excess - q) + taxOnQualified(r.ordinaryTaxable, q, "married_joint", t.params).tax));
  assert.ok(a.tentative < flat(a.excess));
});

test("Part III takes all the dividends, even those the regular deduction already covered (Form 6251 line 13)", () => {
  // 2025, single, no pay, 33,424 of dividends, itemized 51,190 (10,000 of it state and local tax), spread 132,790:
  // AMT income 33,424 - 51,190 + 10,000 + 132,790 = 125,024; less 88,100 leaves 36,924; the dividends at 0%, the rest 26%
  const P = paramsFor(FEDERAL, 2025);
  const inputs = { filingStatus: "single", wages: 0, qualifiedIncome: 33424, itemized: 51190, investmentIncome: 0 };
  const a = amt(inputs, P, amtFor(2025), { preference: 132790, salt: 10000 });
  near(a.amti, 125024); near(a.tentative, 0.26 * (36924 - 33424)); near(a.amt, 910);
  near(amt(inputs, P, amtFor(2025), { preference: 0, salt: 10000 }).amti, 33424 - 51190 + 10000, 1e-9);   // line 4 can be below zero
});

test("a separate return adds back part of the exemption once it is gone: 25% of the excess, at most the exemption", () => {
  const P = paramsFor(FEDERAL, 2025), A = amtFor(2025);
  const gone = A.phaseOutStart.married_separate + A.exemption.married_separate / A.phaseOutRate;   // 900,350
  const at = (wages) => amt({ filingStatus: "married_separate", wages, investmentIncome: 0 }, P, A).amti;
  near(at(1000000), 1000000 + 0.25 * (1000000 - gone)); near(at(2000000), 2000000 + A.exemption.married_separate); near(at(800000), 800000);
});

test("an itemizer adds back the state and local taxes deducted", () => {
  const t = ti();
  const r = federalTax({ ...t.inputs, itemized: 60000 }, t.params);
  assert.equal(r.deduction.used, "itemized");
  const a = amt({ ...t.inputs, itemized: 60000 }, t.params, amtFor(2026), { salt: 12000 });
  near(a.amti, r.agi - r.deduction.amount + 12000 - r.deduction.itemizedLimit);
});

test("the AMT room: the largest spread that adds no AMT, within a dollar", () => {
  const t = ti(); const A = amtFor(2026);
  const room = amtRoom(t.inputs, t.params, A);
  assert.ok(amt(t.inputs, t.params, A, { preference: room }).amt <= 0.5);
  assert.ok(amt(t.inputs, t.params, A, { preference: room + 5 }).amt > 0.5);
  const r = federalTax(t.inputs, t.params);
  near(room, (r.incomeTax + 0.5) / 0.26 - (r.agi - r.deduction.amount + r.deduction.standard - 140200), 2);
});

test("pay from stock: the tax owed against what is withheld (22% of the value, payroll in full, 0.9% only above $200,000)", () => {
  const t = ti();
  const T = { inputs: t.inputs, params: t.params, personWages: 101400, medicareWages: 163800, wageBase: 184500, stateRate: 0.05 };
  const v = stockPayTax(50000, T);
  near(v.federal, fedOnly(federalTax({ ...t.inputs, wages: t.inputs.wages + 50000 }, t.params)) - fedOnly(federalTax(t.inputs, t.params)));
  near(v.payroll, 50000 * 0.0765); near(v.state, 2500); near(v.withheldFederal, 11000); near(v.gap, v.federal - 11000);
  const w = stockPayTax(150000, { ...T, personWages: 150000, medicareWages: 220000 });
  near(w.payroll, 34500 * PAYROLL.ss + 150000 * PAYROLL.medicare + PAYROLL.extraMedicare * 120000);
  near(w.withheld - w.withheldFederal - w.state, 34500 * PAYROLL.ss + 150000 * PAYROLL.medicare + PAYROLL.extraMedicare * 100000);
  near(stockPayTax(2000000, T).withheldFederal, 0.22 * 1000000 + 0.37 * 1000000);
  assert.equal(stockPayTax(0, T).owed, 0); assert.equal(stockPayTax(0, T).withheldFederal, 0);
});

test("holding periods: more than a year, more than two; a sale on the anniversary is not long-term", () => {
  assert.equal(dayAfter("2026-06-30"), "2026-07-01"); assert.equal(dayAfter("2026-12-31"), "2027-01-01");
  const now = esppSale(LOT, 50, TODAY);
  assert.equal(now.qualifying, false); assert.equal(now.qualifiesOn, "2027-01-02"); assert.equal(now.longOn, "2026-07-01");
  near(now.ordinary, 100 * (45 - 34)); near(now.longGain, 5000 - 4500); assert.equal(now.shortGain, 0);
  const onAnniversary = esppSale(LOT, 50, "2026-06-30");
  near(onAnniversary.shortGain, 500); assert.equal(onAnniversary.longGain, 0);
  assert.equal(esppSale(LOT, 50, "2027-01-01").qualifying, false, "two years to the day is not more than two");
  const later = esppSale(LOT, 50, "2027-01-02");
  near(later.ordinary, 100 * Math.min(50 - 34, 0.15 * 40)); near(later.longGain, 5000 - 3400 - 600);
  const fell = esppSale(LOT, 30, "2027-06-01");
  assert.equal(fell.ordinary, 0, "a qualifying sale at a loss has no pay in it"); near(fell.longGain, 3000 - 3400);
});

test("the tax on a sale: pay as income, long-term gains at their rates and in the 3.8% tax, a loss within the household's $3,000", () => {
  const t = ti();
  const T = { inputs: t.inputs, params: t.params, stateRate: 0 };
  near(saleTax({ ordinary: 1100, longGain: 500 }, T).federal, 1100 * 0.22 + 500 * 0.15, 0.01);
  near(saleTax({ shortGain: -5000 }, T).federal, -3000 * 0.22, 0.01);
  near(saleTax({ shortGain: -5000 }, { ...T, inputs: { ...t.inputs, capitalLoss: -3000 } }).federal, 0, 0.01);
  near(saleTax({ ordinary: 1000 }, { ...T, stateRate: 0.05 }).state, 50);
  const rich = { ...t.inputs, wages: 480000 };
  const g = saleTax({ longGain: 10000 }, { ...T, inputs: rich });
  near(g.federal, fedOnly(federalTax({ ...rich, qualifiedIncome: rich.qualifiedIncome + 10000, investmentIncome: rich.investmentIncome + 10000 }, t.params)) - fedOnly(federalTax(rich, t.params)));
  assert.ok(g.federal > 10000 * 0.15 + 300, "the 3.8% is in it");
});

test("the family with units, incentive and nonqualified options: this year's vests in the tax base, exercising now", () => {
  const p = withEquity([RSU, ISO, NSO]);
  const d = compute(p, { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.needsPrice, false); assert.equal(d.price, 50); assert.equal(d.person.id, "p-ana");
  const [y26, y27] = d.rsuYears;
  assert.equal(y26.vests.length, 4); near(y26.value, 1050 * 50); assert.equal(y26.vests.filter((v) => v.past).length, 4);
  near(y27.value, 600 * 50);
  const iso = d.options.find((o) => o.id === "i"), nso = d.options.find((o) => o.id === "n");
  assert.equal(iso.type, "iso"); assert.equal(nso.type, "nso");
  assert.equal(iso.vested, 3500); assert.equal(iso.nsoShares, 0); near(iso.iso.spread, 3500 * 30); near(iso.cost, 70000);
  const t = ti(p); const A = amtFor(2026);
  const now = { ...t.inputs, wages: t.inputs.wages + 52500 };
  near(iso.iso.amtAll, amt(now, t.params, A, { preference: 105000 }).amt);
  near(d.isoRoom, amtRoom(now, t.params, A), 1e-6); assert.equal(iso.iso.roomShares, Math.floor(d.isoRoom / 30));
  assert.ok(d.isoRoom < amtRoom(t.inputs, t.params, A), "the year's vests leave less room");
  assert.equal(iso.iso.holdUntil, "2027-10-31", "more than a year after exercising today");
  near(iso.iso.sameYearTax.total, saleTax({ ordinary: 105000 }, { inputs: now, params: t.params, stateRate: 0 }).total);
  near(nso.spread, 625 * 20); near(nso.nso.value, 12500); assert.equal(nso.nsoShares, 625);
  near(nso.nso.federal, fedOnly(federalTax({ ...now, wages: now.wages + 12500 }, t.params)) - fedOnly(federalTax(now, t.params)));
  assert.deepEqual(d.isoOver, []);
});

test("two incentive grants share the year's room, in grant order", () => {
  const second = { ...ISO, id: "i2", name: "Refresh", granted: "2023-09-01", vestStart: "2023-09-01" };
  const d = compute(withEquity([ISO, second]), { today: TODAY });
  const [a, b] = d.options;
  assert.equal(a.id, "i"); assert.equal(b.id, "i2");
  assert.ok(a.iso.room + b.iso.room <= d.isoRoom + 1e-6, "the room is not counted twice");
  assert.equal(a.iso.roomShares + b.iso.roomShares, Math.min(a.iso.shares + b.iso.shares, Math.floor(d.isoRoom / 30)));
  near(b.iso.amtAll, amt({ ...ti(withEquity([ISO, second])).inputs, wages: ti(withEquity([ISO, second])).inputs.wages + 0 }, ti().params, amtFor(2026), { preference: a.iso.spread + b.iso.spread }).amt - amt({ ...ti(withEquity([ISO, second])).inputs }, ti().params, amtFor(2026), { preference: a.iso.spread }).amt, 1e-6);
});

test("the $100,000 rule: options first exercisable over it in a year are nonqualified, taxed as pay", () => {
  const split = isoSplit([{ id: "b", optionType: "iso", granted: "2022-01-01", strike: 20, schedule: [{ date: "2023-01-01", shares: 5000 }, { date: "2023-04-01", shares: 1250 }, { date: "2024-01-01", shares: 1250 }] }]);
  const v = split.byGrant.get("b");
  assert.equal(v[0].iso, 5000); assert.equal(v[1].iso, 0); assert.equal(v[1].nso, 1250); assert.equal(v[2].iso, 1250);
  assert.deepEqual(split.over, [{ year: 2023, value: 125000, over: 25000 }]);
  const big = { ...ISO, id: "b", shares: 20000, strike: 20, granted: "2022-01-01", vestStart: "2022-01-01" };
  const d = compute(withEquity([big]), { today: TODAY });
  const o = d.options[0];
  assert.ok(o.nsoShares > 0); assert.equal(o.iso.shares + o.nsoShares, o.vested);
  near(o.nso.value, o.nsoShares * 30); near(o.iso.spread, o.iso.shares * 30);
  assert.ok(d.isoOver.length >= 1); assert.equal(ISO_LIMIT, 100000);
});

test("purchase-plan lots: the tax now against at the qualifying date; lots without their prices are left out", () => {
  const d = compute(withEquity([], [LOT, { ...LOT, id: "e2", fmvPurchase: null }]), { today: TODAY });
  assert.equal(d.espp.length, 1); assert.equal(d.esppSkipped, 1);
  const e = d.espp[0];
  assert.equal(e.now.qualifying, false); assert.equal(e.atQualifying.qualifying, true);
  near(e.taxNow.total, 1100 * 0.22 + 500 * 0.15, 0.01); near(e.taxAtQualifying.total, 600 * 0.22 + 1000 * 0.15, 0.01);
  near(e.wait, e.taxNow.total - e.taxAtQualifying.total);
});

test("no share price: the page asks for it instead of working at $0", () => {
  const p = familyPlan(TODAY); p.equity = { espp: [LOT] };
  const d = compute(p, { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.needsPrice, true); assert.deepEqual(d.espp, []); assert.deepEqual(d.options, []);
});

test("next year's units use next year's Social Security limit ($192,300 in 2027)", () => {
  const p = withEquity([RSU]); p.income.find((x) => x.id === "i-ana").amount = 182000 / 26;
  const y27 = compute(p, { today: TODAY }).rsuYears[1];
  near(y27.value, 30000);
  // Ana's 182,000 leaves 10,300 under 2027's base (2026's would leave 2,500); with Bo's 62,400 the couple passes $250,000 by 24,400
  near(y27.tax.payroll, PAYROLL.ss * (192300 - 182000) + 30000 * PAYROLL.medicare + PAYROLL.extraMedicare * (182000 + 62400 + 30000 - 250000), 1e-6);
});

test("not ready without grants, a symbol or purchase-plan shares", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).ready, false);
});
