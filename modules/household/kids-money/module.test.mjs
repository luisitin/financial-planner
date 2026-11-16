// Tests for household/kids-money (gap list, next 60, item 57): every formula, one test per sentence case, the page simple
// first on the stand-in DOM, and the invariance check (the new optional fields change no other page's figure).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compute, childrenOf, moneyOf, monthlyOf, ownOf, monthsTo18, grow, kiddieAge, pickOf, spendingOf, applySpending, cleanMoney,
  answerFor, olderLine, rowWords, savedWords, savedLine, undoneLine, spendLine, spendConfirm, spendDone, SPEND_UNDONE,
  growStatus, growLabels, growLine, kiddieLine, howSteps, listWords, KIDDIE, SHARES, GROWS, EXPENSE_PREFIX, CUSTODIAL_LINE, CUSTODIAL_HELP,
} from "./compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const T = "2026-11-16";
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const run = (p, today = T) => compute(migrate(structuredClone(p)), { today });

/** Two parents and their children: Mia (9 on 2026-11-16) and Leo (5), with what each has typed. */
function family({ mia = null, leo = null, more = [], picks = null } = {}) {
  const p = emptyPlan();
  p.household = { people: [
    { id: "p-a", name: "Ana", role: "self", birthDate: "1988-02-01" },
    { id: "p-b", name: "Bo", role: "partner", birthDate: "1987-06-01" },
    { id: "k-mia", name: "Mia", role: "dependent", birthDate: "2017-05-10", ...(mia ? { childMoney: mia } : {}) },
    { id: "k-leo", name: "Leo", role: "dependent", birthDate: "2021-01-20", ...(leo ? { childMoney: leo } : {}) },
    ...more,
  ], filingStatus: "married_joint", state: "OH" };
  if (picks) p.whatIfs = { ...(p.whatIfs ?? {}), kidsMoney: picks };
  return p;
}

// ---- the formulas
test("an allowance a month: weekly x 52 / 12, every two weeks x 26 / 12, monthly as typed; a period not known reads as monthly", () => {
  near(monthlyOf(moneyOf({ childMoney: { allowance: 20, period: "weekly" } })), 20 * 52 / 12);
  near(monthlyOf(moneyOf({ childMoney: { allowance: 30, period: "biweekly" } })), 30 * 26 / 12);
  near(monthlyOf(moneyOf({ childMoney: { allowance: 40, period: "monthly" } })), 40);
  near(monthlyOf(moneyOf({ childMoney: { allowance: 40, period: "once" } })), 40);
  near(monthlyOf(moneyOf({ childMoney: { allowance: 40 } })), 40);
  assert.equal(monthlyOf(moneyOf({})), 0);
  assert.equal(monthlyOf(moneyOf({ childMoney: { allowance: -5, period: "weekly" } })), 0);
});

test("what a child holds: jar + bank + custodial; anything that is not an amount above 0 counts as 0; what it covers is trimmed", () => {
  const m = moneyOf({ childMoney: { jar: 40, bank: "300", custodial: 1200.5, covers: "  snacks   and toys " } });
  near(ownOf(m), 1540.5);
  assert.equal(m.covers, "snacks and toys");
  assert.equal(ownOf(moneyOf({ childMoney: { jar: "x", bank: null, custodial: -9 } })), 0);
  assert.equal(moneyOf({ childMoney: { covers: "a".repeat(200) } }).covers.length, 120);
  assert.deepEqual(moneyOf({ childMoney: "nope" }), { allowance: 0, period: "monthly", covers: "", jar: 0, bank: 0, custodial: 0 });
});

test("months to 18: whole months to the 18th birthday, the birthday itself counts, never below 0, null without a date", () => {
  assert.equal(monthsTo18("2017-05-10", "2026-11-16"), 8 * 12 + 5);      // 2035-05-10: 101 months (the 10th is reached in May)
  assert.equal(monthsTo18("2017-11-16", "2026-11-16"), 9 * 12);           // on a birthday: whole years
  assert.equal(monthsTo18("2017-11-17", "2026-11-16"), 9 * 12);           // one day short of 9 years: the 17th of November 2035 is 108 months on... less one day
  assert.equal(monthsTo18("2008-11-17", "2026-11-16"), 0);               // 18 tomorrow
  assert.equal(monthsTo18("2000-01-01", "2026-11-16"), 0);               // long past
  assert.equal(monthsTo18("2027-03-01", "2026-11-16"), 18 * 12 + 3);     // not born yet
  assert.equal(monthsTo18(null, T), null); assert.equal(monthsTo18("2017-05-10", null), null);
});

test("growth by 18 in today's dollars: the future value of what is held and of the share saved each month, at the rate less prices", () => {
  // nothing earns and prices stand still: what is held plus the saving, month by month
  near(grow({ now: 300, monthly: 40, share: 0.5, rate: 0, inflation: 0, months: 24 }).value, 300 + 20 * 24);
  // the rate equals the rise in prices: the real rate is 0, the same sum
  near(grow({ now: 300, monthly: 40, share: 0.5, rate: 0.03, inflation: 0.03, months: 24 }).value, 300 + 20 * 24, 1e-9);
  // by hand: 5% a year, prices flat, 12 months, $1,000 and $10 a month at each month's end
  const rm = Math.pow(1.05, 1 / 12) - 1;
  const g = grow({ now: 1000, monthly: 20, share: 0.5, rate: 0.05, inflation: 0, months: 12 });
  near(g.value, 1000 * 1.05 + 10 * (Math.pow(1 + rm, 12) - 1) / rm, 1e-9);
  near(g.monthlyIn, 10); near(g.realRate, 0.05, 1e-12); near(g.monthlyRate, rm, 1e-15);
  // a jar while prices rise 3% a year: what is held buys less each year
  const jar = grow({ now: 1000, monthly: 0, share: 0, rate: 0, inflation: 0.03, months: 120 });
  near(jar.value, 1000 / Math.pow(1.03, 10), 1e-9);
  near(jar.realRate, 1 / 1.03 - 1, 1e-12);
  // nothing saved and nothing held: 0; no months: what is held
  assert.equal(grow({ now: 0, monthly: 50, share: 0, rate: 0.07, inflation: 0.03, months: 100 }).value, 0);
  assert.equal(grow({ now: 250, monthly: 50, share: 1, rate: 0.07, inflation: 0.03, months: 0 }).value, 250);
});

test("the kiddie tax figures are the IRS's for 2026, read at irs.gov with the date: $1,350, and twice that, $2,700", () => {
  assert.equal(KIDDIE.year, 2026); assert.equal(KIDDIE.amount, 1350); assert.equal(KIDDIE.threshold, 2 * KIDDIE.amount);
  assert.equal(KIDDIE.readOn, "2026-11-16");
  assert.deepEqual(KIDDIE.sources.map((s) => s.url), ["https://www.irs.gov/pub/irs-drop/rp-25-32.pdf", "https://www.irs.gov/taxtopics/tc553"]);
});

test("the kiddie tax line: the first age a custodial account's year of earnings reaches $2,700, growing at the rate less prices", () => {
  // 7% on $40,000 is $2,800 now: this year
  assert.deepEqual(kiddieAge({ custodial: 40000, rate: 0.07, inflation: 0.03, age: 9, months: 101 }), { age: 9, now: true });
  // 7% on $30,000 is $2,100; grown 1.07/1.03 a year it reaches 2,700 / 0.07 = $38,571 in year k = ln(38571.4/30000) / ln(1.07/1.03)
  const k = Math.ceil(Math.log(2700 / 0.07 / 30000) / Math.log(1.07 / 1.03));
  assert.equal(k, 7);
  assert.deepEqual(kiddieAge({ custodial: 30000, rate: 0.07, inflation: 0.03, age: 9, months: 101 }), { age: 16, now: false });
  // not before 18: 9 years left would be needed, 8 years and 5 months are left
  assert.equal(kiddieAge({ custodial: 30000, rate: 0.07, inflation: 0.03, age: 10, months: 6 * 12 + 5 }), null);
  // a jar earns nothing; no custodial money; no age
  assert.equal(kiddieAge({ custodial: 1e6, rate: 0, inflation: 0.03, age: 9, months: 101 }), null);
  assert.equal(kiddieAge({ custodial: 0, rate: 0.07, inflation: 0.03, age: 9, months: 101 }), null);
  assert.equal(kiddieAge({ custodial: 40000, rate: 0.07, inflation: 0.03, age: null, months: null }), null);
  // turning 18 this month: only this year is looked at
  assert.deepEqual(kiddieAge({ custodial: 40000, rate: 0.07, inflation: 0.03, age: 17, months: 0 }), { age: 17, now: true });
});

test("the picks: half and a savings account by default; the rates are the plan's own Assumptions; a pick not known reads as the default", () => {
  const p = migrate(emptyPlan());
  const d = pickOf(p);
  assert.equal(d.share, 0.5); assert.equal(d.grow, "savings");
  assert.equal(d.rates.jar, 0); assert.equal(d.rates.savings, p.assumptions.returnCash); assert.equal(d.rates.stocks, p.assumptions.returnStocks);
  assert.equal(d.rate, p.assumptions.returnCash); assert.equal(d.inflation, p.assumptions.inflation);
  p.assumptions.returnStocks = 0.065; p.whatIfs = { kidsMoney: { share: 1, grow: "stocks" } };
  assert.deepEqual([pickOf(p).share, pickOf(p).grow, pickOf(p).rate], [1, "stocks", 0.065]);
  p.whatIfs.kidsMoney = { share: 0.3, grow: "gold" };
  assert.deepEqual([pickOf(p).share, pickOf(p).grow], [0.5, "savings"]);
  assert.deepEqual(SHARES.map((s) => s.value), [0, 0.25, 0.5, 1]); assert.deepEqual(GROWS, ["jar", "savings", "stocks"]);
  // picked: only once a chip stored a pick the page knows; before that both are our guess
  assert.equal(pickOf(migrate(emptyPlan())).picked, false); assert.equal(pickOf(p).picked, false);
  p.whatIfs.kidsMoney = { share: 0.25, grow: "savings" }; assert.equal(pickOf(p).picked, true);
});

test("a rate or a rise in prices at or below -100% (an imported plan) reads as the default: no Infinity, no empty figure", () => {
  const p = family({ mia: { allowance: 20, period: "weekly", jar: 40 } });
  p.assumptions = { ...(migrate(emptyPlan()).assumptions), inflation: -1, returnCash: -1.5, returnStocks: "x" };
  const d = run(p);
  assert.deepEqual([d.pick.inflation, d.pick.rates.savings, d.pick.rates.stocks], [0.03, 0.02, 0.07]);
  assert.ok(Number.isFinite(d.kids[0].grow.value) && Number.isFinite(d.kids[0].grow.realRate));
  assert.doesNotMatch(howSteps(d, usd).join(" "), /Infinity|NaN/);
  assert.equal(JSON.parse(JSON.stringify(d)).kids[0].grow.value, d.kids[0].grow.value, "no null after a save of the answer");
  // just above -100% is a figure, and counted as typed
  p.assumptions.inflation = -0.5; assert.equal(run(p).pick.inflation, -0.5);
});

test("who is a child: a dependent under 18 or with no birth date; 18 or over is listed apart; adults never", () => {
  const p = family({ more: [{ id: "k-x", name: "Sam", role: "dependent" }, { id: "k-old", name: "Eli", role: "dependent", birthDate: "2006-01-01" }, { id: "k-18", name: "Ida", role: "dependent", birthDate: "2008-11-16" }] });
  const c = childrenOf(p, T);
  assert.deepEqual(c.kids.map((k) => [k.name, k.age]), [["Mia", 9], ["Leo", 5], ["Sam", null]]);
  assert.deepEqual(c.older.map((k) => [k.name, k.age]), [["Eli", 20], ["Ida", 18]]);
  assert.deepEqual(childrenOf(emptyPlan(), T), { kids: [], older: [] });
  assert.deepEqual(childrenOf({ household: { people: [null, { role: "dependent", name: " " }] } }, T).kids.map((k) => k.name), ["Your child"]);
});

test("the family's Cy, worked by hand: $5 a week and $300 held, half saved at the savings 2% with prices up 3%: about $1,654 by 18", () => {
  const p = familyPlan(T);
  p.household.people.find((x) => x.id === "p-cy").childMoney = { allowance: 5, period: "weekly", covers: "Treats", jar: 40, bank: 260 };
  const d = run(p);
  assert.equal(d.case, "set");
  const cy = d.kids[0];
  assert.equal(cy.age, 6); assert.equal(cy.months18, 135);   // 2038-03-03: 11 years and 3 months
  near(cy.monthly, 5 * 52 / 12); near(cy.own, 300);
  const rm = Math.pow(1.02 / 1.03, 1 / 12) - 1, gm = Math.pow(1 + rm, 135);
  near(cy.grow.value, 300 * gm + (5 * 52 / 12) * 0.5 * (gm - 1) / rm, 1e-9);
  assert.equal(Math.round(cy.grow.value), 1654);
  assert.equal(cy.kiddie, null); assert.deepEqual(d.kiddie, []);
});

test("Add allowances to spending: a line per child with an allowance, its state new, same, differs or remove; written on Expenses", () => {
  const p = family({ mia: { allowance: 20, period: "weekly" }, leo: { allowance: 10, period: "monthly", jar: 15 } });
  let d = run(p);
  assert.deepEqual(d.spending.rows.map((r) => [r.expenseId, r.name, r.amount, r.period, r.state, r.endDate]),
    [["kids-money-k-mia", "Mia's allowance", 20, "weekly", "new", "2035-05-10"], ["kids-money-k-leo", "Leo's allowance", 10, "monthly", "new", "2039-01-20"]]);
  assert.equal(d.spending.allNew, true); near(d.spending.monthly, 20 * 52 / 12 + 10);
  const q = migrate(structuredClone(p));
  applySpending(q, d.spending);
  assert.deepEqual(q.expenses.filter((x) => x.id.startsWith(EXPENSE_PREFIX)), [
    { id: "kids-money-k-mia", name: "Mia's allowance", category: "other", amount: 20, period: "weekly", inflates: true, essential: false, endDate: "2035-05-10" },
    { id: "kids-money-k-leo", name: "Leo's allowance", category: "other", amount: 10, period: "monthly", inflates: true, essential: false, endDate: "2039-01-20" }]);
  d = compute(q, { today: T });
  assert.deepEqual(d.spending.rows.map((r) => r.state), ["same", "same"]); assert.equal(d.spending.todo.length, 0);
  // Mia's goes up and Leo's is cleared: one differs, one comes off; the line's own name and category are kept
  q.expenses.find((x) => x.id === "kids-money-k-mia").name = "Mia pocket money";
  q.household.people.find((x) => x.id === "k-mia").childMoney.allowance = 25;
  delete q.household.people.find((x) => x.id === "k-leo").childMoney.allowance;
  d = compute(q, { today: T });
  assert.deepEqual(d.spending.rows.map((r) => r.state), ["differs", "remove"]); assert.equal(d.spending.allNew, false);
  applySpending(q, d.spending);
  assert.deepEqual(q.expenses.filter((x) => x.id.startsWith(EXPENSE_PREFIX)), [{ id: "kids-money-k-mia", name: "Mia pocket money", category: "other", amount: 25, period: "weekly", inflates: true, essential: false, endDate: "2035-05-10" }]);
  // the birth date changed on People after the line was added: the end date differs, and only it; Update sets it again
  const e = family({ mia: { allowance: 20, period: "weekly" } }); const eq = migrate(structuredClone(e)); applySpending(eq, run(e).spending);
  eq.household.people.find((x) => x.id === "k-mia").birthDate = "2018-02-01";
  let de = compute(eq, { today: T });
  assert.deepEqual(de.spending.rows.map((r) => [r.state, r.why, r.endDate]), [["differs", "end", "2036-02-01"]]);
  assert.equal(de.spending.onlyEnds, true); assert.equal(de.spending.allNew, false);
  assert.deepEqual(spendLine(de), { text: "Mia's allowance on Expenses ends on another day than the 18th birthday.", button: "Update allowances in spending" });
  assert.equal(spendConfirm(de, usd), "Make Mia's allowance on Expenses stop at the 18th birthday?");
  assert.equal(spendDone(de, usd), "Updated on Expenses: Mia's allowance now stops at the 18th birthday.");
  applySpending(eq, de.spending);
  assert.equal(eq.expenses.find((x) => x.id === "kids-money-k-mia").endDate, "2036-02-01");
  assert.deepEqual(compute(eq, { today: T }).spending.rows.map((r) => r.state), ["same"]);
  // an amount and the end both changed: "amount" leads; the birth date cleared: no better day, the line keeps its own end
  eq.household.people.find((x) => x.id === "k-mia").childMoney.allowance = 30; eq.household.people.find((x) => x.id === "k-mia").birthDate = "2018-03-01";
  de = compute(eq, { today: T }); assert.deepEqual([de.spending.rows[0].why, de.spending.onlyEnds], ["amount", false]);
  eq.household.people.find((x) => x.id === "k-mia").childMoney.allowance = 20; delete eq.household.people.find((x) => x.id === "k-mia").birthDate;
  assert.deepEqual(compute(eq, { today: T }).spending.rows.map((r) => r.state), ["same"]);
  // a child with no birth date: no end date; a child taken off People keeps the line (it is the household's bill now)
  const r = family({ more: [{ id: "k-x", name: "Sam", role: "dependent", childMoney: { allowance: 8, period: "weekly" } }] });
  r.expenses.push({ id: "kids-money-gone", name: "Old allowance", category: "other", amount: 5, period: "weekly" });
  const s = run(r).spending;
  assert.deepEqual(s.rows.map((x) => [x.childId, x.endDate]), [["k-x", null]]);
  const rq = migrate(structuredClone(r)); applySpending(rq, s);
  assert.ok(rq.expenses.some((x) => x.id === "kids-money-gone"));
  assert.equal(rq.expenses.find((x) => x.id === "kids-money-k-x").endDate, undefined);
});

test("counted twice? a bill typed by hand on Expenses that says allowance or pocket money is named before adding, and after", () => {
  const p = family({ mia: { allowance: 20, period: "weekly" } });
  p.expenses.push({ id: "e-1", name: "Mia  allowance", category: "other", amount: 20, period: "weekly" },
    { id: "e-2", name: "Old pocket money", category: "other", amount: 5, period: "weekly", endDate: "2025-01-01" },   // ended: not counted now
    { id: "e-3", name: "Swallowance fees", category: "other", amount: 5, period: "monthly" },                       // not the word
    { id: "kids-money-gone", name: "Eli's allowance", category: "other", amount: 5, period: "weekly" });            // one this page wrote
  const d = run(p);
  assert.deepEqual(d.spending.lookalike, [{ id: "e-1", name: "Mia allowance" }]);
  assert.deepEqual(spendLine(d), { text: "Expenses already has “Mia allowance”. If that is this allowance, your budget counts it already, and adding it here would count it twice.", button: "Add the allowance to spending" });
  assert.equal(spendConfirm(d, usd), "Expenses already has “Mia allowance”. If that is this allowance, your budget counts it already, and adding it here would count it twice. Add Mia's allowance, $87 a month, to your spending on Expenses? Your budget and the other pages will count it from now on. It stops at the 18th birthday.");
  // added anyway: the counted line says so too
  const q = migrate(structuredClone(p)); applySpending(q, d.spending);
  assert.deepEqual(spendLine(compute(q, { today: T })), { text: "This allowance is counted in your spending (Expenses). Expenses also has “Mia allowance”: if that is the same money, your budget counts it twice.", button: null });
  // two children, one counted already; three lookalikes
  const two = family({ mia: { allowance: 20, period: "weekly" }, leo: { allowance: 10, period: "monthly" } });
  const tq = migrate(structuredClone(two)); applySpending(tq, { todo: run(two).spending.todo.slice(0, 1) });
  tq.expenses.push({ id: "a", name: "Allowance", amount: 1, period: "weekly" }, { id: "b", name: "Pocket-money", amount: 1, period: "weekly" }, { id: "c", name: "allowances", amount: 1, period: "weekly" });
  const t = compute(tq, { today: T });
  assert.equal(spendLine(t).text, "Expenses already has “Allowance”, “Pocket-money” and 1 more. If those are Leo's allowance, your budget counts it already, and adding it here would count it twice.");
  // no allowance set: no warning (nothing to add); none of these words: no warning
  const none = family({ mia: { jar: 5 } }); none.expenses.push({ id: "x", name: "Allowance", amount: 1, period: "weekly" });
  assert.deepEqual(run(none).spending.lookalike, []);
  assert.deepEqual(run(family({ mia: { allowance: 20, period: "weekly" } })).spending.lookalike, []);
});

test("cleanMoney: amounts above 0 kept, the period with an allowance (monthly when missing, as moneyOf reads it), what it covers trimmed; nothing left is null", () => {
  assert.deepEqual(cleanMoney({ allowance: 20, period: "weekly", covers: " snacks ", jar: 40, bank: null, custodial: 0 }), { allowance: 20, period: "weekly", covers: "snacks", jar: 40 });
  assert.deepEqual(cleanMoney({ allowance: 20 }), { allowance: 20, period: "monthly" });
  // a stored allowance with no period cleans to what the form shows for it (moneyOf's monthly): an unchanged Save writes nothing
  const m = moneyOf({ childMoney: { allowance: 20 } });
  assert.deepEqual(cleanMoney({ allowance: m.allowance, period: m.period, covers: m.covers, jar: null, bank: null, custodial: null }), cleanMoney({ allowance: 20 }));
  assert.deepEqual(cleanMoney({ allowance: null, period: "monthly", bank: 300 }), { bank: 300 });
  assert.equal(cleanMoney({ allowance: 0, period: "weekly", covers: "  ", jar: null }), null);
  assert.equal(cleanMoney(), null);
});

// ---- the words, one sentence per case
test("the sentence: no child, only grown dependents, children with nothing typed (one, two, three)", () => {
  const none = run(emptyPlan());
  assert.equal(none.case, "none");
  assert.deepEqual(answerFor(none, usd), { head: "Children's money", say: "This page is for families with children: each child's allowance and the money they have of their own. First add your child on People: where it asks “Who is this”, choose “Dependent”, the choice for a child you support." });
  const adults = family(); adults.household.people = adults.household.people.slice(0, 2);
  assert.equal(run(adults).case, "none");
  const older = family(); older.household.people = [...older.household.people.slice(0, 2), { id: "k-old", name: "Eli", role: "dependent", birthDate: "2002-05-15" }];
  const o = run(older);
  assert.equal(o.case, "older");
  assert.equal(answerFor(o, usd).say, "This page is for children under 18, and everyone in your plan is 18 or older. To add your child, go to People and choose “Dependent” where it asks “Who is this”.");
  assert.equal(olderLine(o), null);
  const two = run(family());
  assert.equal(two.case, "start");
  assert.equal(answerFor(two, usd).say, "Start with Mia's allowance: how much, how often and what it is meant to cover. What Mia has saved goes in the same place. Then the same for Leo.");
  const one = family(); one.household.people.splice(3, 1);
  assert.equal(answerFor(run(one), usd).say, "Start with Mia's allowance: how much, how often and what it is meant to cover. What Mia has saved goes in the same place.");
  const three = family({ more: [{ id: "k-z", name: "Zoe", role: "dependent", birthDate: "2023-01-01" }] });
  assert.match(answerFor(run(three), usd).say, /Then the same for Leo and Zoe\.$/);
  const both = family({ more: [{ id: "k-old", name: "Eli", role: "dependent", birthDate: "2006-01-01" }] });
  assert.equal(olderLine(run(both)), "Not listed: Eli (20). This page is for children under 18.");
});

test("the sentence once something is typed: allowance and savings, allowance only, savings only, for one child and for several", () => {
  const say = (p) => answerFor(run(p), usd).say;
  assert.equal(say(family({ mia: { allowance: 20, period: "weekly", jar: 40 }, leo: { allowance: 10, period: "monthly", bank: 300 } })), "Allowances come to $97 a month, and the children have $340 saved.");
  assert.equal(say(family({ mia: { allowance: 20, period: "weekly", jar: 40, bank: 300 } })), "Mia's allowance comes to $87 a month, and Mia has $340 saved.");
  assert.equal(say(family({ mia: { allowance: 20, period: "weekly" }, leo: { allowance: 10, period: "monthly" } })), "Allowances come to $97 a month.");
  assert.equal(say(family({ leo: { allowance: 10, period: "monthly" } })), "Leo's allowance comes to $10 a month.");
  assert.equal(say(family({ mia: { jar: 40 }, leo: { custodial: 1200 } })), "The children have $1,240 saved. No allowance is set.");
  assert.equal(say(family({ leo: { custodial: 1200 } })), "Leo has $1,200 saved. No allowance is set.");
  assert.equal(say(family({ mia: { covers: "snacks" } })), "No allowance is set and nothing saved is typed yet. Tap a child to add it.");
  assert.equal(listWords(["A"]), "A"); assert.equal(listWords(["A", "B", "C"]), "A, B and C");
});

test("each child's row: name and age, the allowance a month, how it is paid and what it covers, what is saved and where", () => {
  const d = run(family({ mia: { allowance: 20, period: "weekly", covers: "Snacks and toys", jar: 40, bank: 300 }, leo: { allowance: 10, period: "monthly", custodial: 1200 }, more: [{ id: "k-x", name: "Sam", role: "dependent" }, { id: "k-u", name: "Kit", role: "dependent", birthDate: "2027-02-01" }] }));
  assert.deepEqual(rowWords(d.kids[0], usd), { title: "Mia, 9", value: "$87 a month", lines: ["$20 every week · for snacks and toys", "$340 saved: $40 in a jar, $300 in a bank account"], action: "Change", aria: "Change Mia's money" });
  assert.deepEqual(rowWords(d.kids[1], usd), { title: "Leo, 5", value: "$10 a month", lines: ["$1,200 saved in a custodial account"], action: "Change", aria: "Change Leo's money" });
  // nothing typed: the start button's own words, "Set allowance", not a bare "Add"
  assert.deepEqual(rowWords(d.kids[2], usd), { title: "Sam, age not known", value: "No allowance", lines: ["Nothing saved yet"], action: "Set allowance", aria: "Set Sam's allowance" });
  assert.equal(rowWords(d.kids[3], usd).title, "Kit, not born yet");
  const biweekly = run(family({ mia: { allowance: 30, period: "biweekly", covers: "TV games" } }));
  assert.deepEqual(rowWords(biweekly.kids[0], usd).lines, ["$30 every two weeks · for TV games", "Nothing saved yet"]);
  assert.equal(savedWords({ jar: 1, bank: 2, custodial: 3 }, 6, usd), "$6 saved: $1 in a jar, $2 in a bank account, $3 in a custodial account");
});

test("the green line after a save names the row's new figures; nothing left says so; Undo's words", () => {
  const d = run(family({ mia: { allowance: 20, period: "weekly", jar: 40, bank: 300 }, leo: { covers: "books" } }));
  assert.equal(savedLine(d.kids[0], usd), "Saved. Mia's allowance comes to $87 a month, and Mia has $340 saved.");
  assert.equal(savedLine(d.kids[1], usd), "Saved: what Leo's allowance is meant to cover. No amount entered yet.");
  const one = run(family({ mia: { allowance: 10, period: "weekly" }, leo: { bank: 300 } }));
  assert.equal(savedLine(one.kids[0], usd), "Saved. Mia's allowance comes to $43 a month. No savings entered yet.");
  assert.equal(savedLine(one.kids[1], usd), "Saved. Leo has $300 saved. No allowance entered yet.");
  const e = run(family());
  assert.equal(savedLine(e.kids[0], usd), "Saved. Nothing is set for Mia now.");
  assert.equal(undoneLine("Mia"), "Mia's money is back as it was.");
  assert.equal(CUSTODIAL_LINE, "Money in a custodial account belongs to the child: you manage it for them until the age your state sets, and then it is theirs.");
  assert.equal(CUSTODIAL_HELP("Mia"), "It belongs to Mia: you manage it until the age your state sets, then it is Mia's.");
});

test("the spending line, its confirm and its green line: none set, one new, several new, one of two new, changed, all counted", () => {
  assert.equal(spendLine(run(family({ mia: { jar: 40 } }))), null);
  const one = run(family({ mia: { allowance: 20, period: "weekly" } }));
  assert.deepEqual(spendLine(one), { text: "Your budget does not count this allowance until you add it.", button: "Add the allowance to spending" });
  assert.equal(spendConfirm(one, usd), "Add Mia's allowance, $87 a month, to your spending on Expenses? Your budget and the other pages will count it from now on. It stops at the 18th birthday.");
  assert.equal(spendDone(one, usd), "Added to your spending on Expenses: Mia's allowance, $87 a month.");
  const two = family({ mia: { allowance: 20, period: "weekly" }, leo: { allowance: 10, period: "monthly" } });
  const d2 = run(two);
  assert.deepEqual(spendLine(d2), { text: "Your budget does not count these allowances until you add them.", button: "Add allowances to spending" });
  assert.equal(spendConfirm(d2, usd), "Add 2 allowances, $97 a month in all, to your spending on Expenses? Your budget and the other pages will count them from now on. Each stops at the 18th birthday.");
  assert.equal(spendDone(d2, usd), "Added to your spending on Expenses: 2 allowances, $97 a month in all.");
  // Mia's is counted already, Leo's is new
  const q = migrate(structuredClone(two)); applySpending(q, { todo: d2.spending.todo.slice(0, 1) });
  const d3 = compute(q, { today: T });
  assert.deepEqual(spendLine(d3), { text: "Your budget does not count Leo's allowance yet.", button: "Add the allowance to spending" });
  assert.equal(spendConfirm(d3, usd), "Add Leo's allowance, $10 a month, to your spending on Expenses? Your budget and the other pages will count it from now on. It stops at the 18th birthday.");
  // both counted: no button
  applySpending(q, d3.spending);
  assert.deepEqual(spendLine(compute(q, { today: T })), { text: "These allowances are counted in your spending (Expenses).", button: null });
  // changed since, and one cleared
  q.household.people.find((x) => x.id === "k-mia").childMoney.allowance = 25;
  delete q.household.people.find((x) => x.id === "k-leo").childMoney;
  const d4 = compute(q, { today: T });
  assert.deepEqual(spendLine(d4), { text: "Your spending on Expenses has other allowance amounts than these.", button: "Update allowances in spending" });
  assert.equal(spendConfirm(d4, usd), "Update the allowances on Expenses to $108 a month in all? Leo's allowance comes off.");
  assert.equal(spendDone(d4, usd), "Updated on Expenses: allowances now come to $108 a month.");
  assert.equal(SPEND_UNDONE, "Taken back: your spending is as it was.");
  const solo = family({ mia: { allowance: 20, period: "weekly" } }); const sq = migrate(structuredClone(solo)); applySpending(sq, run(solo).spending);
  assert.deepEqual(spendLine(compute(sq, { today: T })), { text: "This allowance is counted in your spending (Expenses).", button: null });
  // no birth date: the confirm does not promise an end
  const nb = family({ more: [{ id: "k-x", name: "Sam", role: "dependent", childMoney: { allowance: 8, period: "weekly" } }] });
  assert.equal(spendConfirm(run(nb), usd), "Add Sam's allowance, $35 a month, to your spending on Expenses? Your budget and the other pages will count it from now on.");
});

test("Growing it: the status, the chip labels with the plan's rates, each child's line, a child with no birth date, the kiddie line", () => {
  const d = run(family({ mia: { allowance: 20, period: "weekly", jar: 40, bank: 300 }, leo: { jar: 15 }, more: [{ id: "k-x", name: "Sam", role: "dependent" }] }));
  assert.equal(growStatus(d.pick), "half, 2%", "nothing tapped: the view adds \"our guess\" before it");
  assert.deepEqual(growLabels(d.pick), { jar: "A jar: 0%", savings: "A savings account: 2%", stocks: "A stock fund: 7%" });
  const mia = d.kids[0];
  assert.deepEqual(growLine(mia, usd), { title: `Mia: about ${usd(mia.grow.value)} by 18`, sub: "in 8 years 5 months: $340 now and $43 a month saved, in today's dollars" });
  assert.deepEqual(growLine(d.kids[1], usd).sub, "in 12 years 2 months: $15 now, in today's dollars");
  assert.deepEqual(growLine(d.kids[2], usd), { title: "Sam: add a birth date on People to see this.", sub: null });
  // only what it covers typed: nothing to grow, so no "$0 by 18" and no part (growing false)
  const none = run(family({ mia: { covers: "x" } }));
  assert.equal(none.case, "set"); assert.equal(none.growing, false);
  assert.deepEqual(growLine(none.kids[0], usd), { title: "Mia: no allowance or savings entered yet.", sub: null });
  assert.equal(howSteps(none, usd)[1], "By 18: what a child has now grows each month at the rate picked, 2% a year, and half of the allowance is saved at the end of each month until the 18th birthday.");
  assert.equal(d.growing, true);
  assert.deepEqual(growLine(d.kids[1], usd).title, `Leo: about ${usd(d.kids[1].grow.value)} by 18`);
  // an allowance with "None" saved and nothing held: the figure is $0, and the line says why
  const zero = run(family({ mia: { allowance: 20, period: "weekly" }, picks: { share: 0, grow: "savings" } }));
  assert.equal(growLine(zero.kids[0], usd).sub, "in 8 years 5 months: nothing now and nothing saved, in today's dollars");
  assert.equal(kiddieLine(d, usd), null);
  // a custodial account at a stock fund's 7%: $40,000 earns $2,800 this year; $30,000 reaches it at 16
  const k1 = run(family({ mia: { custodial: 40000 }, picks: { share: 0.5, grow: "stocks" } }));
  assert.equal(growStatus(k1.pick), "half, at 7%", "a chip tapped: the person's picks");
  assert.equal(kiddieLine(k1, usd), "The kiddie tax: in 2026, a child's interest, dividends and gains over $2,700 a year can be taxed at your rate instead of the child's (IRS). Mia's custodial account could earn that much this year, at the rate picked.");
  const k2 = run(family({ mia: { custodial: 30000 }, picks: { share: 0, grow: "stocks" } }));
  assert.equal(growStatus(k2.pick), "none, at 7%");
  assert.match(kiddieLine(k2, usd), /Mia's custodial account could earn that much by age 16, at the rate picked\.$/);
  const k3 = run(family({ mia: { custodial: 40000 }, leo: { custodial: 40000 }, picks: { share: 1, grow: "stocks" } }));
  assert.match(kiddieLine(k3, usd), /Mia's and Leo's custodial accounts could earn that much before 18, at the rate picked\.$/);
  // a jar never earns: no line however much is held
  assert.equal(kiddieLine(run(family({ mia: { custodial: 400000 }, picks: { share: 1, grow: "jar" } })), usd), null);
  // turning 18 this month
  const late = family({ more: [{ id: "k-t", name: "Tia", role: "dependent", birthDate: "2008-12-01", childMoney: { jar: 100 } }] });
  assert.deepEqual(growLine(run(late).kids[2], usd), { title: "Tia: about $100 at 18", sub: "18 this month: $100 now" });
});

test("How this is worked out: the household's own sums and the IRS source with its date", () => {
  const d = run(family({ mia: { allowance: 20, period: "weekly", jar: 40, bank: 300 } }));
  const s = howSteps(d, usd);
  assert.equal(s.length, 5);
  assert.equal(s[0], "An allowance a month: one paid every week is times 52 and divided by 12, one every two weeks times 26 and divided by 12. Mia: $20 × 52 ÷ 12 = $87.");
  assert.equal(s[1], `By 18: what a child has now grows each month at the rate picked, 2% a year, and half of the allowance is saved at the end of each month until the 18th birthday. Mia: $340 now and $43 a month for 8 years 5 months comes to about ${usd(d.kids[0].grow.value)}.`);
  assert.equal(s[2], "In today's dollars: prices are taken to rise 3% a year (Assumptions), so money that earns 2% buys about 1% less each year. The allowance is taken to rise with prices.");
  assert.match(s[3], /^The kiddie tax line: the IRS sets \$1,350 for 2026, and a child's interest, dividends and gains over twice that, \$2,700 a year, are taxed on Form 8615 \(IRS Topic 553 and Rev\. Proc\. 2025-32, read November 2026\)\./);
  assert.equal(s[4], "This money is the child's, so no total in your plan counts it: not Net worth, and not your budget until you add the allowances to spending.");
  const st = run(family({ mia: { jar: 10 }, picks: { share: 0.25, grow: "stocks" } }));
  assert.equal(howSteps(st, usd)[2], "In today's dollars: prices are taken to rise 3% a year (Assumptions), so the growth counted is about 3.9% a year after prices. The allowance is taken to rise with prices.");
});

test("compute: totals, the case, and the same answer twice; a plan with no household, no whatIfs or no assumptions still answers", () => {
  const d = run(family({ mia: { allowance: 20, period: "weekly", jar: 40, custodial: 500 }, leo: { bank: 60 } }));
  near(d.totals.monthly, 20 * 52 / 12); near(d.totals.own, 600); near(d.totals.custodial, 500);
  assert.equal(d.totals.withAllowance, 1); assert.equal(d.totals.withSaved, 2);
  const p = migrate(family());
  assert.equal(JSON.stringify(compute(structuredClone(p), { today: T })), JSON.stringify(compute(structuredClone(p), { today: T })));
  const bare = compute({}, { today: T });
  assert.equal(bare.case, "none"); assert.equal(bare.pick.rate, 0.02); assert.equal(bare.pick.inflation, 0.03);
  const noDay = compute(migrate(family({ mia: { jar: 5 } })), {});
  assert.deepEqual(noDay.kids.map((k) => [k.age, k.months18, k.grow]), [[null, null, null], [null, null, null]]);
});

// ---- invariance: the new fields are read by this page only
test("invariance: nothing typed, nothing added; child money and picks typed on every child change no other page's figure", async () => {
  const fs = await import("node:fs"); const path = await import("node:path"); const { fileURLToPath, pathToFileURL } = await import("node:url");
  const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const all = [["family", familyPlan(T)], ["empty", emptyPlan()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [n, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(n) && n !== "familyPlan") all.push([`${f}:${n}`, fn(T)]);
  }
  // 1. no plan holds the new fields, migrate adds none, and this page writes nothing while it is only read
  for (const [name, p0] of all) {
    const p = migrate(structuredClone(p0));
    assert.ok(!(p.household?.people ?? []).some((x) => x && "childMoney" in x), `${name}: no child money`);
    assert.equal(p.whatIfs?.kidsMoney, undefined, `${name}: no picks`);
    assert.ok(!(p.expenses ?? []).some((x) => String(x?.id).startsWith(EXPENSE_PREFIX)), `${name}: no allowance line`);
    assert.equal(JSON.stringify(compute(structuredClone(p), { today: T })), JSON.stringify(compute(structuredClone(p), { today: T })), name);
  }
  // 2. every page that reads the household, the bills or the calculators' choices (heavy simulations and placeholders apart),
  // on every plan with a child: the same output with child money and picks typed (People's echo of the record, and a page that
  // copies the plan, read with the two new keys left out; Diagnostics' count of the plan's characters, which grows with any
  // typing, left out)
  const keys = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) if (g.isDirectory() && !g.name.startsWith("_")) for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
    const f = path.join(ROOT, "modules", g.name, m.name, "module.js");
    if (!m.isDirectory() || !fs.existsSync(f) || `${g.name}/${m.name}` === "household/kids-money") continue;
    const src = fs.readFileSync(f, "utf8");
    if (!/heavy: true|placeholder: true/.test(src) && /needs:.*"(household|expenses|whatIfs)"/.test(src)) keys.push(`${g.name}/${m.name}`);
  }
  assert.ok(keys.length >= 90, `${keys.length} pages`);
  const computes = await Promise.all(keys.map(async (k) => [k, (await import(pathToFileURL(path.join(ROOT, "modules", k, "compute.js")).href)).compute]));
  const withKids = all.filter(([, p]) => (p.household?.people ?? []).some((x) => x?.role === "dependent")).slice(0, 7);
  assert.ok(withKids.length >= 6, `${withKids.length} plans with a child`);
  const out = (fn, p, key) => {
    try {
      const r = fn(structuredClone(p), { today: T });
      return JSON.stringify(key === "system/diagnostics" ? { ...r, size: undefined } : r, (k, v) => (k === "childMoney" || k === "kidsMoney" ? undefined : v));
    } catch (e) { return `threw ${e.message}`; }
  };
  let checked = 0;
  for (const [name, p0] of withKids) {
    const p = migrate(structuredClone(p0));
    const q = structuredClone(p);
    for (const x of q.household.people) if (x.role === "dependent") x.childMoney = { allowance: 15, period: "weekly", covers: "snacks", jar: 40, bank: 300, custodial: 50000 };
    q.whatIfs = { ...(q.whatIfs ?? {}), kidsMoney: { share: 1, grow: "stocks" } };
    assert.ok(compute(q, { today: T }).totals.monthly > 0, name);
    for (const [k, fn] of computes) { assert.equal(out(fn, q, k), out(fn, p, k), `${name}: ${k} moved`); checked++; }
  }
  assert.ok(checked >= 600, `${checked} pages checked`);
});
