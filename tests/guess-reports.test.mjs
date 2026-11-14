// tests/guess-reports.test.mjs -- smart guesses C8, part 4: reports and exports mark a figure that rests on our guesses
// (spec 15 C8, 1.4 "reports and exports print guesses as facts"). modules/reports/guess-marks.js says which figures are ours;
// each report's compute carries the marks it prints in an additive `ours` key (absent for a plan with no guess); report-kit
// `marked` writes "(our guess)", "(partly our guesses)" or "(our estimate)"; the export lists them in a file of their own,
// "Our guesses", while one is in use, and every other file keeps its columns. Households: qa/fixtures/guess-walk.mjs (rivera: everything left to us), the family fixture (no guess).
import { test } from "node:test";
import assert from "node:assert/strict";
import { marksOf, sumMark, debtMarks, GUESS, PARTLY, ESTIMATE, MARK_WORDS } from "../modules/reports/guess-marks.js";
import { marked } from "../modules/reports/report-kit.js";
import { compute as summary } from "../modules/reports/plan-summary/compute.js";
import { compute as retirementReport } from "../modules/reports/retirement/compute.js";
import { compute as statements } from "../modules/reports/statements/compute.js";
import { compute as annual } from "../modules/reports/annual-review/compute.js";
import { compute as exportCompute, datasetCsv, DATASETS, GUESS_DATASET } from "../modules/reports/export/compute.js";
import { confirmGuess } from "../core/estimate/index.js";
import { rivera, alex, WALK_TODAY as T } from "../qa/fixtures/guess-walk.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { guessedPlan } from "../qa/fixtures/guessed-plan.mjs";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";

test("marksOf: which figures are ours, from the ledger and Get started's older flags; none for a plan without guesses", () => {
  assert.equal(marksOf(familyPlan(T)), null);
  const m = marksOf(rivera());
  assert.ok(m.accounts.has("setup-have-checking") && m.accounts.has("setup-owe-mortgage"));
  assert.equal(m.assets, true); assert.equal(m.liabilities, true);
  assert.ok(m.income.has("setup-pay-setup-partner") && !m.income.has("setup-pay-setup-self"), "Sam's pay was typed");
  assert.ok(m.expenses.has("setup-x-groceries"));
  assert.deepEqual([...m.debts["setup-debt-mortgage"]].sort(), ["minPayment", "rate"]);
  assert.equal(m.retireSpend, true);
  assert.deepEqual([...m.socialSecurity].sort(), ["setup-partner", "setup-self"]);
  assert.ok(m.goals.has("setup-goal-cushion"));
  const old = marksOf(guessedPlan());
  assert.ok(Object.values(old.debts).some((f) => f.has("rate")), "an older rateGuessed flag is a guess too");
});

test("sumMark, debtMarks and marked: one word per case", () => {
  assert.equal(sumMark([{ ours: true, amount: 5 }, { ours: true, amount: 6 }]), GUESS);
  assert.equal(sumMark([{ ours: true, amount: 5 }, { ours: false, amount: 6 }]), PARTLY);
  assert.equal(sumMark([{ ours: false, amount: 5 }, { ours: true, amount: 0 }]), null, "a guess of $0 adds nothing to the sum");
  assert.equal(sumMark([]), null);
  assert.deepEqual(debtMarks(null, "a", "d"), {});
  assert.deepEqual(debtMarks(marksOf(rivera()), "setup-owe-car-loan", "setup-debt-car-loan"), { owed: GUESS, rate: GUESS, payment: GUESS });
  assert.equal(marked("$4,200", GUESS), "$4,200 (our guess)");
  assert.equal(marked("Spending", PARTLY), "Spending (partly our guesses)");
  assert.equal(marked("Planned a month", ESTIMATE), "Planned a month (our estimate)");
  assert.equal(marked("Net worth", null), "Net worth");
  assert.deepEqual(MARK_WORDS, { guess: "our guess", partly: "partly our guesses", estimate: "our estimate" });
});

test("Plan summary: each figure resting on our guesses is marked; spending in retirement from today's is our estimate", () => {
  const d = summary(rivera(), { today: T, maxPaths: 50 });
  const o = d.ours;
  assert.equal(o.netWorth, PARTLY); assert.equal(o.cash, GUESS, "checking and savings both ours");
  assert.equal(o.income, PARTLY, "Jo's pay ours, Sam's typed");
  assert.equal(o.spending, GUESS, "every spending row and payment ours");
  assert.equal(o.planned, GUESS); assert.equal(o.socialSecurity, GUESS);
  assert.deepEqual(o.goals, [GUESS], "the emergency fund's amount");
  assert.ok(o.debts.every((x) => x.owed === GUESS && x.rate === GUESS && x.payment === GUESS));
  // spending in retirement taken from what is spent today: an estimate, not a guess
  const fam = familyPlan(T);
  assert.equal("ours" in summary(fam, { today: T, maxPaths: 50 }), false, "no guess, a figure set: nothing marked");
  fam.retirement.spendingMonthly = 0;
  assert.deepEqual(summary(fam, { today: T, maxPaths: 50, estimates: true }).ours?.planned, ESTIMATE, "the page asks for estimates");
  assert.equal("ours" in summary(fam, { today: T, maxPaths: 50 }), false, "without the parameter a plan with no guess computes as before");
  assert.equal(retirementReport(fam, { today: T, maxPaths: 50, estimates: true }).ours?.spending, ESTIMATE);
  assert.equal("ours" in retirementReport(fam, { today: T, maxPaths: 50 }), false);
});

test("The other reports: the retirement report, the statements, the annual review and the export mark theirs", () => {
  const p = rivera();
  const r = retirementReport(p, { today: T, maxPaths: 50 });
  assert.equal(r.ours.spending, GUESS); assert.equal(r.ours.savedBy, GUESS);
  assert.deepEqual(r.ours.socialSecurity, { Sam: GUESS, Jo: GUESS });
  const s = statements(p, { today: T });
  assert.ok(s.balance.groups.flatMap((g) => g.accounts).every((a) => a.ours === GUESS));
  assert.deepEqual(s.balance.ours, { assets: PARTLY, liabilities: PARTLY, netWorth: PARTLY });
  assert.equal(s.income.ours.expensesTotal, GUESS);
  assert.ok(s.income.expenses.find((e) => /Loan and card/.test(e.label)).ours, "the payments counted from Debts are ours");
  assert.equal(annual(p, { today: T }).ours?.netWorth, PARTLY);
  // the export: "Our guesses" lists them (list, name, column, value) while one is in use
  const ours = datasetCsv(p, "our-guesses", T).split("\r\n");
  assert.equal(ours[0], "list,name,column,value");
  assert.ok(ours.some((l) => /^goals,.*,target_today,/.test(l)) && ours.some((l) => /^income,.*,amount,66000$/.test(l)) && ours.some((l) => /^debts,.*,rate_pct,/.test(l)));
  assert.ok(exportCompute(p, { today: T }).datasets.some((x) => x.id === "our-guesses" && x.rows > 0));
  // a figure kept with "That's about right" is the person's: no longer marked
  const q = rivera();
  for (const path of Object.keys(q.guesses)) confirmGuess(q, path);
  for (const x of q.debts) { delete x.rateGuessed; delete x.paymentGuessed; }
  assert.equal(marksOf(q)?.accounts.size ?? 0, 0);
});

test("export: every file keeps its columns whether or not a guess is in use; only the Our guesses file comes and goes (critic F4)", () => {
  for (const mk of [alex, rivera]) {
    const p = mk(), q = mk();
    for (const path of Object.keys(q.guesses)) confirmGuess(q, path);
    for (const x of q.debts ?? []) { delete x.rateGuessed; delete x.paymentGuessed; }
    for (const ds of DATASETS) {
      const head = (plan) => datasetCsv(plan, ds.id, T).split("\r\n")[0];
      assert.equal(head(p), head(q), `${ds.id}: the same columns`);
      assert.doesNotMatch(head(p), /our_guess/);
    }
    const ids = (plan) => exportCompute(plan, { today: T }).datasets.map((x) => x.id);
    assert.deepEqual(ids(p), [...DATASETS.map((d) => d.id), GUESS_DATASET.id]);
    if (!marksOf(q)) assert.deepEqual(ids(q), DATASETS.map((d) => d.id));
  }
});

test("a $0 saved by retirement with nothing saved on file is not marked our guess; the stress tests wait for the savings (critic F3, F4)", async () => {
  const a = alex();
  const s = summary(a, { today: T, maxPaths: 50, estimates: true });
  assert.equal(s.retirement.unknown, true);
  assert.equal(s.ours.savedBy, null);
  assert.equal(retirementReport(a, { today: T, maxPaths: 50 }).ours?.savedBy ?? null, null);
  assert.equal(summary(rivera(), { today: T, maxPaths: 50 }).ours.savedBy, GUESS, "a guessed balance saved by then is still marked");
  const t = await drawn("reports/plan-summary", alex());
  assert.match(t, /Not entered yet Retirement savings/);
  assert.doesNotMatch(t, /Saved by then/);
  assert.match(t, /Protection: the stress tests The stress tests need your retirement savings first\./);
  assert.doesNotMatch(t, /The plan survives \d+ of \d+ shocks/);
  assert.match(await drawn("reports/plan-summary", rivera()), /The plan survives \d+ of \d+ shocks/);
  assert.doesNotMatch(await drawn("reports/retirement", alex()), /Saved by then \(our guess\)/);
});

test("invariance: a plan with no guess gets no `ours` key and the same export, in every report", () => {
  for (const a of ARCHETYPES) {
    const plan = a.build();
    if (marksOf(plan)) continue;
    assert.equal("ours" in statements(plan, { today: T }), false, a.id);
    assert.equal("ours" in annual(plan, { today: T }), false, a.id);
    for (const ds of ["accounts", "income", "expenses", "debts", "goals"]) assert.doesNotMatch(datasetCsv(plan, ds, T).split("\r\n")[0], /our_guess/, `${a.id}: ${ds}`);
    assert.deepEqual(exportCompute(plan, { today: T }).datasets.map((x) => x.id), DATASETS.map((d) => d.id), `${a.id}: no Our guesses file`);
  }
  const fam = familyPlan(T);
  assert.equal("ours" in summary(fam, { today: T, maxPaths: 50 }), false);
  assert.equal("ours" in retirementReport(fam, { today: T, maxPaths: 50 }), false);
});

// ---- the printed sheets, drawn as the shell draws them
const textOf = (el) => (el.data !== undefined && !el.tagName ? el.data : el.tagName === "STYLE" ? "" : (el.childNodes ?? []).map(textOf).join(" ")).replace(/\s+/g, " ");
async function drawn(key, plan) {
  const L = await import("../qa/first-view-lib.mjs");
  const app = await L.loadApp();
  app.plans.c8p = app.migrate(plan);
  const d = await L.draw(key, "c8p");
  assert.ok(!d.error, `${key}: ${d.error}`);
  return textOf(d.root);
}
test("sheets: the plan summary marks its figures and says what the marks mean; the tax report's withholding is our estimate", async () => {
  const t = await drawn("reports/plan-summary", rivera());
  assert.match(t, /Net worth \(partly our guesses\)/);
  assert.match(t, /Spending \(our guess\)/);
  assert.match(t, /\$4,200 our guess/);
  assert.match(t, /A figure marked "our guess" is a typical figure the plan filled in where a box was left empty/);
  const fam = await drawn("reports/plan-summary", familyPlan(T));
  assert.doesNotMatch(fam, /our guess|our estimate/);
  const tax = await drawn("reports/tax", familyPlan(T));
  assert.match(tax, /\(our estimate, worked out from pay\)/);
  const st = await drawn("reports/statements", alex());
  assert.match(st, /Checking \(our guess\)/);
});
