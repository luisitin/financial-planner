import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, markReviewed, defaultMonth, prevMonth, monthLabel, monthPoint, nextMonth } from "./compute.js";
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
  assert.equal(step(d, "goals").status, "info", "a look step: never holds the count back");
  assert.equal(step(d, "goals").state, "todo", "but says the goals are behind");
  assert.equal(d.done + (d.todo - d.done), d.steps.filter((s) => s.status === "done" || s.status === "todo").length);
  assert.equal(d.reviewed, null); assert.equal(d.streak, 0);
});

test("transactions: the month's files are in, what is unfiled is counted", () => {
  // the files stop on Sep 15: on the 17th that is current (within three days), on the 20th the rest is still to import
  assert.equal(step(compute(samplePlan(), { today: "2026-09-20", month: "2026-09" }), "import").status, "todo");
  assert.match(step(compute(samplePlan(), { today: "2026-09-20", month: "2026-09" }), "import").detail, /stop on 9\/15\/2026: import the rest of September 2026/);
  const d = compute(samplePlan(), { today: "2026-09-17", month: "2026-09" });
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

test("balances from the 1st are not fresh on the 1st of the next month; the saved point's date is in words", () => {
  const p = familyPlan("2026-10-01");
  p.netWorthHistory = [{ date: "2026-10-25", netWorth: 287100 }];
  const d = compute(p, { today: "2026-11-01", month: "2026-10" });
  const b = step(d, "balances");
  assert.equal(b.status, "todo", "a month-old balance is not this month's");
  assert.ok(b.detail.includes("more than three weeks old"), b.detail);
  assert.deepEqual(b.go, ["balance", "update"]);
  assert.ok(step(d, "net-worth").detail.includes("saved on 10/25/2026"), step(d, "net-worth").detail);
  const fresh = compute(familyPlan("2026-10-25"), { today: "2026-11-01", month: "2026-10" });
  assert.equal(step(fresh, "balances").status, "done", "typed a week ago: fresh");
});

test("a month with no lines yet: filing and the budget wait for its files, never ticked", () => {
  const p = familyPlan("2026-11-02");
  p.transactions = [{ id: "t1", date: "2026-09-12", amount: -40, payee: "Kroger", rawPayee: "KROGER", category: "groceries", accountId: "a-chk" }];
  p.budgets = [{ id: "b1", category: "groceries", amount: 600, period: "monthly", rollover: false }];
  const d = compute(p, { today: "2026-11-02" });
  assert.equal(d.month, "2026-10");
  assert.equal(step(d, "import").status, "todo");
  assert.equal(step(d, "file").status, "skip"); assert.match(step(d, "file").detail, /Waits for October 2026's bank files/);
  assert.equal(step(d, "budget").status, "skip"); assert.deepEqual(step(d, "budget").query, { month: "2026-10" });
  assert.equal(step(d, "spending"), undefined, "no spending line for an empty month");
  assert.ok(d.done < d.todo);
});

test("the month's net worth: the newest point after the 10th through the 10th of the next month, against the month before's (Nov 2 saves October)", () => {
  const h = [{ date: "2026-01-01", netWorth: 257000 }, { date: "2026-10-02", netWorth: 295109 }, { date: "2026-11-02", netWorth: 306074 }];
  const r = monthPoint(h, "2026-10");
  assert.equal(r.point.date, "2026-11-02"); assert.equal(r.before.date, "2026-10-02");
  const only = monthPoint(h.slice(0, 2), "2026-10");
  assert.equal(only.point, null, "a point saved on Oct 2 closes September, not October: each point belongs to one month");
  assert.equal(monthPoint(h, "2026-09").point.date, "2026-10-02", "September's close, saved Oct 2");
  assert.equal(monthPoint([{ date: "2026-11-12", netWorth: 1 }], "2026-10").point, null, "after the 10th it is November's");
  assert.equal(nextMonth("2026-12"), "2027-01");
  const p = familyPlan("2026-11-02"); p.netWorthHistory = h;
  const s = step(compute(p, { today: "2026-11-02" }), "net-worth");
  assert.equal(s.status, "done"); assert.match(s.detail, /\$306,074 saved on 11\/2\/2026: up \$10,965 since 10\/2\/2026/);
});

test("where the money went says the change in dollars and as a share; once reviewed the month is summed up", () => {
  const p = familyPlan("2026-11-02");
  const tx = (id, date, amount, category) => ({ id, date, amount, payee: id, rawPayee: id, category, accountId: "a-chk" });
  p.transactions = [tx("a", "2026-09-01", -1000, "groceries"), tx("b", "2026-09-30", -100, "dining"), tx("c", "2026-10-01", -1060, "groceries"), tx("d", "2026-10-31", -100, "dining")];
  p.netWorthHistory = [{ date: "2026-10-02", netWorth: 100000 }, { date: "2026-11-02", netWorth: 104000 }];
  const d = compute(p, { today: "2026-11-02" });
  const sp = step(d, "spending");
  assert.match(sp.detail, /\$1,160 spent in October 2026, up \$60 \(5%\) on September 2026/);
  assert.deepEqual(sp.query, { month: "2026-10" });
  assert.deepEqual(d.summary, ["net worth up $4,000 since 10/2/2026", "$1,160 spent (up 5%)"]);
  assert.deepEqual(d.nextCheck, { month: "2026-11", when: "December" });
});

test("review: a month the files barely reach is not imported, filed or within budget; the budget is a look step", () => {
  const p = familyPlan("2026-11-02");
  const tx = (id, date, amount, category) => ({ id, date, amount, payee: id, rawPayee: id, category, accountId: "a-chk" });
  p.transactions = [tx("a", "2026-10-01", -1000, "groceries"), tx("b", "2026-10-31", -100, "dining"), tx("c", "2026-11-01", -1980, "housing")];
  p.budgets = [{ id: "b1", category: "groceries", amount: 800, period: "monthly", rollover: false }];
  const nov = compute(p, { today: "2026-12-03", month: "2026-11" });
  assert.equal(step(nov, "import").status, "todo", "one line on Nov 1 is not November's files");
  assert.match(step(nov, "import").detail, /stop on 11\/1\/2026: import the rest of November 2026/);
  assert.equal(step(nov, "file").status, "skip"); assert.equal(step(nov, "budget").status, "skip");
  // October, covered and over in groceries: the budget does not hold the count back
  const oct = compute(p, { today: "2026-11-02", month: "2026-10" });
  assert.equal(step(oct, "import").status, "done");
  assert.equal(step(oct, "budget").status, "info"); assert.equal(step(oct, "budget").state, "todo");
  assert.ok(!oct.steps.some((x) => x.status === "todo" && x.id === "budget"));
});

test("the month still running is not marked reviewed: it ends first, and is finished in early next month", () => {
  const now = compute(familyPlan("2026-11-02"), { today: "2026-11-02", month: "2026-11" });
  assert.equal(now.ended, false); assert.equal(now.finishIn, "December");
  const last = compute(familyPlan("2026-11-02"), { today: "2026-11-02", month: "2026-10" });
  assert.equal(last.ended, true, "October is over on November 2");
  const late = compute(familyPlan("2026-11-30"), { today: "2026-11-30" });
  assert.equal(late.month, "2026-11"); assert.equal(late.ended, false, "still running on its last day");
  assert.equal(compute(familyPlan("2026-12-01"), { today: "2026-12-01" }).finishIn, "December", "November, opened on Dec 1, is finished in December");
});
