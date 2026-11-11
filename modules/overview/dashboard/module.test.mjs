import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("setup checklist counts", () => {
  const p = emptyPlan();
  assert.equal(compute(p).doneCount, 0);
  p.accounts.push({ id: "a", name: "x", type: "checking", balance: 1 });
  p.goals.push({ id: "g", name: "Emergency fund", target: 10000 });
  const d = compute(p);
  assert.equal(d.doneCount, 2);
  assert.equal(d.total, d.steps.length);
});

test("a finished 'Set up my plan' folds the checklist even with the assumptions still to look over", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "a", name: "x", type: "checking", balance: 1 });
  assert.equal(compute(p).setupFinished, false);
  p.guide = { setup: { startedAt: "2026-11-01", finishedAt: "2026-11-01" } };
  const d = compute(p);
  assert.equal(d.setupFinished, true);
  assert.equal(d.next?.key, "people", "the checklist itself still knows what is open");
});

test("where you stand: a lean month is worded once, by setup's standing(), for the done screen and here alike (review 2026-11-02, round 5)", async () => {
  const fs = await import("node:fs");
  const { standing } = await import("../setup/compute.js");
  const { compute: next } = await import("../next-best-action/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const D = "2026-11-02";
  const p = familyPlan(D); p.income.find((x) => x.id === "i-side").countOn = 0;
  p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: next(p, { today: D }).spare.full - 297, period: "monthly", essential: false });
  const st = standing(p, { today: D });
  assert.match(st.headline, /^Counting your uneven pay at what you can count on, more goes out than comes in\. Good months make up for it/);
  assert.equal(st.lean.about, 300);
  // the card shows that sentence and the row's figure from it; it no longer works out a sentence or a held amount of its own
  const view = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  // (only the "moves below" endings are trimmed, by calmHeadline: the sentence itself is setup's)
  assert.ok(view.includes('ui.h("p", { class: "db-head" }, calmHeadline(st.headline, { underWay }))'));
  assert.ok(view.includes("const lean = st.lean ?? null;") && view.includes("money(lean.about)"));
  assert.ok(!view.includes("heldNow") && !view.includes("Counting your uneven pay"), "no held amount or sentence of its own");
});

// ---- one next step (stress test 2026-11-11, FL-HOME)
import { homeNext, calmHeadline } from "./compute.js";
import { monthsNear } from "../../../core/words.js";

const PATH = (o = {}) => ({ started: true, complete: false, step: 2, total: 8, next: { key: "month", name: "Your month", href: "#/cashflow/expenses?guide=plan&step=month" }, planHref: "#/overview/plan", ...o });
const ANSWERS = { key: "answers", name: "The questions", href: "#/overview/setup?guide=plan&step=answers" };

test("homeNext: one filled button for every kind of household", () => {
  const p = emptyPlan();
  const steps = compute(p);
  // first open, nothing started: the questions
  assert.deepEqual(homeNext({ setupOn: true, hasMoney: false, path: { started: false }, setup: { state: "new" }, steps }).kind, "setup");
  // part way through the questions, with or without an account: "question 3 of 7", the setup's own count
  const q = homeNext({ setupOn: true, hasMoney: false, path: PATH({ step: 1, next: ANSWERS }), setup: { state: "started", q: 3, total: 7, href: "#/overview/setup/ages" }, steps });
  assert.equal(q.kind, "questions"); assert.equal(q.label, "Continue your plan: question 3 of 7"); assert.equal(q.href, "#/overview/setup/ages"); assert.equal(q.line, null, "no second count");
  assert.equal(homeNext({ setupOn: true, hasMoney: true, path: PATH({ step: 1, next: ANSWERS }), setup: { state: "started", q: 5, total: 7, href: "#/overview/setup/owe" }, steps }).kind, "questions");
  // the questions answered, no account ticked (x-4): the path, with its count
  const w = homeNext({ setupOn: true, hasMoney: false, path: PATH(), setup: { state: "done" }, steps });
  assert.equal(w.kind, "path"); assert.equal(w.label, "Continue your plan: Your month"); assert.equal(w.line, "Your plan: step 2 of 8");
  // a plan in use, path under way: the path, never the next move
  assert.equal(homeNext({ setupOn: true, hasMoney: true, path: PATH(), setup: { state: "done" }, steps, move: { title: "Keep one month of bills in cash", href: "#/balance/liquidity" } }).kind, "path");
  // complete: the next move, else See your plan (never no button)
  assert.equal(homeNext({ setupOn: true, hasMoney: true, path: PATH({ complete: true, next: null }), setup: { state: "done" }, steps, move: { title: "X", href: "#/x" } }).label, "Your next move: X");
  assert.deepEqual(homeNext({ setupOn: true, hasMoney: true, path: PATH({ complete: true, next: null }), setup: { state: "done" }, steps }), { kind: "plan", label: "See your plan", href: "#/overview/plan", line: null });
  // the questions turned off on this device: the six basics' own "Do step N"
  const off = homeNext({ setupOn: false, hasMoney: false, path: null, setup: null, steps });
  assert.equal(off.kind, "checklist"); assert.equal(off.label, "Do step 1: Add your accounts");
});

test("homeNext: a plan built by hand is not sent back to the seven questions; it continues with the basic it lacks", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "a", name: "x", type: "checking", balance: 1 });
  p.household.people.push({ id: "s", role: "self", name: "Ana" });
  p.income.push({ id: "i", type: "salary", amount: 1 }); p.expenses.push({ id: "e", amount: 1 });
  const steps = compute(p);
  const n = homeNext({ setupOn: true, hasMoney: true, path: PATH({ step: 1, next: ANSWERS }), setup: { state: "new" }, steps });
  assert.equal(n.kind, "basics"); assert.equal(n.label, "Continue your plan: Set your first goal"); assert.equal(n.href, "#/goals/goals");
});

test("calmHeadline: nothing points at moves that are not on the Dashboard, and no second 'next' while the path is under way", () => {
  assert.equal(calmHeadline("Life insurance for the people who count on you comes first. The moves below start there.", { underWay: true }), "The people who count on you would be short if an earner died.", "no second 'first' beside the path's button");
  assert.equal(calmHeadline("Paying off costly debt comes first. The moves below start there.", { underWay: true }), "You have costly debt to pay off.");
  assert.equal(calmHeadline("Paying off costly debt comes first. The moves below start there."), "Paying off costly debt comes first. Your next move starts there.");
  assert.equal(calmHeadline("More goes out than comes in each month. That's the first thing to fix, and the moves below start there."), "More goes out than comes in each month. That's the first thing to fix.");
  assert.equal(calmHeadline("Your month works. Building your emergency fund is next.", { underWay: true }), "Your month works. Your emergency fund is thin.");
  assert.equal(calmHeadline("Your month works. Building your emergency fund is next."), "Your month works. Building your emergency fund is next.", "complete: the button says the same next thing");
  assert.equal(calmHeadline("You're in good shape. Here's how to make it even better.", { underWay: true }), "You're in good shape.");
  assert.ok(!/below/.test(calmHeadline("Counting your uneven pay at what you can count on, more goes out than comes in. Good months make up for it; the moves below start with the lean months.")));
});

test("monthsNear: months short of the target never round up to it (j-first-family/x-2)", () => {
  assert.equal(monthsNear(2.8, 3), "2.8 months");
  assert.equal(monthsNear(2.96, 3), "2.9 months", "down, never to the target");
  assert.equal(monthsNear(3, 3), "3 months");
  assert.equal(monthsNear(3.4, 3), "3 months", "over the target: the usual words");
  assert.equal(monthsNear(5.6, 6), "5.6 months");
  assert.equal(monthsNear(4.2, 6), "4 months", "far from the target: whole months");
  assert.equal(monthsNear(0.9, 6), "0.9 months");
  assert.equal(monthsNear(1, 3), "1 month");
});

test("N4/N5 (review 2026-11-11): the path's first step is said one way: the Dashboard, the quiet row on every page", async () => {
  const { firstStep } = await import("./compute.js");
  const { barFor } = await import("../guide/compute.js");
  const { pathSummary } = await import("../guide/compute.js");
  const { setupCard } = await import("../start/compute.js");
  const today = "2026-11-11";
  const quiet = (p) => { const b = barFor(p, { page: "cashflow/income", today }); return b?.text ?? b?.cont?.text ?? null; };
  // the questions under way: question N of 7 everywhere
  const mid = emptyPlan();
  mid.accounts.push({ id: "a", type: "checking", name: "Checking", balance: 2000 });
  mid.guide = { setup: { startedAt: today, at: "money" } };
  const fs = firstStep(mid);
  assert.equal(fs.kind, "questions");
  const home = homeNext({ setupOn: true, hasMoney: true, path: pathSummary(mid, { today }), setup: setupCard(mid, { today }), steps: compute(mid) });
  assert.equal(home.label, fs.label);
  assert.equal(quiet(mid), `${fs.label} ›`, "never 'step 1 of 5' under 'question 2 of 7'");
  // built on the pages, the questions never opened: the first missing basic everywhere
  const hand = emptyPlan();
  hand.accounts.push({ id: "a", type: "checking", name: "Checking", balance: 2000 });
  hand.household.people.push({ id: "s", role: "self", name: "Pat" });
  hand.income.push({ id: "i", type: "salary", amount: 4000 });
  const b = firstStep(hand);
  assert.deepEqual([b.kind, b.label, b.href], ["basics", "Continue your plan: Enter what goes out", "#/cashflow/expenses"]);
  const ps = pathSummary(hand, { today });
  if (ps.started) assert.equal(homeNext({ setupOn: true, hasMoney: true, path: ps, setup: setupCard(hand, { today }), steps: compute(hand) }).label, b.label);
  assert.equal(firstStep(emptyPlan()), null, "nothing in the plan: Set up my plan, not a basic");
});
