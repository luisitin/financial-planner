import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, familyMaximum, familyBenefits, shareUnder, lifetimeEarnings, EARNINGS_TEST_EXEMPT, FUNERAL } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withCover = (anaCover, boCover = 0) => {
  const p = familyPlan(TODAY);
  p.insurance = { policies: [
    ...(anaCover ? [{ id: "a", name: "Ana's term", kind: "term", personId: "p-ana", benefit: anaCover, premium: 30, period: "monthly" }] : []),
    ...(boCover ? [{ id: "b", name: "Bo's group life", kind: "term", personId: "p-bo", benefit: boCover, premium: 0, period: "monthly", throughWork: true }] : []),
  ] };
  return p;
};

test("the family maximum: 150/272/134/175% over 2026's bend points (1979's 230/332/433 scaled by the 2024 wage index: 1,643, 2,371, 3,093)", () => {
  near(familyMaximum(2650, 2026), 4818.5);   // 1.5*1643 + 2.72*728 + 1.34*279 = 4818.52, to the dime below
  near(familyMaximum(4000, 2026), 6999.3);   // + 1.34*722 + 1.75*907
  near(familyMaximum(1000, 2026), 1500);
});

test("the share of a year someone is under an age", () => {
  near(shareUnder("2020-03-03", 18, 2037), 1); near(shareUnder("2020-03-03", 18, 2038), 2 / 12); assert.equal(shareUnder("2020-03-03", 18, 2039), 0);
  near(shareUnder("2020-01-15", 16, 2036), 0);
});

test("the family's Social Security: 75% of the PIA each, the parent's held back $1 for $2 over the exempt amount, the family maximum shared out", () => {
  const one = familyBenefits({ pia: 2650, year: 2027, deathYear: 2026, children: [{ birthDate: "2020-03-03" }], parentPay: 69600 });
  near(one.children, 0.75 * 2650 * 12);
  near(one.parent, 0.75 * 2650 * 12 - (69600 - EARNINGS_TEST_EXEMPT) / 2);
  const three = familyBenefits({ pia: 2000, year: 2027, deathYear: 2026, children: [{ birthDate: "2015-01-01" }, { birthDate: "2017-01-01" }, { birthDate: "2019-01-01" }], parentPay: 0 });
  const fm = familyMaximum(2000, 2026);
  near(three.familyMaxMonthly, fm);
  near(three.children + three.parent, fm * 12, 1e-6);
  near(three.children / three.parent, 3);
  const grown = familyBenefits({ pia: 2000, year: 2040, deathYear: 2026, children: [{ birthDate: "2015-01-01" }], parentPay: 0 });
  assert.equal(grown.children, 0); assert.equal(grown.parent, 0);
});

test("lifetime earnings: the family's share of the take-home pay, discounted", () => {
  const flat = lifetimeEarnings({ pay: 100000, years: 2, realGrowth: 0, realDiscount: 0 });
  near(flat.yearly, 100000 * 0.75 * 0.75); near(flat.total, 2 * flat.yearly);
  const disc = lifetimeEarnings({ pay: 100000, years: 2, realGrowth: 0, realDiscount: 0.05 });
  near(disc.total, flat.yearly * (1 + 1 / 1.05));
});

test("not ready without the plan's basics", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family: the plan's answer, DIME and lifetime earnings for each of them", () => {
  const d = compute(withCover(0), { today: TODAY });
  assert.equal(d.ready, true);
  const [ana, bo] = d.people;
  assert.equal(ana.survivorName, "Bo"); assert.equal(bo.survivorName, "Ana");
  assert.equal(ana.method, "plan");
  assert.ok(ana.need > 100000 && ana.need < 400000, String(ana.need));
  assert.equal(ana.need % 1000, 0);
  assert.equal(bo.need, 0, "Ana's pay and the savings carry the household without Bo");
  near(ana.plan.benefits.childMonthly, 0.75 * 2650); near(ana.plan.benefits.parentMonthly, (0.75 * 2650 * 12 - (69600 - EARNINGS_TEST_EXEMPT) / 2) / 12);
  assert.equal(ana.plan.benefits.childUntil, 2038);
  assert.equal(ana.dime.debts, 6400 + 14200); assert.equal(ana.dime.mortgage, 265000); assert.equal(ana.dime.education, 90000 - 4000); assert.equal(ana.dime.finalExpenses, FUNERAL);
  near(ana.dime.total, ana.dime.debts + ana.dime.finalExpenses + ana.dime.income + ana.dime.mortgage + ana.dime.education);
  near(ana.dime.income, ana.pay * ana.dime.incomeYears);
  assert.ok(ana.dime.incomeYears > 11 && ana.dime.incomeYears < 11.5);
  assert.equal(ana.lifetime.years, 65 - 36);
  assert.equal(ana.gap, ana.need); assert.equal(ana.cover, 0);
  assert.deepEqual(ana.termUntil, { year: 2042, why: "Cy turns 22", who: "Cy", event: "turns 22" });
});

test("the plan's answer is the smallest cover that works: a little less and the survivor's money runs out", () => {
  const need = compute(withCover(0), { today: TODAY }).people[0].need;
  const enough = compute(withCover(need), { today: TODAY }).people[0];
  assert.equal(enough.plan.withCover.success, true); assert.equal(enough.gap, 0);
  const less = compute(withCover(need - 5000), { today: TODAY }).people[0];
  assert.equal(less.plan.withCover.success, false); assert.equal(less.gap, 5000);
});

test("cover through work: the gap if the job ends", () => {
  const d = compute(withCover(0, 125000), { today: TODAY });
  const bo = d.people[1];
  assert.equal(bo.cover, 125000); assert.equal(bo.coverWork, 125000); assert.equal(bo.spare, 125000); assert.equal(bo.gapIfJobEnds, 0);
});

test("one adult and no children: no one depends on the income", () => {
  const p = familyPlan(TODAY);
  p.household.people = p.household.people.filter((q) => q.id === "p-ana");
  const d = compute(p, { today: TODAY });
  const [ana] = d.people;
  assert.equal(d.people.length, 1); assert.equal(ana.dependants, false); assert.equal(ana.plan, null);
  assert.equal(ana.dime.income, 0); assert.equal(ana.dime.education, 0);
});

test("the earnings test by the plan's first year (SSA: $24,480 in 2026, $25,560 in 2027; later years hold the newest)", async () => {
  const { earningsTestExempt } = await import("./compute.js");
  assert.equal(earningsTestExempt(2026), 24480); assert.equal(earningsTestExempt(2027), 25560); assert.equal(earningsTestExempt(2035), 25560);
  const in2027 = familyBenefits({ pia: 2650, year: 2028, deathYear: 2027, children: [{ birthDate: "2020-03-03" }], parentPay: 69600 });
  near(in2027.parent, 0.75 * 2650 * 12 - (69600 - 25560) / 2);
});

test("review: no cover end year in the past; cover ending soon still leaves a gap; a policy naming nobody is said; the setup's 'Me' reads 'you'", async () => {
  const { protectionGaps } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = { today: "2026-11-02" };
  // Cy is 26: the cover runs to Bo's retirement, never to 2022
  const c = familyPlan("2026-11-02"); c.household.people.find((x) => x.id === "p-cy").birthDate = "2000-03-03";
  for (const x of protectionGaps(c, T)) { assert.ok(!x.until || x.until > 2026, String(x.until)); assert.doesNotMatch(x.sentence, /until about 20(1|2[0-6])/); }
  const old = familyPlan("2026-11-02"); old.household.people.find((x) => x.id === "p-cy").birthDate = "1950-02-02";
  assert.ok(compute(old, T).people.every((p) => !p.termUntil || p.termUntil.year > 2026));
  // $250,000 of term cover ending in January: covered today, short from then; the step and its words stay
  const e = familyPlan("2026-11-02");
  e.insurance = { ...(e.insurance ?? {}), policies: [{ id: "t", kind: "term", personId: "p-ana", benefit: 250000, premium: 25, period: "monthly", endDate: "2027-01-15" }] };
  const [ge] = protectionGaps(e, T);
  assert.equal(ge.gap, 235000); assert.equal(ge.endsSoon.length, 1);
  assert.equal(ge.title, "Ana's term life cover ends 1/15/2027: Bo and Cy would then be about $235,000 short");
  const e2 = familyPlan("2026-11-02"); e2.insurance = { ...(e2.insurance ?? {}), policies: [{ ...e.insurance.policies[0], endDate: "2046-01-15" }] };
  assert.deepEqual(protectionGaps(e2, T), [], "cover that lasts past 2042 covers it");
  // a policy for "Household / everyone": not counted, and said
  const h = familyPlan("2026-11-02"); h.insurance = { ...(h.insurance ?? {}), policies: [{ id: "t", kind: "term", personId: "", benefit: 250000, premium: 25, period: "monthly" }] };
  assert.equal(compute(h, T).unassignedCover, 250000);
  assert.match(protectionGaps(h, T)[0].sentence, /A \$250,000 life policy on Policies names nobody: pick who it covers there and it counts\.$/);
  // the setup's default names
  const m = familyPlan("2026-11-02");
  m.household.people.find((x) => x.id === "p-ana").name = "Me"; m.household.people.find((x) => x.id === "p-bo").name = "My spouse"; m.household.people.find((x) => x.id === "p-cy").name = "Child 1";
  const [gm] = protectionGaps(m, T);
  assert.equal(gm.title, "No life insurance on you: your spouse and Child 1 would be about $235,000 short");
  assert.match(gm.sentence, /^If you died this year, your spouse and Child 1 would be about \$235,000 short\. Term life cover on you until about 2042 \(Child 1 turns 22\) closes it\./);
});

test("review: one parent, the children's own answer (method child) is rounded to $1,000 and said part by part, never as a rule of thumb or as the plan", async () => {
  const { protectionGaps } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-11-02");
  p.household.people = p.household.people.filter((x) => x.id !== "p-bo"); p.income = p.income.filter((x) => x.personId !== "p-bo");
  p.retirement.contributions = (p.retirement.contributions ?? []).filter((x) => x.personId !== "p-bo");
  p.household.filingStatus = "head_of_household";
  const ana = compute(p, { today: "2026-11-02" }).people[0];
  assert.equal(ana.method, "child"); assert.equal(ana.need % 1000, 0); assert.ok(ana.need >= ana.child.total && ana.need - ana.child.total < 1000);
  // Cy's college goal $90,000, counted from 2038 (Cy turns 18) at the real bond return 1.04/1.03 - 1: 90,000 / (1.04/1.03)^12
  // = 90,000 / 1.122932 = $80,147.34, less the $4,000 set aside = $76,147.34; the Visa $6,400 + the car loan $14,200 (the
  // mortgage is not added); checking $4,200 + savings $11,500 + brokerage $18,000 pass to Cy (the 401(k)s and the Roth do not count)
  near(ana.child.college, 90000 / Math.pow(1.04 / 1.03, 12) - 4000); near(ana.child.college, 76147.34, 0.01); assert.equal(ana.child.debts, 20600); assert.equal(ana.child.savings, 33700);
  near(ana.child.benefitMonthly, 0.75 * 2650); assert.equal(ana.child.benefitUntil, 2038);
  const [g] = protectionGaps(p, { today: "2026-11-02" });
  assert.equal(g.title, `No life insurance on Ana: Cy would need about $${ana.need.toLocaleString("en-US")}`);
  // Social Security nets only against Cy's own costs and college (it is Cy's money), so the sentence groups them
  assert.match(g.sentence, /^If Ana died, Cy would need about \$[\d,]+,000: their costs until 18 \(\$[\d,]+00\) and college \(\$76,100\) less Social Security for Cy \(\$[\d,]+00\), plus debts \(\$20,600\) and a funeral \(\$8,300\), less the \$33,700 Ana has saved\. Term life cover on Ana until about 2042 \(Cy's college ends\) is the usual way to buy it\.$/);
  assert.doesNotMatch(g.sentence, /rule of thumb|more than the plan holds|mortgage/);
  assert.equal(g.method, "child"); assert.deepEqual(g.depends, ["Cy"]); assert.equal(g.until, 2042);
});

// ---- a single parent (method "child", 2026-11-02)
import { childNeed, childParts, protectionGaps, CHILDCARE_UNTIL, passesOn, termYears } from "./compute.js";

/**
 * Pat (36, $60,000 salary), alone with Kit (born 2016-07-01: 13 in July 2029, 18 in July 2034). Bonds return the same as
 * inflation (3%), so the real discount rate is 0 and every year counts at face value.
 * Spending: rent $2,000 a month, after-school care $500 a month (a name that says so, filed under "other"), and the card's
 * $100 payment counted from Debts: $31,200 a year, less the $1,200 card payment the cover pays off = $30,000.
 */
function singleParent() {
  const p = emptyPlan();
  p.household = { people: [
    { id: "p-pat", name: "Pat", role: "self", birthDate: "1990-01-01", retirementAge: 65 },
    { id: "p-kit", name: "Kit", role: "dependent", birthDate: "2016-07-01" },
  ], filingStatus: "head_of_household", state: "OH" };
  p.accounts = [
    { id: "a-chk", name: "Checking", type: "checking", balance: 2000, asOf: "2026-11-02", ownerId: "", history: [] },
    { id: "a-brk", name: "Brokerage", type: "brokerage", balance: 10000, asOf: "2026-11-02", ownerId: "", history: [] },
    { id: "a-529", name: "Kit's 529", type: "529", balance: 3000, asOf: "2026-11-02", ownerId: "", history: [] },
    { id: "a-401", name: "Pat's 401(k)", type: "401k", balance: 50000, asOf: "2026-11-02", ownerId: "p-pat", history: [] },
    { id: "a-card", name: "Card", type: "credit", balance: 3000, asOf: "2026-11-02", ownerId: "", history: [] },
  ];
  p.debts = [{ id: "d-card", accountId: "a-card", rate: 0.2, minPayment: 100, extra: 0 }];
  p.income = [{ id: "i-pat", name: "Pat's pay", type: "salary", personId: "p-pat", amount: 60000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [
    { id: "e-rent", name: "Rent", category: "housing", amount: 2000, period: "monthly", essential: true, inflates: true },
    { id: "e-after", name: "After-school care", category: "other", amount: 500, period: "monthly", essential: true, inflates: true },
  ];
  p.goals = [
    { id: "g-col", name: "Kit's college", icon: "🎓", target: 40000, targetDate: "2034-08-15", priority: 2, saved: 5000, fundedBy: [], monthly: 0, rate: null, inflates: true },
    { id: "g-deg", name: "Pat's degree", icon: "🎓", target: 20000, targetDate: "2028-08-15", priority: 3, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true },
  ];
  p.assumptions = { ...p.assumptions, inflation: 0.03, returnBonds: 0.03 };
  p.retirement.socialSecurity = { "p-pat": { monthlyAtFRA: 1000 } };
  p.insurance = { policies: [] };
  return p;
}
const ST = { today: "2026-11-02" };

test("single parent: each part of the children's answer, by hand", () => {
  const d = compute(singleParent(), ST);
  const [pat] = d.people;
  assert.equal(pat.method, "child"); assert.equal(pat.survivorName, null);
  const c = pat.child;
  // counted from today's month, November 2026 (January to October are already spent)
  assert.equal(c.fromMonth, 11);
  // childcare: $500 a month, November 2026 to June 2029 (Kit turns 13 in July) = 2 + 12 + 12 + 6 = 32 months = $16,000
  near(c.childcare, 16000);
  // the rest, $30,000 - $6,000 = $24,000 a year = $2,000 a month: Kit's half, $1,000 a month, November 2026 to June 2034
  // (Kit turns 18 in July) = 2 + 7 x 12 + 6 = 92 months = $92,000
  near(c.share, 92000); near(c.costs, 108000);
  // Social Security: 75% of Pat's $1,000 = $750 a month (under the $1,500 family maximum), the same 92 months = $69,000
  near(c.benefits, 69000); near(c.benefitMonthly, 750); assert.equal(c.benefitUntil, 2034); assert.equal(c.noRecord, false);
  assert.deepEqual(c.benefitSteps, [{ monthly: 750, until: 2034, who: ["Kit"] }]);
  // college: $40,000 - $5,000 set aside; "Pat's degree" ends with Pat and is not counted
  assert.equal(c.college, 35000); assert.deepEqual(c.collegeParts.map((x) => x.name), ["Kit's college"]);
  // debts: the card (no mortgage here); a funeral; savings: checking $2,000 + brokerage $10,000 + the 529's $3,000 (not the 401(k))
  assert.equal(c.debts, 3000); assert.equal(c.funeral, FUNERAL); assert.equal(c.savings, 15000);
  // 108,000 - 69,000 + 35,000 + 3,000 + 8,300 - 15,000 = 70,300, rounded up to $71,000
  near(c.total, 70300); assert.equal(pat.need, 71000); assert.equal(pat.gap, 71000); assert.equal(pat.raise, true);
  // the need ends when Kit's college does (2034 to 2037 on the Education page): cover until 2038 (the fifth pass)
  assert.deepEqual(pat.termUntil, { year: 2038, why: "Kit's college ends", who: "Kit", event: "college ends" });
  assert.equal(c.childcareMonthly, 500); assert.equal(c.childcareUntil, 2029); assert.equal(c.shareNow, 0.5);
  // what the page says about it, from the same months: $500 a month until Kit turns 13 in 2029
  assert.deepEqual(c.careSteps, [{ monthly: 500, until: 2029, lastYear: 2029, who: ["Kit"], ended: [] }]);
  // no discounting here (bonds return what prices rise), so Kit's college is the goal's amount less what is set aside
  assert.deepEqual(c.collegeKids, [{ name: "Kit", year: 2034, gross: 40000, value: 40000 }]); assert.deepEqual(c.collegeLeftOut, []);
  assert.equal(pat.survivorMissing, null);
  // the rules of thumb are still worked out, folded on the page
  assert.equal(pat.dime.mortgage, 0); assert.ok(pat.dime.income > 0); assert.ok(pat.lifetime.total > 0);
});

test("single parent: the mortgage is not added (the home is in the spending), and a grown dependent alone keeps the rule of thumb", () => {
  const p = singleParent();
  p.accounts.push({ id: "a-mort", name: "Mortgage", type: "mortgage", balance: 100000, asOf: "2026-11-02", ownerId: "", history: [] });
  const pat = compute(p, ST).people[0];
  assert.equal(pat.child.debts, 3000); assert.equal(pat.need, 71000); assert.equal(pat.dime.mortgage, 100000);
  const grown = singleParent(); grown.household.people.find((x) => x.id === "p-kit").birthDate = "2004-01-01";
  const g = compute(grown, ST).people[0];
  assert.equal(g.method, "dime"); assert.equal(g.child, null);
});

test("single parent: a second adult with no birth date keeps the rule of thumb and says what to add, never the children's answer", () => {
  const p = singleParent();
  p.household.people.push({ id: "p-lee", name: "Lee", role: "partner", birthDate: "" });
  p.income.push({ id: "i-lee", name: "Lee's pay", type: "salary", personId: "p-lee", amount: 50000, period: "annual", growth: 0, taxable: true });
  const pat = compute(p, ST).people.find((x) => x.id === "p-pat");
  assert.equal(pat.method, "dime"); assert.equal(pat.child, null); assert.equal(pat.survivorName, null);
  assert.deepEqual(pat.survivorMissing, { id: "p-lee", name: "Lee", birthDate: true });
  const [g] = protectionGaps(p, ST);
  assert.match(g.title, /by a common rule of thumb$/); assert.match(g.sentence, /Lee and Kit would need/);
});

test("single parent: the children's share of the rest is n/(n+1), month by month in the year one turns 18", () => {
  // A turns 18 in July 2028, B in January 2032; $30,000 a year, no childcare, no discounting
  const r = childNeed({ children: [{ name: "A", birthDate: "2010-07-01" }, { name: "B", birthDate: "2014-01-01" }], startYear: 2026, realDiscount: 0, spending: 30000 });
  // 2026, 2027: 2/3 x 30,000 = 20,000 each; 2028: (6 x 2/3 + 6 x 1/2)/12 = 7/12 x 30,000 = 17,500; 2029-2031: 1/2 x 30,000 = 15,000 each
  near(r.share, 2 * 20000 + 17500 + 3 * 15000); assert.equal(r.years, 6); near(r.byYear[2].share, 17500);
  assert.equal(r.childcare, 0); assert.deepEqual(r.children, ["A", "B"]); near(r.shareNow, 2 / 3);
});

test("single parent: childcare stops at 13 (IRC 21), split between the children under 13 today, discounted at the real rate", () => {
  assert.equal(CHILDCARE_UNTIL, 13);
  // one child, 13 in January 2033: $10,000 for 2026-2032, all of the spending, at 5%: 10,000 x (1 + 1/1.05 + ... + 1/1.05^6) = 60,756.92
  const one = childNeed({ children: [{ name: "A", birthDate: "2020-01-01" }], startYear: 2026, realDiscount: 0.05, spending: 10000, childcare: [{ yearly: 10000 }] });
  near(one.childcare, 60756.92, 0.01); near(one.share, 0);
  // two under 13: the $12,000 is split; B's half stops in 2029, A's in 2033: 3 x 12,000 + 4 x 6,000 = 60,000
  const two = childNeed({ children: [{ name: "A", birthDate: "2020-01-01" }, { name: "B", birthDate: "2016-01-01" }], startYear: 2026, realDiscount: 0, spending: 12000, childcare: [{ yearly: 12000 }] });
  near(two.childcare, 60000);
  // a line with an end date stops then: August 2027 = all of 2026 and 8/12 of 2027
  const ends = childNeed({ children: [{ name: "A", birthDate: "2020-01-01" }], startYear: 2026, realDiscount: 0, spending: 12000, childcare: [{ yearly: 12000, endDate: "2027-08-31" }] });
  near(ends.childcare, 12000 + 8000);
  // no child under 13: the lines still come out of the shared spending and count for nothing (a 15-year-old)
  const teen = childNeed({ children: [{ name: "T", birthDate: "2011-01-01" }], startYear: 2026, realDiscount: 0, spending: 12000, childcare: [{ yearly: 12000 }] });
  near(teen.childcare, 0); near(teen.share, 0); assert.equal(teen.childcareUntil, null);
  // a line with an end date shared by two children: $900 a month ending August 2027, K 13 in March 2027, L 13 in 2034;
  // 2027: K's half January-February + L's half January-August = 450 x 2 + 450 x 8 = $4,500
  const both = childNeed({ children: [{ name: "K", birthDate: "2014-03-10" }, { name: "L", birthDate: "2021-05-03" }], startYear: 2026, realDiscount: 0, spending: 10800, childcare: [{ yearly: 10800, endDate: "2027-08-31" }] });
  near(both.byYear.find((x) => x.year === 2027).childcare, 4500); assert.equal(both.childcareUntil, 2027);
  // said as counted: $900 a month until K turns 13 (March 2027), then $450 until the line ends (August 2027)
  assert.deepEqual(both.careSteps, [{ monthly: 900, until: 2027, lastYear: 2027, who: ["K"], ended: [] }, { monthly: 450, until: 2027, lastYear: 2027, who: [], ended: [""] }]);
});

test("single parent: an older child never gets a bigger answer; 13 is judged from today's month, not January", () => {
  // $3,900 a month spent, $900 of it childcare: the rest is $3,000 a month, the child's half $1,500; from November 2026, no discounting
  const run = (birthDate) => childNeed({ children: [{ name: "A", birthDate }], startYear: 2026, fromMonth: 11, realDiscount: 0, spending: 46800, childcare: [{ yearly: 10800 }] });
  const a = run("2014-01-15"), b = run("2013-02-15"), c = run("2013-01-15");
  // 12 today, 13 in January 2027, 18 in January 2032: childcare November-December 2026 = 2 x 900; share 2 + 60 months x 1,500
  near(a.childcare, 1800); near(a.share, 62 * 1500);
  // 13 since February 2026: no childcare; share November 2026 to January 2031 = 51 months x 1,500 = 76,500
  near(b.childcare, 0); near(b.share, 76500);
  // 13 since January 2026, 18 in January 2031: 50 months x 1,500 = 75,000, a month less than the younger one
  near(c.childcare, 0); near(c.share, 75000);
  assert.ok(a.costs > b.costs && b.costs > c.costs);
});

test("single parent: the first year counts from today's month, for every part", () => {
  // a child turning 18 in December 2026, counted from November: one month of the $22,920 a year (half of it) and one month of $750
  const r = childNeed({ children: [{ name: "T", birthDate: "2008-12-20" }], startYear: 2026, fromMonth: 11, realDiscount: 0, spending: 22920, pia: 1000 });
  near(r.share, 22920 / 12 / 2); near(r.benefits, 750); assert.equal(r.years, 1); assert.equal(r.byYear[0].months, 1);
  // turning 18 this month: nothing is left to count, the child is still named
  const z = childNeed({ children: [{ name: "T", birthDate: "2008-11-20" }], startYear: 2026, fromMonth: 11, realDiscount: 0, spending: 22920, pia: 1000 });
  near(z.costs, 0); near(z.benefits, 0); assert.deepEqual(z.children, ["T"]);
  // the same child from January: eleven months
  near(childNeed({ children: [{ name: "T", birthDate: "2008-12-20" }], startYear: 2026, realDiscount: 0, spending: 22920 }).share, 11 * 22920 / 12 / 2);
});

test("single parent: Social Security for the children is 75% of the PIA each, under the family maximum, with no parent's benefit", () => {
  // one child, PIA $2,430 in 2026: 0.75 x 2,430 = $1,822.50 a month (the family maximum is $4,523.70)
  const one = childNeed({ children: [{ name: "A", birthDate: "2022-07-15" }], startYear: 2026, realDiscount: 0, spending: 0, pia: 2430 });
  near(one.benefitMonthly, 1822.5); near(one.familyMaxMonthly, 4523.7);
  // 2026-2039 in full, January to June 2040: 14.5 x 12 x 1,822.50
  near(one.benefits, 14.5 * 12 * 1822.5);
  // three children: 3 x 1,822.50 = 5,467.50 is over the family maximum, cut to $4,523.70 (1.5 x 1,643 + 2.72 x 728 + 1.34 x 59, to the dime)
  const three = childNeed({ children: [{ name: "A", birthDate: "2018-01-01" }, { name: "B", birthDate: "2020-01-01" }, { name: "C", birthDate: "2022-01-01" }], startYear: 2026, realDiscount: 0, spending: 0, pia: 2430 });
  near(three.benefitMonthly, 4523.7, 1e-6);
  // a parent's benefit would have taken a share of the maximum: without one the children get all of it
  near(familyBenefits({ pia: 2430, year: 2026, deathYear: 2026, children: [{ birthDate: "2022-01-01" }, { birthDate: "2020-01-01" }], parentPay: 0, withParent: false }).children, 2 * 1822.5 * 12);
  // no Social Security figure: nothing is subtracted, and it says so
  const none = childNeed({ children: [{ name: "A", birthDate: "2022-07-15" }], startYear: 2026, realDiscount: 0, spending: 0, pia: 0 });
  assert.equal(none.benefits, 0); assert.equal(none.noRecord, true); assert.deepEqual(none.benefitSteps, []);
});

test("single parent: the family maximum applies month by month, and the benefit steps down as each child turns 18", () => {
  // PIA $2,000: 75% = $1,500 each; family maximum 1.5 x 1,643 + 2.72 x 357 = 3,435.54, $3,435.50 to the dime.
  // Kim turns 18 in July 2030: January-June three children (4,500 cut to 3,435.50), July-December two (3,000)
  const three = childNeed({ children: [{ name: "Kim", birthDate: "2012-07-10" }, { name: "Lou", birthDate: "2015-03-03" }, { name: "Mo", birthDate: "2020-01-20" }], startYear: 2026, realDiscount: 0, pia: 2000 });
  near(three.familyMaxMonthly, 3435.5);
  near(three.byYear.find((x) => x.year === 2030).benefits, 6 * 3435.5 + 6 * 3000);   // 38,613, not a year's average cut
  assert.deepEqual(three.benefitSteps, [{ monthly: 3435.5, until: 2030, who: ["Kim"] }, { monthly: 3000, until: 2033, who: ["Lou"] }, { monthly: 1500, until: 2038, who: ["Mo"] }]);
  // two children, PIA $2,600 (family maximum $4,751.50, not reached): $3,900 until Ava turns 18 in February 2034, then $1,950 until Ben does in October 2041
  const two = childNeed({ children: [{ name: "Ava", birthDate: "2016-02-10" }, { name: "Ben", birthDate: "2023-10-05" }], startYear: 2026, fromMonth: 11, realDiscount: 0, pia: 2600 });
  assert.deepEqual(two.benefitSteps, [{ monthly: 3900, until: 2034, who: ["Ava"] }, { monthly: 1950, until: 2041, who: ["Ben"] }]);
  // November 2026 to January 2034 = 87 months x 3,900; February 2034 to September 2041 = 92 months x 1,950
  near(two.benefits, 87 * 3900 + 92 * 1950); assert.equal(two.benefitUntil, 2041); near(two.benefitMonthly, 3900);
});

test("single parent: college from the Education page when the goal has no amount; the total floors at 0", () => {
  const p = singleParent();
  p.goals[0] = { ...p.goals[0], name: "Education", target: 0, saved: 5000 };
  const c = compute(p, ST).people[0].child;
  // Education: $25,850 a year now (public, in-state), from 2034 for 4 years, prices up 4% a year, in today's money at 3%
  // inflation: 25,850 x ((1.04/1.03)^8 + ^9 + ^10 + ^11) = 25,850 x 4.38479 = $113,347, to the $10 $113,350 (the Education
  // page's own figure as it shows it, not the Goals page's $1,000 rounding); less $5,000 set aside
  assert.equal(c.college, 108350); assert.equal(c.collegeParts[0].from, "planner"); assert.deepEqual(c.collegeParts[0].for, ["Kit"]);
  // savings over everything: nothing to buy
  const rich = singleParent(); rich.accounts.find((a) => a.id === "a-brk").balance = 500000;
  const r = compute(rich, ST).people[0];
  assert.equal(r.child.total, 0); assert.equal(r.need, 0); assert.equal(r.raise, false);
  assert.deepEqual(protectionGaps(rich, ST), []);
  assert.equal(passesOn({ type: "roth" }), false); assert.equal(passesOn({ type: "crypto" }), true);
});

test("single parent: Get started's one Education goal with two children counts college for both (the goal is tied to neither)", () => {
  const p = singleParent();
  p.household.people.push({ id: "p-kim", name: "Kim", role: "dependent", birthDate: "2020-03-01" });
  p.goals = [{ id: "g-edu", name: "Education", icon: "🎓", target: 0, targetDate: "2040-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  const c = compute(p, ST).people[0].child;
  // Kit (college from 2034): 25,850 x ((1.04/1.03)^8 ... ^11) = $113,347 -> $113,350; Kim (from 2038): x ((1.04/1.03)^12 ... ^15)
  // = $117,808 -> $117,810 (each to the $10, as the Education page shows them)
  const k = (a, b) => { let t = 0; for (let i = a; i <= b; i++) t += 25850 * Math.pow(1.04 / 1.03, i); return Math.round(t / 10) * 10; };
  assert.equal(k(8, 11), 113350); assert.equal(k(12, 15), 117810);
  assert.equal(c.college, k(8, 11) + k(12, 15));
  assert.deepEqual(c.collegeParts.map((x) => [x.name, x.from, x.for, x.tied]), [["Education", "planner", ["Kit", "Kim"], false]]);
  assert.deepEqual(c.untiedKids, ["Kit", "Kim"]);
  // tied on the Education page to Kit by name: Kit's figure under it, and Kim's still counted (no goal of Kim's own: the
  // Education page's figure), never left out
  p.goals[0].name = "Kit's education";
  const t = compute(p, ST).people[0].child;
  assert.equal(t.college, k(8, 11) + k(12, 15)); assert.deepEqual(t.collegeParts.map((x) => [x.name, x.for, x.tied]), [["Kit's education", ["Kit"], true], [null, ["Kim"], false]]);
});

test("the shortest usual term that lasts until a year", () => {
  assert.equal(termYears(2044, 2026), 20); assert.equal(termYears(2036, 2026), 10); assert.equal(termYears(2030, 2026), 10);
  assert.equal(termYears(2048, 2026), 25); assert.equal(termYears(2070, 2026), 30);
});

test("single parent: the words name only the parts above zero", () => {
  const [g] = protectionGaps(singleParent(), ST);
  assert.equal(g.title, "No life insurance on Pat: Kit would need about $71,000");
  assert.equal(g.sentence, "If Pat died, Kit would need about $71,000: their costs until 18 ($108,000) and college ($35,000) less Social Security for Kit ($69,000), plus debts ($3,000) and a funeral ($8,300), less the $15,000 Pat has saved. Term life cover on Pat until about 2038 (Kit's college ends) is the usual way to buy it.");
  // no debts, no savings, no Social Security figure: those parts are not said. No education goal: college is still the
  // Education page's $113,350 for Kit (a parent's death does not cancel college)
  const bare = singleParent();
  bare.accounts = bare.accounts.filter((a) => a.type === "401k"); bare.debts = []; bare.goals = []; bare.retirement.socialSecurity = {};
  const [b] = protectionGaps(bare, ST);
  // 108,000 + 113,350 + 8,300 = 229,650, rounded up to $230,000
  assert.match(b.sentence, /^If Pat died, Kit would need about \$230,000: their costs until 18 \(\$108,000\) and college \(\$113,400\), plus a funeral \(\$8,300\)\. Term/);
  assert.doesNotMatch(b.sentence, /debts|saved|Social Security/);
  // cover on file: the gap; the setup's "Me" reads "you"
  const m = singleParent(); m.household.people[0].name = "Me"; m.goals = m.goals.filter((g) => g.id !== "g-deg");   // "Pat's degree" names no one now
  m.insurance.policies = [{ id: "t", kind: "term", personId: "p-pat", benefit: 50000, premium: 20, period: "monthly" }];
  const [gm] = protectionGaps(m, ST);
  assert.equal(gm.title, "Your life cover is about $21,000 short");
  assert.match(gm.sentence, /^If you died, Kit would need about \$71,000: .*, less the \$15,000 you have saved\. With the \$50,000 of cover on file, that is about \$21,000 short\. More term life cover on you until about 2038 \(Kit's college ends\) is the usual way to buy it\.$/);
  // two children: "the children's costs", "for the children"
  assert.equal(childParts({ children: ["A", "B"], costs: 1000, benefits: 500, college: 0, debts: 0, funeral: 8300, savings: 0 }, "you"), "the children's costs until 18 ($1,000) less Social Security for the children ($500), plus a funeral ($8,300)");
});

test("the rule of thumb for one adult whose dependents are grown names only its parts above zero: no mortgage for a renter, no college with none", () => {
  const p = singleParent();
  p.household.people.find((x) => x.id === "p-kit").birthDate = "2004-01-01";   // 22: a grown child still marked Dependent
  p.goals = [];
  p.accounts.find((a) => a.id === "a-card").balance = 30000;
  const pat = compute(p, ST).people[0];
  assert.equal(pat.method, "dime"); assert.equal(pat.dime.income, 0);
  const [g] = protectionGaps(p, ST);
  assert.equal(g.title, "No life insurance on Pat: Kit would need about $39,000 by a common rule of thumb");
  assert.equal(g.sentence, "If Pat died, a common rule of thumb (debts and a funeral added up) puts what Kit would need at about $39,000. Term life cover on Pat is the usual way to buy it.");
  assert.doesNotMatch(g.sentence, /mortgage|college|pay until/);
});

// ---- third review (2026-11-02): college once per child, discounted like the costs; childcare and Social Security said as counted
import { collegeValue } from "./compute.js";
const fundGoal = { id: "g-fund", name: "College fund", icon: "🎓", target: 60000, targetDate: "2034-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true };
const eduGoal = { id: "g-edu", name: "Education", icon: "🎓", target: 0, targetDate: "2034-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true };
// the Education page's figure for a child, to the $10 as it shows it: $25,850 a year now, prices up 4% a year, in today's money at 3%
const eduFig = (a, b) => { let t = 0; for (let i = a; i <= b; i++) t += 25850 * Math.pow(1.04 / 1.03, i); return Math.round(t / 10) * 10; };

test("college is counted once for each child, whatever the order of the goals: a goal's own amount, else the Education page's figure", () => {
  // Kit alone, Get started's "Education" (no amount) and a "College fund" of $60,000, either way round: $60,000, never
  // $60,000 + the Education page's $113,300 (no discounting here: bonds return what prices rise)
  for (const goals of [[eduGoal, fundGoal], [fundGoal, eduGoal]]) {
    const p = singleParent(); p.goals = goals.map((g) => ({ ...g }));
    const c = compute(p, ST).people[0].child;
    assert.equal(c.college, 60000, goals[0].name);
    assert.deepEqual(c.collegeParts.map((x) => [x.name, x.from, x.for]), [["College fund", "goal", ["Kit"]]]);
    assert.deepEqual(c.collegeKids.map((k) => k.name), ["Kit"]);
  }
  // two children (Kim born 2020-03-01) and the same two goals: the $60,000 stands for both of them ($30,000 each), nothing on top
  const two = singleParent(); two.household.people.push({ id: "p-kim", name: "Kim", role: "dependent", birthDate: "2020-03-01" });
  two.goals = [{ ...eduGoal }, { ...fundGoal }];
  const t = compute(two, ST).people[0].child;
  assert.equal(t.college, 60000); assert.deepEqual(t.collegeParts.map((x) => [x.name, x.for]), [["College fund", ["Kit", "Kim"]]]);
  assert.deepEqual(t.collegeKids.map((k) => [k.name, k.gross]), [["Kit", 30000], ["Kim", 30000]]);
  // Kit's own goal ($40,000 - $5,000 set aside) and Get started's "Education" for the rest: Kim gets the Education page's
  // $117,810 (college from 2038), Kit's goal is not added to twice: 35,000 + 117,810 = $152,810
  const own = singleParent(); own.household.people.push({ id: "p-kim", name: "Kim", role: "dependent", birthDate: "2020-03-01" });
  own.goals = [{ ...eduGoal }, own.goals[0]];
  const o = compute(own, ST).people[0].child;
  assert.equal(eduFig(12, 15), 117810);
  assert.equal(o.college, 35000 + 117810);
  assert.deepEqual(o.collegeParts.map((x) => [x.name, x.from, x.for, x.gross, x.amount]), [["Kit's college", "goal", ["Kit"], 40000, 35000], ["Education", "planner", ["Kim"], 117810, 117810]]);
});

test("no education goal at all: each child under 18 still gets the Education page's figure, named", () => {
  const p = singleParent(); p.goals = [];
  const c = compute(p, ST).people[0].child;
  // Kit: 25,850 x ((1.04/1.03)^8 + ... + ^11) = $113,347, to the $10 $113,350
  assert.equal(eduFig(8, 11), 113350);
  assert.equal(c.college, 113350);
  assert.deepEqual(c.collegeParts, [{ id: null, name: null, from: "planner", for: ["Kit"], gross: 113350, saved: 0, amount: 113350, tied: false, partial: false, figures: [{ name: "Kit", amount: 113350, full: 113350, share: 1 }] }]);
  // max(0, 108,000 + 113,350 - 69,000) + 3,000 + 8,300 - 15,000 = 148,650, so $149,000
  near(c.total, 148650); assert.equal(compute(p, ST).people[0].need, 149000);
  // a child none of whose college you chose to pay on the Education page is left out, by name
  p.whatIfs = { ...(p.whatIfs ?? {}), college: { "p-kit": { share: 0 } } };
  const z = compute(p, ST).people[0].child;
  assert.equal(z.college, 0); assert.deepEqual(z.collegeLeftOut, [{ name: "Kit", why: "share" }]);
});

test("college is discounted from the year each child turns 18 at the real bond return, like the costs", () => {
  // $121,000 for a child who turns 18 two years from now, at 10%: 121,000 / 1.1^2 = $100,000; a year already reached counts in full
  near(collegeValue(121000, "2010-01-01", 2026, 0.1), 100000);
  near(collegeValue(5000, "2008-12-01", 2026, 0.1), 5000);
  // Kit's $40,000 goal with bonds at 13.3% and prices at 3%: real 1.133/1.03 - 1 = 10%; Kit turns 18 in 2034, 8 years on:
  // 40,000 / 1.1^8 = 40,000 / 2.14358881 = $18,660.29, less the $5,000 set aside (at face value, like savings) = $13,660.29
  const p = singleParent(); p.assumptions = { ...p.assumptions, returnBonds: 0.133 };
  const c = compute(p, ST).people[0].child;
  near(c.realDiscount, 0.1, 1e-12);
  near(c.college, 40000 / Math.pow(1.1, 8) - 5000, 1e-6); near(c.college, 13660.29, 0.01);
  assert.deepEqual(c.collegeKids.map((k) => [k.name, k.year, k.gross]), [["Kit", 2034, 40000]]);
});

test("childcare is said as the total counts it: each drop and when it ends, from the same months", () => {
  // twins Ava and Ben (13 in April 2033) and Cal (13 in December 2028); "Childcare" $900 a month split between the three,
  // "Nanny" $2,000 a month ending 2027-12-31; from November 2026, no discounting:
  //   November 2026 - December 2027: 900 + 2,000 = $2,900 a month x 14 = 40,600
  //   January - November 2028: $900 x 11 = 9,900;  December 2028 - March 2033: two thirds of $900 = $600 x 52 = 31,200
  const kids = [{ name: "Ava", birthDate: "2020-04-10" }, { name: "Ben", birthDate: "2020-04-10" }, { name: "Cal", birthDate: "2015-12-01" }];
  const r = childNeed({ children: kids, startYear: 2026, fromMonth: 11, realDiscount: 0, spending: 60000, childcare: [{ name: "Childcare", yearly: 10800 }, { name: "Nanny", yearly: 24000, endDate: "2027-12-31" }] });
  near(r.childcare, 40600 + 9900 + 31200);
  assert.deepEqual(r.careSteps.map((s) => [s.monthly, s.lastYear, s.until, s.who, s.ended]), [[2900, 2027, 2028, [], ["Nanny"]], [900, 2028, 2028, ["Cal"], []], [600, 2033, 2033, ["Ava", "Ben"], []]]);
});

test("the Social Security steps merge months of the same amount (the family maximum binding before and after a child turns 18)", () => {
  // four children, PIA $2,430: four or three of them (7,290 or 5,467.50) are cut to the $4,523.70 maximum, so Ava turning 18
  // in March 2034 changes nothing; then $3,645 (two) and $1,822.50 (one)
  const four = childNeed({ children: [["Ava", "2016-03-01"], ["Ben", "2017-03-01"], ["Cal", "2019-03-01"], ["Dee", "2021-03-01"]].map(([name, birthDate]) => ({ name, birthDate })), startYear: 2026, fromMonth: 11, realDiscount: 0, pia: 2430 });
  assert.deepEqual(four.benefitSteps, [{ monthly: 4523.7, until: 2035, who: ["Ben"] }, { monthly: 3645, until: 2037, who: ["Cal"] }, { monthly: 1822.5, until: 2039, who: ["Dee"] }]);
  // November 2026 - February 2035 = 100 months at 4,523.70; March 2035 - February 2037 = 24 at 3,645; March 2037 - February 2039 = 24 at 1,822.50
  near(four.benefits, 100 * 4523.7 + 24 * 3645 + 24 * 1822.5, 1e-6);
});

test("savings over everything: the total floors at 0 and keeps what it is short of 0 (net) for the page to say", () => {
  const rich = singleParent(); rich.accounts.find((a) => a.id === "a-brk").balance = 500000;
  const c = compute(rich, ST).people[0].child;
  // 108,000 - 69,000 + 35,000 + 3,000 + 8,300 - (2,000 + 500,000 + 3,000) = -419,700
  near(c.net, -419700); assert.equal(c.total, 0);
});

// ---- fourth review (2026-11-02): the children's Social Security is their money; whose a goal is; 529; the Education page's figures
import { shownAmount, compute as education } from "../../goals/education/compute.js";

test("the children's Social Security pays only their own costs and college, never the debts or the funeral", () => {
  // A turns 18 in July 2034: November 2026 - June 2034 = 92 months. The rest of the spending, $24,000 a year: A's half is
  // $1,000 a month = 92,000. Social Security: 75% of a $2,000 PIA = $1,500 a month (under the $3,435.50 maximum) = 138,000.
  const kid = [{ name: "A", birthDate: "2016-07-01" }];
  const run = (college, savings) => childNeed({ children: kid, startYear: 2026, fromMonth: 11, realDiscount: 0, spending: 24000, pia: 2000, college, debts: 3000, funeral: 8300, savings });
  // college $10,000: costs and college 102,000, all of it paid by the 138,000; the other 36,000 is A's, kept for A.
  // need = max(0, 92,000 + 10,000 - 138,000) + 3,000 + 8,300 - 1,000 = 10,300 (netting it all would have said 0)
  const a = run(10000, 1000);
  near(a.costs, 92000); near(a.benefits, 138000); near(a.benefitsCounted, 102000); near(a.benefitsSpare, 36000); near(a.kidsShort, 0);
  near(a.net, 10300); near(a.total, 10300);
  // college $60,000: 152,000 is more than the 138,000, so all of it counts and 14,000 is left: 14,000 + 11,300 - 1,000 = 24,300
  const b = run(60000, 1000);
  near(b.benefitsCounted, 138000); near(b.benefitsSpare, 0); near(b.kidsShort, 14000); near(b.total, 24300);
  // savings over the debts and the funeral: 0 + 11,300 - 20,000 = -8,700, nothing to buy
  const z = run(10000, 20000);
  near(z.net, -8700); assert.equal(z.total, 0);
  // the words say it that way: Social Security covers the child's own part; the debts and the funeral still need the rest
  assert.equal(childParts({ ...a, children: ["A"] }, "Pat"), "Social Security for A covers their costs until 18 and college; that leaves debts ($3,000) and a funeral ($8,300), less the $1,000 Pat has saved");
  assert.equal(childParts({ ...b, children: ["A"] }, "Pat"), "their costs until 18 ($92,000) and college ($60,000) less Social Security for A ($138,000), plus debts ($3,000) and a funeral ($8,300), less the $1,000 Pat has saved");
  // the whole plan: Pat's Social Security figure $3,000 (75% = $2,250 a month, x 92 = 207,000) and $5,000 saved (the
  // brokerage emptied): Kit's 108,000 + college 35,000 = 143,000 is covered; 3,000 + 8,300 - 5,000 = 6,300, so $7,000
  const p = singleParent(); p.retirement.socialSecurity = { "p-pat": { monthlyAtFRA: 3000 } }; p.accounts.find((x) => x.id === "a-brk").balance = 0;
  const pat = compute(p, ST).people[0];
  near(pat.child.benefits, 207000); near(pat.child.benefitsCounted, 143000); near(pat.child.net, 6300); assert.equal(pat.child.today, 7000);
  // fifth pass: that is today's figure; the cover is sized to the largest year (Kit's Social Security surplus is gone by then);
  // sixth pass: in that year's dollars (a level policy pays the same dollars every year while prices rise)
  assert.equal(pat.child.peak.year, 2034); assert.equal(pat.need, pat.child.sized.need); assert.ok(pat.need > pat.child.peak.need);
});

test("a goal is a child's only when it names the child as a whole word: 'Education fund' for Ed and Ann, 'University fund' for Ty", () => {
  // Pat with two children both born 2016-07-01 (like Kit), one goal of $100,000 named for neither: shared, $50,000 each (no
  // discounting: bonds return what prices rise), never the first child's alone with the Education page's figure on top
  const twins = (a, b, goal) => {
    const p = singleParent();
    p.household.people = [p.household.people[0], { id: "k-a", name: a, role: "dependent", birthDate: "2016-07-01" }, { id: "k-b", name: b, role: "dependent", birthDate: "2016-07-01" }];
    p.goals = [{ id: "g-fund", name: goal, icon: "🎓", target: 100000, targetDate: "2034-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
    return compute(p, ST).people[0].child;
  };
  for (const [a, b, goal] of [["Ed", "Ann", "Education fund"], ["Ty", "Kit", "University fund"]]) {
    const c = twins(a, b, goal);
    assert.equal(c.college, 100000, goal);
    assert.deepEqual(c.collegeParts.map((x) => [x.name, x.for, x.tied]), [[goal, [a, b], false]]);
    assert.deepEqual(c.collegeKids.map((k) => [k.name, k.gross]), [[a, 50000], [b, 50000]]);
    // costs: after-school $500 shared to July 2029 = 16,000; two thirds of the $2,000 a month rest for 92 months = 122,666.67;
    // Social Security 2 x $750 = $1,500 (the $1,500 family maximum) x 92 = 138,000; max(0, 138,666.67 + 100,000 - 138,000)
    // + 3,000 + 8,300 - 15,000 = 96,966.67, so $97,000
    near(c.costs, 16000 + 92 * 2000 * 2 / 3, 1e-6); near(c.benefits, 138000, 1e-6);
    near(c.total, 16000 + 92 * 2000 * 2 / 3 + 100000 - 138000 + 3000 + 8300 - 15000, 1e-6);
  }
});

test("a grown dependent's college goal is theirs: not counted for the child under 18, and said by name", () => {
  // Mia (born 2005-09-09, 21) is marked Dependent, with "Mia college" of $40,000: Kit's answer stays $71,000 (Kit's goal,
  // $40,000 - $5,000 set aside), Mia's goal is left out and named, and only Kit's college year is said
  const p = singleParent();
  p.household.people.push({ id: "p-mia", name: "Mia", role: "dependent", birthDate: "2005-09-09" });
  p.goals.push({ id: "g-mia", name: "Mia college", icon: "🎓", target: 40000, targetDate: "2027-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true });
  const pat = compute(p, ST).people[0];
  assert.equal(pat.child.college, 35000); assert.equal(pat.need, 71000);
  assert.deepEqual(pat.child.collegeOthers, [{ id: "g-mia", name: "Mia college", for: ["Mia"], why: "grown" }]);
  assert.deepEqual(pat.child.collegeKids.map((k) => [k.name, k.year]), [["Kit", 2034]]);
  // with no birth date the same goal is still not Kit's
  p.household.people.find((x) => x.id === "p-mia").birthDate = "";
  const q = compute(p, ST).people[0];
  assert.equal(q.child.college, 35000); assert.deepEqual(q.child.collegeOthers.map((g) => g.why), ["nobirth"]);
});

test("a goal named with 529 is an education goal, as the Education page treats it", () => {
  // "Kit 529", $30,000, a target icon: the Education page ties it to Kit, so it is Kit's college (not the page's $113,350):
  // 108,000 - 69,000 + 30,000 + 3,000 + 8,300 - 15,000 = 65,300, so $66,000; the rule of thumb counts it too
  const p = singleParent();
  p.goals = [{ id: "g-529", name: "Kit 529", icon: "🎯", target: 30000, targetDate: "2034-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  const pat = compute(p, ST).people[0];
  assert.deepEqual(pat.child.collegeParts.map((x) => [x.name, x.from, x.for, x.amount]), [["Kit 529", "goal", ["Kit"], 30000]]);
  near(pat.child.total, 65300); assert.equal(pat.need, 66000); assert.equal(pat.dime.education, 30000);
});

test("the Education page's figure is quoted and counted as that page shows it (to the $10, its own function)", () => {
  const p = singleParent(); p.goals = [];
  const e = education(p, ST).children[0];
  const [f] = compute(p, ST).people[0].child.collegeParts[0].figures;
  assert.equal(f.full, shownAmount(e.totalToday)); assert.equal(f.amount, f.full); assert.equal(f.full % 10, 0);
  // a 50% share: half of the figure as shown, $113,350 x 0.5 = $56,675
  p.whatIfs = { college: { "p-kit": { share: 0.5 } } };
  const [h] = compute(p, ST).people[0].child.collegeParts[0].figures;
  assert.deepEqual([h.full, h.share, h.amount], [113350, 0.5, 56675]);
});

test("the children's share of the spending steps down as each child turns 18, like childcare", () => {
  // A turns 18 in July 2028, B in January 2032; the rest $30,000 a year = $2,500 a month: two thirds ($1,666.67) until A
  // turns 18, then half ($1,250) until B does
  const r = childNeed({ children: [{ name: "A", birthDate: "2010-07-01" }, { name: "B", birthDate: "2014-01-01" }], startYear: 2026, realDiscount: 0, spending: 30000 });
  assert.deepEqual(r.shareSteps.map((s) => [Math.round(s.monthly * 100) / 100, s.fraction, s.until, s.who]), [[1666.67, 2 / 3, 2028, ["A"]], [1250, 0.5, 2032, ["B"]]]);
});

// ---- fifth pass (2026-11-02): each child's own Social Security, the need over time, shown parts that add up, whose goal,
// the rule of thumb's goals, the rule of thumb said in the headline
import { shownChild, childFigure, collegeLeft } from "./compute.js";
import { render as renderPage } from "./view.js";
import { money as fmtMoney, date as fmtDate } from "../../../core/format.js";

/**
 * Get started's single parent (invented): Jo (born 1993-03-15, $62,000), Child 1 (born 2022-07-15), a $4,000 card at 24%
 * ($150 a month), $400 checking and $1,500 savings, $900 a month of childcare and $2,920 of everything else, Social Security
 * $2,430 at full retirement age, Get started's "Education" goal with no amount; prices 3%, bonds 4%, cash 2% (the defaults).
 */
function sampleJo() {
  const p = emptyPlan();
  p.household = { people: [{ id: "s-jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "s-k1", name: "Child 1", role: "dependent", birthDate: "2022-07-15" }], filingStatus: "head_of_household", state: "OH" };
  p.accounts = [
    { id: "s-chk", name: "Checking", type: "checking", balance: 400, asOf: "2026-11-02", ownerId: "", history: [] },
    { id: "s-sav", name: "Savings", type: "savings", balance: 1500, asOf: "2026-11-02", ownerId: "", history: [] },
    { id: "s-card", name: "Credit cards", type: "credit", balance: 4000, asOf: "2026-11-02", ownerId: "", history: [] },
  ];
  p.debts = [{ id: "s-debt", accountId: "s-card", rate: 0.24, minPayment: 150, extra: 0 }];
  p.income = [{ id: "s-pay", name: "Jo's pay", type: "salary", personId: "s-jo", amount: 62000, period: "annual", growth: 0, taxable: true }];
  const line = (id, name, category, amount) => ({ id, name, category, amount, period: "monthly", essential: true, inflates: true });
  p.expenses = [line("x1", "Rent", "housing", 1300), line("x2", "Utilities and phone", "utilities", 220), line("x3", "Groceries", "groceries", 500), line("x4", "Car, gas and transit", "transport", 350),
    line("x5", "Insurance and health", "insurance", 150), line("x6", "Childcare and school", "childcare", 900), line("x7", "Eating out and fun", "dining", 150), line("x8", "Shopping and everything else", "shopping", 250)];
  p.goals = [{ id: "s-cush", name: "Emergency fund", icon: "🛟", target: 21400, targetDate: "", priority: 1, saved: 0, fundedBy: ["s-chk", "s-sav"], monthly: 0, rate: null, inflates: false, isEmergencyFund: true },
    { id: "s-edu", name: "Education", icon: "🎓", target: 0, targetDate: "2040-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  p.retirement = { ...p.retirement, spendingMonthly: 2920, socialSecurity: { "s-jo": { monthlyAtFRA: 2430 } } };
  p.insurance = { policies: [] };
  return p;
}
const kidOf = (id, name, birthDate) => ({ id, name, role: "dependent", birthDate });
/** life-ver4-1's cases on the sample: twoss (Child 2 born 2019-04-10, a $3,300 record, rent $900), twossrich (+$20,000 saved), leftout (Child 2 born 2016-02-10, 0% of Child 2's college) */
const twoss = () => { const p = sampleJo(); p.household.people.push(kidOf("s-k2", "Child 2", "2019-04-10")); p.retirement.socialSecurity = { "s-jo": { monthlyAtFRA: 3300 } }; p.expenses.find((x) => x.id === "x1").amount = 900; return p; };
const twossrich = () => { const p = twoss(); p.accounts.find((a) => a.id === "s-sav").balance = 21500; return p; };
const leftout = () => { const p = sampleJo(); p.household.people.push(kidOf("s-k2", "Child 2", "2016-02-10")); p.whatIfs = { college: { "s-k2": { type: "public", share: 0, years: 4, startAge: 18 } } }; return p; };
const T5 = { today: "2026-11-02" };
// by hand: the Education page's figures (25,850 a year now, college prices up 4% a year, in today's money at 3%, to the $10)
const g = 1.04 / 1.03;
const eduFigure = (a, b) => { let t = 0; for (let i = a; i <= b; i++) t += 25850 * Math.pow(g, i); return Math.round(t / 10) * 10; };
const hundred = (n) => Math.round(n / 100) * 100;
// one child's part as shown: costs, college and Social Security to $100, Social Security counted only up to the other two
const shortOf = ({ costs, college, ss }) => { const c = hundred(costs), k = hundred(college), b = hundred(ss); return c + k - Math.min(b, c + k); };
// the savings at the start of a year as the retirement projection grows them: $1,900 of cash at 2% a year, in today's money
const cashAt = (year, balance = 1900) => hundred(balance * Math.pow(1.02, year - 2026) / Math.pow(1.03, year - 2027));
const upTo1000 = (n) => Math.ceil(Math.max(0, n) / 1000) * 1000;

test("fifth pass: each child's own Social Security pays only that child's costs and college (Pat, Kit and Lu)", () => {
  // Lu (born 2009-12-01) is 16: no childcare, 18 in December 2027, so November 2026 - November 2027 = 13 months; 0% of Lu's
  // college chosen on Education. Kit has all the $500 after-school care (the only child under 13), November 2026 - June 2029.
  const p = singleParent(); p.household.people.push({ id: "p-lu", name: "Lu", role: "dependent", birthDate: "2009-12-01" }); p.whatIfs = { college: { "p-lu": { share: 0 } } };
  const c = compute(p, ST).people[0].child;
  // the rest, $2,000 a month: a third each while both are under 18, then Kit's half; Social Security 2 x $750 (the $1,500
  // family maximum), then $750
  //   Lu:  share 13 x 666.67 = 8,666.67; Social Security 13 x 750 = 9,750: covered, 1,083.33 kept for Lu
  //   Kit: childcare 32 x 500 = 16,000 + share 13 x 666.67 + 79 x 1,000 = 87,666.67 -> 103,666.67; college 40,000 - 5,000 =
  //        35,000; Social Security 13 x 750 + 79 x 750 = 69,000: 69,666.67 short
  const [kit, lu] = c.perChild;
  near(kit.costs, 16000 + 13 * 2000 / 3 + 79 * 1000, 1e-6); near(kit.college, 35000); near(kit.benefits, 69000, 1e-6); near(kit.short, 69666.67, 0.01);
  near(lu.costs, 13 * 2000 / 3, 1e-6); near(lu.benefits, 9750, 1e-6); near(lu.short, 0); near(lu.spare, 1083.33, 0.01);
  // need = 69,666.67 + 3,000 + 8,300 - 15,000 = 65,966.67; as shown: 69,700 + 3,000 + 8,300 - 15,000 = 66,000, so $66,000. Pooled
  // (Lu's spare paying Kit's costs) it was 112,333.33 + 35,000 - 78,750 + ... = 64,883.33, so $65,000
  near(c.kidsShort, 69666.67, 0.01); assert.equal(c.shown.net, 66000); assert.equal(c.today, 66000);
  near(c.costs + c.college - c.benefits + 3000 + 8300 - 15000, 64883.33, 0.01);
});

test("fifth pass: leftout, Child 2's spare Social Security never pays Child 1's college (life-ver4-1 #2)", () => {
  const c = compute(leftout(), T5).people[0].child;
  // Child 1: $279,100 against costs $227,600 and college $104,900 = $332,500: $53,400 short. Child 2: $152,600 against
  // $93,500 of costs: $59,100 kept for Child 2. 53,400 + 4,000 + 8,300 - 1,900 = 63,800, so $64,000 today (pooled it said
  // 321,100 + 104,900 < 431,700, "covered", and $11,000)
  assert.deepEqual(c.shown.kids.map((k) => [k.name, k.costs, k.college, k.benefits, k.short, k.spare]), [["Child 1", 227600, 104900, 279100, 53400, 0], ["Child 2", 93500, 0, 152600, 0, 59100]]);
  assert.equal(c.shown.net, 63800); assert.equal(c.today, 64000);
  assert.equal(childParts(c, "Jo"), "the children's costs until 18 ($321,100) and Child 1's college ($104,900) less what each child's own Social Security pays for them ($372,600), plus debts ($4,000) and a funeral ($8,300), less the $1,900 Jo has saved");
});

test("fifth pass: shown parts always add up (the spare is the shown total less the shown part counted; the answer from the shown parts)", () => {
  // Ed and Ann (born 2021-05-05) with "Education fund" $100,000: each child's Social Security $256,676.64 shown $256,700, of it
  // $220,120.05 counted shown $220,100; the spare is 513,400 - 440,200 = $73,200 (rounded on its own it said $73,100)
  const p = sampleJo();
  p.household.people = [p.household.people[0], kidOf("k-ed", "Ed", "2021-05-05"), kidOf("k-ann", "Ann", "2021-05-05")];
  p.goals = [p.goals[0], { id: "g-fund", name: "Education fund", icon: "🎓", target: 100000, targetDate: "2039-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  const c = compute(p, T5).people[0].child;
  assert.deepEqual([c.shown.benefits, c.shown.counted, c.shown.spare], [513400, 440200, 73200]);
  assert.equal(Math.round(c.benefitsSpare / 100) * 100, 73100);
  // the sample: 313,100 + 104,900 - 279,100 + 4,000 + 8,300 - 1,900 = 149,300, rounded up to $150,000
  const s = compute(sampleJo(), T5).people[0].child.shown;
  assert.equal(s.costs + s.college - s.counted + s.debts + s.funeral - s.savings, 149300); assert.equal(s.net, 149300);
  // the answer is the shown parts rounded up, so the page's sum and its $1,000 always agree: two children with exact parts
  // adding to 437,032.64 show 84,900 + 37,700 + 203,200 + 104,900 + 14,700 + 8,300 - 16,800 = 436,900, so $437,000 (not $438,000)
  const two = { perChild: [{ name: "A", costs: 84948.2, college: 37747.3, benefits: 0 }, { name: "B", costs: 203197.4, college: 104917.1, benefits: 0 }], debts: 14700, funeral: 8300, savings: 16777.36 };
  assert.equal(shownChild(two).net, 436900); assert.equal(childFigure(two), 437000);
});

test("fifth pass: the need over time on the sample, by hand: today's $150,000 is the largest in today's money", () => {
  const jo = compute(sampleJo(), T5).people[0], c = jo.child;
  const at = (y) => c.needByYear.find((x) => x.year === y);
  // one year for each death at the start of the year, now to Child 1's last college year (2040-2043 on the Education page)
  assert.deepEqual([c.needByYear[0].year, c.needByYear.at(-1).year, c.needByYear.length], [2026, 2043, 18]);
  // the card on the payoff plan: $4,000 x 1.02 - 150 = $3,930 at the start of 2027; 39 months to pay off, so nothing from 2031
  near(at(2027).debts, 3930, 0.005); assert.equal(at(2031).debts, 0);
  // 2040: Child 1's six months to July: share 6 x 1,460 = 8,760 -> 8,800, Social Security 6 x 1,822.50 = 10,935 -> 10,900,
  // college the Education page's $120,110 in full (the year is reached) -> 120,100: 118,000 short; savings 1,900 x 1.02^14 /
  // 1.03^13 = 1,707 -> 1,700: 118,000 + 8,300 - 1,700 = 124,600, so $125,000
  assert.equal(eduFigure(14, 17), 120110);
  assert.equal(shortOf({ costs: 6 * 1460, college: 120110, ss: 6 * 1822.5 }), 118000); assert.equal(cashAt(2040), 1700);
  assert.equal(at(2040).need, upTo1000(118000 + 8300 - cashAt(2040))); assert.equal(at(2040).need, 125000);
  // 2041: three of the four college years are left: 120,110 x 3/4 = 90,082.50 -> 90,100 + 8,300 - 1,700 = 96,700, so $97,000
  assert.equal(at(2041).need, upTo1000(hundred(120110 * 3 / 4) + 8300 - cashAt(2041))); assert.equal(at(2041).need, 97000);
  // 2043: the last year: 120,110 / 4 = 30,027.50 -> 30,000 + 8,300 - 1,700 = 36,600, so $37,000
  assert.equal(at(2043).need, upTo1000(hundred(120110 / 4) + 8300 - cashAt(2043))); assert.equal(at(2043).need, 37000);
  // the largest in today's money is today's (2027 is the same $150,000: the earliest is said); the need goes down and up
  // again, so it is not said to shrink; the cover lasts until Child 1's college ends. Sixth pass: the cover itself is sized
  // in that year's dollars, $184,000 for 2040 (see the sixth pass's test)
  assert.deepEqual(c.peak, { year: 2026, need: 150000 }); assert.equal(at(2027).need, 150000); assert.equal(c.today, 150000);
  assert.equal(jo.need, 184000); assert.equal(c.steady, false);
  assert.deepEqual(jo.termUntil, { year: 2044, why: "Child 1's college ends", who: "Child 1", event: "college ends" });
  assert.ok(c.needByYear.every((x) => x.need <= 150000));
});

test("fifth pass: the need over time on twoss and twossrich, by hand: largest if Jo died in 2037", () => {
  const two = compute(twoss(), T5).people[0], c = two.child;
  // today: each child's Social Security covers their own costs and college, so 4,000 + 8,300 - 1,900 = 10,400: $11,000
  assert.equal(c.today, 11000); assert.equal(c.shown.short, 0);
  // a death at the start of 2037, in today's money (bonds 4% against prices 3%: each later year counts 1/g, g = 1.04/1.03):
  //   Child 2 (18 in April 2037): January - March, a third of the $2,520 a month rest = 3 x 840 = 2,520 -> 2,500; Social
  //     Security 3 x 2,475 = 7,425 -> 7,400; college the Education page's $116,680 (2037-2040) in full -> 116,700: 111,800 short
  //   Child 1: share 3 x 840 + 9 x 1,260 in 2037, 12 x 1,260 in 2038 and 2039, 6 x 1,260 in 2040; Social Security 12 x 2,475
  //     a year, 6 in 2040; college 120,110 / g^3: 51,009.26 -> 51,000, 102,671.76 -> 102,700, 116,678.50 -> 116,700: 65,000 short
  //   savings 1,900 x 1.02^11 / 1.03^10 = 1,758 -> 1,800; the card is paid off: 65,000 + 111,800 + 8,300 - 1,800 = 183,300
  assert.equal(eduFigure(11, 14), 116680);
  const c2 = { costs: 3 * 840, college: 116680, ss: 3 * 2475 };
  const c1 = { costs: 3 * 840 + 9 * 1260 + 12 * 1260 / g + 12 * 1260 / g ** 2 + 6 * 1260 / g ** 3, college: 120110 / g ** 3, ss: 12 * 2475 * (1 + 1 / g + 1 / g ** 2) + 6 * 2475 / g ** 3 };
  assert.deepEqual([shortOf(c2), shortOf(c1), cashAt(2037)], [111800, 65000, 1800]);
  const y37 = c.needByYear.find((x) => x.year === 2037);
  assert.equal(y37.need, upTo1000(shortOf(c1) + shortOf(c2) + 8300 - cashAt(2037))); assert.equal(y37.need, 184000);
  // sixth pass: the cover is that year's need in that year's dollars, 184,000 x 1.03^10 = 247,281, so $248,000
  assert.deepEqual(c.peak, { year: 2037, need: 184000 }); assert.equal(two.need, 248000); assert.equal(two.gap, 248000); assert.equal(two.raise, true);
  // twossrich: $21,900 saved covers today (nothing to buy today), but in 2037 21,900 x 1.02^11 / 1.03^10 = 20,262 -> 20,300:
  // 65,000 + 111,800 + 8,300 - 20,300 = 164,800, so $165,000; not "covered"
  const rich = compute(twossrich(), T5).people[0];
  assert.equal(rich.child.today, 0); assert.equal(cashAt(2037, 21900), 20300);
  assert.deepEqual(rich.child.peak, { year: 2037, need: upTo1000(65000 + 111800 + 8300 - 20300) }); assert.equal(rich.need, 222000); assert.equal(rich.raise, true);
  // the words: the largest, its year, today's figure; the cover until Child 1's college ends
  const [gp] = protectionGaps(twoss(), T5);
  assert.equal(gp.title, "No life insurance on Jo: Child 1 and Child 2 would need up to about $248,000");
  assert.match(gp.sentence, /^If Jo died in 2037, Child 1 and Child 2 would need about \$248,000, in that year's dollars, the most in any year; if Jo died today, about \$11,000: Social Security for the children covers their costs until 18 and college; that leaves debts \(\$4,000\) and a funeral \(\$8,300\), less the \$1,900 Jo has saved\. Term life cover on Jo until about 2044 \(Child 1's college ends\) is the usual way to buy it\.$/);
});

test("fifth pass: the need over time on leftout, by hand: largest if Jo died in 2040 (Child 1 alone, as the sample then)", () => {
  const jo = compute(leftout(), T5).people[0], c = jo.child;
  // in 2040 Child 2 is grown and Child 2's college is not counted: the sample's 2040, 118,000 + 8,300 - 1,700 = $125,000
  assert.equal(c.today, 64000);
  assert.deepEqual(c.peak, { year: 2040, need: upTo1000(118000 + 8300 - cashAt(2040)) }); assert.equal(jo.need, 184000);
  // it rises every year until 2036 (each year of Child 1's own Social Security over Child 1's costs, kept for college, gone)
  const ys = c.needByYear.map((x) => x.need);
  assert.deepEqual(ys.slice(0, 5), [64000, 65000, 70000, 74000, 78000]); assert.equal(c.steady, false);
});

test("fifth pass: a later year keeps today's childcare split (one child's part never grows when another turns 13)", () => {
  // A (born 2022-07-15) and B (born 2016-02-10, 13 in February 2029) share $900 a month today: $450 each. For a death in 2030 A
  // keeps $450 a month to June 2035, 66 months = 29,700 (re-split, A would get all $900: 59,400)
  const kids = [{ name: "A", birthDate: "2022-07-15", care: 0.5 }, { name: "B", birthDate: "2016-02-10", care: 0.5 }];
  const r = childNeed({ children: kids, startYear: 2030, realDiscount: 0, spending: 10800, childcare: [{ yearly: 10800 }] });
  near(r.perChild[0].childcare, 66 * 450); near(r.childcare, 66 * 450);
  const re = childNeed({ children: kids.map(({ care, ...k }) => k), startYear: 2030, realDiscount: 0, spending: 10800, childcare: [{ yearly: 10800 }] });
  near(re.childcare, 66 * 900);
  // the college still to come for a death at the start of a year: all of it until college starts, then the years not begun
  assert.equal(collegeLeft(2039, 2040, 4), 1); assert.equal(collegeLeft(2040, 2040, 4), 1); assert.equal(collegeLeft(2041, 2040, 4), 3 / 4); assert.equal(collegeLeft(2044, 2040, 4), 0);
});

test("fifth pass: a goal naming someone else is never the only child's (Mia with no birth date, either order; Jo's night school first)", () => {
  // life-ver4-0 #1: "Mia college" ($40,000) for Mia, who has no birth date, before or after Get started's "Education", or alone:
  // Child 1's college is the Education page's $120,110 (104,914.03 counted), the need $150,000, and Mia's goal is named
  const mia = (order) => {
    const p = sampleJo(); p.household.people.push({ id: "k-mia", name: "Mia", role: "dependent", birthDate: "" });
    const g = { id: "g-mia", name: "Mia college", icon: "🎓", target: 40000, targetDate: "2030-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true };
    p.goals = order === "first" ? [p.goals[0], g, p.goals[1]] : order === "alone" ? [p.goals[0], g] : [...p.goals, g];
    return p;
  };
  for (const order of ["first", "last", "alone"]) {
    const p = mia(order), jo = compute(p, T5).people[0];
    assert.equal(jo.child.today, 150000, order); assert.equal(jo.need, 184000, order); near(jo.child.college, 104914.03, 0.01);
    assert.deepEqual(jo.child.collegeOthers, [{ id: "g-mia", name: "Mia college", for: ["Mia"], why: "nobirth" }], order);
    assert.equal(education(p, T5).children[0].goal?.name ?? null, order === "alone" ? null : "Education", order);
  }
  // life-ver4-1 #3: "Jo's night school" listed first is Jo's own: the Education page ties Child 1 to "Education", as this page does
  const a = sampleJo(); a.goals.unshift({ id: "g-jo", name: "Jo's night school", icon: "🎓", target: 6000, targetDate: "2028-08-15", priority: 2, saved: 2000, fundedBy: [], monthly: 0, rate: null, inflates: true });
  assert.deepEqual(education(a, T5).children[0].goal, { id: "s-edu", name: "Education" }); assert.equal(compute(a, T5).people[0].child.today, 150000);
});

test("fifth pass: the rule of thumb counts the same goals as the answer (a grown dependent's college left out)", () => {
  // Mia (born 2006-09-01) with "Mia college" $30,000 ($4,000 saved) and "Child 1 529" $50,000 ($3,000 saved): the rule of
  // thumb's education is 50,000 - 3,000 = $47,000, not 47,000 + 26,000 = $73,000
  const p = sampleJo(); p.household.people.push(kidOf("k-mia", "Mia", "2006-09-01"));
  p.goals.push({ id: "g-mia", name: "Mia college", icon: "🎓", target: 30000, targetDate: "2027-08-15", priority: 2, saved: 4000, fundedBy: [], monthly: 0, rate: null, inflates: true },
    { id: "g-529", name: "Child 1 529", icon: "🎯", target: 50000, targetDate: "2040-08-15", priority: 2, saved: 3000, fundedBy: [], monthly: 0, rate: null, inflates: true });
  const jo = compute(p, T5).people[0];
  assert.equal(jo.method, "child"); assert.equal(jo.dime.education, 47000); near(jo.dime.total, jo.dime.debts + jo.dime.finalExpenses + jo.dime.income + 47000);
  // the couple's rule of thumb is unchanged: Cy's $90,000 goal less $4,000
  assert.equal(compute(familyPlan("2026-11-02"), T5).people[0].dime.education, 86000);
});

// the page itself, from a tiny stand-in for the DOM (no browser): its words for the fifth pass's rules
function pageOf(plan, today = "2026-11-02") {
  const el = (tag, attrs = {}, ...kids) => {
    const node = { tag, attrs: { ...(attrs ?? {}) }, children: [], parent: null, hidden: !!attrs?.hidden,
      classList: { add: (c) => { node.attrs.class = `${node.attrs.class ?? ""} ${c}`.trim(); } },
      append: (...xs) => { for (const x of xs.flat(Infinity)) if (x !== null && x !== undefined && x !== false) { if (typeof x === "object") { x.parent = node; node.children.push(x); } else node.children.push(String(x)); } },
      replaceChildren: (...xs) => { node.children = []; node.append(...xs); }, setAttribute: (k, v) => { node.attrs[k] = v; },
      remove: () => { if (node.parent) node.parent.children = node.parent.children.filter((c) => c !== node); },
      querySelector: (sel) => { const cls = sel.replace(/^\./, ""); const find = (n) => { for (const c of n.children) if (typeof c === "object") { if (String(c.attrs.class ?? "").split(" ").includes(cls)) return c; const r = find(c); if (r) return r; } return null; }; return find(node); },
      scrollIntoView: () => {} };
    node.append(...kids);
    return node;
  };
  const ui = { h: el, card: (t, ...k) => el("section", { class: "card" }, el("h2", {}, t), ...k), stat: (a, b, c) => el("div", { class: "stat" }, a, " ", b, " ", c ?? ""), row: (...x) => el("div", { class: "row" }, ...x), button: (l, f, a) => el("button", a ?? {}, l), notice: (k, c) => el("div", { class: `notice ${k}` }, c) };
  const page = el("main");
  renderPage(page, { ui, fmt: { money: (n, c) => fmtMoney(n, c), date: (i) => fmtDate(i), today: () => today }, plan, computeRemote: (id, params) => ({ then: (ok) => ok(compute(plan, params)) }) });
  const text = (n) => (typeof n === "string" ? n : n.tag === "style" ? "" : n.children.map(text).join(" ")).replace(/\s+/g, " ").trim();
  const all = (tag) => { const out = []; const walk = (n) => { if (typeof n === "string") return; if (n.tag === tag) out.push(text(n)); n.children.forEach(walk); }; walk(page); return out; };
  // the paragraph under a heading ("For how long")
  const after = (h3) => { let hit = null; const walk = (n) => { if (typeof n === "string" || hit) return; const i = n.children.findIndex((c) => typeof c === "object" && c.tag === "h3" && text(c) === h3); if (i >= 0) { hit = text(n.children[i + 1]); return; } n.children.forEach(walk); }; walk(page); return hit; };
  // the tiles (`ui.stat`): "Cover needed $184,000 the most, ..."
  const stats = []; const walkStats = (n) => { if (typeof n === "string") return; if (n.tag === "div" && n.attrs.class === "stat") stats.push(text(n)); n.children.forEach(walkStats); }; walkStats(page);
  // the notices (`ui.notice`): "$100,000 of Jo's cover comes with the job ..."
  const notices = []; const walkN = (n) => { if (typeof n === "string") return; if (n.tag === "div" && /^notice /.test(n.attrs.class ?? "")) notices.push(text(n)); n.children.forEach(walkN); }; walkN(page);
  return { h1: all("h1")[0], lede: all("p")[0], p: all("p"), li: all("li"), after, stats, notices };
}

test("fifth pass, the page: the largest need with its year said once, each child's Social Security said child by child, never 'shrinks'", () => {
  const lo = pageOf(leftout());
  // sixth pass: the cover in that year's dollars ($184,000), the year list in today's money ($125,000 in 2040)
  assert.equal(lo.h1, "Jo needs about $184,000 more life cover");
  assert.match(lo.lede, /^That is the most the children would need, if Jo died in 2040, in that year's dollars\. Today it would be \$64,000; no life insurance is on file\./);
  const ss = lo.li.find((x) => x.startsWith("Social Security for the children"));
  assert.match(ss, /^Social Security for the children −\$372,600 /);
  assert.match(ss, /That is about \$431,700 in all, but each child's is that child's own money: it pays only that child's costs and college\. Child 1's \(about \$279,100\) covers Child 1's costs until 18; Child 1 still needs \$53,400 for college\. Child 2's \(about \$152,600\) covers Child 2, and the other \$59,100 is kept for Child 2\./);
  assert.ok(lo.li.some((x) => x.startsWith("Needed today $64,000 Added up, about $63,800,")));
  assert.match(lo.after("For how long"), /In today's money it is largest if Jo died in 2040\. It ends when Child 1's college ends, in about 2044\. A policy pays the same dollars every year while prices rise, so it is sized to the most in that year's dollars: about \$184,000, if Jo died in 2040\. Cover for that amount that lasts until about 2044 covers every year/);
  assert.ok(lo.p.some((x) => x.startsWith("A level term policy for about $184,000 (the most Child 1 and Child 2 would need, if Jo died in 2040, in that year's dollars) that lasts until about 2044 (Child 1's college ends)")));
  // the sample: largest now, but it goes down and up again: never "shrinks"; its parts add up to the figure said
  const s = pageOf(sampleJo());
  assert.match(s.after("For how long"), /^In today's money, the need is largest now\. It goes down and up again over the years/);
  assert.doesNotMatch(s.after("For how long"), /shrink/);
  const val = (label) => Number(s.li.find((x) => x.startsWith(label)).slice(label.length).match(/^ ?−?\$([\d,]+)/)[1].replace(/,/g, ""));
  assert.equal(val("Child 1's costs until 18") + val("College") - val("Social Security for Child 1") + val("Debts") + val("Funeral") - val("Savings that pass to Child 1"), 149300);
  assert.ok(s.li.some((x) => x.startsWith("Needed today $150,000 Added up, about $149,300, and rounded up to the next $1,000.")));
  // twossrich: nothing needed today, but not "covered"
  assert.match(pageOf(twossrich()).lede, /^That is the most the children would need, if Jo died in 2037, in that year's dollars\. If Jo died today, Social Security and savings would pay for everything the children would need;/);
  // twoss: $11,000 today, down to $7,000, then up to $184,000 in 2037: not said to grow from today
  const tw = pageOf(twoss()).after("For how long");
  assert.match(tw, /^The need goes down for a few years, then grows: .* In today's money it is largest if Jo died in 2037\./);
  assert.doesNotMatch(tw, /grows for a while|shrink/);
  // leftout grows every year to 2040; the year list names the children
  assert.match(lo.after("For how long"), /^The need grows for a while:/);
  assert.ok(lo.p.some((x) => /in today's money: the children that much older/.test(x)));
  // one child: the year list names the child, not "the children"
  assert.ok(s.p.some((x) => /in today's money: Child 1 that much older/.test(x)));
});

test("fifth pass, the page: one college figure for a child turning 18 now; the spare that adds up; the rule of thumb in the headline and its goals", () => {
  // turning 18 this month: the Education page's $104,920, counted as $104,900, and why they differ
  const t = sampleJo(); t.household.people[1].birthDate = "2008-11-20";
  const tp = pageOf(t);
  assert.match(tp.li.find((x) => x.startsWith("College")), /^College \$104,900 The Education page puts Child 1's college at \$104,920 in today's money\. That is about \$104,900 here, to the nearest \$100 like every part of this answer\./);
  assert.match(tp.after("For how long"), /^The need is largest now and gets smaller every year\. It ends when Child 1's college ends, in about 2030\./);
  // Ed and Ann: "the other $73,200" (513,400 - 440,200)
  const e = sampleJo(); e.household.people = [e.household.people[0], kidOf("k-ed", "Ed", "2021-05-05"), kidOf("k-ann", "Ann", "2021-05-05")];
  e.goals = [e.goals[0], { id: "g-fund", name: "Education fund", icon: "🎓", target: 100000, targetDate: "2039-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  assert.match(pageOf(e).li.find((x) => x.startsWith("Social Security for the children")), /That is about \$513,400 in all, .* and the other \$73,200 is the children's money/);
  // a second adult with no birth date: the headline says the figure is a rule of thumb until the birth date is in
  const n = sampleJo(); n.household.people.push({ id: "p-sam", name: "Sam", role: "partner", birthDate: "" });
  const np = pageOf(n);
  assert.equal(np.h1, "Jo needs about $862,000 more life cover, by a rule of thumb until Sam's birth date is in");
  // the rule of thumb leaves savings out, so it is not said to shrink "as savings grow"
  assert.match(np.after("For how long"), /^The rule of thumb is largest now and gets smaller every year, as fewer years of Jo's pay are left to count\./);
  // a grown dependent's goal: left out of the rule of thumb too, and its note says so
  const m = sampleJo(); m.household.people.push(kidOf("k-mia", "Mia", "2006-09-01"));
  m.goals.push({ id: "g-mia", name: "Mia college", icon: "🎓", target: 30000, targetDate: "2027-08-15", priority: 2, saved: 4000, fundedBy: [], monthly: 0, rate: null, inflates: true });
  const mp = pageOf(m);
  assert.ok(mp.p.some((x) => /Like the answer above, neither counts “Mia college”: it is for Mia, not the children under 18\./.test(x)));
  assert.doesNotMatch(mp.li.find((x) => x.startsWith("Debts, pay")), /education/);
});

// sixth pass (life-ver5-0, life-ver5-1): a level policy pays the same dollars every year while prices rise. The compute module
// is read as a whole here, so a name it does not export yet fails only the test that uses it
import * as lifeNeeds from "./compute.js";
// the plan's price level as the series divides by it: prices 3% a year from the start of 2027 (1.03^(year - 2027))
const priceLevel = (y) => Math.pow(1.03, Math.max(0, y - 2027));
// a term policy on Jo (invented), optionally ending
const withPolicy = (base, benefit, extra = {}) => { const p = base(); p.insurance = { policies: [{ id: "t1", name: "Term", kind: "term", personId: "s-jo", benefit, premium: 20, period: "monthly", ...extra }] }; return p; };
const edAnn = () => {
  const p = sampleJo();
  p.household.people = [p.household.people[0], kidOf("k-ed", "Ed", "2021-05-05"), kidOf("k-ann", "Ann", "2021-05-05")];
  p.goals = [p.goals[0], { id: "g-fund", name: "Education fund", icon: "🎓", target: 100000, targetDate: "2039-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  return p;
};

test("sixth pass: the cover is the most of each year's need in that year's dollars (sample, twoss, leftout, twossrich, Ed and Ann)", () => {
  // the sample: today's $150,000 is the largest in today's money, but 2040's $125,000 is 125,000 x 1.03^13 = 183,566.71 in
  // 2040's dollars, so a level policy for $184,000 (one for $150,000 would be worth about $102,100 then, $22,900 short)
  const jo = compute(sampleJo(), T5).people[0], c = jo.child;
  near(125000 * priceLevel(2040), 183566.71, 0.01);
  for (const y of c.needByYear) { near(y.priceLevel, priceLevel(y.year), 1e-9); near(y.dollars, y.need * priceLevel(y.year), 1e-6); }
  assert.deepEqual([c.sized.year, c.sized.need, c.sized.real], [2040, 184000, 125000]);
  assert.equal(jo.need, upTo1000(125000 * priceLevel(2040))); assert.equal(jo.gap, 184000);
  // the year list stays in today's money: the largest there is still today's $150,000
  assert.deepEqual(c.peak, { year: 2026, need: 150000 }); assert.equal(c.today, 150000);
  // twoss 184,000 x 1.03^10 = 247,280.61; twossrich 165,000 x 1.03^10 = 221,746.20; leftout as the sample's 2040; Ed and Ann
  // 100,000 x 1.03^12 = 142,576.09
  for (const [name, plan, year, real, need] of [["twoss", twoss, 2037, 184000, 248000], ["twossrich", twossrich, 2037, 165000, 222000], ["leftout", leftout, 2040, 125000, 184000], ["Ed and Ann", edAnn, 2039, 100000, 143000]]) {
    const q = compute(plan(), T5).people[0];
    assert.deepEqual([q.child.sized.year, q.child.sized.real, q.need], [year, real, need], name);
    assert.equal(q.need, upTo1000(real * priceLevel(year)), name);
    // no year's need in its own dollars is over the cover
    assert.ok(q.child.needByYear.every((x) => x.dollars <= q.need), name);
  }
  // the page: the figure with its year in the hero, the tile and How to get it; the reason said once, plainly
  const sp = pageOf(sampleJo());
  assert.equal(sp.h1, "Jo needs about $184,000 more life cover");
  assert.match(sp.lede, /^That is the most Child 1 would need, if Jo died in 2040, in that year's dollars\. Today it would be \$150,000;/);
  assert.ok(sp.stats.includes("Cover needed $184,000 the most, if Jo died in 2040, in that year's dollars"));
  assert.ok(sp.p.some((x) => x.startsWith("A level term policy for about $184,000 (the most Child 1 would need, if Jo died in 2040, in that year's dollars)")));
  assert.match(sp.after("For how long"), /A policy pays the same dollars every year while prices rise, so it is sized to the most in that year's dollars: about \$184,000, if Jo died in 2040\./);
  assert.equal([...sp.p, ...sp.li].join(" ").split("A policy pays the same dollars every year while prices rise").length - 1, 1);
  // the year list in today's money, the year the cover is sized to marked with its figure in that year's dollars
  assert.ok(sp.li.includes("2026 (today) $150,000"));
  assert.ok(sp.li.includes("2040 $125,000 About $184,000 in 2040's dollars, the most of any year: the cover is sized to it."));
  // the total line says today's figure and points to the later year; never that the need is larger later in today's money
  assert.ok(sp.li.some((x) => x.startsWith("Needed today $150,000") && x.endsWith("The cover is sized to a later year: about $184,000 if Jo died in 2040, in that year's dollars (see For how long).")));
  // Next best action and Needs attention: the same figure and year
  const [gp] = protectionGaps(sampleJo(), T5);
  assert.equal(gp.title, "No life insurance on Jo: Child 1 would need up to about $184,000"); assert.equal(gp.gap, 184000);
  assert.match(gp.sentence, /^If Jo died in 2040, Child 1 would need about \$184,000, in that year's dollars, the most in any year; if Jo died today, about \$150,000:/);
  // a need largest today and smaller every year keeps today's figure (nothing later is larger, even in that year's dollars)
  const t = sampleJo(); t.household.people[1].birthDate = "2008-11-20";
  const tj = compute(t, T5).people[0];
  assert.deepEqual([tj.child.sized.year, tj.need], [2026, 116000]);
  assert.doesNotMatch(pageOf(t).after("For how long"), /same dollars/);
  // the couple's method and figures do not change
  const fam = compute(familyPlan("2026-11-02"), T5).people;
  assert.deepEqual(fam.map((q) => [q.method, q.need]), [["plan", 235000], ["plan", 0]]);
});

test("sixth pass: cover on file is checked year by year in that year's dollars (twoss with $200,000 or $180,000 is not covered)", () => {
  // $200,000 is worth 200,000 / 1.03^10 = 148,818.78 in today's money in 2037, against $184,000 then: 35,181.22 short
  const two = compute(withPolicy(twoss, 200000), T5).people[0], y37 = two.child.needByYear.find((x) => x.year === 2037);
  near(y37.coverWorth, 200000 / priceLevel(2037), 1e-6); near(y37.short, 35181.22, 0.01);
  // not covered (the page said "covered, with about $16,000 to spare"): $48,000 more of level cover pays every year
  assert.deepEqual([two.need, two.cover, two.gap, two.spare, two.raise], [248000, 200000, 48000, 0, true]);
  assert.ok(two.child.needByYear.every((x) => x.dollars <= two.cover + two.gap));
  const p200 = pageOf(withPolicy(twoss, 200000));
  assert.equal(p200.h1, "Jo needs about $48,000 more life cover");
  assert.ok(p200.p.includes("Short by about $48,000."));
  // (review 2026-11-06: the shortfall said in both kinds of dollars)
  assert.ok(p200.p.includes("If Jo died in 2037, the $200,000 on file would be worth about $148,800 in today's money, against $184,000 needed then: about $35,200 short in today's money, which is the $48,000 more cover in 2037's dollars (rounded up to the next $1,000)."));
  assert.doesNotMatch([...p200.p, ...p200.li].join(" "), /Your family is covered|to spare/);
  const [g200] = protectionGaps(withPolicy(twoss, 200000), T5);
  assert.equal(g200.title, "Jo's life cover is about $48,000 short");
  // $180,000: $68,000 short (worth 133,936.90 in 2037: $50,063 short then), not "close to covered", and Needs attention says so
  const t180 = compute(withPolicy(twoss, 180000), T5).people[0];
  near(t180.child.needByYear.find((x) => x.year === 2037).short, 184000 - 180000 / priceLevel(2037), 1e-6);
  assert.deepEqual([t180.gap, t180.raise], [68000, true]);
  assert.equal(pageOf(withPolicy(twoss, 180000)).h1, "Jo needs about $68,000 more life cover");
  const [g180] = protectionGaps(withPolicy(twoss, 180000), T5);
  assert.equal(g180.title, "Jo's life cover is about $68,000 short"); assert.equal(g180.gap, 68000);
  // enough, checked the same way: $250,000 pays every year (2037's need is $247,280.61 in that year's dollars)
  const t250 = compute(withPolicy(twoss, 250000), T5).people[0];
  assert.deepEqual([t250.gap, t250.spare, t250.raise], [0, 2000, false]); assert.ok(t250.child.needByYear.every((x) => x.short === 0));
  assert.equal(pageOf(withPolicy(twoss, 250000)).h1, "Your family is covered");
  assert.deepEqual(protectionGaps(withPolicy(twoss, 250000), T5), []);
});

test("sixth pass: cover that ends soon says what is needed after it ends, with its year, never less a policy that will be gone (twossend)", () => {
  // twoss with a $200,000 policy ending 6/30/2027: today's $11,000 (and 2027's) is covered; after it ends the most is 2037's,
  // $248,000 in that year's dollars, and nothing stays on file
  const p = withPolicy(twoss, 200000, { endDate: "2027-06-30" });
  const jo = compute(p, T5).people[0];
  assert.deepEqual([jo.child.afterEnd.year, jo.child.afterEnd.need, jo.child.coverStays, jo.child.coveredUntilEnd, jo.gapAfterEnd, jo.raise], [2037, 248000, 0, true, 248000, true]);
  const pg = pageOf(p);
  assert.equal(pg.h1, "Jo needs about $248,000 more life cover");
  assert.equal(pg.lede, "Jo's $200,000 term policy ends on 6/30/2027, and Child 1 and Child 2 count on Jo until about 2044. After it ends they would need up to about $248,000, if Jo died in 2037, in that year's dollars.");
  assert.ok(pg.p.includes("Covered until 6/30/2027, when $200,000 of it ends; after that short by up to about $248,000 (the most Child 1 and Child 2 would need, if Jo died in 2037, in that year's dollars)."));
  assert.ok(pg.p.some((x) => x.startsWith("A level term policy for about $248,000 (the most Child 1 and Child 2 would need after $200,000 of cover ends, if Jo died in 2037, in that year's dollars) that lasts until about 2044")));
  const words = [...pg.p, ...pg.li].join(" ");
  assert.doesNotMatch(words, /less the \$200,000|from then\.|would be about \$248,000 short/);
  const [gp] = protectionGaps(p, T5);
  assert.equal(gp.title, "Jo's term life cover ends 6/30/2027: Child 1 and Child 2 would then need up to about $248,000 (if Jo died in 2037)");
  assert.equal(gp.sentence, "Jo's $200,000 term policy ends on 6/30/2027, and Child 1 and Child 2 count on Jo until about 2044. After it ends they would need up to about $248,000: the most, if Jo died in 2037, in that year's dollars. New term cover on Jo from then closes it.");
  // what is needed after it ends, not the whole series' most: a child turning 18 now ($116,000 today, then $89,000 in 2027,
  // $62,000 ...) with $150,000 ending 6/30/2027: after it ends the most is 2027's $89,000
  const t = withPolicy(sampleJo, 150000, { endDate: "2027-06-30" }); t.household.people[1].birthDate = "2008-11-20";
  const tj = compute(t, T5).people[0];
  assert.deepEqual([tj.need, tj.gap, tj.child.afterEnd.year, tj.gapAfterEnd, tj.raise], [116000, 0, 2027, 89000, true]);
  const tp = pageOf(t);
  assert.equal(tp.h1, "Jo needs about $89,000 more life cover");
  assert.ok(tp.p.includes("Covered until 6/30/2027, when $150,000 of it ends; after that short by up to about $89,000 (the most Child 1 would need, if Jo died in 2027)."));
  assert.match(tp.lede, /and Child 1 counts on Jo until about 2030\. After it ends they would need up to about \$89,000, if Jo died in 2027\.$/);
  assert.match(protectionGaps(t, T5)[0].title, /would then need up to about \$89,000 \(if Jo died in 2027\)$/);
  // cover that stays is taken off; the ending one never is: $50,000 staying and $200,000 ending -> 248,000 - 50,000
  const both = twoss(); both.insurance = { policies: [{ id: "a", name: "Term", kind: "term", personId: "s-jo", benefit: 200000, premium: 20, period: "monthly", endDate: "2027-06-30" }, { id: "b", name: "Term 2", kind: "term", personId: "s-jo", benefit: 50000, premium: 10, period: "monthly" }] };
  const bj = compute(both, T5).people[0];
  assert.deepEqual([bj.child.coverStays, bj.gapAfterEnd], [50000, 198000]);
  assert.ok(pageOf(both).p.some((x) => x.startsWith("A level term policy for about $198,000 (the most Child 1 and Child 2 would need after $200,000 of cover ends, if Jo died in 2037, in that year's dollars, less the $50,000 that stays on file)")));
});

test("sixth pass: For how long reads the shape with a tolerance: a dip under 2% of the largest is not going down (three children)", () => {
  // Child 1, Ava (born 2016-02-10) and Ben (born 2011-06-01) on a $3,000 record: 155,000 to 153,000 before 2034's 180,000 is a
  // dip of 2,000, 1.1% of 180,000, under SHAPE_TOLERANCE (2%): the need grows for a while, not "goes down, then grows"
  const p = sampleJo(); p.household.people.push(kidOf("s-ava", "Ava", "2016-02-10"), kidOf("s-ben", "Ben", "2011-06-01")); p.retirement.socialSecurity = { "s-jo": { monthlyAtFRA: 3000 } };
  const c = compute(p, T5).people[0].child;
  assert.deepEqual(c.needByYear.slice(0, 9).map((x) => x.need), [102000, 105000, 128000, 155000, 155000, 154000, 153000, 153000, 180000]);
  assert.deepEqual(c.peak, { year: 2034, need: 180000 });
  assert.equal(lifeNeeds.SHAPE_TOLERANCE, 0.02); assert.ok(2000 < lifeNeeds.SHAPE_TOLERANCE * 180000);
  assert.deepEqual([c.rising, c.steady], [true, false]);
  const hl = pageOf(p).after("For how long");
  assert.match(hl, /^The need grows for a while:/); assert.doesNotMatch(hl, /goes down/);
  // twoss goes from 11,000 down to 7,000 first: 4,000, 2.2% of 184,000, so it still goes down for a few years
  assert.ok(4000 > lifeNeeds.SHAPE_TOLERANCE * 184000);
  assert.equal(compute(twoss(), T5).people[0].child.rising, false);
  assert.match(pageOf(twoss()).after("For how long"), /^The need goes down for a few years, then grows:/);
});

test("sixth pass, the words: leftout's spare is kept for that child; undated Mia's note says why; twossrich names what pays today's need", () => {
  // leftout: Child 2's college is not counted, so Child 2's spare is kept for Child 2, never "for that child's college"
  const lo = pageOf(leftout()).after("For how long");
  assert.match(lo, /and what it pays beyond each child's costs is kept for that child, Child 1's toward college: the later the death/);
  assert.doesNotMatch(lo, /kept for that child's college/);
  // when every child's college counts, the spare goes toward that child's college (twoss)
  assert.match(pageOf(twoss()).after("For how long"), /kept for that child's college:/);
  // undated Mia: not counted as a child under 18 because the birth date is missing (the page does not know her age)
  const m = sampleJo(); m.household.people.push({ id: "k-mia", name: "Mia", role: "dependent", birthDate: "" });
  m.goals.push({ id: "g-mia", name: "Mia college", icon: "🎓", target: 40000, targetDate: "2030-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true });
  const note = pageOf(m).p.find((x) => x.startsWith("The first counts"));
  assert.match(note, /Like the answer above, neither counts “Mia college”: it is for Mia, who is not counted as a child under 18 because Mia's birth date is missing on People\./);
  assert.doesNotMatch(note, /not the children under 18/);
  // twossrich: what covers today's need is named, never "would cover it" after another figure
  const r = pageOf(twossrich()).lede;
  assert.match(r, /\. If Jo died today, Social Security and savings would pay for everything the children would need; no life insurance is on file\./);
  assert.doesNotMatch(r, /would cover it/);
});

// Review 2026-11-06 (life-verm #1 and #2): a single parent's cover counts in a year only while it pays for a death at any time
// in that year (a policy that ends during a year does not pay for a death later that year), and every policy that ends
// before the children's need does is cover that ends (`endsSoon`), however far off. The couple keeps "by next year".
import { compute as alertsOf } from "../../overview/alerts/compute.js";
import { compute as nextStepOf } from "../../overview/next-best-action/compute.js";
const policiesOn = (base, ...ps) => { const p = base(); p.insurance = { policies: ps.map((x, i) => ({ id: `t${i}`, name: `Term ${i + 1}`, kind: "term", personId: "s-jo", premium: 20, period: "monthly", ...x })) }; return p; };
const wordsOf = (pg) => [pg.h1, ...pg.p, ...pg.li, ...pg.stats].join(" ");

test("review 2026-11-06: cover that ends in 2030 or 2028 never counts for the years after it (twoss), and Needs attention and Next best action raise it", () => {
  // $300,000 ending 12/31/2030: it pays for any death until then, nothing from 2031; 2037's $184,000 (in today's money) has
  // no cover then. It said "Your family is covered" and "$52,000 to spare"
  const p = withPolicy(twoss, 300000, { endDate: "2030-12-31" });
  const jo = compute(p, T5).people[0], c = jo.child;
  for (const y of c.needByYear) {
    assert.equal(y.coverInForce, y.year <= 2030 ? 300000 : 0, String(y.year));
    near(y.coverWorth, y.coverInForce / y.priceLevel, 1e-6); near(y.short, Math.max(0, y.need - y.coverWorth), 1e-6);
  }
  assert.equal(c.needByYear.find((y) => y.year === 2037).short, 184000);
  assert.deepEqual(jo.endsSoon, [{ endDate: "2030-12-31", benefit: 300000 }]);
  assert.deepEqual([c.afterEnd.year, c.afterEnd.need, c.afterEnd.cover, c.coverStays, c.coveredUntilEnd, jo.gapAfterEnd, jo.spare, jo.raise], [2037, 248000, 0, 0, true, 248000, 0, true]);
  const pg = pageOf(p);
  assert.equal(pg.h1, "Jo needs about $248,000 more life cover");
  assert.equal(pg.lede, "Jo's $300,000 term policy ends on 12/31/2030, and Child 1 and Child 2 count on Jo until about 2044. After it ends they would need up to about $248,000, if Jo died in 2037, in that year's dollars.");
  assert.ok(pg.p.includes("Covered until 12/31/2030, when $300,000 of it ends; after that short by up to about $248,000 (the most Child 1 and Child 2 would need, if Jo died in 2037, in that year's dollars)."));
  assert.ok(pg.p.some((x) => x.startsWith("A level term policy for about $248,000 (the most Child 1 and Child 2 would need after $300,000 of cover ends, if Jo died in 2037, in that year's dollars) that lasts until about 2044")));
  assert.doesNotMatch(wordsOf(pg), /Your family is covered|Covered, with|to spare|would be worth|also covers the most/);
  const [gp] = protectionGaps(p, T5);
  assert.equal(gp.gap, 248000);
  assert.equal(gp.title, "Jo's term life cover ends 12/31/2030: Child 1 and Child 2 would then need up to about $248,000 (if Jo died in 2037)");
  // Needs attention and Next best action raise it, with the same words
  assert.equal(alertsOf(p, T5).alerts.find((a) => a.id === "life-cover-s-jo")?.title, gp.title);
  const step = nextStepOf(p, T5).steps.find((s) => s.id === "protect");
  assert.deepEqual([step?.people?.[0]?.gap, step?.people?.[0]?.title], [248000, gp.title]);
  // $250,000 ending 3/31/2028: it does not pay for a death later in 2028, so 2028 on is after it ends
  const q = withPolicy(twoss, 250000, { endDate: "2028-03-31" });
  const qj = compute(q, T5).people[0];
  assert.deepEqual(qj.child.needByYear.map((y) => y.coverInForce), qj.child.needByYear.map((y) => (y.year < 2028 ? 250000 : 0)));
  assert.deepEqual([qj.endsSoon.length, qj.child.afterEnd.year, qj.child.afterEnd.need, qj.child.coveredUntilEnd, qj.gapAfterEnd, qj.spare, qj.raise], [1, 2037, 248000, true, 248000, 0, true]);
  const qp = pageOf(q);
  assert.equal(qp.h1, "Jo needs about $248,000 more life cover");
  assert.ok(qp.p.includes("Covered until 3/31/2028, when $250,000 of it ends; after that short by up to about $248,000 (the most Child 1 and Child 2 would need, if Jo died in 2037, in that year's dollars)."));
  assert.doesNotMatch(wordsOf(qp), /Your family is covered|to spare|would be worth|also covers the most/);
  assert.equal(protectionGaps(q, T5)[0].title, "Jo's term life cover ends 3/31/2028: Child 1 and Child 2 would then need up to about $248,000 (if Jo died in 2037)");
  // the sample with $200,000 ending 12/31/2035: 2040's $184,000 in that year's dollars, after it ends
  const s = withPolicy(sampleJo, 200000, { endDate: "2035-12-31" });
  const sj = compute(s, T5).people[0];
  assert.deepEqual([sj.gap, sj.child.afterEnd.year, sj.gapAfterEnd, sj.raise], [0, 2040, 184000, true]);
  assert.equal(pageOf(s).h1, "Jo needs about $184,000 more life cover");
});

test("review 2026-11-06: the couple keeps 'ends soon' as by next year: $300,000 ending in 2031 reads as cover with no end date", () => {
  const T = { today: "2026-11-02" };
  const on = (extra) => { const f = familyPlan("2026-11-02"); f.insurance = { ...(f.insurance ?? {}), policies: [{ id: "t", kind: "term", personId: "p-ana", benefit: 300000, premium: 25, period: "monthly", ...extra }] }; return f; };
  const pick = (q) => [q.method, q.need, q.cover, q.gap, q.spare, q.endsSoon.length, q.gapAfterEnd, q.raise];
  const a = compute(on({ endDate: "2031-12-31" }), T).people[0], b = compute(on({}), T).people[0];
  assert.deepEqual(pick(a), ["plan", 235000, 300000, 0, 65000, 0, 0, false]);
  assert.deepEqual(pick(a), pick(b));
  assert.deepEqual(protectionGaps(on({ endDate: "2031-12-31" }), T), []);
  assert.equal(pageOf(on({ endDate: "2031-12-31" })).h1, pageOf(on({})).h1);
});

test("review 2026-11-06: several policies ending at different times: each year counts what still pays then (no 'short' in a year a later policy covers)", () => {
  // $100,000 to 12/31/2028 and $300,000 to 12/31/2040: $400,000 through 2028, $300,000 2029-2040 (2037's $247,280.61 in
  // that year's dollars is paid), nothing from 2041 ($146,720.75 in 2041's dollars, so $147,000)
  const p = policiesOn(twoss, { benefit: 100000, endDate: "2028-12-31" }, { benefit: 300000, endDate: "2040-12-31" });
  const jo = compute(p, T5).people[0], c = jo.child;
  assert.deepEqual(c.needByYear.map((y) => y.coverInForce), c.needByYear.map((y) => (y.year <= 2028 ? 400000 : y.year <= 2040 ? 300000 : 0)));
  near(c.needByYear.find((y) => y.year === 2041).dollars, 97000 * priceLevel(2041), 1e-6);
  assert.deepEqual([jo.endsSoon.length, c.afterEnd.year, c.afterEnd.need, c.afterEnd.cover, c.afterEnd.most, c.coverStays, jo.gapAfterEnd, jo.raise], [2, 2041, 147000, 0, false, 0, 147000, true]);
  // what to buy pays every year with the cover still on file then, and $1,000 less does not
  const buy = Math.max(jo.gap, jo.gapAfterEnd);
  assert.ok(c.needByYear.every((y) => y.coverInForce + buy >= y.dollars - 0.005));
  assert.ok(c.needByYear.some((y) => y.coverInForce + buy - 1000 < y.dollars));
  const pg = pageOf(p);
  assert.equal(pg.h1, "Jo needs about $147,000 more life cover");
  // both policies are named with their dates, never "Covered until" the first (verification, review 2026-11-06)
  assert.ok(pg.p.includes("$100,000 of it ends on 12/31/2028 and $300,000 on 12/31/2040; after that short by up to about $147,000 (if Jo died in 2041, in that year's dollars)."));
  assert.match(pg.lede, /^Jo's term cover ends in steps, \$100,000 on 12\/31\/2028 and \$300,000 on 12\/31\/2040, and Child 1 and Child 2 count on Jo until about 2044\./);
  assert.match(pg.lede, /After it ends they would be up to about \$147,000 short, if Jo died in 2041, in that year's dollars\.$/);
  // never short (or in need) of 2037's $248,000 after it ends: the $300,000 still pays then (the tile and For how long keep
  // the level cover's size, $248,000, as a whole)
  assert.doesNotMatch(wordsOf(pg), /(short by up to|need up to|be up to) about \$248,000|the most Child 1 and Child 2 would need/);
  const [gp] = protectionGaps(p, T5);
  assert.equal(gp.title, "Jo's term life cover ends 12/31/2028 and 12/31/2040: Child 1 and Child 2 would then be up to about $147,000 short (if Jo died in 2041)");
  // a later policy still on file in the year short the most: taken off as "still on file then", never as cover that stays.
  // $100,000 to 12/31/2028 and $150,000 to 12/31/2042: 2037 is 247,280.61 - 150,000 = 97,280.61 short (2043, with nothing on
  // file, 59,374), so $248,000 less the $150,000: $98,000
  const r = policiesOn(twoss, { benefit: 100000, endDate: "2028-12-31" }, { benefit: 150000, endDate: "2042-12-31" });
  const rj = compute(r, T5).people[0];
  assert.deepEqual([rj.child.afterEnd.year, rj.child.afterEnd.need, rj.child.afterEnd.cover, rj.child.afterEnd.most, rj.child.coverStays, rj.gapAfterEnd, rj.raise], [2037, 248000, 150000, true, 0, 98000, true]);
  const rp = pageOf(r);
  assert.equal(rp.h1, "Jo needs about $98,000 more life cover");
  assert.ok(rp.p.includes("Covered until 12/31/2028, when $100,000 of it ends; after that short by up to about $98,000 (the most Child 1 and Child 2 would need, if Jo died in 2037, in that year's dollars, less the $150,000 still on file then)."));
  assert.match(rp.lede, /After it ends they would need up to about \$248,000, if Jo died in 2037, in that year's dollars; with the \$150,000 still on file then, about \$98,000 short\.$/);
  assert.equal(protectionGaps(r, T5)[0].title, "Jo's term life cover ends 12/31/2028: Child 1 and Child 2 would then be up to about $98,000 short (if Jo died in 2037)");
  assert.doesNotMatch(wordsOf(rp), /that stays on file/);
  // the year short the most is not the year of the largest need, with cover still on file then: the figure is already the
  // shortfall, so the cover is said "with" it, never "less" it again. $100,000 to 12/31/2028, $300,000 to 12/31/2040 and
  // $20,000 with no end: 2041's 146,720.75 - 20,000 = 126,720.75, so $147,000 less the $20,000: $127,000
  const w = policiesOn(twoss, { benefit: 100000, endDate: "2028-12-31" }, { benefit: 300000, endDate: "2040-12-31" }, { benefit: 20000 });
  const wj = compute(w, T5).people[0];
  assert.deepEqual([wj.gap, wj.child.afterEnd.year, wj.child.afterEnd.need, wj.child.afterEnd.cover, wj.child.afterEnd.most, wj.child.coverStays, wj.gapAfterEnd, wj.raise], [0, 2041, 147000, 20000, false, 20000, 127000, true]);
  const wp = pageOf(w);
  assert.equal(wp.h1, "Jo needs about $127,000 more life cover");
  assert.ok(wp.p.includes("$100,000 of it ends on 12/31/2028 and $300,000 on 12/31/2040; after that short by up to about $127,000 (if Jo died in 2041, in that year's dollars, with the $20,000 that stays on file)."));
  assert.match(wp.lede, /After it ends they would be up to about \$127,000 short, if Jo died in 2041, in that year's dollars, with the \$20,000 that stays on file against \$147,000 needed\.$/);
  assert.ok(wp.p.some((x) => x.startsWith("A level term policy for about $127,000 (the most Child 1 and Child 2 would be short as cover on file ends, if Jo died in 2041, in that year's dollars, with the $20,000 that stays on file) that lasts until about 2044")));
  assert.doesNotMatch(wordsOf(wp), /less the \$20,000/);
  assert.equal(protectionGaps(w, T5)[0].title, "Jo's term life cover ends 12/31/2028 and 12/31/2040: Child 1 and Child 2 would then be up to about $127,000 short (if Jo died in 2041)");
});

test("review 2026-11-06: what is spare or close to covered counts the cover still on file in each year", () => {
  // $250,000 with no end and $300,000 ending 12/31/2030: covered every year, but only $2,000 to spare (250,000 - 248,000),
  // not $302,000; the words name the $250,000 still on file in 2037
  const p = policiesOn(twoss, { benefit: 250000 }, { benefit: 300000, endDate: "2030-12-31" });
  const jo = compute(p, T5).people[0];
  assert.deepEqual([jo.cover, jo.gap, jo.gapAfterEnd, jo.spare, jo.raise], [550000, 0, 0, 2000, false]);
  const pg = pageOf(p);
  assert.equal(pg.h1, "Your family is covered");
  assert.match(pg.lede, /The \$250,000 of cover still on file in 2037 also covers the most they would need, about \$248,000 if Jo died in 2037, in that year's dollars\./);
  assert.ok(pg.p.includes("Covered, with about $2,000 to spare."));
  assert.ok(pg.p.includes("If Jo died in 2037, the $250,000 still on file then would be worth about $186,000 in today's money, against $184,000 needed then."));
  assert.doesNotMatch(wordsOf(pg), /\$550,000 of cover on file also covers|\$302,000/);
  // $245,000 with no end and $50,000 ending 12/31/2030: $3,000 short after it ends, said, never "Your family is covered"
  const s = policiesOn(twoss, { benefit: 245000 }, { benefit: 50000, endDate: "2030-12-31" });
  const sj = compute(s, T5).people[0];
  assert.deepEqual([sj.gap, sj.gapAfterEnd, sj.spare, sj.raise], [0, 3000, 0, false]);
  const sp = pageOf(s);
  assert.equal(sp.h1, "Close to covered");
  assert.equal(sp.lede, "Once Jo's $50,000 term policy ends on 12/31/2030, Child 1 and Child 2 would be about $3,000 short (if Jo died in 2037, in that year's dollars): a small gap that savings or a modest policy covers.");
  assert.deepEqual(protectionGaps(s, T5), []);
});

test("review 2026-11-06: the worth line says which dollars each figure is in (twoss with $180,000 or $200,000)", () => {
  // 180,000 / 1.03^10 = 133,936.90: $133,900 in today's money against $184,000, $50,100 short in today's money; in 2037's
  // dollars that is 50,100 x 1.03^10 = 67,330, rounded up to the next $1,000 with the rest of the figure: the $68,000 to buy
  const t = pageOf(withPolicy(twoss, 180000));
  assert.ok(t.p.includes("Short by about $68,000."));
  assert.ok(t.p.includes("If Jo died in 2037, the $180,000 on file would be worth about $133,900 in today's money, against $184,000 needed then: about $50,100 short in today's money, which is the $68,000 more cover in 2037's dollars (rounded up to the next $1,000)."));
  assert.ok(pageOf(withPolicy(twoss, 200000)).p.includes("If Jo died in 2037, the $200,000 on file would be worth about $148,800 in today's money, against $184,000 needed then: about $35,200 short in today's money, which is the $48,000 more cover in 2037's dollars (rounded up to the next $1,000)."));
  // enough cover: no shortfall clause
  assert.ok(pageOf(withPolicy(twoss, 250000)).p.includes("If Jo died in 2037, the $250,000 on file would be worth about $186,000 in today's money, against $184,000 needed then."));
});

test("review 2026-11-06: no pay to replace and cover that ends: the gap once it ends is said, never \"$0 short\" or \"Your family is covered\"", () => {
  // Ana with a pension instead of pay ($235,000 needed) and $236,000 ending 3/31/2027; Bo covered with $400,000: Ana's gap is
  // $0 today and $235,000 once the policy ends. Not raised (no pay to replace), so "Close to covered" with that gap said
  const T = "2026-11-02";
  const f = familyPlan(T);
  for (const x of f.income) if (x.personId === "p-ana") x.type = "pension";
  f.insurance = { policies: [
    { id: "a", name: "Ana's term", kind: "term", personId: "p-ana", benefit: 236000, premium: 20, period: "monthly", endDate: "2027-03-31" },
    { id: "b", name: "Bo's term", kind: "term", personId: "p-bo", benefit: 400000, premium: 30, period: "monthly" },
  ] };
  const ana = compute(f, { today: T }).people[0];
  assert.deepEqual([ana.pay, ana.need, ana.gap, ana.endsSoon.length, ana.gapAfterEnd, ana.raise], [0, 235000, 0, 1, 235000, false]);
  const pg = pageOf(f, T);
  assert.equal(pg.h1, "Close to covered");
  assert.match(pg.lede, /^Once Ana's \$236,000 term policy ends on 3\/31\/2027, Bo and Cy would be about \$235,000 short: the income that stops with Ana/);
  assert.doesNotMatch(wordsOf(pg), /\$0 short|Your family is covered/);
  assert.deepEqual(protectionGaps(f, { today: T }), []);
});

test("verification, review 2026-11-06: cover through work beside a term policy that ends: without the job, year by year", () => {
  // twoss with $100,000 through work (no end) and $150,000 ending 9/30/2029: $250,000 in force to 2028, $100,000 from 2029.
  // Without the job, nothing pays from 2029: 2037's 247,280.61 in that year's dollars, so $248,000; never 248,000 - 150,000
  // = $98,000 (the ending policy counted for 2037), which read "Without it ... short about $98,000" under a card short
  // $148,000 with it
  const p = policiesOn(twoss, { benefit: 100000, throughWork: true }, { benefit: 150000, endDate: "2029-09-30" });
  const jo = compute(p, T5).people[0], c = jo.child;
  assert.deepEqual([jo.need, jo.cover, jo.coverWork, jo.gap, jo.gapAfterEnd, jo.gapIfJobEnds], [248000, 250000, 100000, 0, 148000, 248000]);
  assert.deepEqual([c.ifJobEnds.year, c.ifJobEnds.need, c.ifJobEnds.cover], [2037, 248000, 0]);
  // without the work cover, what is still in force plus the figure pays every year, and $1,000 less does not
  const work = (y) => (y.coverInForce >= 100000 ? 100000 : 0);
  assert.ok(c.needByYear.every((y) => y.coverInForce - work(y) + jo.gapIfJobEnds >= y.dollars - 0.005));
  assert.ok(c.needByYear.some((y) => y.coverInForce - work(y) + jo.gapIfJobEnds - 1000 < y.dollars));
  const pg = pageOf(p);
  assert.equal(pg.h1, "Jo needs about $148,000 more life cover");
  assert.ok(pg.notices.includes("$100,000 of Jo's cover comes with the job and ends with it. Without it Child 1 and Child 2 would be short about $248,000 (if Jo died in 2037, in that year's dollars)."), pg.notices.join(" | "));
  assert.doesNotMatch(pg.notices.join(" "), /\$98,000/);
  assert.ok(pg.p.some((x) => x.startsWith("A level term policy that lasts until about 2044 (Child 1's college ends): ask for a 20-year term. Buy at least $148,000 now; $248,000 keeps Child 1 and Child 2 covered even after a job change.")), pg.p.join(" | "));
  // no ending: the same figure as before (need less the cover not through work), now with its year
  const q = policiesOn(twoss, { benefit: 100000, throughWork: true }, { benefit: 150000 });
  const qj = compute(q, T5).people[0];
  assert.deepEqual([qj.gap, qj.gapIfJobEnds], [0, 98000]);
  assert.ok(pageOf(q).notices.includes("$100,000 of Jo's cover comes with the job and ends with it. Without it Child 1 and Child 2 would be short about $98,000 (if Jo died in 2037, in that year's dollars)."));
});

test("verification, review 2026-11-06: several policies are each named with their dates; the same day is added up", () => {
  // $100,000 and $150,000 both ending 12/31/2033: $250,000 ends that day, never "when $100,000 of it ends"
  const p = policiesOn(twoss, { benefit: 100000, endDate: "2033-12-31" }, { benefit: 150000, endDate: "2033-12-31" });
  const jo = compute(p, T5).people[0];
  assert.deepEqual(jo.child.endSteps, [{ endDate: "2033-12-31", benefit: 250000, policies: 2 }]);
  const pg = pageOf(p);
  assert.match(pg.lede, /^Jo's \$250,000 of term cover ends on 12\/31\/2033, and Child 1 and Child 2 count on Jo until about 2044\. After it ends they would need up to about \$248,000, if Jo died in 2037/);
  assert.ok(pg.p.includes("Covered until 12/31/2033, when $250,000 of it ends; after that short by up to about $248,000 (the most Child 1 and Child 2 would need, if Jo died in 2037, in that year's dollars)."));
  assert.ok(pg.p.some((x) => x.startsWith("A level term policy for about $248,000 (the most Child 1 and Child 2 would need after $250,000 of cover ends, if Jo died in 2037")));
  assert.doesNotMatch(wordsOf(pg), /\$100,000 of (it|cover) ends|\$100,000 term policy/);
  const [gp] = protectionGaps(p, T5);
  assert.equal(gp.title, "Jo's term life cover ends 12/31/2033: Child 1 and Child 2 would then need up to about $248,000 (if Jo died in 2037)");
  assert.match(gp.sentence, /^Jo's \$250,000 of term cover ends on 12\/31\/2033, and Child 1 and Child 2 count on Jo/);
  // $10,000 ending 12/31/2027 and $300,000 ending 12/31/2041: covered every year to 2041; 2042 is $105,000 short. The page
  // names both ends, never "Covered until 12/31/2027" or "Jo's term life cover ends 12/31/2027" alone
  const s = policiesOn(twoss, { benefit: 10000, endDate: "2027-12-31" }, { benefit: 300000, endDate: "2041-12-31" });
  const sj = compute(s, T5).people[0];
  assert.deepEqual([sj.child.afterEnd.year, sj.child.afterEnd.need, sj.child.afterEnd.most, sj.gapAfterEnd], [2042, 105000, false, 105000]);
  assert.deepEqual(sj.child.endSteps.map((x) => [x.endDate, x.benefit]), [["2027-12-31", 10000], ["2041-12-31", 300000]]);
  const sp = pageOf(s);
  assert.ok(sp.p.includes("$10,000 of it ends on 12/31/2027 and $300,000 on 12/31/2041; after that short by up to about $105,000 (if Jo died in 2042, in that year's dollars)."), sp.p.join(" | "));
  assert.match(sp.lede, /^Jo's term cover ends in steps, \$10,000 on 12\/31\/2027 and \$300,000 on 12\/31\/2041, and Child 1 and Child 2 count on Jo until about 2044\. After it ends they would be up to about \$105,000 short, if Jo died in 2042/);
  assert.doesNotMatch(wordsOf(sp), /Covered until 12\/31\/2027/);
  assert.equal(protectionGaps(s, T5)[0].title, "Jo's term life cover ends 12/31/2027 and 12/31/2041: Child 1 and Child 2 would then be up to about $105,000 short (if Jo died in 2042)");
  // a ladder, $150,000 to 2031 and $150,000 to 2036: what to buy is "after $300,000 of cover ends", never after $150,000
  const l = policiesOn(twoss, { benefit: 150000, endDate: "2031-12-31" }, { benefit: 150000, endDate: "2036-12-31" });
  const lp = pageOf(l);
  assert.ok(lp.p.some((x) => x.startsWith("A level term policy for about $248,000 (the most Child 1 and Child 2 would need after $300,000 of cover ends, if Jo died in 2037")));
  assert.ok(lp.p.includes("$150,000 of it ends on 12/31/2031 and $150,000 on 12/31/2036; after that short by up to about $248,000 (the most Child 1 and Child 2 would need, if Jo died in 2037, in that year's dollars)."));
});

test("review 2026-11-06 follow-up: a couple's figure without the job leaves out term cover that ends by next year", () => {
  // Ana ($235,000 needed) with $100,000 through work (no end) and $200,000 ending 6/30/2027. Once that policy ends only the
  // work cover is left, so without the job nothing is on file: $235,000, never 235,000 - (300,000 - 100,000) = $35,000 (the
  // ending policy counted), which hid the notice and the job-change size under a card short $135,000 from then
  const T = "2026-11-02";
  const on = (...ps) => { const f = familyPlan(T); f.insurance = { policies: ps.map((x, i) => ({ id: `t${i}`, name: `Ana ${i + 1}`, kind: "term", personId: "p-ana", premium: 20, period: "monthly", ...x })) }; return f; };
  const f = on({ benefit: 100000, throughWork: true }, { benefit: 200000, endDate: "2027-06-30" });
  const ana = compute(f, { today: T }).people[0];
  assert.deepEqual([ana.method, ana.need, ana.cover, ana.coverWork, ana.gap, ana.gapAfterEnd, ana.gapIfJobEnds], ["plan", 235000, 300000, 100000, 0, 135000, 235000]);
  assert.deepEqual(ana.jobEnding, { benefit: 200000, endDate: "2027-06-30", policies: 1 });
  const pg = pageOf(f, T);
  assert.ok(pg.notices.includes("$100,000 of Ana's cover comes with the job and ends with it. Without it the family would be short about $235,000 once Ana's $200,000 term policy ends on 6/30/2027."), pg.notices.join(" | "));
  assert.ok(pg.p.some((x) => x.includes("Buy at least $135,000 now; $235,000 keeps Bo and Cy covered even after a job change.")), pg.p.join(" | "));
  assert.doesNotMatch(pg.notices.join(" "), /\$35,000/);
  // the ending policy through work itself: what is not through work all stays, so the figure is need - that ($135,000 today)
  const w = compute(on({ benefit: 100000, throughWork: true, endDate: "2027-06-30" }, { benefit: 100000 }), { today: T }).people[0];
  assert.deepEqual([w.gapAfterEnd, w.gapIfJobEnds, w.jobEnding], [135000, 135000, null]);
  // no policy that ends: the same figure as before (need less the cover not through work), and nothing more said
  const n = on({ benefit: 100000, throughWork: true }, { benefit: 200000 });
  const nj = compute(n, { today: T }).people[0];
  assert.deepEqual([nj.gap, nj.gapIfJobEnds, nj.jobEnding], [0, 35000, null]);
  assert.ok(pageOf(n, T).notices.includes("$100,000 of Ana's cover comes with the job and ends with it. Without it the family would be short about $35,000."));
});

test("review 2026-11-06 follow-up: cover that exactly meets the need says so, never \"about $0 to spare\"", () => {
  // twoss needs $248,000 (2037, in that year's dollars); $248,000 on file covers it with nothing left over
  const p = withPolicy(twoss, 248000);
  const jo = compute(p, T5).people[0];
  assert.deepEqual([jo.need, jo.gap, jo.spare, jo.raise], [248000, 0, 0, false]);
  const pg = pageOf(p);
  assert.equal(pg.h1, "Your family is covered");
  assert.ok(pg.p.includes("Covered, with nothing to spare."), pg.p.join(" | "));
  assert.doesNotMatch(wordsOf(pg), /\$0 to spare/);
  // the couple: Ana's $235,000 on $235,000 needed
  assert.ok(pageOf(withCover(235000), TODAY).p.includes("Covered, with nothing to spare."));
  // $1,000 more: the spare is said
  assert.ok(pageOf(withPolicy(twoss, 249000)).p.includes("Covered, with about $1,000 to spare."));
});

test("verification 8b, review 2026-11-06: a couple's cover that ends by next year, never \"Covered until\" while short, every date named", () => {
  // Ana needs $235,000 (the family fixture). The truth, day by day from the policies on file, is in each comment.
  const T = "2026-11-02";
  const on = (...ps) => { const f = familyPlan(T); f.insurance = { policies: ps.map((x, i) => ({ id: `t${i}`, name: `Ana ${i + 1}`, kind: "term", personId: "p-ana", premium: 20, period: "monthly", ...x })) }; return f; };
  // short today: $50,000 for good + $150,000 ending 6/30/2027 = $200,000, $35,000 short now and $185,000 once it ends
  const st = on({ benefit: 50000 }, { benefit: 150000, endDate: "2027-06-30" });
  const sa = compute(st, { today: T }).people[0];
  assert.deepEqual([sa.need, sa.gap, sa.gapAfterEnd], [235000, 35000, 185000]);
  const sp = pageOf(st, T);
  assert.ok(sp.p.includes("Short by about $35,000 now, and by about $185,000 once $150,000 of it ends on 6/30/2027."), sp.p.join(" | "));
  assert.doesNotMatch(wordsOf(sp), /Covered until/);
  // two dates: $100,000 through work, $50,000 ending 3/31/2027, $150,000 ending 12/31/2027, $50,000 for good. After 3/31/2027
  // $300,000 still covers the $235,000; only after 12/31/2027 ($150,000 left) is it $85,000 short
  const two = on({ benefit: 100000, throughWork: true }, { benefit: 50000, endDate: "2027-03-31" }, { benefit: 150000, endDate: "2027-12-31" }, { benefit: 50000 });
  const ta = compute(two, { today: T }).people[0];
  assert.deepEqual([ta.gap, ta.gapAfterEnd, ta.endSteps], [0, 85000, [{ endDate: "2027-03-31", benefit: 50000, policies: 1 }, { endDate: "2027-12-31", benefit: 150000, policies: 1 }]]);
  const tp = pageOf(two, T);
  assert.equal(tp.lede, "Ana's term cover ends in steps, $50,000 on 3/31/2027 and $150,000 on 12/31/2027, and Bo and Cy count on Ana until about 2042: once it has ended they would be about $85,000 short.");
  assert.ok(tp.p.includes("Covered for now: $50,000 of it ends on 3/31/2027 and $150,000 on 12/31/2027; once it has ended, short by about $85,000."), tp.p.join(" | "));
  assert.doesNotMatch(wordsOf(tp), /Covered until 3\/31\/2027|\$50,000 term policy ends/);
  const [tg] = protectionGaps(two, { today: T });
  assert.equal(tg.title, "Ana's term life cover ends 3/31/2027 and 12/31/2027: Bo and Cy would then be about $85,000 short");
  assert.equal(alertsOf(two, { today: T }).alerts.find((a) => a.id === "life-cover-p-ana")?.title, tg.title);
  // the job notice names the same $200,000 (follow-up wording, unchanged)
  assert.ok(tp.notices.includes("$100,000 of Ana's cover comes with the job and ends with it. Without it the family would be short about $185,000 once Ana's $200,000 of term cover has ended (by 12/31/2027)."), tp.notices.join(" | "));
  // the same day: $100,000 and $150,000 ending 6/30/2027 are $250,000 ending that day
  const sd = on({ benefit: 100000, endDate: "2027-06-30" }, { benefit: 150000, endDate: "2027-06-30" }, { benefit: 50000 });
  const dp = pageOf(sd, T);
  assert.equal(dp.lede, "Ana's $250,000 of term cover ends on 6/30/2027, and Bo and Cy count on Ana until about 2042: without it they would be about $185,000 short.");
  assert.ok(dp.p.includes("Covered until 6/30/2027, when $250,000 of it ends; short by about $185,000 from then."), dp.p.join(" | "));
  // one policy, covered today: the words are as before
  const one = pageOf(on({ benefit: 100000, throughWork: true }, { benefit: 200000, endDate: "2027-06-30" }), T);
  assert.ok(one.p.includes("Covered until 6/30/2027, when $200,000 of it ends; short by about $135,000 from then."));
  assert.equal(one.lede, "Ana's $200,000 term policy ends on 6/30/2027, and Bo and Cy count on Ana until about 2042: without it they would be about $135,000 short.");
});
