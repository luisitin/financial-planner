import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, schedule, loanCost, deductibleShare, PROJECTS, DEFAULTS, ACQ_LIMIT } from "./compute.js";
import { pmt } from "../../../core/math/finance.js";
import { planReturn } from "../../insurance/term-vs-permanent/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("schedule: interest by hand; with no discount the payments' present value is what is paid", () => {
  const s = schedule(1000, 0.12, 100);
  let b = 1000, i = 0, paid = 0; for (let m = 0; m < 20 && b > 0.005; m++) { const x = b * 0.01, p = Math.min(100, b + x); i += x; paid += p; b = b + x - p; }
  near(s.interest, i); near(s.pv, paid);
  assert.ok(schedule(1000, 0.12, 100, 0.06).pv < s.pv);
});

test("loanCost: the level payment, and at a discount equal to the rate the payments are worth the loan", () => {
  const l = loanCost(30000, 0.08, 10, 0.08);
  near(l.payment, pmt(0.08 / 12, 120, 30000)); near(l.pv, 30000, 0.05);
  near(l.interest, l.payment * 120 - 30000, 0.05);
});

test("value added: the project's average share, or your own", () => {
  const p = emptyPlan(); p.whatIfs = { renovation: { project: "garage-door", cost: 4000 } };
  const d = compute(p, { today: TODAY });
  near(d.valueAdded, 4000 * PROJECTS["garage-door"].recoup); assert.ok(d.equityChange > 0);
  p.whatIfs.renovation.recoup = 0.4;
  near(compute(p, { today: TODAY }).valueAdded, 1600);
});

test("the family's kitchen: four ways; no cash to spare; the line ranks first in today's money", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.ways.map((w) => w.id), ["cash", "heloc", "refi", "loan"]);
  const cash = d.ways[0]; assert.equal(cash.fits, false);
  near(d.discount, planReturn(p));
  const heloc = d.ways.find((w) => w.id === "heloc"), loan = d.ways.find((w) => w.id === "loan");
  const h = loanCost(30000, DEFAULTS.helocRate, DEFAULTS.helocYears, d.discount);
  near(heloc.monthly, h.payment); near(heloc.today, h.pv - 30000);
  const l = loanCost(30000, DEFAULTS.loanRate, DEFAULTS.loanYears, d.discount);
  near(loan.today, l.pv - 30000);
  assert.equal(heloc.taxSaved, 0, "the family takes the standard deduction");
  assert.equal(d.best, "heloc");
  near(d.home.borrowable, 380000 * DEFAULTS.cltv - 265000);
});

test("the refinance: the whole mortgage at the new rate against keeping it, closing costs borrowed too", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  const r = d.ways.find((w) => w.id === "refi");
  const fees = (265000 + 30000) * DEFAULTS.refiCosts;
  near(r.fees, fees);
  const nl = loanCost(265000 + 30000 + fees, DEFAULTS.refiRate, DEFAULTS.refiYears, d.discount);
  const old = schedule(265000, 0.0625, 1980, d.discount);
  near(r.monthly, nl.payment - 1980); near(r.interest, nl.interest - old.interest); near(r.today, nl.pv - old.pv - 30000);
  assert.ok(r.risk, "it gives up a lower rate");
});

test("with the cash and no home: cash is the way, and no home loans are offered", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 80000, history: [] });
  p.whatIfs = { renovation: { project: "bath", cost: 20000 } };
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.ways.map((w) => w.id), ["cash", "loan"]);
  assert.equal(d.best, "cash"); assert.equal(d.home, null);
  near(d.cushion.after, 60000);
});

test("a cash-out refinance fits only up to 80% of the home's value, closing costs included (HUD Mortgagee Letter 2019-11)", () => {
  // the family's 380,000 home and 265,000 mortgage: 30,000 more is 303,850 with 3% costs, 79.96%; 35,000 more is 309,000, 81.3%
  const p = familyPlan(TODAY);
  const r = compute(p, { today: TODAY }).ways.find((w) => w.id === "refi");
  near(r.ltv, 303850 / 380000, 1e-6); assert.equal(r.fits, true);
  p.whatIfs = { renovation: { cost: 35000 } };
  const d = compute(p, { today: TODAY }), r2 = d.ways.find((w) => w.id === "refi");
  near(r2.ltv, 309000 / 380000, 1e-6); assert.equal(r2.fits, false);
  assert.equal(d.ways.find((w) => w.id === "heloc").fits, true, "the line still fits: 85% of 380,000 less 265,000 is 58,000");
});

test("deductible interest by the law: the first $750,000 of home debt, never the closing costs rolled in (IRC 163(h)(3); Pub. 936)", () => {
  assert.equal(deductibleShare(700000, ACQ_LIMIT.other), 1);
  near(deductibleShare(800000, ACQ_LIMIT.other), 15 / 16, 1e-12);
  near(deductibleShare(500000, ACQ_LIMIT.separate), 0.75, 1e-12);
  // the family itemizing: the line's interest is all deductible (295,000 of home debt); the refinance's new loan only on the
  // old balance and the cost, 295,000 of its 303,850, less the old mortgage's interest it replaces; today's money after the tax
  const p = familyPlan(TODAY); p.taxes.itemized = { ...p.taxes.itemized, other: 60000 };
  const d = compute(p, { today: TODAY });
  assert.equal(d.itemizes, true);
  const h = d.ways.find((w) => w.id === "heloc"), r = d.ways.find((w) => w.id === "refi");
  const lc = loanCost(30000, DEFAULTS.helocRate, DEFAULTS.helocYears, d.discount);
  near(h.deductibleShare, 1); near(h.taxSaved, lc.interest * d.marginal); near(h.today, lc.pv - 30000 - lc.pvInterest * d.marginal);
  const nl = loanCost(303850, DEFAULTS.refiRate, DEFAULTS.refiYears, d.discount), old = schedule(265000, 0.0625, 1980, d.discount), share = 295000 / 303850;
  near(r.deductibleShare, share, 1e-12);
  near(r.taxSaved, (nl.interest * share - old.interest) * d.marginal);
  near(r.today, nl.pv - old.pv - 30000 - (nl.pvInterest * share - old.pvInterest) * d.marginal);
  // a cheaper refinance gives up deduction: the tax saved goes negative instead of stopping at 0
  p.whatIfs = { renovation: { refiRate: 0.04, refiYears: 15 } };
  const cheap = compute(p, { today: TODAY }).ways.find((w) => w.id === "refi");
  assert.ok(cheap.interest < 0 && cheap.taxSaved < 0, `${cheap.interest} ${cheap.taxSaved}`);
  // a 740,000 mortgage: the line's 30,000 takes the home debt past 750,000, so 750/770 of its interest counts
  const big = familyPlan(TODAY); big.taxes.itemized = { ...big.taxes.itemized, other: 60000 };
  big.accounts.find((a) => a.id === "a-mort").balance = 740000; big.accounts.find((a) => a.id === "a-home").balance = 1200000;
  big.debts.find((x) => x.id === "d-mort").minPayment = 5000;
  const bh = compute(big, { today: TODAY }).ways.find((w) => w.id === "heloc");
  near(bh.deductibleShare, 750000 / 770000, 1e-12); near(bh.taxSaved, bh.interest * 750000 / 770000 * compute(big, { today: TODAY }).marginal);
});
