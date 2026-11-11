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
  const d = compute(familyPlan(), { today: "2026-10-30", month: "2026-10" });
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
  const d = compute(p, { today: "2026-10-31", month: "2026-10" });
  assert.equal(d.reviewed.note, "again"); assert.equal(d.streak, 3); assert.equal(d.history[0].month, "2026-10");
  p.reviews = p.reviews.filter((r) => r.month !== "2026-09");
  assert.equal(compute(p, { today: "2026-10-31", month: "2026-10" }).streak, 1, "a gap breaks the streak");
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
  const late = compute(familyPlan("2026-11-30"), { today: "2026-11-30", month: "2026-11" });
  assert.equal(late.month, "2026-11"); assert.equal(late.ended, false, "still running on its last day");
  assert.equal(compute(familyPlan("2026-11-30"), { today: "2026-11-30" }).month, "2026-10", "opened with no month: October, never checked in on, is the one to close (MR-3)");
  assert.equal(compute(familyPlan("2026-12-01"), { today: "2026-12-01" }).finishIn, "December", "November, opened on Dec 1, is finished in December");
});

// ---- a plan made this month is not asked about last month (round 4, 2026-11-02)
import { firstDay, checkInDue } from "./compute.js";
test("firstDay: the earliest dated thing in the plan, not when the app was first opened", () => {
  const p = emptyPlan(); p.meta.createdAt = "2026-09-01T00:00:00Z";
  assert.equal(firstDay(p), null);
  p.accounts = [{ id: "a", name: "Checking", type: "checking", balance: 100, asOf: "2026-11-02", history: [{ date: "2026-11-02", balance: 100 }] }];
  assert.equal(firstDay(p), "2026-11-02");
  p.transactions = [{ id: "t", date: "2026-10-14", amount: -5 }];
  assert.equal(firstDay(p), "2026-10-14");
  p.netWorthHistory = [{ date: "2026-01-01", assets: 1, liabilities: 0, netWorth: 1 }];
  assert.equal(firstDay(p), "2026-01-01");
});
test("checkInDue: the month just ended, any day of the month, and only for a plan that existed then (stress test MR-2)", () => {
  const made = emptyPlan();
  made.accounts = [{ id: "a", name: "Checking", type: "checking", balance: 100, asOf: "2026-11-02", history: [] }];
  assert.equal(checkInDue(made, "2026-11-02"), null, "made today: no October check-in");
  assert.equal(defaultMonth("2026-11-02", made), "2026-11", "Monthly review opens on this month for it");
  assert.deepEqual(checkInDue(made, "2026-12-03"), { month: "2026-11", name: "November", done: false, nextName: "December", nextWhen: "January" }, "its first check-in is in December");
  const fam = familyPlan("2026-10-30");
  for (const day of ["2026-11-01", "2026-11-02", "2026-11-11", "2026-11-30"]) {
    assert.equal(checkInDue(fam, day).done, false, day);
    assert.equal(checkInDue(fam, day).month, "2026-10", day);
    assert.equal(defaultMonth(day, fam), "2026-10", `${day}: opens on the month to close`);
  }
  fam.reviews = [{ month: "2026-10", at: "2026-11-01" }];
  assert.deepEqual(checkInDue(fam, "2026-11-11"), { month: "2026-10", name: "October", done: true, nextName: "November", nextWhen: "December" }, "done: says when the next one is");
  assert.equal(defaultMonth("2026-11-11", fam), "2026-11", "October closed: this month");
  assert.equal(checkInDue(fam, "2026-12-31").name, "November", "the last day of a month");
  assert.equal(checkInDue(fam, "2026-12-31").done, false);
  assert.equal(checkInDue({ ...fam, reviews: [{ month: "2026-11" }] }, "2027-01-05").nextWhen, "February", "across the year");
  assert.equal(checkInDue(emptyPlan(), "2026-11-02"), null, "no accounts");
  assert.equal(defaultMonth("2026-11-02"), "2026-10", "without a plan the old rule stands");
  assert.equal(defaultMonth("2026-11-11"), "2026-11");
});

// ---- the bank files are in only when every account covers the month and no card's own file is missing (2026-11-02)
import { cardGapPlan } from "../../../qa/fixtures/card-gap-plan.mjs";
test("the files step: a card that money went to with no file of its own is named, with its amount, and opens its import", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  const oct = step(compute(p, { today: T }), "import");
  assert.equal(oct.status, "todo");
  assert.equal(oct.detail, "Visa card: $2,610 went to it from checking in October, but its own file isn't in, so what you bought on it is missing. Bring in the Visa file.");
  assert.deepEqual(oct.go, ["transactions", "import"]); assert.deepEqual(oct.query, { accountId: "a-visa" });
  const file = step(compute(p, { today: T }), "file");
  assert.equal(file.status, "skip"); assert.equal(file.detail, "Waits for the missing file above.", "every Chase line is filed: it is the Visa's file it waits for");
  // August: the Visa ($2,450.22 on 8/14) and Chase's hole between July's lines and the 90-day file
  const aug = step(compute(p, { today: T, month: "2026-08" }), "import");
  assert.equal(aug.detail, "Visa card: $2,450 went to it from checking in August, but its own file isn't in, so what you bought on it is missing. Bring in the Visa file. Chase checking has no lines from 7/31 to 8/2 (your mortgage usually goes out on the 2nd and a paycheck on the 1st): bring in a file that covers those days, or add them by hand.");
  // the Visa's file in for August to October: October is done; August still has the hole, and now opens Chase's import
  for (let t = Date.UTC(2026, 7, 1), n = 0; t <= Date.UTC(2026, 9, 31); t += 2 * 864e5, n++) p.transactions.push({ id: `v${n}`, date: new Date(t).toISOString().slice(0, 10), amount: -40, payee: "Cafe", rawPayee: "CAFE", accountId: "a-visa", category: "dining", tags: [], note: "" });
  const octIn = step(compute(p, { today: T }), "import");
  assert.equal(octIn.status, "done"); assert.equal(octIn.query, undefined);
  const augIn = step(compute(p, { today: T, month: "2026-08" }), "import");
  assert.equal(augIn.status, "todo"); assert.match(augIn.detail, /^Chase checking has no lines from 7\/31 to 8\/2/); assert.deepEqual(augIn.query, { accountId: "a-chk", need: "2026-07-31..2026-08-02" });
});
test("the files step: more than a quiet spell between two files inside a month is todo; a few quiet days at a file's edge are done", () => {
  const p = familyPlan("2026-11-02");
  const day = (iso, n) => ({ id: `${iso}-${n}`, date: iso, amount: -10, payee: "Kroger", rawPayee: "KROGER", category: "groceries", accountId: "a-chk", tags: [], note: "" });
  const span = (from, to) => { const out = []; for (let t = Date.parse(`${from}T00:00:00Z`), n = 0; t <= Date.parse(`${to}T00:00:00Z`); t += 864e5, n++) out.push(day(new Date(t).toISOString().slice(0, 10), n)); return out; };
  // a line every day, then nothing 10/13 to 10/21 (9 days: more than 7 and more than 2 x 1)
  p.transactions = [...span("2026-10-01", "2026-10-12"), ...span("2026-10-22", "2026-10-31")];
  p.imports = [{ id: "a", accountId: "a-chk", from: "2026-10-01", to: "2026-10-12" }, { id: "b", accountId: "a-chk", from: "2026-10-22", to: "2026-10-31" }];
  let s = step(compute(p, { today: "2026-11-02", month: "2026-10" }), "import");
  assert.equal(s.status, "todo"); assert.equal(s.detail, "Chase checking has no lines from 10/13 to 10/21: bring in a file that covers those days, or add them by hand.");
  assert.deepEqual(s.query, { accountId: "a-chk", need: "2026-10-13..2026-10-21" });
  // the second file from 10/17: 4 quiet days (10/13 to 10/16), nothing usual due in them: records hold the first and last
  // line dates, not the days a file covers, so that is a quiet spell, not a hole (re-check 4, 2026-11-02)
  p.transactions.push(...span("2026-10-17", "2026-10-21")); p.imports[1].from = "2026-10-17";
  s = step(compute(p, { today: "2026-11-02", month: "2026-10" }), "import");
  assert.equal(s.status, "done"); assert.match(s.detail, /transactions dated in October 2026/);
});
// ---- round-5 review (2026-11-02): "most on" is a kind of spending; a late file is named; quiet days can be marked
test("where the money went: 'most on' is a kind of spending, and what went to the card is said apart", () => {
  const T = "2026-11-02";
  const s = step(compute(cardGapPlan(T), { today: T }), "spending");
  assert.equal(s.detail, "$7,454 spent in October 2026, down $1,273 (15%) on September 2026; most on Rent or mortgage ($1,980); $2,610 went to the Visa card, whose file isn't in.");
});
test("the files step: a card file that starts late is named; 'nothing happened' only for days no payment to the card falls in", async () => {
  const { withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const { markQuiet } = await import("../../transactions/ledger/compute.js");
  const T = "2026-11-02";
  const p = withVisaFile(cardGapPlan(T), "2026-08-20", "2026-10-31");
  const aug = step(compute(p, { today: T, month: "2026-08" }), "import");
  assert.equal(aug.status, "todo");
  assert.equal(aug.detail, "Chase checking has no lines from 7/31 to 8/2 (your mortgage usually goes out on the 2nd and a paycheck on the 1st): bring in a file that covers those days, or add them by hand. Visa card's lines start on 8/20: bring in a file from 8/1.");
  // the Chase days hold the mortgage of the 2nd and a paycheck of the 1st; checking paid the Visa $2,450.22 on 8/14, inside
  // the Visa's 8/1 to 8/19: neither is offered as "nothing happened" (re-check rule 4)
  assert.equal(aug.quiet, undefined);
  assert.equal(step(compute(p, { today: T, month: "2026-10" }), "import").status, "done");
  // a Visa file from 8/10: its 8/1 to 8/9 hold no payment to it, so they can be marked
  const e = withVisaFile(cardGapPlan(T), "2026-08-10", "2026-10-31");
  assert.deepEqual(step(compute(e, { today: T, month: "2026-08" }), "import").quiet, [{ accountId: "a-visa", from: "2026-08-01", to: "2026-08-09", name: "Visa card" }]);
  const q = markQuiet(e, { accountId: "a-visa", from: "2026-08-01", to: "2026-08-09", at: `${T}T10:00:00.000Z`, id: "q" });
  assert.equal(step(compute(q, { today: T, month: "2026-08" }), "import").detail, "Chase checking has no lines from 7/31 to 8/2 (your mortgage usually goes out on the 2nd and a paycheck on the 1st): bring in a file that covers those days, or add them by hand.");
  assert.equal(step(compute(cardGapPlan(T), { today: T, month: "2026-08" }), "import").quiet, undefined, "plan3's August: the hole holds usual payments, the Visa money went to");
});
// ---- re-check of the card patch (2026-11-02): the findings' own inputs and figures
test("finding 3: no 'nothing happened' for the Visa's 8/1 to 8/19 when checking paid it on 8/14; August stays $6,074.38", async () => {
  const { withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const { compute: spending } = await import("../../cashflow/spending/compute.js");
  const T = "2026-11-02";
  const p = cardGapPlan(T); p.transactions = p.transactions.filter((t) => t.date >= "2026-08-01");
  withVisaFile(p, "2026-08-20", "2026-10-31");
  const aug = step(compute(p, { today: T, month: "2026-08" }), "import");
  assert.equal(aug.detail, "Visa card's lines start on 8/20: bring in a file from 8/1.");
  assert.equal(aug.quiet, undefined, "a payment to the card falls in those days");
  // checking's $3,264.16, 12 Visa dinners of $30, and the $2,450.22 paid on 8/14 (before the Visa's first line ever)
  assert.ok(Math.abs(spending(p, { today: T, month: "2026-08" }).total - 6074.38) < 0.005);
  // the Visa file with a gap 9/11 to 9/19 around the 9/14 payment: no button for those days either (page review 1)
  const g = withVisaFile(withVisaFile(cardGapPlan(T), "2026-08-01", "2026-09-10"), "2026-09-20", "2026-10-31");
  const sep = step(compute(g, { today: T, month: "2026-09" }), "import");
  assert.equal(sep.detail, "Visa card has no lines from 9/11 to 9/19: bring in a file that covers those days, or add them by hand.");
  assert.equal(sep.quiet, undefined);
});
test("finding 4: a quiet savings account (interest on 7/31 and 10/31) in a household with no card leaves October's files step done", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  p.accounts = p.accounts.filter((a) => a.type !== "credit");
  p.transactions = p.transactions.filter((t) => t.date >= "2026-08-01" && !/CRD AUTOPAY/.test(t.rawPayee));
  for (const [i, d] of ["2026-07-31", "2026-10-31"].entries()) p.transactions.push({ id: `iq${i}`, date: d, amount: 12, payee: "INTEREST PAID", rawPayee: "INTEREST PAID", accountId: "a-sav", category: "income-interest", tags: [], note: "" });
  for (const ym of ["2026-08", "2026-09", "2026-10"]) assert.equal(step(compute(p, { today: T, month: ym }), "import").status, "done", ym);
});
test("page review 7: August's files step names the Visa and Chase's missing days, with a way to each", () => {
  const T = "2026-11-02";
  const aug = step(compute(cardGapPlan(T), { today: T, month: "2026-08" }), "import");
  assert.deepEqual(aug.query, { accountId: "a-visa" }, "the step itself opens the first");
  assert.deepEqual(aug.links, [
    { label: "Bring in the Visa file", go: ["transactions", "import"], query: { accountId: "a-visa" } },
    // the hole's import says the days it needs; "by hand" opens August with a new line dated 8/1 (re-check 4, page findings 5, 6)
    { label: "Bring in the Chase checking file", go: ["transactions", "import"], query: { accountId: "a-chk", need: "2026-07-31..2026-08-02" } },
    { label: "Add Chase checking's lines by hand", go: ["transactions", "ledger"], rest: ["account", "a-chk"], query: { month: "2026-08", add: "2026-08-01" } }]);
  assert.equal(step(compute(cardGapPlan(T), { today: T }), "import").links, undefined, "October names the Visa only: the step's own link");
});
test("page review 6: a month whose files miss some days, or the month before it, is not compared as fact", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  assert.equal(step(compute(p, { today: T, month: "2026-08" }), "spending").detail,
    "$5,714 spent in August 2026 (its files miss some days, so it is not compared with July 2026); most on Childcare and school ($1,150); $2,450 went to the Visa card, whose file isn't in.");
  assert.equal(step(compute(p, { today: T, month: "2026-09" }), "spending").detail,
    "$8,727 spent in September 2026 (August 2026's files miss some days, so the two are not compared); most on Rent or mortgage ($1,980); $2,981 went to the Visa card, whose file isn't in.");
});
test("page review 3: a stand-in dated before the card's file starts is said so, not 'whose file isn't in'", async () => {
  const { withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = withVisaFile(cardGapPlan(T), "2026-08-20", "2026-10-31");
  assert.match(step(compute(p, { today: T, month: "2026-08" }), "spending").detail, /; \$2,450 went to the Visa card, before its file starts on 8\/20\.$/);
});

// --- re-check 4: one rule for holes, a payment counted for neither card, the month before a card's file ---
test("money 1 (re-check 4): one checking file a month (8/3-8/29, 9/1-9/26, 10/1-10/31): every files step is done", async () => {
  const { noCardFromAug, oneFileAMonth } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = noCardFromAug(cardGapPlan(T)); p.transactions = p.transactions.filter((t) => t.date !== "2026-09-28" && t.date !== "2026-09-30");
  oneFileAMonth(p, "a-chk");
  for (const ym of ["2026-08", "2026-09", "2026-10"]) assert.equal(step(compute(p, { today: T, month: ym }), "import").status, "done", ym);
});
test("money 3 (re-check 4): quarterly one-line savings files (7/31 and 10/31) are no hole: every files step is done", async () => {
  const { noCardFromAug, bankLine } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = noCardFromAug(cardGapPlan(T));
  for (const [i, d] of ["2026-07-31", "2026-10-31"].entries()) {
    p.transactions.push(bankLine(`q${i}`, d, 12, "INTEREST PAID", "a-sav", "income-interest", { importId: `iq${i}` }));
    p.imports.push({ id: `iq${i}`, at: `${d}T12:00:00.000Z`, accountId: "a-sav", fileName: "ally.csv", rows: 1, added: 1, skipped: 0, bad: 0, from: d, to: d });
  }
  for (const ym of ["2026-08", "2026-09", "2026-10"]) assert.equal(step(compute(p, { today: T, month: ym }), "import").status, "done", ym);
});
test("money 4 (re-check 4): a payment for one of two Chase cards: the files step says the sentence, with a way to each card's file", async () => {
  const { anAccount } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = cardGapPlan(T); p.accounts.find((a) => a.id === "a-visa").name = "Freedom";
  p.accounts.push(anAccount("a-sap", "Sapphire", "credit", "Chase"));
  const st = step(compute(p, { today: T, month: "2026-10" }), "import");
  assert.equal(st.status, "todo");
  assert.equal(st.detail, "$2,610 went to one of your Chase cards in October; bring in the card files to see what it bought.");
  assert.deepEqual(st.links, [
    { label: "Bring in the Freedom file", go: ["transactions", "import"], query: { accountId: "a-visa" } },
    { label: "Bring in the Sapphire file", go: ["transactions", "import"], query: { accountId: "a-sap" } }]);
  assert.equal(step(compute(p, { today: T, month: "2026-10" }), "spending").detail,
    "$4,843 spent in October 2026 (its card purchases aren't all in, so it is not compared with September 2026); most on Rent or mortgage ($1,980).");
});
test("pages 4 (re-check 4): July, before the Visa's file starts on 8/1, says so in the files step and the spending step", async () => {
  const { withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = withVisaFile(cardGapPlan(T), "2026-08-01", "2026-10-31");
  assert.equal(step(compute(p, { today: T, month: "2026-07" }), "import").detail,
    "Visa card: $640 went to it from checking in July, before its file starts on 8/1, so what you bought on it then is missing. Bring in the Visa file for July. Chase checking has no lines from 7/31 to 8/2 (your mortgage usually goes out on the 2nd and a paycheck on the 1st): bring in a file that covers those days, or add them by hand.");
  assert.equal(step(compute(p, { today: T, month: "2026-07" }), "spending").detail,
    "$4,190 spent in July 2026; most on Rent or mortgage ($1,980); $640 went to the Visa card, before its file starts on 8/1.");
});

test("the counts say what they count: things to do, and things worth a look (stress test MR-3, OV-3)", () => {
  const d = compute(familyPlan("2026-11-11"), { today: "2026-11-11", month: "2026-10" });
  assert.equal(d.todo - d.done, 1, "one thing to do");
  assert.deepEqual(d.firstTodo, { id: "net-worth", title: "Save the month's net worth" });
  assert.equal(d.lookLeft, d.steps.filter((s) => s.status === "info" && s.state === "todo").length);
  assert.ok(d.lookLeft >= 1, "the goals are behind: worth a look");
  assert.ok(d.lookTotal >= d.lookLeft);
  // the attention line drops the parts that are zero
  const att = d.steps.find((s) => s.id === "attention").detail;
  assert.ok(!/\b0 to /.test(att), att);
  assert.match(d.steps.find((s) => s.id === "net-worth").detail, /at the bottom of Net worth/, "says where the button is (MR-5)");
});

test("a month checked in late: the first save after it closes the month, said to be late (attack2, 2026-11-11)", () => {
  const h = [{ date: "2026-10-02", netWorth: 100 }, { date: "2026-11-11", netWorth: 130 }, { date: "2026-11-20", netWorth: 140 }];
  assert.equal(monthPoint(h, "2026-10").point, null, "without late, the window rule");
  const r = monthPoint(h, "2026-10", { late: true });
  assert.equal(r.point.date, "2026-11-11"); assert.equal(r.point.late, true); assert.equal(r.before.date, "2026-10-02");
  // something saved in the window still wins
  assert.equal(monthPoint([...h, { date: "2026-11-05", netWorth: 120 }], "2026-10", { late: true }).point.date, "2026-11-05");
  // on the page: October's step is done by a save on Nov 11, and says it came late
  const p = emptyPlan();
  p.accounts.push({ id: "a", name: "Checking", type: "checking", balance: 130, asOf: "2026-11-11" });
  p.netWorthHistory = [{ date: "2026-11-11", netWorth: 130 }];
  const step = compute(p, { today: "2026-11-11", month: "2026-10" }).steps.find((s) => s.id === "net-worth");
  assert.equal(step.status, "done"); assert.match(step.detail, /after the month ended/);
});

test("a finished month can be opened again (Undo, Open this month again)", async () => {
  const { unmarkReviewed } = await import("./compute.js");
  const p = emptyPlan();
  markReviewed(p, "2026-10", "2026-11-11", "note"); markReviewed(p, "2026-09", "2026-10-05", "");
  unmarkReviewed(p, "2026-10");
  assert.deepEqual(p.reviews.map((r) => r.month), ["2026-09"]);
});

test("N11 (review 2026-11-11): opening a finished month again keeps its note, and finishing again puts it back", async () => {
  const { markReviewed, unmarkReviewed, compute: c } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  markReviewed(p, "2026-10", "2026-11-11", "Car repair this month");
  unmarkReviewed(p, "2026-10");
  assert.deepEqual(p.reviews, [], "the month is open again for every page that counts reviews");
  assert.deepEqual(p.reviewNotes, { "2026-10": "Car repair this month" });
  assert.equal(c(p, { today: "2026-11-11", month: "2026-10" }).draftNote, "Car repair this month", "the box fills from it");
  markReviewed(p, "2026-10", "2026-11-12", "Car repair this month");
  assert.equal(p.reviews[0].note, "Car repair this month");
  assert.equal(p.reviewNotes, undefined, "nothing held once it is on the entry");
  // a month with no note is held too, so it stays among the months, and nothing is left once it is finished again
  markReviewed(p, "2026-09", "2026-10-05", ""); unmarkReviewed(p, "2026-09");
  assert.deepEqual(p.reviewNotes, { "2026-09": "" });
  assert.ok(c(p, { today: "2026-12-05" }).choices.includes("2026-09"), "still one tap away a few months on");
  markReviewed(p, "2026-09", "2026-12-05", "");
  assert.equal(p.reviewNotes, undefined);
});

test("attack on N11: an older month opened again with a note stays among the month choices until it is finished again", async () => {
  const { unmarkReviewed, markReviewed, compute: c } = await import("./compute.js");
  const p = migrate(familyPlan("2026-11-11"));
  p.reviews = [{ month: "2026-09", at: "2026-10-03", note: "Sept: dentist" }, { month: "2026-10", at: "2026-11-03", note: "" }];
  unmarkReviewed(p, "2026-09");
  const d = c(p, { today: "2026-11-11", month: "2026-10" });
  assert.deepEqual(d.choices, ["2026-11", "2026-10", "2026-09"]);
  assert.deepEqual(c(p, { today: "2026-12-05", month: "2026-12" }).choices, ["2026-12", "2026-11", "2026-09"], "a month later it is still there");
  markReviewed(p, "2026-09", "2026-11-11", "Sept: dentist");
  assert.deepEqual(c(p, { today: "2026-11-11", month: "2026-10" }).choices, ["2026-11", "2026-10"], "finished again: back to the two months");
});

test("N6 (review 2026-11-11): a blank plan has nothing to check in on; a plan with anything in it does", () => {
  assert.equal(compute(emptyPlan(), { today: "2026-11-11" }).empty, true);
  // pay alone, no accounts, the questions not begun: still a plan to set up, as every other page says (N19)
  const p = emptyPlan(); p.income.push({ id: "i", type: "salary", amount: 4000 });
  assert.equal(compute(p, { today: "2026-11-11" }).empty, true);
  // the questions begun, or an account added: there is something to check in on
  const q = emptyPlan(); q.income.push({ id: "i", type: "salary", amount: 4000 }); q.guide = { setup: { startedAt: "2026-11-10", at: "money" } };
  assert.equal(compute(q, { today: "2026-11-11" }).empty, false);
  const a = emptyPlan(); a.accounts.push({ id: "a", type: "checking", name: "Checking", balance: 2000 });
  assert.equal(compute(a, { today: "2026-11-11" }).empty, false);
  assert.equal(compute(migrate(familyPlan("2026-11-11")), { today: "2026-11-11" }).empty, false);
  // pay and bills plus a debt or a goal: real things to look at, the steps show (attack on N19)
  for (const add of [(x) => x.debts.push({ id: "d", name: "Card", balance: 8000, rate: 0.24, minPayment: 200 }), (x) => x.goals.push({ id: "g", name: "Trip", target: 5000, targetDate: "2027-01-01" })]) {
    const g = emptyPlan(); g.income.push({ id: "i", type: "salary", amount: 4000 }); g.expenses.push({ id: "e", name: "Rent", amount: 1500 }); add(g);
    assert.equal(compute(g, { today: "2026-11-11" }).empty, false);
  }
  // part way through the questions with nothing in: the hero's button continues the questions, as the Dashboard does
  const m = emptyPlan(); m.guide = { setup: { startedAt: "2026-11-10", at: "money" } };
  const r = compute(m, { today: "2026-11-11" });
  assert.equal(r.empty, true); assert.equal(r.first.kind, "questions"); assert.match(r.first.label, /^Continue your plan: question \d of \d$/); assert.equal(r.first.href, "#/overview/setup/money");
});
