import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, CATEGORIES, closeGap } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import * as fmt from "../../../core/format.js";

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
  // 5. a card payment missing from the list: counted from Debts by name, so nothing is missing and nothing to warn about
  // (2026-11-02; before, the total stayed short and a warning said "a payment may be missing")
  const e = base();
  e.accounts.push({ id: "v", name: "Visa", type: "credit", balance: 4000 });
  e.debts.push({ id: "dv", accountId: "v", rate: 0.24, minPayment: 400 });
  e.expenses.push({ id: "e1", name: "Mortgage payment", category: "housing", amount: 1650, period: "monthly" }, { id: "e2", name: "Car loan", category: "debt", amount: 320, period: "monthly" });
  const de = compute(e, {});
  assert.equal(de.warnings.length, 0, de.warnings.join(" "));
  assert.equal(de.debtFromDebts, 400); assert.deepEqual(de.fromDebts.map((x) => x.name), ["Visa"]); assert.equal(de.monthly, 1650 + 320 + 400);
  // 6. a filed amount far from its debt's payment still says one may be out of date
  const f = base();
  f.expenses.push({ id: "e1", name: "Mortgage payment", category: "housing", amount: 1650, period: "monthly" }, { id: "e2", name: "Car loan", category: "debt", amount: 200, period: "monthly" });
  assert.match(compute(f, {}).warnings[0], /add up to \$200 a month; the Debts page has \$320 \(not counting the mortgage, which is under housing\)\. A payment may be missing here/);
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

test("each debt is matched to its own expense: the car payment listed does not drop the card's (round 4, 2026-11-02)", async () => {
  const { matchDebts } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-10-30";
  const p = familyPlan(T);
  const d = compute(p, { today: T });
  // the family lists the car payment ($410) and the mortgage (under housing); the Visa's $400 ($190 required + $210 extra on Debts) is on Debts only
  assert.equal(d.debtFromDebts, 400);
  assert.deepEqual(d.fromDebts, [{ id: "a-visa", name: "Visa card", monthly: 400, required: 190 }]);
  assert.deepEqual(d.debtMatches, { "a-car": "e-car" });
  const listed = d.active.reduce((t, x) => t + x.monthly, 0);
  assert.ok(Math.abs(d.monthly - (listed + 400)) < 0.01);
  assert.ok(Math.abs(d.essentialMonthly - (d.active.filter((x) => x.essential).reduce((t, x) => t + x.monthly, 0) + 190)) < 0.01, "the required $190 is a must-pay; the $210 extra is not");
  assert.ok(Math.abs(d.essentialMonthly + d.optionalMonthly - d.monthly) < 0.01, "must-pay and nice-to-have add up to the total: the $210 extra is a nice-to-have");
  assert.deepEqual(d.warnings, [], "nothing is missing any more, so no 'a payment may be missing' warning");
  const cat = d.byCategory.find((c) => c.category === "debt");
  assert.equal(cat.label, "Loan and card payments (some from Debts)"); assert.ok(Math.abs(cat.monthly - 810) < 0.01);
  // listed as its own expense, by name, it is not counted twice
  p.expenses.push({ id: "e-visa", name: "Visa payment", category: "debt", amount: 400, period: "monthly", essential: true });
  const e = compute(p, { today: T });
  assert.equal(e.debtFromDebts, 0); assert.deepEqual(e.fromDebts, []);
  // one line for all loan payments ($810) covers both debts
  const q = familyPlan(T);
  q.expenses = q.expenses.filter((x) => x.id !== "e-car");
  q.expenses.push({ id: "e-all", name: "Loans", category: "debt", amount: 810, period: "monthly", essential: true });
  assert.equal(compute(q, { today: T }).debtFromDebts, 0);
  // matching: by a word of the name first (words every loan shares do not count), then by an amount within 10%
  const m = matchDebts([{ id: "x1", name: "Toyota", monthly: 300 }, { id: "x2", name: "Card payment", monthly: 395 }], [{ id: "v", name: "Visa card", payment: 400, minPayment: 190 }, { id: "c", name: "Car loan (Toyota Financial)", payment: 410 }]);
  assert.equal(m.matched.get("c").id, "x1"); assert.equal(m.matched.get("v").id, "x2"); assert.equal(m.spare, 0);
});

test("a loan paid off costs nothing: no payment on Debts, its listed payment is said to have ended, and it never stands in for another debt (round 4)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: liabilities } = await import("../../balance/liabilities/compute.js");
  const { compute: alerts } = await import("../../overview/alerts/compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  const before = liabilities(p, { today: T });
  p.accounts.find((a) => a.id === "a-car").balance = 0;
  const li = liabilities(p, { today: T });
  const car = li.rows.find((r) => r.id === "a-car");
  assert.equal(car.paidOff, true); assert.equal(car.payment, 0); assert.equal(car.minPayment, 0); assert.equal(car.typedPayment, 410);
  assert.ok(Math.abs(li.payments - (before.payments - 410)) < 0.01, "Paying each month and debt-to-income drop the paid-off loan");
  const d = compute(p, { today: T });
  assert.deepEqual(d.ended, [{ debtId: "a-car", debtName: "Car loan", id: "e-car", name: "Car payment", monthly: 410 }]);
  // the Visa's $400 is still counted from Debts: the ended car payment does not cover it
  assert.equal(d.debtFromDebts, 400); assert.deepEqual(d.fromDebts.map((x) => x.name), ["Visa card"]);
  assert.deepEqual(d.warnings, []);
  const al = alerts(p, { today: T }).alerts.find((a) => a.id === "debt-paid-a-car");
  assert.ok(al && al.title === "Car loan is paid off" && /Car payment \(\$410 a month\), is still counted on Expenses/.test(al.detail ?? al.text ?? JSON.stringify(al)));
  // stopped from yesterday, it no longer counts and nothing is said
  p.expenses.find((x) => x.id === "e-car").endDate = "2026-11-01";
  const s = compute(p, { today: T });
  assert.deepEqual(s.ended, []); assert.ok(Math.abs(s.monthly - (d.monthly - 410)) < 0.01);
});

// The page drawn with a stand-in for the UI kit: every element keeps its children, so the words on screen can be read
// back as text without a browser (review 2026-11-02, round 5).
function drawText(render, plan, computeOf, today) {
  const node = (tag, kids = []) => {
    const n = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.kids.push(c); },
      replaceChildren(...k) { n.kids = []; n.append(...k); }, remove() {}, scrollIntoView() {}, set innerHTML(v) { n.kids = []; void v; },
      get textContent() { return n.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } };
    n.append(...kids); return n;
  };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]),
    row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form"), field: (l, c) => node("field", [l, c]), select: () => node("select"), uid: () => "u", confirm: () => false };
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update() {} }, computeOf, route: { query: {} } });
  return root.textContent.replace(/\s+/g, " ");
}

test("short only in a lean month: the tile and Close the gap give the full month to the nearest $10, the one figure (review 2026-11-02, round 5)", async () => {
  const { render } = await import("./view.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const D = "2026-11-02";
  const at = (left) => {
    const p = familyPlan(D); p.income.find((y) => y.id === "i-side").countOn = 0;
    const s = next(p, { today: D }).spare;
    p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s.full - left, period: "monthly", essential: false });
    return p;
  };
  const text = (p) => drawText(render, p, (key, params) => (key === "overview/next-best-action" ? next(p, params) : null), D);
  const lean = text(at(297));
  assert.match(lean, /in a lean month; when all your uneven pay comes in, about \$300 is left/);
  assert.match(lean, /A month that brings the Income page's amount leaves about \$300, so this is about the lean months\./);
  assert.doesNotMatch(lean, /The rest has to come from a must-pay|The biggest must-pays/, "no must-pay to cut when good months make up for lean ones");
  const short = text(at(-123));
  assert.match(short, /when all your uneven pay comes in, it is still about \$120 short/);
  assert.match(short, /Even a month that brings the Income page's amount is about \$120 short\. This is the first thing to fix\./);
});

test("a full month within $5 of $0: the tile and Close the gap say 'only just about breaks even', never 'about $0' (review 2026-11-02, round 5)", async () => {
  const { render } = await import("./view.js");
  const { compute: next } = await import("../../overview/next-best-action/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const D = "2026-11-02";
  const at = (left) => {
    const p = familyPlan(D); p.income.find((y) => y.id === "i-side").countOn = 0;
    const s = next(p, { today: D }).spare;
    p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: s.full - left, period: "monthly", essential: false });
    return p;
  };
  for (const left of [3, -2]) {
    const p = at(left);
    const text = drawText(render, p, (key, params) => (key === "overview/next-best-action" ? next(p, params) : null), D);
    assert.match(text, /in a lean month; when all your uneven pay comes in, it only just about breaks even/);
    assert.match(text, /Even a month that brings the Income page's amount only just about breaks even\. This is the first thing to fix\./);
    assert.doesNotMatch(text, /about \$0\b/);
  }
});
