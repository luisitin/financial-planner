import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, KINDS, GROUPS, SOON_DAYS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const withPolicies = (policies) => { const p = familyPlan(TODAY); p.insurance = { policies }; return p; };
const POLICIES = [
  { id: "w", name: "Group life", kind: "term", personId: "p-ana", benefit: 200000, premium: 0, period: "monthly", throughWork: true },
  { id: "t", name: "Term", kind: "term", personId: "p-ana", benefit: 500000, premium: 32, period: "monthly", endDate: "2042-03-01" },
  { id: "b", name: "Bo's life", kind: "whole", personId: "p-bo", benefit: 100000, premium: 1200, period: "annual", cashValue: 8000 },
  { id: "d", name: "Disability", kind: "disability", personId: "p-ana", benefit: 5070, premium: 22, period: "monthly", throughWork: true },
  { id: "c", name: "Care", kind: "ltc", personId: "p-bo", benefit: 4500, premium: 150, period: "quarterly" },
  { id: "h", name: "Home", kind: "home", personId: "", benefit: 410000, premium: 2160, period: "annual", renewalDate: "2026-12-05" },
  { id: "x", name: "Old term", kind: "term", personId: "p-bo", benefit: 50000, premium: 10, period: "monthly", endDate: "2025-06-30" },
];

test("every kind has a label, an icon, a benefit and a group that exists", () => {
  for (const k of Object.values(KINDS)) { assert.ok(k.label && k.icon && k.benefit); assert.ok(GROUPS[k.group], k.label); }
});

test("an empty plan: nothing on file, nothing owed", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.premiumYearly, 0); assert.deepEqual(d.warnings, []);
});

test("premiums a year: each premium times its payments a year; an ended policy no longer counts", () => {
  const d = compute(withPolicies(POLICIES), { today: TODAY });
  assert.equal(d.count, 7);
  const byId = Object.fromEntries(d.items.map((x) => [x.id, x]));
  assert.equal(byId.t.premiumYearly, 32 * 12); assert.equal(byId.b.premiumYearly, 1200); assert.equal(byId.c.premiumYearly, 600);
  assert.equal(d.premiumYearly, 0 + 384 + 1200 + 264 + 600 + 2160);
  assert.ok(Math.abs(d.premiumMonthly - d.premiumYearly / 12) < 1e-9);
  assert.equal(byId.x.ended, true);
  assert.equal(d.warnings.length, 1); assert.match(d.warnings[0], /Old term ended on 2025-06-30/);
});

test("cover per person: life adds term and whole, disability and care are monthly, dependents are left out", () => {
  const d = compute(withPolicies(POLICIES), { today: TODAY });
  assert.deepEqual(d.byPerson.map((p) => p.personId), ["p-ana", "p-bo"]);
  const [ana, bo] = d.byPerson;
  assert.equal(ana.life, 700000); assert.equal(ana.disabilityMonthly, 5070); assert.equal(ana.ltcMonthly, 0);
  assert.equal(bo.life, 100000, "the ended term is not cover"); assert.equal(bo.ltcMonthly, 4500);
  const life = d.byGroup.find((g) => g.group === "life");
  assert.equal(life.count, 3); assert.equal(life.premiumYearly, 384 + 1200);
});

test("the flags: cover through work, a term ending while people depend on it, a renewal within the window, no benefit", () => {
  const d = compute(withPolicies([...POLICIES, { id: "n", name: "No figure", kind: "umbrella", premium: 300, period: "annual" }]), { today: TODAY });
  const byId = Object.fromEntries(d.items.map((x) => [x.id, x]));
  assert.ok(byId.w.flags.some((f) => f.includes("through work")));
  assert.ok(byId.d.flags.some((f) => f.includes("through work")));
  assert.ok(byId.t.flags.some((f) => f.includes("ends 2042")));
  assert.equal(byId.h.renewsSoon, true); assert.ok(byId.h.flags.some((f) => f.includes("renews in 36 days")));
  assert.ok(byId.n.flags.includes("no liability limit entered"));
  assert.equal(byId.n.personName, "Household");
});

test("the renewal window is SOON_DAYS: one day past it is not flagged; a single person has no one depending on a term", () => {
  const p = withPolicies([{ id: "h", name: "Home", kind: "home", benefit: 1, premium: 1, period: "annual", renewalDate: "2026-12-30" }, { id: "t", name: "Term", kind: "term", personId: "p-ana", benefit: 1, premium: 1, endDate: "2040-01-01" }]);
  assert.equal(SOON_DAYS, 60);
  assert.equal(compute(p, { today: TODAY }).items[0].renewsSoon, false, "61 days");
  assert.equal(compute(p, { today: "2026-10-31" }).items[0].renewsSoon, true, "60 days");
  p.household.people = p.household.people.filter((x) => x.id === "p-ana");
  assert.ok(!compute(p, { today: TODAY }).items[1].flags.some((f) => f.includes("ends")));
});
