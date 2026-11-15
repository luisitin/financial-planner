// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("cash-flow: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("Review 2026-11-06 (round 7): the year's income lines say 'your Social Security' for the first adult Get started left unnamed", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-06";
  const lines = (plan) => [...new Set(compute(plan, { today: T }).rows.flatMap((r) => r.in.lines.map((l) => l.name)))];
  assert.deepEqual(lines(familyPlan(T)), ["Bo's Social Security", "Ana's Social Security"], "typed names read as before");
  for (const [partner, theirs] of [["My spouse", "your spouse's"], ["Bo", "Bo's"]]) {
    const p = familyPlan(T); p.household.people[0].name = "Me"; p.household.people[1].name = partner;
    assert.deepEqual(lines(p), [`${theirs} Social Security`, "your Social Security"], "was: Me's Social Security, My spouse's Social Security");
  }
});

// stress test 2026-11-11: the key under the table says the plan's own order, not always "taxable, then pre-tax"
test("stress test: the key names the plan's withdrawal order", async () => {
  const { orderSaid } = await import("./view.js");
  assert.equal(orderSaid(["taxable", "deferred", "free"]), "Money comes out of cash first, then taxable savings, then pre-tax accounts (taxed as it comes out), then Roth (tax-free).");
  assert.equal(orderSaid(["deferred", "free", "taxable"]), "Money comes out of cash first, then pre-tax accounts (taxed as it comes out), then Roth (tax-free), then taxable savings.");
  const p = retirementPlan(); p.retirement.withdrawalOrder = ["deferred", "taxable", "free"];
  assert.deepEqual(compute(p, { today: "2026-11-11" }).order, ["deferred", "taxable", "free"]);
});

// money moved between accounts (Will the money last?, gap list next 60 item 26): the year's record says it, one sentence per case
test("a year with money moved between accounts says it, in the dollars shown", async () => {
  const { moveSaid } = await import("./view.js");
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  assert.equal(moveSaid({ fromName: "Savings", toName: "Brokerage", amount: 20000, tax: 0, capped: false }, money), "Moved $20,000 from Savings to Brokerage");
  assert.equal(moveSaid({ fromName: "Sam's 401(k)", toName: "Brokerage", amount: 20000, tax: 3000, capped: false }, money), "Moved $20,000 from Sam's 401(k) to Brokerage, $3,000 of tax");
  assert.equal(moveSaid({ fromName: "Savings", toName: "Brokerage", amount: 38211, tax: 0, capped: true }, money), "Moved $38,211 from Savings to Brokerage, all it held");
  assert.equal(moveSaid({ fromName: "Savings", toName: "Brokerage", amount: 0, tax: 0, capped: true }, money), "Nothing to move from Savings");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const p = retirementPlan(); p.retirement.happenings = [{ id: "h1", kind: "move", fromId: "k401", toId: "brk", year: 2034, amount: 20000 }];
  const r = await renderPage(new URL("./view.js", import.meta.url).href, p, "2026-09-16");
  assert.match(r.root.textContent, /Moved \$20,000 from Sam's 401\(k\) to Brokerage, \$3,000 of tax\./, "the year's record on a phone");
  assert.match(r.root.textContent, /2034: Moved \$20,000 from Sam's 401\(k\) to Brokerage, \$3,000 of tax\./, "the line under the table");
});
