// The full checks for this page are in tests/debt-pages.test.mjs (shared fixture qa/fixtures/debt-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, offer } from "./compute.js";
import { debtPlan } from "../../../qa/fixtures/debt-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("payoff: runs on the sample household and on an empty plan", () => {
  const d = compute(debtPlan(), { today: "2026-09-15" });
  assert.equal(d.hasData, true); assert.equal(d.chosen.debts[0].name, "Store card");
  assert.ok(compute(emptyPlan(), { today: "2026-09-15" }));
});

// a card and a mortgage, with an extra already set on the card on the Debts page
function cardAndHome() {
  const p = emptyPlan();
  p.accounts.push({ id: "v", name: "Visa", type: "credit", balance: -6000 }, { id: "m", name: "Mortgage", type: "mortgage", balance: -200000 });
  p.debts = [{ accountId: "v", rate: 0.24, minPayment: 190, extra: 210 }, { accountId: "m", rate: 0.0625, minPayment: 1500 }];
  return p;
}
test("payoff: the month's payment is split into the minimums, extras set on Debts and the extra here", () => {
  const d = compute(cardAndHome(), { today: "2026-11-01" });
  assert.equal(d.required, 1690); assert.equal(d.alreadyExtra, 210); assert.equal(d.extra, 0); assert.equal(d.budget, 1900);
  const visa = d.debts.find((x) => x.id === "v");
  assert.equal(visa.minPayment, 400); assert.equal(visa.required, 190); assert.equal(visa.extraSet, 210);
  assert.equal(d.extraSaved, false, "no extra was ever saved here");
  const p = cardAndHome(); p.debtPlan = { extra: 0 };
  assert.equal(compute(p, { today: "2026-11-01" }).extraSaved, true, "a saved 0 is a choice");
});
test("payoff: params.extra and params.order preview another plan without the plan changing", () => {
  const p = cardAndHome();
  const base = compute(p, { today: "2026-11-01" });
  const more = compute(p, { today: "2026-11-01", extra: 2000, order: "snowball" });
  assert.equal(more.extra, 2000); assert.equal(more.order, "snowball"); assert.equal(more.budget, base.budget + 2000);
  assert.ok(more.chosen.months < base.chosen.months);
  assert.deepEqual(p.debtPlan, {}, "nothing written");
  assert.equal(compute(p, { today: "2026-11-01", order: "nonsense" }).order, "avalanche");
});
test("payoff: a debt that ends sooner because finished debts' payments move to it is named with both dates", () => {
  const d = compute(cardAndHome(), { today: "2026-11-01" });
  const r = d.rollover.find((x) => x.id === "m");
  assert.ok(r, "the mortgage takes the card's $400 once the card is paid off");
  assert.ok(r.planEnd < r.ownEnd);
  const li = d.chosen.debts.find((x) => x.id === "m");
  assert.equal(r.planEnd, li.endDate);
  const p = cardAndHome(); p.debtPlan = { extra: 300 };
  assert.deepEqual(compute(p, { today: "2026-11-01" }).rollover, [], "with an extra chosen here the plan speeds every debt; no roll-over note");
});
test("payoff: the orders tie when they end the same month at the same interest", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Car", type: "loan", balance: -9000 });
  p.debts = [{ accountId: "c", rate: 0.07, minPayment: 300 }];
  assert.equal(compute(p, { today: "2026-11-01" }).tie, true, "one debt: every order is the same");
  // (an own order the person set that differs: "My own order" now starts as highest rate first, so it needs one set here)
  const own = cardAndHome(); own.debtPlan = { customOrder: ["m", "v"] };
  assert.equal(compute(own, { today: "2026-11-01", extra: 500 }).tie, false, "a card and a mortgage with extra money: the order matters");
});

test("offer: Next best action's amount aimed at the step's debts, until they are paid off; nothing when it moves nothing", () => {
  const p = cardAndHome();
  const o = offer(p, { today: "2026-11-01", amount: 1234.56, stepId: "high-debt" });
  assert.equal(o.amount, 1230, "rounded down to $10");
  assert.deepEqual(o.targets.map((x) => x.id), ["v"], "the 24% card, never the mortgage");
  assert.ok(o.soon < o.now, `${o.soon} before ${o.now}`);
  assert.ok(o.interestSaved > 0);
  // saved: the extra is aimed at the card and stops when it is paid off, so the mortgage ends when it would have
  p.debtPlan = { extra: o.amount, order: "avalanche", targets: ["v"] };
  const d = compute(p, { today: "2026-11-01" }), none = compute(cardAndHome(), { today: "2026-11-01" });
  assert.deepEqual(d.targets, ["v"]); assert.equal(d.extra, 1230);
  assert.equal(d.chosen.debts.find((x) => x.id === "v").endDate, o.soon);
  const mEnd = (r) => r.chosen.debts.find((x) => x.id === "m").months;
  assert.ok(mEnd(d) < mEnd(none), "the card's freed $400 still rolls on to the mortgage");
  const p2 = cardAndHome(); p2.debtPlan = { extra: 1230, order: "avalanche" };
  assert.ok(mEnd(d) > mEnd(compute(p2, { today: "2026-11-01" })), "but the $1,230 is not paid on the mortgage for years");
  // once the card is paid off the aimed extra stops: the amount is kept for the page, but nothing more is paid
  const paid = cardAndHome(); paid.accounts[0].balance = 0; paid.debtPlan = { extra: 1230, targets: ["v"] };
  const pd = compute(paid, { today: "2026-11-01" });
  assert.equal(pd.targetsDone, true); assert.equal(pd.extra, 0); assert.equal(pd.extraTyped, 1230);
  // a middling debt while a higher-rate mortgage is in the plan: aimed at the car loan, it still ends the car loan sooner
  const q = emptyPlan();
  q.accounts.push({ id: "car", name: "Car loan", type: "loan", balance: -14200 }, { id: "m", name: "Mortgage", type: "mortgage", balance: -200000 });
  q.debts = [{ accountId: "car", rate: 0.059, minPayment: 410 }, { accountId: "m", rate: 0.065, minPayment: 1500 }];
  const mid = offer(q, { today: "2026-11-01", amount: 3620, stepId: "mid-debt" });
  assert.deepEqual(mid.targets.map((x) => x.id), ["car"]);
  assert.ok(mid.soon < mid.now);
  // under $25, another step, or no debt of that kind: nothing to offer
  assert.equal(offer(cardAndHome(), { today: "2026-11-01", amount: 20, stepId: "high-debt" }), null);
  assert.equal(offer(cardAndHome(), { today: "2026-11-01", amount: 500, stepId: "full-fund" }), null);
  assert.equal(offer(cardAndHome(), { today: "2026-11-01", amount: 500, stepId: "mid-debt" }), null, "no debt from 4% to 10% but the mortgage");
});

test("twoDates: a debt the payoff plan finishes sooner than its own payment, with both dates and whose payments move onto it", async () => {
  const { twoDates } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: debts } = await import("../../balance/liabilities/compute.js");
  const today = "2026-11-02";
  const plan = familyPlan(today);
  const t = twoDates(plan, { today });
  const P = compute(plan, { today });
  const own = debts(plan, { today }).rows.find((r) => r.type === "mortgage");
  const inPlan = P.chosen.debts.find((x) => x.id === own.id);
  // the family's mortgage: January 2046 on its own $1,980, March 2039 once the card's and the car's payments move onto it
  assert.deepEqual(t[own.id], { own: own.payoffDate, plan: inPlan.endDate, from: P.chosen.debts.filter((x) => x.id !== own.id && x.endDate < inPlan.endDate).map((x) => x.name), extra: P.extra });
  assert.ok(t[own.id].plan < t[own.id].own);
  assert.deepEqual(t[own.id].from, ["Visa card", "Car loan"]);
  // a debt that ends the same month either way is not listed
  for (const d of P.chosen.debts) if (d.id !== own.id) assert.equal(t[d.id], undefined);
  assert.deepEqual(twoDates(emptyPlan(), { today }), {});
});

test("savedPlan: the saved extra, the debts it goes to and when the last is gone; null without one or once they are paid (review 2026-11-02, round 5)", async () => {
  const { savedPlan } = await import("./compute.js");
  const T = "2026-09-15";
  const none = debtPlan(); none.debtPlan = { ...none.debtPlan, extra: 0 };
  assert.equal(savedPlan(none, { today: T }), null, "no extra saved");
  const p = debtPlan(); p.debtPlan = { ...p.debtPlan, extra: 200, order: "avalanche" };
  const s = savedPlan(p, { today: T }), d = compute(p, { today: T });
  assert.equal(s.extra, 200);
  assert.deepEqual(s.ids, d.debts.map((x) => x.id), "aimed at none: every debt, as it rolls from one to the next");
  assert.deepEqual(s.ends.map((x) => x.id), s.ids);
  const last = s.ends.reduce((a, b) => (b.months > a.months ? b : a));
  assert.deepEqual([s.until, s.months], [last.endDate, last.months]);
  // aimed at one debt that is paid off: the extra has stopped
  const q = debtPlan(); q.debtPlan = { ...(q.debtPlan ?? {}), extra: 200, targets: ["gone-debt"] };
  assert.equal(savedPlan(q, { today: T }), null);
  assert.equal(savedPlan(emptyPlan(), { today: T }), null);
});

// --- round 8 (2026-11-06), renter-debt-7: what is typed moves the whole page, not only the headline ------------------------
test("round 8: a typed extra redraws when each debt ends and the three orders from the same figures as the headline", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const page = await renderPage(new URL("./view.js", import.meta.url), renterDebtPlan(), "2026-11-06", { computeOf: { "overview/next-best-action": nba } });
  // "The three orders, same money" now sits inside "How this is worked out" (gap #3, simple first): read it there
  const card = (title) => title === "The three orders, same money" ? page.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === "how") : page.root.querySelectorAll(".card").find((c) => textOf(c.querySelector("h2")) === title);
  // saved: $50 extra, highest rate first: debt-free July 2030, $7,799 of interest
  assert.match(textOf(card("The three orders, same money")), /Highest interest rate first chosen least interest 3 years 8 months, by July 2030 \$7,799 interest/);
  // type $150 (not saved): the headline, the list and the orders all say December 2029 and $5,865 (by hand: 4 debts, $670
  // required + $150, avalanche; core/math/payoff.js on the same debts)
  const box = page.root.querySelector('[name="extra"]');
  box.value = "150"; box.dispatch("input");
  const hero = textOf(page.root.querySelector(".hero"));
  assert.match(hero, /Debt-free by December 2029/); assert.match(hero, /\$5,865 of interest/);
  const ends = textOf(card("When each debt ends"));
  // each debt's line is its name and its month now (gap #3, simple first); its figures follow the typing in "Each debt"
  assert.match(ends, /Visa card June 2028 ✅ Store card October 2028 ✅ Mastercard April 2029 ✅ Car loan December 2029/);
  assert.match(textOf(card("The three orders, same money")), /Each debt Visa card \$4,500 at 29\.0% · \$150 a month required · \$[\d,]+ interest to come · gone in 1 year 7 months/);
  assert.match(textOf(card("The three orders, same money")), /Highest interest rate first chosen least interest 3 years 1 month, by December 2029 \$5,865 interest/);
  assert.equal(page.saved.length, 0, "typing saves nothing");
  // the Order select moves them too: smallest balance first, $6,058
  const sel = page.root.querySelector('[aria-label="Order"]');
  sel.value = "snowball"; sel.dispatch("change");
  assert.match(textOf(card("The three orders, same money")), /Smallest balance first chosen 3 years 1 month, by December 2029 \$6,058 interest/);
});

// --- round 8 review (2026-11-06): "required payments only" read as a fixed minimum; say what it is ----------------------------
test("review UX: the last line says it is today's payments with each finished debt's payment moving on, not the minimum", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const t = await pageText(new URL("./view.js", import.meta.url), renterDebtPlan(), "2026-11-06", { computeOf: { "overview/next-best-action": nba } });
  assert.match(t, /If you pay nothing more than today's required amounts \(each finished debt's payment moving to the next\): 4 years 2 months and \$9,623 of interest\./);
  assert.ok(!/With the required payments only/.test(t));
});

test("payoff: a debt with no rate or payment is named with its id, so the page can link to its form", () => {
  const p = cardAndHome();
  p.accounts.push({ id: "c1", name: "New card", type: "credit", balance: -1850 });
  const d = compute(p, { today: "2026-09-15" });
  assert.deepEqual(d.missingRows, [{ id: "c1", name: "New card" }]);
  assert.deepEqual(d.missing, ["New card"]);
});

test("walk 2026-11-11: 'My own order' with nothing saved starts from highest rate first, not A to Z", () => {
  const p = cardAndHome();
  p.accounts.push({ id: "a", name: "Aardvark loan", type: "loan", balance: -3000 });
  p.debts.push({ accountId: "a", rate: 0.05, minPayment: 100 });
  const d = compute(p, { today: "2026-09-15", order: "custom" });
  assert.deepEqual(d.customOrder, ["v", "m", "a"]);
});

// --- gap #3 (2026-11-13): one-time extra payments, and months you can't pay the extra ----------------------------------------
// Every figure below was worked by hand or by an independent loop outside this repo (monthly interest on the opening balance,
// the payment, then the one-time amount; README "One-time payments"), never by core/math/payoff.js.
import { payoffPlan } from "../../../core/math/payoff.js";
import { lumpMonth, lumpsOf, monthByMonth } from "./compute.js";
import { textOf } from "../../../qa/fixtures/fake-dom.mjs";

const T13 = "2026-11-13";
const near = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
// one card: $5,000 at 20%, $150 required, $50 extra here: 33 months, $1,522.10 of interest (by hand), August 2029
function oneCard(lumps, extra = 50) {
  const p = emptyPlan();
  p.accounts.push({ id: "visa", name: "Visa card", type: "credit", balance: -5000 });
  p.debts = [{ accountId: "visa", rate: 0.2, minPayment: 150 }];
  p.debtPlan = { extra, order: "avalanche", ...(lumps ? { lumps } : {}) };
  return p;
}
const lineOf = (p, today = T13) => compute(p, { today }).lumpLines[0];

test("gap #3 math: $5,000 at 20% with $200 a month and $1,000 in month 3: 8 months sooner and $542.54 less interest, as by hand", () => {
  const debts = [{ id: "c", name: "Card", balance: 5000, rate: 0.2, minPayment: 200 }];
  const none = payoffPlan(debts), r = payoffPlan(debts, { lumps: [{ month: 3, amount: 1000 }] });
  // by hand: 5,000 + 83.33 - 200 = 4,883.33; + 81.39 - 200 = 4,764.72; + 79.41 - 200 - 1,000 = 3,644.13 after month 3
  near(r.timeline[0].balances.c, 4883.33); near(r.timeline[1].balances.c, 4764.72); near(r.timeline[2].balances.c, 3644.13);
  assert.equal(r.timeline[2].once, 1000); assert.equal(r.timeline[1].once, 0);
  assert.equal(none.months, 33); near(none.totalInterest, 1522.1);
  assert.equal(r.months, 25); near(r.totalInterest, 979.56);
  assert.deepEqual(r.lumpEffect, { monthsSooner: 8, interestSaved: 542.54 });
  near(r.totalPaid, 5979.56, 0.01);
});

test("gap #3 math: with no one-time amounts (absent or []) every plan is exactly what it was, for every fixture's debts", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  for (const p of [debtPlan(), familyPlan(T13), renterDebtPlan(), cardAndHome()]) {
    const d = compute(p, { today: T13 });
    for (const order of ["avalanche", "snowball", "custom"]) for (const extra of [0, d.extra, 250]) {
      const opts = { extra, order, customOrder: d.customOrder };
      const a = payoffPlan(d.debts, opts), b = payoffPlan(d.debts, { ...opts, lumps: [] }), c = payoffPlan(d.debts, { ...opts, lumps: [{ month: 0, amount: 500 }, { month: 4, amount: 0 }, { month: "x", amount: 9 }] });
      assert.equal(JSON.stringify(b), JSON.stringify(a)); assert.equal(JSON.stringify(c), JSON.stringify(a), "a month below 1, 0 or not a number is left out");
      assert.ok(!("lumpEffect" in a) && !("once" in (a.timeline[0] ?? {})));
    }
  }
});

test("gap #3 math: a lump on a debt already paid off rolls to the next, as one on that next debt does", () => {
  // A $300 at 10% / $100 (gone in month 4), B $2,000 at 15% / $100; highest rate first: 13 months and $195.95 by hand
  const debts = [{ id: "A", name: "A", balance: 300, rate: 0.1, minPayment: 100 }, { id: "B", name: "B", balance: 2000, rate: 0.15, minPayment: 100 }];
  const none = payoffPlan(debts);
  assert.equal(none.months, 13); near(none.totalInterest, 195.95);
  const onA = payoffPlan(debts, { lumps: [{ month: 6, amount: 500, debtId: "A" }] }), onB = payoffPlan(debts, { lumps: [{ month: 6, amount: 500, debtId: "B" }] });
  assert.equal(onA.months, 10); near(onA.totalInterest, 159.59);
  assert.equal(JSON.stringify(onA), JSON.stringify(onB));
  assert.equal(onA.debts.find((x) => x.id === "A").paidOff, 4);
  // a debt that is not in the plan at all: the first debt in the order
  assert.equal(JSON.stringify(payoffPlan(debts, { lumps: [{ month: 6, amount: 500, debtId: "gone" }] })), JSON.stringify(onB));
});

test("gap #3 math: a lump larger than every debt ends them all that month", () => {
  const debts = [{ id: "A", name: "A", balance: 300, rate: 0.1, minPayment: 100 }, { id: "B", name: "B", balance: 2000, rate: 0.15, minPayment: 100 }];
  const r = payoffPlan(debts, { lumps: [{ month: 2, amount: 5000 }] });
  assert.equal(r.months, 2); near(r.totalInterest, 53.25);
  assert.deepEqual(r.debts.map((x) => x.paidOff), [2, 2]);
  assert.equal(r.timeline.at(-1).total, 0);
});

test("gap #3 math: a month that pays less delays the date; it never goes below the debts' own payments", () => {
  const debts = [{ id: "c", name: "Card", balance: 5000, rate: 0.2, minPayment: 150 }];
  const base = payoffPlan(debts, { extra: 50 });
  const less = payoffPlan(debts, { extra: 50, lumps: [{ month: 3, amount: -50 }] });
  assert.equal(base.months, 33); assert.equal(less.months, 34); near(less.totalInterest, 1554.27);
  assert.equal(less.timeline[2].paid, 150); assert.equal(less.timeline[2].once, -50);
  // asking for $100 less than a $200 month only takes the $50 above the $150 required
  assert.equal(JSON.stringify(payoffPlan(debts, { extra: 50, lumps: [{ month: 3, amount: -100 }] }).timeline), JSON.stringify(less.timeline));
  // with nothing above the required payments that month, it changes nothing
  const noExtra = payoffPlan(debts), noExtraLess = payoffPlan(debts, { lumps: [{ month: 3, amount: -50 }] });
  assert.equal(noExtraLess.months, noExtra.months); assert.equal(noExtraLess.totalInterest, noExtra.totalInterest);
  assert.deepEqual(noExtraLess.lumpEffect, { monthsSooner: 0, interestSaved: 0 });
  // two debts: once the first is gone its payment rolls on, and a month that pays less holds that back too
  const two = [{ id: "A", name: "A", balance: 300, rate: 0.1, minPayment: 100 }, { id: "B", name: "B", balance: 2000, rate: 0.15, minPayment: 100 }];
  assert.equal(payoffPlan(two, { lumps: [{ month: 6, amount: -100 }] }).timeline[5].paid, 100);
});

test("gap #3 math: a bigger lump is never later and never costs more interest", () => {
  const debts = debtPlanDebts();
  let last = null;
  for (const amount of [0, 100, 500, 1000, 2500, 5000, 10000, 50000, 500000]) {
    const r = payoffPlan(debts, { extra: 200, lumps: amount ? [{ month: 5, amount }] : [] });
    if (last) { assert.ok(r.months <= last.months, `${amount}: ${r.months} after ${last.months}`); assert.ok(r.totalInterest <= last.totalInterest + 1e-9); }
    last = r;
  }
  let prev = null;
  for (const amount of [0, 50, 100, 200, 500]) {
    const r = payoffPlan(debts, { extra: 200, lumps: amount ? [{ month: 5, amount: -amount }] : [] });
    if (prev) assert.ok(r.months >= prev.months && r.totalInterest >= prev.totalInterest - 1e-9);
    prev = r;
  }
});
function debtPlanDebts() { return compute(debtPlan(), { today: T13 }).debts; }

test("gap #3 compute: a saved month becomes the plan's month: next month is the first, this month counts with it, before is past", () => {
  assert.equal(lumpMonth("2026-12", T13), 1); assert.equal(lumpMonth("2026-11", T13), 0); assert.equal(lumpMonth("2026-10", T13), -1);
  assert.equal(lumpMonth("2027-03", T13), 4); assert.equal(lumpMonth("2026-13", T13), null); assert.equal(lumpMonth("March", T13), null); assert.equal(lumpMonth("2027-03", null), null);
  // a line without a month or an amount is left out; one without an id gets one
  assert.deepEqual(lumpsOf({ debtPlan: { lumps: [{ month: "2027-03", amount: 900 }, { id: "x", month: "", amount: 5 }, { id: "y", month: "2027-04", amount: 0 }, { id: "z", month: "2027-04", amount: "a" }, null] } }),
    [{ id: "lump-0", month: "2027-03", amount: 900, debtId: "" }]);
  // this month and next month give the same plan; a month before today's is left out
  const same = (a, b) => assert.equal(JSON.stringify(compute(oneCard([{ id: "a", month: a, amount: 1000 }]), { today: T13 }).chosen), JSON.stringify(compute(oneCard([{ id: "a", month: b, amount: 1000 }]), { today: T13 }).chosen));
  same("2026-11", "2026-12");
  const past = compute(oneCard([{ id: "a", month: "2026-09", amount: 1000 }]), { today: T13 });
  assert.deepEqual(past.lumps, []); assert.equal(past.chosen.months, 33); assert.equal(past.lumpLines[0].kind, "past");
  assert.deepEqual(past.lumpEffect, { monthsSooner: 0, interestSaved: 0 });
});

test("gap #3 compute: every order and the $100 more carry the lines; 'nothing more than today' and the roll-over note do not", () => {
  const p = cardAndHome(); p.debtPlan = { lumps: [{ id: "l1", month: "2027-03", amount: 3000 }] };
  const d = compute(p, { today: "2026-11-01" }), none = compute(cardAndHome(), { today: "2026-11-01" });
  for (const k of ["avalanche", "snowball", "custom"]) assert.ok(d.plans[k].totalInterest < none.plans[k].totalInterest, k);
  assert.ok(d.chosen.debts.find((x) => x.id === "v").months < none.chosen.debts.find((x) => x.id === "v").months);
  assert.equal(JSON.stringify(d.baseline), JSON.stringify(none.baseline), "the baseline is today's payments only");
  assert.ok(none.rollover.length > 0); assert.deepEqual(d.rollover, [], "with a one-time payment the date has two reasons: no roll-over note");
  assert.deepEqual(d.lumps, [{ id: "l1", month: 4, amount: 3000, debtId: "" }]);
  assert.ok(d.lumpEffect.interestSaved > 0);
  // the month-by-month rows: the plan's months as calendar months, the one-time money in its month
  const rows = monthByMonth(d, "2026-11-01");
  assert.equal(rows.length, d.chosen.timeline.length); assert.equal(rows[0].month, "2026-12"); assert.equal(rows[3].month, "2027-03");
  assert.equal(rows[3].once, 3000); assert.equal(rows[2].once, 0); assert.equal(rows.at(-1).total, 0);
  assert.equal(rows[0].once, 0); assert.deepEqual(monthByMonth(compute(emptyPlan(), { today: T13 }), T13), []);
});

test("gap #3 compute: each line's kind against the same plan without it, worked by hand", () => {
  // $1,000 in month 3: 25 months against 33, $542.54 less (as the math test)
  let l = lineOf(oneCard([{ id: "a", month: "2027-02", amount: 1000 }]));
  assert.deepEqual([l.kind, l.months, l.monthsWithout, l.endDate, l.endWithout], ["sooner", 25, 33, "2028-12-13", "2029-08-13"]); near(l.interestDelta, 542.54);
  l = lineOf(oneCard([{ id: "a", month: "2027-02", amount: -50 }]));
  assert.deepEqual([l.kind, l.months, l.monthsWithout], ["later", 34, 33]); near(l.interestDelta, -32.17);
  l = lineOf(oneCard([{ id: "a", month: "2027-02", amount: 20 }]));
  assert.deepEqual([l.kind, l.months], ["same", 33]); near(l.interestDelta, 12.84);
  l = lineOf(oneCard([{ id: "a", month: "2027-02", amount: -10 }]));
  assert.equal(l.kind, "same"); near(l.interestDelta, -6.42);
  l = lineOf(oneCard([{ id: "a", month: "2027-02", amount: -50 }], 0));
  assert.deepEqual([l.kind, l.interestDelta], ["nothing", 0]);
  l = lineOf(oneCard([{ id: "a", month: "2031-01", amount: 500 }]));
  assert.equal(l.kind, "after");
  l = lineOf(oneCard([{ id: "a", month: "2026-09", amount: 1000 }]));
  assert.equal(l.kind, "past");
  // $1,000 at 0% and $100 a month: 10 months either way, no interest (by hand)
  const zero = (lumps) => { const p = emptyPlan(); p.accounts.push({ id: "z", name: "Store card", type: "credit", balance: -1000 }); p.debts = [{ accountId: "z", rate: 0, minPayment: 100 }]; p.debtPlan = { lumps }; return p; };
  l = lineOf(zero([{ id: "a", month: "2027-01", amount: 50 }]));
  assert.deepEqual([l.kind, l.months, l.endDate], ["nothing", 10, "2027-09-13"]);
  // $10,000 at 24% and $150 a month never ends ($200 of interest); $6,000 next month ends it in 41 months (April 2030)
  const never = (lumps) => { const p = emptyPlan(); p.accounts.push({ id: "n", name: "Loan", type: "loan", balance: -10000 }); p.debts = [{ accountId: "n", rate: 0.24, minPayment: 150 }]; p.debtPlan = { lumps }; return p; };
  l = lineOf(never([{ id: "a", month: "2026-12", amount: 6000 }]));
  assert.deepEqual([l.kind, l.months, l.endDate], ["ends", 41, "2030-04-13"]);
  assert.equal(lineOf(never([{ id: "a", month: "2026-12", amount: 100 }])).kind, "never");
  assert.equal(lineOf(never([{ id: "a", month: "2026-12", amount: -50 }])).kind, "never");
  // two lines: each against the plan without it, so both name the headline's month
  const two = compute(oneCard([{ id: "b", month: "2027-06", amount: 500 }, { id: "a", month: "2027-02", amount: 1000 }]), { today: T13 });
  assert.deepEqual(two.lumpLines.map((x) => x.id), ["a", "b"], "in month order");
  assert.ok(two.lumpLines.every((x) => x.endDate === two.chosen.endDate));
  // which debt: named when it is in the plan
  const named = cardAndHome(); named.debtPlan = { lumps: [{ id: "a", month: "2027-03", amount: 2000, debtId: "m" }] };
  assert.equal(compute(named, { today: "2026-11-01" }).lumpLines[0].debtName, "Mortgage");
});

test("gap #3 invariance: with no line saved every compute this commit touches gives the same output, and no new key", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { compute: lifeNeeds } = await import("../../insurance/life-needs/compute.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { savedPlan, twoDates } = await import("./compute.js");
  const plans = [familyPlan(T13), renterDebtPlan(), retiredCouplePlan(T13), emptyPlan(), debtPlan(), ...ARCHETYPES.map((a) => a.build())];
  for (const p0 of plans) {
    const p = migrate(structuredClone(p0)), q = structuredClone(p);
    q.debtPlan = { ...(q.debtPlan ?? {}), lumps: [] };
    const a = compute(p, { today: T13 }), b = compute(q, { today: T13 });
    assert.equal(JSON.stringify(b), JSON.stringify(a));
    for (const k of ["lumps", "lumpLines", "lumpEffect"]) assert.ok(!(k in a), k);
    assert.equal(JSON.stringify(savedPlan(q, { today: T13 })), JSON.stringify(savedPlan(p, { today: T13 })));
    assert.equal(JSON.stringify(twoDates(q, { today: T13 })), JSON.stringify(twoDates(p, { today: T13 })));
    let la = null, lb = null;
    try { la = JSON.stringify(lifeNeeds(p, { today: T13 })); } catch (e) { la = `throws ${e.message}`; }
    try { lb = JSON.stringify(lifeNeeds(q, { today: T13 })); } catch (e) { lb = `throws ${e.message}`; }
    assert.equal(lb, la);
  }
});

// Get started's single parent (invented, as in modules/insurance/life-needs/module.test.mjs): a $4,000 card at 24%, $150 a month
function sampleJo(lumps) {
  const p = emptyPlan();
  p.household = { people: [{ id: "s-jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "s-k1", name: "Child 1", role: "dependent", birthDate: "2022-07-15" }], filingStatus: "head_of_household", state: "OH" };
  p.accounts = [{ id: "s-chk", name: "Checking", type: "checking", balance: 400, asOf: "2026-11-02", ownerId: "", history: [] }, { id: "s-sav", name: "Savings", type: "savings", balance: 1500, asOf: "2026-11-02", ownerId: "", history: [] },
    { id: "s-card", name: "Credit cards", type: "credit", balance: 4000, asOf: "2026-11-02", ownerId: "", history: [] }];
  p.debts = [{ id: "s-debt", accountId: "s-card", rate: 0.24, minPayment: 150, extra: 0 }];
  p.income = [{ id: "s-pay", name: "Jo's pay", type: "salary", personId: "s-jo", amount: 62000, period: "annual", growth: 0, taxable: true }];
  const line = (id, name, category, amount) => ({ id, name, category, amount, period: "monthly", essential: true, inflates: true });
  p.expenses = [line("x1", "Rent", "housing", 1300), line("x3", "Groceries", "groceries", 500), line("x6", "Childcare and school", "childcare", 900), line("x8", "Everything else", "shopping", 970)];
  p.goals = [{ id: "s-edu", name: "Education", icon: "🎓", target: 0, targetDate: "2040-08-15", priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true }];
  p.retirement = { ...p.retirement, spendingMonthly: 2920, socialSecurity: { "s-jo": { monthlyAtFRA: 2430 } } };
  p.insurance = { policies: [] };
  if (lumps) p.debtPlan = { lumps };
  return p;
}
test("gap #3: one debt-free month on Pay off debts, Debts (both dates) and Life insurance needs (its debts over time)", async () => {
  const { twoDates } = await import("./compute.js");
  const { compute: lifeNeeds } = await import("../../insurance/life-needs/compute.js");
  const T = "2026-11-02";
  const plain = sampleJo(), lump = sampleJo([{ id: "l1", month: "2027-01", amount: 3000 }]);
  const card = (p) => compute(p, { today: T }).chosen.debts.find((x) => x.id === "s-card");
  const before = card(plain), after = card(lump);
  assert.ok(after.months < before.months);
  assert.equal(after.endDate.slice(0, 4), "2027");
  // Debts: the plan's date beside the card's own payment date is the payoff page's
  assert.equal(twoDates(lump, { today: T })["s-card"].plan, after.endDate);
  // Life insurance needs: the card is still owed at the start of 2027 and gone from the start of 2028 (without the lump, not
  // until 2031: 39 months on its own $150)
  const at = (p, y) => lifeNeeds(p, { today: T }).people[0].child.needByYear.find((x) => x.year === y).debts;
  assert.ok(at(lump, 2027) > 0); assert.equal(at(lump, 2028), 0);
  assert.ok(at(plain, 2028) > 0); assert.equal(at(plain, 2031), 0);
});

// ---- the page: a live store (an update is kept and the page drawn again, as the shell does) ----------------------------------
async function livePage(plan0, today = T13, { fieldError = null } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  let cur = migrate(structuredClone(plan0));
  const page = { saves: 0, root: null };
  const store = { get: () => cur, update: (fn) => { const d = structuredClone(cur); fn(d); cur = d; page.saves++; } };
  page.draw = () => { page.root = new FakeElement("main"); render(page.root, { ui: fieldError ? { ...ui, fieldError } : ui, fmt: { ...fmt, today: () => today }, plan: cur, route: { group: "debt", id: "payoff", rest: [], query: {} }, module: { group: "debt", id: "payoff" }, store, redraw: () => page.draw(), computeOf: () => null }); return page; };
  page.plan = () => cur;
  page.text = () => textOf(page.root);
  page.part = (id) => page.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  page.body = (id) => textOf(page.part(id)?.querySelector(".fold-body"));
  page.button = (label, scope = page.root) => scope.all().find((e) => e.tagName === "BUTTON" && textOf(e) === label);
  // the words a person sees with nothing opened: everything outside a shut part (its title and status only)
  page.first = () => { const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !n.hasAttribute("open") ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.tagName === "STYLE" ? "" : n.childNodes.map(walk).join(" ")); return walk(page.root).replace(/\s+/g, " ").trim(); };
  page.filled = () => { const shut = (e) => { for (let x = e; x; x = x.parentNode) if (x.tagName === "DETAILS" && !x.hasAttribute("open")) return true; return false; }; return page.root.all().filter((e) => ((e.tagName === "BUTTON" && !/secondary|chip/.test(e.className)) || (e.tagName === "A" && /\bbtn\b/.test(e.className) && !/secondary/.test(e.className))) && !e.hidden && !shut(e) && !(e.closest?.("[hidden]"))).map((e) => textOf(e)); };
  return page.draw();
}
const typeIn = (page, name, value) => { const box = page.root.querySelector(`[name="${name}"]`); box.value = value; box.dispatch("input"); return box; };
const submitOf = (page, name) => page.root.querySelector(`[name="${name}"]`).closest("form").dispatch("submit");

test("gap #3 page: the first view is the answer, the box and each debt's month (the rest moved, not lost); the parts card says 'none yet'", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const page = await livePage(renterDebtPlan(), "2026-11-06");
  const first = page.first();
  assert.match(first, /^Debt-free by July 2030 \$720 a month \(\$670 required, \$50 more from this plan\), highest interest rate first: 3 years 8 months and \$7,799 of interest\./);
  assert.match(first, /When each debt ends ✅ Visa card August 2029 ✅ Store card November 2029 ✅ Mastercard April 2030 ✅ Car loan July 2030/);
  assert.match(first, /One-time payments none yet › How this is worked out 3 orders ›/);
  // moved, not deleted: the three orders, each debt's figures and the baseline are inside "How this is worked out"
  assert.ok(!/The three orders, same money|interest to come|If you pay nothing more/.test(first));
  const how = textOf(page.part("how"));
  assert.match(how, /The three orders, same money Highest interest rate first chosen least interest 3 years 8 months, by July 2030 \$7,799 interest/);
  assert.match(how, /Visa card \$4,500 at 29\.0% · \$150 a month required · \$2,073 interest to come · gone in 2 years 9 months/);
  assert.match(how, /If you pay nothing more than today's required amounts \(each finished debt's payment moving to the next\): 4 years 2 months and \$9,623 of interest\./);
  assert.ok(page.button("Print the month-by-month plan", page.part("how")).className.includes("secondary"));
  assert.equal(page.part("lumps").hasAttribute("open"), false); assert.equal(page.part("how").hasAttribute("open"), false);
  assert.deepEqual(page.filled(), ["Save plan"], "one filled button");
  const words = first.split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length;
  assert.ok(words <= 160, `${words} words`);   // 239 before (the select's three choices are counted here; a phone shows one)
  // More on this: two questions that fit these debts
  assert.match(first, /More on this What does paying only the minimum on a card cost\? › How would a lender see these debts\? ›$/);
});

test("gap #3 page: add a lump sum inside the part: it is saved with its month, the part stays open, the green line names the new date", async () => {
  const page = await livePage(oneCard());
  const part = page.part("lumps");
  assert.match(page.body("lumps"), /A tax refund or a bonus paid on top once ends the debts sooner; a month you can't pay the extra moves the date later\. Put a lump sum on a debt When Next month March \(a tax refund\) Type my own In December 2026\./);
  // November: next month is December (the bonus chip says the same month, so it is not shown twice)
  const chips = part.all().find((e) => e.dataset.choice === "lumpAt").all().filter((e) => e.tagName === "BUTTON");
  assert.deepEqual(chips.map((e) => [textOf(e), e.getAttribute("aria-pressed")]), [["Next month", "true"], ["March (a tax refund)", "false"], ["Type my own", "false"]]);
  page.button("March (a tax refund)").click();
  assert.match(page.body("lumps"), /In March 2027\./);
  typeIn(page, "lumpAmount", "1,000");
  submitOf(page, "lumpAmount");
  const lumps = page.plan().debtPlan.lumps;
  assert.equal(lumps.length, 1); assert.deepEqual({ ...lumps[0], id: "" }, { id: "", month: "2027-03", amount: 1000, debtId: "" }); assert.ok(lumps[0].id);
  assert.equal(page.plan().debtPlan.extra, 50, "nothing else changed");
  page.draw();
  assert.ok(page.part("lumps").hasAttribute("open"), "the part saved in stays open");
  assert.equal(page.part("how").hasAttribute("open"), false, "no other part moves");
  // by hand (independent loop): $1,000 in month 4 of a $200 month: 26 months against 33, $518.90 less interest
  assert.match(page.body("lumps"), /^Saved\. Debt-free by January 2029 now, instead of August 2029\. \$1,000 in March 2027: debt-free by January 2029 instead of August 2029, about \$519 less interest\./);
  assert.match(page.first(), /^Debt-free by January 2029/);
  assert.match(page.first(), /One-time payments 1 set by you/);
  // the next draw has no green line; the line stays, with Remove, and the forms wait behind outlined buttons
  page.draw();
  const t = page.body("lumps");
  assert.ok(!/Saved\./.test(t));
  assert.match(t, /\$1,000 in March 2027: debt-free by January 2029 instead of August 2029, about \$519 less interest\. Remove/);
  assert.ok(page.button("+ Add another lump sum").className.includes("secondary"));
  assert.ok(page.root.querySelector('[name="lumpAmount"]').closest("form").closest("div").hidden, "the add form is folded behind its button");
});

test("S11: after a save only the saved part changes: a lump sum opens One-time payments and nothing else; Save plan moves no part", async () => {
  const openOf = (page) => Object.fromEntries(page.root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open")]));
  const page = await livePage(oneCard());
  const before = openOf(page);
  assert.deepEqual(before, { lumps: false, how: false });
  typeIn(page, "lumpAmount", "1,000");
  submitOf(page, "lumpAmount");
  page.draw();
  assert.deepEqual(openOf(page), { ...before, lumps: true }, "only the part saved in differs");
  // the plan's own Save (outside every part): no part opens or shuts
  const plain = await livePage(oneCard());
  const was = openOf(plain);
  typeIn(plain, "extra", "75");
  plain.button("Save plan").click();
  assert.equal(plain.plan().debtPlan.extra, 75);
  plain.draw();
  assert.deepEqual(openOf(plain), was);
  // the one-time amount is asked only by its own optional form: not a required box inside a shut part (R9 item 9);
  // an empty amount is held at the box with the page's words, the shut part opens around the box, and nothing is saved.
  // ui.fieldError acts only in a browser; this stand-in records the words and does what the kit's bringTo does first,
  // open each shut section around the box (the kit's own, on its browser path: tests/ui-kit-helpers.test.mjs, "fieldError:
  // ... a shut section holding the box opens")
  const said = [];
  const fieldError = (box, text) => {
    said.push([box?.getAttribute("name"), text]);
    for (let x = box; x; x = x.parentNode) if (x.tagName === "DETAILS" && !x.hasAttribute("open")) x.setAttribute("open", "");
    return false;
  };
  const held = await livePage(oneCard(), T13, { fieldError });
  const inPart = (el, id) => { for (let x = el; x; x = x.parentNode) if (x.tagName === "DETAILS" && x.dataset.part) return x.dataset.part === id; return false; };
  for (const name of ["lumpAmount", "skipAmount"]) {
    const box = held.root.querySelector(`[name="${name}"]`);
    assert.equal(box.hasAttribute("required"), false, `${name}: not required`);
    assert.ok(inPart(box, "lumps"), `${name} sits inside One-time payments`);
  }
  assert.deepEqual(openOf(held), { lumps: false, how: false }, "both parts shut before the try");
  submitOf(held, "lumpAmount");
  assert.deepEqual(said, [["lumpAmount", "Type the amount, like 2,500."]], "the words are said at the amount box");
  assert.deepEqual(openOf(held), { lumps: true, how: false }, "the part around the box opens, and no other");
  assert.equal(held.saves, 0, "an empty amount saves nothing");
  // the month you can't pay the extra: the same, with its own words
  held.part("lumps").removeAttribute("open");
  submitOf(held, "skipAmount");
  assert.deepEqual(said[1], ["skipAmount", "Type how much less, like 300."]);
  assert.deepEqual(openOf(held), { lumps: true, how: false });
  assert.equal(held.saves, 0, "an empty amount saves nothing");
  // a zero is no amount either
  typeIn(held, "lumpAmount", "0");
  submitOf(held, "lumpAmount");
  assert.deepEqual(said[2], ["lumpAmount", "Type the amount, like 2,500."]);
  assert.equal(held.saves, 0);
});

test("gap #3 page: a month you can't pay the extra is saved as a negative amount and moves the date later", async () => {
  const page = await livePage(oneCard());
  page.button("A month you can't pay the extra").click();
  assert.equal(page.root.querySelector('[name="skipAmount"]').closest("form").closest("div").hidden, false);
  typeIn(page, "skipAmount", "50");
  submitOf(page, "skipAmount");
  assert.deepEqual(page.plan().debtPlan.lumps.map((x) => [x.month, x.amount, x.debtId]), [["2026-12", -50, ""]]);
  page.draw();
  // by hand: $50 less in month 1: 34 months, $34.98 more interest
  assert.match(page.body("lumps"), /^Saved\. Debt-free by September 2029 now, instead of August 2029\. \$50 less in December 2026: debt-free by September 2029 instead of August 2029, about \$35 more interest\./);
});

test("gap #3 page: which debt is under 'More details (optional)'; an empty amount is held at the box", async () => {
  const page = await livePage(cardAndHome(), "2026-11-01");
  const sel = page.root.querySelector('[name="lumpDebt"]');
  assert.ok(sel.closest("details").className.includes("form-more"));
  assert.match(textOf(sel), /The next one in your order Visa Mortgage/);
  submitOf(page, "lumpAmount");
  assert.equal(page.saves, 0, "nothing saved without an amount");
  typeIn(page, "lumpAmount", "2,000"); sel.value = "m";
  submitOf(page, "lumpAmount");
  assert.equal(page.plan().debtPlan.lumps[0].debtId, "m");
  page.draw();
  assert.match(page.body("lumps"), /^Saved\. Debt-free by \w+ \d{4} now, instead of \w+ \d{4}\. \$2,000 in December 2026 on the Mortgage: /);
});

test("gap #3 page: one sentence for every case a line can reach", async () => {
  const say = async (p, today = T13) => { const page = await livePage(p, today); return page.body("lumps").split(" Remove")[0]; };
  assert.equal(await say(oneCard([{ id: "a", month: "2027-02", amount: 1000 }])), "$1,000 in February 2027: debt-free by December 2028 instead of August 2029, about $543 less interest.");
  assert.equal(await say(oneCard([{ id: "a", month: "2027-02", amount: -50 }])), "$50 less in February 2027: debt-free by September 2029 instead of August 2029, about $32 more interest.");
  assert.equal(await say(oneCard([{ id: "a", month: "2027-02", amount: 20 }])), "$20 in February 2027: still debt-free by August 2029, about $13 less interest.");
  assert.equal(await say(oneCard([{ id: "a", month: "2027-02", amount: -10 }])), "$10 less in February 2027: still debt-free by August 2029, about $6 more interest.");
  assert.equal(await say(oneCard([{ id: "a", month: "2027-02", amount: -50 }], 0)), "$50 less in February 2027: nothing above the required payments is paid that month, so it changes nothing.");
  assert.equal(await say(oneCard([{ id: "a", month: "2031-01", amount: 500 }])), "$500 in January 2031: your debts are paid off before then, so it changes nothing.");
  assert.equal(await say(oneCard([{ id: "a", month: "2026-09", amount: 1000 }])), "$1,000 in September 2026 is past, so the plan leaves it out. If you paid it, update the balance on Debts.");
  assert.equal(await say(oneCard([{ id: "a", month: "2026-09", amount: -50 }])), "$50 less in September 2026 is past, so the plan leaves it out.");
  const zero = emptyPlan(); zero.accounts.push({ id: "z", name: "Store card", type: "credit", balance: -1000 }); zero.debts = [{ accountId: "z", rate: 0, minPayment: 100 }]; zero.debtPlan = { lumps: [{ id: "a", month: "2027-01", amount: 50, debtId: "z" }] };
  assert.equal(await say(zero), "$50 in January 2027 on the Store card: still debt-free by September 2027, with less than $1 of interest saved.");
  const never = (lumps) => { const p = emptyPlan(); p.accounts.push({ id: "n", name: "Loan", type: "loan", balance: -10000 }); p.debts = [{ accountId: "n", rate: 0.24, minPayment: 150 }]; p.debtPlan = { lumps }; return p; };
  assert.equal(await say(never([{ id: "a", month: "2026-12", amount: 6000 }])), "$6,000 in December 2026: debt-free by April 2030; without it the debts are never paid off.");
  assert.equal(await say(never([{ id: "a", month: "2026-12", amount: 100 }])), "$100 in December 2026: at these payments the debts are still never paid off.");
  assert.equal(await say(never([{ id: "a", month: "2026-12", amount: -50 }])), "$50 less in December 2026: at these payments the debts would never be paid off.");
});

test("gap #3 page: Remove takes the line out, says the new date, and Undo puts it back", async () => {
  const page = await livePage(oneCard([{ id: "a", month: "2027-02", amount: 1000 }]));
  assert.match(page.first(), /^Debt-free by December 2028/);
  page.button("Remove", page.part("lumps")).click();
  assert.equal(page.plan().debtPlan.lumps, undefined, "the last line gone: no empty list left behind");
  page.draw();
  assert.ok(page.part("lumps").hasAttribute("open"));
  assert.match(page.body("lumps"), /^Removed: \$1,000 in February 2027\. Debt-free by August 2029 now\. Undo/);
  assert.match(page.first(), /^Debt-free by August 2029/);
  page.button("Undo").click();
  assert.equal(page.plan().debtPlan.lumps.length, 1);
  page.draw();
  assert.match(page.body("lumps"), /^Put back: \$1,000 in February 2027\. Debt-free by December 2028 now\./);
  // a plan that never ends says so
  const p = emptyPlan(); p.accounts.push({ id: "n", name: "Loan", type: "loan", balance: -10000 }); p.debts = [{ accountId: "n", rate: 0.24, minPayment: 150 }]; p.debtPlan = { lumps: [{ id: "a", month: "2026-12", amount: 6000 }] };
  const q = await livePage(p);
  q.button("Remove", q.part("lumps")).click(); q.draw();
  assert.match(q.body("lumps"), /^Removed: \$6,000 in December 2026\. At these payments the debts are never paid off\./);
});

test("gap #3 page: one filled button; Save plan is outlined while paying from savings (or the offer) holds the filled action", async () => {
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const filledOf = (page) => page.root.all().filter((e) => (e.tagName === "BUTTON" && !/secondary|chip/.test(e.className) && !e.closest("details")) || (e.tagName === "A" && /\bbtn\b/.test(e.className) && !/secondary/.test(e.className))).map((e) => textOf(e));
  // the family with $40,000 more in savings: the Visa card can be paid from savings above a full cushion
  const p = familyPlan(T13); delete p.debtPlan; p.accounts.find((a) => a.type === "savings").balance += 40000;
  const rich = await renderPage(new URL("./view.js", import.meta.url), p, T13, { computeOf: { "overview/next-best-action": nba } });
  assert.deepEqual(filledOf(rich), ["I moved it: update my balances"]);
  assert.ok(rich.root.all().find((e) => e.tagName === "BUTTON" && textOf(e) === "Save plan").className.includes("secondary"));
  const plain = await renderPage(new URL("./view.js", import.meta.url), familyPlan(T13), T13, { computeOf: { "overview/next-best-action": nba } });
  assert.deepEqual(filledOf(plain), ["Save plan"]);
});

test("gap #3 page: the green line after a save names the new answer, one sentence per case", async () => {
  const { lumpSaved } = await import("./view.js");
  const l = (kind, endDate = "2029-01-13", endWithout = "2029-08-13") => ({ kind, endDate, endWithout });
  assert.equal(lumpSaved(l("sooner")), "Saved. Debt-free by January 2029 now, instead of August 2029.");
  assert.equal(lumpSaved(l("later", "2029-09-13")), "Saved. Debt-free by September 2029 now, instead of August 2029.");
  assert.equal(lumpSaved(l("ends", "2030-04-13", null)), "Saved. Debt-free by April 2030 now.");
  assert.equal(lumpSaved(l("never", null, null)), "Saved. At these payments the debts are still never paid off.");
  for (const k of ["same", "nothing", "after"]) assert.equal(lumpSaved(l(k, "2029-08-13")), "Saved. Still debt-free by August 2029.");
  // through the page: a small lump that keeps the month
  const page = await livePage(oneCard());
  typeIn(page, "lumpAmount", "20"); submitOf(page, "lumpAmount"); page.draw();
  assert.match(page.body("lumps"), /^Saved\. Still debt-free by August 2029\. \$20 in December 2026: still debt-free by August 2029, about \$\d+ less interest\./);
  // the chips sit in a holder wave 1 does not keep typing from (the "Type my own" box is used up when its month is picked)
  assert.ok(page.root.all().some((e) => e.dataset.choice === "lumpAt" && e.parentNode?.dataset?.noKeep === ""));
});

// ---------------------------------------------------------------- gap #29: against the plan
// one card: $10,000 at 12% (1% a month), $500 a month, counted from 2026-07-13 with a balance from 2026-07-01. By hand, the
// plan's balances: month 1 10,000 + 100 - 500 = 9,600; month 2 9,600 + 96 - 500 = 9,196; month 3 9,196 + 91.96 - 500 =
// 8,787.96; month 4 8,787.96 + 87.88 - 500 = 8,375.84; month 5 8,375.84 + 83.76 - 500 = 7,959.60.
async function againstOf(owedNow, { lumps, start = "2026-07-13", history = [{ date: "2026-07-01", balance: -10000 }], asOf = T13 } = {}) {
  const { against } = await import("./compute.js");
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Card", type: "credit", balance: -owedNow, asOf, history });
  p.debts = [{ accountId: "c", rate: 0.12, minPayment: 500 }];
  p.debtPlan = { extra: 0, order: "avalanche", startedAt: start, ...(lumps ? { lumps } : {}) };
  return against(p, { today: T13 });
}
test("gap #29: exactly on plan is on track; the plan's balance by now is worked out from the balance on the start day", async () => {
  const { againstSays } = await import("./compute.js");
  const a = await againstOf(8375.84);
  assert.equal(a.debts[0].months, 4); assert.equal(a.debts[0].startBal, 10000);
  near(a.debts[0].planned, 8375.84, 0.01); assert.equal(a.debts[0].ahead, 0); assert.equal(againstSays(a), "on track");
  assert.equal((await againstOf(8376.5)).total.ahead, 0, "within a dollar is on track");
});
test("gap #29: ahead and behind, to the nearest month, read between the plan's months", async () => {
  const { againstSays } = await import("./compute.js");
  // 8,000 is between month 4 (8,375.84) and month 5 (7,959.60): month 4.90, 0.90 ahead -> 1
  const ahead = await againstOf(8000); assert.equal(ahead.total.ahead, 1); near(ahead.total.diff, 375.84, 0.01); assert.equal(againstSays(ahead), "1 month ahead");
  // 8,700 is between month 3 (8,787.96) and month 4: month 3.21, 0.79 behind -> 1
  const behind = await againstOf(8700); assert.equal(behind.total.ahead, -1); assert.equal(againstSays(behind), "1 month behind");
  // 9,300 is between month 1 (9,600) and month 2 (9,196): month 1.74, 2.26 behind -> 2
  assert.equal((await againstOf(9300)).total.ahead, -2);
  // paid off: the plan ends in month 23 (10,000 at 1% with 500: 22.4 months, the last one part), 23 - 4 = 19 ahead
  assert.equal((await againstOf(0)).total.ahead, 19);
  // more than at the start
  const more = await againstOf(10500); assert.equal(more.total.more, true); assert.equal(more.total.ahead, null); assert.equal(againstSays(more), "owe more");
});
test("gap #29: no newer balance says update your balances; nothing to compare draws no row", async () => {
  const { againstSays } = await import("./compute.js");
  const waiting = await againstOf(10000, { history: [], asOf: "2026-07-01" });
  assert.equal(waiting.waiting, true); assert.equal(againstSays(waiting), "update balances");
  assert.equal(await againstOf(10000, { history: [] }), null, "no balance from the start day: nothing to compare");
  assert.equal(await againstOf(9600, { start: "2026-10-20" }), null, "under a month since the start: no row yet");
  const p = emptyPlan(); p.accounts.push({ id: "c", name: "Card", type: "credit", balance: -9000, asOf: T13 }); p.debts = [{ accountId: "c", rate: 0.12, minPayment: 500 }]; p.debtPlan = { extra: 0 };
  const { against } = await import("./compute.js");
  assert.equal(against(p, { today: T13 }), null, "no start day");
});
test("gap #29: a one-time payment (gap #3) counts in the plan's path, placed by months from the start", async () => {
  // $1,000 in September 2026 is month 2 from July: by hand 9,600, then 9,196 - 1,000 = 8,196, 8,277.96 - 500 = 7,777.96,
  // 7,855.74 - 500 = 7,355.74 by month 4
  const a = await againstOf(7355.74, { lumps: [{ id: "l", month: "2026-09", amount: 1000 }] });
  near(a.total.planned, 7355.74, 0.01); assert.equal(a.total.ahead, 0);
  assert.equal((await againstOf(8375.84, { lumps: [{ id: "l", month: "2026-09", amount: 1000 }] })).total.ahead < 0, true, "without paying it you are behind");
});
test("gap #29: the start day is set the first time the plan is saved, and again only by Start counting from today", async () => {
  const { stampStart } = await import("./compute.js");
  const d = { debtPlan: { extra: 100 } };
  stampStart(d, "2026-11-13"); assert.equal(d.debtPlan.startedAt, "2026-11-13");
  stampStart(d, "2026-12-13"); assert.equal(d.debtPlan.startedAt, "2026-11-13", "kept");
  stampStart(d, "2026-12-13", { again: true }); assert.equal(d.debtPlan.startedAt, "2026-12-13");
  const page = await livePage(oneCard(null, 0));
  page.button("Save plan").click();
  assert.equal(page.plan().debtPlan.startedAt, T13);
});
test("gap #29 page: no row by default; once a month has gone by, 'Against your plan' with its few words, and Start counting from today", async () => {
  assert.equal((await livePage(oneCard(null, 0))).part("against"), undefined, "no start day: no row");
  const p = oneCard(null, 0);
  p.accounts[0].history = [{ date: "2026-07-01", balance: -5000 }]; p.accounts[0].asOf = T13; p.accounts[0].balance = -4000;
  p.debtPlan.startedAt = "2026-07-13";
  const page = await livePage(p);
  const row = page.part("against");
  assert.ok(row && !row.hasAttribute("open"), "a shut row");
  assert.match(textOf(row.querySelector("summary")), /Against your plan.*months? ahead/);
  assert.match(page.body("against"), /^You owe \$4,000\. Your plan said \$4,\d{3} by now: about \d+ months? ahead\./);
  page.button("Start counting from today", row).click();
  assert.equal(page.plan().debtPlan.startedAt, T13);
  page.draw();
  assert.equal(page.part("against"), undefined, "counting from today: the row comes back after a month");
});
