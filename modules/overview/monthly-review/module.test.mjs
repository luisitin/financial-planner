import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, markReviewed, defaultMonth, prevMonth, monthLabel } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";

const step = (d, id) => d.steps.find((s) => s.id === id);

test("which month: the one just ended in the first ten days, this one after; labels and the month before", () => {
  assert.equal(defaultMonth("2026-11-04"), "2026-10"); assert.equal(defaultMonth("2026-11-11"), "2026-11");
  assert.equal(prevMonth("2026-01"), "2025-12"); assert.equal(monthLabel("2026-10"), "October 2026");
});

test("an old plan gains an empty reviews list on load", () => {
  const old = emptyPlan(); delete old.reviews;
  assert.deepEqual(migrate(old).reviews, []);
});

test("the family in October: fresh balances, no net worth point this month, no bank files (optional), goals behind", () => {
  const d = compute(familyPlan(), { today: "2026-10-30" });
  assert.equal(d.month, "2026-10"); assert.equal(d.label, "October 2026");
  assert.equal(step(d, "balances").status, "done");
  assert.equal(step(d, "net-worth").status, "todo");
  assert.equal(step(d, "import").status, "skip"); assert.equal(step(d, "file").status, "skip");
  assert.equal(step(d, "goals").status, "todo");
  assert.equal(d.done + (d.todo - d.done), d.steps.filter((s) => s.status === "done" || s.status === "todo").length);
  assert.equal(d.reviewed, null); assert.equal(d.streak, 0);
});

test("transactions: the month's files are in, what is unfiled is counted", () => {
  const d = compute(samplePlan(), { today: "2026-09-20", month: "2026-09" });
  assert.equal(step(d, "import").status, "done");
  const unfiled = samplePlan().transactions.filter((t) => t.date.startsWith("2026-09") && !t.category && !t.transferId).length;
  assert.equal(step(d, "file").status, unfiled ? "todo" : "done"); assert.ok(step(d, "file").detail.includes(String(unfiled)));
  assert.ok(step(d, "spending"), "spending for the month");
});

test("marking reviewed: one entry a month, replaced not doubled, and the streak counts months in a row", () => {
  const p = familyPlan();
  markReviewed(p, "2026-08", "2026-08-31", "first"); markReviewed(p, "2026-09", "2026-09-30", ""); markReviewed(p, "2026-10", "2026-10-30", " tidy  ");
  markReviewed(p, "2026-10", "2026-10-31", "again");
  assert.deepEqual(p.reviews.map((r) => r.month), ["2026-08", "2026-09", "2026-10"]);
  assert.equal(p.reviews[2].note, "again"); assert.equal(p.reviews[2].at, "2026-10-31");
  const d = compute(p, { today: "2026-10-31" });
  assert.equal(d.reviewed.note, "again"); assert.equal(d.streak, 3); assert.equal(d.history[0].month, "2026-10");
  p.reviews = p.reviews.filter((r) => r.month !== "2026-09");
  assert.equal(compute(p, { today: "2026-10-31" }).streak, 1, "a gap breaks the streak");
});
