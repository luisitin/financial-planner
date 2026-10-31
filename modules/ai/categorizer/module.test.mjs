import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, groupsFor, batches, promptFor, readAnswer, review, applyChoices, band, keyOf, BATCH, BANDS } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { applyRules } from "../../transactions/rules/compute.js";

// the sample plan: Netflix, the card autopay, the card's "Payment Thank You" and one Amazon charge have no category;
// two transfers are linked; Kroger, rent, payroll and Shell are filed
test("the payees to ask about: not filed yet, or every payee; transfers left out; one group per payee, most first", () => {
  const p = samplePlan();
  const open = groupsFor(p, "open");
  assert.deepEqual(open.map((g) => g.payee).sort(), ["Amazon Mktpl Amzn", "Chase Credit Crd Autopay", "Netflix", "Payment Thank You"]);
  assert.ok(open.every((g) => g.filed === "" && g.count === 1));
  const all = groupsFor(p, "all");
  assert.ok(!all.some((g) => /transfer/i.test(g.payee)), "linked transfers are not asked about");
  const kroger = all.find((g) => g.payee === "Kroger");
  assert.equal(kroger.count, 3); assert.equal(kroger.filed, "groceries"); assert.equal(kroger.mixed, false); assert.equal(kroger.in, false);
  assert.ok(Math.abs(kroger.total - (-86.40 - 54.12 - 60)) < 1e-9);
  const amazon = all.find((g) => g.payee === "Amazon Mktpl Amzn");
  assert.equal(amazon.count, 2); assert.equal(amazon.filed, "shopping"); assert.equal(amazon.mixed, true, "one filed, one not");
  assert.equal(amazon.unfiled, 1); assert.equal(amazon.ways, 1); assert.equal(kroger.unfiled, 0); assert.equal(kroger.ways, 1);
  const pay = all.find((g) => /payroll/i.test(g.payee));
  assert.equal(pay.in, true); assert.equal(all[0], pay, "payroll and Kroger have 3 each; the larger total first");
  assert.equal(keyOf({ rawPayee: "AMAZON MKTPL*2K3 09/01", payee: "x" }), keyOf({ rawPayee: "Amazon Mktpl", payee: "y" }), "card codes and dates do not split a payee");
  const d = compute(p);
  assert.equal(d.total, 16); assert.equal(d.transfers, 2); assert.equal(d.open, 4);
  assert.deepEqual(d.scopes, { open: 4, all: all.length }); assert.deepEqual(d.questions, { open: 1, all: 1 });
  assert.deepEqual(compute(emptyPlan()), { total: 0, transfers: 0, open: 0, scopes: { open: 0, all: 0 }, questions: { open: 0, all: 0 } });
});

test("questions of 40 payees, in order; each question holds payee names only", () => {
  const groups = Array.from({ length: 95 }, (_, i) => ({ key: `p${i}`, payee: `Payee ${i}`, rawPayee: `PAYEE ${i}`, in: false }));
  const qs = batches(groups);
  assert.equal(BATCH, 40); assert.deepEqual(qs.map((q) => q.length), [40, 40, 15]); assert.equal(qs[2][0].key, "p80");
  assert.deepEqual(batches([]), []);
  const p = samplePlan();
  const q = promptFor(p, groupsFor(p, "all"));
  assert.match(q.user, /KROGER/); assert.match(q.user, /ACME CORP PAYROLL \(money in\)/);
  assert.ok(!/86\.4|1950|2026-|Chase checking|chk/.test(q.user), "no amounts, dates or accounts leave the device");
  assert.ok(!/transfer:/.test(q.user), "the transfer category is not offered");
});

test("the answer read back: categories the plan knows, confidence kept between 0 and 1, anything else dropped", () => {
  const p = samplePlan();
  const text = 'Here you go: [{"payee":"NETFLIX","category":"subscriptions","confidence":0.93},{"payee":"PAYMENT THANK YOU","category":"debt","confidence":1.4},{"payee":"KROGER","category":"not-a-category","confidence":0.9},{"payee":"SHELL OIL","category":"transport"}]';
  const a = readAnswer(p, text);
  assert.deepEqual(Object.keys(a).sort(), ["netflix", "shell oil", "thank you"], "keys are the payee without the bank's noise words (\"payment\")");
  assert.equal(a.netflix.confidence, 0.93); assert.equal(a["thank you"].confidence, 1, "capped at 1");
  assert.equal(a["shell oil"].confidence, 0.5, "no confidence given: the Categorise page's 0.5");
  assert.deepEqual(readAnswer(p, "sorry, I cannot"), {}); assert.deepEqual(readAnswer(p, "[not json"), {});
});

test("how sure, in words: 80% or more sure, 50% or more fairly sure, else unsure", () => {
  assert.deepEqual(BANDS, { sure: 0.8, fairly: 0.5 });
  assert.equal(band(0.8), "sure"); assert.equal(band(0.79), "fairly"); assert.equal(band(0.5), "fairly"); assert.equal(band(0.49), "unsure"); assert.equal(band(0), "unsure");
});

test("the review: changes first and surest first, agreements last; the summary counts each kind", () => {
  const p = samplePlan();
  const all = groupsFor(p, "all");
  const answers = {
    kroger: { category: "groceries", confidence: 0.95 },          // agrees
    "shell oil": { category: "dining", confidence: 0.6 },          // filed differently
    netflix: { category: "subscriptions", confidence: 0.9 },       // new, sure
    "thank you": { category: "debt", confidence: 0.3 },            // new, unsure ("Payment Thank You" without the bank's noise word)
    "amazon mktpl amzn": { category: "shopping", confidence: 0.85 },   // filed one way and not filed: not "the same"
  };
  const r = review(p, all, answers);
  assert.deepEqual(r.rows.map((x) => x.key), ["netflix", "amazon mktpl amzn", "shell oil", "thank you", "kroger"]);
  const k = r.rows.find((x) => x.key === "kroger");
  assert.equal(k.agrees, true); assert.equal(k.isNew, false); assert.equal(k.band, "sure"); assert.equal(k.label, "Groceries");
  assert.equal(r.rows.find((x) => x.key === "shell oil").agrees, false);
  assert.equal(r.rows.find((x) => x.key === "amazon mktpl amzn").agrees, false, "mixed: filing would change one of them");
  assert.deepEqual(r.summary, { asked: all.length, answered: 5, unanswered: all.length - 5, sure: 3, fairly: 1, unsure: 1, isNew: 2, differ: 2, agree: 1, sureNew: 1 });
  assert.deepEqual(review(p, all, {}).rows, []);
});

test("filing: the category on every transaction of the payee, its clean name, and one rule per payee for future imports", () => {
  const p = samplePlan();
  const open = groupsFor(p, "open");
  const netflix = open.find((g) => g.payee === "Netflix");
  let n = 0;
  const res = applyChoices(p, [{ ids: netflix.ids, rawPayee: netflix.rawPayee, category: "subscriptions" }, { ids: ["t9"], rawPayee: "CHASE CREDIT CRD AUTOPAY", category: "nope" }], { uid: () => `r${++n}`, today: "2026-10-31" });
  assert.deepEqual(res, { transactions: 1, payees: 1, rulesAdded: 1, rulesChanged: 0 }, "a category the plan does not know is skipped");
  const t6 = p.transactions.find((t) => t.id === "t6");
  assert.equal(t6.category, "subscriptions"); assert.equal(t6.rawPayee, "NETFLIX"); assert.equal(t6.payee, "Netflix");
  assert.equal(p.transactions.find((t) => t.id === "t9").category, "", "untouched");
  assert.deepEqual(p.rules, [{ id: "r1", contains: "netflix", category: "subscriptions", payee: "Netflix", direction: "any", hits: 1, createdAt: "2026-10-31" }]);
  // next month's import files itself
  const next = applyRules(p.rules, [{ id: "n1", payee: "NETFLIX.COM 10/05", amount: -15.49, category: "" }]);
  assert.equal(next.txs[0].category, "subscriptions");
  // the same payee filed again the same way: hits; another way: the rule follows the new choice
  const again = applyChoices(p, [{ ids: ["t6"], rawPayee: "NETFLIX", category: "subscriptions" }], { uid: () => "x" });
  assert.deepEqual(again, { transactions: 0, payees: 1, rulesAdded: 0, rulesChanged: 0 }); assert.equal(p.rules[0].hits, 2); assert.equal(p.rules.length, 1);
  const changed = applyChoices(p, [{ ids: ["t6"], rawPayee: "NETFLIX", category: "shopping" }], { uid: () => "y" });
  assert.deepEqual(changed, { transactions: 1, payees: 1, rulesAdded: 0, rulesChanged: 1 }); assert.equal(p.rules[0].category, "shopping"); assert.equal(p.rules.length, 1);
  assert.deepEqual(applyChoices(p, [], {}), { transactions: 0, payees: 0, rulesAdded: 0, rulesChanged: 0 });
});

test("rechecking what is filed: filing a payee filed two ways sets them all, and counts only what changed", () => {
  const p = samplePlan();
  const amazon = groupsFor(p, "all").find((g) => g.payee === "Amazon Mktpl Amzn");
  const res = applyChoices(p, [{ ids: amazon.ids, rawPayee: amazon.rawPayee, category: "shopping" }], { uid: () => "r1" });
  assert.equal(res.transactions, 1, "t11 was already shopping, t12 was not filed");
  assert.deepEqual(p.transactions.filter((t) => amazon.ids.includes(t.id)).map((t) => t.category), ["shopping", "shopping"]);
  assert.equal(p.rules[0].hits, 2);
});
