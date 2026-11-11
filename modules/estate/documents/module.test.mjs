import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, KINDS, REVIEW_YEARS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const item = (d, key) => d.items.find((x) => x.key === key);

test("an empty plan: one adult's papers, no guardian", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.ok(!d.items.some((x) => x.kind === "guardian"));
  assert.equal(d.required, Object.values(KINDS).filter((k) => !k.optional && k.per === "adult").length);
  assert.equal(d.done, 0);
});

test("the family: each adult's five papers, a guardian for Cy, nothing signed yet", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.required, 2 * 5 + 1); assert.equal(d.done, 0);
  assert.ok(item(d, "will:p-ana") && item(d, "will:p-bo") && item(d, "guardian"));
  assert.deepEqual(d.minors, ["Cy"]); assert.match(d.warnings[0], /No guardian is named for Cy/);
});

test("signed papers: counted; old ones and ones signed before a child was born are flagged; the guardian warning goes", () => {
  const p = familyPlan(TODAY);
  p.estate.documents = [
    { id: "1", kind: "will", personId: "p-ana", status: "done", updatedAt: "2019-04-01" },
    { id: "2", kind: "will", personId: "p-bo", status: "done", updatedAt: "2024-01-10" },
    { id: "3", kind: "guardian", personId: "", status: "done", updatedAt: "2024-01-10" },
    { id: "4", kind: "poaFinance", personId: "p-ana", done: true, updatedAt: "2025-02-02" },
    { id: "5", kind: "hipaa", personId: "p-bo", status: "started" },
  ];
  const d = compute(p, { today: TODAY });
  assert.equal(d.done, 4);
  const ana = item(d, "will:p-ana");
  assert.equal(ana.stale, true); assert.ok(ana.reasons.includes(`signed 7 years ago`)); assert.ok(ana.reasons.includes("Cy was born after it was signed"));
  assert.equal(item(d, "will:p-bo").stale, false);
  assert.equal(item(d, "poaFinance:p-ana").status, "done", "the older done flag still counts");
  assert.equal(item(d, "hipaa:p-bo").status, "started");
  assert.equal(d.warnings.length, 0);
  assert.ok(REVIEW_YEARS === 5);
});

test("a grown child needs no guardian", () => {
  const p = familyPlan(TODAY); p.household.people.find((q) => q.id === "p-cy").birthDate = "2000-01-01";
  assert.ok(!compute(p, { today: TODAY }).items.some((x) => x.kind === "guardian"));
});

test("the first adult left unnamed (\"Me\"): a reason to look again says you, with the verb to match", () => {
  const p = familyPlan(TODAY);
  const me = p.household.people.find((x) => x.id === "p-ana"); me.name = "Me"; me.birthDate = "2020-01-01";   // a date typed wrong
  p.estate.documents = [{ id: "1", kind: "will", personId: "p-ana", status: "done", updatedAt: "2019-04-01" }];
  const reasons = item(compute(p, { today: TODAY }), "will:p-ana").reasons;
  assert.ok(reasons.includes("you were born after it was signed"), reasons.join(" | "));
  assert.ok(reasons.includes("Cy was born after it was signed"), "any other name as before");
});

// ---- the first screen's one action (stress test MR-7, 2026-11-11)
import { nextPaper } from "./compute.js";
test("nextPaper: the guardian first when children have none, else the first essential not signed, else nothing", () => {
  const it = (kind, o = {}) => ({ key: o.personName ? `${kind}:${o.personName}` : kind, kind, label: kind[0].toUpperCase() + kind.slice(1), status: "none", optional: false, ...o });
  assert.deepEqual(nextPaper({ items: [it("will", { personName: "Ana" }), it("guardian")] }), { key: "guardian", kind: "guardian", label: "Name a guardian in your will" });
  assert.equal(nextPaper({ items: [it("will", { personName: "Ana" }), it("guardian", { status: "done" })] }).label, "Start here: Will for Ana");
  assert.equal(nextPaper({ items: [it("will", { personName: "Me" })] }).label, "Start here: Will for you", "Get started's unnamed adult reads 'you'");
  assert.equal(nextPaper({ items: [it("will", { status: "done" }), it("trust", { optional: true })] }), null, "optional papers are never the next one");
  assert.equal(nextPaper({ items: [] }), null);
});
