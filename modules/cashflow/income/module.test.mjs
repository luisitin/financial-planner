import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.monthly, 0); assert.equal(d.yearly, 0); assert.deepEqual(d.byPerson, []);
});
test("pay periods are normalised: 2,000 every two weeks is 52,000 a year, 4,333.33 a month", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self" });
  p.income.push({ id: "i1", name: "Ana's pay", type: "salary", personId: "a", amount: 2000, period: "biweekly", growth: 0.03, taxable: true });
  const d = compute(p, { today: TODAY });
  assert.equal(d.yearly, 52000);
  near(d.monthly, 4333.33);
  near(d.nextYear, 53560);
  assert.equal(d.items[0].personName, "Ana");
  assert.equal(d.byPerson[0].name, "Ana");
  assert.equal(d.taxableYearly, 52000);
  assert.equal(d.untaxedYearly, 0);
});
test("start and end dates decide what counts today; one-offs stay out of the monthly total", () => {
  const p = emptyPlan();
  p.income.push(
    { id: "i1", name: "Job", type: "salary", amount: 5000, period: "monthly" },
    { id: "i2", name: "New job", type: "salary", amount: 6000, period: "monthly", startDate: "2027-01-01" },
    { id: "i3", name: "Old gig", type: "business", amount: 1000, period: "monthly", endDate: "2026-06-30" },
    { id: "i4", name: "Tax refund", type: "other", amount: 1500, period: "once", taxable: false },
  );
  const d = compute(p, { today: TODAY });
  assert.equal(d.monthly, 5000);
  assert.equal(d.active.length, 2, "job and the one-off");
  assert.equal(d.items[1].upcoming, true);
  assert.equal(d.items[2].ended, true);
  assert.equal(d.oneTime, 1500);
  assert.equal(d.untaxedYearly, 0, "a one-off has no yearly amount");
  assert.equal(d.items[0].personName, "Household");
});
test("warnings: no amount, ends before it starts, growth typed as 300", () => {
  const p = emptyPlan();
  p.income.push({ id: "i1", name: "Nothing", type: "other", amount: 0, period: "monthly" }, { id: "i2", name: "Backwards", type: "other", amount: 1, period: "monthly", startDate: "2026-02-01", endDate: "2026-01-01" }, { id: "i3", name: "Rocket", type: "salary", amount: 1, period: "monthly", growth: 3 });
  const w = compute(p, { today: TODAY }).warnings;
  assert.ok(w.some((x) => x.includes("no amount")));
  assert.ok(w.some((x) => x.includes("ends before")));
  assert.ok(w.some((x) => x.includes("Raises are usually")));
});
test("byType sums yearly amounts per kind", () => {
  const p = emptyPlan();
  p.income.push({ id: "1", name: "a", type: "salary", amount: 100, period: "monthly" }, { id: "2", name: "b", type: "salary", amount: 100, period: "monthly" }, { id: "3", name: "c", type: "rental", amount: 1200, period: "annual" });
  assert.deepEqual(compute(p).byType, { salary: 2400, rental: 1200 });
});
test("looksYearly: a salary over $480,000 a year not typed as yearly is asked about; others are not", async () => {
  const { looksYearly, ASK_YEARLY_ABOVE } = await import("./compute.js");
  assert.equal(ASK_YEARLY_ABOVE, 480000);
  assert.deepEqual(looksYearly({ type: "salary", amount: 72000, period: "monthly" }), { yearly: 864000, asIf: 72000 });
  assert.equal(looksYearly({ type: "salary", amount: 40000, period: "monthly" }), null, "exactly $480,000 a year: not asked");
  assert.ok(looksYearly({ type: "salary", amount: 40001, period: "monthly" }));
  assert.equal(looksYearly({ type: "business", amount: 72000, period: "monthly" }), null, "only pay");
  assert.equal(looksYearly({ type: "salary", amount: 900000, period: "annual" }), null, "typed as a year: believed");
  assert.deepEqual(looksYearly({ type: "salary", amount: 20000, period: "biweekly" }), { yearly: 520000, asIf: 20000 });
  assert.equal(looksYearly({ type: "salary", amount: 72000, period: "once" }), null);
});

test("a raise from a later date keeps today's pay until then (round 4, 2026-11-02): changeFrom splits it; next year counts the raise", async () => {
  const { changeFrom } = await import("./compute.js");
  const T = "2026-11-02";
  const ana = { id: "i1", name: "Ana's salary", type: "salary", personId: "p-ana", amount: 3900, period: "biweekly", growth: 0.03, startDate: "", endDate: "", taxable: true };
  const ch = changeFrom(ana, { ...ana, amount: 4200, startDate: "2027-01-01" }, T);
  assert.equal(ch.split, true);
  // review 2026-11-02, round 5: the pay that ends keeps its id; the new pay has none (the page gives it one) and says which
  // line it carries on
  assert.deepEqual(ch.old, { ...ana, endDate: "2026-12-31" }, "the pay on file runs until the day before, unchanged");
  assert.deepEqual(ch.next, { name: "Ana's salary", type: "salary", personId: "p-ana", amount: 4200, period: "biweekly", growth: 0.03, startDate: "2027-01-01", endDate: "", taxable: true, continues: "i1" });
  near(ch.change, (4200 - 3900) * 26 / 12);
  // the plan keeps today's pay now, and the raise a year from now
  const plan = { ...emptyPlan(), income: [ch.old, { id: "i2", ...ch.next }] };
  const d = compute(plan, { today: T });
  near(d.monthly, 3900 * 26 / 12); near(d.nextYear, 4200 * 26, 0.01);
  // not split: no date, a date already past, only the name changed, or an income that has not started yet
  assert.equal(changeFrom(ana, { ...ana, amount: 4200 }, T).split, false);
  assert.equal(changeFrom(ana, { ...ana, amount: 4200, startDate: "2026-10-01" }, T).split, false);
  assert.equal(changeFrom(ana, { ...ana, name: "Pay", startDate: "2027-01-01" }, T).split, false);
  assert.equal(changeFrom({ ...ana, startDate: "2026-12-01" }, { ...ana, amount: 4200, startDate: "2027-01-01" }, T).split, false);
  // an end date already before the new start is kept
  assert.equal(changeFrom({ ...ana, endDate: "2026-12-15" }, { ...ana, endDate: "", amount: 4200, startDate: "2027-01-01" }, T).old.endDate, "2026-12-15");
});

test("a raise from a later date: one chain (review 2026-11-02, round 5): the setup's id and the careful figure stay, the new pay continues the line", async () => {
  const { changeFrom, chainId, countedOn } = await import("./compute.js");
  const T = "2026-11-02";
  // the setup's own pay line keeps its id (Get started's pay question answers with today's pay); the new pay is marked a
  // typical year, so the Forecast still spreads it without the setup's id
  const setup = { id: "setup-pay-p-ana", name: "Ana's business", type: "business", personId: "p-ana", amount: 90000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true };
  const sp = changeFrom(setup, { ...setup, amount: 96000, startDate: "2027-01-01" }, T);
  assert.equal(sp.old.id, "setup-pay-p-ana"); assert.equal("typicalYear" in sp.old, false);
  assert.equal("id" in sp.next, false); assert.equal(sp.next.continues, "setup-pay-p-ana"); assert.equal(sp.next.typicalYear, true);
  const marked = changeFrom({ ...setup, id: "x1", typicalYear: true }, { ...setup, amount: 96000, startDate: "2027-01-01" }, T);
  assert.equal(marked.next.typicalYear, true); assert.equal(marked.old.typicalYear, true, "kept on the line that has it");
  // the Forecast spreads both halves over the months (the ending one by the setup's id, the new one by typicalYear):
  // a year's pay never lands in the two weeks before the start date
  const { compute: forecast } = await import("../forecast/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const fp = familyPlan(T); fp.income = fp.income.filter((x) => x.type !== "business");
  const ana60 = { ...setup, amount: 60000 }, s60 = changeFrom(ana60, { ...ana60, amount: 66000, startDate: "2027-01-01" }, T);
  fp.income.push(s60.old, { id: "n60", ...s60.next });
  const dep = forecast(fp, { today: T, days: 120 }).days.flatMap((x) => x.events.filter((e) => e.name === "Ana's business").map((e) => [x.date, Math.round(e.amount)]));
  assert.deepEqual(dep.slice(0, 3), [["2026-11-15", 5000], ["2026-12-15", 5000], ["2027-01-01", 5500]]);
  const plain = changeFrom({ ...setup, id: "x2", period: "monthly", amount: 7000 }, { ...setup, period: "monthly", amount: 7500, startDate: "2027-01-01" }, T);
  assert.equal("typicalYear" in plain.next, false, "any other line: not marked");
  // the careful figure goes on with the new pay (repeating business pay only); countedOn ignores it at or above a lower amount
  const side = { id: "i-side", name: "Weekend photography", type: "business", personId: "", amount: 600, period: "monthly", countOn: 300 };
  const up = changeFrom(side, { ...side, amount: 900, startDate: "2027-01-01" }, T);
  assert.equal(up.old.countOn, 300); assert.equal(up.next.countOn, 300); assert.equal(countedOn(up.next), 300);
  assert.equal(countedOn(changeFrom(side, { ...side, amount: 250, startDate: "2027-01-01" }, T).next), null);
  assert.equal("countOn" in changeFrom(side, { ...side, type: "salary", amount: 900, startDate: "2027-01-01" }, T).next, false, "a new kind drops it");
  assert.equal("countOn" in changeFrom(side, { ...side, period: "once", amount: 900, startDate: "2027-01-01" }, T).next, false, "one time drops it");
  // chainId: the line's own id, or the first line of the chain; a second raise on the new pay still continues the first line
  assert.equal(chainId(side), "i-side"); assert.equal(chainId({ id: "n1", ...up.next }), "i-side");
  const again = changeFrom({ id: "n1", ...up.next }, { ...up.next, amount: 1200, startDate: "2027-06-01" }, "2027-02-01");
  assert.equal(again.old.id, "n1"); assert.equal(again.old.continues, "i-side"); assert.equal(again.next.continues, "i-side");
  assert.equal(chainId(null), undefined);
});

// ---- round 8 batch 6: rent after the place's running costs (landlord-5) --------------------------------------------------
test("batch 6: the condo's $2,100 of rent is $937 a month after its running costs (Rental analysis); the line keeps $2,100", async () => {
  const M = await import("./compute.js");
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const p = condoOnNetWorthPlan(), T = "2026-11-06";
  const r = M.rentAfterCostsOf(p, { today: T }).get("setup-other");
  // (25,200 less 5% empty months, less 4,700 + 1,200 + 4,200 + 2,600 of running costs) / 12
  near(r.afterCosts, 11240 / 12); assert.deepEqual(r.rentals, ["Condo"]); near(r.beforeCosts, 0); assert.equal(r.onPage, true);
  // the totals and tax still read the rent as typed
  near(compute(p, { today: T }).monthly, 95000 / 12 + 72000 / 12 + 2100);
  // a second rent line for a place not on Rental analysis stays before its costs
  p.income.push({ id: "garage", name: "Garage", type: "rental", amount: 150, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true });
  const g = M.rentAfterCostsOf(p, { today: T }).get("garage");
  assert.equal(g.afterCosts, null); near(g.beforeCosts, 150);
  // no place on Rental analysis: before its costs, and the page says where to add it
  p.property = [];
  const n = M.rentAfterCostsOf(p, { today: T }).get("setup-other");
  assert.equal(n.afterCosts, null); assert.equal(n.onPage, false);
  // no rent at all: nothing
  assert.equal(M.rentAfterCostsOf(emptyPlan(), { today: T }).size, 0);
});

// round 8 batch 6 review (money 10, UX 5): one figure for what the condo brings in, its loan said too
test("batch 6 review: a line that is one rental's whole rent shows that rental's figure ($937), with the loan after it ($86), and says when the rents differ", async () => {
  const M = await import("./compute.js");
  const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  const p = condoOnNetWorthPlan();
  let r = M.rentAfterCostsOf(p, { today: T }).get("setup-other");
  // 937 less the 851 payment on Debts = 86 a month, Rental analysis's cash flow
  near(r.afterCosts, 11240 / 12); near(r.loanMonthly, 851); near(r.afterLoan, 11240 / 12 - 851); assert.equal(r.loanInDebts, true); assert.equal(r.rentalRent, null);
  // the review's rentdiff: Income's line $2,000, Rental analysis $2,100: the rental's own $937 (it read $892, scaled by 24,000 / 25,200)
  p.income.find((x) => x.id === "setup-other").amount = 2000;
  r = M.rentAfterCostsOf(p, { today: T }).get("setup-other");
  near(r.afterCosts, 11240 / 12); near(r.rentalRent, 2100);
  // a loan typed only on Rental analysis: said, not on Debts
  r = M.rentAfterCostsOf(condoOnlyRentalPlan(), { today: T }).get("setup-other");
  near(r.loanMonthly, 851); assert.equal(r.loanInDebts, false);
  // one line for two places on Rental analysis: shared as before, no single loan said
  const q = condoOnNetWorthPlan();
  q.property.push({ ...q.property[0], id: "r-flat", name: "Flat", accountId: undefined, loanAccountId: null, loanBalance: 0, rentMonthly: 900 });
  q.income.find((x) => x.id === "setup-other").amount = 3000;
  r = M.rentAfterCostsOf(q, { today: T }).get("setup-other");
  assert.deepEqual(r.rentals, ["Condo", "Flat"]); assert.equal(r.loanMonthly, null);
});

// ---- One figure or item by item (gap list, next 60, item 11; README "One figure or item by item") ---------------------------
import * as OF from "./one-figure.js";
import { migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { takeHome, compute as paycheckOf } from "../paycheck/compute.js";
import { compute as federalOf } from "../../taxes/federal/compute.js";
import { buildInputs, compute as retirementOf, otherIncome } from "../../retirement/projection/compute.js";
import { ARCHETYPES } from "../../../qa/households/lib/catalog.mjs";
const T1 = "2026-11-16";
const usd = (n) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
// Ana and Bo's family (qa fixture) with three lines of dividends and interest: two paid every three months, one monthly
const earners = () => {
  const p = migrate(familyPlan(T1));
  p.income.push({ id: "d1", name: "Index fund dividends", type: "investment", personId: "", amount: 300, period: "quarterly", growth: 0, taxable: true },
    { id: "d2", name: "Savings interest", type: "investment", personId: "", amount: 150.5, period: "quarterly", growth: 0, taxable: true },
    { id: "d3", name: "Bond interest", type: "investment", personId: "", amount: 40, period: "monthly", growth: 0, taxable: true });
  return p;
};
// a live page: the same route object across redraws (as the shell after a save), the store's plan moving on each update
async function live(p0) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  let cur = migrate(structuredClone(p0)), updates = 0, root = null;
  const route = { rest: [], query: {} };
  const store = { get: () => cur, update: (fn) => { const d = structuredClone(cur); fn(d); cur = d; updates++; } };
  const draw = () => { root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => T1 }, plan: cur, route, store, modules: new Map() }); return api; };
  const partEl = () => root.querySelectorAll("details").find((x) => x.dataset.part === "asOne") ?? null;
  const api = { draw, textOf, partEl, get plan() { return cur; }, get updates() { return updates; }, get root() { return root; },
    btn: (words, inside = root) => inside.querySelectorAll("button").find((b) => textOf(b) === words) ?? null, text: () => textOf(root), partText: () => textOf(partEl()) };
  return draw();
}

test("one figure: a kind is one kind of income of one person; pay from a job (two employers), rent, a pension, Social Security and one-time amounts are never one figure", () => {
  const p = earners();
  p.household.people.push({ id: "p-me", name: "Me", role: "self" });
  assert.equal(OF.sectionKey({ type: "business", personId: "p-bo" }), "business|p-bo");
  assert.equal(OF.sectionKey({ type: "other" }), "other|");
  for (const x of [{ type: "salary", personId: "p-ana" }, { type: "rental" }, { type: "pension" }, { type: "social" }, { type: "bonus", period: "once" }, { type: "nonsense" }]) assert.equal(OF.sectionKey(x), null, JSON.stringify(x));
  assert.deepEqual(["bonus|p-bo", "business|p-me", "business|p-bo", "investment|", "support|", "other|", "bonus|", "other|gone"].map((k) => OF.sectionName(p, k)),
    ["Bo's bonus", "My business income", "Bo's business income", "Dividends and interest", "Support or gifts", "Other income", "Bonus", "Other income"]);
  assert.deepEqual([OF.sectionNoun(p, "business|p-bo"), OF.sectionNoun(p, "investment|")], ["Bo's business income", "your dividends and interest"]);
  // two jobs of one person are two employers: Paycheck takes Social Security from each on its own, so they never go together
  const two = migrate(familyPlan(T1)); two.income.push({ ...two.income.find((x) => x.id === "i-ana"), id: "i-ana-2", name: "Ana's weekend job", amount: 300 });
  assert.deepEqual(OF.sectionsOf(two), []);
});

test("one figure: the line kept is the one marked, else Get started's, else the biggest; a line paid otherwise stays on its own", () => {
  assert.deepEqual(OF.sectionsOf(migrate(familyPlan(T1))), [], "the family as it is: one line of each kind and person");
  const p = earners();
  const [s] = OF.sectionsOf(p);
  assert.deepEqual([s.name, s.count, Math.round(s.monthly * 100) / 100, Math.round(s.together * 100) / 100, s.keep, s.join, s.mode, s.changes], ["Dividends and interest", 3, 190.17, 150.17, "d1", ["d2"], "items", true]);
  assert.deepEqual(s.held, [{ id: "d3", name: "Bond interest", why: "it is paid on another schedule" }]);
  const g = earners(); g.income.push({ id: "setup-other", name: "Other money coming in", type: "investment", personId: "", amount: 1, period: "quarterly", growth: 0, taxable: true });
  assert.equal(OF.sectionsOf(g)[0].keep, "setup-other");
  const m = earners(); m.income.find((x) => x.id === "d2").oneFigure = true;
  assert.equal(OF.sectionsOf(m)[0].keep, "d2");
  const one = earners(); OF.asOne(one, "investment|");
  const after = OF.sectionsOf(one)[0];
  assert.deepEqual([after.mode, after.count, after.kept, after.changes], ["one", 2, 150.5 / 3 + 100, true]);
});

test("one figure: each reason a line stays on its own, one sentence each", () => {
  const base = () => { const p = emptyPlan(); p.household.people = [{ id: "p-ana", name: "Ana", role: "self" }];
    p.income.push({ id: "k", name: "Main job", type: "business", personId: "p-ana", amount: 4000, period: "monthly", growth: 0.03, taxable: true }, { id: "x", name: "Second job", type: "business", personId: "p-ana", amount: 500, period: "monthly", growth: 0.03, taxable: true }); return p; };
  const why = (edit) => { const p = base(); edit(p); return (OF.sectionsOf(p)[0]?.held ?? []).map(OF.holdWords); };
  const cases = [
    [(p) => { p.whatIfs = { salary: { x: { raise: 0.04 } } }; }, "Salary keeps its raises under it"],
    [(p) => { p.whatIfs = { sideIncome: { x: { months: {} } } }; }, "Side income keeps its months under it"],
    [(p) => { p.whatIfs = { business: { incomeId: "x" } }; }, "Small business works from it"],
    [(p) => { p.lifeEvents = [{ incomeId: "x" }]; }, "another page keeps something about it"],
    [(p) => { p.income[1].countOn = 300; }, "Side income plans with a careful figure for it"],
    [(p) => { p.income[1].period = "biweekly"; }, "it is paid on another schedule"],
    [(p) => { p.income[1].growth = 0; }, "it has a raise of its own"],
    [(p) => { p.income[1].endDate = "2027-06-30"; }, "it has dates of its own"],
    [(p) => { p.income[1].taxable = false; }, "income tax applies to it differently"],
    [(p) => { p.income[1].payday = "2026-11-06"; }, "it has its own payday"],
    [(p) => { p.income[1].typicalYear = true; }, "it is a typical year of uneven pay"],
    [(p) => { p.guesses = { "income[x].amount": { v: 500, k: "income.pay", u: "total", d: "2026-11-01" } }; }, "its amount is our guess for now: type the real one first"],
    [(p) => { p.income[0].id = "setup-other"; p.income[1].id = "setup-other-2"; }, "it is an answer in Get started"],
  ];
  for (const [edit, words] of cases) {
    const said = why(edit);
    assert.equal(said.length, 1, words);
    assert.match(said[0], new RegExp(`^(Second job|Main job) stays on its own: ${words}\\.$`), words);
  }
  // a raise from a later date: the pay that ends and the pay that carries it on (`continues`) are both part of it
  assert.deepEqual(why((p) => { p.income[1].continues = "k"; }), ["Main job stays on its own: it is part of a raise from a later date.", "Second job stays on its own: it is part of a raise from a later date."]);
  assert.deepEqual(why((p) => { p.income.push({ id: "k2", name: "Main job from January", type: "business", personId: "p-ana", amount: 4200, period: "monthly", growth: 0.03, continues: "x", startDate: "2027-01-01" }); }),
    ["Second job stays on its own: it is part of a raise from a later date.", "Main job from January stays on its own: it is part of a raise from a later date."]);
});

test("one figure: putting together adds the amounts at the same schedule; one line is only marked; Item by item takes the mark off", () => {
  const p = earners();
  const r = OF.asOne(p, "investment|");
  assert.deepEqual(r, { kept: "d1", gone: ["d2"], names: ["Index fund dividends", "Savings interest"], monthly: 450.5 * 4 / 12, name: "Dividends and interest" });
  const k = p.income.find((x) => x.id === "d1");
  assert.deepEqual({ name: k.name, amount: k.amount, period: k.period, oneFigure: k.oneFigure }, { name: "Dividends and interest", amount: 450.5, period: "quarterly", oneFigure: true });
  assert.equal(p.income.some((x) => x.id === "d2"), false);
  assert.equal(p.income.find((x) => x.id === "d3").oneFigure, undefined);
  const one = emptyPlan(); one.income.push({ id: "o", name: "Tutoring", type: "other", amount: 200, period: "monthly" });
  assert.deepEqual(OF.asOne(one, "other|"), { kept: "o", gone: [], names: ["Tutoring"], monthly: 200, name: "Tutoring" });
  assert.equal(one.income[0].oneFigure, true);
  assert.deepEqual(OF.itemize(one, "other|"), { kept: "o", name: "Tutoring", monthly: 200 });
  assert.equal("oneFigure" in one.income[0], false);
  assert.equal(OF.itemize(one, "other|"), null);
  assert.equal(OF.asOne(one, "business|"), null);
  // another line of the kind added beside the one figure takes the mark off
  OF.asOne(p, "investment|");
  const added = { id: "n", name: "Bank bonus", type: "investment", personId: "", amount: 25, period: "monthly" };
  p.income.push(added);
  assert.equal(OF.unmarkOnAdd(p, added), "Dividends and interest");
  assert.equal(p.income.some((x) => x.oneFigure), false);
  assert.equal(OF.unmarkOnAdd(p, { type: "rental" }), null);
});

test("one figure: the words, one sentence per case", () => {
  const p = earners();
  const [s] = OF.sectionsOf(p);
  assert.equal(OF.INTRO, "Keep a kind of income as one figure, typed and changed in one place, or list each source on its own. Either way what comes in counts the same, and so does every plan that reads it.");
  assert.equal(OF.PART_TITLE, "One figure or item by item");
  assert.equal(OF.statusWords([s]), "1 can be one figure");
  assert.equal(OF.statusWords([{ ...s, mode: "one" }]), "1 as one figure");
  assert.equal(OF.statusWords([{ ...s, changes: false }]), "");
  // what one figure would bring in when some lines stay on their own (review 2026-11-16 P1)
  assert.equal(OF.sectionLine(s, usd), "2 of 3 sources can be one figure, $150 a month");
  assert.equal(OF.sectionLine({ ...s, held: [], join: ["d2", "d3"] }, usd), "3 sources, $190 a month in all");
  assert.equal(OF.sectionLine({ ...s, join: [] }, usd), "3 sources, $190 a month in all", "nothing joins: the plain line");
  assert.equal(OF.sectionLine({ ...s, count: 1, held: [] }, usd), "1 source, $190 a month in all");
  assert.equal(OF.sectionLine({ ...s, mode: "one", held: [], kept: 150 }, usd), "One figure: $150 a month");
  assert.equal(OF.sectionLine({ ...s, mode: "one", kept: 150 }, usd), "One figure: $150 a month, with 1 more on its own");
  assert.equal(OF.sectionLine({ ...s, mode: "one", kept: 150, held: [1, 2] }, usd), "One figure: $150 a month, with 2 more on their own");
  assert.equal(OF.askWords(p, s, usd, 14440), "Replace Index fund dividends and Savings interest with one line, Dividends and interest: $150 a month? Bond interest stays on its own. What comes in stays $14,440 a month.");
  assert.equal(OF.askWords(p, { ...s, held: [...s.held, { name: "Gift" }] }, usd, 14440), "Replace Index fund dividends and Savings interest with one line, Dividends and interest: $150 a month? Bond interest and Gift stay on their own. What comes in stays $14,440 a month.");
  const all = earners(); all.income.find((x) => x.id === "d3").period = "quarterly";
  const [sa] = OF.sectionsOf(all);
  assert.equal(OF.askWords(all, sa, usd, 14440), "Replace Index fund dividends, Savings interest and Bond interest with one line, Dividends and interest: $164 a month? What comes in stays $14,440 a month.");
  assert.equal(OF.doneWords({ gone: ["d2"], names: ["Index fund dividends", "Savings interest"], monthly: 150.17, name: "Dividends and interest" }, s, usd, 14440), "Dividends and interest is one figure now: $150 a month, in place of 2 sources. Bond interest stays on its own. What comes in is still $14,440 a month.");
  assert.equal(OF.doneWords({ gone: ["d2"], names: ["Index fund dividends", "Savings interest"], monthly: 150.17, name: "Dividends and interest" }, { ...s, held: [] }, usd, 14440), "Dividends and interest is one figure now: $150 a month, in place of 2 sources. What comes in is still $14,440 a month.");
  assert.equal(OF.doneWords({ gone: [], names: ["Tutoring"], monthly: 200, name: "Tutoring" }, s, usd, 14440), "Tutoring is one figure now: $200 a month. What comes in is still $14,440 a month.");
  assert.equal(OF.itemizeWords({ name: "Bo's business income", monthly: 600 }, usd), "Bo's business income is item by item now. List each one: tap its line to rename it, then + Add another income.");
  assert.equal(OF.undoneWords({ gone: ["d2"], names: ["Index fund dividends", "Savings interest"] }, usd, 14440), "Put back: Index fund dividends and Savings interest. What comes in is still $14,440 a month.");
  assert.equal(OF.undoneWords({ name: "Bo's business income" }, usd, 14440), "Back as it was: Bo's business income. What comes in is still $14,440 a month.");
  assert.equal(OF.addWords("Bo's business income"), "Bo's business income is item by item again: each source is on the list.");
  assert.equal(OF.holdWords({ name: "Bond interest", why: "it is paid on another schedule" }), "Bond interest stays on its own: it is paid on another schedule.");
  assert.equal(OF.rowLine(p, p.income.find((x) => x.id === "d1")), null);
  OF.asOne(p, "investment|");
  assert.equal(OF.rowLine(p, p.income.find((x) => x.id === "d1")), "One figure for your dividends and interest");
});

test("one figure: what comes in, take-home pay, the federal estimate and the retirement plan are the same either way", () => {
  const close = (a, b, path = "") => {
    if (typeof a === "number" && typeof b === "number") return assert.ok(Math.abs(a - b) <= Math.max(0.005, 1e-9 * Math.abs(a)), `${path}: ${a} != ${b}`);
    if (a && b && typeof a === "object") { assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), path); for (const k of Object.keys(a)) close(a[k], b[k], `${path}.${k}`); return; }
    assert.deepEqual(a, b, path);
  };
  const figs = (p) => {
    const { items, active, count, warnings, byPerson, ...inc } = compute(p, { today: T1 }); void items; void active; void count; void warnings;
    const b = buildInputs(structuredClone(p), { today: T1 });
    const lines = {}; for (const x of b.inputs?.incomes ?? []) { const k = `${x.kind ?? x.type ?? ""}|${x.personIndex}|${x.startAge ?? ""}|${x.endAge ?? ""}`; lines[k] = (lines[k] ?? 0) + x.yearly; }
    const r = retirementOf(structuredClone(p), { today: T1 });
    const pc = paycheckOf(p, { today: T1 });
    return { inc, byPerson: byPerson.map(({ personId, yearly, monthly }) => ({ personId, yearly, monthly })), takeHome: takeHome(p, { today: T1 }).monthly,
      paycheck: (pc.people ?? []).map((x) => ({ id: x.id, gross: x.gross, net: x.net, yearly: x.yearly })), federal: federalOf(p, { today: T1 }).result,
      lines, answer: { verdict: r.verdict, affordable: r.affordable, coverage: r.coverage, atRetirement: r.atRetirement, rows: (r.rows ?? []).map((x) => x.total) } };
  };
  // dividends put together, and Bo's weekend photography split in two halves on the same schedule, then put back together
  const p = earners();
  const before = figs(p);
  const one = structuredClone(p); OF.asOne(one, "investment|");
  close(figs(one), before, "dividends as one figure");
  const split = structuredClone(p);
  const bo = split.income.find((x) => x.id === "i-side"); bo.amount = 350;
  split.income.push({ ...bo, id: "i-side-2", name: "Weddings", amount: 250 });
  close(figs(split), before, "split in two");
  const back = structuredClone(split); assert.ok(OF.asOne(back, "business|p-bo"));
  close(figs(back), before, "Bo's business income as one figure");
  assert.deepEqual(back.income.filter((x) => x.type === "business").map((x) => [x.id, x.name, x.amount, x.period]), [["i-side", "Bo's business income", 600, "monthly"]]);
  OF.itemize(back, "business|p-bo");
  close(figs(back), before, "item by item again");
});

test("one figure, the page: no part while nothing can change", async () => {
  for (const p of [migrate(familyPlan(T1)), renterDebtPlan(), emptyPlan()]) {
    const r = await live(p);
    assert.equal(r.partEl(), null);
    assert.doesNotMatch(r.text(), /One figure/);
  }
});

test("one figure, the page (S11): one quiet row, shut; One figure asks in place; Replace makes one line in one save; only that part changes, it stays open with the green line and Undo; Undo puts them back", async () => {
  const r = await live(earners());
  const el = r.partEl();
  assert.ok(el && !el.hasAttribute("open"), "drawn, and shut");
  assert.equal(r.root.querySelectorAll("details").filter((x) => x.dataset.part).length, 1, "the page's one part");
  assert.equal(r.textOf(el.querySelector(".fold-title")), "One figure or item by item");
  assert.equal(r.textOf(el.querySelector(".fold-status")), "1 can be one figure");
  const card = r.root.querySelectorAll("section").find((x) => r.textOf(x.querySelector("h2")) === "Income sources");
  assert.ok(card.querySelectorAll("details").includes(el), "in the Income sources card, under the list");
  assert.match(r.partText(), /Dividends and interest · 2 of 3 sources can be one figure, \$150 a month One figure Item by item Bond interest stays on its own: it is paid on another schedule\./);
  assert.equal(el.querySelectorAll("button").filter((b) => !b.classList.contains("chip") && !b.classList.contains("secondary")).length, 0, "no filled button inside");
  const pressed = () => ["One figure", "Item by item"].map((w) => r.btn(w, el).getAttribute("aria-pressed"));
  assert.deepEqual(pressed(), ["false", "true"]);
  r.btn("One figure", el).click();
  assert.match(r.partText(), /Replace Index fund dividends and Savings interest with one line, Dividends and interest: \$150 a month\? Bond interest stays on its own\. What comes in stays \$14,440 a month\./);
  assert.deepEqual(pressed(), ["true", "false"], "while it asks, the chip tapped is the one lit (review 2026-11-16 P2)");
  assert.equal(r.updates, 0);
  r.btn("Keep them as they are", el).click();
  assert.doesNotMatch(r.partText(), /Replace Index/);
  assert.deepEqual(pressed(), ["false", "true"]);
  r.btn("One figure", el).click();
  r.btn("Replace with one line", el).click();
  assert.equal(r.updates, 1);
  assert.deepEqual(r.plan.income.filter((x) => x.type === "investment").map((x) => [x.id, x.name, x.amount]), [["d1", "Dividends and interest", 450.5], ["d3", "Bond interest", 40]]);
  r.draw();
  const el2 = r.partEl();
  assert.ok(el2.hasAttribute("open"), "the part saved in stays open");
  assert.equal(r.root.querySelectorAll("details").filter((x) => x.dataset.part).length, 1, "no other part opened or shut");
  assert.match(r.partText(), /^One figure or item by item 1 as one figure › Dividends and interest is one figure now: \$150 a month, in place of 2 sources\. Bond interest stays on its own\. What comes in is still \$14,440 a month\. Undo/);
  assert.match(r.text(), /Dividends and interest \$451 every three months · Household One figure for your dividends and interest \$150 a month/);
  r.btn("Undo", el2).click();
  assert.equal(r.updates, 2);
  assert.deepEqual(r.plan.income, migrate(earners()).income, "exactly as before");
  r.draw();
  assert.match(r.partText(), /Put back: Index fund dividends and Savings interest\. What comes in is still \$14,440 a month\./);
});

test("one figure, the page: Item by item keeps the one line; adding another line of that kind lists it item by item again, said", async () => {
  const p = earners(); OF.asOne(p, "investment|");
  const r = await live(p);
  r.btn("Item by item", r.partEl()).click();
  assert.equal(r.updates, 1);
  assert.equal(r.plan.income.find((x) => x.id === "d1").oneFigure, undefined);
  r.draw();
  assert.match(r.partText(), /Dividends and interest is item by item now\. List each one: tap its line to rename it, then \+ Add another income\./);
  // an add of another dividends line while the kind is one figure
  const q = earners(); OF.asOne(q, "investment|");
  const a = await live(q);
  a.btn("+ Add another income").click();
  const form = a.root.querySelector("form");
  for (const [k, v] of Object.entries({ name: "Bank bonus", type: "investment", personId: "", amount: "25", period: "quarterly" })) form.querySelector(`[name="${k}"]`).value = v;
  form.reset = () => {}; form.dispatch("submit");
  assert.equal(a.updates, 1);
  assert.equal(a.plan.income.some((x) => x.oneFigure), false);
  a.draw();
  assert.match(a.text(), /Bank bonus added\. Dividends and interest is item by item again: each source is on the list\./);
});

test("one figure: a support or other line whose name the retirement plan reads stays on its own (child support, money from your own accounts, a pension's name)", () => {
  const p = emptyPlan();
  p.household.people = [{ id: "p-kim", name: "Kim", role: "self" }, { id: "p-zoe", name: "Zoe Lee", role: "dependent", birthDate: "2015-04-01" }];
  const line = (id, name, type = "support") => ({ id, name, type, personId: "p-kim", amount: 300, period: "monthly", growth: 0, taxable: false });
  p.income.push(line("a", "Help from Grandma"), line("b", "Child support for Zoe"), line("c", "Help for Zoe"), line("d", "Support for Zoe"), line("e", "IRA withdrawals"), line("f", "Pension top-up"), line("g", "Gifts from family"));
  const [s] = OF.sectionsOf(p);
  assert.deepEqual(s.held.map(OF.holdWords), [
    "Child support for Zoe stays on its own: it is child support: the retirement plan stops it when the child turns 18.",
    "Support for Zoe stays on its own: it is child support: the retirement plan stops it when the child turns 18.",
    "IRA withdrawals stays on its own: its name says it is money from your own accounts.",
    "Pension top-up stays on its own: its name tells the retirement plan what it is."]);
  assert.deepEqual([s.keep, ...s.join], ["a", "c", "g"], "lines whose names say nothing to the plan go together");
  assert.equal(OF.nameRead(p, { type: "other", name: "Kids' allowance support" }), "it is child support: the retirement plan stops it when the child turns 18");
  assert.equal(OF.nameRead(p, { type: "business", name: "Child support for Zoe" }), null, "only support and other lines are read by name");
  assert.equal(OF.nameRead(p, { type: "support", name: "Support or gifts" }), null, "the kind's own name says nothing to the plan");
  OF.asOne(p, s.key);
  assert.equal(p.income.find((x) => x.id === "a").name, "Kim's support or gifts");
  assert.equal(OF.nameRead(p, p.income.find((x) => x.id === "a")), null, "and the new name says nothing to the plan either");
});

test("one figure (review 2026-11-16 F1): a dependent's support lines put together keep their name out of the plan's child support rule, so the retirement plan reads them as before", () => {
  // the two-parent household (qa/households 04) with two support lines of Sofia, a dependent born in 2016
  const base = migrate(structuredClone(ARCHETYPES.find((a) => a.id === "04-two-parents").build()));
  const kid = base.household.people.find((x) => x.role === "dependent" && /^Sofia/.test(x.name));
  assert.ok(kid, "Sofia is on file");
  base.income.push({ id: "s1", name: "Board", type: "support", personId: kid.id, amount: 300, period: "monthly", growth: 0, taxable: false },
    { id: "s2", name: "Gift", type: "support", personId: kid.id, amount: 200, period: "monthly", growth: 0, taxable: false });
  const people = [...base.household.people.filter((x) => x.role !== "dependent").map((x) => ({ id: x.id, birthYear: Number(String(x.birthDate).slice(0, 4)), retireAge: 67 })),
    { id: kid.id, birthYear: Number(String(kid.birthDate).slice(0, 4)), retireAge: 67 }];
  const read = (p) => { const r = otherIncome(p, people, 2050, T1); const sum = (xs) => xs.reduce((t, x) => t + x.yearly, 0); return { counted: sum(r.counted), left: sum(r.left), until: r.counted.map((x) => x.endAge) }; };
  const before = read(base);
  assert.equal(before.counted, 6000);
  const one = structuredClone(base);
  const [s] = OF.sectionsOf(one).filter((x) => x.type === "support");
  assert.equal(s.name, "Sofia's gifts and help", "not \"Sofia's support or gifts\", which the plan reads as child support");
  OF.asOne(one, s.key);
  assert.deepEqual(one.income.filter((x) => x.type === "support").map((x) => [x.name, x.amount]), [["Sofia's gifts and help", 500]]);
  assert.equal(OF.nameRead(one, one.income.find((x) => x.id === "s1")), null);
  assert.deepEqual(read(one), { counted: 6000, left: before.left, until: [before.until[0]] });
  // the names tried, in order: the kind's with the person's, the gentler one, the kind's alone; never one the plan reads
  const p = emptyPlan(); p.household.people = [{ id: "a", name: "Ana", role: "self" }, { id: "k", name: "Kids", role: "dependent" }, { id: "n", name: "Pension", role: "self" }];
  // (a dependent named "Kids": "Kids's support or gifts" and "Kids's gifts and help" both say "kids" to the plan)
  assert.deepEqual(["support|a", "support|k", "other|k", "other|n", "support|"].map((k) => OF.sectionName(p, k)), ["Ana's support or gifts", "Support or gifts", "Kids's other income", "Other income", "Support or gifts"]);
  for (const k of ["support|a", "support|k", "other|k", "other|n", "support|"]) assert.equal(OF.nameRead(p, { type: k.split("|")[0], name: OF.sectionName(p, k) }), null, k);
  assert.equal(OF.sectionNoun(p, "support|k"), "your support or gifts");
});

test("one figure (review 2026-11-16 F3): a line whose id is missing or shared stays on its own, and putting together removes only the lines that join", () => {
  const p = emptyPlan();
  const line = (id, name, amount) => ({ ...(id === undefined ? {} : { id }), name, type: "investment", personId: "", amount, period: "monthly", growth: 0, taxable: true });
  p.income.push(line("x", "Div A", 100), line("x", "Div B", 50), line("y", "Div C", 20), line(undefined, "Div D", 5), line("z", "Div E", 1), { name: "Tutoring", type: "other", amount: 7, period: "monthly" });
  const before = compute(p, { today: T1 }).monthly;
  const [s] = OF.sectionsOf(p);
  assert.deepEqual([s.keep, s.join, s.held.map((h) => h.why)], ["y", ["z"], Array(3).fill("the app cannot tell it apart from another income on your list")]);
  OF.asOne(p, s.key);
  assert.deepEqual(p.income.map((x) => [x.id, x.name, x.amount]), [["x", "Div A", 100], ["x", "Div B", 50], ["y", "Dividends and interest", 21], [undefined, "Div D", 5], [undefined, "Tutoring", 7]]);
  assert.equal(compute(p, { today: T1 }).monthly, before);
  const q = emptyPlan(); q.income.push(line("x", "Div A", 100), line("x", "Div B", 50));
  assert.equal(OF.asOne(q, "investment|"), null);
  assert.equal(q.income.length, 2);
});
