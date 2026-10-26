import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePayee, prettyPayee, matchRule, applyRules, ruleFor, compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("normalizePayee strips statement noise so the same merchant compares equal", () => {
  assert.equal(normalizePayee("AMAZON MKTPL*2K3AB1 AMZN.COM/BILL WA"), "amazon mktpl amzn wa", ".com/bill is a web address, dropped");
  assert.equal(normalizePayee("KROGER #0421 DAYTON OH"), "kroger dayton oh");
  assert.equal(normalizePayee("NETFLIX.COM 866-579-7172 CA"), "netflix ca");
  assert.equal(normalizePayee("POS DEBIT 09/01 STARBUCKS 1234"), "starbucks");
  assert.equal(normalizePayee(""), "");
  assert.equal(prettyPayee("KROGER #0421 DAYTON OH"), "Kroger Dayton");
  assert.equal(prettyPayee("Zelle payment to Bo Rivera 20812"), "Zelle Rivera");
  assert.equal(prettyPayee("12345"), "12345", "nothing left after cleaning: keep the raw text");
});
test("matchRule: contains, direction, account", () => {
  const tx = { payee: "Netflix", rawPayee: "NETFLIX.COM 866-579-7172 CA", amount: -15.49, accountId: "chk" };
  assert.equal(matchRule({ contains: "netflix", category: "subscriptions" }, tx), true);
  assert.equal(matchRule({ contains: "NetFlix.com", category: "subscriptions" }, tx), true, "the rule text is normalised too");
  assert.equal(matchRule({ contains: "netflix", direction: "in", category: "x" }, tx), false);
  assert.equal(matchRule({ contains: "netflix", direction: "out", category: "x" }, tx), true);
  assert.equal(matchRule({ contains: "netflix", accountId: "visa", category: "x" }, tx), false);
  assert.equal(matchRule({ contains: "", category: "x" }, tx), false);
  assert.equal(matchRule({ contains: "hulu", category: "x" }, tx), false);
});
test("applyRules files uncategorised transactions, renames payee, counts hits, leaves categorised alone unless forced", () => {
  const rules = [{ id: "r1", contains: "kroger", category: "groceries", payee: "Kroger" }, { id: "r2", contains: "kroger", category: "other" }];
  const txs = [
    { id: "a", payee: "Kroger Dayton", rawPayee: "KROGER #0421 DAYTON OH", amount: -50, category: "" },
    { id: "b", payee: "Kroger Dayton", rawPayee: "KROGER #0421 DAYTON OH", amount: -20, category: "dining" },
    { id: "c", payee: "Shell", rawPayee: "SHELL OIL 57442", amount: -48, category: "" },
  ];
  const r = applyRules(rules, txs);
  assert.equal(r.changed, 1);
  assert.deepEqual(r.hits, { r1: 1 }, "the first matching rule wins");
  assert.equal(r.txs[0].category, "groceries"); assert.equal(r.txs[0].payee, "Kroger"); assert.equal(r.txs[0].rawPayee, "KROGER #0421 DAYTON OH");
  assert.equal(r.txs[1].category, "dining", "already categorised: untouched");
  assert.equal(r.txs[2].category, "");
  assert.equal(txs[0].category, "", "input not mutated");
  const forced = applyRules(rules, txs, { force: true });
  assert.equal(forced.txs[1].category, "groceries"); assert.equal(forced.changed, 2);
});
test("ruleFor builds the rule the Categorise page saves", () => {
  const r = ruleFor("AMAZON MKTPL*2K3AB1 AMZN.COM/BILL WA", "shopping");
  assert.equal(r.contains, "amazon mktpl amzn"); assert.equal(r.category, "shopping"); assert.equal(r.payee, "Amazon Mktpl Amzn"); assert.equal(r.direction, "any");
  assert.equal(matchRule(r, { rawPayee: "AMAZON MKTPL*9Z9 AMZN.COM/BILL WA", payee: "x", amount: -1 }), true, "next month's Amazon line matches");
});
test("compute lists rules with match counts and how many uncategorised they would fix", () => {
  const p = emptyPlan();
  p.rules.push({ id: "r1", contains: "kroger", category: "groceries" });
  p.transactions.push({ id: "a", payee: "Kroger", rawPayee: "KROGER 1", amount: -5, category: "" }, { id: "b", payee: "Kroger", rawPayee: "KROGER 2", amount: -5, category: "groceries" }, { id: "c", payee: "Shell", rawPayee: "SHELL", amount: -5, category: "" });
  const d = compute(p);
  assert.equal(d.count, 1); assert.equal(d.rules[0].matches, 2); assert.equal(d.rules[0].categoryLabel, "Groceries"); assert.equal(d.uncategorised, 2); assert.equal(d.wouldFix, 1);
});
