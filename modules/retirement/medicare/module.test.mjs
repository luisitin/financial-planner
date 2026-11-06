import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, tierFor, enrollmentWindow } from "./compute.js";
import { TIERS, PART_B, PART_D_BASE } from "./data/medicare.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("the 2026 tiers: the standard premium first, rising to the top; the lines are inclusive", () => {
  for (const t of Object.values(TIERS)) { assert.equal(t[0][1], PART_B); assert.equal(t[0][2], 0); assert.equal(t.at(-1)[0], Infinity); for (let i = 1; i < t.length; i++) assert.ok(t[i][1] > t[i - 1][1]); }
  assert.equal(tierFor(218000, "married_joint").index, 0); assert.equal(tierFor(218001, "married_joint").index, 1);
  assert.equal(tierFor(109000, "single").partB, 202.90); assert.equal(tierFor(150000, "single").partB, 405.80); assert.equal(tierFor(150000, "single").partDAdd, 37.50);
  assert.equal(tierFor(600000, "head_of_household").partB, 689.90);
  assert.equal(tierFor(200000, "married_separate").partB, 649.20);
});

test("the sign-up window: three months either side of the 65th birthday month; a birthday on the 1st moves it", () => {
  assert.deepEqual(enrollmentWindow("1990-05-20"), { from: "2055-02", month: "2055-05", to: "2055-08" });
  assert.deepEqual(enrollmentWindow("1988-11-02"), { from: "2053-08", month: "2053-11", to: "2054-02" });
  assert.deepEqual(enrollmentWindow("1990-01-01"), { from: "2054-09", month: "2054-12", to: "2055-03" });
});

test("not ready without the plan; the windows still shown", () => {
  const p = emptyPlan(); p.household.people = [{ id: "a", name: "A", role: "self", birthDate: "1961-03-10" }];
  const d = compute(p, { today: TODAY });
  assert.equal(d.ready, false); assert.equal(d.people[0].medicareYear, 2026);
});

test("the family: each enrolled person pays, from the income two years before; working years from pay less pre-tax saving", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.status, "married_joint");
  const y = d.years[0];
  assert.equal(y.year, 2053); assert.equal(y.enrolled, 1); assert.equal(y.magiYear, 2051);
  near(y.magiReal, 3900 * 26 - 470 * 26, 1e-6);
  near(y.totalYearly, (PART_B + PART_D_BASE) * 12);
  assert.equal(d.years.find((x) => x.year === 2055).enrolled, 2);
  near(d.lifetime, d.years.reduce((s, x) => s + x.totalYearly, 0));
  assert.equal(d.surcharge, 0); assert.equal(d.firstSurcharge, null);
  near(d.roomNow.room, 218000 - y.magiReal);
});

test("big Roth conversions push income over a line: the surcharge two years later", () => {
  const p = familyPlan(TODAY); p.retirement.taxMode = "brackets"; p.retirement.rothConversion = { on: true, fillRate: 0.32 };
  p.retirement.medicare = { partDPremium: 50, supplementPremium: 150 };
  const d = compute(p, { today: TODAY });
  assert.ok(d.surcharge > 0 && d.surchargeYears > 0);
  assert.equal(d.firstSurcharge.magiYear, d.firstSurcharge.year - 2); assert.ok(d.firstSurcharge.conversion > 0);
  const hit = d.years.find((x) => x.tier > 0);
  near(hit.totalYearly, (hit.partBEach + 50 + hit.partDAddEach + 150) * 12 * hit.enrolled);
  near(hit.surchargeYearly, ((hit.partBEach - PART_B) + hit.partDAddEach) * 12 * hit.enrolled);
});

test("the 2027 drug-plan base premium is the 2026 one raised by the 6% yearly cap (CMS, July 28, 2026)", async () => {
  const { PART_D_BASE_NEXT } = await import("./data/medicare.js");
  assert.equal(PART_D_BASE_NEXT.year, 2027); assert.equal(PART_D_BASE_NEXT.amount, 41.33);
  assert.equal(Math.round(PART_D_BASE * 1.06 * 100) / 100, PART_D_BASE_NEXT.amount);
});

// review 2026-11-02 (fifth pass): two incomes, by law. Medicare's surcharge: AGI plus tax-exempt interest (42 USC 1395r(i)(4)(A));
// the marketplace's credit: AGI plus untaxed Social Security plus tax-exempt interest (26 USC 36B(d)(2)(B))
const couple6863 = () => {
  const o = familyPlan("2026-11-02"); o.household.people = o.household.people.filter((x) => x.role !== "dependent");
  o.household.people[0].birthDate = "1958-03-01"; o.household.people[1].birthDate = "1963-06-01";
  for (const q of o.household.people) q.retirementAge = 60;
  o.income = []; o.retirement.contributions = []; o.retirement.spendingMonthly = null;
  o.expenses.push({ id: "mc", name: "Medicare Part B", category: "health", amount: 203, period: "monthly", essential: true, inflates: true });
  return o;
};

test("fifth pass: Medicare's surcharge income is AGI plus tax-exempt interest; the marketplace's adds untaxed Social Security", async () => {
  const { irmaaIncome, marketplaceIncome, planIncome } = await import("./compute.js");
  assert.equal(irmaaIncome({ agi: 50000, exemptInterest: 2000, untaxedSocialSecurity: 30000 }), 52000);
  assert.equal(marketplaceIncome({ agi: 50000, exemptInterest: 2000, untaxedSocialSecurity: 30000 }), 82000);
  assert.equal(marketplaceIncome({ agi: 50000 }), 50000); assert.equal(irmaaIncome({}), 0);
  // the 68/63 couple in 2026: Ana's Social Security is mostly untaxed; the surcharge counts the taxed part only, the marketplace all of it
  const pi = planIncome(couple6863(), { today: "2026-11-02" });
  const row = pi.run.rows.find((r) => r.year === 2026), parts = pi.partsOf(row);
  near(parts.agi, (row.taxInfo.ordinary + row.taxInfo.qualified + row.taxInfo.taxableSocialSecurity) / row.priceLevel, 1e-6);
  near(parts.untaxedSocialSecurity, (row.taxInfo.socialSecurity - row.taxInfo.taxableSocialSecurity) / row.priceLevel, 1e-6);
  assert.ok(parts.untaxedSocialSecurity > 20000, String(parts.untaxedSocialSecurity));
  near(pi.magiOf(row), parts.agi, 1e-6, "was the same figure for both");
  near(pi.acaMagiOf(row), parts.agi + parts.untaxedSocialSecurity, 1e-6);
  // an interest line on Income, even marked untaxed, is never added to the plan (its money is in the accounts' growth, which the
  // brackets count as dividends in AGI: projection otherIncome, recheck 2026-11-05), so nothing is added on top of AGI for it
  // (review 2026-11-06, was 3,000 in both); other untaxed income (support) is in neither
  const q = couple6863();
  q.income.push({ id: "muni", name: "Muni bond interest", type: "investment", personId: "", amount: 3000, period: "annual", growth: 0, taxable: false },
    { id: "kid", name: "Support", type: "support", personId: "", amount: 2400, period: "annual", growth: 0, taxable: false });
  const qi = planIncome(q, { today: "2026-11-02" }), qrow = qi.run.rows.find((r) => r.year === 2026), qp = qi.partsOf(qrow);
  near(qp.exemptInterest, 0, 1e-6); assert.equal(qi.inputs.incomes.some((x) => x.name === "Muni bond interest"), false);
  near(qi.magiOf(qrow), qp.agi, 1e-6); near(qi.acaMagiOf(qrow), qp.agi + qp.untaxedSocialSecurity, 1e-6);
  // Medicare's page prices the surcharge on its own income (the year two before), never the marketplace's
  const d = compute(couple6863(), { today: "2026-11-02" });
  const y = d.years.find((x) => x.year === 2028);
  near(y.magiReal, pi.magiOf(pi.run.rows.find((r) => r.year === 2026)), 1e-6);
});
