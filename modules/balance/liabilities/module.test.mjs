import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { nper, pmt } from "../../../core/math/finance.js";

const TODAY = "2026-09-15";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("empty plan and a plan with only assets: no debts", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).count, 0);
  const p = emptyPlan(); p.accounts.push({ id: "a", name: "Checking", type: "checking", balance: 100 });
  assert.equal(compute(p, { today: TODAY }).count, 0);
});
test("a card without detail is listed as needing details; totals still count what is owed", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Visa", type: "credit", balance: 4000 });
  const d = compute(p, { today: TODAY });
  assert.equal(d.count, 1); assert.equal(d.withDetail, 0); assert.equal(d.owed, 4000);
  assert.equal(d.rows[0].rate, null); assert.equal(d.rows[0].months, null); assert.equal(d.avgRate, null);
});
test("payoff months match nper; payoff date; expensive flag; weighted average rate; DTI", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Visa", type: "credit", balance: 4000 }, { id: "m", name: "Mortgage", type: "mortgage", balance: 200000 });
  const mortgagePayment = pmt(0.06 / 12, 360, 200000);   // 1199.10...
  p.debts.push({ id: "d1", accountId: "c", rate: 0.229, minPayment: 100, extra: 100 }, { id: "d2", accountId: "m", rate: 0.06, minPayment: mortgagePayment, extra: 0, termMonths: 360 });
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 6000, period: "monthly" });
  const d = compute(p, { today: TODAY });
  const visa = d.rows.find((r) => r.name === "Visa"), mort = d.rows.find((r) => r.name === "Mortgage");
  assert.equal(d.rows[0].name, "Visa", "highest rate first");
  assert.equal(visa.months, Math.ceil(nper(0.229 / 12, 200, 4000) - 1e-9));
  assert.equal(visa.payoffDate.slice(0, 4), String(2026 + Math.floor((8 + visa.months) / 12)));
  assert.equal(visa.expensive, true);
  near(visa.interestMonthly, 4000 * 0.229 / 12);
  assert.ok(visa.totalInterest > 0 && visa.totalInterest < 4000);
  assert.equal(mort.expensive, false);
  assert.equal(mort.months, 360, "the 30-year payment pays off in exactly 360 months");
  near(d.avgRate, (0.229 * 4000 + 0.06 * 200000) / 204000);
  near(d.payments, 200 + mortgagePayment);
  near(d.dti, (200 + mortgagePayment) / 6000);
  assert.ok(d.warnings.some((w) => w.includes("Visa costs")));
});
test("a payment below the interest never pays off; zero balance is paid off", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Card", type: "credit", balance: 10000 }, { id: "z", name: "Old loan", type: "loan", balance: 0 });
  p.debts.push({ id: "d", accountId: "c", rate: 0.24, minPayment: 100 }, { id: "d2", accountId: "z", rate: 0.05, minPayment: 50 });
  const d = compute(p, { today: TODAY });
  assert.equal(d.rows.find((r) => r.name === "Card").neverPaysOff, true);
  assert.equal(d.rows.find((r) => r.name === "Old loan").months, 0);
  assert.ok(d.warnings.some((w) => w.includes("never pays off")));
});

// smart guesses (spec P7, C2 review): a card whose balance and rate are both our guesses is not called expensive in amber:
// the verdict would rest on our guesses alone. A typed balance or rate keeps today's warning.
test("a debt resting on our guesses alone (balance and rate) is not flagged expensive; typed figures still are", async () => {
  const { compute: alerts } = await import("../../overview/alerts/compute.js");
  const make = (guessBalance, guessRate) => {
    const p = emptyPlan();
    p.accounts = [{ id: "setup-owe-credit", name: "Credit cards", type: "credit", balance: 3000, asOf: "2026-11-01" }];
    p.debts = [{ id: "setup-debt-credit", accountId: "setup-owe-credit", rate: 0.224, minPayment: 90, extra: 0 }];
    p.guesses = {};
    if (guessBalance) p.guesses["accounts[setup-owe-credit].balance"] = { k: "debt.credit.owed", v: 3000, u: "total", s: 0.9, at: "2026-11-01", d: "2026-11-01" };
    if (guessRate) { p.guesses["debts[setup-debt-credit].rate"] = { k: "debt.credit.rate", v: 0.224, u: "rate", s: null, at: "2026-11-01", d: "2026-11-01" }; p.debts[0].rateGuessed = 0.224; }
    if (!Object.keys(p.guesses).length) delete p.guesses;
    return p;
  };
  const ours = compute(make(true, true), { today: "2026-11-01" });
  assert.equal(ours.rows[0].expensive, false);
  assert.equal(ours.rows[0].byGuesses, true);
  assert.deepEqual(ours.warnings, []);
  assert.equal(alerts(make(true, true), { today: "2026-11-01" }).alerts.some((a) => /expensive/.test(a.id ?? "")), false);
  assert.equal(alerts(make(false, false), { today: "2026-11-01" }).alerts.some((a) => /expensive/.test(a.id ?? "")), true, "typed: the alert as today");
  for (const [b, r] of [[false, true], [true, false], [false, false]]) {
    const d = compute(make(b, r), { today: "2026-11-01" });
    assert.equal(d.rows[0].expensive, true, `${b}/${r}`);
    assert.equal("byGuesses" in d.rows[0], false);
    assert.equal(d.warnings.length, 1);
  }
});

// --- round 8 (2026-11-06), renter-debt-1: a card's date holds only if the same payment is kept up -------------------------
test("round 8: a debt's own date says it holds only at the same payment ('if you keep paying $150 a month'), not 'on its own payment'", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const text = await pageText(new URL("./view.js", import.meta.url), renterDebtPlan(), "2026-11-06");
  // $4,500 at 29% at $150: 55 months (June 2031); on the payoff plan ($50 extra, highest rate first) August 2029
  assert.match(text, /Visa card expensive 29\.0% · paid off by June 2031 if you keep paying \$150 a month, August 2029 on your payoff plan/);
  assert.match(text, /Car loan 9\.0% · paid off by [A-Z][a-z]+ \d{4} if you keep paying \$350 a month/);
  assert.ok(!text.includes("on its own payment"));
});

test("round 8: the debt-to-income tile grades a renter on the 20% line for renters", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { rentsHome } = await import("./compute.js");
  const p = renterDebtPlan();
  assert.equal(rentsHome(p, compute(p, { today: "2026-11-06" }).rows), true);
  const text = await pageText(new URL("./view.js", import.meta.url), p, "2026-11-06");
  assert.match(text, /21% Debt payments vs income over the 20% guideline for renters \(rent not counted\)/);
  assert.ok(!text.includes("under 36%: comfortable"));
  // a mortgage, or a home on file, is a homeowner: the 36% line as before
  const q = renterDebtPlan(); q.accounts.push({ id: "h", name: "Home", type: "property", balance: 200000 });
  assert.equal(rentsHome(q, compute(q, { today: "2026-11-06" }).rows), false);
  assert.match(await pageText(new URL("./view.js", import.meta.url), q, "2026-11-06"), /under 36%: comfortable/);
});

// --- round 8 review (2026-11-06), D3 and D7: a renter's share is of the required payments, graded at the percent shown ------
test("review D3: the renters' line counts the required payments, not an extra chosen on top; D7: graded at the whole percent shown", async () => {
  const { renterDebtPlan, renterPayingExtraPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const view = new URL("./view.js", import.meta.url);
  const p = renterPayingExtraPlan();
  const d = compute(p, { today: "2026-11-06" });
  // $150 + $100 + $70 required on the cards, $400 extra on the Visa: $320 of $3,250 is 9.8%; $720 paid is 22%
  assert.equal(d.minimums, 320); assert.equal(d.payments, 720);
  near(d.dtiRequired, 320 / 3250); near(d.dti, 720 / 3250);
  const t = await pageText(view, p, "2026-11-06");
  assert.match(t, /10% Debt payments vs income required payments: within the 20% guideline for renters/);
  // $140 on the Visa instead of $150: $660 / $3,250 = 20.3%, shown as 20%: within, as it reads
  const q = renterDebtPlan(); q.debts.find((x) => x.id === "setup-debt-credit").minPayment = 140;
  assert.match(await pageText(view, q, "2026-11-06"), /20% Debt payments vs income within the 20% guideline for renters/);
  // $670 / $3,250 = 20.6%, shown as 21%: over
  assert.match(await pageText(view, renterDebtPlan(), "2026-11-06"), /21% Debt payments vs income over the 20% guideline for renters \(rent not counted\)/);
});

test("review UX: the home lender's figure has a verdict, against what lenders accept", async () => {
  const { lenderWithHousing } = await import("./compute.js");
  // (670 + 950) / 3,250 = 49.8%, shown as 50%
  assert.equal(lenderWithHousing(1620 / 3250, 950), "Add a home payment like your $950 rent and a lender would see 50% of your income going to debts: more than most lenders accept (36%, or up to 45 to 50% only with a strong credit score and savings).");
  // (320 + 950) / 3,250 = 39.1%
  assert.equal(lenderWithHousing(1270 / 3250, 950), "Add a home payment like your $950 rent and a lender would see 39% of your income going to debts: more than the 36% most lenders like; some go to 45% with a strong credit score and savings.");
  assert.equal(lenderWithHousing(0.3, 950), "Add a home payment like your $950 rent and a lender would see 30% of your income going to debts: within the 36% most lenders want.");
  // 45.3% shows as 45%: within the stretch, as it reads
  assert.match(lenderWithHousing(0.453, 950), /45% of your income going to debts: more than the 36% most lenders like/);
});

test("review (seen while checking): only one expensive debt is 'first'; the next ones say when", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const w = compute(renterDebtPlan(), { today: "2026-11-06" }).warnings;
  assert.deepEqual(w, [
    "Visa card costs about $109 a month in interest at 29%. Paying it down first saves the most.",
    "Store card costs about $45 a month in interest at 27%. Pay it down once the Visa card is paid off.",
    "Mastercard costs about $66 a month in interest at 24%. Pay it down once the Store card is paid off.",
  ]);
});

// --- verify (2026-11-06): graded at the percent the page prints, even at 28.5% -----------------------------------------------------
test("verify: shownShare rounds as the pages print a percent (core/format.js pct), so 28.5% is 29% in both", async () => {
  const { shownShare } = await import("./compute.js");
  const { pct } = await import("../../../core/format.js");
  // 0.285 is stored as 0.28499999999999998: x * 100 rounds to 28, but the page prints "29%"; likewise 14.5%
  for (const x of [0.145, 0.205, 0.285, 0.365, 0.435, 0.203, 0.2049, 926.25 / 3250]) assert.equal(`${Math.round(shownShare(x) * 100)}%`, pct(x, 0), String(x));
});
