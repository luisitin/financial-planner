// tests/estimate-ledger.test.mjs -- core/estimate/ledger.js: a guess is an ordinary value plus one entry in
// plan.guesses, and only while the field still equals it (docs/DATA_MODEL.md `guesses`). Hand-made plans, no tables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { same, guessAt, isGuess, guessesInUse, guessesTouching, markGuess, clearGuess, confirmGuess, saveField, TOLERANCE } from "../core/estimate/index.js";

const T = "2026-11-02";
const est = (key, value, unit = "month", extra = {}) => ({ key, value, unit, sigma: unit === "rate" ? null : 0.25, dataAsOf: T, ...extra });
const plan = () => ({
  meta: { currency: "USD" },
  accounts: [{ id: "setup-owe-credit", type: "credit", balance: 4200 }, { id: "a-visa", type: "credit", balance: 900 }, { id: "a-chk", type: "checking", balance: 3000 }, { id: "setup-owe-mortgage", type: "mortgage", balance: 210000 }],
  debts: [
    { id: "setup-debt-credit", accountId: "setup-owe-credit", rate: 0.2236, rateGuessed: 0.2236, minPayment: 150 },
    { id: "d-visa", accountId: "a-visa", rate: 0.2236, rateGuessed: 0.2236, minPayment: 40, paymentGuessed: 40 },
    { id: "setup-debt-mortgage", accountId: "setup-owe-mortgage", rate: 0.0724, rateGuessed: 0.0724, minPayment: 1431.15, paymentGuessed: 1431.15 },
  ],
  expenses: [{ id: "e1", category: "groceries", amount: null, period: "monthly" }, { id: "e2", category: "dining", amount: 450, period: "monthly" }],
  goals: [{ id: "setup-goal-cushion", target: 18000, fundedBy: ["a-chk"] }],
  household: { people: [{ id: "setup-self", name: "Ana", role: "self" }] },
  retirement: { spendingMonthly: 4100, socialSecurity: { "setup-self": { monthlyAtFRA: 2210 } } },
  guide: { setup: { ssWrote: { "setup-self": 2210 }, retireAuto: true, cushionTarget: 18000, cushionFunds: ["a-chk"] } },
});

test("same(): per unit -- rates within 1e-9, money within half a cent, ages exact, lists by content", () => {
  assert.equal(same(0.22, 0.2236, "rate"), false, "a typed 22% over a guessed 22.36% is the person's");
  assert.equal(same(0.049, 0.046, "rate"), false);
  assert.equal(same(0.046 + 1e-12, 0.046, "rate"), true);
  assert.equal(same(450.004, 450, "month"), true);
  assert.equal(same(450.006, 450, "month"), false);
  assert.equal(same(64, 64, "age"), true);
  assert.equal(same(64.5, 64, "age"), false);
  assert.equal(same(["a1", "a2"], ["a1", "a2"], "list"), true);
  assert.equal(same(["a2", "a1"], ["a1", "a2"], "list"), false);
  assert.equal(same("OH", "OH"), true);
  assert.equal(same(null, 0, "month"), false);
  assert.deepEqual(TOLERANCE, { rate: 1e-9, month: 0.005, year: 0.005, total: 0.005, age: 0, "year-date": 0 });
});

test("markGuess writes the field and its entry, is idempotent (`at` kept) and never creates a record", () => {
  const p = plan();
  assert.equal(markGuess(p, "expenses[e1].amount", est("spend.groceries", 550), T), true);
  assert.equal(p.expenses[0].amount, 550);
  assert.deepEqual(p.guesses["expenses[e1].amount"], { k: "spend.groceries", v: 550, u: "month", s: 0.25, at: T, d: T });
  assert.equal(markGuess(p, "expenses[e1].amount", est("spend.groceries", 550), "2026-12-01"), false, "same key and value: nothing changes");
  assert.equal(p.guesses["expenses[e1].amount"].at, T, "at is the day v last changed");
  assert.equal(markGuess(p, "expenses[e1].amount", est("spend.groceries", 600), "2026-12-01"), true);
  assert.equal(p.guesses["expenses[e1].amount"].at, "2026-12-01");
  const q = plan(), before = JSON.stringify(q);
  assert.equal(markGuess(q, "expenses[gone].amount", est("spend.groceries", 550), T), false);
  assert.equal(JSON.stringify(q), before, "no record, no entry, no field");
  assert.equal(markGuess(q, "expenses[e1].amount", { ...est("spend.groceries", 1), value: null }, T), false, "no value, nothing written");
});

test("isGuess is true while the field equals v and false once it changes", () => {
  const p = plan();
  markGuess(p, "expenses[e1].amount", est("spend.groceries", 550), T);
  assert.equal(isGuess(p, "expenses[e1].amount"), true);
  assert.equal(guessAt(p, "expenses[e1].amount").k, "spend.groceries");
  p.expenses[0].amount = 550.004;
  assert.equal(isGuess(p, "expenses[e1].amount"), true, "within half a cent");
  p.expenses[0].amount = 500;
  assert.equal(isGuess(p, "expenses[e1].amount"), false);
  assert.equal(guessesInUse(p).some((e) => e.path === "expenses[e1].amount"), false, "a changed field is not listed");
  assert.equal(isGuess(p, "expenses[e2].amount"), false, "never marked");
});

test("legacy flags read as frozen guesses: rateGuessed 0.2236 is debts[<id>].rate, k debt.credit.rate, legacy", () => {
  const p = plan();
  const g = guessesInUse(p);
  const card = g.find((e) => e.path === "debts[setup-debt-credit].rate");
  assert.deepEqual({ k: card.k, v: card.v, u: card.u, legacy: card.legacy }, { k: "debt.credit.rate", v: 0.2236, u: "rate", legacy: true });
  assert.equal(g.find((e) => e.path === "debts[d-visa].rate").k, "debt.credit.rate", "kind from the account type when the id is not the setup's");
  assert.equal(g.find((e) => e.path === "debts[d-visa].minPayment").k, "debt.credit.payment");
  assert.equal(g.find((e) => e.path === "debts[setup-debt-mortgage].minPayment").v, 1431.15);
  assert.equal(g.find((e) => e.path === "retirement.socialSecurity.setup-self.monthlyAtFRA").k, "overview/setup:ss");
  assert.equal(g.find((e) => e.path === "retirement.spendingMonthly").k, "overview/setup:retireSpend");
  assert.equal(g.find((e) => e.path === "goals[setup-goal-cushion].target").k, "overview/setup:cushionTarget");
  assert.deepEqual(g.find((e) => e.path === "goals[setup-goal-cushion].fundedBy").v, ["a-chk"]);
  assert.equal(g.length, 9);
  assert.equal(isGuess(p, "debts[setup-owe-credit].rate"), true, "the account's id reads the same row");
  p.debts[0].rate = 0.19;
  assert.equal(isGuess(p, "debts[setup-debt-credit].rate"), false, "typed over: the flag no longer matches");
  // a pasted ssa.gov record is the person's own figure
  const q = plan(); q.retirement.socialSecurity["setup-self"].record = [{ year: 2020, earnings: 50000 }];
  assert.equal(guessesInUse(q).some((e) => e.k === "overview/setup:ss"), false);
  // retireAuto holds no figure: the guess is today's value, and a zero is no guess
  const r = plan(); r.retirement.spendingMonthly = 0;
  assert.equal(guessesInUse(r).some((e) => e.k === "overview/setup:retireSpend"), false);
});

test("the ledger wins on a shared path, and writing it mirrors the older flag", () => {
  const p = plan();
  assert.equal(markGuess(p, "debts[setup-owe-mortgage].rate", est("debt.mortgage.rate", 0.046, "rate"), T), true, "the account's spelling");
  assert.ok(p.guesses["debts[setup-debt-mortgage].rate"], "stored under the row's own id");
  assert.equal(p.debts[2].rate, 0.046);
  assert.equal(p.debts[2].rateGuessed, 0.046, "mirrored, so Liabilities and the setup keep reading it as a guess");
  const rows = guessesInUse(p).filter((e) => e.path === "debts[setup-debt-mortgage].rate");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].legacy, undefined);
  assert.equal(clearGuess(p, "debts[setup-debt-mortgage].rate"), true);
  assert.equal("rateGuessed" in p.debts[2], false, "cleared: the flag goes too, the value stays");
  assert.equal(p.debts[2].rate, 0.046);
  assert.equal(p.guesses, undefined);
});

test("confirm or clear each older flag: the value stays and becomes the person's", () => {
  const p = plan();
  assert.equal(confirmGuess, clearGuess);
  assert.equal(confirmGuess(p, "debts[d-visa].minPayment"), true);
  assert.equal("paymentGuessed" in p.debts[1], false);
  assert.equal(confirmGuess(p, "retirement.socialSecurity.setup-self.monthlyAtFRA"), true);
  assert.deepEqual(p.guide.setup.ssWrote, {});
  assert.equal(confirmGuess(p, "retirement.spendingMonthly"), true);
  assert.equal(p.guide.setup.retireAuto, false);
  assert.equal(confirmGuess(p, "goals[setup-goal-cushion].target"), true);
  assert.equal(p.guide.setup.cushionTarget, null, "null: the person's own amount, which the setup leaves alone");
  assert.equal(confirmGuess(p, "goals[setup-goal-cushion].fundedBy"), true);
  assert.equal("cushionFunds" in p.guide.setup, false);
  assert.deepEqual([p.debts[1].minPayment, p.retirement.spendingMonthly, p.goals[0].target], [40, 4100, 18000], "no figure moved");
  assert.equal(confirmGuess(p, "debts[d-visa].minPayment"), false, "twice: nothing left to clear");
  assert.deepEqual(guessesInUse(p).map((e) => e.path).sort(), ["debts[d-visa].rate", "debts[setup-debt-credit].rate", "debts[setup-debt-mortgage].minPayment", "debts[setup-debt-mortgage].rate"]);
});

test("saveField: typed wins even when equal; blank with a guess is marked; blank without one saves null", () => {
  const p = plan();
  const g = est("spend.groceries", 450);
  assert.equal(saveField(p, "expenses[e1].amount", { value: null, guessed: true }, g, T), true);
  assert.equal(p.expenses[0].amount, 450);
  assert.equal(isGuess(p, "expenses[e1].amount"), true);
  assert.equal(saveField(p, "expenses[e1].amount", { value: 450, guessed: false }, g, T), true, "typed 450 over our 450: theirs now");
  assert.equal(p.expenses[0].amount, 450);
  assert.equal(p.guesses, undefined, "the entry is gone");
  const q = plan();
  assert.equal(saveField(q, "expenses[e1].amount", { value: null, guessed: false }, null, T), false, "blank, no guess: null, as today");
  assert.equal(q.expenses[0].amount, null);
  assert.equal(q.guesses, undefined);
  assert.equal(saveField(q, "expenses[e1].amount", { value: null, guessed: true }, null, T), false, "guessed but no estimate: nothing to write");
  assert.equal(saveField(q, "debts[setup-debt-credit].rate", { value: 0.199, guessed: false }, null, T), true);
  assert.equal("rateGuessed" in q.debts[0], false, "typing over an older guess drops its flag");
});

test("the last clearGuess deletes plan.guesses: the JSON equals the plan before the first mark", () => {
  const p = plan(); p.expenses[0].amount = 450;
  const before = JSON.stringify(p);
  markGuess(p, "expenses[e1].amount", est("spend.groceries", 450), T);
  markGuess(p, "expenses[e2].amount", est("spend.dining", 450), T);
  assert.equal(Object.keys(p.guesses).length, 2);
  clearGuess(p, "expenses[e1].amount");
  assert.equal(Object.keys(p.guesses).length, 1);
  clearGuess(p, "expenses[e2].amount");
  assert.equal(JSON.stringify(p), before);
});

test("guessesTouching: the guesses in use under some plan sections, each with its weight", () => {
  const p = plan();
  markGuess(p, "expenses[e1].amount", est("spend.groceries", 550), T);
  const t = guessesTouching(p, ["expenses", "goals"], { weights: { "spend.groceries": "big" } });
  assert.deepEqual(t.map((e) => [e.path, e.weight]), [["expenses[e1].amount", "big"], ["goals[setup-goal-cushion].target", "small"], ["goals[setup-goal-cushion].fundedBy", "small"]]);
  assert.equal(guessesTouching(p, ["debts"]).length, 5);
  assert.equal(guessesTouching(p, []).length, 0);
});
