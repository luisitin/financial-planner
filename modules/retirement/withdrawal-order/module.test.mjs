// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("withdrawal-order: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// round 8, Batch 5b (2026-11-06): the ways that set a withdrawal spend tax savings rather than keep them, so orders are compared
// on the plan's own spending, the same every year: a plan on another way ranks its orders exactly as on the same spending
test("5b: a plan on a share of what is left compares its orders at the same spending every year", async () => {
  const { bridgeCouple } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const today = "2026-11-06";
  // health cover is priced on the plan's own income, which moves with the way: left out here, so only the way differs
  const couple = () => { const p = migrate(bridgeCouple()); p.retirement.healthIncluded = true; return p; };
  const steady = compute(couple(), { today });
  for (const way of ["percent", "guardrails", "vpw"]) {
    const p = couple(); p.retirement.strategy = way;
    const d = compute(p, { today });
    assert.deepEqual(d.options.map((o) => [o.key, o.endAfterTaxReal, o.taxesReal]), steady.options.map((o) => [o.key, o.endAfterTaxReal, o.taxesReal]), way);
    assert.equal(d.best, steady.best);
  }
});

// stress test 2026-11-11, x-4: the flat-rate warning is the page's own notice with a button, not a line of builder words in `notes`
test("the flat rate is reported as bracketsOn, not as a note", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const p = retirementPlan("2026-11-11");
  p.retirement = { ...(p.retirement ?? {}), taxMode: "flat" };
  const d = compute(p, { today: "2026-11-11" });
  assert.equal(d.ready, true);
  assert.equal(d.bracketsOn, false);
  assert.ok(!d.notes.some((n) => /flat tax rate/.test(n)));
});

// stress test 2026-11-11, RB2 and R-A9: the retirement pages that cannot work yet send a newcomer straight to where each missing
// thing is typed (modules/retirement/needs.js), the first button filled, not to Will the money last? to read the same list again
test("stress test: needs.js turns the projection's missing list into buttons, first filled", async () => {
  const { needAct } = await import("../needs.js");
  assert.deepEqual(needAct("a person with a birth date on the People page"), { href: "#/household/people", label: "Add people ›" });
  assert.deepEqual(needAct("your accounts on the Net worth page"), { href: "#/balance/net-worth", label: "Add what you own ›" });
  assert.deepEqual(needAct("what you will spend in retirement (a figure here, or your expenses on the Expenses page)"), { href: "#/retirement/projection?type=spending", label: "Type what you'll spend ›" });
  assert.equal(needAct("Everyone is past the plan's end age: check the birth dates on the People page").href, "#/household/people");
  assert.equal(needAct("the plan is longer than the history on file"), null);
});
test("stress test: every empty retirement page shows the same buttons and no small link to Will the money last?", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const pages = ["withdrawal-order", "withdrawal-strategy", "roth-conversions", "cash-flow", "buckets", "sequence-risk"];
  for (const id of pages) {
    const r = await renderPage(new URL(`../${id}/view.js`, import.meta.url).href, emptyPlan(), "2026-11-11");
    const links = r.root.querySelectorAll("a");
    const hrefs = links.map((a) => [a.getAttribute("href"), a.className]);
    assert.deepEqual(hrefs.slice(0, 3), [["#/household/people", "btn"], ["#/balance/net-worth", "btn secondary"], ["#/retirement/projection?type=spending", "btn secondary"]], `${id}: ${JSON.stringify(hrefs)}`);
    assert.ok(!hrefs.some(([h]) => h === "#/retirement/projection"), `${id} still sends to the list page: ${JSON.stringify(hrefs)}`);
  }
  // the two odds pages ask the PC; their not-ready answer draws the same row
  for (const id of ["monte-carlo", "historical"]) {
    const { compute: c } = await import(`../${id}/compute.js`);
    // (these two read ctx.view and the store's backend, which renderPage leaves out: a ctx of their own)
    const ui = await import("../../../core/ui/dom.js"), fmt = await import("../../../core/format.js"), { render } = await import(`../${id}/view.js`);
    const root = document.createElement("main"), plan = emptyPlan();
    render(root, { ui, fmt: { ...fmt, today: () => "2026-11-11" }, plan, view: {}, route: { rest: [], query: {} }, store: { get: () => plan, update() {}, backend: () => "local" }, computeRemote: async (k, o) => c(plan, { today: "2026-11-11", ...o }) });
    await new Promise((r) => setTimeout(r, 0));
    const hrefs = root.querySelectorAll("a").map((a) => [a.getAttribute("href"), a.className]);
    assert.ok(hrefs.some(([h, c2]) => h === "#/household/people" && c2 === "btn"), `${id}: ${JSON.stringify(hrefs)}`);
    assert.ok(!root.querySelectorAll(".notice").some((n) => n.classList.contains("warn")), `${id}: no amber box for a first open`);
  }
});
