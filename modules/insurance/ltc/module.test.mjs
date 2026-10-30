import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, careEvents, settingsFor, CARE, DEFAULTS, AVERAGE_YEARS, AVERAGE_YEARS_ANY, MAX_YEARS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const BO_POLICY = { id: "l", name: "Bo's care policy", kind: "ltc", personId: "p-bo", benefit: 4500, premium: 150, period: "monthly", benefitYears: 3 };

test("the 2024 national medians", () => {
  assert.equal(CARE.nursing.yearly, 127750); assert.equal(CARE.semi.yearly, 111325); assert.equal(CARE.assisted.yearly, 70800); assert.equal(CARE.home.yearly, 77792); assert.equal(CARE.day.yearly, 26000);
});

test("settings: the defaults, and the years from the person's sex", () => {
  const p = familyPlan(TODAY);
  assert.deepEqual(settingsFor(p, "p-ana"), { care: DEFAULTS.care, startAge: DEFAULTS.startAge, costFactor: 1, years: AVERAGE_YEARS_ANY, sex: "" });
  p.retirement.longevity = { "p-ana": { sex: "female" }, "p-bo": { sex: "male" } };
  assert.equal(settingsFor(p, "p-ana").years, AVERAGE_YEARS.female); assert.equal(settingsFor(p, "p-bo").years, AVERAGE_YEARS.male);
  p.insurance.ltc = { care: "assisted", startAge: 80, years: 5, costFactor: 1.3 };
  assert.deepEqual(settingsFor(p, "p-ana"), { care: "assisted", startAge: 80, costFactor: 1.3, years: 5, sex: "female" });
});

test("care events: whole years then the part-year; a policy pays after its wait, up to its monthly benefit and its pool", () => {
  const plain = careEvents({ fromYear: 2070, years: 2.5, yearly: 100000, lastYear: 2090 });
  assert.deepEqual(plain.map((e) => [e.year, e.amount]), [[2070, 100000], [2071, 100000], [2072, 50000]]);
  const ev = careEvents({ fromYear: 2070, years: 2.5, yearly: 100000, lastYear: 2090, policy: { monthly: 5000, years: 2, waitDays: 90 } });
  near(ev[0].pays, 60000 * (1 - 90 / 365)); near(ev[1].pays, 60000); near(ev[2].pays, 120000 - ev[0].pays - 60000);
  for (const e of ev) near(e.amount, e.cost - e.pays);
  // the plan ends first: no care past the last year
  assert.equal(careEvents({ fromYear: 2070, years: 3, yearly: 1, lastYear: 2071 }).length, 2);
});

test("without inflation protection the benefit is worth less each year", () => {
  const ev = careEvents({ fromYear: 2036, years: 1, yearly: 100000, lastYear: 2090, policy: { monthly: 5000, years: 3, waitDays: 0, inflation: 0.03, nowYear: 2026 } });
  near(ev[0].pays, 60000 / Math.pow(1.03, 10));
});

test("not ready without the plan's basics", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family: three years in a nursing home from 85, the most the plan can carry, the policy against its premiums", () => {
  const p = familyPlan(TODAY); p.insurance = { policies: [BO_POLICY] };
  const d = compute(p, { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.base.success, true); assert.equal(d.primary, "Ana");
  const [ana, bo] = d.people;
  assert.equal(ana.startAge, 85); assert.equal(ana.fromYear, 1990 + 85); assert.equal(ana.costTotal, 3 * 127750);
  assert.equal(ana.self.success, true); assert.equal(ana.shortToday, 0);
  assert.ok(ana.maxYears > 3 && ana.maxYears < MAX_YEARS, String(ana.maxYears));
  assert.ok(ana.reachChance > 0 && ana.reachChance < 1);
  assert.equal(ana.policy, null);
  assert.equal(bo.policy.monthly, 4500); assert.equal(bo.policy.years, 3); assert.equal(bo.policy.waitDays, 90); assert.equal(bo.policy.inflationProtected, false);
  near(bo.policy.monthlyThenReal, 4500 / Math.pow(1.03, 2073 - 2026));
  let prem = 0; for (let y = 2026; y < 2073; y++) prem += 1800 / Math.pow(1.03, y - 2026);
  near(bo.policy.premiumsToStart, prem, 1e-6);
  assert.ok(bo.withPolicy.endReal < bo.self.endReal, "an unprotected policy bought this young costs the plan more than it pays");
  // with an inflation rider it pays its full benefit in today's dollars
  p.insurance.policies[0].inflationProtected = true;
  const prot = compute(p, { today: TODAY }).people[1];
  near(prot.policy.paysTotal, 4500 * 12 * (3 - 90 / 365));
});

test("care the plan cannot pay for: the money runs out, and the lump sum today that would pay for it", () => {
  const p = familyPlan(TODAY); p.insurance.ltc = { care: "nursing", startAge: 70, years: 12, costFactor: 2 };
  const ana = compute(p, { today: TODAY }).people[0];
  assert.equal(ana.self.success, false);
  assert.ok(ana.maxYears < 12);
  assert.ok(ana.shortToday > 0 && ana.shortToday % 1000 === 0);
});
