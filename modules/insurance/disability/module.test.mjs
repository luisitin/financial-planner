import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, afterTax, employerPaid, TARGET_SHARE, DEFAULT_WAIT_DAYS, DEFAULT_UNTIL_AGE, SSDI_WAIT_MONTHS, COST_RANGE } from "./compute.js";
import { TAKE_HOME } from "../../scenarios/stress-tests/compute.js";
import { takeHome as paycheckTakeHome, compute as paycheck } from "../../cashflow/paycheck/compute.js";
import { freelancerPlan } from "../../../qa/fixtures/round8-households.mjs";
import { migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withPolicies = (policies) => { const p = familyPlan(TODAY); p.insurance = { policies }; return p; };
const LTD = { id: "d", name: "Ana's LTD", kind: "disability", personId: "p-ana", benefit: 5070, premium: 22, period: "monthly", throughWork: true };

test("tax on the benefit: employer-paid is taxed, paid from your own taxed pay is not", () => {
  near(afterTax(1000, true), 1000 * TAKE_HOME); assert.equal(afterTax(1000, false), 1000);
  assert.equal(employerPaid({ throughWork: true }), true); assert.equal(employerPaid({ throughWork: false }), false);
  assert.equal(employerPaid({ throughWork: true, paidBy: "me" }), false); assert.equal(employerPaid({ paidBy: "employer" }), true);
});

test("an empty plan: no one earns", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0);
});

test("the family with Ana's work policy: share of pay, after tax, the defaults, the household's bills", () => {
  const d = compute(withPolicies([LTD]), { today: TODAY });
  assert.equal(d.count, 2);
  const [ana, bo] = d.earners;
  // take-home: each salary as the Paycheck page works it out (whole-app sweep x3, 2026-11-16), business income at TAKE_HOME
  const pc = paycheck(withPolicies([LTD]), { today: TODAY }), net = (id) => pc.people.find((x) => x.id === id).yearly.net / 12;
  near(ana.grossMonthly, 3900 * 26 / 12); near(ana.takeHomeMonthly, net("p-ana"), 0.01);
  assert.equal(ana.benefitMonthly, 5070); near(ana.afterTaxMonthly, 5070 * TAKE_HOME);
  near(ana.share, 5070 / ana.grossMonthly); assert.equal(ana.extraNeeded, 0, "60% of 8,450 is 5,070");
  assert.equal(ana.policies[0].waitDays, DEFAULT_WAIT_DAYS); assert.equal(ana.policies[0].untilAge, DEFAULT_UNTIL_AGE); assert.equal(ana.policies[0].offset, true);
  near(ana.household.othersMonthly, net("p-bo") + 600 * TAKE_HOME, 0.01);   // Bo's salary as Paycheck has it, his $600 of business at 75%
  near(ana.household.shortMonthly, ana.household.essentialMonthly - ana.household.othersMonthly - ana.afterTaxMonthly);
  // once Social Security pays (Ana's 2,650), the work plan pays only the part above it
  near(ana.ssdiMonthly, 2650); near(ana.withSsdiMonthly, 2650 + (5070 - 2650) * TAKE_HOME);
  // Bo: nothing on file; the target and what closing it costs
  assert.equal(bo.benefitMonthly, 0); near(bo.target, TARGET_SHARE * 5800); near(bo.extraNeeded, TARGET_SHARE * 5800);
  near(bo.costRange[0], COST_RANGE[0] * 5800 * 12); near(bo.costRange[1], COST_RANGE[1] * 5800 * 12);
  assert.equal(bo.wait.days, null); near(bo.wait.months, SSDI_WAIT_MONTHS);
  assert.ok(d.warnings.some((w) => w.includes("All of Ana's disability insurance comes with the job")));
});

test("the wait: the cash carries what the others' pay leaves uncovered", () => {
  const d = compute(withPolicies([{ ...LTD, waitDays: 180 }]), { today: TODAY });
  const ana = d.earners[0];
  near(ana.wait.months, 180 / (365.25 / 12));
  near(ana.wait.shortMonthly, Math.max(0, ana.household.essentialMonthly - ana.household.othersMonthly));
  near(ana.wait.needed, ana.wait.shortMonthly * ana.wait.months);
  assert.equal(ana.wait.covered, ana.wait.cash >= ana.wait.needed);
  // no cash and must-pay bills above Bo's take-home: the wait is not covered (Bo's $4,992 a month covers the family's $4,768 of
  // must-pay bills on its own since the take-home is Paycheck's, so the bills go up by $1,000 here)
  const p = withPolicies([{ ...LTD, waitDays: 180 }]); p.accounts.find((a) => a.id === "a-chk").balance = 0; p.accounts.find((a) => a.id === "a-sav").balance = 0;
  p.expenses.push({ id: "x-more", name: "Care for a parent", category: "other", amount: 1000, period: "monthly", essential: true, inflates: true });
  const w = compute(p, { today: TODAY }).earners[0].wait;
  assert.ok(w.shortMonthly > 0, String(w.shortMonthly));
  assert.equal(w.covered, false);
});

test("a policy you pay yourself, with no offset, stops early: tax-free, stacks on Social Security, warned", () => {
  const d = compute(withPolicies([{ ...LTD, throughWork: false, paidBy: "me", offset: false, untilAge: 60, benefit: 3000 }]), { today: TODAY });
  const ana = d.earners[0];
  assert.equal(ana.afterTaxMonthly, 3000); near(ana.withSsdiMonthly, 2650 + 3000);
  near(ana.extraNeeded, TARGET_SHARE * ana.grossMonthly - 3000);
  assert.ok(d.warnings.some((w) => w.includes("stops paying at 60")));
});

test("someone past their retirement age, or with no pay, is not an earner; an ended policy does not count", () => {
  const p = withPolicies([{ ...LTD, endDate: "2025-01-01" }]);
  p.household.people.find((q) => q.id === "p-bo").retirementAge = 30;
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.earners.map((e) => e.id), ["p-ana"]);
  assert.equal(d.earners[0].benefitMonthly, 0);
});

test("the first adult left unnamed (\"Me\"): the warnings say you and your", () => {
  const p = withPolicies([{ ...LTD, untilAge: 60 }]); p.household.people.find((x) => x.id === "p-ana").name = "Me";
  const d = compute(p, { today: TODAY });
  assert.ok(d.warnings.some((w) => w.includes("before you plan to retire at")), d.warnings.join(" | "));
  assert.ok(d.warnings.some((w) => w.includes("All of your disability insurance comes with the job")), d.warnings.join(" | "));
  assert.ok(!d.warnings.some((w) => /\bMe\b/.test(w)));
  // any other name reads as before
  assert.ok(compute(withPolicies([{ ...LTD, untilAge: 60 }]), { today: TODAY }).warnings.some((w) => w.includes("before Ana plans to retire at")));
});

test("take-home is the Paycheck page's for each salary, the same figure on both pages; 75% where Paycheck cannot work it out (whole-app sweep x3)", () => {
  // the family: Ana's $8,450 a month reaches the bank as Paycheck's $6,257 (it read about $6,338, 75%)
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  const th = paycheckTakeHome(p, { today: TODAY });
  const ana = d.earners.find((e) => e.id === "p-ana"), anaSalary = p.income.filter((x) => x.personId === "p-ana" && x.type === "salary");
  assert.equal(Math.round(ana.takeHomeMonthly), Math.round(paycheck(p, { today: TODAY }).people.find((x) => x.id === "p-ana").yearly.net / 12));
  assert.ok(anaSalary.every((x) => th.ratio[x.id] > 0 && th.ratio[x.id] < 1), "each of Ana's salaries has Paycheck's share");
  // a household whose pay is all business income: Paycheck has nothing to work out, so 75%, as before
  const f = migrate(freelancerPlan());
  assert.equal(paycheckTakeHome(f, { today: TODAY }).ready, false);
  for (const e of compute(f, { today: TODAY }).earners) near(e.takeHomeMonthly, e.grossMonthly * TAKE_HOME);
});

test("with no date given, compute never reads the clock: every line at 75%, as Paycheck cannot tell which pay is current (critic F4)", () => {
  const p = familyPlan(TODAY);
  const RealDate = globalThis.Date;
  // a clock read (new Date() or Date.now() with nothing given) is counted (a throw would be swallowed by a try along the way)
  let reads = 0;
  class Counted extends RealDate {
    constructor(...a) { if (!a.length) reads++; super(...a); }
    static now() { reads++; return RealDate.now(); }
  }
  globalThis.Date = Counted;
  let d;
  try { d = compute(p, {}); } finally { globalThis.Date = RealDate; }
  assert.equal(reads, 0, "the clock was read");
  for (const e of d.earners) near(e.takeHomeMonthly, e.grossMonthly * TAKE_HOME);
  // with the day given, Paycheck's share (Ana: $6,257 a month, not 75%)
  const dated = compute(p, { today: TODAY }).earners.find((e) => e.id === "p-ana");
  assert.ok(dated.takeHomeMonthly < dated.grossMonthly * TAKE_HOME - 50, String(dated.takeHomeMonthly));
});
