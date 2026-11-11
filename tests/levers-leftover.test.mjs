// tests/levers-leftover.test.mjs -- the money left over each month, after the review of 2026-11-12 (findings named by the
// critics' ids). The left-over is the Dashboard's own figure (M1); a row into the bank is money that stays in checking and savings
// (M3); a row above what is left over, or into an account that is gone, is said and put right in one tap (B3, B7); the answer
// after a save never says "still" over an answer that lasts, and never a "was" the page did not say (P6, M7). Invented
// households: the phone-built ones, the 14 qa households, the family, Sam.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as LV from "../modules/retirement/levers.js";
import * as C from "../modules/retirement/contributions/compute.js";
import { buildInputs, BUCKET_OF } from "../modules/retirement/projection/compute.js";
import { migrate } from "../core/schema/migrate.js";
import { perYear } from "../core/math/periods.js";
import { isGuess } from "../core/estimate/index.js";
import { compute as nbaCompute } from "../modules/overview/next-best-action/compute.js";
import { compute as benchmarks } from "../modules/overview/benchmarks/compute.js";
import { compute as liquidity } from "../modules/balance/liquidity/compute.js";
import { yearSavingWords } from "../core/math/leftover.js";
import { danaLee, jamie, casey, robin, morgan } from "../qa/fixtures/phone-households.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";

const T = "2026-11-11";
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const nba = (plan) => nbaCompute(structuredClone(plan), { today: T });
const spareOf = (plan) => { const n = nba(plan); return n.ready ? n.spare : null; };
const rowsOf = (plan) => LV.leverRows(plan, { today: T, spare: spareOf(plan) });
const all = (r) => [...r.shown, ...r.folded, ...r.hidden];
const leftRow = (plan) => all(rowsOf(plan)).find((x) => x.key === "leftover");
const household = (id) => migrate(ARCHETYPES.find((a) => a.id === id).build());
const answer = (plan, opts) => { const p = structuredClone(plan); LV.applyLeftover(p, { today: T, ...opts }); return p; };
const invest = (plan, row, amount = row.amount) => answer(plan, { answer: "invest", monthly: row.total, amount, personId: row.leadId, newAccount: { id: "n-inv", name: "Investments for later", type: "brokerage" } });
const bank = (plan, row, amount = row.amount) => answer(plan, { answer: "bank", monthly: row.total, amount, personId: row.leadId, newAccount: { id: "n-bank", name: "Savings for later", type: "savings" } });
const bill = (plan, amount) => { const p = structuredClone(plan); p.expenses.push({ id: `bill-${amount}`, name: "A new bill", amount, period: "monthly", category: "other", essential: true }); return p; };

// ---- M1: the left-over is the Dashboard's ----
test("M1: the left-over row is Next best action's left-over, after the goal saving (the Dashboard's figure); investing the prefilled amount leaves the month $0 to $10 ahead", () => {
  for (const [name, plan] of [["02-couple-no-kids", household("02-couple-no-kids")], ["family", migrate(familyPlan(T))], ["01-single-adult", household("01-single-adult")]]) {
    const sp = spareOf(plan);
    assert.ok(sp.goalSaving > 0, `${name}: saves for goals`);
    const row = leftRow(plan);
    assert.ok(row, `${name}: a left-over row`);
    assert.ok(Math.abs(row.total - sp.monthly) < 0.005, `${name}: the row is the month's own ${sp.monthly}, not ${row.total}`);
    assert.equal(row.value.split(" a month")[0], money(sp.monthly), name);
    assert.equal(row.amount, Math.floor(sp.monthly / 10) * 10, `${name}: the prefilled amount`);
    const after = nba(invest(plan, row));
    assert.ok(after.spare.monthly >= 0 && after.spare.monthly < 10, `${name}: the month after is ${after.spare.monthly}`);
    assert.equal(after.steps.find((s) => s.id === "bills")?.status, nba(plan).steps.find((s) => s.id === "bills")?.status, `${name}: "Spend less than you bring in" stands as it did`);
    assert.ok(Math.abs(after.spare.goalSaving - sp.goalSaving) < 0.005, `${name}: the goal money is still the goals'`);
  }
});

test("M1: a month that is short has no left-over row and nothing 'not counted' about it, whatever the goals take (07, 12)", () => {
  for (const id of ["07-multigenerational", "12-high-net-worth"]) {
    const plan = household(id), sp = spareOf(plan);
    assert.ok(sp.monthly < LV.LEFTOVER_MIN && sp.monthly + sp.goalSaving >= LV.LEFTOVER_MIN, `${id}: short after the goals, not before them`);
    const list = LV.leverList(plan, { today: T, spare: sp });
    assert.equal(list.rows.some((x) => x.key === "leftover"), false, id);
    assert.doesNotMatch(LV.restsOnWords(list), /left over/, id);
  }
});

test("M1: uneven pay counts at what the plan counts on (spare.monthly), not at the month all of it comes in (spare.full)", () => {
  const plan = migrate(jamie());
  plan.income.push({ id: "side-1", name: "Weekend repairs", type: "business", amount: 1000, period: "monthly", personId: plan.household.people[0].id, countOn: 400 });
  const sp = spareOf(plan);
  assert.ok(sp.held > 100 && sp.full > sp.monthly + 100, "some of the uneven pay is held back");
  const row = leftRow(plan);
  assert.ok(Math.abs(row.total - sp.monthly) < 0.005);
  assert.ok(nba(invest(plan, row)).spare.monthly >= 0);
});

// ---- M3: in the bank is not retirement saving ----
test("M3: a row into a checking or savings account is in no sum of retirement saving; the bucket list and the account test agree", () => {
  for (const [type, bucket] of Object.entries(BUCKET_OF)) assert.equal(C.isBankAccount({ type }), bucket === "cash", type);
  const p = migrate(morgan()), row = leftRow(p);
  const q = bank(p, row, 530);
  const before = C.compute(p, { today: T }), after = C.compute(q, { today: T });
  assert.deepEqual([after.yearly, after.matchYearly, after.totalYearly], [before.yearly, before.matchYearly, before.totalYearly]);
  assert.equal(after.bankYearly, 530 * 12);
  assert.equal(after.items.find((i) => i.id === "leftover-1").bank, true);
  assert.deepEqual(after.byPerson.map((x) => x.yearly), before.byPerson.map((x) => x.yearly));
  // invested, it is saving out of pay
  assert.equal(C.compute(invest(p, row, 530), { today: T }).yearly, before.yearly + 530 * 12);
});

test("M3: Morgan's 'It stays in the bank': the Dashboard's year line, the left-over, the emergency fund's date and the saving rate stay; the retirement answer counts it", () => {
  const p = migrate(morgan()), row = leftRow(p);
  const q = bank(p, row, 530);
  const a = nba(p), b = nba(q);
  assert.ok(Math.abs(a.spare.monthly - b.spare.monthly) < 0.005, "the month's left-over is unchanged");
  assert.equal(yearSavingWords(b.spare, money), yearSavingWords(a.spare, money));
  assert.match(yearSavingWords(b.spare, money), /^About \$6,400 a year builds up in checking and savings\.$/);
  const dates = (n) => n.steps.map((s) => [s.id, s.status, s.doneDate ?? null, s.startDate ?? null]);
  assert.deepEqual(dates(b), dates(a), "no step loses its date");
  assert.ok(a.steps.some((s) => s.doneDate), "there are dated steps to keep");
  const rate = (plan) => benchmarks(plan, { today: T }).items.find((x) => x.id === "saving-rate");
  assert.equal(rate(q).you, rate(p).you, "Benchmarks' saving rate is unchanged");
  assert.match(rate(q).sentence, /^\$0 a year goes into retirement accounts, employer money included: 0% of pay\./);
  assert.equal(liquidity(q, { today: T }).gap, liquidity(p, { today: T }).gap);
  // the projection counts it, in the cash bucket (said = done: the card's own effect)
  assert.deepEqual(LV.answerOf(q, { today: T }), row.outs[1]);
  assert.notDeepEqual(LV.answerOf(q, { today: T }), LV.answerOf(p, { today: T }));
  // the card after: the answer, the whole left-over still there to see, nothing counted twice
  const r2 = leftRow(q);
  assert.equal(r2.value, "$530 a month into Savings for later, kept in the bank (you said so)");
  assert.ok(Math.abs(r2.total - a.spare.monthly) < 0.005, "the left-over the question is about is the month's own, the row is not added on top");
  // invested instead, the month's left-over drops by it
  assert.ok(Math.abs(nba(invest(p, row, 530)).spare.monthly - (a.spare.monthly - 530)) < 0.005);
});

// ---- B3: a row above what is left over ----
test("B3: a bill added after 'Invested for later' makes the row more than is left over: said, 'Lower it', never 'Still right'", () => {
  const p = migrate(danaLee()), row = leftRow(p);
  assert.equal(row.amount, 1820);
  const q = invest(p, row);
  assert.equal(leftRow(q).ask, undefined, "answered and right");
  for (const [amount, lowered] of [[100, 1720], [300, 1520], [700, 1120]]) {
    const r = leftRow(bill(q, amount));
    assert.equal(r.ask, true, `$${amount}: asked`);
    assert.equal(r.value, `You said $1,820 a month is invested; only ${money(1828.4 - amount)} is left over now.`);
    assert.deepEqual(r.acts.map((x) => x.label), [`Lower it to ${money(lowered)}`, "Answer again"]);
    assert.equal(r.acts[0].lower, lowered);
    assert.ok(!r.acts.some((x) => x.keep), "no 'Still right'");
    assert.match(r.effects.join(" "), new RegExp(`^Lowered to \\$${lowered.toLocaleString("en-US")} a month: .+ As it is counted now: `));
    // said = done: the lowered row is the card's effect, and the month is no longer short
    const low = structuredClone(bill(q, amount)); LV.lowerLeftover(low, lowered, { today: T, total: r.total });
    assert.deepEqual(LV.answerOf(low, { today: T }), r.outs[0]);
    assert.equal(low.retirement.contributions.find((c) => c.id === "leftover-1").amount, lowered);
    assert.ok(nba(low).spare.monthly >= 0 && nba(low).spare.monthly < 10);
    assert.equal(leftRow(low).ask, undefined, "right again");
  }
});

test("B3: with nothing left over the one offer is to stop counting it; that takes the row and the answer out", () => {
  const p = migrate(danaLee()), row = leftRow(p);
  const q = bill(invest(p, row), 2500);
  const r = leftRow(q);
  assert.equal(r.value, "You said $1,820 a month is invested; nothing is left over now.");
  assert.deepEqual(r.acts.map((x) => [x.label, x.lower]), [["Stop counting it", 0]]);
  const gone = structuredClone(q); LV.lowerLeftover(gone, 0, { today: T, total: r.total });
  assert.equal(gone.retirement.leftover, undefined);
  assert.equal(gone.retirement.contributions.some((c) => c.id === "leftover-1"), false);
  assert.deepEqual(LV.answerOf(gone, { today: T }), LV.answerOf(bill(p, 2500), { today: T }));
  // the same for a row into the bank: the month's left-over is what it is, the row may not be more than it
  const b = leftRow(bill(bank(p, row), 700));
  assert.equal(b.value, "You said $1,820 a month is kept in the bank; only $1,128 is left over now.");
  assert.equal(b.acts[0].label, "Lower it to $1,120");
});

// ---- B7: the account the row went into is gone ----
test("B7: the account deleted on Net worth: the card says the row is still counted, asks again, and 'Stop counting it' gives the answer from before", () => {
  const p = migrate(danaLee()), row = leftRow(p);
  const q = invest(p, row);
  q.accounts = q.accounts.filter((a) => a.id !== "n-inv");
  assert.equal(LV.leftoverAnswer(q).lost, true);
  const r = leftRow(q);
  assert.equal(r.ask, true);
  assert.equal(r.value, "$1,820 a month is still counted as invested, but the account it went into is no longer on Net worth.");
  assert.deepEqual(r.acts.map((x) => x.label), ["Stop counting it", "Answer again"]);
  assert.match(r.effects.join(" "), /^No longer counted: .+ As it is counted now: /);
  const gone = structuredClone(q); LV.lowerLeftover(gone, 0, { today: T, total: r.total });
  assert.deepEqual(LV.answerOf(gone, { today: T }), LV.answerOf(p, { today: T }), "the answer from before the left-over was answered");
  assert.deepEqual(r.outs[0], LV.answerOf(p, { today: T }), "and the card said so");
});

// ---- P6, M7: the words after a save ----
test("P6, M7: an answer that lasts both times is never 'still'; after 'We don't know yet' only the new answer is said", () => {
  const out = (age) => ({ lasts: false, age, endAge: 95, endReal: 0 }), last = (endReal) => ({ lasts: true, age: null, endAge: 95, endReal });
  assert.equal(LV.answerChangeWords(last(100000), last(1265000)), "lasts to the end, with about $1,165,000 more left at 95 (today's dollars)");
  assert.equal(LV.answerChangeWords(last(1265000), last(100000)), "lasts to the end, with about $1,165,000 less left at 95 (today's dollars)");
  assert.equal(LV.answerChangeWords(last(100000), last(100040)), "lasts to the end, with about the same left at 95");
  assert.equal(LV.answerChangeWords(last(100000), last(100040), undefined, { still: false }), "");
  assert.equal(LV.answerChangeWords(out(65), last(5000), undefined, { unknown: true }), "now lasts to the end (age 95)");
  assert.equal(LV.answerChangeWords(null, out(70), undefined, { unknown: true }), "now runs out at 70");
  assert.equal(LV.answerChangeWords(out(70), out(70)), "still runs out at 70", "an answer that runs out both times can be 'still'");
});


// ---- the final review (2026-11-13), F4: a fold on the card says what of the person's it holds ----
test("F4: the card's \"N more numbers\" fold counts the person's own numbers in it; folded on track, the card's line names one not counted yet", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const view = new URL("../modules/retirement/projection/view.js", import.meta.url).href;
  const cOf = { "overview/next-best-action": nbaCompute };
  const draw = async (plan) => {
    const r = await renderPage(view, plan, T, { computeOf: cOf });
    for (let i = 0; i < 200 && r.root.querySelector(".lv-rows")?.getAttribute("aria-busy"); i++) await new Promise((ok) => setTimeout(ok, 50));
    return r;
  };
  // Jamie with growth 6% and prices 3.5% saved on Assumptions on an earlier visit: both fold, and the fold's line says so
  const j = migrate(jamie());
  j.assumptions.returnStocks = 0.06;
  j.assumptions.inflation = 0.035;
  await draw(structuredClone(j));   // (the page remembers the last answer it drew: this visit changes nothing)
  const r = await draw(structuredClone(j));
  const fold = r.root.querySelector(".lv").querySelectorAll("details").find((x) => /more numbers?/.test(x.textContent));
  const inFold = fold.querySelectorAll("li").map((li) => li.getAttribute("data-lever"));
  assert.ok(inFold.includes("growth") && inFold.includes("prices"), JSON.stringify(inFold));
  const yours = fold.querySelectorAll("li").filter((li) => li.querySelector(".pill")?.textContent === LV.TAGS.yours).length;
  assert.ok(yours >= 2);
  assert.equal(fold.querySelector("summary").textContent, `${inFold.length} more numbers, ${yours} you gave us›`);
  // the family is on track: the whole card is a fold, and it holds the money left over, not counted yet
  const f = migrate(familyPlan());
  const list = LV.leverList(f, { today: T, spare: spareOf(f) });
  const missing = list.rows.filter((x) => x.tag === "missing").length;
  assert.ok(missing >= 1, "the family's left-over is not counted yet");
  const rf = await renderPage(view, f, T, { computeOf: cOf });
  const card = rf.root.querySelector(".lv");
  assert.equal(card.tagName, "DETAILS", "folded on track");
  assert.equal(card.querySelector("summary").textContent, `What this answer rests on${missing} not counted›`);
});
