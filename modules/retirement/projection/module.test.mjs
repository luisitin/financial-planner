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
  // with health cover in the spending figure (the box ticked) the recheck's figures; with the health line its $640 a month of
  // "Health premiums" gives way to Medicare for both from 2030 ($5,805 a year), so the plan carries more (review 2026-11-06)
  const inc = JSON.parse(JSON.stringify(p)); inc.retirement = { ...(inc.retirement ?? {}), healthIncluded: true };
  assert.equal(figures(inc).verdict, "short"); assert.equal(figures(inc).shortYear, 2059); assert.equal(figures(inc).carries, 59612);
  assert.deepEqual([figures(p).verdict, figures(p).carries], ["tight", 53936], "was short in 2059 with no health line");
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
  assert.ok(ev.every((e) => e.label === "Health cover" && e.spending === true), "marked as spending: guaranteed income pays it first");
  assert.equal(ev[0].year, 2052, "nothing while Ana still works: Bo joins her plan at work in 2050 and 2051");
  assert.deepEqual(hc.onWorkPlan.map((y) => y.year), [2050, 2051]);
  const cost = (y) => hc.years.find((x) => x.year === y)?.cost ?? 0, med = (y) => md.years.find((x) => x.year === y)?.totalYearly ?? 0;
  // 2052: both on the marketplace (Ana 62, Bo 64); 2053-2054: Ana on it, Bo on Medicare at 65; 2055 on: both on Medicare
  near(ev.find((e) => e.year === 2052).amount, cost(2052), 0.01); assert.equal(med(2052), 0);
  near(ev.find((e) => e.year === 2053).amount, cost(2053) + med(2053), 0.01);
  near(ev.find((e) => e.year === 2054).amount, cost(2054) + med(2054), 0.01);
  near(ev.find((e) => e.year === 2055).amount, med(2055), 0.01); assert.equal(cost(2055), 0);
  assert.equal(ev.length, b.inputs.endYear - 2052 + 1, "one event a year from 2052 to the end");
  near(med(2053), 12 * (202.9 + md.partD), 0.01);   // Bo alone, standard Part B and the base drug plan, no surcharge
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
  assert.equal(b.health.medicare.fromYear, 2055);
  assert.equal(healthOf(b.inputs)[0].year, 2055);
  // the two years left out are named, with who works and the amount the Medicare page counts for them
  const md = medicare(familyPlan(H), { today: H });
  assert.deepEqual([b.health.onJob.fromYear, b.health.onJob.untilYear, b.health.onJob.names, b.health.onJob.worker], [2053, 2054, ["Bo"], "Ana"]);
  near(b.health.medicare.total + b.health.onJob.total, md.lifetime, 0.01, "the Medicare page's lifetime is the added years plus the job's years");
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
  near(ev(2055), 2 * 12 * (202.9 + 38.99), 0.01);
  assert.deepEqual([b.health.jobPlan.fromYear, b.health.jobPlan.untilYear, b.health.jobPlan.worker], [2050, 2054, "Bo"]);
  // so the years someone still works carry today's whole spending, premium included: 69,916 + 7,200 = 77,116
  const d = compute(p, { today: H });
  const row = d.rows.find((r) => r.year === 2051);
  near((row.spending + row.eventSpending) / row.priceLevel, (b.spendingYearly + 7200), 0.01);
  near(b.spendingYearly + 7200, 77116, 1);
});

test("health line: 'my spending figure already includes health cover' adds nothing, and the verdict moves the right way", async () => {
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

test("health line: Get started's Insurance and health row is not health cover; for a retired couple over 65 it pays their Medicare", async () => {
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

test("health line: which Expenses lines are health cover", async () => {
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
  near(b.health.medicare.total, md.lifetime, 0.01, "every Medicare year of the Medicare page"); near(b.health.medicare.total, 220160.16, 0.05);
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
  assert.deepEqual([r.health.onJob.fromYear, r.health.onJob.untilYear], [2033, 2036], "the fixture as before: 2033-2036 on Lee's job");
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
  near(b.health.medicare.total, 174160.8, 0.05);
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
  assert.equal(b.health.medicare.fromYear, 2033); near(b.health.medicare.total, md.lifetime, 0.01); near(b.health.medicare.total, 295353, 1);
  assert.equal(b.health.medicare.surchargeYears, 21);
  assert.deepEqual(hc.years.map((y) => y.year), [2033, 2034]); near(hc.years[0].cost, 588, 1); near(hc.years[1].cost, 4227, 1);
  near(b.health.bridge.total, hc.total, 0.01); near(b.health.total, 300168, 1);
  assert.equal(hc.noBridge, false, "was: \"no one needs marketplace cover: everyone works until 65\"");
  // $400 a month of dividends, other income and a pension owned by Lee: the same
  for (const line of [{ id: "div", name: "Dividends", type: "investment", amount: 400 }, { id: "oth", name: "Royalties", type: "other", amount: 400 }, { id: "pen", name: "Lee's small pension", type: "pension", amount: 400 }]) {
    const q = rentLee(line), bq = buildInputs(q, { today: H });
    assert.equal(workRule(q, bq.inputs.people, { today: H })(bq.inputs.people[1], 2034), false, line.type);
    assert.equal(bq.health.onJob, null, line.type); assert.equal(bq.health.medicare.fromYear, 2033, line.type);
  }
  // Lee's salary back: she works to 67 and 2033-2036 are on her job's plan, as before
  const r = buildInputs(retirementPlan(), { today: H });
  assert.deepEqual([r.health.onJob.fromYear, r.health.onJob.untilYear], [2033, 2036]);
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
  // fifth pass: the household retires when Bo, the one who works, stops (was 2055, Ana's 65th, with 2050-2054 at income $0)
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

test("fourth pass: Retirement settings' box shows the figure the plan counts before health cover, and a lower figure typed lowers spending", async () => {
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
  near(family.total, 174161, 1); assert.equal(family.onJob.presumedUntil, null, "Ana's salary: nothing presumed");
  const noIncome = familyPlan(H); noIncome.income = []; noIncome.retirement.contributions = [];
  // with their saving kept, Ana's 401(k) at work and Bo's Roth (nobody has pay) are work: the same health line, nothing presumed
  const saving = familyPlan(H); saving.income = [];
  const bs = buildInputs(saving, { today: H }).health;
  near(bs.total, family.total, 0.01); assert.equal(bs.onJob.presumedUntil, null);
  for (const p of [await fifth.childJob(), noIncome]) {
    const b = buildInputs(p, { today: H }), hc = healthcare(p, { today: H });
    // was: $231,756, Bo's marketplace 2050-2052 at an income of $0 ("under the poverty line") and nothing for Ana, who has no job either
    near(b.health.total, family.total, 0.01); assert.equal(b.health.bridge, null);
    assert.deepEqual([b.health.onJob.fromYear, b.health.onJob.untilYear, b.health.onJob.worker], [2053, 2054, "Ana"], "Bo's Medicare left to Ana's plan, as with her salary");
    assert.equal(b.health.onJob.presumedUntil, 2055, "the page says the plan takes Ana as working until 2055");
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
  near(b.health.total, medicare(p, { today: H }).lifetime, 0.01); near(b.health.total, 115275, 1);
});

test("fifth pass: someone not working does not hold the household at work: retirement starts when the last working adult stops, or now", async () => {
  const { compute: healthcare } = await import("../healthcare/compute.js");
  const { householdRetireYear, workRule } = await import("./compute.js");
  const p = await fifth.anaNone();
  const d = compute(p, { today: H }), hc = healthcare(p, { today: H });
  // was 2055 (Ana's 65th): 2050-2054 had no spending and no withdrawals, the marketplace priced on an income of $0
  assert.equal(d.inputs.retireYear, 2050); assert.deepEqual(d.retireBy, { id: "p-bo", name: "Bo", age: 62, first: false });
  for (const y of hc.years) assert.ok(d.rows.find((r) => r.year === y.year).spending > 0, `${y.year}: priced in a year with living costs`);
  assert.deepEqual(hc.years.slice(0, 4).map((y) => y.magi > 0), [true, true, true, true], "2050-2053 on the plan's own withdrawals");
  near(d.health.total, 272417, 1); assert.equal(d.verdict, "short");
  // the first year with income $0 is 2054, when the plan lives on Roth money (no taxable income): a real one, with spending
  assert.deepEqual(d.health.bridge.underLine, [2054]);
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
  assert.ok(words.includes("Rental condo: $18,000 a year from 2033 (before its costs)"), words.join("; "));
  assert.ok(!words.some((w) => /Lee's pay/.test(w)), "was: Lee's pay: $18,000 a year from 56");
  assert.ok(words.includes("Lee's Social Security: $25,200 a year from 67"));
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
  assert.equal(await say(fifth.c6863()), "Bo: about $300 to $630 a month, 2026 and 2027 (marketplace, after the credit). Bo: Medicare, about $240 a month from 2028.");
  assert.equal(await say(at62()), "Ana and Bo: about $400 a month, 2052 (marketplace, after the credit). Ana: about $1,440 a month, 2053 and 2054 (marketplace, no credit). Bo: Medicare, about $240 a month from 2053. Ana: Medicare from 2055 (about $480 a month for the two of you).");
  const lee = await say(rentLee({ id: "rent", name: "Rental condo", type: "rental", amount: 1500, growth: 0.02 }));
  assert.ok(lee.startsWith("Lee: about $50 to $350 a month, 2033 and 2034 (marketplace, after the credit). Sam: Medicare, about $240 a month from 2033. Lee: Medicare from 2035"), lee);
  assert.ok(lee.endsWith("including an income surcharge in 21 of those years (Medicare page)."), lee);
  for (const s of [await say(fifth.c6863()), await say(at62()), lee, await say(fifth.anaNone())]) assert.ok(!/\bthen\b/.test(s), s);
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  assert.equal(await say(familyPlan(H)), "Ana and Bo: Medicare, about $480 a month for the two of you from 2055.");
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
  assert.deepEqual(a.retireBy, { id: "p-ana", name: "Ana", age: 68, first: true }, "the year is her own (this year), so she is named");
  // the two plans give one answer: "Runs out in 2041 (age 83)", carries $68,896 (was "Runs out in 2054", $71,564 with the answer)
  const fig = (d) => [d.verdict, d.shortYear, d.shortAge, Math.round(d.affordable), Math.round(d.health.total)];
  assert.deepEqual(fig(a), fig(b)); assert.deepEqual(fig(a).slice(0, 4), ["short", 2041, 83, 68896]);
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
  // the fifth pass's own cases hold: Ana "not working now" at 40 keeps Bo's 2050 (her own year is 2055), nobody working is now
  assert.equal(buildInputs(await fifth.anaNone(), { today: H }).inputs.retireYear, 2050);
  assert.equal(buildInputs(await sixth.noPay(true), { today: H }).inputs.retireYear, 2026);
});

test("review 2026-11-06: householdRetireYear is capped at the first adult's own year, and retireStarter names who starts it", async () => {
  const { householdRetireYear, workRule, retireStarter } = await import("./compute.js");
  const people = [{ id: "a", name: "Ana", birthYear: 1971, retireAge: 65, endAge: 95 }, { id: "b", name: "Bo", birthYear: 1968, retireAge: 70, endAge: 95 }];
  const plan = { household: { people: [{ id: "a", role: "self" }, { id: "b", role: "partner" }] }, income: [{ id: "j", type: "salary", personId: "b", amount: 5000, period: "monthly" }], guide: { setup: { status: { a: "retired" } } } };
  const w = workRule(plan, people, { today: "2026-11-06" });
  // Ana (55) said "retired" with 65 on file (2036); Bo works to 70 (2038): the household's year is Ana's own 2036, not Bo's 2038
  assert.equal(householdRetireYear(plan, people, 2026, w), 2036);
  assert.deepEqual(retireStarter(people, 2026, 2036, w), { id: "a", name: "Ana", age: 65, first: true });
  // Bo stopping at 62 (2030), before Ana's own year: his stop starts it
  const early = people.map((p) => (p.id === "b" ? { ...p, retireAge: 62 } : p));
  assert.equal(householdRetireYear(plan, early, 2026, workRule(plan, early, { today: "2026-11-06" })), 2030);
  assert.deepEqual(retireStarter(early, 2026, 2030, workRule(plan, early, { today: "2026-11-06" })), { id: "b", name: "Bo", age: 62, first: false });
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
  // Ana "not working now" (the household retires in 2050, when Bo stops): her help from parents with no end date stops with her
  // work, which has stopped, so 2050-2054 (before her own 65) are not counted; it is named as not counted (why "work")
  const p = await fifth.anaNone(); p.income.push({ id: "h", name: "Help from parents", type: "support", personId: "p-ana", amount: 400, period: "monthly" });
  const b = buildInputs(p, { today: H });
  assert.equal(b.inputs.retireYear, 2050);
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
  const j = d.health.onJob;
  assert.deepEqual([j.fromYear, j.untilYear, j.years], [2028, 2032, 5], "the whole span, as before");
  assert.deepEqual(j.parts.map((x) => [x.fromYear, x.untilYear, x.worker, x.names.join("+")]), [[2028, 2030, "Ana", "Bo"], [2031, 2032, "Bo", "Ana+Bo"]]);
  const words = onJobWords(j);
  assert.equal(words[0], "In 2028 to 2030 Bo is 65 or over while Ana still works: a plan through Ana's job can cover Bo, so Medicare those years is not added (the Medicare page counts them).");
  assert.equal(words[1], "In 2031 and 2032 Ana is 65 or over while Bo still works: a plan through Bo's job can cover Ana and Bo, so Medicare those years is not added (the Medicare page counts them).");
  assert.ok(!words.join(" ").includes("2032 Bo is 65 or over while Ana"), "was: one sentence naming Ana's job to 2032");
  // the money is unchanged: no Medicare while either works, both from 2033
  assert.deepEqual(d.inputs.events.filter((e) => e.label === "Health cover").map((e) => e.year).slice(0, 2), [2033, 2034]);
  near(j.total, 20318.76, 0.01);
  // one worker throughout keeps one sentence, as before (the family: Bo's 2053-2054 on Ana's job)
  const fam = compute((await import("../../../qa/fixtures/family-plan.mjs")).familyPlan("2026-11-06"), { today: "2026-11-06" });
  assert.deepEqual(onJobWords(fam.health.onJob), ["In 2053 and 2054 Bo is 65 or over while Ana still works: a plan through Ana's job can cover Bo, so Medicare those years is not added (the Medicare page counts them)."]);
});
