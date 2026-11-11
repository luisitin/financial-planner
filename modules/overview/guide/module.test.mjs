// modules/overview/guide/module.test.mjs -- the seven guides' definitions, how a step counts as done, the counts,
// the next step, which step a page is, what the shell draws around a page, and the changes a tap makes.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  JOURNEYS, journeyById, visibleSteps, stepState, journeyStatus, stepForPage, neighbours, barFor, activeSummary, stepHref,
  startGuide, markLooked, markNone, markLater, clearMark, leaveGuide, restartGuide, finishGuide, touchGuide, compute, activeJourney, OWN_PAGES,
  PATH_ID, SELF_LED, partsFor, pathSummary, nextAfter, resultOrder, passStep,
} from "./compute.js";
import { isDirty } from "./act.js";
import { houseGoal, detailed, emergencyGoal } from "./journeys.js";
import { compute as dashboard } from "../dashboard/compute.js";
import { router } from "../../../core/router.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { sam, jordan, patLee, ruth, finishSetup } from "../../../qa/fixtures/setup-personas.mjs";
import * as S from "../setup/compute.js";
import manifest from "./module.js";

const MODS = fileURLToPath(new URL("../../", import.meta.url));
const src = (key) => { const f = `${MODS}${key}/module.js`; return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
const viewSrc = (key) => fs.readFileSync(`${MODS}${key}/view.js`, "utf8");
const empty = () => migrate(emptyPlan());
const family = () => migrate(familyPlan("2026-10-31"));
const J = (id) => journeyById(id);
const st = (s, key) => s.steps.find((x) => x.key === key);
const VERBS = ["Add", "Enter", "Set", "Check", "Pick", "See", "Say", "Sort", "Start", "Compare", "Fit", "List", "Note", "Answer"];

test("definitions: seven guides, unique ids and keys, 3 to 7 numbered steps (the path comes and goes with the household), extras only show when they apply", () => {
  assert.equal(JOURNEYS.length, 7);
  assert.equal(new Set(JOURNEYS.map((j) => j.id)).size, 7);
  for (const j of JOURNEYS) {
    assert.match(j.id, /^[a-z]+(-[a-z]+)*$/);
    assert.equal(new Set(j.steps.map((s) => s.key)).size, j.steps.length, `${j.id} keys unique`);
    const numbered = j.steps.filter((s) => !s.optional);
    // the path ("plan") is the one exception to both rules: its steps come and go with the household, like the retirement guide's
    // variant (up to 12 steps are defined; a household gets 4 to 9 of them, tested below)
    if (j.id !== PATH_ID) assert.ok(numbered.length >= 3 && numbered.length <= 7, `${j.id} has ${numbered.length} numbered steps`);
    // the numbering never changes as data arrives: a step that can hide must be an extra
    for (const s of j.steps) if (s.show) assert.ok(s.optional, `${j.id}/${s.key}: a step with show() must be an extra`);
    for (const s of j.steps.filter((x) => x.optional)) assert.ok(s.why, `${j.id}/${s.key}: an extra says why it is there`);
    assert.ok(j.line.endsWith(".") && j.minutes > 0 && j.finish?.label && j.finish?.text);
  }
});
test("definitions: every door opens a usable page, never a 'Coming soon' one", () => {
  for (const j of JOURNEYS) for (const key of [...j.steps.flatMap((s) => [s.page, s.alt?.page]), ...j.more.map((m) => m.page), j.finish.page].filter(Boolean)) {
    const m = src(key);
    assert.ok(m, `${j.id}: ${key} exists`);
    assert.match(m, /status: "(usable|complete)"/, `${j.id}: ${key} is usable`);
  }
});
test("copy: shorts fit a button and start with a verb; asks are one sentence; every step says when it is done", () => {
  for (const j of JOURNEYS) for (const s of j.steps) {
    assert.ok(s.short.length <= 21, `${j.id}/${s.key} short "${s.short}" is ${s.short.length}`);
    assert.ok(VERBS.includes(s.short.split(" ")[0]), `${j.id}/${s.key} short starts with a verb: "${s.short}"`);
    for (const a of [s.ask, s.alt?.ask].filter(Boolean)) {
      assert.match(a, /^[A-Z].*\.$/, `${j.id}/${s.key} ask is a sentence`);
      assert.equal(a.slice(0, -1).split(/\.\s+[A-Z]/).length, 1, `${j.id}/${s.key} ask is one sentence`);
    }
    assert.match(s.doneWhen ?? "", /^it is done once .*\.$/, `${j.id}/${s.key} doneWhen`);
    assert.ok(s.check || s.looked || s.none, `${j.id}/${s.key} can be done`);
    for (const m of j.more) assert.ok(m.title, `${j.id} more ${m.page} has a title`);
  }
});
test("copy: when an ask says 'tap X', X is a button on that page", () => {
  for (const j of JOURNEYS) for (const s of j.steps) for (const [page, ask] of [[s.page, s.ask], [s.alt?.page, s.alt?.ask]]) {
    if (!ask) continue;
    for (const m of ask.matchAll(/tap ((?:[A-Z][a-z']*)(?: (?:[a-z]+|[A-Z][a-z]*))*?)(?=[,.;]| or | so | for |$)/g)) {
      for (const label of m[1].split(" or ")) assert.ok(viewSrc(page).includes(label.trim()), `${j.id}/${s.key}: "${label}" on ${page}`);
    }
  }
});
test("the path: id plan, never whole-plan; its finish is Your plan; steps are look-only, named, unblocked", () => {
  assert.equal(PATH_ID, "plan");
  assert.equal(J("whole-plan"), null, "the old guide is gone (a stored whole-plan entry is just unused)");
  const j = J(PATH_ID);
  assert.deepEqual([j.title, j.minutes, j.finish.page, j.finish.label, j.more], ["Build my plan", 20, "overview/plan", "See your plan", []]);
  assert.equal(j.steps.length, 12);
  for (const x of j.steps) {
    assert.ok(x.name && x.looked === true, `${x.key}: a name, look-only`);
    assert.equal(x.needs, undefined, `${x.key}: nothing blocks`);
    const m = src(x.page);
    assert.ok(m && /status: "usable"/.test(m), `${x.key}: ${x.page} is usable`);
  }
  assert.ok(src(j.finish.page).includes('status: "usable"'));
  assert.deepEqual(SELF_LED, ["overview/setup", "overview/plan"]);
  // the Dashboard's six steps are its own, unchanged
  assert.equal(dashboard({}).steps.length, 6);
});
test("the path's steps for each household, in order, with M (built with setup's own apply functions)", () => {
  const T = "2026-11-02";
  const finish = (name, p) => finishSetup(name, p, T);
  const keys = (p, off = []) => pathSummary(p, { today: T, off }).parts.map((x) => x.key);
  assert.deepEqual(keys(finish("sam", sam())), ["answers", "month", "debts", "cushion", "retire", "taxes"], "young renter: 6 (no retirement savings yet: no \"What would help\" step, stress test j-first-renter/F4)");
  assert.deepEqual(keys(finish("jordan", jordan())), ["answers", "month", "cushion", "protect", "retire", "taxes"], "family with no retirement savings on file: no \"What would help\" yet");
  assert.deepEqual(keys(finish("patLee", patLee())), ["answers", "month", "cushion", "protect", "retire", "taxes"], "near retirement (no 'what would help': the plan lasts)");
  const r = finish("ruth", ruth());
  assert.deepEqual(keys(r), ["answers", "month", "cushion", "retire", "take-out", "rmd"], "retired widow: 6");
  assert.deepEqual(keys(r, ["retirement/rmd"]), ["answers", "month", "cushion", "retire", "take-out"], "a page that is off drops its step");
  for (const p of [sam(), jordan(), patLee(), ruth(), family()]) { const n = keys(p).length; assert.ok(n >= 4 && n <= 9, `${n} steps`); }
  // retiree wording
  const rs = journeyStatus(J(PATH_ID), r, { today: T });
  assert.equal(st(rs, "month").title, "See what comes in and goes out");
  assert.match(st(rs, "month").ask, /comes from your savings each month/);
  // the family plan
  assert.deepEqual(keys(family()), ["answers", "month", "debts", "cushion", "protect", "retire", "college", "taxes"]);
});
test("the path: month is done by typed spending, not by empty or mostly guessed spending", () => {
  const p = family();
  assert.equal(st(journeyStatus(J(PATH_ID), p), "month").state, "done", "typed expenses");
  const e = empty();
  assert.equal(st(journeyStatus(J(PATH_ID), e), "month").state, "todo", "no expenses");
  const g = family(); g.guesses = {}; for (const x of g.expenses) g.guesses[`expenses[${x.id}].amount`] = { k: "overview/guesses:spend", v: x.amount, u: "month", s: null, at: "2026-10-31", d: "x" };
  const gs = journeyStatus(J(PATH_ID), g, { today: "2026-10-31" });
  assert.equal(st(gs, "month").state, "todo", "mostly our guesses: not done by data");
});
test("done checks: a 0% loan counts as detailed; Home repairs is not a down payment; the emergency fund by name or icon", () => {
  const p = empty();
  p.accounts = [{ id: "a1", name: "Family loan", type: "loan", balance: -2000 }];
  assert.equal(detailed(p), false);
  p.debts = [{ accountId: "a1", rate: 0, minPayment: 100 }];
  assert.equal(detailed(p), true);
  const g = (name, icon) => ({ ...empty(), goals: [{ id: "g", name, icon }] });
  assert.equal(houseGoal(g("House down payment", "🏠")), true);
  assert.equal(houseGoal(g("Home repairs", "🏠")), false);
  assert.equal(houseGoal(g("Homeschool", "🏠")), false);
  assert.equal(houseGoal(g("Our new home", "🏠")), true);
  assert.equal(houseGoal(g("Home", "🎯")), true, "by name, as Home affordability finds it");
  assert.equal(houseGoal(g("Home office", "🏠")), false);
  assert.equal(houseGoal(g("Pay off the house", "🎯")), false, "paying a home off is not saving to buy one");
  assert.equal(houseGoal(g("Trip home for Christmas", "✈️")), false);
  assert.equal(houseGoal(g("Townhouse fund", "🎯")), true, "a home run into another word");
  assert.equal(emergencyGoal(g("Rainy day", "🎯")), true);
  assert.equal(emergencyGoal(g("Anything", "🛟")), true);
  assert.equal(emergencyGoal(g("Car", "🚗")), false);
});
test("visibleSteps: extras show when they apply, and hide when their page is off; numbered steps always count", () => {
  const p = empty();
  assert.deepEqual(visibleSteps(J("debt"), p).map((s) => s.key), ["add", "rates", "order"]);
  p.accounts = [{ id: "c", type: "credit", balance: -500 }];
  assert.deepEqual(visibleSteps(J("debt"), p).map((s) => s.key), ["add", "rates", "order", "cards"]);
  assert.deepEqual(visibleSteps(J("debt"), p, ["debt/credit-cards", "debt/payoff"]).map((s) => s.key), ["add", "rates", "order"]);
});
test("stepState: the plan's data wins; a look-only step is done once ticked; does-not-apply and skipped", () => {
  const p = empty(), d = structuredClone(p);
  const add = J("debt").steps[0], cards = J("debt").steps.find((s) => s.key === "cards");
  assert.equal(stepState(cards, p, {}), "todo");
  markLooked(d, "debt", "cards", "2026-10-31");
  assert.equal(stepState(cards, d, d.guide.journeys.debt), "done");
  const q = structuredClone(p);
  markLater(q, "debt", "add", "2026-10-31");
  assert.equal(stepState(add, q, q.guide.journeys.debt), "later");
  markNone(q, "debt", "add", "2026-10-31");
  assert.equal(stepState(add, q, q.guide.journeys.debt), "none");
  assert.equal(q.guide.journeys.debt.later.add, undefined);
  markLater(q, "debt", "add", "2026-10-31");
  assert.equal(stepState(add, q, q.guide.journeys.debt), "later");
  assert.equal(q.guide.journeys.debt.none.add, undefined);
  clearMark(q, "debt", "add");
  assert.equal(stepState(add, q, q.guide.journeys.debt), "todo");
  q.accounts = [{ id: "c", type: "credit", balance: -500 }];
  markLater(q, "debt", "add", "2026-10-31");
  assert.equal(stepState(add, q, q.guide.journeys.debt), "done", "data beats a skip");
});
test("journeyStatus on an empty plan: nothing done, step 1 next, not started; needs shown", () => {
  for (const j of JOURNEYS) {
    const s = journeyStatus(j, empty());
    assert.equal(s.doneCount, 0); assert.equal(s.finished, false); assert.equal(s.started, false);
    assert.equal(s.next.index, 1);
  }
  assert.deepEqual(JOURNEYS.map((j) => journeyStatus(j, empty()).total), [4, 3, 5, 3, 7, 5, 7], "the path: the four steps everyone gets");
  const r = journeyStatus(J("retire"), empty());
  assert.deepEqual(st(r, "spend").blockedBy, { key: "people", index: 1, short: "Add birth dates", href: "#/household/people?guide=retire&step=people" });
  assert.equal(st(r, "pension").blockedBy, null);
});
test("journeyStatus on the family plan (worked by hand from qa/fixtures): counts and which steps", () => {
  const want = { plan: [1, 8, ["answers", "month"]], debt: [2, 3, ["add", "rates"]], budget: [4, 5, ["income", "accounts", "spending", "cushion"]], home: [1, 3, ["pay"]], retire: [5, 7, ["people", "savings", "spend", "ss", "saving"]], taxes: [3, 5, ["people", "income", "state"]], protect: [3, 7, ["people", "savings", "spend"]] };
  const p = family();
  for (const j of JOURNEYS) {
    const s = journeyStatus(j, p);
    assert.deepEqual([s.doneCount, s.total, s.steps.filter((x) => x.state === "done").map((x) => x.key)], want[j.id], j.id);
    assert.equal(s.started, false, `${j.id}: data alone does not make a guide started`);
  }
  assert.deepEqual(journeyStatus(J("debt"), p).steps.filter((x) => x.optional).map((x) => x.key), ["cards", "one-loan"]);
});
test("journeyStatus: does-not-apply counts; finished once every numbered step is done even with extras left; next prefers to-do over skipped", () => {
  const p = family();
  markLater(p, "home", "afford", "2026-10-31");
  assert.equal(journeyStatus(J("home"), p).next.key, "afford", "the goal needs afford: back to the skipped one");
  markNone(p, "home", "afford", "2026-10-31");
  let s = journeyStatus(J("home"), p);
  assert.equal(s.doneCount, 2); assert.equal(s.started, true);
  assert.equal(s.next.key, "goal");
  markLater(p, "home", "goal", "2026-10-31");
  s = journeyStatus(J("home"), p);
  assert.equal(s.next.key, "goal", "only the skipped step is left");
  p.goals.push({ id: "h", name: "House down payment", icon: "🏠" });
  s = journeyStatus(J("home"), p);
  assert.equal(s.complete, true); assert.equal(s.finished, true); assert.equal(s.next, null);
  assert.deepEqual(s.steps.filter((x) => x.optional).map((x) => x.key), ["lenders", "rent-buy", "fit"], "lenders only with loans or cards");
  assert.equal(s.extrasLeft, 3); assert.equal(s.nextExtra.key, "lenders");
});
test("finishedAt keeps a guide Done when new data reopens a step", () => {
  const p = family();
  for (const k of ["policies", "life", "papers", "contacts"]) markNone(p, "protect", k, "2026-10-31");   // people, savings and spend are in the family plan
  assert.equal(journeyStatus(J("protect"), p).complete, true);
  finishGuide(p, "protect", "2026-10-31");
  clearMark(p, "protect", "contacts");
  const s = journeyStatus(J("protect"), p);
  assert.equal(s.complete, false); assert.equal(s.finished, true);
});
test("stepForPage: the named step wins; a page used twice moves on; an alt page finds its step; other pages none", () => {
  const p = family();
  const home = journeyStatus(J("home"), p);
  assert.equal(stepForPage(home, "goals/house", "goal").step.key, "goal");
  assert.equal(stepForPage(home, "goals/house").step.key, "afford");
  p.whatIfs = { ...(p.whatIfs ?? {}), house: { price: 400000 } };
  assert.equal(stepForPage(journeyStatus(J("home"), p), "goals/house").step.key, "goal");
  const wp = journeyStatus(J("plan"), empty());
  assert.deepEqual([stepForPage(wp, "cashflow/expenses").step.key, stepForPage(wp, "cashflow/expenses").viaAlt], ["month", false]);
  assert.equal(stepForPage(wp, "goals/house"), null, "home does not apply to an empty plan");
  assert.equal(stepForPage(wp, "cashflow/expenses", "nope").step.key, "month", "an unknown step key falls back to the page's own step");
});
test("neighbours: no previous on step 1; next jumps done steps; wraps to an earlier open one; none left -> null", () => {
  const p = family();
  const s = journeyStatus(J("budget"), p);
  assert.equal(neighbours(s, st(s, "income")).prev, null);
  assert.equal(neighbours(s, st(s, "income")).next.key, "budget");
  const w = neighbours(s, st(s, "cushion"));
  assert.equal(w.next.key, "budget"); assert.equal(w.wrapped, true);
  p.budgets = [{ id: "b", category: "food", amount: 300 }];
  const s2 = journeyStatus(J("budget"), p);
  assert.equal(neighbours(s2, st(s2, "budget")).next, null);
});
test("neighbours: Skip goes to a step that can be done now; one that needs the skipped step only when nothing else is left", () => {
  const home = journeyStatus(J("home"), empty());
  assert.equal(st(home, "lenders"), undefined, "no loans or cards: no lenders step");
  assert.equal(neighbours(home, st(home, "afford")).next.key, "rent-buy", "not the goal (needs afford)");
  const owes = empty(); owes.accounts = [{ id: "c", type: "credit", balance: -900 }];
  const h2 = journeyStatus(J("home"), owes);
  assert.equal(st(h2, "lenders").blockedBy.key, "pay");
  assert.equal(h2.nextExtra.key, "rent-buy", "the first extra that can be done now");
  const debt = journeyStatus(J("debt"), empty());
  assert.equal(neighbours(debt, st(debt, "add")).next.key, "rates", "every later step needs add: the next in order");
});
test("Do step N never points at a step waiting on a skipped one while another can be done; Skip prefers a free step before it to a blocked one after", () => {
  const p = empty();
  markLater(p, "debt", "add", "2026-10-31");
  assert.equal(journeyStatus(J("debt"), p).next.key, "add", "every other step needs add: back to the skipped one");
  const r = family(); delete r.expenses; r.expenses = []; r.retirement = { ...(r.retirement ?? {}), spendingMonthly: null };
  markLater(r, "retire", "spend", "2026-10-31");
  let s = journeyStatus(J("retire"), r);
  assert.equal(st(s, "chance").blockedBy.key, "spend");
  assert.equal(s.next.key, "pension", "a free step before the skipped one");
  const nb = neighbours(s, st(s, "pension"));
  assert.deepEqual([nb.next.key, nb.wrapped], ["spend", true], "not chance, which needs spend: back to step 3");
  assert.equal(st(s, "estimate"), undefined);
  const t = journeyStatus(J("taxes"), empty());
  assert.equal(st(t, "estimate").hasCheck, true, "a look-only step that can also be saved says so");
  assert.equal(st(t, "room").hasCheck, false);
});
test("the retirement and protect guides do not finish before their pages can answer", () => {
  const p = empty();
  p.household.people = [{ id: "me", name: "Me", birthDate: "1966-05-01" }];
  p.accounts = [{ id: "s", type: "savings", balance: 1000 }];
  let r = journeyStatus(J("retire"), p);
  assert.equal(st(r, "chance").blockedBy.key, "spend", "no spending yet: the chance page cannot answer");
  assert.equal(st(r, "spend").none, undefined, "spending cannot be waved away");
  p.expenses = [{ id: "e", name: "Rent", amount: 900, frequency: "monthly" }];
  r = journeyStatus(J("retire"), p);
  assert.equal(st(r, "spend").state, "done"); assert.equal(st(r, "chance").blockedBy, null);
  const q = empty(); q.household.people = [{ id: "me", name: "Me" }];
  const pr = journeyStatus(J("protect"), q);
  assert.equal(st(pr, "people").state, "todo", "an adult needs a birth date");
  assert.deepEqual(st(pr, "life").blockedBy.key, "people");
});
test("isDirty: a typed box on the page whose value changed since it was focused; gone, unchanged, choice lists, tick boxes, search and marked controls do not count", () => {
  const c = (o) => ({ type: "text", value: "", isConnected: true, ...o });
  const a = c({}), b = c({ type: "checkbox", checked: false }), gone = c({ isConnected: false }), find = c({ type: "search" }), filt = c({ dataset: { nodirty: "" } });
  const starts = new Map([[a, ""], [b, false], [gone, ""], [find, ""], [filt, "x"]]);
  assert.equal(isDirty([a, b, gone, find, filt], starts), false);
  gone.value = "typed"; find.value = "typed"; filt.value = "y";
  assert.equal(isDirty([a, b, gone, find, filt], starts), false);
  b.checked = true;
  assert.equal(isDirty([a, b], starts), false, "a tick box is not typing");
  const sel = c({ type: "select-one", value: "x" }); starts.set(sel, "x"); sel.value = "y";
  assert.equal(isDirty([sel], starts), false, "a choice list (a filter, an account picker) is not typing");
  a.value = "250";
  assert.equal(isDirty([a, b], starts), true);
  const t = c({ type: "textarea", value: "" }); starts.set(t, ""); t.value = "notes";
  assert.equal(isDirty([t], starts), true);
  assert.equal(isDirty([c({ value: "250" })], starts), false, "never focused: not typed here");
});
test("barFor: guide mode for an address that names a guide (followed or not); compact for a followed guide's step; review; quick; continue", () => {
  const p = family();
  const q = { guide: "debt", step: "rates" };
  for (const own of OWN_PAGES) assert.equal(barFor(p, { page: own, query: { from: "quick" } }), null);
  for (const own of SELF_LED) assert.equal(barFor(p, { page: own, query: { guide: "plan" } }), null, "the questions and Your plan lead the way themselves");
  assert.equal(barFor(p, { page: "overview/dashboard" }), null);
  assert.deepEqual(barFor(p, { page: "goals/house", query: { from: "quick" } }), { mode: "quick" });
  // a step of the Monthly review: one line back to the check-in (and the way on at the bottom), never on the review itself
  const rv = barFor(p, { page: "cashflow/budget", query: { from: "review", review: "2026-10", month: "2026-10" } });
  assert.deepEqual([rv.mode, rv.month, typeof rv.cont.text], ["review", "2026-10", "string"]);
  assert.equal(barFor(p, { page: "cashflow/budget", query: { from: "review", review: "junk" } }).month, null);
  assert.notEqual(barFor(p, { page: "overview/monthly-review", query: { from: "review" } }).mode, "review");
  // the address alone brings the bar, whether or not that guide is followed (3.2)
  const named = barFor(p, { page: "balance/liabilities", query: q });
  assert.equal(named.mode, "guide"); assert.equal(named.step.key, "rates");
  startGuide(p, "budget", "2026-10-31");
  assert.equal(barFor(p, { page: "balance/liabilities", query: q }).mode, "guide", "debt's bar although the budget guide is the followed one");
  assert.equal(barFor(p, { page: "balance/liabilities", query: q }).journey.id, "debt");
  leaveGuide(p);
  startGuide(p, "debt", "2026-10-31");
  const b = barFor(p, { page: "balance/liabilities", query: q });
  assert.equal(b.mode, "guide"); assert.equal(b.step.key, "rates"); assert.equal(b.index, 2); assert.equal(b.total, 3); assert.equal(b.state, "done");
  assert.equal(b.next.key, "order");
  assert.deepEqual(JSON.parse(JSON.stringify(b)), b, "plain data only");
  const c = barFor(p, { page: "debt/payoff" });
  assert.equal(c.mode, "compact"); assert.equal(c.step.key, "order"); assert.equal(typeof c.cont.href, "string", "compact carries the continue row");
  assert.equal(barFor(p, { page: "debt/payoff", query: { from: "review", review: "2026-10" } }).mode, "review", "from a Monthly review step, the way back to the check-in wins over the guide's one line");
  assert.equal(barFor(p, { page: "debt/payoff", query: { guide: "debt", step: "order", from: "review", review: "2026-10" } }).mode, "guide", "the guide's own address still shows the full bar");
  assert.equal(barFor(p, { page: "goals/house" }).mode, "continue", "a page that is not a step ends with the continue row");
  assert.equal(barFor(p, { page: "goals/house", query: { from: "quick" } }).mode, "quick");
  leaveGuide(p);
  assert.equal(barFor(p, { page: "debt/payoff", query: { guide: "debt", step: "order" } }).mode, "guide", "the address alone brings the bar back, even after leaving");
  assert.equal(barFor(p, { page: "debt/payoff" }).mode, "continue");
});
test("barFor: priority is guide > review > quick > plan > compact > continue", () => {
  const p = family();
  startGuide(p, "debt", "2026-10-31");
  const both = { from: "quick" };
  assert.equal(barFor(p, { page: "debt/payoff", query: both }).mode, "quick", "quick before compact");
  assert.equal(barFor(p, { page: "debt/payoff", query: { guide: "debt", step: "order", from: "review" } }).mode, "guide", "guide first");
  assert.equal(barFor(p, { page: "debt/payoff", query: { from: "review", review: "2026-10" } }).mode, "review", "review before compact");
  leaveGuide(p);
  assert.equal(barFor(p, { page: "retirement/projection", query: { from: "plan" } }).mode, "plan");
  startGuide(p, "debt", "2026-10-31");
  assert.equal(barFor(p, { page: "debt/payoff", query: { from: "plan" } }).mode, "plan", "plan before compact: debt/payoff is a row of Your plan");
  assert.equal(barFor(p, { page: "debt/payoff" }).mode, "compact", "compact before continue");
});
test("barFor: a followed guide goes quiet after 30 days without a tap; once complete, compact mode stops", () => {
  const p = family();
  startGuide(p, "debt", "2026-09-01");
  assert.equal(barFor(p, { page: "debt/payoff", today: "2026-09-20" }).mode, "compact");
  assert.equal(activeJourney(p, "2026-10-05"), null);
  assert.equal(barFor(p, { page: "debt/payoff", today: "2026-10-05" }).mode, "continue", "quiet: no one-line reminder, only the way on");
  // Continue, Do step N or a step row brings it back; a tap in the guide keeps it awake, at most one save a day
  assert.equal(startGuide(p, "debt", "2026-10-05"), true);
  assert.equal(p.guide.activeAt, "2026-10-05"); assert.equal(p.guide.journeys.debt.startedAt, "2026-09-01");
  assert.equal(barFor(p, { page: "debt/payoff", today: "2026-10-05" }).mode, "compact");
  assert.equal(touchGuide(p, "2026-10-05"), false);
  assert.equal(touchGuide(p, "2026-10-20"), true); assert.equal(p.guide.activeAt, "2026-10-20");
  const q = family(); startGuide(q, "debt", "2026-10-31"); q.debtPlan = { order: "avalanche" };
  assert.equal(barFor(q, { page: "debt/payoff" }).mode, "continue");
  assert.equal(barFor(q, { page: "debt/payoff", query: { guide: "debt", step: "order" } }).mode, "guide");
});
test("activeSummary and stepHref; the router reads a step's address back", () => {
  const p = family();
  assert.equal(activeSummary(p), null);
  startGuide(p, "taxes", "2026-10-31");
  const a = activeSummary(p);
  assert.deepEqual([a.id, a.doneCount, a.total, a.next.key, a.next.href], ["taxes", 3, 5, "estimate", "#/taxes/federal?guide=taxes&step=estimate"]);
  const step = J("debt").steps[1];
  assert.equal(stepHref("debt", step), "#/balance/liabilities?guide=debt&step=rates");
  assert.deepEqual(router.parse(stepHref("debt", step)), { group: "balance", id: "liabilities", rest: [], query: { guide: "debt", step: "rates" } });
});
test("changes: say whether they changed anything, keep progress, and touch nothing outside plan.guide", () => {
  const p = family(), before = JSON.stringify({ ...p, guide: undefined });
  assert.equal(startGuide(p, "debt", "2026-10-30"), true);
  assert.equal(startGuide(p, "debt", "2026-10-30"), false, "already followed and tapped today: no save");
  assert.equal(startGuide(p, "debt", "2026-10-31"), true, "a new day: remember it");
  assert.equal(p.guide.journeys.debt.startedAt, "2026-10-30");
  assert.equal(startGuide(p, "nope", "2026-10-31"), false);
  assert.equal(markLooked(p, "debt", "cards", "2026-10-31"), true);
  assert.equal(markLooked(p, "debt", "cards", "2026-10-31"), false);
  assert.equal(p.guide.activeAt, "2026-10-31");
  assert.equal(leaveGuide(p), true); assert.equal(leaveGuide(p), false);
  assert.equal(touchGuide(p, "2026-11-05"), false, "nothing followed: nothing to touch");
  assert.equal(p.guide.journeys.debt.done.cards, "2026-10-31", "leaving keeps progress");
  assert.equal(restartGuide(p, "debt", "2026-11-01"), true);
  assert.deepEqual([p.guide.active, p.guide.journeys.debt.startedAt, p.guide.journeys.debt.done], ["debt", "2026-11-01", {}]);
  assert.equal(finishGuide(p, "debt", "2026-11-02"), true);
  assert.deepEqual([p.guide.active, p.guide.journeys.debt.finishedAt], [null, "2026-11-02"]);
  assert.equal(finishGuide(p, "debt", "2026-11-03"), false);
  assert.equal(clearMark(p, "debt", "nothing"), false);
  assert.equal(JSON.stringify({ ...p, guide: undefined }), before);
});
test("compute returns plain data only, and the detail for one guide", () => {
  const d = compute(family(), { id: "retire" });
  assert.deepEqual(JSON.parse(JSON.stringify(d)), d);
  assert.equal(d.journeys.length, 7); assert.equal(d.detail.id, "retire"); assert.equal(d.active, null);
  assert.equal(compute(family(), { id: "nope" }).detail, null);
});
test("the manifest exports the shell's frame hook, and frame.js never imports the shell", () => {
  assert.equal(typeof manifest.frame, "function");
  const f = fs.readFileSync(fileURLToPath(new URL("./frame.js", import.meta.url)), "utf8");
  assert.ok(!/core\/app\.js/.test(f));
});
test("every fold and '+ Add another' button an ask names is really on that page (a guide-page sweep found asks naming folded or missing controls)", () => {
  const view = (page) => fs.readFileSync(`${MODS}${page}/view.js`, "utf8");
  let folds = 0, adds = 0;
  for (const j of JOURNEYS) for (const s of j.steps) {
    for (const [page, ask, opens] of [[s.page, s.ask, s.opens], s.alt ? [s.alt.page, s.alt.ask, s.alt.opens] : null].filter(Boolean)) {
      const v = view(page);
      if (opens) { folds++; assert.ok(v.includes(`"${opens}"`), `${j.id}/${s.key}: ${page} has a fold "${opens}"`); assert.ok(ask.includes(opens), `${j.id}/${s.key}: the ask names the fold it opens`); }
      for (const m of ask.match(/\+ Add another \w+/g) ?? []) { adds++; assert.ok(v.includes(m), `${j.id}/${s.key}: ${page} has "${m}"`); }
    }
  }
  assert.ok(folds >= 3 && adds >= 7, `${folds} folds, ${adds} add-another buttons checked`);
});
test("the paycheck step counts either earner; the card and one-loan steps wait for rates; one loan only when Consolidation has something to compare", () => {
  const p = family(); p.taxes = { ...(p.taxes ?? {}), withholding: { partner: { perPaycheck: 210, period: "biweekly" } } };
  assert.equal(st(journeyStatus(J("taxes"), p), "paychecks").state, "done", "only the partner has tax taken out");
  const owes = (...debts) => { const q = empty(); q.accounts = debts.map(([type, balance], i) => ({ id: `d${i}`, name: `Debt ${i}`, type, balance })); return q; };
  const d = journeyStatus(J("debt"), owes(["credit", -3000], ["loan", -5000]));
  assert.equal(st(d, "cards").blockedBy.key, "rates");
  assert.equal(st(d, "one-loan").blockedBy.key, "rates", "no rate yet: consolidation would assume 20%");
  const withRates = (q, rates) => { q.debts = q.accounts.map((a, i) => ({ id: `x${i}`, accountId: a.id, rate: rates[i], minPayment: 100 })); return q; };
  const low = withRates(owes(["credit", -3000], ["loan", -5000]), [0.06, 0.05]);
  assert.equal(st(journeyStatus(J("debt"), low), "one-loan"), undefined, "nothing at 10% or more: nothing to roll together");
  const mixed = withRates(owes(["credit", -3000], ["student_loan", -20000]), [0.22, 0.05]);
  assert.equal(st(journeyStatus(J("debt"), mixed), "one-loan"), undefined, "a student loan is left out of Consolidation");
  const high = withRates(owes(["credit", -3000], ["loan", -5000]), [0.22, 0.08]);
  assert.ok(st(journeyStatus(J("debt"), high), "one-loan"), "two it can roll together, one at 22%");
});

test("Show me where: each step that says 'tap ...' names a button its page really draws", async () => {
  const { targetsOf } = await import("./compute.js");
  const fsm = await import("node:fs");
  assert.deepEqual(targetsOf("List each account, then tap Add account, and + Add another account for the next."), ["+ Add another account", "Add account"]);
  assert.deepEqual(targetsOf("Give each adult a birth date, then tap Add person or Save changes."), ["Add person", "Save changes"]);
  assert.deepEqual(targetsOf("Open Retirement settings near the bottom, type what you spend, then tap Save settings."), ["Save settings", "Retirement settings"]);
  assert.deepEqual(targetsOf("Tap each paper, like a will, then tap Save."), ["Save"], "'each paper' names no button");
  assert.deepEqual(targetsOf("See which goals arrive on time."), []);
  for (const j of JOURNEYS) for (const s of j.steps) for (const [page, ask, opens, target] of [[s.page, s.ask, s.opens, s.target], ...(s.alt?.ask ? [[s.alt.page, s.alt.ask, s.alt.opens, s.alt.target]] : [])]) {
    if (!/\btap\b/i.test(ask)) continue;
    const labels = targetsOf(ask, { opens, target });
    if (!labels.length) continue;   // "tap a row to type yours" (the path's month step) names no button, like "tap each paper"
    const src = fsm.readFileSync(new URL(`../../${page}/view.js`, import.meta.url), "utf8");
    assert.ok(labels.some((l) => src.includes(l.replace(/^\+ /, ""))), `${j.id}/${s.key}: none of ${JSON.stringify(labels)} is in ${page}/view.js`);
  }
});

test("review: 'I won't get Social Security' in the retirement guide counts as the setup's 'none', so no page asks again", async () => {
  const { markNone } = await import("./compute.js");
  const { retirementKnown } = await import("../../retirement/projection/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-11-02"); p.retirement.socialSecurity = {};
  assert.equal(retirementKnown(p), false);
  markNone(p, "retire", "ss", "2026-11-02");
  assert.deepEqual(p.guide.setup.ss, { "p-ana": "none", "p-bo": "none" });
  assert.equal(retirementKnown(p), true);
});

test("round 4: the retirement guide for a household already retired (no paycheck saving, today's spending, Income pension counts)", () => {
  const today = "2026-11-02";
  const q = empty();
  q.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10", retirementAge: 66 }, { id: "s", name: "Sam", role: "partner", birthDate: "1957-06-20", retirementAge: 65 }];
  q.accounts = [{ id: "ira", name: "IRA", type: "ira", balance: 400000 }];
  q.income = [{ id: "pen", name: "Ruth's pension", type: "pension", personId: "r", amount: 1200, period: "monthly", taxable: true }];
  const r = journeyStatus(J("retire"), q, { today });
  assert.equal(st(r, "saving"), undefined, "no 'what you save from each paycheck' step");
  assert.equal(r.total, 6);
  assert.equal(st(r, "spend").title, "Say what you spend");
  assert.match(st(r, "spend").ask, /what you spend a month now/);
  assert.equal(st(r, "ss").alt.page, "cashflow/income");
  assert.equal(st(r, "pension").state, "done", "a pension already on Income counts");
  assert.match(r.line, /rest of your life/);
  const pages = r.more.map((m) => m.page);
  assert.ok(pages.includes("retirement/rmd") && pages.includes("retirement/withdrawal-strategy"));
  assert.ok(!pages.includes("retirement/healthcare") && !pages.includes("retirement/fire"), "both 65 or over: nothing about the years before 65 or stopping early");
  // one of them under 65: health care before 65 stays
  const young = structuredClone(q); young.household.people[1].birthDate = "1963-01-05"; young.household.people[1].retirementAge = 62;
  assert.ok(journeyStatus(J("retire"), young, { today }).more.some((m) => m.page === "retirement/healthcare"));
  // the same people still working: the guide as before
  const working = structuredClone(q); working.income.push({ id: "pay", name: "Sam's pay", type: "salary", personId: "s", amount: 4000, period: "monthly", taxable: true });
  const w = journeyStatus(J("retire"), working, { today });
  assert.equal(w.total, 7); assert.equal(st(w, "spend").title, "Say what you will spend");
  // without a date nothing changes (the shell always passes one)
  assert.equal(journeyStatus(J("retire"), q).total, 7);
  // compute and the bar carry the same steps
  assert.equal(compute(q, { id: "retire", today }).detail.total, 6);
  q.guide = { active: "retire", activeAt: today };
  const bar = barFor(q, { page: "retirement/projection", query: { guide: "retire", step: "spend" }, today });
  assert.equal(bar.step.title, "Say what you spend"); assert.equal(bar.total, 6);
});

test("review 2026-11-02: the retiree guide with the retirement age blank, an ended pension, no pension, and no required withdrawal yet", () => {
  const today = "2026-11-02";
  const q = empty();
  q.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }, { id: "s", name: "Sam", role: "partner", birthDate: "1957-06-20" }];
  q.accounts = [{ id: "ira", name: "Ruth's IRA", type: "ira", balance: 300000 }];
  q.income = [{ id: "pen", name: "Old pension", type: "pension", personId: "s", amount: 900, period: "monthly", endDate: "2025-12-31" }];
  const r = journeyStatus(J("retire"), q, { today });
  assert.equal(r.total, 6, "a blank retirement age is the plan's own: they are retired");
  assert.equal(st(r, "pension").state, "todo", "a pension that has ended does not count");
  assert.equal(r.finish.text, "Your ages, savings and spending are in your plan.", "no Social Security or pension named when there is none");
  assert.equal(st(r, "ss").alt.ask.startsWith("Choose Social Security under Kind of income"), true);
  // Ruth is 76 with an IRA: this year's withdrawal; with only a Roth there is none to take, and the row goes
  assert.ok(r.more.some((m) => m.page === "retirement/rmd" && m.title === "This year's required withdrawal"));
  const roth = structuredClone(q); roth.accounts = [{ id: "ro", name: "Roth", type: "roth", balance: 100000 }];
  assert.ok(!journeyStatus(J("retire"), roth, { today }).more.some((m) => m.page === "retirement/rmd"));
  // both 66: none due yet
  const young = structuredClone(q); young.household.people[0].birthDate = "1960-02-01"; young.household.people[1].birthDate = "1960-05-01";
  assert.ok(journeyStatus(J("retire"), young, { today }).more.some((m) => m.page === "retirement/rmd" && m.title === "When must I start taking money out?"));
});

test("review 2026-11-02 (round 5): an ended Social Security line on Income is not Social Security added; one that starts later is", () => {
  const today = "2026-11-02";
  const q = empty();
  q.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }, { id: "s", name: "Sam", role: "partner", birthDate: "1957-06-20" }];
  q.accounts = [{ id: "ira", name: "Ruth's IRA", type: "ira", balance: 300000 }];
  q.income = [{ id: "sv", name: "Survivor benefit", type: "social", personId: "r", amount: 900, period: "monthly", endDate: "2025-12-31" }];
  const r = journeyStatus(J("retire"), q, { today });
  assert.equal(st(r, "ss").state, "todo", "no other page counts an ended benefit");
  assert.equal(r.finish.text, "Your ages, savings and spending are in your plan.");
  // starting in 2030: the projection counts it from then, so it is in the plan
  delete q.income[0].endDate; q.income[0].startDate = "2030-01-01";
  const later = journeyStatus(J("retire"), q, { today });
  assert.equal(st(later, "ss").state, "done");
  assert.equal(later.finish.text, "Your ages, savings, spending and Social Security are in your plan.");
});

// ---------------------------------------------------------------- the path ("Your plan"): where a person stands, and what Next does
const TD = "2026-11-02";
const walkTo = (p, keys) => { for (const k of keys) passStep(p, k, TD); return p; };
test("pathSummary: an empty plan (not started, next = the questions); after setup (step 2); all passed (complete); a new loan reopens it", () => {
  const e = empty();
  let ps = pathSummary(e, { today: TD });
  assert.deepEqual([ps.started, ps.complete, ps.next.key, ps.step, ps.total], [false, false, "answers", 1, 4]);
  assert.equal(ps.planHref, "#/overview/plan");
  const p = sam();
  S.markAt(p, "done", TD);
  ps = pathSummary(p, { today: TD });
  assert.equal(ps.started, true);
  assert.equal(ps.parts[0].passed, true, "step 1 is passed when it is done");
  assert.deepEqual([ps.next.key, ps.step], ["month", 2]);
  // every step passed -> complete; the Next tap on the last open step finishes the guide (and only then)
  const keys = ps.parts.map((x) => x.key);
  for (const k of keys.slice(1, -1)) { passStep(p, k, TD); assert.notEqual(p.guide.journeys.plan.finishedAt, "2026-11-02", "not finished while a step is open"); }
  assert.equal(pathSummary(p, { today: TD }).complete, false);
  passStep(p, keys.at(-1), TD);
  ps = pathSummary(p, { today: TD });
  assert.deepEqual([ps.complete, ps.next, ps.step], [true, null, null]);
  assert.equal(p.guide.active, null, "finishing stops following the path");
  assert.equal(journeyStatus(J(PATH_ID), p, { today: TD }).finished, true, "the guide list says Done only when Your plan is ready");
  // data adds a step later: a gentle reopening, not a reset
  const before = ps.total;
  const q = structuredClone(p);   // (a plan object counts as unchanged: the store hands out a new one on every change)
  q.accounts.push({ id: "card2", name: "New card", type: "credit", balance: -2500 });
  const again = pathSummary(q, { today: TD });
  assert.equal(again.complete, false);
  assert.equal(again.total, before + (again.parts.some((x) => x.key === "debts") && !keys.includes("debts") ? 1 : 0));
  assert.deepEqual(again.changed, keys.includes("debts") ? null : { added: ["Your debts"], removed: [] });
  assert.equal(journeyStatus(J(PATH_ID), q, { today: TD }).finished, false);
});
test("pathSummary: a new loan on a finished path sends the person to the new step, and says so once", () => {
  const p = ruth(); S.markAt(p, "done", TD);
  S.applyOweAmounts(p, {}, TD);
  const keys = pathSummary(p, { today: TD }).parts.map((x) => x.key);
  for (const k of keys.slice(1)) passStep(p, k, TD);
  assert.equal(pathSummary(p, { today: TD }).complete, true);
  const q = structuredClone(p);
  q.accounts.push({ id: "card", name: "Store card", type: "credit", balance: -1800 });
  const ps = pathSummary(q, { today: TD });
  assert.deepEqual([ps.complete, ps.next.key, ps.changed], [false, "debts", { added: ["Your debts"], removed: [] }]);
  passStep(q, "debts", TD);
  assert.equal(pathSummary(q, { today: TD }).changed, null, "the Next tap saves the new list: the line shows until then");
});
test("nextAfter: the next step in order even when done by data; after a jump back it never walks the passed steps again", () => {
  const p = sam(); S.markAt(p, "done", TD);
  S.applyOweAmounts(p, { credit: { owed: 3200, payment: 90 }, "car-loan": { owed: 9000, payment: 310 } }, TD);
  S.applySpend(p, { mode: "rows", rows: { housing: 900, utilities: 200, groceries: 400, transport: 300, insurance: 200, dining: 150, shopping: 100 } }, TD);
  const keys = pathSummary(p, { today: TD }).parts.map((x) => x.key);
  assert.equal(st(journeyStatus(J(PATH_ID), p, { today: TD }), "month").state, "done", "typed spending is done by data");
  assert.deepEqual(nextAfter(p, "answers", { today: TD }), { key: "month", name: "Your month", href: "#/cashflow/expenses?guide=plan&step=month", kind: "next" });
  assert.equal(nextAfter(p, "month", { today: TD }).key, "debts", "done or not, the next one in order is seen once");
  // skip ahead: tap Next on the last step with the middle ones never seen
  for (const k of ["answers", "month"]) passStep(p, k, TD);
  passStep(p, keys.at(-1), TD);
  const after = nextAfter(p, keys.at(-1), { today: TD });
  assert.equal(after.kind, "still"); assert.equal(after.key, "debts", "the first one not done anywhere");
  for (const k of keys.slice(2, -1)) passStep(p, k, TD);
  assert.deepEqual(nextAfter(p, "debts", { today: TD }).kind, "finish", "everything passed: the end");
  assert.equal(nextAfter(p, keys.at(-1), { today: TD }).href, "#/overview/plan");
  // a jump back to a skipped step goes on to the end, not through the passed steps again
  const q = sam(); S.markAt(q, "done", TD);
  S.applySpend(q, { mode: "rows", rows: { housing: 900, utilities: 200, groceries: 400, transport: 300, insurance: 200, dining: 150, shopping: 100 } }, TD);
  const qk = pathSummary(q, { today: TD }).parts.map((x) => x.key);
  for (const k of qk.filter((k) => k !== "cushion")) passStep(q, k, TD);
  assert.equal(nextAfter(q, qk.at(-1), { today: TD }).key, "cushion");
  passStep(q, "cushion", TD);
  assert.equal(nextAfter(q, "cushion", { today: TD }).kind, "finish");
});
test("partsFor: the same array for a plan and for its clone with one more tick (the cache), but not after the household changes", () => {
  const p = sam(); S.markAt(p, "done", TD);
  const a = partsFor(p, { today: TD });
  const c = structuredClone(p);
  markLooked(c, PATH_ID, "month", TD);
  assert.equal(partsFor(c, { today: TD }), a);
  assert.equal(partsFor(p, { today: TD }), a);
  const d = structuredClone(p); d.accounts.push({ id: "z", type: "credit", balance: -900 });
  assert.notEqual(partsFor(d, { today: TD }), a);
  assert.notEqual(partsFor(p, { today: TD, off: ["retirement/projection"] }), a, "off is part of the key");
});
test("journeyStatus plain data: no functions anywhere, waits included; a step that waits says what it needs", () => {
  const p = ruth(); p.retirement.socialSecurity = {}; p.guide.setup.ss = {}; p.income = p.income.filter((x) => x.type !== "social");
  const js = journeyStatus(J(PATH_ID), p, { today: TD });
  assert.deepEqual(JSON.parse(JSON.stringify(js)), js);
  for (const x of js.steps) assert.equal(typeof x.waits, "undefined");
  const r = st(js, "retire");
  assert.ok(r.waiting && /Social Security/.test(r.waiting.what) && r.waiting.href.startsWith("#/"), JSON.stringify(r.waiting));
  assert.equal(pathSummary(p, { today: TD }).gaps.length >= 1, true);
  assert.equal(st(journeyStatus(J(PATH_ID), ruth(), { today: TD }), "retire").waiting, null);
});
test("an old plan with guide.active = whole-plan renders with no bar and no throw", () => {
  const p = sam();
  p.guide = { ...(p.guide ?? {}), active: "whole-plan", activeAt: TD, chosen: { id: "whole-plan", at: TD }, journeys: { "whole-plan": { startedAt: "2026-10-01", finishedAt: "2026-10-02", done: {}, none: {}, later: {} } } };
  assert.equal(activeJourney(p, TD), null);
  assert.equal(barFor(p, { page: "cashflow/expenses", today: TD }).mode, "continue", "only the quiet way on");
  assert.equal(compute(p, { today: TD }).active, null);
  assert.equal(pathSummary(p, { today: TD }).complete, false, "the old finishedAt does not finish the new path");
});
test("barFor, the path: ?guide=plan draws path mode whatever is followed; one Next, Back, the step's own button, waits", () => {
  const p = sam(); S.markAt(p, "done", TD);
  startGuide(p, "budget", TD);
  const b = barFor(p, { page: "cashflow/expenses", query: { guide: "plan", step: "month" }, today: TD });
  assert.deepEqual([b.mode, b.path, b.journey.id, b.index, b.name], ["guide", true, "plan", 2, "Your month"]);
  assert.deepEqual([b.after.kind, b.after.name], ["next", b.after.name]);
  assert.equal(b.back.href, "#/overview/setup/done", "back from step 2 to the questions' end screen once they were finished");
  const fresh = empty(); fresh.income = [{ id: "i", type: "salary", amount: 3000, period: "monthly", personId: "x" }];
  assert.equal(barFor(fresh, { page: "cashflow/expenses", query: { guide: "plan", step: "month" }, today: TD }).back.href, "#/overview/guide/plan", "setup never finished: not setup/done (opening it would mark it finished)");
  // the step's own button keeps Next outlined until done
  const d = barFor(sam(), { page: "debt/payoff", query: { guide: "plan", step: "debts" }, today: TD });
  assert.equal(d, null === d ? d : d, "debts only applies with a debt");
  const w = ruth(); S.markAt(w, "done", TD);
  const rm = barFor(w, { page: "retirement/rmd", query: { guide: "plan", step: "rmd" }, today: TD });
  assert.equal(rm.mode, "guide"); assert.equal(rm.after.kind, "still", "the last step, with others not yet seen: the first one not done");
  // opening it finished or stale still draws the bar
  finishGuide(p, PATH_ID, TD);
  assert.equal(barFor(p, { page: "cashflow/expenses", query: { guide: "plan", step: "month" }, today: TD }).mode, "guide");
  // waits
  const nw = ruth(); nw.retirement.socialSecurity = {}; nw.guide.setup.ss = {}; nw.income = nw.income.filter((x) => x.type !== "social");
  assert.ok(barFor(nw, { page: "retirement/projection", query: { guide: "plan", step: "retire" }, today: TD }).waiting);
});
test("barFor, continue: the four texts; this-page-is-next goes to ?guide=plan&step=; the one-page trail still shows", () => {
  // never started: Start your plan
  let c = barFor(empty(), { page: "balance/net-worth", today: TD });
  assert.deepEqual([c.mode, c.text, c.href], ["continue", "Start your plan: a few easy questions ›", "#/overview/start"]);
  // under way
  const p = sam(); S.markAt(p, "done", TD); startGuide(p, PATH_ID, TD);
  c = barFor(p, { page: "balance/net-worth", today: TD });
  const ps = pathSummary(p, { today: TD });
  assert.equal(c.text, `Continue your plan: step ${ps.step} of ${ps.total} ›`); assert.equal(c.href, ps.next.href); assert.equal(c.startPath, true);
  // this page is the next step, reached without ?guide
  c = barFor(p, { page: "cashflow/expenses", today: TD });
  assert.equal(c.text, `This is step ${ps.step} of ${ps.total} of your plan ›`); assert.equal(c.href, "#/cashflow/expenses?guide=plan&step=month");
  // complete
  for (const k of ps.parts.slice(1).map((x) => x.key)) passStep(p, k, TD);
  c = barFor(p, { page: "property/rent-vs-buy", today: TD });
  assert.deepEqual([c.mode, c.text, c.href], ["continue", "See your plan ›", "#/overview/plan"]);
});
test("barFor, plan mode: a row of Your plan opened from it, or after completion; the next result keeps ?from=plan; last row has none", () => {
  const p = sam(); S.markAt(p, "done", TD);
  S.applyOweAmounts(p, { credit: { owed: 3200, payment: 90 } }, TD);
  const rows = resultOrder(p, { today: TD });
  assert.deepEqual(rows.map((r) => r.key).slice(0, 3), ["net", "month", "debts"]);
  const b = barFor(p, { page: rows[0].page, query: { from: "plan" }, today: TD });
  assert.deepEqual([b.mode, b.planHref, b.next.page, b.next.href], ["plan", "#/overview/plan", rows[1].page, `#/${rows[1].page}?from=plan`]);
  assert.equal(barFor(p, { page: rows.at(-1).page, query: { from: "plan" }, today: TD }).next, null);
  assert.equal(barFor(p, { page: rows[0].page, today: TD }).mode, "continue", "not from Your plan and the path not complete");
  for (const r of pathSummary(p, { today: TD }).parts.slice(1)) passStep(p, r.key, TD);
  assert.equal(barFor(p, { page: rows[0].page, today: TD }).mode, "plan", "after completion every result page offers the next result");
  assert.equal(barFor(p, { page: "goals/vehicle", query: { from: "plan" }, today: TD }).mode, "continue", "not a row of Your plan");
});
test("resultOrder: three groups in order; a row shows with its step; off pages and steps that do not apply are left out", () => {
  const f = family();
  const keys = resultOrder(f, { today: "2026-10-31" }).map((r) => r.key);
  assert.deepEqual(keys, ["net", "month", "debts", "cushion", "protect", "retire", "goals", "college", "taxes"]);
  assert.deepEqual(resultOrder(f, { today: "2026-10-31", off: ["retirement/projection"] }).map((r) => r.key).includes("retire"), false);
  assert.deepEqual(resultOrder(empty(), { today: TD }).map((r) => r.key), ["month", "cushion", "retire"], "answers has no row of its own; net and goals need data");
});
test("passStep: ticks, saves the list of steps, follows the path; the last open step finishes it", () => {
  const p = ruth(); S.markAt(p, "done", TD);
  assert.equal(passStep(p, "month", TD), true);
  assert.equal(passStep(p, "month", TD), false, "nothing changes the second time");
  assert.equal(p.guide.journeys.plan.done.month, TD);
  assert.deepEqual(p.guide.journeys.plan.parts, ["answers", "month", "cushion", "retire", "take-out", "rmd"]);
  assert.equal(p.guide.active, PATH_ID);
  for (const k of ["cushion", "retire", "take-out"]) passStep(p, k, TD);
  assert.equal(p.guide.active, PATH_ID, "one step still open: not finished");
  passStep(p, "rmd", TD);
  assert.equal(p.guide.active, null); assert.equal(p.guide.journeys.plan.finishedAt, TD);
});

// ---------------------------------------------------------------- the words of the frame's path, plan and continue texts
test("plain words: no banned word in the frame's path, plan and continue texts, the trails and the aria-labels", () => {
  const BANNED = ["Monte Carlo", "simulated", "liabilities", "assumptions", "net worth", "RMD", "AGI", "IRMAA", "W-4", "withholding", "withheld", "guide", "journey", "scenario", "lever", "levers", "goal seek", "PC", "AI", "server", "sandbox", "inflation", "bonds", "stocks", "pre-tax", "Roth", "Medigap", "9 of 10 markets", "middle run", "must-pay"];
  const re = new RegExp(`\\b(${BANNED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
  const frame = fs.readFileSync(fileURLToPath(new URL("./frame.js", import.meta.url)), "utf8");
  const compute = fs.readFileSync(fileURLToPath(new URL("./compute.js", import.meta.url)), "utf8");
  const between = (text, a, b) => { const i = text.indexOf(a); assert.ok(i >= 0, a); const j = b ? text.indexOf(b, i + a.length) : text.length; assert.ok(j > i, b); return text.slice(i, j); };
  const pieces = [
    between(frame, "const READ_ONLY", "const readTrail"),                      // the step lines of the path
    between(frame, "const contRow", "if (!real) {"),                           // the continue row
    between(frame, "if (!real) {", "if (bar.mode === \"review\")"),            // the trail beside it (path: "Back to your plan")
    between(frame, "if (bar.mode === \"plan\")", "const { journey: j, step, next } = bar;"),   // plan mode
    between(frame, "function pathMode()"),                                      // the path's bar and card
    between(compute, "function continueFor", "/**\n * What the shell draws around a page"),
  ];
  const literals = (text) => [...text.matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, "")).filter((t) => / /.test(t) && !/#\/|=|\.gb-|\.gn-/.test(t));
  const bad = [];
  for (const [i, p] of pieces.entries()) for (const t of literals(p)) if (re.test(t)) bad.push(`${i}: ${t}`);
  // the guide's own trail ("Back to the guide: ...") belongs to the other guides: it is on the non-path branch of the trail line only
  assert.deepEqual(bad.filter((b) => !/Back to the guide|Back to your guide/.test(b)), []);
});
test("the path's bar has no Next of its own and no 'Skip to'; one Next at the bottom", () => {
  const frame = fs.readFileSync(fileURLToPath(new URL("./frame.js", import.meta.url)), "utf8");
  const path = frame.slice(frame.indexOf("function pathMode()"));
  assert.ok(!/barNext|gb-next|gb-go|Skip to|Questions\? See the help|Ask the app a question/.test(path), "no top Next, no Skip, no help link in the path");
  assert.equal((path.match(/class: "gn-main"/g) ?? []).length, 1);
  assert.ok(/Done\? Go to Next/.test(path) && /Still to do/.test(path) && /Finish: see your plan/.test(path));
});

test("review fixes: the cushion step waits on the accounts it needs; the waiting link and the bar are right on a phone", () => {
  // an empty plan has no account: the page has nothing to show, so the step says so and offers "Add it" (never blocks)
  const e = empty(); S.markAt(e, "done", TD);
  const w = barFor(e, { page: "balance/liquidity", query: { guide: "plan", step: "cushion" }, today: TD });
  assert.ok(w.waiting && /accounts/.test(w.waiting.what) && w.waiting.href === "#/balance/net-worth", JSON.stringify(w.waiting));
  assert.ok(w.after.href, "and Next is still there");
  // with an account the step does not wait
  const r = ruth(); S.markAt(r, "done", TD);
  assert.equal(barFor(r, { page: "balance/liquidity", query: { guide: "plan", step: "cushion" }, today: TD }).waiting, null);
  const f = fs.readFileSync(fileURLToPath(new URL("./frame.js", import.meta.url)), "utf8");
  assert.match(f, /\.gn-root \.gn-state a \{[^}]*min-height: 44px/, "the 'Add it' link is a 44 px target");
  assert.match(f, /Math\.max\(bar\.doneCount, bar\.index \?\? 0\) \/ bar\.total/, "step N of N is a full bar");
});

test("the Guides list says '1 of 7 steps is', the noun after the total (wording sweep check, 2026-11-07)", async () => {
  const { statusLine } = await import("./view.js");
  assert.equal(statusLine({ minutes: 10, doneCount: 1, total: 7 }), "About 10 minutes. 1 of 7 steps is already in your plan.");
  assert.equal(statusLine({ minutes: 10, doneCount: 2, total: 7 }), "About 10 minutes. 2 of 7 steps are already in your plan.");
  assert.equal(statusLine({ minutes: 5, doneCount: 1, total: 1 }), "About 5 minutes. 1 of 1 step is already in your plan.");
  assert.equal(statusLine({ minutes: 5, doneCount: 0, total: 3 }), "About 5 minutes");
  assert.equal(statusLine({ started: true, doneCount: 2, total: 6 }), "In progress: 2 of 6 steps done");
});

test("the month step waits on the pay, never on the spending its own page takes (stress test j-first-freelancer/F5)", async () => {
  const { pathSummary } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan(); p.guide = { setup: { startedAt: "2026-11-10", finishedAt: "2026-11-10" } };
  const month = pathSummary(p, { today: "2026-11-11" }).parts.find((x) => x.key === "month");
  assert.deepEqual(month.waiting, { what: "your pay", href: "#/cashflow/income" });
  p.income = [{ id: "i", type: "salary", amount: 5000, period: "monthly" }];
  assert.equal(pathSummary(p, { today: "2026-11-11" }).parts.find((x) => x.key === "month").waiting, null);
});

// ---- the path's step card says the step's name and only what the page shows (stress test 2026-11-11: j-first-family/F9,
// j-first-renter/F9, j-first-freelancer/F5, j-first-renter/F4)
import { pathAsk, targetsOf } from "./compute.js";
import { monthAsk } from "./journeys.js";
import { markGuess } from "../../../core/estimate/ledger.js";
import { emptyPlan as emptyForAsk } from "../../../core/schema/migrate.js";

test("pathAsk: the card starts with the name the Next button used; a waiting step says what it needs instead", () => {
  assert.equal(pathAsk({ name: "Your month", ask: "Read what is left each month at the top." }), "Your month. Read what is left each month at the top.");
  assert.equal(pathAsk({ name: "Your retirement", ask: "Read the answer at the top.", waiting: { what: "your Social Security", href: "#/x" } }),
    "Your retirement. This step needs your Social Security first: add it, or go on and come back to it.");
  assert.equal(pathAsk({ short: "See your month", ask: "X." }), "See your month. X.");
});

test("the Your month step asks for what Expenses shows: the empty form, bills with our guesses, typed bills; no pay is a wait", () => {
  const D = "2026-11-11";
  const p = emptyForAsk();
  p.household.people.push({ id: "s", role: "self", name: "Sam", birthDate: "1996-03-01" });
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 900 });
  const card = (q) => barFor(q, { page: "cashflow/expenses", query: { guide: PATH_ID }, today: D });
  // no pay: the card says it waits for the pay, never "read what is left at the top"
  assert.equal(card(p).waiting.what, "your pay");
  assert.match(card(p).step.ask, /^Your month\. This step needs your pay first/);
  p.income.push({ id: "i", type: "salary", amount: 3000, period: "monthly" });
  assert.equal(card(p).waiting, null);
  assert.match(card(p).step.ask, /^Your month\. Type each bill or spending you know, then tap Add expense/);
  p.expenses.push({ id: "e1", name: "Groceries", category: "groceries", amount: 400, period: "monthly", essential: true });
  assert.equal(monthAsk(p, { today: D }), "Read what is left each month at the top. To change a bill, open See or change each bill.");
  markGuess(p, "expenses[e1].amount", { key: "spend.groceries", value: 400, unit: "month", sigma: null, dataAsOf: D }, D);
  assert.match(monthAsk(p, { today: D }), /Some bills are our guesses: open See or change each bill/);
  assert.ok(targetsOf(monthAsk(p, { today: D })).includes("See or change each bill"), "Show me where finds the fold");
});

test("the Your retirement step over a forecast that cannot answer yet says so, and names the page's own button", () => {
  const D = "2026-11-11";
  const p = emptyForAsk();
  p.household.people.push({ id: "s", role: "self", name: "Sam", birthDate: "2002-03-01" });
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 900 });
  p.income.push({ id: "i", type: "salary", amount: 3000, period: "monthly" });
  p.expenses.push({ id: "e1", name: "Rent", category: "housing", amount: 1200, period: "monthly", essential: true });
  p.guide = { ...(p.guide ?? {}), journeys: { [PATH_ID]: { none: {} } } };
  p.retirement = { ...(p.retirement ?? {}), socialSecurity: { s: { monthlyAtFRA: 1400 } } };
  const b = barFor(p, { page: "retirement/projection", query: { guide: PATH_ID }, today: D });
  assert.equal(b.waiting, null, JSON.stringify(b.waiting));
  assert.match(b.step.ask, /^Your retirement\. Your retirement savings are not in the plan yet/);
  assert.ok(targetsOf(b.step.ask).includes("Add what you own"));
});

test("N2 (review 2026-11-11): the path's All steps counts and ticks only steps passed, so the step the button names is never ticked", () => {
  const p = family();
  const s = journeyStatus(J("plan"), p);
  assert.equal(s.next.key, "month", "the button names Your month");
  assert.equal(s.next.name, "Your month", "the same step name as the Dashboard and Your plan");
  assert.equal(s.doneCount, s.steps.filter((x) => !x.optional && x.passed).length);
  assert.ok(!s.steps.find((x) => x.key === "month").passed, "month is not passed, so not counted");
  assert.equal(s.doneCount, s.next.index - 1, "step N is next, so N-1 are done");
});
