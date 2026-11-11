// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, careExpenses, paidInYear, isCare, careInputsWith, taxInputs, ENROLL_FROM_MONTH, careAccountRule, careAccount, ratePct } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { federalTax } from "../../../core/math/tax.js";

test("federal: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("federal: the 0.9% additional Medicare tax is worked on pay before pre-tax 401(k) saving", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-10-30");
  p.income.find((x) => x.id === "i-ana").amount = 7600;   // 197,600 + Bo's 62,400 = 260,000 of pay; 12,220 to Ana's 401(k)
  const d = compute(p, { today: "2026-10-30" });
  assert.equal(d.inputs.medicareWages, 260000);
  assert.equal(d.inputs.wages, 260000 - 12220);
  assert.ok(Math.abs(d.result.additionalMedicare - 0.009 * 10000) < 0.01);
  const typed = familyPlan("2026-10-30"); typed.taxes.thisYear.wages = 255000;
  assert.equal(compute(typed, { today: "2026-10-30" }).inputs.medicareWages, 255000, "typed wages are taken as they are");
});

test("federal: filing separately, Social Security is taxed from the first dollar unless the spouses lived apart all year (IRC 86(c))", () => {
  const p = emptyPlan();
  p.household.filingStatus = "married_separate";
  p.taxes.thisYear.socialSecurity = 30000; p.taxes.thisYear.otherOrdinary = 5000;
  const together = compute(p, { today: "2026-10-30" });
  assert.equal(together.result.income.taxableSocialSecurity, 0.85 * (5000 + 15000));   // 17,000
  assert.ok(together.notes.some((n) => /lived apart all year/.test(n)));
  p.taxes.livedApart = true;
  const apart = compute(p, { today: "2026-10-30" });
  assert.equal(apart.livedApart, true);
  assert.equal(apart.result.income.taxableSocialSecurity, 0);   // provisional 20,000 under the single base of 25,000
  p.household.filingStatus = "married_joint";
  assert.equal(compute(p, { today: "2026-10-30" }).livedApart, false);   // the tick counts only on a separate return
});

test("federal: a year past the tables takes SSA's published wage base (2027: $192,300), later years inflate", () => {
  const p = emptyPlan();
  p.taxes.year = 2027;
  assert.equal(compute(p, { today: "2026-10-30" }).params.ssWageBase, 192300);
  p.taxes.year = 2026;
  assert.equal(compute(p, { today: "2026-10-30" }).params.ssWageBase, 184500);
  p.taxes.year = 2029;
  assert.ok(compute(p, { today: "2026-10-30" }).params.ssWageBase > 184500);
});

// --- wages, Medicare wages and the adjustments against the year's limits (README "Pay and contributions") ----------
const person = (id, role, birthDate) => ({ id, name: id === "r" ? "Rosa" : id === "k" ? "Kai" : id === "a" ? "Ana" : "Ben", role, birthDate });
function earner({ people, pay, rows = [], hsa = {}, status = "single" }) {
  const p = emptyPlan();
  p.household.filingStatus = status;
  p.household.people = people;
  p.income = Object.entries(pay).map(([id, amount]) => ({ id: `pay-${id}`, name: "Pay", type: "salary", personId: id, amount, period: "annual", growth: 0 }));
  p.accounts = rows.map(([id, type, name, owner]) => ({ id, type, name, balance: 0, ownerId: owner }));
  p.retirement.contributions = rows.map(([id, , , owner, amount, match = 0]) => ({ id: `c-${id}`, accountId: id, personId: owner, amount, period: "annual", employerMatch: match }));
  p.taxes.hsa = { ...p.taxes.hsa, ...hsa };
  return p;
}

test("federal: the health FSA comes off wages and Medicare wages, up to the year's limit (IRC 125(i), 3121(a)(5)(G); key RULES.md 10.6)", () => {
  const jo = (fsa) => compute(earner({ people: [person("k", "self", "1981-02-02")], pay: { k: 80000 }, hsa: { fsa } }), { today: "2026-10-30" });
  const d = jo(3600);   // Jo elects 3,600: 3,400 is the 2026 limit, the 200 over stays in pay
  assert.equal(d.inputs.wages, 80000 - 3400); assert.equal(d.inputs.medicareWages, 80000 - 3400);
  assert.deepEqual([d.fsa.excluded, d.fsa.over, d.fsa.limit, d.fsa.offWages], [3400, 200, 3400, 3400]);
  assert.ok(d.notes.some((n) => /FSA election is over this year's limit of \$3,400/.test(n)));
  assert.equal(jo(2000).inputs.wages, 78000);
  assert.equal(compute(earner({ people: [person("k", "self", "1981-02-02")], pay: { k: 80000 }, hsa: { fsa: 3600 } }), { today: "2025-10-30" }).fsa.excluded, 3300, "2025: Rev. Proc. 2024-40's 3,300");
});

test("federal: pre-tax 401(k) money comes off wages only up to the limit plus catch-up, Roth money first in the excess (IRC 402(g)(1)(A); RULES.md 10.1)", () => {
  // Rosa, 61 in 2026: limit 24,500 + 11,250; pre-tax 26,000 + Roth 10,000 = 36,000, 250 over, all of it Roth: nothing in pay
  const rosa = (pretax, roth) => compute(earner({ people: [person("r", "self", "1965-03-14")], pay: { r: 150000 }, rows: [["k", "401k", "401(k)", "r", pretax, 6000], ["rk", "roth", "Roth 401(k)", "r", roth]] }), { today: "2026-10-30" });
  const d = rosa(26000, 10000);
  assert.equal(d.k401.people[0].catchUp, 11250); assert.equal(d.k401.people[0].inIncome, 0); assert.equal(d.inputs.wages, 150000 - 26000);
  assert.equal(d.inputs.medicareWages, 150000, "401(k) money stays in Medicare wages (3121(v)(1)(A))");
  // all 36,000 pre-tax: the 250 over the 35,750 is pay this year
  const e = rosa(36000, 0);
  assert.equal(e.k401.people[0].inIncome, 250); assert.equal(e.inputs.wages, 150000 - 35750); assert.equal(e.pretax401k, 35750);
  assert.ok(e.notes.some((n) => /250 of pre-tax 401\(k\) money is over this year's limit/.test(n)));
  // at 45 there is no catch-up: 30,000 pre-tax leaves 5,500 in pay
  const young = compute(earner({ people: [person("k", "self", "1981-02-02")], pay: { k: 150000 }, rows: [["k1", "401k", "401(k)", "k", 30000]] }), { today: "2026-10-30" });
  assert.equal(young.inputs.wages, 150000 - 24500); assert.equal(young.k401.inIncome, 5500);
});

test("federal: the 401(k) catch-up is at most the pay left after the other deferrals (IRC 414(v)(2)(A)(ii))", () => {
  // Rosa paid 30,000 puts 30,000 pre-tax: the catch-up is 30,000 - 24,500 = 5,500, not 11,250, so all of it stays out of pay
  const p = earner({ people: [person("r", "self", "1965-03-14")], pay: { r: 30000 }, rows: [["k", "401k", "401(k)", "r", 30000]] });
  const d = compute(p, { today: "2026-10-30" });
  assert.equal(d.k401.people[0].catchUp, 5500); assert.equal(d.k401.people[0].excluded, 30000); assert.equal(d.inputs.wages, 0);
  // no pay at all: no catch-up, and the 401(k) money over the base limit is income
  p.income = [];
  const n = compute(p, { today: "2026-10-30" });
  assert.equal(n.k401.people[0].catchUp, 0); assert.equal(n.k401.people[0].inIncome, 30000 - 24500);
  // self-employed, a solo 401(k): compensation is the earned income (415(c)(3)(B), 401(c)(2)), so the business keeps
  // Rosa's whole 11,250 catch-up and nothing is taxed as an excess deferral
  p.income = [{ id: "biz", name: "Consulting", type: "business", personId: "r", amount: 90000, period: "annual", growth: 0 }];
  p.retirement.contributions[0].amount = 35750;
  const s = compute(p, { today: "2026-10-30" });
  assert.equal(s.k401.people[0].compensation, 90000); assert.equal(s.k401.people[0].pay, 0);
  assert.equal(s.k401.people[0].catchUp, 11250); assert.equal(s.k401.people[0].inIncome, 0);
  assert.ok(!s.notes.some((x) => /401\(k\) money is over/.test(x)));
  // a business that earns less than the deferrals caps it: 30,000 - 24,500 = 5,500
  p.income[0].amount = 30000;
  assert.equal(compute(p, { today: "2026-10-30" }).k401.people[0].catchUp, 5500);
});

test("federal: HSA money through pay is kept out of income and Medicare wages only up to the household's limit (IRC 106(d)(1), 223(b), 3121(a)(5)(G))", () => {
  // Kai (RULES.md 10.5): 210,000 of pay, 24,500 pre-tax 401(k), 4,400 of HSA through pay, self-only cover
  const kai = (hsa) => compute(earner({ people: [person("k", "self", "1981-02-02")], pay: { k: 210000 }, rows: [["k1", "401k", "401(k)", "k", 24500], ["h", "hsa", "HSA", "k", hsa]], hsa: { coverage: "self", contribution: hsa } }), { today: "2026-10-30" });
  const d = kai(4400);
  assert.equal(d.inputs.wages, 210000 - 24500); assert.equal(d.inputs.adjustments, 4400); assert.equal(d.result.agi, 181100);
  assert.equal(d.inputs.medicareWages, 205600); assert.ok(Math.abs(d.result.additionalMedicare - 0.009 * 5600) < 1e-9, "0.9% on 5,600 over 200,000");
  // 5,000 in: the 600 over the 4,400 limit is pay
  const o = kai(5000);
  assert.equal(o.inputs.adjustments, 4400); assert.equal(o.inputs.medicareWages, 210000 - 4400); assert.equal(o.hsa.excess, 600);
  assert.ok(o.sources.some((s) => s.key === "hsa" && s.amount === -4400 && /600 over the limit/.test(s.detail)));
  assert.ok(o.notes.some((n) => /600 of HSA money is over the limit/.test(n)));
});

test("federal: without high-deductible cover HSA money is pay, the employer's too; a spouse outside self-only cover the same (IRC 223(c)(1), Pub. 969)", () => {
  const couple = (coverage) => earner({ status: "married_joint", people: [person("a", "self", "1970-05-01"), person("b", "partner", "1974-05-01")], pay: { a: 100000, b: 60000 },
    rows: [["ha", "hsa", "HSA", "a", 3000, 1000], ["hb", "hsa", "HSA", "b", 2000, 500]], hsa: { coverage, contribution: 5000, employer: 1500 } });
  const fam = compute(couple("family"), { today: "2026-10-30" });
  assert.equal(fam.inputs.adjustments, 5000); assert.equal(fam.inputs.wages, 160000); assert.equal(fam.inputs.medicareWages, 155000);
  const none = compute(couple("none"), { today: "2026-10-30" });
  assert.equal(none.inputs.adjustments, 0); assert.equal(none.inputs.wages, 160000 + 1500, "the employer's 1,500 is pay too"); assert.equal(none.inputs.medicareWages, 161500);
  assert.equal(none.hsa.employerTaxed, 1500); assert.ok(none.notes.some((n) => /no high-deductible health plan/.test(n)));
  // self-only cover is Ana's (56: 4,400 + 1,000): Ben's 2,500 is over, of which 2,000 his pay and 500 his employer's
  const self = compute(couple("self"), { today: "2026-10-30" });
  assert.equal(self.hsa.excess, 2500); assert.equal(self.inputs.adjustments, 5000 - 2500); assert.equal(self.inputs.wages, 160000);
  assert.equal(self.result.agi, 160000 - 3000 + 500, "pay less Ana's 3,000; Ben's 2,000 is not deducted and his employer's 500 is pay");
});

test("federal: the traditional IRA deduction stops at each person's IRA limit plus catch-up (IRC 219(b)(1), (b)(5))", () => {
  const p = earner({ status: "married_joint", people: [person("a", "self", "1970-05-01"), person("b", "partner", "1984-05-01")], pay: { a: 90000, b: 40000 },
    rows: [["ia", "ira", "IRA", "a", 9000], ["ib", "ira", "IRA", "b", 7000]] });
  const d = compute(p, { today: "2026-10-30" });
  // Ana, 56: 7,500 + 1,100 = 8,600 of her 9,000; Ben, 42: all 7,000
  assert.deepEqual(d.ira.people.map((x) => x.deductible), [8600, 7000]); assert.equal(d.inputs.adjustments, 15600); assert.equal(d.ira.over, 400);
  assert.ok(d.sources.some((s) => s.key === "ira" && s.amount === -15600 && /400 over the IRA limit/.test(s.detail)));
});

test("federal: typed wages are the person's own W-2 box 1: nothing comes off them", () => {
  const p = earner({ people: [person("k", "self", "1981-02-02")], pay: { k: 80000 }, rows: [["k1", "401k", "401(k)", "k", 30000]], hsa: { fsa: 3000 } });
  p.taxes.thisYear.wages = 50000;
  const d = compute(p, { today: "2026-10-30" });
  assert.equal(d.inputs.wages, 50000); assert.equal(d.inputs.medicareWages, 50000); assert.equal(d.fsa.offWages, 0);
  assert.ok(!d.notes.some((n) => /401\(k\) money is over|FSA election is over/.test(n)));
});

test("federal: filing separately, each spouse's return holds their own pay and business; the child goes on the higher earner's (Pub. 501)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-10-30");
  p.household.filingStatus = "married_separate";
  const d = compute(p, { today: "2026-10-30" });
  const [ana, bo] = d.separate;
  assert.equal(ana.personId, "p-ana"); assert.equal(bo.personId, "p-bo");
  assert.equal(bo.selfEmployment, 7200); assert.equal(ana.selfEmployment, 0);   // the photography is Bo's
  assert.equal(ana.dependentsUnder17, 1); assert.equal(bo.dependentsUnder17, 0);   // Ana's 101,400 of pay is the larger
  assert.ok(Math.abs(ana.wages + bo.wages - d.inputs.wages) < 0.01);
  assert.ok(Math.abs(d.result.separate[0].totalTax + d.result.separate[1].totalTax - d.result.totalTax) < 0.011);
  assert.equal(d.standard, 2 * 16100);
  assert.ok(d.notes.some((n) => /two returns: Ana's and Bo's/.test(n)));
  p.household.filingStatus = "married_joint";
  assert.equal(compute(p, { today: "2026-10-30" }).separate, null);
});

test("federal: filing separately, a sale in one spouse's name is all on that spouse's return; one in neither name is split (Pub. 501; IRC 1211(b))", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { lossCarryover } = await import("./compute.js");
  const { federalTax } = await import("../../../core/math/tax.js");
  const p = familyPlan("2026-10-30");
  p.household.filingStatus = "married_separate";
  p.taxes.gains = [{ id: "g1", name: "Bo's shares", proceeds: 0, basis: 5000, held: "short", personId: "p-bo" }];
  let d = compute(p, { today: "2026-10-30" });
  const [ana, bo] = d.separate;
  assert.equal(ana.capitalLoss, 0); assert.equal(bo.capitalLoss, -1500);   // Bo's 5,000 loss: 1,500 off Bo's income
  assert.deepEqual(bo.gainTotals, { short: -5000, long: 0 });
  assert.equal(lossCarryover(d, federalTax(d.inputs, d.params)).total, 3500);
  delete p.taxes.gains[0].personId;
  d = compute(p, { today: "2026-10-30" });
  assert.deepEqual(d.separate.map((x) => x.capitalLoss), [-1500, -1500]);   // 2,500 on each return, 1,500 off each
  assert.equal(lossCarryover(d, federalTax(d.inputs, d.params)).total, 2000);
  assert.equal(d.gains.carryover.total, 2000);
});

// --- the child and dependent care credit from the plan (README "Child and dependent care credit") ------------------
const TODAY = "2026-11-02";
/** A single parent: Jo, head of household, 62,000 of pay, a child born 2022-07-15 (4 at the end of 2026), 900 a month of daycare. */
function singleParent(fn) {
  const p = emptyPlan();
  p.household.filingStatus = "head_of_household"; p.household.state = "OH";
  p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: 62000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "rent", name: "Rent", category: "housing", amount: 1300, period: "monthly" }, { id: "care", name: "Daycare", category: "childcare", amount: 900, period: "monthly" }];
  if (fn) fn(p);
  return p;
}
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("care credit: the single parent's 10,800 of daycare gives 35% of 3,000 = 1,050, its row after the child tax credit, and the walk adds up", () => {
  const d = compute(singleParent(), { today: TODAY });
  assert.deepEqual(d.inputs.care, { expenses: 10800, persons: 1, benefits: 0, earnedLow: 62000 });
  near(d.result.credits.careCredit, 1050); near(d.result.totalTax, 4188 - 2200 - 1050);
  const labels = d.steps.map((s) => s.label);
  const at = labels.indexOf("Child and dependent care credit");
  assert.equal(labels[at - 1], "Child tax credit"); assert.equal(labels[at + 1], "Federal tax");
  near(d.steps[at].amount, -1050);
  assert.equal(d.steps[at].sub, "$3,000 of your $10,800 of child care counts (the most for one child), at 35% for your income");
  // income tax, less the two credits, is the federal tax
  const step = (l) => d.steps.find((s) => s.label === l).amount;
  near(step("Income tax") + step("Child tax credit") + step("Child and dependent care credit"), step("Federal tax"));
  assert.ok(d.sources.some((s) => s.key === "care" && s.amount === 10800 && /Daycare \$10,800/.test(s.detail)));
  assert.equal(d.care.persons, 1); assert.deepEqual(d.care.kids, ["Kit"]);
  // on 26,000 of pay: 44% (50 less ceil(11,000 / 2,000) = 6 points) of 3,000 = 1,320, but the tax is 185 (1,850 taxable at
  // 10%): 185 of credit, the child credit all refundable (min(2,200, 1,700, 15% of 23,500)), the walk says why
  const low = compute(singleParent((p) => { p.income[0].amount = 26000; }), { today: TODAY });
  near(low.result.incomeTax, 185); near(low.result.credits.careCredit, 185); near(low.result.credits.refundable, 1700); near(low.result.totalTax, -1700);
  assert.equal(low.steps.find((s) => s.label === "Child and dependent care credit").sub, "$3,000 of your $10,800 of child care counts (the most for one child), at 44% for your income; only $185 fits under the tax, and none of it comes back as a refund");
});

test("care credit: the family's care is what falls in the year, the lower earner's pay caps it, and the rate is the joint one", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const d = compute(familyPlan(TODAY), { today: TODAY });
  // Daycare 1,150 a month to August 31 (8 months) and after-school care 450 a month from September 1 (4 months)
  assert.equal(d.inputs.care.expenses, 8 * 1150 + 4 * 450);
  // Bo: 62,400 of pay and 7,200 of photography less half its self-employment tax (15.3% of 92.35%, halved)
  near(d.inputs.care.earnedLow, 62400 + 7200 - 0.5 * 0.153 * 0.9235 * 7200);
  assert.equal(d.care.joint, true);
  // AGI 158,780: 35% less one point per 4,000 (or part) over 150,000 = 3 points: 32% of 3,000
  near(d.result.agi, 158780); near(d.result.credits.careCredit, 960);
  assert.ok(d.steps.some((s) => s.label === "Child and dependent care credit" && Math.abs(s.amount + 960) < 0.01));
});

test("care credit: which Expenses lines are care, and the part paid in the tax year", () => {
  const lines = [
    { id: "a", name: "Childcare and school", category: "childcare", amount: 100, period: "monthly" },   // Set up my plan's row
    { id: "b", name: "Private school", category: "childcare", amount: 1000, period: "monthly" },         // schooling: not care
    { id: "c", name: "Kids' tutoring", category: "childcare", amount: 50, period: "monthly" },
    { id: "d", name: "Nanny", category: "personal", amount: 200, period: "monthly" },                   // care by its name, any category
    { id: "e", name: "After-school care", category: "childcare", amount: 300, period: "monthly", startDate: "2026-09-01" },
    { id: "f", name: "Summer day camp", category: "fun", amount: 900, period: "once", startDate: "2026-07-01" },
    { id: "g", name: "Overnight camp", category: "childcare", amount: 2000, period: "once", startDate: "2026-07-15" },
    { id: "h", name: "Daycare", category: "childcare", amount: 500, period: "monthly", endDate: "2025-12-31" },   // ended before the year
    { id: "i", name: "Preschool", category: "other", amount: 400, period: "monthly", startDate: "2027-01-01" },  // starts after it
    { id: "j", name: "Groceries", category: "groceries", amount: 800, period: "monthly" },
    { id: "k", name: "Doggy daycare", category: "pets", amount: 150, period: "monthly" },
  ];
  const c = careExpenses({ expenses: lines }, 2026);
  assert.deepEqual(c.lines.map((x) => x.id), ["a", "d", "e", "f"]);
  assert.equal(c.total, 1200 + 2400 + 4 * 300 + 900);
  assert.equal(paidInYear({ amount: 100, period: "weekly", startDate: "2026-12-15" }, 2026), 5200 / 12);   // one month of 52 weeks
  assert.equal(paidInYear({ amount: 900, period: "once", startDate: "2025-07-01" }, 2026), 0);
});

test("care credit: who counts (under 13 for some of the year, a birth date needed), a separate return, and the hint", () => {
  // a child who turns 13 during the year counts for the part of the year before the birthday (Form 2441 instructions): born
  // 2013-06-01, so the care paid January to May counts (5 x 900 = 4,500); the 3,000 limit is not prorated: 35% x 3,000
  const teen = compute(singleParent((p) => { p.household.people[1].birthDate = "2013-06-01"; }), { today: TODAY });
  assert.equal(teen.care.persons, 1); assert.equal(teen.care.expenses, 4500); assert.equal(teen.care.expensesAll, 10800);
  near(teen.result.credits.careCredit, 1050);
  assert.ok(teen.notes.some((n) => /Kit turns 13 in 2026, so only the care paid before the birthday counts for the child care credit: \$4,500 of the \$10,800/.test(n)));
  // born 2013-05-10: January to April and 9 of May's 31 days, 4 x 900 + 900 x 9 / 31
  near(compute(singleParent((p) => { p.household.people[1].birthDate = "2013-05-10"; }), { today: TODAY }).care.expenses, 3600 + 900 * 9 / 31, 1e-9);
  // 13 on January 1, or 13 all year: no qualifying child, no credit, and a note says why
  for (const born of ["2013-01-01", "2012-07-15"]) {
    const old = compute(singleParent((p) => { p.household.people[1].birthDate = born; }), { today: TODAY });
    assert.equal(old.inputs.care, undefined); assert.equal(old.result.credits.careCredit, 0); assert.equal(old.care.persons, 0);
    assert.ok(old.notes.some((n) => /no child on the People page is under 13 in 2026, so it does not count for the child care credit/.test(n)), born);
  }
  // no child on People at all: a note asks for one
  const nobody = compute(singleParent((p) => { p.household.people = p.household.people.filter((x) => x.role !== "dependent"); }), { today: TODAY });
  assert.equal(nobody.result.credits.careCredit, 0); assert.ok(nobody.notes.some((n) => /no child is on the People page, so the child care credit is not counted/.test(n)));
  // no birth date: not counted, and a note asks for it
  const undated = compute(singleParent((p) => { delete p.household.people[1].birthDate; }), { today: TODAY });
  assert.equal(undated.result.credits.careCredit, 0); assert.ok(undated.notes.some((n) => /Kit has no birth date on the People page/.test(n)));
  // married filing separately: none (IRC 21(e)(2)), and the page says why and what to look at instead
  const sep = compute(singleParent((p) => { p.household.filingStatus = "married_separate"; }), { today: TODAY });
  assert.equal(sep.result.credits.careCredit, 0); assert.ok(sep.notes.some((n) => /Filing separately, the child care credit is not allowed.*head of household/.test(n)));
  assert.ok(!sep.steps.some((s) => s.label === "Child and dependent care credit"));
  // filing jointly with only one adult on People: the spouse's earned income is not known (21(d)(1)(B)), so no credit, a note
  const joint1 = compute(singleParent((p) => { p.household.filingStatus = "married_joint"; }), { today: TODAY });
  assert.equal(joint1.care.spouseUnknown, true); assert.equal(joint1.inputs.care.earnedLow, 0); assert.equal(joint1.result.credits.careCredit, 0);
  assert.ok(joint1.notes.some((n) => /lists only one adult, so the credit is not counted. Add your spouse there/.test(n)));
  // a child under 13 and no care on Expenses: no credit, and what the page's hint keys on
  const none = compute(singleParent((p) => { p.expenses = p.expenses.filter((x) => x.id !== "care"); }), { today: TODAY });
  assert.equal(none.care.persons, 1); assert.equal(none.care.expenses, 0); assert.equal(none.care.expensesAll, 0); assert.equal(none.inputs.care, undefined);
  assert.ok(!none.steps.some((s) => s.label === "Child and dependent care credit"));
});

test("care credit: a child care account comes off the 3,000 and off wages (Form 2441 lines 25, 26 and 29; example B)", async () => {
  const fsa = (b, today = TODAY) => compute(singleParent((p) => { p.whatIfs = { benefits: { jo: b } }; }), { today });
  // 2,000 for 2026: wages 62,000 - 2,000 = 60,000, taxable 35,850, tax 1,770 + 12% x 18,150 = 3,948; the credit
  // (3,000 - 2,000) x 35% = 350; the child credit 2,200: 1,398
  const two = fsa({ dcfsaElect: 2000, planYear: 2026 });
  assert.equal(two.inputs.care.benefits, 2000); near(two.result.credits.careCredit, 350);
  assert.equal(two.inputs.wages, 60000); assert.equal(two.inputs.medicareWages, 60000); near(two.result.totalTax, 3948 - 350 - 2200);
  assert.match(two.steps.find((s) => s.label === "Child and dependent care credit").sub, /\$3,000 for one child, less the \$2,000 your child care account pays\), at 35%/);
  assert.ok(two.sources.some((x) => x.key === "wages" && /less the \$2,000 child care account/.test(x.detail)));
  // 5,000 for 2026 (the research spec's example B): AGI 57,000, no credit (3,000 - 5,000 < 0), tax 3,588 - 2,200 = 1,388
  const five = fsa({ dcfsaElect: 5000, planYear: 2026 });
  near(five.result.agi, 57000); assert.equal(five.result.credits.careCredit, 0); near(five.result.totalTax, 1388);
  assert.deepEqual(["elected", "forfeited", "excluded", "taxedAsPay"].map((k) => five.care.account[k]), [5000, 0, 5000, 0]);
  // the walk says why there is no credit, at 0, and still adds up
  const row = five.steps.find((s) => s.label === "Child and dependent care credit");
  assert.equal(row.amount, 0); assert.equal(row.sub, "none: the $5,000 your child care account pays is more than the $3,000 limit for one child, and that money already skips tax");
  // a plan takes at most 7,500 (129(a)(2)(A)): 20,000 typed is 7,500 in the account, all of it out of income (10,800 of
  // care), wages 54,500, and a note says only 7,500 is counted
  const big = fsa({ dcfsaElect: 20000, planYear: 2026 });
  assert.equal(big.inputs.care.benefits, 7500); assert.equal(big.inputs.wages, 62000 - 7500); assert.equal(big.care.account.taxedAsPay, 0);
  assert.ok(big.notes.some((n) => /set to \$20,000 on Benefits elections; a plan takes at most \$7,500 a year/.test(n)));
  // no plan year typed: Benefits elections' own (next year's from October), as the Paycheck page counts it. On 2026-11-02
  // the account is 2027's: the 2026 tax keeps its 1,050 credit and 62,000 of wages, and a note says why
  const later = fsa({ dcfsaElect: 5000 });
  assert.equal(later.inputs.care.benefits, 0); assert.equal(later.inputs.wages, 62000); near(later.result.credits.careCredit, 1050); near(later.result.totalTax, 938);
  assert.ok(later.notes.some((n) => /The child care account on Benefits elections is chosen for 2027, so it is not counted in 2026's tax/.test(n)));
  near(fsa({ dcfsaElect: 2000, planYear: 2027 }).result.credits.careCredit, 1050);
  // in April the page chooses for this year: counted
  assert.equal(fsa({ dcfsaElect: 2000 }, "2026-04-15").inputs.care.benefits, 2000);
  // typed wages are W-2 box 1, which already leaves the account out: nothing more comes off
  const typedW = compute(singleParent((p) => { p.taxes.thisYear = { wages: 57000 }; p.whatIfs = { benefits: { jo: { dcfsaElect: 5000, planYear: 2026 } } }; }), { today: TODAY });
  assert.equal(typedW.inputs.wages, 57000); assert.equal(typedW.inputs.care.benefits, 5000); assert.equal(typedW.result.credits.careCredit, 0);
  // the Benefits page's own rule for the plan year matches this one
  const { DEFAULTS } = await import("../../career/benefits/compute.js");
  assert.equal(ENROLL_FROM_MONTH, DEFAULTS.enrollFromMonth);
});

test("child care account: elected beyond the care is lost, not taxed (Form 2441 line 14); Jo with 1,800 of care and 5,000", () => {
  // 150 a month of care is 1,800: line 12 = 5,000, line 14 (forfeited) = 3,200, line 15 = 1,800, line 25 (excluded) = 1,800,
  // line 26 = 0. Wages 62,000 - 1,800 - 3,200 = 57,000 (the 3,200 is never paid), taxable 32,850, tax 1,770 + 12% x 15,150 =
  // 3,588. The credit: 3,000 - 1,800 = 1,200 of limit, but the care left after the account is 0: none. Less the 2,200 child
  // credit: 1,388 (the reviewer's figure; the app said 1,772, the 3,200 taxed as pay)
  const d = compute(singleParent((p) => { p.expenses[1].amount = 150; p.whatIfs = { benefits: { jo: { dcfsaElect: 5000, planYear: 2026 } } }; }), { today: TODAY });
  const A = d.care.account;
  assert.deepEqual([A.elected, A.forfeited, A.received, A.excluded, A.taxedAsPay], [5000, 3200, 1800, 1800, 0]);
  assert.equal(d.inputs.wages, 57000); assert.equal(d.inputs.medicareWages, 57000);
  near(d.result.incomeTax, 3588); assert.equal(d.result.credits.careCredit, 0); near(d.result.totalTax, 1388);
  assert.ok(d.notes.some((n) => n.startsWith("You would lose $3,200 of the $5,000 in the child care account: only $1,800 of care for a child is on the Expenses page")));
  assert.ok(!d.notes.some((n) => /taxed as wages/.test(n)), "nothing is taxed as wages");
  // the walk has the credit's row at 0 and says the account pays all the care (the reviewer's money #7)
  assert.equal(d.steps.find((s) => s.label === "Child and dependent care credit").sub, "none: your child care account pays all $1,800 of the care, and that money already skips tax; care the account pays cannot count again");
  assert.ok(d.sources.some((x) => x.key === "wages" && /less the \$1,800 child care account, less \$3,200 of it that would be lost/.test(x.detail)));
  // no care on Expenses at all: all 5,000 is lost, wages 57,000, the same 1,388, and the note asks for the care
  const none = compute(singleParent((p) => { p.expenses = p.expenses.filter((x) => x.id !== "care"); p.whatIfs = { benefits: { jo: { dcfsaElect: 5000, planYear: 2026 } } }; }), { today: TODAY });
  assert.equal(none.care.account.forfeited, 5000); assert.equal(none.inputs.wages, 57000); near(none.result.totalTax, 1388);
  assert.ok(none.notes.some((n) => /no care for a child is on the Expenses page. The account only pays back care, so you would lose the \$5,000/.test(n)));
});

test("child care account: the reviewer's case #1 (2025, head of household, 120,000 of pay, 3,000 account, 300 of care)", () => {
  // Form 2441 lines 12 / 14 / 15 / 25 = 3,000 / 2,700 / 300 / 300: wages 117,000; 2025 head of household: standard deduction
  // 23,625, taxable 93,375, tax 1,700 + 12% x 47,850 + 22% x 28,525 = 13,717.50; no care credit (the account pays the 300);
  // less the 2,200 child credit: 11,517.50 (the app said 12,111.50)
  const d = compute(singleParent((p) => {
    p.taxes.year = 2025; p.income[0].amount = 120000; p.expenses[1].amount = 25;
    p.whatIfs = { benefits: { jo: { dcfsaElect: 3000, planYear: 2025 } } };
  }), { today: TODAY });
  const A = d.care.account;
  assert.deepEqual([A.elected, A.forfeited, A.received, A.excluded, A.taxedAsPay, A.limit], [3000, 2700, 300, 300, 0, 5000]);
  assert.equal(d.inputs.wages, 117000); near(d.result.incomeTax, 13717.5); assert.equal(d.result.credits.careCredit, 0); near(d.result.totalTax, 11517.5);
});

test("child care account: separate returns share the care (case #76) and each return has its own 3,750", async () => {
  // case #76: 40,000 with a 2,000 account and 25,000 with a 5,000 account, filing separately; preschool 150 a month May to
  // December = 1,200 of care. The care is shared by the elections (2/7 and 5/7): 342.86 and 857.14; each return keeps that
  // out of income (both under 3,750 and the lower earner's 20,000), 1,200 in all (the app kept 2,400); the rest is lost
  const p = emptyPlan();
  p.household.filingStatus = "married_separate";
  p.household.people = [{ id: "a", name: "Al", role: "self", birthDate: "1990-01-01" }, { id: "b", name: "Bea", role: "partner", birthDate: "1991-01-01" }, { id: "k", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  p.income = [{ id: "pa", name: "Al's pay", type: "salary", personId: "a", amount: 40000, period: "annual", taxable: true }, { id: "pb", name: "Bea's pay", type: "salary", personId: "b", amount: 25000, period: "annual", taxable: true }];
  p.expenses = [{ id: "pre", name: "Preschool", category: "childcare", amount: 150, period: "monthly", startDate: "2026-05-01" }];
  p.whatIfs = { benefits: { a: { dcfsaElect: 2000, planYear: 2026 }, b: { dcfsaElect: 5000, planYear: 2026 } } };
  const d = compute(p, { today: TODAY });
  const A = d.care.account, al = A.people.find((x) => x.id === "a"), bea = A.people.find((x) => x.id === "b");
  near(A.care, 1200); near(A.excluded, 1200); near(A.forfeited, 5800); assert.equal(A.taxedAsPay, 0);
  near(al.excluded, 1200 * 2 / 7); near(bea.excluded, 1200 * 5 / 7);
  const ret = (id) => d.inputs.separate.find((x) => x.personId === id);
  near(ret("a").wages, 38000); near(ret("b").wages, 20000);   // pay less the account's money (kept out, or lost)
  assert.ok(!d.notes.some((n) => /over|taxed as wages/.test(n)));
  // the family filing separately, 3,750 each: with 11,000 of care each return keeps all 3,750 out and nothing is taxed (no
  // "over the limit" note: the 3,750 is each return's); with only 1,800 of care, 900 each stays out and 2,850 each is lost
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const fam = (fn) => { const q = familyPlan(TODAY); q.household.filingStatus = "married_separate"; q.whatIfs = { benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } }; if (fn) fn(q); return compute(q, { today: TODAY }); };
  const full = fam();
  assert.deepEqual(full.care.account.people.map((x) => [x.excluded, x.taxedAsPay, x.forfeited]), [[3750, 0, 0], [3750, 0, 0]]);
  assert.ok(!full.notes.some((n) => /over this year's limit|over the 3,750|taxed as wages/.test(n)), "no false over-the-limit note");
  const small = fam((q) => { q.expenses = q.expenses.filter((x) => !/care/i.test(x.name)).concat([{ id: "c", name: "Daycare", category: "childcare", amount: 150, period: "monthly" }]); });
  assert.deepEqual(small.care.account.people.map((x) => [x.excluded, x.forfeited]), [[900, 2850], [900, 2850]]);
  assert.ok(small.sources.some((x) => x.key === "wages" && /less the \$1,800 child care account, less \$5,700 of it that would be lost/.test(x.detail)));
  // Ana at 5,000 on a separate return: 3,750 stays out, 1,250 is taxed as pay on her return, and the note says so
  const over = fam((q) => { q.whatIfs.benefits["p-ana"].dcfsaElect = 5000; q.whatIfs.benefits["p-bo"].dcfsaElect = 0; });
  assert.deepEqual(over.care.account.people.map((x) => [x.excluded, x.taxedAsPay]), [[3750, 1250], [0, 0]]);
  assert.ok(over.notes.some((n) => n === "Ana's child care account pays $5,000 of care, over the $3,750 a separate return can keep out of income: $1,250 of it is taxed as wages on Ana's return."));
});

test("child care account: the rule by hand (careAccountRule): shared care, the household limit, the lower earner", () => {
  // joint, Ana 5,000 and Bo 5,000, 11,000 of care: 10,000 received, the household limit 7,500 shared 3,750 each, 2,500 taxed
  const j = careAccountRule({ people: [{ id: "a", typed: 5000, earned: 90000, filer: true }, { id: "b", typed: 5000, earned: 60000 }], care: 11000, joint: true, limit: 7500, planMax: 7500 });
  assert.deepEqual([j.received, j.excluded, j.taxedAsPay, j.forfeited, j.overLimit], [10000, 7500, 2500, 0, true]);
  assert.deepEqual(j.people.map((x) => x.excluded), [3750, 3750]);
  // joint with a spouse who earns nothing: none of it stays out (129(b)(1)(B)); it is all taxed as pay
  const z = careAccountRule({ people: [{ id: "a", typed: 5000, earned: 90000, filer: true }, { id: "b", typed: 0, earned: 0 }], care: 11000, joint: true, limit: 7500 });
  assert.deepEqual([z.excluded, z.taxedAsPay, z.earnedCapped], [0, 5000, true]);
  // a single filer: her own earned income (line 18 leaves the account's money out: 6,000 - 2,000 = 4,000 caps it)
  const s1 = careAccountRule({ people: [{ id: "a", typed: 5000, earned: 9000, filer: true }], care: 11000, limit: 7500 });
  assert.deepEqual([s1.excluded, s1.taxedAsPay], [4000, 1000]);
  // separate: each return its own 3,750; the care shared by the elections, never counted twice
  const m = careAccountRule({ people: [{ id: "a", typed: 3750, earned: 90000 }, { id: "b", typed: 3750, earned: 60000 }], care: 1800, separate: true, limit: 3750 });
  assert.deepEqual(m.people.map((x) => [x.care, x.excluded, x.forfeited]), [[900, 900, 2850], [900, 900, 2850]]);
  assert.equal(m.overLimit, false);
});

test("child care account: careAccount reads the same rule for a year; the walk's and the hero's rate share one rounding", () => {
  const p = singleParent((q) => { q.whatIfs = { benefits: { jo: { dcfsaElect: 5000, planYear: 2027 } } }; });
  assert.equal(careAccount(p, { today: TODAY }).excluded, 0, "2026: the account is 2027's");
  const a27 = careAccount(p, { year: 2027, today: TODAY });
  assert.deepEqual([a27.year, a27.elected, a27.excluded, a27.limit], [2027, 5000, 5000, 7500]);
  // 4,268 of 88,000 is exactly 4.85%: "4.9%" in the walk and on the page (the reviewer's page #10: the walk said 4.9%, the
  // hero 4.8%)
  assert.equal(ratePct(4268 / 88000), "4.9%"); assert.equal(ratePct(0.0485), "4.9%"); assert.equal(ratePct(0.05749), "5.7%");
  const high = compute(singleParent((q) => { q.income[0].amount = 88000; }), { today: TODAY });
  near(high.result.totalTax, 4268); assert.match(high.steps.find((s) => s.label === "Federal tax").sub, /^4\.9% of income/);
});

test("care credit: the next dollar's reason is the care credit when it sets the cost (the reviewer's page #5)", () => {
  // 30,000: income tax 585 (5,850 taxable at 10%), a care credit of 44% x 3,000 capped at the 585: more pay, more tax, more
  // credit: the next dollar costs 0, and the credit is the reason (careSets "covers"), not the 10% bracket
  const low = compute(singleParent((p) => { p.income[0].amount = 30000; }), { today: TODAY });
  near(low.result.incomeTax, 585); near(low.result.credits.careCredit, 585); assert.equal(low.nextDollar, 0); assert.equal(low.careSets, "covers");
  near(low.nextDollarNoCare, 0.1, 1e-9);
  // 88,000: the credit getting smaller sets it (13.5 cents over the 12% bracket)
  assert.equal(compute(singleParent((p) => { p.income[0].amount = 88000; }), { today: TODAY }).careSets, "falls");
  // 62,000: the credit does not move it (35% flat to 75,000): the bracket is the reason
  assert.equal(compute(singleParent(), { today: TODAY }).careSets, null);
  // the walk ends below zero when refundable credits are more than the tax, and says so
  assert.equal(low.steps.find((s) => s.label === "Federal tax").sub, "the credits are more than the tax: $1,700 comes back as a refund; the next dollar costs 0¢");
});

test("care credit: a 14-year-old's care is not said to be for the credit (the reviewer's page #8)", () => {
  const teen = compute(singleParent((p) => { p.household.people[1].birthDate = "2012-05-01"; }), { today: TODAY });
  const src = teen.sources.find((x) => x.key === "care");
  assert.ok(!/for the child care credit/.test(src.detail), src.detail);
  assert.equal(src.detail, "Expenses page (Daycare $10,800); it does not count here: the note above says why");
});

test("care credit: a separate return takes each spouse's own child care account off their own wages, up to 3,750", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(TODAY); p.household.filingStatus = "married_separate";
  p.whatIfs = { benefits: { "p-ana": { dcfsaElect: 5000, planYear: 2026 }, "p-bo": { dcfsaElect: 1000, planYear: 2026 } } };
  const d = compute(p, { today: TODAY });
  const ana = d.inputs.separate.find((x) => x.personId === "p-ana"), bo = d.inputs.separate.find((x) => x.personId === "p-bo");
  const q = familyPlan(TODAY); q.household.filingStatus = "married_separate";
  const d0 = compute(q, { today: TODAY });
  const ana0 = d0.inputs.separate.find((x) => x.personId === "p-ana"), bo0 = d0.inputs.separate.find((x) => x.personId === "p-bo");
  near(ana0.wages - ana.wages, 3750); near(bo0.wages - bo.wages, 1000);
  // Medicare wages (box 5): the whole 5,000 election is out of them, not only the 3,750 kept out of income (IRC 3121(a)(18);
  // care fourth pass: the part over the limit is taxed as pay for income tax only, Form 2441 line 26)
  near(ana0.medicareWages - ana.medicareWages, 5000);
  assert.equal(d.result.credits.careCredit, 0, "no credit on a separate return");
  near(d.inputs.wages, ana.wages + bo.wages);
});

test("care credit: names that are care and names that are not (Pub. 503)", () => {
  const is = (name, category = "childcare") => isCare({ name, category });
  for (const n of ["After school care", "After school program", "Before school care", "Pre school", "Kids club after school", "Afterschool", "After-school care", "Preschool tuition", "Nursery school", "Day care", "Daycare", "Childcare and school", "Nanny", "Babysitter", "Au pair", "Summer day camp", "Summer camp", "Care for Kit", "Sitter"]) assert.equal(is(n), true, n);
  for (const n of ["Child support", "Diapers and formula", "Soccer and activities", "Private school", "School tuition", "Kids' tutoring", "Piano lessons", "Summer school", "Overnight camp", "Kindergarten"]) assert.equal(is(n), false, n);
  assert.equal(is("Doggy daycare", "other"), false); assert.equal(is("Dog day care", "pets"), false); assert.equal(is("Adult day care for Mom", "other"), false);
  assert.equal(is("Elder care", "other"), false); assert.equal(is("Garden nursery", "home"), false); assert.equal(is("Nanny", "personal"), true);
  // the reviewer's lines on the single parent's plan, each 0 of credit
  for (const [name, category, amount] of [["Child support", "childcare", 400], ["Diapers and formula", "childcare", 120], ["Soccer and activities", "childcare", 120], ["Doggy daycare", "other", 300], ["Adult day care for Mom", "other", 600]]) {
    const d = compute(singleParent((p) => { p.expenses = [{ id: "x", name, category, amount, period: "monthly" }]; }), { today: TODAY });
    assert.equal(d.result.credits.careCredit, 0, name);
  }
  for (const name of ["After school care", "After school program", "Before school care", "Pre school", "Kids club after school"]) {
    near(compute(singleParent((p) => { p.expenses[1].name = name; }), { today: TODAY }).result.credits.careCredit, 1050);
  }
});

test("care credit: the next dollar's cost does not jump with the credit's steps (over whole steps of 2,000 or 4,000)", async () => {
  // head of household with daycare at 86,500 to 89,500 of pay: in the 2026 phase-down (a point per 2,000 over 75,000) the
  // 1,000 probe lands on a step every other 1,000 (12 or 15 cents); over 2,000 it is 12% + 30 / 2,000 = 13.5 cents each time
  const at = (pay) => compute(singleParent((p) => { p.income[0].amount = pay; }), { today: TODAY });
  for (const pay of [86500, 87500, 88500, 89500]) { const d = at(pay); near(d.nextDollar, 0.12 + 30 / 2000, 1e-9); assert.equal(d.careFalls, true); }
  assert.ok(Math.abs(at(86500).marginal - at(87500).marginal) > 0.02, "the 1,000 probe (marginal, read by other pages) still differs");
  // joint: over 4,000 (one step of 30 on one child's 3,000); `marginal` stays the 1,000 probe's 22%
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const d = compute(familyPlan(TODAY), { today: TODAY });
  near(d.nextDollar, 0.22 + 30 / 4000, 1e-9); near(d.marginal, 0.22, 1e-9);
  // no care: the same figure as before
  const none = compute(singleParent((p) => { p.expenses = []; }), { today: TODAY });
  assert.equal(none.nextDollar, none.marginal); assert.equal(none.careFalls, false);
});

test("care credit: careInputsWith works the account's rule and the lower earner again for a what-if", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const ti = taxInputs(familyPlan(TODAY), { today: TODAY });
  const bo = ti.care.earnedPeople.find((x) => x.id === "p-bo");
  const same = careInputsWith(ti);
  assert.deepEqual({ expenses: same.expenses, persons: same.persons, benefits: same.benefits, earnedLow: same.earnedLow }, ti.inputs.care); assert.equal(same.wagesChange, 0);
  assert.equal(careInputsWith(ti, { "p-bo": { pay: 0, business: 0 } }).earnedLow, 0);
  near(careInputsWith(ti, { "p-bo": { pay: 1000 } }).earnedLow, 1000 + bo.business, 1e-9);
  // Ana's 5,000 account: with Bo at no pay none of it stays out (wages up 5,000 against the plan where it does)
  const p = familyPlan(TODAY); p.whatIfs = { benefits: { "p-ana": { dcfsaElect: 5000, planYear: 2026 } } };
  const t5 = taxInputs(p, { today: TODAY });
  assert.equal(t5.care.account.excluded, 5000);
  const zero = careInputsWith(t5, { "p-bo": { pay: 0, business: 0 } });
  // the plan has 5,000 off wages; with Bo at 0 none of it stays out: taxed as pay, so the wages go back up by 5,000
  assert.deepEqual([zero.benefits, zero.wagesChange, zero.account.taxedAsPay, zero.account.off], [0, 5000, 5000, 0]);
  // elections in place of the plan's: none
  const none = careInputsWith(t5, {}, {});
  assert.deepEqual([none.benefits, none.wagesChange], [0, 5000]);
  assert.equal(careInputsWith({ inputs: {} }), null);
});

// --- care fourth pass (2026-11-02) ------------------------------------------------------------------------------------------
/** A stand-in for the UI kit: text only, enough to read what a view says. */
function stubUi() {
  const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, querySelector() { return null; }, scrollIntoView() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  return { node, ui: { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form"), field: (l, c, help) => node("field", [l, c, help]), moneyBox: () => ({ box: node("money"), input: node("input") }), moneyValue: () => null } };
}
async function pageText(plan, today = TODAY) {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const { node, ui } = stubUi();
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update() {} } });
  return root.textContent.replace(/\s+/g, " ");
}

test("care fourth pass: the whole election is out of Medicare wages; only income tax adds back the part over the household's limit (oracle #243)", () => {
  // 2026 joint: 260,000 of pay with 9,000 typed (a plan takes 7,500) and 80,000 with 7,500; 20,400 of care for one child.
  // W-2 box 5 leaves out each plan's 7,500 (IRC 3121(a)(18); box 10 instructions): Medicare wages 340,000 - 15,000 = 325,000,
  // and the 0.9% is 0.9% x 75,000 = 675.00 (the page said 742.50, worked on 332,500). For income tax only 7,500 stays out
  // (Form 2441 line 26): wages 332,500
  const p = emptyPlan();
  p.household.filingStatus = "married_joint";
  p.household.people = [{ id: "pa", name: "Pat", role: "self", birthDate: "1988-06-15" }, { id: "pb", name: "Sam", role: "partner", birthDate: "1989-06-15" }, { id: "k0", name: "Kid", role: "dependent", birthDate: "2023-10-27" }];
  p.income = [{ id: "pay-pa", name: "Pay", personId: "pa", type: "salary", amount: 260000, period: "annual", growth: 0, taxable: true }, { id: "pay-pb", name: "Pay", personId: "pb", type: "salary", amount: 80000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "x0", name: "Nanny", category: "childcare", period: "monthly", amount: 1400, startDate: "", endDate: "" }, { id: "x1", name: "Preschool", category: "childcare", period: "monthly", amount: 400, startDate: "2026-04-01", endDate: "" }];
  p.whatIfs = { benefits: { pa: { dcfsaElect: 9000, planYear: 2026 }, pb: { dcfsaElect: 7500, planYear: 2026 } } };
  p.taxes = { ...(p.taxes ?? {}), year: 2026 };
  const d = compute(p, { today: "2026-02-02" });
  assert.equal(d.inputs.medicareWages, 325000); assert.equal(d.inputs.wages, 332500);
  near(d.result.additionalMedicare, 675, 1e-9);
  // on a separate return each spouse's own whole election (Ana's 5,000, not the 3,750 kept out of income): the separate-return test above
});

test("care fourth pass: the household's excess over the limit is split by the elections, and the note says the split", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(TODAY); p.whatIfs = { benefits: { "p-ana": { dcfsaElect: 5000, planYear: 2026 }, "p-bo": { dcfsaElect: 3000, planYear: 2026 } } };
  const d = compute(p, { today: TODAY });
  const A = d.care.account;
  near(A.taxedAsPay, 500, 1e-9);
  near(A.people.find((x) => x.id === "p-ana").taxedAsPay, 312.5, 1e-9); near(A.people.find((x) => x.id === "p-bo").taxedAsPay, 187.5, 1e-9);
  assert.ok(d.notes.some((n) => n.includes("$500 of it is taxed as wages (Ana $313, Bo $188, by what each put in)")), d.notes.join(" | "));
  // the walk names both accounts and what they pay (it said "the 7,500 your child care account pays")
  const row = d.steps.find((s) => s.label === "Child and dependent care credit");
  assert.equal(row.amount, 0);
  assert.equal(row.sub, "none: Ana's and Bo's child care accounts pay $8,000 of the care ($7,500 of it free of tax), more than the $3,000 limit for one child");
  // one account keeps its words
  const one = familyPlan(TODAY); one.whatIfs = { benefits: { "p-ana": { dcfsaElect: 5000, planYear: 2026 } } };
  assert.match(compute(one, { today: TODAY }).steps.find((s) => s.label === "Child and dependent care credit").sub, /^none: the \$5,000 your child care account pays is more than the \$3,000 limit for one child/);
});

test("care fourth pass: a separate return has no 'for the child care credit' labels; an account with no care says its money would be lost", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const mfs = familyPlan(TODAY); mfs.household.filingStatus = "married_separate";
  const d = compute(mfs, { today: TODAY });
  const care = d.sources.find((s) => s.key === "care");
  assert.ok(!/for the child care credit/.test(care.detail), care.detail);
  assert.match(care.detail, /a separate return gets no child care credit for it/);
  const text = await pageText(mfs);
  assert.ok(!text.includes("for the child care credit"), text.match(/.{80}for the child care credit.{40}/)?.[0]);
  assert.ok(text.includes("1 under 13 at the end of the year. Filing married filing separately"));
  // the joint return keeps them
  assert.ok((await pageText(familyPlan(TODAY))).includes("1 under 13 at the end of the year, for the child care credit"));
  // Jo with a 5,000 account and no care on Expenses: no promise of a credit (with the account it stays 0); the account's money
  // would be lost (the page said "Add it on Expenses and the child care credit comes off your tax")
  const noCare = singleParent((p) => { p.expenses = p.expenses.filter((x) => x.id !== "care"); p.whatIfs = { benefits: { jo: { dcfsaElect: 5000, planYear: 2026 } } }; });
  const t = await pageText(noCare);
  assert.ok(t.includes("Paying for child care so you can work? Add it on Expenses: the child care account pays it back. With no care to pay, the $5,000 in the account would be lost."), t.match(/Paying for child care.{200}/)?.[0]);
  assert.ok(!t.includes("the child care credit comes off your tax"));
  assert.ok(!t.includes("Care the account does not pay can still count"), "5,000 uses up the 3,000 limit for one child");
  // a smaller account leaves room under the 3,000: care it does not pay can still count
  const small = singleParent((p) => { p.expenses = p.expenses.filter((x) => x.id !== "care"); p.whatIfs = { benefits: { jo: { dcfsaElect: 1000, planYear: 2026 } } }; });
  assert.ok((await pageText(small)).includes("Care the account does not pay can still count for the child care credit."));
  // no account: the credit hint as before
  const plain = singleParent((p) => { p.expenses = p.expenses.filter((x) => x.id !== "care"); });
  assert.ok((await pageText(plain)).includes("Add it on Expenses and the child care credit comes off your tax."));
});

test("care fourth pass: the Federal estimate's two returns add up to the tax above, the business's tax on its owner's return", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(TODAY); p.household.filingStatus = "married_separate";
  p.whatIfs = { benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } };
  const text = await pageText(p);
  // the hero says 14,282 (the law), and the returns 7,765 + 6,518 (Bo's 5,500 of income tax and 1,017 of self-employment tax)
  assert.ok(text.includes("About $14,282 of federal tax for 2026"), text.slice(0, 300));
  assert.ok(text.includes("Ana's return $7,765"), text.match(/Two returns.{300}/)?.[0]);
  assert.ok(text.includes("Bo's return $6,518"));
  assert.ok(text.includes("with the business on this return: $5,500 of income tax and $1,017 of self-employment tax"));
});

test("care fourth pass: one next-dollar figure (nextDollarOf) for the Federal estimate, Brackets and the Tax report", async () => {
  const { nextDollarOf } = await import("./compute.js");
  const { compute: brackets } = await import("../brackets/compute.js");
  const { compute: report } = await import("../../reports/tax/compute.js");
  // Jo at 88,000: the 12% bracket and 30 of credit lost for each 2,000 over 75,000 (IRC 21(a)(2)): 13.5 cents, "14%"; the
  // 1,000 probe (`marginal`) says 12%
  const p = singleParent((q) => { q.income[0].amount = 88000; });
  const d = compute(p, { today: TODAY });
  near(d.nextDollar, 0.135, 1e-9); near(d.marginal, 0.12, 1e-9);
  near(nextDollarOf(d.inputs, d.params), d.nextDollar, 1e-12);
  near(brackets(p, { today: TODAY }).marginal, d.nextDollar, 1e-12);
  // Brackets says why the next dollar is above the bracket: the child care credit getting smaller, as the Federal estimate
  // says (it said "benefits or gains get pulled along"); without the care the same income's next dollar is the bracket's
  assert.equal(brackets(p, { today: TODAY }).careMoves, true);
  const { render: bracketsView } = await import("../brackets/view.js");
  const fmt = await import("../../../core/format.js");
  const { node, ui } = stubUi();
  const anyUi = new Proxy(ui, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => typeof x !== "object" || (x && "kids" in x)))) });
  const root = node("root");
  bracketsView(root, { ui: anyUi, fmt: { ...fmt, today: () => TODAY }, plan: p, store: { update() {} } });
  const text = root.textContent.replace(/\s+/g, " ");
  assert.ok(text.includes("14% more than the bracket rate, because the child care credit also shrinks"), text.slice(0, 600));
  const noCare = singleParent((q) => { q.income[0].amount = 88000; q.expenses = (q.expenses ?? []).filter((x) => x.category !== "childcare"); });
  assert.equal(brackets(noCare, { today: TODAY }).careMoves, false);
  const r = report(p, { today: TODAY });
  near(r.thisYear.nextDollar, d.nextDollar, 1e-12); near(r.thisYear.marginal, d.nextDollar, 1e-12);
  assert.equal(ratePct(r.thisYear.effectiveRate), "4.9%");
});

test("Review 2026-11-06: the Two returns card says the business owner's own taxable income and bracket (Bo: 48,653, the 12% bracket)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  // the family filing separately, Ana 5,000 + Bo 3,000 in child care accounts. Bo's return with his photography at its
  // profit, half its self-employment tax and its 20% deduction off taxes 48,653, in the 12% bracket; the card said
  // "$50,500 taxed ... the 22% bracket" (the business counted in full as ordinary income)
  const p = familyPlan(TODAY); p.household.filingStatus = "married_separate";
  p.whatIfs = { benefits: { "p-ana": { dcfsaElect: 5000, planYear: 2026 }, "p-bo": { dcfsaElect: 3000, planYear: 2026 } } };
  const text = await pageText(p);
  const bo = text.match(/Bo's return .{0,320}/)?.[0] ?? "";
  assert.ok(bo.includes("$48,653 taxed"), bo); assert.ok(bo.includes("the 12% bracket"), bo); assert.ok(!bo.includes("$50,500 taxed"), bo);
  // 3,750 each: 47,903
  p.whatIfs.benefits = { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } };
  assert.ok((await pageText(p)).match(/Bo's return .{0,320}/)?.[0].includes("$47,903 taxed"));
});

test("Review 2026-11-06: filing separately, the Federal estimate says each return's own refund or bill (not \"you would get about $540 back\")", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  // the family filing separately, 3,750 each, withholding estimated from pay: Ana's own return gets 2,200 back, Bo's owes
  // 1,659.70 (withholding byReturn); the household's two added up is the 540.30 refund the page said
  const p = familyPlan(TODAY); p.household.filingStatus = "married_separate";
  p.whatIfs = { benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } };
  const text = await pageText(p);
  assert.ok(text.includes("Filing separately, each return settles on its own: Ana would get about $2,200 back, and Bo would owe about $1,660."), text.slice(0, 900));
  assert.ok(!text.includes("you would get about $540 back"));
  assert.ok(text.includes("Fix it in your paychecks"), "Bo's bill makes the paycheck fix the main button");
});

// --- Review 2026-11-06 (verifier) ------------------------------------------------------------------------------------------
test("Review 2026-11-06 (verifier): the 0-cent next dollar names the child care credit as more than the tax only when it is", async () => {
  // Lee: head of household, 45,000, two children under 13, 10,800 of care. Income tax 2,148; the care credit 35% x 6,000 =
  // 2,100, less than the tax; the child tax credit takes the 48 left and 3,400 comes back. More pay costs 0 (the refundable part
  // stays at its most, 2 x 1,700) only because the care credit leaves so little tax: careSets "covers". The page said "the child
  // care credit is more than the tax", which is false (2,100 < 2,148): the credits together are
  const lee = singleParent((p) => {
    p.income[0].amount = 45000;
    p.household.people.push({ id: "kid2", name: "Ned", role: "dependent", birthDate: "2018-06-01" });
    p.expenses.find((x) => x.id === "care").amount = 600;
    p.expenses.push({ id: "as", name: "After-school care", category: "childcare", amount: 300, period: "monthly" });
  });
  const d = compute(lee, { today: TODAY });
  near(d.result.incomeTax, 2148); near(d.result.credits.careCredit, 2100); near(d.result.totalTax, -3400);
  assert.equal(d.nextDollar, 0); assert.equal(d.careSets, "covers");
  const t = await pageText(lee);
  assert.ok(!t.includes("the child care credit is more than the tax"), t.slice(0, 700));
  assert.ok(t.includes("costs 0 cents (with the child care credit, your credits are more than the tax, so they cover the tax on more pay too)"), t.slice(0, 700));
  assert.ok(t.includes("the credits cover it") && !t.includes("the child care credit covers it"));
  // Jo at 30,000: the care credit (44% of 3,000, held to the 585 of tax) is the whole tax: the original words are true
  const t30 = await pageText(singleParent((p) => { p.income[0].amount = 30000; }));
  assert.ok(t30.includes("(the child care credit is more than the tax, so it covers the tax on more pay too)"), t30.slice(0, 700));
  assert.ok(t30.includes("the child care credit covers it"));
});

test("Review 2026-11-06 (verifier): filing separately with no paychecks, the hero says what each return owes, not 'about right'", async () => {
  // Gus 90,000 and Hal 30,000 of business profit, filing separately, nothing withheld, 3,000 paid in the 1st quarter. The
  // returns' verdicts are "unknown" (no paycheck figure), but with no pay nothing is withheld, so each balance is known: Gus
  // owes about 14,813 and Hal 4,484 (Estimated payments says the same). The hero said "Gus's is about right, and Hal's is
  // about right"
  const p = emptyPlan();
  p.household.filingStatus = "married_separate"; p.household.state = "TX";
  p.household.people = [{ id: "g", name: "Gus", role: "self", birthDate: "1984-04-04" }, { id: "h", name: "Hal", role: "partner", birthDate: "1986-06-06" }, { id: "k", name: "Bea", role: "dependent", birthDate: "2025-03-03" }];
  p.income = [{ id: "b1", name: "Gus's design work", type: "business", personId: "g", amount: 90000, period: "annual", growth: 0, taxable: true }, { id: "b2", name: "Hal's tutoring", type: "business", personId: "h", amount: 30000, period: "annual", growth: 0, taxable: true }];
  p.taxes = { ...(p.taxes ?? {}), year: 2026, estimated: { paid: [3000, 0, 0, 0], typedAt: "2026-04-10" } };
  const { taxAnswer } = await import("../withholding/compute.js");
  const a = taxAnswer(p, { today: TODAY });
  assert.equal(a.from, "none"); assert.equal(a.returns.length, 2);
  const t = await pageText(p);
  assert.ok(!/is about right/.test(t), t.slice(0, 900));
  for (const x of a.returns) assert.ok(x.balance > 1000 && t.includes(`${x.name} would owe about $${Math.round(x.balance).toLocaleString("en-US")}`), t.slice(0, 900));
});

test("Review 2026-11-06: no child care credit because a spouse (or the filer) has no earned income says why (IRC 21(d))", async () => {
  // Kim & Lou file jointly: Kim earns 70,000, Lou has no pay; 10,800 of daycare for Kit. The care counts only up to the lower
  // earned income (21(d)(1)(B)), 0, so the credit is 0, and the page gave no reason (verifier follow-up)
  const kl = emptyPlan(); kl.household.filingStatus = "married_joint"; kl.household.state = "OH";
  kl.household.people = [{ id: "kim", name: "Kim", role: "self", birthDate: "1990-01-01" }, { id: "lou", name: "Lou", role: "partner", birthDate: "1991-01-01" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  kl.income = [{ id: "pay", name: "Kim's pay", type: "salary", personId: "kim", amount: 70000, period: "annual", growth: 0, taxable: true }];
  kl.expenses = [{ id: "care", name: "Daycare", category: "childcare", amount: 900, period: "monthly" }];
  const d = compute(kl, { today: TODAY });
  assert.equal(d.result.credits.careCredit, 0); assert.equal(d.care.earnedLow, 0);
  const note = d.notes.find((n) => /no child care credit/.test(n));
  assert.ok(note && note.includes("Lou has no pay or business income on the Income page") && note.includes("$250 a month for one child"), d.notes.join(" | "));
  assert.ok((await pageText(kl)).includes("Lou has no pay or business income"));
  // with a 5,000 child care account on Kim's pay, none of it stays out of income (129(b): the lower earned income, 0): "None
  // of", where the note read "Only 0 of the 5,000 child care account stays out of income"
  const acct = structuredClone(kl); acct.whatIfs = { benefits: { kim: { dcfsaElect: 5000, planYear: 2026 } } };
  const da = compute(acct, { today: TODAY });
  assert.ok(da.notes.some((n) => n.startsWith("None of the $5,000 child care account stays out of income: no more than the lower earner's earned income (Lou has none).")) && !da.notes.some((n) => n.startsWith("Only 0 ")), da.notes.join(" | "));
  // the same household with Lou earning 20,000: the credit is there, no such note
  const both = structuredClone(kl); both.income.push({ id: "p2", name: "Lou's pay", type: "salary", personId: "lou", amount: 20000, period: "annual", growth: 0, taxable: true });
  const d2 = compute(both, { today: TODAY });
  assert.ok(d2.result.credits.careCredit > 0 && !d2.notes.some((n) => /no child care credit/.test(n)));
  // a single parent with a pension only: no earned income of their own
  const pen = singleParent((p) => { p.income = [{ id: "pen", name: "Jo's pension", type: "pension", personId: "jo", amount: 40000, period: "annual", growth: 0, taxable: true }]; });
  const d3 = compute(pen, { today: TODAY });
  assert.equal(d3.result.credits.careCredit, 0);
  assert.ok(d3.notes.some((n) => n.includes("only up to your earned income") && n.includes("no child care credit")), d3.notes.join(" | "));
});

test("Review 2026-11-06 (verifier): a bracket's edge inside the care credit's step is not averaged into the next dollar", async () => {
  // Pat 91,000 + Sam 40,000 filing jointly, Ivy (2) in daycare at 1,400 a month. Taxable 98,800: 2,000 of room left in the
  // 12% bracket (22% from 100,800). The care credit is 35% x 3,000 = 1,050 and stays there to 150,000 of AGI (the 35% floor,
  // IRC 21(a)(2) as the 2025 law has it), so it does not move the next dollar: the next 2,000 cost 12 cents each, then 22.
  // Worked over the whole 4,000 step the page read "17 cents", with "benefits or gains get pulled along" (Federal) and "the
  // child care credit gets smaller" (Brackets), and the Tax report "pays 17%; $2,000 more ... fits in the 12% bracket".
  // The fix: the 1,000 probe without the credit, plus the credit's own effect over its whole steps (nextDollarOf)
  const { nextDollarOf } = await import("./compute.js");
  const { compute: brackets } = await import("../brackets/compute.js");
  const { compute: report } = await import("../../reports/tax/compute.js");
  const p = emptyPlan(); p.household.filingStatus = "married_joint"; p.household.state = "TX";
  p.household.people = [{ id: "pat", name: "Pat", role: "self", birthDate: "1988-01-01" }, { id: "sam", name: "Sam", role: "partner", birthDate: "1989-03-03" }, { id: "ivy", name: "Ivy", role: "dependent", birthDate: "2024-02-01" }];
  p.income = [{ id: "p1", name: "Pat's pay", type: "salary", personId: "pat", amount: 91000, period: "annual", growth: 0, taxable: true }, { id: "p2", name: "Sam's pay", type: "salary", personId: "sam", amount: 40000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "care", name: "Daycare", category: "childcare", amount: 1400, period: "monthly" }];
  const d = compute(p, { today: TODAY });
  near(d.result.taxableIncome, 98800); near(d.result.credits.careCredit, 1050);
  near(d.nextDollar, 0.12, 1e-9); assert.equal(d.careSets, null); near(d.nextDollarNoCare, 0.12, 1e-9);
  near(nextDollarOf(d.inputs, d.params), 0.12, 1e-9);
  const b = brackets(p, { today: TODAY });
  near(b.marginal, 0.12, 1e-9); assert.equal(b.careMoves, false);
  near(report(p, { today: TODAY }).thisYear.nextDollar, 0.12, 1e-9);
  const t = await pageText(p);
  assert.ok(t.includes("the next dollar you earn costs 12 cents (the 12% rate, $2,000 of room left before it goes up)"), t.slice(0, 600));
  assert.ok(!t.includes("benefits or gains get pulled along"), t.slice(0, 900));
  // the care credit's own steps still count where it moves: Jo at 88,000 is 13.5 cents, Jo at 30,000 0, the family 22.75
  near(compute(singleParent((q) => { q.income[0].amount = 88000; }), { today: TODAY }).nextDollar, 0.135, 1e-9);
  assert.equal(compute(singleParent((q) => { q.income[0].amount = 30000; }), { today: TODAY }).nextDollar, 0);
  // a joint return where the credit is 0 (no earned income on the lower side) and the refundable child tax credit's limit sits
  // inside the step: the credit moves nothing, so Brackets does not name it (it read "the child care credit covers part of the
  // tax on more pay" at 9 cents; the 1,000 probe, 6 cents, is the figure without care too)
  const zero = structuredClone(p); zero.income = [{ ...p.income[1], amount: 46800 }];
  zero.household.people.push({ id: "k2", name: "Sol", role: "dependent", birthDate: "2016-04-01" }, { id: "k3", name: "Mia", role: "dependent", birthDate: "2019-12-24" });
  const dz = compute(zero, { today: TODAY });
  assert.equal(dz.result.credits.careCredit, 0); assert.equal(dz.careSets, null); near(dz.nextDollar, dz.nextDollarNoCare, 1e-9);
  assert.equal(brackets(zero, { today: TODAY }).careMoves, false);
});

// --- Review 2026-11-06 (fix round 6) --------------------------------------------------------------------------------------
test("Review 2026-11-06: pay that ended this year or is one-time is 'not counted for 2026', not 'none is on the Income page' (IRC 21(d))", async () => {
  const { uncountedEarned, uncountedWords } = await import("./compute.js");
  const today = "2026-09-15";
  // H-0221: Dana, head of household, two children, 650 a month of after-school care; her pay (3,300 every two weeks) ended
  // August 15. The engine counts a year of what is coming in today, so none of her pay is counted: the note said "none is
  // on the Income page", which is false
  const dana = emptyPlan(); dana.household.filingStatus = "head_of_household"; dana.household.state = "GA";
  dana.household.people = [{ id: "d", name: "Dana", role: "self", birthDate: "1985-08-30" }, { id: "l", name: "Leo", role: "dependent", birthDate: "2014-03-12" }, { id: "n", name: "Nia", role: "dependent", birthDate: "2018-11-02" }];
  dana.income = [{ id: "pay", name: "Dana's pay", type: "salary", personId: "d", amount: 3300, period: "biweekly", growth: 0.03, taxable: true, endDate: "2026-08-15" }];
  dana.expenses = [{ id: "care", name: "After-school care", category: "childcare", amount: 650, period: "monthly" }];
  const d = compute(dana, { today });
  assert.equal(d.result.income.wages, 0, "the engine counts no ended pay (unchanged)"); assert.equal(d.result.credits.careCredit, 0);
  const care = d.notes.find((n) => /no child care credit/.test(n));
  assert.equal(care, "Child care counts for the child care credit only up to your earned income (pay or business profit), and none is counted for 2026, so this estimate has no child care credit. To count what was paid this year, type it as Wages this year below.");
  assert.ok(d.notes.includes("Nothing on the Income page is counted for 2026. Dana's pay ended on August 15, 2026; this estimate counts only pay coming in today. The estimate is built from what you type below."), d.notes.join(" | "));
  assert.ok(!d.notes.some((n) => /none is on the Income page|Nothing on the Income page yet/.test(n)), d.notes.join(" | "));
  assert.deepEqual(uncountedEarned({ items: [{ type: "salary", personId: "d", amount: 3300, period: "biweekly", active: false, ended: true, endDate: "2026-08-15" }] }, dana.household.people, 2026),
    [{ personId: "d", name: "Dana", what: "pay", why: "ended", date: "2026-08-15", amount: 3300, inYear: true }]);
  // pay that ended in an earlier year (H-0368: Jen's ended 2020-01-01) is still "not counted for 2026", but is not named as
  // the reason, and no hint to type this year's wages is given for it
  const gone = structuredClone(dana); gone.income[0].endDate = "2020-01-01";
  const dg = compute(gone, { today });
  assert.ok(dg.notes.includes("Child care counts for the child care credit only up to your earned income (pay or business profit), and none is counted for 2026, so this estimate has no child care credit."), dg.notes.join(" | "));
  assert.ok(dg.notes.includes("Nothing on the Income page is counted for 2026. The estimate is built from what you type below."), dg.notes.join(" | "));
  // typed wages count for the year: the credit is worked on them and both notes go
  const typed = structuredClone(dana); typed.taxes.thisYear.wages = 52800;
  const dt = compute(typed, { today });
  assert.ok(dt.result.credits.careCredit > 0 && !dt.notes.some((n) => /counted for 2026/.test(n)), dt.notes.join(" | "));
  // H-0319: Carlos's 119,600 is "once" (no yearly amount); Jen earns 3,900 a month; Ana is 3, 1,300 a month of daycare
  const cj = emptyPlan(); cj.household.filingStatus = "married_joint"; cj.household.state = "TX";
  cj.household.people = [{ id: "c", name: "Carlos", role: "self", birthDate: "1987-01-20" }, { id: "j", name: "Jen", role: "partner", birthDate: "1988-07-07" }, { id: "a", name: "Ana", role: "dependent", birthDate: "2023-05-05" }];
  cj.income = [{ id: "c1", name: "Carlos's pay", type: "salary", personId: "c", amount: 119600, period: "once", taxable: true }, { id: "j1", name: "Jen's pay", type: "salary", personId: "j", amount: 3900, period: "monthly", growth: 0, taxable: true }];
  cj.expenses = [{ id: "dc", name: "Daycare (Ana)", category: "childcare", amount: 1300, period: "monthly" }];
  const c = compute(cj, { today });
  const cn = c.notes.find((n) => /no child care credit/.test(n));
  assert.ok(cn.startsWith("Filing jointly, child care counts for the child care credit only up to the lower of your two earned incomes, and Carlos has no pay or business income counted for 2026, so this estimate has no child care credit. Carlos's $119,600 of pay is one-time; this estimate counts no one-time pay. (A spouse"), cn);
  assert.ok(!/Income page/.test(cn) && !/Wages this year/.test(cn), "on a joint return typed wages are shared by pay, so no such hint");
  // with a 5,000 child care account on Jen's pay: "(Carlos has none counted for 2026)", not "(Carlos has none)"
  const acct = structuredClone(cj); acct.whatIfs = { benefits: { j: { dcfsaElect: 5000, planYear: 2026 } } };
  assert.ok(compute(acct, { today }).notes.some((n) => n.startsWith("None of the $5,000 child care account stays out of income: no more than the lower earner's earned income (Carlos has none counted for 2026).")));
  // pay that starts later, and the words for several lines
  assert.equal(uncountedWords([{ name: "Sam", what: "pay", why: "starts", date: "2027-01-04" }]), "Sam's pay starts on January 4, 2027; this estimate counts only pay coming in today.");
  assert.equal(uncountedWords([{ name: "Sam", what: "pay", why: "ended", date: "2026-03-31" }, { name: "Sam", what: "bonus", why: "once", amount: 5000 }]), "Sam's pay ended on March 31, 2026 and Sam's $5,000 of bonus is one-time; this estimate counts only pay coming in today, and no one-time pay.");
  assert.equal(uncountedWords([]), "");
  // a single person whose only pay is one-time (H-0019): not "Nothing on the Income page yet"
  const once = emptyPlan(); once.household.people = [{ id: "m", name: "Maya", role: "self", birthDate: "1997-05-04" }];
  once.income = [{ id: "m1", name: "Maya's pay", type: "salary", personId: "m", amount: 63700, period: "once", taxable: true }];
  assert.ok(compute(once, { today }).notes.includes("Nothing on the Income page is counted for 2026. Maya's $63,700 of pay is one-time; this estimate counts no one-time pay. The estimate is built from what you type below."));
  // truly nothing on the Income page keeps its words (Kim & Lou's "on the Income page" is covered above)
  assert.ok(compute(emptyPlan(), { today }).notes.includes("Nothing on the Income page yet: the estimate is built from what you type below."));
});

// --- Review 2026-11-06 (round 7): "you" for the first adult Get started left unnamed ("Me") ---------------------------------
test("Review 2026-11-06 (round 7): the notes and the page say you/your for the unnamed first adult; typed names as before", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { uncountedWords } = await import("./compute.js");
  const unnamed = (fn) => { const q = familyPlan(TODAY); q.household.people.find((x) => x.id === "p-ana").name = "Me"; q.household.people.find((x) => x.id === "p-bo").name = "My spouse"; if (fn) fn(q); return q; };
  // filing separately: "two returns: yours and your spouse's", the child "on your return" or "on your spouse's return"
  const mfs = unnamed((q) => { q.household.filingStatus = "married_separate"; });
  const d = compute(mfs, { today: TODAY });
  assert.ok(d.notes.some((n) => /^Filing separately is two returns: (yours and your spouse's|your spouse's and yours), each with their own pay/.test(n) && /on (your|your spouse's) return\.$/.test(n)), d.notes.join(" | "));
  const named = familyPlan(TODAY); named.household.filingStatus = "married_separate";
  assert.ok(compute(named, { today: TODAY }).notes.some((n) => /^Filing separately is two returns: Ana's and Bo's, each with their own pay/.test(n)));
  const text = await pageText(mfs);
  assert.ok(text.includes("Your spouse's return") && text.includes("Your return"), text.slice(0, 900));
  assert.ok(!/\bMe's\b|\bMe (would|earns)\b|My spouse/.test(text), text.match(/.{60}(Me's|Me would|Me earns|My spouse).{60}/)?.[0]);
  // a separate return's child care account over the 3,750: "Your child care account ... on your return"
  const over = compute(unnamed((q) => { q.household.filingStatus = "married_separate"; q.whatIfs = { benefits: { "p-ana": { dcfsaElect: 5000, planYear: 2026 }, "p-bo": { dcfsaElect: 0, planYear: 2026 } } }; }), { today: TODAY });
  assert.ok(over.notes.some((n) => n === "Your child care account pays $5,000 of care, over the $3,750 a separate return can keep out of income: $1,250 of it is taxed as wages on your return."), over.notes.join(" | "));
  // pay not counted this year
  assert.equal(uncountedWords([{ name: "Me", what: "pay", why: "ended", date: "2026-03-31" }]), "Your pay ended on March 31, 2026; this estimate counts only pay coming in today.");
  assert.equal(uncountedWords([{ name: "My spouse", what: "bonus", why: "once", amount: 5000 }]), "Your spouse's $5,000 of bonus is one-time; this estimate counts no one-time pay.");
  // a spouse with no earned income on a joint return: "you have no pay", not "Me has no pay"
  const kl = emptyPlan(); kl.household.filingStatus = "married_joint"; kl.household.state = "OH";
  kl.household.people = [{ id: "kim", name: "My spouse", role: "partner", birthDate: "1990-01-01" }, { id: "lou", name: "Me", role: "self", birthDate: "1991-01-01" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  kl.income = [{ id: "pay", name: "My spouse's pay", type: "salary", personId: "kim", amount: 70000, period: "annual", growth: 0, taxable: true }];
  kl.expenses = [{ id: "care", name: "Daycare", category: "childcare", amount: 900, period: "monthly" }];
  assert.ok(compute(kl, { today: TODAY }).notes.some((n) => n.includes("and you have no pay or business income on the Income page")));
  const acct = structuredClone(kl); acct.whatIfs = { benefits: { kim: { dcfsaElect: 5000, planYear: 2026 } } };
  assert.ok(compute(acct, { today: TODAY }).notes.some((n) => n.startsWith("None of the $5,000 child care account stays out of income: no more than the lower earner's earned income (you have none).")));
});

// ---- round 8, Batch 1: the page's figures count what the plan already knows (known.js). compute().result and steps stay as
// the answer keys check them; the page, Withholding check and Estimated payments read known(). The households are in
// qa/fixtures/round8-households.mjs, their figures worked by hand in the README ("What the plan already knows (round 8)").
const R8 = "2026-11-06";
const H8 = () => import("../../../qa/fixtures/round8-households.mjs");
const K8 = () => import("./known.js");
const near8 = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("round 8 item 20 (freelancer-4): the business at its profit: AGI 69,489, taxable 42,711, income tax 4,877, the 12% bracket, 15,898 in all", async () => {
  const { freelancerPlan } = await H8(), { known } = await K8();
  const p = freelancerPlan(), d = compute(p, { today: R8 }), k = known(p, { today: R8 });
  // the keys' return keeps the business at its gross: AGI 78,000 less the 3,000 IRA
  assert.equal(d.result.agi, 75000); assert.equal(d.result.bracketRate, 0.22);
  // 78,000 less half the self-employment tax (15.3% x 92.35% x 78,000 / 2 = 5,510.52) less the IRA 3,000
  near8(k.result.agi, 78000 - 5510.5245 - 3000);
  // less the 16,100 standard deduction and the 20% business deduction: 20% of (78,000 - 5,510.52) = 14,497.90, capped at
  // 20% of 53,389.48 = 10,677.90
  near8(k.result.deduction.qbi, 0.2 * (69489.4755 - 16100)); near8(k.result.taxableIncome, 42711.58);
  near8(k.result.incomeTax, 1240 + 0.12 * (42711.58 - 12400)); assert.equal(k.result.bracketRate, 0.12);
  near8(k.seTax, 0.153 * 0.9235 * 78000); near8(k.total, 4877.39 + 11021.05);
  const labels = k.steps.map((s) => s.label);
  assert.ok(labels.includes("Business deduction (20%)") && labels.includes("Self-employment tax"));
  assert.ok(!labels.includes("Tax saved by business deductions"), "the patch line is gone");
  assert.match(k.steps.find((s) => s.label === "Adjustments").sub, /half the self-employment tax \$5,511, IRA \$3,000/);
  // the income is named by where it comes from, not "other ordinary" (the keys' walk keeps its own words)
  assert.equal(k.steps.find((s) => s.label === "Income").sub, "business profit $78,000");
  near8(k.steps.at(-2).amount, k.total); assert.equal(k.steps.at(-2).label, "Federal tax");
  // the walk adds up: income less adjustments is AGI; AGI less the deductions is taxable income
  const v = (l) => k.steps.find((s) => s.label === l).amount;
  near8(v("Income") + v("Adjustments"), v("Adjusted gross income")); near8(v("Adjusted gross income") + v("Standard deduction") + v("Business deduction (20%)"), v("Taxable income"));
  assert.deepEqual(d.steps, compute(freelancerPlan(), { today: R8 }).steps, "compute()'s own walk is untouched");
});

test("round 8 item 5 (landlord-1): a rental on Rental analysis counts after its costs, in place of the Income page's gross rent", async () => {
  const { landlordPlan } = await H8(), { known, rentalStep } = await K8();
  const p = landlordPlan(), d = compute(p, { today: R8 }), k = known(p, { today: R8 });
  assert.equal(d.result.agi, 179600, "the keys' return still has the gross 25,200 of rent");
  // wages 167,000 less 12,600 to the 401(k)s: AGI 154,400; the condo loses 1,547 (23,940 of rent after 5% empty months,
  // less 12,700 of costs, about 6,678 of interest and 6,109 of depreciation), all of it suspended: the allowance is
  // 25,000 - (154,400 - 100,000) / 2 < 0
  assert.equal(k.result.agi, 154400); assert.equal(k.result.taxableIncome, 122200);
  // 2,480 + 12% of 76,000 + 22% of 21,400 = 16,308, less the 2,200 child tax credit
  near8(k.total, 14108);
  near8(k.rental.magi, 154400); assert.equal(k.rental.allowance, 0); near8(k.rental.passive.suspended, 1546.79); assert.equal(k.rental.net, 0);
  assert.ok(k.sources.some((s) => s.key === "rental" && /in place of the \$25,200 of rent on the Income page/.test(s.detail)));
  // a profitable rental adds its net: rent 3,000 a month brings the condo to 36,000 x 0.95 - 13,060 - interest - depreciation
  const q = landlordPlan(); q.property[0].rentMonthly = 3000; q.income.find((x) => x.id === "rent").amount = 3000;
  const kq = known(q, { today: R8 }), r = kq.rental.rentals[0];
  near8(kq.rental.net, r.taxable); assert.ok(r.taxable > 0); near8(kq.result.agi, 154400 + r.taxable);
  // without the property on Rental analysis the Income page's rent stays at its gross, said "before any cost"
  const g = landlordPlan(); g.property = [];
  const kg = known(g, { today: R8 });
  assert.equal(kg.result.agi, 179600); assert.ok(kg.sources.some((s) => s.key === "rental" && /before any cost/.test(s.detail)));
  assert.equal(rentalStep({ plan: g, fed: compute(g, { today: R8 }), inputs: compute(g, { today: R8 }).inputs, params: { today: R8 } }).line, null);
});

test("round 8 item 6 (widow-2): this year's required withdrawal is income: AGI 59,254, 20,376 of Social Security taxed, 3,965 of tax", async () => {
  const { widowPlan } = await H8(), { known, withdrawalStep } = await K8();
  const p = widowPlan(), d = compute(p, { today: R8 }), k = known(p, { today: R8 });
  near8(d.result.totalTax, 536, 1);
  // 410,000 / 25.5 (the Uniform Lifetime factor at 74) = 16,078; provisional income 22,800 + 16,078 + 13,800 = 52,678:
  // 0.85 x (52,678 - 34,000) + 4,500 = 20,376 of Social Security taxed
  near8(k.withdrawal.required, 16078, 0); near8(k.result.income.taxableSocialSecurity, 20376.3, 0.05);
  near8(k.result.agi, 22800 + 16078 + 20376.3, 0.05);
  // less 16,100 + 2,050 (65 or over) and the 6,000 senior deduction: 35,104 taxable; 1,240 + 12% of 22,704 = 3,964.5
  near8(k.result.taxableIncome, 35104.3, 0.05); near8(k.total, 3964.5, 1);
  assert.equal(k.steps.find((s) => s.label === "Income").sub, "IRA and 401(k) withdrawals $16,078, pension $22,800, Social Security $27,600");
  assert.equal(k.lines[0].label, "Required withdrawal"); assert.match(k.lines[0].detail, /required withdrawal \$16,078/);
  // marked taken it is still this year's income
  const t = widowPlan(); t.retirement.rmdTaken = { 2026: { me: "2026-10-01" } };
  near8(known(t, { today: R8 }).total, k.total);
  // a typed figure replaces the plan's
  const y = widowPlan(); y.taxes.thisYear.iraWithdrawals = 20000;
  const ky = known(y, { today: R8 });
  assert.equal(ky.lines[0].from, "typed"); assert.equal(ky.withdrawal.total, 20000);
  // Other ordinary income typed: it replaces the plan's withdrawal (round 8 review: the form used to say to type IRA
  // withdrawals there), with a note saying where the withdrawals go if it does not hold them
  const o = widowPlan(); o.taxes.thisYear.otherOrdinary = 500;
  const ko = known(o, { today: R8 });
  assert.ok(ko.notes.some((n) => /does not add this year's required withdrawal of \$16,078/.test(n))); assert.equal(ko.withdrawal.inOther, true);
  assert.equal(ko.lines.some((l) => l.key === "withdrawals"), false); near8(ko.total, compute(o, { today: R8 }).result.totalTax);
  // spending past what the pension, Social Security and the required withdrawal bring in: the retirement projection's first
  // year takes more from the IRA, and that is income too; the same plan changed in place is worked again (the projection's
  // first year is kept by the plan's content, not by the object)
  const sp = widowPlan(); sp.retirement.spendingMonthly = 7000;
  const ks = known(sp, { today: R8 });
  assert.ok(ks.withdrawal.spending > 10000, `draw ${ks.withdrawal.spending}`); near8(ks.withdrawal.total, 16078 + ks.withdrawal.spending);
  assert.equal(ks.lines[0].label, "Withdrawals from pre-tax retirement accounts");
  sp.retirement.spendingMonthly = 3000;
  assert.equal(known(sp, { today: R8 }).withdrawal.spending, 0);
  // another tax year than today's: no plan line (the withdrawal is worked for today's year)
  const z = widowPlan(); z.taxes.year = 2025;
  const fz = compute(z, { today: R8 });
  assert.equal(withdrawalStep({ plan: z, fed: fz, inputs: fz.inputs, params: { today: R8 } }).line, null);
});

test("round 8 item 12 (equity-2): stock vesting this year is pay: 105,000 more wages, 53,643 of tax, the 24% bracket", async () => {
  const { equityPlan } = await H8(), { known, stockStep } = await K8();
  const p = equityPlan(), k = known(p, { today: R8 });
  // 300 units at the March 2026 cliff, then 75 in June, September and December: 525 x 200 = 105,000
  near8(k.stock.value, 105000); assert.equal(k.stock.shares, 525); assert.equal(k.stock.personId, "mo");
  near8(k.result.agi, 213000 + 105000); near8(k.result.taxableIncome, 285800); assert.equal(k.result.bracketRate, 0.24);
  // 2,480 + 9,120 + 22% of 110,600 + 24% of 74,400 = 53,788; less 1,000 for two older dependents; plus 0.9% of 345,000 - 250,000
  near8(k.total, 53788 - 1000 + 855);
  // held back: 22% of 105,000 and 0.9% of Mo's pay past 200,000 that the vests add (315,000 - 200,000 less 210,000 - 200,000)
  near8(k.stock.withheld, 23100 + 945); near8(k.stock.withheldAfter, 0.22 * 15000 + 0.009 * 15000);
  // wages typed: not added, and a note says so
  const w = equityPlan(); w.taxes.thisYear.wages = 300000;
  const fw = compute(w, { today: R8 });
  const sw = stockStep({ plan: w, fed: fw, inputs: fw.inputs, params: { today: R8 } });
  assert.equal(sw.line, null); assert.match(sw.note, /Wages this year is typed/);
  // a pay line that is the stock pay already: not added twice
  const i = equityPlan(); i.income.push({ id: "rsu", name: "RSU vesting", personId: "mo", type: "bonus", amount: 105000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true });
  const fi = compute(i, { today: R8 });
  const si = stockStep({ plan: i, fed: fi, inputs: fi.inputs, params: { today: R8 } });
  assert.equal(si.line, null); assert.match(si.note, /"RSU vesting" on the Income page counts it/);
});

test("round 8 item 23 (couple-home-6): student loan interest comes off: taxable 87,300, tax 9,980; none on separate returns", async () => {
  const { studentLoanPlan } = await H8(), { known, loanStep } = await K8();
  const p = studentLoanPlan(), k = known(p, { today: R8 });
  // twelve 730 payments on 64,000 at 6.5%: about 4,020 of interest, of which 2,500 counts; MAGI 122,000 is under 175,000
  assert.ok(k.loan.interest > 3900 && k.loan.interest < 4200); assert.equal(k.loan.deduction, 2500);
  assert.equal(k.result.taxableIncome, 87300); near8(k.total, 9980);
  // in the phase-out: MAGI 190,000 on a joint return keeps (205,000 - 190,000) / 30,000 of it
  const hi = studentLoanPlan(); hi.income[0].amount = 126000;
  near8(known(hi, { today: R8 }).loan.deduction, 2500 * 15000 / 30000);
  // a separate return gets none, with a note
  const s = studentLoanPlan(); s.household.filingStatus = "married_separate";
  const fs2 = compute(s, { today: R8 }), ls = loanStep({ plan: s, fed: fs2, inputs: fs2.inputs, params: { today: R8 } });
  assert.equal(ls.line, null); assert.match(ls.note, /separate return cannot deduct it/);
  near8(known(s, { today: R8 }).total, fs2.result.totalTax);
  // Other adjustments typed replaces it
  const a = studentLoanPlan(); a.taxes.thisYear.adjustments = 1000;
  assert.equal(known(a, { today: R8 }).loan, null);
});

test("round 8 item 9 (equity-3, landlord-3): the IRA deduction is cut for someone with a plan at work by the income limits (IRC 219(g))", async () => {
  const { equityPlan, landlordPlan, freelancerPlan } = await H8(), { known } = await K8();
  // Mo, with a 401(k), puts 7,500 in a traditional IRA: at 318,000 (with the stock pay) none of it comes off
  const p = equityPlan(); p.accounts.push({ id: "ira-mo", name: "Mo's IRA", type: "ira", balance: 0, ownerId: "mo" });
  p.retirement.contributions.push({ id: "c-ira", accountId: "ira-mo", personId: "mo", period: "annual", amount: 7500, employerMatch: 0 });
  const k = known(p, { today: R8 }), base = known(equityPlan(), { today: R8 });
  assert.equal(compute(p, { today: R8 }).ira.deductible, 7500, "the keys' return still assumes it is deductible");
  assert.equal(k.ira.deductible, 0); assert.equal(k.ira.basis, 7500); near8(k.result.agi, base.result.agi);
  assert.ok(k.sources.some((s) => s.key === "ira" && /none of Mo's \$7,500 comes off/.test(s.detail) && /The \$7,500 put in after tax comes out tax-free later; what it earns is taxed\. Keep a record of it \(Form 8606\)/.test(s.detail)));
  assert.match(k.steps.find((s) => s.label === "Income").sub, /^wages \$318,000 \(\$105,000 of it stock pay\)$/);
  // the landlord's 7,500 for Sam: at 154,400 (over 149,000) none comes off either, so the tax is the same as without it
  const l = landlordPlan(); l.accounts.push({ id: "ira-sam", name: "Sam's IRA", type: "ira", balance: 0, ownerId: "sam" });
  l.retirement.contributions.push({ id: "c-ira", accountId: "ira-sam", personId: "sam", period: "annual", amount: 7500, employerMatch: 0 });
  near8(known(l, { today: R8 }).total, 14108);
  // no plan at work (the freelancer): all of it comes off
  const f = known(freelancerPlan(), { today: R8 });
  assert.equal(f.ira.deductible, 3000); assert.equal(f.ira.people[0].rule, "none");
});

test("round 8: a household without any of it computes exactly as the keys' return", async () => {
  const { known } = await K8();
  for (const p of [taxPlan(), emptyPlan()]) {
    const d = compute(p, { today: "2026-09-16" }), k = known(p, { today: "2026-09-16" }, d);
    assert.equal(k.changed, false); assert.equal(k.result, d.result); assert.equal(k.total, d.result.totalTax);
    // the rate too, to the last digit (it read total / gross, a few billionths off the engine's on some plans)
    assert.equal(k.rate, d.result.effectiveRate);
    assert.deepEqual(k.steps, d.steps); assert.deepEqual(k.lines.filter((l) => l.key !== "ira"), []);
  }
});

// ---- round 8, Batch 1 review (r8/b1/review-money.md, review-ux.md): each fix with the household that showed it ----------
test("round 8 review 1: the rental allowance's modified AGI leaves out the deductible half of self-employment tax (Form 8582 line 6)", async () => {
  const { landlordBusinessPlan } = await H8(), { known } = await K8();
  const p = landlordBusinessPlan(), k = known(p, { today: R8 });
  // profit 140,000; AGI 140,000 - 9,890.68 (half the self-employment tax) - the allowed loss; MAGI adds the half back: 140,000
  near8(k.se.half, 0.5 * 0.153 * 0.9235 * 140000); near8(k.rental.magi, 140000);
  // 25,000 - (140,000 - 100,000) / 2 = 5,000 of the loss counts this year
  near8(k.rental.allowance, 5000); near8(k.rental.net, -5000); near8(k.total, 33679.01);
});

test("round 8 review 2: Other income taxed at regular rates typed as the widow's withdrawal is not counted twice", async () => {
  const { widowPlan } = await H8(), { known } = await K8();
  const p = widowPlan(); p.taxes.thisYear.otherOrdinary = 16078;
  const k = known(p, { today: R8 });
  near8(k.total, 3964.52, 0.01); assert.equal(k.withdrawal.counted, 0);
  assert.ok(k.sources.some((s) => s.key === "otherTyped" && /taken to include this year's IRA and 401\(k\) withdrawals \(the plan's \$16,078 is not added again\)/.test(s.detail)));
  assert.equal(k.sources.filter((s) => /withdrawal/i.test(s.label)).length, 0, "no second line for the same money");
  // with nothing typed, the source line says what the box is for now
  const q = widowPlan(); q.household.people[0].birthDate = "1980-03-15"; q.taxes.thisYear.otherOrdinary = 300;
  assert.ok(known(q, { today: R8 }).sources.some((s) => s.key === "otherTyped" && s.detail === "interest, non-qualified dividends, Roth conversions"));
});

test("round 8 review 4: a draw for spending before 59½ owes the extra 10% (IRC 72(t)), and a household living on it has income", async () => {
  const { earlyRetireePlan } = await H8(), { known, shareBefore59Half, EARLY_RATE } = await K8();
  const p = earlyRetireePlan();
  const d = compute(p, { today: R8 }), k = known(p, { today: R8 }, d);
  assert.equal(d.hasIncome, false, "the Income page is empty"); assert.equal(k.hasIncome, true, "the IRA draw is income");
  assert.ok(k.withdrawal.spending > 60000, `draw ${k.withdrawal.spending}`);
  // 50 all year: all of it owes 10%, counted after the income tax as its own walk row
  near8(k.earlyTax, EARLY_RATE * k.withdrawal.spending); near8(k.total, k.result.totalTax + k.earlyTax);
  near8(k.total, 14126.52, 2);
  const row = k.steps.find((s) => s.label === "Extra 10% on early withdrawals");
  assert.ok(row); near8(row.amount, k.earlyTax); near8(k.steps.find((s) => s.label === "Federal tax").amount, k.total);
  assert.ok(k.notes.some((n) => /before 59½ owes an extra 10% \(Form 5329\)/.test(n) && /not an IRA/.test(n)));
  // the share of the year before the half-birthday: born 1967-01-15 reaches 59½ on 2026-07-15 (195 of 365 days before it)
  near8(shareBefore59Half({ birthDate: "1967-01-15" }, 2026), 195 / 365, 1e-9);
  assert.equal(shareBefore59Half({ birthDate: "1966-01-15" }, 2026), 0); assert.equal(shareBefore59Half({ birthDate: "1980-01-01" }, 2026), 1);
  assert.equal(shareBefore59Half({ birthDate: "" }, 2026), null);
  // a required withdrawal (the widow, 74) owes none
  const { widowPlan } = await H8();
  assert.equal(known(widowPlan(), { today: R8 }).earlyTax, 0);
});

test("round 8 review 5: stock pay uses up the wage base, so a business owner's self-employment tax is the 2.9% part only", async () => {
  const { stockAndBusinessPlan } = await H8(), { known } = await K8();
  const p = stockAndBusinessPlan();
  const k = known(p, { today: R8 });
  assert.equal(k.stock.value, 100000);
  // Social Security wages 150,000 + 100,000 = 250,000, past the 184,500 base: 2.9% of 92.35% of 40,000 = 1,071.26
  near8(k.se.total, 0.029 * 0.9235 * 40000);
  // the 0.9% on what passes 200,000 after the Medicare wages (250,000): all 36,940 of earnings = 332.46
  near8(k.se.addl, 0.009 * 0.9235 * 40000);
});

test("round 8 review 6: rent for a place not on Rental analysis stays income (at its gross), only the condo's rent comes out", async () => {
  const { landlordPlan } = await H8(), { known, withoutIncomeRent } = await K8();
  const rent8 = (id, amount, name) => ({ id, name, personId: "", type: "rental", amount, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true });
  const p = landlordPlan(); p.income.push(rent8("duplex", 1500, "Duplex rent"));
  const k = known(p, { today: R8 });
  near8(k.rental.removed, 25200); near8(k.rental.left, 18000);
  // AGI 154,400 + 18,000; taxable 140,200: 2,480 + 9,120 + 22% of 39,400 = 20,268, less the 2,200 child tax credit
  near8(k.result.agi, 172400); near8(k.total, 18068);
  assert.ok(k.sources.some((s) => s.key === "rental" && s.amount === 18000 && /rent for a place not on Rental analysis/.test(s.detail)));
  // matched by name first: a row named for the condo comes out whole, whatever its amount
  const q = landlordPlan(); q.income.find((x) => x.id === "rent").name = "Condo rent"; q.income.find((x) => x.id === "rent").amount = 2000;
  q.income.push(rent8("duplex", 2100, "Duplex"));
  const f = compute(q, { today: R8 });
  const w = withoutIncomeRent(q, f, { today: R8 });
  assert.deepEqual(w.rows.map((x) => Math.round(x.removed)), [24000, 1200]);
});

test("round 8 review 7: the 20% business deduction shrinks over its income line (IRC 199A(b)(3)), to the 400 minimum past the range", async () => {
  const { highFreelancerPlan } = await H8(), { known, qbiPhase } = await K8();
  const p = highFreelancerPlan();
  const k = known(p, { today: R8 });
  // taxable income before it 367,105, past 201,750 + 75,000: no wages paid, no property, so only the 199A(i) minimum
  assert.equal(k.result.deduction.qbi, 400); near8(k.total, 132231.10, 0.05);
  assert.ok(k.notes.some((n) => /over the \$201,750 where its limits start and past \$276,750/.test(n) && /\$400 minimum for an active business is taken/.test(n)));
  // half way through the range half of it is left; under the line all of it; joint and separate lines and widths
  near8(qbiPhase({ tentative: 10000, taxable: 239250, filingStatus: "single", year: 2026 }).amount, 5000);
  near8(qbiPhase({ tentative: 10000, taxable: 201750, filingStatus: "single", year: 2026 }).amount, 10000);
  near8(qbiPhase({ tentative: 10000, taxable: 478500, filingStatus: "married_joint", year: 2026 }).amount, 5000);
  near8(qbiPhase({ tentative: 10000, taxable: 239275, filingStatus: "married_separate", year: 2026 }).amount, 5000);
  near8(qbiPhase({ tentative: 10000, taxable: 600000, filingStatus: "married_joint", year: 2026 }).amount, 0);
  // the freelancer at 78,000 is far under it: unchanged
  const { freelancerPlan } = await H8();
  near8(known(freelancerPlan(), { today: R8 }).result.deduction.qbi, 0.2 * (69489.4755 - 16100));
});

test("round 8 review 8: student loan interest comes off AGI but not off the income Social Security is tested on (Pub. 915 Worksheet 1)", async () => {
  const { parentLoanPlan } = await H8(), { known } = await K8();
  const p = parentLoanPlan();
  const k = known(p, { today: R8 });
  // provisional income 30,000 + 12,000 = 42,000: 4,500 + 0.85 x 8,000 = 11,300 of the 24,000 taxed, the loan interest left in
  near8(k.result.income.taxableSocialSecurity, 11300); near8(k.result.agi, 30000 + 11300 - 2500); near8(k.total, 1510);
  // the engine: studentLoanInterest is off AGI and in the adjustments, not off provisional income
  const P = compute(p, { today: R8 }).params;
  const a = federalTax({ filingStatus: "single", otherOrdinary: 30000, socialSecurity: 24000, studentLoanInterest: 2500 }, P);
  const b = federalTax({ filingStatus: "single", otherOrdinary: 30000, socialSecurity: 24000, adjustments: 2500 }, P);
  near8(a.income.taxableSocialSecurity, 11300); near8(b.income.taxableSocialSecurity, 9175); near8(a.adjustments, 2500); near8(a.agi, 38800);
});

test("round 8 review 9: the first required withdrawal may wait until April 1 of next year, and the page says so", async () => {
  const { firstRmdPlan } = await H8(), { known } = await K8();
  const p = firstRmdPlan();
  const k = known(p, { today: R8 });
  assert.equal(k.withdrawal.people[0].first, true);
  assert.ok(k.notes.some((n) => /first required withdrawal: it may wait until April 1, 2027, but then it is 2027's income, on top of 2027's own/.test(n)));
  // marked taken: nothing to wait for
  p.retirement.rmdTaken = { 2026: { me: "2026-10-01" } };
  assert.ok(!known(p, { today: R8 }).notes.some((n) => /may wait until April 1/.test(n)));
});

test("round 8 review UX 9-11: the IRA row is $0 not -$0 and says only what was put in comes out tax-free; the walk names rent and pensions", async () => {
  const { landlordPlan, widowPlan } = await H8(), { known } = await K8();
  const l = landlordPlan(); l.accounts.push({ id: "ira-sam", name: "Sam's IRA", type: "ira", balance: 0, ownerId: "sam" });
  l.retirement.contributions.push({ id: "c-ira", accountId: "ira-sam", personId: "sam", period: "annual", amount: 7500, employerMatch: 0 });
  const k = known(l, { today: R8 }), ira = k.sources.find((s) => s.key === "ira");
  assert.equal(Object.is(ira.amount, -0), false); assert.equal(ira.amount, 0);
  assert.match(ira.detail, /at your joint income of about \$154,400 none of Sam's \$7,500 comes off/);
  assert.match(ira.detail, /The \$7,500 put in after tax comes out tax-free later; what it earns is taxed/);
  // the rent is named in the walk's income, at its result after costs, and the loss line says what it means this year
  assert.equal(known(landlordPlan(), { today: R8 }).steps.find((s) => s.label === "Income").sub, "wages $154,400, rentals $0 after costs ($25,200 of rent; see below)");
  assert.ok(k.sources.some((s) => s.key === "rental" && /at your income a rental loss cannot lower this year's tax; the \$1,547 waits for a year with rental profit, or the sale/.test(s.detail)));
  // stock pay is said in shares
  const { equityPlan } = await H8();
  assert.match(known(equityPlan(), { today: R8 }).sources.find((s) => s.key === "stock").detail, /525 shares vesting in 2026 at \$200 each/);
});

// --- round 8, batch 1 verify (2026-11-06) ------------------------------------------------------------------------------
test("round 8 verify: a 401(k) drawn after leaving work at 55 or later owes no extra 10% (IRC 72(t)(2)(A)(v)); an IRA still does", async () => {
  const { known } = await K8();
  // Ty, born 1969-03-03 (57 in 2026), no pay on the Income page, 800,000 in one pre-tax account, 5,000 a month of spending
  const mk = (accounts, retirementAge, birthDate = "1969-03-03") => {
    const p = emptyPlan();
    p.household.people = [{ id: "me", name: "Ty", role: "self", birthDate, retirementAge, lifeExpectancy: null }];
    p.household.filingStatus = "single"; p.household.state = "TX"; p.income = [];
    p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 20000, ownerId: "" }, ...accounts.map(([type, balance], i) => ({ id: `a${i}`, name: `Plan ${i}`, type, balance, ownerId: "me" }))];
    p.retirement.spendingMonthly = 5000;
    return p;
  };
  // left work at 56, money in the old job's 401(k): the separation-from-service exception (IRS, "Retirement topics:
  // exceptions to tax on early distributions": qualified plans yes, IRAs no), so no extra 10%, and the page says why
  const k401 = known(mk([["401k", 800000]], 56), { today: R8 });
  assert.ok(k401.withdrawal.spending > 40000, `draw ${k401.withdrawal.spending}`);
  assert.equal(k401.earlyTax, 0);
  assert.equal(k401.steps.some((s) => s.label === "Extra 10% on early withdrawals"), false);
  assert.ok(k401.notes.some((n) => /left work at 56/.test(n) && /not an IRA/.test(n)), k401.notes.join(" | "));
  // the same money in an IRA owes it: 10% of the whole draw
  const kIra = known(mk([["ira", 800000]], 56), { today: R8 });
  near8(kIra.earlyTax, 0.1 * kIra.withdrawal.spending);
  // left work at 52: no exception for the 401(k) either
  const k52 = known(mk([["401k", 800000]], 52, "1972-03-03"), { today: R8 });
  near8(k52.earlyTax, 0.1 * k52.withdrawal.spending);
  // half in each, left at 56: the 10% on the IRA's half of the draw only (the draw shared by balance, as before)
  const kMix = known(mk([["401k", 400000], ["ira", 400000]], 56), { today: R8 });
  near8(kMix.earlyTax, 0.05 * kMix.withdrawal.spending);
});

test("round 8 verify: a retiree whose income is the plan's IRA withdrawals is not told the estimate is built only from what is typed", async () => {
  const { earlyRetireePlan } = await H8();
  const text = await pageText(earlyRetireePlan(), R8);
  assert.ok(!/the estimate is built from what you type below/i.test(text), "the withdrawals are the plan's, not typed");
  assert.match(text, /Nothing on the Income page yet: the estimate is built from this year's IRA and 401\(k\) withdrawals the plan takes \(What the plan already knows\) and what you type below\./);
  // with nothing at all, the page asks for pay first (stress test 2026-11-11, A8): one box and "Show my tax", no $0 tiles
  const empty = await pageText(emptyPlan(), R8);
  assert.match(empty, /Add what you earn first, then this page works out your tax\./);
  assert.match(empty, /Show my tax/);
  assert.doesNotMatch(empty, /From income to tax/);
});

// ---- wording follow-up 2026-11-07 (lane B item 1): money always has its dollar sign in the lines people read
test("wording: the walk and the sources show every amount of money with a dollar sign", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-10-30");
  p.income.find((x) => x.id === "i-ana").amount = 7600;   // 12,220 to Ana's 401(k)
  p.taxes = { ...(p.taxes ?? {}), year: 2026, estimated: { paid: [1000, 1000, 1000, 1000], typedAt: "2026-10-01" } };
  const d = compute(p, { today: "2026-10-30" });
  const wages = d.sources.find((x) => x.key === "wages");
  assert.match(wages.detail, /less \$12,220 of pre-tax 401\(k\) contributions/);
  assert.ok(!/(^|[ (])\d{1,3},\d{3}\b/.test(wages.detail.replace(/\$\d{1,3}(,\d{3})*/g, "")), wages.detail);
  const { known } = await K8();
  const k = known(p, { today: "2026-10-30" });
  const income = k.steps.find((s) => s.label === "Income").sub;
  assert.match(income, /^wages \$[\d,]+/);
  const paid = k.steps.find((s) => s.label === "Already paid");
  assert.equal(paid.sub, "$4,000 estimated payments");
  assert.match(k.sources.find((x) => x.key === "care").detail, /Daycare \$9,200, After-school care \$1,800/);
  const widow = (await H8()).widowPlan();
  const kw = known(widow, { today: R8 });
  assert.equal(kw.steps.find((s) => s.label === "Senior deduction").sub, "$6,000 a person 65 or over, tax years 2025 to 2028, less as income rises");
  // every step line in the walk: no bare thousands figure
  for (const plan of [p, widow]) for (const s of known(plan, { today: R8 }).steps) {
    const bare = String(s.sub ?? "").replace(/\$-?\d{1,3}(,\d{3})*/g, "").match(/(^|[^\d.%])\d{1,3},\d{3}\b/);
    assert.equal(bare, null, `${s.label}: ${s.sub}`);
  }
});
