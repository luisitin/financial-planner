import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const ids = (d) => d.alerts.map((a) => a.id);

test("empty plan: the four setup alerts, all informational; nothing to fix", () => {
  const p = emptyPlan(); p.meta.createdAt = `${TODAY}T09:00:00.000Z`;
  const d = compute(p, { today: TODAY });
  // (no "look over the assumptions" on a new plan: the checklist's "Look over our guesses" is that look; C5 hand-off N3)
  assert.deepEqual(ids(d), ["no-people", "no-accounts", "no-income", "no-expenses"]);
  assert.deepEqual(d.counts, { bad: 0, warn: 0, info: 4 });
  assert.equal(d.total, 4); assert.equal(d.chores, 0);
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
  assert.ok(ids(d).includes("assumptions-yearly"));
  assert.equal(d.alerts.find((a) => a.id === "assumptions-yearly").chore, true, "the yearly look is housekeeping");
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
  p.meta.createdAt = "2025-06-01T09:00:00.000Z";   // over a year old, the assumptions never looked at: their yearly look is due
  const d = compute(p, { today: TODAY });
  assert.deepEqual(ids(d), ["assumptions-yearly", "history"]);
  assert.ok(d.alerts.every((a) => a.chore));
  assert.equal(d.total, 0); assert.equal(d.chores, 2); assert.equal(d.allClear, true, "nothing needs a look; two chores wait");
});

// ---- C5 hand-off N3: "Look over the assumptions" sat beside the checklist's "Look over our guesses" (two looks at different
// things). The assumptions are planning choices: a chore once a year, never a to-do or a "check", and none on a new plan
test("N3: the assumptions are a yearly chore: a year after the last look, or a year after the plan was made; never counted", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 20000, asOf: TODAY });
  const ask = (q) => compute(q, { today: TODAY }).alerts.find((a) => /^assumptions/.test(a.id)) ?? null;
  p.meta.createdAt = "2026-08-01T09:00:00.000Z";
  assert.equal(ask(p), null, "a plan made this summer and never looked at: nothing yet");
  p.meta.createdAt = "2025-08-01T09:00:00.000Z";
  const due = ask(p);
  assert.deepEqual([due.id, due.level, due.chore, due.title, due.act], ["assumptions-yearly", "info", true, "Once a year: look over the assumptions", "Look them over"]);
  assert.match(due.detail, /Your plan is over a year old/);
  p.assumptions.reviewedAt = "2026-03-01";
  assert.equal(ask(p), null, "looked at this year");
  p.assumptions.reviewedAt = "2025-09-01";
  assert.match(ask(p).detail, /You last looked on .*2025/);
  const d = compute(p, { today: TODAY });
  assert.equal(d.counts.warn + d.counts.bad, d.alerts.filter((a) => !a.chore && !a.fine && a.level !== "info").length, "the chore is not in the count");
  assert.ok(!d.alerts.some((a) => a.id === "assumptions-stale" || a.id === "assumptions-unreviewed"));
  assert.ok(!compute(p).alerts.some((a) => a.id === "assumptions-yearly"), "without a day: no date checks");
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
  assert.equal(life.level, "warn"); assert.equal(life.title, "No life insurance on Ana: Bo and Cy would be about $312,000 short");   // 2026-11-02, the health line (Bo alone pays his cover): was 235,000; 287,000 before the seventh pass's Medigap Plan G default ($194 a month)
  assert.deepEqual(life.go, ["insurance", "life-needs"]);
  assert.ok(!a.some((x) => x.id === "life-cover-p-bo"), "the plan holds if Bo died");
  const g = a.find((x) => x.id === "guardian");
  assert.equal(g.level, "info"); assert.equal(g.title, "No one is named to raise Cy if you both died"); assert.deepEqual(g.go, ["estate", "documents"]);
  p.insurance = { ...(p.insurance ?? {}), policies: [{ id: "t1", kind: "term", personId: "p-ana", benefit: 100000, premium: 20, period: "monthly" }] };
  assert.equal(compute(p, { today: "2026-11-02" }).alerts.find((x) => x.id === "life-cover-p-ana").title, "Ana's life insurance is about $212,000 short");   // the health line: was 135,000, then 187,000 before the seventh pass's Medigap Plan G default
  p.insurance.policies[0].benefit = 350000;   // 300,000 before the seventh pass (the need is 312,000 with the Medigap Plan G default)
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
  // (Round 8 item 3: the goals step now comes right after the Visa, before the full cushion and the open-ended steps, so it
  // starts in December 2026 with all the spare money then, $3,884 a month, not in December 2027 with $1,911; month by month
  // from then, less the emergency fund's, the car's and college's catch-up, the most a wedding by December 2029 can reach is
  // about $115,900, where it was about $21,100)
  const w = run(g("g-wed", 12000, "2029-12-01"));
  assert.deepEqual(w.queued.map((x) => x.id), ["g-wed"]); assert.ok(!w.behind.some((x) => x.id === "g-wed"));
  // (review D6, 2026-11-06: the family's "Emergency fund" goal is not ticked as the emergency fund, so Liquidity keeps its money
  // apart and it is one of the dated goals the step catches up, here too: its catch-up takes about $6,100 more of what a
  // wedding by December 2029 could reach, about $109,800 now)
  assert.deepEqual(run(g("g-wed", 111000, "2029-12-01")).queued, [], "about $109,800 is the most it can be");
  assert.deepEqual(run(g("g-wed", 109000, "2029-12-01")).queued.map((x) => x.id), ["g-wed"], "a $109,000 wedding can still be reached");
  // a $150,000 wedding is behind (round 5's first finding stays fixed; $36,000 now fits, item 3), and it holds the step: the
  // 2035 boat is not said to start on that money; the boat alone waits
  const big = run(g("g-wed", 150000, "2029-12-01"), g("g-boat", 6000, "2035-06-01"));
  assert.deepEqual(big.queued.map((x) => x.id), []); assert.ok(big.behind.some((x) => x.id === "g-wed")); assert.ok(big.behind.some((x) => x.id === "g-boat"));
  assert.deepEqual(run(g("g-boat", 6000, "2035-06-01")).queued.map((x) => x.id), ["g-boat"]);
  // a $3,000 holiday getting $100 a month, due 3 days after the turn (December 5, 2026: the turn is December 2, 2026 since
  // round 8 item 3): it draws nothing from the step, so the boat still waits (second pass: its catch-up came out infinite and
  // every later goal read behind)
  const hol = run(g("g-boat", 6000, "2035-06-01"), g("g-hol", 3000, "2026-12-05", { monthly: 100 }));
  assert.equal(hol.turn, "2026-12-02"); assert.deepEqual(hol.queued.map((x) => x.id), ["g-boat"]); assert.ok(hol.behind.some((x) => x.id === "g-hol"));
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
  // Round 8 item 3: in both households the goals step now gets money this month (before, January and March 2027, after the
  // full cushion), so no goal waits a turn: each one behind its pace is behind, and Next best action says what it needs from
  // now. (The month-by-month reckoning from a later turn, with these households' figures, is the test above.)
  const h777 = run("08-retired/goals/H-0777-two-goals-one-account.md");
  assert.equal(h777.turn, null); assert.deepEqual(h777.queued, []); assert.deepEqual(h777.behind.map((x) => x.id).sort(), ["g-share2", "g-trip"]);
  const h177 = run("02-couple-no-kids/goals/H-0177-two-goals-one-account.md");
  assert.equal(h177.turn, null); assert.deepEqual(h177.queued, []); assert.ok(h177.behind.some((x) => x.id === "g-share1") && h177.behind.some((x) => x.id === "g-share2"));
});

test("goalsBehind follows Next best action's goals step: its capacity is the spare money that reaches it once it starts", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: nbaOf } = await import("../next-best-action/compute.js");
  const { compute: goalsOf } = await import("../../goals/goals/compute.js");
  const T = "2026-11-02";
  const plan = (due) => { const p = familyPlan(T); p.goals.find((x) => x.id === "g-col").monthly = 0; p.goals.find((x) => x.id === "g-trip").targetDate = due; return p; };
  const run = (p) => { const nba = nbaOf(p, { today: T }); return { nba, gb: goalsBehind(goalsOf(p, { today: T }), { nba, today: T }) }; };
  // (round 8 item 3: the turn is December 2026, right after the Visa, so "a month after the turn" is January 2027)
  const near = run(plan("2027-01-01"));
  const step = near.nba.steps.find((s) => s.id === "goals");
  assert.equal(step.startDate, "2026-12-02");
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
  assert.match(a.title, /type what you have paid/); assert.match(a.detail, /you have not typed any yet\. If none were made, about \$[\d,]+ was due by now/);
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

test("Review 2026-11-06: the tax bill alert reads each separate return, and says the self-employment tax itself", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-02";
  // filing jointly: 5,223 to pay; the business's self-employment tax is 1,017 (the alert said 581, the business's whole effect)
  const j = compute(familyPlan(T), { today: T }).alerts.find((x) => x.id === "tax-bill");
  assert.match(j.detail, /\(\$1,017 of it self-employment tax\)/);
  // filing separately with 3,750 each: Ana's return gets 2,200 back and Bo's owes 1,659.70. The two added up are a 540 refund,
  // so nothing was said; Bo's bill is his own return's
  const p = familyPlan(T); p.household.filingStatus = "married_separate";
  p.whatIfs = { ...(p.whatIfs ?? {}), benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } };
  const a = compute(p, { today: T }).alerts.find((x) => x.id === "tax-bill");
  assert.ok(a, "Bo's own bill is an alert");
  assert.equal(a.title, "About $1,660 of tax to pay in April on Bo's return");
  assert.match(a.detail, /one return's refund cannot pay the other's bill/);
});

test("Review 2026-11-06 (round 7): the unnamed first adult (\"Me\") reads you and your, the unnamed partner your spouse; typed names as before", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-02";
  // a retirement inside the next year: "You retire this year", not "Me retires"
  const p = emptyPlan();
  p.household.people = [{ id: "r", name: "Me", role: "self", birthDate: "1962-03-10", retirementAge: 65 }];
  p.accounts = [{ id: "ira", name: "IRA", type: "ira", balance: 310000, ownerId: "r", asOf: T, history: [] }];
  const r = compute(p, { today: T }).alerts.find((a) => a.id === "retiring-r");
  assert.ok(r); assert.match(r.title, /^You retire (this year|in about a year)/);
  const named = structuredClone(p); named.household.people[0].name = "Ruth";
  assert.match(compute(named, { today: T }).alerts.find((a) => a.id === "retiring-r").title, /^Ruth retires (this year|in about a year)/);
  // this year's required withdrawal: "Your required withdrawal"
  const q = emptyPlan();
  q.household.people = [{ id: "r", name: "Me", role: "self", birthDate: "1950-03-10" }];
  q.accounts = [{ id: "ira", name: "IRA", type: "ira", balance: 310000, ownerId: "r", asOf: "2026-09-15", history: [] }];
  assert.match(compute(q, { today: T }).alerts.find((a) => a.id.startsWith("rmd-")).title, /^Your required withdrawal: at least \$13,080 by December 31/);
  // filing separately, the partner's return owes: "on your spouse's return"; "Your spouse's return has ... your spouse's pay"
  const s = familyPlan(T); s.household.filingStatus = "married_separate"; s.household.people[0].name = "Me"; s.household.people[1].name = "My spouse";
  s.whatIfs = { ...(s.whatIfs ?? {}), benefits: { "p-ana": { dcfsaElect: 3750, planYear: 2026 }, "p-bo": { dcfsaElect: 3750, planYear: 2026 } } };
  const a = compute(s, { today: T }).alerts.find((x) => x.id === "tax-bill");
  assert.equal(a.title, "About $1,660 of tax to pay in April on your spouse's return");
  assert.match(a.detail, /Your spouse's return has about \$[\d,]+ of federal tax and your spouse's pay takes out about/);
  for (const x of compute(s, { today: T }).alerts) assert.doesNotMatch(`${x.title} ${x.detail}`, /\bMe's\b|My spouse/, x.id);
});

// C3 (spec 8.1): no red "You spend more than comes in" resting on our guesses; one calm line asks for the real spending
test("C3 spending that is mostly our guesses: a calm 'Type what you really spend', never the red overspend", async () => {
  const { markGuess } = await import("../../../core/estimate/index.js");
  const p = emptyPlan();
  p.household.people = [{ id: "me", name: "Me", role: "self", birthDate: "1990-01-01" }];
  p.income = [{ id: "i", name: "Pay", type: "salary", amount: 2500, period: "monthly", personId: "me" }];
  p.expenses = [{ id: "setup-x-housing", name: "Rent", category: "housing", amount: 1500, period: "monthly", essential: true }, { id: "setup-x-groceries", name: "Groceries", category: "groceries", amount: 1200, period: "monthly", essential: true }];
  assert.ok(ids(compute(p, { today: TODAY })).includes("overspend"));
  for (const x of p.expenses) markGuess(p, `expenses[${x.id}].amount`, { key: "spend.x", value: x.amount, unit: "month", sigma: 0.25, dataAsOf: "2026-09-01" }, TODAY);
  const d = compute(p, { today: TODAY });
  assert.ok(!ids(d).includes("overspend"));
  const a = d.alerts.find((x) => x.id === "spend-guessed");
  assert.deepEqual([a.level, a.title, a.go], ["info", "Type what you really spend", ["cashflow", "expenses"]]);
  assert.match(a.detail, /with them, about \$[\d,]+ more would go out each month than comes in/);
});

// ---- C5 follow-ups, critic F3: with our pay guess the calm line asks for the pay first, as the Dashboard and Your plan do
/** Every box of Get started left to us (the C5 B10 walk), the pay typed when `pay` is given, the spending typed when `spend` is. */
async function boxesOurs({ today, pay = "", spend = null } = {}) {
  const S = await import("../setup/compute.js");
  const G = await import("../guesses/compute.js");
  const { estimate, settle, mergeEstimators } = await import("../../../core/estimate/index.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const REG = mergeEstimators([{ from: "overview/guesses", estimators: G.estimators, tables: G.TABLES }, { from: "overview/setup", estimators: S.estimators }]);
  const GO = { estimators: REG.estimators, tables: REG.tables, today };
  const p = migrate(emptyPlan()); S.applyYou(p, { name: "Sam", who: "me", kids: 0, state: "AZ" });
  const step = (fn) => { const before = structuredClone(p); fn((k, o = {}) => estimate(before, k, { ...GO, ...o })); settle(p, GO); };
  step((guess) => S.applyMoney(p, { people: { "setup-self": { status: "work", amount: pay, period: "annual" } }, today }, today, { guess }));
  step((guess) => S.applyAges(p, { people: { "setup-self": { month: 3, year: 1983, stopAge: 65, ss: { mode: "estimate" } } } }, today, { guess }));
  S.applyHavePicks(p, ["checking", "retire"]); step((guess) => S.applyHaveAmounts(p, {}, today, { guess }));
  S.applyOwePicks(p, ["credit"]); step((guess) => S.applyOweAmounts(p, {}, today, { guess }));
  step((guess) => S.applySpend(p, { mode: "rows", rows: spend ?? {} }, today, { guess }));
  S.markAt(p, "done", today);
  return p;
}
test("C5 follow-ups F3: our pay guess is named and asked for first, calm, on the pay question; never a red overspend", async () => {
  const { standing } = await import("../setup/compute.js");
  const D = "2026-11-13";
  const one = (p) => { const d = compute(p, { today: D }); return d.alerts.filter((x) => x.id === "spend-guessed" || x.id === "pay-guessed" || x.id === "overspend"); };
  // the pay and the spending ours (Get started's "both"): one calm line, the pay first, opening the pay question
  const both = await boxesOurs({ today: D });
  assert.equal(standing(both, { today: D }).spareWaitsOn, "both");
  const [b, ...b2] = one(both);
  assert.deepEqual(b2, []);
  assert.deepEqual([b.id, b.level, b.title, b.act, b.go, b.rest, b.query], ["spend-guessed", "info", "Type your pay and what you really spend", "Type your pay", ["overview", "setup"], ["money"], { back: "done" }]);
  assert.match(b.detail, /^Your pay and most of your spending are our guesses for now(; with them, about \$[\d,]+0 more would go out each month than comes in)?\. Your real figures decide whether your month works\.$/);
  // the spending typed, more than our pay guess leaves: the pay alone, calm, never "You spend more than comes in" on our pay
  const lean = { housing: 2600, utilities: 300, groceries: 700, transport: 700, insurance: 300, dining: 500, shopping: 600 };
  const pay = await boxesOurs({ today: D, spend: lean });
  assert.equal(standing(pay, { today: D }).spareWaitsOn, "pay");
  const [a, ...a2] = one(pay);
  assert.deepEqual(a2, [], "no red overspend beside it");
  assert.deepEqual([a.id, a.level, a.title, a.act, a.go, a.rest], ["pay-guessed", "info", "Type your pay", "Type your pay", ["overview", "setup"], ["money"]]);
  assert.match(a.detail, /^Your pay is our guess for now; with it, about \$[\d,]+0 more would go out each month than comes in\. Your real pay decides whether your month works\.$/);
  // ...and with money left over: still the one calm line, as the Dashboard's row asks for the pay
  const ok = await boxesOurs({ today: D, spend: { housing: 1500, utilities: 200, groceries: 500, transport: 400, insurance: 150, dining: 300, shopping: 300 } });
  assert.equal(standing(ok, { today: D }).spareWaitsOn, "pay");
  assert.deepEqual(one(ok).map((x) => [x.id, x.detail]), [["pay-guessed", "Your pay is our guess for now. Your real pay decides whether your month works."]]);
  // the pay typed, the spending ours: as before (Expenses)
  const spend = await boxesOurs({ today: D, pay: "52000" });
  assert.equal(standing(spend, { today: D }).spareWaitsOn, "spending");
  assert.deepEqual(one(spend).map((x) => [x.id, x.title, x.go]), [["spend-guessed", "Type what you really spend", ["cashflow", "expenses"]]]);
  // the same plan with the pay typed and the spending typed short: the red overspend, as before
  const real = await boxesOurs({ today: D, pay: "52000", spend: lean });
  assert.deepEqual(one(real).map((x) => [x.id, x.level]), [["overspend", "bad"]]);
  // the view opens the screen inside the page (`rest`), so the link lands on the pay question
  const view = (await import("node:fs")).readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(view.includes("ctx.go(a.go[0], a.go[1], a.rest ?? [], a.query ?? {})"));
});

test("C3 a thin cushion measured against guessed must-pay bills is said by our guesses, never red", async () => {
  const { markGuess } = await import("../../../core/estimate/index.js");
  const p = emptyPlan();
  p.household.people = [{ id: "me", name: "Me", role: "self", birthDate: "1990-01-01" }];
  p.income = [{ id: "i", name: "Pay", type: "salary", amount: 6000, period: "monthly", personId: "me" }];
  p.accounts = [{ id: "c", name: "Checking", type: "checking", balance: 1000 }];
  p.expenses = [{ id: "setup-x-housing", name: "Rent", category: "housing", amount: 1500, period: "monthly", essential: true }, { id: "setup-x-groceries", name: "Groceries", category: "groceries", amount: 600, period: "monthly", essential: true }];
  assert.ok(ids(compute(p, { today: TODAY })).includes("emergency-bad"));
  for (const x of p.expenses) markGuess(p, `expenses[${x.id}].amount`, { key: "spend.x", value: x.amount, unit: "month", sigma: 0.25, dataAsOf: "2026-09-01" }, TODAY);
  const d = compute(p, { today: TODAY });
  assert.ok(!ids(d).some((i) => /^emergency-(bad|warn|later)$/.test(i)));
  const a = d.alerts.find((x) => x.id === "emergency-guessed");
  assert.deepEqual([a.level, a.title, a.go], ["info", "Emergency fund: by our guesses", ["cashflow", "expenses"]]);
  assert.match(a.detail, /^By our guesses of the bills you have to pay, usable cash covers about 0\.5 months; the plan aims for \d+\. Type your real bills to know for sure\.$/);
});

test("round 8 item 40: within a level, an alert with a date comes first: the required withdrawal before the cushion", async () => {
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.household = { people: [{ id: "p-r", name: "Ruth", role: "self", birthDate: "1952-03-15", retirementAge: 74 }], filingStatus: "single", state: "FL" };
  p.accounts = [{ id: "a-chk", name: "Checking", type: "checking", balance: 12000, ownerId: "", asOf: "2026-11-06", history: [] },
    { id: "a-ira", name: "Ruth's retirement", type: "ira", balance: 410000, ownerId: "p-r", asOf: "2026-11-06", history: [] }];
  p.income = [{ id: "i-pen", name: "Pension", type: "pension", personId: "p-r", amount: 1900, period: "monthly" }, { id: "i-ss", name: "Social Security", type: "social", personId: "p-r", amount: 2300, period: "monthly" }];
  p.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 700, period: "monthly", essential: true }, { id: "e-bills", name: "Bills", category: "utilities", amount: 1650, period: "monthly", essential: true }];
  const a = compute(p, { today: "2026-11-06" }).alerts.filter((x) => !x.chore);
  // (round 8 batch 1: the withdrawal is in the year's tax now, so the tax to have held back from it follows, also due
  // December 31, before the cushion)
  assert.deepEqual(a.map((x) => x.id).slice(0, 3), ["rmd-p-r-2026", "estimates-holdback", "emergency-warn"]);
  assert.equal(a[0].due, "2026-12-31");
});

// Round 8 batch 1 verify, item 4: with this year's required withdrawal in the tax, Needs attention says what every tax page
// says (have the tax held back from the withdrawal by December 31), never "pay the past-due part"
test("round 8 batch 1: a withdrawal's tax is held back from it: one instruction, no past-due line", async () => {
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const { compute: est } = await import("../../taxes/estimated/compute.js");
  const p = emptyPlan();
  p.household = { people: [{ id: "p-r", name: "Ruth", role: "self", birthDate: "1952-03-15", retirementAge: 74 }], filingStatus: "single", state: "FL" };
  p.accounts = [{ id: "a-chk", name: "Checking", type: "checking", balance: 12000, ownerId: "", asOf: "2026-11-06", history: [] },
    { id: "a-ira", name: "Ruth's retirement", type: "ira", balance: 410000, ownerId: "p-r", asOf: "2026-11-06", history: [] }];
  p.income = [{ id: "i-pen", name: "Pension", type: "pension", personId: "p-r", amount: 1900, period: "monthly" }, { id: "i-ss", name: "Social Security", type: "social", personId: "p-r", amount: 2300, period: "monthly" }];
  p.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 700, period: "monthly", essential: true }, { id: "e-bills", name: "Bills", category: "utilities", amount: 1650, period: "monthly", essential: true }];
  const e = est(p, { today: "2026-11-06" });
  assert.ok(e.holdBack, "Estimated payments offers the hold-back");
  const all = compute(p, { today: "2026-11-06" }).alerts;
  const a = all.find((x) => x.id === "estimates-holdback");
  assert.ok(a, "the hold-back alert is there");
  assert.equal(a.title, `Have about $${e.holdBack.amount.toLocaleString("en-US")} of tax held back from your IRA withdrawal by December 31`);
  assert.equal(a.due, "2026-12-31");
  assert.equal(all.some((x) => x.id === "estimates-behind"), false);
  assert.doesNotMatch(all.map((x) => `${x.title} ${x.detail}`).join(" "), /past[- ]due/i);
});

// Round 8 batch 2 review (money D5): a workplace plan's own required withdrawal can wait until its owner retires from that job
// (IRC 401(a)(9)(C); IRS, Retirement plan and IRA RMD FAQs, read 2026-11-06); an IRA's cannot. The alert says the same as
// Next best action: the amount from the IRA alone, and that the 401(k) at the job now can wait.
test("round 8 review D5: still working at 75: the required withdrawal alert counts only what cannot wait", () => {
  const p = emptyPlan();
  p.household = { people: [{ id: "p-a", name: "Ana", role: "self", birthDate: "1951-02-01" }], filingStatus: "single", state: "NC" };
  p.income = [{ id: "i-pay", name: "Pay", type: "salary", personId: "p-a", amount: 78000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "e-rent", name: "Rent", category: "housing", amount: 1400, period: "monthly", essential: true }];
  p.accounts = [{ id: "a-chk", name: "Checking", type: "checking", balance: 20000, ownerId: "", history: [] },
    { id: "a-k", name: "Work 401(k)", type: "401k", balance: 300000, ownerId: "p-a", history: [] }, { id: "a-i", name: "IRA", type: "ira", balance: 100000, ownerId: "p-a", history: [] }];
  p.retirement.contributions = [{ id: "c1", accountId: "a-k", personId: "p-a", amount: 500, period: "biweekly", employerMatch: 3000 }];
  const a = compute(p, { today: "2026-11-06" }).alerts.find((x) => x.id === "rmd-p-a-2026");
  // 100,000 / 24.6 = 4,065.04
  assert.equal(a.title, "Ana's required withdrawal: at least $4,065 by December 31");
  assert.match(a.detail, /^From IRA, worked out from today's balance\. Ana's 401\(k\) at the job now \(Work 401\(k\)\) can usually wait until Ana retires/);
  p.accounts = p.accounts.filter((x) => x.id !== "a-i");
  assert.equal(compute(p, { today: "2026-11-06" }).alerts.some((x) => x.id.startsWith("rmd-")), false);
});

// Round 8 batch 2 review (UX 1): a goal Next best action pays from savings (due within 3 months, more than a month can save, the
// cash covers it) is not "behind" by a month's saving here or on the Dashboard's Goals tile; it is said as a bill to pay
test("round 8 review UX 1: a bill paid from savings is not in the goals-behind sum; it has its own line", () => {
  const p = emptyPlan();
  p.household = { people: [{ id: "p-m", name: "Marcus", role: "self", birthDate: "1972-03-15" }, { id: "p-l", name: "Lin", role: "partner", birthDate: "1974-05-15" },
    { id: "k-1", name: "Child 1", role: "dependent", birthDate: "2007-07-15" }, { id: "k-2", name: "Child 2", role: "dependent", birthDate: "2005-07-15" }], filingStatus: "married_joint", state: "WA" };
  p.income = [{ id: "i-m", name: "Pay", type: "salary", personId: "p-m", amount: 210000, period: "annual", growth: 0, taxable: true }, { id: "i-l", name: "Pay", type: "salary", personId: "p-l", amount: 30000, period: "annual", growth: 0, taxable: true }];
  p.accounts = [{ id: "a-chk", name: "Checking", type: "checking", balance: 15000, ownerId: "", history: [] }, { id: "a-sav", name: "Savings", type: "savings", balance: 40000, ownerId: "", history: [] }];
  p.expenses = [{ id: "e-home", name: "Mortgage", category: "housing", amount: 3200, period: "monthly", essential: true }, { id: "e-food", name: "Food", category: "groceries", amount: 1500, period: "monthly", essential: true }, { id: "e-fun", name: "Everything else", category: "fun", amount: 6000, period: "monthly", essential: false }];
  p.retirement.workPlans = { "p-m": { match: false }, "p-l": { match: false } };
  p.goals = [{ id: "g-c1", name: "Child 1's college, 2026-27", icon: "🎓", target: 12930, targetDate: "2027-01-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false },
    { id: "g-c2", name: "Child 2's college, 2026-27", icon: "🎓", target: 12930, targetDate: "2027-01-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false },
    { id: "g-car", name: "New car", icon: "🚗", target: 30000, targetDate: "2029-06-01", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false }];
  const d = compute(p, { today: "2026-11-06" });
  const text = d.alerts.map((a) => `${a.title} ${a.detail}`).join(" | ");
  assert.doesNotMatch(text, /28,4\d\d|12,9\d0 a month|6,4\d0 a month/);
  const cash = d.alerts.find((a) => a.id === "goals-from-cash");
  assert.equal(cash.title, "Pay 2 goals from savings");
  assert.match(cash.detail, /^Child 1's college, 2026-27 \(about \$12,930 by January 15, 2027\) and Child 2's college, 2026-27 \(about \$12,930 by January 15, 2027\) are due sooner than a month can save for them; your usable cash covers them\./);
});

// Round 8 batch 2 review (UX 4): Needs attention said "$103,000 still to go" for a college goal dated 2023, where Education
// says $12,925 (the spring half of 2026-27) is the next bill; it points to Education as Next best action does
test("round 8 review UX 4: a past-due college goal for a child in college points to Education's next bill", () => {
  const p = emptyPlan();
  p.household = { people: [{ id: "p-m", name: "Marcus", role: "self", birthDate: "1972-03-15" }, { id: "k-2", name: "Child 2", role: "dependent", birthDate: "2005-07-15" }], filingStatus: "single", state: "WA" };
  p.income = [{ id: "i-m", name: "Pay", type: "salary", personId: "p-m", amount: 150000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "e-home", name: "Rent", category: "housing", amount: 2500, period: "monthly", essential: true }];
  p.goals = [{ id: "g-old", name: "Child 2's college", icon: "🎓", target: 103000, targetDate: "2023-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  const a = compute(p, { today: "2026-11-06" }).alerts.find((x) => x.id === "goal-late-g-old");
  assert.equal(a.detail, "Education says the next bill is about $12,930 (the spring half of 2026-27, due January 15, 2027): tap Update on Education to set this goal to it.");
  assert.deepEqual(a.go, ["goals", "education"]);
});

// round 8 batch 6 review (UX 10): a rental only on Rental analysis is a housekeeping item, with its value and loan
test("batch 6 review: a rental left out of net worth is a housekeeping item; asked about when Net worth may already list it", async () => {
  const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  const a = compute(condoOnlyRentalPlan(), { today: T }).alerts.find((x) => x.id === "rental-off-r-condo");
  assert.deepEqual([a.title, a.detail, a.go, a.chore], ["Condo is not in your net worth yet", "It is worth $260,000 and owes $150,000 on Rental analysis. Add it there in one tap.", ["property", "rental"], true]);
  // Net worth lists a Condo: asked, not asserted
  const b = compute(condoOnNetWorthPlan(), { today: T }).alerts.find((x) => x.id === "rental-off-r-condo");
  assert.equal(b.detail, "It is worth $260,000 on Rental analysis. Net worth may already list it: say which there.");
  // linked: nothing
  const p = condoOnNetWorthPlan(); p.property[0].accountId = "condo";
  assert.ok(!compute(p, { today: T }).alerts.some((x) => x.id.startsWith("rental-off-")));
});

test("round 8 batch 6 verify: a rental Net worth may already list is asked about, not called missing", async () => {
  const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const find = (p) => compute(p, { today: "2026-11-06" }).alerts.find((x) => x.id === "rental-off-r-condo");
  // Net worth lists "Condo" at $260,000, not yet linked: it is probably in net worth already, so the title asks
  const a = find(condoOnNetWorthPlan());
  assert.equal(a.title, "Is Condo on Net worth already?");
  assert.doesNotMatch(a.title, /not in your net worth/);
  assert.match(a.detail, /Net worth may already list it/);
  // only on Rental analysis: it is not in net worth, and the item says so
  assert.equal(find(condoOnlyRentalPlan()).title, "Condo is not in your net worth yet");
});

test("each row says what the person does on the page it opens; costly debt opens Pay off debts (stress test MR-7)", async () => {
  const { actFor } = await import("./compute.js");
  assert.equal(actFor({ id: "debt-expensive-a-visa", go: ["debt", "payoff"] }), "Plan the payoff");
  assert.equal(actFor({ id: "emergency-bad", go: ["balance", "liquidity"] }), "Add to your emergency fund");
  assert.equal(actFor({ id: "tax-bill", go: ["taxes", "withholding"] }), "Check the tax taken from your pay");
  assert.equal(actFor({ id: "something-new", go: ["x", "y"] }), null, "unknown: the view says Open <page title>");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const d = compute(familyPlan("2026-11-11"), { today: "2026-11-11" });
  const visa = d.alerts.find((a) => /^debt-expensive-/.test(a.id));
  if (visa) { assert.deepEqual(visa.go, ["debt", "payoff"]); assert.equal(visa.act, "Plan the payoff"); }
  assert.ok(d.alerts.filter((a) => !a.chore).every((a) => typeof a.act === "string"), d.alerts.filter((a) => !a.act).map((a) => a.id).join());
});
