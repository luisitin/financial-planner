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

// ---- round 8 batch 6: a landlord kind and one pairing of policies with homes (landlord-2, landlord-7) ----------------------
test("batch 6: a Landlord kind for a home rented out, in the home, car and liability group", async () => {
  const M = await import("./compute.js");
  assert.equal(M.KINDS.landlord?.group, "property");
  assert.deepEqual(M.HOME_KINDS, ["home", "landlord"]);
  const d = compute(withPolicies([{ id: "l", name: "Condo landlord policy", kind: "landlord", benefit: 300000, premium: 900, period: "annual" }]), { today: TODAY });
  assert.equal(d.items[0].kindLabel, "Landlord (a home you rent out)"); assert.equal(d.premiumYearly, 900);
});

test("batch 6: pairHomes ties a policy to its home by Which home, then by name, then in order", async () => {
  const { pairHomes, namesHome } = await import("./compute.js");
  const home = { id: "p1", name: "Home policy" }, condo = { id: "p2", name: "Condo landlord policy" };
  const ids = (xs) => xs.map((x) => x?.id ?? null);
  // by name, whatever the order
  assert.deepEqual(ids(pairHomes([{ accountId: "c", name: "Condo" }, { accountId: "h", name: "Home" }], [home, condo])), ["p2", "p1"]);
  // Which home first
  assert.deepEqual(ids(pairHomes([{ accountId: "c", name: "Condo" }, { accountId: "h", name: "Home" }], [{ ...home, accountId: "c" }, condo])), ["p1", null]);
  // names saying nothing: in order when the counts match, a lone home with a lone policy, or (lone: "first") the first of several
  assert.deepEqual(ids(pairHomes([{ accountId: "a", name: "House" }, { accountId: "b", name: "Cabin" }], [{ id: "x", name: "Policy 1" }, { id: "y", name: "Policy 2" }])), ["x", "y"]);
  assert.deepEqual(ids(pairHomes([{ accountId: "a", name: "House" }], [{ id: "x", name: "Policy 1" }, { id: "y", name: "Policy 2" }])), [null]);
  assert.deepEqual(ids(pairHomes([{ accountId: "a", name: "House" }], [{ id: "x", name: "Policy 1" }, { id: "y", name: "Policy 2" }], { lone: "first" })), ["x"]);
  // a name both homes share is no clue ("Condo home insurance" names Home and Condo)
  assert.deepEqual(ids(pairHomes([{ accountId: "h", name: "Home" }, { accountId: "c", name: "Condo" }], [{ id: "z", name: "Condo home insurance" }, home])), ["p1", "z"]);
  assert.equal(namesHome({ name: "Condo landlord policy" }, "condo"), true);
  assert.equal(namesHome({ name: "Homeowners" }, "Home"), false, "whole words only");
  assert.equal(namesHome({ name: "My policy" }, "My"), false, "names under three letters say nothing");
});

// round 8 batch 6 review (money 6): with nothing tying them and names that say nothing, a landlord policy goes with the home
// rented out and a homeowners policy with the home lived in, before list order (the landlord policy listed first took Home)
test("batch 6 review: pairHomes pairs by kind before list order: landlord with the rented-out home, homeowners with the other", async () => {
  const { pairHomes } = await import("./compute.js");
  const ids = (xs) => xs.map((x) => x?.id ?? null);
  const land = { id: "pl", name: "Rental dwelling policy", kind: "landlord" }, own = { id: "ph", name: "Homeowners policy", kind: "home" };
  assert.deepEqual(ids(pairHomes([{ accountId: "h", name: "Home" }, { accountId: "c", name: "Condo", rental: true }], [land, own])), ["ph", "pl"]);
  // a lone rental only on Rental analysis, with the home lived in on Net worth
  assert.deepEqual(ids(pairHomes([{ accountId: "h", name: "Home" }, { accountId: null, name: "Condo", rental: true }], [own, { id: "pa", name: "Acme rental dwelling", kind: "landlord" }])), ["ph", "pa"]);
  // with only homeowners policies the order rule is as before (no landlord kind: nothing to tell them apart by)
  assert.deepEqual(ids(pairHomes([{ accountId: "c", name: "Condo", rental: true }, { accountId: "h", name: "Home" }], [{ id: "x", name: "Policy 1", kind: "home" }, { id: "y", name: "Policy 2", kind: "home" }])), ["x", "y"]);
});
