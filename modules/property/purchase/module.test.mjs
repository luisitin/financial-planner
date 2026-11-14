import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, giveWay, DEFAULTS } from "./compute.js";
import { pmt, pmtToReach } from "../../../core/math/finance.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withPurchase = (purchase) => { const p = familyPlan(TODAY); p.whatIfs = { purchase }; return p; };

test("the example until a purchase is typed", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.total, DEFAULTS.price); assert.equal(d.save, null, "no date, no saving plan");
  near(d.finance.payment, pmt(DEFAULTS.apr / 12, DEFAULTS.termMonths, DEFAULTS.price));
});

test("save up: the monthly amount that, with interest, reaches the price with tax by the date", () => {
  const p = withPurchase({ name: "Sofa", price: 3500, salesTax: 0.06, when: "2027-06-01", saved: 500 });
  const d = compute(p, { today: TODAY });
  near(d.total, 3710); assert.equal(d.months, 7);
  const r = Number(p.assumptions?.returnCash ?? 0.02) / 12;
  near(d.save.monthly, pmtToReach(r, 7, 3710, 500)); near(d.save.earned, 3710 - 500 - d.save.monthly * 7);
});

test("finance: a level payment, all 0%, and 0% for a while then the rate", () => {
  const plain = compute(withPurchase({ price: 3000, apr: 0.2, termMonths: 24 }), { today: TODAY }).finance;
  near(plain.payment, pmt(0.2 / 12, 24, 3000)); near(plain.interest, plain.payment * 24 - 3000);
  const free = compute(withPurchase({ price: 2400, termMonths: 12, promoMonths: 12 }), { today: TODAY }).finance;
  near(free.payment, 200); assert.equal(free.interest, 0);
  const mixed = compute(withPurchase({ price: 2400, termMonths: 24, promoMonths: 12, apr: 0.24 }), { today: TODAY }).finance;
  let b = 2400; for (let m = 0; m < 24; m++) b = (m < 12 ? b : b * 1.02) - mixed.payment;
  near(b, 0, 0.01); assert.ok(mixed.interest > 0 && mixed.payment < plain.payment + 100);
});

test("a small purchase fits in the money left; no goal gives way", () => {
  const d = compute(withPurchase({ price: 1200, when: "2027-04-01", apr: 0.2, termMonths: 12 }), { today: TODAY });
  assert.equal(d.effect.save.list.length, 0); assert.equal(d.effect.finance.list.length, 0);
  near(d.spare, computeNext(familyPlan(TODAY), { today: TODAY }).spare.monthly);
});

test("giveWay: least important first, then the latest due; paused when nothing is left; the rest uncovered", () => {
  const goals = [
    { id: "a", name: "Must", priority: 1, monthly: 300, targetDate: "2027-01-01", funded: 0, target: 3000, rate: 0, status: "on track" },
    { id: "b", name: "Nice soon", priority: 3, monthly: 100, targetDate: "2027-01-01", funded: 0, target: 1200, rate: 0, status: "on track" },
    { id: "c", name: "Nice later", priority: 3, monthly: 200, targetDate: "2030-01-01", funded: 0, target: 2400, rate: 0, status: "on track" },
    { id: "d", name: "Done", priority: 3, monthly: 50, status: "done" },
  ];
  const g = giveWay(goals, 250);
  assert.deepEqual(g.list.map((x) => [x.id, x.from]), [["c", 200], ["b", 50]]);
  assert.ok(g.list[0].paused); assert.equal(g.list[1].monthsLater, 24 - 12, "1,200 at 50 a month instead of 100");
  assert.equal(g.uncovered, 0);
  const all = giveWay(goals, 1000);
  assert.deepEqual(all.list.map((x) => x.id), ["c", "b", "a"]); near(all.uncovered, 400);
});

test("a boat: saving up by June squeezes the goals; the cash is not there", () => {
  const d = compute(withPurchase({ name: "Boat", price: 42000, salesTax: 0.0625, when: "2027-06-01", saved: 2000, apr: 0.089, termMonths: 84 }), { today: TODAY });
  assert.ok(d.effect.save.list.length > 0 && d.effect.save.uncovered > 0);
  near(d.effect.save.list.reduce((t, g) => t + g.from, 0) + d.effect.save.uncovered, d.save.monthly - d.spare);
  assert.equal(d.cash.fits, false);
});

test("pay cash: only what is not already set aside comes out of usable cash (README: usable cash − (total − set aside))", () => {
  const p = withPurchase({ name: "Sofa", price: 3000, saved: 1000 });
  const d = compute(p, { today: TODAY }), now = computeLiquidity(p, { today: TODAY }).now;
  near(d.cash.amount, 2000); near(d.cash.after, now - 2000); assert.equal(d.cash.fits, now >= 2000);
  // set aside more than it costs: nothing more to pay
  const all = compute(withPurchase({ name: "Sofa", price: 3000, saved: 5000 }), { today: TODAY });
  near(all.cash.amount, 0); near(all.cash.after, now);
});

// ---- our guess in the rate box (smart guesses C9, spec 12.1 K3): a gray figure counted while the box is empty, never saved
import { PREVIEWED } from "./compute.js";
import { estimate } from "../../../core/estimate/index.js";
import { estimators as GUESSES, TABLES } from "../../overview/guesses/compute.js";
import { T as DEBTS_T } from "../../overview/guesses/data/debts.js";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
import { migrate, emptyPlan } from "../../../core/schema/migrate.js";

const T14 = "2026-11-14";
const OPTS = { estimators: GUESSES, tables: TABLES, today: T14 };

test("C9 the rate we preview is the guesses module's card rate: the Federal Reserve's average on cards that charge interest (G.19)", () => {
  assert.deepEqual(PREVIEWED, ["apr"]);
  const t = DEBTS_T.cc_apr_fed_g19;
  assert.equal(t.rows["Credit card plans, accounts assessed interest (commercial banks)"][0], 22.36);
  const e = estimate(renterDebtPlan(), "debt.credit.rate", OPTS);
  assert.deepEqual([e.value, e.why, e.tables], [0.224, "the average rate on cards that charge interest", ["cc_apr_fed_g19"]], "rounded to a tenth of a point (R11)");
  const eur = renterDebtPlan(); eur.meta.currency = "EUR";
  assert.equal(estimate(eur, "debt.credit.rate", OPTS), null, "no U.S. figure for a plan in another currency");
});
test("C9 compute: without previews nothing changes; with them the gray rate counts only while the box is empty", () => {
  for (const p of [familyPlan(TODAY), renterDebtPlan(), retiredCouplePlan(TODAY), migrate(emptyPlan()), withPurchase({ price: 3000, apr: null, termMonths: null })]) {
    const a = compute(p, { today: TODAY });
    assert.equal(a.previewed, undefined, "no new key without previews");
    assert.deepEqual(compute(p, { today: TODAY, previews: null }), a);
    const { previewed, ...b } = compute(p, { today: TODAY, previews: {} });
    assert.deepEqual(previewed, []); assert.deepEqual(b, a, "an empty previews object changes nothing");
  }
  const blank = compute(withPurchase({ price: 3000, apr: null }), { today: TODAY, previews: { apr: 0.224 } });
  assert.deepEqual(blank.previewed, ["apr"]); assert.equal(blank.inputs.apr, 0.224);
  near(blank.finance.payment, pmt(0.224 / 12, 24, 3000));
  const typed = compute(withPurchase({ price: 3000, apr: 0.18 }), { today: TODAY, previews: { apr: 0.224 } });
  assert.deepEqual(typed.previewed, [], "a typed rate is the person's: our figure is not counted");
  assert.equal(typed.inputs.apr, 0.18);
  assert.deepEqual(compute(withPurchase({ price: 3000 }), { today: TODAY, previews: { apr: NaN } }).previewed, [], "a figure that is not a number is no preview");
  assert.equal(compute(withPurchase({ price: 3000 }), { today: TODAY, previews: { apr: "0.3" } }).inputs.apr, DEFAULTS.apr);
});

// ---- the page (drawn on the stand-in DOM, with ctx.guess as the shell gives it)
async function drawPurchase(plan0, { guess = true } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const p = migrate(structuredClone(plan0)); const saved = []; const root = new FakeElement("main");
  const ctx = { ui, fmt: { ...fmt, today: () => T14 }, plan: p, route: { rest: [], query: {} }, module: { group: "property", id: "purchase" }, computeOf: () => null,
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } },
    ...(guess ? { guess: (k, o = {}) => estimate(p, k, { ...OPTS, ...o }) } : {}) };
  render(root, ctx);
  return { root, saved, textOf, plan: p };
}
const boxOf = (root, name) => root.querySelector(`[name="${name}"]`);
const openParts = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));
const outsideShut = (el) => { for (let a = el.parentNode; a; a = a.parentNode) if (a.tagName === "DETAILS" && !a.hasAttribute("open")) return false; return true; };

test("C9 the page: the empty rate box shows our gray figure, the answer counts it and says so, and opening writes nothing", async () => {
  const { root, saved, textOf } = await drawPurchase(renterDebtPlan());
  assert.equal(saved.length, 0, "opening the page writes nothing");
  assert.equal(boxOf(root, "apr").value ?? "", "");
  assert.equal(boxOf(root, "apr").getAttribute("placeholder"), "22.4");
  assert.equal(boxOf(root, "termMonths").value ?? "", "", "no example in a box: its help says what empty counts");
  assert.equal(boxOf(root, "salesTax").getAttribute("placeholder"), "", "no gray e.g. in a percent box beside a real gray figure");
  const t = textOf(root);
  assert.match(t, /Our guess: the average rate on cards that charge interest\./);
  // critic e9 P4: a card's average is not a store's offer; the line says many start with no interest
  assert.equal(textOf(boxOf(root, "apr").closest("label").querySelector(".help")), "Our guess: the average rate on cards that charge interest. Many store plans charge no interest at first.");
  assert.match(t, /Until you say what you want to buy, it shows a \$3,000 example\./);
  assert.match(t, /Left empty, we count 24 months\./);
  const line = root.querySelectorAll("div").find((x) => /^24 months at 22\.4% \(our guess\): \$\d/.test(textOf(x)));
  assert.ok(line && outsideShut(line), "the answer says the rate is our guess, outside any fold (R9 #5)");
  assert.deepEqual(openParts(root), { figures: true }, "asks first: The figures is open until the page has a purchase");
});
test("C9 S11 (R17): Compare with the rate left empty saves no guess, and only The figures stays open", async () => {
  const a = await drawPurchase(renterDebtPlan());
  boxOf(a.root, "price").value = "2400";
  boxOf(a.root, "price").closest("form").dispatch("submit");
  assert.equal(a.saved.length, 1);
  const w = a.saved[0].whatIfs.purchase;
  assert.deepEqual([w.price, w.apr, w.termMonths, w.salesTax, w.saved, w.promoMonths], [2400, null, null, null, null, null], "an empty box saves nothing: our figure is never written");
  assert.equal(a.saved[0].guesses, undefined, "no guess entry either");
  const b = await drawPurchase(a.saved[0]);
  assert.deepEqual(openParts(b.root), { figures: true }, "the part just saved stays open, no other moves");
  assert.equal(boxOf(b.root, "apr").getAttribute("placeholder"), "22.4", "reopened: still empty and gray");
  assert.match(b.textOf(b.root), /Saved\. The purchase: \$2,400, or \$\d+ a month on the payment plan\./);
  assert.equal(boxOf(b.root, "price").value, "2,400");
  const c = await drawPurchase(a.saved[0]);
  assert.deepEqual(openParts(c.root), { figures: false }, "the next visit opens on the answer, the figures folded");
  assert.match(c.textOf(c.root), /24 months at 22\.4% \(our guess\)/, "folded, the answer still says the rate is our guess");
  // the person types a rate: it is theirs, and the gray figure is gone
  boxOf(c.root, "apr").value = "18";
  boxOf(c.root, "apr").closest("form").dispatch("submit");
  assert.equal(c.saved[0].whatIfs.purchase.apr, 0.18);
  const e = await drawPurchase(c.saved[0]);
  assert.equal(boxOf(e.root, "apr").value, "18");
  assert.equal(boxOf(e.root, "apr").getAttribute("placeholder") ?? "", "");
  assert.doesNotMatch(e.textOf(e.root), /our guess/i);
});
test("C9 no guesses (another country, or the shell without ctx.guess): the rate box is empty and says what it counts", async () => {
  const eur = renterDebtPlan(); eur.meta.currency = "EUR";
  for (const { root, textOf } of [await drawPurchase(eur), await drawPurchase(renterDebtPlan(), { guess: false })]) {
    assert.equal(boxOf(root, "apr").value ?? "", "");
    assert.equal(boxOf(root, "apr").getAttribute("placeholder"), "");
    assert.match(textOf(root), /Left empty, we count 22% a year\./);
    assert.match(textOf(root), /24 months at 22%: /);
    assert.doesNotMatch(textOf(root), /our guess/i);
  }
});
