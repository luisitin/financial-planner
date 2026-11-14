// tests/guess-estimates.test.mjs -- smart guesses C8, part 3: figures a page works out at compute time where nothing was typed
// say so (spec 8.4). With `params.estimates`, a compute adds `estimates: [{ key, what, why }]` while its answer rests on one:
// Withholding check's tax taken from pay worked out from pay (no pay stub figure), Will the money last?'s spending taken from
// today's expenses (no figure set). Absent otherwise, so every other answer is unchanged. (The Federal estimate's own
// `estimates` waits: another batch is changing taxes/federal.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute as withholding, withheldEstimates } from "../modules/taxes/withholding/compute.js";
import { compute as projection, SPENDING_ESTIMATE } from "../modules/retirement/projection/compute.js";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";

const T = "2026-11-13";

test("Withholding check: the tax a paycheck takes out, worked out from pay, is an estimate; a typed pay stub figure is not", () => {
  const p = familyPlan(T);
  const d = withholding(p, { today: T, estimates: true });
  assert.equal(d.estimate.from, "paycheck");
  assert.deepEqual(d.estimates, [{ key: "withheld", what: "Tax taken out of pay", why: "the tax held back is worked out from your pay the way payroll does", people: ["Ana", "Bo"] }]);
  assert.equal("estimates" in withholding(p, { today: T }), false, "only when a page asks");
  // one stub typed: the other earner's is still ours
  p.taxes.withholding = { self: { perPaycheck: 400, period: "biweekly" } };
  const mixed = withholding(p, { today: T, estimates: true });
  assert.equal(mixed.estimate.from, "mixed");
  assert.deepEqual(mixed.estimates[0].people, ["Bo"]);
  p.taxes.withholding.partner = { perPaycheck: 300, period: "biweekly" };
  assert.equal("estimates" in withholding(p, { today: T, estimates: true }), false, "both typed: nothing is ours");
  assert.deepEqual(withheldEstimates(null), []);
  assert.deepEqual(withheldEstimates({ from: "typed", people: [] }), []);
});

test("Will the money last?: spending taken from today's expenses is an estimate; a figure set is not", () => {
  const p = familyPlan(T);
  assert.equal("estimates" in projection(p, { today: T, estimates: true }), false, "a figure is set");
  p.retirement.spendingMonthly = 0;
  const d = projection(p, { today: T, estimates: true });
  assert.equal(d.spendingSource, "expenses");
  assert.deepEqual(d.estimates, [SPENDING_ESTIMATE]);
  assert.deepEqual(SPENDING_ESTIMATE, { key: "spending", what: "Spending in retirement", why: "taken from what you spend today" });
  assert.equal("estimates" in projection(p, { today: T }), false, "only when a page asks");
});

test("invariance: with estimates asked for, the only new key is `estimates`", () => {
  for (const a of ARCHETYPES) {
    const plan = a.build();
    for (const [f, name] of [[withholding, "withholding"], [projection, "projection"]]) {
      const with_ = f(plan, { today: T, estimates: true });
      const { estimates, ...rest } = with_;
      assert.equal(JSON.stringify(rest), JSON.stringify(f(plan, { today: T })), `${a.id}: ${name}`);
      if (estimates) assert.ok(Array.isArray(estimates) && estimates.every((e) => e.key && e.what && e.why), `${a.id}: ${name}`);
    }
  }
});

test("Withholding check's page says the estimate in its headline and how it is worked out in one line, per case (critic F3)", async () => {
  const L = await import("../qa/first-view-lib.mjs");
  const app = await L.loadApp();
  const textOf = (el) => (el.data !== undefined && !el.tagName ? el.data : el.tagName === "STYLE" ? "" : (el.childNodes ?? []).map(textOf).join(" ")).replace(/\s+/g, " ");
  const draw = async (plan) => { app.plans.c8e = app.migrate(plan); const d = await L.draw("taxes/withholding", "c8e"); assert.ok(!d.error, d.error); return textOf(d.root); };
  // the headline carries compute's `estimates` (spec 8.4: "(our estimate)" on that headline only), in place of "likely"
  const p = familyPlan(T);
  const both = await draw(p);
  assert.match(both, /^ ?You would (owe about \$[\d,]+ in April|get about \$[\d,]+ back) \(our estimate\) /);
  assert.doesNotMatch(both, /likely/);
  assert.match(both, /Worked out from pay the way payroll does \(Ana about \$[\d,]+ a paycheck, Bo about \$[\d,]+ a paycheck\)\. Type the "Federal income tax" figure/);
  assert.equal(both.match(/our estimate/gi).length, 1, "said once");
  p.taxes.withholding = { self: { perPaycheck: 400, period: "biweekly" } };
  const one = await draw(p);
  assert.match(one, /\(our estimate\) /);
  assert.match(one, /Bo's withholding is our estimate, worked out from pay the way payroll does \(Bo about \$[\d,]+ a paycheck\)/);
  p.taxes.withholding.partner = { perPaycheck: 300, period: "biweekly" };
  assert.doesNotMatch(await draw(p), /our estimate/i);
});

test("Will the money last?: the answer marks retirement spending taken from today's expenses \"(our estimate)\", once (critic F3)", async () => {
  const L = await import("../qa/first-view-lib.mjs");
  const app = await L.loadApp();
  const textOf = (el) => (el.data !== undefined && !el.tagName ? el.data : el.tagName === "STYLE" ? "" : (el.childNodes ?? []).map(textOf).join(" ")).replace(/\s+/g, " ");
  const draw = async (plan) => { app.plans.c8p = app.migrate(plan); const d = await L.draw("retirement/projection", "c8p"); assert.ok(!d.error, d.error); return textOf(d.root); };
  const p = familyPlan(T);
  assert.doesNotMatch(await draw(p), /our estimate/, "a figure is set: nothing is ours");
  p.retirement.spendingMonthly = 0;
  const t = await draw(p);
  assert.match(t, /(you plan to spend \$[\d,]+ \(our estimate\)\.|\$[\d,]+ a year( on top of health insurance)? \(our estimate\) runs out in \d{4})/);
  assert.equal(t.match(/our estimate/g).length, 1, "said once, beside the figure");
});
