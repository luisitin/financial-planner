import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const ids = (d) => d.alerts.map((a) => a.id);

test("empty plan: the four setup alerts, all informational, then the assumptions as a chore; nothing to fix", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.deepEqual(ids(d), ["no-people", "no-accounts", "no-income", "no-expenses", "assumptions-unreviewed"]);
  assert.deepEqual(d.counts, { bad: 0, warn: 0, info: 4 }, "a chore is not counted");
  assert.equal(d.total, 4); assert.equal(d.chores, 1);
  assert.equal(d.alerts.at(-1).chore, true);
  assert.equal(d.allClear, false);
});
test("a complete, healthy plan is all clear", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01" });
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 20000, asOf: "2026-09-01" });
  p.netWorthHistory.push({ date: "2026-09-01", assets: 20000, liabilities: 0, netWorth: 20000 });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 5000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  p.assumptions.reviewedAt = "2026-09-01";
  const d = compute(p, { today: TODAY });
  assert.deepEqual(ids(d), []);
  assert.equal(d.allClear, true);
});
test("problems are ranked worst first and link to their pages", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01" });
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 1000, asOf: "2026-01-01" }, { id: "c", name: "Visa", type: "credit", balance: 5000, asOf: "2026-09-01" });
  p.debts.push({ id: "d", accountId: "c", rate: 0.25, minPayment: 50 });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 3000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 3500, period: "monthly" });
  p.goals.push({ id: "g", name: "Trip", target: 2000, targetDate: "2026-01-01" });
  p.assumptions.reviewedAt = "2024-01-01";
  const d = compute(p, { today: TODAY });
  const levels = d.alerts.map((a) => a.level);
  assert.deepEqual([...levels].sort((x, y) => ({ bad: 0, warn: 1, info: 2 })[x] - ({ bad: 0, warn: 1, info: 2 })[y]), levels, "sorted worst first");
  assert.ok(ids(d).includes("overspend"));
  assert.ok(ids(d).includes("emergency-bad"));
  assert.ok(ids(d).includes("debt-never-c"));
  assert.ok(ids(d).includes("stale-balances"));
  assert.ok(ids(d).includes("history"));
  assert.ok(ids(d).includes("goal-late-g"));
  assert.ok(ids(d).includes("assumptions-stale"));
  assert.equal(d.counts.bad, 3);
  assert.deepEqual(d.alerts.find((a) => a.id === "overspend").go, ["cashflow", "expenses"]);
  assert.deepEqual(d.alerts.find((a) => a.id === "debt-never-c").go, ["balance", "liabilities"]);
});
test("expensive debt and a behind goal are check/to-do, not fix; missing debt detail is a to-do", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Visa", type: "credit", balance: 5000, asOf: TODAY }, { id: "l", name: "Car loan", type: "loan", balance: 9000, asOf: TODAY });
  p.debts.push({ id: "d", accountId: "c", rate: 0.25, minPayment: 300 });
  p.goals.push({ id: "g", name: "House", target: 50000, targetDate: "2030-01-01", monthly: 100 });
  const d = compute(p, { today: TODAY });
  assert.equal(d.alerts.find((a) => a.id === "debt-expensive-c").level, "warn");
  assert.equal(d.alerts.find((a) => a.id === "goal-behind-g").level, "info");
  assert.equal(d.alerts.find((a) => a.id === "debt-details").level, "info");
  assert.equal(d.counts.bad, 0);
});
test("without today, date checks are skipped", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 100 });
  const d = compute(p);
  assert.ok(!ids(d).includes("stale-balances") && !ids(d).includes("history"));
});

test("overspending is judged after tax and saving, like the Dashboard: pay above spending can still be short", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "me", name: "Ana", birthDate: "1990-01-01", role: "self" });
  p.household.filingStatus = "single";
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 6000, period: "monthly", personId: "me" });
  p.expenses.push({ id: "e", name: "Everything", category: "housing", amount: 5500, period: "monthly" });
  const d = compute(p, { today: TODAY });
  const o = d.alerts.find((a) => a.id === "overspend");
  assert.ok(o, "$6,000 before tax, $5,500 spent: short once tax is taken out");
  assert.match(o.detail, /after tax and saving/);
  const q = emptyPlan();
  q.household.people.push({ id: "me", name: "Ana", birthDate: "1990-01-01", role: "self" });
  q.household.filingStatus = "single";
  q.income.push({ id: "i", name: "Pay", type: "salary", amount: 6000, period: "monthly", personId: "me" });
  q.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  assert.ok(!compute(q, { today: TODAY }).alerts.some((a) => a.id === "overspend"), "room left after tax: no alert");
});
test("old balances open Update my balances", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 1000, asOf: "2026-01-01" });
  assert.deepEqual(compute(p, { today: TODAY }).alerts.find((a) => a.id === "stale-balances").go, ["balance", "update"]);
});

test("chores (assumptions, today's totals) come last and leave the count and all-clear alone", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01" });
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 20000, asOf: "2026-09-01" });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 5000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  const d = compute(p, { today: TODAY });
  assert.deepEqual(ids(d), ["assumptions-unreviewed", "history"]);
  assert.ok(d.alerts.every((a) => a.chore));
  assert.equal(d.total, 0); assert.equal(d.chores, 2); assert.equal(d.allClear, true, "nothing needs a look; two chores wait");
});
test("two or more goals behind are one alert with the extra they need in all; a goal with nothing going in is named first (F-015)", () => {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01" });
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 20000, asOf: "2026-09-01" });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 9000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  p.goals.push({ id: "t", name: "Trip", target: 6000, targetDate: "2027-09-15", monthly: 100 }, { id: "c", name: "Car", target: 12000, targetDate: "2028-09-15" });
  const d = compute(p, { today: TODAY });
  const g = d.alerts.find((a) => a.id === "goals-behind");
  assert.ok(g, "one goals alert");
  assert.ok(!ids(d).some((x) => x.startsWith("goal-behind-")), "not one per goal");
  assert.equal(g.title, "2 goals are behind");
  assert.ok(g.detail.startsWith("Car and Trip need about"), g.detail);
  assert.ok(g.detail.includes("nothing is going in to Car yet"));
  assert.ok(/You have about \$[\d,]+ left over each month\./.test(g.detail), g.detail);
  p.goals.pop();
  assert.ok(ids(compute(p, { today: TODAY })).includes("goal-behind-t"), "a single goal keeps its own alert");
});
test("goalsBehind: the monthly need counts goals behind their pace, never a goal past its date; idle goals are named; no duplicate for a late goal", async () => {
  const { goalsBehind } = await import("./compute.js");
  const { compute: goals } = await import("../../goals/goals/compute.js");
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01" });
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 20000, asOf: "2026-09-01" });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 9000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  p.goals.push({ id: "t", name: "Trip", target: 6000, targetDate: "2027-09-15" }, { id: "c", name: "Car", target: 12000, targetDate: "2028-09-15" },
    { id: "s2", name: "Sofa", target: 3000, targetDate: "2026-09-01", saved: 500, monthly: 100 });
  const gl = goals(p, { today: TODAY });
  const gb = goalsBehind(gl);
  assert.deepEqual(gb.behind.map((g) => g.id).sort(), ["c", "t"]);
  assert.deepEqual(gb.pastDue.map((g) => g.id), ["s2"]);
  const want = gl.goals.filter((g) => g.status === "behind").reduce((t, g) => t + g.neededMonthly - (g.monthly || 0), 0);
  assert.ok(Math.abs(gb.need - want) < 0.01, "the Sofa's $2,500 to go is not added as a month");
  const d = compute(p, { today: TODAY });
  const g = d.alerts.find((a) => a.id === "goals-behind");
  assert.ok(g.detail.includes("nothing is going in to either of them yet"), g.detail);
  assert.ok(ids(d).includes("goal-late-s2"));
  assert.ok(!d.alerts.some((a) => a.id.startsWith("goals-") && a.id !== "goals-behind" && /Sofa/.test(a.detail)), "the late goal is said once");
});

test("a likely bill in April: paychecks short of the year's tax by $1,000 or more is one thing to check", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { taxAnswer } = await import("../../taxes/withholding/compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  const a = taxAnswer(p, { today: T });
  const al = compute(p, { today: T }).alerts.find((x) => x.id === "tax-bill");
  assert.ok(a.balance >= 1000, "the two-earner family is under-withheld");
  assert.equal(al.level, "warn"); assert.deepEqual(al.go, ["taxes", "withholding"]);
  assert.match(al.title, /^About \$[\d,]+ of tax to pay in April$/);
  // enough withheld: no alert
  p.taxes.withholding = { self: { perPaycheck: 600, period: "biweekly" }, partner: { perPaycheck: 700, period: "monthly" } };
  assert.equal(compute(p, { today: T }).alerts.find((x) => x.id === "tax-bill"), undefined);
});

test("no paycheck takes tax out: a past-due estimated payment is one alert, pointing to Estimated payments", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-11-02");
  p.income = p.income.filter((x) => x.type !== "salary" && x.type !== "bonus");
  p.income.push({ id: "pen", name: "Pension", type: "pension", personId: "p-ana", amount: 5000, period: "monthly", taxable: true, startDate: "", endDate: "" });
  const a = compute(p, { today: "2026-11-02" }).alerts;
  const e = a.find((x) => x.id === "estimates-behind");
  assert.ok(e, "the alert is there");
  // nothing typed on Estimated payments yet: it asks (review 2026-11-02); typed, it says what is past due
  assert.match(e.title, /^Estimated tax: type what you have paid this year$/);
  assert.deepEqual(e.go, ["taxes", "estimated"]);
  p.taxes.estimated = { ...(p.taxes.estimated ?? {}), typedAt: "2026-10-01" };
  assert.match(compute(p, { today: "2026-11-02" }).alerts.find((x) => x.id === "estimates-behind").title, /^About \$[\d,]+ of estimated tax is past due$/);
  assert.ok(!a.some((x) => x.id === "tax-bill"), "no April-bill alert without withholding");
  p.taxes.estimated = { ...(p.taxes.estimated ?? {}), paid: [5000, 0, 0, 0] };
  assert.ok(!compute(p, { today: "2026-11-02" }).alerts.some((x) => x.id === "estimates-behind"), "nothing once the year is paid ahead");
});

test("protection: no life cover on an earner others depend on, and no guardian for a child, each one item", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-11-02");
  const a = compute(p, { today: "2026-11-02" }).alerts;
  const life = a.find((x) => x.id === "life-cover-p-ana");
  assert.equal(life.level, "warn"); assert.equal(life.title, "No life insurance on Ana: Bo and Cy would be about $235,000 short");
  assert.deepEqual(life.go, ["insurance", "life-needs"]);
  assert.ok(!a.some((x) => x.id === "life-cover-p-bo"), "the plan holds if Bo died");
  const g = a.find((x) => x.id === "guardian");
  assert.equal(g.level, "info"); assert.equal(g.title, "No one is named to raise Cy if you both died"); assert.deepEqual(g.go, ["estate", "documents"]);
  p.insurance = { ...(p.insurance ?? {}), policies: [{ id: "t1", kind: "term", personId: "p-ana", benefit: 100000, premium: 20, period: "monthly" }] };
  assert.equal(compute(p, { today: "2026-11-02" }).alerts.find((x) => x.id === "life-cover-p-ana").title, "Ana's life cover is about $135,000 short");
  p.insurance.policies[0].benefit = 300000;
  assert.ok(!compute(p, { today: "2026-11-02" }).alerts.some((x) => x.id.startsWith("life-cover")), "covered: nothing");
});

// ---- a goal whose turn comes later is not behind (round 4, 2026-11-02)
import { goalsBehind } from "./compute.js";
test("goalsBehind: a goal with nothing going in waits its turn when Next best action funds goals in a later month", () => {
  const gl = { goals: [
    { id: "h", name: "House", status: "behind", monthly: 0, neededMonthly: 859, targetDate: "2031-06-01" },
    { id: "c", name: "Car", status: "behind", monthly: 100, neededMonthly: 300 },
    { id: "t", name: "Trip", status: "on track", monthly: 50, neededMonthly: 50 },
  ] };
  const later = { ready: true, steps: [{ id: "goals", startDate: "2028-06-02" }] };
  const g = goalsBehind(gl, { nba: later, today: "2026-11-02" });
  assert.deepEqual(g.queued.map((x) => x.id), ["h"]);
  assert.deepEqual(g.behind.map((x) => x.id), ["c"]);
  assert.equal(g.need, 200); assert.equal(g.turn, "2028-06-02");
  const now = goalsBehind(gl, { nba: { ready: true, steps: [{ id: "goals", startDate: "2026-11-02" }] }, today: "2026-11-02" });
  assert.deepEqual(now.queued, []); assert.deepEqual(now.behind.map((x) => x.id), ["h", "c"]);
  assert.deepEqual(goalsBehind(gl).queued, [], "without Next best action nothing waits");
  // review 2026-11-02: a goal due before (or on) its turn cannot wait for it, and the emergency fund never waits for the goals step
  const soon = { goals: [
    { id: "gift", name: "Holiday gifts", status: "behind", monthly: 0, neededMonthly: 750, targetDate: "2026-12-20" },
    { id: "ef", name: "Emergency fund", icon: "🛟", isEmergencyFund: true, status: "behind", monthly: 0, neededMonthly: 400, targetDate: "2029-06-30" },
    { id: "h", name: "House", status: "behind", monthly: 0, neededMonthly: 859, targetDate: "2031-06-01" },
  ] };
  const s2 = goalsBehind(soon, { nba: later, today: "2026-11-02" });
  assert.deepEqual(s2.queued.map((x) => x.id), ["h"]);
  assert.deepEqual(s2.behind.map((x) => x.id).sort(), ["ef", "gift"]);
  assert.equal(s2.need, 1150);
});

test("this year's required withdrawal is on Needs attention from October until it is marked taken", () => {
  const p = emptyPlan();
  p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }];
  p.accounts = [{ id: "ira", name: "Ruth's IRA", type: "ira", balance: 310000, ownerId: "r", asOf: "2026-09-15", history: [] }];
  const ids = (today) => compute(p, { today }).alerts.filter((a) => a.id.startsWith("rmd-"));
  assert.equal(ids("2026-09-20").length, 0, "not before October");
  const nov = ids("2026-11-02"); assert.equal(nov.length, 1);
  assert.match(nov[0].title, /Ruth's required withdrawal: at least \$13,080 by December 31/); assert.equal(nov[0].level, "warn");
  assert.equal(ids("2026-12-05")[0].level, "bad", "in December it is a fix");
  p.retirement.rmdTaken = { 2026: { r: "2026-11-02" } };
  assert.equal(ids("2026-11-03").length, 0, "marked taken");
});

test("goalsBehind: a goal waits its turn only while it can still be reached from then (review 2026-11-02)", () => {
  // the goals step starts in November 2027 with up to $2,000 a month reaching it
  const nba = { ready: true, steps: [{ id: "goals", startDate: "2027-11-02", roomYearly: 2400 * 12, capacity: 2000 }] };
  const trip = (targetDate) => ({ goals: [{ id: "trip", name: "Japan trip", status: "behind", monthly: 0, neededMonthly: 600, targetDate, targetThen: 8000, funded: 1200, rate: 0 }] });
  // due a month after its turn: $6,800 in one month is more than reaches the step, so it is behind now
  assert.deepEqual(goalsBehind(trip("2027-12-15"), { nba, today: "2026-11-02" }).queued, []);
  assert.deepEqual(goalsBehind(trip("2027-12-15"), { nba, today: "2026-11-02" }).behind.map((g) => g.id), ["trip"]);
  // due 19 months after it: about $358 a month from then, which fits
  assert.deepEqual(goalsBehind(trip("2029-06-15"), { nba, today: "2026-11-02" }).queued.map((g) => g.id), ["trip"]);
  // two waiting goals share the step: the sooner one first, the later one only if both fit ($6,800/19 + $60,000/55 > $1,000)
  const two = { goals: [trip("2029-06-15").goals[0], { id: "col", name: "College", status: "behind", monthly: 0, neededMonthly: 400, targetDate: "2032-06-15", targetThen: 60000, funded: 0, rate: 0 }] };
  const small = { ready: true, steps: [{ id: "goals", startDate: "2027-11-02", capacity: 1000 }] };
  const g = goalsBehind(two, { nba: small, today: "2026-11-02" });
  assert.deepEqual(g.queued.map((x) => x.id), ["trip"]); assert.deepEqual(g.behind.map((x) => x.id), ["col"]);
  assert.deepEqual(goalsBehind(two, { nba, today: "2026-11-02" }).queued.map((x) => x.id), ["trip", "col"]);
});

test("goalsBehind: a waiting goal fits only in what the behind goals already getting money leave of the step (review 2026-11-02, round 5)", () => {
  // the goals step starts in December 2027 with $1,831 a month reaching it
  const nba = { ready: true, steps: [{ id: "goals", startDate: "2027-12-02", capacity: 1831 }] };
  const wedding = { id: "wed", name: "Wedding", status: "behind", monthly: 0, neededMonthly: 943, targetDate: "2029-12-01", targetThen: 36000, funded: 0, rate: 0 };
  const car = { id: "car", name: "Car", status: "behind", monthly: 300, neededMonthly: 836, targetDate: "2029-03-01" };
  const col = { id: "col", name: "College", status: "behind", monthly: 250, neededMonthly: 585, targetDate: "2038-08-15" };
  const ef = { id: "ef", name: "Emergency fund", icon: "🛟", isEmergencyFund: true, status: "behind", monthly: 400, neededMonthly: 1189, targetDate: "2029-06-30" };
  const soon = { id: "gift", name: "Gifts", status: "behind", monthly: 100, neededMonthly: 900, targetDate: "2027-06-01" };
  // alone, the wedding's $1,500 a month from the turn ($36,000 over 24 months) fits in $1,831: it waits its turn
  assert.deepEqual(goalsBehind({ goals: [wedding] }, { nba, today: "2026-11-02" }).queued.map((g) => g.id), ["wed"]);
  // the car ($536 more) and college ($335 more) draw on the same step first: $1,831 - $871 = $960 is short of $1,500
  const g = goalsBehind({ goals: [ef, car, col, wedding] }, { nba, today: "2026-11-02" });
  assert.deepEqual(g.queued, []); assert.ok(g.behind.some((x) => x.id === "wed"));
  // the emergency fund (filled in its own steps) and a goal due before the turn do not count against the step
  const h = goalsBehind({ goals: [ef, soon, wedding] }, { nba, today: "2026-11-02" });
  assert.deepEqual(h.queued.map((x) => x.id), ["wed"]);
});

test("goalsBehind (round 5, second pass): the other goals' extra is measured from the turn; a waiting goal that does not fit keeps the room", () => {
  // the goals step starts in December 2027 (13 months away) with $800 a month reaching it
  const T = "2026-11-02";
  const nba = { ready: true, steps: [{ id: "goals", startDate: "2027-12-02", capacity: 800 }] };
  const goal = (id, extra) => ({ id, name: id, status: "behind", rate: 0, funded: 0, targetDate: "2029-12-02", ...extra });
  // the car gets $100 a month toward $12,000: $1,300 by the turn, so from then (24 months) $445.83 a month, $345.83 more
  // (today's measure, $12,000 / 37 months less $100, is only $224.32 more)
  const car = goal("car", { monthly: 100, targetThen: 12000, neededMonthly: 12000 / 37 });
  // the wedding waits: $12,000 over the 24 months from the turn is $500 a month; $500 + $345.83 is more than $800
  const wedding = goal("wedding", { monthly: 0, targetThen: 12000, neededMonthly: 12000 / 37 });
  const g = goalsBehind({ goals: [car, wedding] }, { nba, today: T });
  assert.deepEqual(g.queued, [], "before: $500 + $224.32 fit in $800, so it read 'starts later'");
  assert.deepEqual(g.behind.map((x) => x.id).sort(), ["car", "wedding"]);
  // with $900 reaching the step it fits, and waits its turn
  const roomy = { ready: true, steps: [{ id: "goals", startDate: "2027-12-02", capacity: 900 }] };
  assert.deepEqual(goalsBehind({ goals: [car, wedding] }, { nba: roomy, today: T }).queued.map((x) => x.id), ["wedding"]);
  // a $36,000 wedding ($1,500 a month from the turn) does not fit; it is still short at its date and holds the step, so a
  // $6,000 boat due in 2035 is not said to start on that money (before: the boat read "saving for it starts in December 2027")
  const big = goal("wedding", { monthly: 0, targetThen: 36000, neededMonthly: 36000 / 37 });
  const boat = goal("boat", { monthly: 0, targetThen: 6000, targetDate: "2035-06-02", neededMonthly: 6000 / 103 });
  const b = goalsBehind({ goals: [big, boat] }, { nba, today: T });
  assert.deepEqual(b.queued, []); assert.deepEqual(b.behind.map((x) => x.id).sort(), ["boat", "wedding"]);
  assert.deepEqual(goalsBehind({ goals: [boat] }, { nba, today: T }).queued.map((x) => x.id), ["boat"], "alone, the boat waits its turn");
  // a waiting goal due within the turn's first month is behind now and leaves the step to the others
  const trip = goal("trip", { monthly: 0, targetThen: 5000, targetDate: "2027-12-20", neededMonthly: 400 });
  assert.deepEqual(goalsBehind({ goals: [trip, boat] }, { nba, today: T }).queued.map((x) => x.id), ["boat"]);
});

test("goalsBehind (round 5, third pass): on the family plan a $12,000 wedding can be reached, so it waits; a $36,000 one cannot", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: nbaOf } = await import("../next-best-action/compute.js");
  const { compute: goalsOf } = await import("../../goals/goals/compute.js");
  const T = "2026-11-02";
  const run = (...extra) => { const p = familyPlan(T); p.goals = p.goals.filter((x) => x.id !== "g-trip"); p.goals.push(...extra); const nba = nbaOf(p, { today: T }); return goalsBehind(goalsOf(p, { today: T }), { nba, today: T }); };
  const g = (id, target, targetDate, more = {}) => ({ id, name: id, icon: "", target, targetDate, priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false, ...more });
  // second pass said "behind": it took the car's extra as lasting until December 2029, but the car is due in March 2029.
  // Month by month from December 2027 the wedding gets about $405 for 15 months, then about $1,449 for 9: about $19,100
  const w = run(g("g-wed", 12000, "2029-12-01"));
  assert.deepEqual(w.queued.map((x) => x.id), ["g-wed"]); assert.ok(!w.behind.some((x) => x.id === "g-wed"));
  assert.deepEqual(run(g("g-wed", 20000, "2029-12-01")).queued, [], "about $19,100 is the most it can be");
  // a $36,000 wedding is behind (round 5's first finding stays fixed), and it holds the step: the 2035 boat is not said to
  // start on that money; the boat alone waits
  const big = run(g("g-wed", 36000, "2029-12-01"), g("g-boat", 6000, "2035-06-01"));
  assert.deepEqual(big.queued.map((x) => x.id), []); assert.ok(big.behind.some((x) => x.id === "g-wed")); assert.ok(big.behind.some((x) => x.id === "g-boat"));
  assert.deepEqual(run(g("g-boat", 6000, "2035-06-01")).queued.map((x) => x.id), ["g-boat"]);
  // a $3,000 holiday getting $100 a month, due 3 days after the turn (January 2, 2028): it draws nothing from the step, so
  // the boat still waits (second pass: its catch-up came out infinite and every later goal read behind)
  const hol = run(g("g-boat", 6000, "2035-06-01"), g("g-hol", 3000, "2028-01-05", { monthly: 100 }));
  assert.equal(hol.turn, "2028-01-02"); assert.deepEqual(hol.queued.map((x) => x.id), ["g-boat"]); assert.ok(hol.behind.some((x) => x.id === "g-hol"));
});

test("goalsBehind (round 5, third pass): month by month from the turn, a goal's catch-up lasts only until its own date", () => {
  const T = "2026-11-02";
  // the goals step starts in January 2027 with $2,328 a month reaching it (the retired household H-0777, in round figures)
  const nba = { ready: true, steps: [{ id: "goals", startDate: "2027-01-02", capacity: 2328 }] };
  // the trip gets $500 a month toward $12,000 ($3,000 put by): $4,000 at the turn, so $2,000 a month for the 4 months to
  // its date, $1,500 more; Share B, $15,000 to go in 11 months, gets $828 for 4 months, then $2,328: $19,608
  const trip = { id: "trip", name: "Trip", status: "behind", monthly: 500, targetThen: 12000, funded: 3000, rate: 0, targetDate: "2027-06-01", neededMonthly: 1489 };
  const share = { id: "share", name: "Share B", status: "behind", monthly: 0, targetThen: 30000, funded: 15000, rate: 0, targetDate: "2028-01-01", neededMonthly: 1117 };
  const g = goalsBehind({ goals: [trip, share] }, { nba, today: T });
  assert.deepEqual(g.queued.map((x) => x.id), ["share"], "second pass: $1,500 + $1,364 a month is more than $2,328, so behind");
  assert.deepEqual(g.behind.map((x) => x.id), ["trip"]); assert.equal(g.need, 989);
  // at $1,700 a month: $200 x 4 + $1,700 x 7 = $12,700, short of $15,000: behind
  assert.deepEqual(goalsBehind({ goals: [trip, share] }, { nba: { ready: true, steps: [{ id: "goals", startDate: "2027-01-02", capacity: 1700 }] }, today: T }).queued, []);
  // two waiting goals: the sooner one takes what is left each month until it is reached, the later one has the rest
  const a = { ...share, id: "a", funded: 22000 }, b = { ...share, id: "b", funded: 25000, targetDate: "2028-06-01" };
  assert.deepEqual(goalsBehind({ goals: [trip, a, b] }, { nba, today: T }).queued.map((x) => x.id), ["a", "b"]);
  // a goal getting money that is due within the turn's first month draws nothing (second pass: its need was infinite)
  const soon = { ...trip, id: "soon", targetDate: "2027-01-20" };
  assert.deepEqual(goalsBehind({ goals: [soon, share] }, { nba, today: T }).queued.map((x) => x.id), ["share"]);
});

test("goalsBehind (round 5, third pass): the two qa households whose shared-account goal can wait", async () => {
  const fs = await import("node:fs");
  const { compute: nbaOf } = await import("../next-best-action/compute.js");
  const { compute: goalsOf } = await import("../../goals/goals/compute.js");
  const T = "2026-11-02";
  const run = (file) => {
    const plan = JSON.parse(fs.readFileSync(new URL(`../../../qa/households/${file}`, import.meta.url), "utf8").match(/## Plan JSON\s*```json\s*([\s\S]*?)```/)[1]);
    return goalsBehind(goalsOf(plan, { today: T }), { nba: nbaOf(plan, { today: T }), today: T });
  };
  // retired: the trip's catch-up ends in June 2027, so Share B ($15,000 to go by January 2028) can wait (second pass: behind)
  const h777 = run("08-retired/goals/H-0777-two-goals-one-account.md");
  assert.deepEqual(h777.queued.map((x) => x.id), ["g-share2"]); assert.deepEqual(h777.behind.map((x) => x.id), ["g-trip"]);
  // a couple: the baby fund's catch-up ends in September 2027, so Share A can wait; Share B ($30,000 from nothing) cannot
  const h177 = run("02-couple-no-kids/goals/H-0177-two-goals-one-account.md");
  assert.deepEqual(h177.queued.map((x) => x.id), ["g-share1"]); assert.ok(h177.behind.some((x) => x.id === "g-share2"));
});

test("goalsBehind follows Next best action's goals step: its capacity is the spare money that reaches it once it starts", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: nbaOf } = await import("../next-best-action/compute.js");
  const { compute: goalsOf } = await import("../../goals/goals/compute.js");
  const T = "2026-11-02";
  const plan = (due) => { const p = familyPlan(T); p.goals.find((x) => x.id === "g-col").monthly = 0; p.goals.find((x) => x.id === "g-trip").targetDate = due; return p; };
  const run = (p) => { const nba = nbaOf(p, { today: T }); return { nba, gb: goalsBehind(goalsOf(p, { today: T }), { nba, today: T }) }; };
  const near = run(plan("2027-12-01"));
  const step = near.nba.steps.find((s) => s.id === "goals");
  assert.ok(step.capacity >= step.monthly && step.capacity > 0, "capacity is at least what the step gets in its first month");
  assert.ok(!near.gb.queued.some((g) => g.id === "g-trip"), "a trip due a month after the turn is behind");
  assert.ok(near.gb.queued.some((g) => g.id === "g-col"), "college due years later still waits its turn");
  assert.ok(run(plan("2029-06-01")).gb.queued.some((g) => g.id === "g-trip"), "the same trip due later waits its turn");
});

test("estimated tax: nothing ever typed asks what was paid instead of saying '$0 is paid so far' (review 2026-11-02)", async () => {
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const { compute: nbaOf } = await import("../next-best-action/compute.js");
  const T = "2026-11-02";
  const p = emptyPlan();
  p.household = { ...(p.household ?? {}), people: [{ id: "dee", name: "Dee", role: "self", birthDate: "1990-04-01" }], state: "TX", filingStatus: "single" };
  p.income = [{ id: "setup-pay-dee", name: "Dee's business", type: "business", personId: "dee", amount: 78000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true }];
  p.expenses = [{ id: "e1", name: "Rent", category: "housing", amount: 1800, period: "monthly", essential: true }];
  p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 30000 }];
  const a = compute(p, { today: T }).alerts.find((x) => x.id === "estimates-behind");
  assert.match(a.title, /type what you have paid/); assert.match(a.detail, /none are typed yet\. If none were made, about \$[\d,]+ was due by now/);
  assert.doesNotMatch(a.detail, /\$0 is paid so far/);
  const step = nbaOf(p, { today: T }).steps.find((s) => s.id === "tax");
  assert.equal(step.title, "Type or pay this year's estimated tax"); assert.match(step.detail, /^No estimated payments are typed for 2026 yet\. If none were made/);
  // once typed (even all zero), the plain past-due wording returns
  p.taxes.estimated = { paid: [0, 0, 0, 0], typedAt: "2026-10-01" };
  assert.match(compute(p, { today: T }).alerts.find((x) => x.id === "estimates-behind").title, /^About \$[\d,]+ of estimated tax is past due$/);
  assert.equal(nbaOf(p, { today: T }).steps.find((s) => s.id === "tax").title, "Pay the estimated tax that is past due");
});

test("short only in a lean month is amber, not red (review 2026-11-02, round 5); short even in a full month stays red", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: next } = await import("../next-best-action/compute.js");
  const D = "2026-11-02";
  // the family's $600 of photography counted at $0; spending set so a full month leaves `left`
  const base = () => { const p = familyPlan(D); p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const at = (left) => { const p = base(); const s = next(p, { today: D }).spare; p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s.full - left, period: "monthly", essential: false }); return p; };
  const lean = compute(at(297), { today: D }), o = lean.alerts.find((a) => a.id === "overspend");
  assert.equal(o.level, "warn"); assert.equal(o.title, "Lean months run short");
  // the full-month figure as every page says it: to the nearest $10
  assert.match(o.detail, /counting uneven pay at what you can count on \(Side income\); a month that brings the Income page's amount leaves about \$300\. Good months make up for lean ones/);
  assert.ok(lean.counts.warn >= 1);
  const short = compute(at(-120), { today: D }).alerts.find((a) => a.id === "overspend");
  assert.equal(short.level, "bad"); assert.equal(short.title, "You spend more than comes in");
  assert.match(short.detail, /a month that brings the Income page's amount is still about \$120 short\. Check the amounts, then find what to cut\.$/);
  // nothing held back: red, the plain sentence
  const p = familyPlan(D); const s0 = next(p, { today: D }).spare;
  p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s0.monthly + 100, period: "monthly", essential: false });
  const plain = compute(p, { today: D }).alerts.find((a) => a.id === "overspend");
  assert.equal(plain.level, "bad"); assert.doesNotMatch(plain.detail, /uneven pay/);
});

test("a full month within $5 of $0 'only just about breaks even' (no 'about $0'), and stays red (review 2026-11-02, round 5)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: next } = await import("../next-best-action/compute.js");
  const D = "2026-11-02";
  const base = () => { const p = familyPlan(D); p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const at = (left) => { const p = base(); const s = next(p, { today: D }).spare; p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s.full - left, period: "monthly", essential: false }); return p; };
  for (const left of [3, -2]) {
    const o = compute(at(left), { today: D }).alerts.find((a) => a.id === "overspend");
    assert.equal(o.level, "bad"); assert.equal(o.title, "You spend more than comes in");
    assert.match(o.detail, /a month that brings the Income page's amount only just about breaks even\. Check the amounts, then find what to cut\.$/);
    assert.doesNotMatch(o.detail, /about \$0\b/);
  }
});
