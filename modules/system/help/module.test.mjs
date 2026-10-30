import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, directory, startSteps, FAQ } from "./compute.js";
import { GROUPS } from "../../../core/groups.js";
import MODULES from "../../registry.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";

test("an empty plan: none of the first steps done but the debts one (no debts to detail)", () => {
  const d = compute(emptyPlan());
  assert.equal(d.total, 7);
  assert.deepEqual(d.steps.filter((s) => s.done).map((s) => s.id), ["debts"]);
});

test("the family has every basic", () => {
  const d = compute(familyPlan(TODAY));
  assert.equal(d.done, d.total);
});

test("a debt without its rate or payment leaves that step open", () => {
  const p = familyPlan(TODAY);
  p.debts = p.debts.filter((x) => x.accountId !== "a-car");
  assert.equal(startSteps(p).find((s) => s.id === "debts").done, false);
});

test("every step points at a page that exists", async () => {
  const keys = new Set(MODULES.map((m) => `${m.group}/${m.id}`));
  for (const s of startSteps(emptyPlan())) assert.ok(keys.has(s.go.join("/")), s.go.join("/"));
});

const manifests = [
  { group: "debt", id: "payoff", title: "Pay off debt", purpose: "Avalanche or snowball, and when each debt is gone.", status: "usable", order: 10 },
  { group: "debt", id: "consolidation", title: "Consolidation", purpose: "Roll cards into one cheaper loan.", status: "usable", order: 20 },
  { group: "career", id: "salary", title: "Salary", purpose: "What your job pays against the market.", status: "planned", placeholder: true, order: 10 },
  { group: "system", id: "secret", title: "Hidden page", purpose: "Turned off.", status: "usable", enabled: false },
];

test("directory: sections in sidebar order, pages in their order, ready counted, switched-off pages left out", () => {
  const d = directory(manifests, GROUPS);
  assert.deepEqual(d.sections.map((s) => s.id), ["debt", "career"]);
  assert.deepEqual(d.sections[0].pages.map((p) => p.id), ["payoff", "consolidation"]);
  assert.equal(d.sections[0].ready, 2); assert.equal(d.sections[1].ready, 0);
  assert.ok(d.sections[1].pages[0].planned);
});

test("directory with a query: matches only, best first", () => {
  const d = directory(manifests, GROUPS, "debt");
  assert.deepEqual(d.results.map((p) => p.id), ["payoff", "consolidation"], "the section's name matches both");
  assert.deepEqual(directory(manifests, GROUPS, "cards").results.map((p) => p.id), ["consolidation"]);
  assert.equal(directory(manifests, GROUPS, "zzz").results.length, 0);
  assert.equal(directory(manifests, GROUPS, "turned off").results.length, 0);
});

test("questions are plain and answered", () => {
  assert.ok(FAQ.length >= 6);
  for (const f of FAQ) { assert.ok(f.q.length > 5 && f.a.length > 20); assert.ok(!/\b(PIA|RMD|MAGI|DTI|IRMAA)\b/.test(f.a), f.q); }
});
