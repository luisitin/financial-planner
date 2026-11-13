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
  // (C5 B7: and "Look over our guesses", with no guess in use there is nothing to look over)
  assert.equal(d.doneCount, 3);
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
  assert.equal(monthsNear(3.4, 3), "3.4 months", "just over, rounding down to it: one decimal, beside 'a bit over the 3' (attack on N3)");
  assert.equal(monthsNear(3.6, 3), "4 months", "over the target, not rounding to it: the usual words");
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
  assert.equal(firstStep(emptyPlan()).kind, "start", "nothing in the plan: Set up my plan, not a basic");
  const pay = emptyPlan(); pay.income.push({ id: "i", type: "salary", amount: 4000 });
  assert.equal(firstStep(pay).label, "Set up my plan", "pay alone, no accounts: the questions (attack on N5)");
});

test("monthsNear: just over the target never rounds down to it beside 'a bit over' (attack on N3)", () => {
  assert.equal(monthsNear(6.06, 6), "6.1 months");
  assert.equal(monthsNear(6.02, 6), "6 months", "within overTarget's margin: no 'over' words, so the plain figure");
  assert.equal(monthsNear(6.6, 6), "7 months");
});

test("firstStep: the question number of the screen its link opens, as setupCard says it (attack: 4 of 7 here, 5 of 7 there)", async () => {
  const { setupCard } = await import("../start/compute.js");
  const { firstStep } = await import("./compute.js");
  for (const at of ["you", "money", "ages", "have", "have-amounts", "owe", "owe-amounts", "spend", "goals", "goal-details"]) {
    const p = emptyPlan(); p.income.push({ id: "i", type: "salary", amount: 4000 });
    p.guide = { setup: { startedAt: "2026-11-10", at } };
    const fs = firstStep(p), sc = setupCard(p);
    assert.equal(fs.kind, "questions", at);
    assert.equal(fs.q, sc.q, `${at}: the same number`);
    assert.equal(fs.href, sc.href, `${at}: the same screen`);
  }
});

// ---- smart guesses C5 B7: the checklist's last step is "Look over our guesses" (key still `assumptions`): done once "These
// look fine" was tapped on Our guesses for you (guide.guessesLookedAt), or when no big guess is in use (and the plan holds
// something to look over); Assumptions' own "reviewed" no longer ticks it
test("C5 B7: Look over our guesses: open with big guesses, done after 'These look fine' or with small guesses only", async () => {
  const { guessedPlan } = await import("../../../qa/fixtures/guessed-plan.mjs");
  const { SHORT_LABEL } = await import("./compute.js");
  const step = (p) => compute(p).steps.find((s) => s.key === "assumptions");
  const p = guessedPlan("2026-11-02");   // the setup's older guesses: Social Security, the debts' rates and payments (big)
  assert.deepEqual([step(p).label, step(p).go, step(p).done], ["Look over our guesses", ["overview", "guesses"], false]);
  assert.equal(SHORT_LABEL.assumptions, "Look over our guesses");
  p.assumptions = { ...(p.assumptions ?? {}), reviewedAt: "2026-11-02" };
  assert.equal(step(p).done, false, "Assumptions reviewed is not our guesses looked over");
  p.guide.guessesLookedAt = "2026-11-02";
  assert.equal(step(p).done, true, "These look fine");
  // only small guesses (the cushion's months and accounts): nothing that moves a verdict much, so nothing to look over
  const q = emptyPlan();
  q.accounts.push({ id: "a", name: "Checking", type: "checking", balance: 1000 });
  q.guesses = { "accounts[a].balance": { k: "account.retire.balance", v: 1000, u: "total", s: null, at: "2026-11-02", d: "2026-11-02" } };
  assert.equal(step(q).done, false, "what is saved for retirement is a big guess");
  q.goals = [{ id: "g", name: "Goal", target: 25000, targetDate: "2030-01-01", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  q.guesses = { "goals[g].target": { k: "overview/setup:cushionTarget", v: 25000, u: "total", s: null, at: "2026-11-02", d: "2026-11-02" } };
  assert.equal(step(q).done, true, "a small guess only");
  // a goal's amount that is our guess decides whether the goal is "behind" and what it needs a month: big (critic M6)
  q.guesses = { "goals[g].target": { k: "goal.home.target", v: 25000, u: "total", s: null, at: "2026-11-02", d: "2026-11-02" } };
  assert.equal(step(q).done, false, "a goal amount that is our guess is looked over");
  q.guesses = { "accounts[a].balance": { k: "gone.key", v: 1000, u: "total", s: null, at: "2026-11-02", d: null } };
  assert.equal(step(q).done, false, "a key no module knows counts as big");
  assert.equal(step(emptyPlan()).done, false, "an empty plan has nothing to look over yet");
});
test("C5 B7: the one next step is the same whether our guesses were looked over or not (the key is unchanged)", async () => {
  const { firstStep, homeNext } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { guessedPlan } = await import("../../../qa/fixtures/guessed-plan.mjs");
  const { jordan, sam, patLee } = await import("../../../qa/fixtures/setup-personas.mjs");
  for (const p of [familyPlan("2026-11-02"), guessedPlan("2026-11-02"), jordan(), sam(), patLee(), emptyPlan()]) {
    const looked = structuredClone(p); looked.guide = { ...(looked.guide ?? {}), guessesLookedAt: "2026-11-02" };
    assert.deepEqual(firstStep(looked), firstStep(p));
    for (const setupOn of [false, true]) {
      const a = homeNext({ setupOn, hasMoney: compute(p).hasMoney, steps: compute(p) }), b = homeNext({ setupOn, hasMoney: compute(looked).hasMoney, steps: compute(looked) });
      assert.deepEqual(a?.kind === "checklist" ? null : a, b?.kind === "checklist" ? null : b);
    }
  }
});

// ---- the C5 follow-ups (docs/handoffs/2026-11-13-guesses-c5.md): the Dashboard drawn with the real UI kit (qa/fixtures/fake-dom.mjs),
// where-you-stand worked out by setup's standing() unless a test hands in its own
let ALL = null;
async function allModules() {
  if (!ALL) { ALL = new Map(); for (const r of (await import("../../registry.js")).default) { const m = (await r.load()).default; ALL.set(`${m.group}/${m.id}`, m); } }
  return ALL;
}
/** drawDashboard(plan, today, { standing(st) -> st, computeOf: { key: fn } }) -> { root, text, rows: [{ k, s, v, href }], row(k), saved (each store.update's draft) } */
async function drawDashboard(plan, today, { standing = null, computeOf: over = {} } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const modules = await allModules();
  const p = migrate(structuredClone(plan));
  const computeOf = (key, params = {}) => {
    if (over[key]) return over[key](p, { today, ...params });
    const r = modules.get(key)?.compute?.(p, params ?? {}) ?? null;
    return key === "overview/setup" && standing && r?.standing ? { ...r, standing: standing(r.standing) } : r;
  };
  const root = new FakeElement("main"), saved = [];
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan: p, modules, isReady: (m) => m.status !== "planned", features: { enabled: () => true }, ai: {}, go() {}, announce() {},
    derived: modules.get("overview/dashboard").compute(p), computeOf, store: { get: () => p, update(fn) { const d = structuredClone(p); fn(d); saved.push(d); } }, view: { build: false }, live: { ai: true, pc: true } });
  await new Promise((r) => setTimeout(r, 0));
  const rows = root.querySelectorAll("a").filter((a) => a.closest(".db-rows")).map((a) => {
    const spans = a.children; const k = spans.find((s) => s.className === "db-k");
    return { k: k ? textOf(k.childNodes[0] ? { childNodes: [k.childNodes[0]], hidden: false } : k) : "", s: textOf(k?.querySelector(".db-s")), v: textOf(spans.find((s) => /db-v/.test(s.className))), href: a.getAttribute("href") };
  });
  return { root, text: textOf(root), rows, row: (k) => rows.find((r) => r.k === k) ?? null, saved };
}

test("C1/N7: the left-over row, while it waits, names what it waits for in Get started's words and opens that question", async () => {
  const fs = await import("node:fs");
  const { SPARE_WAITS } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const D = "2026-11-13";
  // the summary tile's own words (setup/view.js SPARE_WAITS): one reason, said the same on both screens
  const setupView = fs.readFileSync(new URL("../setup/view.js", import.meta.url), "utf8");
  const theirs = /const SPARE_WAITS = (\{.*?\});\n/.exec(setupView)?.[1];
  assert.ok(theirs, "setup's tile words are where the test reads them");
  assert.deepEqual(SPARE_WAITS, Function(`return (${theirs});`)());
  for (const [on, s, v, at] of [
    ["pay", "Depends on your pay. With our pay guess, about $1,370 spare", "Type your pay ›", "money"],
    ["both", "Depends on your pay and spending. With our guesses, about $1,370 spare", "Type your pay ›", "money"],
    ["spending", "Depends on your spending. With our spending guesses, about $1,370 spare", "Type yours ›", "spend"],
  ]) {
    const d = await drawDashboard(familyPlan(D), D, { standing: (st) => ({ ...st, spare: 1374, spareWaits: true, spareWaitsOn: on }) });
    const r = d.row("Left over each month");
    assert.deepEqual([r.s, r.v, r.href], [s, v, `#/overview/setup/${at}?back=done`], on);
  }
  // short with our guesses: "short", never a minus sign
  const d = await drawDashboard(familyPlan(D), D, { standing: (st) => ({ ...st, spare: -455, spareWaits: true, spareWaitsOn: "pay" }) });
  assert.equal(d.row("Left over each month").s, "Depends on your pay. With our pay guess, about $460 short");
});

test("H3: a row that cannot be worked out says standing().tileWhy, the reason Get started's summary gives, and links where it waits", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const D = "2026-11-13";
  const why = { netWorth: null, spare: "Needs what comes in.", cushion: "Needs your savings.", retire: "Needs your savings and spending." };
  const d = await drawDashboard(familyPlan(D), D, { standing: (st) => ({ ...st, spare: null, runway: null, retire: null, retirementKnown: true, tileWhy: why, tileAt: { retire: "have" } }) });
  assert.deepEqual([d.row("Left over each month").s, d.row("Emergency fund").s, d.row("Retirement").s], ["Needs what comes in", "Needs your savings", "Needs your savings and spending"]);
  assert.equal(d.row("Retirement").href, "#/overview/setup/have?back=done", "the question it waits for (standing().tileAt)");
  // the check that waits for "a few more of your figures" still opens Will the money last?, which lists them
  const e = await drawDashboard(familyPlan(D), D, { standing: (st) => ({ ...st, retire: null, retirementKnown: true, tileWhy: { ...why, retire: "Needs a few more of your figures." }, tileAt: { retire: "spend" } }) });
  assert.deepEqual([e.row("Retirement").s, e.row("Retirement").href], ["Needs a few more of your figures", "#/retirement/projection"]);
  // Social Security or the ages not given yet: the questions' ages screen, with what it needs
  const f = await drawDashboard(familyPlan(D), D, { standing: (st) => ({ ...st, retire: null, retirementKnown: false, retirementMissing: "your birth dates", tileWhy: { ...why, retire: "Needs your birth dates." }, tileAt: { retire: "ages" } }) });
  assert.deepEqual([f.row("Retirement").s, f.row("Retirement").href], ["Needs your birth dates", "#/overview/setup/ages?back=done"]);
});

test("C3: a card with only goal amounts never makes the month wait; it shows quietly after the money tiles", async () => {
  const S = await import("../setup/compute.js");
  const G = await import("../guesses/compute.js");
  const { jordan } = await import("../../../qa/fixtures/setup-personas.mjs");
  const { mergeEstimators } = await import("../../../core/estimate/index.js");
  const D = "2026-11-02";
  const REG = mergeEstimators([{ from: "overview/guesses", estimators: G.estimators, tables: G.TABLES }, { from: "overview/setup", estimators: S.estimators }]);
  const OPTS = { estimators: REG.estimators, tables: REG.tables, today: D };
  const p = jordan(D);
  S.applyGoalPicks(p, ["education"]); S.applyGoalDetails(p, { education: { target: "" } }, D); S.markAt(p, "done", D);
  for (const id of ["debt", "spend"]) G.useFillGuesses(p, { ...OPTS, only: id });
  assert.equal(G.guessCards(p, OPTS).first, "goals");
  const d = await drawDashboard(p, D);
  // the month and retirement rows say their own answers, never "See below"
  for (const r of d.rows) assert.doesNotMatch(`${r.s} ${r.v}`, /See below|Depends on what you owe|Depends on the figures below/, r.k);
  // the card: after the tiles, its button outlined (the where-you-stand card holds the page's one filled button)
  const card = d.root.querySelectorAll("section").find((x) => /Fill in what you skipped/.test(x.textContent));
  assert.ok(card, "the goal amounts are offered on the Dashboard");
  assert.match(card.textContent, /college goal/);
  const kids = d.root.childNodes, tiles = kids.findIndex((x) => /Net worth/.test(x.textContent ?? "") && /You owe/.test(x.textContent ?? ""));
  assert.ok(tiles >= 0 && kids.indexOf(card) > tiles, "after the money tiles");
  const use = card.querySelectorAll("button").find((b) => b.textContent.trim() === "Use these guesses");
  assert.match(use.className, /secondary/);
  // its tap writes the goal amounts alone: the spending and debt cases keep their own answers (no fillSkipped written)
  use.click();
  const after = d.saved.at(-1);
  assert.ok(after.goals.filter((g) => g.id.startsWith("setup-goal-education")).every((g) => g.target > 0), "each child's college amount");
  assert.equal(after.guide.fillSkipped, p.guide?.fillSkipped, "the other cards' answer is untouched");
  assert.deepEqual(after.expenses, p.expenses); assert.deepEqual(after.debts, p.debts);
});

test("H1/N1: the Goals tile is Your plan's line: a blank amount is said, and behind on our guess of the amount says so", async () => {
  const S = await import("../setup/compute.js");
  const G = await import("../guesses/compute.js");
  const { estimate, settle, mergeEstimators } = await import("../../../core/estimate/index.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const D = "2026-11-02";
  const REG = mergeEstimators([{ from: "overview/guesses", estimators: G.estimators, tables: G.TABLES }, { from: "overview/setup", estimators: S.estimators }]);
  const GO = { estimators: REG.estimators, tables: REG.tables, today: D };
  const p = migrate(emptyPlan()); S.applyYou(p, { name: "Sam", who: "me", kids: 0, state: "AZ" });
  const step = (fn) => { const before = structuredClone(p); fn((k, o = {}) => estimate(before, k, { ...GO, ...o })); settle(p, GO); };
  step((guess) => S.applyMoney(p, { people: { "setup-self": { status: "work", amount: "52000", period: "annual" } }, today: D }, D, { guess }));
  S.applyHavePicks(p, ["checking"]); step((guess) => S.applyHaveAmounts(p, { checking: 5000 }, D, { guess }));
  S.applyGoalPicks(p, ["home", "trip"]);
  step((guess) => S.applyGoalDetails(p, { home: { target: "" }, trip: { target: "" } }, D, null, { guess }));
  S.markAt(p, "done", D);
  const d = await drawDashboard(p, D);
  const tile = d.root.querySelectorAll("a").find((a) => a.getAttribute("href") === "#/goals/goals");
  // the short form (critic F5): the need worked out from our amount is left to Goals and Your plan, which still say it
  assert.match(tile.textContent, /1 goal behind by our guess of its amount; 1 needs an amount/);
  assert.doesNotMatch(tile.textContent, /it needs about/);
  const view = (await import("node:fs")).readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(view.includes("goalsWords(gl, gb,") && view.includes("short: true") && !view.includes('"all on track"'), "the line is plan/words.js goalsWords, said once");
});
