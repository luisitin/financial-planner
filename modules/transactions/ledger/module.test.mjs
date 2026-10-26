import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, txKey, monthOf, monthLabel, isTransfer } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("helpers: key, month, label, transfer", () => {
  assert.equal(txKey({ accountId: "chk", date: "2026-09-02", amount: -42.174, payee: "x", rawPayee: "AMAZON MKTPL*2K3 AMZN.COM/BILL WA" }), "chk|2026-09-02|-42.17|amazon mktpl amzn wa");
  assert.equal(monthOf("2026-09-15"), "2026-09"); assert.equal(monthLabel("2026-09"), "Sep 2026"); assert.equal(monthLabel("x"), "x");
  const p = samplePlan();
  assert.equal(isTransfer(p.transactions.find((t) => t.id === "t7"), p), true);
  assert.equal(isTransfer(p.transactions.find((t) => t.id === "t4"), p), false);
});
test("empty plan", () => {
  const d = compute(emptyPlan());
  assert.equal(d.total, 0); assert.equal(d.rows.length, 0); assert.equal(d.in, 0); assert.deepEqual(d.months, []);
});
test("all transactions, newest first, totals exclude transfers, months and accounts listed", () => {
  const p = samplePlan();
  const d = compute(p);
  assert.equal(d.total, 16); assert.equal(d.matched, 16); assert.equal(d.shown, 16); assert.equal(d.hasMore, false);
  assert.equal(d.rows[0].date, "2026-09-15");
  near(d.in, 1950 * 3 + 640.22);
  near(d.out, 1500 + 86.40 + 54.12 + 15.49 + 640.22 + 42.17 + 42.17 + 1500 + 48 + 60);
  assert.deepEqual(d.months.map((m) => m.ym), ["2026-09", "2026-08"]);
  assert.equal(d.months[0].count, 12);
  assert.equal(d.accounts[0].name, "Chase checking"); assert.equal(d.accounts[0].count, 12);
  assert.equal(d.uncategorisedAll, 4);
  assert.equal(d.rows.find((r) => r.id === "t4").categoryLabel, "Groceries");
  assert.equal(d.rows.find((r) => r.id === "t7").transfer, true);
});
test("filters: month, account, uncategorised, search; paging", () => {
  const p = samplePlan();
  let d = compute(p, { month: "2026-08" });
  assert.equal(d.matched, 4); near(d.in, 1950); near(d.out, 1608);
  d = compute(p, { accountId: "visa" });
  assert.equal(d.matched, 3);
  d = compute(p, { category: "none" });
  assert.equal(d.matched, 4); assert.equal(d.uncategorised, 4);
  d = compute(p, { category: "groceries" });
  assert.equal(d.matched, 3);
  d = compute(p, { q: "kroger" });
  assert.equal(d.matched, 3);
  d = compute(p, { limit: 5 });
  assert.equal(d.shown, 5); assert.equal(d.hasMore, true);
  d = compute(p, { limit: 5, offset: 15 });
  assert.equal(d.shown, 1); assert.equal(d.hasMore, false);
});
