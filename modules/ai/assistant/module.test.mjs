import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compute, SYSTEM_PROMPT, ASK, RANGE_WORDS, NOT_TRIED, ALREADY_WORDS, TRUST_WORDS, UNDONE_WORDS, SETS_OWN_WORDS, SPEND_MAX, UNKNOWN_WORDS, BASICS_WORDS, AUTO_WORDS, LATER_WORDS, PAGES, WHERE, readReply, valueOf, propose, applyProposal, changeWords, effectWords, doneWords, changesContext } from "./compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
import { compute as socialSecurity } from "../../retirement/social-security/compute.js";
import { ARCHETYPES } from "../../../qa/households/lib/catalog.mjs";
import * as phone from "../../../qa/fixtures/phone-households.mjs";
import { LEVERS, applyChanges, compute as compare } from "../../scenarios/compare/compute.js";
import { outcomeOf, answerOf } from "../../retirement/levers.js";
import { AMOUNT_CEILING, MONTHLY_CEILING } from "../../retirement/happenings.js";
import { changesOf } from "../../../core/ui/undo.js";

test("assistant summary names accounts and goals", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "a", name: "Everyday checking", type: "checking", balance: 1234 });
  p.goals.push({ id: "g", name: "House", target: 50000, targetDate: "2028-01-01" });
  const d = compute(p);
  assert.match(d.summary, /Everyday checking: checking, balance 1234/);
  assert.match(d.summary, /House: target 50000/);
});

// ---- C5 hand-off H4: the model is told which figures are our guesses, never them as the person's own
test("H4: a balance or a goal's amount that is our guess is marked (our guess); the person's own figures are not", () => {
  const T = "2026-11-02";
  const p = emptyPlan();
  p.accounts.push({ id: "setup-have-retire-me", name: "Retirement savings at work", type: "401k", balance: 42000 }, { id: "a", name: "Everyday checking", type: "checking", balance: 1234 });
  p.goals.push({ id: "setup-goal-home", name: "House down payment", target: 43000, targetDate: "2029-11-02" }, { id: "g", name: "Car", target: 12000, targetDate: "2028-01-01" });
  p.guesses = { "accounts[setup-have-retire-me].balance": { k: "account.retire.balance", v: 42000, u: "total", s: null, at: T, d: T }, "goals[setup-goal-home].target": { k: "goal.home.target", v: 43000, u: "total", s: null, at: T, d: T } };
  const d = compute(p);
  assert.match(d.summary, /Retirement savings at work: 401k, balance 42000 \(our guess\)/);
  assert.match(d.summary, /House down payment: target 43000 \(our guess\) by 2029-11-02/);
  assert.match(d.summary, /Everyday checking: checking, balance 1234[;.]/);
  assert.match(d.summary, /Car: target 12000 by 2028-01-01/);
  // a figure typed over our guess is the person's: no mark
  p.accounts[0].balance = 50000;
  assert.doesNotMatch(compute(p).summary, /our guess\).*Retirement|Retirement savings at work: 401k, balance 50000 \(our guess\)/);
  // the model is told what the mark means and to say it
  assert.match(SYSTEM_PROMPT, /"\(our guess\)" is a typical figure the app filled in/);
});

// ---- gap design #39 (2026-11-14): the helper proposes a change, the app checks it and works out what it does ----------------
const T = "2026-11-14";
const family = () => migrate(structuredClone(familyPlan(T)));   // Ana (self, 1990, stops at 65), Bo (1988, at 62), Cy (a child)
/** Every lever the helper may name, with a value inside its range, on the family plan. */
const GOOD = [
  { lever: "spendingMonthly", value: 6000 }, { lever: "retireAge", value: 60, who: "Ana" }, { lever: "claimAge", value: 70, who: "Bo" },
  { lever: "stocksNow", value: 0.6 }, { lever: "stocksRetired", value: 0.4 }, { lever: "returnStocks", value: 0.05 }, { lever: "returnBonds", value: 0.03 },
  { lever: "inflation", value: 0.04 }, { lever: "spendingEase", value: 0.01 }, { lever: "strategy", value: "guardrails" },
  { lever: "in", value: 100000, year: 2035 }, { lever: "out", value: 40000, year: 2030 }, { lever: "spend", value: 500, year: 2056 },
  { lever: "after", value: 1500, who: "Bo", year: 2052, until: 2054 }, { lever: "less", value: 0.5, who: "Bo", year: 2028, until: 2030 },
  { lever: "home", value: 250000, year: 2045 },
];

test("#39 readReply: a reply with no CHANGE line comes back exactly as it was; the one line is taken out and read", () => {
  for (const text of ["", "Plain answer.", "**Bold** and a list:\n- one\n- two", "Change: you could spend less, and see Compare what-ifs.", "CHANGE your mind any time.", "A line\r\nwith Windows ends\r\n"]) {
    assert.deepEqual(readReply(text), { text, asked: null }, JSON.stringify(text));
  }
  assert.deepEqual(readReply('Spending $6,000 a month is a change you can try.\n\nCHANGE: {"lever": "spendingMonthly", "value": 6000}'), { text: "Spending $6,000 a month is a change you can try.", asked: { lever: "spendingMonthly", value: 6000 } });
  assert.deepEqual(readReply('Sure.\n```json\nCHANGE: {"lever":"retireAge","value":62,"who":"Bo"}\n```\nThat is all.'), { text: "Sure.\n\nThat is all.", asked: { lever: "retireAge", value: 62, who: "Bo" } }, "a code fence left empty goes with it");
  assert.deepEqual(readReply('Yes.\n**CHANGE:** `{"lever": "inflation", "value": 0.04}`.'), { text: "Yes.", asked: { lever: "inflation", value: 0.04 } }, "marks and a stop around it");
  // a line the app cannot use names no lever ({}): propose then says in one line that nothing was tried
  assert.deepEqual(readReply('Two.\nCHANGE: {"lever":"inflation","value":0.04}\nCHANGE: {"lever":"returnStocks","value":0.05}'), { text: "Two.", asked: {} }, "more than one: none is used, and both lines go");
  assert.deepEqual(readReply("Hm.\nCHANGE: {lever: inflation}"), { text: "Hm.", asked: {} }, "not JSON: nothing is used");
  assert.deepEqual(readReply('Hm.\nCHANGE: {"inflation", 0.04}'), { text: "Hm.", asked: {} });
});

test("#39 test 1: an unknown lever is refused, in one quiet line that says nothing was tried", () => {
  const p = family();
  for (const asked of [null, undefined, "spendingMonthly", [], 7]) assert.equal(propose(p, asked, { today: T }), null, `${JSON.stringify(asked)}: no change named, nothing to say`);
  for (const asked of [{}, { value: 6000 }, { lever: "fee", value: 0.01 }, { lever: "extraSavingMonthly", value: 500 }, { lever: "constructor", value: 1 },
    { lever: "__proto__", value: 1 }, { lever: "toString", value: 1 }, { lever: "lumpSum", value: 1000 }, { lever: "homeYear", value: 2040 }, { lever: "SpendingMonthly", value: 6000 }]) {
    assert.deepEqual(propose(p, asked, { today: T }), { lever: null, refused: UNKNOWN_WORDS }, JSON.stringify(asked));
  }
  assert.equal(UNKNOWN_WORDS, "The app could not turn this into one change it can test, so nothing was tried.");
  assert.deepEqual(Object.keys(ASK), ["spendingMonthly", "retireAge", "claimAge", "stocksNow", "stocksRetired", "returnStocks", "returnBonds", "inflation", "spendingEase", "strategy", "in", "out", "spend", "after", "less", "home"],
    "Scenario compare's levers that its Make this my plan writes, then #1's six kinds");
  for (const k of Object.keys(ASK).slice(0, 10)) assert.ok(LEVERS.some((l) => l.key === k && !l.input && !l.copyOnly), `${k} is a lever Compare writes into the plan`);
});

test("#39 test 2: an out-of-range value is refused, one written sentence per lever", () => {
  const p = family();
  const outside = { spendingMonthly: [0, -5, SPEND_MAX + 1, "lots"], retireAge: [39, 86, 62.5], claimAge: [61, 71, 66.5], stocksNow: [-0.1, 101], stocksRetired: [101], returnStocks: [-0.2, 0.31], returnBonds: [0.25],
    inflation: [-0.01, 0.21], spendingEase: [0.06, -0.01], strategy: ["yolo", 3, "constructor"], in: [0, AMOUNT_CEILING + 1], out: [-100], spend: [0, MONTHLY_CEILING + 1], after: [0, MONTHLY_CEILING + 1], less: [-0.5, 101], home: [-1, AMOUNT_CEILING + 1] };
  for (const [lever, values] of Object.entries(outside)) for (const value of values) {
    assert.deepEqual(propose(p, { lever, value, year: 2040, who: "Bo" }, { today: T }), { lever, refused: RANGE_WORDS[lever] }, `${lever} ${value}`);
  }
  // each says the range and the next step
  assert.equal(RANGE_WORDS.spendingMonthly, "That number is outside what the plan can test ($1 to $100,000 a month). Ask again with another number.");
  assert.equal(RANGE_WORDS.retireAge, "That age is outside what the plan can test (a whole age from 40 to 85). Ask again with another age.");
  assert.equal(RANGE_WORDS.claimAge, "Social Security can start at a whole age from 62 to 70. Ask again with an age in that range.");
  assert.equal(RANGE_WORDS.stocksNow, "A share in stocks is from 0% to 100%. Ask again with another share.");
  assert.equal(RANGE_WORDS.returnStocks, "That number is outside what the plan can test (stocks growing -10% to 30% a year). Ask again with another number.");
  assert.equal(RANGE_WORDS.returnBonds, "That number is outside what the plan can test (bonds growing -10% to 20% a year). Ask again with another number.");
  assert.equal(RANGE_WORDS.inflation, "That number is outside what the plan can test (prices rising 0% to 20% a year). Ask again with another number.");
  assert.equal(RANGE_WORDS.spendingEase, "That number is outside what the plan can test (spending 0% to 5% less each year as you age). Ask again with another number.");
  assert.equal(RANGE_WORDS.strategy, "That is not one of the ways of taking money out the plan knows. Ask again naming one of the ways on How much to take out.");
  assert.equal(RANGE_WORDS.in, "That amount is outside what the plan can test (money coming in of $1 to $100,000,000). Ask again with another amount.");
  assert.equal(RANGE_WORDS.out, "That amount is outside what the plan can test (a cost of $1 to $100,000,000). Ask again with another amount.");
  assert.equal(RANGE_WORDS.spend, "That amount is outside what the plan can test (spending up or down by $1 to $1,000,000 a month). Ask again with another amount.");
  assert.equal(RANGE_WORDS.after, "That amount is outside what the plan can test (pay of $1 to $1,000,000 a month). Ask again with another amount.");
  assert.equal(RANGE_WORDS.less, "The share of the usual pay kept is from 0% to 100%. Ask again with another share.");
  assert.equal(RANGE_WORDS.home, "That price is outside what the plan can test (a next home of $1 to $100,000,000). Ask again with another price.");
  for (const w of Object.values(RANGE_WORDS)) assert.match(w, /Ask again /, "every range sentence has the next step");
  // the other reasons, each its own sentence
  assert.deepEqual(propose(p, { lever: "home", value: 0, year: 2045 }, { today: T }), { lever: "home", refused: "This change was not tried. Selling to rent needs the rent a month: set it on Will the money last? under Things that will happen.", go: "projection" });
  assert.deepEqual(propose(p, { lever: "home", value: 250000 }, { today: T }).refused, "This change was not tried: it needs a year. Ask again with a year from 2026 to 2085, when the plan ends.");
  assert.deepEqual(propose(p, { lever: "spend", value: 500, year: "next year" }, { today: T }).refused, NOT_TRIED.year(2026, 2085));
  assert.deepEqual(propose(p, { lever: "spend", value: 500, year: 2040, until: "later" }, { today: T }).refused, NOT_TRIED.year(2026, 2085));
  assert.equal(propose(p, { lever: "out", value: 40000, year: 2020 }, { today: T }).refused, "This change was not tried. 2020 has passed. Pick a year from 2026 to 2085, when the plan ends.");
  assert.equal(propose(p, { lever: "in", value: 1000, year: 2090 }, { today: T }).refused, "This change was not tried. The plan ends in 2085. Pick a year from 2026 to 2085, when the plan ends.");
  assert.equal(propose(p, { lever: "after", value: 1500, who: "Bo", year: 2045 }, { today: T }).refused, "This change was not tried. Bo is still at work until 2050 in this plan. Pick a year from 2050 on, or change the age on the People page.");
  assert.deepEqual(propose(p, { lever: "retireAge", value: 60, who: "Zed" }, { today: T }), { lever: "retireAge", refused: "This change was not tried: it names someone who is not in the plan. Ask again with the name of someone on the People page.", go: "people" });
  assert.equal(propose(p, { lever: "retireAge", value: 60, who: "Cy" }, { today: T }).refused, NOT_TRIED.stranger, "a child is not an adult of the plan");
  const none = emptyPlan();
  assert.deepEqual(propose(none, { lever: "retireAge", value: 60 }, { today: T }), { lever: "retireAge", refused: "This change was not tried: the plan has no one on the People page yet. Add yourself there first, then ask again.", go: "people" });
  assert.deepEqual(propose(none, { lever: "in", value: 1000 }, { today: T }), { lever: "in", refused: "This change cannot be tried yet. Fill in the basics on Will the money last? first, then ask again.", go: "projection" });
  const noHome = family(); noHome.accounts = noHome.accounts.filter((a) => a.type !== "property");
  assert.equal(propose(noHome, { lever: "home", value: 250000, year: 2045 }, { today: T }).refused, "This change was not tried. The plan has no home to sell. Add it under What you own first.");
});

test("#39 the value as the app reads it: whole dollars, a percentage as a fraction, the who by name, id or 'me'", () => {
  assert.equal(valueOf("$6,000", "money"), 6000); assert.equal(valueOf(5999.6, "money"), 6000); assert.equal(valueOf("six", "money"), null); assert.equal(valueOf(null, "money"), null);
  assert.equal(valueOf(0.05, "rate"), 0.05); assert.equal(valueOf(5, "rate"), 0.05); assert.equal(valueOf("5%", "rate"), 0.05); assert.equal(valueOf("0.5%", "rate"), 0.005); assert.equal(valueOf(-10, "rate"), -0.1);
  assert.equal(valueOf(1, "share"), 1); assert.equal(valueOf(60, "share"), 0.6); assert.equal(valueOf(150, "share"), 150, "above 100 is not a percentage: refused by the range");
  assert.equal(valueOf(62, "age"), 62); assert.equal(valueOf("62", "age"), 62); assert.equal(valueOf(" guardrails ", "way"), "guardrails"); assert.equal(valueOf(3, "way"), null);
  const p = family();
  const who = (w) => propose(p, { lever: "retireAge", value: 60, ...(w === undefined ? {} : { who: w }) }, { today: T }).personId;
  assert.equal(who(undefined), "p-ana", "no one named: the first adult (the person asking)");
  assert.equal(who("Bo"), "p-bo"); assert.equal(who("bo"), "p-bo"); assert.equal(who("p-bo"), "p-bo"); assert.equal(who("me"), "p-ana"); assert.equal(who("Ana Smith"), undefined);
  assert.equal(propose(p, { lever: "retireAge", value: 60, personId: "p-bo" }, { today: T }).personId, "p-bo");
});

test("#39 test 3: the effect is Scenario compare's own (applyChanges and one projection), never a figure of the model's", () => {
  const p = family();
  for (const asked of GOOD) {
    const pr = propose(p, { ...asked, value: asked.value }, { today: T });
    assert.ok(pr && !pr.refused && !pr.already, `${asked.lever}: ${JSON.stringify(pr)}`);
    assert.deepEqual(pr.before, answerOf(p, { today: T }), "against the plan as it is");
    if (pr.changes) {
      assert.deepEqual(pr.with, outcomeOf(applyChanges(p, pr.changes, { today: T }).inputs), asked.lever);
      // the very figures a version with these changes shows on Compare what-ifs
      const c = compare({ ...structuredClone(p), scenarios: [{ id: "v", name: "v", changes: pr.changes }] }, { today: T, paths: 0 });
      const r = c.scenarios[0].results;
      assert.equal(pr.with.lasts, r.success, asked.lever); assert.equal(pr.with.lasts ? null : pr.with.age, r.success ? null : r.failAge); assert.equal(pr.with.endReal, r.endReal, asked.lever);
      assert.equal(pr.before.lasts, c.base.success); assert.equal(pr.before.endReal, c.base.endReal);
    }
    // what the card says is what the plan gives once applied (work after retiring and a spending change have no Compare key)
    const d = structuredClone(p);
    assert.equal(applyProposal(d, pr, { today: T }), true);
    assert.deepEqual(answerOf(d, { today: T }), pr.with, `${asked.lever}: the answer after Apply`);
  }
  // the model's own figures in its reply are never read: only lever and value are
  const pr = propose(p, { lever: "spendingMonthly", value: 6000, lastsTo: 120, effect: "lasts forever" }, { today: T });
  assert.equal(pr.effect, "With this change, the money still lasts to the end, with about $585,000 more left at 95, in today's dollars.");
});

test("#39 Social Security's 'now' is the age the plan counts: the full retirement age when none is saved; someone already paid is not asked", () => {
  // Ana born in 1958 with no claim age saved: the plan (social-security compute, the projection) starts it at 66 and 8 months
  const p = family();
  p.household.people[0].birthDate = "1958-05-05"; p.household.people[0].retirementAge = 68; delete p.retirement.socialSecurity;
  assert.equal(socialSecurity(p, { today: T }).people.find((x) => x.id === "p-ana").claimAge, 66 + 8 / 12);
  assert.equal(propose(p, { lever: "claimAge", value: 70 }, { today: T }).change, "Change: Ana starts Social Security at 70 instead of 66 and 8 months.");
  const at67 = propose(p, { lever: "claimAge", value: 67 }, { today: T });
  assert.equal(at67.already, undefined, "67 is a change from 66 and 8 months, not what the plan has");
  assert.equal(at67.change, "Change: Ana starts Social Security at 67 instead of 66 and 8 months.");
  const d = structuredClone(p); assert.equal(applyProposal(d, at67, { today: T }), true);
  assert.equal(socialSecurity(d, { today: T }).people.find((x) => x.id === "p-ana").claimAge, 67);
  assert.deepEqual(answerOf(d, { today: T }), at67.with, "the card's answer is the plan's once applied");
  // Bo (1988, full age 67): with none saved, 67 is what the plan has
  assert.equal(propose(p, { lever: "claimAge", value: 67, who: "Bo" }, { today: T }).already, ALREADY_WORDS);
  // the retired couple: Ruth already gets it (an Income line), Sam (1957: full age 66 and 6 months) has not claimed
  const rc = migrate(retiredCouplePlan(T));
  assert.deepEqual(propose(rc, { lever: "claimAge", value: 70 }, { today: T }), { lever: "claimAge", refused: "This change was not tried: Ruth already gets Social Security, so the age it starts is set.", go: "ss" });
  assert.equal(propose(rc, { lever: "claimAge", value: 70, who: "Sam" }, { today: T }).change, "Change: Sam starts Social Security at 70 instead of 66 and 6 months.");
  assert.equal(propose(rc, { lever: "claimAge", value: 67, who: "Sam" }, { today: T }).already, undefined);
  // a saved age is the plan's, as before
  assert.equal(propose(family(), { lever: "claimAge", value: 70, who: "Bo" }, { today: T }).change, "Change: Bo starts Social Security at 70 instead of 67.");
});

test("#39 test 4: Apply writes one field (or one line of Things that will happen; three under Get started's own spending figure, said first), and Undo puts the plan back byte for byte", async () => {
  const { takeBack } = await import("../../../core/ui/undo.js");
  const p = family();
  const expect = { spendingMonthly: "retirement.spendingMonthly", retireAge: "household.people.p-ana.retirementAge", claimAge: "retirement.socialSecurity.p-bo.claimAge", stocksNow: "retirement.stocksNow",
    stocksRetired: "retirement.stocksRetired", returnStocks: "assumptions.returnStocks", returnBonds: "assumptions.returnBonds", inflation: "assumptions.inflation", spendingEase: "retirement.spendingEase", strategy: "retirement.strategy" };
  for (const asked of GOOD) {
    const pr = propose(p, asked, { today: T });
    const d = structuredClone(p);
    applyProposal(d, pr, { today: T });
    const ch = changesOf(p, d);
    assert.equal(ch.length, 1, `${asked.lever}: ${JSON.stringify(ch)}`);
    const where = ch[0].path.map((x) => (typeof x === "object" ? x.id : x)).join(".");
    if (expect[asked.lever]) assert.equal(where, expect[asked.lever]);
    else { assert.equal(where, "retirement.happenings"); assert.deepEqual(ch[0].was, undefined); assert.equal(ch[0].now.length, 1); assert.equal(ch[0].now[0].kind, asked.lever); assert.equal(ch[0].now[0].year, asked.year); }
    takeBack(d, ch);
    assert.equal(JSON.stringify(d), JSON.stringify(p), `${asked.lever}: undone, the plan is as before`);
  }
  // nothing to write: the plan already has it, or a refusal
  for (const asked of [{ lever: "spendingMonthly", value: 7000 }, { lever: "inflation", value: 0.03 }, { lever: "retireAge", value: 62, who: "Bo" }, { lever: "strategy", value: "fixed-real" }, { lever: "claimAge", value: 67 }]) {
    const pr = propose(p, asked, { today: T });
    assert.deepEqual(pr, { lever: asked.lever, value: asked.value, already: ALREADY_WORDS }, asked.lever);
    const d = structuredClone(p);
    assert.equal(applyProposal(d, pr, { today: T }), false); assert.equal(JSON.stringify(d), JSON.stringify(p));
  }
  assert.equal(applyProposal(structuredClone(p), propose(p, { lever: "retireAge", value: 20 }, { today: T }), { today: T }), false);
  assert.equal(applyProposal(structuredClone(p), null), false);
  // while the spending figure is Get started's own (retireAuto), Apply also makes it the household's (Compare's lever, as
  // when it is typed on Will the money last?): three fields, which the card says before the tap, and Undo takes all three back
  const auto = family(); auto.guide = { ...(auto.guide ?? {}), setup: { ...(auto.guide?.setup ?? {}), retireAuto: true } };
  const pa = propose(auto, { lever: "spendingMonthly", value: 6000 }, { today: T });
  assert.equal(pa.change, "Change: spend $6,000 a month in retirement instead of $4,570, in today's dollars.", "now: the figure Will the money last? shows");
  assert.equal(pa.note, "Today this figure follows your bills (Get started set it). With this change it stays where you put it, and the plan still adds health insurance on top.");
  const da = structuredClone(auto); applyProposal(da, pa, { today: T });
  const cha = changesOf(auto, da);
  assert.deepEqual(cha.map((c) => c.path.join(".")), ["retirement.spendingMonthly", "guide.setup.retireAuto", "guide.setup.retireHeld"]);
  assert.deepEqual(answerOf(da, { today: T }), pa.with);
  takeBack(da, cha); assert.equal(JSON.stringify(da), JSON.stringify(auto));
  // the figure the box shows, asked again, is what Will the money last?'s own box keeps as Get started's (saveSpendingFigure): already
  assert.equal(propose(auto, { lever: "spendingMonthly", value: 4570 }, { today: T }).already, ALREADY_WORDS);
  const inc = structuredClone(auto); inc.retirement.healthIncluded = true;
  assert.equal(propose(inc, { lever: "spendingMonthly", value: 6000 }, { today: T }).note, AUTO_WORDS.included);
  assert.equal(AUTO_WORDS.included, "Today this figure follows your bills (Get started set it). With this change it stays where you put it, health insurance included, as you said.");
  assert.equal(propose(family(), { lever: "spendingMonthly", value: 6000 }, { today: T }).note, undefined, "a typed figure: one field, no note");
  const both = structuredClone(auto); both.retirement.strategy = "percent";
  assert.equal(propose(both, { lever: "spendingMonthly", value: 6000 }, { today: T }).note, `${SETS_OWN_WORDS} ${AUTO_WORDS.before}`);
});

test("#39 the change in words: one written sentence per lever and case", () => {
  const p = family();
  const say = (asked, plan = p) => propose(plan, asked, { today: T }).change;
  assert.equal(say({ lever: "spendingMonthly", value: 6000 }), "Change: spend $6,000 a month in retirement instead of $7,000, in today's dollars.");
  const fromBills = family(); delete fromBills.retirement.spendingMonthly;
  assert.equal(say({ lever: "spendingMonthly", value: 6000 }, fromBills), "Change: spend $6,000 a month in retirement, in today's dollars, instead of what you spend today.");
  assert.equal(say({ lever: "retireAge", value: 60, who: "Bo" }), "Change: Bo stops work at 60 instead of 62.");
  const me = family(); me.household.people[0].name = "Me";
  assert.equal(say({ lever: "retireAge", value: 60 }, me), "Change: you stop work at 60 instead of 65.");
  assert.equal(say({ lever: "claimAge", value: 70, who: "Bo" }), "Change: Bo starts Social Security at 70 instead of 67.");
  assert.equal(say({ lever: "claimAge", value: 70 }, me), "Change: you start Social Security at 70 instead of 67.");
  assert.equal(say({ lever: "stocksNow", value: 0.6 }), "Change: 60% in stocks now instead of 70%.");
  assert.equal(say({ lever: "stocksRetired", value: 0.4 }), "Change: 40% in stocks once retired instead of 50%.");
  assert.equal(say({ lever: "returnStocks", value: 0.055 }), "Change: stocks grow 5.5% a year instead of 7%.");
  assert.equal(say({ lever: "returnBonds", value: 0.03 }), "Change: bonds grow 3% a year instead of 4%.");
  assert.equal(say({ lever: "inflation", value: 0.04 }), "Change: prices rise 4% a year instead of 3%.");
  assert.equal(say({ lever: "spendingEase", value: 0.01 }), "Change: spend 1% less each year as you age, in today's dollars, instead of the same every year.");
  const eased = family(); eased.retirement.spendingEase = 0.02;
  assert.equal(say({ lever: "spendingEase", value: 0.01 }, eased), "Change: spend 1% less each year as you age, in today's dollars, instead of 2% less.");
  assert.equal(say({ lever: "spendingEase", value: 0 }, eased), "Change: spend the same every year as you age, instead of 2% less each year.");
  assert.equal(say({ lever: "strategy", value: "guardrails" }), 'Change: take money out by "Trim after bad years" instead of "Same spending every year".');
  assert.equal(say({ lever: "in", value: 100000, year: 2035 }), "Change: $100,000 comes into savings in 2035, in today's dollars.");
  assert.equal(say({ lever: "out", value: 40000 }), "Change: a cost of $40,000 comes out of savings in 2026, in today's dollars.", "no year: this year");
  // money in or out once adds to a line of the same kind that year already in the plan, and says so
  const had = family(); applyProposal(had, propose(had, { lever: "in", value: 50000, year: 2030 }, { today: T }), { today: T });
  assert.equal(say({ lever: "in", value: 50000, year: 2030 }, had), "Change: $50,000 more comes into savings in 2030, in today's dollars, on top of the $50,000 already in your plan that year.");
  assert.equal(say({ lever: "in", value: 50000, year: 2031 }, had), "Change: $50,000 comes into savings in 2031, in today's dollars.");
  assert.equal(say({ lever: "out", value: 50000, year: 2030 }, had), "Change: a cost of $50,000 comes out of savings in 2030, in today's dollars.");
  applyProposal(had, propose(had, { lever: "out", value: 20000, year: 2030 }, { today: T }), { today: T });
  assert.equal(say({ lever: "out", value: 5000, year: 2030 }, had), "Change: a cost of $5,000 more comes out of savings in 2030, in today's dollars, on top of the $20,000 already in your plan that year.");
  assert.equal(say({ lever: "spend", value: 500, year: 2056 }), "Change: spending goes up $500 a month from 2056 on, in today's dollars.");
  assert.equal(say({ lever: "spend", value: -300, year: 2056, until: 2060 }), "Change: spending goes down $300 a month 2056 to 2060, in today's dollars.");
  assert.equal(say({ lever: "after", value: 1500, who: "Bo", year: 2052, until: 2054 }), "Change: Bo works after retiring 2052 to 2054: $1,500 a month, in today's dollars.");
  assert.equal(say({ lever: "after", value: 1500, year: 2056 }, me), "Change: you work after retiring in 2056: $1,500 a month, in today's dollars.");
  assert.equal(say({ lever: "less", value: 0.5, who: "Bo", year: 2028, until: 2030 }), "Change: Bo works half-time 2028 to 2030.");
  assert.equal(say({ lever: "less", value: 0, year: 2028 }), "Change: Ana takes a break from work in 2028.");
  assert.equal(say({ lever: "less", value: 0.6, who: "Bo", year: 2028 }), "Change: Bo works for 60% of the usual pay in 2028.");
  assert.equal(say({ lever: "home", value: 250000, year: 2045 }), "Change: sell the home in 2045 and buy one for $250,000, in today's dollars.");
  const sold = family(); sold.retirement.happenings = [{ id: "h1", kind: "home", year: 2050, buyFor: 300000 }];
  assert.equal(say({ lever: "home", value: 250000, year: 2045 }, sold), "Change: sell the home in 2045 and buy one for $250,000, in today's dollars, in place of the home sale already in the plan.");
  const d = structuredClone(sold); applyProposal(d, propose(sold, { lever: "home", value: 250000, year: 2045 }, { today: T }), { today: T });
  assert.deepEqual(d.retirement.happenings.filter((h) => h.kind === "home").map((h) => [h.id, h.year, h.buyFor]), [["h1", 2045, 250000]], "one home: the plan's own line is replaced");
  assert.equal(changeWords(p, { lever: "nope", value: 1 }), "");
});

test("#39 what it does, in words: one written sentence per case, the answer of Will the money last? at average markets", () => {
  const out = (age) => ({ lasts: false, age, endAge: 95, endReal: 0 });
  const lasts = (endReal, endAge = 95) => ({ lasts: true, age: null, endAge, endReal });
  assert.equal(effectWords(null, out(87)), "What it does cannot be worked out yet. Fill in the basics on Will the money last? first, then ask again.");
  assert.equal(effectWords(out(91), null), BASICS_WORDS);
  // about the money, never read as the age work stops
  assert.equal(effectWords(out(91), out(87)), "With this change, you would run out of money at 91 instead of 87.");
  assert.equal(effectWords(out(84), out(87)), "With this change, you would run out of money at 84 instead of 87.");
  assert.equal(effectWords(out(87), out(87)), "With this change, you would still run out of money at 87.");
  assert.equal(effectWords(lasts(1000), out(87)), "With this change, the money would last to the end (age 95) instead of running out at 87.");
  assert.equal(effectWords(out(88), lasts(1000)), "With this change, you would run out of money at 88 instead of it lasting to the end (age 95).");
  assert.equal(effectWords(lasts(540000), lasts(500000)), "With this change, the money still lasts to the end, with about $40,000 more left at 95, in today's dollars.");
  assert.equal(effectWords(lasts(460000), lasts(500000)), "With this change, the money still lasts to the end, with about $40,000 less left at 95, in today's dollars.");
  assert.equal(effectWords(lasts(500040), lasts(500000)), "With this change, the money still lasts to the end, with about the same left at 95.");
  assert.equal(doneWords(null), "Done. Will the money last? shows what it does once the plan has a few basics.");
  assert.equal(doneWords(out(91)), "Done. If markets do about average, you now run out of money at 91.");
  assert.equal(doneWords(lasts(1, 97)), "Done. If markets do about average, the money now lasts to the end (age 97).");
  assert.equal(doneWords(lasts(1455760)), "Done. If markets do about average, the money now lasts to the end (age 95), with about $1,456,000 left in today's dollars.");
  // plain words: no "average markets", the helper "suggested"
  assert.equal(TRUST_WORDS, "Worked out by the app from your plan, assuming markets do about average. The helper only suggested the change.");
  assert.equal(UNDONE_WORDS, "Undone. Your plan is as it was before this change.");
  assert.equal(ALREADY_WORDS, "Your plan already has this, so there is nothing to change.");
  // a plan that cannot be run yet: the change and the next step, and nothing to apply
  const bare = emptyPlan(); bare.household.people = [{ id: "me", name: "Me", role: "self" }];
  const pr = propose(bare, { lever: "retireAge", value: 60 }, { today: T });
  assert.deepEqual(pr, { lever: "retireAge", value: 60, personId: "me", now: 65, change: "Change: you stop work at 60 instead of 65.", effect: BASICS_WORDS, basics: true, go: "projection" });
  assert.equal(applyProposal(structuredClone(bare), pr, { today: T }), false);
  assert.equal(applyProposal(structuredClone(bare), { ...pr, changes: { "retireAge:me": 60 } }, { today: T }), false, "basics never writes, whatever else it carries");
  // a way of taking money out that sets its own spending: a change of spending says so
  const share = family(); share.retirement.strategy = "percent";
  assert.equal(propose(share, { lever: "spendingMonthly", value: 6000 }, { today: T }).note, SETS_OWN_WORDS);
  assert.equal(propose(share, { lever: "spend", value: 500, year: 2056 }, { today: T }).note, "Your way of taking money out sets spending from what is saved, so a change of spending does little here (How much to take out).");
  assert.equal(propose(share, { lever: "inflation", value: 0.04 }, { today: T }).note, undefined);
  assert.equal(propose(family(), { lever: "spendingMonthly", value: 6000 }, { today: T }).note, undefined);
});

test("#39 the model is told the levers and the one line, and no figure of the plan", () => {
  const p = family();
  const c = changesContext(p);
  for (const k of Object.keys(ASK)) assert.match(c, new RegExp(`^- ${k}\\b`, "m"), k);
  assert.match(c, /CHANGE: \{"lever": "<a name from the list>", "value": <a number, or the word for strategy>\}/);
  assert.match(c, /\(Ana, Bo\)/, "the adults' first names, as in the plan's summary; never a child");
  assert.doesNotMatch(c, /Cy|7,?000|1990|p-ana/, "no figure, date or id of the plan");
  assert.doesNotMatch(changesContext(emptyPlan()), /\(\)/);
});

// ---- the page: a pretend model reply, never a network call
async function page(plan0, { reply = "", off = false } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const s = { p: plan0, saved: [], root: null, textOf, sent: [], draws: 0 };
  const route = { group: "ai", id: "assistant", rest: [], query: {} };
  const ai = {
    settings: async () => ({ provider: off ? "none" : "ollama", model: "test-helper", source: "device" }),
    models: async () => ["test-helper"],
    chat: async (messages) => { s.sent.push(messages); return { content: typeof reply === "function" ? reply(messages) : reply }; },
  };
  let later = null;
  const soon = () => { clearTimeout(later); later = setTimeout(() => s.draw(), 0); };   // the shell's redraw after a save
  s.draw = () => {
    s.draws++;
    s.root = new FakeElement("main");
    render(s.root, { ui, fmt: { ...fmt, today: () => T }, plan: s.p, route, module: { group: "ai", id: "assistant" }, modules: new Map(), derived: compute(s.p), ai,
      store: { get: () => s.p, update: (fn) => { const d = structuredClone(s.p); fn(d); s.saved.push(d); s.p = d; soon(); } }, redraw: soon });
  };
  s.draw();
  s.settle = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };
  await s.settle();
  s.find = (pred, within = s.root) => within.all().find(pred);
  s.button = (text, within = s.root) => s.find((e) => e.tagName === "BUTTON" && e.textContent === text, within);
  s.cards = () => s.root.all().filter((e) => e.dataset?.change !== undefined);
  s.ask = async (q) => { s.root.all().find((e) => e.tagName === "TEXTAREA").value = q; s.button("Send").click(); await s.settle(); };
  return s;
}
const SAY = 'Spending $6,000 a month in retirement is one thing you can try.\n\nCHANGE: {"lever": "spendingMonthly", "value": 6000}';

test("#39 test 5: with the helper off there is no card and nothing is asked; a reply that names no change shows no card", async () => {
  const off = await page(family(), { off: true, reply: SAY });
  assert.equal(off.cards().length, 0);
  assert.equal(off.sent.length, 0, "nothing goes to a helper that is off");
  assert.match(off.textOf(off.root), /The AI helper is turned off in Settings\./);
  assert.equal(off.button("Send").disabled, true);
  const plain = await page(family(), { reply: "Your emergency fund page shows that. See Emergency fund." });
  await plain.ask("Is my emergency fund big enough?");
  assert.equal(plain.cards().length, 0);
  assert.equal(plain.saved.length, 0);
  assert.equal(plain.root.all().filter((e) => /\bmsg\b/.test(e.className)).length, 2, "the question and the answer, as before");
  // the system message carries the levers, after the rules and before the pages and the plan's summary
  const sys = plain.sent[0][0].content;
  assert.ok(sys.startsWith(SYSTEM_PROMPT) && sys.indexOf("CHANGES:") < sys.indexOf("PLAN CONTEXT:"));
});

test("#39 the card: what changes and what it does, Apply outlined, one store.update, a green line with Undo; the chat outlives the redraw", async () => {
  const { structure, handWritten, isFilled } = await import("../../../qa/first-view-lib.mjs");
  const p0 = family();
  const s = await page(p0, { reply: SAY });
  await s.ask("What if we spend $6,000 a month?");
  const [card] = s.cards();
  assert.equal(card.dataset.change, "open");
  const text = s.textOf(card);
  assert.equal(text, "Change: spend $6,000 a month in retirement instead of $7,000, in today's dollars. With this change, the money still lasts to the end, with about $585,000 more left at 95, in today's dollars. Worked out by the app from your plan, assuming markets do about average. The helper only suggested the change. Apply No thanks");
  for (const b of ["Apply", "No thanks"]) assert.match(s.button(b, card).className, /\bsecondary\b/, `${b} is outlined`);
  assert.equal(s.saved.length, 0, "showing the card writes nothing");
  // the page's folds are the helper's parts, no hand-written <details>; the one finding is the owner's own fold: after the first
  // question the four suggestions fold behind "Suggestions" (design log 2026-09-15, round 7, A), fewer words than R14's forty
  assert.deepEqual([...structure(s.root, { key: "ai/assistant" }), ...handWritten(s.root)], [{ id: "S7", what: '"Suggestions" holds 0 figures, 0 rows, 23 words: show it instead' }]);
  assert.ok(!s.root.all().some((e) => e.dataset?.change !== undefined && e.all().some((b) => isFilled(b))), "no filled button in the card");
  s.button("Apply", card).click();
  await s.settle();
  assert.equal(s.saved.length, 1, "one store.update");
  assert.deepEqual(changesOf(p0, s.p).map((c) => c.path.join(".")), ["retirement.spendingMonthly"]);
  assert.equal(s.p.retirement.spendingMonthly, 6000);
  const done = s.cards()[0];
  assert.equal(done.dataset.change, "applied");
  const green = s.find((e) => /\bnotice\b/.test(e.className) && /\bok\b/.test(e.className), done);
  assert.equal(s.textOf(green), "Done. If markets do about average, the money now lasts to the end (age 95), with about $1,456,000 left in today's dollars. Undo");
  // Undo lives while the page is open; the line says so and where the figure is kept after that
  assert.equal(s.textOf(done), "Change: spend $6,000 a month in retirement instead of $7,000, in today's dollars. Done. If markets do about average, the money now lasts to the end (age 95), with about $1,456,000 left in today's dollars. Undo Undo stays here until you leave this page. After that, change it here: Will the money last? ›");
  assert.equal(s.find((e) => e.tagName === "A", done).textContent, "Will the money last?\u00a0›", "the arrow never wraps alone");
  assert.equal(s.find((e) => e.tagName === "A", done).getAttribute("href"), "#/retirement/projection");
  assert.equal(s.root.all().filter((e) => /\bmsg\b/.test(e.className)).length, 2, "the question and the answer are still there after the redraw");
  assert.ok(s.draws >= 2);
  // a second question in the same chat: the helper hears the whole conversation
  s.button("Undo", done).click();
  await s.settle();
  assert.equal(s.saved.length, 2);
  assert.equal(JSON.stringify(s.p), JSON.stringify(p0), "Undo puts the plan back exactly");
  assert.equal(s.textOf(s.cards()[0]), `Change: spend $6,000 a month in retirement instead of $7,000, in today's dollars. ${UNDONE_WORDS}`);
  await s.ask("Thanks");
  assert.equal(s.sent.at(-1).filter((m) => m.role !== "system").length, 3, "the earlier question and answer go along");
  assert.match(s.sent.at(-1)[2].content, /^CHANGE:|CHANGE: \{/m, "the helper sees its own line, as it wrote it");
});

test("#39 No thanks closes the card and writes nothing; a refused change says why in one quiet line", async () => {
  const s = await page(family(), { reply: SAY });
  await s.ask("What if we spend $6,000 a month?");
  s.button("No thanks", s.cards()[0]).click();
  await s.settle();
  assert.equal(s.cards().length, 0); assert.equal(s.saved.length, 0);
  s.draw(); await s.settle();
  assert.equal(s.cards().length, 0, "it stays closed when the page is drawn again");
  const r = await page(family(), { reply: 'Ten million a month sounds nice.\nCHANGE: {"lever": "spendingMonthly", "value": 10000000}' });
  await r.ask("What if I spend ten million a month?");
  assert.deepEqual(r.cards().map((e) => [e.dataset.change, r.textOf(e), e.className]), [["refused", "That number is outside what the plan can test ($1 to $100,000 a month). Ask again with another number.", "muted small"]]);
  assert.equal(r.button("Apply"), undefined);
  // a reason with a next step on another page links there
  const who = await page(family(), { reply: 'Zed could stop early.\nCHANGE: {"lever": "retireAge", "value": 60, "who": "Zed"}' });
  await who.ask("What if Zed stops at 60?");
  assert.equal(who.textOf(who.cards()[0]), NOT_TRIED.stranger, "the page named in the sentence is the link");
  const toPeople = who.find((x) => x.tagName === "A", who.cards()[0]);
  assert.equal(toPeople.getAttribute("href"), "#/household/people"); assert.equal(who.textOf(toPeople), "People");
  // a plan that cannot be run yet: the change, why nothing can be checked, where to start; no Apply, nothing written
  const e = await page(emptyPlan(), { reply: 'You could plan on $3,000.\nCHANGE: {"lever": "spendingMonthly", "value": 3000}' });
  await e.ask("What if I spend $3,000 a month?");
  const [basics] = e.cards();
  assert.equal(basics.dataset.change, "basics");
  assert.equal(e.textOf(basics), "Change: spend $3,000 a month in retirement, in today's dollars, instead of what you spend today. What it does cannot be worked out yet. Fill in the basics on Will the money last? first, then ask again.");
  const toProjection = e.find((x) => x.tagName === "A", basics);
  assert.equal(toProjection.getAttribute("href"), "#/retirement/projection"); assert.equal(e.textOf(toProjection), "Will the money last?");
  assert.equal(e.button("Apply"), undefined); assert.equal(e.button("No thanks"), undefined);
  assert.equal(e.saved.length, 0);
  // an unknown lever, or a line the app cannot read: one quiet line, no buttons
  for (const line of ['CHANGE: {"lever": "fee", "value": 0.01}', "CHANGE: {fee: 1}", 'CHANGE: {"lever": "inflation", "value": 0.04}\nCHANGE: {"lever": "returnStocks", "value": 0.05}']) {
    const u = await page(family(), { reply: `Fees matter.\n${line}` });
    await u.ask("What if I pay a 1% fee?");
    assert.deepEqual(u.cards().map((x) => [x.dataset.change, u.textOf(x)]), [["refused", UNKNOWN_WORDS]], line);
    assert.equal(u.button("Apply"), undefined);
  }
});

test("#39 a plan the page cannot read draws the chat without a card, never a broken page", async () => {
  const odd = family(); odd.retirement.happenings = "oops";   // (the same data already stops Will the money last? itself)
  for (const [bad, line] of [[odd, '{"lever": "home", "value": 300000, "year": 2035}']]) {
    assert.throws(() => propose(bad, JSON.parse(line), { today: T }), "the stored data really is unreadable here");
    const s = await page(bad, { reply: `Worth a look.\nCHANGE: ${line}` });
    await s.ask("What if?");
    assert.equal(s.cards().length, 0);
    assert.equal(s.root.all().filter((e) => /\bmsg\b/.test(e.className)).length, 2, "the question and the answer are drawn");
    s.draw(); await s.settle();
    assert.equal(s.root.all().filter((e) => /\bmsg\b/.test(e.className)).length, 2, "and drawn again");
  }
});

test("#39 every lever names the page that keeps its figure, so it can be changed once Undo has gone", () => {
  assert.deepEqual(Object.keys(WHERE), Object.keys(ASK));
  for (const k of Object.values(WHERE)) assert.ok(PAGES[k], k);
  const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
  for (const [k, pg] of Object.entries(PAGES)) {
    const route = pg.href.replace(/^#\//, "");
    const m = fs.readFileSync(path.join(ROOT, "modules", route, "module.js"), "utf8");
    assert.match(m, new RegExp(`title: "${pg.title.replace(/[?]/g, "\\?")}"`), `${k}: the page's own title`);
    assert.match(m, /status: "usable"/, `${k}: a page that is there`);
  }
  assert.equal(LATER_WORDS, "Undo stays here until you leave this page. After that, change it here:");
});

test("#39 invariance: no new field; every plan reads, sums and summarises exactly as before, and trying a change never touches the plan", async () => {
  const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
  const all = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) all.push([`fixture ${f}:${name}`, migrate(fn(T))]);
  }
  for (const a of ARCHETYPES) all.push([a.id, migrate(a.build())]);
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") all.push([`phone ${name}`, migrate(fn())]);
  all.push(["empty plan", emptyPlan()]);
  assert.ok(all.length >= 20);
  for (const [name, plan] of all) {
    const before = JSON.stringify(plan), summary = JSON.stringify(compute(plan)), answer = JSON.stringify(answerOf(plan, { today: T }));
    for (const asked of [...GOOD, { lever: "retireAge", value: 30 }, { lever: "fee", value: 0.01 }]) {
      const pr = propose(plan, asked, { today: T });
      assert.ok(pr === null || typeof pr === "object", name);
      for (const k of ["change", "effect", "refused", "already"]) if (pr?.[k] !== undefined) assert.doesNotMatch(pr[k], /undefined|NaN|null|\[object/, `${name} ${asked.lever}: ${pr[k]}`);
    }
    assert.equal(JSON.stringify(plan), before, `${name}: trying changes never touches the plan`);
    assert.deepEqual(Object.keys(compute(plan)), ["summary", "chars"]);
    assert.equal(JSON.stringify(compute(plan)), summary, name);
    assert.equal(JSON.stringify(answerOf(plan, { today: T })), answer, name);
  }
});

test("S11: #39 after Apply only the applied card changes: the other cards stay open as they were, the folds stay shut", async () => {
  const replies = [SAY, 'Prices rising faster is worth a look.\nCHANGE: {"lever": "inflation", "value": 0.04}'];
  const s = await page(family(), { reply: () => replies.shift() });
  await s.ask("What if we spend $6,000 a month?");
  await s.ask("And if prices rise 4% a year?");
  const before = s.cards().map((e) => [e.dataset.change, s.textOf(e).split(". ")[0]]);
  assert.deepEqual(before, [["open", "Change: spend $6,000 a month in retirement instead of $7,000, in today's dollars"], ["open", "Change: prices rise 4% a year instead of 3%"]]);
  const shut = () => s.root.all().filter((e) => e.tagName === "DETAILS").map((d) => [d.dataset.part, d.hasAttribute("open")]);
  assert.deepEqual(shut(), [["suggestions", false]]);
  s.button("Apply", s.cards()[1]).click();
  await s.settle();
  assert.equal(s.saved.length, 1);
  assert.deepEqual(s.cards().map((e) => [e.dataset.change, s.textOf(e).split(". ")[0]]), [before[0], ["applied", "Change: prices rise 4% a year instead of 3%"]]);
  assert.ok(s.button("Apply", s.cards()[0]), "the first card can still be applied");
  assert.match(s.textOf(s.cards()[0]), /With this change, the money/, "its effect is worked out again against the plan as it is now");
  assert.deepEqual(shut(), [["suggestions", false]], "no part opened or shut");
});
