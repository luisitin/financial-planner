import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildInputs, compute, BUCKET_OF } from "./compute.js";
import { project } from "../../../core/math/retirement.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-16";
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("an empty plan says what is missing", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, false); assert.ok(d.missing.length >= 2);
});
test("buildInputs: people, buckets, contributions, incomes, years", () => {
  const b = buildInputs(retirementPlan(), { today: TODAY });
  assert.equal(b.inputs.startYear, 2026); assert.equal(b.inputs.retireYear, 2033, "Sam 65 in 2033"); assert.equal(b.inputs.endYear, 2065, "Lee reaches 95 in 2065");
  assert.deepEqual(b.inputs.people.map((p) => p.name), ["Sam", "Lee"]);
  near(b.inputs.balances.cash, 52000); near(b.inputs.balances.taxable, 150000); near(b.inputs.balances.deferred, 730000); near(b.inputs.balances.free, 90000);
  assert.equal(BUCKET_OF.property, undefined, "the house is not retirement money");
  const c = b.inputs.contributions;
  near(c.find((x) => x.name === "Sam's 401(k)").yearly, 18000 + 6000); assert.equal(c.find((x) => x.name === "Sam's 401(k)").bucket, "deferred");
  near(c.find((x) => x.name === "Lee's IRA").yearly, 7000); assert.equal(c.find((x) => x.name === "Lee's IRA").personIndex, 1);
  const names = b.inputs.incomes.map((i) => i.name);
  assert.ok(names.includes("Sam's Social Security") && names.includes("Lee's Social Security") && names.includes("Lee's state pension") && names.includes("Lee's pay"));
  const leePay = b.inputs.incomes.find((i) => i.name === "Lee's pay");
  assert.equal(leePay.startAge, 56); assert.equal(leePay.endAge, 66); near(leePay.yearly, 66000);
  near(b.inputs.spending.yearly, 78000); assert.equal(b.spendingSource, "typed");
  assert.equal(b.inputs.rmd.birthYear, 1968); assert.equal(b.inputs.rmd.startAge, 75);
  assert.deepEqual(b.inputs.rmd.owners.map((o) => [o.personIndex, Math.round(o.share * 730), o.startAge]), [[0, 730, 75], [1, 0, 75]], "accounts with no owner belong to the first person");
});
test("the projection runs, retires in 2033, and gives an affordable figure and a verdict", () => {
  const d = compute(retirementPlan(), { today: TODAY });
  assert.equal(d.ready, true);
  assert.equal(d.rows.length, 40); assert.equal(d.atRetirement.year, 2033); assert.equal(d.atRetirement.age, 65);
  assert.ok(d.atRetirement.totalReal > 1000000, "1.02m plus 7 years of growth and contributions");
  assert.equal(d.atEnd.year, 2065);
  assert.ok(["on track", "tight", "short"].includes(d.verdict));
  assert.ok(d.affordable > 0);
  const r2033 = d.rows.find((r) => r.year === 2033);
  assert.ok(r2033.income > 0, "Lee's pay in 2033 (she works to 67)");
  const r2037 = d.rows.find((r) => r.year === 2037);
  assert.ok(r2037.incomeLines.some((l) => l.name === "Lee's state pension"), "pension from 67");
  const r2043 = d.rows.find((r) => r.year === 2043);
  assert.ok(r2043.rmd > 0, "Sam is 75 in 2043: RMDs start");
  assert.ok(d.coverage > 0 && d.coverage < 1);
});
test("spending falls back to today's expenses when nothing is typed", () => {
  const p = retirementPlan(); p.retirement.spendingMonthly = null;
  const b = buildInputs(p, { today: TODAY });
  assert.equal(b.spendingSource, "expenses"); near(b.inputs.spending.yearly, 84000);
});
test("a pension typed on the Income page counts in retirement (F-028)", () => {
  const p = retirementPlan(); p.retirement.pensions = []; p.retirement.socialSecurity = {};
  p.income.push({ id: "i3", name: "Teachers' pension", type: "pension", personId: "sam", amount: 2000, period: "monthly", growth: 0.02, startDate: "2033-05-01", taxable: true });
  const b = buildInputs(p, { today: TODAY });
  const pn = b.inputs.incomes.find((i) => i.name === "Teachers' pension");
  assert.ok(pn, "the Income page's pension reaches the engine");
  near(pn.yearly, 24000); assert.equal(pn.personIndex, 0); assert.equal(pn.startAge, 2033 - 1968); assert.equal(pn.cola, true); assert.equal(pn.endAge, undefined);
  const d = compute(p, { today: TODAY });
  assert.ok(d.rows.find((r) => r.year === 2034).incomeLines.some((l) => l.name === "Teachers' pension"), "paid in retirement");
  const without = compute((() => { const q = retirementPlan(); q.retirement.pensions = []; q.retirement.socialSecurity = {}; return q; })(), { today: TODAY });
  assert.ok(d.affordable > without.affordable + 15000, "the pension raises what the plan can spend");
});
test("Income-page pensions: already paid, ended, one-off, fixed and duplicates", () => {
  const p = retirementPlan();
  p.income.push(
    { id: "a", name: "Army pension", type: "pension", personId: "lee", amount: 600, period: "monthly", growth: 0 },
    { id: "b", name: "Old pension", type: "pension", personId: "lee", amount: 300, period: "monthly", endDate: "2025-12-31" },
    { id: "c", name: "Lump sum", type: "pension", personId: "sam", amount: 50000, period: "once" },
    { id: "d", name: "Lee's state pension", type: "pension", personId: "lee", amount: 900, period: "monthly", growth: 0.02, startDate: "2037-09-01" },
    { id: "e", name: "Union pension", type: "pension", personId: "sam", amount: 12000, period: "annual", growth: 0.01, startDate: "2030-01-01", endDate: "2050-06-30", taxable: false },
  );
  const got = buildInputs(p, { today: TODAY }).inputs.incomes.filter((i) => i.source === "income");
  assert.deepEqual(got.map((i) => i.name).sort(), ["Army pension", "Union pension"], "ended, one-off and the duplicate of the Pensions entry are left out");
  const army = got.find((i) => i.name === "Army pension");
  assert.equal(army.startAge, 2026 - 1970, "already paid: counts from now"); assert.equal(army.personIndex, 1); assert.equal(army.cola, false, "no rise typed: a fixed amount");
  const union = got.find((i) => i.name === "Union pension");
  assert.equal(union.startAge, 62); assert.equal(union.endAge, 82); assert.equal(union.taxable, false); near(union.yearly, 12000);
});
test("required withdrawals are worked per owner, at each owner's age; cash value has none", () => {
  const p = retirementPlan();
  p.household.people[1].birthDate = "1958-08-22";   // Lee starts at 73 in 2031, before Sam (75 in 2043)
  for (const a of p.accounts) if (a.id === "k401") a.ownerId = "sam"; else if (a.id === "ira") a.ownerId = "lee";
  p.accounts.push({ id: "cv", name: "Whole life", type: "cash_value_life", balance: 40000 });
  const b = buildInputs(p, { today: TODAY });
  near(b.inputs.balances.deferred, 770000);
  const d = compute(p, { today: TODAY });
  const r2031 = d.rows.find((r) => r.year === 2031);
  assert.ok(r2031.rmdBy[1] > 0 && r2031.rmdBy[0] === 0, "only Lee's IRA has a required withdrawal in 2031");
  const lee2031 = r2031.rmdBy[1];
  const r2043 = d.rows.find((r) => r.year === 2043);
  assert.ok(r2043.rmdBy[0] > 0, "Sam's starts at 75");
  near(r2043.rmd, r2043.rmdBy[0] + r2043.rmdBy[1], 0.01);
  assert.ok(lee2031 < r2031.balances.deferred / 26.5, "Lee's is worked on her own IRA, not the whole pre-tax bucket");
});

// a retired couple: pay stopped, a pension, Social Security on the Social Security page, spending above what comes in
const retired = () => {
  const p = retirementPlan();
  for (const x of p.household.people) x.retirementAge = 55;
  p.income = p.income.filter((x) => !["salary", "bonus", "business"].includes(x.type));
  p.income.push({ id: "pen", name: "Sam's pension", type: "pension", personId: "sam", amount: 3000, period: "monthly" });
  p.retirement.contributions = [];
  return p;
};

test("round 4: Social Security already paid and typed on the Income page counts, once", async () => {
  const { incomeSocial, retirementKnown, ssOnIncome } = await import("./compute.js");
  const T = "2026-11-02";
  const p = retired(); p.retirement.socialSecurity = {};
  assert.equal(retirementKnown(p, T), false);
  p.income.push({ id: "ss1", name: "Sam's Social Security", type: "social", personId: "sam", amount: 2600, period: "monthly" }, { id: "ss2", name: "Lee's Social Security", type: "social", personId: "lee", amount: 1900, period: "monthly" });
  assert.equal(ssOnIncome(p, "sam", T), true); assert.equal(retirementKnown(p, T), true);
  const b = buildInputs(p, { today: T });
  const soc = b.inputs.incomes.filter((x) => x.kind === "social");
  assert.deepEqual(soc.map((x) => [x.name, x.yearly, x.startAge]), [["Sam's Social Security", 31200, 58], ["Lee's Social Security", 22800, 56]]);
  // a figure on the Social Security page wins: nothing counts twice
  p.retirement.socialSecurity = { sam: { claimAge: 67, monthlyAtFRA: 2800 } };
  const again = buildInputs(p, { today: T }).inputs.incomes.filter((x) => x.kind === "social");
  assert.equal(again.filter((x) => x.name.startsWith("Sam")).length, 1);
  assert.equal(incomeSocial(p, b.people, [{ id: "sam", yearly: 33600 }], T).map((x) => x.personId).join(), "lee");
});

test("round 4: a retired household drawing from savings as the plan intends is told so, not to cut", async () => {
  const { householdRetired, drawingAsPlanned } = await import("./compute.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { compute: alerts } = await import("../../overview/alerts/compute.js");
  const { compute: health } = await import("../../overview/health-score/compute.js");
  const T = { today: "2026-11-02" };
  const p = retired();
  assert.equal(householdRetired(p, T), true);
  const dr = drawingAsPlanned(p, T);
  assert.ok(dr && dr.affordableMonthly > dr.spendingMonthly, JSON.stringify(dr));
  const n = next(p, T);
  assert.ok(n.spare.monthly < 0); assert.ok(n.drawing);
  const bills = n.steps.find((s) => s.id === "bills");
  assert.equal(bills.status, "done"); assert.equal(bills.title, "Spend within what the plan can pay for");
  assert.ok(!n.steps.some((s) => s.id === "max-401k"), "nobody has pay to put in a 401(k)");
  assert.ok(!alerts(p, T).alerts.some((a) => a.id === "overspend"));
  const sv = health(p, T).parts.find((x) => x.id === "saving");
  assert.equal(sv.points, sv.max);
  // still working: the usual rule
  const w = retirementPlan(); w.expenses.push({ id: "boat", name: "Boat", category: "fun", amount: 9000, period: "monthly", essential: false });
  assert.equal(householdRetired(w, T), false); assert.equal(next(w, T).drawing, null);
  assert.ok(alerts(w, T).alerts.some((a) => a.id === "overspend"));
});

test("review 2026-11-02: a retired household with the retirement age left blank is retired (the plan's own age); a benefit started early counts from now", async () => {
  const { householdRetired, compute } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const T = "2026-11-02";
  const p = emptyPlan();
  p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }, { id: "s", name: "Sam", role: "partner", birthDate: "1957-06-20" }];
  p.income = [{ id: "pen", name: "Sam's pension", type: "pension", personId: "s", amount: 1500, period: "monthly" }];
  assert.equal(householdRetired(p, { today: T }), true);
  p.income.push({ id: "pay", name: "Sam's pay", type: "salary", personId: "s", amount: 2000, period: "monthly" });
  assert.equal(householdRetired(p, { today: T }), false, "pay still coming in");
  // 50, getting it now: the projection's income starts this year, not at 62
  const q = emptyPlan();
  q.household.people = [{ id: "pat", name: "Pat", role: "self", birthDate: "1976-04-10", retirementAge: 67 }];
  q.accounts = [{ id: "a", name: "Savings", type: "savings", balance: 20000 }];
  q.retirement.spendingMonthly = 2000;
  q.guide = { setup: { ss: { pat: "getting" } } }; q.retirement.socialSecurity = { pat: { claimAge: 62, monthlyAtFRA: 2142.9 } };
  const d = compute(q, { today: T });
  const first = d.rows[0];
  assert.ok(first.incomeLines.some((x) => /Social Security/.test(x.name) && x.amount > 0), "paid from this year");
});

test("recheck 2026-11-05: a spouse's top-up counts from when both have claimed, as the Social Security page says it", async () => {
  const { compute: ss } = await import("../social-security/compute.js");
  const T = "2026-11-02";
  // Ruth (born August 1960) $2,100 at full age; Sam (born June 1966) $900 of his own, so $150 a month more on Ruth's record
  const plan = (rClaim, sClaim) => {
    const p = emptyPlan();
    p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1960-08-15", retirementAge: 66 }, { id: "s", name: "Sam", role: "partner", birthDate: "1966-06-15", retirementAge: 62 }];
    p.accounts = [{ id: "a", name: "Savings", type: "savings", balance: 300000, history: [] }]; p.retirement.spendingMonthly = 4000;
    p.retirement.socialSecurity = { r: { claimAge: rClaim, monthlyAtFRA: 2100 }, s: { claimAge: sClaim, monthlyAtFRA: 900 } };
    return p;
  };
  for (const [rClaim, sClaim, fromAge] of [[67, 67, 67], [67, 62, 62], [70, 62, 64]]) {
    const p = plan(rClaim, sClaim), d = ss(p, { today: T });
    const b = buildInputs(p, { today: T });
    const social = b.inputs.incomes.filter((x) => x.kind === "social");
    const top = social.filter((x) => x.personIndex === 1 && /spouse's benefit/.test(x.name));
    assert.equal(top.length, 1, `${rClaim}/${sClaim}`);
    assert.equal(top[0].yearly, d.couple.spousalCounted.s * 12); assert.equal(top[0].startAge, fromAge, `${rClaim}/${sClaim}: never before Ruth's own starts (${1960 + rClaim})`);
    assert.ok(1966 + top[0].startAge >= 1960 + rClaim, "not before the worker has claimed");
    // the projection's Social Security a year is the page's
    assert.ok(Math.abs(social.reduce((s, x) => s + x.yearly, 0) - d.householdYearly) < 1e-6); assert.equal(b.ssYearly, d.householdYearly);
    // each person's own benefit comes first (the stress tests replace a person's first Social Security line)
    assert.ok(social.findIndex((x) => x.personIndex === 1) < social.indexOf(top[0]));
  }
  // no figure of Sam's own: nothing counted for him
  const none = plan(67, 67); delete none.retirement.socialSecurity.s;
  assert.equal(buildInputs(none, { today: T }).inputs.incomes.filter((x) => x.kind === "social" && x.personIndex === 1).length, 0);
});

// recheck 2026-11-05: income on the Income page that is not pay, a pension or Social Security, after work stops. Rent goes on;
// support and other count after work only up to an end date they carry, else stop when their owner stops work; child support
// with no end date ends in the year the youngest dependent (or the child it names) turns 18; dividends and interest never.
const T5 = "2026-11-02";
const household = async (file) => { const fs = await import("node:fs"); return JSON.parse(fs.readFileSync(new URL(`../../../qa/households/${file}`, import.meta.url), "utf8").match(/## Plan JSON\s*```json\s*([\s\S]*?)```/)[1]); };
const figures = (p) => { const d = compute(p, { today: T5 }); return { success: d.result.success, end: Math.round(d.atEnd.totalReal), carries: Math.round(d.affordable), verdict: d.verdict, shortYear: d.shortYear ?? null }; };
const without = (p, name) => ({ ...p, income: p.income.filter((x) => x.name !== name) });
const yearsOf = (I, name) => project(I).rows.filter((r) => r.incomeLines.some((l) => l.name === name)).map((r) => r.year);

test("recheck 2026-11-05: help from parents with no end date does not change H-0826; with an end date it counts to it", async () => {
  const p = await household("09-near-retirement/income/H-0826-untaxed-support.md");
  assert.deepEqual(figures(p), figures(without(p, "Monthly help from parents")), "help from parents for life flipped short to tight");
  // with health cover in the spending figure (the box ticked) the recheck's figures; with the health line its $640 a month of
  // "Health premiums" gives way to Medicare for both from 2030 ($5,805 a year), so the plan carries more (review 2026-11-06)
  const inc = JSON.parse(JSON.stringify(p)); inc.retirement = { ...(inc.retirement ?? {}), healthIncluded: true };
  assert.equal(figures(inc).verdict, "short"); assert.equal(figures(inc).shortYear, 2059); assert.equal(figures(inc).carries, 59612);
  // seventh pass (2026-11-06): Medicare now holds a supplement (the national Medigap Plan G average, $194 a month each, $4,656 a year for the two) and Frank's
  // 2029 Medicare, with Gloria still at work, is counted (a job's plan is no longer taken to cover him): short in 2057,
  // carries $49,149; with the supplement set to $0 it is tight, $53,806
  assert.deepEqual([figures(p).verdict, figures(p).carries, figures(p).shortYear], ["short", 49149, 2057], "was short in 2059 with no health line, tight at $53,936 with no supplement");
  const b = buildInputs(p, { today: T5 });
  assert.equal(b.inputs.incomes.some((x) => x.name === "Monthly help from parents"), false);
  assert.deepEqual(b.otherLeft.map((x) => [x.name, x.yearly, x.why]), [["Monthly help from parents", 4800, "work"]]);
  // with an end date it counts after work (Gloria stops in 2030), to that year
  const q = JSON.parse(JSON.stringify(p)); q.income.find((x) => x.name === "Monthly help from parents").endDate = "2040-12-31";
  const J = buildInputs(q, { today: T5 });
  assert.deepEqual(yearsOf(J.inputs, "Monthly help from parents"), [2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040]);
  assert.deepEqual(J.otherLeft, []);
  assert.ok(compute(q, { today: T5 }).affordable > compute(p, { today: T5 }).affordable);
});

test("recheck 2026-11-05: 'IRA withdrawals' typed as other income adds nothing after work stops (H-0796): the IRA is already in the plan", async () => {
  const p = await household("08-retired/special/H-0796-draws-from-ira.md");
  assert.deepEqual(figures(p), figures(without(p, "IRA withdrawals")));
  assert.ok(buildInputs(p, { today: T5 }).otherLeft.some((x) => x.name === "IRA withdrawals" && x.yearly === 30000 && x.why === "accounts"));
});

test("recheck 2026-11-05: child support with no end date ends in the year the youngest dependent turns 18", async () => {
  // H-0201: Dana retires in 2050; Leo (2014) and Nia (2018) are grown by then: nothing after work stops
  const p = await household("03-single-parent/base/H-0201-base.md");
  assert.deepEqual(figures(p), figures(without(p, "Child support received")));
  assert.equal(buildInputs(p, { today: T5 }).inputs.incomes.some((x) => x.name === "Child support received"), false);
  // retiring in 2030 instead: it counts from 2030 to 2036, the year Nia (born 2018) turns 18, and not after
  const q = JSON.parse(JSON.stringify(p)); q.household.people[0].retirementAge = 45;
  const I = buildInputs(q, { today: T5 }).inputs;
  assert.deepEqual(yearsOf(I, "Child support received"), [2030, 2031, 2032, 2033, 2034, 2035, 2036]);
  assert.equal(I.incomes.find((x) => x.name === "Child support received").endAge, 2036 - 1985);
  // "Child support for Zoe" ends when Zoe (not the youngest) turns 18; a dependent born later does not stretch it
  const b = await household("06-blended-family/base/H-0501-base.md");
  b.household.people.find((x) => x.role === "self").retirementAge = 45;   // Rob stops in 2027
  const K = buildInputs(b, { today: T5 }).inputs;
  assert.equal(Math.max(...yearsOf(K, "Child support for Zoe")), 2017 + 18);
  // no dependent with a birth date: it is like any other support (stops when its owner stops work)
  const r = JSON.parse(JSON.stringify(q)); r.household.people = r.household.people.filter((x) => x.role !== "dependent");
  assert.deepEqual(yearsOf(buildInputs(r, { today: T5 }).inputs, "Child support received"), []);
});

test("recheck 2026-11-05: dividends and interest are not added (the accounts' growth holds them); rent still counts, for life", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const p = retiredCouplePlan();
  assert.deepEqual(figures(p), figures(without(p, "Dividends")), "dividends counted on top of the brokerage's growth");
  const b = buildInputs(p, { today: T5 });
  assert.equal(b.inputs.incomes.some((x) => x.name === "Dividends"), false);
  assert.deepEqual(b.otherLeft.map((x) => [x.name, x.yearly, x.why]), [["Dividends", 4800, "growth"]]);
  // rent: from the household's first retirement year (this year: Ruth stopped at 62) for life, rising with its 2% raise
  const rent = b.inputs.incomes.find((x) => x.name === "Rental duplex");
  assert.deepEqual([rent.yearly, rent.startAge, rent.endAge, rent.cola, rent.type], [24000, 2026 - 1957, undefined, true, "rental"]);
  assert.ok([2026, 2040, 2054].every((y) => yearsOf(b.inputs, "Rental duplex").includes(y)));
  assert.ok(figures(p).carries > figures(without(p, "Rental duplex")).carries, "rent counts");
  // with an end date, to it
  const q = retiredCouplePlan(); q.income.find((x) => x.name === "Rental duplex").endDate = "2035-06-30";
  assert.equal(Math.max(...yearsOf(buildInputs(q, { today: T5 }).inputs, "Rental duplex")), 2035);
  // the first retirement year's income, by what it is: the stat's words
  const d = compute(p, { today: T5 });
  assert.deepEqual(d.coverageFrom, ["Social Security", "pensions", "rent"]);
  assert.ok(Math.abs(d.coverage - d.rows[0].income / d.rows[0].spending) < 1e-12);
});

test("recheck 2026-11-05: a partner's support with no end date counts until they stop work, as their pay did, and not after", () => {
  const p = retirementPlan();   // Sam (self) stops in 2033, Lee (partner) in 2037
  p.income.push({ id: "h", name: "Help from Lee's parents", type: "support", personId: "lee", amount: 500, period: "monthly", growth: 0, taxable: false });
  const b = buildInputs(p, { today: T5 });
  assert.deepEqual(yearsOf(b.inputs, "Help from Lee's parents"), [2033, 2034, 2035, 2036]);
  assert.equal(b.inputs.incomes.find((x) => x.name === "Lee's pay").yearly, 66000, "pay is pay only");
  assert.deepEqual(b.otherLeft.map((x) => [x.name, x.why]), [["Help from Lee's parents", "work"]]);
});

// recheck 2026-11-05, second pass (verify of the first pass)
test("recheck 2026-11-05: withdrawals from the plan's own accounts typed as income are never added, even with an end date (H-0796)", async () => {
  const { ownAccountMoney } = await import("./compute.js");
  const p = await household("08-retired/special/H-0796-draws-from-ira.md");
  // following the old advice ("give it an end date if it carries on") counted the IRA twice again: $85,416 became $106,606
  const q = JSON.parse(JSON.stringify(p)); q.income.find((x) => x.name === "IRA withdrawals").endDate = "2055-12-31";
  assert.deepEqual(figures(q), figures(without(p, "IRA withdrawals")));
  assert.equal(buildInputs(q, { today: T5 }).inputs.incomes.some((x) => x.name === "IRA withdrawals"), false);
  assert.ok(buildInputs(q, { today: T5 }).otherLeft.some((x) => x.name === "IRA withdrawals" && x.yearly === 30000 && x.why === "accounts"));
  // by its name: retirement accounts and savings drawn on; a person called Ira, a trust's payout or an annuity are not
  for (const n of ["IRA withdrawals", "401(k) distribution", "401k draw", "RMD", "Required minimum distribution", "Roth withdrawals", "403b payout", "Withdrawals from savings", "Brokerage draws", "TSP payments", "457 plan"]) assert.equal(ownAccountMoney(n), true, n);
  for (const n of ["Help from Ira", "Family trust distribution", "Monthly help from parents", "Annuity", "Withdrawals from the family trust", "Child support received"]) assert.equal(ownAccountMoney(n), false, n);
});

test("recheck 2026-11-05: only child support is child support ('Children's book royalties' is other income)", async () => {
  const p = await household("03-single-parent/base/H-0201-base.md");
  p.household.people.find((x) => x.role === "self").retirementAge = 45;   // Dana stops in 2030; Nia (the youngest, born 2018) turns 18 in 2036
  const self = p.household.people.find((x) => x.role === "self").id;
  p.income.push({ id: "roy", name: "Children's book royalties", type: "other", personId: self, amount: 800, period: "monthly", growth: 0, taxable: true });
  p.income.push({ id: "sn", name: "Support for Leo", type: "support", personId: self, amount: 300, period: "monthly", growth: 0, taxable: false });
  const b = buildInputs(p, { today: T5 });
  // royalties with no end date stop with work (listed as not counted), never counted to a child's 18th
  assert.deepEqual(yearsOf(b.inputs, "Children's book royalties"), []);
  assert.ok(b.otherLeft.some((x) => x.name === "Children's book royalties" && x.why === "work"));
  // support that names a dependent is child support, to that child's 18th (Leo, born 2014: 2032); "Child support received"
  // still runs to the youngest's (Nia: 2036)
  assert.deepEqual(yearsOf(b.inputs, "Support for Leo"), [2030, 2031, 2032]);
  assert.deepEqual(yearsOf(b.inputs, "Child support received"), [2030, 2031, 2032, 2033, 2034, 2035, 2036]);
});

test("recheck 2026-11-05: what is not counted is said with what to do: own-account withdrawals, and dividends from outside the accounts", async () => {
  const { leftWords } = await import("../careful.js");
  const ui = { h: (tag, attrs, ...kids) => kids.join("") };
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const say = (left) => leftWords(ui, money, left).join("");
  const own = say([{ name: "IRA withdrawals", yearly: 30000, why: "accounts" }]);
  assert.match(own, /IRA withdrawals, \$30,000 a year, is not added: it comes out of your own accounts, which the plan already draws on\./);
  assert.doesNotMatch(own, /end date/, "an end date would count the IRA twice");
  assert.match(say([{ name: "IRA withdrawals", yearly: 30000, why: "accounts" }, { name: "RMD", yearly: 5000, why: "accounts" }]), /IRA withdrawals and RMD, \$35,000 a year, are not added: they come out of your own accounts/);
  const growth = say([{ name: "Dividends", yearly: 4800, why: "growth" }]);
  assert.match(growth, /already includes them\. If some of it comes from outside your accounts \(a loan you made, a trust\), type that part as other income with an end date on the Income page\./);
  assert.match(say([{ name: "Help from parents", yearly: 4800, why: "work" }]), /Give it an end date on the Income page if it carries on\./);
  // the "Not counted" row of What goes into this says why, by kind (it said "no end date, so it stops when work does" for H-0796's IRA)
  const { leftWhy } = await import("../careful.js");
  assert.deepEqual(["work", "growth", "accounts"].map((why) => leftWhy({ why })), ["no end date, so it stops when work does", "already in your accounts' growth", "taken from your own accounts, which the plan already draws on"]);
});

// review 2026-11-06 (verify of the second pass)
test("review 2026-11-06: rent named by its address or unit ('457 Elm St duplex', 'Rent from condo 401B') is rent, and a person called Roth is not a Roth account", async () => {
  const { ownAccountMoney } = await import("./compute.js");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  // the retired couple's rent counts for life whatever it is called: the name check for money out of the plan's own accounts
  // dropped it ($85,416 a year carried became $61,416, "Paid by income" 201% became 129%) and said "it comes out of your own
  // accounts, which the plan already draws on"
  const named = (name) => { const p = retiredCouplePlan(); p.income.find((x) => x.type === "rental").name = name; return p; };
  for (const name of ["457 Elm St duplex", "Rent from condo 401B", "Unit 403 B rent", "Rent from the Roth house"]) {
    const p = named(name);
    assert.deepEqual(figures(p), figures(retiredCouplePlan()), name);
    const b = buildInputs(p, { today: T5 });
    assert.ok(b.inputs.incomes.some((x) => x.name === name && x.yearly === 24000), name);
    assert.equal(b.otherLeft.some((x) => x.why === "accounts"), false, name);
  }
  // help from a grandmother whose surname is Roth, to its end date, counts to that date like any other support
  const p = retiredCouplePlan();
  p.income.push({ id: "gr", name: "Help from Grandma Roth", type: "support", personId: "p-ruth", amount: 300, period: "monthly", growth: 0, taxable: false, endDate: "2030-12-31" });
  assert.deepEqual(yearsOf(buildInputs(p, { today: T5 }).inputs, "Help from Grandma Roth"), [2026, 2027, 2028, 2029, 2030]);
  for (const n of ["Support from Grandma Roth", "Rothman consulting", "Roth", "457 Elm St", "Unit 401B"]) assert.equal(ownAccountMoney(n), false, n);
  for (const n of ["Roth IRA withdrawals", "Roth distributions", "Roth conversion", "457(b) payout", "457 b withdrawals", "457 plan", "Draws from my Roth account"]) assert.equal(ownAccountMoney(n), true, n);
});

test("review 2026-11-06: a draw from a business or against pay is not money out of the household's own accounts", async () => {
  const { ownAccountMoney } = await import("./compute.js");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  // "Owner's draw from business account" read as a withdrawal from the household's accounts: never counted, and the page
  // said it came out of the household's own accounts
  for (const n of ["Owner's draw from business account", "Owner’s draw from business account", "Account manager bonus draws", "Draws against commissions account", "Partnership draws from capital account"]) assert.equal(ownAccountMoney(n), false, n);
  // the accounts themselves still are, a business owner's own 401(k) included
  for (const n of ["Withdrawals from savings", "Brokerage account draws", "IRA withdrawals", "Business owner's 401(k) withdrawals", "Roth IRA withdrawals"]) assert.equal(ownAccountMoney(n), true, n);
  const p = retiredCouplePlan();
  p.income.push({ id: "od", name: "Owner's draw from business account", type: "other", personId: "p-sam", amount: 1000, period: "monthly", growth: 0, taxable: true, endDate: "2029-12-31" });
  const b = buildInputs(p, { today: T5 });
  assert.deepEqual(yearsOf(b.inputs, "Owner's draw from business account"), [2026, 2027, 2028, 2029]);
  assert.equal(b.otherLeft.some((x) => x.why === "accounts"), false);
});

// ---- the health line (2026-11-02): marketplace cover from retirement to 65 after the credit, then Medicare, on top of spending
const H = "2026-11-02";
// the family couple both stopping at 62: Bo (1988) stops in 2050 while Ana works, Ana (1990) in 2052, the household's retirement year
const at62 = async () => { const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs"); const p = familyPlan(H); for (const q of p.household.people) if (q.role !== "dependent") q.retirementAge = 62; return p; };
const healthOf = (I) => (I.events ?? []).filter((e) => e.kind === "health");

test("health line: marketplace years 2052-2054 from Healthcare before 65, Medicare from 65 from Medicare, one event a year", async () => {
  const { compute: healthcare } = await import("../healthcare/compute.js");
  const { compute: medicare } = await import("../medicare/compute.js");
  const p = await at62();
  const b = buildInputs(p, { today: H });
  assert.equal(b.inputs.retireYear, 2052);
  const hc = healthcare(p, { today: H }), md = medicare(p, { today: H });
  const ev = healthOf(b.inputs);
  assert.ok(ev.every((e) => e.label === "Health insurance" && e.spending === true), "marked as spending: guaranteed income pays it first");
  assert.equal(ev[0].year, 2052, "nothing while Ana still works: Bo joins her plan at work in 2050 and 2051");
  assert.deepEqual(hc.onWorkPlan.map((y) => y.year), [2050, 2051]);
  const cost = (y) => hc.years.find((x) => x.year === y)?.cost ?? 0, med = (y) => md.years.find((x) => x.year === y)?.totalYearly ?? 0;
  // 2052: both on the marketplace (Ana 62, Bo 64); 2053-2054: Ana on it, Bo on Medicare at 65; 2055 on: both on Medicare
  near(ev.find((e) => e.year === 2052).amount, cost(2052), 0.01); assert.equal(med(2052), 0);
  near(ev.find((e) => e.year === 2053).amount, cost(2053) + med(2053), 0.01);
  near(ev.find((e) => e.year === 2054).amount, cost(2054) + med(2054), 0.01);
  near(ev.find((e) => e.year === 2055).amount, med(2055), 0.01); assert.equal(cost(2055), 0);
  assert.equal(ev.length, b.inputs.endYear - 2052 + 1, "one event a year from 2052 to the end");
  near(med(2053), 12 * (202.9 + md.partD + md.supplement), 0.01);   // Bo alone, standard Part B, the base drug plan and a supplement, no surcharge
  assert.equal(md.supplement, 194, "no supplement entered: the national Medigap Plan G average (seventh pass; it was $0)");
  near(med(2055), 2 * med(2053), 0.01);
  const h = b.health;
  assert.equal(h.included, false);
  assert.deepEqual([h.bridge.fromYear, h.bridge.untilYear, h.bridge.years], [2052, 2054, 3]);
  near(h.bridge.total, hc.total, 0.01); near(h.bridge.monthlyFirst, cost(2052) / 12, 0.01);
  assert.equal(h.medicare.fromYear, 2053); near(h.medicare.monthlyAll, med(2055) / 12, 0.01); assert.equal(h.medicare.enrolled, 2);
  near(h.medicare.total, md.lifetime, 0.01, "every Medicare year is in retirement");
  near(h.total, ev.reduce((t, e) => t + e.amount, 0), 0.01);
  // the cliff: 2053 and 2054 are over it, the first year's lost credit is healthcare's own figure
  const over = hc.years.filter((y) => y.overCliff > 0);
  assert.equal(h.bridge.cliff.year, over[0].year); near(h.bridge.cliff.lost, over[0].lostCredit, 0.01); near(h.bridge.cliff.income, hc.cliffIncome, 0.01);
  // the projection exposes it, and the engine's rows carry it as spending
  const d = compute(p, { today: H });
  assert.deepEqual(d.health, b.health);
  near(d.rows.find((r) => r.year === 2055).eventSpending, med(2055) * d.rows.find((r) => r.year === 2055).priceLevel, 0.01);
});

// review 2026-11-02: one rule per person and year, whoever is listed first: while anyone still works, a plan through that
// job covers the household (Healthcare before 65's own rule), so neither marketplace nor Medicare is added that year
test("health line: Medicare years while someone still works are left to the job's plan, whoever is listed first (the family: Bo is 65 in 2053, Ana works to 2055)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: medicare } = await import("../medicare/compute.js");
  const b = buildInputs(familyPlan(H), { today: H });
  assert.equal(b.health.bridge, null, "Ana retires at 65: no marketplace years");
  // seventh pass (2026-11-06): Bo, 65 in 2053, has stopped while Ana works: his Medicare is counted unless the plan says her
  // job's plan covers him (retirement.medicare.jobCoversSpouse); it was taken for granted
  const md = medicare(familyPlan(H), { today: H });
  assert.equal(b.health.medicare.fromYear, 2053); assert.equal(healthOf(b.inputs)[0].year, 2053); assert.equal(b.health.onJob, null);
  assert.deepEqual([b.health.spouseOnJob.fromYear, b.health.spouseOnJob.untilYear, b.health.spouseOnJob.names, b.health.spouseOnJob.parts[0].worker], [2053, 2054, ["Bo"], "Ana"]);
  near(b.health.medicare.total, md.lifetime, 0.01, "every year the Medicare page counts");
  // with the tick, as before: the two years are left to Ana's plan, named with who works and the amount the Medicare page counts
  const t = familyPlan(H); t.retirement.medicare = { jobCoversSpouse: true };
  const bt = buildInputs(t, { today: H });
  assert.equal(bt.health.medicare.fromYear, 2055); assert.equal(healthOf(bt.inputs)[0].year, 2055); assert.equal(bt.health.spouseOnJob, null);
  assert.deepEqual([bt.health.onJob.fromYear, bt.health.onJob.untilYear, bt.health.onJob.names, bt.health.onJob.worker], [2053, 2054, ["Bo"], "Ana"]);
  near(bt.health.medicare.total + bt.health.onJob.total, md.lifetime, 0.01, "the Medicare page's lifetime is the added years plus the job's years");
  // Bo listed first: the same rule gives the same Medicare (it was 179,970 against 174,161 before the review)
  const sw = familyPlan(H); sw.household.people.find((x) => x.id === "p-bo").role = "self"; sw.household.people.find((x) => x.id === "p-ana").role = "partner";
  const bs = buildInputs(sw, { today: H });
  assert.equal(bs.inputs.people[0].name, "Bo");
  near(bs.health.medicare.total, b.health.medicare.total, 0.01); assert.equal(bs.health.bridge, null, "Bo's 2050-2052 are on Ana's plan at work");
  // roles the other way (Ana stops at 60, Bo works to 67): Bo's own 2053-2054 are not added while he works, Medicare from 2055
  const rv = familyPlan(H); rv.household.people.find((x) => x.id === "p-ana").retirementAge = 60; rv.household.people.find((x) => x.id === "p-bo").retirementAge = 67;
  const br = buildInputs(rv, { today: H });
  assert.equal(br.health.medicare.fromYear, 2055); assert.deepEqual([br.health.onJob.fromYear, br.health.onJob.names, br.health.onJob.worker], [2053, ["Bo"], "Bo"]);
});

test("health line: a premium taken out of today's expenses goes back in while a partner still works (Ana stops at 60 in 2050, Bo works to 67)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(H); p.retirement.spendingMonthly = null;
  p.household.people.find((x) => x.id === "p-ana").retirementAge = 60; p.household.people.find((x) => x.id === "p-bo").retirementAge = 67;
  p.expenses.push({ id: "hi", name: "Health insurance", category: "health", amount: 600, period: "monthly", essential: true, inflates: true });
  const b = buildInputs(p, { today: H });
  assert.equal(b.inputs.retireYear, 2050); near(b.health.removedMonthly, 600, 0.01);
  const ev = (y) => healthOf(b.inputs).find((e) => e.year === y)?.amount ?? 0;
  // 2050-2054: Ana on Bo's plan at work, so its $600 a month goes on (and Bo's own Medicare in 2053-2054 is not added); 2055 on: Medicare for both
  for (const y of [2050, 2051, 2052, 2053, 2054]) near(ev(y), 7200, 0.01);
  near(ev(2055), 2 * 12 * (202.9 + 38.99 + 194), 0.01);   // with the Medigap Plan G default (seventh pass)
  assert.deepEqual([b.health.jobPlan.fromYear, b.health.jobPlan.untilYear, b.health.jobPlan.worker], [2050, 2054, "Bo"]);
  // so the years someone still works carry today's whole spending, premium included: 69,916 + 7,200 = 77,116
  const d = compute(p, { today: H });
  const row = d.rows.find((r) => r.year === 2051);
  near((row.spending + row.eventSpending) / row.priceLevel, (b.spendingYearly + 7200), 0.01);
  near(b.spendingYearly + 7200, 77116, 1);
});

test("health line: 'my spending figure already includes health insurance' adds nothing, and the verdict moves the right way", async () => {
  const p = await at62();
  const withH = compute(p, { today: H });
  p.retirement.healthIncluded = true;
  const b = buildInputs(p, { today: H });
  assert.equal(healthOf(b.inputs).length, 0); assert.equal(b.health.included, true); assert.equal(b.health.total, 0);
  const without = compute(p, { today: H });
  near(without.spendingYearly, withH.spendingYearly, 0.01, "the typed figure is the same either way");
  assert.ok(withH.affordable < without.affordable - 2000, `health on top leaves less to spend: ${withH.affordable} vs ${without.affordable}`);
  const rank = { "on track": 0, tight: 1, short: 2 };
  assert.ok(rank[withH.verdict] >= rank[without.verdict], "never a better verdict with the cost added");
  assert.ok(withH.atEnd.totalReal < without.atEnd.totalReal);
  // guaranteed income covers a smaller share once health cover counts as spending (Lee stops with Sam in 2033, so nobody's
  // job covers them: Sam, 65, is on Medicare at once and Lee on the marketplace; with Lee working to 67, 2033 is a job year)
  const r = retirementPlan(); r.household.people.find((x) => x.id === "lee").retirementAge = 63; r.retirement.socialSecurity.sam.claimAge = 65;
  const rWith = compute(r, { today: H });
  r.retirement.healthIncluded = true;
  const rWithout = compute(r, { today: H });
  assert.ok(rWith.coverage > 0 && rWith.coverage < rWithout.coverage, `${rWith.coverage} vs ${rWithout.coverage}`);
});

test("health line: spending from Expenses keeps a Medicare line and drops a work premium; a line for someone else leaves the household's Medicare in", async () => {
  const { compute: medicare } = await import("../medicare/compute.js");
  const p = await at62();
  p.retirement.spendingMonthly = null;
  const plain = buildInputs(p, { today: H });
  assert.equal(plain.spendingSource, "expenses"); assert.ok(plain.health.medicare, "no Medicare line: Medicare is added");
  p.expenses.push({ id: "mc", name: "Medicare Part B for Bo's mother", category: "health", amount: 203, period: "monthly", essential: true, inflates: true },
    { id: "hi", name: "Health insurance premium", category: "health", amount: 640, period: "monthly", essential: true, inflates: true },
    { id: "dn", name: "Dental insurance", category: "insurance", amount: 40, period: "monthly", essential: true, inflates: true },
    { id: "rx", name: "Prescriptions", category: "health", amount: 60, period: "monthly", essential: true, inflates: true });
  const b = buildInputs(p, { today: H });
  // review 2026-11-02 (was: the mother's line dropped all of Ana's and Bo's Medicare, $179,966, and the plan looked better
  // for an added expense): nobody here is 65 yet, so the line is someone else's and stays as it is; their own Medicare is added
  assert.equal(b.health.medicareLine, null); assert.equal(b.health.paidBy, null); assert.equal(b.health.otherLine, "Medicare Part B for Bo's mother");
  near(b.health.medicare.total, medicare(p, { today: H }).lifetime, 0.01, "all of Ana's and Bo's Medicare");
  assert.ok(b.health.bridge, "the marketplace years are still added");
  assert.deepEqual(b.health.coverLines.map((x) => x.name), ["Health insurance premium"]);
  // the Medicare, dental and prescription lines stay in the carried figure; the work premium gives way to the health line
  near(b.spendingYearly, plain.spendingYearly + (203 + 40 + 60) * 12, 0.01);
  // an added expense never makes the plan carry more: the mother's $203 alone
  const q = await at62(); q.retirement.spendingMonthly = null;
  const before = compute(q, { today: H });
  q.expenses.push({ ...p.expenses.find((x) => x.id === "mc") });
  const after = compute(q, { today: H });
  assert.ok(after.affordable <= before.affordable + 1, `${after.affordable} vs ${before.affordable}`);
  // a typed figure is taken as it is: Medicare goes on top unless the box is ticked
  p.retirement.spendingMonthly = 7000;
  const typed = buildInputs(p, { today: H });
  assert.ok(typed.health.medicare); assert.equal(typed.health.medicareLine, null); near(typed.spendingYearly, 84000, 0.01);
});

test("health line: a Medicare line pays the Medicare of those 65 or over now, not of a younger spouse", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: medicare } = await import("../medicare/compute.js");
  // a retired couple, 68 and 63, living on savings; Medicare Part B on Expenses is the older one's
  const p = familyPlan(H); p.household.people = p.household.people.filter((x) => x.role !== "dependent");
  p.household.people[0].birthDate = "1958-03-01"; p.household.people[1].birthDate = "1963-06-01";
  for (const q of p.household.people) q.retirementAge = 60;
  p.income = []; p.retirement.contributions = []; p.retirement.spendingMonthly = null;
  p.expenses.push({ id: "mc", name: "Medicare Part B", category: "health", amount: 203, period: "monthly", essential: true, inflates: true });
  const b = buildInputs(p, { today: H });
  assert.deepEqual(b.health.paidBy.names, ["Ana"]); assert.equal(b.health.medicareLine, "Medicare Part B");
  const md = medicare(p, { today: H });
  // 2026-2027: Ana's Medicare is the line's, Bo (63, 64) is on the marketplace; from 2028 (Bo 65) Bo's share of each year
  assert.deepEqual([b.health.bridge.fromYear, b.health.bridge.untilYear], [2026, 2027]);
  assert.equal(b.health.medicare.fromYear, 2028); assert.deepEqual(b.health.medicare.joins, [{ name: "Bo", year: 2028 }]);
  const y = md.years.find((x) => x.year === 2030);
  assert.equal(y.enrolled, 2); near(healthOf(b.inputs).find((e) => e.year === 2030).amount, y.totalYearly / 2, 0.01, "Bo's half: the same premium for each");
  const bo = md.years.filter((x) => x.year >= 2028 && x.year <= 1963 + 95).reduce((t, x) => t + x.totalYearly * ((x.year - 1963 >= 65 ? 1 : 0) / x.enrolled), 0);
  near(b.health.medicare.total, bo, 0.01);
});

test("health line: Get started's Insurance and health row is not health insurance; for a retired couple over 65 it pays their Medicare", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const rows = [["housing", "Rent", 900], ["groceries", "Groceries", 800], ["insurance", "Insurance and health", 700], ["dining", "Eating out and fun", 400]];
  const setupRows = () => rows.map(([k, n, a]) => ({ id: `setup-x-${k}`, name: n, category: k, amount: a, period: "monthly", essential: true, inflates: true }));
  const p = familyPlan(H); p.household.people = p.household.people.filter((x) => x.role !== "dependent");
  p.household.people[0].birthDate = "1958-03-01"; p.household.people[1].birthDate = "1959-06-01";
  for (const q of p.household.people) q.retirementAge = 60;
  p.income = []; p.retirement.contributions = []; p.retirement.spendingMonthly = null; p.expenses = setupRows();
  const b = buildInputs(p, { today: H });
  // review 2026-11-02 (was: all $700 came out as health cover and only $484 of Medicare came back)
  assert.deepEqual(b.health.coverLines, [], "the row is kept whole"); near(b.health.removedMonthly, 0, 0.01);
  assert.deepEqual(b.health.paidBy.names, ["Ana", "Bo"]); assert.equal(b.health.medicare, null, "their Medicare is in the row");
  assert.equal(healthOf(b.inputs).length, 0);
  // a working couple under 65 with the same row: it stays whole and the health line is added on top
  const w = await at62(); w.retirement.spendingMonthly = null; w.expenses.push(...setupRows().filter((x) => x.id === "setup-x-insurance"));
  const bw = buildInputs(w, { today: H });
  assert.deepEqual(bw.health.coverLines, []); assert.equal(bw.health.paidBy, null); assert.ok(bw.health.medicare && bw.health.bridge);
});

test("health line: Get started's own spending figure carries today's bills, so a premium in them comes out too", async () => {
  const p = await at62();
  p.expenses.push({ id: "hi", name: "Health insurance", category: "health", amount: 600, period: "monthly", essential: true, inflates: true });
  p.retirement.spendingMonthly = 5170;
  const typed = buildInputs(p, { today: H });
  assert.equal(typed.health.removedMonthly, 0, "a figure typed on this page is taken as it is"); near(typed.spendingYearly, 5170 * 12, 0.01);
  p.guide = { ...(p.guide ?? {}), setup: { ...(p.guide?.setup ?? {}), retireAuto: true } };
  const auto = buildInputs(p, { today: H });
  // review 2026-11-02 (was: the $600 stayed in the figure and the health line went on top: $7,200 a year twice)
  assert.equal(auto.spendingSource, "typed"); assert.equal(auto.health.fromSetup, true);
  near(auto.health.removedMonthly, 600, 0.01); near(auto.spendingYearly, (5170 - 600) * 12, 0.01);
  // ticked: nothing is taken out and nothing added
  p.retirement.healthIncluded = true;
  const inc = buildInputs(p, { today: H });
  near(inc.spendingYearly, 5170 * 12, 0.01); assert.equal(healthOf(inc.inputs).length, 0);
});

test("health line: with the box ticked the page can still say what cover would cost (showHealth), the engine never sees it", async () => {
  const p = await at62();
  const on = compute(p, { today: H });
  p.retirement.healthIncluded = true;
  const plain = compute(p, { today: H }), shown = compute(p, { today: H, showHealth: true });
  assert.equal(plain.health.shown, undefined);
  near(shown.health.shown.total, on.health.total, 0.01); near(shown.health.shown.bridge.monthlyLow, on.health.bridge.monthlyLow, 0.01);
  near(shown.affordable, plain.affordable, 0.01, "the figures are the box's");
});

test("health line: which Expenses lines are health insurance", async () => {
  const { healthLine } = await import("./compute.js");
  const k = (name, category = "health", id = "x") => healthLine({ id, name, category });
  assert.equal(k("Medicare premiums"), "medicare"); assert.equal(k("Medigap plan G", "insurance"), "medicare"); assert.equal(k("Part D drug plan"), "medicare");
  assert.equal(k("Health insurance", "insurance"), "cover"); assert.equal(k("Marketplace plan", "other"), "cover"); assert.equal(k("COBRA"), "cover"); assert.equal(k("Insurance premium"), "cover");
  assert.equal(k("Car and home insurance", "insurance"), null); assert.equal(k("Dental insurance"), null); assert.equal(k("Life insurance premium"), null);
  assert.equal(k("Doctor visits"), null); assert.equal(k("Prescriptions"), null); assert.equal(k("Insurance premium", "insurance"), null, "an insurance line has to say health");
  // review 2026-11-02: cover held with other things is "mixed", never taken out whole
  assert.equal(k("Insurance and health", "insurance", "setup-x-insurance"), "mixed", "Get started's row: premiums you pay yourself, medicine");
  assert.equal(k("Insurance and health", "insurance"), "mixed"); assert.equal(k("Health insurance & prescriptions"), "mixed"); assert.equal(k("Health insurance, gym"), "mixed");
});

test("health line: no recursion, and either page can load first", async () => {
  const { planIncome } = await import("../medicare/compute.js");
  const p = await at62();
  assert.equal(healthOf(buildInputs(p, { today: H, health: false }).inputs).length, 0, "the run the premiums are priced on has no health line");
  assert.equal(buildInputs(p, { today: H, health: false }).health, null);
  assert.equal(healthOf(planIncome(p, { today: H }).inputs).length, 0);
  const { spawnSync } = await import("node:child_process");
  for (const first of ["../medicare/compute.js", "../healthcare/compute.js", "./compute.js"]) {
    const url = new URL(first, import.meta.url).href, fx = new URL("../../../qa/fixtures/family-plan.mjs", import.meta.url).href;
    const code = `const m = await import(${JSON.stringify(url)}); const { familyPlan } = await import(${JSON.stringify(fx)}); const r = m.compute(familyPlan("${H}"), { today: "${H}" }); if (!r.ready) process.exit(2);`;
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
    assert.equal(run.status, 0, `${first} first: ${run.stderr}`);
  }
  // Get started's compute first (this page reads its retireDefault, and it reads this page's compute)
  const su = new URL("../../overview/setup/compute.js", import.meta.url).href, pr = new URL("./compute.js", import.meta.url).href, fx = new URL("../../../qa/fixtures/family-plan.mjs", import.meta.url).href;
  const code = `await import(${JSON.stringify(su)}); const m = await import(${JSON.stringify(pr)}); const { familyPlan } = await import(${JSON.stringify(fx)}); if (!m.compute(familyPlan("${H}"), { today: "${H}" }).ready) process.exit(2);`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
  assert.equal(run.status, 0, `setup first: ${run.stderr}`);
});

// ---- review 2026-11-02 (third pass): who works, Get started's live figure, cover alongside Medicare, one reason a year
const noJobLee = (born) => {
  const p = retirementPlan();
  p.income = p.income.filter((i) => i.personId !== "lee");
  p.retirement.contributions = p.retirement.contributions.filter((c) => c.personId !== "lee");
  const lee = p.household.people.find((x) => x.id === "lee"); lee.birthDate = born; delete lee.retirementAge;   // the plan's 65
  p.guide = { setup: { status: { sam: "work", lee: "none" } } };
  return p;
};

test("health line: a partner with no pay does not work, so the retired one's Medicare is added and the partner's own cover priced", async () => {
  const { compute: healthcare } = await import("../healthcare/compute.js");
  const { compute: medicare } = await import("../medicare/compute.js");
  const { workRule } = await import("./compute.js");
  const p = noJobLee("1975-08-22");
  const b = buildInputs(p, { today: H });
  const works = workRule(p, b.inputs.people, { today: H, incomes: b.inputs.incomes });
  const [sam, lee] = b.inputs.people;
  assert.equal(works(sam, 2030), true, "Sam has a salary and is under 65"); assert.equal(works(sam, 2033), false, "65: retired");
  assert.equal(works(lee, 2030), false, "no pay, and Get started says not working now");
  // was: 2033-2039 left to "Lee's job" (no Medicare for Sam, $199,841 against the Medicare page's $220,160), Lee's cover never priced
  const md = medicare(p, { today: H }), hc = healthcare(p, { today: H });
  assert.equal(b.health.onJob, null);
  // (220,160.16 before the seventh pass's supplement: + $2,328 a person-year over 62 person-years)
  near(b.health.medicare.total, md.lifetime, 0.01, "every Medicare year of the Medicare page"); near(b.health.medicare.total, 220160.16 + 2328 * 62, 0.05);
  assert.equal(b.health.medicare.fromYear, 2033);
  // Lee on the marketplace from Sam's retirement to 65 (2033-2039), Lee covered through Sam's job before that
  assert.deepEqual(hc.years.map((y) => y.year), [2033, 2034, 2035, 2036, 2037, 2038, 2039]); assert.deepEqual(hc.years[0].covered, ["Lee"]);
  assert.deepEqual(hc.onWorkPlan.map((y) => y.year), [2026, 2027, 2028, 2029, 2030, 2031, 2032]); assert.equal(hc.onWorkPlan[0].worker, "Sam");
  near(b.health.bridge.total, hc.total, 0.01);
  const ev = (y) => (b.inputs.events ?? []).find((e) => e.kind === "health" && e.year === y)?.amount ?? 0;
  near(ev(2033), hc.years[0].cost + md.years.find((y) => y.year === 2033).totalYearly, 0.01);
  // "retired" in Get started ends work too, even with pay on Income; with pay and no status the age decides
  const q = retirementPlan(); q.guide = { setup: { status: { lee: "retired" } } };
  const bq = buildInputs(q, { today: H });
  assert.equal(workRule(q, bq.inputs.people, { today: H, incomes: bq.inputs.incomes })(bq.inputs.people[1], 2034), false);
  const r = buildInputs(retirementPlan(), { today: H });
  assert.equal(workRule(retirementPlan(), r.inputs.people, { today: H, incomes: r.inputs.incomes })(r.inputs.people[1], 2034), true, "Lee's salary, under 67");
  // the fixture: Sam's 2033-2036, while Lee works, were on Lee's job; since the seventh pass they are counted (no tick), and only
  // Lee's own 2035-2036, while she works, are left to her job
  assert.deepEqual(r.health.spouseOnJob.parts.map((x) => [x.fromYear, x.untilYear, x.worker, x.names.join("+")]), [[2033, 2036, "Lee", "Sam"]]);
  assert.deepEqual(r.health.onJob.parts.map((x) => [x.fromYear, x.untilYear, x.worker, x.names.join("+")]), [[2035, 2036, "Lee", "Lee"]]);
});

test("health line: Get started's own figure is worked out from today's bills, so a premium added or changed later comes out only once", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { retireDefault } = await import("../../overview/setup/compute.js");
  const p = familyPlan(H);
  p.retirement.spendingMonthly = retireDefault(p, H); p.guide = { setup: { retireAuto: true } };
  assert.equal(p.retirement.spendingMonthly, 4570);
  near(buildInputs(p, { today: H }).spendingYearly, 4570 * 12, 0.01);
  // a $600 premium added on Expenses afterwards: was $3,970 a month (600 taken out of a figure that never had it)
  p.expenses.push({ id: "hi", name: "Health insurance", category: "health", amount: 600, period: "monthly", essential: true, inflates: true });
  const b = buildInputs(p, { today: H });
  assert.equal(b.setupMonthly, 5170, "Get started's figure from today's bills"); near(b.health.removedMonthly, 600, 0.01);
  near(b.spendingYearly, 4570 * 12, 0.01);
  assert.equal(compute(p, { today: H }).setupMonthly, 5170, "the page shows it in Retirement settings");
  // changed to $800: still $4,570 a month before health cover
  p.expenses.find((x) => x.id === "hi").amount = 800;
  near(buildInputs(p, { today: H }).spendingYearly, 4570 * 12, 0.01);
  // a typed figure is taken as it is (retireAuto off): the saved figure, premium or not
  p.guide.setup.retireAuto = false;
  const t = buildInputs(p, { today: H });
  assert.equal(t.setupMonthly, null); near(t.spendingYearly, 4570 * 12, 0.01); near(t.health.removedMonthly, 0, 0.01);
});

test("setupFigure is Get started's retireDefault, worked out without loading Get started (plans with setup rows, loans, childcare, a retired adult)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { retireDefault } = await import("../../overview/setup/compute.js");
  const { setupFigure } = await import("./compute.js");
  const plans = [familyPlan(H), retirementPlan(), emptyPlan()];
  const rows = familyPlan(H); rows.expenses.push(
    { id: "setup-x-housing", name: "Home costs", category: "housing", amount: 900, period: "monthly" }, { id: "setup-x-childcare", name: "Childcare", category: "childcare", amount: 1200, period: "monthly" },
    { id: "setup-x-insurance", name: "Insurance and health", category: "insurance", amount: 5400, period: "annual" }, { id: "kids", name: "Daycare", category: "childcare", amount: 800, period: "monthly" },
    { id: "old", name: "Old gym", category: "fun", amount: 40, period: "monthly", endDate: "2025-01-31" });
  plans.push(rows);
  const total = familyPlan(H); total.expenses = [{ id: "setup-x-total", name: "Monthly spending (rough)", category: "other", amount: 3500, period: "monthly" }]; plans.push(total);
  const loanBill = familyPlan(H); loanBill.expenses.push({ id: "car", name: "Car payment", category: "debt", amount: 410, period: "monthly" }); plans.push(loanBill);
  const retired = familyPlan(H); retired.guide = { setup: { status: { "p-ana": "retired" } } }; retired.household.people[1].retirementAge = 75; plans.push(retired);
  for (const [i, p] of plans.entries()) {
    for (const today of [H, null, "2040-06-30"]) assert.equal(setupFigure(p, today), retireDefault(p, today), `plan ${i} on ${today}`);
  }
});

test("health line: with everyone 65 or over and retired, a health insurance line is cover alongside Medicare: it stays and pays their Medicare", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const couple = (lines) => {
    const p = familyPlan(H); p.household.people = p.household.people.filter((x) => x.role !== "dependent");
    p.household.people[0].birthDate = "1958-03-01"; p.household.people[1].birthDate = "1959-06-01";
    for (const q of p.household.people) q.retirementAge = 60;
    p.income = []; p.retirement.contributions = []; p.retirement.spendingMonthly = null; p.debts = [];
    p.expenses = [{ id: "r", name: "Rent", category: "housing", amount: 2586, period: "monthly", essential: true, inflates: true }, ...lines.map((x) => ({ period: "monthly", essential: true, inflates: true, ...x }))];
    return p;
  };
  // a supplement and a Medicare line: was the supplement's $300 taken out and nothing put back
  const a = buildInputs(couple([{ id: "s", name: "Supplemental insurance", category: "health", amount: 300 }, { id: "m", name: "Medicare premiums", category: "health", amount: 490 }]), { today: H });
  assert.deepEqual(a.health.coverLines, []); near(a.spendingYearly, (2586 + 300 + 490) * 12, 0.01);
  assert.deepEqual(a.health.paidBy.names, ["Ana", "Bo"]); assert.equal(a.health.paidBy.era, false); assert.equal(healthOf(a.inputs).length, 0);
  // one "Health insurance" line: was $900 taken out and $483.78 of Medicare added ($416 a month less)
  const b = buildInputs(couple([{ id: "h", name: "Health insurance", category: "health", amount: 900 }]), { today: H });
  assert.deepEqual(b.health.coverLines, []); near(b.spendingYearly, (2586 + 900) * 12, 0.01);
  assert.deepEqual(b.health.paidBy, { line: "Health insurance", ids: ["p-ana", "p-bo"], names: ["Ana", "Bo"], era: true });
  assert.equal(b.health.medicare, null); assert.equal(healthOf(b.inputs).length, 0);
  // one of them under 65 (Bo 63): the line is cover before Medicare again, and comes out
  const c = couple([{ id: "h", name: "Health insurance", category: "health", amount: 900 }]); c.household.people[1].birthDate = "1963-06-01";
  near(buildInputs(c, { today: H }).health.removedMonthly, 900, 0.01);
});

test("health line: one reason a year: Medicare a line on Expenses pays is never also left to a job's plan", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: medicare } = await import("../medicare/compute.js");
  // Ruth 72, retired; Sam 69, still paid until 70 (the projection's "Sam's pay"); Medicare premiums on Expenses
  const p = familyPlan(H); p.household.people = p.household.people.filter((x) => x.role !== "dependent");
  Object.assign(p.household.people[0], { name: "Ruth", birthDate: "1954-03-10", retirementAge: 62, lifeExpectancy: 100 });
  Object.assign(p.household.people[1], { name: "Sam", birthDate: "1957-06-20", retirementAge: 70, lifeExpectancy: 90 });
  p.income = [{ id: "pay", name: "Sam's consulting", type: "business", personId: "p-bo", amount: 2000, period: "monthly", growth: 0, taxable: true }];
  p.retirement.contributions = []; p.retirement.spendingMonthly = null;
  p.expenses.push({ id: "mc", name: "Medicare premiums", category: "health", amount: 370, period: "monthly", essential: true, inflates: true });
  const b = buildInputs(p, { today: H });
  assert.deepEqual(b.health.paidBy.names, ["Ruth", "Sam"]);
  assert.equal(b.health.onJob, null, "was: 2026 'Ruth is 65 or over while Sam still works' next to 'Medicare for Ruth and Sam is already in your spending'");
  // Get started's mixed row pays Ruth's only (Sam still works in 2026): 2026 is Sam's job year, for Sam alone, at his share
  p.expenses = p.expenses.filter((x) => x.id !== "mc").concat({ id: "setup-x-insurance", name: "Insurance and health", category: "insurance", amount: 700, period: "monthly", essential: true, inflates: true });
  const m = buildInputs(p, { today: H });
  assert.deepEqual(m.health.paidBy.names, ["Ruth"]);
  assert.deepEqual([m.health.onJob.fromYear, m.health.onJob.untilYear, m.health.onJob.names, m.health.onJob.worker], [2026, 2026, ["Sam"], "Sam"]);
  near(m.health.onJob.total, medicare(p, { today: H }).years.find((x) => x.year === 2026).totalYearly / 2, 0.01);
});

test("health line: the words' data: the work premium kept apart from the total, and whether the marketplace years have a credit", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(H); p.retirement.spendingMonthly = null;
  p.household.people.find((x) => x.id === "p-ana").retirementAge = 60; p.household.people.find((x) => x.id === "p-bo").retirementAge = 67;
  p.expenses.push({ id: "hi", name: "Health insurance", category: "health", amount: 600, period: "monthly", essential: true, inflates: true });
  const b = buildInputs(p, { today: H });
  near(b.health.jobPlan.total, 600 * 12 * 5, 0.01);
  near(b.health.total - b.health.jobPlan.total, b.health.medicare.total, 0.01, "'in all' without the premium: Medicare only");
  near(b.health.medicare.total, 174160.8 + 2328 * 60, 0.05);   // + the supplement over 60 person-years (seventh pass)
  // the couple at 62: credits in the marketplace years, none under the poverty line
  const c = buildInputs(await at62(), { today: H });
  assert.ok(c.health.bridge.credit > 0); assert.deepEqual(c.health.bridge.underLine, []);
  // the retired 68/63 couple of an earlier test (Part B on Expenses): 2026's income was under the poverty line until the
  // marketplace counted Ana's untaxed Social Security (fifth pass); Lee with no job (2033, before any Social Security) still is
  const o = familyPlan(H); o.household.people = o.household.people.filter((x) => x.role !== "dependent");
  o.household.people[0].birthDate = "1958-03-01"; o.household.people[1].birthDate = "1963-06-01";
  for (const q of o.household.people) q.retirementAge = 60;
  o.income = []; o.retirement.contributions = []; o.retirement.spendingMonthly = null;
  o.expenses.push({ id: "mc", name: "Medicare Part B", category: "health", amount: 203, period: "monthly", essential: true, inflates: true });
  assert.deepEqual(buildInputs(o, { today: H }).health.bridge.underLine, [], "was: [2026]");
  const l = retirementPlan(); l.income = l.income.filter((x) => x.personId !== "lee"); l.retirement.contributions = l.retirement.contributions.filter((x) => x.personId !== "lee");
  assert.deepEqual(buildInputs(l, { today: H }).health.bridge.underLine, [2033]);
});

// ---- review 2026-11-02 (fourth pass): pay is a job or a business, a "work" answer counts, both pages price the same years,
// the spending box shows the figure the plan counts, and "after the credit" only over years that all have one
const rentLee = (line) => {
  // the retirement fixture with Lee's salary swapped for other income she owns (her IRA saving kept); nothing said in Get started
  const p = retirementPlan();
  p.income = p.income.filter((x) => x.personId !== "lee").concat({ personId: "lee", growth: 0, taxable: true, period: "monthly", ...line });
  return p;
};

test("fourth pass: rent, dividends, pensions and other income never make anyone work: Lee's rent leaves Sam's Medicare and Lee's own cover in", async () => {
  const { compute: healthcare } = await import("../healthcare/compute.js");
  const { compute: medicare } = await import("../medicare/compute.js");
  const { workRule } = await import("./compute.js");
  const p = rentLee({ id: "rent", name: "Rental condo", type: "rental", amount: 1500, growth: 0.02 });
  const b = buildInputs(p, { today: H });
  const [sam, lee] = b.inputs.people;
  // the engine still brings her rent in as income, under its own name (the FIRE answer's incomeOther), never as "Lee's pay"
  assert.ok(b.inputs.incomes.some((x) => x.name === "Rental condo"), "the engine still brings her rent in as income");
  assert.ok(!b.inputs.incomes.some((x) => x.name === "Lee's pay"), "rent is not pay");
  assert.equal(workRule(p, b.inputs.people, { today: H })(lee, 2034), false, "was: true (\"Lee's pay\" counted as a job)");
  assert.equal(workRule(p, b.inputs.people, { today: H })(sam, 2030), true);
  // was: $246,687, Medicare only from 2037, 2033-2036 "a plan through Lee's job"; now Medicare from 2033 and Lee's marketplace 2033-2034
  assert.equal(b.health.onJob, null);
  const md = medicare(p, { today: H }), hc = healthcare(p, { today: H });
  // merged with the FIRE answer (round 5): the rent is its own line from 2033 for life (it stopped at Lee's 66 inside "Lee's
  // pay"), so the plan's income is $18,000 higher every year and Medicare's income surcharge applies in 21 years (2045-2065):
  // Medicare $264,103 -> $295,353, the marketplace 2033 $602 -> $588 and 2034 $4,220 -> $4,227, the line $268,924 -> $300,168
  // (seventh pass: + the Medigap Plan G default, $2,328 a person-year over 62 person-years: 295,353 -> 439,689; the line 300,168 -> 444,504)
  assert.equal(b.health.medicare.fromYear, 2033); near(b.health.medicare.total, md.lifetime, 0.01); near(b.health.medicare.total, 295353 + 2328 * 62, 1);
  assert.equal(b.health.medicare.surchargeYears, 21);
  assert.deepEqual(hc.years.map((y) => y.year), [2033, 2034]); near(hc.years[0].cost, 588, 1); near(hc.years[1].cost, 4227, 1);
  near(b.health.bridge.total, hc.total, 0.01); near(b.health.total, 300168 + 2328 * 62, 1);
  assert.equal(hc.noBridge, false, "was: \"no one needs marketplace cover: everyone works until 65\"");
  // $400 a month of dividends, other income and a pension owned by Lee: the same
  for (const line of [{ id: "div", name: "Dividends", type: "investment", amount: 400 }, { id: "oth", name: "Royalties", type: "other", amount: 400 }, { id: "pen", name: "Lee's small pension", type: "pension", amount: 400 }]) {
    const q = rentLee(line), bq = buildInputs(q, { today: H });
    assert.equal(workRule(q, bq.inputs.people, { today: H })(bq.inputs.people[1], 2034), false, line.type);
    assert.equal(bq.health.onJob, null, line.type); assert.equal(bq.health.medicare.fromYear, 2033, line.type);
  }
  // Lee's salary back: she works to 67; Sam's 2033-2036 were on her job's plan, and are counted since the seventh pass (no tick)
  const r = buildInputs(retirementPlan(), { today: H });
  assert.deepEqual([r.health.spouseOnJob.fromYear, r.health.spouseOnJob.untilYear], [2033, 2036]);
  const rt = retirementPlan(); rt.retirement.medicare = { jobCoversSpouse: true };
  assert.deepEqual([buildInputs(rt, { today: H }).health.onJob.fromYear, buildInputs(rt, { today: H }).health.onJob.untilYear], [2033, 2036], "with the tick, as before");
});

test("fourth pass: a retired couple's rental is not a job: Medicare from this year for both, no 'still works' year", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: medicare } = await import("../medicare/compute.js");
  // the retired couple seed's shape: Ruth 72, Sam 69 (retirement age 70); Sam's salary ended last year, a rental duplex is his
  const p = familyPlan(H); p.household.people = p.household.people.filter((x) => x.role !== "dependent");
  Object.assign(p.household.people[0], { name: "Ruth", birthDate: "1954-03-10", retirementAge: 62, lifeExpectancy: 100 });
  Object.assign(p.household.people[1], { name: "Sam", birthDate: "1957-06-20", retirementAge: 70, lifeExpectancy: 90 });
  p.income = [
    { id: "rent", name: "Rental duplex", type: "rental", personId: "p-bo", amount: 2000, period: "monthly", growth: 0.02, taxable: true },
    { id: "old", name: "Sam's old salary", type: "salary", personId: "p-bo", amount: 6000, period: "monthly", growth: 0, taxable: true, endDate: "2025-12-31" },
  ];
  p.retirement.contributions = []; p.retirement.spendingMonthly = null; p.debts = [];
  const b = buildInputs(p, { today: H });
  // was: "In 2026 Ruth is 65 or over while Sam still works", and 2026's Medicare for both ($5,805) left out
  assert.equal(b.health.onJob, null);
  assert.equal(b.health.medicare.fromYear, 2026); near(b.health.medicare.total, medicare(p, { today: H }).lifetime, 0.01);
});

test("fourth pass: pay owned by a child never makes an adult work; pay with no owner is the first adult's", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { workRule } = await import("./compute.js");
  const p = familyPlan(H);
  p.income = p.income.filter((x) => x.personId !== "p-ana").concat({ id: "cy-job", name: "Cy's summer job", type: "salary", personId: "p-cy", amount: 800, period: "monthly", growth: 0, taxable: true });
  const people = buildInputs(p, { today: H }).inputs.people;
  assert.equal(people[0].name, "Ana");
  // review 2026-11-06: her 401(k) saving with a match is work (the one work rule, Financial independence's since 2026-11-05)
  assert.equal(workRule(p, people, { today: H })(people[0], 2030), true, "her 401(k) saving at work");
  p.retirement.contributions = p.retirement.contributions.filter((c) => c.personId !== "p-ana");
  assert.equal(workRule(p, people, { today: H })(people[0], 2030), false, "was: true (Cy's pay counted as Ana's)");
  p.income.find((x) => x.id === "cy-job").personId = "";
  assert.equal(workRule(p, people, { today: H })(people[0], 2030), true, "no owner: the first adult's");
});

test("fourth pass: a Get started answer of work counts with no Income line: no marketplace years before the household retires", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: healthcare } = await import("../healthcare/compute.js");
  const { workRule } = await import("./compute.js");
  const p = familyPlan(H); p.income = []; p.guide = { setup: { status: { "p-ana": "work", "p-bo": "work" } } };
  const b = buildInputs(p, { today: H });
  const [ana, bo] = b.inputs.people;
  const works = workRule(p, b.inputs.people, { today: H });
  assert.equal(works(ana, 2054), true); assert.equal(works(ana, 2055), false, "65: retired"); assert.equal(works(bo, 2049), true); assert.equal(works(bo, 2050), false);
  // was: 29 marketplace years 2026-2054 for Ana, Bo and Cy at income $0 ($741,455), none of them in the projection
  const hc = healthcare(p, { today: H });
  assert.equal(hc.noBridge, true); assert.equal(hc.total, 0);
  assert.deepEqual(hc.onWorkPlan.map((y) => y.year), [2050, 2051, 2052], "Bo on Ana's plan, as with their salaries");
  assert.equal(b.inputs.retireYear, 2055);
  near(b.health.total, buildInputs(familyPlan(H), { today: H }).health.total, 0.01, "the same health line as with their pay on Income");
  // "none" means not working, even with a salary on Income
  const q = familyPlan(H); q.guide = { setup: { status: { "p-bo": "none" } } };
  const qp = buildInputs(q, { today: H }).inputs.people;
  assert.equal(workRule(q, qp, { today: H })(qp[1], 2030), false);
});

test("fourth pass: the Healthcare page and the health line price the same years (fifth pass: Ana not working no longer holds the household at work)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: healthcare } = await import("../healthcare/compute.js");
  const { compute: medicare } = await import("../medicare/compute.js");
  // Ana (the household's retirement year: 65 in 2055) is not working now and has no pay; Bo works to 62 (2050)
  const p = familyPlan(H);
  p.income = p.income.filter((x) => x.personId !== "p-ana"); p.retirement.contributions = p.retirement.contributions.filter((c) => c.personId !== "p-ana");
  p.guide = { setup: { status: { "p-ana": "none" } } };
  const b = buildInputs(p, { today: H }), hc = healthcare(p, { today: H }), md = medicare(p, { today: H });
  // fifth pass: the household retires when Bo, the one who works, stops (was 2055, Ana's 65th, with 2050-2054 at income $0);
  // (the seventh pass made it this year; its verify: Ana is 36, a parent at home under 55, so Bo's work holds the household at
  // work until he stops, as the fifth pass had it)
  assert.equal(b.inputs.retireYear, 2050);
  assert.deepEqual([hc.onWorkPlan[0].year, hc.onWorkPlan.at(-1).year, hc.onWorkPlan[0].worker], [2026, 2049, "Bo"], "Ana on Bo's plan while he works");
  // 2050 on: nobody works, so the marketplace (Ana to 2054, Bo to 2052) and Bo's Medicare from 2053
  assert.equal(hc.years[0].year, 2050); assert.deepEqual(hc.years[0].covered, ["Ana", "Bo"]);
  // was: the health line began in 2055, leaving out the page's 2050-2054 and Bo's Medicare 2053-2054
  assert.equal(b.health.bridge.fromYear, 2050); assert.equal(b.health.bridge.years, hc.years.length); near(b.health.bridge.total, hc.total, 0.01);
  assert.equal(b.health.medicare.fromYear, 2053); near(b.health.medicare.total, md.lifetime, 0.01);
  const ev = (y) => (b.inputs.events ?? []).find((e) => e.kind === "health" && e.year === y)?.amount ?? 0;
  near(ev(2050), hc.years[0].cost, 0.01); near(ev(2053), hc.years.find((y) => y.year === 2053).cost + md.years.find((y) => y.year === 2053).totalYearly, 0.01);
  assert.equal(ev(2049), 0, "Bo still works in 2049");
});

test("fourth pass: Retirement settings' box shows the figure the plan counts before health insurance, and a lower figure typed lowers spending", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { retireDefault } = await import("../../overview/setup/compute.js");
  const { saveSpendingFigure } = await import("./compute.js");
  // Get started's figure (4,570), then a $600 premium added on Expenses: the plan counts 4,570 before health cover
  const p = familyPlan(H);
  p.retirement.spendingMonthly = retireDefault(p, H); p.guide = { setup: { retireAuto: true } };
  p.expenses.push({ id: "hi", name: "Health insurance", category: "health", amount: 600, period: "monthly", essential: true, inflates: true });
  const d = compute(p, { today: H });
  assert.equal(d.setupMonthly, 5170); near(d.spendingYearly / 12, 4570, 0.01);
  assert.equal(d.figureMonthly, 4570, "the box (and its fold status) show what the plan counts, not 5,170 with the premium in it");
  const saved = (typed) => { const q = structuredClone(p); saveSpendingFigure(q, typed, d.figureMonthly); return q; };
  // was: typing 5,000 under a box showing 5,170 raised spending from 4,570 to 5,000; now 5,000 is above the 4,570 shown
  const five = saved(5000); assert.equal(five.guide.setup.retireAuto, false); near(buildInputs(five, { today: H }).spendingYearly / 12, 5000, 0.01);
  const four = saved(4000); near(buildInputs(four, { today: H }).spendingYearly / 12, 4000, 0.01, "lower than shown: lower spending");
  // the figure shown, saved again: still Get started's, still 4,570, the saved figure untouched
  const same = saved(4570); assert.equal(same.guide.setup.retireAuto, true); assert.equal(same.retirement.spendingMonthly, 4570);
  near(buildInputs(same, { today: H }).spendingYearly / 12, 4570, 0.01);
  // a typed figure (not Get started's) is shown as typed; no figure: nothing shown (today's expenses)
  const t = retirementPlan(); assert.equal(compute(t, { today: H }).figureMonthly, 6500);
  t.retirement.spendingMonthly = null; assert.equal(compute(t, { today: H }).figureMonthly, null);
});

test("fourth pass: 'after the credit' only when every marketplace year has one (the 68/63 couple, Lee with no job, the couple at 62)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { creditWords } = await import("./compute.js");
  const MIXED = "marketplace; with the credit in the years it applies";
  // the retired 68/63 couple: fifth pass, both years with a credit (2026 read as under the poverty line before the marketplace
  // counted Ana's untaxed Social Security); Lee with no job below is the mixed case now
  const o = familyPlan(H); o.household.people = o.household.people.filter((x) => x.role !== "dependent");
  o.household.people[0].birthDate = "1958-03-01"; o.household.people[1].birthDate = "1963-06-01";
  for (const q of o.household.people) q.retirementAge = 60;
  o.income = []; o.retirement.contributions = []; o.retirement.spendingMonthly = null;
  o.expenses.push({ id: "mc", name: "Medicare Part B", category: "health", amount: 203, period: "monthly", essential: true, inflates: true });
  const c = buildInputs(o, { today: H }).health.bridge;
  assert.deepEqual([c.years, c.creditYears, c.underLine], [2, 2, []], "was: [2, 1, [2026]]"); assert.equal(creditWords(c), "marketplace, after the credit");
  // Lee with no job (and nothing in Get started): 2033 under the poverty line, 2034 with a credit
  const l = retirementPlan(); l.income = l.income.filter((x) => x.personId !== "lee"); l.retirement.contributions = l.retirement.contributions.filter((x) => x.personId !== "lee");
  const lb = buildInputs(l, { today: H }).health.bridge;
  assert.deepEqual([lb.fromYear, lb.years, lb.creditYears, lb.underLine], [2033, 2, 1, [2033]]); assert.equal(creditWords(lb), MIXED);
  // the couple at 62: 2052 with a credit, 2053 and 2054 over the cliff (no credit)
  const g = buildInputs(await at62(), { today: H }).health.bridge;
  assert.deepEqual([g.years, g.creditYears, g.cliff.yearsList], [3, 1, [2053, 2054]]); assert.equal(creditWords(g), MIXED);
  // every year with a credit, and none
  const r = buildInputs(rentLee({ id: "rent", name: "Rental condo", type: "rental", amount: 1500, growth: 0.02 }), { today: H }).health.bridge;
  assert.deepEqual([r.years, r.creditYears], [2, 2]); assert.equal(creditWords(r), "marketplace, after the credit");
  assert.equal(creditWords({ years: 2, creditYears: 0 }), "marketplace, no credit");
});

// ---- review 2026-11-02 (fifth pass): who is covered by whose plan, the household's retirement year, rent by its own name,
// the marketplace's own income, and the words naming each person's years
const fifth = {
  // the family with Ana's salary taken out and a summer job of Cy's (a child): Ana has no pay and said nothing in Get started
  // (review 2026-11-06: and her 401(k) saving, which is work by the one work rule)
  childJob: async () => { const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs"); const p = familyPlan(H); p.income = p.income.filter((x) => x.personId !== "p-ana").concat({ id: "cy-job", name: "Cy's summer job", type: "salary", personId: "p-cy", amount: 800, period: "monthly", growth: 0, taxable: true }); p.retirement.contributions = p.retirement.contributions.filter((c) => c.personId !== "p-ana"); return p; },
  // Ana "not working now" with no pay, Bo works to 62 (2050)
  anaNone: async () => { const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs"); const p = familyPlan(H); p.income = p.income.filter((x) => x.personId !== "p-ana"); p.retirement.contributions = p.retirement.contributions.filter((c) => c.personId !== "p-ana"); p.guide = { setup: { status: { "p-ana": "none" } } }; return p; },
  // the retired 68/63 couple (Part B on Expenses): Ana gets Social Security, Bo is on the marketplace 2026-2027
  c6863: async () => { const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs"); const o = familyPlan(H); o.household.people = o.household.people.filter((x) => x.role !== "dependent"); o.household.people[0].birthDate = "1958-03-01"; o.household.people[1].birthDate = "1963-06-01"; for (const q of o.household.people) q.retirementAge = 60; o.income = []; o.retirement.contributions = []; o.retirement.spendingMonthly = null; o.expenses.push({ id: "mc", name: "Medicare Part B", category: "health", amount: 203, period: "monthly", essential: true, inflates: true }); return o; },
};

test("fifth pass: a first adult with no pay and no Get started answer is presumed at work until the household retires: Bo on Ana's plan, the family's health line", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: healthcare } = await import("../healthcare/compute.js");
  const { workRule } = await import("./compute.js");
  const family = buildInputs(familyPlan(H), { today: H }).health;
  // seventh pass: 174,161 + the Medigap Plan G default (+139,680) + Bo's 2053-2054 Medicare while Ana works (+10,461.36)
  near(family.total, 324302, 1); assert.equal(family.spouseOnJob.parts[0].presumedUntil, null, "Ana's salary: nothing presumed");
  const noIncome = familyPlan(H); noIncome.income = []; noIncome.retirement.contributions = [];
  // with their saving kept, Ana's 401(k) at work and Bo's Roth (nobody has pay) are work: the same health line, nothing presumed
  const saving = familyPlan(H); saving.income = [];
  const bs = buildInputs(saving, { today: H }).health;
  near(bs.total, family.total, 0.01); assert.equal(bs.spouseOnJob.parts[0].presumedUntil, null);
  for (const p of [await fifth.childJob(), noIncome]) {
    const b = buildInputs(p, { today: H }), hc = healthcare(p, { today: H });
    // was: $231,756, Bo's marketplace 2050-2052 at an income of $0 ("under the poverty line") and nothing for Ana, who has no job either
    near(b.health.total, family.total, 0.01); assert.equal(b.health.bridge, null);
    // (seventh pass: Bo's 2053-2054 counted while Ana works, as with her salary; it was left to her plan)
    assert.deepEqual([b.health.spouseOnJob.fromYear, b.health.spouseOnJob.untilYear, b.health.spouseOnJob.parts[0].worker], [2053, 2054, "Ana"], "Bo's Medicare counted while Ana works, as with her salary");
    assert.equal(b.health.spouseOnJob.parts[0].presumedUntil, 2055, "the page says the plan takes Ana as working until 2055");
    assert.equal(hc.noBridge, true); assert.deepEqual([hc.onWorkPlan[0].year, hc.onWorkPlan.at(-1).year, hc.onWorkPlan[0].worker], [2050, 2052, "Ana"]);
    assert.deepEqual(hc.presumed, [{ name: "Ana", untilYear: 2055 }], "the page says the plan takes Ana as working until 2055");
    const [ana, bo] = b.inputs.people, w = workRule(p, b.inputs.people, { today: H, retireYear: b.inputs.retireYear });
    assert.equal(w(ana, 2054), true); assert.equal(w(ana, 2055), false); assert.equal(w.presumed(ana, 2054), true);
    // a partner with no pay and no answer is not presumed: covered by the first adult's plan, not working
    assert.equal(w.presumed(bo, 2030), false);
  }
  // without the household's year nobody is presumed (that is how the year itself is worked out)
  const p = await fifth.childJob(), people = buildInputs(p, { today: H }).inputs.people;
  assert.equal(workRule(p, people, { today: H })(people[0], 2030), false);
});

test("fifth pass: no cover after the end of someone's plan (Lee with a plan to 60 was priced cover at 63 and 64)", async () => {
  const { compute: healthcare } = await import("../healthcare/compute.js");
  const { compute: medicare } = await import("../medicare/compute.js");
  const { coverRule } = await import("./compute.js");
  const p = retirementPlan();
  p.income = p.income.filter((x) => x.personId !== "lee"); p.retirement.contributions = p.retirement.contributions.filter((c) => c.personId !== "lee");
  p.household.people.find((q) => q.id === "lee").lifeExpectancy = 60;   // her plan ends in 2030
  const b = buildInputs(p, { today: H }), hc = healthcare(p, { today: H });
  const lee = b.inputs.people[1];
  assert.equal(coverRule(p, b.inputs.people, { today: H, retireYear: b.inputs.retireYear })(lee, 2033), false, "was: true");
  assert.deepEqual(hc.years, [], "was: 2033 Lee $394, 2034 Lee $3,828"); assert.equal(b.health.bridge, null);
  // (115,275 before the seventh pass's Medigap Plan G default: + $2,328 a year over Sam's 31 Medicare years, 2033-2063)
  near(b.health.total, medicare(p, { today: H }).lifetime, 0.01); near(b.health.total, 115275 + 2328 * 31, 1);
});

test("fifth pass: someone not working does not hold the household at work: retirement starts when the last working adult stops, or now", async () => {
  const { compute: healthcare } = await import("../healthcare/compute.js");
  const { householdRetireYear, workRule } = await import("./compute.js");
  const p = await fifth.anaNone();
  const d = compute(p, { today: H }), hc = healthcare(p, { today: H });
  // was 2055 (Ana's 65th): 2050-2054 had no spending and no withdrawals, the marketplace priced on an income of $0; the fifth
  // pass made it 2050 (Bo's stop: nothing drawn before, his pay taken to cover all $84,000 a year). Seventh pass (2026-11-06):
  // this year, Bo's pay as income. Its verify (2026-11-06): Ana is 36, a parent at home under 55 (STOP_NOW_FROM_AGE), so Bo's
  // work holds the household at work until he stops, as the fifth pass had it; starting now put the savings in the retired mix
  // for 28 years and drew the tax on his pay from savings (short in 2045 instead of 2054)
  assert.equal(d.inputs.retireYear, 2050);
  assert.deepEqual(d.retireBy, { id: "p-bo", name: "Bo", age: 62, first: false });
  const r26 = d.rows.find((r) => r.year === 2026);
  assert.ok(!r26.retired && r26.spending === 0, "a working year: Bo's pay carries it, nothing drawn");
  for (const y of hc.years) assert.ok(d.rows.find((r) => r.year === y.year).spending > 0, `${y.year}: priced in a year with living costs`);
  assert.equal(d.verdict, "short"); assert.equal(d.shortYear, 2054);
  assert.deepEqual(d.health.bridge.underLine, [2054]);
  // Bo working by a Get started answer alone (no pay on Income) still holds the household at work until he stops, as before
  const ans = await fifth.anaNone(); ans.income = ans.income.filter((x) => x.personId !== "p-bo"); ans.guide.setup.status["p-bo"] = "work";
  assert.equal(buildInputs(ans, { today: H }).inputs.retireYear, 2050);
  // nobody works: retirement is now
  const q = await fifth.anaNone(); q.guide.setup.status["p-bo"] = "retired";
  const bq = buildInputs(q, { today: H });
  assert.equal(bq.inputs.retireYear, 2026); assert.equal(bq.retireBy.nobody, true);
  // the first adult working, or saying nothing: their own retirement year, as before (the frozen keys have no Get started answers)
  const people = buildInputs(retirementPlan(), { today: H }).inputs.people;
  assert.equal(householdRetireYear(retirementPlan(), people, 2026, workRule(retirementPlan(), people, { today: H })), 2033);
  const empty = retirementPlan(); empty.income = [];
  assert.equal(householdRetireYear(empty, people, 2026, workRule(empty, people, { today: H })), 2033);
  // a partner Get started says is retired brings no pay in, whatever Income still holds (was "Lee's pay" to 66)
  const r = retirementPlan(); r.guide = { setup: { status: { lee: "retired" } } };
  // (type "pay": the base's name for it, recheck 2026-11-05; the fifth pass called it kind "pay")
  assert.equal(buildInputs(r, { today: H }).inputs.incomes.some((x) => x.type === "pay"), false);
  assert.equal(buildInputs(retirementPlan(), { today: H }).inputs.incomes.find((x) => x.name === "Lee's pay").type, "pay");
});

test("fifth pass: rent and dividends are named by their own name, never as someone's pay, and never make anyone work", async () => {
  const { incomeWords, workRule } = await import("./compute.js");
  const p = rentLee({ id: "rent", name: "Rental condo", type: "rental", amount: 1500, growth: 0.02 });
  const I = buildInputs(p, { today: H }).inputs;
  const words = incomeWords(I, (n) => `$${Math.round(n).toLocaleString("en-US")}`);
  // one unit (round 8 batch 6 review, UX 7): the year, with whose age it is
  assert.ok(words.includes("Rental condo (before its costs): $18,000 a year from 2033 (Lee is 63)"), words.join("; "));
  assert.ok(!words.some((w) => /Lee's pay/.test(w)), "was: Lee's pay: $18,000 a year from 56");
  assert.ok(words.includes("Lee's Social Security: $25,200 a year from 2037 (age 67)"), words.join("; "));
  // the stat says what comes in in the first retirement year, by type (was incomeKinds, every kind the plan holds; review
  // 2026-11-06: the base's coverageFrom, which matches the share it shows): in 2033 only the rent
  assert.deepEqual(compute(p, { today: H }).coverageFrom, ["rent"]);
  assert.equal(workRule(p, I.people, { today: H })(I.people[1], 2030), false);
  // an Income line named like pay is still what its type says: a rental called "Lee's pay" is rent, never pay
  const q = rentLee({ id: "rent", name: "Lee's pay", type: "rental", amount: 1500 });
  const Iq = buildInputs(q, { today: H }).inputs;
  assert.equal(Iq.incomes.find((x) => x.name === "Lee's pay").type, "rental");
  assert.equal(workRule(q, Iq.people, { today: H })(Iq.people[1], 2030), false);
});

test("fifth pass: the health words name the person and the years for each part, with no 'then' between parts that overlap", async () => {
  const { healthSummary } = await import("./compute.js");
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const say = async (p) => { const h = buildInputs(await p, { today: H }).health; return healthSummary(h.bridge, h.medicare, { money }); };
  // was: "About $210 to $1,440 a month from 2026 until 65 (marketplace; ...), then Medicare about $240 a month for Ana from 2026"
  // (seventh pass: Medicare with the Medigap Plan G default, $194 a month each: about $440 a month each, $870 for two; it read $240 and $480)
  assert.equal(await say(fifth.c6863()), "Bo: about $300 to $630 a month, 2026 and 2027 (marketplace, after the credit). Bo: Medicare, about $440 a month from 2028.");
  assert.equal(await say(at62()), "Ana and Bo: about $400 a month, 2052 (marketplace, after the credit). Ana: about $1,440 a month, 2053 and 2054 (marketplace, no credit). Bo: Medicare, about $440 a month from 2053. Ana: Medicare from 2055 (about $870 a month for the two of you).");
  const lee = await say(rentLee({ id: "rent", name: "Rental condo", type: "rental", amount: 1500, growth: 0.02 }));
  assert.ok(lee.startsWith("Lee: about $50 to $350 a month, 2033 and 2034 (marketplace, after the credit). Sam: Medicare, about $440 a month from 2033. Lee: Medicare from 2035"), lee);
  assert.ok(lee.endsWith("including an income surcharge in 21 of those years (Medicare page)."), lee);
  for (const s of [await say(fifth.c6863()), await say(at62()), lee, await say(fifth.anaNone())]) assert.ok(!/\bthen\b/.test(s), s);
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  // (seventh pass: Bo's Medicare from 2053, while Ana still works, is counted: no tick says her job's plan covers him)
  assert.equal(await say(familyPlan(H)), "Bo: Medicare, about $440 a month from 2053. Ana: Medicare from 2055 (about $870 a month for the two of you).");
  assert.equal(healthSummary(null, null), "");
});

// ---- review 2026-11-06 (sixth pass): the fifth pass's verify (defects 1 and 2) and one work rule with Financial independence
const sixth = {
  // the 68/63 couple (Ana 68, past her 60; Bo 63) with Bo working to 66 for $1,500 a month; `said`: Get started has Ana "retired"
  partTime: async (said) => { const p = await fifth.c6863(); p.household.people[1].retirementAge = 66; p.income = [{ id: "bo", name: "Bo's job", type: "salary", personId: "p-bo", amount: 1500, period: "monthly", growth: 0, taxable: true }]; if (said) p.guide = { setup: { status: { "p-ana": "retired" } } }; return p; },
  // the same couple, Bo's retirement age 66 and no pay at all
  noPay: async (said) => { const p = await fifth.c6863(); p.household.people[1].retirementAge = 66; if (said) p.guide = { setup: { status: { "p-ana": "retired" } } }; return p; },
};

test("review 2026-11-06 (defect 1): a 'retired' answer never lets a part-time partner's job hold the household at work past the first adult's own year", async () => {
  const { compute: fire } = await import("../fire/compute.js");
  const { compute: goalSeek } = await import("../../scenarios/goal-seek/compute.js");
  const said = await sixth.partTime(true), none = await sixth.partTime(false);
  const a = compute(said, { today: H }), b = compute(none, { today: H });
  // was 2029 ("when Bo stops work at 66"): 2026-2028 had no spending, nothing drawn and Ana's Social Security dropped
  assert.equal(a.inputs.retireYear, 2026, "was 2029"); assert.equal(b.inputs.retireYear, 2026);
  // the year is her own (this year), so she is named; seventh pass: as having stopped, with Bo's pay coming in until 2028
  assert.deepEqual(a.retireBy, { id: "p-ana", name: "Ana", age: 68, first: true, stopped: true, notWorking: false, working: [{ id: "p-bo", name: "Bo", stopAge: 66, untilYear: 2028 }] });
  assert.deepEqual(b.retireBy, { id: "p-ana", name: "Ana", age: 68, first: true });
  // the two plans give one answer: "Runs out in 2041 (age 83)", carries $68,896 (was "Runs out in 2054", $71,564 with the answer);
  // seventh pass: "Runs out in 2038 (age 80)", carries $66,863, Medicare holding the Medigap Plan G default ($87,080 -> $156,920)
  const fig = (d) => [d.verdict, d.shortYear, d.shortAge, Math.round(d.affordable), Math.round(d.health.total)];
  assert.deepEqual(fig(a), fig(b)); assert.deepEqual(fig(a), ["short", 2038, 80, 66863, 156920]);
  // 2026 is a year of retirement: spending, Ana's Social Security and Bo's pay ($18,000) all in it
  const row = a.rows.find((r) => r.year === 2026);
  assert.ok(row.retired && row.spending > 0);
  assert.ok(row.incomeLines.some((l) => l.name === "Bo's pay" && Math.abs(l.amount - 18000) < 1), "Bo's pay comes in as income");
  assert.ok(row.incomeLines.some((l) => l.name === "Ana's Social Security" && l.amount > 30000));
  // Financial independence and Goal seek: one answer for both plans, about Bo (was "Bo would need to work until 74 ... 67 would
  // do" and Goal seek "at 67" with the answer, and no Goal seek lever without it)
  const fa = fire(said, { today: H }).withIncome, fb = fire(none, { today: H }).withIncome;
  assert.deepEqual([fa.name, fa.earliestAge, fa.retired], ["Bo", null, false]); assert.deepEqual([fb.name, fb.earliestAge], [fa.name, fa.earliestAge]);
  const lever = (p) => goalSeek(p, { today: H }).levers.find((l) => l.id === "retire");
  assert.equal(lever(said).title, "When Bo can retire"); assert.equal(lever(none).title, "When Bo can retire");
  assert.equal(lever(said).value, null); assert.equal(lever(none).value, null);
  // the fifth pass's own cases: Ana "not working now" at 36 kept Bo's 2050 (her own year is 2055); seventh pass: now, Bo's pay
  // as income (the "someone not working" test); nobody working is now
  assert.equal(buildInputs(await fifth.anaNone(), { today: H }).inputs.retireYear, 2050, "a parent at home at 36: Bo's stop (verify of the seventh pass)");
  assert.equal(buildInputs(await sixth.noPay(true), { today: H }).inputs.retireYear, 2026);
});

test("review 2026-11-06: householdRetireYear is capped at the first adult's own year, and retireStarter names who starts it", async () => {
  const { householdRetireYear, workRule, retireStarter } = await import("./compute.js");
  const people = [{ id: "a", name: "Ana", birthYear: 1971, retireAge: 65, endAge: 95 }, { id: "b", name: "Bo", birthYear: 1968, retireAge: 70, endAge: 95 }];
  const plan = { household: { people: [{ id: "a", role: "self" }, { id: "b", role: "partner" }] }, income: [{ id: "j", type: "salary", personId: "b", amount: 5000, period: "monthly" }], guide: { setup: { status: { a: "retired" } } } };
  const w = workRule(plan, people, { today: "2026-11-06" });
  // Ana (55) said "retired" with 65 on file (2036); Bo works to 70 (2038) with pay on Income: seventh pass (2026-11-06), this
  // year, his pay coming in as income until 2037 (it was Ana's own 2036, nothing drawn before)
  assert.equal(householdRetireYear(plan, people, 2026, w), 2026);
  assert.deepEqual(retireStarter(people, 2026, 2026, w), { id: "a", name: "Ana", age: 55, first: true, stopped: true, notWorking: false, working: [{ id: "b", name: "Bo", stopAge: 70, untilYear: 2037 }] });
  // Bo working by a Get started answer alone (no pay the plan can count): he holds the household at work until he stops, never
  // later than Ana's own 2036, as before
  const said = { ...plan, income: [], guide: { setup: { status: { a: "retired", b: "work" } } } };
  assert.equal(householdRetireYear(said, people, 2026, workRule(said, people, { today: "2026-11-06" })), 2036);
  assert.deepEqual(retireStarter(people, 2026, 2036, workRule(said, people, { today: "2026-11-06" })), { id: "a", name: "Ana", age: 65, first: true });
  // Bo stopping at 62 (2030), before Ana's own year: his stop starts it
  const early = people.map((p) => (p.id === "b" ? { ...p, retireAge: 62 } : p));
  assert.equal(householdRetireYear(said, early, 2026, workRule(said, early, { today: "2026-11-06" })), 2030);
  assert.deepEqual(retireStarter(early, 2026, 2030, workRule(said, early, { today: "2026-11-06" })), { id: "b", name: "Bo", age: 62, first: false });
  // Ana's own year already past (born 1958, 60 on file): this year, and it is hers
  const past = [{ ...people[0], birthYear: 1958, retireAge: 60 }, people[1]];
  assert.equal(householdRetireYear(plan, past, 2026, workRule(plan, past, { today: "2026-11-06" })), 2026);
  assert.equal(retireStarter(past, 2026, 2026, workRule(plan, past, { today: "2026-11-06" })).first, true);
});

test("review 2026-11-06: one work rule: a contribution at work is work; any other only when nobody else has pay (a spousal IRA)", async () => {
  const { workRule } = await import("./compute.js");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  // Lee with her salary taken out and her IRA saving kept, Sam working: Sam's pay can fund it, so Lee does not work
  const lee = rentLee({ id: "rent", name: "Rental condo", type: "rental", amount: 1500 });
  const I = buildInputs(lee, { today: H }).inputs, w = workRule(lee, I.people, { today: H });
  assert.equal(w.status(I.people[1]), "unknown"); assert.equal(w(I.people[1], 2030), false);
  // the same saving into a 401(k) (a plan at work), or with an employer match, is work
  const k = rentLee({ id: "rent", name: "Rental condo", type: "rental", amount: 1500 }); k.accounts.find((a) => a.id === "ira").type = "401k";
  assert.equal(workRule(k, I.people, { today: H })(I.people[1], 2030), true);
  const m = rentLee({ id: "rent", name: "Rental condo", type: "rental", amount: 1500 }); m.retirement.contributions.find((c) => c.personId === "lee").employerMatch = 1000;
  assert.equal(workRule(m, I.people, { today: H })(I.people[1], 2030), true);
  // the retired couple's Sam (69, 70 on file) with a Roth contribution and nobody's pay: his saving is work (Financial
  // independence's rule since 2026-11-05); a "retired" answer wins over it
  const s = retiredCouplePlan(); s.retirement.contributions.push({ id: "c", accountId: "a-roth", personId: "p-sam", amount: 500, period: "monthly", employerMatch: 0 });
  const Is = buildInputs(s, { today: H }).inputs, sam = Is.people.find((q) => q.id === "p-sam");
  assert.equal(workRule(s, Is.people, { today: H })(sam, 2026), true);
  s.guide = { ...(s.guide ?? {}), setup: { ...(s.guide?.setup ?? {}), status: { "p-sam": "retired" } } };
  assert.equal(workRule(s, Is.people, { today: H })(sam, 2026), false);
  // a "retired" answer wins over pay too, and that partner brings no "<name>'s pay" in (fifth pass)
  const r = retirementPlan(); r.guide = { setup: { status: { lee: "retired" } } };
  const Ir = buildInputs(r, { today: H }).inputs;
  assert.equal(workRule(r, Ir.people, { today: H })(Ir.people[1], 2030), false);
});

test("review 2026-11-06: support with no end date of someone who has stopped, or of the first adult, never counts from the household's retirement", async () => {
  // Ana "not working now" (the household retired in 2050, when Bo stopped; this year since the seventh pass, Bo's pay as income):
  // her help from parents with no end date stops with her work, which has stopped, so no year from the household's retirement
  // (before her own 65) is counted; it is named as not counted (why "work")
  const p = await fifth.anaNone(); p.income.push({ id: "h", name: "Help from parents", type: "support", personId: "p-ana", amount: 400, period: "monthly" });
  const b = buildInputs(p, { today: H });
  assert.equal(b.inputs.retireYear, 2050, "Ana at home at 36: Bo's stop (verify of the seventh pass)");
  assert.deepEqual(yearsOf(b.inputs, "Help from parents"), [], "was counted 2050-2054");
  assert.deepEqual(b.otherLeft.map((x) => [x.name, x.why]), [["Help from parents", "work"]]);
  // Bo's, who works to 62: his until he stops, as before (none after the household's 2050 either, his stop)
  const q = await fifth.anaNone(); q.income.push({ id: "h", name: "Help from parents", type: "support", personId: "p-bo", amount: 400, period: "monthly" });
  assert.deepEqual(buildInputs(q, { today: H }).otherLeft.map((x) => [x.name, x.why]), [["Help from parents", "work"]]);
});

test("review 2026-11-06: Medicare and the marketplace count the pay of whoever works that year by the one work rule", async () => {
  const { planIncome } = await import("../medicare/compute.js");
  // Lee said "retired" with her salary still on Income: before the household retires her pay is not in its income any more
  const r = retirementPlan(); r.guide = { setup: { status: { lee: "retired" } } };
  const pi = planIncome(r, { today: H }), pi0 = planIncome(retirementPlan(), { today: H });
  const at = (x, y) => x.partsOf(x.run.rows.find((row) => row.year === y)).agi;
  // her $66,000 less her $7,000 IRA saving (it went by age: under her 67, her pay was counted whatever she said)
  near(at(pi0, 2030) - at(pi, 2030), 66000 - 7000, 1);
});

// Review 2026-11-06 (sixth pass verify): the Medicare years left to a job's plan are said a run of years per worker, so the
// words never name a worker for a year they have stopped. Ana (1966, stops at 65 in 2031) and Bo (1963, works to 70 in 2033):
// Bo is 65 in 2028; 2028-2030 on Ana's job (both work; Ana is listed first), 2031-2032 on Bo's own job, Ana 65 too. The page
// read "In 2028 to 2032 Bo is 65 or over while Ana still works", Ana named for 2031 and 2032 after she stopped.
test("verify 2026-11-06: the Medicare years left to a job are worded per worker (onJobWords)", async () => {
  const { onJobWords } = await import("./compute.js");
  const p = emptyPlan();
  p.household.filingStatus = "married_joint";
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1966-02-10", retirementAge: 65 }, { id: "b", name: "Bo", role: "partner", birthDate: "1963-05-10", retirementAge: 70 });
  p.accounts.push({ id: "k", name: "401k", type: "401k", balance: 900000, ownerId: "a" }, { id: "s", name: "Savings", type: "savings", balance: 50000 });
  p.income.push({ id: "pa", name: "Ana's salary", type: "salary", personId: "a", amount: 80000, period: "annual", growth: 0.02 }, { id: "pb", name: "Bo's salary", type: "salary", personId: "b", amount: 60000, period: "annual", growth: 0.02 });
  p.expenses.push({ id: "e", name: "Everything", category: "other", amount: 6000, period: "monthly", essential: true, inflates: true });
  p.retirement.socialSecurity = { a: { claimAge: 67, monthlyAtFRA: 2400 }, b: { claimAge: 70, monthlyAtFRA: 2600 } };
  const d = compute(p, { today: "2026-11-06" });
  assert.equal(d.inputs.retireYear, 2031);
  // seventh pass (2026-11-06): Bo, who works himself in 2028-2032, is on his own job's plan (it named Ana's, listed first), and
  // Ana, 65 in 2031 after she stops, has her Medicare counted while Bo works (no tick on the Medicare page)
  const { spouseWords } = await import("./compute.js");
  const j = d.health.onJob;
  assert.deepEqual([j.fromYear, j.untilYear, j.years], [2028, 2032, 5], "the whole span, as before");
  assert.deepEqual(j.parts.map((x) => [x.fromYear, x.untilYear, x.worker, x.names.join("+")]), [[2028, 2032, "Bo", "Bo"]]);
  assert.deepEqual(onJobWords(j), ["In 2028 to 2032 Bo is 65 or over but still works: health insurance comes through the job, so Medicare those years is not added (the Medicare page counts them)."]);
  assert.deepEqual(spouseWords(d.health.spouseOnJob), ["In 2031 and 2032 Ana is 65 or over while Bo still works: Ana's Medicare is counted. If a plan through Bo's job covers Ana, check the box on the Medicare page."]);
  assert.ok(!onJobWords(j).join(" ").includes("while Ana"), "was: Ana's job named for Bo's own years");
  // the money: Bo's own Medicare is left to his job while he works; Ana's from 2031; both from 2033
  assert.deepEqual(d.inputs.events.filter((e) => e.label === "Health insurance").map((e) => e.year).slice(0, 2), [2031, 2032]);
  near(j.total, 5 * 12 * (202.9 + 38.99 + 194), 0.01); near(d.health.spouseOnJob.total, 2 * 12 * (202.9 + 38.99 + 194), 0.01);
  // with the tick, Ana's 2031-2032 are on Bo's job too, a sentence for each run of the same people
  const t = JSON.parse(JSON.stringify(p)); t.retirement.medicare = { jobCoversSpouse: true };
  const dt = compute(t, { today: "2026-11-06" });
  assert.deepEqual(dt.health.onJob.parts.map((x) => [x.fromYear, x.untilYear, x.worker, x.names.join("+")]), [[2028, 2030, "Bo", "Bo"], [2031, 2032, "Bo", "Bo+Ana"]]);
  assert.equal(onJobWords(dt.health.onJob)[1], "In 2031 and 2032 Ana is 65 or over while Bo still works: you said a plan through Bo's job covers Ana (Medicare page), so Medicare those years is not added (the Medicare page counts them).");
  assert.deepEqual(dt.inputs.events.filter((e) => e.label === "Health insurance").map((e) => e.year).slice(0, 2), [2033, 2034]);
  // one worker throughout keeps one sentence (the family: Bo's 2053-2054, counted, or with the tick on Ana's job)
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const fam = compute(familyPlan("2026-11-06"), { today: "2026-11-06" });
  assert.equal(fam.health.onJob, null);
  assert.deepEqual(spouseWords(fam.health.spouseOnJob), ["In 2053 and 2054 Bo is 65 or over while Ana still works: Bo's Medicare is counted. If a plan through Ana's job covers Bo, check the box on the Medicare page."]);
  const ft = familyPlan("2026-11-06"); ft.retirement.medicare = { jobCoversSpouse: true };
  assert.deepEqual(onJobWords(compute(ft, { today: "2026-11-06" }).health.onJob), ["In 2053 and 2054 Bo is 65 or over while Ana still works: you said a plan through Ana's job covers Bo (Medicare page), so Medicare those years is not added (the Medicare page counts them)."]);
});

// ---- review 2026-11-06, seventh pass (health-ver6 follow-ups 1-6, fire-ver8b): the years a pay line is paid, a husband's or
// wife's Medicare while the other works, retirement starting now when the first adult has stopped, and the words
const seventh = {
  T: "2026-11-06",
  // Rae (62, "not working now", 67 on file) and Jo (62, part-time $2,200 a month to 66), the health-ver6 example
  rae: () => {
    const p = emptyPlan();
    p.household.people.push({ id: "rae", name: "Rae", role: "self", birthDate: "1964-01-15", retirementAge: 67 }, { id: "jo", name: "Jo", role: "partner", birthDate: "1964-10-01", retirementAge: 66 });
    p.household.filingStatus = "married_joint"; p.guide = { setup: { status: { rae: "none", jo: "work" } } };
    p.accounts.push({ id: "ira", name: "Rae's IRA", type: "ira", balance: 380000, ownerId: "rae" }, { id: "brk", name: "Brokerage", type: "brokerage", balance: 70000 }, { id: "sav", name: "Savings", type: "savings", balance: 30000 });
    p.income.push({ id: "jo", name: "Jo's part-time job", type: "salary", personId: "jo", amount: 2200, period: "monthly", growth: 0.02, taxable: true });
    p.retirement.socialSecurity = { rae: { claimAge: 67, monthlyAtFRA: 2100 }, jo: { claimAge: 67, monthlyAtFRA: 1600 } };
    p.expenses.push({ id: "h", name: "Home costs", category: "housing", amount: 1700, period: "monthly", essential: true, inflates: true }, { id: "f", name: "Food", category: "groceries", amount: 800, period: "monthly", essential: true, inflates: true }, { id: "c", name: "Car and gas", category: "transport", amount: 450, period: "monthly", essential: true, inflates: true }, { id: "o", name: "Everything else", category: "other", amount: 1400, period: "monthly", essential: false, inflates: true });
    return p;
  },
  // Rae 66 retired on Social Security ($2,400 a month), Jo part-time to 66: Rae on Medicare while Jo works (health-ver6 follow-up 2)
  partTime: () => {
    const p = seventh.rae();
    p.household.people[0].birthDate = "1960-01-15"; p.household.people[0].retirementAge = 63; p.guide.setup.status.rae = "retired";
    p.income.push({ id: "ss", name: "Rae's Social Security", type: "social", personId: "rae", amount: 2400, period: "monthly", growth: 0.025, taxable: true });
    p.retirement.socialSecurity = { jo: { claimAge: 67, monthlyAtFRA: 1600 } };
    return p;
  },
};

test("seventh pass: payYears counts a pay line in the years it is paid for more than half of, this year when paid today", async () => {
  const { payYears } = await import("./compute.js");
  const T = seventh.T, line = (x) => ({ amount: 1000, period: "monthly", ...x });
  assert.deepEqual(payYears(line({}), T), { from: 2026, until: Infinity });
  // a job ending 2027-06-30 (181 of 365 days) counts to 2026; one ending 2027-07-03 (184 days) counts 2027 too
  assert.deepEqual(payYears(line({ endDate: "2027-06-30" }), T), { from: 2026, until: 2026 });
  assert.deepEqual(payYears(line({ endDate: "2027-07-03" }), T), { from: 2026, until: 2027 });
  // ending later this year while paid today: this year counts
  assert.deepEqual(payYears(line({ endDate: "2026-11-30" }), T), { from: 2026, until: 2026 });
  // a job starting 2027-01-01 counts from 2027; one starting 2027-09-01 from 2028; one starting next month, from 2027
  assert.deepEqual(payYears(line({ startDate: "2027-01-01" }), T), { from: 2027, until: Infinity });
  assert.deepEqual(payYears(line({ startDate: "2027-09-01" }), T), { from: 2028, until: Infinity });
  assert.deepEqual(payYears(line({ startDate: "2026-12-01" }), T), { from: 2027, until: Infinity });
  // ended, a one-off, no amount, or a stint shorter than half of any year: none
  assert.equal(payYears(line({ endDate: "2026-06-30" }), T), null); assert.equal(payYears(line({ period: "once" }), T), null);
  assert.equal(payYears(line({ amount: 0 }), T), null); assert.equal(payYears(line({ startDate: "2027-03-01", endDate: "2027-05-31" }), T), null);
  // a raise from a later date splits a line in two (cashflow/income splitRaise): the boundary year counts once
  const old = payYears(line({ endDate: "2027-02-28" }), T), next = payYears(line({ startDate: "2027-03-01", amount: 1100 }), T);
  assert.deepEqual([old, next], [{ from: 2026, until: 2026 }, { from: 2027, until: Infinity }]);
  // with no date given, every line is taken as paid now
  assert.deepEqual(payYears(line({}), null), { from: -Infinity, until: Infinity });
});

test("seventh pass: the work rule and a partner's pay use the pay line's dates (a job ending 2027-06-30 counted to 66; one starting 2027 as no work)", async () => {
  const { workRule } = await import("./compute.js");
  const T = seventh.T;
  const yrs = (p) => { const d = compute(p, { today: T }), W = workRule(p, d.inputs.people, { today: T, retireYear: d.inputs.retireYear }), jo = d.inputs.people[1]; return { d, works: [2026, 2027, 2028, 2029, 2030].filter((y) => W(jo, y)), pay: d.inputs.incomes.filter((x) => x.type === "pay").map((x) => [x.yearly, 1964 + x.startAge, 1964 + x.endAge]) }; };
  const all = yrs(seventh.rae());
  assert.deepEqual(all.works, [2026, 2027, 2028, 2029]); assert.deepEqual(all.pay, [[26400, 2026, 2029]]);
  // ending 2027-06-30: Jo works and is paid in 2026 only (was: to 2029, and Rae's 2029 Medicare left to the job)
  const ends = seventh.rae(); ends.income[0].endDate = "2027-06-30";
  const e = yrs(ends);
  assert.deepEqual(e.works, [2026]); assert.deepEqual(e.pay, [[26400, 2026, 2026]]);
  assert.equal(e.d.health.onJob, null); assert.equal(e.d.health.spouseOnJob, null);
  assert.deepEqual(e.d.health.bridge.parts.map((x) => [x.fromYear, x.untilYear, x.names.join("+")]), [[2027, 2028, "Rae+Jo"]], "both on the marketplace once the job ends (Jo, born 1964-10-01, is on Medicare from 2029)");
  // starting 2027-01-01: Jo works and is paid 2027-2029 (was: no work and no pay at all); 2026 on the marketplace
  const starts = seventh.rae(); starts.income[0].startDate = "2027-01-01";
  const s = yrs(starts);
  assert.deepEqual(s.works, [2027, 2028, 2029]); assert.deepEqual(s.pay, [[26400, 2027, 2029]]);
  assert.deepEqual(s.d.health.bridge.parts.map((x) => [x.fromYear, x.untilYear, x.names.join("+")]), [[2026, 2026, "Rae+Jo"]]);
  // Financial independence keeps the job that starts next year in its "you have stopped" answer: the projection's year
  const { incomeAnswer } = await import("../fire/compute.js");
  const w = incomeAnswer(starts, T);
  assert.equal(w.retired, true); assert.equal(w.failYear, s.d.shortYear);
  // Medicare's working-year income counts the pay of that year only: Jo alone, at work to 66, a raise from 2027-03-01 (a line
  // ending 2027-02-28 at $2,200 a month and one from 2027-03-01 at $2,500, as cashflow/income splitRaise writes it) is $26,400
  // in 2026 and $30,000 from 2027 (was $26,400 every year, the raise left out)
  const { planIncome } = await import("../medicare/compute.js");
  const one = seventh.rae(); one.household.people = [one.household.people[1]]; one.household.filingStatus = "single";
  one.guide = { setup: { status: { jo: "work" } } }; one.retirement.socialSecurity = { jo: one.retirement.socialSecurity.jo };
  one.income = [{ ...one.income[0], endDate: "2027-02-28" }, { ...one.income[0], id: "jo2", amount: 2500, startDate: "2027-03-01" }];
  const pi = planIncome(one, { today: T }), agi = (y) => Math.round(pi.partsOf(pi.run.rows.find((r) => r.year === y)).agi);
  assert.equal(pi.inputs.retireYear, 2030); assert.deepEqual([2026, 2027, 2028, 2029].map(agi), [26400, 30000, 30000, 30000]);
});

test("seventh pass: a first adult who has stopped with a partner on pay starts retirement now, the partner's pay as income (Rae: as with her age set to 62)", async () => {
  const T = seventh.T;
  const p = seventh.rae(), at62 = seventh.rae(); at62.household.people[0].retirementAge = 62;
  const d = compute(p, { today: T }), d62 = compute(at62, { today: T });
  // was: 2030 (min of Rae's own 2031 and Jo's stop), nothing drawn 2026-2029 and Jo's $26,400 taken to cover all $55,200 ("on
  // track"); with Rae's age set to 62 it started in 2026 ("tight"). Now both start in 2026, with the same figures
  assert.equal(d.inputs.retireYear, 2026); assert.equal(d62.inputs.retireYear, 2026);
  const fig = (x) => [x.verdict, x.shortYear ?? null, Math.round(x.affordable), Math.round(x.atEnd.totalReal), Math.round(x.health.total)];
  assert.deepEqual(fig(d), fig(d62));
  const r26 = d.rows.find((r) => r.year === 2026);
  assert.ok(r26.retired && r26.spending > 0 && r26.incomeLines.some((l) => l.name === "Jo's pay" && Math.abs(l.amount - 26400) < 1));
  // who starts it: Rae, not working, with Jo's pay coming in until 2029
  assert.deepEqual(d.retireBy, { id: "rae", name: "Rae", age: 62, first: true, stopped: true, notWorking: true, working: [{ id: "jo", name: "Jo", stopAge: 66, untilYear: 2029 }] });
  // Financial independence has nothing left to explain (it read "Your plan still has Rae working until 67 ... only in 2030")
  const { incomeAnswer } = await import("../fire/compute.js");
  assert.equal(incomeAnswer(p, T).plannedStop, null);
});

test("seventh pass: a spouse 65 or over is not taken as covered by the other's job: Medicare counted unless the Medicare page's tick says so", async () => {
  const { spouseWords, onJobWords } = await import("./compute.js");
  const { compute: medicare } = await import("../medicare/compute.js");
  const T = seventh.T, p = seventh.partTime();
  const d = compute(p, { today: T }), md = medicare(p, { today: T });
  // Rae (66) on Social Security, Jo part-time to 66 (2029): Rae's Medicare 2026-2029 was left to "Jo's job" ($11,612 before the
  // supplement); now counted, Jo's own 2029 still on his job
  assert.deepEqual(d.health.spouseOnJob.parts.map((x) => [x.fromYear, x.untilYear, x.worker, x.names.join("+")]), [[2026, 2029, "Jo", "Rae"]]);
  near(d.health.spouseOnJob.total, 4 * 12 * (202.9 + 38.99 + 194), 0.01);
  assert.deepEqual(d.health.onJob.parts.map((x) => [x.fromYear, x.untilYear, x.worker, x.names.join("+")]), [[2029, 2029, "Jo", "Jo"]]);
  assert.equal(d.health.medicare.fromYear, 2026);
  assert.deepEqual(spouseWords(d.health.spouseOnJob), ["In 2026 to 2029 Rae is 65 or over while Jo still works: Rae's Medicare is counted. If a plan through Jo's job covers Rae, check the box on the Medicare page."]);
  assert.deepEqual(md.spouseYears.map((y) => y.year), [2026, 2027, 2028, 2029]);
  // with the tick (retirement.medicare.jobCoversSpouse) her 2026-2029 are left to Jo's job, as before, and said so
  const t = seventh.partTime(); t.retirement.medicare = { jobCoversSpouse: true };
  const dt = compute(t, { today: T });
  assert.equal(dt.health.spouseOnJob, null); assert.equal(dt.health.medicare.fromYear, 2030);
  near(d.health.total - dt.health.total, d.health.spouseOnJob.total, 0.01);
  assert.match(onJobWords(dt.health.onJob)[0], /^In 2026 to 2028 Rae is 65 or over while Jo still works: you said a plan through Jo's job covers Rae \(Medicare page\)/);
  // a presumed worker (no pay, no answer) is said with the spouse's years, as onJobWords says it
  assert.deepEqual(spouseWords({ parts: [{ fromYear: 2053, untilYear: 2054, years: 2, names: ["Bo"], worker: "Ana", presumedUntil: 2055 }] }).slice(1), ["No pay is listed for Ana and Get started does not say Ana has stopped work, so the plan takes Ana as working until 2055."]);
});

test("seventh pass: Medicare in the health line holds the national Medigap Plan G average when no supplement is entered, and the words say what it leaves out", async () => {
  const { healthSummary } = await import("./compute.js");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const p = retiredCouplePlan(); p.expenses = p.expenses.filter((x) => x.id !== "e-med");
  const h = buildInputs(p, { today: seventh.T }).health;
  assert.equal(h.medicare.supplementMonthly, 194); assert.equal(h.medicare.supplementDefault, true);
  near(h.medicare.monthlyAll, 2 * (202.9 + 38.99 + 194), 0.01);
  const own = retiredCouplePlan(); own.expenses = own.expenses.filter((x) => x.id !== "e-med"); own.retirement.medicare = { supplementPremium: 0 };
  const h0 = buildInputs(own, { today: seventh.T }).health;
  assert.equal(h0.medicare.supplementMonthly, 0); assert.equal(h0.medicare.supplementDefault, false);
  // $2,328 a person-year over 51 person-years (Ruth 2026-2049, Sam 2026-2052, to the plan's end age)
  near(h.total - h0.total, 2328 * 51, 1);
  assert.equal(healthSummary(null, h.medicare), "Ruth and Sam: Medicare, about $870 a month for the two of you from 2026.");
  // married filing separately: the marketplace years say why there is no credit
  assert.equal(healthSummary({ parts: [{ names: ["Lou"], fromYear: 2026, untilYear: 2027, years: 2, monthlyLow: 1400, monthlyHigh: 1800, creditYears: 0, separate: true }] }, null), "Lou: about $1,400 to $1,800 a month, 2026 and 2027 (marketplace, no credit on separate returns).");
});

test("seventh pass (fire-ver8b): a business word leaves a name out of the household's own accounts only when the business is the source", async () => {
  const { ownAccountMoney } = await import("./compute.js");
  // the household's own accounts, which the plan already draws on (were counted on top of them)
  for (const n of ["Withdrawals from my brokerage firm account", "Draws from company stock account", "Savings account draws for the business", "Withdrawals from the investment firm"]) assert.equal(ownAccountMoney(n), true, n);
  // money from a business or against pay, as before
  for (const n of ["Owner's draw from business account", "Account manager bonus draws", "Draws against commissions account", "Partnership draws from capital account", "Draws from the firm", "Company account draws", "LLC distributions"]) assert.equal(ownAccountMoney(n), false, n);
  for (const n of ["Withdrawals from savings", "Brokerage account draws", "IRA withdrawals", "Business owner's 401(k) withdrawals", "Roth IRA withdrawals"]) assert.equal(ownAccountMoney(n), true, n);
});

// ---- verify 2026-11-06 (seventh pass): a job's 401(k) saving stops with the job, as its pay does
test("verify 2026-11-06: a contribution to a plan at work stops with its owner's last pay line when every one has an end date", () => {
  // Dee (60) said "retired", 66 on file; Sam (58) on salary to 2028-03-31 (65 on file, 2033), saving $400 a month in his 401(k)
  // with a $1,800 match. The patch stopped his pay at the end date (2027: more than half of 2028 unpaid) but the saving and the
  // match went on to 2032: $6,600 a year from a job that has ended, short in 2049 instead of 2046
  const p = emptyPlan();
  p.household.people.push({ id: "dee", name: "Dee", role: "self", birthDate: "1966-02-14", retirementAge: 66 }, { id: "sam", name: "Sam", role: "partner", birthDate: "1968-05-01", retirementAge: 65 });
  p.household.filingStatus = "married_joint"; p.guide = { setup: { status: { dee: "retired", sam: "work" } } };
  p.accounts.push({ id: "dira", name: "Dee's IRA", type: "ira", balance: 300000, ownerId: "dee" }, { id: "s401", name: "Sam's 401(k)", type: "401k", balance: 180000, ownerId: "sam" }, { id: "sav", name: "Savings", type: "savings", balance: 25000 });
  p.income.push({ id: "sj", name: "Sam's job", type: "salary", personId: "sam", amount: 5000, period: "monthly", growth: 0.02, taxable: true, endDate: "2028-03-31" });
  p.retirement.contributions.push({ id: "c1", accountId: "s401", personId: "sam", amount: 400, period: "monthly", employerMatch: 1800 });
  p.retirement.socialSecurity = { dee: { claimAge: 67, monthlyAtFRA: 1800 }, sam: { claimAge: 67, monthlyAtFRA: 2200 } };
  p.expenses.push({ id: "h", name: "Rent", category: "housing", amount: 4300, period: "monthly", essential: true, inflates: true });
  const T = "2026-11-06";
  const I = buildInputs(p, { today: T }).inputs;
  assert.deepEqual(I.contributions.map((c) => [c.name, c.yearly, c.untilYear]), [["Sam's 401(k)", 6600, 2027]]);
  const rows = project(I).rows, put = (y) => Math.round(rows.find((r) => r.year === y).contributions);
  assert.ok(put(2027) > 0); assert.equal(put(2028), 0);
  // with no end date it goes on to his retirement age, as before; an IRA saving (not a plan at work) is not cut either
  delete p.income[0].endDate;
  assert.equal(buildInputs(p, { today: T }).inputs.contributions[0].untilYear, undefined);
  p.income[0].endDate = "2028-03-31"; p.retirement.contributions = [{ id: "c2", accountId: "dira", personId: "sam", amount: 300, period: "monthly" }];
  assert.equal(buildInputs(p, { today: T }).inputs.contributions[0].untilYear, undefined);
});

test("verify of the seventh pass: a parent at home under 55 is a one-earner family, not retired: the partner's work holds the household at work", () => {
  const T = seventh.T;
  // Elena (35, "not working now", 65 on file) at home, Marcus (37) earning $90,000 to 62
  const p = emptyPlan();
  p.household.people.push({ id: "elena", name: "Elena", role: "self", birthDate: "1991-03-01", retirementAge: 65 }, { id: "marcus", name: "Marcus", role: "partner", birthDate: "1989-05-01", retirementAge: 62 });
  p.household.filingStatus = "married_joint"; p.guide = { setup: { status: { elena: "none", marcus: "work" } } };
  p.accounts.push({ id: "k", name: "Marcus's 401(k)", type: "401k", balance: 120000, ownerId: "marcus" }, { id: "sav", name: "Savings", type: "savings", balance: 20000 });
  p.income.push({ id: "m", name: "Marcus's pay", type: "salary", personId: "marcus", amount: 90000, period: "annual", growth: 0.02, taxable: true });
  p.expenses.push({ id: "h", name: "Home costs", category: "housing", amount: 2400, period: "monthly", essential: true, inflates: true }, { id: "o", name: "Everything else", category: "other", amount: 2200, period: "monthly", essential: false, inflates: true });
  const d = compute(p, { today: T });
  // was (seventh pass): 2026, the savings in the retired mix from 35 and the tax on Marcus's pay drawn from savings
  assert.equal(d.inputs.retireYear, 2051, "the earlier of Elena's own 2056 and Marcus stopping at 62 (2051)");
  assert.equal(d.retireBy.stopped, undefined);
  // 55 or over keeps the seventh pass: Rae (62) starts now
  assert.equal(compute(seventh.rae(), { today: T }).inputs.retireYear, 2026);
  // "retired" at any age is retired: Elena saying so starts retirement now, Marcus's pay as income
  const r = structuredClone(p); r.guide.setup.status.elena = "retired";
  assert.equal(compute(r, { today: T }).inputs.retireYear, 2026);
});

test("round 7 (2026-11-06): everyone past the plan's end age (a birth year typo) waits and says why; no page that runs the plan fails", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  // Ana alone, born 1900 (1926 typed for 1962 does the same): the run had no rows, and fourteen pages read its last row and
  // showed "This page failed to render" (this one, the Timeline, the reports, Chance the money lasts, ...)
  const old = familyPlan("2026-11-06"); old.household.people = old.household.people.filter((y) => y.id !== "p-bo"); old.household.people.find((y) => y.id === "p-ana").birthDate = "1900-01-01";
  const d = compute(old, { today: "2026-11-06" });
  assert.equal(d.ready, false);
  assert.deepEqual(d.noYears, { why: "Ana is 126, past the age the plan runs to (95)", check: "the birth date" });
  assert.ok(d.missing.includes("Ana is 126, past the age the plan runs to (95): check the birth date on the People page"), d.missing.join(" | "));
  for (const id of ["retirement/monte-carlo", "retirement/historical", "retirement/fire", "retirement/rmd", "retirement/buckets", "retirement/cash-flow", "scenarios/goal-seek", "overview/timeline", "overview/health-score", "overview/next-best-action", "career/human-capital", "reports/plan-summary", "reports/retirement", "reports/annual-review", "reports/export", "reports/tax", "taxes/projection"]) {
    const m = await import(`../../${id}/compute.js`);
    try { await m.compute(structuredClone(old), { today: "2026-11-06", paths: 100, quick: true }); } catch (e) { assert.fail(`${id}: ${e.message}`); }
  }
  // one of a couple past the end age: the other's years still run
  const one = familyPlan("2026-11-06"); one.household.people.find((y) => y.id === "p-bo").birthDate = "1900-01-01";
  assert.equal(compute(one, { today: "2026-11-06" }).ready, true);
  assert.equal(compute(familyPlan("2026-11-06"), { today: "2026-11-06" }).noYears ?? null, null);
});

// ---- review 2026-11-06, round 7: Get started names the first adult "Me" when no name is typed, and the partner "My spouse";
// the words say "you", "your" and "your spouse" with the verb to match, never "Me's Social Security" or "while Me still works"
test("Review 2026-11-06 (round 7): the unnamed first adult reads 'you' and 'your' in the income names and the health words", async () => {
  const { incomeWords, healthSummary, onJobWords, spouseWords, noYearsWhy, spousalName } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-06";
  const named = (partner, tick = false) => { const p = familyPlan(T); p.household.people[0].name = "Me"; p.household.people[1].name = partner; if (tick) p.retirement.medicare = { jobCoversSpouse: true }; return p; };
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  for (const [partner, them, theirs] of [["My spouse", "your spouse", "your spouse's"], ["Bo", "Bo", "Bo's"]]) {
    const d = compute(named(partner), { today: T });
    const ss = d.inputs.incomes.filter((x) => x.kind === "social").map((x) => x.name);
    assert.deepEqual(ss, ["your Social Security", `${theirs} Social Security`], "was: Me's Social Security, My spouse's Social Security");
    const words = incomeWords(d.inputs, money);
    assert.match(words[0], /^your Social Security: \$[\d,]+ a year from \d{4} \(age 67\)$/, "a line named for you still says your ages");
    assert.match(words[1], new RegExp(`^${theirs} Social Security: \\$[\\d,]+ a year from \\d{4} \\(age 67\\)$`));
    assert.deepEqual(spouseWords(d.health.spouseOnJob), [`In 2053 and 2054 ${them} is 65 or over while you still work: ${theirs} Medicare is counted. If a plan through your job covers ${them}, check the box on the Medicare page.`]);
    const label = partner === "Bo" ? "Bo" : "Your spouse";
    assert.match(healthSummary(d.health.bridge, d.health.medicare, { money }), new RegExp(`^${label}: Medicare, about \\$[\\d,]+ a month from 2053\\. You: Medicare from 2055 \\(about \\$[\\d,]+ a month for the two of you\\)`));
    assert.deepEqual(onJobWords(compute(named(partner, true), { today: T }).health.onJob), [`In 2053 and 2054 ${them} is 65 or over while you still work: you said a plan through your job covers ${them} (Medicare page), so Medicare those years is not added (the Medicare page counts them).`]);
    assert.ok(!JSON.stringify([words, d.health]).includes("Me's"), "no Me's anywhere in the words or the health line");
  }
  // you as the one 65 or over, or the one presumed at work: "you are", "you have"
  assert.deepEqual(spouseWords({ parts: [{ fromYear: 2053, untilYear: 2054, years: 2, names: ["Me"], worker: "My spouse", presumedUntil: 2055 }] }), ["In 2053 and 2054 you are 65 or over while your spouse still works: your Medicare is counted. If a plan through your spouse's job covers you, check the box on the Medicare page.", "No pay is listed for your spouse and Get started does not say your spouse has stopped work, so the plan takes your spouse as working until 2055."]);
  assert.deepEqual(onJobWords({ parts: [{ fromYear: 2053, untilYear: 2053, years: 1, names: ["Me"], worker: "Me", presumedUntil: 2054 }] }), ["In 2053 you are 65 or over but still work: health insurance comes through the job, so Medicare that year is not added (the Medicare page counts it).", "No pay is listed for you and Get started does not say you have stopped work, so the plan takes you as working until 2054."]);
  // why a plan has no years: "you are 126", "you retire at 70", "you and your spouse are both past"
  const ages = 'the retirement age and "Plan to age"';
  assert.deepEqual(noYearsWhy([{ name: "Me", birthYear: 1900, retireAge: 65, endAge: 95 }], 2026), { why: "you are 126, past the age the plan runs to (95)", check: "the birth date" });
  assert.deepEqual(noYearsWhy([{ name: "Me", birthYear: 1997, retireAge: 70, endAge: 60 }], 2026), { why: "the plan runs to 60, and you retire at 70", check: ages });
  assert.deepEqual(noYearsWhy([{ name: "Me", birthYear: 1900, retireAge: 65, endAge: 95 }, { name: "My spouse", birthYear: 1901, retireAge: 65, endAge: 95 }], 2026), { why: "you and your spouse are both past the age the plan runs to", check: "the birth dates" });
  // a spouse's top-up and a partner's pay, built at compute time
  assert.deepEqual(["Me", "My spouse", "Ana"].map(spousalName), ["your benefit as a spouse", "your spouse's benefit as a spouse", "Ana's spouse's benefit"]);
  const pt = await sixth.partTime(true); pt.household.people[0].name = "Me"; pt.household.people[1].name = "My spouse";
  const row = compute(pt, { today: H }).rows.find((r) => r.year === 2026);
  assert.ok(row.incomeLines.some((l) => l.name === "your spouse's pay" && Math.abs(l.amount - 18000) < 1), "was: My spouse's pay");
  assert.ok(row.incomeLines.some((l) => l.name === "your Social Security" && l.amount > 30000), "was: Me's Social Security");
});

// C3 (spec 7.F): Get started's retirement figure kept by our guesses' ledger (overview/setup:retireSpend, which settle works
// out again whenever what it reads changes) is used as saved; from 50 it is not today's bills, so it is not worked out again here
test("C3 a retirement figure in the guesses' ledger is used as saved; the same figure without a ledger entry follows today's bills as before", async () => {
  const { markGuess } = await import("../../../core/estimate/index.js");
  const p = await at62();
  p.guide = { ...(p.guide ?? {}), setup: { ...(p.guide?.setup ?? {}), retireAuto: true } };
  p.retirement.spendingMonthly = 4100;
  const live = buildInputs(p, { today: H });
  assert.notEqual(live.setupMonthly, 4100, "worked out from today's bills (setupFigure)");
  markGuess(p, "retirement.spendingMonthly", { key: "overview/setup:retireSpend", value: 4100, unit: "month", sigma: null, dataAsOf: "2026-11-02" }, H);
  const kept = buildInputs(p, { today: H });
  assert.equal(kept.setupMonthly, 4100); assert.equal(kept.health.fromSetup, live.health.fromSetup);
});

// path part 3: the first screen says things in plain words (the path walk's banned-word check, qa/flows/path-walk.js, runs it in the browser)
test("part 3: plain words on the first screen: no hard word in this page's view or compute strings", () => {
  const strip = (t) => t.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[^]*?\*\//g, "");
  const view = strip(fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8"));
  for (const w of ['Even in a bad run of years', "in today's dollars", 'What you save for retirement', 'pj-link']) assert.ok(view.includes(w), w);
  for (const w of ['9 of 10 markets', 'Contributions page', 'Assumptions page']) assert.ok(!view.includes(w), w);
});

// review fix (UX 3): no retirement savings on file is "not known yet", never "runs out"
test("part 3 review: savingsUnknown is true only with no investments, nothing added, retirement ahead and an income that does not carry the spending", async () => {
  const { savingsUnknown } = await import("./compute.js");
  const mk = (verdict, balances, contributions = [], atYear = 2060) => ({ ready: true, verdict, atRetirement: { year: atYear }, inputs: { startYear: 2026, balances: { cash: 9000, taxable: 0, deferred: 0, free: 0, ...balances }, contributions } });
  assert.equal(savingsUnknown(null), false);
  assert.equal(savingsUnknown({ ready: false }), false);
  assert.equal(savingsUnknown(mk("short", {})), true, "only cash: not retirement savings");
  assert.equal(savingsUnknown(mk("short", { deferred: 5000 })), false, "a retirement account on file");
  assert.equal(savingsUnknown(mk("short", {}, [{ yearly: 1 }])), false, "something is being added");
  assert.equal(savingsUnknown(mk("on track", {})), false, "income carries it: a real answer");
  assert.equal(savingsUnknown(mk("short", {}, [], 2026)), false, "already retired: runs out is the answer");
  const view = fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8");
  assert.ok(view.includes("We don't know yet") && view.includes("savingsUnknown(d)"));
});

// ---- round 8 batch 6: the condo's rent after its running costs, its loan counted once (landlord-5) ------------------------
const rentalOf = (b) => b.inputs.incomes.filter((x) => x.source === "rental").map((x) => [x.part, Math.round(x.yearly), x.cola, x.taxable, x.fromYear ?? null, x.untilYear ?? null]);
test("batch 6: the condo counts after its running costs from retirement (11,240 a year, rising with inflation), not 25,200 of gross rent", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  const p = condoOnNetWorthPlan(), b = buildInputs(p, { today: T });
  const rent = b.inputs.incomes.filter((x) => x.type === "rental");
  // no gross rent line any more: the Income page's 2,100 a month is the condo's rent
  assert.ok(!rent.some((x) => x.name === "Rent coming in"), rent.map((x) => x.name).join("; "));
  const run = rent.find((x) => x.part === "rent");
  assert.deepEqual([run.name, run.yearly, run.cola, run.startAge], ["Condo's rent after its running costs", 11240, true, 2045 - 1980]);
  // Get started's spending figure carries the condo's 851 (it is still being paid when work stops: 4,350 + 851 = 5,200), so the
  // payment comes back once the loan is paid off: 150,000 at 4.5% and 851 a month, 289 months from November 2026
  assert.equal(b.setupMonthly, 5200);
  const back = rent.find((x) => x.part === "loan back");
  assert.deepEqual([back.name, back.yearly, back.cola, back.fromYear, back.loanEnds], ["Condo's loan payment, back once the loan is paid off", 851 * 12, true, 2051, "2050-12"]);
  // the first retirement year: Alex's pay and the condo after its costs against the spending and health line
  const d = compute(p, { today: T });
  const row = d.rows.find((r) => r.year === 2045);
  near(row.income, 72000 * 1.03 ** 19 + 11240 * row.priceLevel, 1);
  assert.equal(Math.round(d.coverage * 100), 123, String(d.coverage));
  assert.ok(d.coverage < 1.27, "it was 128% with the gross rent");
  // the tile says the rent is after its costs (UX 7); a loan payment given back is not income of any kind
  assert.deepEqual(d.coverageFrom, ["a partner's pay", "rent after its running costs"]);
  // in words: one unit, the year with whose age it is (UX 7)
  const { incomeWords } = await import("./compute.js");
  const words = incomeWords(b.inputs);
  assert.ok(words.includes("Condo's rent after its running costs: $11,240 a year from 2045 (Sam is 65)"), words.join("; "));
  assert.ok(words.includes("Condo's loan ends in December 2050: the $851 a month for it in your spending is free again from 2051 ($10,212 a year)"), words.join("; "));
});

test("batch 6 review (money 4): a loan the spending does not hold comes off at its fixed payment until it is paid off, while the rent after costs rises with inflation", async () => {
  const { condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  const p = condoOnlyRentalPlan(), b = buildInputs(p, { today: T });
  // two lines: the rent after costs (rising), and the loan's 851 x 12 = 10,212 a year coming off (fixed, untaxed) to 2050. It
  // was one fixed line, 11,240 - 10,212 = 1,028, which did not rise with the rent
  assert.deepEqual(rentalOf(b), [["rent", 11240, true, true, null, null], ["loan", -10212, false, false, null, 2050]]);
  // the engine: 2045's condo lines are 11,240 x 1.03^19 - 10,212 = 19,709 - 10,212 = 9,497 (was 1,028); 2050's 22,849 - 10,212
  const d = compute(p, { today: T });
  const condo = (y) => d.rows.find((r) => r.year === y).incomeLines.filter((l) => /^Condo/.test(l.name)).reduce((t, l) => t + l.amount, 0);
  near(condo(2045), 11240 * 1.03 ** 19 - 10212, 1);
  near(condo(2050), 11240 * 1.03 ** 24 - 10212, 1);
  near(condo(2051), 11240 * 1.03 ** 25, 1);
  // first-year coverage 135% (was 126%)
  assert.equal(Math.round(d.coverage * 100), 135, String(d.coverage));
  const { incomeWords } = await import("./compute.js");
  assert.ok(incomeWords(b.inputs).includes("Condo's loan payments, $851 a month, come off from 2045 (Sam is 65) until the loan ends in December 2050"), incomeWords(b.inputs).join("; "));
  assert.equal(b.setupMonthly, 4350, "the loan is not among the bills");
});

test("batch 6 review (money 1): spending from Expenses holds the condo's loan only when a bill or Debts row in it does; a mortgage bill for the home alone does not", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  // the review's repro: no figure typed, so the spending is today's Expenses, and the home's mortgage is filed under housing
  // as "Mortgage payment" ($2,350): Expenses then drops both mortgages from Debts, so the condo's 851 is in no bill
  const p = condoOnNetWorthPlan();
  p.retirement.spendingMonthly = 0; p.guide.retireAuto = false;
  p.expenses.push({ id: "x-mort", name: "Mortgage payment", category: "housing", essential: true, period: "monthly", inflates: false, startDate: "", endDate: "", amount: 2350 });
  const b = buildInputs(p, { today: T });
  assert.equal(b.spendingSource, "expenses");
  // no "back once paid off" (it gave 21,382 in 2051, rising for life): the loan comes off until December 2050
  assert.deepEqual(rentalOf(b), [["rent", 11240, true, true, null, null], ["loan", -10212, false, false, null, 2050]]);
  // the same plan with no housing bill: Expenses counts the condo's 851 from Debts, so it comes back after the payoff
  const q = condoOnNetWorthPlan();
  q.retirement.spendingMonthly = 0; q.guide.retireAuto = false;
  assert.deepEqual(rentalOf(buildInputs(q, { today: T })), [["rent", 11240, true, true, null, null], ["loan back", 10212, true, false, 2051, null]]);
  // a typed figure holds no loan: it comes off
  const t = condoOnNetWorthPlan(); t.guide.setup.retireAuto = false;
  assert.deepEqual(rentalOf(buildInputs(t, { today: T })).map((x) => x[0]), ["rent", "loan"]);
});

test("batch 6 review (money 2 and 3): the payment that comes back is what the spending holds (the minimum, not the extra), and it is not taxed", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  const p = condoOnNetWorthPlan();
  p.debts.find((d) => d.accountId === "condo-loan").extra = 300;
  const b = buildInputs(p, { today: T });
  // Get started's figure holds the minimum, 851 (still 5,200): at 1,151 a month the loan is paid off in 2041, before
  // retirement, so the 851 comes back from 2045 at 10,212 a year (it was 13,812: the payment with its extra)
  assert.equal(b.setupMonthly, 5200);
  assert.deepEqual(rentalOf(b), [["rent", 11240, true, true, null, null], ["loan back", 10212, true, false, 2045, null]]);
  const d = compute(p, { today: T });
  assert.equal(Math.round(d.coverage * 100), 138, String(d.coverage));
  assert.deepEqual(d.coverageFrom, ["a partner's pay", "rent after its running costs"], "the loan given back in 2045 is not named as income");
  // on the brackets, the 2051 tax is the run's with that line out of the taxed income (it was taxed as income: 5,097 against 243)
  const q = condoOnNetWorthPlan(); q.retirement.taxMode = "brackets";
  const r = compute(q, { today: T }), I = r.inputs;
  const row = r.rows.find((x) => x.year === 2051), lineOf = row.incomeLines.find((l) => /back once/.test(l.name));
  assert.ok(lineOf && lineOf.amount > 20000, "the line is paid in 2051");
  assert.equal(I.incomes.find((x) => x.part === "loan back").taxable, false);
  // the review's figures: 2051 tax $243 untaxed, $5,097 when the line was taxed
  const taxed = project({ ...I, incomes: I.incomes.map((x) => (x.part === "loan back" ? { ...x, taxable: true } : x)) });
  near(row.taxes, 243, 1);
  near(taxed.rows.find((x) => x.year === 2051).taxes, 5097, 1);
});

test("batch 6 review (money 5): a rental whose running costs are more than its rent still gives its loan back, and its shortfall is paid", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  const p = condoOnNetWorthPlan();
  // rent 1,100: 13,200 less 5% empty months (660) less 12,700 of costs = -160 a year
  p.property[0].rentMonthly = 1100; p.income.find((x) => x.type === "rental").amount = 1100;
  const b = buildInputs(p, { today: T });
  assert.deepEqual(rentalOf(b), [["short", -160, true, false, null, null], ["loan back", 10212, true, false, 2051, null]]);
  const { incomeWords } = await import("./compute.js");
  assert.ok(incomeWords(b.inputs).includes("Condo costs $160 a year more to run than its rent brings in, paid from savings from 2045 (Sam is 65)"), incomeWords(b.inputs).join("; "));
});

test("batch 6 review: a rental sold before its loan is paid off ends the loan with the sale; a loan paid off before retirement is not taken off", async () => {
  const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  // the rent line ends in June 2047 (sold): the rent counts to 2047, and the spending's 851 is free again from 2048
  const p = condoOnNetWorthPlan(); p.income.find((x) => x.type === "rental").endDate = "2047-06-30";
  assert.deepEqual(rentalOf(buildInputs(p, { today: T })), [["rent", 11240, true, true, null, 2047], ["loan back", 10212, true, false, 2048, null]]);
  // not held in the spending: the payments come off only to the sale
  const q = condoOnlyRentalPlan(); q.income.find((x) => x.type === "rental").endDate = "2047-06-30";
  const bq = buildInputs(q, { today: T });
  assert.deepEqual(rentalOf(bq), [["rent", 11240, true, true, null, 2047], ["loan", -10212, false, false, null, 2047]]);
  const { incomeWords } = await import("./compute.js");
  assert.ok(incomeWords(bq.inputs).includes("Condo's loan payments, $851 a month, come off from 2045 (Sam is 65) until it is sold in 2047"), incomeWords(bq.inputs).join("; "));
  // a loan of 20,000 paid off in about two years: nothing comes off in retirement
  const r = condoOnlyRentalPlan(); r.property[0].loanBalance = 20000;
  assert.deepEqual(rentalOf(buildInputs(r, { today: T })), [["rent", 11240, true, true, null, null]]);
});

test("batch 6: rent for a place not on Rental analysis is counted as before, at its gross, 'before its costs'", () => {
  const p = rentLee({ id: "rent", name: "Rental condo", type: "rental", amount: 1500, growth: 0.02 });
  const I = buildInputs(p, { today: H }).inputs;
  const r = I.incomes.find((x) => x.name === "Rental condo");
  assert.equal(r.yearly, 18000); assert.equal(r.cola, true); assert.equal(r.afterCosts, undefined);
});
