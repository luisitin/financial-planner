// modules/overview/guide/module.test.mjs -- the seven guides' definitions, how a step counts as done, the counts,
// the next step, which step a page is, what the shell draws around a page, and the changes a tap makes.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  JOURNEYS, journeyById, visibleSteps, stepState, journeyStatus, stepForPage, neighbours, barFor, activeSummary, stepHref,
  startGuide, markLooked, markNone, markLater, clearMark, leaveGuide, restartGuide, finishGuide, touchGuide, compute, activeJourney, OWN_PAGES,
} from "./compute.js";
import { isDirty } from "./act.js";
import { WHOLE_PLAN_TEXT, houseGoal, detailed, emergencyGoal } from "./journeys.js";
import { compute as dashboard } from "../dashboard/compute.js";
import { router } from "../../../core/router.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import manifest from "./module.js";

const MODS = fileURLToPath(new URL("../../", import.meta.url));
const src = (key) => { const f = `${MODS}${key}/module.js`; return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
const viewSrc = (key) => fs.readFileSync(`${MODS}${key}/view.js`, "utf8");
const empty = () => migrate(emptyPlan());
const family = () => migrate(familyPlan("2026-10-31"));
const J = (id) => journeyById(id);
const st = (s, key) => s.steps.find((x) => x.key === key);
const VERBS = ["Add", "Enter", "Set", "Check", "Pick", "See", "Say", "Sort", "Start", "Compare", "Fit", "List", "Note"];

test("definitions: seven guides, unique ids and keys, 3 to 7 numbered steps, extras only show when they apply", () => {
  assert.equal(JOURNEYS.length, 7);
  assert.equal(new Set(JOURNEYS.map((j) => j.id)).size, 7);
  for (const j of JOURNEYS) {
    assert.match(j.id, /^[a-z]+(-[a-z]+)*$/);
    assert.equal(new Set(j.steps.map((s) => s.key)).size, j.steps.length, `${j.id} keys unique`);
    const numbered = j.steps.filter((s) => !s.optional);
    assert.ok(numbered.length >= 3 && numbered.length <= 7, `${j.id} has ${numbered.length} numbered steps`);
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
test("the whole plan is exactly the dashboard's six steps: same keys, pages, order and count", () => {
  const wp = J("whole-plan");
  assert.deepEqual(Object.keys(WHOLE_PLAN_TEXT), dashboard({}).steps.map((s) => s.key));
  for (const plan of [empty(), family()]) {
    const d = dashboard(plan), s = journeyStatus(wp, plan);
    assert.deepEqual(s.steps.map((x) => [x.key, x.page]), d.steps.map((x) => [x.key, x.go.join("/")]));
    assert.equal(s.doneCount, d.doneCount);
    assert.equal(s.total, d.total);
  }
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
  assert.deepEqual(JOURNEYS.map((j) => journeyStatus(j, empty()).total), [6, 3, 5, 3, 7, 5, 7]);
  const r = journeyStatus(J("retire"), empty());
  assert.deepEqual(st(r, "spend").blockedBy, { key: "people", index: 1, short: "Add birth dates", href: "#/household/people?guide=retire&step=people" });
  assert.equal(st(r, "pension").blockedBy, null);
});
test("journeyStatus on the family plan (worked by hand from qa/fixtures): counts and which steps", () => {
  const want = { "whole-plan": [5, 6, ["accounts", "people", "income", "expenses", "goals"]], debt: [2, 3, ["add", "rates"]], budget: [4, 5, ["income", "accounts", "spending", "cushion"]], home: [1, 3, ["pay"]], retire: [5, 7, ["people", "savings", "spend", "ss", "saving"]], taxes: [3, 5, ["people", "income", "state"]], protect: [3, 7, ["people", "savings", "spend"]] };
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
  const wp = journeyStatus(J("whole-plan"), empty());
  assert.deepEqual([stepForPage(wp, "transactions/import").step.key, stepForPage(wp, "transactions/import").viaAlt], ["expenses", true]);
  assert.equal(stepForPage(wp, "goals/house"), null);
  assert.equal(stepForPage(wp, "goals/goals", "nope").step.key, "goals", "an unknown step key falls back to the page's own step");
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
test("barFor: nothing without a followed guide; guide mode only for the followed guide; compact elsewhere; quick", () => {
  const p = family();
  const q = { guide: "debt", step: "rates" };
  assert.equal(barFor(p, { page: "balance/liabilities" }), null);
  assert.equal(barFor(p, { page: "balance/liabilities", query: q }), null, "query.guide with no followed guide gives nothing");
  for (const own of OWN_PAGES) assert.equal(barFor(p, { page: own, query: { from: "quick" } }), null);
  assert.deepEqual(barFor(p, { page: "goals/house", query: { from: "quick" } }), { mode: "quick" });
  // a step of the Monthly review: one line back to the check-in, never on the review itself
  assert.deepEqual(barFor(p, { page: "cashflow/budget", query: { from: "review", review: "2026-10", month: "2026-10" } }), { mode: "review", month: "2026-10" });
  assert.deepEqual(barFor(p, { page: "cashflow/budget", query: { from: "review", review: "junk" } }), { mode: "review", month: null });
  assert.equal(barFor(p, { page: "overview/monthly-review", query: { from: "review" } }), null);
  startGuide(p, "debt", "2026-10-31");
  const b = barFor(p, { page: "balance/liabilities", query: q });
  assert.equal(b.mode, "guide"); assert.equal(b.step.key, "rates"); assert.equal(b.index, 2); assert.equal(b.total, 3); assert.equal(b.state, "done");
  assert.equal(b.next.key, "order");
  assert.deepEqual(JSON.parse(JSON.stringify(b)), b, "plain data only");
  assert.equal(barFor(p, { page: "balance/liabilities", query: { guide: "budget", step: "rates" } }), null, "a guide that is not followed is ignored, and a done step reached another way shows nothing");
  const c = barFor(p, { page: "debt/payoff" });
  assert.equal(c.mode, "compact"); assert.equal(c.step.key, "order");
  assert.deepEqual(barFor(p, { page: "debt/payoff", query: { from: "review", review: "2026-10" } }), { mode: "review", month: "2026-10" }, "from a Monthly review step, the way back to the check-in wins over the guide's one line");
  assert.equal(barFor(p, { page: "debt/payoff", query: { guide: "debt", step: "order", from: "review", review: "2026-10" } }).mode, "guide", "the guide's own address still shows the full bar");
  assert.equal(barFor(p, { page: "goals/house" }), null, "a page that is not a step");
  assert.equal(barFor(p, { page: "goals/house", query: { from: "quick" } }).mode, "quick");
  leaveGuide(p);
  assert.equal(barFor(p, { page: "debt/payoff", query: { guide: "debt", step: "order" } }), null, "after leaving, the address alone brings nothing back");
});
test("barFor: a followed guide goes quiet after 30 days without a tap; once complete, compact mode stops", () => {
  const p = family();
  startGuide(p, "debt", "2026-09-01");
  assert.ok(barFor(p, { page: "debt/payoff", today: "2026-09-20" }));
  assert.equal(activeJourney(p, "2026-10-05"), null);
  assert.equal(barFor(p, { page: "debt/payoff", today: "2026-10-05" }), null);
  // Continue, Do step N or a step row brings it back; a tap in the guide keeps it awake, at most one save a day
  assert.equal(startGuide(p, "debt", "2026-10-05"), true);
  assert.equal(p.guide.activeAt, "2026-10-05"); assert.equal(p.guide.journeys.debt.startedAt, "2026-09-01");
  assert.ok(barFor(p, { page: "debt/payoff", today: "2026-10-05" }));
  assert.equal(touchGuide(p, "2026-10-05"), false);
  assert.equal(touchGuide(p, "2026-10-20"), true); assert.equal(p.guide.activeAt, "2026-10-20");
  const q = family(); startGuide(q, "debt", "2026-10-31"); q.debtPlan = { order: "avalanche" };
  assert.equal(barFor(q, { page: "debt/payoff" }), null);
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
  assert.ok(folds >= 3 && adds >= 8, `${folds} folds, ${adds} add-another buttons checked`);
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
