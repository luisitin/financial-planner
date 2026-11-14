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

// ---------------------------------------------------------------- the words: one sentence per case (docs/OPTIONAL.md R5)
test("each case has its own written sentence", async () => {
  const fmt = await import("../../../core/format.js");
  const { twoSentence, horizonWords } = await import("./view.js");
  const p = await family();
  const say = (offers, keep = 7) => twoSentence(twoOffers(p, { today: T13, offers, keep }), fmt, "USD");
  assert.equal(horizonWords(7), "Over 7 years"); assert.equal(horizonWords(1), "Over 1 year"); assert.equal(horizonWords("payoff"), "Until the loans are paid off");
  assert.equal(say([]), null);
  assert.equal(say([{ rate: 0.055, termYears: 20, costs: 4000 }]), "Over 7 years, offer 1 costs $8,353 less than keeping your loan. Type the other offer to compare the two.");
  assert.equal(say([null, { rate: 0.0699, termYears: 30, costs: 4000 }]), "Over 7 years, offer 2 costs $25,131 more than keeping your loan. Type the other offer to compare the two.");
  // about the same as keeping: a rate that saves about its costs over the years kept
  let same = null;
  for (let r = 0.059; r <= 0.0625 && !same; r += 0.00001) { const t = twoOffers(p, { today: T13, offers: [{ rate: r, termYears: 20, costs: 2000 }], keep: 7 }); if (Math.abs(t.offers[0].vsKeeping) < TIE) same = t; }
  assert.ok(same, "a rate near break-even exists");
  assert.equal(twoSentence(same, fmt, "USD"), "Over 7 years, offer 1 costs about the same as keeping your loan. Type the other offer to compare the two.");
  assert.equal(say([{ rate: 0.07, termYears: 30, costs: 4000 }, { rate: 0.068, termYears: 30, costs: 3000 }]), "Over 7 years, keeping your loan costs less than either offer: offer 1 costs $25,318 more, offer 2 $20,579 more.");
  assert.equal(say([{ rate: 0.055, termYears: 20, costs: 4000 }, { rate: 0.055, termYears: 20, costs: 4050 }]), "Over 7 years, the two offers cost about the same: $50 apart.");
  assert.equal(say([ONE, TWO]), "Over 7 years, offer 1 costs $3,309 less than offer 2; offer 2 would cost less if you move or pay it off within 3 years 9 months.");
  assert.equal(say([ONE, TWO], 3), "Over 3 years, offer 2 costs $818 less than offer 1; offer 1 would cost less if you keep the loan 3 years 10 months or longer.");
  assert.equal(say([{ rate: 0.0525, termYears: 15, costs: 4000 }, { rate: 0.055, termYears: 30, costs: 4000 }]), "Over 7 years, offer 1 costs $16,111 less than offer 2, and it stays the cheaper one however long you keep the loan.");
  assert.equal(say([ONE, TWO], "payoff"), "Until the loans are paid off, offer 1 costs $10,953 less than offer 2; offer 2 would cost less if you move or pay it off within 3 years 9 months.");
});

test("the lines under each offer: when its costs are paid back, what is paid at closing", async () => {
  const fmt = await import("../../../core/format.js");
  const { evenWords, cashWords, offerWords, savedWords, owedWords, creditLeftWords, savedLede } = await import("./view.js");
  const p = await family();
  const t = twoOffers(p, { today: T13, offers: [ONE, TWO], keep: 7 });
  assert.equal(evenWords(t.offers[0], t, fmt), "Its costs are paid back after 2 years 8 months.");
  const short = twoOffers(p, { today: T13, offers: [ONE], keep: 2 });
  assert.equal(evenWords(short.offers[0], short, fmt), "Its costs are paid back after 2 years 8 months, later than the 2 years you expect to keep it.");
  const one = twoOffers(p, { today: T13, offers: [ONE], keep: 1 });
  assert.equal(evenWords(one.offers[0], one, fmt), "Its costs are paid back after 2 years 8 months, later than the 1 year you expect to keep it.");
  const off = twoOffers(p, { today: T13, offers: [ONE], keep: "payoff" });
  assert.equal(evenWords(off.offers[0], off, fmt), "Its costs are paid back after 2 years 8 months.");
  const free = twoOffers(p, { today: T13, offers: [{ rate: 0.06, termYears: 20 }], keep: 7 });
  assert.equal(evenWords(free.offers[0], free, fmt), "No costs to pay back.");
  const dear = twoOffers(p, { today: T13, offers: [{ rate: 0.07, termYears: 20, costs: 3000 }], keep: 7 });
  assert.equal(evenWords(dear.offers[0], dear, fmt), "It never pays back its costs.");
  assert.equal(cashWords(t.offers[0], fmt, "USD"), "$6,650 at closing");
  assert.equal(cashWords(t.offers[1], fmt, "USD"), "nothing at closing: $2,500 added to the loan");
  const covered = twoOffers(p, { today: T13, offers: [{ rate: 0.06, termYears: 20, costs: 2000, credit: 3000 }], keep: 7 });
  assert.equal(cashWords(covered.offers[0], fmt, "USD"), "nothing at closing: the credit covers the costs");
  assert.equal(cashWords(free.offers[0], fmt, "USD"), "nothing to pay at closing");
  // a number and its word never split over two lines (a no-break space between them)
  assert.equal(offerWords(t.offers[0], fmt, "USD"), "5.25%, 20\u00a0years, 1\u00a0point");
  const plain = (o) => offerWords(o, fmt, "USD").replace(/\u00a0/g, " ");
  assert.equal(plain(t.offers[1]), "5.625%, 20 years, $1,500 credit");
  assert.equal(plain(offerInputs({ rate: 0.0575 })), "5.75%, 30 years, no points");
  assert.equal(plain(offerInputs({ rate: 0.055, points: 1.5, credit: 500 })), "5.5%, 30 years, 1.5 points, $500 credit");
  assert.equal(savedWords(t, fmt, "USD"), "Saved. Over 7 years, offer 1 costs $3,309 less than offer 2; offer 2 would cost less if you move or pay it off within 3 years 9 months.");
  // what is still owed at the end of the years kept (M1), one case each
  assert.equal(owedWords(t.offers[0].owed, t, fmt, "USD"), "Still owed after 7 years: $201,586.");
  assert.equal(owedWords(t.keeping.owed, t, fmt, "USD"), "Still owed after 7 years: $201,999.");
  assert.equal(owedWords(0, t, fmt, "USD"), "Paid off within the 7 years.");
  assert.equal(owedWords(1000, one, fmt, "USD"), "Still owed after 1 year: $1,000.");
  assert.equal(owedWords(0, off, fmt, "USD"), null, "until paid off: nothing is owed, nothing to say");
  // a credit above the costs (M2): the part not counted is said; a credit the costs use up says nothing
  assert.equal(creditLeftWords(covered.offers[0], fmt, "USD"), "The credit is $1,000 more than the costs; that part is not counted.");
  assert.equal(creditLeftWords(t.offers[1], fmt, "USD"), null);
  // the hero's line for saved offers: the sentence without its ask
  assert.equal(savedLede(t, fmt, "USD"), "Your saved offers: over 7 years, offer 1 costs $3,309 less than offer 2; offer 2 would cost less if you move or pay it off within 3 years 9 months.");
  assert.equal(savedLede(twoOffers(p, { today: T13, offers: [ONE], keep: 7 }), fmt, "USD"), "Your saved offer: over 7 years, offer 1 costs $10,085 less than keeping your loan.");
  assert.equal(savedLede(twoOffers(p, { today: T13, offers: [ONE, TWO], keep: "payoff" }), fmt, "USD"), "Your saved offers: until the loans are paid off, offer 1 costs $10,953 less than offer 2; offer 2 would cost less if you move or pay it off within 3 years 9 months.");
  assert.equal(savedLede(twoOffers(p, { today: T13, offers: [], keep: 7 }), fmt, "USD"), null);
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

// ---------------------------------------------------------------- the page: one quiet tap away, saved only by its own Save
async function livePage(plan0, today = T13, { fieldError = null } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  let cur = migrate(structuredClone(plan0));
  const page = { saves: 0, root: null };
  const store = { get: () => cur, update: (fn) => { const d = structuredClone(cur); fn(d); cur = d; page.saves++; } };
  page.draw = () => { page.root = new FakeElement("main"); render(page.root, { ui: fieldError ? { ...ui, fieldError } : ui, fmt: { ...fmt, today: () => today }, plan: cur, route: { group: "debt", id: "refinance", rest: [], query: {} }, module: { group: "debt", id: "refinance" }, store, redraw: () => page.draw(), computeOf: () => null }); return page; };
  page.plan = () => cur;
  page.text = () => textOf(page.root);
  page.part = (id) => page.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  page.body = (id) => textOf(page.part(id)?.querySelector(".fold-body"));
  page.button = (label, scope = page.root) => scope.all().find((e) => e.tagName === "BUTTON" && textOf(e) === label);
  page.first = () => { const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !n.hasAttribute("open") ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.tagName === "STYLE" ? "" : n.childNodes.map(walk).join(" ")); return walk(page.root).replace(/\s+/g, " ").trim(); };
  page.filled = () => { const shut = (e) => { for (let x = e; x; x = x.parentNode) if (x.tagName === "DETAILS" && !x.hasAttribute("open")) return true; return false; }; return page.root.all().filter((e) => e.tagName === "BUTTON" && !/secondary|chip/.test(e.className) && !e.hidden && !shut(e)).map((e) => textOf(e)); };
  page.open = () => Object.fromEntries(page.root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open")]));
  return page.draw();
}
const typeIn = (page, name, value, change = true) => { const box = page.root.querySelector(`[name="${name}"]`); box.value = value; box.dispatch("input"); if (change) box.dispatch("change"); return box; };
const submitOf = (page, name) => page.root.querySelector(`[name="${name}"]`).closest("form").dispatch("submit");
const chip = (page, label) => { const b = page.root.all().find((e) => e.tagName === "BUTTON" && /\bchip\b/.test(e.className) && e.textContent.replace(/\s+/g, " ").trim() === label); assert.ok(b, `chip ${label}`); b.click(); };
const fresh = async () => { const v = await import("./view.js"); v._reset?.(); };

const COMPARED = { rate: 0.055, termYears: 30, closingCosts: 6000, yearsStaying: 7 };
const withRefi = async (refinance) => { const p = await family(); p.debtPlan = { ...(p.debtPlan ?? {}), refinance }; return p; };

test("first view: nothing new before an offer is compared; once one is, the comparison is one shut row, titled as asked", async () => {
  await fresh();
  // nothing compared: the page as before, the hero, the offer's four boxes and its one filled button, and no second way
  // to type an offer (a person critic's P3: the part asked the same questions again under other names)
  const none = await livePage(await family());
  assert.equal(none.part("offers"), undefined, "no comparison before an offer is compared");
  assert.match(none.first(), /^Refinance Your mortgage: \$265,000 at 6\.25%, \$1,980 a month\. Type an offer below\. The offer/);
  assert.ok(!/Compare two offers/.test(none.text()));
  assert.ok(!/usually 2 to 5%/.test(none.text()), "no unsourced share of the loan on screen");
  // an offer compared: one shut row, nothing of it on the first view, one tap away
  await fresh();
  const page = await livePage(await withRefi(COMPARED));
  const part = page.part("offers");
  assert.ok(part && !part.hasAttribute("open"), "shut");
  assert.equal(part.dataset.kind, "own");
  assert.match(page.first(), /Compare two offers/);
  for (const w of ["Offer 1", "Points", "Lender credit", "Save these offers", "Until paid off"]) assert.ok(!page.first().includes(w), w);
  assert.ok(page.body("offers").includes("Save these offers"), "one tap away");
  // no box in the part is required (R9 item 9), and no hand-written <details>
  for (const b of part.all().filter((e) => e.tagName === "INPUT")) assert.equal(b.hasAttribute("required"), false, b.getAttribute("name"));
  assert.ok(page.root.all().filter((e) => e.tagName === "DETAILS").every((d) => d.dataset.part || /form-more/.test(d.className)));
  // no mortgage: no comparison (the page asks for the mortgage first)
  const empty = await livePage(emptyPlan());
  assert.equal(empty.part("offers"), undefined);
});

test("the part asks in the page's own words: the same labels as the offer above, points said in plain words, the credit named", async () => {
  await fresh();
  const page = await livePage(await withRefi(COMPARED));
  page.part("offers").setAttribute("open", "");
  const labels = page.part("offers").all().filter((e) => /\bfield-label\b/.test(e.className ?? "")).map((e) => e.textContent.replace(/\s+/g, " ").trim());
  // the rate and the term read as they do in "The offer" (P3); points say what they are (P4)
  assert.ok(labels.includes("Offered rate per year") && labels.includes("New term in years"), labels.join(" | "));
  for (const w of ["Rate a year", "How long the new loan is"]) assert.ok(!labels.includes(w), w);
  assert.ok(labels.includes("Points (a fee for a lower rate)"), labels.join(" | "));
  assert.ok(!labels.includes("Points"), "never the bare word");
  // the one optional box is named for what it holds (P5)
  const more = page.part("offers").all().find((e) => e.tagName === "DETAILS" && /form-more/.test(e.className));
  assert.equal(more.querySelector("summary").textContent.replace(/[\s\u203a]+/g, " ").trim(), "Lender credit (optional)");
  assert.ok(more.querySelector('[name="twoCredit"]'));
  // one filled button on the screen with the part open: the offer's Compare; Save these offers is outlined (P1)
  const save = page.button("Save these offers", page.part("offers"));
  assert.match(save.className, /\bsecondary\b/);
  assert.ok(!page.filled().includes("Save these offers"));
  assert.ok(page.filled().length <= 1, page.filled().join(", "));
});

test("two offers saved and none compared above: the hero says their answer, not \u201cType an offer below.\u201d", async () => {
  await fresh();
  const both = await livePage(await withRefi({ offers: [ONE, TWO], keep: 7 }));
  assert.match(both.first(), /^Refinance Your mortgage: \$265,000 at 6\.25%, \$1,980 a month\. Your saved offers: over 7 years, offer 1 costs \$3,309 less than offer 2; offer 2 would cost less if you move or pay it off within 3 years 9 months\. The offer/);
  assert.ok(!/Type an offer below/.test(both.first()));
  assert.match(both.part("offers").querySelector(".fold-status").textContent, /set by you/);
  await fresh();
  const one = await livePage(await withRefi({ offers: [ONE, null], keep: 7 }));
  assert.match(one.first(), /Your saved offer: over 7 years, offer 1 costs \$10,085 less than keeping your loan\. The offer/);
  assert.ok(!/Type the other offer|Type an offer below/.test(one.first()));
  // nothing saved: as before
  await fresh();
  assert.match((await livePage(await family())).first(), /a month\. Type an offer below\./);
});

test("offer 1 starts from the offer compared above; chips and boxes change the answer at once and save nothing until Save these offers", async () => {
  await fresh();
  const page = await livePage(await withRefi(COMPARED));
  // offer 1 is the compared offer (not saved), so the answer is already there and offer 2's boxes are out
  assert.match(page.body("offers"), /Offer 1: 5\.5%, 30 years, no points, costs paid at closing/);
  assert.match(page.body("offers"), /Over 7 years, offer 1 costs \$567 less than keeping your loan\./);
  assert.match(page.body("offers"), /Offer 2 New term in years/);
  typeIn(page, "twoRate", "5.625");
  typeIn(page, "twoCosts", "4,000");
  chip(page, "20 years");
  chip(page, "Add them to the loan");
  assert.equal(page.saves, 0, "nothing saved yet");
  assert.match(page.body("offers"), /Not saved yet/);
  // while offer 2's boxes are out the answer is its sentence, changing as they are typed; the figures of each offer wait
  assert.match(page.body("offers"), /Over 7 years, offer 2 costs \$4,181 less than offer 1, and it stays the cheaper one however long you keep the loan\./);
  assert.ok(!/Offer 2 · |How these are worked out/.test(page.body("offers")));
  chip(page, "10 years");
  assert.match(page.body("offers"), /^.*Over 10 years, /);
  assert.equal(page.saves, 0);
  submitOf(page, "twoRate");
  assert.equal(page.saves, 1);
  const rf = page.plan().debtPlan.refinance;
  assert.deepEqual(rf.offers, [{ rate: 0.055, termYears: 30, points: 0, credit: 0, costs: 6000, rollIn: false }, { rate: 0.05625, termYears: 20, points: 0, credit: 0, costs: 4000, rollIn: true }]);
  assert.equal(rf.keep, 10);
  assert.deepEqual([rf.rate, rf.termYears, rf.closingCosts, rf.yearsStaying], [0.055, 30, 6000, 7], "the single offer is kept as it was");
  page.draw();
  const said = page.part("offers").querySelector(".notice.ok");
  assert.ok(said, "a green line");
  assert.match(said.textContent, /^Saved\. Over 10 years, offer 2 costs \$[\d,]+ less than offer 1/);
  assert.match(page.part("offers").querySelector(".fold-status").textContent, /set by you/);
  // said once (a person critic's P6): the green line stands in the answer's place at the top, nothing under Save
  const sentence = said.textContent.replace(/^Saved\. /, "");
  assert.equal(page.body("offers").split(sentence).length - 1, 1, "the answer once in the part");
  assert.ok(page.body("offers").indexOf(sentence) < page.body("offers").indexOf("How long you expect to keep the loan"), "at the top, above the chips");
  assert.equal(page.body("offers").split("Save these offers").pop().indexOf("Saved."), -1, "nothing green under Save");
  // both offers saved: no boxes out, so each offer's figures, what each still owes then, and how they are worked out
  assert.match(page.body("offers"), /Offer 2 · 5\.625%, 20 years, no points \$1,869 a month \$111 less than now · nothing at closing: \$4,000 added to the loan/);
  assert.match(page.body("offers"), /Still owed after 10 years: \$[\d,]+\. Keeping your loan \$1,980 a month \$[\d,]+ of interest over 10 years\. Still owed after 10 years: \$[\d,]+\./);
  assert.match(page.body("offers"), /How these are worked out/);
  // the next change puts the plain answer back in its place
  chip(page, "7 years");
  assert.equal(page.part("offers").querySelector(".notice.ok"), null);
  assert.match(page.body("offers"), /Over 7 years, offer \d costs/);
  page.button("Change", page.part("offers")).click();
  assert.ok(!/Offer 2 · |How these are worked out/.test(page.body("offers")), "Change: one offer's boxes, the sentence alone");
});

test("a missing rate is held at its box; offer 1 saved alone opens offer 2; the single offer's Compare keeps both", async () => {
  await fresh();
  const said = [];
  const fieldError = (box, text) => { said.push([box?.getAttribute("name"), text]); return false; };
  const page = await livePage(await withRefi(COMPARED), T13, { fieldError });
  assert.match(page.body("offers"), /Offer 2 New term in years/);
  submitOf(page, "twoRate");
  assert.deepEqual(said, [["twoRate", "Type the rate, like 5.5."]]); assert.equal(page.saves, 0);
  // offer 1 changed to buy the rate down with a point, saved on its own
  page.button("Change", page.part("offers")).click();
  assert.equal(page.root.querySelector('[name="twoRate"]').value, "5.5", "offer 1's boxes hold the offer compared above");
  assert.match(page.body("offers"), /Offer 2: not typed yet/);
  typeIn(page, "twoRate", "5.25"); chip(page, "20 years"); chip(page, "1 point"); typeIn(page, "twoCosts", "4,000");
  submitOf(page, "twoRate");
  assert.equal(page.saves, 1);
  assert.deepEqual(page.plan().debtPlan.refinance.offers, [{ rate: 0.0525, termYears: 20, points: 1, credit: 0, costs: 4000, rollIn: false }, null]);
  assert.equal(page.plan().debtPlan.refinance.keep, 7);
  page.draw();
  assert.equal(page.part("offers").hasAttribute("open"), true, "the saved part stays open (R17)");
  assert.equal(page.part("offers").querySelector(".notice.ok").textContent, "Saved. Over 7 years, offer 1 costs $10,085 less than keeping your loan. Type the other offer to compare the two.");
  assert.ok(!page.body("offers").includes("Not saved yet"));
  assert.match(page.body("offers"), /Offer 1: 5\.25%, 20 years, 1 point, costs paid at closing Change Offer 2 New term in years/);
  // offer 2 with a lender credit (under "Lender credit (optional)") and its costs added to the loan
  typeIn(page, "twoRate", "5.625"); chip(page, "20 years"); typeIn(page, "twoCosts", "4,000"); typeIn(page, "twoCredit", "1,500"); chip(page, "Add them to the loan");
  submitOf(page, "twoRate");
  page.draw();
  assert.equal(page.part("offers").querySelector(".notice.ok").textContent, "Saved. Over 7 years, offer 1 costs $3,309 less than offer 2; offer 2 would cost less if you move or pay it off within 3 years 9 months.");
  assert.match(page.body("offers"), /Offer 2 · 5\.625%, 20 years, \$1,500 credit \$1,859 a month \$121 less than now · nothing at closing: \$2,500 added to the loan/);
  assert.match(page.body("offers"), /Offer 1 · 5\.25%, 20 years, 1 point .* Still owed after 7 years: \$201,586\./);
  // Change opens that offer's boxes with what was saved
  page.button("Change", page.part("offers")).click();
  assert.equal(page.root.querySelector('[name="twoRate"]').value, "5.25");
  // the single offer's Compare keeps the two offers
  const before = structuredClone(page.plan().debtPlan.refinance.offers);
  typeIn(page, "rate", "5.5"); typeIn(page, "closingCosts", "6,000");
  submitOf(page, "rate");
  assert.deepEqual(page.plan().debtPlan.refinance.offers, before);
  assert.equal(page.plan().debtPlan.refinance.rate, 0.055);
});

test("a credit bigger than the costs says what is not counted; a loan paid off inside the years kept says so", async () => {
  await fresh();
  const page = await livePage(await withRefi({ ...COMPARED, offers: [{ rate: 0.06, termYears: 30, points: 2, costs: 1000, credit: 20000, rollIn: true }, { rate: 0.05, termYears: 15, costs: 3000 }], keep: 20 }));
  page.part("offers").setAttribute("open", "");
  const body = page.body("offers");
  assert.match(body, /nothing at closing: the credit covers the costs The credit is \$13,700 more than the costs; that part is not counted\./);
  assert.match(body, /Offer 2 · 5%, 15 years, no points .* Paid off within the 20 years\./);
  assert.match(body, /Still owed after 20 years: \$143,109\. Offer 2/, "the 30-year loan still owes at 20 years");
  assert.match(body, /Keeping your loan \$1,980 a month \$190,195 of interest over 20 years\. Paid off within the 20 years\./, "today's loan ends in 19 years 2 months");
});

test("S11: after a save only the saved part changes: Save these offers opens Compare two offers, Compare opens The figures, nothing else moves", async () => {
  await fresh();
  const page = await livePage(await withRefi(COMPARED));
  const before = page.open();
  assert.deepEqual(before, { figures: false, offers: false });
  typeIn(page, "twoRate", "5.25");
  submitOf(page, "twoRate");
  page.draw();
  assert.deepEqual(page.open(), { ...before, offers: true });
  // the next draw (no save) no longer forces it open: the shell's own memory keeps what the person left
  page.draw();
  assert.deepEqual(page.open(), before);
  // the offer's Compare: the answer leads and its boxes are in "The figures", open after the save; Compare two offers stays shut
  await fresh();
  const plain = await livePage(await family());
  typeIn(plain, "rate", "5.5"); typeIn(plain, "closingCosts", "6,000");
  submitOf(plain, "rate");
  plain.draw();
  assert.deepEqual(plain.open(), { figures: true, offers: false });
  plain.draw();
  assert.deepEqual(plain.open(), { figures: false, offers: false });
  typeIn(plain, "rate", "5"); submitOf(plain, "rate"); plain.draw();
  assert.deepEqual(plain.open(), { figures: true, offers: false });
  // and Save these offers on the answered page opens only its own part
  plain.draw();
  typeIn(plain, "twoRate", "5.25"); submitOf(plain, "twoRate"); plain.draw();
  assert.deepEqual(plain.open(), { figures: false, offers: true });
});

test("R8: once an offer is compared the answer leads; its four boxes fold into The figures, which says the offer", async () => {
  await fresh();
  const p = await family(); p.debtPlan = { ...(p.debtPlan ?? {}), refinance: { rate: 0.055, termYears: 30, closingCosts: 6000, yearsStaying: 7 } };
  const page = await livePage(p);
  const first = page.first();
  assert.match(first, /^A close call Your mortgage: \$265,000 at 6\.25%, \$1,980 a month\. What this offer does /);
  assert.ok(!/Offered rate per year|Type an offer below|under the boxes/.test(first), "no boxes on the first view");
  assert.match(first, /The figures 5\.5%, 30 years › Compare two offers ›/);
  const fig = page.part("figures");
  assert.equal(fig.dataset.kind, "figures");
  for (const name of ["rate", "termYears", "closingCosts", "yearsStaying"]) assert.ok(fig.querySelector(`[name="${name}"]`), name);
  assert.equal(page.filled().length, 0, "the one filled button (Compare) is inside The figures");
  // nothing compared yet: the four boxes are the page, as before
  await fresh();
  const none = await livePage(await family());
  assert.equal(none.part("figures"), undefined);
  assert.deepEqual(none.filled(), ["Compare"]);
});

test("with no offer saved, offer 1 follows the offer compared above; once offers are saved, a new Compare above leaves the comparison alone", async () => {
  await fresh();
  const page = await livePage(await family());
  assert.equal(page.part("offers"), undefined, "the offer's own boxes first");
  typeIn(page, "rate", "5.5"); typeIn(page, "closingCosts", "6,000");
  submitOf(page, "rate");
  page.draw();
  assert.match(page.body("offers"), /Offer 1: 5\.5%, 30 years, no points, costs paid at closing Change/);
  assert.equal(page.plan().debtPlan.refinance.offers, undefined, "the comparison saved nothing");
  typeIn(page, "twoRate", "5.25");
  submitOf(page, "twoRate");
  page.draw();
  typeIn(page, "rate", "6"); submitOf(page, "rate"); page.draw();
  assert.match(page.body("offers"), /Offer 1: 5\.5%, 30 years, no points, costs paid at closing/, "the saved offer 1 stays");
});
