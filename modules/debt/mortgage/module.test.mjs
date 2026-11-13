// The full checks for this page are in tests/debt-pages.test.mjs (shared fixture qa/fixtures/debt-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { debtPlan } from "../../../qa/fixtures/debt-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("mortgage: runs on the sample household and on an empty plan", () => {
  const d = compute(debtPlan(), { today: "2026-09-15" });
  assert.equal(d.hasData, true); assert.ok(Number.isFinite(d.base.months));
  assert.ok(compute(emptyPlan(), { today: "2026-09-15" }));
});

test("mortgage insurance from the price paid: ask to end it at 80%, it ends by itself at 78% on the schedule (12 U.S.C. 4902)", async () => {
  const { nper } = await import("../../../core/math/finance.js");
  const p = debtPlan();
  // the home is worth $380,000 today but was bought for $310,000: $265,000 owed is 85.5% of the price
  p.property = [{ id: "h", kind: "home", accountId: "home", value: 380000, purchasePrice: 310000, purchaseDate: "2021-05-01" }];
  const d = compute(p, { today: "2026-09-15" }), r = d.mortgage.rate / 12;
  assert.equal(d.pmi.basis, "price"); assert.equal(d.pmi.basisValue, 310000);
  assert.ok(Math.abs(d.pmi.ltv - 265000 / 310000) < 1e-9);
  assert.equal(d.pmi.dropAtBalance, 248000); assert.ok(Math.abs(d.pmi.autoAtBalance - 241800) < 1e-6);
  // the months until the balance reaches each line at the required payment (no extra here): the same as the closed form
  const to = (line) => Math.ceil(nper(r, d.mortgage.payment, 265000) - nper(r, d.mortgage.payment, line) - 1e-9);
  assert.equal(d.pmi.monthsUntilDrop, to(248000)); assert.equal(d.pmi.monthsUntilAuto, to(241800));
  assert.ok(d.pmi.monthsUntilAuto > d.pmi.monthsUntilDrop && d.pmi.dateAuto > d.pmi.dateDrop);
  // no price entered: today's value stands in, and the page says to enter the price
  assert.equal(compute(debtPlan(), { today: "2026-09-15" }).pmi.basis, "today");
});

// ---- round 8 batch 6: each loan against its own home (landlord-2) ---------------------------------------------------------
test("batch 6: the mortgage on the home you live in comes first; the condo's loan is measured against the condo (58%)", async () => {
  const { condoOnNetWorthPlan, condoOnlyRentalPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  const p = condoOnNetWorthPlan();
  // the condo's loan has the higher rate, so it came first and was measured against the main home (37% of 410,000)
  const d = compute(p, { today: T });
  assert.equal(d.mortgage.name, "Mortgage"); assert.deepEqual(d.others, [{ id: "condo-loan", name: "Condo mortgage" }]);
  assert.equal(d.home.name, "Home"); assert.ok(Math.abs(d.pmi.ltv - 250000 / 410000) < 1e-9);
  // picked: against the condo's own value (on Rental analysis until its Net worth account is linked); a rental's mortgage
  // insurance is not under the Homeowners Protection Act, so only what is owed against its value is given
  const c = compute(p, { today: T, accountId: "condo-loan" });
  assert.equal(c.mortgage.name, "Condo mortgage"); assert.equal(c.pmi.rental, true);
  assert.equal(Math.round(c.pmi.ltv * 100), 58); assert.equal(c.pmi.homeValue, 260000); assert.equal(c.home.name, "Condo");
  // after "Add it to net worth" on the plan with the condo only on Rental analysis: the same
  const R = await import("../../property/rental/compute.js");
  const q = condoOnlyRentalPlan(); let n = 0;
  const made = R.addToNetWorth(q, "r-condo", { today: T, uid: () => `x${++n}` });
  const e = compute(q, { today: T, accountId: made.loanAccountId });
  assert.equal(Math.round(e.pmi.ltv * 100), 58); assert.equal(compute(q, { today: T }).mortgage.name, "Mortgage");
  // homeOf on a plan with no rental is the first home with a value, as before
  assert.equal(R.compute ? (await import("./compute.js")).homeOf(debtPlan(), "nope")?.account?.type : null, "property");
});

// round 8 batch 6 review (money 9 and 10): the home's mortgage is never measured against a rental, with or without a loan; a
// rental's loan is measured against the rental's own value until its Net worth account is linked
test("batch 6 review: a rental owned outright listed first is not the home's; an unlinked account of the rental's name is not read", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  // the review's condofirst: the condo owned outright, linked to its rental, its account before Home
  const p = condoOnNetWorthPlan(); const c = p.accounts.find((a) => a.id === "condo");
  p.accounts = [c, ...p.accounts.filter((a) => a !== c && a.id !== "condo-loan")]; p.debts = p.debts.filter((x) => x.accountId !== "condo-loan");
  Object.assign(p.property[0], { accountId: "condo", loanAccountId: null, loanBalance: 0 });
  const d = compute(p, { today: T });
  assert.equal(d.home.name, "Home"); assert.equal(Math.round(d.pmi.ltv * 100), 61);
  assert.ok(!d.pmi.rental);
  // the review's rentdiff: Net worth's Condo at 270,000, not linked; the rental says 260,000
  const q = condoOnNetWorthPlan(); q.accounts.find((a) => a.id === "condo").balance = 270000;
  const e = compute(q, { today: T, accountId: "condo-loan" });
  assert.equal(e.pmi.homeValue, 260000); assert.equal(Math.round(e.pmi.ltv * 100), 58);
  // linked: Net worth's value
  q.property[0].accountId = "condo";
  assert.equal(compute(q, { today: T, accountId: "condo-loan" }).pmi.homeValue, 270000);
});

// ---- plain words (spec 13.1, C10, 2026-11-13): the lump sum says what it does; the figures are the same -----------------------------
test("C10 plain words: 'Pay a lump sum to lower the monthly payment', 'left at 6.25% interest'; the recast's figures unchanged", async () => {
  const d = compute(debtPlan(), { today: "2026-09-15", lump: 20000 });
  // the recast: the same end date, a lower payment (the figures the stat shows)
  assert.ok(d.recast && d.recast.lump === 20000 && d.recast.newPayment < d.mortgage.payment && d.recast.monthlySaving > 0);
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const t = await pageText(new URL("./view.js", import.meta.url), debtPlan(), "2026-09-15");
  assert.match(t, /Pay a lump sum to lower the monthly payment/);
  assert.match(t, /left at [\d.]+% interest, \$[\d,]+ a month/);
  assert.doesNotMatch(t, /One lump sum|for a recast|Recast with/);
  const empty = await pageText(new URL("./view.js", import.meta.url), emptyPlan(), "2026-09-15");
  assert.match(empty, /paying every two weeks or a lump sum that lowers the monthly payment would do/);
  const fs = await import("node:fs");
  const view = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(view.includes("`After a ${fmt.money(x.recast.lump, cur)} lump sum`") && !view.includes("Recast with"));
});
