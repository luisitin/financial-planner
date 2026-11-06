import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, matchAt, fullMatchAt, matchDollars, limit401k, groupLifeImputed, taxSaved, PAYROLL, DEFAULT_TIERS, paycheckChange } from "./compute.js";
import { compute as computePaycheck } from "../../cashflow/paycheck/compute.js";
import { BENEFITS, GROUP_LIFE, ESPP, ROTH_CATCHUP_FROM } from "./data/benefits.js";
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
  // Ana and Bo are in the 22% bracket, and in the child care credit's phase-down: 2,000 less income takes their AGI from
  // 158,780 to 156,780, so the credit on Cy's care goes from 32% to 33% of 3,000 (one point per 4,000 over 150,000): +30
  near(a.federal, 2000 * 0.22 + 30, 0.01, "Ana and Bo are in the 22% bracket");
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
  assert.ok(d.notes.some((n) => /2027 limits for the 401\(k\).* are not in the app yet/.test(n) && /health savings account's 2027 limits are in/.test(n)));
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
  // 22%, and the child care credit: AGI 171,000 before any 401(k) (29% of 3,000) falls to 146,500 (35%): 6 points, +180
  near(max.saved, 24500 * 0.22 + 180, 0.01);
  near(max.cost, 24500 - max.saved);
  // what a paycheck loses is the Paycheck page's own figure (care fourth pass: one take-home figure for a 401(k) choice, the
  // same as "taken from each paycheck"); the year's cost after the tax it saves stays max.cost
  assert.equal(max.costFrom, "paycheck"); assert.ok(max.costPerCheck > 0 && max.costPerCheck < max.perCheck);
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

test("no Roth catch-up rule before 2026 (Notice 2023-62's transition)", () => {
  const q = familyPlan(TODAY);
  q.household.people.find((x) => x.id === "p-ana").birthDate = "1970-01-01";
  q.income.find((x) => x.id === "i-ana").amount = 6500;   // 169,000 a year
  q.whatIfs = { ...(q.whatIfs ?? {}), benefits: { "p-ana": { planYear: 2025 } } };
  const k = compute(q, { today: "2025-11-01" }).k401;
  assert.ok(k.catchUp > 0, "50 or older"); assert.ok(169000 > BENEFITS[2025].rothCatchUpWages);
  assert.equal(k.rothCatchUp, false); assert.equal(k.options.find((o) => o.key === "max").roth, 0, "all of it pre-tax in 2025");
  assert.equal(ROTH_CATCHUP_FROM, 2026);
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
  const d = compute(withBenefits({ hsaEligible: true, hsaCoverage: "family", hsaEmployer: 1000, hsaElect: 9500 }), { today: TODAY });
  const h = d.hsa;
  // 2027, the plan year in October: Rev. Proc. 2026-24's $9,000 family limit, before the rest of 2027's limits are out
  assert.equal(h.limit, 9000); assert.equal(h.room, 8000); assert.equal(h.elect, 8000); assert.equal(h.typed, 9500);
  const t = ti();
  near(h.saved, fedOnly(federalTax(t.inputs, t.params)) - fedOnly(federalTax({ ...t.inputs, wages: t.inputs.wages - 8000 }, t.params)) + 8000 * 0.0765);
  near(h.maxSaved, h.saved, 1e-9);
  assert.equal(h.stateTaxed, false);
  const older = compute(withBenefits({ hsaEligible: true, hsaCoverage: "self" }, {}, (q) => { q.household.people.find((x) => x.id === "p-ana").birthDate = "1972-01-01"; }), { today: TODAY }).hsa;
  assert.equal(older.limit, 4500 + 1000, "55 in the plan year");
  const spring = compute(withBenefits({ hsaEligible: true, hsaCoverage: "family" }), { today: SPRING }).hsa;
  assert.equal(spring.limit, 8750, "2026 chosen in the spring: Rev. Proc. 2025-19");
  const ca = withBenefits({ hsaEligible: true, hsaCoverage: "self", hsaElect: 1000 }, {}, (q) => { q.household.state = "CA"; q.taxes.state = { rate: 0.06 }; });
  const c = compute(ca, { today: TODAY }).hsa;
  assert.equal(c.limit, 4500); assert.equal(c.stateTaxed, true);
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
  near(d.fsa.saved, taxSaved(3400, T).total); near(d.commuter.saved, taxSaved(440 * 12, T).total);
  // the child care account, for the plan year 2027 (October): the family's care in 2027 is the after-school care, 450 x 12 =
  // 5,400 (the daycare ended in August 2026). Without the account the credit is 32% of 3,000 = 960 (AGI 158,780); with it
  // 5,400 stays out of income, the other 2,100 is lost (it pays back only care), and the credit is gone. Federal: 22% of
  // the 7,500 off wages less the 960; payroll 7.65% of 7,500; less the 2,100 lost: 1,650 - 960 + 573.75 - 2,100 = -836.25
  const dc = d.dependentCare;
  near(dc.care, 5400); near(dc.forfeited, 2100); near(dc.excluded, 5400); near(dc.creditLost, 960, 1e-6);
  near(dc.federal, 1650 - 960, 0.01); near(dc.payroll, 573.75, 1e-6); near(dc.saved, 1650 - 960 + 573.75 - 2100, 0.01);
  // each employee's own account up to a plan's 7,500; Bo's 5,000 counted once in the household (the shared limit and care)
  const shared = compute(withBenefits({ dcfsaElect: 7500 }, { "p-bo": { dcfsaElect: 5000 } }), { today: TODAY }).dependentCare;
  assert.equal(shared.others, 5000); assert.equal(shared.elect, 7500, "a plan's own limit; the household's is the tax's");
  // with Bo's 5,000 already paying 5,000 of the household's 5,400 of 2027 care, Ana's 7,500 can pay back only 400 more:
  // 7,100 more is lost (12,500 elected against 5,400 of care, where Bo's alone lost nothing)
  near(shared.forfeited, 7100, 0.01); near(shared.excluded, 400, 0.01);
  // a separate return: a plan takes 7,500; each return keeps 3,750 out of income
  const sep = compute(withBenefits({ dcfsaElect: 9000 }, {}, (q) => { q.household.filingStatus = "married_separate"; }), { today: TODAY }).dependentCare;
  assert.equal(sep.elect, 7500); assert.equal(sep.limit, 3750); assert.equal(sep.separate, true);
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
  // taken from each paycheck: the Paycheck page's own take-home with the choices against without them (and no 401(k))
  assert.equal(d.total.perCheckFrom, "paycheck");
  const pc = paycheckChange(withBenefits({ hsaEligible: true, hsaElect: 2000, fsaElect: 500, esppOffered: true, esppPct: 0.05 }), { today: TODAY, person: { id: "p-ana" }, paychecks: 26, filingStatus: "married_joint", taxYear: 2026, yearly: { hsa: 2000, fsa: 500, dcfsa: 0, commuter: 0, espp: d.espp.yearly } });
  near(d.total.perCheck, pc.all); assert.ok(d.total.perCheck > 0);
  const t = ti();
  // the cafeteria part, worked on the wages the 401(k) leaves: 22% income tax and 7.65% payroll on the $2,500, and the
  // child care credit one point higher (AGI 158,780 -> 156,280: from 32% to 33% of 3,000, +30)
  near(d.total.savedYearly - d.k401.options.find((o) => o.key === "now").saved, 2500 * (0.22 + 0.0765) + 30, 0.01);
  const near190 = withBenefits({ hsaEligible: true, hsaCoverage: "family", hsaElect: 8750, fsaElect: 3400 }, {}, (q) => { q.income.find((x) => x.id === "i-ana").amount = 190000 / 26; });
  const n = compute(near190, { today: TODAY });
  assert.ok(n.total.savedYearly - n.k401.options.find((o) => o.key === "now").saved > n.hsa.saved + n.fsa.saved + 1, "together they reach under the wage base");
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

test("the child care account's saving counts the child care credit it costs (the research spec's example B)", () => {
  // Jo: head of household, 62,000, one child of 4, 900 a month of daycare, Texas. 5,000 in the account saves 12% income tax
  // and 7.65% payroll tax on it (982.50) but its money comes off the credit's 3,000 limit (IRC 21(c)): the 1,050 credit
  // (35% of 3,000) is lost. Net -67.50: for Jo the credit alone is better, and the page says so
  const p = emptyPlan();
  p.household.filingStatus = "head_of_household"; p.household.state = "TX";
  p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: 62000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "care", name: "Daycare", category: "childcare", amount: 900, period: "monthly" }];
  p.whatIfs = { benefits: { jo: { dcfsaElect: 5000 } } };
  const dc = compute(p, { today: "2026-11-02" }).dependentCare;
  near(dc.creditLost, 1050, 1e-6); near(dc.savedBeforeCredit, 5000 * (0.12 + PAYROLL.ss + PAYROLL.medicare), 1e-6);
  near(dc.saved, 5000 * (0.12 + PAYROLL.ss + PAYROLL.medicare) - 1050, 1e-6);
  // 2,000 in the account: 1,000 of the limit is left and 35% of it stays (350), so 700 of credit is lost
  p.whatIfs.benefits.jo.dcfsaElect = 2000;
  near(compute(p, { today: "2026-11-02" }).dependentCare.creditLost, 700, 1e-6);
});

// --- the child care account's real worth (the Federal estimate's one rule, with and without the election) ------------------
const NOV = "2026-11-02";
/** Jo: head of household in Ohio, 62,000 of pay, a child born 2022-07-15, 900 a month of daycare (the single parent). */
function jo(fn) {
  const p = emptyPlan();
  p.household.filingStatus = "head_of_household"; p.household.state = "OH";
  p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: 62000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "care", name: "Daycare", category: "childcare", amount: 900, period: "monthly" }];
  if (fn) fn(p);
  return p;
}
const joAcct = (amount, fn) => jo((p) => { p.whatIfs = { benefits: { jo: { dcfsaElect: amount, planYear: 2026 } } }; if (fn) fn(p); });

test("child care account: Jo's 5,000 for 2026 saves 70 (-450 + 382.50 + 137.50), and the paycheck falls by the Paycheck page's own change", () => {
  const d = compute(joAcct(5000), { today: NOV });
  const dc = d.dependentCare;
  // federal: 12% of 5,000 = 600 saved, the 1,050 credit lost: -450; payroll 7.65%: 382.50; Ohio's 2.75%: 137.50
  near(dc.federal, -450, 1e-6); near(dc.payroll, 382.5, 1e-6); near(dc.state, 137.5, 1e-6); near(dc.saved, 70, 1e-6); near(dc.creditLost, 1050, 1e-6);
  assert.equal(dc.forfeited, 0); assert.equal(dc.excluded, 5000); assert.equal(dc.taxedAsPay, 0);
  // each paycheck: the Paycheck page's take-home without the account less with it (2,003.09 - 1,853.86), not 5,000 less the
  // year's saving over 26 (the reviewer's page #2: 190 said, 149 true); the credit lost shows in the refund instead
  const pcWith = computePaycheck(joAcct(5000), { today: NOV }).people[0], pcWithout = computePaycheck(jo(), { today: NOV }).people[0];
  near(dc.perCheck, pcWithout.net - pcWith.net, 0.005); near(dc.perCheck, 149.23, 0.005);
  near(d.total.perCheck, 149.23, 0.005); assert.equal(d.total.perCheckFrom, "paycheck"); near(d.total.savedYearly, 70, 1e-6);
  // with no plan year the account is 2027's (October): the same worth, worked for 2027
  const later = compute(jo((p) => { p.whatIfs = { benefits: { jo: { dcfsaElect: 5000 } } }; }), { today: NOV }).dependentCare;
  near(later.saved, 70, 1e-6); near(later.perCheck, 149.23, 0.005);
});

test("child care account: 2,000 costs 252 a year more than it saves; no care loses it all; 1,800 of care loses 3,200", () => {
  // 2,000: 12% = 240 saved, the credit falls 1,050 -> 350 (700 lost): -460; payroll 153; Ohio 55: -252 (never a negative "saved")
  const two = compute(joAcct(2000), { today: NOV }).dependentCare;
  near(two.federal, -460, 1e-6); near(two.saved, -252, 1e-6); near(two.creditLost, 700, 1e-6);
  // no care on Expenses: all 5,000 is lost (Form 2441 line 14). The tax falls (600 + 382.50 + 137.50) but the money is gone
  const none = compute(joAcct(5000, (p) => { p.expenses = []; }), { today: NOV }).dependentCare;
  near(none.forfeited, 5000); near(none.saved, 600 + 382.5 + 137.5 - 5000, 1e-6); assert.equal(none.creditLost, 0);
  // 150 a month (1,800 of care): 1,800 stays out, 3,200 is lost; the credit without the account is 35% of 1,800 = 630, with
  // it none: federal 600 - 630 = -30; payroll 382.50 and Ohio 137.50 on the 5,000 out of pay; less the 3,200: -2,710
  const small = compute(joAcct(5000, (p) => { p.expenses[0].amount = 150; }), { today: NOV }).dependentCare;
  near(small.care, 1800); near(small.forfeited, 3200); near(small.excluded, 1800); near(small.creditLost, 630, 1e-6);
  near(small.federal, -30, 1e-6); near(small.saved, -30 + 382.5 + 137.5 - 3200, 1e-6);
});

test("child care account: the family's two accounts are counted once (Ana 5,000, Bo 2,500), and a spouse with no pay", () => {
  const fam = (b, fn) => { const p = familyPlan(NOV); p.whatIfs = { benefits: b }; if (fn) fn(p); return p; };
  // Ana alone: federal 22% of 5,000 = 1,100 less the 960 credit (32% of 3,000 at AGI 158,780): 140; payroll 382.50: 522.50
  const ana = compute(fam({ "p-ana": { dcfsaElect: 5000, planYear: 2026 } }), { today: NOV }).dependentCare;
  near(ana.federal, 140, 1e-6); near(ana.saved, 522.5, 1e-6); near(ana.creditLost, 960, 1e-6);
  // Bo's 2,500 with Ana's 5,000: the credit is already gone, so it costs none: 550 + 191.25 = 741.25 (the app said "costs 54")
  const bo = compute(fam({ personId: "p-bo", "p-ana": { dcfsaElect: 5000, planYear: 2026 }, "p-bo": { dcfsaElect: 2500, planYear: 2026 } }), { today: NOV }).dependentCare;
  near(bo.creditLost, 0, 1e-6); near(bo.federal, 550, 1e-6); near(bo.payroll, 191.25, 1e-6); near(bo.saved, 741.25, 1e-6); assert.equal(bo.others, 5000);
  // Ana's 5,000 with Bo's 2,500: without hers the credit is 33% of 500 = 165 (AGI 156,280), with it none: 1,100 - 165 = 935
  const anaB = compute(fam({ "p-ana": { dcfsaElect: 5000, planYear: 2026 }, "p-bo": { dcfsaElect: 2500, planYear: 2026 } }), { today: NOV }).dependentCare;
  near(anaB.creditLost, 165, 1e-6); near(anaB.federal, 935, 1e-6);
  // the two pages' credit lost add up to what the plan loses (165, not 1,845 of a 960 credit)
  near(anaB.creditLost + bo.creditLost, 165, 1e-6);
  // Bo with no pay and no business: none of Ana's account stays out of income (129(b)(1)(B)); it saves nothing at all
  const noPay = compute(fam({ "p-ana": { dcfsaElect: 5000, planYear: 2026 } }, (p) => { p.income = p.income.filter((x) => x.personId !== "p-bo"); }), { today: NOV }).dependentCare;
  // the whole election still leaves Social Security and Medicare wages (3121(a)(18); care fourth pass): 7.65% of 5,000
  near(noPay.federal, 0, 1e-6); near(noPay.payroll, 382.5, 1e-6); near(noPay.saved, 382.5, 1e-6); near(noPay.taxedAsPay, 5000); assert.equal(noPay.earnedCapped, true);
  // filing separately, 3,750 each: each return keeps its own 3,750 out (the app showed 0 for both)
  const mfs = compute(fam({ "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } }, (p) => { p.household.filingStatus = "married_separate"; }), { today: NOV }).dependentCare;
  assert.equal(mfs.elect, 3750); assert.equal(mfs.excluded, 3750); assert.equal(mfs.taxedAsPay, 0); near(mfs.payroll, 3750 * 0.0765, 1e-6);
  assert.ok(mfs.federal > 0);
});

// --- care fourth pass (2026-11-02) ------------------------------------------------------------------------------------------
/** The page's text with a stand-in for the UI kit. */
async function pageText(plan, today = NOV) {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, querySelector() { return null; }, scrollIntoView() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form") };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update() {} } });
  // the paragraphs, each on its own, so a test can tell which paragraph a sentence is in
  const paras = [];
  const walk = (x) => { if (typeof x !== "object") return; if (x.tag === "p") paras.push(x.textContent.replace(/\s+/g, " ")); for (const c of x.kids) walk(c); };
  walk(root);
  return { text: root.textContent.replace(/\s+/g, " "), paras };
}
const famAcct = (b, fn) => { const p = familyPlan(NOV); p.whatIfs = { benefits: b }; if (fn) fn(p); return p; };

test("care fourth pass: the whole election saves Social Security and Medicare (Ana 7,500 + Bo 7,500: 573.75), as the paycheck takes it", () => {
  // 15,000 elected, 11,000 of care: 4,000 lost, 7,500 out of income, 3,500 taxed as pay. Ana's 7,500 still leaves her
  // Social Security and Medicare wages, all of it (IRC 3121(a)(18)): 7.65% x 7,500 = 573.75 (the page said 306)
  const b = { "p-ana": { dcfsaElect: 7500, planYear: 2026 }, "p-bo": { dcfsaElect: 7500, planYear: 2026 } };
  const d = compute(famAcct(b), { today: NOV }).dependentCare;
  near(d.payroll, 573.75, 1e-6); near(d.saved, -2546.25, 1e-6);
  // the Paycheck page takes Social Security and Medicare on 101,400 - 7,500 for her
  const pc = computePaycheck(famAcct(b), { today: NOV }).people.find((x) => x.id === "p-ana");
  near(pc.wages.fica * pc.paychecks, 101400 - 7500, 0.01);
  // Ana 5,000 + Bo 3,000: Ana saves 1,372.50 and Bo 779.50 (payroll on all 5,000 and 3,000; the page said 1,334 and 741)
  const both = { "p-ana": { dcfsaElect: 5000, planYear: 2026 }, "p-bo": { dcfsaElect: 3000, planYear: 2026 } };
  near(compute(famAcct(both), { today: NOV }).dependentCare.saved, 1372.5, 1e-6);
  near(compute(famAcct({ ...both, personId: "p-bo" }), { today: NOV }).dependentCare.saved, 779.5, 1e-6);
});

test("care fourth pass: the household's excess is each adult's own share, the split every page says (Ana 313, Bo 188 of 500)", async () => {
  const both = { "p-ana": { dcfsaElect: 5000, planYear: 2026 }, "p-bo": { dcfsaElect: 3000, planYear: 2026 } };
  const ana = compute(famAcct(both), { today: NOV }).dependentCare, bo = compute(famAcct({ ...both, personId: "p-bo" }), { today: NOV }).dependentCare;
  near(ana.own.taxedAsPay, 312.5, 1e-9); near(bo.own.taxedAsPay, 187.5, 1e-9); near(ana.householdTaxed, 500, 1e-9);
  // the two pages' shares add up to the household's 500, never 500 each
  near(ana.own.taxedAsPay + bo.own.taxedAsPay, 500, 1e-9);
  const ta = (await pageText(famAcct(both))).text, tb = (await pageText(famAcct({ ...both, personId: "p-bo" }))).text;
  assert.ok(ta.includes("$313 of the child care account is taxed as pay"), ta.match(/.{40}taxed as pay.{160}/)?.[0]);
  assert.ok(ta.includes("shared by what each puts in (Bo $188)"));
  assert.ok(tb.includes("$188 of the child care account is taxed as pay"));
  assert.ok(!ta.includes("$500 of it is taxed as pay") && !tb.includes("$500 of it is taxed as pay"));
  // the Paycheck page says the same split
  const notes = computePaycheck(famAcct(both), { today: NOV }).notes.join(" ");
  assert.ok(notes.includes("313 of it is over") && notes.includes("188 of it is over"), notes);
});

test("care fourth pass: Benefits' child care words are their own paragraph naming the account; separate returns say no credit", async () => {
  // Jo with 5,000: the sentences are not in the health FSA's paragraph, and each names the child care account
  const { paras } = await pageText(joAcct(5000));
  const fsa = paras.find((p) => p.startsWith("A health FSA is use-it-or-lose-it"));
  assert.ok(fsa && !/child care/i.test(fsa), fsa);
  const care = paras.find((p) => p.startsWith("The child care account pays day care"));
  assert.ok(care, paras.join(" || "));
  assert.ok(care.includes("The child care account costs $1,050 of child care credit"));
  assert.ok(care.includes("In all the child care account saves $70 a year, after the credit it costs."));
  assert.ok(!/\bof it:|\bIt costs\b/.test(care), care);
  // no care: "You would lose all $5,000 in the child care account"
  assert.ok((await pageText(joAcct(5000, (p) => { p.expenses = []; }))).text.includes("You would lose all $5,000 in the child care account"));
  // the family filing separately, no account chosen: no credit sentence (a separate return gets none), the row's limit is 3,750
  const mfs = famAcct({}, (p) => { p.household.filingStatus = "married_separate"; });
  const t = (await pageText(mfs)).text;
  assert.ok(!t.includes("can cost you some or all of the credit"), "no credit to cost on a separate return");
  assert.ok(t.includes("On a separate return there is no child care credit"));
  assert.ok(t.includes("Child care FSA, up to $3,750"), t.match(/Child care FSA.{30}/)?.[0]);
  // Bo's page, filing separately, with Ana's 5,000: Ana's account does not use up Bo's own 3,750
  const bo = famAcct({ personId: "p-bo", "p-ana": { dcfsaElect: 5000, planYear: 2026 }, "p-bo": { dcfsaElect: 3000, planYear: 2026 } }, (p) => { p.household.filingStatus = "married_separate"; });
  const tb = (await pageText(bo)).text;
  assert.ok(!tb.includes("already chosen by others"), tb.match(/.{60}already chosen by others.{20}/)?.[0]);
  assert.ok(tb.includes("on a separate return at most $3,750 of it stays out of income, on each spouse's own return"));
  const dcb = compute(bo, { today: NOV }).dependentCare;
  near(dcb.own.excluded, 3000, 1e-9); near(dcb.own.taxedAsPay, 0, 1e-9);
});

test("care fourth pass: the costs read the right way round; 'costs $252 a year more than it saves'; skipping only when no amount is worth it", async () => {
  // 1,800 of care with a 5,000 account: the 3,200 lost, less 490 of tax saved, is 2,710 (it said "more than the tax the
  // choices save, less the $3,200 ... would lose")
  const small = joAcct(5000, (p) => { p.expenses[0].amount = 150; });
  const ts = (await pageText(small)).text;
  assert.ok(ts.includes("Costs a year $2,710 the $3,200 the child care account would lose, less the $490 of tax the choices save"), ts.match(/Costs a year.{140}/)?.[0]);
  // 2,000: the row says what it costs more than; the credit alone beats 2,000, but 7,500 saves 630, so not "skip the account"
  const two = joAcct(2000);
  const t2 = (await pageText(two)).text;
  assert.ok(t2.includes("Child care FSA: $2,000 costs $252 a year more than it saves"), t2.match(/Child care FSA.{60}/)?.[0]);
  assert.ok(!t2.includes("think about skipping the account"));
  assert.ok(t2.includes("at $2,000 the credit alone is worth more, but $7,500 in the account would save $630 a year"));
  const best = compute(two, { today: NOV }).dependentCare.best;
  assert.deepEqual(best, { elect: 7500, saved: compute(joAcct(7500), { today: NOV }).dependentCare.saved });
  near(best.saved, 630, 1e-6);
  // two children: the credit's limit is 6,000, so every dollar up to it costs 35 cents of credit and saves 22.4 (12% + 7.65% +
  // Ohio's 2.75%): 2,000 costs 252, and even 7,500 costs 420 (-6,000 x 12.6% + 1,500 x 22.4%). Then, and only then, "think
  // about skipping the account"
  const kids2 = joAcct(2000, (p) => { p.household.people.push({ id: "kid2", name: "Lou", role: "dependent", birthDate: "2019-09-01" }); });
  const dk = compute(kids2, { today: NOV }).dependentCare;
  near(dk.saved, -252, 1e-6); near(dk.best.saved, -420, 1e-6); assert.equal(dk.best.elect, 7500);
  assert.ok((await pageText(kids2)).text.includes("for you the credit alone is worth more, so think about skipping the account"));
});

test("care fourth pass: one take-home figure for the same 401(k) (the row and 'taken from each paycheck')", () => {
  // the family, Ana's 12.1% now and nothing else chosen: the row said "takes $363 from take-home pay", the paycheck card $414
  const d = compute(familyPlan(NOV), { today: NOV });
  const now = d.k401.options.find((o) => o.key === "now");
  assert.equal(d.total.perCheckFrom, "paycheck"); assert.equal(now.costFrom, "paycheck");
  near(now.costPerCheck, d.total.perCheck, 1e-9);
  near(now.costPerCheck, 413.6, 0.01);
  // each choice from the Paycheck page: more in, more from take-home
  const [match, , max] = d.k401.options;
  assert.ok(match.costPerCheck < now.costPerCheck && now.costPerCheck < max.costPerCheck);
});

// --- Review 2026-11-06 -----------------------------------------------------------------------------------------------------
test("Review 2026-11-06: on a separate return the business owner's account saves what his own return says (Bo 862.19, not 1,047)", () => {
  // the family filing separately. Bo's return carries his photography at its profit, with half its self-employment tax and
  // its 20% deduction off (IRS Pub. 501; IRC 164(f), 199A): it sits in the 12% bracket. The page worked his return with the
  // business counted in full as ordinary income, across the 12%/22% line, so his account looked worth 760 of federal tax
  // where the Federal estimate and Budget move by 575.31
  const mfs = (b) => famAcct(b, (p) => { p.household.filingStatus = "married_separate"; });
  const each = { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } };
  const bo = compute(mfs({ ...each, personId: "p-bo" }), { today: NOV }).dependentCare;
  near(bo.federal, 575.31, 0.005); near(bo.payroll, 286.875, 1e-6); near(bo.saved, 862.19, 0.005);
  // Ana 5,000 + Bo 3,000: Bo's 3,000 saves 485.31 + 229.50 = 714.81 (the page said 890)
  const split = { "p-ana": { dcfsaElect: 5000, planYear: 2026 }, "p-bo": { dcfsaElect: 3000, planYear: 2026 } };
  const bo2 = compute(mfs({ ...split, personId: "p-bo" }), { today: NOV }).dependentCare;
  near(bo2.federal, 485.31, 0.005); near(bo2.saved, 714.81, 0.005);
  // the same as the Federal estimate's own tax with and without his election (Withholding check's yearTax: the business on
  // its owner's return)
  return Promise.all([import("../../taxes/federal/compute.js"), import("../../taxes/withholding/compute.js")]).then(([F, W]) => {
    const tax = (p) => W.yearTax(p, F.compute(p, { today: NOV }), { today: NOV }).total;
    near(tax(mfs({ ...each, "p-bo": { dcfsaElect: 0, planYear: 2026 } })) - tax(mfs(each)), bo.federal, 0.005);
    // Ana's figures do not move (her return has no business): 825 + 286.88
    const ana = compute(mfs(each), { today: NOV }).dependentCare;
    near(ana.federal, 825, 0.005); near(ana.saved, 1111.875, 0.005);
  });
});
