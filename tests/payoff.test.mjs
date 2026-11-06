// tests/payoff.test.mjs -- core/math/payoff.js against hand-checked numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { payoffPlan, minimumOnly } from "../core/math/payoff.js";
import { nper } from "../core/math/finance.js";

const near = (a, b, tol = 0.02) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
const DEBTS = [
  { id: "visa", name: "Visa", balance: 4000, rate: 0.229, minPayment: 100 },
  { id: "car", name: "Car loan", balance: 14200, rate: 0.049, minPayment: 410 },
  { id: "store", name: "Store card", balance: 900, rate: 0.269, minPayment: 30 },
];

test("one debt, no extra: months agree with nper and interest adds up", () => {
  const r = payoffPlan([DEBTS[0]], { extra: 0 });
  assert.equal(r.months, Math.ceil(nper(0.229 / 12, 100, 4000) - 1e-9));
  near(r.totalPaid, 4000 + r.totalInterest, 0.05);
  assert.equal(r.debts[0].paidOff, r.months);
  assert.equal(r.timeline.length, r.months);
  assert.equal(r.timeline[r.months - 1].total, 0);
});
test("avalanche targets the highest rate, snowball the smallest balance; avalanche costs less interest", () => {
  const av = payoffPlan(DEBTS, { extra: 200, order: "avalanche" });
  const sn = payoffPlan(DEBTS, { extra: 200, order: "snowball" });
  assert.deepEqual(av.debts.map((d) => d.id), ["store", "visa", "car"]);
  assert.deepEqual(sn.debts.map((d) => d.id), ["store", "visa", "car"], "here the smallest balance is also the highest rate");
  const av2 = payoffPlan(DEBTS, { extra: 200, order: "avalanche", customOrder: [] });
  assert.ok(av.totalInterest <= sn.totalInterest + 0.01);
  assert.ok(av2.months === av.months);
  const cu = payoffPlan(DEBTS, { extra: 200, order: "custom", customOrder: ["car", "visa", "store"] });
  assert.deepEqual(cu.debts.map((d) => d.id), ["car", "visa", "store"]);
  assert.ok(cu.totalInterest > av.totalInterest, "paying the cheap car loan first costs more");
});
test("freed payments roll into the next debt; more extra means fewer months", () => {
  const a = payoffPlan(DEBTS, { extra: 0 }), b = payoffPlan(DEBTS, { extra: 300 });
  assert.ok(b.months < a.months);
  assert.ok(b.totalInterest < a.totalInterest);
  assert.equal(a.budget, 540); assert.equal(b.budget, 840);
  const last = b.timeline[b.timeline.length - 1];
  assert.equal(last.total, 0);
});
test("a payment that does not cover the interest never pays off", () => {
  const r = payoffPlan([{ id: "x", name: "Trap", balance: 10000, rate: 0.24, minPayment: 100 }], { extra: 0, maxMonths: 120 });
  assert.equal(r.months, Infinity);
  assert.deepEqual(r.neverPaysOff, ["x"]);
  const m = minimumOnly(10000, 0.24, 100);
  assert.equal(m.months, Infinity);
  const ok = minimumOnly(4000, 0.229, 100);
  assert.equal(ok.months, Math.ceil(nper(0.229 / 12, 100, 4000) - 1e-9));
  const pct = minimumOnly(4000, 0.229, 0, { percentOfBalance: 0.02, floor: 25 });
  assert.ok(pct.months > ok.months && Number.isFinite(pct.months), "2% of balance with a $25 floor takes far longer");
});
test("zero balances are skipped; empty input", () => {
  const r = payoffPlan([{ id: "z", name: "Done", balance: 0, rate: 0.1, minPayment: 50 }], { extra: 100 });
  assert.equal(r.months, 0); assert.deepEqual(r.debts, []); assert.equal(payoffPlan([]).months, 0);
});
test("minimum-only: 2% of the month's opening balance (Regulation Z appendix M2), never only when it cannot amortize", () => {
  const pct = { percentOfBalance: 0.02, floor: 25 };
  // $3,000 at 18%: month 1 pays 2% of $3,000 = $60 (not 2% of $3,045), month 2 2% of $3,030 = $60.60, ...
  const one = minimumOnly(3000, 0.18, 0, { ...pct, maxMonths: 1 });
  assert.equal(one.interest, 45);
  const a = minimumOnly(3000, 0.18, 0, pct);
  assert.deepEqual([a.months, a.interest], [268, 6327.77]);   // tools/golden_debt cc-edge-001 (RULES.md example 2)
  // 2% of the balance at 30% (2.5% a month) never catches the interest: never, from the first month
  assert.equal(minimumOnly(2000, 0.30, 0, pct).months, Infinity);
  // 23.99% (1.999% a month): 2% barely beats the interest; paid off in month 1,350, not "never" at 100 years
  const slow = minimumOnly(1260, 0.2399, 0, pct);
  assert.deepEqual([slow.months, slow.interest], [1350, 32570.08]);   // cc-edge-009
});

test("an aimed extra goes to its own debts only and stops when they are paid off; freed payments still roll on", () => {
  const debts = [
    { id: "card", name: "Card", balance: 3000, rate: 0.24, minPayment: 100, takesExtra: true },
    { id: "car", name: "Car", balance: 9000, rate: 0.07, minPayment: 300 },
    { id: "home", name: "Home", balance: 200000, rate: 0.065, minPayment: 1400 },
  ];
  const aimed = payoffPlan(debts, { extra: 1000 });
  const plain = payoffPlan(debts.map(({ takesExtra, ...d }) => d), { extra: 1000 });
  const none = payoffPlan(debts.map(({ takesExtra, ...d }) => d), { extra: 0 });
  const end = (r, id) => r.debts.find((d) => d.id === id).months;
  assert.equal(end(aimed, "card"), end(plain, "card"), "the card gets the extra the same way");
  assert.ok(end(aimed, "card") < end(none, "card"));
  // after the card: only its $100 moves on to the car (highest rate next), not the $1,000
  const cardDone = end(aimed, "card");
  const after = aimed.timeline[cardDone + 1];
  assert.equal(after.paid, 100 + 300 + 1400, "the month after: the required payments, the card's $100 rolled on, no extra");
  assert.ok(end(aimed, "home") > end(plain, "home"), "the mortgage is not paid early by the aimed extra");
  assert.ok(end(aimed, "car") < end(none, "car"), "but the car gets the card's freed $100");
  // a middling debt aimed at while a higher-rate mortgage is in the plan: the extra still goes to the aimed debt
  const mid = [{ id: "car", name: "Car", balance: 9000, rate: 0.059, minPayment: 300, takesExtra: true }, { id: "home", name: "Home", balance: 200000, rate: 0.065, minPayment: 1400 }];
  const m = payoffPlan(mid, { extra: 1000 }), m0 = payoffPlan(mid.map(({ takesExtra, ...d }) => d), { extra: 1000 });
  assert.ok(end(m, "car") < end(m0, "car"), "avalanche alone would send the extra to the 6.5% mortgage");
  // nothing marked: the same result as before
  assert.deepEqual(payoffPlan(debts.map((d) => ({ ...d, takesExtra: false })), { extra: 1000 }).debts, plain.debts);
});

// --- round 8 (2026-11-06), renter-debt-1: what the bank asks shrinks with the balance ----------------------------------------
test("the bank's minimum: 1% of the month's opening balance plus that month's interest, at least the floor (CFPB 2025 report 4.1.1)", async () => {
  const { bankMinimum, issuerShare, ISSUER_FLOORS, ISSUER_SHARE } = await import("../core/math/payoff.js");
  assert.equal(ISSUER_SHARE, 0.01); assert.deepEqual(ISSUER_FLOORS, { low: 25, high: 40 });
  // the CFPB's own worked example (The Consumer Credit Card Market, December 2025, 4.1.3): $2,000 at 29%, "the greater of
  // accrued interest plus 1 percent of the balance or $35 each month would pay over $3,000 in interest over an almost
  // 10-year period". By hand (an independent loop): 119 months, $3,134.10
  const cfpb = minimumOnly(2000, 0.29, 0, { interestPlus: 0.01, floor: 35 });
  assert.deepEqual([cfpb.months, cfpb.interest], [119, 3134.1]);
  // $4,500 at 29% (round 8): interest + 1%, $35 floor 199 months and $9,175.87; $25 floor 233 months and $9,661.32;
  // $40 floor 186 months and $8,933.23
  const at = (floor) => { const r = minimumOnly(4500, 0.29, 0, { interestPlus: 0.01, floor }); return [r.months, r.interest]; };
  assert.deepEqual(at(35), [199, 9175.87]); assert.deepEqual(at(25), [233, 9661.32]); assert.deepEqual(at(40), [186, 8933.23]);
  // the share from the typed minimum: ($150 - $108.75 of interest) / $4,500 = 0.92%, rounded to the nearest quarter point: 1%
  assert.deepEqual(issuerShare(4500, 0.29, 150), { share: 0.01, fromTyped: true });
  // $70 on $2,000 at 27%: ($70 - $45) / $2,000 = 1.25%; out of 0.5% to 2% (or nothing typed): 1%, assumed
  assert.deepEqual(issuerShare(2000, 0.27, 70), { share: 0.0125, fromTyped: true });
  assert.deepEqual(issuerShare(2000, 0.27, 0), { share: 0.01, fromTyped: false });
  assert.deepEqual(issuerShare(2000, 0.27, 40), { share: 0.01, fromTyped: false }, "a payment at or below the interest says nothing about the share");
  assert.deepEqual(issuerShare(500, 0.2, 100), { share: 0.01, fromTyped: false }, "18.3% of the balance is not a share a bank uses");
  const b = bankMinimum(4500, 0.29, 150);
  assert.deepEqual([b.quick.months, b.quick.interest, b.slow.months, b.slow.interest], [186, 8933.23, 233, 9661.32]);
  assert.equal(b.share, 0.01); assert.equal(b.fromTyped, true); assert.equal(b.first, 153.75);
  // $3,300 at 24%, $100 typed: (100 - 66) / 3,300 = 1.03%, so 1%: 146 to 193 months
  const m = bankMinimum(3300, 0.24, 100);
  assert.deepEqual([m.quick.months, m.slow.months], [146, 193]);
  // a 29% card with nothing typed: a finite estimate (the 2% reading never ends at 29%)
  const none = bankMinimum(4500, 0.29, 0);
  assert.ok(Number.isFinite(none.slow.months) && none.fromTyped === false);
  assert.equal(minimumOnly(4500, 0.29, 0, { percentOfBalance: 0.02, floor: 25 }).months, Infinity, "the old fallback: never");
  // nothing owed
  assert.equal(bankMinimum(0, 0.29, 0), null);
});

// --- round 8 review (2026-11-06), D1: a typed minimum that is the bank's floor, or the whole balance, is read as such -------
test("the bank's minimum when the typed one is its floor, the whole balance, below the interest, or matches no formula", async () => {
  const { bankMinimum, ISSUER_FLOOR_RANGE } = await import("../core/math/payoff.js");
  // the CFPB's floors "varied from $15 to $50" (The Consumer Credit Card Market, December 2025, 4.1.1)
  assert.deepEqual(ISSUER_FLOOR_RANGE, { low: 15, high: 50 });
  // $900 at 19.9% with $35 required: interest $14.93 + 1% is $23.93, under $35, so $35 is this card's floor and the bank asks
  // it every month until the balance is below it. By hand (an independent loop, the review's): 34 months, $282.95. One figure:
  // the $25 / $40 floors under an unknown card do not apply
  const floor = bankMinimum(900, 0.199, 35);
  assert.equal(floor.kind, "floor"); assert.equal(floor.fromTyped, true); assert.equal(floor.first, 35);
  assert.deepEqual([floor.quick.months, floor.quick.interest, floor.slow.months, floor.slow.interest], [34, 282.95, 34, 282.95]);
  // the whole balance asked (a charge card, or one paid in full each month): nothing carried, no interest while it is paid in full
  const full = bankMinimum(9800, 0.229, 9800);
  assert.equal(full.kind, "full"); assert.deepEqual([full.quick.interest, full.slow.interest], [0, 0]);
  // a typed minimum at or under the month's interest ($10,000 at 24%: $200 of interest, $150 typed): no bank asks that, so
  // most banks' minimum is used and the kind says why
  const low = bankMinimum(10000, 0.24, 150);
  assert.equal(low.kind, "below-interest"); assert.equal(low.fromTyped, false); assert.ok(Number.isFinite(low.slow.months));
  // $500 on $5,000 at 20% (8.3% of the balance on top of the interest, over the $50 floors): no usual formula
  assert.equal(bankMinimum(5000, 0.2, 500).kind, "unmatched");
  // a minimum that fits interest + a share: "typed"; nothing typed: "assumed"
  assert.equal(bankMinimum(4500, 0.29, 150).kind, "typed");
  assert.equal(bankMinimum(4500, 0.29, 0).kind, "assumed");
});

// --- verify (2026-11-06): a typed minimum under the $40 floor caps the floor at that minimum ------------------------------------
test("verify: a typed minimum under $40 is at least the card's floor, so paying only the minimum never ends sooner than keeping it level", async () => {
  const { bankMinimum } = await import("../core/math/payoff.js");
  // $900 at 26.9% with $30 required (qa fixture debtPlan's store card): ($30 - $20.18 of interest) / $900 = 1.09%, so 1%. The bank
  // asks $30 now, so its floor is $30 or less, never $40. By hand (an independent loop): $30 kept level 51 months and $610.65;
  // interest + 1% at least $30: 51 months, $610.65 (it asks $30 until the balance is under it); at least $25: 69 months, $843.77.
  // Before: the $40 end gave 32 months and $366.61, sooner than paying the $30 minimum level.
  const b = bankMinimum(900, 0.269, 30), level = minimumOnly(900, 0.269, 30);
  assert.equal(b.kind, "typed"); assert.deepEqual([level.months, level.interest], [51, 610.65]);
  assert.deepEqual(b.floors, { low: 25, high: 30 }); assert.equal(b.first, 30);
  assert.deepEqual([b.quick.months, b.quick.interest, b.slow.months, b.slow.interest], [51, 610.65, 69, 843.77]);
  // $1,000 at 20% with $27: floors $25 to $27: 59 months $568.90 to 66 months $650.12
  const c = bankMinimum(1000, 0.2, 27);
  assert.deepEqual([c.quick.months, c.quick.interest, c.slow.months, c.slow.interest], [59, 568.9, 66, 650.12]);
  // under $25 (a 0% card with $20 required, 1% of $2,000): one figure, the floor at most $20: 100 months
  const z = bankMinimum(2000, 0, 20);
  assert.deepEqual(z.floors, { low: 20, high: 20 }); assert.deepEqual([z.quick.months, z.slow.months], [100, 100]);
  // $40 or more typed: the usual $25 / $40 ends, as before
  assert.deepEqual(bankMinimum(4500, 0.29, 150).floors, { low: 25, high: 40 });
});
