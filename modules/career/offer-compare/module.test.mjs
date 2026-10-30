import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, matchFor, timeFor, taxYear, PAYROLL, DEFAULTS } from "./compute.js";
import { taxInputs, compute as computeFederal } from "../../taxes/federal/compute.js";
import { FEDERAL } from "../../taxes/federal/data/federal.js";
import { federalTax, paramsFor } from "../../../core/math/tax.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const OFFER = { id: "o1", name: "Big Co", salary: 118000, bonus: 10000, signOn: 15000, stockYearly: 12000, matchRate: 0.5, matchUpTo: 0.06, premium: 2400, commuteMinutes: 35, commuteCost: 14, officeDays: 3, movingCost: 3000 };
const withOffers = (offers, extra = {}) => { const p = familyPlan(TODAY); p.whatIfs = { offers: { offers, ...extra } }; return p; };
const fedOnly = (inputs, params, wages) => { const f = federalTax({ ...inputs, wages }, params); return f.totalTax - f.additionalMedicare; };

test("the employer's retirement money: an amount typed, else the match rate on pay up to the cap, within the legal limits", () => {
  near(matchFor({ salary: 100000, matchRate: 0.5, matchUpTo: 0.06 }), 3000);
  near(matchFor({ salary: 100000, matchRate: 1, matchUpTo: 0.04, matchYearly: 5000 }), 5000);
  assert.equal(matchFor({ salary: 100000 }), 0);
  // pay counts only to $360,000 (2026), and you can put in at most $24,500
  near(matchFor({ salary: 500000, matchRate: 0.5, matchUpTo: 0.06 }, { compLimit: 360000, deferralLimit: 24500 }), 0.5 * 0.06 * 360000);
  near(matchFor({ salary: 300000, matchRate: 1, matchUpTo: 0.1 }, { compLimit: 360000, deferralLimit: 24500 }), 24500);
});

test("the time a job takes: weeks worked, hours, the commute's hours and cost", () => {
  const t = timeFor({ ptoDays: 20, hoursWeek: 40, officeDays: 3, commuteMinutes: 30, commuteCost: 10 });
  assert.equal(t.weeks, 48); assert.equal(t.work, 1920); assert.equal(t.commuteDays, 144);
  near(t.commuteHours, 144); near(t.commuteCost, 1440);
  assert.equal(timeFor({ hoursWeek: 40, officeDays: 9 }).commuteDays, 7 * 52);
});

test("a year's tax: federal income tax by the engine, payroll to the wage base, the 0.9% on Medicare wages, the state", () => {
  const ti = taxInputs(familyPlan(TODAY), { today: TODAY });
  const T = { inputs: ti.inputs, params: ti.params, otherWages: 50000, wageBase: 184500, stateRate: 0.04 };
  const a = taxYear(100000, T);
  near(a.federal, fedOnly(ti.inputs, ti.params, 150000));
  near(a.payroll, 100000 * 0.0765); near(a.state, 4000); assert.equal(a.extraMedicare, 0);
  near(taxYear(200000, T).payroll, 184500 * PAYROLL.ss + 200000 * PAYROLL.medicare);
  const c = taxYear(100000, { ...T, otherMedicare: 180000 });
  near(c.extraMedicare, PAYROLL.extraMedicare * 30000); near(c.payroll, 100000 * 0.0765 + PAYROLL.extraMedicare * 30000);
  near(taxYear(1000, { ...T, otherWages: -5000 }).federal, fedOnly(ti.inputs, ti.params, 0), 1e-9);
});

test("the family: Ana's job now from the plan, against an offer, by hand", () => {
  const p = withOffers([OFFER]);
  const d = compute(p, { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.person.id, "p-ana"); assert.equal(d.years, DEFAULTS.years); assert.equal(d.hasJob, true);
  const ti = taxInputs(p, { today: TODAY });
  const other = ti.inputs.wages - 101400;
  const [now, big] = d.options;
  assert.equal(now.current, true); assert.equal(now.yearly.salary, 101400); assert.equal(now.yearly.match, 3050, "the plan's employer match");
  near(now.tax.federal, fedOnly(ti.inputs, ti.params, other + 101400) - fedOnly(ti.inputs, ti.params, other));
  near(now.tax.payroll, 101400 * 0.0765); assert.equal(now.tax.state, 0, "Texas");
  near(big.yearly.match, 3540); near(big.yearly.total, 118000 + 10000 + 12000 + 3540 - 2400);
  const wages1 = 118000 + 10000 + 12000 + 15000 - 2400;
  near(big.tax.federal, fedOnly(ti.inputs, ti.params, other + wages1) - fedOnly(ti.inputs, ti.params, other));
  near(big.tax.payroll, wages1 * 0.0765);
  near(big.afterTax, big.yearly.total + 15000 - big.tax.total - 3000);
  // later years: salary, bonus and match rise with Ana's 3% raise, each taxed with its own year's tables and wage base
  const g = (t) => 1.03 ** t;
  near(big.rows[2].gross, (128000 + 3540) * g(2) + 12000 - 2400, 1e-6);
  const P2 = paramsFor(FEDERAL, 2028, { inflation: 0.03 });
  const w2 = 128000 * g(2) + 12000 - 2400;
  near(big.rows[2].tax, fedOnly(ti.inputs, P2, other + w2) - fedOnly(ti.inputs, P2, other) + w2 * 0.0765, 1e-6);
  const weeks = 52 - DEFAULTS.ptoDays / 5;   // 19 days off: 48.2 weeks
  near(big.overYears.commute, 3 * weeks * 14 * 4);
  near(big.overYears.net, big.rows.reduce((s, r) => s + r.afterTax, 0) - big.overYears.commute);
  near(big.perHour, (big.steadyAfterTax - 3 * weeks * 14) / (40 * weeks + 3 * weeks * 70 / 60));
  assert.equal(d.best, "o1"); assert.equal(d.runnerUp, "current"); assert.equal(big.rank, 1); near(big.vsCurrent, big.overYears.net - now.overYears.net);
});

test("a single earner keeps the 401(k) deduction: the job now's federal tax is the Federal page's", () => {
  const p = withOffers([OFFER]);
  p.household.people = p.household.people.filter((x) => x.id !== "p-bo"); p.household.filingStatus = "single";
  p.income = p.income.filter((x) => x.personId !== "p-bo");
  const d = compute(p, { today: TODAY });
  const fed = computeFederal(p, { today: TODAY }).result;
  const ti = taxInputs(p, { today: TODAY });
  near(d.options[0].tax.federal, fed.totalTax - fed.additionalMedicare - fedOnly(ti.inputs, ti.params, 0), 1e-6);
  assert.ok(ti.inputs.wages < 101400, "the plan's wages are after Ana's 401(k) saving");
});

test("the Social Security wage base of each year compared", () => {
  const d = compute(withOffers([{ id: "hi", name: "High", salary: 190000, raise: 0.03 }]), { today: TODAY });
  const hi = d.options[1];
  // year one: 6.2% stops at 2026's $184,500; year two: at 2027's $192,300 (SSA); with Bo's $62,400 the couple passes $250,000
  near(hi.rows[0].tx.payroll, 184500 * PAYROLL.ss + 190000 * PAYROLL.medicare + PAYROLL.extraMedicare * (190000 + 62400 - 250000));
  near(hi.rows[1].tx.payroll, 192300 * PAYROLL.ss + 195700 * PAYROLL.medicare + PAYROLL.extraMedicare * (195700 + 62400 - 250000), 1e-6);
});

test("the household's 0.9% extra Medicare tax: only the part this job adds", () => {
  const p = withOffers([]); p.income.find((x) => x.id === "i-bo").amount = 25000;   // Bo at $300,000
  const now = compute(p, { today: TODAY }).options[0];
  near(now.tax.payroll, 101400 * (0.0765 + PAYROLL.extraMedicare));
});

test("if the stock halved: offers at half their stock; options at the employer lose their whole spread", () => {
  const d = compute(withOffers([OFFER]), { today: TODAY });
  const half = compute(withOffers([{ ...OFFER, stockYearly: 6000 }]), { today: TODAY }).options[1];
  near(d.options[1].ifStockHalves, half.overYears.net, 1e-6);
  near(d.options[1].stockYears, 48000); near(d.options[1].stockShare, 48000 / d.options[1].overYears.gross);
  const p = withOffers([OFFER]);
  p.equity = { symbol: "ACME", price: 50, priceAsOf: TODAY, personId: "p-ana", grants: [{ id: "o", kind: "option", name: "Options", granted: "2025-01-15", vestStart: "2025-01-15", shares: 4800, strike: 40, vestMonths: 48, cliffMonths: 12, every: 3 }] };
  const e = compute(p, { today: TODAY });
  const flat = compute(withOffers([OFFER]), { today: TODAY }).options[0];
  near(e.options[0].stockYears, 2700 * 10, 1e-9);
  near(e.options[0].ifStockHalves, flat.overYears.net, 1e-6);   // at $25 the options are worth nothing
  assert.ok(e.notes.some((n) => /Stock options/.test(n)));
});

test("the current employer's grants: the vests of each year ahead, and what leaving gives up", () => {
  const p = withOffers([OFFER]);
  p.equity = { symbol: "ACME", price: 50, priceAsOf: TODAY, personId: "p-ana", grants: [{ id: "g", kind: "rsu", name: "New hire", granted: "2025-01-15", vestStart: "2025-01-15", shares: 4800, vestMonths: 48, cliffMonths: 12, every: 3 }] };
  const d = compute(p, { today: TODAY });
  // vested: 1,200 at the cliff (2026-01), then 300 each quarter (2026-04, 2026-07, 2026-10): 2,100; 2,700 to go
  near(d.forfeit, 2700 * 50);
  const now = d.options[0];
  near(now.yearly.stock, 4 * 300 * 50, 1e-9);
  near(now.stockYears, 2700 * 50, 1e-9);   // all of it vests within the four years compared
});

test("no job now: nothing but what is typed, no hours, no hourly figure", () => {
  const p = familyPlan(TODAY);
  p.income = p.income.filter((x) => x.id !== "i-ana");
  p.taxes.hsa = { employer: 1000 };
  p.whatIfs = { offers: { personId: "p-ana", offers: [OFFER] } };
  const d = compute(p, { today: TODAY });
  const now = d.options[0];
  assert.equal(d.hasJob, false); assert.equal(now.name, "No job now");
  assert.equal(now.yearly.total, 0); assert.equal(now.yearly.match, 0); assert.equal(now.yearly.hsa, 0);
  assert.equal(now.time.work, 0); assert.equal(now.perHour, null);
  assert.equal(d.options[1].inputs.hoursWeek, DEFAULTS.hoursWeek);
});

test("typed figures for the job now win; whose job; offers take the job now's blanks; a state rate per job; not ready", () => {
  const p = withOffers([{ ...OFFER, stateRate: 0.05 }], { personId: "p-bo", years: 2, current: { salary: 70000, matchYearly: 1000, ptoDays: 25, hoursWeek: 45 } });
  p.taxes.hsa = { employer: 1000 };
  const d = compute(p, { today: TODAY });
  assert.equal(d.person.id, "p-bo"); assert.equal(d.years, 2);
  assert.equal(d.options[0].yearly.salary, 70000); assert.equal(d.options[0].yearly.match, 1000);
  assert.equal(d.options[0].yearly.hsa, 0, "the household's HSA money is not Bo's job's");
  assert.equal(d.options[0].time.weeks, 47);
  assert.equal(d.options[1].inputs.ptoDays, 25); assert.equal(d.options[1].inputs.hoursWeek, 45);
  near(d.options[1].tax.state, (118000 + 10000 + 12000 + 15000 - 2400) * 0.05);
  assert.equal(d.options[1].rows.length, 2);
  assert.equal(compute(withOffers([]), { today: TODAY }).options[0].yearly.hsa, 0, "no HSA money on file");
  const self = withOffers([]); self.taxes.hsa = { employer: 1000 };
  assert.equal(compute(self, { today: TODAY }).options[0].yearly.hsa, 1000, "Ana is the plan's own: the HSA money is hers");
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});
