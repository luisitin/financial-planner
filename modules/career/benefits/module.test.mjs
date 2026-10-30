import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, matchAt, fullMatchAt, matchDollars, limit401k, groupLifeImputed, taxSaved, PAYROLL, DEFAULT_TIERS } from "./compute.js";
import { BENEFITS, GROUP_LIFE, ESPP } from "./data/benefits.js";
import { LIMITS } from "../../retirement/contributions/data/limits.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";      // October: open enrollment for 2027
const SPRING = "2026-04-15";     // the year's own benefits
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const fedOnly = (r) => r.totalTax - r.additionalMedicare;
const withBenefits = (b, extra = {}, fn) => { const p = familyPlan(TODAY); p.whatIfs = { benefits: { ...extra, "p-ana": b } }; if (fn) fn(p); return p; };
const ti = (p = familyPlan(TODAY)) => taxInputs(p, { today: TODAY });

test("the match by tiers: 100% on the first 3%, 50% on the next 2%; capped pay; no match at all", () => {
  const tiers = [{ rate: 1, upTo: 0.03 }, { rate: 0.5, upTo: 0.05 }];
  near(matchAt(0.02, tiers), 0.02); near(matchAt(0.04, tiers), 0.035); near(matchAt(0.1, tiers), 0.04);
  assert.equal(fullMatchAt(tiers), 0.05);
  near(matchAt(0.06, DEFAULT_TIERS), 0.03); assert.equal(fullMatchAt(DEFAULT_TIERS), 0.06);
  assert.equal(matchAt(0.1, []), 0); assert.equal(fullMatchAt([]), 0);
  // the match counts pay only to $360,000 (2026), and what you put in only to the deferral limit
  near(matchDollars(24500, 500000, DEFAULT_TIERS, { compLimit: 360000, limit: 24500 }), 0.03 * 360000);
  near(matchDollars(30000, 300000, [{ rate: 1, upTo: 0.1 }], { compLimit: 360000, limit: 24500 }), 24500);
  near(matchDollars(5000, 100000, DEFAULT_TIERS), 2500);
});

test("the 401(k) limit by the age reached (2026: $24,500; $8,000 from 50; $11,250 from 60 to 63)", () => {
  const L = LIMITS[2026].kinds;
  assert.deepEqual(limit401k(L, 36), { limit: 24500, catchUp: 0 });
  assert.deepEqual(limit401k(L, 50), { limit: 32500, catchUp: 8000 });
  assert.deepEqual(limit401k(L, 61), { limit: 35750, catchUp: 11250 });
  assert.deepEqual(limit401k(L, 64), { limit: 32500, catchUp: 8000 });
  assert.deepEqual(limit401k(L, null), { limit: 24500, catchUp: 0 }); assert.deepEqual(limit401k(L, NaN), { limit: 24500, catchUp: 0 });
});

test("life cover through work above $50,000: Table I's monthly cost per $1,000 is taxable pay (age 40 when unknown)", () => {
  near(groupLifeImputed(200000, 36), 150 * 0.09 * 12);
  near(groupLifeImputed(100000, 52), 50 * 0.23 * 12);
  near(groupLifeImputed(100000, 70, 100), 50 * 2.06 * 12 - 100);
  near(groupLifeImputed(100000, null), 50 * 0.10 * 12); near(groupLifeImputed(100000, NaN), 50 * 0.10 * 12);
  assert.equal(groupLifeImputed(50000, 40), 0); assert.equal(groupLifeImputed(60000, 30, 1000), 0);
  assert.equal(GROUP_LIFE.free, 50000);
});

test("the tax a pre-tax deduction saves: federal income tax by the engine (no 0.9%), payroll under the wage base, the state", () => {
  const t = ti();
  const T = { inputs: t.inputs, params: t.params, personPay: 100000, wageBase: 184500, stateRate: 0.05 };
  const a = taxSaved(2000, T);
  near(a.federal, fedOnly(federalTax(t.inputs, t.params)) - fedOnly(federalTax({ ...t.inputs, wages: t.inputs.wages - 2000 }, t.params)));
  near(a.federal, 2000 * 0.22, 0.01, "Ana and Bo are in the 22% bracket");
  near(a.payroll, 2000 * (PAYROLL.ss + PAYROLL.medicare)); near(a.state, 100); near(a.total, a.federal + a.payroll + 100);
  near(taxSaved(2000, { ...T, fica: false }).payroll, 0);
  near(taxSaved(2000, { ...T, personPay: 190000 }).payroll, 2000 * PAYROLL.medicare, 1e-9);
  near(taxSaved(2000, { ...T, personPay: 185500 }).payroll, 1000 * PAYROLL.ss + 2000 * PAYROLL.medicare);
  near(taxSaved(2000, { ...T, state: false }).state, 0);
  assert.equal(taxSaved(0, T).total, 0);
  // over the 0.9% line, a 401(k) saves only income tax
  const rich = { ...t.inputs, wages: 300000, filingStatus: "single" };
  const r = taxSaved(24500, { ...T, inputs: rich, fica: false, state: false });
  near(r.federal, fedOnly(federalTax(rich, t.params)) - fedOnly(federalTax({ ...rich, wages: 275500 }, t.params)));
});

test("in October the page chooses next year's benefits with the latest limits, and says so", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.planYear, 2027); assert.equal(d.limitsYear, 2026); assert.equal(d.person.age, 37, "the age Ana reaches in 2027");
  assert.ok(d.notes.some((n) => /2027 limits are not in the app yet/.test(n)));
  const spring = compute(familyPlan(SPRING), { today: SPRING });
  assert.equal(spring.planYear, 2026); assert.ok(!spring.notes.some((n) => /limits are not in the app/.test(n)));
  const turning50 = familyPlan(TODAY); turning50.household.people.find((x) => x.id === "p-ana").birthDate = "1977-03-01";
  assert.equal(compute(turning50, { today: TODAY }).k401.catchUp, 8000, "50 in 2027, the plan year");
});

test("Ana's 401(k): now, the whole match at 6% (assumed), the limit, each choice's cost after tax", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.person.id, "p-ana"); assert.equal(d.pay, 101400); assert.equal(d.paychecks, 26);
  const k = d.k401;
  assert.equal(k.tiersAssumed, true);
  near(k.nowYearly, 470 * 26); near(k.nowPct, 12220 / 101400); assert.equal(k.nowMatchPlan, 3050);
  near(k.fullPct, 0.06); near(k.fullMatch, 0.03 * 101400); near(k.nowMatch, 0.03 * 101400); assert.equal(k.leftBehind, 0);
  assert.equal(k.limit, 24500); near(k.maxPct, 24500 / 101400);
  assert.deepEqual(k.options.map((o) => o.key), ["match", "now", "max"]);
  const t = ti();
  const w0 = t.inputs.wages + 12220;   // wages before any 401(k) saving
  const max = k.options.find((o) => o.key === "max");
  near(max.yearly, 24500); near(max.perCheck, 24500 / 26);
  near(max.saved, fedOnly(federalTax({ ...t.inputs, wages: w0 }, t.params)) - fedOnly(federalTax({ ...t.inputs, wages: w0 - 24500 }, t.params)));
  near(max.saved, 24500 * 0.22, 0.01);
  near(max.cost, 24500 - max.saved); near(max.costPerCheck, max.cost / 26);
  assert.equal(k.rothCatchUp, false); assert.equal(k.rothCatchUpWages, 150000);
});

test("match left behind with the employer's tiers; no match at all; pay above the $360,000 limit", () => {
  const p = withBenefits({ matchTiers: [{ rate: 1, upTo: 0.04 }, { rate: 0.5, upTo: 0.06 }] });
  p.retirement.contributions.find((c) => c.id === "c-ana").amount = 101400 * 0.02 / 26;
  const k = compute(p, { today: TODAY }).k401;
  assert.equal(k.tiersAssumed, false);
  near(k.nowPct, 0.02); near(k.nowMatch, 0.02 * 101400); near(k.fullMatch, 0.05 * 101400); near(k.leftBehind, 0.03 * 101400);
  const none = compute(withBenefits({ matchTiers: [{ rate: 0, upTo: 0 }] }), { today: TODAY }).k401;
  assert.equal(none.fullMatch, 0); assert.equal(none.leftBehind, 0); assert.deepEqual(none.options.map((o) => o.key), ["now", "max"]);
  const rich = withBenefits({}, {}, (q) => { q.income.find((x) => x.id === "i-ana").amount = 500000 / 26; q.retirement.contributions.find((c) => c.id === "c-ana").amount = 24500 / 26; });
  const r = compute(rich, { today: TODAY }).k401;
  assert.equal(r.overCompLimit, true);
  near(r.nowMatch, 0.03 * 360000, 1e-6); near(r.fullMatch, 0.03 * 360000, 1e-6); assert.equal(r.leftBehind, 0, "at the limit nothing is left behind");
});

test("the Roth catch-up: over $150,000 the catch-up part is after tax, so it saves no tax now", () => {
  const q = familyPlan(TODAY);
  q.household.people.find((x) => x.id === "p-ana").birthDate = "1975-01-01";
  q.income.find((x) => x.id === "i-ana").amount = 6500;   // 169,000 a year
  const k = compute(q, { today: TODAY }).k401;
  assert.equal(k.catchUp, 8000); assert.equal(k.rothCatchUp, true); assert.ok(169000 > BENEFITS[2026].rothCatchUpWages);
  const max = k.options.find((o) => o.key === "max");
  near(max.yearly, 32500); near(max.roth, 8000);
  const t = taxInputs(q, { today: TODAY });
  const w0 = t.inputs.wages + 12220;
  near(max.saved, fedOnly(federalTax({ ...t.inputs, wages: w0 }, t.params)) - fedOnly(federalTax({ ...t.inputs, wages: w0 - 24500 }, t.params)));
});

test("a state that taxes 401(k) money (Pennsylvania) saves no state tax on it, but does on the HSA", () => {
  const p = withBenefits({ hsaEligible: true, hsaElect: 1000 }, {}, (q) => { q.household.state = "PA"; q.taxes.state = { rate: 0.0307 }; });
  const d = compute(p, { today: TODAY });
  assert.equal(d.k401.stateTaxed, true);
  const t = taxInputs(p, { today: TODAY });
  const max = d.k401.options.find((o) => o.key === "max");
  near(max.saved, fedOnly(federalTax({ ...t.inputs, wages: t.inputs.wages + 12220 }, t.params)) - fedOnly(federalTax({ ...t.inputs, wages: t.inputs.wages + 12220 - 24500 }, t.params)));
  near(d.hsa.saved, taxSaved(1000, { inputs: t.inputs, params: t.params, personPay: 101400, wageBase: 184500, stateRate: 0.0307 }).total);
});

test("the HSA: the family limit less the employer's money, the election capped at the room, the tax it saves, the catch-up from 55", () => {
  const d = compute(withBenefits({ hsaEligible: true, hsaCoverage: "family", hsaEmployer: 1000, hsaElect: 9000 }), { today: TODAY });
  const h = d.hsa;
  assert.equal(h.limit, 8750); assert.equal(h.room, 7750); assert.equal(h.elect, 7750); assert.equal(h.typed, 9000);
  const t = ti();
  near(h.saved, fedOnly(federalTax(t.inputs, t.params)) - fedOnly(federalTax({ ...t.inputs, wages: t.inputs.wages - 7750 }, t.params)) + 7750 * 0.0765);
  near(h.maxSaved, h.saved, 1e-9);
  assert.equal(h.stateTaxed, false);
  const older = compute(withBenefits({ hsaEligible: true, hsaCoverage: "self" }, {}, (q) => { q.household.people.find((x) => x.id === "p-ana").birthDate = "1972-01-01"; }), { today: TODAY }).hsa;
  assert.equal(older.limit, 4400 + 1000, "55 in the plan year");
  const ca = withBenefits({ hsaEligible: true, hsaCoverage: "self", hsaElect: 1000 }, {}, (q) => { q.household.state = "CA"; q.taxes.state = { rate: 0.06 }; });
  const c = compute(ca, { today: TODAY }).hsa;
  assert.equal(c.limit, 4400); assert.equal(c.stateTaxed, true);
  const tc = taxInputs(ca, { today: TODAY });
  near(c.saved, taxSaved(1000, { inputs: tc.inputs, params: tc.params, personPay: 101400, wageBase: 184500, stateRate: 0.06, state: false }).total, 1e-6);
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).hsa, null, "no HSA on file: not shown");
});

test("FSAs and commuting: capped at the limits, the typed figure kept; child care shared by the household", () => {
  const d = compute(withBenefits({ fsaElect: 5000, dcfsaElect: 9000, transitMonthly: 400, parkingMonthly: 100 }), { today: TODAY });
  assert.equal(d.fsa.elect, 3400); assert.equal(d.fsa.typed, 5000); assert.equal(d.fsa.carryover, 680);
  assert.equal(d.dependentCare.elect, 7500); assert.equal(d.dependentCare.typed, 9000); assert.deepEqual(d.dependentCare.kids, ["Cy"]);
  assert.equal(d.commuter.transit, 340); assert.equal(d.commuter.parking, 100); assert.equal(d.commuter.typed.transit, 400);
  const t = ti();
  const T = { inputs: t.inputs, params: t.params, personPay: 101400, wageBase: 184500, stateRate: 0 };
  near(d.fsa.saved, taxSaved(3400, T).total); near(d.dependentCare.saved, taxSaved(7500, T).total); near(d.commuter.saved, taxSaved(440 * 12, T).total);
  const shared = compute(withBenefits({ dcfsaElect: 7500 }, { "p-bo": { dcfsaElect: 5000 } }), { today: TODAY }).dependentCare;
  assert.equal(shared.others, 5000); assert.equal(shared.elect, 2500, "the household's $7,500 less Bo's $5,000");
  const sep = withBenefits({ dcfsaElect: 9000 }, {}, (q) => { q.household.filingStatus = "married_separate"; });
  assert.equal(compute(sep, { today: TODAY }).dependentCare.elect, 3750);
});

test("the stock purchase plan: at most 15% off; 15% off is 17.6% on the money, taxed as pay when sold at once; the state too", () => {
  const d = compute(withBenefits({ esppOffered: true, esppPct: 0.1 }), { today: TODAY });
  const e = d.espp;
  near(e.yearly, 10140); near(e.gain, 10140 * (1 / 0.85 - 1)); near(e.cap, ESPP.yearlyStock * 0.85); near(e.perCheck, 390);
  const t = ti();
  near(e.taxOnGain, federalTax({ ...t.inputs, otherOrdinary: t.inputs.otherOrdinary + e.gain }, t.params).totalTax - federalTax(t.inputs, t.params).totalTax);
  near(e.taxOnGain, e.gain * 0.22, 0.01); near(e.afterTax, e.gain - e.taxOnGain);
  assert.equal(compute(withBenefits({ esppOffered: true, esppPct: 0.1, esppDiscount: 0.2 }), { today: TODAY }).espp.discount, 0.15);
  const big = compute(withBenefits({ esppOffered: true, esppPct: 0.25 }), { today: TODAY }).espp;
  assert.equal(big.capped, true); near(big.yearly, 21250);
  const st = compute(withBenefits({ esppOffered: true, esppPct: 0.1 }, {}, (q) => { q.taxes.state = { rate: 0.05 }; }), { today: TODAY }).espp;
  near(st.taxOnGain - e.taxOnGain, st.gain * 0.05, 1e-6);
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).espp, null);
});

test("life cover through work: the yearly taxable cost and the tax on it, Social Security only under the wage base", () => {
  const d = compute(withBenefits({ lifeCover: 200000 }), { today: TODAY });
  near(d.life.imputed, 150 * 0.09 * 12);   // Ana is 37 in 2027
  const t = ti();
  near(d.life.tax, fedOnly(federalTax({ ...t.inputs, wages: t.inputs.wages + 162 }, t.params)) - fedOnly(federalTax(t.inputs, t.params)) + 162 * 0.0765);
  const rich = compute(withBenefits({ lifeCover: 500000 }, {}, (q) => { q.income.find((x) => x.id === "i-ana").amount = 250000 / 26; q.taxes.state = { rate: 0.05 }; }), { today: TODAY }).life;
  const tr = taxInputs(withBenefits({}, {}, (q) => { q.income.find((x) => x.id === "i-ana").amount = 250000 / 26; }), { today: TODAY });
  near(rich.imputed, 450 * 0.09 * 12);
  near(rich.tax, fedOnly(federalTax({ ...tr.inputs, wages: tr.inputs.wages + 486 }, tr.params)) - fedOnly(federalTax(tr.inputs, tr.params)) + 486 * (0.0145 + 0.05), 1e-6);
  assert.equal(compute(withBenefits({ lifeCover: 50000 }), { today: TODAY }).life, null);
});

test("the paycheck: the 401(k) first, then the cafeteria choices together (near the wage base they save more together)", () => {
  const d = compute(withBenefits({ hsaEligible: true, hsaElect: 2000, fsaElect: 500, esppOffered: true, esppPct: 0.05 }), { today: TODAY });
  near(d.total.pretaxYearly, 12220 + 2000 + 500);
  near(d.total.perCheck, (d.total.pretaxYearly - d.total.savedYearly + d.espp.yearly) / 26);
  const t = ti();
  // the cafeteria part, worked on the wages the 401(k) leaves: 22% income tax and 7.65% payroll on the $2,500
  near(d.total.savedYearly - d.k401.options.find((o) => o.key === "now").saved, 2500 * (0.22 + 0.0765), 0.01);
  const near190 = withBenefits({ hsaEligible: true, hsaCoverage: "family", hsaElect: 8750, dcfsaElect: 7500 }, {}, (q) => { q.income.find((x) => x.id === "i-ana").amount = 190000 / 26; });
  const n = compute(near190, { today: TODAY });
  assert.ok(n.total.savedYearly - n.k401.options.find((o) => o.key === "now").saved > n.hsa.saved + n.dependentCare.saved, "together they reach under the wage base");
});

test("paychecks: from weekly, twice-a-month or monthly pay; a yearly figure assumes 26 and says so", () => {
  const per = (period, amount) => compute(withBenefits({}, {}, (q) => { Object.assign(q.income.find((x) => x.id === "i-ana"), { period, amount }); }), { today: TODAY });
  assert.equal(per("weekly", 1950).paychecks, 52); assert.equal(per("semimonthly", 4225).paychecks, 24);
  const y = per("annual", 101400);
  assert.equal(y.paychecks, 26); assert.ok(y.notes.some((n) => /yearly figure/.test(n)));
  assert.equal(compute(withBenefits({ paychecks: 24 }, {}, (q) => { q.income.find((x) => x.id === "i-ana").period = "annual"; }), { today: TODAY }).paychecks, 24);
});

test("whose benefits: someone with pay; a choice without pay falls back; not ready without pay or with pay linked to nobody", () => {
  const bo = compute(withBenefits({}, { personId: "p-bo" }), { today: TODAY });
  assert.equal(bo.person.id, "p-bo"); assert.equal(bo.paychecks, 12); assert.equal(bo.k401.hasAccount, false);
  assert.deepEqual(bo.k401.options.map((o) => o.key), ["match", "max"], "nothing goes in now: no 'now' choice");
  const noPayBo = withBenefits({}, { personId: "p-bo" }, (q) => { q.income = q.income.filter((x) => x.id !== "i-bo"); });
  const f = compute(noPayBo, { today: TODAY });
  assert.equal(f.ready, true); assert.equal(f.person.id, "p-ana"); assert.deepEqual(f.people.map((x) => x.id), ["p-ana"]);
  assert.equal(compute(emptyPlan(), { today: TODAY }).why, "no-pay");
  const unlinked = emptyPlan(); unlinked.income = [{ id: "x", name: "Pay", type: "salary", personId: "", amount: 4000, period: "biweekly" }];
  const u = compute(unlinked, { today: TODAY });
  assert.equal(u.ready, false); assert.equal(u.why, "no-person");
  const zero = withBenefits({}, {}, (q) => { q.income = q.income.filter((x) => x.id !== "i-bo"); q.income.find((x) => x.id === "i-ana").amount = 0; });
  assert.equal(compute(zero, { today: TODAY }).ready, false);
});
