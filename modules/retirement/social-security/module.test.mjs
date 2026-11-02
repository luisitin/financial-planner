import { test } from "node:test";
import assert from "node:assert/strict";
import { fullRetirementAge, claimFactor, parseRecord, credits, estimateBenefit, compute } from "./compute.js";
import { WAGE_INDICES } from "./data/ssa.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("full retirement age and the claim-age factors match the SSA charts", () => {
  assert.deepEqual([fullRetirementAge(1960).years, fullRetirementAge(1960).months], [67, 0]);
  assert.deepEqual([fullRetirementAge(1957).years, fullRetirementAge(1957).months], [66, 6]);
  assert.deepEqual([fullRetirementAge(1950).years, fullRetirementAge(1950).months], [66, 0]);
  near(claimFactor(1960, 62), 0.70, 1e-9, "62 with an FRA of 67: 70%");
  near(claimFactor(1960, 67), 1, 1e-9);
  near(claimFactor(1960, 70), 1.24, 1e-9, "three years of 8% delayed credits");
  near(claimFactor(1960, 65), 1 - 24 * (5 / 9) / 100, 1e-9, "24 months early: 86.67%");
  near(claimFactor(1955, 62), 1 - 36 * (5 / 9) / 100 - 14 * (5 / 12) / 100, 1e-9, "FRA 66 and 2 months: 50 months early: 74.17%");
  near(claimFactor(1960, 75), 1.24, 1e-9, "no credit past 70");
});
test("parseRecord reads ssa.gov style text", () => {
  const rec = parseRecord("Year  Taxed Social Security Earnings\n2024\t$69,000\n2023 $66,500.00\n2022\t64,000\nsome junk\n2024 $70,000\n");
  assert.deepEqual(rec, [{ year: 2022, earnings: 64000 }, { year: 2023, earnings: 66500 }, { year: 2024, earnings: 70000 }]);
  assert.equal(credits(rec), 12);
  assert.equal(credits([{ year: 2024, earnings: 1000 }]), 0, "under one credit's worth");
});
test("estimateBenefit follows the SSA formula on a simple record", () => {
  // Born 1962: turns 60 in 2022 (indexing year), 62 in 2024. 35 years of earnings equal to the AWI of each year
  // index to exactly AWI[2022] each, so AIME = AWI[2022] / 12 and the bend points are the 2024 ones.
  const record = []; for (let y = 1987; y <= 2021; y++) record.push({ year: y, earnings: WAGE_INDICES[y] });
  const e = estimateBenefit(record, { birthYear: 1962, claimAge: 67, futureEarnings: "none", today: "2026-09-16" });
  assert.equal(e.indexingYear, 2022);
  assert.equal(e.aime, Math.floor(WAGE_INDICES[2022] * 35 / 420));
  const scale = WAGE_INDICES[2022] / WAGE_INDICES[1977];
  assert.deepEqual(e.bendPoints, [Math.round(180 * scale), Math.round(1085 * scale)]);
  const [bp1, bp2] = e.bendPoints;
  let pia = 0.9 * bp1 + 0.32 * (Math.min(e.aime, bp2) - bp1) + 0.15 * Math.max(0, e.aime - bp2);
  pia = Math.floor(pia * 10) / 10;
  // COLAs for 2024 and 2025 apply (turned 62 in 2024)
  assert.ok(e.pia > pia, "COLA'd up since 62"); assert.ok(e.pia < pia * 1.1);
  assert.equal(e.eligible, true); assert.equal(e.credits, 40); assert.equal(e.projectedYears, 0);
  near(e.monthly, e.pia, 0.11, "claiming at FRA 67: the PIA");
  const early = estimateBenefit(record, { birthYear: 1962, claimAge: 62, futureEarnings: "none", today: "2026-09-16" });
  near(early.monthly, Math.floor(e.pia * 0.7 * 10) / 10, 0.11);
});
test("future earnings repeat the last year until the stop year; a record with few years is not eligible", () => {
  const e = estimateBenefit([{ year: 2023, earnings: 50000 }, { year: 2024, earnings: 52000 }], { birthYear: 1990, claimAge: 67, futureEarnings: "same", stopYear: 2030, today: "2026-01-01" });
  assert.equal(e.projectedYears, 6); assert.equal(e.yearsInRecord, 8); assert.equal(e.eligible, false, "8 years is 32 credits");
  const f = estimateBenefit([{ year: 2023, earnings: 50000 }, { year: 2024, earnings: 52000 }], { birthYear: 1990, claimAge: 67, futureEarnings: "same", today: "2026-01-01" });
  assert.equal(f.yearsInRecord, 2 + (1990 + 67 - 1 - 2024), "until the year before claiming");
});
test("compute: a record, a typed statement figure, and nothing", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1962-05-20", retirementAge: 67 }, { id: "b", name: "Bo", role: "partner", birthDate: "1965-01-15" }, { id: "c", name: "Cy", role: "dependent", birthDate: "2020-01-01" });
  const record = []; for (let y = 1987; y <= 2021; y++) record.push({ year: y, earnings: WAGE_INDICES[y] });
  p.retirement = { socialSecurity: { a: { claimAge: 70, record, futureEarnings: "none" }, b: { claimAge: 62, monthlyAtFRA: 2000 } } };
  const d = compute(p, { today: "2026-09-16" });
  assert.equal(d.people.length, 2);
  assert.equal(d.people[0].source, "record"); assert.ok(d.people[0].monthly > 0); assert.equal(d.people[0].claimAge, 70);
  assert.equal(d.people[1].source, "typed"); near(d.people[1].monthly, 1400, 0.11, "62 with an FRA of 67 on 2,000");
  // Ana is 64 and 4 months (by month) and has not claimed: the ages still possible, from now (rounded up to the month) to 70 (round 4)
  assert.deepEqual(d.people[0].options.map((o) => Math.round(o.claimAge * 12)), [64 * 12 + 4, 65 * 12, 66 * 12, 67 * 12, 68 * 12, 69 * 12, 70 * 12]);
  assert.equal(d.hasData, true);
  const e = compute(emptyPlan(), { today: "2026-09-16" });
  assert.equal(e.hasData, false); assert.equal(e.householdYearly, 0);
});

test("decisions already made (round 4): getting it is a fact; past 62 the choice is from now to 70, answered", async () => {
  const p = emptyPlan();
  p.household.people.push({ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }, { id: "s", name: "Sam", role: "partner", birthDate: "1957-06-20" });
  p.income = [{ id: "i", name: "Ruth's Social Security", type: "social", personId: "r", amount: 2100, period: "monthly" }];
  p.retirement = { socialSecurity: { r: { claimAge: 66, monthlyAtFRA: 2100 }, s: { claimAge: 70, monthlyAtFRA: 2400 } } };
  const T = "2026-11-02";
  const [ruth, sam] = compute(p, { today: T }).people;
  assert.equal(ruth.claimed, true); assert.equal(ruth.claimedYear, 2016); assert.equal(ruth.wait, null);
  assert.equal(sam.claimed, false);
  assert.deepEqual(sam.options.map((o) => Math.round(o.claimAge * 12)), [69 * 12 + 5, 70 * 12], "now (69 and 5 months) or 70");
  // claim now against 70 (SSA: 2/3 of 1% a month after full retirement age, FRA 66 and 6 months for 1957)
  assert.equal(sam.wait.at70, "2027-06"); assert.equal(sam.wait.at70Monthly, sam.options[1].monthly); assert.equal(sam.wait.nowMonthly, sam.options[0].monthly);
  const t = sam.wait.breakEven;
  assert.ok(Math.abs(sam.wait.nowMonthly * (t - sam.wait.nowAge) - sam.wait.at70Monthly * (t - 70)) < sam.wait.at70Monthly * 0.1, "the sums are equal at the break-even age");
  // setup's "I already get it" counts as claimed too; a claim age on file that has passed is flagged
  const q = structuredClone(p); q.income = []; q.guide = { setup: { ss: { r: "getting" } } }; q.retirement.socialSecurity.s.claimAge = 67;
  const [r2, s2] = compute(q, { today: T }).people;
  assert.equal(r2.claimed, true); assert.equal(s2.pastClaimAge, true);
});

test("review 2026-11-02: claimed only while paid; a benefit started before the claim age is 'now'; no past-age warning without figures", async () => {
  const { compute, fraFromMonthly, claimFactor } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const T = "2026-11-02";
  const base = () => { const p = emptyPlan(); p.household.people = [{ id: "pat", name: "Pat", role: "self", birthDate: "1976-04-10", retirementAge: 67 }]; return p; };
  // 50 and on disability benefits ("I get it now" in setup, saved at 62): getting it now, not "since 2038"
  const dis = base(); dis.guide = { setup: { ss: { pat: "getting" } } }; dis.retirement.socialSecurity = { pat: { claimAge: 62, monthlyAtFRA: 2142.9 } };
  const a = compute(dis, { today: T }).people[0];
  assert.equal(a.claimed, true); assert.equal(a.startedEarly, true); assert.equal(a.claimedYear, null);
  // Social Security typed on Income with a start date to come, as a one-off or ended: not claimed
  for (const line of [{ startDate: "2030-01-01", period: "monthly" }, { period: "once" }, { endDate: "2025-12-31", period: "monthly" }]) {
    const q = base(); q.household.people[0].birthDate = "1963-05-01";
    q.income = [{ id: "s", name: "Pat's Social Security", type: "social", personId: "pat", amount: 1800, ...line }];
    assert.equal(compute(q, { today: T }).people[0].claimed, false, JSON.stringify(line));
  }
  // past 62 with a claim age on file but no figures, or "won't get it": no "has passed" warning
  const none = base(); none.household.people[0].birthDate = "1957-01-01"; none.retirement.socialSecurity = { pat: { claimAge: 67 } };
  assert.equal(compute(none, { today: T }).people[0].pastClaimAge, false);
  none.retirement.socialSecurity.pat.monthlyAtFRA = 2000;
  assert.equal(compute(none, { today: T }).people[0].pastClaimAge, true, "with a figure, a claim age gone by is said");
  // 76, never claimed, 70 on file: up to date
  const old = base(); old.household.people[0].birthDate = "1950-03-10"; old.retirement.socialSecurity = { pat: { claimAge: 70, monthlyAtFRA: 2000 } };
  assert.equal(compute(old, { today: T }).people[0].pastClaimAge, false);
  // what arrives now, back to the full-age amount, to the dime
  assert.equal(fraFromMonthly(1950, 66, 2100), Math.round((2100 / claimFactor(1950, 66)) * 10) / 10);
});
