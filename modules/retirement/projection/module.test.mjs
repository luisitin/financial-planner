import { test } from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(bills.status, "done"); assert.equal(bills.title, "Spend within what the plan can carry");
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
  assert.equal(figures(p).verdict, "short"); assert.equal(figures(p).shortYear, 2059);
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
