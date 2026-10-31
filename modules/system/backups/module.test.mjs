import { test } from "node:test";
import assert from "node:assert/strict";
import { whenOf, listOf, diffPlans, sizeOf, changeWords, compute, SECTIONS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("a copy's time from its name (the server stamps UTC), and the list newest first", () => {
  assert.equal(whenOf("plan-2026-10-31T09-30-05.json"), "2026-10-31T09:30:05Z");
  assert.equal(whenOf("plan-broken.json"), null); assert.equal(whenOf("notes.txt"), null); assert.equal(whenOf(null), null);
  assert.deepEqual(listOf(["plan-2026-10-30T10-00-00.json", "plan-broken.json", "plan-2026-10-31T09-30-00.json"]).map((b) => b.name), ["plan-2026-10-31T09-30-00.json", "plan-2026-10-30T10-00-00.json"]);
  assert.deepEqual(listOf(undefined), []);
});

test("what changed between a copy and now: records added, removed and changed; details of an object; a value", () => {
  const older = familyPlan("2026-10-31");
  const newer = structuredClone(older);
  newer.accounts.push({ id: "new", name: "New savings", type: "savings", balance: 100 });
  newer.accounts = newer.accounts.filter((a) => a.id !== "a-visa");
  newer.accounts.find((a) => a.id === "a-chk").balance += 50;
  newer.household.state = "OR";
  newer.notes = "a note";
  newer.meta.updatedAt = "2099-01-01T00:00:00Z";   // always differs: never counted
  const d = diffPlans(older, newer);
  const by = Object.fromEntries(d.map((x) => [x.key, x]));
  assert.deepEqual(by.accounts, { key: "accounts", label: "Accounts", kind: "records", added: 1, removed: 1, changed: 1 });
  assert.deepEqual(by.household, { key: "household", label: "People and household", kind: "fields", added: 0, removed: 0, changed: 1 });
  assert.equal(by.notes.kind, "value"); assert.ok(!by.meta);
  assert.deepEqual(d.map((x) => x.key), ["household", "accounts", "notes"], "in the order of SECTIONS");
  assert.equal(changeWords(by.accounts), "1 added, 1 removed, 1 changed");
  assert.equal(changeWords(by.household), "1 detail changed"); assert.equal(changeWords(by.notes), "changed");
  assert.deepEqual(diffPlans(older, structuredClone(older)), [], "the same plan: nothing");
  // a section only in one plan, records keyed by "key" (papers), and a section the app does not name
  const p = emptyPlan(), q = emptyPlan();
  q.papers = [{ key: "birth:p1", where: "safe" }];
  q.somethingNew = { a: 1 };
  assert.deepEqual(diffPlans(p, q).map((x) => [x.key, x.label, x.kind, x.added]), [["papers", "Where papers are", "records", 1], ["somethingNew", "somethingNew", "fields", 0]]);
  assert.equal(diffPlans(p, q).find((x) => x.key === "somethingNew").changed, 1, "a section only in one plan counts its details");
  assert.equal(SECTIONS.transactions, "Transactions");
});

test("a plan's size at a glance", () => {
  const s = sizeOf(familyPlan("2026-10-31"));
  assert.equal(s.people, 3); assert.ok(s.accounts > 5); assert.equal(typeof s.transactions, "number");
  assert.deepEqual(sizeOf(null), { people: 0, accounts: 0, transactions: 0, goals: 0, savedAt: null });
  assert.deepEqual(compute(emptyPlan()).size.people, 0);
});
