import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, listOf, NAMED } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const item = (d, key) => d.items.find((x) => x.key === key);
const withRows = (rows, policies = []) => { const p = familyPlan(TODAY); p.estate.beneficiaries = rows; p.insurance = { policies }; return p; };

test("listOf: arrays, older plain names, blanks dropped", () => {
  assert.deepEqual(listOf("Bo"), [{ name: "Bo", share: 1 }]);
  assert.deepEqual(listOf([{ name: " Bo ", share: 0.5, personId: "p-bo" }, { name: "" }]), [{ name: "Bo", share: 0.5, personId: "p-bo" }]);
  assert.deepEqual(listOf(null), []);
});

test("an empty plan: nothing to name", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).count, 0);
});

test("the family with nothing on file: every account that takes a form, and the money with no one named", () => {
  const d = compute(withRows([], [{ id: "t", name: "Term", kind: "term", personId: "p-ana", benefit: 500000 }, { id: "h", name: "Home", kind: "home", benefit: 1 }]), { today: TODAY });
  const accounts = familyPlan(TODAY).accounts.filter((a) => NAMED[a.type]);
  assert.equal(d.count, accounts.length + 1, "home insurance takes no beneficiary");
  assert.equal(d.named, 0); assert.equal(d.missingValue, accounts.reduce((s, a) => s + a.balance, 0) + 500000);
  assert.match(item(d, "account:a-401").flags[0], /retirement account left to an estate/);
});

test("the flags: shares, no backup, a minor named directly, the estate, a spouse left off a 401(k), old and before a birth", () => {
  const d = compute(withRows([
    { key: "account:a-401", primary: [{ name: "Bo", personId: "p-bo", share: 0.6 }], contingent: [{ name: "Cy", personId: "p-cy", share: 1 }], reviewedAt: "2025-01-01" },
    { accountId: "a-bk401", primary: [{ name: "Dana", share: 1 }], contingent: [{ name: "Estate", share: 1 }], reviewedAt: "2015-06-01" },
    { accountId: "a-roth", primary: "Ana", contingent: [], reviewedAt: "2026-01-01" },
  ]), { today: TODAY });
  const a = item(d, "account:a-401");
  assert.ok(a.flags.some((f) => f.includes("add up to 60%"))); assert.ok(a.flags.some((f) => f.startsWith("Cy is under 18")));
  const b = item(d, "account:a-bk401");
  assert.ok(b.flags.some((f) => f.includes("Ana is not the main beneficiary"))); assert.ok(b.flags.some((f) => f.includes("the estate is named")));
  assert.ok(b.flags.some((f) => f === "checked 11 years ago")); assert.ok(b.flags.some((f) => f === "Cy was born after it was last checked"));
  const r = item(d, "account:a-roth");
  assert.deepEqual(r.flags, ["no backup (contingent) beneficiary, if the first one dies first"]);
  assert.equal(d.named, 3);
});

test("a clean row: no flags", () => {
  const d = compute(withRows([{ accountId: "a-401", primary: [{ name: "Bo", personId: "p-bo", share: 1 }], contingent: [{ name: "Cy's trust", share: 1 }], reviewedAt: "2026-01-01" }]), { today: TODAY });
  assert.equal(item(d, "account:a-401").ok, true);
  assert.deepEqual(item(d, "account:a-401").minors, []);
});

test("a child under 18 named on an account: its own line of what to name instead, matched by the person picked, else by the name typed", () => {
  const d = compute(withRows([
    { accountId: "a-401", primary: [{ name: "Cy", personId: "p-cy", share: 1 }], contingent: [{ name: "Bo", personId: "p-bo", share: 1 }], reviewedAt: "2026-01-01" },
    { accountId: "a-roth", primary: [{ name: "cy", share: 1 }], contingent: [{ name: "Cy", personId: "p-cy", share: 1 }], reviewedAt: "2026-01-01" },
    // picked from the household as Bo, then retyped: the person picked wins over the name
    { accountId: "a-bk401", primary: [{ name: "Cy", personId: "p-bo", share: 1 }], contingent: [{ name: "Ana", personId: "p-ana", share: 1 }], reviewedAt: "2026-01-01" },
  ]), { today: TODAY });
  const a = item(d, "account:a-401");
  assert.deepEqual(a.minors, [{ name: "Cy", personId: "p-cy", level: "primary", text: "Cy is under 18 and can't receive this directly: name a custodian under your state's Uniform Transfers to Minors Act (UTMA), or a trust" }]);
  assert.ok(a.flags.includes(a.minors[0].text)); assert.equal(a.ok, false);
  const r = item(d, "account:a-roth");
  assert.deepEqual(r.minors.map((m) => [m.name, m.level]), [["cy", "primary"], ["Cy", "contingent"]], "by name when no person was picked");
  assert.deepEqual(item(d, "account:a-bk401").minors, []);
  // 18 or over: nothing
  const grown = familyPlan(TODAY); grown.household.people.find((x) => x.id === "p-cy").birthDate = "2000-03-03";
  grown.estate.beneficiaries = [{ accountId: "a-401", primary: [{ name: "Cy", personId: "p-cy", share: 1 }], contingent: [{ name: "Bo", personId: "p-bo", share: 1 }], reviewedAt: "2026-01-01" }];
  assert.deepEqual(item(compute(grown, { today: TODAY }), "account:a-401").minors, []);
});
