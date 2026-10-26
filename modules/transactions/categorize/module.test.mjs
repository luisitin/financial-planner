import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, buildPrompt, parseSuggestions } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("empty plan: nothing to file, share 1", () => {
  const d = compute(emptyPlan());
  assert.equal(d.groups.length, 0); assert.equal(d.share, 1); assert.equal(d.uncategorised, 0);
});
test("groups the uncategorised by payee, most frequent first, with suggestions from history and rules", () => {
  const p = samplePlan();
  p.rules.push({ id: "r", contains: "netflix", category: "subscriptions" });
  const d = compute(p);
  assert.equal(d.uncategorised, 4); assert.equal(d.done, 12); assert.ok(Math.abs(d.share - 12 / 16) < 1e-9);
  assert.equal(d.groups.length, 4);
  const amazon = d.groups.find((g) => g.payee === "Amazon Mktpl Amzn");
  assert.equal(amazon.count, 1);
  assert.equal(amazon.suggestion.category, "shopping", "the other Amazon line was filed as shopping");
  assert.ok(amazon.suggestion.why.includes("earlier"));
  const netflix = d.groups.find((g) => g.payee === "Netflix");
  assert.equal(netflix.suggestion.category, "subscriptions"); assert.equal(netflix.suggestion.why, "a rule matches");
  const payment = d.groups.find((g) => g.payee === "Payment Thank You");
  assert.equal(payment.suggestion, null); assert.equal(payment.in, true);
  assert.deepEqual(d.groups.map((g) => g.count), [1, 1, 1, 1]);
  assert.equal(d.groups[0].payee, "Chase Credit Crd Autopay", "ties broken by amount");
});
test("the AI prompt carries only payee names and category ids; answers are checked against the list", () => {
  const p = samplePlan();
  const d = compute(p);
  const pr = buildPrompt(p, d.groups);
  assert.ok(pr.system.includes("JSON"));
  assert.ok(pr.user.includes("groceries: Groceries"));
  assert.ok(pr.user.includes("NETFLIX"));
  assert.ok(!pr.user.includes("15.49"), "no amounts");
  assert.ok(!pr.user.includes("Chase checking"), "no account names");
  assert.ok(!pr.user.includes("transfer:"), "transfer is not offered");
  const got = parseSuggestions(p, 'Sure! [{"payee":"NETFLIX","category":"subscriptions","confidence":0.9},{"payee":"X","category":"not-a-category","confidence":1}]');
  assert.deepEqual(got, { netflix: { category: "subscriptions", confidence: 0.9 } });
  assert.deepEqual(parseSuggestions(p, "no json here"), {});
  assert.deepEqual(parseSuggestions(p, "[not json"), {});
});
