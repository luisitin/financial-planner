import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, amt, amtRoom, stockPayTax, esppSale, saleTax, isoSplit, dayAfter, ISO_LIMIT, PAYROLL, payoutTax, deferredPay, deferredLines, deferredSummary, deferredStatus, deferredSaid, deferredFrom, DEFERRED } from "./compute.js";
import { payouts, deferredPlans, deferredIncomes, adultsOf, DEFERRED_MAX_YEARS, DEFERRED_AHEAD, DEFERRED_MAX_MONEY } from "./deferred.js";
import { AMT, amtFor } from "./data/amt.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { taxView } from "../../taxes/federal/known.js";
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
// the Federal estimate's return without this year's units (the page adds them itself): the family's business at its profit is in it
const tv = (p = familyPlan(TODAY)) => taxView(p, { today: TODAY }, { without: "stock" });

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
  // the 3,000 loss also takes AGI from 158,780 to 155,780: the child care credit on Cy's care from 32% to 33% of 3,000 (-30)
  near(saleTax({ shortGain: -5000 }, T).federal, -3000 * 0.22 - 30, 0.01);
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
  const t = tv(p); const A = amtFor(2026);
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

test("the $100,000 rule: options first exercisable over it in a year are nonqualified, taxed as wages", () => {
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
  near(y27.tax.payroll, PAYROLL.ss * (192300 - 182000) + 30000 * PAYROLL.medicare + PAYROLL.extraMedicare * (182000 + 62400 + 30000 - 250000) + 50.4, 1e-6);
  // plus the 0.9% on Bo's business profit (Form 8959 part II: its threshold is what the household's pay leaves of 250,000): 59.84 with the units, 9.44 without, the Federal estimate's self-employment row (Review 9)
});

test("not ready without grants, a symbol or purchase-plan shares", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).ready, false);
});

test("round 8 fix: next year's units are worked on next year's tax tables, so Equity compensation and Employer stock say one 2027 set-aside", async () => {
  const { equityPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const { compute: employerStock } = await import("../../investments/employer-stock/compute.js");
  const T = { today: "2026-11-06" };
  const p = equityPlan(), d = compute(p, T), es = employerStock(p, T);
  const [y26, y27] = d.rsuYears;
  // this year is unchanged: 105,000 of units, 1,398 to set aside on both pages
  near(y26.tax.gap, es.wholeYears.find((x) => x.year === 2026).gap, 0.5); near(y26.tax.gap, 1398, 0.5);
  // 2027: 60,000 of units on 2027's tables (the latest ones raised for inflation): federal 13,642 against 13,788 on 2026's,
  // so the set-aside is 352 on both pages (it said 498 here and 352 on Employer stock)
  const t27 = taxInputs({ ...p, taxes: { ...(p.taxes ?? {}), year: 2027, gains: [] } }, T);
  assert.equal(t27.params.indexed, true);
  near(y27.tax.federal, fedOnly(federalTax({ ...t27.inputs, wages: t27.inputs.wages + 60000 }, t27.params)) - fedOnly(federalTax(t27.inputs, t27.params)));
  near(y27.tax.federal, 13642, 0.5);
  near(y27.tax.gap, es.wholeYears.find((x) => x.year === 2027).gap, 0.5); near(y27.tax.gap, 352, 0.5);
  assert.equal(y27.estimated, true); assert.equal(y26.estimated, false);
});

// ---------------------------------------------------------------- the page, drawn on the stand-in DOM (opt spec 6.1: class B)
async function drawPage(plan0, { answer = true, today = TODAY } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const asked = [];
  let cur = migrate(structuredClone(plan0)); const saved = [];
  let n = 0;
  const store = { get: () => cur, update: (fn) => { const dft = structuredClone(cur); fn(dft); cur = dft; saved.push(dft); } };
  const draw = () => {
    const root = new FakeElement("main");
    const ctx = { ui: { ...ui, uid: () => `new-${++n}`, confirm: (q) => { asked.push(q); return answer; } }, fmt: { ...fmt, today: () => today }, plan: cur, route: { rest: [], query: {} }, module: { group: "career", id: "equity" }, computeOf: () => null, store };
    render(root, ctx);
    return root;
  };
  return { draw, saved, asked, textOf, plan: () => cur };
}
const partsOpen = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));
const partEl = (root, id) => root.querySelectorAll("details").find((x) => x.dataset.part === id);
const btnOf = (root, words) => root.querySelectorAll("button").find((b) => b.textContent === words);
const boxOf = (el, name) => el.querySelector(`[name="${name}"]`);
// inside a shut section (a part, or a form's "More details (optional)")
const shut = (el) => { for (let a = el.parentNode; a; a = a.parentNode) if (a.tagName === "DETAILS" && !a.hasAttribute("open")) return true; return false; };
// the filled buttons on the first view: submit buttons not outlined, outside shut sections
const filled = (root) => root.querySelectorAll("button").filter((b) => b.getAttribute("type") === "submit" && !String(b.className ?? "").includes("secondary") && !shut(b));

// hidden by the page (the option price box under units)
const hid = (el) => { for (let a = el; a; a = a.parentNode) if (a.hasAttribute?.("hidden")) return true; return false; };

test("the page drawn: no fold by hand; the grant form first with three boxes and the one filled button; the company a quiet row", async () => {
  const a = await drawPage(familyPlan(TODAY));
  const root = a.draw();
  assert.equal(root.querySelectorAll("details").filter((x) => !x.dataset.part && !String(x.className).includes("form-more")).length, 0, "no fold by hand (R10)");
  assert.deepEqual(partsOpen(root), { company: false, espp: false, deferred: false }, "nothing to price yet: the company row is shut");
  const t = a.textOf(root);
  assert.match(t, /Add each grant from your stock plan's website below; the share price comes next\./);
  const grantForm = btnOf(root, "Add the grant").closest("form");
  const shown = () => grantForm.all().filter((b) => (b.tagName === "INPUT" || b.tagName === "SELECT") && !shut(b) && !hid(b)).map((b) => b.getAttribute("name"));
  assert.deepEqual(shown(), ["kind", "shares", "granted"], "three boxes first (units ask no price); the name and the vesting under More details (optional)");
  // options ask the price paid per share; back to units, the box goes again (person critic F8: it showed for units)
  const kind = boxOf(grantForm, "kind");
  kind.value = "nso"; kind.dispatch("change");
  assert.deepEqual(shown(), ["kind", "shares", "strike", "granted"]);
  kind.value = "rsu"; kind.dispatch("change");
  assert.deepEqual(shown(), ["kind", "shares", "granted"]);
  assert.deepEqual(filled(root).map((b) => b.textContent), ["Add the grant"], "one filled button: the company's Save is outlined while the grant form shows");
  // a row opened beside the grant form adds no second filled button (opening "Purchase-plan shares" showed two)
  for (const id of ["company", "espp", "deferred"]) partEl(root, id).setAttribute("open", "");
  assert.deepEqual(filled(root).map((b) => b.textContent), ["Add the grant"], "every row open: still one filled button");
  assert.equal(a.textOf(partEl(root, "company").querySelector(".fold-status")).trim(), "not set yet");
  assert.equal(a.saved.length, 0, "drawing writes nothing");
  // More on this: the deeper pages as questions
  for (const q of ["How much rides on one company?", "What else does work give you?", "What is the tax when you sell?"]) assert.ok(t.includes(q), q);
});

test("a grant with no price opens the company row (the box the answer needs is in sight); with a price it is shut and says it", async () => {
  const p = familyPlan(TODAY); p.equity = { grants: [RSU] };
  const root = (await drawPage(p)).draw();
  assert.equal(partsOpen(root).company, true);
  assert.deepEqual(filled(root).map((b) => b.textContent), ["Save"], "with a grant on the list the company's Save is the one filled button");
  partEl(root, "espp").setAttribute("open", "");
  assert.deepEqual(filled(root).map((b) => b.textContent), ["Save"], "the purchase form beside it is outlined while the price is missing");
  const q = await drawPage(withEquity([RSU]));
  const r2 = q.draw();
  assert.equal(partsOpen(r2).company, false);
  assert.equal(q.textOf(partEl(r2, "company").querySelector(".fold-status")).trim(), "ACME at $50.00");
  assert.ok(btnOf(r2, "+ Add another grant"), "with grants the add form folds behind its outlined button (R20)");
});

test("a new grant saved with its vesting boxes blank gets the usual pattern; the green line shows in the grants card", async () => {
  const a = await drawPage(familyPlan(TODAY));
  let root = a.draw();
  const f = btnOf(root, "Add the grant").closest("form");
  boxOf(f, "shares").value = "1200"; boxOf(f, "granted").value = "2026-02-01";
  f.dispatch("submit");
  assert.equal(a.saved.length, 1);
  const g = a.plan().equity.grants[0];
  assert.deepEqual({ kind: g.kind, shares: g.shares, granted: g.granted, vestStart: g.vestStart, vestMonths: g.vestMonths, cliffMonths: g.cliffMonths, every: g.every }, { kind: "rsu", shares: 1200, granted: "2026-02-01", vestStart: "2026-02-01", vestMonths: 48, cliffMonths: 12, every: 3 });
  root = a.draw();
  assert.match(a.textOf(root), /Grant added\./);
});

test("S11 (R17): a save in a row keeps that row open with its green line; no other row opens or shuts; the next visit opens shut", async () => {
  const a = await drawPage(withEquity([RSU]));
  let root = a.draw();
  assert.deepEqual(partsOpen(root), { company: false, espp: false, deferred: false });
  const f = boxOf(partEl(root, "company"), "price").closest("form");
  boxOf(f, "price").value = "55";
  f.dispatch("submit");
  assert.equal(a.saved.length, 1); assert.equal(a.plan().equity.price, 55); assert.equal(a.plan().equity.priceAsOf, TODAY);
  root = a.draw();
  assert.deepEqual(partsOpen(root), { company: true, espp: false, deferred: false }, "the row just saved stays open, no other moves");
  assert.match(a.textOf(partEl(root, "company")), /Saved\./);
  root = a.draw();
  assert.deepEqual(partsOpen(root), { company: false, espp: false, deferred: false }, "the next draw opens shut");
  // purchase-plan shares: an empty list keeps its add form in its row; nothing is required at the box (a shut row holds no required box)
  const b = await drawPage(withEquity([RSU]));
  root = b.draw();
  const lf = btnOf(partEl(root, "espp"), "Add the shares").closest("form");
  assert.equal(lf.querySelectorAll("input").filter((x) => x.hasAttribute("required")).length, 0);
  for (const [k, v] of Object.entries({ offeringDate: "2025-01-01", purchaseDate: "2025-06-30", shares: "100", price: "34", fmvOffering: "40", fmvPurchase: "45" })) boxOf(lf, k).value = v;
  lf.dispatch("submit");
  assert.equal(b.saved.length, 1); assert.equal(b.plan().equity.espp.length, 1);
  root = b.draw();
  assert.deepEqual(partsOpen(root), { company: false, espp: true, deferred: false });
  assert.match(b.textOf(partEl(root, "espp")), /Shares added\./);
  // a purchase missing a price is refused at Save, nothing written
  const c = await drawPage(withEquity([RSU]));
  root = c.draw();
  const cf = btnOf(partEl(root, "espp"), "Add the shares").closest("form");
  boxOf(cf, "shares").value = "10";
  cf.dispatch("submit");
  assert.equal(c.saved.length, 0);
});

// ---------------------------------------------------------------- pay held for later (deferred pay plans; README "Pay held for later")
const T16 = "2026-11-16";
// one person, single, $100,000 of pay a year, born 1980, stops work at 62 (2042); 2026's tables: 10% to 12,400, 12% to 50,400,
// 22% to 105,700, 24% to 201,775; standard deduction 16,100 (Rev. Proc. 2025-32 section 4, as modules/taxes/federal/data has them)
const solo = (deferred, person = {}) => {
  const p = emptyPlan();
  p.household.people = [{ id: "p1", name: "Me", role: "self", birthDate: "1980-05-01", retirementAge: 62, ...person }];
  p.household.filingStatus = "single";
  p.income = [{ id: "s", name: "Pay", type: "salary", amount: 100000, period: "annual", personId: "p1", taxable: true }];
  p.equity = { deferred };
  return p;
};
const PLAN = { id: "d1", name: "2026 deferral", balance: 100000, yearly: 10000, untilYear: 2029, years: 5, startYear: 2031 };
const money0 = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

test("payouts: a lump in one year; equal parts over 5 years; what goes in from next year to the last year", () => {
  const lump = payouts({ balance: 100000, years: 1, startYear: 2031 }, { year: 2026 });
  assert.deepEqual(lump.rows, [{ year: 2031, amount: 100000 }]); assert.equal(lump.contributions, 0);
  // 100,000 + 10,000 for 2027, 2028 and 2029 (2026's is in the balance) = 130,000, in 5 equal parts of 26,000, 2031 to 2035
  const five = payouts(PLAN, { year: 2026 });
  assert.equal(five.contributions, 3); near(five.value, 130000); near(five.part, 26000);
  assert.deepEqual(five.rows.map((r) => r.year), [2031, 2032, 2033, 2034, 2035]);
  // no last year: every year until it starts paying (2027 to 2030, four)
  near(payouts({ ...PLAN, untilYear: null }, { year: 2026 }).value, 140000);
  // a last year after it starts paying stops at the year before
  near(payouts({ ...PLAN, untilYear: 2040 }, { year: 2026 }).value, 140000);
  // the parts box: blank is one year; at most 30
  assert.equal(payouts({ balance: 5000, startYear: 2030 }, { year: 2026 }).years, 1);
  assert.equal(payouts({ balance: 5000, startYear: 2030, years: 99 }, { year: 2026 }).years, DEFERRED_MAX_YEARS);
});

test("payouts with growth after prices: the value when it starts and equal parts with the rest growing, by hand", () => {
  const g = 0.03;
  const d = payouts({ ...PLAN, growth: g }, { year: 2026 });
  // V = 100,000 x 1.03^5 + 10,000 x (1.03^4 + 1.03^3 + 1.03^2) = 115,927.41 + 32,791.36
  const V = 100000 * 1.03 ** 5 + 10000 * (1.03 ** 4 + 1.03 ** 3 + 1.03 ** 2);
  near(d.value, V, 1e-6); near(V, 148718.77, 0.01);
  // a = 1 + 1/1.03 + ... + 1/1.03^4 = 4.717098; P = V / a = 31,527.6
  const a = [0, 1, 2, 3, 4].reduce((t, j) => t + 1.03 ** -j, 0);
  near(d.part, V / a, 1e-6); near(d.part, 31527.6, 0.1);
  // paid out to the last cent: the parts, taken back to the first year, add up to V
  near(d.rows.reduce((t, r, j) => t + r.amount * 1.03 ** -j, 0), V, 1e-6);
});

test("at leaving work: from the owner's stop year (birth year + retirement age); before this year it counts from this year", () => {
  const p = solo([{ ...PLAN, startYear: null }]);
  assert.equal(adultsOf(p)[0].stopYear, 2042);
  const [d] = deferredPlans(p, { year: 2026 });
  assert.equal(d.atStop, true); assert.equal(d.startYear, 2042);
  // money goes in to 2029 as typed
  near(d.value, 130000);
  assert.deepEqual(d.rows.map((r) => r.year), [2042, 2043, 2044, 2045, 2046]);
  // the plan's own retirement age when the person has none
  const q = solo([{ ...PLAN, startYear: null }], { retirementAge: undefined }); q.assumptions = { ...(q.assumptions ?? {}), retirementAge: 67 };
  assert.equal(deferredPlans(q, { year: 2026 })[0].startYear, 2047);
  // a stop year already past: counted from this year, and said
  const late = deferredPlans(solo([{ ...PLAN, startYear: null, untilYear: null }], { birthDate: "1955-01-01" }), { year: 2026 })[0];
  assert.equal(late.startYear, 2026); assert.equal(late.late, true); assert.equal(late.contributions, 0);
  // no birth date: not placed, no rows, no income line
  const none = solo([{ ...PLAN, startYear: null }], { birthDate: undefined });
  const u = deferredPlans(none, { year: 2026 })[0];
  assert.equal(u.placed, false); assert.deepEqual(u.rows, []);
  assert.deepEqual(deferredIncomes(none, { year: 2026 }), []);
});

test("the tax on each year's payout, against a hand calculation at 2026's single brackets", () => {
  const d = deferredPay(solo([PLAN]), { today: T16 });
  // while working: taxable 100,000 - 16,100 = 83,900; with 26,000 more, 109,900: 22% x (105,700 - 83,900) + 24% x (109,900 - 105,700)
  const hand = 0.22 * (105700 - 83900) + 0.24 * (109900 - 105700);
  near(hand, 5804);
  const [p] = d.plans;
  assert.equal(p.case, "even");
  for (const r of p.rows) near(r.tax, hand, 1e-6);
  near(p.tax, 5 * hand, 1e-6); near(d.tax, 5 * hand, 1e-6); near(d.total, 130000);
  // the same figure from the federal helper on the page's own return
  const t = tv(solo([PLAN]));
  near(payoutTax(26000, t.inputs, t.params), hand, 1e-6);
  // a lump of 100,000 in 2031: 22% x 21,800 + 24% x (183,900 - 105,700)
  const lump = deferredPay(solo([{ id: "l", balance: 100000, years: 1, startYear: 2031 }]), { today: T16 }).plans[0];
  assert.equal(lump.case, "once"); near(lump.rows[0].tax, 0.22 * 21800 + 0.24 * (183900 - 105700), 1e-6); near(lump.rows[0].tax, 23564);
  // paid from leaving work: the pay has stopped, so 26,000 alone: 10% x (26,000 - 16,100) = 990 a year
  const left = deferredPay(solo([{ ...PLAN, startYear: null }]), { today: T16 }).plans[0];
  for (const r of left.rows) near(r.tax, 990, 1e-6);
  assert.deepEqual(deferredPay(solo([{ ...PLAN, startYear: null }]), { today: T16 }).years[0].stopped, ["p1"]);
  assert.equal(payoutTax(0, t.inputs, t.params), 0);
});

test("two plans paying in one year share that year's tax by their payouts; a stop year inside the payouts makes runs", () => {
  const two = deferredPay(solo([{ id: "a", name: "A", balance: 30000, years: 1, startYear: 2031 }, { id: "b", name: "B", balance: 10000, years: 1, startYear: 2031 }]), { today: T16 });
  const all = 0.22 * (105700 - 83900) + 0.24 * (123900 - 105700);   // 40,000 on top: taxable 123,900
  near(two.years[0].tax, all, 1e-6);
  near(two.plans[0].rows[0].tax, all * 0.75, 1e-6); near(two.plans[1].rows[0].tax, all * 0.25, 1e-6);
  // paying 2040 to 2044, work stopping in 2042: 2040 and 2041 on top of the pay, 2042 to 2044 alone
  const runs = deferredPay(solo([{ id: "r", name: "Runs", balance: 100000, years: 5, startYear: 2040 }]), { today: T16 }).plans[0];
  assert.equal(runs.case, "runs");
  assert.deepEqual(runs.runs.map((r) => [r.from, r.to]), [[2040, 2041], [2042, 2044]]);
  near(runs.runs[0].tax, 0.22 * 20000, 1e-6); near(runs.runs[1].tax, 0.1 * (20000 - 16100), 1e-6);
  // a couple: the base keeps the share of the household's wages still earned that year
  const fam = familyPlan(T16); fam.equity = { deferred: [{ id: "f", balance: 50000, years: 1, startYear: 2051 }] };   // Bo (born 1988, 62) stops in 2050
  const fd = deferredPay(fam, { today: T16 });
  const t = tv(fam);
  const bo = 5200 * 12, ana = 3900 * 26;
  assert.deepEqual(fd.years[0].stopped, ["p-bo"]);
  near(fd.years[0].tax, payoutTax(50000, { ...t.inputs, wages: (t.inputs.wages * ana) / (ana + bo) }, t.params), 1e-6);
});

test("compute adds deferred only when the plan holds one; an empty entry is no plan; deferred-only plans are not ready for stock", () => {
  assert.equal("deferred" in compute(familyPlan(T16), { today: T16 }), false);
  const empty = familyPlan(T16); empty.equity = { deferred: [{ id: "x", name: "nothing", balance: 0 }] };
  assert.equal("deferred" in compute(empty, { today: T16 }), false);
  const d = compute(solo([PLAN]), { today: T16 });
  assert.equal(d.ready, false); assert.equal(d.deferred.plans.length, 1);
  const s = withEquity([RSU]); s.equity.deferred = [PLAN];
  const ds = compute(s, { today: T16 });
  assert.equal(ds.ready, true); assert.equal(ds.deferred.plans[0].case, "even");
  const { deferred: _d, ...rest } = ds;
  assert.equal(JSON.stringify(rest), JSON.stringify(compute(withEquity([RSU]), { today: T16 })), "the stock figures are the same with deferred pay");
});

test("one written sentence per case (R5), the status, the saves' green lines and Undo's words", () => {
  const [even] = deferredPay(solo([PLAN]), { today: T16 }).plans;
  assert.deepEqual(deferredLines(even, money0), ["$26,000 a year from 2031 to 2035, with about $5,804 of federal tax each year."]);
  const [once] = deferredPay(solo([{ id: "l", name: "Lump", balance: 100000, years: 1, startYear: 2031 }]), { today: T16 }).plans;
  assert.deepEqual(deferredLines(once, money0), ["All of it in 2031: about $100,000, with about $23,564 of federal tax."]);
  const [runs] = deferredPay(solo([{ id: "r", name: "Runs", balance: 100000, years: 5, startYear: 2040 }]), { today: T16 }).plans;
  assert.deepEqual(deferredLines(runs, money0), ["2040 to 2041: $20,000 a year, with about $4,400 of federal tax each year.", "2042 to 2044: $20,000 a year, with about $390 of federal tax each year."]);
  assert.equal(deferredSummary(runs, money0), "It pays $100,000 from 2040 to 2044, with about $9,970 of federal tax in all.");   // 2 x 4,400 + 3 x 390
  const [single] = deferredPay(solo([{ id: "o", balance: 5000, years: 1, startYear: 2031 }], {}), { today: T16 }).plans;
  const noTax = { ...single, rows: [{ ...single.rows[0], tax: 0 }] };
  assert.deepEqual(deferredLines(noTax, money0), ["All of it in 2031: about $5,000, with no federal tax."]);
  const [un] = deferredPay(solo([{ ...PLAN, startYear: null }], { birthDate: undefined }), { today: T16 }).plans;
  // not placed: said as not counted, with what it needs (person critic F4: it read as counted)
  assert.deepEqual(deferredLines(un, money0), ["Not counted yet: it pays from the year you stop work, and that needs your birth date."]);
  assert.equal(deferredLines({ ...un, owner: { name: "Bo" } }, money0)[0], "Not counted yet: it pays from the year Bo stops work, and that needs Bo's birth date.");
  assert.equal(deferredSaid.added(un, money0), "Added. Not counted yet: it pays from the year you stop work, and that needs your birth date.");
  const [late] = deferredPay(solo([{ ...PLAN, startYear: 2024, untilYear: null }]), { today: T16 }).plans;
  assert.equal(deferredLines(late, money0, 2026).at(-1), "It would have started before 2026, so it is counted from 2026.");
  // status
  assert.equal(deferredStatus(null), "");
  assert.equal(deferredStatus({ plans: [even] }), "2031 to 2035");
  assert.equal(deferredStatus({ plans: [once] }), "in 2031");
  assert.equal(deferredStatus({ plans: [even, once] }), "2 plans");
  assert.equal(deferredStatus({ plans: [un] }), "");
  // the green lines name the new answer (R7), Undo's words
  assert.equal(deferredSaid.added(even, money0), "Added. $26,000 a year from 2031 to 2035, with about $5,804 of federal tax each year.");
  assert.equal(deferredSaid.saved(once, money0), "Saved. All of it in 2031: about $100,000, with about $23,564 of federal tax.");
  assert.equal(deferredSaid.removed("2026 deferral"), "Removed \"2026 deferral\".");
  assert.equal(deferredSaid.removed(""), "Removed the plan.");
  assert.equal(deferredSaid.addUndone("2026 deferral"), "\"2026 deferral\" is off the list again.");
  assert.equal(deferredSaid.saveUndone(""), "The plan is back as it was.");
  assert.equal(deferredSaid.removeUndone("2026 deferral"), "\"2026 deferral\" is back on the list.");
  assert.equal(deferredSaid.askRemove("2026 deferral"), "Remove \"2026 deferral\"?");
  assert.match(DEFERRED.risk, /if the company fails, you wait in line with everyone else it owes/);
  assert.match(DEFERRED.how, /^In today's dollars\. Federal tax only/);
});

test("what the form saves, and what it refuses at its box", () => {
  const ok = deferredFrom({ name: " 2026 deferral ", balance: 100000, yearly: null, untilYear: null, years: 5, startYear: "2031", growth: null }, { year: 2026 });
  assert.deepEqual(ok.entry, { name: "2026 deferral", balance: 100000, yearly: 0, untilYear: null, years: 5, startYear: 2031, growth: null });
  assert.equal(deferredFrom({ balance: 50000, startYear: "leave", years: null }, { year: 2026 }).entry.startYear, null, "from leaving work");
  assert.equal(deferredFrom({ balance: 50000, startYear: "", years: null }, { year: 2026 }).entry.years, 1, "blank: one year");
  assert.equal(deferredFrom({ yearly: 12000, personId: "p-bo" }, { year: 2026 }).entry.personId, "p-bo");
  assert.deepEqual(deferredFrom({ balance: null, yearly: 0 }, { year: 2026 }), { error: "balance", words: "Type what is in it now, or what you put in each year." });
  assert.deepEqual(deferredFrom({ balance: 1000, untilYear: 2025 }, { year: 2026 }), { error: "untilYear", words: "Type 2026 or later, or leave it empty." });
  // a plan saved with 2026 as its last year saves again in 2027 as it is (money critic F4); another past year is still refused
  assert.equal(deferredFrom({ balance: 1000, untilYear: 2026 }, { year: 2027, kept: 2026 }).entry.untilYear, 2026);
  assert.equal(deferredFrom({ balance: 1000, untilYear: 2025 }, { year: 2027, kept: 2026 }).error, "untilYear");
  assert.equal(deferredFrom({ balance: 1000, years: 31 }, { year: 2026 }).error, "years");
  assert.equal(deferredFrom({ balance: 1000, growth: 0.2 }, { year: 2026 }).error, "growth");
});

test("stored data the form cannot make: a first year far ahead is held to 100 years from now, money to $1 trillion; quick and finite", () => {
  // a start year of 2,000,000,000 looped two billion contribution years (ten seconds a draw; money critic F2)
  const t0 = Date.now();
  const far = payouts({ balance: 1, yearly: 5, startYear: 2e9 }, { year: 2026 });
  assert.ok(Date.now() - t0 < 200, `${Date.now() - t0} ms`);
  assert.equal(far.startYear, 2026 + DEFERRED_AHEAD); assert.equal(far.contributions, DEFERRED_AHEAD - 1); near(far.value, 1 + 5 * (DEFERRED_AHEAD - 1));
  assert.equal(payouts({ balance: 1000, startYear: null }, { year: 2026, stopYear: 1e9 }).startYear, 2126, "a birth year far ahead too");
  // $1e308 at 15% for 64 years was Infinity: the rows read null and the tax was not a number
  const big = solo([{ id: "b", balance: 1e308, yearly: 1e308, years: 30, growth: 0.15, startYear: 2090 }]);
  const d = deferredPay(big, { today: T16 });
  assert.ok(d.plans[0].rows.every((r) => Number.isFinite(r.amount) && Number.isFinite(r.tax)) && Number.isFinite(d.tax));
  near(payouts({ balance: 1e308, years: 1, startYear: 2026 }, { year: 2026 }).value, DEFERRED_MAX_MONEY);
  assert.ok(deferredIncomes(big, { year: 2026 }).every((x) => Number.isFinite(x.yearly)));
});

test("the plan's form: whose plan names the year it starts from leaving work; an old plan saves again as it is", async () => {
  // two adults: the choice names the owner and the year, and follows "Whose plan" (person critic F3: "its owner")
  const a = await drawPage(familyPlan(T16), { today: T16 });
  let root = a.draw();
  let f = btnOf(partEl(root, "deferred"), "Add the plan").closest("form");
  const leave = () => a.textOf(boxOf(f, "startYear").querySelector("option"));
  const ana = adultsOf(familyPlan(T16)).find((x) => x.id === "p-ana"), bo = adultsOf(familyPlan(T16)).find((x) => x.id === "p-bo");
  assert.equal(leave(), `The year Ana stops work (${ana.stopYear})`);
  boxOf(f, "personId").value = "p-bo"; boxOf(f, "personId").dispatch("change");
  assert.equal(leave(), `The year Bo stops work (${bo.stopYear})`);
  // a plan saved in 2026 with 2026 as its last year, edited in 2027 without touching that box: saved, not refused
  const old = solo([{ id: "o", name: "Old", balance: 50000, yearly: 5000, untilYear: 2026, years: 1, startYear: 2031 }]);
  const b = await drawPage(old, { today: "2027-02-01" });
  root = b.draw();
  btnOf(partEl(root, "deferred"), "Edit").click();
  f = btnOf(partEl(root, "deferred"), "Save the plan").closest("form");
  assert.equal(boxOf(f, "untilYear").getAttribute("min"), "2026", "the box's floor lets the saved year stand");
  boxOf(f, "balance").value = "52000";
  f.dispatch("submit");
  assert.equal(b.saved.length, 1);
  assert.deepEqual([b.plan().equity.deferred[0].balance, b.plan().equity.deferred[0].untilYear], [52000, 2026]);
});

test("the plan's row: Edit takes the green line away; a plan with no year says it is not counted, with the way to People", async () => {
  // Edit after an add: the "Added." line and its Undo go (person critic F2: Undo would take back the plan being edited)
  const a = await drawPage(solo([]), { today: T16 });
  let root = a.draw();
  let f = btnOf(partEl(root, "deferred"), "Add the plan").closest("form");
  boxOf(f, "balance").value = "40000"; boxOf(f, "startYear").value = "2031";
  f.dispatch("submit");
  root = a.draw();
  let el = partEl(root, "deferred");
  assert.match(a.textOf(el), /Added\./); assert.ok(btnOf(el, "Undo"));
  // no name typed: called by the row's own title (person critic F6: "Deferred pay plan")
  assert.match(a.textOf(el.querySelector(".rec-title")), /^Pay held for later$/);
  btnOf(el, "Edit").click();
  el = partEl(root, "deferred");
  assert.ok(!/Added\./.test(a.textOf(el)) && !btnOf(el, "Undo"), "no green line while editing");
  assert.ok(btnOf(el, "Save the plan"));
  // no birth date and paid from leaving work: not counted, a way to People, and no line about Will the money last?
  const u = await drawPage(solo([{ id: "u", balance: 50000, startYear: null }], { birthDate: undefined }), { today: T16 });
  el = partEl(u.draw(), "deferred");
  const t = u.textOf(el);
  assert.match(t, /Not counted yet: it pays from the year you stop work, and that needs your birth date\./);
  const link = el.querySelectorAll("a").find((x) => x.getAttribute("href") === "#/household/people");
  assert.equal(u.textOf(link), "Add your birth date");
  assert.ok(String(link.className).includes("secondary"), "outlined");
  assert.ok(!t.includes(DEFERRED.retirement));
  // placed: no link, and the line is there
  const p = await drawPage(solo([PLAN]), { today: T16 });
  el = partEl(p.draw(), "deferred");
  assert.ok(p.textOf(el).includes(DEFERRED.retirement));
  assert.equal(el.querySelectorAll("a").filter((x) => x.getAttribute("href") === "#/household/people").length, 0);
});

test("Will the money last?'s lines: one a plan, in today's dollars raised with prices, taxed like pre-tax money; none without a plan", () => {
  assert.deepEqual(deferredIncomes(familyPlan(T16), { year: 2026 }), []);
  const [line] = deferredIncomes(solo([PLAN]), { year: 2026 });
  assert.deepEqual(line, { name: "Pay held for later: 2026 deferral", yearly: 26000, personId: "p1", startAge: 0, fromYear: 2031, untilYear: 2035, cola: true, taxable: true, pretax: true, notInMonth: true, type: "other", deferred: "d1" });
});

test("the row drawn: one quiet row, shut, no status while empty; open it shows what it is for, the form and the risk line", async () => {
  const a = await drawPage(solo([]), { today: T16 });
  const root = a.draw();
  const el = partEl(root, "deferred");
  assert.equal(a.textOf(el.querySelector(".fold-title")).trim(), "Pay held for later");
  assert.equal(el.querySelector(".fold-status"), null);
  assert.deepEqual(partsOpen(root), { company: false, espp: false, deferred: false });
  const t = a.textOf(el);
  assert.ok(t.includes(DEFERRED.intro) && t.includes(DEFERRED.risk));
  const f = btnOf(el, "Add the plan").closest("form");
  const inMore = (b) => { for (let x = b.parentNode; x; x = x.parentNode) if (x.tagName === "DETAILS" && String(x.className).includes("form-more")) return true; return false; };
  const first = f.all().filter((b) => (b.tagName === "INPUT" || b.tagName === "SELECT") && !inMore(b)).map((b) => b.getAttribute("name"));
  assert.deepEqual(first, ["name", "balance", "yearly", "years", "startYear"], "five boxes first; the last year, growth and whose plan under More details (optional)");
  assert.equal(f.querySelectorAll("input").filter((x) => x.hasAttribute("required")).length, 0, "no required box in a shut row");
  assert.equal(a.textOf(boxOf(f, "startYear").querySelector("option")), "The year you stop work (2042)");
  assert.equal(a.saved.length, 0);
});

test("S11 (R17) add, Undo, edit and remove: the row stays open with its green line naming the answer; nothing else moves", async () => {
  const a = await drawPage(solo([]), { today: T16 });
  let root = a.draw();
  let f = btnOf(partEl(root, "deferred"), "Add the plan").closest("form");
  boxOf(f, "name").value = "2026 deferral"; boxOf(f, "balance").value = "100000"; boxOf(f, "yearly").value = "10000"; boxOf(f, "untilYear").value = "2029";
  boxOf(f, "years").value = "5"; boxOf(f, "startYear").value = "2031";
  f.dispatch("submit");
  assert.equal(a.saved.length, 1);
  const saved = a.plan().equity.deferred;
  assert.deepEqual(saved, [{ id: "new-1", name: "2026 deferral", balance: 100000, yearly: 10000, untilYear: 2029, years: 5, startYear: 2031, growth: null }]);
  root = a.draw();
  assert.deepEqual(partsOpen(root), { company: false, espp: false, deferred: true }, "the row just saved stays open, no other moves");
  let el = partEl(root, "deferred"), t = a.textOf(el);
  assert.match(t, /Added\. \$26,000 a year from 2031 to 2035, with about \$5,804 of federal tax each year\./);
  assert.equal(a.textOf(el.querySelector(".fold-status")).trim(), "2031 to 2035");
  assert.match(t, /2026 deferral\s*\$130,000/);
  for (const line of [DEFERRED.how, DEFERRED.risk, DEFERRED.retirement]) assert.ok(t.includes(line), line);
  assert.ok(btnOf(el, "+ Add another plan"), "with a plan the form folds behind its outlined button (R20)");
  // Undo takes the add back, and says so on the next draw
  btnOf(el, "Undo").click();
  assert.deepEqual(a.plan().equity.deferred, []);
  root = a.draw();
  assert.match(a.textOf(partEl(root, "deferred")), /"2026 deferral" is off the list again\./);
  // add it again, then edit: paid over 10 years
  f = btnOf(partEl(root, "deferred"), "Add the plan").closest("form");
  boxOf(f, "name").value = "2026 deferral"; boxOf(f, "balance").value = "100000"; boxOf(f, "years").value = "1"; boxOf(f, "startYear").value = "leave";
  f.dispatch("submit");
  assert.equal(a.plan().equity.deferred[0].startYear, null, "from leaving work");
  root = a.draw();
  // paid once work has stopped, alone: taxable 100,000 - 16,100 = 83,900: 10% x 12,400 + 12% x 38,000 + 22% x 33,500 = 13,170
  assert.match(a.textOf(partEl(root, "deferred")), /Added\. All of it in 2042: about \$100,000, with about \$13,170 of federal tax\./);
  btnOf(partEl(root, "deferred"), "Edit").click();
  f = btnOf(partEl(root, "deferred"), "Save the plan").closest("form");
  assert.equal(boxOf(f, "balance").value, "100,000");
  boxOf(f, "years").value = "10";
  f.dispatch("submit");
  assert.equal(a.plan().equity.deferred[0].years, 10);
  root = a.draw();
  assert.match(a.textOf(partEl(root, "deferred")), /Saved\. \$10,000 a year from 2042 to 2051, with no federal tax\./);
  // remove: asked first, then removed with Undo, which puts it back
  btnOf(partEl(root, "deferred"), "Remove").click();
  assert.deepEqual(a.asked.at(-1), "Remove \"2026 deferral\"?");
  assert.deepEqual(a.plan().equity.deferred, []);
  root = a.draw();
  assert.match(a.textOf(partEl(root, "deferred")), /Removed "2026 deferral"\./);
  btnOf(partEl(root, "deferred"), "Undo").click();
  assert.equal(a.plan().equity.deferred.length, 1);
  root = a.draw();
  assert.match(a.textOf(partEl(root, "deferred")), /"2026 deferral" is back on the list\./);
  // No keeps it
  const no = await drawPage(solo([PLAN]), { today: T16, answer: false });
  btnOf(partEl(no.draw(), "deferred"), "Remove").click();
  assert.equal(no.saved.length, 0);
});

test("the form refuses at its box: nothing in it and nothing going in; a last year before this one", async () => {
  const a = await drawPage(solo([]), { today: T16 });
  const root = a.draw();
  const f = btnOf(partEl(root, "deferred"), "Add the plan").closest("form");
  f.dispatch("submit");
  assert.equal(a.saved.length, 0, "nothing typed: nothing saved");
  boxOf(f, "balance").value = "5000"; boxOf(f, "untilYear").value = "2025";
  f.dispatch("submit");
  assert.equal(a.saved.length, 0, "a last year before this one is refused");
});
