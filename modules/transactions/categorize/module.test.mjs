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

test("a first bank file: well-known shops and moves between your own accounts come with a guess, marked as one", async () => {
  const { compute, shopGuess } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 1000 }, { id: "s", name: "Savings", type: "savings", balance: 500 }, { id: "v", name: "Visa", type: "credit", balance: -300 });
  const tx = (id, rawPayee, amount) => ({ id, date: "2026-09-02", amount, payee: rawPayee, rawPayee, accountId: "c", category: "" });
  p.transactions.push(tx("a", "KROGER #0388 DAYTON OH", -54.12), tx("b", "SHELL OIL 57442", -40), tx("c", "Online Transfer to SAV 1234", -500), tx("d", "CHASE CREDIT CRD AUTOPAY", -640.22), tx("e", "SHELLEY JONES", -20), tx("f", "ACME CORP PAYROLL", 2000));
  const by = Object.fromEntries(compute(p).groups.map((g) => [g.rawPayee, g.suggestion]));
  assert.equal(by["KROGER #0388 DAYTON OH"].category, "groceries"); assert.equal(by["KROGER #0388 DAYTON OH"].guess, true);
  assert.equal(by["SHELL OIL 57442"].category, "transport");
  assert.equal(by["Online Transfer to SAV 1234"].category, "transfer");
  assert.equal(by["CHASE CREDIT CRD AUTOPAY"].category, "transfer");
  assert.equal(by["SHELLEY JONES"], null, "whole words only");
  assert.equal(by["ACME CORP PAYROLL"], null);
  assert.equal(shopGuess("NETFLIX.COM"), "subscriptions");
  p.accounts = p.accounts.filter((a) => a.type === "checking");
  assert.equal(compute(p).groups.find((g) => g.rawPayee === "CHASE CREDIT CRD AUTOPAY").suggestion, null, "no card in the plan: not called a transfer");
});
test("review: guesses try the longest name first and leave unclear names alone; loans and people are not transfers; PayPal shops are separate payees", async () => {
  const { shopGuess, transferGuess, compute: cat } = await import("./compute.js");
  assert.equal(shopGuess("UBER EATS"), "dining"); assert.equal(shopGuess("UBER *EATS"), "dining"); assert.equal(shopGuess("UBER *TRIP"), "transport");
  assert.equal(shopGuess("FRONTIER AIRLINES 4221234 DENVER CO"), null); assert.equal(shopGuess("SPECTRUM HEALTH 0042"), null); assert.equal(shopGuess("MARATHON PETRO 123"), null);
  const plan = { accounts: [{ type: "savings" }, { type: "credit" }] };
  assert.equal(transferGuess("NAVY FEDERAL CREDIT UNION LOAN PMT", plan, false), false, "a loan payment is spending");
  assert.equal(transferGuess("ZELLE TO SAVANNAH M", plan, false), false, "a person called Savannah");
  assert.equal(transferGuess("ONLINE TRANSFER TO SAV 1234", plan, false), true);
  assert.equal(transferGuess("CHASE CREDIT CRD AUTOPAY", plan, false), true);
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.transactions.push({ id: "1", date: "2026-10-01", amount: -15.49, payee: "PAYPAL *NETFLIX", rawPayee: "PAYPAL *NETFLIX", accountId: "c", category: "" }, { id: "2", date: "2026-10-02", amount: -80, payee: "PAYPAL *EBAY", rawPayee: "PAYPAL *EBAY", accountId: "c", category: "" });
  assert.equal(cat(p).groups.length, 2);
});
