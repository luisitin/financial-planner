import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("setup checklist counts", () => {
  const p = emptyPlan();
  assert.equal(compute(p).doneCount, 0);
  p.accounts.push({ id: "a", name: "x", type: "checking", balance: 1 });
  p.goals.push({ id: "g", name: "Emergency fund", target: 10000 });
  const d = compute(p);
  assert.equal(d.doneCount, 2);
  assert.equal(d.total, d.steps.length);
});

test("a finished 'Set up my plan' folds the checklist even with the assumptions still to look over", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "a", name: "x", type: "checking", balance: 1 });
  assert.equal(compute(p).setupFinished, false);
  p.guide = { setup: { startedAt: "2026-11-01", finishedAt: "2026-11-01" } };
  const d = compute(p);
  assert.equal(d.setupFinished, true);
  assert.equal(d.next?.key, "people", "the checklist itself still knows what is open");
});

test("where you stand: a lean month is worded once, by setup's standing(), for the done screen and here alike (review 2026-11-02, round 5)", async () => {
  const fs = await import("node:fs");
  const { standing } = await import("../setup/compute.js");
  const { compute: next } = await import("../next-best-action/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const D = "2026-11-02";
  const p = familyPlan(D); p.income.find((x) => x.id === "i-side").countOn = 0;
  p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: next(p, { today: D }).spare.full - 297, period: "monthly", essential: false });
  const st = standing(p, { today: D });
  assert.match(st.headline, /^Counting your uneven pay at what you can count on, more goes out than comes in\. Good months make up for it/);
  assert.equal(st.lean.about, 300);
  // the card shows that sentence and the row's figure from it; it no longer works out a sentence or a held amount of its own
  const view = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(view.includes('ui.h("p", { class: "db-head" }, st.headline)'));
  assert.ok(view.includes("const lean = st.lean ?? null;") && view.includes("money(lean.about)"));
  assert.ok(!view.includes("heldNow") && !view.includes("Counting your uneven pay"), "no held amount or sentence of its own");
});
