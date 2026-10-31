import { test } from "node:test";
import assert from "node:assert/strict";
import { whenOf, listOf, diffPlans, diffCopy, asPlan, unstamped, sectionLabel, sizeOf, changeWords, compute, SECTIONS } from "./compute.js";
import { migrate } from "../../../core/schema/migrate.js";
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
  assert.deepEqual(diffPlans(p, q).map((x) => [x.key, x.label, x.kind, x.added]), [["papers", "Where papers are", "records", 1], ["somethingNew", "something new", "fields", 0]]);
  assert.equal(diffPlans(p, q).find((x) => x.key === "somethingNew").changed, 1, "a section only in one plan counts its details");
  assert.equal(SECTIONS.transactions, "Transactions");
});

test("a plan's size at a glance", () => {
  const s = sizeOf(familyPlan("2026-10-31"));
  assert.equal(s.people, 3); assert.ok(s.accounts > 5); assert.equal(typeof s.transactions, "number");
  assert.deepEqual(sizeOf(null), { people: 0, accounts: 0, transactions: 0, goals: 0, savedAt: null });
  assert.deepEqual(compute(emptyPlan()).size.people, 0);
});

test("the plan's name, currency and language count as a change; the stamps every save writes do not", () => {
  const a = emptyPlan(), b = structuredClone(a);
  b.meta.updatedAt = "2099-01-01T00:00:00Z"; b.meta.createdAt = "2099-01-01T00:00:00Z"; b.meta.updatedBy = "Phone";
  assert.deepEqual(diffPlans(a, b), [], "only stamps differ");
  b.meta.currency = "EUR";
  assert.deepEqual(diffPlans(a, b).map((x) => [x.key, x.label, changeWords(x)]), [["meta", "Plan name and currency", "1 detail changed"]]);
  b.meta.name = "Our plan";
  assert.equal(changeWords(diffPlans(a, b)[0]), "2 details changed");
  assert.equal(unstamped(null), null);
  assert.deepEqual(unstamped({ meta: { updatedAt: "x", name: "n" } }), { meta: { name: "n" } });
});

test("a copy saved before the app added a section or a default shows no change nobody made; a missing section and an empty one are the same", () => {
  const old = familyPlan("2026-10-31");
  delete old.reviews; delete old.investments; delete old.taxes.hsa; delete old.assumptions.emergencyMonths; delete old.debtPlan;
  const now = migrate(structuredClone(old));
  assert.ok(diffPlans(old, now).length > 0, "compared raw, the defaults the app filled in look like changes");
  assert.deepEqual(diffCopy(old, now), [], "brought up to date first: nothing");
  const before = JSON.stringify(old);
  diffCopy(old, now);
  assert.equal(JSON.stringify(old), before, "the copy itself is not changed");
  assert.deepEqual(diffPlans({}, { reviews: [], notes: "", importProfiles: {} }), []);
  now.reviews = [{ month: "2026-10", at: "2026-10-31", note: "" }];
  assert.deepEqual(diffCopy(old, now).map((x) => x.key), ["reviews"], "a real change still shows");
});

test("a list with something that is not a record in it (a null left by a hand edit) never breaks the comparison", () => {
  const a = { accounts: [{ id: "a", name: "A" }] }, b = { accounts: [{ id: "a", name: "A" }, null] };
  assert.deepEqual(diffPlans(a, b).map((x) => [x.key, x.kind, x.added, x.removed]), [["accounts", "records", 1, 0]]);
  assert.deepEqual(diffPlans(b, a).map((x) => [x.key, x.removed]), [["accounts", 1]]);
  assert.doesNotThrow(() => diffPlans({ goals: [{ id: "g" }, 3, "x"] }, { goals: [{ id: "g" }] }));
});

test("every section of a plan has a name in plain words; a copy the PC sends is a plan or nothing", () => {
  for (const k of Object.keys(emptyPlan())) if (k !== "schemaVersion") assert.ok(SECTIONS[k], `no plain name for ${k}`);
  assert.equal(sectionLabel("debtPlan"), "Debt payoff plan");
  assert.equal(sectionLabel("brandNewThing"), "brand new thing");
  assert.equal(changeWords({ kind: "fields", changed: 2 }), "2 details changed");
  assert.equal(asPlan(null), null); assert.equal(asPlan([]), null); assert.equal(asPlan({ notes: "x" }), null); assert.equal(asPlan(0), null);
  const p = emptyPlan();
  assert.equal(asPlan(p), p);
});
