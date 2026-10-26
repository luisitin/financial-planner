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
  assert.equal(d.people[0].options.length, 5); assert.equal(d.people[0].options[0].claimAge, 62);
  assert.equal(d.hasData, true);
  const e = compute(emptyPlan(), { today: "2026-09-16" });
  assert.equal(e.hasData, false); assert.equal(e.householdYearly, 0);
});
