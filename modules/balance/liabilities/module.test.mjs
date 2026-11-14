import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { nper, pmt } from "../../../core/math/finance.js";
import * as ui from "../../../core/ui/dom.js";
import { textOf } from "../../../qa/fixtures/fake-dom.mjs";

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

// --- round 8 batch 4 follow-up F2 (2026-11-07): the notices follow the saved payoff order ------------------------------------------
test("F2: a saved smallest-first or own order is the order the notices say; highest-rate-first is as before", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const warn = (order, customOrder) => { const p = renterDebtPlan(); p.debtPlan = { ...(p.debtPlan ?? {}), order, ...(customOrder ? { customOrder } : {}) }; return compute(p, { today: "2026-11-06" }).warnings; };
  // smallest balance first: Store card $2,000, Mastercard $3,300, Visa $4,500 (the order Pay off debts pays in)
  assert.deepEqual(warn("snowball"), [
    "Visa card costs about $109 a month in interest at 29%. Pay it down once the Mastercard is paid off.",
    "Store card costs about $45 a month in interest at 27%. Your payoff plan pays it down first.",
    "Mastercard costs about $66 a month in interest at 24%. Pay it down once the Store card is paid off.",
  ]);
  // the person's own order: Mastercard, Visa, Store card (a card left off the list goes last)
  assert.deepEqual(warn("custom", ["mc", "setup-owe-credit", "store"]), [
    "Visa card costs about $109 a month in interest at 29%. Pay it down once the Mastercard is paid off.",
    "Store card costs about $45 a month in interest at 27%. Pay it down once the Visa card is paid off.",
    "Mastercard costs about $66 a month in interest at 24%. Your payoff plan pays it down first.",
  ]);
  // only the Store card listed: it first, then every other debt Pay off debts pays, by name (Car loan, Mastercard, Visa card)
  assert.match(warn("custom", ["store"]).find((w) => w.startsWith("Mastercard")), /once the Car loan is paid off/);
  // highest rate first saved, or nothing saved: unchanged
  assert.deepEqual(warn("avalanche"), warn(undefined));
  assert.match(warn("avalanche")[0], /Paying it down first saves the most\.$/);
});

// review D3 (2026-11-07): a cheaper debt the saved order pays between two cards comes between them in the notices
test("D3: the notice names the debt the saved order pays just before, even a cheaper one", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const p = renterDebtPlan();
  const car = compute(p, { today: "2026-11-06" }).rows.find((r) => r.name === "Car loan");
  assert.ok(car, "the renter has a car loan");
  p.debtPlan = { ...(p.debtPlan ?? {}), order: "custom", customOrder: ["store", car.id, "mc", "setup-owe-credit"] };
  const w = compute(p, { today: "2026-11-06" }).warnings;
  assert.match(w.find((x) => x.startsWith("Mastercard")), /once the Car loan is paid off/);
  assert.match(w.find((x) => x.startsWith("Visa")), /once the Mastercard is paid off/);
  assert.match(w.find((x) => x.startsWith("Store")), /Your payoff plan pays it down first\.$/);
  assert.equal(compute(p, { today: "2026-11-06" }).order, "custom");
  assert.equal(compute(renterDebtPlan(), { today: "2026-11-06" }).order, "avalanche");
});

// verify of the follow-ups (2026-11-07): the note under the list says highest rate first saves more only when Pay off debts finds it does
test("verify: the order note claims 'highest rate first would save more' only when it does", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { compute: payoff } = await import("../../debt/payoff/compute.js");
  const view = new URL("./view.js", import.meta.url);
  const at = (debtPlan) => { const p = renterDebtPlan(); p.debtPlan = { ...(p.debtPlan ?? {}), ...debtPlan }; return p; };
  // smallest first: $7,962.03 of interest against $7,798.80 highest rate first, so the sentence is true and said
  const snow = at({ order: "snowball" });
  const ps = payoff(snow, { today: "2026-11-07" });
  assert.ok(ps.plans.snowball.totalInterest - ps.plans.avalanche.totalInterest > 100);
  assert.match(await pageText(view, snow, "2026-11-07"), /Your payoff plan pays the smallest balance first\. Paying the highest interest rate first would save more in interest\./);
  // an own order that is highest rate first (Visa 29%, Store 27%, Mastercard 24%, Car loan 9%): the same interest, so it is not said
  const own = at({ order: "custom", customOrder: ["setup-owe-credit", "store", "mc", "setup-owe-car-loan"] });
  const po = payoff(own, { today: "2026-11-07" });
  assert.ok(Math.abs(po.plans.custom.totalInterest - po.plans.avalanche.totalInterest) < 0.5);
  const t = await pageText(view, own, "2026-11-07");
  assert.match(t, /Your payoff plan pays in the order you chose\. Tap a debt/); assert.ok(!/would save more in interest/.test(t), t);
  // an own order that costs more (smallest first, as typed): said
  assert.match(await pageText(view, at({ order: "custom", customOrder: ["store", "mc", "setup-owe-credit"] }), "2026-11-07"), /in the order you chose\. Paying the highest interest rate first would save more in interest\./);
});

test("D7: the costly debts are summed once, in the payoff plan's order; 'never pays off' is kept apart", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const d = compute(renterDebtPlan(), { today: "2026-11-06" });
  assert.equal(d.costly.count, 3);
  assert.deepEqual(d.costly.order.map((c) => c.name), ["Visa card", "Store card", "Mastercard"]);
  assert.equal(Math.round(d.costly.interestMonthly), Math.round(d.rows.filter((r) => r.expensive).reduce((t, r) => t + r.interestMonthly, 0)));
  assert.deepEqual(d.stuck, []);
  const p = renterDebtPlan(); p.debtPlan = { ...(p.debtPlan ?? {}), order: "snowball" };
  assert.deepEqual(compute(p, { today: "2026-11-06" }).costly.order.map((c) => c.name), ["Store card", "Mastercard", "Visa card"]);
});

test("D7, D1, B8: one costly notice with the payoff button, and a way to add a loan or card", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const t = await pageText(new URL("./view.js", import.meta.url), renterDebtPlan(), "2026-11-06");
  assert.match(t, /3 debts cost about \$\d+ a month in interest\. Pay them down in this order: Visa card first \(29%\), then Store card, then Mastercard\./);
  assert.match(t, /See my payoff plan/);
  assert.match(t, /\+ Add a loan or card/);
});

// ---- plain-words pass C10 (2026-11-13, SPEC 13.1): a plural name reads as one ("Your credit cards cost"), the figures as before --------
test("C10: a debt named as a plural (Get started's \"Credit cards\", \"Student loans\") is said as one; a singular name as before", async () => {
  const { debtWords } = await import("./compute.js");
  assert.deepEqual(debtWords("Credit cards"), { many: true, own: true, name: "your credit cards", Name: "Your credit cards", it: "them", they: "they", is: "are", costs: "cost", pays: "pay" });
  assert.deepEqual([debtWords("Store cards").Name, debtWords("Store cards").costs], ["Your store cards", "cost"]);
  assert.deepEqual([debtWords("Amex cards").Name, debtWords("Amex cards").costs, debtWords("Amex cards").own], ["Amex cards", "cost", false], "a name of its own stays as typed");
  for (const n of ["Visa card", "Car loan", "Sears", "Lowe's card", "Mortgage", ""]) assert.deepEqual([debtWords(n).many, debtWords(n).Name, debtWords(n).costs], [false, n, "costs"], n);
  const p = emptyPlan();
  p.accounts.push({ id: "cc", name: "Credit cards", type: "credit", balance: 3000 }, { id: "sl", name: "Student loans", type: "student_loan", balance: 6000 }, { id: "car", name: "Car loan", type: "loan", balance: 4000 });
  p.debts.push({ id: "d1", accountId: "cc", rate: 0.229, minPayment: 120, extra: 0 }, { id: "d2", accountId: "sl", rate: 0.16, minPayment: 90, extra: 0 }, { id: "d3", accountId: "car", rate: 0.07, minPayment: 300, extra: 0 });
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.warnings, [
    "Your credit cards cost about $57 a month in interest at 22.9%. Paying them down first saves the most.",
    "Your student loans cost about $80 a month in interest at 16%. Pay them down once your credit cards are paid off.",
  ]);
  // the figures are the same sums as before: interest = owed x rate / 12
  near(d.rows.find((r) => r.id === "cc").interestMonthly, 3000 * 0.229 / 12); near(d.rows.find((r) => r.id === "sl").interestMonthly, 6000 * 0.16 / 12);
  assert.deepEqual(d.costly.order.map((c) => c.name), ["Credit cards", "Student loans"]);
  // after a singular name: "the Visa card is"; your own order puts a plural first: "Your payoff plan pays them down first"
  const q = structuredClone(p); q.accounts[0].name = "Visa card"; q.debtPlan = { order: "custom", customOrder: ["sl", "cc"] };
  assert.deepEqual(compute(q, { today: TODAY }).warnings, [
    "Visa card costs about $57 a month in interest at 22.9%. Pay it down once your student loans are paid off.",
    "Your student loans cost about $80 a month in interest at 16%. Your payoff plan pays them down first.",
  ]);
  // never paid off: "they never pay off", in the warnings and in `stuck` alike
  const s = structuredClone(p); s.debts[0].minPayment = 20;
  const st = compute(s, { today: TODAY });
  assert.ok(st.stuck.includes("Credit cards: the payment does not even cover the interest, so they never pay off. Raise the payment."), st.stuck.join(" | "));
  assert.ok(st.warnings.includes(st.stuck[0]));
});

test("C10: the form asks in plain words; a card is not asked for a loan length", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const p = emptyPlan();
  p.accounts.push({ id: "cc", name: "Credit cards", type: "credit", balance: 3000 }, { id: "car", name: "Car loan", type: "loan", balance: 4000 });
  p.debts.push({ id: "d1", accountId: "cc", rate: 0.229, minPayment: 120, extra: 0 }, { id: "d3", accountId: "car", rate: 0.07, minPayment: 300, extra: 0, securedBy: "the car" });
  const view = new URL("./view.js", import.meta.url);
  const card = (await renderPage(view, p, TODAY, { route: { rest: ["cc"], query: {} } })).text();
  assert.match(card, /Interest rate a year .* Payment a month .*the minimum the lender asks for Extra you pay a month .*on top of that minimum/);
  for (const w of ["Interest rate per year", "Required payment each month", "Extra you pay each month", "Loan length", "What it is borrowed against"]) assert.ok(!card.includes(w), w);
  assert.match(card, /Your credit cards cost about \$57 a month in interest at 22\.9%/);
  const loan = (await renderPage(view, p, TODAY, { route: { rest: ["car"], query: {} } })).text();
  assert.match(loan, /Loan length in months .*Started.*What it is borrowed against/);
  // (the list's "borrowed against the car" bit reads the account, not the loan's details, so it has never shown: left as it is,
  // nothing new on the first screen; its words are plain for when it does)
  assert.ok(!loan.includes("secured by"));
});

// ---- smart guesses C6 (spec 9.2, 9.4, 12.1): a blank rate or payment is our guess, counted and marked, never a silent 0 and
// never a refusal; a figure typed is the person's, even equal to ours; a guess reopens grey ------------------------------------
async function guessKit(today) {
  const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const G = await import("../../overview/guesses/compute.js");
  const S = await import("../../overview/setup/compute.js");
  const E = await import("../../../core/estimate/index.js");
  const { render } = await import("./view.js");
  const REG = E.mergeEstimators([{ from: "overview/guesses", estimators: G.estimators, tables: G.TABLES }, { from: "overview/setup", estimators: S.estimators }]);
  const O = { estimators: REG.estimators, tables: REG.tables, today };
  const draw = (plan, route = { rest: [], query: {} }) => {
    const root = new FakeElement("main"), saved = [];
    const ctx = { ui, fmt: { ...fmt, today: () => today }, plan, route, modules: new Map(),
      guess: (k, { plan: on, ...o } = {}) => E.estimate(on ?? plan, k, { ...O, ...o }),   // (opts.plan: a draft, as core/app.js)
      store: { get: () => plan, update(fn) { const d = structuredClone(plan); fn(d); E.settle(d, O); saved.push(d); } } };
    render(root, ctx);
    const form = root.all().find((e) => e.tagName === "FORM");
    const box = (n) => form?.all().find((e) => e.getAttribute("name") === n) ?? null;
    const help = (n) => box(n)?.closest("label")?.all().find((e) => e.tagName === "SMALL")?.textContent ?? null;
    return { root, saved, form, box, help };
  };
  return { draw, E, O };
}
const visaNoDetail = async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const p = renterDebtPlan();
  p.debts = p.debts.filter((d) => d.accountId !== "mc");   // the Mastercard has no rate or payment yet
  return p;
};

test("C6 9.2: a debt with no details shows our rate and payment grey; saved blank, both are our guesses, counted and marked", async () => {
  const T = "2026-11-06";
  const { draw, E, O } = await guessKit(T);
  const p = await visaNoDetail();
  const pg = draw(p, { rest: ["mc"], query: {} });
  const rate = E.estimate(p, "debt.credit.rate", { ...O, path: "accounts[mc].balance" });
  const pay = E.estimate(p, "debt.credit.payment", { ...O, path: "accounts[mc].balance", args: { rate: null } });
  assert.ok(rate.value > 0.1 && pay.value > 30, `${rate.value} ${pay.value}`);
  assert.equal(pg.box("rate").getAttribute("placeholder"), String(Number((rate.value * 100).toFixed(1))));
  assert.equal(pg.box("minPayment").getAttribute("placeholder"), ui.guessText(pay, "money"));
  assert.equal(pg.box("rate").hasAttribute("required"), false);
  assert.equal(pg.box("minPayment").hasAttribute("required"), false);
  assert.equal(pg.box("rate").getAttribute("value") ?? "", "");
  assert.equal(pg.help("rate"), "Our guess: the average rate on cards that charge interest. On the statement; type 22.9 for 22.9%.");
  assert.match(pg.help("minPayment"), /^Our guess: the month's interest plus 1% of what you owe, a usual minimum\./);
  assert.match(textOf(pg.root), /Not sure\? Leave a box empty and we'll use the gray figure\./);
  pg.form.dispatch("submit");
  const d = pg.saved.at(-1), row = d.debts.find((x) => x.accountId === "mc");
  assert.equal(row.rate, rate.value);
  assert.equal(row.minPayment, pay.value);
  assert.equal(d.guesses[`debts[${row.id}].rate`].k, "debt.credit.rate");
  assert.equal(d.guesses[`debts[${row.id}].minPayment`].k, "debt.credit.payment");
  assert.ok(E.isGuess(d, `debts[${row.id}].rate`) && E.isGuess(d, `debts[${row.id}].minPayment`));
  // counted: the debt now has a payment and a payoff date on every page that reads Debts
  const r = compute(d, { today: T }).rows.find((x) => x.id === "mc");
  assert.equal(r.payment, pay.value);
  assert.ok(r.payoffDate);
  assert.deepEqual(r.guessed, ["rate", "payment"]);
  // the green line says so, in the record's own words (spec 9.4)
  const again = draw(d);
  assert.match(textOf(again.root), /Saved Mastercard\. Rate and payment are our guesses for now: type the real ones when you have them\./);
  assert.match(textOf(again.root), /The rate and the payment are our guesses for now\./);
});

test("C6: a figure typed equal to our guess is the person's; a guess reopens grey; typed over, it ends", async () => {
  const T = "2026-11-06";
  const { draw, E, O } = await guessKit(T);
  const p = await visaNoDetail();
  const rate = E.estimate(p, "debt.credit.rate", { ...O, path: "accounts[mc].balance" });
  const first = draw(p, { rest: ["mc"], query: {} });
  first.box("rate").value = String(Number((rate.value * 100).toFixed(1)));
  first.box("minPayment").value = "100";
  first.form.dispatch("submit");
  const typed = first.saved.at(-1), row = typed.debts.find((x) => x.accountId === "mc");
  assert.equal(row.rate, rate.value);
  assert.equal(typed.guesses?.[`debts[${row.id}].rate`], undefined, "typed equal to ours: the person's");
  assert.equal("guessed" in compute(typed, { today: T }).rows.find((x) => x.id === "mc"), false);
  // saved blank, then reopened: the boxes are empty and grey, never our figure as typed text (spec P2)
  const blank = draw(p, { rest: ["mc"], query: {} }); blank.form.dispatch("submit");
  const ours = blank.saved.at(-1);
  const reopened = draw(ours, { rest: ["mc"], query: {} });
  assert.equal(reopened.box("rate").getAttribute("value") ?? "", "");
  assert.equal(reopened.box("minPayment").getAttribute("value") ?? "", "");
  assert.ok(reopened.box("rate").getAttribute("placeholder"));
  // saved blank again: nothing about the two figures changes (the same guesses, still ours)
  reopened.form.dispatch("submit");
  const same = reopened.saved.at(-1), id = ours.debts.find((x) => x.accountId === "mc").id;
  assert.equal(same.debts.find((x) => x.id === id).rate, ours.debts.find((x) => x.id === id).rate);
  assert.deepEqual(same.guesses[`debts[${id}].rate`], ours.guesses[`debts[${id}].rate`]);
  // typed over: the person's, and the payment stays ours, worked out again from the typed rate
  const over = draw(ours, { rest: ["mc"], query: {} });
  over.box("rate").value = "12";
  over.box("rate").dispatch("change");
  const moved = E.estimate(ours, "debt.credit.payment", { ...O, path: "accounts[mc].balance", args: { rate: 0.12 } });
  assert.equal(over.box("minPayment").getAttribute("placeholder"), ui.guessText(moved, "money"), "the grey payment follows the rate typed above it");
  over.form.dispatch("submit");
  const after = over.saved.at(-1), r2 = after.debts.find((x) => x.id === id);
  assert.equal(r2.rate, 0.12);
  assert.equal(after.guesses[`debts[${id}].rate`], undefined);
  assert.equal(r2.minPayment, moved.value);
  assert.ok(E.isGuess(after, `debts[${id}].minPayment`));
  assert.match(textOf(draw(after).root), /Saved Mastercard\. The payment is our guess for now: type the real one when you have it\./);
});

test("C6 9.2: a typed figure cleared back to ours is said with the figure we now use", async () => {
  const T = "2026-11-06";
  const { draw, E, O } = await guessKit(T);
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const p = renterDebtPlan();
  const pg = draw(p, { rest: ["mc"], query: {} });
  assert.equal(pg.box("rate").getAttribute("value"), "24", "typed: shown as typed");
  pg.box("rate").value = "";
  pg.form.dispatch("submit");
  const rate = E.estimate(p, "debt.credit.rate", { ...O, path: "accounts[mc].balance" });
  const d = pg.saved.at(-1);
  assert.equal(d.debts.find((x) => x.id === "d-mc").rate, rate.value);
  assert.match(textOf(draw(d).root), new RegExp(`Saved Mastercard\\. Cleared: we'll use our guess, about ${String(Number((rate.value * 100).toFixed(1))).replace(".", "\\.")}%, until you type yours\\.`));
});

test("C6: outside the U.S. there is no guess: the boxes are required as before, and nothing is marked", async () => {
  const T = "2026-11-06";
  const { draw } = await guessKit(T);
  const p = await visaNoDetail();
  p.guide = { ...(p.guide ?? {}), setup: { ...(p.guide?.setup ?? {}), outsideUS: true } };
  const pg = draw(p, { rest: ["mc"], query: {} });
  assert.equal(pg.box("rate").getAttribute("placeholder"), null);
  assert.equal(pg.box("rate").hasAttribute("required"), true);
  assert.equal(pg.box("minPayment").hasAttribute("required"), true);
  assert.doesNotMatch(textOf(pg.root), /Our guess|gray/);
});

test("C6: rows[].guessed names the row's guesses; a plan with none gets no such key (invariance)", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const p = renterDebtPlan();
  const before = compute(p, { today: TODAY });
  assert.ok(before.rows.every((r) => !("guessed" in r)));
  const q = structuredClone(p);
  q.guesses = { "accounts[mc].balance": { k: "debt.credit.owed", v: 3300, u: "total", s: 0.9, at: TODAY, d: TODAY }, "debts[d-mc].minPayment": { k: "debt.credit.payment", v: 100, u: "month", s: null, at: TODAY, d: TODAY } };
  const after = compute(q, { today: TODAY });
  assert.deepEqual(after.rows.find((r) => r.id === "mc").guessed, ["owed", "payment"]);
  // every other figure is the same as without the ledger
  const strip = (d) => JSON.parse(JSON.stringify(d.rows.map(({ guessed, ...r }) => r)));
  assert.deepEqual(strip(after), strip(before));
  // an older plan's flag on the row (rateGuessed) reads as our guess too
  const old = structuredClone(p); old.debts.find((x) => x.id === "d-store").rateGuessed = 0.27;
  assert.deepEqual(compute(old, { today: TODAY }).rows.find((r) => r.id === "store").guessed, ["rate"]);
});

test("C6: no grey example is left in a box on the Debts form (the example is in the help line)", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const p = emptyPlan();
  p.accounts.push({ id: "car", name: "Car loan", type: "loan", balance: 4000 });
  const pg = await renderPage(new URL("./view.js", import.meta.url), p, TODAY, { route: { rest: ["car"], query: {} } });
  const boxes = pg.root.all().filter((e) => e.tagName === "INPUT");
  assert.ok(boxes.length >= 5);
  for (const b of boxes) assert.equal(b.getAttribute("placeholder"), null, b.getAttribute("name"));
  assert.match(pg.text(), /What it is borrowed against for example, the house or the car; leave blank if nothing/);
});

// ---- C6 review fixes (2026-11-14): a figure of ours is shown and kept as the plan counts it; a paid-off debt; the extra box
test("C6 fix F1/P2: an older plan's guessed rate (rateGuessed) shows grey as the figure counted, and Save with nothing typed moves nothing", async () => {
  const T = "2026-11-06";
  const { draw, E, O } = await guessKit(T);
  const p = (await import("../../../qa/fixtures/renter-debt-plan.mjs")).renterDebtPlan();
  // Get started's guesses before the ledger: the car loan's 7.17% and the Visa card's 22.36%, marked on the rows only
  const car = p.debts.find((d) => d.id === "setup-debt-car-loan"); car.rate = 0.0717; car.rateGuessed = 0.0717;
  const visa = p.debts.find((d) => d.id === "setup-debt-credit"); visa.rate = 0.2236; visa.rateGuessed = 0.2236;
  const today = E.estimate(p, "debt.car-loan.rate", { ...O, path: "accounts[setup-owe-car-loan].balance" });
  assert.ok(today && Math.abs(today.value - 0.0717) > 0.01, "today's table gives another figure (the case the review found)");
  for (const [acct, id, want] of [["setup-owe-car-loan", "setup-debt-car-loan", 0.0717], ["setup-owe-credit", "setup-debt-credit", 0.2236]]) {
    const pg = draw(p, { rest: [acct], query: {} });
    assert.equal(pg.box("rate").getAttribute("value") ?? "", "", "still ours: it opens grey");
    assert.equal(pg.box("rate").getAttribute("placeholder"), want === 0.0717 ? "7.17" : "22.36", "the grey figure is the one the plan counts, to its last digit (round 2, F3: not 7.2)");
    assert.equal(pg.box("rate").hasAttribute("required"), false);
    pg.form.dispatch("submit");
    const d = pg.saved.at(-1), row = d.debts.find((x) => x.id === id);
    assert.equal(row.rate, want, "Save with nothing typed: the rate is exactly as it was (not today's table, not rounded)");
    assert.equal(row.rateGuessed, want, "still our guess, the older mark kept");
    assert.equal(d.guesses?.[`debts[${id}].rate`], undefined, "nothing written to the ledger (settle would move it)");
    assert.ok(E.isGuess(d, `debts[${id}].rate`));
    assert.deepEqual(compute(d, { today: T }).rows.find((r) => r.id === acct).payment, compute(p, { today: T }).rows.find((r) => r.id === acct).payment);
  }
  // typed over, it is the person's
  const over = draw(p, { rest: ["setup-owe-car-loan"], query: {} });
  over.box("rate").value = "6.5"; over.form.dispatch("submit");
  const mine = over.saved.at(-1).debts.find((x) => x.id === "setup-debt-car-loan");
  assert.equal(mine.rate, 0.065);
  assert.equal("rateGuessed" in mine, false);
});

test("C6 fix F1: a ledger guess kept frozen at another figure than today's shows that figure grey; a payment of ours stays while the rate is as on file", async () => {
  const T = "2026-11-06";
  const { draw, E } = await guessKit(T);
  const p = (await import("../../../qa/fixtures/renter-debt-plan.mjs")).renterDebtPlan();
  // frozen entries (their data is newer than the tables: settle never puts older figures back), at figures today's tables do not give
  p.guesses = {
    "debts[d-store].rate": { k: "debt.credit.rate", v: 0.27, u: "rate", s: null, at: "2026-10-01", d: "2099-01-01" },
    "debts[d-store].minPayment": { k: "debt.credit.payment", v: 70, u: "month", s: null, at: "2026-10-01", d: "2099-01-01" },
  };
  const pg = draw(p, { rest: ["store"], query: {} });
  assert.equal(pg.box("rate").getAttribute("placeholder"), "27");
  assert.equal(pg.box("minPayment").getAttribute("placeholder"), "70");
  assert.match(pg.help("rate"), /^Our guess: what we filled in for now\./, "today's why is not said beside a figure today's table did not give");
  pg.form.dispatch("submit");
  const d = pg.saved.at(-1);
  assert.deepEqual(d.debts.find((x) => x.id === "d-store"), p.debts.find((x) => x.id === "d-store"));
  assert.deepEqual(d.guesses, p.guesses, "the entries untouched");
  // a rate typed above it: the payment of ours is worked out again from it (as before)
  const typed = draw(p, { rest: ["store"], query: {} });
  typed.box("rate").value = "12"; typed.box("rate").dispatch("change");
  assert.notEqual(typed.box("minPayment").getAttribute("placeholder"), "70");
  // typed, then cleared again: back to the payment on file
  typed.box("rate").value = ""; typed.box("rate").dispatch("change");
  assert.equal(typed.box("minPayment").getAttribute("placeholder"), "70");
  assert.ok(E.isGuess(d, "debts[d-store].minPayment"));
});

test("C6 fix F4: a paid-off debt whose payment is ours opens with the figure on file grey (not an empty required box) and saves unchanged; its row names no guess", async () => {
  const T = "2026-11-06";
  const { draw } = await guessKit(T);
  const p = (await import("../../../qa/fixtures/renter-debt-plan.mjs")).renterDebtPlan();
  p.accounts.find((a) => a.id === "mc").balance = 0;
  p.guesses = {
    "debts[d-mc].rate": { k: "debt.credit.rate", v: 0.24, u: "rate", s: null, at: "2026-10-01", d: "2099-01-01" },
    "debts[d-mc].minPayment": { k: "debt.credit.payment", v: 100, u: "month", s: null, at: "2026-10-01", d: "2099-01-01" },
  };
  const row = compute(p, { today: T }).rows.find((r) => r.id === "mc");
  assert.equal(row.paidOff, true);
  assert.equal("guessed" in row, false, "a paid-off debt's rate and payment count for nothing: not named");
  const list = draw(p);
  assert.doesNotMatch(textOf(list.root), /are our guesses for now/);
  const pg = draw(p, { rest: ["mc"], query: {} });
  assert.equal(pg.box("minPayment").getAttribute("value") ?? "", "");
  assert.equal(pg.box("minPayment").getAttribute("placeholder"), "100");
  assert.equal(pg.box("minPayment").hasAttribute("required"), false, "Save is never held for a payment nobody owes");
  // a rate typed: still no new payment of ours on a debt with nothing owed, and the one on file stays
  pg.box("rate").value = "20"; pg.box("rate").dispatch("change");
  assert.equal(pg.box("minPayment").getAttribute("placeholder"), "100");
  pg.box("rate").value = ""; pg.box("rate").dispatch("change");
  pg.form.dispatch("submit");
  const d = pg.saved.at(-1);
  assert.ok(d, "saved");
  assert.deepEqual(d.debts.find((x) => x.id === "d-mc"), p.debts.find((x) => x.id === "d-mc"));
  assert.deepEqual(d.guesses, p.guesses);
});

test("C6 fix P4/P5: the extra opens empty when there is none (saved as 0, as before); a row's guess line is one short sentence", async () => {
  const T = "2026-11-06";
  const { draw } = await guessKit(T);
  const p = (await import("../../../qa/fixtures/renter-debt-plan.mjs")).renterDebtPlan();
  const pg = draw(p, { rest: ["mc"], query: {} });
  assert.equal(pg.box("extra").getAttribute("value") ?? "", "", "no typed $0 under 'leave blank for none'");
  pg.form.dispatch("submit");
  assert.equal(pg.saved.at(-1).debts.find((x) => x.id === "d-mc").extra, 0);
  const q = (await import("../../../qa/fixtures/renter-debt-plan.mjs")).renterDebtPlan();
  q.debts.find((x) => x.id === "d-store").rateGuessed = 0.27;
  const text = textOf(draw(q).root);
  assert.match(text, /The rate is our guess for now\./);
  assert.doesNotMatch(text, /tap to type the real/);
});

// ---- C6 review round 2 (2026-11-14) -----------------------------------------------------------------------------------------
test("C6 round 2 F2: a payment of ours that rounds to $0 is no guess: the box is asked, and nothing is counted or marked at $0", async () => {
  const T = "2026-11-06";
  const { draw, E } = await guessKit(T);
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const mk = (type, balance) => {
    const p = emptyPlan(); p.household.people = [{ id: "s", name: "Sam", role: "self", birthDate: "1985-01-01" }]; p.household.state = "OH";
    p.income.push({ id: "i", name: "Pay", type: "salary", amount: 5000, period: "monthly", ownerId: "s" });
    p.accounts.push({ id: "L1", name: "Debt", type, balance, history: [] });
    return p;
  };
  for (const [type, balance] of [["loan", 1], ["mortgage", 250], ["student_loan", 250]]) {
    const p = mk(type, balance);
    const pay = E.estimate(p, `debt.${type === "student_loan" ? "student" : type}.payment`, { estimators: (await import("../../overview/guesses/compute.js")).estimators, tables: (await import("../../overview/guesses/compute.js")).TABLES, today: T, path: "accounts[L1].balance" });
    assert.ok(!pay || Math.round(pay.value) === 0, `${type} ${balance}: the table's payment rounds to $0 (the case)`);
    const pg = draw(p, { rest: ["L1"], query: {} });
    const box = pg.box("minPayment");
    assert.equal(box.getAttribute("placeholder"), null, `${type}: no grey $0`);
    assert.equal(box.hasAttribute("data-guess"), false);
    assert.equal(box.hasAttribute("required"), true, `${type}: the payment is asked`);
    assert.ok(pg.box("rate").getAttribute("placeholder"), `${type}: the rate is still our guess`);
    // the rate typed: the payment of ours worked out from it is $0 again, still none
    pg.box("rate").value = "5"; pg.box("rate").dispatch("change");
    assert.equal(box.getAttribute("placeholder"), null);
    assert.equal(box.hasAttribute("required"), true);
    pg.box("rate").value = ""; pg.box("rate").dispatch("change");
    // a payment typed: saved as the person's, the rate our guess
    box.value = "25"; pg.form.dispatch("submit");
    const d = pg.saved.at(-1), row = d.debts.find((x) => x.accountId === "L1");
    assert.equal(row.minPayment, 25);
    assert.equal(E.isGuess(d, `debts[${row.id}].minPayment`), false);
    assert.ok(E.isGuess(d, `debts[${row.id}].rate`));
  }
  // above $0 the payment is still ours (as before)
  const big = draw(mk("loan", 4000), { rest: ["L1"], query: {} });
  assert.ok(Number(String(big.box("minPayment").getAttribute("placeholder")).replace(/,/g, "")) > 0);
  assert.equal(big.box("minPayment").hasAttribute("required"), false);
});
