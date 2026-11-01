import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, CATEGORIES, closeGap } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.monthly, 0); assert.equal(d.income, null); assert.equal(d.leftOver, null); assert.deepEqual(d.byCategory, []);
});
test("monthly totals, must-pay split, category shares", () => {
  const p = emptyPlan();
  p.expenses.push(
    { id: "e1", name: "Rent", category: "housing", amount: 1800, period: "monthly" },
    { id: "e2", name: "Groceries", category: "groceries", amount: 150, period: "weekly" },
    { id: "e3", name: "Netflix", category: "subscriptions", amount: 15, period: "monthly", inflates: false },
    { id: "e4", name: "Car insurance", category: "insurance", amount: 600, period: "quarterly", essential: false },
  );
  const d = compute(p, { today: TODAY });
  near(d.monthly, 1800 + 650 + 15 + 200);
  near(d.essentialMonthly, 1800 + 650);                 // insurance was overridden to not essential
  near(d.optionalMonthly, 215);
  near(d.inflatingMonthly, 1800 + 650 + 200);           // Netflix does not inflate
  assert.equal(d.byCategory[0].category, "housing");
  near(d.byCategory[0].share, 1800 / 2665);
  assert.equal(d.items[3].essential, false);
  assert.equal(d.items[0].essential, CATEGORIES.housing.essential);
});
test("compared with income: left over and savings rate; a shortfall warns", () => {
  const p = emptyPlan();
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 5000, period: "monthly" });
  p.expenses.push({ id: "e", name: "Rent", category: "housing", amount: 2000, period: "monthly" });
  let d = compute(p, { today: TODAY });
  assert.equal(d.leftOver, 3000); assert.equal(d.savingsRate, 0.6); assert.deepEqual(d.warnings, []);
  p.expenses.push({ id: "e2", name: "Everything else", category: "other", amount: 4000, period: "monthly" });
  d = compute(p, { today: TODAY });
  assert.equal(d.leftOver, -1000);
  assert.ok(d.warnings.some((w) => w.includes("more each month than comes in")));
});
test("dates: upcoming and ended expenses are listed but not counted; one-offs are separate", () => {
  const p = emptyPlan();
  p.expenses.push(
    { id: "a", name: "Now", category: "other", amount: 100, period: "monthly" },
    { id: "b", name: "Later", category: "other", amount: 100, period: "monthly", startDate: "2027-01-01" },
    { id: "c", name: "Before", category: "other", amount: 100, period: "monthly", endDate: "2026-01-01" },
    { id: "d", name: "Vacation", category: "travel", amount: 3000, period: "once" },
  );
  const d = compute(p, { today: TODAY });
  assert.equal(d.monthly, 100); assert.equal(d.count, 4); assert.equal(d.active.length, 2); assert.equal(d.oneTime, 3000);
  assert.equal(d.items[1].upcoming, true); assert.equal(d.items[2].ended, true);
});

test("a mortgage filed under housing is not counted twice, and does not set off the loan-payments check", () => {
  const base = () => {
    const p = emptyPlan();
    p.accounts.push({ id: "m", name: "Mortgage", type: "mortgage", balance: 250000 }, { id: "c", name: "Car loan", type: "loan", balance: 9000 });
    p.debts.push({ id: "dm", accountId: "m", rate: 0.065, minPayment: 1650 }, { id: "dc", accountId: "c", rate: 0.07, minPayment: 320 });
    return p;
  };
  // 1. "Mortgage payment" under housing, the car loan under loan payments: nothing to check, nothing added
  const a = base();
  a.expenses.push({ id: "e1", name: "Mortgage payment", category: "housing", amount: 1650, period: "monthly" }, { id: "e2", name: "Car loan", category: "debt", amount: 320, period: "monthly" });
  const da = compute(a, {});
  assert.equal(da.warnings.length, 0, da.warnings.join(" "));
  assert.equal(da.monthly, 1970);
  // 2. the mortgage under housing (by amount), no loan payments filed: only the car loan comes from Debts
  const b = base();
  b.expenses.push({ id: "e1", name: "House", category: "housing", amount: 1600, period: "monthly" });
  assert.equal(compute(b, {}).monthly, 1600 + 320, "the mortgage is not added a second time");
  // 3. Set up my plan's "Home costs" besides the mortgage: the mortgage still comes from Debts
  const c = base();
  c.expenses.push({ id: "e1", name: "Home costs", category: "housing", amount: 450, period: "monthly" });
  assert.equal(compute(c, {}).monthly, 450 + 1650 + 320);
  // 4. everything filed under loan payments, mortgage included: also fine
  const d = base();
  d.expenses.push({ id: "e1", name: "Home costs", category: "housing", amount: 450, period: "monthly" }, { id: "e2", name: "Mortgage and car", category: "debt", amount: 1970, period: "monthly" });
  assert.equal(compute(d, {}).warnings.length, 0);
  // 5. a card payment missing from the list: the check says so, in plain words
  const e = base();
  e.accounts.push({ id: "v", name: "Visa", type: "credit", balance: 4000 });
  e.debts.push({ id: "dv", accountId: "v", rate: 0.24, minPayment: 400 });
  e.expenses.push({ id: "e1", name: "Mortgage payment", category: "housing", amount: 1650, period: "monthly" }, { id: "e2", name: "Car loan", category: "debt", amount: 320, period: "monthly" });
  const w = compute(e, {}).warnings;
  assert.equal(w.length, 1);
  assert.match(w[0], /add up to \$320 a month; the Debts page has \$720 \(not counting the mortgage, which is under housing\)\. A payment may be missing here/);
});
test("the before-tax overspend sentence is also returned on its own, so a page that knows the after-tax figure can show that instead", () => {
  const p = emptyPlan();
  p.income.push({ id: "i", name: "Pay", type: "salary", amount: 1000, period: "monthly" });
  p.expenses.push({ id: "r", name: "Rent", category: "housing", amount: 1500, period: "monthly" });
  const d = compute(p, { today: "2026-09-15" });
  assert.ok(d.overspend.includes("$500 more each month"));
  assert.ok(d.warnings.includes(d.overspend));
  p.income[0].amount = 2000;
  assert.equal(compute(p, { today: "2026-09-15" }).overspend, null);
});

test("closeGap: the fewest nice-to-haves that close the gap, a trim on the last, must-pays only when that is not enough", () => {
  const items = [
    { id: "a", name: "Eating out", amount: 400, monthly: 400, active: true, essential: false, period: "monthly" },
    { id: "b", name: "Streaming", amount: 45, monthly: 45, active: true, essential: false, period: "monthly" },
    { id: "c", name: "Gym", amount: 120, monthly: 120, active: true, essential: false, period: "monthly" },
    { id: "d", name: "Trip", monthly: 900, active: false, essential: false, period: "monthly" },   // ended: not offered
    { id: "e", name: "Rent", monthly: 2400, active: true, essential: true, period: "monthly" },
    { id: "f", name: "Groceries", monthly: 700, active: true, essential: true, period: "monthly" },
  ];
  // one item covers 100: the smallest that does (Gym 120), with a trim of 100 enough
  let r = closeGap(items, 100);
  assert.deepEqual(r.picks.map((x) => x.id), ["c"]);
  assert.equal(r.picks[0].trimBy, 100);
  assert.equal(r.picks[0].trimTo, 20, "a $120 monthly gym trimmed by $100 a month: $20 a month");
  // a yearly trip: the trim is said in its own terms, the amount its form asks for
  const trip = [{ id: "t", name: "Summer trip", amount: 3000, period: "annual", monthly: 250, active: true, essential: false }];
  const y = closeGap(trip, 220).picks[0];
  assert.equal(y.trimBy, 220); assert.equal(y.trimTo, 360, "$3,000 a year less $2,640 = $360 a year"); assert.equal(y.period, "annual");
  assert.equal(r.enough, true);
  assert.deepEqual(r.bigMustPays, []);
  // 450: Eating out alone is 400; then Streaming (45) does not cover the 50 left, Gym (120) does -> trim it by 50
  r = closeGap(items, 450);
  assert.deepEqual(r.picks.map((x) => x.id), ["a", "c"]);
  assert.equal(r.picks[1].trimBy, 50);
  assert.equal(r.covered, 520);
  // exactly the whole of one: no trim
  assert.equal(closeGap(items, 400).picks[0].trimBy, null);
  // more than every nice-to-have (565): all three, not enough, the biggest must-pays named
  r = closeGap(items, 1000, { goalSaving: 950 });
  assert.deepEqual(r.picks.map((x) => x.id), ["a", "c", "b"]);
  assert.equal(r.enough, false);
  assert.equal(r.niceTotal, 565);
  assert.deepEqual(r.bigMustPays.map((x) => x.id), ["e", "f"]);
  assert.equal(r.goalSaving, 950);
  // no gap: nothing picked
  assert.deepEqual(closeGap(items, 0).picks, []);
});
