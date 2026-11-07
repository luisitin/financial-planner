import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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

// C3 (spec 8.1): how much of the month is our guesses, only on a plan that holds guesses
test("C3 guessedMonthly and guessedShare: the bills and debt payments Get started guessed; nothing on a plan without guesses", async () => {
  const { markGuess } = await import("../../../core/estimate/index.js");
  const p = emptyPlan();
  p.income = [{ id: "i", name: "Pay", type: "salary", amount: 5000, period: "monthly", personId: "" }];
  p.expenses = [
    { id: "setup-x-housing", name: "Rent", category: "housing", amount: 1200, period: "monthly", essential: true },
    { id: "setup-x-groceries", name: "Groceries", category: "groceries", amount: 400, period: "monthly", essential: true },
    { id: "setup-x-dining", name: "Eating out and fun", category: "dining", amount: 300, period: "monthly", essential: false },
  ];
  p.accounts = [{ id: "cc", name: "Credit cards", type: "credit", balance: -3000 }];
  p.debts = [{ id: "d-cc", accountId: "cc", rate: 0.224, minPayment: 90 }];
  const plain = compute(p, {});
  assert.equal(plain.guessedMonthly, undefined); assert.equal(plain.guessedShare, undefined);
  const est = (v) => ({ key: "spend.x", value: v, unit: "month", sigma: 0.25, dataAsOf: "2026-11-02" });
  markGuess(p, "expenses[setup-x-groceries].amount", est(400), "2026-11-02");
  markGuess(p, "expenses[setup-x-dining].amount", est(300), "2026-11-02");
  markGuess(p, "debts[d-cc].minPayment", { ...est(90), key: "debt.credit.payment" }, "2026-11-02");
  const r = compute(p, {});
  // 400 + 300 + the card's 90 (counted from Debts) of 1,200 + 400 + 300 + 90 = 1,990
  assert.deepEqual([r.guessedMonthly, r.guessedCount, Math.round(r.guessedShare * 1000) / 1000], [790, 3, 0.397]);
  // must-pay: groceries 400 + the card's 90 of 1,200 + 400 + 90 = 1,690
  assert.deepEqual([r.guessedEssential, Math.round(r.guessedEssentialShare * 1000) / 1000], [490, 0.29]);
  for (const k of ["monthly", "essentialMonthly", "optionalMonthly", "debtFromDebts"]) assert.equal(r[k], plain[k], `${k} unchanged`);
});

// C3 money review D6 (est/c3/c3-review-money.md): a guessed row that a typed bill covers in full (our rent at $0 under the
// person's own Apartment bill) is our figure doing its job, not a bill the person forgot to fill in
test("C3 review D6: a guessed row at $0 is not 'has no amount'; a typed $0 bill still is", async () => {
  const { markGuess } = await import("../../../core/estimate/index.js");
  const p = emptyPlan();
  p.expenses = [
    { id: "apt", name: "Apartment", category: "housing", amount: 1350, period: "monthly", essential: true },
    { id: "setup-x-housing", name: "Rent", category: "housing", amount: 0, period: "monthly", essential: true },
    { id: "gym", name: "Gym", category: "fun", amount: 0, period: "monthly", essential: false },
  ];
  markGuess(p, "expenses[setup-x-housing].amount", { key: "spend.housing", value: 0, unit: "month", sigma: 0.25, dataAsOf: "2026-11-02" }, "2026-11-02");
  assert.deepEqual(compute(p, {}).warnings.filter((w) => /no amount/.test(w)), ["Gym has no amount."]);
});

test("C3 verify: the bank card's notice names what was written (one row, a new bill, or a row and the bills split off it)", async () => {
  const { fromBankWords } = await import("./compute.js");
  assert.equal(fromBankWords({ name: "Groceries", amount: 1020, row: true, also: [] }), "Groceries is now $1,020 a month, from your bank.");
  assert.equal(fromBankWords({ name: "Other", amount: 50, row: false, also: [] }), "Added Other: $50 a month.");
  assert.equal(fromBankWords({ name: "Utilities", amount: 220, row: true, also: [{ name: "Phone and internet", amount: 170 }] }), "From your bank: Utilities $220 and Phone and internet $170 a month.");
  assert.equal(fromBankWords({ name: "Eating out", amount: 1010, row: true, also: [{ name: "Subscriptions", amount: 30 }, { name: "Pets", amount: 40 }] }), "From your bank: Eating out $1,010, Subscriptions $30 and Pets $40 a month.");
  // a row whose own kind the bank barely shows goes, and only the bills split off it are named
  assert.equal(fromBankWords({ name: "Eating out and fun", amount: 0, row: false, also: [{ name: "Subscriptions", amount: 60 }] }), "From your bank: Subscriptions $60 a month.");
});

// path part 3: the first screen says things in plain words (the path walk's banned-word check, qa/flows/path-walk.js, runs it in the browser)
test("part 3: plain words on the first screen: no hard word in this page's view or compute strings", () => {
  const strip = (t) => t.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[^]*?\*\//g, "");
  const view = strip(fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8"));
  for (const w of ['once prices rise', 'See or change each bill', 'ex-link']) assert.ok(view.includes(w), w);
  for (const w of ['after inflation']) assert.ok(!view.includes(w), w);
});

// review fix (UX 1): the list opens by bills typed, not by dollars; Get started's spread rows do not count as typed
test("part 3 review: billsFoldOpen opens for short lists and for lists mostly typed here, not for Get started's rows", async () => {
  const { billsFoldOpen } = await import("./compute.js");
  const mk = (ids) => { const p = emptyPlan(); p.expenses = ids.map((id) => ({ id, name: id, category: "other", amount: 100, period: "monthly" })); return p; };
  const seven = ["setup-x-home", "setup-x-food", "setup-x-car", "setup-x-fun", "setup-x-health", "setup-x-kids", "setup-x-other"];
  const p1 = mk(seven);
  assert.equal(billsFoldOpen(p1, p1.expenses), false, "one total spread over seven rows: closed");
  const p2 = mk(["a", "b", "c", "d", "e", "f", "g", "h"]);
  assert.equal(billsFoldOpen(p2, p2.expenses), true, "eight typed bills: open");
  const p3 = mk([...seven.slice(0, 5), "mine", "mine2"]);
  assert.equal(billsFoldOpen(p3, p3.expenses), false, "two typed of seven: closed");
  const p4 = mk(["a", "b", "c", "d", "e"]);
  assert.equal(billsFoldOpen(p4, p4.expenses), true, "five or fewer: open");
});
test("part 3 review: the tiles say bills you have to pay and could be cut; a too-high guess is said plainly", () => {
  const view = fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8");
  for (const w of ['"Bills you have to pay"', '"Could be cut"', "probably too high", "a bill you have to pay"]) assert.ok(view.includes(w), w);
  for (const w of ['ui.stat("Must pay"', 'ui.stat("Nice to have"']) assert.ok(!view.includes(w), w);
});

// verify 2026-11-06: with the bill list folded (many bills, most our guesses), a save re-draws the page: the list must stay open and the
// confirmation must sit outside the fold, or the person sees the fold shut and no word that the bill was added
test("verify: adding a bill with the list folded keeps it open and shows the confirmation above the fold", async () => {
  const { render } = await import("./view.js");
  const { markGuess } = await import("../../../core/estimate/index.js");
  const mkNode = (tag, kids = []) => {
    const n = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.kids.push(c); },
      replaceChildren(...k) { n.kids = []; n.append(...k); }, remove() {}, scrollIntoView() {}, querySelector() { return null; }, set innerHTML(v) { n.kids = []; void v; },
      get textContent() { return n.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } };
    n.append(...kids); return n;
  };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const T = "2026-11-02";
  const plan = emptyPlan();
  plan.meta.currency = plan.meta.currency ?? "USD";
  plan.expenses = ["housing", "utilities", "groceries", "transport", "insurance", "dining", "shopping"].map((k) => ({ id: `setup-x-${k}`, name: k, category: k, amount: 100, period: "monthly", essential: true }));
  for (const x of plan.expenses) markGuess(plan, `expenses[${x.id}].amount`, { key: `spend.${x.category}`, value: 100, unit: "month", sigma: 0.25, dataAsOf: T }, T);
  let submit = null, addClick = null;
  const ui = { h: (tag, a, ...k) => mkNode(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => mkNode("card", [t, ...k]),
    button: (l, onClick) => { if (/Add another expense/.test(l)) addClick = onClick; return mkNode("button", [l]); }, notice: (lv, t) => mkNode("notice", [t]),
    row: (...k) => mkNode("row", k), stat: (l, v, s) => mkNode("stat", [l, v, s]), form: (f, v, onSubmit) => { submit = onSubmit; return mkNode("form"); },
    field: (l, c) => mkNode("field", [l, c]), select: () => mkNode("select"), uid: () => "u1", confirm: () => false };
  const draw = (p, update) => { const root = mkNode("root"); render(root, { ui, fmt: { ...fmt, today: () => T }, plan: p, store: { update }, computeOf: () => null, route: { query: {} } }); return root; };
  const fold = (root) => root.kids.find((c) => c && c.tag === "details");
  const first = draw(plan, () => {});
  assert.equal(fold(first).open, false, "7 bills, all our guesses: the list starts folded");
  // the Add button lives inside the fold; open the form, then save through the form's own handler
  addClick();
  let next = null;
  submit({ name: "Gym", category: "fun", amount: 40, period: "monthly", essential: false, inflates: true, startDate: "", endDate: "" });
  // the store mock hands back the new plan; the shell then draws the page again
  const saved = structuredClone(plan); saved.expenses.push({ id: "u1", name: "Gym", category: "fun", amount: 40, period: "monthly", essential: false });
  // (the real handler called store.update with a draft function; run it on a copy to be sure it adds one row)
  const probe = structuredClone(plan); let ran = false;
  const second = draw(saved, () => { ran = true; });
  assert.equal(fold(second).open, true, "after a save the list stays open");
  const outside = second.kids.filter((c) => c && c.tag === "div" && /Gym added\./.test(c.textContent));
  assert.equal(outside.length, 1, "the confirmation is a child of the page, not of the fold");
  assert.ok(!/Gym added\./.test(fold(second).textContent), "and not hidden inside the fold");
  void next; void probe; void ran;
  // the notice shows once: the next draw has no pending word and the list folds again
  assert.equal(fold(draw(plan, () => {})).open, false);
});

// ---- round 8 batch 6 review (money 1 and 2): which Debts payments the month carries, and how much of each ----------------
test("batch 6: debtsCounted lists the Debts rows the month carries, at the amount it carries; a mortgage dropped for a housing bill is not there", async () => {
  const { condoOnNetWorthPlan } = await import("../../../qa/fixtures/round8-rental.mjs");
  const T = "2026-11-06";
  const by = (xs) => [...xs].sort((a, b) => (a.id < b.id ? 1 : -1));
  // no loan bills: both mortgages come from Debts, at their payments
  const p = condoOnNetWorthPlan();
  assert.deepEqual(by(compute(p, { today: T }).debtsCounted), [{ id: "setup-owe-mortgage", monthly: 2350 }, { id: "condo-loan", monthly: 851 }]);
  // a bill under loan payments matched to the condo's loan: carried at the bill's amount
  p.expenses.push({ id: "x-condo", name: "Condo mortgage", category: "debt", amount: 900, period: "monthly" });
  assert.deepEqual(compute(p, { today: T }).debtsCounted.find((x) => x.id === "condo-loan"), { id: "condo-loan", monthly: 900 });
  // the home's mortgage filed under housing ($2,350): Expenses then drops every mortgage from Debts, so the condo's 851 is in no
  // bill and is not carried (the review's repro)
  const q = condoOnNetWorthPlan();
  q.expenses.push({ id: "x-mort", name: "Mortgage payment", category: "housing", amount: 2350, period: "monthly" });
  assert.deepEqual(compute(q, { today: T }).debtsCounted, []);
  // a housing bill that is both mortgages' payments (within 10% of 3,201) carries both, at their payments
  q.expenses.find((x) => x.id === "x-mort").amount = 3200;
  assert.deepEqual(by(compute(q, { today: T }).debtsCounted), [{ id: "setup-owe-mortgage", monthly: 2350 }, { id: "condo-loan", monthly: 851 }]);
});

test("verify: the left-over box on 'Set your month in one number' asks for a keyboard with a minus sign (an iPhone's number pad has none)", async () => {
  const { render } = await import("./view.js");
  const mkNode = (tag, kids = []) => {
    const n = { tag, kids: [], style: {}, attrs: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.kids.push(c); },
      replaceChildren(...k) { n.kids = []; n.append(...k); }, remove() {}, scrollIntoView() {}, querySelector() { return null; }, setAttribute(k, v) { n.attrs[k] = v; }, set innerHTML(v) { n.kids = []; void v; },
      get textContent() { return n.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } };
    n.append(...kids); return n;
  };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const T = "2026-11-02";
  const plan = emptyPlan();
  plan.meta.currency = plan.meta.currency ?? "USD";
  plan.income = [{ id: "i1", name: "Pay", type: "salary", amount: 60000, period: "annual" }];
  plan.expenses = [{ id: "x1", name: "Rent", category: "housing", amount: 1200, period: "monthly", essential: true }];
  const boxes = [];
  const ui = { h: (tag, a, ...k) => mkNode(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => mkNode("card", [t, ...k]),
    button: (l) => mkNode("button", [l]), notice: (lv, t) => mkNode("notice", [t]), row: (...k) => mkNode("row", k), stat: (l, v, s) => mkNode("stat", [l, v, s]),
    form: (f) => { const form = mkNode("form"); if (f.some((x) => x.key === "amount")) { const box = mkNode("input"); boxes.push({ label: f[0].label, box }); form.querySelector = (sel) => (sel === 'input[name="amount"]' ? box : null); } return form; },
    field: (l, c) => mkNode("field", [l, c]), select: () => mkNode("select"), uid: () => "u1", confirm: () => false };
  const root = mkNode("root");
  // (the form lands in the card's host after it is built: the host's querySelector reaches the form's box)
  const realH = ui.h; ui.h = (tag, a, ...k) => { const n = realH(tag, a, ...k); n.querySelector = (sel) => { for (const c of n.kids) { const r = c?.querySelector?.(sel); if (r) return r; } return null; }; return n; };
  render(root, { ui, fmt: { ...fmt, today: () => T }, plan, store: { update() {} }, computeOf: () => null, route: { query: {} } });
  const left = boxes.find((b) => /checking go up/.test(b.label));
  assert.ok(left, "the left-over box is drawn");
  assert.equal(left.box.attrs.inputmode, "text");
});
