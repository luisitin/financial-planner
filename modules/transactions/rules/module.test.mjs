import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePayee, prettyPayee, matchRule, applyRules, ruleFor, ruleText, compute } from "./compute.js";
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
  assert.equal(r.contains, "amazon mktpl", "cut at the code: the words before it"); assert.equal(r.category, "shopping"); assert.equal(r.payee, "Amazon Mktpl"); assert.equal(r.wholeWords, true); assert.equal(r.direction, "any");
  assert.equal(matchRule(r, { rawPayee: "AMAZON MKTPL*9Z9 AMZN.COM/BILL WA", payee: "x", amount: -1 }), true, "next month's Amazon line matches");
});
test("compute lists rules with match counts and how many uncategorised they would fix", () => {
  const p = emptyPlan();
  p.rules.push({ id: "r1", contains: "kroger", category: "groceries" });
  p.transactions.push({ id: "a", payee: "Kroger", rawPayee: "KROGER 1", amount: -5, category: "" }, { id: "b", payee: "Kroger", rawPayee: "KROGER 2", amount: -5, category: "groceries" }, { id: "c", payee: "Shell", rawPayee: "SHELL", amount: -5, category: "" });
  const d = compute(p);
  assert.equal(d.count, 1); assert.equal(d.rules[0].matches, 2); assert.equal(d.rules[0].categoryLabel, "Groceries"); assert.equal(d.uncategorised, 2); assert.equal(d.wouldFix, 1);
});

test("ruleText: the shop's own name, so a rule saved from one file files the next (another branch, the card's file)", () => {
  assert.equal(ruleText("KROGER #0388 DAYTON OH"), "kroger");
  assert.equal(ruleText("SHELL OIL 57442 DAYTON OH"), "shell oil", "the words before the code, two at most");
  assert.equal(ruleText("SOUTHWEST AIRLINES 52621 DALLAS TX"), "southwest airlines", "never just 'southwest' (Southwest Gas)");
  assert.equal(ruleText("NETFLIX.COM LOS GATOS CA"), "netflix");
  assert.equal(ruleText("BEST BUY 00012 DAYTON OH"), "best buy", "a short first word keeps the second");
  assert.equal(ruleText("COMCAST CABLE COMM"), "comcast cable comm", "no code, no state: up to three words, as before");
  assert.equal(ruleText("Online Transfer to SAV 1234"), "transfer to sav", "a word that only says what kind of line it is keeps the words after it");
  const r = ruleFor("KROGER #0388 DAYTON OH", "groceries");
  for (const raw of ["KROGER #0421", "KROGER #0388 CENTERVILLE OH", "KROGER 0421 DAYTON OH"]) assert.equal(matchRule(r, { rawPayee: raw, payee: "x", amount: -20 }), true, raw);
  assert.equal(matchRule(ruleFor("SHELL OIL 57442 DAYTON OH", "transport"), { rawPayee: "SHELL OIL 12345 XENIA OH", payee: "x", amount: -40 }), true);
  assert.equal(matchRule(ruleFor("NETFLIX.COM LOS GATOS CA", "subscriptions"), { rawPayee: "NETFLIX.COM", payee: "x", amount: -15 }), true);
});
test("review: rules made from a bank line match whole words; a payment service keeps its shop; a common first word keeps the second", async () => {
  const { ruleFor, ruleText, ruleName, matchRule, payeeWords } = await import("./compute.js");
  const shell = ruleFor("SHELL OIL 57442 DAYTON OH", "transport");
  assert.equal(shell.contains, "shell oil"); assert.equal(shell.wholeWords, true); assert.equal(shell.payee, "Shell Oil");
  assert.equal(matchRule(shell, { rawPayee: "ZELLE TO SHELLEY JONES", amount: -50 }), false, "not inside another word");
  assert.equal(matchRule(shell, { rawPayee: "SHELL OIL 12345 CENTERVILLE OH", amount: -40 }), true, "another branch");
  assert.equal(matchRule({ contains: "shell", category: "x" }, { rawPayee: "ZELLE TO SHELLEY", amount: -1 }), true, "a rule typed by hand still matches any part, as before");
  assert.equal(matchRule({ contains: "shell", wholeWords: true, category: "x" }, { rawPayee: "ZELLE TO SHELLEY JONES", amount: -1 }), false, "whole words only");
  for (const [from, other] of [["SOUTHWEST AIRLINES 52621 DALLAS TX", "SOUTHWEST GAS CORP 1234"], ["FRONTIER AIRLINES 4221234 DENVER CO", "FRONTIER COMM 80055"], ["DELTA AIR 0062 ATLANTA GA", "DELTA DENTAL INS 4411"]])
    assert.equal(matchRule(ruleFor(from, "travel"), { rawPayee: other, amount: -80 }), false, `${from} never files ${other}`);
  assert.equal(payeeWords("PAYPAL *NETFLIX"), "paypal netflix");
  const pp = ruleFor("PAYPAL *NETFLIX", "subscriptions");
  assert.equal(pp.contains, "paypal netflix"); assert.equal(pp.payee, "Netflix");
  assert.equal(matchRule(pp, { rawPayee: "PAYPAL *EBAY", amount: -80 }), false, "another PayPal shop is not a subscription");
  assert.equal(matchRule(pp, { rawPayee: "PAYPAL *NETFLIX", amount: -15.49 }), true);
  assert.equal(ruleName("SQ *BLUE BOTTLE 1234"), "Blue Bottle");
  assert.equal(ruleText("AMERICAN AIRLINES 0012345"), "american airlines", "never just 'american' (American Express)");
  assert.equal(ruleName("ONLINE TRANSFER TO SAV 1234"), "Transfer Sav", "a kind-of-line rule keeps the old name");
  assert.equal(ruleText("UBER *EATS"), "uber eats");
});
