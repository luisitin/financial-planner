import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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

// Round 8 item 18 (equity-5): children already in college -- what is still to pay, a goal never dated in the past, the FAFSA,
// and the American Opportunity credit only under its income limit
/** Marcus and Lin (invented, as the round-8 tester's plan): $210,000 and $30,000, two children in a public college. */
function inCollege() {
  const p = emptyPlan();
  p.household = { people: [{ id: "p-m", name: "Marcus", role: "self", birthDate: "1972-03-15" }, { id: "p-l", name: "Lin", role: "partner", birthDate: "1974-05-15" },
    { id: "k-1", name: "Child 1", role: "dependent", birthDate: "2007-07-15" }, { id: "k-2", name: "Child 2", role: "dependent", birthDate: "2005-07-15" }], filingStatus: "married_joint", state: "WA" };
  p.income = [{ id: "i-m", name: "Pay", type: "salary", personId: "p-m", amount: 210000, period: "annual", growth: 0, taxable: true }, { id: "i-l", name: "Pay", type: "salary", personId: "p-l", amount: 30000, period: "annual", growth: 0, taxable: true }];
  return p;
}
const T8 = "2026-11-06";

test("round 8 item 18: a child in the last year of college: about one year still to pay, and the goal is dated at the next bill", () => {
  const d = compute(inCollege(), { today: T8 });
  const [c1, c2] = d.children;
  // Child 2 started in 2023: 2023-24, 2024-25 and 2025-26 are over; 2026-27 has begun and its spring bill (January 15, 2027)
  // is still ahead. (Review D7: the fall bill has come due, so what is left of it is the spring half of $25,850, the page's
  // 2025-26 price, prices not yet risen for the year that started in 2026; it counted in full before.)
  assert.equal(c2.started, true);
  assert.deepEqual(c2.left.map((x) => x.label), ["2026-27"]);
  near(c2.stillToPay, 12925, 0.01);
  assert.equal(c2.nextBill, "2027-01-15");
  near(c2.nextYearCost, 12925, 0.01);
  assert.ok(c2.stillToPay > 12000 && c2.stillToPay < 14000, "about half a year");
  // Child 1 (from 2025): this year's spring half, 2027-28 and 2028-29
  assert.deepEqual(c1.left.map((x) => x.label), ["2026-27", "2027-28", "2028-29"]);
  near(c1.stillToPay, 12925 + 25850 * 1.04 + 25850 * 1.04 ** 2, 0.01);
  assert.equal(c1.nextBill, "2027-01-15");
  // the FAFSA: for the next school year still to begin (2027-28 for Child 1, open since October 1, 2026 at the latest,
  // 20 U.S.C. 1090(d)(4)(A)); none for Child 2, whose last year has begun
  assert.deepEqual(c1.fafsa, { year: 2027, label: "2027-28", opens: "2026-10-01", open: true });
  assert.equal(c2.fafsa ?? null, null);
  // $213,000 of income (joint): over the $180,000 where the American Opportunity credit ends (Pub. 970, IRC 25A(d))
  assert.equal(d.aotc ?? null, null);
});

test("round 8 item 18: the American Opportunity credit is named under its income limit, shrinking from $160,000 joint", () => {
  const p = inCollege();
  p.income[0].amount = 120000;   // $150,000 in all: the whole credit
  const d = compute(p, { today: T8 });
  assert.equal(d.aotc.status, "full"); assert.equal(d.aotc.students, 2); assert.equal(d.aotc.perStudent, 2500);
  p.income[0].amount = 140000;   // $170,000: in the $160,000 to $180,000 range where it shrinks
  assert.equal(compute(p, { today: T8 }).aotc.status, "partial");
  p.income[0].amount = 150000;   // $180,000: none
  assert.equal(compute(p, { today: T8 }).aotc ?? null, null);
  p.income[0].amount = 140000;
  p.household.filingStatus = "married_separate";
  assert.equal(compute(p, { today: T8 }).aotc ?? null, null, "no credit on a separate return");
});

test("round 8 item 18: once every school year is over, nothing is still to pay; a child years away has no FAFSA line yet", () => {
  const p = inCollege();
  const later = compute(p, { today: "2027-06-01" });
  assert.equal(later.children[1].finished, true); assert.equal(later.children[1].stillToPay, 0); assert.equal(later.children[1].nextBill, null);
  const fam = compute(familyPlan(TODAY), { today: TODAY }).children[0];
  assert.equal(fam.fafsa ?? null, null, "Cy starts in 2038");
  assert.equal(fam.stillToPay, undefined, "a child not yet in college reads exactly as before");
  assert.equal(fam.started, false);
});

test("round 8 item 18: the goal button's goal for a child in college: next school year's cost, dated at the next bill, never in the past", async () => {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const p = inCollege();
  p.goals = [{ id: "g-old", name: "Child 2's college", icon: "🎓", target: 103000, targetDate: "2023-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  const node = (tag, kids = [], extra = {}) => { const x = { tag, kids: [], style: {}, ...extra, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, remove() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  let n = 0;
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l, fn) => node("button", [l], { onClick: fn }), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form"), uid: () => `new-${++n}` };
  const all = (x, out = []) => { if (typeof x !== "object") return out; if (x.tag === "button") out.push(x); for (const c of x.kids) all(c, out); return out; };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => T8 }, plan: p, store: { update(fn) { fn(p); } } });
  assert.match(root.textContent, /Still to pay/);
  assert.match(root.textContent, /2026-27/);
  assert.doesNotMatch(root.textContent, /0% covered|covers about 0%/);
  all(root).find((b) => /^Update "Child 2's college"/.test(b.textContent)).onClick();
  const g = p.goals.find((x) => x.id === "g-old");
  // (review D7: the spring half, $12,925, to the $10 as the page shows it)
  assert.equal(g.targetDate, "2027-01-15"); assert.equal(g.target, 12930); assert.equal(g.inflates, false);
  all(root).find((b) => /^Make it Child 1's goal/.test(b.textContent)).onClick();
  const g1 = p.goals.find((x) => x.name === "Child 1's college, 2026-27");
  assert.ok(g1 && g1.targetDate === "2027-01-15" && g1.target === 12930, JSON.stringify(g1));
  assert.ok(p.goals.every((x) => x.targetDate > T8));
});

// Round 8 batch 2 review (money D7): the page's own two-bill model (BILLS: August 15 and January 15) puts half a school year on
// each bill; once the fall bill has come due, what is left of that year is its spring half, so the goal written for the January
// bill asked for the whole year (and "$12,914 a month" for each child, $28,404 on Goals)
test("round 8 review D7: after the fall bill, a school year under way has its spring half left", () => {
  const [c1, c2] = compute(inCollege(), { today: T8 }).children;
  assert.deepEqual(c2.left.map((x) => [x.label, x.part ?? "year"]), [["2026-27", "spring"]]);
  near(c2.nextYearCost, 25850 / 2, 0.01); near(c2.stillToPay, 12925, 0.01);
  assert.equal(c2.nextBill, "2027-01-15");
  // Child 1: 2026-27's spring half, then 2027-28 and 2028-29 in full (4% a year)
  near(c1.stillToPay, 12925 + 25850 * 1.04 + 25850 * 1.04 ** 2, 0.01);
  // before the fall bill the whole year is still ahead, due from its fall bill
  const july = compute(inCollege(), { today: "2026-07-01" }).children[1];
  assert.deepEqual(july.left.map((x) => [x.label, x.part ?? "year"]), [["2026-27", "year"]]);
  near(july.nextYearCost, 25850, 0.01); assert.equal(july.nextBill, "2026-08-15");
});

// Round 8 batch 2 review (UX 1): a generic "Education" goal stayed next to the new per-child goals, so college was counted twice;
// the button offers to turn it into the child's goal, keeping what is set aside for it
test("round 8 review UX 1: a generic Education goal naming no child is offered as the one to turn into a child's goal", async () => {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const p = inCollege();
  p.goals = [{ id: "g-edu", name: "Education", icon: "🎓", target: 90000, targetDate: "2029-11-01", priority: 2, saved: 5000, fundedBy: [], monthly: 300, rate: null, inflates: true }];
  assert.deepEqual(compute(p, { today: T8 }).generic, { id: "g-edu", name: "Education" });
  const node = (tag, kids = [], extra = {}) => { const x = { tag, kids: [], style: {}, ...extra, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, remove() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  let n = 0;
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l, fn) => node("button", [l], { onClick: fn }), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form"), uid: () => `new-${++n}` };
  const all = (x, out = []) => { if (typeof x !== "object") return out; if (x.tag === "button") out.push(x); for (const c of x.kids) all(c, out); return out; };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => T8 }, plan: p, store: { update(fn) { fn(p); } } });
  assert.match(root.textContent, /Next bill/); assert.match(root.textContent, /spring half/);
  all(root).find((b) => /^Use "Education" for Child 2/.test(b.textContent)).onClick();
  assert.equal(p.goals.length, 1, "one goal, not two");
  assert.deepEqual([p.goals[0].id, p.goals[0].name, p.goals[0].target, p.goals[0].targetDate, p.goals[0].saved, p.goals[0].monthly, p.goals[0].inflates], ["g-edu", "Child 2's college, 2026-27", 12930, "2027-01-15", 5000, 300, false]);
});

// Round 8 verify (2026-11-06): with a child still to start college, a goal naming nobody may well be that child's ("College
// fund", $150,000 by 2036), and the filled button turned it into the older child's spring bill, $12,930 by January, with its
// saving. It is offered only while every child has begun college.
test("round 8 verify: a generic college goal is not offered to a child in college while a younger child is still to start", () => {
  const p = inCollege();
  p.household.people.push({ id: "k3", name: "Child 3", role: "dependent", birthDate: "2018-05-01" });
  p.goals = [{ id: "g-fund", name: "College fund", icon: "🎓", target: 150000, targetDate: "2036-08-15", priority: 2, saved: 20000, fundedBy: [], monthly: 400, rate: null, inflates: true }];
  assert.equal(compute(p, { today: T8 }).generic ?? null, null);
  // every child in college (the equity family): offered, as before
  p.household.people = p.household.people.filter((x) => x.id !== "k3");
  assert.deepEqual(compute(p, { today: T8 }).generic, { id: "g-fund", name: "College fund" });
});

// Round 8 verify (2026-11-06): a school year already begun was priced at this calendar year's price, so on January 1 the spring
// half of 2026-27 rose from $12,925 to $13,442 for the same January 15 bill. Each school year is priced as its own.
test("round 8 verify: the spring bill of a year under way keeps its price across January 1", () => {
  const dec = compute(inCollege(), { today: "2026-12-20" }).children[1];
  const jan = compute(inCollege(), { today: "2027-01-14" }).children[1];
  near(dec.nextYearCost, 12925, 0.01); near(jan.nextYearCost, 12925, 0.01); assert.equal(jan.nextBill, "2027-01-15");
  // Child 1 in January: the spring half of 2026-27, then 2027-28 and 2028-29 as before
  near(compute(inCollege(), { today: "2027-01-14" }).children[0].stillToPay, 12925 + 25850 * 1.04 + 25850 * 1.04 ** 2, 0.01);
});

// path part 3: the first screen says things in plain words (the path walk's banned-word check, qa/flows/path-walk.js, runs it in the browser)
test("part 3: plain words on the first screen: no hard word in this page's view or compute strings", () => {
  const strip = (t) => t.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[^]*?\*\//g, "");
  const view = strip(fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8"));
  for (const w of ['faster than prices in general']) assert.ok(view.includes(w), w);
  for (const w of ['faster than inflation']) assert.ok(!view.includes(w), w);
});

// smart guesses C5 (2026-11-13): Get started's Education goal left blank takes this page's own "Make it a goal" figure
test("educationTarget: each child's 'Make it a goal' figure (today's money x share, to the $1,000), summed; compute() unchanged", async () => {
  const { educationTarget } = await import("./compute.js");
  const p = familyPlan("2026-11-02");
  const before = JSON.stringify(compute(p, { today: "2026-11-02" }));
  const t = educationTarget(p, { today: "2026-11-02" });
  const kids = compute(p, { today: "2026-11-02" }).children.filter((c) => !c.started);
  assert.ok(kids.length > 0);
  assert.deepEqual(t.children.map((c) => c.value), kids.map((c) => Math.round((c.totalToday * c.share) / 1000) * 1000));
  assert.equal(t.total, t.children.reduce((s, c) => s + c.value, 0));
  assert.equal(JSON.stringify(compute(p, { today: "2026-11-02" })), before);
  assert.equal(educationTarget(emptyPlan(), { today: "2026-11-02" }), null, "no child with a birth year");
});

// ---- our guess in an empty "A cost I enter" box (smart guesses C9, spec 12.1 K3): gray, counted while empty, never saved
import { estimators, publicYearNow, COSTS_READ } from "./compute.js";
import { PREVIEW_LINE } from "./view.js";
import { estimate, checkEstimators } from "../../../core/estimate/index.js";
import { TABLES } from "../../overview/guesses/compute.js";
import { migrate } from "../../../core/schema/migrate.js";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
import { previewsOf } from "./compute.js";
import { compute as planOf } from "../../overview/plan/compute.js";
import { compute as lifeNeedsOf } from "../../insurance/life-needs/compute.js";
import { collegeBills } from "../../overview/next-best-action/compute.js";
import { compute as goalsOf } from "../goals/compute.js";

const T13 = "2026-11-13";
const OPTS = { estimators, tables: TABLES, today: T13 };
const customBlank = () => { const p = familyPlan(T13); p.whatIfs = { college: { "p-cy": { type: "custom", yearly: null } } }; return p; };

test("C9 goals/education:yearly: a public in-state year at published prices, grown to this year at the plan's college growth", () => {
  assert.deepEqual(checkEstimators(estimators), []);
  assert.equal(publicYearNow(familyPlan(T13), T13), 25850, "2026: the 2025-26 price (as the page counts public)");
  near(publicYearNow(familyPlan(T13), "2027-03-01"), 25850 * 1.04);
  const g = familyPlan(T13); g.whatIfs = { college: { growth: 0.05 } };
  near(publicYearNow(g, "2028-01-01"), 25850 * 1.05 * 1.05);
  const e = estimate(familyPlan(T13), "goals/education:yearly", OPTS);
  assert.deepEqual([e.value, e.why, e.basis, e.dataAsOf, e.unit], [25850, "a year at a public in-state college, at published prices", "yours", COSTS_READ, "year"]);
  const eur = familyPlan(T13); eur.meta.currency = "EUR";
  assert.equal(estimate(eur, "goals/education:yearly", OPTS), null, "no U.S. price outside the U.S.");
});
test("C9 invariance and previews: an empty custom cost is 0 with previews: null (as before) and our figure with them; typed wins", () => {
  for (const p of [familyPlan(T13), renterDebtPlan(), retiredCouplePlan(T13), migrate(emptyPlan()), customBlank()]) {
    const a = compute(p, { today: T13, previews: null });
    assert.ok(a.children.every((c) => !("previewed" in c)), "no new key without previews");
    assert.deepEqual(compute(p, { today: T13, previews: false }), a);
  }
  assert.equal(compute(customBlank(), { today: T13, previews: null }).children[0].yearlyNow, 0, "as before: an empty custom cost is $0");
  const d = compute(customBlank(), { today: T13, previews: { yearly: 25850 } });
  assert.deepEqual([d.children[0].yearlyNow, d.children[0].previewed], [25850, true]);
  near(d.children[0].total, d.children[0].costs.reduce((t, x) => t + x.cost, 0));
  const typed = customBlank(); typed.whatIfs.college["p-cy"].yearly = 18000;
  assert.deepEqual([compute(typed, { today: T13, previews: { yearly: 25850 } }).children[0].yearlyNow, compute(typed, { today: T13, previews: { yearly: 25850 } }).children[0].previewed], [18000, false]);
  const pub = compute(familyPlan(T13), { today: T13, previews: { yearly: 99999 } });
  assert.deepEqual([pub.children[0].yearlyNow, pub.children[0].previewed], [25850, false], "only a custom cost left empty");
  const { children: c0, ...rest0 } = compute(familyPlan(T13), { today: T13, previews: null });
  const { children: c1, ...rest1 } = pub;
  assert.deepEqual(rest1, rest0); assert.deepEqual(c1.map(({ previewed, ...x }) => x), c0, "the rest of the answer is the same");
});

async function drawEdu(plan0, { guess = true } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const p = migrate(structuredClone(plan0)); const saved = []; const root = new FakeElement("main");
  render(root, { ui, fmt: { ...fmt, today: () => T13 }, plan: p, route: { rest: [], query: {} }, module: { group: "goals", id: "education" }, computeOf: () => null,
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } },
    ...(guess ? { guess: (k, o = {}) => estimate(p, k, { ...OPTS, ...o }) } : {}) });
  return { root, saved, textOf };
}
const openParts = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));

test("C9 the page: an empty custom cost shows our gray figure, the line says so, and opening writes nothing", async () => {
  await drawEdu(customBlank());   // (a confirmation an earlier test left is said once)
  const { root, saved, textOf } = await drawEdu(customBlank());
  assert.equal(saved.length, 0);
  const box = root.querySelector('[name="yearly"]');
  assert.equal(box.getAttribute("placeholder"), "25,850");
  assert.match(textOf(box.closest("label")), /Our guess: a year at a public in-state college, at published prices\./);
  const line = root.querySelectorAll("p").find((x) => textOf(x) === PREVIEW_LINE);
  assert.ok(line, "the line is in the child's card");
  for (let a = line.parentNode; a; a = a.parentNode) assert.ok(!(a.tagName === "DETAILS" && !a.hasAttribute("open")), "never folded away");
  assert.doesNotMatch(textOf(root), /\$0\s*Four years would cost/, "the custom cost is no longer $0");
  // a public college: no gray figure, no line
  const pub = await drawEdu(familyPlan(T13));
  assert.doesNotMatch(pub.textOf(pub.root), /our guess for now/i);
  // no guesses (another currency): an empty custom cost is $0 as before, and the box has no gray figure
  const eur = customBlank(); eur.meta.currency = "EUR";
  const none = await drawEdu(eur);
  assert.equal(none.root.querySelector('[name="yearly"]').getAttribute("placeholder") ?? "", "");
  assert.doesNotMatch(none.textOf(none.root), /our guess/i);
  // the page no longer leans on ctx.guess (compute counts our figure): a shell without it draws the same page
  const bare = await drawEdu(customBlank(), { guess: false });
  assert.equal(bare.textOf(bare.root), textOf(root));
});
test("C9 (critic e9 F2) an empty custom cost counts the same on Education, Your plan, Next best action and Life insurance needs", () => {
  const p = customBlank();
  const d = compute(p, { today: T13 });
  const cy = d.children.find((c) => c.id === "p-cy");
  // left out, the preview is our own: exactly what the shell's ctx.guess gives the page
  assert.equal(previewsOf(p, { today: T13 }).yearly.value, estimate(p, "goals/education:yearly", OPTS).value);
  assert.deepEqual(d, compute(p, { today: T13, previews: { yearly: estimate(p, "goals/education:yearly", OPTS).value } }));
  assert.deepEqual([cy.yearlyNow, cy.previewed], [25850, true]);
  // 25,850 x (1.04^12 + 1.04^13 + 1.04^14 + 1.04^15), Cy starting in 2038
  near(cy.total, [12, 13, 14, 15].reduce((t, n) => t + 25850 * Math.pow(1.04, n), 0), 1e-6);
  // Your plan's college line quotes it (it said "would cost about $0")
  const row = planOf(p, { today: T13 }).groups.flatMap((g) => g.rows).find((r) => r.key === "college");
  const kids = d.children.reduce((t, c) => t + c.total, 0);
  assert.equal(row.figure, kids);
  assert.ok(row.figure > 100000);
  // Life insurance needs counts the college the page shows (it left the custom cost out): our public in-state year, so the
  // same need as a child on Public
  assert.equal(compute(p, { today: T13, previews: null }).children.find((c) => c.id === "p-cy").total, 0, "the test can tell: with no guess the cost is $0");
  const ln = lifeNeedsOf(p, { today: T13 }), lnPublic = lifeNeedsOf(familyPlan(T13), { today: T13 });
  assert.ok(ln.people[0].dime.education > 0);
  assert.equal(ln.people[0].dime.education, lnPublic.people[0].dime.education);
  assert.equal(ln.people[0].plan.need, lnPublic.people[0].plan.need);
  // Next best action's college bill reads the same compute: a child in college, a custom cost left empty (it said $0)
  const q = familyPlan(T13); q.household.people.find((x) => x.id === "p-cy").birthDate = "2007-03-01";
  q.whatIfs = { college: { "p-cy": { type: "custom", yearly: null } } };
  const edu = compute(q, { today: T13 }).children.find((c) => c.id === "p-cy");
  const bills = collegeBills(q, T13, [...goalsOf(q, { today: T13 }).goals, { id: "gc", name: "Cy's college, 2026-27", status: "past due", planner: { page: "goals/education" } }]);
  assert.ok(edu.nextYearCost > 0, "the bill is our public year, not $0");
  assert.equal([...bills.values()][0]?.amount, edu.nextYearCost);
});
test("C9 (critic e9 F6, F7) the cost box, its gray figure and its line show only for \"A cost I enter\"; no stray example", async () => {
  const { fullSelectors } = await import("../../../qa/fixtures/fake-dom.mjs");
  fullSelectors();   // the page finds its kind box with 'select[name="type"]', as a browser does
  const pub = await drawEdu(familyPlan(T13));
  const lab = pub.root.querySelector('[name="yearly"]').closest("label");
  assert.equal(lab.style.display, "none", "Public: the box is not shown (hidden alone lost to .field { display: flex })");
  const cus = await drawEdu(customBlank());
  assert.equal(cus.root.querySelector('[name="yearly"]').closest("label").style.display, "");
  // switching the kind in the form shows it, with our gray figure
  const sel = pub.root.querySelector('select[name="type"]');
  sel.value = "custom"; sel.dispatch("change");
  assert.equal(lab.style.display, "");
  assert.equal(pub.root.querySelector('[name="yearly"]').getAttribute("placeholder"), "25,850");
  // no percent box keeps the kit's "e.g. 7": gray means counted; and every help line starts as a sentence (P8)
  for (const b of pub.root.querySelectorAll("input")) assert.notEqual(b.getAttribute("placeholder"), "e.g. 7", b.getAttribute("name"));
  for (const h of pub.root.querySelectorAll(".help")) assert.match(pub.textOf(h), /^[A-Z0-9]/, `"${pub.textOf(h)}" starts in lower case`);
});
test("C9 S11 (R17): saving a child's college with the cost left empty saves no figure, and only that part stays open", async () => {
  const a = await drawEdu(customBlank());
  const before = openParts(a.root);
  assert.deepEqual(before, { "college-p-cy": false, state: false, growth: false });
  a.root.querySelector('[name="yearly"]').closest("form").dispatch("submit");
  assert.equal(a.saved.length, 1);
  assert.equal(a.saved[0].whatIfs.college["p-cy"].yearly, null, "our figure is never written");
  assert.equal(a.saved[0].guesses, undefined);
  const b = await drawEdu(a.saved[0]);
  assert.deepEqual(openParts(b.root), { "college-p-cy": true, state: false, growth: false }, "the part just saved stays open; no other moves");
  assert.match(b.textOf(b.root), /college saved\./);
  // the growth row: saving it opens only itself
  const c = await drawEdu(familyPlan(T13));
  c.root.querySelector('[name="growth"]').value = "5";
  c.root.querySelector('[name="growth"]').closest("form").dispatch("submit");
  assert.equal(c.saved[0].whatIfs.college.growth, 0.05);
  const e = await drawEdu(c.saved[0]);
  assert.deepEqual(openParts(e.root), { "college-p-cy": false, state: false, growth: true });
  assert.match(e.textOf(e.root.querySelectorAll("details").find((x) => x.dataset.part === "growth")), /At 5\.0% a year, a public in-state year \(\$25,850 in 2025-26\) would cost about \$\d/);
});

test("C9 the growth row's sentence: what the rate does to the first child still to start, else the rate alone", async () => {
  const { growthExample } = await import("./view.js");
  const money = (n) => `$${Math.round(n / 10) * 10}`;
  const d = compute(familyPlan(T13), { today: T13 });
  assert.equal(growthExample(d, money), `At 4.0% a year, a public in-state year ($25850 in 2025-26) would cost about $${Math.round(25850 * Math.pow(1.04, 2038 - 2026) / 10) * 10} in 2038, when Cy starts.`);
  assert.equal(growthExample({ growth: 0.05, costYear: 2025, children: [{ started: true }] }, money), "The plan assumes 5.0% a year for college prices.");
});

// ---------------------------------------------------------------- gap list, next 60, item 3: your state's tax break (map U4)
import { stateBreak, STATE_EXAMPLE } from "./compute.js";
import { stateSentence, stateCounted, stateRateHelp, rateWords, rateText, STATE_CHECK, stateSaved, stateStatus } from "./view.js";
const money10 = (n) => `$${(Math.round(n / 10) * 10).toLocaleString("en-US")}`;   // the page's own rounding (shownAmount)
/** The family, moved to Colorado (a flat 4.4% on the State tax page), with what they typed in the state row. */
const inColorado = (college = {}) => { const p = familyPlan(T13); p.household.state = "CO"; p.whatIfs = { college }; return p; };
const partOf = (root, id) => root.querySelectorAll("details").find((x) => x.dataset.part === id);

test("state break: no child still to start (empty plan, every child in college) draws no row", () => {
  assert.equal(stateBreak(emptyPlan(), { today: T13 }), null);
  assert.equal(stateBreak(inCollege(), { today: T8 }), null);
});
test("state break: a state with no income tax on pay says so, whatever is typed for the deduction (Texas)", () => {
  for (const college of [{}, { stateDeduction: 5000 }]) {
    const p = familyPlan(T13); p.whatIfs = { college };
    const s = stateBreak(p, { today: T13 });
    assert.deepEqual([s.case, s.name, s.rate, s.rateFrom, s.yearly], ["none", "Texas", 0, "none", null]);
    assert.equal(stateSentence(s, money10), "Texas has no state income tax on pay, so 529 money brings no state tax break there.");
    assert.equal(stateCounted(s, money10), null);
    assert.equal(stateRateHelp(s), "Left empty, we count 0%: Texas has no state income tax on pay.");
  }
  // a rate typed here wins even there (a move, or a plan whose state is out of date)
  const p = familyPlan(T13); p.whatIfs = { college: { stateDeduction: 2000, stateRate: 0.05 } };
  const s = stateBreak(p, { today: T13 });
  assert.deepEqual([s.case, s.rate, s.rateFrom], ["full", 0.05, "yours"]);
  near(s.yearly, 2000 * 0.05);
});
test("state break by hand: Colorado 4.4%, $3,000 a year going in (Cy's goal, $250 a month), 12 years to 2038", () => {
  // the deduction above what goes in: only what goes in comes off (capped)
  const a = stateBreak(inColorado({ stateDeduction: 5000 }), { today: T13 });
  assert.deepEqual([a.case, a.code, a.rate, a.rateFrom, a.put, a.counted, a.years, a.last], ["capped", "CO", 0.044, "flat", 3000, 3000, 12, { name: "Cy", startYear: 2038 }]);
  near(a.yearly, 3000 * 0.044); near(a.total, 3000 * 0.044 * 12);   // $132 a year, $1,584 in all
  assert.equal(stateSentence(a, money10), "About $130 a year less state tax on the $3,000 a year you put in now, $1,580 in all by the time Cy starts college in 2038.");
  assert.equal(stateCounted(a, money10), "Counted: $3,000 a year off your income at 4.4%, Colorado's flat rate on the State tax page, each year until Cy starts college in 2038.");
  assert.equal(stateRateHelp(a), "Left empty, we count 4.4%: Colorado's flat rate on the State tax page.");
  // the deduction under what goes in: all of it (full)
  const b = stateBreak(inColorado({ stateDeduction: 2000 }), { today: T13 });
  assert.equal(b.case, "full"); near(b.yearly, 88); near(b.total, 88 * 12);
  assert.equal(stateSentence(b, money10), "About $90 a year less state tax, $1,060 in all by the time Cy starts college in 2038.");
  // nothing going in yet: if they put the deduction in (assumed)
  const p = inColorado({ stateDeduction: 5000 }); p.goals.find((g) => g.id === "g-col").monthly = 0;
  const c = stateBreak(p, { today: T13 });
  assert.deepEqual([c.case, c.put, c.counted], ["assumed", 0, 5000]); near(c.yearly, 220); near(c.total, 2640);
  assert.equal(stateSentence(c, money10), "Nothing goes into a 529 yet. Putting in $5,000 a year would take about $220 a year off your state tax, $2,640 in all by the time Cy starts college in 2038.");
});
test("state break: two children, the older one starting first: from then on only the younger one's saving comes off", () => {
  const p = inColorado({ stateDeduction: 4000 });
  p.household.people.push({ id: "p-bo", name: "Bo", role: "dependent", birthDate: "2016-04-04" });   // college from 2034
  p.goals.push({ id: "g-bo", name: "Bo's college", icon: "🎓", target: 60000, targetDate: "2034-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 100, rate: null, inflates: true });
  const s = stateBreak(p, { today: T13 });
  // 2026 to 2033: 12 x (250 + 100) = 4,200 a year goes in, 4,000 counts; 2034 to 2037: Cy's 3,000 alone
  assert.deepEqual([s.case, s.put, s.counted, s.years, s.last.name], ["full", 4200, 4000, 12, "Cy"]);
  near(s.total, (4000 * 8 + 3000 * 4) * 0.044);
});
test("critic q4 P1, P2: the state row's status says what it holds while shut; its green line is short and names the figure", () => {
  // Texas (the family): no income tax on pay, said in two words in the shut row
  assert.equal(stateStatus(stateBreak(familyPlan(T13), { today: T13 })), "Texas: none");
  assert.equal(stateStatus(stateBreak(inColorado(), { today: T13 })), "", "nothing typed: statusOf says not set yet");
  const a = stateBreak(inColorado({ stateDeduction: 5000 }), { today: T13 });
  assert.equal(stateSaved(a, money10), "About $130 a year less state tax.");
  assert.equal(stateSaved(stateBreak(inColorado({ stateDeduction: 0 }), { today: T13 }), money10), "", "no figure: Saved. alone, the sentence is under it");
});
test("state break: asks for what it lacks, and 0 typed says there is no break", () => {
  const ask = stateBreak(inColorado(), { today: T13 });
  assert.equal(ask.case, "ask");
  assert.equal(stateSentence(ask, money10), "Type below how much a year your state lets you take off your income for 529 money: we work out what it saves.");
  // a state with graduated rates and nothing typed on the State tax page: no rate to count (Georgia)
  const ga = inColorado({ stateDeduction: 4000 }); ga.household.state = "GA";
  const r = stateBreak(ga, { today: T13 });
  assert.deepEqual([r.case, r.rate, r.page.rate], ["rate", null, null]);
  assert.equal(stateSentence(r, money10), "Type your state's tax rate below to see what that saves.");
  assert.equal(stateRateHelp(r), "Your state's rate on your top dollars, for example 5%.");
  for (const college of [{ stateDeduction: 0 }, { stateDeduction: 4000, stateRate: 0 }]) {
    const z = stateBreak(inColorado(college), { today: T13 });
    assert.equal(z.case, "zero", JSON.stringify(college));
    assert.equal(stateSentence(z, money10), "With nothing taken off or a 0% rate, 529 money brings no state tax break.");
  }
});
test("state break: the rate's words follow the State tax page (a rate typed there, last year's share), and rates read as people write them", () => {
  const typedThere = inColorado({ stateDeduction: 2000 }); typedThere.taxes = { ...(typedThere.taxes ?? {}), state: { rate: 0.05 } };
  const a = stateBreak(typedThere, { today: T13 });
  assert.deepEqual([a.rate, a.rateFrom], [0.05, "typed"]);
  assert.equal(rateWords(a), "your rate on the State tax page");
  const s = stateBreak(inColorado({ stateDeduction: 2000 }), { today: T13, stateTax: { rate: 0.0307, method: "prior", name: "Pennsylvania", code: "PA" } });
  assert.equal(rateWords(s), "what your state took last year as a share of income, on the State tax page");
  assert.deepEqual([rateText(0.044), rateText(0.0495), rateText(0.06), rateText(0.0307)], ["4.4%", "4.95%", "6%", "3.07%"]);
  assert.equal(STATE_EXAMPLE, 5000);
});

test("state break, the page S11: one quiet row, nothing new in the first view; the state clause moved into it; Save names the answer", async () => {
  const { fullSelectors } = await import("../../../qa/fixtures/fake-dom.mjs");
  fullSelectors();
  await drawEdu(familyPlan(T13));   // (a confirmation an earlier test left is said once)
  const a = await drawEdu(inColorado());
  const row = partOf(a.root, "state");
  assert.ok(row && !row.hasAttribute("open"), "a shut row");
  assert.equal(a.textOf(row.querySelector(".fold-title")), "Your state's tax break");
  assert.equal(row.querySelector(".fold-status") ?? null, null, "no status until something is typed");
  // the long bullet is short now; its clause is inside the row (moved, not deleted)
  assert.ok(a.root.querySelectorAll("li").some((li) => a.textOf(li) === "A 529 plan grows tax-free when spent on college."));
  assert.ok(a.textOf(row.querySelector(".fold-body")).includes(STATE_CHECK));
  // the help gives the example in words; the box shows no gray figure
  const box = a.root.querySelector('[name="stateDeduction"]');
  assert.equal(box.getAttribute("placeholder") ?? "", "");
  assert.ok(a.textOf(box.closest("label")).includes("For example $5,000. Your state's 529 plan says how much"));
  // Save: only this row opens, and its green line names the new answer
  box.value = "5,000";
  box.closest("form").dispatch("submit");
  assert.equal(a.saved.length, 1);
  assert.deepEqual([a.saved[0].whatIfs.college.stateDeduction, a.saved[0].whatIfs.college.stateRate], [5000, null]);
  const b = await drawEdu(a.saved[0]);
  assert.deepEqual(openParts(b.root), { "college-p-cy": false, state: true, growth: false });
  // the green line names the new figure in a few words; the full sentence is right under it, once (critic q4 P2)
  const said = partOf(b.root, "state").querySelector(".notice");
  assert.equal(b.textOf(said), "Saved. About $130 a year less state tax.");
  assert.ok(b.textOf(partOf(b.root, "state")).includes("About $130 a year less state tax on the $3,000 a year you put in now, $1,580 in all by the time Cy starts college in 2038."));
  assert.ok(b.textOf(partOf(b.root, "state").querySelector("summary")).includes("1 set by you"));
  // children all in college: no row, and the bullet keeps its clause
  const c = await drawEdu(inCollege());
  assert.equal(partOf(c.root, "state"), undefined);
  assert.ok(c.root.querySelectorAll("li").some((li) => c.textOf(li).includes("many states take contributions off state income tax")));
});
