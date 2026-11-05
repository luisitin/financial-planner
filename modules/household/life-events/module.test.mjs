import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, eventView, startEvent, setEventDate, removeEvent, setStep, applyChange, SOON_DAYS } from "./compute.js";
import { EVENTS } from "./data/events.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import fs from "node:fs";
import path from "node:path";

const TODAY = "2026-10-31";

test("every step is well formed: links go to built pages, changes are known, deadlines are numbers", () => {
  const known = ["addPartner", "addChild", "fileJointly", "fileHeadOfHousehold", "fileSingle", "setState", "updatePay", "addAccount"];
  for (const [kind, e] of Object.entries(EVENTS)) {
    assert.ok(e.label && e.dateLabel && e.intro, kind);
    const keys = new Set();
    for (const s of e.steps) {
      assert.ok(!keys.has(s.key), `${kind}: ${s.key} twice`); keys.add(s.key);
      if (s.change) assert.ok(known.includes(s.change), `${kind}.${s.key}`);
      if (s.days) assert.ok(Number.isInteger(s.days) && s.days > 0);
      if (s.go) { const src = fs.readFileSync(path.join("modules", ...s.go, "module.js"), "utf8"); assert.ok(!/status:\s*"planned"/.test(src), `${kind}.${s.key} -> ${s.go.join("/")} is not built`); }
    }
  }
});

test("deadlines from the event's day: 30 and 60 days, December 31 of the 10th year; late, soon, open", () => {
  const p = emptyPlan();
  startEvent(p, { id: "m", kind: "marriage", date: "2026-10-10" }, TODAY);
  const e = eventView(p, p.lifeEvents[0], TODAY);
  const by = Object.fromEntries(e.steps.map((s) => [s.key, s]));
  assert.equal(by["work-health"].deadline, "2026-11-09"); assert.equal(by["work-health"].daysLeft, 9); assert.equal(by["work-health"].state, "soon");
  assert.equal(by["own-health"].deadline, "2026-12-09"); assert.equal(by["own-health"].state, "open", `more than ${SOON_DAYS} days away`);
  assert.equal(by.name.deadline, null);
  startEvent(p, { id: "i", kind: "inheritance", date: "2025-03-02" }, TODAY);
  assert.equal(eventView(p, p.lifeEvents[1], TODAY).steps.find((s) => s.key === "ira").deadline, "2035-12-31", "the IRS example: a death in 2025 empties by December 31, 2035");
  startEvent(p, { id: "j", kind: "job", date: "2026-08-01" }, TODAY);
  const job = eventView(p, p.lifeEvents[2], TODAY);
  assert.equal(job.steps.find((s) => s.key === "cobra").state, "late"); assert.equal(job.steps.find((s) => s.key === "cobra").daysLeft, -31);
  // the urgent list: late and soon, soonest first
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.urgent.map((u) => [u.event.label, u.step.key, u.step.deadline]), [["A new job", "cobra", "2026-09-30"], ["A new job", "own-health", "2026-09-30"], ["Getting married", "work-health", "2026-11-09"]]);
  assert.deepEqual(d.events.map((x) => x.id), ["m", "j", "i"], "newest day first");
});

test("ticking steps, steps already in the plan, the next step, and the single-parent step", () => {
  const p = familyPlan(TODAY);   // Ana and Bo (partner), married filing jointly
  startEvent(p, { id: "m", kind: "marriage", date: "2026-06-01" }, TODAY);
  let e = eventView(p, p.lifeEvents[0], TODAY);
  assert.equal(e.steps.find((s) => s.key === "partner").auto, true, "a partner is on People already");
  assert.equal(e.steps.find((s) => s.key === "filing").auto, true);
  setStep(p, "m", "name", true, TODAY);
  e = eventView(p, p.lifeEvents[0], TODAY);
  assert.equal(e.done, 3); assert.equal(e.steps.find((s) => s.key === "name").doneOn, TODAY);
  assert.equal(e.next.key, "work-health", "the first step not done (its deadline has passed)");
  setStep(p, "m", "name", false, TODAY);
  assert.equal(eventView(p, p.lifeEvents[0], TODAY).done, 2);
  // the head-of-household step only for a single filer
  startEvent(p, { id: "b", kind: "baby", date: "2026-12-01" }, TODAY);
  assert.ok(!eventView(p, p.lifeEvents[1], TODAY).steps.some((s) => s.key === "hoh"));
  p.household.filingStatus = "single";
  assert.ok(eventView(p, p.lifeEvents[1], TODAY).steps.some((s) => s.key === "hoh"));
  // a child born near the day counts as added
  p.household.people.push({ id: "k", name: "Dee", role: "dependent", birthDate: "2026-11-20" });
  assert.equal(eventView(p, p.lifeEvents[1], TODAY).steps.find((s) => s.key === "child").auto, true);
});

test("plan changes, each ticking its step: partner, child, filing status, state, pay, an inherited account", () => {
  const p = emptyPlan();
  startEvent(p, { id: "m", kind: "marriage", date: "2026-10-10" }, TODAY);
  assert.deepEqual(applyChange(p, "m", "addPartner", { name: "" }), { ok: false, text: "Type your partner's name." });
  assert.equal(applyChange(p, "m", "addPartner", { id: "p2", name: " Sam ", birthDate: "1990-05-05" }, TODAY).ok, true);
  assert.deepEqual(p.household.people.at(-1), { id: "p2", name: "Sam", birthDate: "1990-05-05", role: "partner" });
  assert.equal(p.lifeEvents[0].done.partner, TODAY);
  applyChange(p, "m", "fileJointly", {}, TODAY); assert.equal(p.household.filingStatus, "married_joint");
  startEvent(p, { id: "mv", kind: "move", date: "2026-12-01" }, TODAY);
  assert.equal(applyChange(p, "mv", "setState", { state: "zz" }).ok, false);
  applyChange(p, "mv", "setState", { state: "or" }, TODAY); assert.equal(p.household.state, "OR");
  startEvent(p, { id: "j", kind: "job", date: "2026-11-15" }, TODAY);
  applyChange(p, "j", "updatePay", { id: "n1", incomeId: "", name: "", amount: 90000, period: "annual", startDate: "2026-11-27", personId: "p2" }, TODAY);
  assert.deepEqual(p.income.at(-1), { id: "n1", name: "Pay from the new job", type: "salary", personId: "p2", amount: 90000, period: "annual", growth: null, startDate: "2026-11-27", endDate: "", taxable: true });
  applyChange(p, "j", "updatePay", { incomeId: "n1", amount: 3800, period: "biweekly", startDate: "" }, TODAY);
  assert.deepEqual([p.income.length, p.income[0].amount, p.income[0].period, p.income[0].startDate], [1, 3800, "biweekly", "2026-11-27"], "an existing pay is changed in place");
  assert.equal(applyChange(p, "j", "updatePay", { amount: -1 }).ok, false);
  startEvent(p, { id: "i", kind: "inheritance", date: "2026-09-01" }, TODAY);
  applyChange(p, "i", "addAccount", { id: "a9", name: "Inherited IRA", type: "ira", balance: "52000" }, TODAY);
  assert.deepEqual(p.accounts.at(-1), { id: "a9", name: "Inherited IRA", type: "ira", institution: "", balance: 52000, asOf: TODAY, ownerId: "", history: [], notes: "Inherited" });
  startEvent(p, { id: "d", kind: "divorce", date: "2026-10-01" }, TODAY);
  applyChange(p, "d", "fileSingle", { status: "head_of_household" }, TODAY); assert.equal(p.household.filingStatus, "head_of_household");
  startEvent(p, { id: "b", kind: "baby", date: "2027-01-05" }, TODAY);
  applyChange(p, "b", "addChild", { id: "c1", name: "Baby", birthDate: "" }, TODAY); assert.equal(p.household.people.at(-1).role, "dependent");
  assert.equal(applyChange(p, "b", "nonsense").ok, false);
  const done = compute(p, { today: TODAY }).events.flatMap((e) => e.steps.filter((s) => s.doneOn).map((s) => `${e.kind}.${s.key}`)).sort();
  assert.deepEqual(done, ["baby.child", "divorce.filing", "inheritance.account", "job.pay", "marriage.filing", "marriage.partner", "move.state"]);
});

test("starting, re-dating and removing events; unknown kinds; the empty plan", () => {
  const p = emptyPlan();
  assert.equal(startEvent(p, { id: "x", kind: "lottery", date: TODAY }), null);
  startEvent(p, { id: "a", kind: "move", date: "bad" }, TODAY);
  assert.equal(compute(p, { today: TODAY }).events[0].date, null);
  assert.equal(setEventDate(p, "a", "2027-02-01"), true); assert.equal(p.lifeEvents[0].date, "2027-02-01");
  assert.equal(removeEvent(p, "a"), true); assert.equal(removeEvent(p, "a"), false);
  const e = compute(emptyPlan(), { today: TODAY });
  assert.deepEqual(e.events, []); assert.deepEqual(e.urgent, []); assert.equal(e.kinds.length, 6); assert.ok(e.states.includes("DC"));
});

test("a new job whose first payday is still to come keeps today's pay until the day before, then the new pay (the month never reads empty)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: incomeOf } = await import("../../cashflow/income/compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  const ana = p.income.find((x) => x.personId === "p-ana" && x.type === "salary");
  const before = incomeOf(p, { today: T }).monthly;
  startEvent(p, { id: "j", kind: "job", date: "2027-01-04" }, T);
  const r = applyChange(p, "j", "updatePay", { id: "n2", incomeId: ana.id, amount: 88000, period: "annual", startDate: "2027-01-04" }, T);
  assert.equal(r.ok, true);
  assert.match(r.text, /^From 1\/4\/2027 Ana's pay is 88,000 a year; until then the pay on file stays\./);
  const old = p.income.find((x) => x.id === ana.id), next = p.income.find((x) => x.id === "n2");
  assert.equal(old.endDate, "2027-01-03"); assert.equal(old.amount, ana.amount, "today's pay is not overwritten");
  assert.deepEqual([next.personId, next.amount, next.period, next.startDate, next.endDate, next.type], ["p-ana", 88000, "annual", "2027-01-04", "", "salary"]);
  assert.equal(next.name, `${ana.name} (new job)`);
  assert.ok(Math.abs(incomeOf(p, { today: T }).monthly - before) < 0.01, "this month's income is unchanged");
  assert.ok(Math.abs(incomeOf(p, { today: "2027-02-01" }).monthly - (before - ana.amount * 26 / 12 + 88000 / 12)) < 1, "from February: the new pay");
});

test("a new job from a pay that is itself a raise from a later date is its own pay: no `continues`, no careful figure (review 2026-11-02, round 5)", async () => {
  const { changeFrom, chainId } = await import("../../cashflow/income/compute.js");
  const { compute: salary } = await import("../../career/salary/compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  // Bo's photography gets a raise from January on Income (the split: the old line ends, the new one continues it)
  const was = p.income.find((x) => x.id === "i-side");
  was.countOn = 300;
  const ch = changeFrom(was, { ...was, amount: 800, startDate: "2027-01-01" }, T);
  const i = p.income.indexOf(was);
  p.income[i] = ch.old; p.income.splice(i + 1, 0, { id: "i-side-raise", ...ch.next });
  assert.equal(chainId(p.income.find((x) => x.id === "i-side-raise")), "i-side");
  p.whatIfs = { ...(p.whatIfs ?? {}), salary: { "i-ana": { raise: 0.04, promoEvery: 3 } } };
  // a new job from February, started from the raise: it is a pay of its own
  startEvent(p, { id: "j", kind: "job", date: "2027-03-01" }, "2027-02-01");
  assert.equal(applyChange(p, "j", "updatePay", { id: "n3", incomeId: "i-side-raise", amount: 1500, period: "monthly", startDate: "2027-03-01" }, "2027-02-01").ok, true);
  const next = p.income.find((x) => x.id === "n3");
  assert.equal("continues" in next, false);
  assert.equal("countOn" in next, false);
  assert.equal(chainId(next), "n3");
  // and the same for a salary that continues another: Salary keeps the new job's raises apart from the old job's
  const ana = p.income.find((x) => x.id === "i-ana");
  const ch2 = changeFrom(ana, { ...ana, amount: 4100, startDate: "2027-01-01" }, T);
  const k = p.income.indexOf(ana);
  p.income[k] = ch2.old; p.income.splice(k + 1, 0, { id: "i-ana-raise", ...ch2.next });
  startEvent(p, { id: "j2", kind: "job", date: "2027-06-01" }, "2027-02-01");
  applyChange(p, "j2", "updatePay", { id: "n4", incomeId: "i-ana-raise", amount: 95000, period: "annual", startDate: "2027-06-01" }, "2027-02-01");
  const job = salary(p, { today: "2027-07-01" }).jobs.find((x) => x.incomeId === "n4");
  assert.deepEqual([job.key, job.raiseFrom, job.settings.promoEvery], ["n4", "income", 0]);
});
