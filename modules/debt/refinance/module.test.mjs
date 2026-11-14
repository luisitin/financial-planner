// The full checks for this page are in tests/debt-pages.test.mjs (shared fixture qa/fixtures/debt-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, twoOffers, offerInputs, offerCosts, interestRun, keepOf, TIE, MAX_MONTHS } from "./compute.js";
import { debtPlan } from "../../../qa/fixtures/debt-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { pmt, amortization } from "../../../core/math/finance.js";

test("refinance: runs on the sample household and on an empty plan", () => {
  const d = compute(debtPlan(), { today: "2026-09-15", rate: 0.05, termYears: 30, closingCosts: 6000, yearsStaying: 7 });
  assert.equal(d.hasData, true); assert.ok(d.monthlySaving > 0);
  assert.ok(compute(emptyPlan(), { today: "2026-09-15" }));
});

// ---------------------------------------------------------------- two offers side by side (gap list, next 60, item 1)
// The invented family of qa/fixtures/family-plan.mjs: $265,000 left at 6.25%, $1,980 a month (no tax or insurance in it),
// 230 months to go. Offer 1 buys the rate down with a point; offer 2 takes a lender credit and adds its costs to the loan.
const T13 = "2026-11-13";
const near = (a, b, tol = 0.01, what = "") => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} vs ${b}`);
const family = async () => (await import("../../../qa/fixtures/family-plan.mjs")).familyPlan(T13);
const ONE = { rate: 0.0525, termYears: 20, points: 1, costs: 4000 };
const TWO = { rate: 0.05625, termYears: 20, credit: 1500, costs: 4000, rollIn: true };

test("an offer's pieces are read with their defaults: 30 years, no points, no credit, paid at closing; no rate (or above 30%) is not ready", () => {
  assert.deepEqual(offerInputs({ rate: 0.055 }), { ready: true, rate: 0.055, termYears: 30, points: 0, credit: 0, costs: 0, rollIn: false });
  assert.equal(offerInputs(null).ready, false); assert.equal(offerInputs({ rate: null }).ready, false); assert.equal(offerInputs({ rate: "" }).ready, false);
  assert.equal(offerInputs({ rate: 0.31 }).ready, false); assert.equal(offerInputs({ rate: -0.01 }).ready, false);
  assert.equal(offerInputs({ rate: 0 }).ready, true, "a 0% loan is a rate");
  const o = offerInputs({ rate: 0.05, termYears: 55.4, points: 9, credit: -5, costs: -1, rollIn: "yes" });
  assert.deepEqual([o.termYears, o.points, o.credit, o.costs, o.rollIn], [40, 5, 0, 0, false], "clamped; rollIn only when true");
});

test("points paid at closing: each point is 1% of today's balance; the cash is the points and the costs less the credit", () => {
  const c = offerCosts(265000, offerInputs({ rate: 0.0525, points: 1, costs: 4000 }));
  assert.deepEqual(c, { loan: 265000, pointsCost: 2650, fees: 6650, creditUsed: 0, creditLeft: 0, net: 6650, cashAtClosing: 6650, rolled: 0 });
  const half = offerCosts(265000, offerInputs({ rate: 0.0525, points: 0.5, costs: 4000, credit: 1000 }));
  assert.equal(half.pointsCost, 1325); assert.equal(half.net, 4325); assert.equal(half.cashAtClosing, 4325);
});

test("points added to the loan are on the bigger loan itself: L = (B + costs - credit) / (1 - points%)", () => {
  const c = offerCosts(265000, offerInputs({ rate: 0.05, points: 2, costs: 4000, credit: 1000, rollIn: true }));
  const L = (265000 + 4000 - 1000) / (1 - 0.02);
  near(c.loan, L, 0.005, "loan"); near(c.pointsCost, 0.02 * L, 0.005, "points on L");
  near(c.net, c.pointsCost + 4000 - 1000, 0.011, "net is the fees less the credit");
  near(c.rolled, L - 265000, 0.005); assert.equal(c.cashAtClosing, 0);
  // the worked example's offer 2: no points, so L = B + costs - credit
  assert.deepEqual(offerCosts(265000, offerInputs(TWO)), { loan: 267500, pointsCost: 0, fees: 4000, creditUsed: 1500, creditLeft: 0, net: 2500, cashAtClosing: 0, rolled: 2500 });
});

test("a lender credit above the fees is not paid out, whether the costs are paid or added; the part left over is said", () => {
  for (const rollIn of [false, true]) {
    const c = offerCosts(265000, offerInputs({ rate: 0.06, costs: 2000, credit: 3000, rollIn }));
    assert.equal(c.loan, 265000); assert.equal(c.net, 0); assert.equal(c.creditUsed, 2000); assert.equal(c.cashAtClosing, 0); assert.equal(c.rolled, 0);
    assert.equal(c.creditLeft, 1000, "the $1,000 the costs do not use");
    // the money critic's case (M2): 2 points ($5,300) and $1,000 of costs against a $20,000 credit leaves $13,700 unused
    const big = offerCosts(265000, offerInputs({ rate: 0.06, points: 2, costs: 1000, credit: 20000, rollIn }));
    assert.deepEqual([big.loan, big.fees, big.creditUsed, big.creditLeft, big.net], [265000, 6300, 6300, 13700, 0]);
  }
  // a credit the fees use up leaves nothing over
  assert.equal(offerCosts(265000, offerInputs({ rate: 0.06, costs: 4000, credit: 1500 })).creditLeft, 0);
  assert.equal(offerCosts(265000, offerInputs({ rate: 0.06, costs: 4000, credit: 4000 })).creditLeft, 0);
});

test("the payment is the standard formula, L x i / (1 - (1 + i)^-n), to the cent; the tax and insurance ride on both payments", async () => {
  const p = await family();
  const t = twoOffers(p, { today: T13, offers: [ONE, TWO], keep: 7 });
  const closed = (L, r, n) => L * (r / 12) / (1 - Math.pow(1 + r / 12, -n));
  near(t.offers[0].toLoan, closed(265000, 0.0525, 240), 0.005, "offer 1"); assert.equal(t.offers[0].toLoan, Math.round(pmt(0.0525 / 12, 240, 265000) * 100) / 100);
  near(t.offers[1].toLoan, closed(267500, 0.05625, 240), 0.005, "offer 2");
  assert.equal(t.offers[0].saving, Math.round((1980 - t.offers[0].payment) * 100) / 100);
  // a payment that holds tax and insurance (the mortgage page's escrow): the same amount is on the offer's payment
  const q = await family(); q.debts.find((x) => q.accounts.find((a) => a.id === x.accountId)?.type === "mortgage").escrowMonthly = 400;
  const e = twoOffers(q, { today: T13, offers: [ONE], keep: 7 });
  assert.equal(e.current.escrow, 400); assert.equal(e.current.toLoan, 1580);
  assert.equal(e.offers[0].payment, 2185.69, "$1,785.69 for the loan and the same $400"); assert.equal(e.offers[0].saving, -205.69);
  // the same as the page's own single offer with the point as its closing costs
  const one = compute(q, { today: T13, rate: 0.0525, termYears: 20, closingCosts: 6650, yearsStaying: 7 });
  assert.equal(one.offer.payment, e.offers[0].payment); assert.equal(one.monthlySaving, e.offers[0].saving); near(one.netWhileStaying, e.offers[0].vsKeeping, 0.02);
});

test("interest month by month is the page's own loop; a plain offer's saving against keeping is compute()'s netWhileStaying", async () => {
  const p = await family();
  const run = interestRun(1000, 0.12, 100, 20);
  assert.equal(run.cum[0], 0); near(run.cum[1], 10, 1e-9); near(run.cum[2], 10 + (1000 + 10 - 100) * 0.01, 1e-9);
  assert.equal(run.paidOff, 11, "1,000 at 1% a month and 100 a month ends in month 11");
  assert.equal(run.cum[20], run.cum[11], "nothing after it is paid off");
  for (const [rate, termYears, closingCosts, yearsStaying] of [[0.055, 30, 6000, 7], [0.05, 15, 3000, 5], [0.07, 30, 4000, 10], [0.06, 20, 0, 12]]) {
    const one = compute(p, { today: T13, rate, termYears, closingCosts, yearsStaying });
    const two = twoOffers(p, { today: T13, offers: [{ rate, termYears, costs: closingCosts }], keep: yearsStaying });
    near(two.offers[0].vsKeeping, one.netWhileStaying, 0.02, `net at ${rate}`);
    near(two.keeping.cost, one.interestWhileStaying.current, 0.01, "keeping's interest");
    near(two.offers[0].cost - closingCosts, one.interestWhileStaying.offer, 0.01, "the offer's interest");
    assert.equal(two.offers[0].payment, one.offer.payment);
  }
});

test("an offer's cost over the years kept is all the money out, less the balance owed either way: fees + interest", async () => {
  const p = await family();
  const LONG = { rate: 0.0525, termYears: 30 };   // the money critic's case (M1): a 30-year loan, the lower payment, the bigger balance
  for (const keep of [5, 7, 10]) {
    const t = twoOffers(p, { today: T13, offers: [ONE, TWO], keep });
    for (const o of [...t.offers, twoOffers(p, { today: T13, offers: [LONG], keep }).offers[0]]) {
      const s = amortization({ principal: o.loan, annualRate: o.rate, years: o.termYears, payment: o.toLoan }).schedule;
      const H = keep * 12, paid = s.slice(0, H).reduce((a, r) => a + r.payment, 0), owed = s[H - 1].balance;
      near(o.owed, owed, 0.05, `offer ${o.n} still owed after ${keep} years`);
      near(o.cost, o.cashAtClosing + paid + o.owed - 265000, 0.05, `offer ${o.n} over ${keep} years`);
    }
    // keeping the loan: its interest is all its money out less what it still owes, the same way
    const now = amortization({ principal: 265000, annualRate: 0.0625, years: 30, payment: 1980 }).schedule;
    near(t.keeping.owed, now[keep * 12 - 1].balance, 0.05, `keeping, still owed after ${keep} years`);
    near(t.keeping.cost, 1980 * keep * 12 + t.keeping.owed - 265000, 0.05, `keeping over ${keep} years`);
  }
  // the longer loan's lower payment leaves more owed at 7 years than keeping or the 20-year offer, and its cost counts that
  const t7 = twoOffers(p, { today: T13, offers: [ONE, LONG], keep: 7 });
  assert.deepEqual([t7.keeping.owed, t7.offers[0].owed, t7.offers[1].owed], [201999.1, 201586.47, 234223.96]);
  assert.ok(t7.offers[1].owed > t7.keeping.owed + 30000);
  // until paid off: nothing is owed at the end, either way
  const off = twoOffers(p, { today: T13, offers: [ONE, LONG], keep: "payoff" });
  assert.deepEqual([off.keeping.owed, ...off.offers.map((o) => o.owed)], [0, 0, 0]);
});

test("break-even: the first month the interest saved covers the costs, the same month as the payment saving plus the lower balance", async () => {
  const p = await family();
  const t = twoOffers(p, { today: T13, offers: [ONE, TWO], keep: 7 });
  const keepRun = interestRun(265000, 0.0625, 1980, MAX_MONTHS);
  const bal = (P, r, pay, k) => { let b = P; for (let i = 0; i < k && b > 0.005; i++) b = Math.max(0, b + b * r / 12 - pay); return b; };
  for (const o of t.offers) {
    const run = interestRun(o.loan, o.rate, o.toLoan, MAX_MONTHS);
    const byInterest = (k) => keepRun.cum[k] - run.cum[k] >= o.net;
    // the brief's way: running saving in payment + (old balance - new balance) covers the cash paid at closing
    const byPayment = (k) => k * (1980 - o.toLoan) + bal(265000, 0.0625, 1980, k) - bal(o.loan, o.rate, o.toLoan, k) >= o.cashAtClosing - 1e-6;
    assert.ok(byInterest(o.breakEven) && !byInterest(o.breakEven - 1), `offer ${o.n}: month ${o.breakEven}`);
    assert.ok(byPayment(o.breakEven) && !byPayment(o.breakEven - 1), `offer ${o.n}, the payment way: month ${o.breakEven}`);
  }
  assert.deepEqual(t.offers.map((o) => o.breakEven), [32, 21]);
  // no costs: nothing to pay back; a higher rate: never
  const free = twoOffers(p, { today: T13, offers: [{ rate: 0.06, termYears: 20 }], keep: 7 }).offers[0];
  assert.equal(free.noCosts, true); assert.equal(free.breakEven, 0);
  const dear = twoOffers(p, { today: T13, offers: [{ rate: 0.07, termYears: 20, costs: 3000 }], keep: 7 }).offers[0];
  assert.equal(dear.noCosts, false); assert.equal(dear.breakEven, null);
});

test("the README's worked example, figure by figure", async () => {
  const t = twoOffers(await family(), { today: T13, offers: [ONE, TWO], keep: 7 });
  assert.equal(t.months, 84); assert.equal(t.keeping.cost, 103319.1);
  const [a, b] = t.offers;
  assert.deepEqual([a.pointsCost, a.net, a.cashAtClosing, a.toLoan, a.saving, a.breakEven, a.cost, a.vsKeeping], [2650, 6650, 6650, 1785.69, 194.31, 32, 93234.43, 10084.67]);
  assert.deepEqual([b.loan, b.net, b.cashAtClosing, b.rolled, b.toLoan, b.saving, b.breakEven, b.cost, b.vsKeeping], [267500, 2500, 0, 2500, 1859.04, 120.96, 21, 96543.06, 6776.04]);
  assert.equal(t.diff, -3308.63); assert.equal(t.cheaper, 1); assert.equal(t.case, "two");
  assert.deepEqual(t.otherWins, { within: 45, from: null }, "offer 2 is the cheaper one through month 45");
});

test("the years kept: 5, 7, 10 years in months; until paid off is the longest loan; at most 600 months; absent, the single offer's years, else 7", async () => {
  const p = await family();
  for (const k of [5, 7, 10]) assert.equal(twoOffers(p, { today: T13, offers: [ONE], keep: k }).months, k * 12);
  const off = twoOffers(p, { today: T13, offers: [ONE, { rate: 0.055, termYears: 30 }], keep: "payoff" });
  assert.ok(off.months >= 360 && off.months <= 361, `a 30-year offer is the longest: ${off.months}`);
  assert.equal(twoOffers(p, { today: T13, offers: [ONE], keep: "payoff" }).months, 240, "the 20-year offer outlasts the 230 months left");
  assert.equal(twoOffers(p, { today: T13, keep: 40 }).months, 480);
  assert.equal(keepOf(undefined, {}), 7); assert.equal(keepOf(undefined, { yearsStaying: 12 }), 12); assert.equal(keepOf(null, { yearsStaying: 3 }), 3);
  assert.equal(keepOf("payoff", { yearsStaying: 3 }), "payoff"); assert.equal(keepOf(99), 40); assert.equal(keepOf(0), 1); assert.equal(keepOf(6.6), 7);
  // the saved values are read when no params are given
  const q = await family(); q.debtPlan = { ...(q.debtPlan ?? {}), refinance: { yearsStaying: 5, offers: [ONE, TWO], keep: 10 } };
  const s = twoOffers(q, { today: T13 });
  assert.equal(s.keep, 10); assert.equal(s.ready, 2); assert.equal(s.offers[1].loan, 267500);
});

test("which costs less: a tie within $100, the other offer winning sooner or later, keeping winning, one offer alone", async () => {
  const p = await family();
  const at = (offers, keep = 7) => twoOffers(p, { today: T13, offers, keep });
  assert.equal(at([]).case, "none"); assert.equal(at([null, null]).ready, 0);
  const one = at([{ rate: 0.055, termYears: 20, costs: 4000 }]);
  assert.equal(one.case, "one"); assert.equal(one.ready, 1); assert.equal(one.cheaper, null);
  assert.equal(at([null, { rate: 0.0699, termYears: 30, costs: 4000 }]).case, "one");
  const tie = at([{ rate: 0.055, termYears: 20, costs: 4000 }, { rate: 0.055, termYears: 20, costs: 4050 }]);
  assert.equal(tie.case, "tie"); assert.equal(tie.diff, -50); assert.ok(Math.abs(tie.diff) < TIE); assert.equal(tie.cheaper, null);
  const keep = at([{ rate: 0.07, termYears: 30, costs: 4000 }, { rate: 0.068, termYears: 30, costs: 3000 }]);
  assert.equal(keep.case, "keep"); assert.ok(keep.offers.every((o) => o.vsKeeping < 0));
  // kept 3 years, the credit wins now and the point wins from month 46 on
  const soon = at([ONE, TWO], 3);
  assert.equal(soon.case, "two"); assert.equal(soon.cheaper, 2); assert.deepEqual(soon.otherWins, { within: null, from: 46 });
  // a 15-year offer at the lower rate against a 30-year: the 15-year is cheaper at every month
  const always = at([{ rate: 0.0525, termYears: 15, costs: 4000 }, { rate: 0.055, termYears: 30, costs: 4000 }]);
  assert.equal(always.cheaper, 1); assert.deepEqual(always.otherWins, { within: null, from: null });
  // no mortgage: nothing to compare
  const none = twoOffers(emptyPlan(), { today: T13, offers: [ONE] });
  assert.equal(none.hasData, false); assert.equal(none.missing, "mortgage");
});

// ---------------------------------------------------------------- invariance: nothing new typed, nothing moves
test("invariance: with no offers saved, compute() gives what it gave before for every invented household, and twoOffers adds no key to it", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const plans = [familyPlan(T13), renterDebtPlan(), retiredCouplePlan(T13), emptyPlan(), debtPlan(), ...ARCHETYPES.map((a) => a.build())];
  const KEYS = ["hasData", "needsOffer", "current", "offer", "monthlySaving", "breakEvenMonths", "yearsStaying", "interestWhileStaying", "netWhileStaying", "verdict", "extraYears", "missing", "mortgageId", "termYears", "closingCosts"];
  let drawn = 0;
  for (const p0 of plans) {
    const p = migrate(structuredClone(p0));
    for (const params of [{ today: T13 }, { today: T13, rate: 0.055, termYears: 30, closingCosts: 6000, yearsStaying: 7 }]) {
      const a = compute(p, params);
      const q = structuredClone(p);
      q.debtPlan = { ...(q.debtPlan ?? {}), refinance: { ...(q.debtPlan?.refinance ?? {}), offers: [ONE, TWO], keep: "payoff" } };
      assert.equal(JSON.stringify(compute(q, params)), JSON.stringify(a), "the saved offers change nothing compute() says");
      for (const k of Object.keys(a)) assert.ok(KEYS.includes(k), `no new key: ${k}`);
      if (a.hasData) drawn++;
    }
  }
  assert.ok(drawn >= 10, `households with a mortgage: ${drawn}`);
});
