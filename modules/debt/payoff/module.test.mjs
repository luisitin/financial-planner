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
  assert.equal(compute(cardAndHome(), { today: "2026-11-01", extra: 500 }).tie, false, "a card and a mortgage with extra money: the order matters");
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
