import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("assistant summary names accounts and goals", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "a", name: "Everyday checking", type: "checking", balance: 1234 });
  p.goals.push({ id: "g", name: "House", target: 50000, targetDate: "2028-01-01" });
  const d = compute(p);
  assert.match(d.summary, /Everyday checking: checking, balance 1234/);
  assert.match(d.summary, /House: target 50000/);
});

// ---- C5 hand-off H4: the model is told which figures are our guesses, never them as the person's own
test("H4: a balance or a goal's amount that is our guess is marked (our guess); the person's own figures are not", async () => {
  const { SYSTEM_PROMPT } = await import("./compute.js");
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
