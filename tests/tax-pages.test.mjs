// tests/tax-pages.test.mjs -- the Phase 6 pages on the tax fixture (qa/fixtures/tax-plan.mjs:
// Sam and Lee filing jointly in 2026 with a child, a 401(k), an IRA, an HSA, two sales, a
// paycheck's withholding and last year's return), hand-checked against the 2026 tables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { taxPlan } from "../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../core/schema/migrate.js";
import { compute as federal, itemizedTotal, netGains } from "../modules/taxes/federal/compute.js";
import { compute as brackets } from "../modules/taxes/brackets/compute.js";
import { compute as gains } from "../modules/taxes/capital-gains/compute.js";
import { compute as withholding, paychecksLeft, safeHarbour } from "../modules/taxes/withholding/compute.js";
import { compute as estimated } from "../modules/taxes/estimated/compute.js";
import { compute as hsa } from "../modules/taxes/hsa-fsa/compute.js";
import { compute as taxProjection } from "../modules/taxes/projection/compute.js";
import { compute as withdrawalOrder } from "../modules/retirement/withdrawal-order/compute.js";
import { compute as roth } from "../modules/retirement/roth-conversions/compute.js";
import { compute as projection } from "../modules/retirement/projection/compute.js";
import { FEDERAL } from "../modules/taxes/federal/data/federal.js";

const TODAY = "2026-09-16";
const near = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("federal: the couple's 2026 return from the plan: 144,000 of wages after the 401(k), IRA and HSA off the top, gains netted, the child credit", () => {
  const d = federal(taxPlan(), { today: TODAY });
  assert.equal(d.year, 2026); assert.equal(d.filingStatus, "married_joint");
  assert.equal(d.inputs.wages, 144000); assert.equal(d.inputs.adjustments, 12000); assert.equal(d.inputs.qualifiedIncome, 3000); assert.equal(d.inputs.otherOrdinary, 0);
  assert.equal(d.people.dependentsUnder17, 1); assert.equal(d.people.ages65plus, 0);
  const r = d.result;
  assert.equal(r.agi, 135000); assert.equal(r.taxableIncome, 102800); assert.equal(r.ordinaryTaxable, 99800);
  near(r.ordinaryTax, 11480); near(r.qualifiedTax, 450); assert.equal(r.credits.childTaxCredit, 2200);
  near(r.totalTax, 9730); near(d.marginal, 0.12, 1e-9); assert.equal(r.bracketRate, 0.12); assert.equal(r.roomInBracket, 1000);
  near(r.balance, 9730 - 8000 - 300);
  assert.ok(d.sources.some((s) => s.key === "ira" && s.amount === -7000));
  assert.ok(d.sources.some((s) => s.key === "hsa" && s.amount === -5000));
  assert.ok(d.sources.some((s) => s.key === "longGains" && s.amount === 3000));
  assert.ok(d.steps.some((s) => s.label === "Child tax credit" && s.amount === -2200));
  assert.equal(d.isIndexed, false);
});

test("federal: typed figures replace the plan's; the year can be changed; an empty plan owes nothing", () => {
  const p = taxPlan();
  p.taxes.thisYear.wages = 100000; p.taxes.thisYear.qualifiedIncome = 5000; p.taxes.year = 2025;
  const d = federal(p, { today: TODAY });
  assert.equal(d.year, 2025); assert.equal(d.inputs.wages, 100000); assert.equal(d.inputs.qualifiedIncome, 8000);
  assert.ok(d.sources.find((s) => s.key === "wages").from === "typed");
  const e = federal(emptyPlan(), { today: TODAY });
  assert.equal(e.result.totalTax, 0); assert.equal(e.hasIncome, false); assert.ok(e.notes.length);
  const far = federal({ ...emptyPlan(), taxes: { ...emptyPlan().taxes, year: 2031 } }, { today: TODAY });
  assert.equal(far.isIndexed, true);
});

test("itemized deductions: the state-and-local cap, the medical floor; gains netting: short losses eat long gains, 3,000 of loss a year", () => {
  const P = FEDERAL[2026];
  const it = itemizedTotal({ mortgageInterest: 12000, propertyTax: 30000, stateTax: 20000, charitable: 2000, medical: 12000 }, 100000, "married_joint", P);
  assert.equal(it.saltCap, 40400); near(it.total, 12000 + 40400 + 2000 + (12000 - 7500));
  assert.ok(it.lines.find((l) => l.key === "salt").note.includes("capped"));
  const high = itemizedTotal({ propertyTax: 50000 }, 600000, "married_joint", P);   // 95,000 over 505,000 x 0.3 = 28,500 off the cap
  near(high.saltCap, 40400 - 28500);
  const g = netGains([{ proceeds: 30000, basis: 22000, held: "long" }, { proceeds: 4000, basis: 9000, held: "short" }], "married_joint");
  assert.equal(g.netLong, 3000); assert.equal(g.netShort, 0); assert.equal(g.netLoss, 0);
  const loss = netGains([{ proceeds: 1000, basis: 11000, held: "long" }], "single");
  assert.equal(loss.lossAllowed, -3000); assert.equal(loss.carryForward, -7000);
});

test("brackets: the ladder, the current rung, the slices above and what 10,000 more would cost", () => {
  const d = brackets(taxPlan(), { today: TODAY, extra: 10000 });
  assert.equal(d.ladder.length, 7); assert.equal(d.ladder.find((l) => l.current).rate, 0.12);
  assert.equal(d.ladder[0].filled, 24800); near(d.ladder[1].filled, 75000);
  assert.equal(d.above[0].rate, 0.12); assert.equal(d.above[0].amount, 1000); assert.equal(d.above[1].rate, 0.22); assert.equal(d.above[1].amount, 110600);
  near(d.extra.tax, 1000 * 0.12 + 9000 * 0.22); near(d.extra.rate, 0.21, 1e-9); assert.equal(d.extra.bracketRate, 0.22);
  assert.ok(brackets(emptyPlan(), { today: TODAY }).hasIncome === false);
});

test("capital gains: the sales add 450 of tax (3,000 net long-term at 15%); the 0% band is full; a low earner has room", () => {
  const d = gains(taxPlan(), { today: TODAY, extra: { amount: 10000, held: "long" } });
  assert.equal(d.hasSales, true); assert.equal(d.rows.length, 2);
  near(d.taxOnGains, 450); near(d.rateOnGains, 0.15, 1e-9); assert.equal(d.zeroRoom, 0);
  near(d.extra.tax, 1500); near(d.extra.rate, 0.15, 1e-9);
  const p = emptyPlan(); p.income.push({ id: "i", name: "Pay", type: "salary", amount: 2500, period: "monthly" });
  const low = gains(p, { today: TODAY });
  assert.equal(low.zeroRoom, 49450 - (30000 - 16100));
});

test("withholding: paychecks left in the year, the projected total, a refund and the W-4 suggestion", () => {
  assert.equal(paychecksLeft("biweekly", TODAY, 2026), 7); assert.equal(paychecksLeft("monthly", TODAY, 2026), 3); assert.equal(paychecksLeft("biweekly", TODAY, 2027), 26);
  const d = withholding(taxPlan(), { today: TODAY });
  assert.equal(d.withholding.people.length, 1); assert.equal(d.withholding.people[0].left, 7);
  near(d.withholding.projected, 8000 + 400 * 7); near(d.totalTax, 9730); near(d.balance, 9730 - 10800 - 300);
  assert.equal(d.verdict, "refund"); assert.equal(d.suggestion.kind, "cut"); assert.equal(d.suggestion.perPaycheck, Math.floor(1370 / 7));
  const p = taxPlan(); p.taxes.thisYear.withheld = 0; p.taxes.withholding.self.perPaycheck = 150; p.taxes.estimated.paid = [0, 0, 0, 0];
  const owe = withholding(p, { today: TODAY });
  near(owe.withholding.projected, 150 * 26); assert.equal(owe.verdict, "owe"); assert.equal(owe.suggestion.kind, "add"); assert.equal(owe.suggestion.perPaycheck, Math.ceil((9730 - 3900) / 7));
  assert.equal(owe.penaltyRisk, true);
  assert.equal(withholding(emptyPlan(), { today: TODAY }).verdict, "unknown");
});

test("estimated payments: the safe harbour, no instalments when withholding covers it, four instalments when it does not", () => {
  const h = safeHarbour(20000, 15000, 100000, "single"); assert.equal(h.required, 15000); assert.equal(h.basis, "last year");
  const h2 = safeHarbour(20000, 19000, 200000, "single"); near(h2.required, 18000); assert.equal(h2.basis, "this year");   // 110% of 19,000 is more than 90% of 20,000
  const d = estimated(taxPlan(), { today: TODAY });
  assert.equal(d.needsEstimates, false); near(d.harbour.required, 0.9 * 9730); assert.equal(d.nextDue, null); assert.equal(d.paid, 300);
  const p = taxPlan(); p.taxes.thisYear.withheld = 0; p.taxes.withholding = {};
  const e = estimated(p, { today: TODAY });
  assert.equal(e.needsEstimates, true); near(e.toPayByEstimates, 8757); near(e.perQuarter, 8757 / 4);
  assert.deepEqual(e.quarters.map((q) => q.status), ["short", "short", "short", "upcoming"]);   // 300 paid against 2,189 a quarter, mid-September
  assert.equal(e.nextDue.label, "1st quarter"); near(e.nextDue.amount, 8757 / 4 - 300); near(e.remaining, 8757 - 300);
  assert.equal(e.penaltyRisk, true);
  assert.equal(e.quarters[3].due, "2027-01-15");
});

test("hsa and fsa: the family limit with two catch-ups, the room, the tax saved through the brackets, the growth to 65", () => {
  const d = hsa(taxPlan(), { today: TODAY });
  assert.equal(d.hsa.limit, 8750 + 2000); assert.equal(d.hsa.total, 6000); assert.equal(d.hsa.room, 4750);
  near(d.hsa.taxSaved, 1000); near(d.hsa.ficaSaved, 382.5); assert.equal(d.hsa.years, 7);
  assert.ok(d.hsa.futureValue > 6000 * 7);
  assert.equal(d.hasFsa, false); assert.equal(d.notes.length, 0);
  const p = taxPlan(); p.taxes.hsa = { coverage: "self", contribution: 6000, employer: 0, fsa: 4000, fsaSpent: 1000 };
  const e = hsa(p, { today: TODAY });
  assert.equal(e.hsa.limit, 4400 + 1000); assert.equal(e.hsa.over, 600); assert.equal(e.fsa.unspent, 3000); assert.equal(e.fsa.over, 600);
  assert.equal(e.notes.length, 3); assert.ok(e.fsa.daysLeft > 100);
});

test("tax projection: every retirement year through the brackets, totals in today's dollars, the flat setting for comparison", () => {
  const d = taxProjection(taxPlan(), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.rows[0].year, 2033); assert.ok(d.rows.length > 25);
  assert.ok(d.totals.taxes > 100000 && d.totals.taxes < 1000000); assert.ok(d.flatTaxes > 0); assert.ok(d.byBracket.some((b) => b.rate === 0.12));
  assert.ok(d.rows.some((r) => r.socialSecurity > 0 && r.taxableSocialSecurity > 0 && r.taxableSocialSecurity <= 0.85 * r.socialSecurity + 1));
  assert.ok(d.notes.some((n) => n.includes("flat")));
  const nominal = taxProjection(taxPlan(), { today: TODAY, real: false });
  assert.ok(nominal.totals.taxes > d.totals.taxes);
  assert.equal(taxProjection(emptyPlan(), { today: TODAY }).ready, false);
});

test("the projection itself: brackets mode taxes each year's income, the flat mode is unchanged, and conversions only run in brackets mode", () => {
  const flat = projection(taxPlan(), { today: TODAY });
  assert.equal(flat.result.taxMode, "flat"); assert.equal(flat.orderLabel, "Taxable, then pre-tax, then Roth");
  const p = taxPlan(); p.retirement.taxMode = "brackets"; p.retirement.withdrawalOrder = ["deferred", "taxable", "free"];
  const br = projection(p, { today: TODAY });
  assert.equal(br.result.taxMode, "brackets"); assert.equal(br.orderLabel, "Pre-tax, then taxable, then Roth");
  assert.ok(br.rows.find((r) => r.retired).taxInfo);
  assert.ok(br.result.totalTaxes !== flat.result.totalTaxes);
  p.retirement.rothConversion = { on: true, fillRate: 0.12, untilAge: null };
  const rc = projection(p, { today: TODAY });
  assert.ok(rc.result.totalConverted > 0);
  p.retirement.taxMode = "flat";
  assert.equal(projection(p, { today: TODAY }).result.totalConverted, 0);
});

test("withdrawal order: four orders ranked by what is left after tax; the tap that sets one", () => {
  const d = withdrawalOrder(taxPlan(), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.options.length, 4); assert.equal(d.current, "taxable-first");
  assert.equal(d.options.filter((o) => o.best).length, 1);
  const best = d.options.find((o) => o.best);
  assert.ok(d.options.every((o) => !o.success || o.endAfterTaxReal <= best.endAfterTaxReal + 0.01));
  assert.ok(d.options.every((o) => o.endAfterTaxReal <= o.endBalanceReal + 0.01));
  assert.ok(d.notes.some((n) => n.includes("flat")));
  const p = taxPlan(); p.retirement.withdrawalOrder = ["deferred", "taxable", "free"];
  assert.equal(withdrawalOrder(p, { today: TODAY }).current, "deferred-first");
  assert.equal(withdrawalOrder(emptyPlan(), { today: TODAY }).ready, false);
});

test("roth conversions: a big pre-tax pot with high required withdrawals is helped by filling the 22% bracket; a couple already in 12% barely is", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "ann", name: "Ann", role: "self", birthDate: "1966-05-01", retirementAge: 60 });
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 50000 }, { id: "brk", name: "Brokerage", type: "brokerage", balance: 800000 }, { id: "ira", name: "IRA", type: "ira", balance: 2500000 });
  p.expenses.push({ id: "e1", name: "Everything", category: "other", amount: 6000, period: "monthly", essential: true });
  p.retirement.socialSecurity = { ann: { claimAge: 67, monthlyAtFRA: 3000 } };
  const d = roth(p, { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.options.length, 5); assert.ok(d.best === 0.22 || d.best === 0.24, String(d.best));
  const none = d.options[0], best = d.options.find((o) => o.best);
  assert.ok(best.endAfterTaxReal > none.endAfterTaxReal + 100000); assert.ok(best.taxesReal < none.taxesReal); assert.ok(best.rmdReal < none.rmdReal);
  assert.ok(d.options.find((o) => o.fillRate === 0.22).endAfterTaxReal > none.endAfterTaxReal + 100000);
  assert.equal(d.span.from, 2026); assert.equal(d.span.to, 2040);   // 60 to 74; required withdrawals from 75
  assert.ok(d.table.every((r) => r.conversion > 0 && r.bracketRate === d.shown), JSON.stringify(d.table.map((r) => [r.year, r.bracketRate])));
  assert.ok(d.table.some((r) => r.ages[0] >= 63 && r.irmaa));
  const couple = roth(taxPlan(), { today: TODAY });
  const cNone = couple.options[0], cBest = couple.options.find((o) => o.best);
  assert.ok(cBest.endAfterTaxReal - cNone.endAfterTaxReal < 50000);   // small change either way
  assert.equal(couple.on, false); assert.equal(couple.span.from, 2033);
  p.retirement.rothConversion = { on: true, fillRate: 0.12, untilAge: 65 };
  const on = roth(p, { today: TODAY });
  assert.equal(on.on, true); assert.equal(on.fillRate, 0.12); assert.equal(on.table[on.table.length - 1].ages[0], 64);
  assert.ok(on.notes.some((n) => n.includes("brackets")));
});
