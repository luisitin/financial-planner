import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, fmtAge, KINDS, MILESTONES } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const ev = (d, id) => d.events.find((e) => e.id === id);

test("an empty plan or no today: not ready, says what is missing", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, false); assert.ok(d.missing.some((m) => m.includes("People")));
  assert.equal(compute(familyPlan(), {}).ready, false, "no today, no ages");
});

test("the family: retirements, Medicare, Social Security, the rule ages, children, on the right days", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.equal(d.ready, true);
  assert.equal(ev(d, "retire-p-bo").date, "2050-11-02", "Bo born 1988-11-02 retires at 62");
  assert.equal(ev(d, "retire-p-ana").date, "2055-05-20");
  assert.match(ev(d, "retire-p-bo").detail, /until Medicare at 65 .*3 years/, "retiring before 65 names the health-cover gap");
  assert.doesNotMatch(ev(d, "retire-p-ana").detail, /Medicare/);
  assert.equal(ev(d, "medicare-p-ana").date, "2055-05-20");
  assert.equal(ev(d, "medicare-p-bo").date, "2053-11-02");
  assert.equal(ev(d, "social-p-ana").date, "2057-05-20", "claimed at 67");
  assert.match(ev(d, "social-p-ana").detail, /\$2,650 a month/);
  assert.equal(ev(d, "penalty-p-ana").date, "2049-11-20", "59 and a half");
  assert.equal(ev(d, "catchup-p-ana").date, "2040-05-20", "50");
  assert.match(ev(d, "catchup-p-ana").detail, /\$8,000 more a year into a 401\(k\) and \$1,100 more into an IRA/);
  assert.equal(ev(d, "supercatchup-p-ana").date, "2050-05-20", "60, still working and owns a 401(k)");
  assert.equal(ev(d, "rmd-p-ana").year, 2065, "born 1990: required withdrawals from 75");
  assert.equal(ev(d, "rmd-p-bo").year, 2063);
  assert.equal(ev(d, "child17-p-cy").date, "2037-03-03"); assert.equal(ev(d, "child18-p-cy").date, "2038-03-03"); assert.equal(ev(d, "child26-p-cy").date, "2046-03-03");
  assert.equal(ev(d, "end-p-ana").date, "2085-05-20"); assert.equal(d.endYear, 2085);
});

test("the family: debts in payoff order, debt-free with the last one, goals with their status", () => {
  const d = compute(familyPlan(), { today: TODAY });
  const debts = d.events.filter((e) => e.kind === "debt" || e.kind === "mortgage");
  assert.deepEqual(debts.map((e) => e.title), ["Visa card paid off", "Car loan paid off", "Mortgage paid off"]);
  assert.equal(ev(d, "debt-a-mort").kind, "mortgage");
  assert.equal(ev(d, "debtfree").date, ev(d, "debt-a-mort").date, "debt-free the day the last debt goes");
  assert.equal(d.headline.debtFreeYear, Number(ev(d, "debtfree").date.slice(0, 4)));
  const goals = d.events.filter((e) => e.kind === "goal");
  assert.deepEqual(goals.map((e) => e.title), ["Emergency fund", "Japan trip", "Replace Bo's car", "Cy's college"]);
  assert.equal(ev(d, "goal-g-ef").icon, "🛟", "a goal keeps its own icon");
  assert.ok(goals.every((g) => g.tone === "warn" || g.tone === "ok"));
});

test("order, years and counts: nothing before today, sorted, quiet years counted, every topic counted once", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.equal(d.events[0].kind, "now");
  assert.ok(d.events.every((e) => (e.date ?? `${e.year}-12-31`) >= TODAY));
  const keys = d.events.map((e) => e.date ?? `${e.year}-01-01`);
  assert.deepEqual(keys, [...keys].sort());
  assert.equal(d.counts.all, d.events.length);
  assert.equal(Object.entries(d.counts).filter(([k]) => k !== "all").reduce((s, [, n]) => s + n, 0), d.events.length);
  for (let i = 1; i < d.years.length; i++) assert.equal(d.years[i].gapBefore, d.years[i].year - d.years[i - 1].year - 1);
  const y2038 = d.years.find((y) => y.year === 2038);
  assert.deepEqual(y2038.ages.map((a) => `${a.name} ${a.age}`), ["Ana 48", "Bo 50", "Cy 18"]);
  assert.equal(d.years.find((y) => y.year === 2085).ages.some((a) => a.name === "Bo"), false, "Bo's plan ends in 2083");
  assert.equal(y2038.era, "work"); assert.equal(d.years.find((y) => y.year === 2057).era, "retired");
  for (const e of d.events) assert.ok(KINDS[e.kind], e.kind);
});

test("money: milestones only upward and past today's level, independence, whether it lasts", () => {
  const d = compute(familyPlan(), { today: TODAY });
  const ms = d.events.filter((e) => e.kind === "milestone").map((e) => Number(e.id.split("-")[1]));
  assert.deepEqual(ms, [...ms].sort((a, b) => a - b));
  assert.ok(ms.every((m) => MILESTONES.includes(m) && m > 192700), "only milestones not yet reached today");
  // independence sits on the chart's own path: the sample family's savings peak near $1.4 million, under the number, so no moment
  assert.equal(ev(d, "fi"), undefined, "the projected savings never reach the independence number before retirement");
  assert.equal(ev(d, "lasts").tone, "ok"); assert.equal(d.headline.lastsTo, 2085); assert.equal(d.headline.shortYear, null);
  assert.equal(d.events.at(-1).id, "lasts", "the verdict is the last word");
  assert.equal(d.savings[0].year, 2026); assert.equal(d.savings.at(-1).year, 2085);
});

test("a plan that runs short says when, in red, and the headline carries it", () => {
  const p = familyPlan(); p.retirement.spendingMonthly = 16000;
  const d = compute(p, { today: TODAY });
  const s = ev(d, "short");
  assert.ok(s); assert.equal(s.tone, "bad"); assert.equal(d.headline.shortYear, s.year); assert.equal(d.headline.lastsTo, null);
  assert.equal(ev(d, "lasts"), undefined);
});

test("people already retired and a plan with no savings yet", () => {
  const p = retirementPlan();
  p.household.people[0].birthDate = "1955-01-15";   // 71: retired, on Medicare, Social Security and withdrawals already started
  const d = compute(p, { today: TODAY });
  assert.equal(ev(d, "retire-sam"), undefined); assert.equal(ev(d, "medicare-sam"), undefined); assert.equal(ev(d, "social-sam"), undefined, "already past: none of these are listed");
  assert.equal(ev(d, "rmd-sam").year, 2028, "born 1955: required withdrawals at 73, still ahead");
  const bare = emptyPlan(); bare.household.people.push({ id: "me", name: "Jo", role: "self", birthDate: "1980-02-02" });
  const b = compute(bare, { today: TODAY });
  assert.equal(b.ready, true); assert.equal(b.savings.length, 0); assert.ok(b.notes[0].startsWith("Add "));
  assert.equal(ev(b, "social-me").tone, "warn", "no Social Security figure: the earliest age, flagged");
  assert.equal(ev(b, "penalty-me"), undefined, "no retirement accounts, no 59 and a half");
});

test("fmtAge", () => {
  assert.equal(fmtAge(67), "67"); assert.equal(fmtAge(66.5), "66 and 6 months"); assert.equal(fmtAge(62 + 1 / 12), "62 and 1 month");
});

test("independence: the first year the chart's savings reach the independence number, before retirement", async () => {
  const { compute: fire } = await import("../../retirement/fire/compute.js");
  const p = familyPlan(); p.retirement.spendingMonthly = 2500;
  const d = compute(p, { today: TODAY });
  const n = fire(p, { today: TODAY }).fiNumber;
  const first = d.savings.find((s) => s.year > 2026 && s.real >= n);
  const e = ev(d, "fi");
  assert.ok(first && first.year < d.headline.retireYear, "this plan gets there before retirement");
  assert.equal(e.year, first.year, "the moment is where the chart crosses the number");
  assert.ok(e.detail.includes("savings pass about"));
  assert.deepEqual(e.go, ["retirement", "projection"], "it opens the projection it is read from");
  // already past the number today: no moment "next year"
  const rich = familyPlan(); rich.retirement.spendingMonthly = 2500;
  (rich.accounts.find((a) => a.type === "brokerage" || a.type === "taxable") ?? rich.accounts[0]).balance = 3000000;
  assert.equal(ev(compute(rich, { today: TODAY }), "fi"), undefined);
});

test("a goal waiting its turn on Next best action says when it starts, not 'Behind', as on Goals (review 2026-11-02)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-02";
  const p = familyPlan(T); p.goals.find((g) => g.id === "g-col").monthly = 0;   // college, due 2038, nothing going in yet
  const ev = compute(p, { today: T }).events.find((e) => e.id === "goal-g-col");
  assert.match(ev.detail, /Saving for it starts in \w+ \d{4}, when its turn comes on Next best action\.$/); assert.doesNotMatch(ev.detail, /Behind/); assert.notEqual(ev.tone, "warn");
  // a goal due before that turn is still behind
  const trip = compute(p, { today: T }).events.find((e) => e.id === "goal-g-trip");
  assert.match(trip.detail, /Behind/); assert.equal(trip.tone, "warn");
});

test("the mortgage paid off: the payoff plan's date, and its own payment's date with the reason (both dates, round 4)", () => {
  const today = "2026-11-02";
  const d = compute(familyPlan(today), { today });
  const e = (d.events ?? []).find((x) => x.kind === "mortgage");
  assert.equal(e.date.slice(0, 7), "2039-03");
  assert.match(e.detail, /This date has the Visa card and Car loan payments moving onto it once they are paid off; on its own payment it runs to January 2046\./);
});

test("someone already getting Social Security has no 'starts' event, however early it began (review 2026-11-02, round 5)", () => {
  const today = "2026-11-02";
  // Ana is 55 and on disability benefits (setup's "I already get it": the full-age figure, at 67, and the Income line)
  const p = familyPlan(today);
  p.household.people.find((x) => x.id === "p-ana").birthDate = "1971-03-15";
  p.guide = { ...(p.guide ?? {}), setup: { ...(p.guide?.setup ?? {}), ss: { "p-ana": "getting" } } };
  p.retirement.socialSecurity["p-ana"] = { claimAge: 67, monthlyAtFRA: 1800 };
  p.income.push({ id: "setup-ss-p-ana", name: "Ana's Social Security", type: "social", personId: "p-ana", amount: 1800, period: "monthly" });
  const d = compute(p, { today });
  assert.equal(ev(d, "social-p-ana"), undefined, "not 'starts in 2038, at full retirement age'");
  assert.match(ev(d, "social-p-bo").title, /Bo's Social Security starts/, "the partner's start is still ahead");
  // paid and only on Income (no figure on the Social Security page): not "can claim at 62, no estimate yet" either
  delete p.retirement.socialSecurity["p-ana"]; delete p.guide.setup.ss["p-ana"];
  assert.equal(ev(compute(p, { today }), "social-p-ana"), undefined);
});

test("a goal behind by less than $100 a month says its need to the $10, never 'about $0' (review 2026-11-02, round 5, third pass)", async () => {
  const { needWords } = await import("./compute.js");
  assert.equal(needWords(1234), "about $1,200"); assert.equal(needWords(95), "about $100");
  assert.equal(needWords(49), "about $50"); assert.equal(needWords(94), "about $90"); assert.equal(needWords(5), "about $10");
  assert.equal(needWords(3), "under $10"); assert.equal(needWords(0), "under $10");
  // the family plan with a $36,000 wedding and a $6,000 boat for 2035, both behind: the boat needs about $60 a month
  const T = "2026-11-02";
  const p = familyPlan(T); p.goals = p.goals.filter((x) => x.id !== "g-trip");
  const g = (id, name, target, targetDate) => ({ id, name, icon: "", target, targetDate, priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: false });
  p.goals.push(g("g-wed", "Wedding", 36000, "2029-12-01"), g("g-boat", "Boat", 6000, "2035-06-01"));
  const boat = ev(compute(p, { today: T }), "goal-g-boat");
  assert.match(boat.detail, /^\$6,000 due\. Behind: about \$\d0 a month is needed\.$/); assert.doesNotMatch(boat.detail, /about \$0 a month/);
});
