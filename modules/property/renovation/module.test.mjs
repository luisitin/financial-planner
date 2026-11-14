import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, schedule, loanCost, deductibleShare, PROJECTS, DEFAULTS, ACQ_LIMIT } from "./compute.js";
import { pmt } from "../../../core/math/finance.js";
import { planReturn } from "../../insurance/term-vs-permanent/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("schedule: interest by hand; with no discount the payments' present value is what is paid", () => {
  const s = schedule(1000, 0.12, 100);
  let b = 1000, i = 0, paid = 0; for (let m = 0; m < 20 && b > 0.005; m++) { const x = b * 0.01, p = Math.min(100, b + x); i += x; paid += p; b = b + x - p; }
  near(s.interest, i); near(s.pv, paid);
  assert.ok(schedule(1000, 0.12, 100, 0.06).pv < s.pv);
});

test("loanCost: the level payment, and at a discount equal to the rate the payments are worth the loan", () => {
  const l = loanCost(30000, 0.08, 10, 0.08);
  near(l.payment, pmt(0.08 / 12, 120, 30000)); near(l.pv, 30000, 0.05);
  near(l.interest, l.payment * 120 - 30000, 0.05);
});

test("value added: the project's average share, or your own", () => {
  const p = emptyPlan(); p.whatIfs = { renovation: { project: "garage-door", cost: 4000 } };
  const d = compute(p, { today: TODAY });
  near(d.valueAdded, 4000 * PROJECTS["garage-door"].recoup); assert.ok(d.equityChange > 0);
  p.whatIfs.renovation.recoup = 0.4;
  near(compute(p, { today: TODAY }).valueAdded, 1600);
});

test("the family's kitchen: four ways; no cash to spare; the line ranks first in today's dollars", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.ways.map((w) => w.id), ["cash", "heloc", "refi", "loan"]);
  const cash = d.ways[0]; assert.equal(cash.fits, false);
  near(d.discount, planReturn(p));
  const heloc = d.ways.find((w) => w.id === "heloc"), loan = d.ways.find((w) => w.id === "loan");
  const h = loanCost(30000, DEFAULTS.helocRate, DEFAULTS.helocYears, d.discount);
  near(heloc.monthly, h.payment); near(heloc.today, h.pv - 30000);
  const l = loanCost(30000, DEFAULTS.loanRate, DEFAULTS.loanYears, d.discount);
  near(loan.today, l.pv - 30000);
  assert.equal(heloc.taxSaved, 0, "the family takes the standard deduction");
  assert.equal(d.best, "heloc");
  near(d.home.borrowable, 380000 * DEFAULTS.cltv - 265000);
});

test("the refinance: the whole mortgage at the new rate against keeping it, closing costs borrowed too", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { today: TODAY });
  const r = d.ways.find((w) => w.id === "refi");
  const fees = (265000 + 30000) * DEFAULTS.refiCosts;
  near(r.fees, fees);
  const nl = loanCost(265000 + 30000 + fees, DEFAULTS.refiRate, DEFAULTS.refiYears, d.discount);
  const old = schedule(265000, 0.0625, 1980, d.discount);
  near(r.monthly, nl.payment - 1980); near(r.interest, nl.interest - old.interest); near(r.today, nl.pv - old.pv - 30000);
  assert.ok(r.risk, "it gives up a lower rate");
});

test("with the cash and no home: cash is the way, and no home loans are offered", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "s", name: "Savings", type: "savings", balance: 80000, history: [] });
  p.whatIfs = { renovation: { project: "bath", cost: 20000 } };
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.ways.map((w) => w.id), ["cash", "loan"]);
  assert.equal(d.best, "cash"); assert.equal(d.home, null);
  near(d.cushion.after, 60000);
});

test("a cash-out refinance fits only up to 80% of the home's value, closing costs included (HUD Mortgagee Letter 2019-11)", () => {
  // the family's 380,000 home and 265,000 mortgage: 30,000 more is 303,850 with 3% costs, 79.96%; 35,000 more is 309,000, 81.3%
  const p = familyPlan(TODAY);
  const r = compute(p, { today: TODAY }).ways.find((w) => w.id === "refi");
  near(r.ltv, 303850 / 380000, 1e-6); assert.equal(r.fits, true);
  p.whatIfs = { renovation: { cost: 35000 } };
  const d = compute(p, { today: TODAY }), r2 = d.ways.find((w) => w.id === "refi");
  near(r2.ltv, 309000 / 380000, 1e-6); assert.equal(r2.fits, false);
  assert.equal(d.ways.find((w) => w.id === "heloc").fits, true, "the line still fits: 85% of 380,000 less 265,000 is 58,000");
});

test("deductible interest by the law: the first $750,000 of home debt, never the closing costs rolled in (IRC 163(h)(3); Pub. 936)", () => {
  assert.equal(deductibleShare(700000, ACQ_LIMIT.other), 1);
  near(deductibleShare(800000, ACQ_LIMIT.other), 15 / 16, 1e-12);
  near(deductibleShare(500000, ACQ_LIMIT.separate), 0.75, 1e-12);
  // the family itemizing: the line's interest is all deductible (295,000 of home debt); the refinance's new loan only on the
  // old balance and the cost, 295,000 of its 303,850, less the old mortgage's interest it replaces; today's money after the tax
  const p = familyPlan(TODAY); p.taxes.itemized = { ...p.taxes.itemized, other: 60000 };
  const d = compute(p, { today: TODAY });
  assert.equal(d.itemizes, true);
  const h = d.ways.find((w) => w.id === "heloc"), r = d.ways.find((w) => w.id === "refi");
  const lc = loanCost(30000, DEFAULTS.helocRate, DEFAULTS.helocYears, d.discount);
  near(h.deductibleShare, 1); near(h.taxSaved, lc.interest * d.marginal); near(h.today, lc.pv - 30000 - lc.pvInterest * d.marginal);
  const nl = loanCost(303850, DEFAULTS.refiRate, DEFAULTS.refiYears, d.discount), old = schedule(265000, 0.0625, 1980, d.discount), share = 295000 / 303850;
  near(r.deductibleShare, share, 1e-12);
  near(r.taxSaved, (nl.interest * share - old.interest) * d.marginal);
  near(r.today, nl.pv - old.pv - 30000 - (nl.pvInterest * share - old.pvInterest) * d.marginal);
  // a cheaper refinance gives up deduction: the tax saved goes negative instead of stopping at 0
  p.whatIfs = { renovation: { refiRate: 0.04, refiYears: 15 } };
  const cheap = compute(p, { today: TODAY }).ways.find((w) => w.id === "refi");
  assert.ok(cheap.interest < 0 && cheap.taxSaved < 0, `${cheap.interest} ${cheap.taxSaved}`);
  // a 740,000 mortgage: the line's 30,000 takes the home debt past 750,000, so 750/770 of its interest counts
  const big = familyPlan(TODAY); big.taxes.itemized = { ...big.taxes.itemized, other: 60000 };
  big.accounts.find((a) => a.id === "a-mort").balance = 740000; big.accounts.find((a) => a.id === "a-home").balance = 1200000;
  big.debts.find((x) => x.id === "d-mort").minPayment = 5000;
  const bh = compute(big, { today: TODAY }).ways.find((w) => w.id === "heloc");
  // Pub. 936 Table 1 puts that share on all the home's interest: while the line runs, the mortgage loses 20/770 of its own
  const bd = compute(big, { today: TODAY }), cap = 750000 / 770000, mi = schedule(740000, 0.0625, 5000, bd.discount, DEFAULTS.helocYears * 12);
  near(bh.deductibleShare, cap, 1e-12);
  near(bh.taxSaved, (bh.interest * cap - mi.interest * (1 - cap)) * bd.marginal);
});

// ---- our guesses in the offers' rate boxes (smart guesses C9, spec 12.1 K3): gray figures counted while a box is empty, never saved
import { PREVIEWED, PREVIEW_KEYS } from "./compute.js";
import { estimate, checkEstimators } from "../../../core/estimate/index.js";
import { estimators as GUESSES, TABLES } from "../../overview/guesses/compute.js";
import { estimators as HOUSE } from "../../goals/house/compute.js";
import { T as DEBTS_T } from "../../overview/guesses/data/debts.js";
import { T as PURCHASE_T } from "../../overview/guesses/data/purchase.js";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
import { migrate } from "../../../core/schema/migrate.js";

const T14 = "2026-11-14";
const OPTS = { estimators: { ...GUESSES, ...HOUSE }, tables: TABLES, today: T14 };
const withProject = (r) => { const p = familyPlan(TODAY); p.whatIfs = { renovation: r }; return p; };

test("C9 the rates we preview: Freddie Mac's 30-year average of the year to refinance, the Federal Reserve's two-year personal loan rate", () => {
  assert.deepEqual(PREVIEWED, ["refiRate", "loanRate"]);
  assert.deepEqual(PREVIEW_KEYS, { refiRate: "goals/house:rate", loanRate: "debt.loan.rate" });
  assert.deepEqual(checkEstimators(OPTS.estimators), []);
  assert.equal(PURCHASE_T.pmms30_annual_average_by_year.rows["30-year fixed"].at(-1), 6.53);
  assert.equal(DEBTS_T.auto_personal_rate_fed_g19.rows["Personal loan, 24-month (commercial banks)"][0], 11.9);
  const r = estimate(familyPlan(T14), "goals/house:rate", OPTS), l = estimate(familyPlan(T14), "debt.loan.rate", OPTS);
  assert.deepEqual([r.value, r.why], [0.065, "the average new 30-year rate so far this year"]);
  assert.deepEqual([l.value, l.why, l.tables], [0.119, "the average bank rate on a two-year personal loan", ["auto_personal_rate_fed_g19"]]);
  const eur = familyPlan(T14); eur.meta.currency = "EUR";
  for (const k of Object.values(PREVIEW_KEYS)) assert.equal(estimate(eur, k, OPTS), null, `${k}: no U.S. figure in another currency`);
});
test("C9 compute: without previews nothing changes; with them a gray rate counts only while its box is empty, and its way says so", () => {
  for (const p of [familyPlan(TODAY), renterDebtPlan(), retiredCouplePlan(TODAY), migrate(emptyPlan()), withProject({ project: "bath", cost: 20000, loanRate: null, refiRate: "" })]) {
    const a = compute(p, { today: TODAY });
    assert.equal(a.previewed, undefined, "no new key without previews");
    assert.deepEqual(compute(p, { today: TODAY, previews: null }), a);
    const { previewed, ...b } = compute(p, { today: TODAY, previews: {} });
    assert.deepEqual(previewed, []); assert.deepEqual(b, a, "an empty previews object changes nothing");
  }
  const pv = { refiRate: 0.065, loanRate: 0.119 };
  const blank = compute(withProject({ project: "bath", cost: 20000 }), { today: TODAY, previews: pv });
  assert.deepEqual(blank.previewed, ["refiRate", "loanRate"]);
  const way = (d, id) => d.ways.find((w) => w.id === id);
  near(way(blank, "loan").monthly, pmt(0.119 / 12, 60, 20000));
  assert.equal(way(blank, "loan").note, "11.9% (our guess) over 5 years; not backed by your home");
  assert.match(way(blank, "refi").note, /^the whole mortgage at 6\.5% \(our guess\) for 30 years/);
  assert.equal(way(blank, "heloc").note, "8% repaid over 10 years; the rate usually changes over time", "the line keeps its stated default: no table");
  const typed = compute(withProject({ project: "bath", cost: 20000, loanRate: 0.09, refiRate: null }), { today: TODAY, previews: pv });
  assert.deepEqual(typed.previewed, ["refiRate"], "a typed rate is the person's: our figure is not counted");
  assert.equal(way(typed, "loan").note, "9% over 5 years; not backed by your home");
  assert.deepEqual(compute(withProject({ cost: 20000 }), { today: TODAY, previews: { loanRate: NaN, refiRate: "0.06" } }).previewed, []);
});

// ---- the page (drawn on the stand-in DOM, with ctx.guess as the shell gives it)
async function drawRenovation(plan0, { guess = true } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const p = migrate(structuredClone(plan0)); const saved = []; const root = new FakeElement("main");
  const ctx = { ui, fmt: { ...fmt, today: () => T14 }, plan: p, route: { rest: [], query: {} }, module: { group: "property", id: "renovation" }, computeOf: () => null,
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } },
    ...(guess ? { guess: (k, o = {}) => estimate(p, k, { ...OPTS, ...o }) } : {}) };
  render(root, ctx);
  return { root, saved, textOf, plan: p };
}
const boxOf = (root, name) => root.querySelector(`[name="${name}"]`);
const openParts = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));
const outsideShut = (el) => { for (let a = el.parentNode; a; a = a.parentNode) if (a.tagName === "DETAILS" && !a.hasAttribute("open")) return false; return true; };

test("C9 the page: empty rate boxes show our gray figures, the ways to pay count them and say so, and opening writes nothing", async () => {
  const { root, saved, textOf } = await drawRenovation(familyPlan(T14));
  assert.equal(saved.length, 0, "opening the page writes nothing");
  assert.equal(boxOf(root, "loanRate").value ?? "", "");
  assert.equal(boxOf(root, "loanRate").getAttribute("placeholder"), "11.9");
  assert.equal(boxOf(root, "refiRate").getAttribute("placeholder"), "6.5");
  assert.equal(boxOf(root, "helocRate").getAttribute("placeholder"), "", "no table, no gray figure: its help says what empty counts");
  assert.equal(boxOf(root, "loanYears").value ?? "", "", "no example in a box");
  const t = textOf(root);
  assert.match(t, /Our guess: the average bank rate on a two-year personal loan\./);
  assert.match(t, /Our guess: the average new 30-year rate so far this year\./);
  assert.match(t, /Left empty, we count 8% a year\./);
  assert.match(t, /Left empty, we count 5 years\./);
  const line = root.querySelectorAll("div").find((x) => /^11\.9% \(our guess\) over 5 years/.test(textOf(x)));
  assert.ok(line && outsideShut(line), "the way to pay says its rate is our guess, outside any fold (R9 #5)");
  assert.deepEqual(openParts(root), { figures: true }, "asks first: The figures is open until the page has a project");
});
test("C9 S11 (R17): Compare with the rate boxes left empty saves no guess, and only The figures stays open", async () => {
  const a = await drawRenovation(familyPlan(T14));
  boxOf(a.root, "cost").value = "20000";
  boxOf(a.root, "cost").closest("form").dispatch("submit");
  assert.equal(a.saved.length, 1);
  const w = a.saved[0].whatIfs.renovation;
  assert.equal(w.cost, 20000);
  assert.deepEqual(["helocRate", "helocYears", "refiRate", "refiYears", "refiCosts", "loanRate", "loanYears"].map((k) => w[k]), [null, null, null, null, null, null, null], "an empty box saves nothing: our figure is never written");
  assert.equal(a.saved[0].guesses, undefined, "no guess entry either");
  const b = await drawRenovation(a.saved[0]);
  assert.deepEqual(openParts(b.root), { figures: true }, "the part just saved stays open, no other moves");
  assert.match(b.textOf(b.root), /Saved\. The cheapest way to pay: [a-z-]+/);
  assert.equal(boxOf(b.root, "loanRate").getAttribute("placeholder"), "11.9", "reopened: still empty and gray");
  const c = await drawRenovation(a.saved[0]);
  assert.deepEqual(openParts(c.root), { figures: false }, "the next visit opens on the answer, the figures folded");
  assert.match(c.textOf(c.root), /11\.9% \(our guess\) over 5 years/, "folded, the ways to pay still say the rate is our guess");
  boxOf(c.root, "loanRate").value = "9.5";
  boxOf(c.root, "loanRate").closest("form").dispatch("submit");
  assert.equal(c.saved[0].whatIfs.renovation.loanRate, 0.095);
  const e = await drawRenovation(c.saved[0]);
  assert.equal(boxOf(e.root, "loanRate").value, "9.5");
  assert.equal(boxOf(e.root, "loanRate").getAttribute("placeholder") ?? "", "");
  assert.match(e.textOf(e.root), /9\.5% over 5 years; not backed by your home/);
});
test("C9 no guesses (another country, or the shell without ctx.guess): the rate boxes are empty and say what they count", async () => {
  const eur = familyPlan(T14); eur.meta.currency = "EUR";
  for (const { root, textOf } of [await drawRenovation(eur), await drawRenovation(familyPlan(T14), { guess: false })]) {
    assert.equal(boxOf(root, "loanRate").getAttribute("placeholder"), "");
    assert.match(textOf(root), /Left empty, we count 12% a year\./);
    assert.match(textOf(root), /Left empty, we count 6\.5% a year\./);
    assert.doesNotMatch(textOf(root), /our guess/i);
  }
});
