import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan", () => { assert.equal(compute(emptyPlan()).hasData, false); });
test("a month: spending only (no income, no transfers), categories with shares and change, top payees, biggest", () => {
  const p = samplePlan();
  const d = compute(p, { month: "2026-09" });
  assert.equal(d.month, "2026-09"); assert.equal(d.label, "Sep 2026");
  assert.deepEqual(d.months.map((m) => m.ym), ["2026-09", "2026-08"]);
  near(d.total, 1500 + 86.40 + 54.12 + 15.49 + 640.22 + 42.17 + 42.17);
  assert.equal(d.count, 7);
  // the file ends on Sep 15, so September is compared with Aug 1 to 15 only (rent, $1,500), not all of August ($1,608)
  assert.deepEqual(d.sameDays, { lo: 1, hi: 15 });
  assert.equal(d.previous.ym, "2026-08"); near(d.previous.total, 1500);
  near(d.change, (d.total - 1500) / 1500);
  assert.equal(d.byCategory[0].category, "housing"); near(d.byCategory[0].share, 1500 / d.total); near(d.byCategory[0].change, 0);
  const groc = d.byCategory.find((c) => c.category === "groceries");
  near(groc.total, 140.52); near(groc.previous, 0, "no groceries on Aug 1 to 15"); assert.equal(groc.change, null);
  near(d.perDay, d.total / 15);
  const unfiled = d.byCategory.find((c) => c.category === "");
  near(unfiled.total, 15.49 + 640.22 + 42.17);
  assert.equal(d.topPayees[0].payee, "Oak Street Apartments");
  assert.equal(d.biggest[0].payee, "Oak Street Apartments"); assert.equal(d.biggest[1].payee, "Chase Credit Crd Autopay");
  assert.equal(d.daily.length, 6, "six distinct days with spending");
});
test("opens on the latest month the bank files fully cover; an unknown month falls back to it", () => {
  const p = samplePlan();
  const d = compute(p);
  assert.equal(d.month, "2026-08", "September is only covered to the 15th");
  near(d.total, 1608); assert.equal(d.previous, null); assert.equal(d.change, null); assert.equal(d.cover.full, true);
  near(d.perDay, 1608 / 31);
  assert.equal(compute(p, { month: "2020-01" }).month, "2026-08");
  assert.deepEqual(d.months.map((m) => m.full), [false, true]);
});
test("a file cut mid-month: the same days of the month before; months covering no common days have no change", () => {
  const p = emptyPlan();
  const tx = (id, date, amount, category) => ({ id, date, amount, payee: id, accountId: "c", category });
  // a 90-day file downloaded on Oct 12, starting Jul 14: July from the 14th, October to the 12th
  p.transactions.push(tx("j", "2026-07-14", -300, "groceries"), tx("a1", "2026-08-05", -200, "groceries"), tx("a2", "2026-08-25", -400, "groceries"),
    tx("s1", "2026-09-04", -100, "groceries"), tx("s2", "2026-09-20", -900, "groceries"), tx("o1", "2026-10-03", -250, "groceries"), tx("o2", "2026-10-12", -50, "dining"));
  const oct = compute(p, { month: "2026-10", today: "2026-10-12" });
  assert.equal(oct.cover.full, false); assert.equal(oct.cover.days, 12);
  assert.deepEqual(oct.sameDays, { lo: 1, hi: 12 });
  near(oct.previous.total, 100, "Sep 1 to 12: the $100 on the 4th, not the whole $1,000");
  near(oct.change, (300 - 100) / 100);
  near(oct.perDay, 300 / 12);
  assert.equal(compute(p, { today: "2026-10-12" }).month, "2026-09", "opens on September, the latest whole month");
  // August is whole; July only from the 14th: August is compared on the 14th to the 31st
  const aug = compute(p, { month: "2026-08", today: "2026-10-12" });
  assert.deepEqual(aug.sameDays, { lo: 14, hi: 31 });
  near(aug.previous.total, 300); near(aug.previous.current, 400); near(aug.change, (400 - 300) / 300);
  // a file covering Sep 25 to Oct 3 only: October 1 to 3 and September 25 to 30 share no days
  const q = emptyPlan();
  q.transactions.push(tx("x", "2026-09-25", -80, "groceries"), tx("y", "2026-10-03", -60, "groceries"));
  const o = compute(q, { month: "2026-10", today: "2026-10-12" });
  assert.equal(o.noOverlap, true); assert.equal(o.change, null); assert.equal(o.previous, null);
});
