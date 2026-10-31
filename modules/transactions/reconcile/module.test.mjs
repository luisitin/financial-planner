import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, reconcile, recordOf, nextStart, NEAR_DAYS, MAX_HINTS } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

// the sample plan's checking account in September: +1950 +1950 −1500 −86.40 −54.12 −15.49 −500 −640.22 = +1103.77
const SEPT = 1950 + 1950 - 1500 - 86.40 - 54.12 - 15.49 - 500 - 640.22;
const chk = (endBalance, extra = {}) => ({ accountId: "chk", from: "2026-09-01", to: "2026-09-30", startBalance: 1000, endBalance, ...extra });
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} vs ${b}`);

test("a matching statement: the change it shows equals the lines on file for the same days, both ends counted", () => {
  const p = samplePlan();
  const r = reconcile(p, chk(1000 + SEPT));
  assert.equal(r.ready, true); assert.equal(r.matches, true); assert.equal(r.gap, 0); assert.equal(r.fix, 0); assert.deepEqual(r.hints, []);
  near(r.statementChange, SEPT); near(r.ledgerChange, SEPT);
  assert.equal(r.lines.length, 8, "September 1 and the lines up to September 30; August's are out");
  assert.deepEqual(r.lines.map((t) => t.date), [...r.lines.map((t) => t.date)].sort(), "by date");
  near(r.lines[0].running, 1000 + r.lines[0].amount); near(r.lines.at(-1).running, 1000 + SEPT);
  // the same statement ending a day earlier leaves out the 15th's lines
  assert.equal(reconcile(p, chk(1000 + SEPT, { to: "2026-09-14" })).lines.length, 7, "the payroll on the 15th falls out");
});

test("a card or loan: its balance is what you owe, so spending raises it and payments lower it", () => {
  const p = samplePlan();
  // the Visa card in September: payment +640.22, Amazon −42.17 twice: owed goes from 640.22 to 84.34
  const r = reconcile(p, { accountId: "visa", from: "2026-09-01", to: "2026-09-30", startBalance: 640.22, endBalance: 84.34 });
  assert.equal(r.liability, true); assert.equal(r.matches, true);
  near(r.statementChange, -555.88); near(r.ledgerChange, -555.88);
  near(r.lines.at(-1).running, 84.34);
  // a statement that owes 42.17 more: a charge of 42.17 (−42.17 on the ledger) is what would close it
  const more = reconcile(p, { accountId: "visa", from: "2026-09-01", to: "2026-09-30", startBalance: 640.22, endBalance: 126.51 });
  near(more.gap, 42.17); near(more.fix, -42.17);
});

test("what could explain a gap: a line entered twice, one of exactly the gap, the wrong sign, two lines, digits swapped, a missing line", () => {
  const p = samplePlan();
  // the statement has 15.49 more than the ledger: Netflix (−15.49) may not be on it
  let r = reconcile(p, chk(1000 + SEPT + 15.49));
  near(r.gap, 15.49); near(r.fix, 15.49);
  assert.deepEqual(r.hints.find((h) => h.kind === "extra").ids, ["t6"]);
  assert.ok(r.hints.some((h) => h.kind === "missing" && /money in/.test(h.text)), "or money in is missing");
  // entered twice: a copy of Netflix a day later
  p.transactions.push({ ...p.transactions.find((t) => t.id === "t6"), id: "t6b", date: "2026-09-06" });
  r = reconcile(p, chk(1000 + SEPT));
  near(r.gap, 15.49);
  const twice = r.hints.find((h) => h.kind === "twice");
  assert.deepEqual(twice.ids, ["t6", "t6b"]); assert.match(twice.text, /entered twice/);
  assert.ok(!r.hints.some((h) => h.kind === "extra" && h.ids.includes("t6b")), "the copy is not offered again as a line of the gap");
  // the wrong sign: the 86.40 at Kroger entered as money in moves the balance by 172.80
  const q = samplePlan(); q.transactions.find((t) => t.id === "t4").amount = 86.40;
  r = reconcile(q, chk(1000 + SEPT));
  near(r.gap, -172.80);
  assert.deepEqual(r.hints.find((h) => h.kind === "sign").ids, ["t4"]);
  // two lines that add up to the gap: Kroger 86.40 + 54.12 = 140.52
  r = reconcile(samplePlan(), chk(1000 + SEPT + 140.52));
  assert.deepEqual(r.hints.find((h) => h.kind === "pair").ids, ["t4", "t5"]);
  // a gap that divides by 9 (in cents): 0.27, as when 86.41 is typed as 86.14
  r = reconcile(samplePlan(), chk(1000 + SEPT - 0.27));
  assert.ok(r.hints.some((h) => h.kind === "swap")); assert.ok(!reconcile(samplePlan(), chk(1000 + SEPT - 0.25)).hints.some((h) => h.kind === "swap"));
  assert.equal(r.hints.at(-1).kind, "missing", "a missing line is always the last idea");
});

test("just over the statement's edge: a line dated in the days after it, or one inside it near the end", () => {
  const p = samplePlan();
  // a −30 line on October 2 that the bank counted in September's statement
  p.transactions.push({ id: "o1", accountId: "chk", date: "2026-10-02", amount: -30, payee: "Gym", category: "" });
  let r = reconcile(p, chk(1000 + SEPT - 30));
  assert.deepEqual(r.hints.find((h) => h.kind === "edge").ids, ["o1"]);
  assert.equal(NEAR_DAYS, 3);
  p.transactions.find((t) => t.id === "o1").date = "2026-10-04";
  r = reconcile(p, chk(1000 + SEPT - 30));
  assert.ok(!r.hints.some((h) => h.kind === "edge"), "4 days after is too far");
  // a line on file 1 day before the end that the bank put in the next statement
  const q = samplePlan(); q.transactions.push({ id: "e1", accountId: "chk", date: "2026-09-29", amount: -12, payee: "Late fee", category: "" });
  r = reconcile(q, chk(1000 + SEPT));
  assert.deepEqual(r.hints.find((h) => h.kind === "edge").ids, ["e1"], "in the ledger on the 29th, counted by the bank next month");
});

test("at most three ideas of a kind", () => {
  const p = samplePlan();
  for (let i = 0; i < 6; i++) p.transactions.push({ id: `x${i}`, accountId: "chk", date: "2026-09-12", amount: -7, payee: `Shop ${i}`, category: "" });
  const r = reconcile(p, chk(1000 + SEPT - 42 + 7));
  assert.equal(MAX_HINTS, 3); assert.equal(r.hints.filter((h) => h.kind === "extra").length, 3);
});

test("what it needs: the account, the two dates in order, both balances", () => {
  const p = samplePlan();
  assert.deepEqual(reconcile(p, chk(1, { accountId: "nope" })), { ready: false, why: "account" });
  assert.deepEqual(reconcile(p, chk(1, { from: "2026-10-01" })), { ready: false, why: "dates" });
  assert.deepEqual(reconcile(p, chk(1, { to: "30/09/2026" })), { ready: false, why: "dates" });
  assert.deepEqual(reconcile(p, chk(null)), { ready: false, why: "balances" });
  assert.equal(reconcile(p, chk(1000, { from: "2026-09-15", to: "2026-09-15" })).lines.length, 1, "a one-day statement");
});

test("a saved check: the record, and the next statement starting the day after at its ending balance", () => {
  const p = samplePlan();
  const input = chk(1000 + SEPT);
  const rec = recordOf(reconcile(p, input), input, { id: "rc1", today: "2026-10-31" });
  assert.deepEqual(rec, { id: "rc1", accountId: "chk", from: "2026-09-01", to: "2026-09-30", startBalance: 1000, endBalance: 1000 + SEPT, lines: 8, at: "2026-10-31" });
  assert.equal(nextStart(p, "chk"), null);
  p.reconciliations = [rec, { ...rec, id: "rc0", from: "2026-08-01", to: "2026-08-31", endBalance: 1000 }];
  assert.deepEqual(nextStart(p, "chk"), { from: "2026-10-01", startBalance: 1000 + SEPT }, "the latest one, by its last day");
  assert.equal(nextStart(p, "visa"), null);
  const d = compute(p);
  assert.equal(d.ready, true);
  assert.equal(d.accounts.find((a) => a.id === "chk").last.id, "rc1"); assert.equal(d.accounts.find((a) => a.id === "visa").liability, true);
  assert.deepEqual(d.records.map((x) => x.id), ["rc1", "rc0"]); assert.equal(d.records[0].accountName, "Chase checking");
  assert.deepEqual(compute(emptyPlan()), { accounts: [], records: [], ready: false });
});
