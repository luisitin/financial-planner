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

// gap #24 fix F4 (2026-11-14): linking a line that was split across categories says the split is gone
test("gap #24 fix F4 on the page: linking a split line as a transfer takes its parts off and the green line says so", async () => {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const page = (plan) => renderPage(new URL("./view.js", import.meta.url).href, plan, "2026-11-14");
  const p = samplePlan();
  // t9 (the card payment going out) was split by mistake: $100.00 of it shopping, the rest loan and card payments
  const t9 = p.transactions.find((t) => t.id === "t9"), size = Math.abs(t9.amount);
  t9.splits = [{ category: "shopping", amount: -100 }, { category: t9.category || "debt", amount: -(size - 100) }];
  const r = await page(p);
  r.root.querySelectorAll("button").find((b) => textOf(b) === "Link").click();
  assert.equal(r.saved.length, 1);
  const after = r.saved[0].transactions.find((t) => t.id === "t9");
  assert.equal(after.splits, undefined); assert.equal(after.category, "transfer");
  const said = (await page(r.saved[0])).root.querySelectorAll(".notice.ok").map((n) => textOf(n));
  assert.equal(said.length, 1);
  assert.match(said[0], /^Linked: .* It no longer counts as income or spending\. One of them was split across categories; it is whole again, since a transfer is not spending\.$/);
  // with no split the line is what it was
  const r2 = await page(samplePlan());
  r2.root.querySelectorAll("button").find((b) => textOf(b) === "Link").click();
  assert.match((await page(r2.saved[0])).root.querySelectorAll(".notice.ok").map((n) => textOf(n))[0], /It no longer counts as income or spending\.$/);
});
