// The full checks for this page are in tests/debt-pages.test.mjs (shared fixture qa/fixtures/debt-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { debtPlan } from "../../../qa/fixtures/debt-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("ratios: runs on the sample household and on an empty plan", () => {
  const d = compute(debtPlan(), { today: "2026-09-15" });
  assert.ok(d.dti > 0 && d.dti < 1); assert.equal(d.rows.length, 4);
  assert.ok(compute(emptyPlan(), { today: "2026-09-15" }));
});

test("card use: Credit cards' answer to how much less gets under 30%, and the required part of what is paid", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const today = "2026-11-02";
  const d = compute(familyPlan(today), { today });
  assert.equal(Math.round(d.under.less30), 1900); assert.equal(d.under.date30, "2027-06-02");
  assert.ok(d.minimums < d.payments, "the family pays more than the required amounts");
});

// --- round 8 (2026-11-06), renter-debt-6: a renter's debt payments are graded on the renters' line --------------------------
test("round 8: a renter's 21% is over the CFPB's 20% line for renters (rent not counted); with a housing payment like the rent, 49.8%", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const d = compute(renterDebtPlan(), { today: "2026-11-06" });
  // $670 of required payments on $3,250 a month: 20.6%; the line for renters is 15 to 20% or less, rent not counted
  assert.ok(Math.abs(d.dti - 670 / 3250) < 1e-12);
  assert.equal(d.renter, true);
  assert.deepEqual([d.grades.dti.level, d.grades.dti.label], ["warn", "over the guideline for renters"]);
  // a home lender adds the housing payment: (670 + 950) / 3,250 = 49.85%
  assert.ok(Math.abs(d.withHousing - 1620 / 3250) < 1e-12);
  const row = d.rows.find((r) => r.key === "dti");
  assert.match(row.why, /renters/); assert.match(row.note, /like your \$950 rent and a lender would see 50% of your income going to debts: more than most lenders accept/);
  // a homeowner (a mortgage on file): as before, 36% comfortable, no renter fields
  const own = compute(debtPlan(), { today: "2026-09-15" });
  assert.equal(own.grades.dti.label, "comfortable"); assert.equal("renter" in own, false); assert.equal("withHousing" in own, false);
});

// --- round 8 review (2026-11-06): D3 required payments, D6 a rent that has ended, D7 graded at the percent shown ---------------
test("review D3: a renter paying $400 extra is graded on the $320 required (10%, within); a lender would see 39%, not 51%", async () => {
  const { renterPayingExtraPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const d = compute(renterPayingExtraPlan(), { today: "2026-11-06" });
  const row = d.rows.find((r) => r.key === "dti");
  assert.ok(Math.abs(row.value - 320 / 3250) < 1e-12, String(row.value));
  assert.deepEqual([d.grades.dti.level, d.grades.dti.label], ["ok", "within the guideline for renters"]);
  // (320 + 950) / 3,250 = 39.1% (Fannie Mae B3-6-05: a card counts at its required minimum)
  assert.ok(Math.abs(d.withHousing - 1270 / 3250) < 1e-12);
  assert.match(row.note, /lender would see 39% of your income going to debts: more than the 36% most lenders like/);
});

test("review D6: the rent a lender would add is today's rent, not one that has ended", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const p = renterDebtPlan(); p.expenses.find((x) => x.category === "housing").endDate = "2025-12-31";
  const d = compute(p, { today: "2026-11-06" });
  assert.equal(d.housingPayment, 0); assert.equal(d.withHousing, null); assert.equal(d.rows.find((r) => r.key === "dti").note, undefined);
  p.expenses.push({ id: "rent2", name: "New rent", category: "housing", essential: true, period: "monthly", inflates: true, startDate: "2026-01-01", endDate: "", amount: 1000 });
  const e = compute(p, { today: "2026-11-06" });
  assert.equal(e.housingPayment, 1000); assert.match(e.rows.find((r) => r.key === "dti").note, /your \$1,000 rent/);
});

test("review D7: shares are graded at the whole percent the page shows", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  // $660 / $3,250 = 20.3%, shown as 20%: within the 20% line, as it reads
  const p = renterDebtPlan(); p.debts.find((x) => x.id === "setup-debt-credit").minPayment = 140;
  assert.equal(compute(p, { today: "2026-11-06" }).grades.dti.label, "within the guideline for renters");
  assert.equal(compute(renterDebtPlan(), { today: "2026-11-06" }).grades.dti.label, "over the guideline for renters", "20.6% shows as 21%");
  // rent $920 on $3,250: 28.3%, shown as 28%: comfortable against 28%
  const q = renterDebtPlan(); q.expenses.find((x) => x.category === "housing").amount = 920;
  assert.equal(compute(q, { today: "2026-11-06" }).grades.housing.label, "comfortable");
});

// --- verify (2026-11-06): rent of exactly 28.5% of income is printed "29%" and graded as 29% -----------------------------------------
test("verify: housing at 28.5% reads 29% and on the high side, here and on How am I doing", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { compute: bench } = await import("../../overview/benchmarks/compute.js");
  const { pct } = await import("../../../core/format.js");
  const p = renterDebtPlan(); p.expenses.find((e) => e.category === "housing").amount = 926.25;   // 926.25 / 3,250 = 28.5%
  const d = compute(p, { today: "2026-11-06" }), row = d.rows.find((r) => r.key === "housing");
  assert.equal(pct(row.value, 0), "29%"); assert.equal(row.grade.label, "on the high side");
  const h = bench(p, { today: "2026-11-06" }).items.find((x) => x.id === "housing");
  assert.equal(h.verdict, "behind"); assert.match(h.sentence, / is 29% of gross income/);
});

// --- verify (2026-11-06): a rent that is still our guess is not "your rent" ---------------------------------------------------------
test("verify: when the rent is our guess, the home-lender sentence says so, here and on How am I doing", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { markGuess } = await import("../../../core/estimate/index.js");
  const { compute: bench } = await import("../../overview/benchmarks/compute.js");
  const T = { today: "2026-11-06" };
  const p = renterDebtPlan();
  // Get started's housing row filled in by our guesses (smart guesses, spending): $1,200 a month
  assert.ok(markGuess(p, "expenses[setup-x-housing].amount", { key: "spend.housing", value: 1200, unit: "usd/mo", sigma: 300, dataAsOf: "2025" }, T.today));
  // (670 + 1,200) / 3,250 = 57.5%, printed 58%
  const note = compute(p, T).rows.find((r) => r.key === "dti").note;
  assert.match(note, /^Add a home payment like the \$1,200 rent we guessed for you \(type yours on Expenses\) and a lender would see 58% of your income going to debts/);
  assert.ok(!/your \$1,200 rent/.test(note), note);
  assert.match(bench(p, T).items.find((x) => x.id === "debt").sentence, /the \$1,200 rent we guessed for you/);
  // a typed rent is still "your rent"
  assert.match(compute(renterDebtPlan(), T).rows.find((r) => r.key === "dti").note, /^Add a home payment like your \$950 rent/);
});
