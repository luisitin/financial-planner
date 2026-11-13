import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, ageFactor, povertyLine, expectedShare, credit, countedAges } from "./compute.js";
import { FPL, BENCHMARK_40 } from "./data/aca.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("the age curve, the poverty line, the expected share and the cliff", () => {
  // the federal default standard age curve, one factor for each age (CMS, December 16, 2016, Appendix I)
  assert.equal(ageFactor(21), 1); assert.equal(ageFactor(40), 1.278); assert.equal(ageFactor(64), 3); assert.equal(ageFactor(70), 3);
  assert.equal(ageFactor(62), 2.873); assert.equal(ageFactor(45), 1.444); assert.equal(ageFactor(34), 1.214); assert.equal(ageFactor(45.9), 1.444);
  assert.equal(ageFactor(5), 0.765); assert.equal(ageFactor(14), 0.765); assert.equal(ageFactor(15), 0.833);
  // coverage in 2026 uses the 2025 guidelines (the default); 2027 the 2026 ones; later years hold the newest
  assert.equal(povertyLine(1), FPL.base); assert.equal(povertyLine(2), 21150); assert.equal(povertyLine(4), 32150);
  assert.equal(povertyLine(2, 2027), 21640); assert.equal(povertyLine(1, 2040), 15960); assert.equal(povertyLine(1, 2020), 15650);
  // straight-line in its band, rounded to the nearest one-hundredth of one percent (26 CFR 1.36B-3(g)(1))
  assert.equal(expectedShare(1.2), 0.021); assert.equal(expectedShare(1.75), 0.054); assert.equal(expectedShare(3.5), 0.0996);
  assert.equal(expectedShare(1.75, "law", 2027), 0.0554); assert.equal(expectedShare(1.2, "law", 2027), 0.0215);
  assert.equal(expectedShare(1.33), 0.0314, "exactly 133%: at least 133% is the upper band (Rev. Proc. 2025-25)");
  assert.equal(expectedShare(4), 0.0996, "exactly 400% still has a credit"); assert.equal(expectedShare(4.01), null, "over the cliff, no credit");
  assert.equal(expectedShare(0.99), null, "under 100% of the poverty line: no credit (36B(c)(1)(A))"); assert.equal(expectedShare(0.99, "enhanced"), null);
  assert.equal(expectedShare(4.01, "enhanced"), 0.085); assert.equal(expectedShare(1.4, "enhanced"), 0);
  // a family's premium counts only the three oldest children under 21 (45 CFR 147.102(c)(1))
  assert.deepEqual(countedAges([45, 43, 17, 15, 12, 9, 22]), [45, 43, 22, 17, 15, 12]);
});

test("the credit: the benchmark less the expected contribution, never below zero; nothing over the cliff", () => {
  const c = credit({ magi: 60000, size: 2, benchmarkYearly: 30000 });
  near(c.multiple, 60000 / 21150); near(c.credit, 30000 - c.share * 60000); near(c.cost, c.share * 60000);
  const over = credit({ magi: 4.01 * 21150, size: 2, benchmarkYearly: 30000 });
  assert.equal(over.credit, 0); assert.equal(over.cost, 30000);
  assert.equal(credit({ magi: 200000, size: 2, benchmarkYearly: 5000, rules: "enhanced" }).credit, 0, "the benchmark is under 8.5% of income");
});

test("the family as planned: no marketplace years (Ana's job covers Bo's gap)", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.noBridge, true); assert.deepEqual(d.onWorkPlan.map((y) => y.year), [2050, 2051, 2052]);
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("both retiring at 58: the marketplace years, the national benchmark by age, over the cliff, and the larger credits", () => {
  const p = familyPlan(TODAY); for (const q of p.household.people) if (q.role !== "dependent") q.retirementAge = 58;
  const d = compute(p, { today: TODAY });
  assert.equal(d.years[0].year, 2048); assert.deepEqual(d.years[0].covered, ["Ana", "Bo"]);
  near(d.years[0].benchmark, 12 * BENCHMARK_40 / ageFactor(40) * (ageFactor(58) + ageFactor(60)));
  assert.equal(d.size, 2); assert.equal(d.cliffIncome, 4 * povertyLine(2, 2027), "2048 holds the newest figures (2027 coverage)");
  const over = d.years.filter((y) => y.overCliff > 0);
  assert.ok(over.length > 0); for (const y of over) { assert.equal(y.credit, 0); assert.ok(y.lostCredit > 0); }
  near(d.total, d.years.reduce((s, y) => s + y.cost, 0));
  p.retirement.aca = { rules: "enhanced", benchmarkMonthly: 2000 };
  const e = compute(p, { today: TODAY });
  assert.ok(e.total < d.total); assert.equal(e.cliffYears, 0); assert.equal(e.cliffIncome, null);
  near(e.years[0].benchmark, 12 * 2000 / (ageFactor(36) / ageFactor(40) + ageFactor(38) / ageFactor(40)) / ageFactor(40) * (ageFactor(58) + ageFactor(60)), 1e-6);
});

test("review 2026-11-02: someone with no pay does not work: covered through the partner's job while it lasts, then on the marketplace", () => {
  // Bo has no pay (Get started: not working now) and is under his retirement age; Ana works to 65 (2055)
  const p = familyPlan(TODAY);
  p.income = p.income.filter((x) => x.personId !== "p-bo"); p.retirement.contributions = p.retirement.contributions.filter((c) => c.personId !== "p-bo");
  p.guide = { setup: { status: { "p-ana": "work", "p-bo": "none" } } };
  const d = compute(p, { today: TODAY });
  // was: no year at all for Bo (the age alone said he worked until 62, then Ana's job covered 2050-2052)
  assert.deepEqual([d.onWorkPlan[0].year, d.onWorkPlan.at(-1).year], [2026, 2052]); assert.deepEqual(d.onWorkPlan[0].covered, ["Bo"]); assert.equal(d.onWorkPlan[0].worker, "Ana");
  assert.equal(d.noBridge, true, "Bo is 65 in 2053, while Ana still works");
  // Ana stopping at 58 (2048): Bo, 60, has no job to join, so 2048 on are marketplace years for both
  p.household.people.find((x) => x.id === "p-ana").retirementAge = 58;
  const e = compute(p, { today: TODAY });
  assert.equal(e.onWorkPlan.at(-1).year, 2047); assert.deepEqual(e.years.map((y) => y.year).slice(0, 2), [2048, 2049]); assert.deepEqual(e.years[0].covered.slice(0, 2), ["Ana", "Bo"]);
  // with his pay back, Bo works to 62 (2050) and the household joins his plan in 2048 and 2049
  const q = familyPlan(TODAY); q.household.people.find((x) => x.id === "p-ana").retirementAge = 58;
  assert.deepEqual(compute(q, { today: TODAY }).onWorkPlan.map((y) => y.year), [2048, 2049]);
});

test("fourth pass: the years are the projection's: a work answer is a job, no pay and nothing said waits for the household's retirement", async () => {
  // no Income lines and Get started saying both work: no marketplace years before the household retires (was 2026-2054 at $0)
  const p = familyPlan(TODAY); p.income = []; p.guide = { setup: { status: { "p-ana": "work", "p-bo": "work" } } };
  const d = compute(p, { today: TODAY });
  assert.equal(d.noBridge, true); assert.deepEqual(d.onWorkPlan.map((y) => y.year), [2050, 2051, 2052]);
  // Lee with no pay and nothing said: not on the marketplace before the household retires (2033), then until 65
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const l = retirementPlan(); l.income = l.income.filter((x) => x.personId !== "lee"); l.retirement.contributions = [];
  const e = compute(l, { today: TODAY });
  assert.deepEqual(e.years.map((y) => y.year), [2033, 2034]); assert.deepEqual(e.onWorkPlan, [], "was: 2026-2032 on Sam's plan");
  // a rental is not a job: Lee is on the marketplace from 2033 (was: no year, "everyone works until 65")
  const r = retirementPlan(); r.income = r.income.filter((x) => x.personId !== "lee").concat({ id: "rent", name: "Rental condo", type: "rental", personId: "lee", amount: 1500, period: "monthly", growth: 0.02, taxable: true });
  assert.deepEqual(compute(r, { today: TODAY }).years.map((y) => y.year), [2033, 2034]);
});

// review 2026-11-02 (fifth pass): the marketplace's own income, and why no one needs it, person by person
test("fifth pass: the marketplace counts untaxed Social Security: the 68/63 couple's 2026 credit appears and no year is under the poverty line", () => {
  const H = "2026-11-02";
  const o = familyPlan(H); o.household.people = o.household.people.filter((x) => x.role !== "dependent");
  o.household.people[0].birthDate = "1958-03-01"; o.household.people[1].birthDate = "1963-06-01";
  for (const q of o.household.people) q.retirementAge = 60;
  o.income = []; o.retirement.contributions = []; o.retirement.spendingMonthly = null;
  o.expenses.push({ id: "mc", name: "Medicare Part B", category: "health", amount: 203, period: "monthly", essential: true, inflates: true });
  const d = compute(o, { today: H });
  assert.deepEqual(d.years.map((y) => y.year), [2026, 2027]);
  const [y26, y27] = d.years;
  // was: income $15,365, no credit ("under the poverty line"), $17,324; now Ana's untaxed Social Security counts
  assert.equal(y26.underLine, false); assert.ok(y26.credit > 0); near(y26.magi, 48012, 1); near(y26.cost, 3644, 1);
  // 2027 (loans lane 1, 2026-11-07): the family's loan payments in today's bills are a fixed amount while they run, not raised
  // for prices, so a little less is drawn: income $73,264 and cost $7,488 (were $74,460 and $7,610)
  near(y27.magi, 73264, 1); near(y27.cost, 7488, 1);
  assert.equal(d.underLineYears, 0);
});

test("fifth pass: why no one needs marketplace coverage names the real reason, never 'everyone works until 65' for retirees", async () => {
  const H = "2026-11-02";
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  // a retired couple of 72 and 69 (the retired couple seed's ages): both on Medicare
  const seed = familyPlan(H);
  seed.household.people = [
    { id: "p-ruth", name: "Ruth", role: "self", birthDate: "1954-03-10", retirementAge: 62, lifeExpectancy: 100 },
    { id: "p-sam", name: "Sam", role: "partner", birthDate: "1957-06-20", retirementAge: 70, lifeExpectancy: 90 },
  ];
  seed.income = [{ id: "i-rent", name: "Rental duplex", type: "rental", personId: "p-sam", amount: 2000, period: "monthly", growth: 0.02, taxable: true }];
  seed.retirement.contributions = []; seed.retirement.spendingMonthly = null;
  const s = compute(seed, { today: H });
  assert.equal(s.noBridge, true);
  assert.deepEqual(s.noBridgeWhy.map((w) => [w.name, w.why]), [["Ruth", "medicare"], ["Sam", "medicare"]]);
  // the family: Ana works to 65; Bo works to 62, then is on Ana's plan at work
  const f = compute(familyPlan(H), { today: H });
  assert.deepEqual(f.noBridgeWhy.map((w) => [w.name, w.why, w.worker ?? null, w.ownUntilAge ?? null]), [["Ana", "job", null, null], ["Bo", "partner", "Ana", 62]]);
  // the retirement fixture: both work until 65 or later
  assert.deepEqual(compute(retirementPlan(), { today: H }).noBridgeWhy.map((w) => [w.name, w.why]), [["Sam", "job"], ["Lee", "job"]]);
  // Lee with no pay and a plan to 60: on Sam's plan to the end of her plan
  const l = retirementPlan(); l.income = l.income.filter((x) => x.personId !== "lee"); l.household.people[1].lifeExpectancy = 60;
  const lw = compute(l, { today: H }).noBridgeWhy.find((w) => w.name === "Lee");
  assert.deepEqual([lw.why, lw.worker, lw.endsBefore65], ["partner", "Sam", true]);
});

// ---- review 2026-11-06, seventh pass: married filing separately gets no premium tax credit (26 U.S.C. 36B(c)(1)(C): a married
// taxpayer is an applicable taxpayer only on a joint return; the exception for a spouse living apart after domestic abuse or
// abandonment, 26 CFR 1.36B-2(b)(2)(ii)-(v), is said on the page, not assumed)
test("seventh pass: married filing separately gets no marketplace credit (H-1395 got $15,893 of credits)", async () => {
  const fs = await import("node:fs");
  const md = fs.readFileSync(new URL("../../../qa/households/14-unusual-structures/special/H-1395-separated-not-divorced.md", import.meta.url), "utf8");
  const plan = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]);
  const T = "2026-11-06";
  assert.equal(plan.household.filingStatus, "married_separate");
  const d = compute(plan, { today: T });
  // Grace stops at 64 in 2031, her one marketplace year: the full benchmark, $17,606, with no credit
  assert.equal(d.separate, true); assert.equal(d.totalCredit, 0, "was $15,893"); assert.equal(d.cliffIncome, null); assert.equal(d.cliffYears, 0);
  assert.ok(d.years.length > 0 && d.years.every((y) => y.credit === 0 && Math.abs(y.cost - y.benchmark) < 1e-9 && y.cliff === null && y.lostCredit === 0));
  assert.equal(Math.round(d.total), 17606);
  // the same household filing jointly keeps the credit, as before
  const joint = JSON.parse(JSON.stringify(plan)); joint.household.filingStatus = "married_joint";
  const dj = compute(joint, { today: T });
  assert.equal(dj.separate, false); assert.equal(Math.round(dj.totalCredit), 15893); assert.equal(Math.round(dj.total), 1712);
  // the projection's health line prices the full premium and says why
  const { compute: projection, creditWords } = await import("../projection/compute.js");
  const pr = projection(plan, { today: T });
  assert.equal(pr.health.bridge.separate, true); assert.equal(Math.round(pr.health.bridge.total), 17606); assert.equal(pr.health.bridge.credit, 0);
  assert.equal(creditWords(pr.health.bridge), "marketplace, no credit on separate returns");
  // the rule itself (26 U.S.C. 36B(c)(1)(C)): every status but married filing separately
  const { creditAllowed } = await import("./compute.js");
  assert.equal(creditAllowed("married_separate"), false); assert.equal(creditAllowed("married_joint"), true); assert.equal(creditAllowed("single"), true); assert.equal(creditAllowed("head_of_household"), true);
});

// ---- health costs that rise faster than prices (gap design #10, 2026-11-13; Assumptions' "Health costs rise") ------------------
test("#10: with prices nothing changes; one point faster, each year's benchmark is today's x 1.01^(years from now), and the credit is worked out on the grown premium", async () => {
  const { earlyRetiree, separateCouple } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const T = "2026-11-13";
  const flat = migrate(earlyRetiree());
  const a = compute(flat, { today: T });
  assert.ok(a.years.length >= 15 && a.years[0].year === 2026, "Kim, 45, on the marketplace until 65");
  assert.equal("healthGrowth" in a, false);
  // 1. h = 0 (absent, zero, blank): identical, byte for byte
  for (const v of [0, null, ""]) { const p = structuredClone(flat); p.assumptions.healthGrowth = v; assert.equal(JSON.stringify(compute(p, { today: T })), JSON.stringify(a), String(v)); }
  // 2. h = 0.01: the benchmark of year t is the flat one x 1.01^(t - 2026); ten years on, x 1.01^10
  const fast = structuredClone(flat); fast.assumptions.healthGrowth = 0.01;
  const b = compute(fast, { today: T });
  assert.equal(b.healthGrowth, 0.01); assert.equal(b.years.length, a.years.length);
  for (const [i, y] of b.years.entries()) near(y.benchmark, a.years[i].benchmark * Math.pow(1.01, y.year - 2026), 1e-6);
  const y10 = b.years.find((y) => y.year === 2036), f10 = a.years.find((y) => y.year === 2036);
  near(y10.benchmark, f10.benchmark * Math.pow(1.01, 10), 1e-6);
  assert.equal(b.years[0].benchmark, a.years[0].benchmark, "this year's premium is today's");
  // 3. the credit is on the grown benchmark: income and the share expected of it are the same, so in a year with a credit the
  // credit takes up the whole rise and what the household pays stays its expected share of income
  let withCredit = 0, without = 0;
  for (const [i, y] of b.years.entries()) {
    const f = a.years[i];
    assert.equal(y.magi, f.magi, "the income the credit is priced on does not move"); assert.equal(y.cliff, f.cliff);
    if (f.credit > 0) { near(y.credit - f.credit, y.benchmark - f.benchmark, 1e-6); near(y.cost, f.cost, 1e-6); near(y.credit, y.benchmark - y.cost, 1e-6); withCredit++; }
    else { near(y.cost, y.benchmark, 1e-6); without++; }
  }
  assert.ok(withCredit >= 5, `${withCredit} years with a credit`);
  // a year with no credit at all (income over the cliff): the household pays the whole grown premium, and the credit lost by
  // going over is the one on the grown premium too
  const over = structuredClone(flat); over.retirement.aca = { rules: "law" }; over.income.push({ id: "rent", name: "Rent from the flat", type: "rental", personId: "kim", amount: 9000, period: "monthly", taxable: true });
  const o0 = compute(over, { today: T }); over.assumptions.healthGrowth = 0.02; const o2 = compute(over, { today: T });
  const k = o0.years.findIndex((y) => y.overCliff > 0 && y.year > 2030);
  assert.ok(k >= 0, "a year over the cliff");
  near(o2.years[k].cost, o0.years[k].benchmark * Math.pow(1.02, o0.years[k].year - 2026), 1e-6);
  assert.ok(o2.years[k].lostCredit > o0.years[k].lostCredit);
  near(o2.total, o2.years.reduce((s, y) => s + y.cost, 0), 1e-6);
});

test("#10 the page: one line says why later years cost more, with the way to change it; with prices the page is word for word what it was", async () => {
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { earlyRetiree } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const view = new URL("./view.js", import.meta.url);
  const T = "2026-11-13";
  const flat = await pageText(view, earlyRetiree(), T);
  assert.doesNotMatch(flat, /faster than prices/);
  const p = earlyRetiree(); p.assumptions.healthGrowth = 0;
  assert.equal(await pageText(view, p, T), flat);
  p.assumptions.healthGrowth = 0.01;
  const fast = await pageText(view, p, T);
  assert.match(fast, /Premiums are set to rise 1 point a year faster than prices \(your choice on Assumptions\)\. In a year with a tax credit, the credit takes up the rise; in a year without one, you pay it\. Change it/);
});
