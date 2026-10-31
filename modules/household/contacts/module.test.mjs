import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, saveContact, removeContact, lastFour, ROLES, NO_FIRM } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

function plan() {
  const p = familyPlan("2026-10-31");
  p.insurance = { policies: [{ id: "pol-h", name: "House policy", kind: "home", insurer: "Acme Mutual" }, { id: "pol-a", name: "Car policy", kind: "auto", insurer: "acme mutual" }, { id: "pol-l", name: "Term life", kind: "term" }] };
  return p;
}

test("only the last four digits are kept", () => {
  assert.equal(lastFour("1234"), "1234"); assert.equal(lastFour(" 12-34 "), "1234");
  assert.equal(lastFour("12345"), "", "a longer number is refused, never cut down"); assert.equal(lastFour("12a4"), ""); assert.equal(lastFour(""), ""); assert.equal(lastFour(null), "");
});

test("suggestions: each bank on your accounts and each insurer on your policies, grouped by name, until someone handles them", () => {
  const p = plan();
  const d = compute(p);
  assert.equal(d.empty, true);
  const firms = d.suggestions.map((s) => [s.role, s.firm, s.accountIds.length + s.policyIds.length]);
  assert.ok(firms.some(([r, f]) => r === "bank" && f === "Chase"));
  assert.deepEqual(firms.find(([, f]) => f === "Acme Mutual"), ["insurer", "Acme Mutual", 2], "the same insurer in other capitals is one suggestion");
  assert.equal(d.suggestions.find((s) => s.firm === "Acme Mutual").what, "House policy, Car policy");
  // a contact for the firm (by name) or one that handles the account takes the suggestion away
  saveContact(p, { id: "c1", role: "insurer", firm: "ACME Mutual" });
  saveContact(p, { id: "c2", role: "other", name: "Pat", accountIds: [p.accounts.find((a) => a.institution === "Chase").id] });
  const e = compute(p);
  assert.ok(!e.suggestions.some((s) => s.firm === "Acme Mutual"));
  assert.equal(e.suggestions.find((s) => s.firm === "Chase").what, "Visa card", "Pat handles the checking account; the Chase card is still offered");
});

test("contacts: cleaned, linked to accounts and policies with last four digits, grouped by role in order", () => {
  const p = plan();
  const chk = p.accounts.find((a) => a.institution === "Chase").id;
  const c = saveContact(p, { id: "c1", role: "bank", firm: " Chase ", phone: "555 0100", accountIds: [chk, chk, "gone"], last4: { [chk]: "4321", gone: "1", other: "123456" } });
  assert.deepEqual(c.accountIds, [chk, "gone"]); assert.deepEqual(c.last4, { [chk]: "4321" }, "bad numbers are dropped");
  saveContact(p, { id: "c2", role: "emergency", name: "Sam", email: "sam@example.com" });
  saveContact(p, { id: "c3", role: "nonsense", name: "Lee", policyIds: ["pol-l"] });
  const d = compute(p);
  assert.deepEqual(d.contacts.map((x) => [x.id, x.role]), [["c2", "emergency"], ["c1", "bank"], ["c3", "other"]]);
  assert.deepEqual(d.contacts[1].links, [{ kind: "account", id: chk, name: "Chase checking", what: "Checking", last4: "4321" }], "a link to a removed account is not shown");
  assert.deepEqual(d.contacts[2].links.map((l) => [l.kind, l.name, l.what]), [["policy", "Term life", "Term life"]]);
  assert.deepEqual(d.byRole.map((g) => g.role), ["emergency", "bank", "other"]);
  assert.equal(d.contacts[1].roleLabel, ROLES.bank.label);
  // saving again by id replaces
  saveContact(p, { id: "c1", role: "bank", firm: "Chase", phone: "555 0199" });
  assert.equal(p.contacts.filter((x) => x.id === "c1").length, 1); assert.equal(compute(p).contacts.find((x) => x.id === "c1").phone, "555 0199");
  assert.equal(removeContact(p, "c1"), true); assert.equal(removeContact(p, "c1"), false);
});

test("things worth a look: no one to call in an emergency, no way to reach someone, accounts tied to no one", () => {
  const p = plan();
  p.accounts.push({ id: "x", name: "Cash box", type: "cash" });
  saveContact(p, { id: "c1", role: "advisor", name: "Riley" });
  const d = compute(p);
  assert.deepEqual(d.checks.map((c) => c.id), ["emergency", "reach", "unlinked"]);
  assert.match(d.checks[1].text, /^Riley has no phone or email/);
  assert.match(d.checks[2].text, /^1 account or policy is not tied/, "the term life policy names no insurer; the house and the cash box have no firm behind them (NO_FIRM)");
  saveContact(p, { id: "c2", role: "emergency", name: "Sam", phone: "555 0100", policyIds: ["pol-l"] });
  saveContact(p, { id: "c1", role: "advisor", name: "Riley", email: "r@example.com" });
  assert.deepEqual(compute(p).checks, []);
  assert.deepEqual(NO_FIRM, ["property", "vehicle", "cash", "other_asset"]);
  assert.deepEqual(compute(emptyPlan()), { contacts: [], byRole: [], suggestions: [], checks: [{ id: "emergency", text: compute(emptyPlan()).checks[0].text }], empty: true });
});
