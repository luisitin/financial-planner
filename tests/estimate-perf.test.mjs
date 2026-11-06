// tests/estimate-perf.test.mjs -- settle runs inside every store.update, so it must be quick: on the largest qa plan
// with 40 guesses and six months of bank transactions, 200 settles (each after an answer changed) take under 600 ms,
// and a plan with no guesses (every plan today) costs one look: 10,000 settles under 50 ms. Best of three tries, so a
// busy machine does not fail it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, estimate, markGuess, mergeEstimators, pathOf } from "../core/estimate/index.js";
import { estimators as guessEstimators, TABLES } from "../modules/overview/guesses/compute.js";
import { estimators as setupEstimators } from "../modules/overview/setup/compute.js";
import { migrate } from "../core/schema/migrate.js";
import { debtPlan } from "../qa/fixtures/debt-plan.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { heldPlan } from "../qa/fixtures/held-plan.mjs";
import { investmentsPlan } from "../qa/fixtures/investments-plan.mjs";
import { retirementPlan } from "../qa/fixtures/retirement-plan.mjs";
import { samplePlan } from "../qa/fixtures/sample-plan.mjs";
import { taxPlan } from "../qa/fixtures/tax-plan.mjs";

const T = "2026-11-02";
// a stand-in for the spending guesses still to come (C3): each reads the plan's pay and the row's number
const ROW = { tier: 3, order: 1, label: "A spending row", unit: "month", weight: "small", reads: [], fn(p, o) {
  const pay = (p.income ?? []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const i = Number(/perf-(\d+)/.exec(o.path ?? "")?.[1] ?? 1);
  return { value: 50 + (pay % 997) + i * 10, sigma: 0.25, measured: false, why: "a share of the pay", tables: ["cc_apr_fed_g19"] };
} };
const reg = mergeEstimators([{ from: "overview/guesses", estimators: guessEstimators, tables: TABLES }, { from: "overview/setup", estimators: setupEstimators }, { from: "perf", estimators: { "perf.row": ROW } }]);
const OPTS = { estimators: reg.estimators, tables: reg.tables, today: T };

function largest() {
  const plans = [debtPlan(), familyPlan(T), heldPlan(), investmentsPlan(), retirementPlan(), samplePlan(), taxPlan()].map(migrate);
  return plans.sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)[0];
}
/** The largest qa plan with six months of bank transactions and 40 guesses written the way a page writes them. */
function busyPlan() {
  const p = largest();
  p.transactions = [];
  for (let m = 0; m < 6; m++) for (let i = 0; i < 150; i++) {
    const date = `2026-${String(5 + m).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`;
    p.transactions.push({ id: `t-${m}-${i}`, date, amount: -((i * 37) % 400) - 5, payee: `Shop ${i % 40}`, rawPayee: `SHOP ${i % 40}`, accountId: p.accounts?.[0]?.id ?? "", category: ["groceries", "dining", "transport", "shopping"][i % 4], tags: [], note: "", key: `k-${m}-${i}` });
  }
  p.guide = { ...(p.guide ?? {}), setup: { ...(p.guide?.setup ?? {}) } };
  p.household.state = "OH";
  const marks = [];
  for (const d of p.debts ?? []) marks.push([pathOf("debts", d.id, "rate"), "debt.credit.rate"]);
  for (const x of (p.household?.people ?? []).filter((x) => x.role !== "dependent")) {
    p.retirement = p.retirement ?? {}; p.retirement.socialSecurity = p.retirement.socialSecurity ?? {};
    p.retirement.socialSecurity[x.id] = { ...(p.retirement.socialSecurity[x.id] ?? {}), monthlyAtFRA: null };
    marks.push([`retirement.socialSecurity.${x.id}.monthlyAtFRA`, "overview/setup:ss"]);
  }
  p.retirement.spendingMonthly = null; marks.push(["retirement.spendingMonthly", "overview/setup:retireSpend"]);
  for (let i = 1; marks.length < 40; i++) { p.expenses.push({ id: `perf-${i}`, name: `Row ${i}`, category: "other", amount: null, period: "monthly", inflates: true }); marks.push([pathOf("expenses", `perf-${i}`, "amount"), "perf.row"]); }
  for (const [path, k] of marks) { const e = estimate(p, k, { ...OPTS, path }); if (e) markGuess(p, path, e, T); }
  return p;
}
const best = (tries, run) => Math.min(...Array.from({ length: tries }, run));

test("settle: the largest qa plan, 40 guesses, six months of transactions, 200 times in under 600 ms", (t) => {
  const p = busyPlan();
  assert.equal(p.transactions.length, 900);
  assert.ok(Object.keys(p.guesses).length >= 38, `guesses written: ${Object.keys(p.guesses).length}`);
  let moved = 0;
  const ms = best(3, () => {
    const q = structuredClone(p);
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      if (q.income?.[0]) q.income[0].amount = (Number(q.income[0].amount) || 1000) + (i % 2 ? 7 : -7);   // an answer changed before each
      moved += settle(q, OPTS).changed.length;
    }
    return performance.now() - t0;
  });
  assert.ok(moved > 0, "the guesses really followed the answers");
  t.diagnostic(`200 settles, ${Object.keys(p.guesses).length} guesses: ${ms.toFixed(0)} ms`);
  assert.ok(ms < 600, `200 settles took ${ms.toFixed(0)} ms`);
});

test("settle on a plan with no guesses: 10,000 times in under 50 ms", (t) => {
  const p = largest();
  assert.equal(p.guesses, undefined);
  const ms = best(3, () => { const t0 = performance.now(); for (let i = 0; i < 10000; i++) settle(p, OPTS); return performance.now() - t0; });
  t.diagnostic(`10,000 no-guess settles: ${ms.toFixed(1)} ms`);
  assert.ok(ms < 50, `10,000 no-guess settles took ${ms.toFixed(1)} ms`);
});
