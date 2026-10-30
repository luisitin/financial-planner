import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, lastMonths, monthStats, RELIABLE, MIN_MONTHS } from "./compute.js";
import { rulesFor, mileageOn, THRESHOLDS } from "./data/rules.js";
import { compute as computeSelfEmployment } from "../../taxes/self-employment/compute.js";
import { compute as computeEstimated } from "../../taxes/estimated/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const VALS = [450, 900, 0, 600, 1200, 300, 700, 650, 0, 800, 1500, 500];
const withMonths = (vals, fn) => { const p = familyPlan(TODAY); const ms = lastMonths(TODAY); p.whatIfs = { sideIncome: { "i-side": { months: Object.fromEntries(ms.map((k, i) => [k, vals[i]])) } } }; if (fn) fn(p); return p; };

test("the last twelve whole months, oldest first, across a year end", () => {
  assert.deepEqual(lastMonths(TODAY), ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(lastMonths("2026-01-05", 3), ["2025-10", "2025-11", "2025-12"]);
});

test("the figures from the months: average, median, the amount reached in three months out of four, the spread", () => {
  const s = monthStats(VALS);
  assert.equal(s.n, 12); near(s.average, 7600 / 12); near(s.median, (600 + 650) / 2);
  assert.equal(s.low, 0); assert.equal(s.high, 1500); assert.equal(s.zeros, 2);
  assert.equal(s.reliable, 450); assert.equal(s.reached, 9, "at least 75% of the months reached it");
  assert.ok(VALS.filter((v) => v >= 500).length < RELIABLE * 12, "the next figure up is reached in fewer");
  const sd = Math.sqrt(VALS.reduce((t, x) => t + (x - 7600 / 12) ** 2, 0) / 12);
  near(s.spread, sd / (7600 / 12));
  // blanks are left out; few months still give the rule
  const few = monthStats([null, 100, "", 300, 200]);
  assert.equal(few.n, 3); assert.equal(few.reliable, 100, "with three months, the lowest");
  assert.equal(monthStats([]).n, 0); assert.equal(monthStats([0, 0, 0]).spread, null);
});

test("the cushion: the deepest the running shortfall went when paying yourself the average", () => {
  const s = monthStats(VALS, lastMonths(TODAY));
  // average 633.33: Oct +183, Nov -83 (100), Dec 733 (550)... deepest in June 2026 at 900
  near(s.cushion, 900, 1e-9); assert.equal(s.deepest, "2026-06");
  assert.equal(monthStats([500, 500, 500]).cushion, 0, "even months need no cushion");
  near(monthStats([0, 1000]).cushion, 500); assert.equal(monthStats([1000, 0], ["a", "b"]).deepest, null);
});

test("the family's photography: the reliable month against the Income page's figure", () => {
  const d = compute(withMonths(VALS), { today: TODAY });
  assert.equal(d.ready, true); assert.equal(d.items.length, 1);
  const it = d.items[0];
  assert.equal(it.id, "i-side"); assert.equal(it.monthly, 600); assert.equal(it.enough, true);
  assert.equal(it.countOn, 450); near(it.gap, 150);
  assert.equal(it.typedMonths.length, 12);
});

test("the share to set aside: the tax this income adds over what comes in, worked on the months' average", () => {
  const p = withMonths(VALS);
  const d = compute(p, { today: TODAY });
  // the tax is worked with the side income at its average ($633.33 a month), not the Income page's $600
  const avgPlan = withMonths(VALS, (q) => { Object.assign(q.income.find((x) => x.id === "i-side"), { amount: 7600 / 12, period: "monthly" }); });
  const se = computeSelfEmployment(avgPlan, { today: TODAY });
  assert.equal(d.setAside.onAverage, true);
  near(d.setAside.yearly, se.businessTax); near(d.setAside.rate, se.businessTax / 7600); near(d.setAside.quarter, se.businessTax / 4);
  assert.ok(d.setAside.rate > 0.25 && d.setAside.rate < 0.35, "22% income tax and 14.1% self-employment tax, less the deductions they bring");
  const st = compute(withMonths(VALS, (q) => { q.taxes.state = { rate: 0.05 }; }), { today: TODAY });
  near(st.setAside.yearly, st.setAside.federal + 0.05 * se.net, 1e-6); near(st.setAside.rate, st.setAside.yearly / 7600);
  // expenses on the Self-employment page lower the share of each payment
  const ex = compute(withMonths(VALS, (q) => { q.whatIfs.selfEmployment = { expenses: 3800 }; }), { today: TODAY });
  assert.ok(ex.setAside.rate < d.setAside.rate * 0.6);
  // pressing "Count on" does not lower the tax: it is still worked on the average
  const counted = withMonths(VALS, (q) => { q.income.find((x) => x.id === "i-side").amount = 450; });
  near(compute(counted, { today: TODAY }).setAside.yearly, d.setAside.yearly);
  // the whole return's quarterly payments come from the Estimated payments page
  const est = computeEstimated(avgPlan, { today: TODAY });
  assert.equal(d.estimates.needed, !!est.needsEstimates); assert.deepEqual(d.estimates.nextDue, est.nextDue ?? null);
});

test("near the $400 line the share does not jump: it is the year's tax over what came in", () => {
  const p = familyPlan(TODAY); p.income.find((x) => x.id === "i-side").amount = 35;   // $420 a year: 92.35% of it is under $400
  const d = compute(p, { today: TODAY });
  assert.ok(d.setAside.rate < 0.3, `rate ${d.setAside.rate}`);
});

test("a state with no rate is noted; last year's average rate is noted; nothing to set aside without a taxable business", () => {
  const p = withMonths(VALS, (q) => { q.household.state = "CA"; q.taxes.state = {}; });
  const d = compute(p, { today: TODAY });
  assert.equal(d.setAside.stateKnown, false); assert.ok(d.notes.some((n) => /State tax page/.test(n)));
  const prior = compute(withMonths(VALS, (q) => { q.household.state = "CA"; q.taxes.state = { priorTax: 5000, priorAgi: 160000 }; }), { today: TODAY });
  assert.equal(prior.setAside.stateAverage, true); assert.ok(prior.notes.some((n) => /average state rate/.test(n)));
  const untaxed = compute(withMonths(VALS, (q) => { q.income.find((x) => x.id === "i-side").taxable = false; }), { today: TODAY });
  assert.equal(untaxed.setAside, null);
});

test("fewer than three typed months: no figures from them", () => {
  const d = compute(withMonths([null, null, null, null, null, null, null, null, null, 300, 500, null]), { today: TODAY });
  assert.equal(d.items[0].stats.n, 2); assert.equal(d.items[0].enough, false); assert.equal(d.items[0].countOn, null);
  assert.equal(MIN_MONTHS, 3);
});

test("the year's rules: 1099-NEC from $2,000, 1099-K over $20,000 and 200 payments for apps, any amount for cards, 72.5 then 76 cents a mile", () => {
  const d = compute(withMonths(VALS), { today: TODAY });
  assert.equal(d.rules.form1099NEC, 2000); assert.deepEqual(d.rules.form1099K, { apps: { amount: 20000, payments: 200 }, cards: 0 }); assert.equal(d.rules.mileage, 0.76);
  assert.equal(d.rules.year, 2026); assert.equal(d.rules.stale, false);
  const next = compute(withMonths(VALS), { today: "2027-03-01" }).rules;
  assert.equal(next.year, 2026); assert.equal(next.stale, true, "2027's rules are not in the table yet");
  near(THRESHOLDS.seTax / THRESHOLDS.seBase, 433.13, 0.01);
  assert.equal(mileageOn("2026-03-01"), 0.725); assert.equal(mileageOn("2026-07-01"), 0.76); assert.equal(mileageOn("2025-08-01"), 0.7);
  assert.equal(rulesFor(2025).form1099NEC, 600); assert.equal(rulesFor(2030).form1099NEC, 2000);
});

test("not ready without a side income; one-off business income is left out", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
  const p = familyPlan(TODAY); p.income = p.income.filter((x) => x.type !== "business");
  assert.equal(compute(p, { today: TODAY }).ready, false);
  p.income.push({ id: "x", name: "One sale", type: "business", personId: "p-bo", amount: 900, period: "once" });
  assert.equal(compute(p, { today: TODAY }).ready, false);
});
