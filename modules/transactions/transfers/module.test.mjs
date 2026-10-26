import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, findPairs } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("empty plan", () => {
  const d = compute(emptyPlan());
  assert.equal(d.pairs.length, 0); assert.equal(d.linked.length, 0); assert.equal(d.total, 0);
});
test("finds the unlinked card payment pair, lists the linked savings transfer, ignores same-account matches", () => {
  const p = samplePlan();
  const d = compute(p);
  assert.equal(d.suggested, 1);
  assert.equal(d.pairs[0].out.id, "t9"); assert.equal(d.pairs[0].in.id, "t10"); assert.equal(d.pairs[0].gap, 1);
  assert.equal(d.pairs[0].out.accountName, "Chase checking"); assert.equal(d.pairs[0].in.accountName, "Visa card");
  assert.equal(d.count, 1); assert.equal(d.linked[0].transferId, "x1"); assert.equal(d.linked[0].out.id, "t7"); assert.equal(d.linked[0].in.id, "t8");
});
test("window, one use per transaction, wordy descriptions rank first", () => {
  const txs = [
    { id: "o1", accountId: "a", date: "2026-09-01", amount: -100, payee: "Transfer to B" },
    { id: "o2", accountId: "a", date: "2026-09-02", amount: -100, payee: "Grocery" },
    { id: "i1", accountId: "b", date: "2026-09-02", amount: 100, payee: "Transfer from A" },
    { id: "i2", accountId: "b", date: "2026-09-20", amount: 100, payee: "Deposit" },
    { id: "s", accountId: "a", date: "2026-09-02", amount: 100, payee: "Refund" },
  ];
  const pairs = findPairs(txs);
  assert.equal(pairs.length, 1, "i2 is too far away; s is the same account");
  assert.equal(pairs[0].out.id, "o1", "the wordy 'Transfer to' beats the grocery line even though it is a day further");
  assert.equal(findPairs(txs, { days: 30 }).length, 2);
});
