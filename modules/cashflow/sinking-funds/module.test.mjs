import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, nextDueOn, asideOf } from "./compute.js";
import { recurringPlan } from "../recurring/module.test.mjs";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} != ${b}`);

test("empty plan", () => { assert.equal(compute(emptyPlan(), { today: TODAY }).hasData, false); });
test("typed quarterly, yearly and dated one-time costs plus a yearly payment found in transactions", () => {
  const p = recurringPlan();   // has Allstate 540 yearly in the transactions
  p.expenses.push(
    { id: "q", name: "Estimated taxes", category: "taxes", amount: 900, period: "quarterly", startDate: "2026-10-15" },
    { id: "y", name: "Car registration", category: "transport", amount: 240, period: "annual", startDate: "2027-03-01" },
    { id: "o", name: "Roof repair", category: "housing", amount: 8000, period: "once", startDate: "2027-01-15" },
    { id: "past", name: "Old thing", category: "other", amount: 100, period: "once", startDate: "2026-01-01" },
  );
  const d = compute(p, { today: TODAY });
  const by = (n) => d.funds.find((f) => f.name === n);
  near(by("Estimated taxes").monthly, 300); assert.equal(by("Estimated taxes").monthsToNext, 1);
  near(by("Car registration").monthly, 20);
  near(by("Roof repair").monthly, 2000, "8000 over the 4 months to January"); assert.equal(by("Roof repair").monthsToNext, 4);
  assert.equal(by("Old thing"), undefined, "a one-time cost in the past is gone");
  near(by("Allstate Insurance").monthly, 45); assert.equal(by("Allstate Insurance").source, "found"); assert.equal(by("Allstate Insurance").next, "2027-09-10");
  near(d.monthly, 300 + 20 + 2000 + 45);
  assert.deepEqual(d.dueNext.map((f) => f.name), ["Estimated taxes"]);
  assert.equal(d.funds[0].name, "Estimated taxes", "soonest first");
});

test("CF-5: a typed irregular cost carries its expense id, so its row opens that expense", () => {
  const p = emptyPlan();
  p.expenses = [{ id: "trip", name: "Summer trip", category: "travel", amount: 3000, period: "annual" }];
  const d = compute(p, { today: TODAY });
  assert.equal(d.funds[0].expenseId, "trip");
});

// ---- gap #12: what is already set aside for each yearly or quarterly bill (H13, H12)
const T = "2026-11-13";
const bill = (extra = {}) => ({ id: "car", name: "Car insurance", category: "insurance", amount: 1200, period: "annual", ...extra });
const one = (e, today = T) => { const p = emptyPlan(); p.expenses = [e]; return compute(p, { today }).funds[0]; };

test("gap #12: the next due date rolls forward from a past date by whole cycles, counted from the first date (no drift at a month's end)", () => {
  assert.equal(nextDueOn("2025-03-01", 12, T), "2027-03-01");
  assert.equal(nextDueOn("2026-03-01", 12, T), "2027-03-01");
  assert.equal(nextDueOn("2026-01-15", 3, T), "2027-01-15");
  assert.equal(nextDueOn("2026-01-31", 3, T), "2027-01-31", "Jan 31 + 3 months is Apr 30, but Jan 31 + 12 months is Jan 31 again");
  assert.equal(nextDueOn("2026-11-13", 12, T), "2026-11-13", "due today is still due");
  assert.equal(nextDueOn("2027-05-01", 3, T), "2027-05-01", "a date ahead is kept");
  assert.equal(nextDueOn("", 12, T), null);
  assert.equal(nextDueOn("not a date", 12, T), null);
});

test("gap #12 test 1: on track, short and over (A = $1,200 a year, due March 1: 3 whole months away, so $900 should be set aside by now)", () => {
  // needed by now = A x (L - n) / L = 1,200 x (12 - 3) / 12 = 900
  const short = one(bill({ nextDue: "2027-03-01", setAside: 640, setAsideAt: T })).aside;
  assert.equal(short.state, "short"); assert.equal(short.months, 3); assert.equal(short.cycle, 12);
  near(short.needed, 900); near(short.short, 260); assert.equal(short.due, "2027-03-01"); assert.equal(short.at, T);
  const track = one(bill({ nextDue: "2027-03-01", setAside: 950 })).aside;
  assert.equal(track.state, "on-track"); near(track.short, 0); assert.equal(track.at, null);
  const exact = one(bill({ nextDue: "2027-03-01", setAside: 900 })).aside;
  assert.equal(exact.state, "on-track", "exactly what is needed by now is on track");
  const ready = one(bill({ nextDue: "2027-03-01", setAside: 1200 })).aside;
  assert.equal(ready.state, "ready"); near(ready.extra, 0); near(ready.toFinish, 0);
  const over = one(bill({ nextDue: "2027-03-01", setAside: 1300 })).aside;
  assert.equal(over.state, "ready"); near(over.extra, 100);
  const nothing = one(bill({ nextDue: "2027-03-01", setAside: 0 })).aside;
  assert.equal(nothing.state, "short", "$0 typed is a figure: nothing set aside yet"); near(nothing.short, 900);
  const pennies = one(bill({ nextDue: "2027-03-01", setAside: 899.6 })).aside;
  assert.equal(pennies.state, "on-track", "less than half a dollar short rounds to on track");
});

test("gap #12 test 2: the catch-up amount: what is left over the whole months until it is due, at least one", () => {
  // (A - setAside) / max(1, n) = (1,200 - 640) / 3 = 186.67
  near(one(bill({ nextDue: "2027-03-01", setAside: 640 })).aside.toFinish, 560 / 3);
  // due this month (n = 0): all of what is left
  const now = one(bill({ nextDue: "2026-11-28", setAside: 640 })).aside;
  assert.equal(now.months, 0); near(now.needed, 1200); near(now.short, 560); near(now.toFinish, 560);
  // more than a cycle away (n = 15 > L = 12): nothing needed yet, the rest spread over 15 months
  const far = one(bill({ nextDue: "2028-03-01", setAside: 640 })).aside;
  assert.equal(far.months, 15); near(far.needed, 0); assert.equal(far.state, "on-track"); near(far.toFinish, 560 / 15);
  // the pure helper says the same as compute
  const a = asideOf({ amount: 1200, cycle: 12, setAside: 640, due: "2027-03-01", today: T, at: null });
  near(a.toFinish, 560 / 3); near(a.needed, 900);
});

test("gap #12 test 3: no setAside (and no nextDue) gives today's view: the same fund, key for key, as before", () => {
  const plain = one(bill({ startDate: "2026-03-01" }));
  assert.deepEqual(Object.keys(plain), ["key", "expenseId", "name", "icon", "source", "amount", "period", "yearly", "monthly", "next", "monthsToNext", "saveByThen"]);
  assert.equal(plain.next, "2026-03-01", "today's view keeps the date as typed on Expenses (rolled forward only once the bill is followed)");
  assert.equal(plain.aside, undefined);
  // blank, null or nonsense set-aside figures and dates are read as absent
  for (const extra of [{ setAside: null }, { setAside: "" }, { setAside: -5 }, { setAside: "abc" }, { nextDue: "" }, { nextDue: null }, { nextDue: "soon" }]) {
    assert.deepEqual(one(bill({ startDate: "2026-03-01", ...extra })), plain, JSON.stringify(extra));
  }
  // a one-time cost is never followed (the design is for bills that come back)
  assert.equal(one({ id: "roof", name: "Roof", category: "housing", amount: 8000, period: "once", startDate: "2027-01-15", setAside: 3000 }).aside, undefined);
});

test("gap #12 test 4: a quarterly cycle (L = 3): $540 every three months, next due December 15 (1 whole month away)", () => {
  const q = (s) => one({ id: "ins", name: "Car and home insurance", category: "insurance", amount: 540, period: "quarterly", nextDue: "2026-12-15", setAside: s }).aside;
  // needed = 540 x (3 - 1) / 3 = 360; short = 360 - 300 = 60; to finish = (540 - 300) / 1 = 240
  const a = q(300);
  assert.equal(a.cycle, 3); assert.equal(a.months, 1); near(a.needed, 360); near(a.short, 60); near(a.toFinish, 240); assert.equal(a.state, "short");
  assert.equal(q(400).state, "on-track");
  assert.equal(q(540).state, "ready");
  // rolled from the date typed on Expenses: January 15 every three months -> January 15, 2027 (2 months away: 540 x 1 / 3 = 180)
  const rolled = one({ id: "ins", name: "Insurance", category: "insurance", amount: 540, period: "quarterly", startDate: "2026-01-15", setAside: 100 });
  assert.equal(rolled.next, "2027-01-15"); assert.equal(rolled.monthsToNext, 2); near(rolled.aside.needed, 180); near(rolled.aside.short, 80);
});

test("gap #12: the person's next due date wins over the one from Expenses; no date at all says so; the totals never change", () => {
  const f = one(bill({ startDate: "2026-06-01", nextDue: "2027-02-01", setAside: 500 }));
  assert.equal(f.next, "2027-02-01"); assert.equal(f.monthsToNext, 2);
  const dateOnly = one(bill({ startDate: "2026-06-01", nextDue: "2027-02-01" }));
  assert.equal(dateOnly.next, "2027-02-01", "a next due date alone moves the date"); assert.equal(dateOnly.aside, undefined);
  const pastDue = one(bill({ nextDue: "2026-02-01", setAside: 500 }));
  assert.equal(pastDue.next, "2027-02-01", "a next due date that has passed rolls on by the cycle");
  const noDate = one(bill({ setAside: 640 })).aside;
  assert.equal(noDate.state, "no-date"); assert.equal(noDate.due, null); assert.equal(noDate.needed, null); assert.equal(noDate.short, null); assert.equal(noDate.toFinish, null);
  assert.equal(one(bill({ setAside: 1500 })).aside.state, "ready", "all of it set aside needs no date");
  const p0 = emptyPlan(); p0.expenses = [bill({ startDate: "2026-06-01" })];
  const p1 = emptyPlan(); p1.expenses = [bill({ startDate: "2026-06-01", setAside: 640, setAsideAt: T, nextDue: "2027-02-01" })];
  const [a, b] = [compute(p0, { today: T }), compute(p1, { today: T })];
  assert.equal(b.monthly, a.monthly); assert.equal(b.yearly, a.yearly);
});

test("gap #12: a figure noted on or before a due date that has passed was for that bill: it is not counted toward the next one", () => {
  // the critic's case: $1,200 noted October 1, the bill fell due November 12 (yesterday); the next one is November 2027
  const f = one(bill({ startDate: "2026-11-12", setAside: 1200, setAsideAt: "2026-10-01" }));
  assert.equal(f.next, "2027-11-12");
  assert.equal(f.aside.state, "stale"); assert.equal(f.aside.lastDue, "2026-11-12"); assert.equal(f.aside.amount, 1200); assert.equal(f.aside.at, "2026-10-01");
  assert.equal(f.aside.needed, null); assert.equal(f.aside.short, null); assert.equal(f.aside.toFinish, null); assert.equal(f.aside.extra, 0);
  // noted on the day it fell due: it may have been paid from it that day, so it counted for that bill too
  assert.equal(one(bill({ startDate: "2026-11-12", setAside: 1200, setAsideAt: "2026-11-12" })).aside.state, "stale");
  // noted the day after: counts toward the next one (12 whole months away: nothing needed yet)
  const after = one(bill({ startDate: "2026-11-12", setAside: 100, setAsideAt: T })).aside;
  assert.equal(after.state, "on-track"); assert.equal(after.lastDue, null);
  // two bills back: the bill it was for is the first due date on or after the day it was noted
  assert.equal(one(bill({ startDate: "2025-03-01", setAside: 600, setAsideAt: "2025-01-10" })).aside.lastDue, "2025-03-01");
  // the person's own date that has passed works the same way
  assert.equal(one(bill({ nextDue: "2026-11-01", setAside: 640, setAsideAt: "2026-10-20" })).aside.lastDue, "2026-11-01");
  // a due date still ahead: whenever it was noted, it counts
  assert.equal(one(bill({ nextDue: "2027-03-01", setAside: 640, setAsideAt: "2026-01-05" })).aside.state, "short");
  // quarterly: noted October 1 for the bill of November 15 (still ahead) counts; noted August 1 was for August 15
  const q = (at) => one({ id: "ins", name: "Insurance", category: "insurance", amount: 540, period: "quarterly", startDate: "2026-02-15", setAside: 540, setAsideAt: at }).aside;
  assert.equal(q("2026-10-01").state, "ready"); assert.equal(q("2026-08-01").state, "stale"); assert.equal(q("2026-08-01").lastDue, "2026-08-15");
  // no day noted: it cannot be told, so it counts as before
  assert.equal(one(bill({ startDate: "2026-11-12", setAside: 1200 })).aside.state, "ready");
  // the pure helper says the same
  const a = asideOf({ amount: 1200, cycle: 12, setAside: 1200, due: "2027-11-12", today: T, at: "2026-10-01", noteFor: "2026-11-12" });
  assert.equal(a.state, "stale"); assert.equal(a.lastDue, "2026-11-12");
  assert.equal(asideOf({ amount: 1200, cycle: 12, setAside: 1200, due: "2027-11-12", today: T, at: "2026-10-01", noteFor: "2027-11-12" }).state, "ready");
});

// ---- the words: one written sentence per case (R5), each read here
const fmt = await import("../../../core/format.js");
const { asideLine, asideSentence, whenWords, savedWords } = await import("./view.js");
const money = (n) => fmt.money(n);
const lineOf = (extra, today = T) => asideLine(one(bill(extra), today), today, money);
const sentOf = (extra, today = T) => asideSentence(one(bill(extra), today), today, money);

test("gap #12 words: when it is due, in calendar months", () => {
  assert.deepEqual(whenWords("2026-11-28", T), { in: "this month", by: "this month", month: "November", cm: 0 });
  assert.deepEqual(whenWords("2026-12-05", T), { in: "in December", by: "by December", month: "December", cm: 1 });
  assert.deepEqual(whenWords("2027-03-01", T), { in: "in March", by: "by March", month: "March", cm: 4 });
  assert.deepEqual(whenWords("2027-11-01", T), { in: "in November 2027", by: "by November 2027", month: "November 2027", cm: 12 });
});

test("gap #12 words: the line on each bill, one per case", () => {
  assert.deepEqual(lineOf({ nextDue: "2027-03-01", setAside: 950 }), { text: "$950 of $1,200 set aside · due in March · on track", alarm: null, next: null });
  assert.deepEqual(lineOf({ nextDue: "2027-03-01", setAside: 640 }), { text: "$640 of $1,200 set aside · short $260 by March", alarm: "short $260 by March", next: "Put aside $187 a month to catch up." });
  assert.deepEqual(lineOf({ nextDue: "2026-12-20", setAside: 640 }), { text: "$640 of $1,200 set aside · short $460 by December", alarm: "short $460 by December", next: "Put aside $560 before it is due." });
  assert.deepEqual(lineOf({ nextDue: "2026-11-28", setAside: 640 }), { text: "$640 of $1,200 set aside · short $560, due this month", alarm: "short $560, due this month", next: null });
  assert.deepEqual(lineOf({ nextDue: "2027-03-01", setAside: 1200 }), { text: "All $1,200 set aside · due in March", alarm: null, next: null });
  assert.deepEqual(lineOf({ setAside: 1200 }), { text: "All $1,200 set aside", alarm: null, next: null });
  assert.deepEqual(lineOf({ nextDue: "2027-03-01", setAside: 1300 }), { text: "$1,300 set aside, $100 more than the bill · due in March", alarm: null, next: null });
  assert.deepEqual(lineOf({ setAside: 1300 }), { text: "$1,300 set aside, $100 more than the bill", alarm: null, next: null });
  assert.deepEqual(lineOf({ setAside: 640 }), { text: "$640 of $1,200 set aside · no date yet: tap to add one", alarm: null, next: null });
  assert.deepEqual(lineOf({ startDate: "2026-11-12", setAside: 1200, setAsideAt: "2026-10-01" }), { text: "$1,200 noted for the bill due November 12 · tap to update", alarm: null, next: null });
  assert.deepEqual(lineOf({ startDate: "2025-03-01", setAside: 600, setAsideAt: "2025-01-10" }), { text: "$600 noted for the bill due March 1, 2025 · tap to update", alarm: null, next: null });
});

test("gap #12 words: the sentence for the green line and the working, one per case", () => {
  assert.equal(sentOf({ nextDue: "2027-03-01", setAside: 950 }), "$950 of $1,200 is set aside, on track for the bill due in March.");
  assert.equal(sentOf({ nextDue: "2027-03-01", setAside: 640 }), "$640 of $1,200 is set aside, $260 short by March. Put aside $187 a month to catch up.");
  assert.equal(sentOf({ nextDue: "2026-12-20", setAside: 640 }), "$640 of $1,200 is set aside, $460 short by December. Put aside $560 before it is due.");
  assert.equal(sentOf({ nextDue: "2026-11-28", setAside: 640 }), "$640 of $1,200 is set aside, $560 short, and it is due this month.");
  assert.equal(sentOf({ nextDue: "2027-03-01", setAside: 1200 }), "All $1,200 is set aside for the bill due in March.");
  assert.equal(sentOf({ setAside: 1200 }), "All $1,200 is set aside.");
  assert.equal(sentOf({ nextDue: "2027-03-01", setAside: 1300 }), "$1,300 is set aside, $100 more than the bill.");
  assert.equal(sentOf({ setAside: 640 }), "$640 of $1,200 is set aside. Add when it is due to see if you are on track.");
  assert.equal(sentOf({ startDate: "2026-11-12", setAside: 1200, setAsideAt: "2026-10-01" }), "$1,200 was noted for the bill due November 12. Note what is set aside now for the next one, due in November 2027.");
});

test("gap #12 words: the green line after a save names the bill's new state (R7)", () => {
  const f = (extra) => one(bill(extra));
  assert.equal(savedWords(f({ nextDue: "2027-03-01", setAside: 640 }), { was: false }, T, money), "Saved. Car insurance: $640 of $1,200 is set aside, $260 short by March. Put aside $187 a month to catch up.");
  assert.equal(savedWords(f({ startDate: "2026-03-01" }), { was: true }, T, money), "Saved. Car insurance no longer shows what is set aside.");
  assert.equal(savedWords(f({ nextDue: "2027-02-01" }), { was: false }, T, money), "Saved. Car insurance is next due in February.");
  assert.equal(savedWords(f({}), { was: false }, T, money), "Saved. Type what is already set aside for Car insurance to see if it is on track.");
  assert.equal(savedWords(null, { was: true, name: "Car insurance" }, T, money), "Saved.");
});

// ---- the page, drawn with the real kit on the fake DOM
const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
const appendOf = FakeElement.prototype.append;
FakeElement.prototype.append = function (...ns) {
  if (ns.some((n) => n === null || n === undefined)) throw new Error(`append(${ns.map(String).join(", ")}): a browser would write "null"`);
  return appendOf.apply(this, ns);
};
// ui.openUnder puts the form right after the tapped row: the stand-in needs a row's parent and after() for that
if (!Object.getOwnPropertyDescriptor(FakeElement.prototype, "parentElement")) Object.defineProperty(FakeElement.prototype, "parentElement", { get() { return this.parentNode; } });
FakeElement.prototype.after ??= function (...ns) {
  const p = this.parentNode;
  if (!p) return;
  const hold = new FakeElement("x"); hold.append(...ns);
  const added = hold.childNodes.splice(0);
  for (const c of added) c.parentNode = p;
  p.childNodes.splice(p.childNodes.indexOf(this) + 1, 0, ...added);
};
const kit = await import("../../../core/ui/dom.js");
const { render: drawPage, asideForm } = await import("./view.js");
/** Draw the page as the shell does: store.update records the draft and draws again. */
function page(plan0, today = T) {
  let plan = migrate(structuredClone(plan0));
  const s = { saved: [], root: null, went: [] };
  const ctx = () => ({ ui: kit, fmt: { ...fmt, today: () => today }, plan, module: { group: "cashflow", id: "sinking-funds" }, route: { group: "cashflow", id: "sinking-funds", rest: [], query: {} },
    go: (...a) => s.went.push(a), store: { get: () => plan, update: (fn) => { const dr = structuredClone(plan); fn(dr); s.saved.push(dr); plan = dr; draw(); } }, redraw: () => draw() });
  const draw = () => { s.root = new FakeElement("main"); drawPage(s.root, ctx()); };
  draw();
  s.plan = () => plan; s.ctx = ctx;
  return s;
}
const every = (el) => [el, ...el.all()];
const isOpen = (el) => el.hasAttribute("open");
const shutAround = (e) => { for (let p = e.parentNode; p; p = p.parentNode) if (p.tagName === "DETAILS" && !isOpen(p)) return true; return false; };
/** The words a person sees without opening anything: a shut part shows only its summary. */
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden || n.tagName === "STYLE" ? "" : n.tagName === "DETAILS" && !isOpen(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/\s+/g, " ").trim();
}
const partsOf = (root) => every(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partOf = (root, id) => partsOf(root).find((e) => e.dataset.part === id) ?? null;
const statusIn = (el) => el.querySelector(".fold-status")?.textContent ?? "";
const filled = (root) => every(root).filter((e) => (e.tagName === "BUTTON" || (e.tagName === "A" && /\bbtn\b/.test(e.className))) && !/secondary|chip|link|ghost|small|danger/.test(e.className) && !shutAround(e));
const boxesSeen = (root) => every(root).filter((e) => (e.tagName === "INPUT" || e.tagName === "SELECT") && !shutAround(e));
const rowsOf = (root) => every(root).filter((e) => e.tagName === "LI" && e.dataset.key);
const input = (form, name) => every(form).find((e) => e.tagName === "INPUT" && e.getAttribute("name") === name);
const submit = (form) => form.dispatch("submit");

const RIGHT = "Right column: what to put aside each month. One-time costs are spread over the months until their date.";
test("gap #12 page: nothing followed yet: the first view is today's, with one line saying how to note what is set aside", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = page(familyPlan(T));
  const t = seen(s.root);
  assert.match(t, /^Set aside \$\d[\d,]* a month /);
  assert.ok(t.includes("$3,000 once a year · no date yet: tap to add one"), t);
  assert.ok(t.includes("Tap a bill that comes yearly or every three months to note what is already set aside for it."), t);
  assert.ok(!t.includes("set aside ·"), "no set-aside line before a figure is noted");
  assert.equal(filled(s.root).length, 0); assert.equal(boxesSeen(s.root).length, 0);
  // today's line about the right-hand figure stays where it was, and no part is added while nothing is followed (critic 4)
  assert.ok(t.includes(RIGHT), t);
  assert.equal(partOf(s.root, "how"), null);
  assert.equal(partsOf(s.root).length, 0);
});

test("gap #12 page: once a bill is followed, \"How this is worked out\" holds the right-hand figure's working and the source", () => {
  const s = page((() => { const p = emptyPlan(); p.expenses = [bill({ nextDue: "2027-03-01", setAside: 640, setAsideAt: T })]; return p; })());
  const how = partOf(s.root, "how");
  assert.ok(how && !isOpen(how)); assert.equal(statusIn(how), "1 set by you");
  assert.ok(how.textContent.includes("what it costs in a year ÷ 12"), how.textContent);
  assert.ok(how.textContent.includes("Read November 13, 2026"), how.textContent);
  assert.ok(!seen(s.root).includes(RIGHT), "the line moves into the working once there is working to show");
});

test("gap #12 page: a bill that comes back says \"Set aside ›\" (its tap opens the set-aside form); a one-time cost keeps \"Edit ›\" (its tap opens Expenses)", () => {
  const p = emptyPlan();
  p.expenses = [bill({ startDate: "2027-05-01" }), { id: "roof", name: "Roof repair", category: "housing", amount: 8000, period: "once", startDate: "2027-06-15" }];
  const s = page(p);
  const right = (key) => seen(rowsOf(s.root).find((r) => r.dataset.key === key).querySelector(".st"));
  assert.equal(right("typed-car"), "$100 a month Set aside ›");
  assert.equal(right("typed-roof"), "$1,143 a month Edit ›");
  assert.ok(!seen(s.root).includes("Edit › Set aside") && !rowsOf(s.root).some((r) => r.dataset.key === "typed-car" && seen(r).includes("Edit ›")));
});

test("gap #12 page: a bill due early next month is \"less than a month away\" in the working and \"next month\" under Coming up, never \"this month\"", () => {
  const p = emptyPlan();
  p.expenses = [bill({ nextDue: "2026-12-01", setAside: 640, setAsideAt: T })];
  const s = page(p);
  const how = partOf(s.root, "how").textContent;
  assert.ok(how.includes("Car insurance: $1,200 once a year, due in December, less than a month away. Set aside by now: $1,200 × 12 ÷ 12 = $1,200."), how);
  assert.ok(!how.includes("this month"), how);
  const t = seen(s.root);
  assert.ok(t.includes("Car insurance 12/1/2026 · next month $1,200"), t);
  assert.ok(t.includes("short $560 by December"), t);
  // in the same calendar month it is still "this month"
  const p2 = emptyPlan(); p2.expenses = [bill({ nextDue: "2026-11-28", setAside: 640, setAsideAt: T })];
  const s2 = page(p2);
  assert.ok(partOf(s2.root, "how").textContent.includes("due this month, this month") === false);
  assert.ok(partOf(s2.root, "how").textContent.includes("Car insurance: $1,200 once a year, due this month. Set aside by now:"), partOf(s2.root, "how").textContent);
  assert.ok(seen(s2.root).includes("Car insurance 11/28/2026 · this month $1,200"), seen(s2.root));
});

test("gap #12 page: a figure noted before the last bill fell due says so on its line, is never hidden by \"N more\", and the working and the form say why", () => {
  const p = emptyPlan();
  p.expenses = Array.from({ length: 9 }, (_, i) => ({ id: `b${i}`, name: `Bill ${i}`, category: "other", amount: 1000, period: "annual", nextDue: `2027-0${i + 1}-10` }));
  p.expenses[8] = bill({ startDate: "2026-11-12", setAside: 1200, setAsideAt: "2026-10-01" });
  const s = page(p);
  const t = seen(s.root);
  assert.ok(t.includes("Car insurance $1,200 noted for the bill due November 12 · tap to update"), t);
  assert.ok(!t.includes("All $1,200 set aside"), t);
  assert.ok(rowsOf(s.root).some((r) => r.dataset.key === "typed-car" && !shutAround(r)), "kept among the rows shown");
  const how = partOf(s.root, "how").textContent;
  assert.ok(how.includes("Car insurance: $1,200 once a year, next due in November 2027. You noted $1,200 on 10/1/2026, for the bill due November 12, so it does not count toward the next one: tap the bill to note what is set aside now."), how);
  const car = compute(s.plan(), { today: T }).funds.find((f) => f.key === "typed-car");
  const [form] = asideForm(s.ctx(), car, s.plan().expenses[8], {});
  assert.ok(form.textContent.includes("Last noted 10/1/2026, for the bill due 11/12/2026. Empty the box and save to stop tracking it."), form.textContent);
  // saving a figure now dates it today: it counts toward November 2027 again
  input(form, "setAside").value = "100";
  submit(form);
  assert.equal(s.plan().expenses[8].setAsideAt, T);
  assert.ok(seen(s.root).includes("Saved. Car insurance: $100 of $1,200 is set aside, on track for the bill due in November 2027."), seen(s.root));
});

test("gap #12 page: a bill tapped under \"Coming up\" opens its form there, and the green line after Save lands right under that row", () => {
  const p = emptyPlan();
  p.expenses = [bill({ startDate: "2026-01-10" }), { id: "trip", name: "Summer trip", category: "travel", amount: 3000, period: "annual", startDate: "2027-07-01" }];
  const s = page(p);
  const cardIn = (root, title) => every(root).find((e) => e.tagName === "SECTION" && e.querySelector("h2")?.textContent === title);
  const card = (title) => cardIn(s.root, title);
  const due = card("Coming up in the next three months"), all = card("Every irregular cost");
  const dueRow = rowsOf(due).find((r) => r.dataset.key === "typed-car");
  dueRow.click();
  assert.equal(dueRow.getAttribute("aria-expanded"), "true");
  const form = every(due).find((e) => e.tagName === "FORM");
  assert.ok(form, "the form opens under the tapped row, in Coming up");
  assert.equal(every(all).find((e) => e.tagName === "FORM"), undefined);
  input(form, "setAside").value = "1000";
  submit(form);
  const ok = every(s.root).filter((x) => /\bnotice\b/.test(x.className) && /\bok\b/.test(x.className));
  assert.equal(ok.length, 1, "said once");
  const due2 = card("Coming up in the next three months");
  const row2 = rowsOf(due2).find((r) => r.dataset.key === "typed-car");
  const sibs = row2.parentNode.childNodes;
  assert.equal(sibs[sibs.indexOf(row2) + 1], ok[0].parentNode, "right under the row that was tapped");
  assert.ok(ok[0].textContent.startsWith("Saved. Car insurance: $1,000 of $1,200 is set aside"), ok[0].textContent);
  // saved from Coming up with a date that takes it out of the next three months: the green line goes under its line in the list
  const s3 = page(p);
  const row3 = rowsOf(cardIn(s3.root, "Coming up in the next three months")).find((r) => r.dataset.key === "typed-car");
  row3.click();
  const f3 = every(s3.root).find((e) => e.tagName === "FORM");
  input(f3, "setAside").value = "200"; input(f3, "nextDue").value = "2027-09-01";
  submit(f3);
  const ok3 = every(s3.root).filter((x) => /\bnotice\b/.test(x.className) && /\bok\b/.test(x.className));
  assert.equal(ok3.length, 1);
  const line = rowsOf(s3.root).filter((r) => r.dataset.key === "typed-car").at(-1);
  assert.equal(line.parentNode.childNodes[line.parentNode.childNodes.indexOf(line) + 1], ok3[0].parentNode);
});

test("gap #12 page: a short bill's line is on the first view in amber with its catch-up; on track says so; the how part works the sum", () => {
  const p = emptyPlan();
  p.expenses = [bill({ nextDue: "2027-03-01", setAside: 640, setAsideAt: T }),
    { id: "ins", name: "Home insurance", category: "insurance", amount: 540, period: "quarterly", nextDue: "2027-01-15", setAside: 400, setAsideAt: T }];
  const s = page(p);
  const t = seen(s.root);
  assert.ok(t.includes("Car insurance $640 of $1,200 set aside · short $260 by March Put aside $187 a month to catch up."), t);
  assert.ok(t.includes("Home insurance $400 of $540 set aside · due in January · on track"), t);
  const amber = every(s.root).filter((e) => e.className === "sf-short");
  assert.deepEqual(amber.map((e) => e.textContent), ["short $260 by March"]);
  assert.ok(!t.includes("Tap a bill that comes yearly"), "the hint goes once a bill is followed");
  const how = partOf(s.root, "how");
  assert.equal(statusIn(how), "2 set by you");
  assert.ok(how.textContent.includes("Set aside by now: $1,200 × 9 ÷ 12 = $900."), how.textContent);
  assert.ok(how.textContent.includes("$1,200 − $640 = $560, ÷ 3 months = $187 a month."), how.textContent);
  assert.ok(how.textContent.includes("You noted $640 on 11/13/2026: $260 short."), how.textContent);
  assert.equal(filled(s.root).length, 0); assert.equal(boxesSeen(s.root).length, 0);
});

test("gap #12 page: the working with one month or less to go says the whole rest, before it is due; a whole bill set aside says so", () => {
  const p = emptyPlan();
  p.expenses = [{ id: "ins", name: "Home insurance", category: "insurance", amount: 540, period: "quarterly", nextDue: "2026-12-15", setAside: 300, setAsideAt: T },
    bill({ setAside: 1200, setAsideAt: T })];
  const how = partOf(page(p).root, "how").textContent;
  assert.ok(how.includes("Home insurance: $540 every three months, due in December, 1 month away. Set aside by now: $540 × 2 ÷ 3 = $360. You noted $300 on 11/13/2026: $60 short. Still to put aside: $540 − $300 = $240, before it is due."), how);
  assert.ok(how.includes("Car insurance: $1,200 once a year. You noted $1,200 on 11/13/2026: the whole bill is set aside."), how);
});

test("gap #12 page: the bill's form: the set-aside box, the date folded when Expenses has one and in sight when not; Save writes, dates it today and names the new answer", () => {
  const p = emptyPlan();
  p.expenses = [bill({ startDate: "2026-03-01" }), { id: "trip", name: "Summer trip", category: "travel", amount: 3000, period: "annual" }];
  const s = page(p);
  const car = one(bill({ startDate: "2026-03-01" }));
  // with a date on Expenses: "Next due" waits under "More details (optional)"
  const [form] = asideForm(s.ctx(), car, p.expenses[0], {});
  const fold = every(form).find((e) => e.tagName === "DETAILS");
  assert.ok(fold && fold.className.includes("form-more") && !isOpen(fold));
  assert.ok(fold.textContent.includes("Next due") && fold.textContent.includes("Blank: 3/1/2027, from Expenses."), fold.textContent);
  assert.ok(form.textContent.includes("Already set aside"));
  // with no date anywhere: the date box is in sight (the answer needs it)
  const trip = one({ id: "trip", name: "Summer trip", category: "travel", amount: 3000, period: "annual" });
  const [form2] = asideForm(s.ctx(), trip, p.expenses[1], {});
  assert.equal(every(form2).find((e) => e.tagName === "DETAILS"), undefined);
  assert.equal(boxesSeen(form2).length, 2);
  // Save: the figure and today's date go on the expense; the green line names the new state, under the row
  input(form, "setAside").value = "640";
  submit(form);
  const e = s.plan().expenses[0];
  assert.equal(e.setAside, 640); assert.equal(e.setAsideAt, T); assert.equal(e.nextDue, undefined);
  assert.equal(e.name, "Car insurance"); assert.equal(e.amount, 1200); assert.equal(e.startDate, "2026-03-01");
  const ok = every(s.root).filter((x) => /\bnotice\b/.test(x.className) && /\bok\b/.test(x.className));
  assert.deepEqual(ok.map((x) => x.textContent), ["Saved. Car insurance: $640 of $1,200 is set aside, $260 short by March. Put aside $187 a month to catch up."]);
  const row = rowsOf(s.root).filter((r) => r.dataset.key === "typed-car").at(-1);   // its line in the list (the first is "Coming up")
  assert.ok(seen(row).includes("short $260 by March"), seen(row));
  const sibs = row.parentNode.childNodes;
  assert.equal(sibs[sibs.indexOf(row) + 1], ok[0].parentNode, "the green line sits right under the bill's line");
  // the next draw has no green line (said once)
  s.ctx().redraw();
  assert.equal(every(s.root).filter((x) => /\bnotice\b/.test(x.className)).length, 0);
});

test("gap #12 page: a next due date is saved, then the figure is cleared: the bill goes back to today's line", () => {
  const p = emptyPlan();
  p.expenses = [bill({ setAside: 640, setAsideAt: "2026-10-01" })];
  const s = page(p);
  assert.ok(seen(s.root).includes("$640 of $1,200 set aside · no date yet: tap to add one"));
  const [form] = asideForm(s.ctx(), compute(s.plan(), { today: T }).funds[0], s.plan().expenses[0], {});
  assert.equal(input(form, "setAside").value, "640");
  assert.ok(form.textContent.includes("Last noted 10/1/2026."), form.textContent);
  input(form, "nextDue").value = "2027-03-01";
  submit(form);
  assert.equal(s.plan().expenses[0].nextDue, "2027-03-01"); assert.equal(s.plan().expenses[0].setAsideAt, T, "dated today on save");
  assert.ok(seen(s.root).includes("Saved. Car insurance: $640 of $1,200 is set aside, $260 short by March."));
  const [again] = asideForm(s.ctx(), compute(s.plan(), { today: T }).funds[0], s.plan().expenses[0], {});
  input(again, "setAside").value = "";
  submit(again);
  const e = s.plan().expenses[0];
  assert.equal("setAside" in e, false); assert.equal("setAsideAt" in e, false); assert.equal(e.nextDue, "2027-03-01", "the date stays");
  assert.ok(seen(s.root).includes("Saved. Car insurance no longer shows what is set aside."));
  assert.ok(seen(s.root).includes("$1,200 once a year · next 3/1/2027"), seen(s.root));
});

test("gap #12 page: a one-time cost still opens Expenses; the bill's form has a way to change the bill itself there", () => {
  const p = emptyPlan();
  p.expenses = [bill({ startDate: "2026-03-01" }), { id: "roof", name: "Roof repair", category: "housing", amount: 8000, period: "once", startDate: "2027-01-15" }];
  const s = page(p);
  const roof = rowsOf(s.root).find((r) => r.dataset.key === "typed-roof");
  assert.equal(roof.getAttribute("role"), "link");
  roof.click();
  assert.deepEqual(s.went.at(-1), ["cashflow", "expenses", [], { edit: "roof", back: "cashflow/sinking-funds" }]);
  const car = rowsOf(s.root).find((r) => r.dataset.key === "typed-car");
  assert.equal(car.getAttribute("role"), "button"); assert.equal(car.getAttribute("aria-expanded"), "false");
  const [, way] = asideForm(s.ctx(), one(bill({ startDate: "2026-03-01" })), p.expenses[0], {});
  const btn = every(way).find((e) => e.tagName === "BUTTON");
  assert.equal(btn.textContent, "Change the bill on Expenses"); assert.ok(btn.className.includes("secondary"));
  btn.click();
  assert.deepEqual(s.went.at(-1), ["cashflow", "expenses", [], { edit: "car", back: "cashflow/sinking-funds" }]);
});

test("gap #12 page: a long list shows six rows and \"N more irregular costs\", never hiding a short bill", () => {
  const p = emptyPlan();
  // Bill 0 to Bill 8 due on the 10th of January to September 2027; Bill 9 also in September, with nothing set aside
  p.expenses = Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, name: `Bill ${i}`, category: "other", amount: 1000 + i * 100, period: "annual", nextDue: `2027-0${Math.min(i, 8) + 1}-10` }));
  p.expenses[9].setAside = 0;   // 9 whole months away: 1,900 x 3 / 12 = 475 needed by now, none set aside
  const s = page(p);
  const more = partOf(s.root, "costs");
  assert.ok(more && !isOpen(more));
  assert.equal(more.querySelector(".fold-title").textContent, "3 more irregular costs");
  const main = rowsOf(s.root).filter((r) => !shutAround(r)).map((r) => r.dataset.key);
  assert.ok(main.includes("typed-b9"), "the short bill stays among the rows shown");
  assert.ok(!main.includes("typed-b6") || !main.includes("typed-b7"), main.join(", "));
  assert.ok(seen(s.root).includes("Bill 9 $0 of $1,900 set aside · short $475 by September"), seen(s.root));
});

// ---- invariance (gap spec 3.5): with the new fields absent, compute() is what it was
test("gap #12 invariance: over the invented households and the four fixture plans, every fund keeps its keys and its date, and blank new fields change nothing", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const plans = [["family", familyPlan(T)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan()], ["empty", emptyPlan()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  assert.ok(plans.length >= 18);
  const KEYS = ["funds", "monthly", "yearly", "dueNext", "hasData"];
  let funds = 0;
  for (const [name, p0] of plans) for (const day of ["2026-03-01", T, "2027-02-01"]) {
    const p = migrate(structuredClone(p0));
    const d = compute(p, { today: day });
    assert.deepEqual(Object.keys(d), KEYS, name);
    for (const f of d.funds) {
      funds++;
      assert.equal(f.aside, undefined, `${name}: ${f.name}`);
      if (f.source === "typed") { const e = p.expenses.find((x) => x.id === f.expenseId); assert.equal(f.next, f.period === "once" ? e.startDate : e.startDate || null, `${name}: ${f.name}`); }
    }
    const blank = structuredClone(p);
    for (const e of blank.expenses ?? []) Object.assign(e, { setAside: null, setAsideAt: null, nextDue: "" });
    assert.equal(JSON.stringify(compute(blank, { today: day })), JSON.stringify(d), `${name} @ ${day}`);
  }
  assert.ok(funds >= 60, `${funds} funds checked`);
});

test("S11: after a save no part opens or shuts: a bill's figure saved under its line (one from under \"N more irregular costs\" too) leaves every part as it was", () => {
  const openOf = (root) => Object.fromEntries(partsOf(root).map((e) => [e.dataset.part, isOpen(e)]));
  const p = emptyPlan();
  p.expenses = Array.from({ length: 10 }, (_, i) => bill({ id: `b${i}`, name: `Bill ${i + 1}`, amount: 1200 + i * 120 }));
  const s = page(p);
  const before = openOf(s.root);
  assert.deepEqual(before, { costs: false }, "ten bills: six shown, the rest under one shut part");
  // a bill in sight: its form opens under its line, Save writes, and no part moves (How this is worked out comes, shut)
  const shown = rowsOf(s.root).find((r) => !partOf(s.root, "costs").all().includes(r));
  shown.click();
  let form = every(s.root).find((e) => e.tagName === "FORM");
  input(form, "setAside").value = "300";
  submit(form);
  assert.equal(s.saved.length, 1);
  assert.deepEqual(openOf(s.root), { ...before, how: false });
  // a bill from under "N more irregular costs": its line comes up among those in sight with the green line, the part stays shut
  const hidden = partOf(s.root, "costs").all().find((e) => e.tagName === "LI" && e.dataset.key);
  const key = hidden.dataset.key;
  hidden.click();
  form = every(s.root).find((e) => e.tagName === "FORM");
  input(form, "setAside").value = "200";
  submit(form);
  assert.equal(s.saved.length, 2);
  assert.deepEqual(openOf(s.root), { ...before, how: false });
  const again = rowsOf(s.root).find((r) => r.dataset.key === key);
  assert.ok(!partOf(s.root, "costs").all().includes(again), "the saved bill is in sight, not behind the shut part");
  assert.equal(every(s.root).filter((x) => /\bnotice\b/.test(x.className) && /\bok\b/.test(x.className)).length, 1);
});
