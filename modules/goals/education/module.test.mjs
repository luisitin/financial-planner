import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, COSTS, DEFAULT_GROWTH } from "./compute.js";
import { planReturn } from "../../insurance/term-vs-permanent/compute.js";
import { pmtToReach, fv } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("the published prices", () => {
  assert.equal(COSTS.public.yearly, 25850); assert.equal(COSTS.private.yearly, 60920);
});

test("no children: nothing to plan", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).children.length, 0);
});

test("Cy: four public years from 2038, rising 4% a year; the college goal supplies what is set aside", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  const c = d.children[0];
  assert.equal(c.startYear, 2038); assert.equal(c.years, 4); assert.equal(c.yearlyNow, 25850);
  for (const [i, x] of c.costs.entries()) near(x.cost, 25850 * Math.pow(1 + DEFAULT_GROWTH, 2038 + i - 2026));
  near(c.total, c.costs.reduce((s, x) => s + x.cost, 0));
  const r = planReturn(p);
  near(c.atStart, c.costs.reduce((s, x, i) => s + x.cost / Math.pow(1 + r, i), 0));
  assert.equal(c.goal.id, "g-col"); assert.equal(c.monthly, 250);
  near(c.neededMonthly, pmtToReach(r / 12, c.monthsLeft, c.atStart, c.saved), 1e-6);
  near(c.coveredShare, fv(r / 12, c.monthsLeft, 250, c.saved) / c.atStart, 1e-9);
});

test("per child: private, half covered, five years, a custom cost; 529 accounts when there is no goal", () => {
  const p = familyPlan(TODAY);
  p.goals = p.goals.filter((g) => g.id !== "g-col");
  p.accounts.push({ id: "c529", name: "Cy 529", type: "529", balance: 12000 });
  p.whatIfs = { college: { "p-cy": { type: "private", share: 0.5, years: 5 }, growth: 0.05 } };
  const c = compute(p, { today: TODAY }).children[0];
  assert.equal(c.type, "private"); assert.equal(c.costs.length, 5); assert.equal(c.share, 0.5); assert.equal(c.saved, 12000); assert.equal(c.goal, null);
  near(c.costs[0].cost, 60920 * Math.pow(1.05, 12));
  p.whatIfs.college["p-cy"] = { type: "custom", yearly: 10000 };
  assert.equal(compute(p, { today: TODAY }).children[0].yearlyNow, 10000);
});

// ---- 2026-11-02: a goal is a child's only when it names the child as a whole word; the shared pattern and rounding
import { namesPerson, EDUCATION_GOAL, shownAmount } from "./compute.js";

test("a child's name as a whole word ties the goal: 'Education fund' is not Ed's, 'University fund' is not Ty's", () => {
  assert.equal(namesPerson("Ed's college", "Ed"), true); assert.equal(namesPerson("COLLEGE FOR ED", "ed"), true);
  assert.equal(namesPerson("Education fund", "Ed"), false); assert.equal(namesPerson("University fund", "Ty"), false);
  assert.equal(namesPerson("College fund for Child 1", "Child 1"), true); assert.equal(namesPerson("Child 10's college", "Child 1"), false);
  assert.equal(namesPerson("Education", "Cat"), false); assert.equal(namesPerson("anything", ""), false);
  // two children: a goal naming neither is tied to neither (with one child it is still the child's, the lone-child rule)
  const p = familyPlan(TODAY);
  p.household.people = p.household.people.filter((x) => x.id !== "p-cy").concat([
    { id: "k-ed", name: "Ed", role: "dependent", birthDate: "2021-05-05" }, { id: "k-ann", name: "Ann", role: "dependent", birthDate: "2021-05-05" }]);
  p.goals = p.goals.filter((g) => g.id !== "g-col").concat([{ id: "g-fund", name: "Education fund", icon: "🎓", target: 100000, targetDate: "2039-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }]);
  assert.deepEqual(compute(p, { today: TODAY }).children.map((c) => [c.name, c.goal]), [["Ed", null], ["Ann", null]]);
  p.household.people = p.household.people.map((x) => (x.id === "k-ed" ? { ...x, name: "Ty" } : x));
  p.goals[p.goals.length - 1].name = "University fund";
  assert.deepEqual(compute(p, { today: TODAY }).children.map((c) => [c.name, c.goal]), [["Ty", null], ["Ann", null]]);
  // "Ed's college" is Ed's, and a 529 account named "Education 529" is not Ed's either (shared equally)
  p.household.people = p.household.people.map((x) => (x.id === "k-ed" ? { ...x, name: "Ed" } : x));
  p.goals[p.goals.length - 1].name = "Ed's college";
  p.accounts.push({ id: "e529", name: "Education 529", type: "529", balance: 8000 });
  const [ed, ann] = compute(p, { today: TODAY }).children;
  assert.deepEqual(ed.goal, { id: "g-fund", name: "Ed's college" }); assert.equal(ann.goal, null); assert.equal(ann.saved, 8000 / 2);
});

test("a goal named with 529 is an education goal (the one pattern Life insurance needs reads), and figures are shown to the $10", () => {
  assert.equal(EDUCATION_GOAL.test("Child 1 529"), true); assert.equal(EDUCATION_GOAL.test("Japan trip"), false);
  const p = familyPlan(TODAY);
  p.goals = p.goals.filter((g) => g.id !== "g-col").concat([{ id: "g-529", name: "Cy 529", icon: "🎯", target: 50000, targetDate: "2038-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }]);
  assert.deepEqual(compute(p, { today: TODAY }).children[0].goal, { id: "g-529", name: "Cy 529" });
  assert.equal(shownAmount(120113.2), 120110); assert.equal(shownAmount(104915), 104920);
});

// ---- fifth pass (2026-11-02): with one child, the first education goal is the child's only when it names nobody else
test("one child: a goal naming another person is never the child's (Mia with no birth date, in either order; an adult's own school first)", () => {
  const goal = (id, name, target, saved = 0) => ({ id, name, icon: "🎓", target, targetDate: "2030-08-15", priority: 2, saved, fundedBy: [], monthly: 0, rate: null, inflates: true });
  const edu = goal("g-edu", "Education", 0);
  const withMia = (goals) => {
    const p = familyPlan(TODAY);
    p.household.people.push({ id: "p-mia", name: "Mia", role: "dependent", birthDate: "" });   // Mia: no birth date, so Cy is the only child
    p.goals = p.goals.filter((g) => g.id !== "g-col").concat(goals);
    return compute(p, { today: TODAY }).children;
  };
  // "Mia college" first or second: Cy's goal is Get started's "Education" (it was "Mia college" when listed first)
  for (const goals of [[goal("g-mia", "Mia college", 40000), edu], [edu, goal("g-mia", "Mia college", 40000)]]) {
    const kids = withMia(goals);
    assert.deepEqual(kids.map((c) => [c.name, c.goal]), [["Cy", { id: "g-edu", name: "Education" }]], goals[0].name);
  }
  // "Mia college" alone: it is Mia's, so Cy has no goal (and nothing set aside from it)
  assert.deepEqual(withMia([goal("g-mia", "Mia college", 40000, 9000)]).map((c) => [c.name, c.goal, c.saved]), [["Cy", null, 0]]);
  // an adult's own goal listed first ("Ana's night school", $2,000 saved) is Ana's, not Cy's: Cy's is "Education"
  const p = familyPlan(TODAY);
  p.goals = [goal("g-ana", "Ana's night school", 6000, 2000), edu, ...p.goals.filter((g) => g.id !== "g-col")];
  const [cy] = compute(p, { today: TODAY }).children;
  assert.deepEqual(cy.goal, { id: "g-edu", name: "Education" }); assert.equal(cy.saved, 0);
});
