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

test("'count on' is kept apart: the month plans with it, every tax figure stays on the Income amount (round 4)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: income } = await import("../../cashflow/income/compute.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { taxAnswer } = await import("../../taxes/withholding/compute.js");
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const { compute: statements } = await import("../../reports/statements/compute.js");
  const { compute: cashStatement } = await import("../../cashflow/statement/compute.js");
  const T = "2026-11-02";
  const before = familyPlan(T), after = familyPlan(T);
  const side = after.income.find((x) => x.id === "i-side");
  side.countOn = 300;   // $600 a month on average; plan the month with $300
  // the amount is untouched; the income compute says what is held back
  assert.equal(after.income.find((x) => x.id === "i-side").amount, before.income.find((x) => x.id === "i-side").amount);
  const ia = income(after, { today: T });
  assert.equal(ia.heldMonthly, side.amount - 300); assert.equal(ia.monthly, income(before, { today: T }).monthly);
  // the month is the careful one: the same as typing $300 as the income (less income, less tax set aside from it)...
  const nb = next(before, { today: T }).spare, na = next(after, { today: T }).spare;
  const typed300 = familyPlan(T); typed300.income.find((x) => x.id === "i-side").amount = 300;
  assert.ok(Math.abs(na.monthly - next(typed300, { today: T }).spare.monthly) < 0.01, `${na.monthly} vs ${next(typed300, { today: T }).spare.monthly}`);
  assert.equal(na.heldGross, side.amount - 300); assert.ok(na.held > 0 && na.held < na.heldGross, "held back after the tax on it");
  // ...while the tax lines stay the whole year's, as on every tax page
  assert.equal(na.federalTax, nb.federalTax); assert.equal(na.payrollTax, nb.payrollTax);
  assert.equal(taxAnswer(after, { today: T })?.totalTax, taxAnswer(before, { today: T })?.totalTax);
  assert.equal(estimated(after, { today: T }).nextDue?.amount, estimated(before, { today: T }).nextDue?.amount);
  // Side income knows what is on file
  assert.equal(compute(after, { today: T }).items.find((x) => x.id === "i-side").counted, 300);
  // the printable statements add up to the same month, and the cash-flow statement names the line
  const c = statements(after, { today: T }).cashflow;
  assert.ok(Math.abs(c.fromLiving - c.retirement - c.goals - c.debtExtra - c.net) < 0.01, "Left in cash follows from the lines");
  assert.ok(Math.abs(c.net - na.monthly * 12) < 0.01);
  const cs = cashStatement(after, { today: T });
  assert.ok(JSON.stringify(cs).includes("Uneven pay not counted on, after its tax (Side income)"));
});

test("count on: one rule everywhere; only repeating business pay, only below its amount (review 2026-11-02)", async () => {
  const { countedOn, compute: income, changeFrom } = await import("../../cashflow/income/compute.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { compute: forecast } = await import("../../cashflow/forecast/compute.js");
  const { compute: health } = await import("../../overview/health-score/compute.js");
  const T = "2026-11-02";
  const line = { type: "business", amount: 600, period: "monthly", countOn: 300 };
  assert.equal(countedOn(line), 300);
  assert.equal(countedOn({ ...line, countOn: 700 }), null, "above the amount: the amount counts");
  assert.equal(countedOn({ ...line, countOn: 600 }), null, "at the amount: nothing held back");
  assert.equal(countedOn({ ...line, type: "salary" }), null, "a line changed to another kind drops it");
  assert.equal(countedOn({ ...line, period: "once" }), null);
  assert.equal(countedOn({ ...line, countOn: "" }), null); assert.equal(countedOn({ ...line, countOn: 0 }), 0, "nothing to count on is a figure");
  assert.equal(countedOn({ ...line, amount: 7200, period: "annual" }), 300, "a yearly figure is compared a month");
  // a figure above the amount moves nothing: Income, Next best action and the Forecast all stay on the $600
  const base = familyPlan(T), high = familyPlan(T);
  high.income.find((x) => x.id === "i-side").countOn = 700;
  assert.equal(income(high, { today: T }).heldMonthly, 0);
  assert.ok(Math.abs(next(high, { today: T }).spare.monthly - next(base, { today: T }).spare.monthly) < 0.01);
  const fh = forecast(high, { today: T }), fb = forecast(base, { today: T });
  assert.ok(Math.abs(fh.income - fb.income) < 0.01 && Math.abs(fh.end - fb.end) < 0.01, "the forecast never lands more than the Income amount");
  const low = familyPlan(T); low.income.find((x) => x.id === "i-side").countOn = 300;
  assert.ok(forecast(low, { today: T }).income < fb.income - 100, "a figure below it does land less");
  assert.equal(compute(high, { today: T }).items.find((x) => x.id === "i-side").counted, null);
  // a raise from a later date (review 2026-11-02, round 5): the pay that ends keeps the line's id, the new pay continues it
  // and carries the careful figure; the split itself is tested on Income (cashflow/income module.test.mjs)
  const ch = changeFrom({ id: "i-side", name: "Weekend photography", type: "business", amount: 600, period: "monthly", countOn: 300 }, { amount: 900, period: "monthly", startDate: "2027-01-01" }, T);
  assert.equal(ch.split, true); assert.equal(ch.old.id, "i-side"); assert.equal(ch.old.countOn, 300);
  assert.equal(ch.next.continues, "i-side"); assert.equal(ch.next.countOn, 300); assert.equal(countedOn(ch.next), 300, "still below the new $900");
  // on the start date Side income still has the months typed and the careful figure (the split as the Income page saves it)
  const split = familyPlan(T);
  const months = compute(split, { today: T }).months;
  split.whatIfs = { ...(split.whatIfs ?? {}), sideIncome: { "i-side": { months: Object.fromEntries(months.map((m) => [m, 500])) } } };
  const was = { ...split.income.find((x) => x.id === "i-side"), countOn: 300 };
  const s2 = changeFrom(was, { ...was, amount: 900, startDate: "2027-01-01" }, T);
  const i = split.income.findIndex((x) => x.id === "i-side");
  split.income[i] = s2.old; split.income.splice(i + 1, 0, { id: "new-pay", ...s2.next });
  for (const [day, id, monthly] of [[T, "i-side", 600], ["2027-01-15", "new-pay", 900]]) {
    const it = compute(split, { today: day }).items;
    assert.equal(it.length, 1); assert.equal(it[0].id, id); assert.equal(it[0].key, "i-side"); assert.equal(it[0].monthly, monthly);
    assert.equal(it[0].counted, 300); assert.ok(it[0].enough, `${day}: the typed months are there`);
    assert.ok(next(split, { today: day }).spare.held > 0, `${day}: the careful month goes on`);
  }
  assert.deepEqual(Object.keys(split.whatIfs.sideIncome), ["i-side"], "one record for both halves: nothing copied");
  // the saving share is on the careful month on both sides: counting on less never marks a saver down
  const careful = familyPlan(T); careful.income.find((x) => x.id === "i-side").countOn = 300;
  const nbC = next(careful, { today: T }).spare;
  const part = health(careful, { today: T }).parts.find((x) => x.id === "saving");
  const afterTax = nbC.gross - (nbC.businessCosts ?? 0) - nbC.federalTax - nbC.payrollTax - (nbC.stateTax ?? 0) - nbC.held;
  const saved = nbC.retirementSaving + nbC.goalSaving + (nbC.debtExtra ?? 0) + nbC.monthly;
  assert.match(part.detail, new RegExp(`About ${Math.round((saved / afterTax) * 100)}% of income after tax`));
  // Next best action's lines add up to the spare (the part held back is a line of its own)
  const sum = nbC.businessCosts + nbC.federalTax + nbC.payrollTax + nbC.stateTax + nbC.spending + nbC.retirementSaving + nbC.goalSaving + nbC.debtExtra + nbC.held + nbC.monthly;
  assert.ok(Math.abs(sum - nbC.gross) < 0.01);
});

test("a raise from a later date: count on and the months are one record for both halves (review 2026-11-02, round 5)", async () => {
  const { setCountOn, saveMonths } = await import("./compute.js");
  const { changeFrom } = await import("../../cashflow/income/compute.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const T = "2026-11-02";
  // the family's photography with twelve months typed, "Count on $X" tapped, then a raise to $900 from April saved on Income
  const p = familyPlan(T);
  const ms = compute(p, { today: T }).months;
  p.whatIfs = { ...(p.whatIfs ?? {}), sideIncome: { "i-side": { months: Object.fromEntries(ms.map((m) => [m, 500])) } } };
  setCountOn(p, compute(p, { today: T }).items[0], 400);
  const was = p.income.find((x) => x.id === "i-side");
  const ch = changeFrom(was, { ...was, amount: 900, startDate: "2027-04-01" }, T);
  const i = p.income.findIndex((x) => x.id === "i-side");
  p.income[i] = ch.old; p.income.splice(i + 1, 0, { id: "new-pay", ...ch.next });
  const lines = () => p.income.filter((x) => x.id === "i-side" || x.continues === "i-side");
  assert.deepEqual(lines().map((x) => x.countOn), [400, 400]);
  // months typed as they come, before the start date, under the line on screen: still there after it
  for (const [day, m] of [["2026-12-02", "2026-11"], ["2027-01-02", "2026-12"], ["2027-02-02", "2027-01"], ["2027-03-02", "2027-02"], ["2027-03-31", "2027-03"]]) {
    const it = compute(p, { today: day }).items;
    assert.equal(it.length, 1); assert.equal(it[0].id, "i-side");
    saveMonths(p, it[0], { [m]: 700 });
  }
  const after = compute(p, { today: "2027-04-15" }).items[0];
  assert.equal(after.id, "new-pay");
  assert.deepEqual(after.typedMonths, [500, 500, 500, 500, 500, 500, 500, 700, 700, 700, 700, 700], "the months typed before the start date stay");
  // "Count the full $600 again" before the start date: off on both halves, so it does not come back on the start date
  setCountOn(p, compute(p, { today: T }).items[0], null);
  assert.deepEqual(lines().map((x) => "countOn" in x), [false, false]);
  assert.equal(compute(p, { today: "2027-04-15" }).items[0].counted, null);
  assert.ok(next(p, { today: "2027-04-15" }).spare.held < 0.005, "the left-over figure counts the full amount after the start date too");
  // "Count on $300 instead": both halves; after the start date the new pay says it too
  setCountOn(p, compute(p, { today: T }).items[0], 300);
  assert.deepEqual(lines().map((x) => x.countOn), [300, 300]);
  assert.equal(compute(p, { today: "2027-04-15" }).items[0].counted, 300);
  // changed after the start date, on the new pay: the same record
  setCountOn(p, compute(p, { today: "2027-04-15" }).items[0], 350);
  assert.deepEqual(lines().map((x) => x.countOn), [350, 350]);
  // a line of the chain that is not repeating business pay keeps none; another income is never touched
  p.income.find((x) => x.id === "new-pay").type = "other";
  p.income.push({ id: "i-other", name: "Tutoring", type: "business", amount: 400, period: "monthly", countOn: 100 });
  setCountOn(p, { key: "i-side" }, 250);
  assert.equal("countOn" in p.income.find((x) => x.id === "new-pay"), false);
  assert.equal(p.income.find((x) => x.id === "i-side").countOn, 250);
  assert.equal(p.income.find((x) => x.id === "i-other").countOn, 100);
  // saveMonths keeps what was there and adds what is typed
  saveMonths(p, { key: "i-side" }, { "2027-04": 800 });
  assert.equal(p.whatIfs.sideIncome["i-side"].months["2027-04"], 800); assert.equal(p.whatIfs.sideIncome["i-side"].months["2026-11"], 700);
});
