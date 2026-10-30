import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, targetsFor, RULE, PRESETS, FICA, SLACK } from "./compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { seTax } from "../../taxes/self-employment/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const fam = (fn) => { const p = familyPlan(TODAY); if (fn) fn(p); return p; };
const by = (d) => Object.fromEntries(d.buckets.map((b) => [b.key, b]));

test("the rule and the presets add up to 100%; own shares are scaled to 100%", () => {
  assert.deepEqual(RULE, { needs: 0.5, wants: 0.3, savings: 0.2 });
  for (const p of Object.values(PRESETS)) near(p.needs + p.wants + p.savings, 1);
  assert.equal(targetsFor({}).from, "50-30-20");
  assert.equal(targetsFor({ preset: "60-20-20" }).needs, 0.6);
  const own = targetsFor({ preset: "own", needs: 0.55, wants: 0.25, savings: 0.3 });
  near(own.needs, 0.55 / 1.1); near(own.savings, 0.3 / 1.1); assert.equal(own.scaled, true);
  assert.equal(targetsFor({ preset: "own" }).from, "50-30-20", "own with nothing typed: the rule");
});

test("income after tax by hand: federal income tax, each person's Social Security and Medicare, self-employment tax, the state", () => {
  const p = fam();
  const d = compute(p, { today: TODAY });
  const fed = computeFederal(p, { today: TODAY }).result.totalTax;
  // Ana 101,400 and Bo 62,400 of pay; Bo's 7,200 of photography pays self-employment tax after his wages
  const payroll = FICA.ss * 101400 + FICA.medicare * 101400 + FICA.ss * 62400 + FICA.medicare * 62400 + seTax(7200, { wages: 62400, wageBase: 184500 }).total;
  near(d.month.gross, 171000 / 12); near(d.month.federal, fed / 12); near(d.month.payroll, payroll / 12);
  assert.equal(d.month.state, 0, "Texas"); near(d.month.afterTax, (171000 - fed - payroll) / 12);
});

test("needs are the bills marked \"I must pay this\", wants the rest, savings retirement + goals + what is left", () => {
  const p = fam();
  const d = compute(p, { today: TODAY }), b = by(d);
  const exp = computeExpenses(p, { today: TODAY });
  near(b.needs.monthly, exp.essentialMonthly); near(b.wants.monthly, exp.monthly - exp.essentialMonthly);
  const retirement = computeContributions(p, { today: TODAY }).yearly / 12;
  near(d.saving.retirement, retirement);
  near(b.savings.monthly, d.month.afterTax - b.needs.monthly - b.wants.monthly);
  near(b.needs.share, b.needs.monthly / d.month.afterTax); near(b.needs.targetMonthly, 0.5 * d.month.afterTax); near(b.needs.gap, b.needs.monthly - 0.5 * d.month.afterTax);
  assert.ok(d.needs[0].monthly >= d.needs[1].monthly, "largest first");
  assert.equal(d.saving.unlisted, true, "the family's expenses leave over 10% of income unlisted");
});

test("over and under: needs and wants above their share by more than the slack, savings below theirs", () => {
  const p = fam((q) => { q.expenses.push({ id: "x-rent", name: "Second home", category: "housing", amount: 6000, period: "monthly", essential: true }, { id: "x-fun", name: "Boat", category: "fun", amount: 3000, period: "monthly", essential: false }); });
  const b = by(compute(p, { today: TODAY }));
  assert.equal(b.needs.status, "over"); assert.equal(b.wants.status, "over");
  // no retirement saving, no goals, and spending that leaves 5% over: savings under 20% - the slack
  const q = fam((x) => { x.retirement.contributions = []; x.goals = []; });
  const A = compute(q, { today: TODAY }).month.afterTax;
  const spend = fam((x) => { x.retirement.contributions = []; x.goals = []; x.expenses.push({ id: "x-fill", name: "Everything else", category: "fun", amount: A * 0.95 - computeExpenses(x, { today: TODAY }).monthly, period: "monthly", essential: false }); });
  const s = by(compute(spend, { today: TODAY }));
  near(s.savings.share, 0.05, 1e-6); assert.equal(s.savings.status, "under"); near(s.savings.gap, (0.05 - 0.2) * A, 1e-6);
  // within the slack counts as on target
  assert.ok(SLACK > 0 && SLACK < 0.05);
});

test("spending above income after tax: nothing left over, the shortfall, a note", () => {
  const p = fam((q) => { q.expenses.push({ id: "x-big", name: "Too much", category: "fun", amount: 20000, period: "monthly", essential: false }); });
  const d = compute(p, { today: TODAY });
  assert.equal(d.saving.leftover, 0); assert.ok(d.saving.short > 0);
  near(d.saving.short, by(d).needs.monthly + by(d).wants.monthly + d.saving.retirement + d.saving.goals - d.month.afterTax);
  assert.ok(d.notes.some((n) => /More goes out/.test(n)));
});

test("a state with an income tax comes off; with no expense marked as a must-pay, a note", () => {
  const pa = compute(fam((q) => { q.household.state = "PA"; }), { today: TODAY });
  assert.ok(pa.month.state > 0); near(pa.month.afterTax, pa.month.gross - pa.month.federal - pa.month.payroll - pa.month.state);
  const none = compute(fam((q) => { q.expenses.forEach((e) => { e.essential = false; }); }), { today: TODAY });
  assert.equal(none.needs.length, 0); assert.ok(none.notes.some((n) => /No expense is marked/.test(n)));
});

test("not ready without income or expenses", () => {
  assert.deepEqual(compute(emptyPlan(), { today: TODAY }).missing, ["income", "expenses"]);
  const p = fam((q) => { q.expenses = []; });
  assert.deepEqual(compute(p, { today: TODAY }).missing, ["expenses"]);
});
