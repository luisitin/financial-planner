import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, inputsOf, simulate, DEFAULTS } from "./compute.js";
import { planReturn, TAX_DRAG } from "../../insurance/term-vs-permanent/compute.js";
import { pmt } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withInputs = (s) => { const p = familyPlan("2026-10-30"); p.whatIfs = { rentVsBuy: s }; return p; };

test("the inputs: defaults, the plan's own return less the tax drag, saved values win", () => {
  const p = familyPlan("2026-10-30");
  const x = inputsOf(p);
  assert.equal(x.price, DEFAULTS.price); near(x.investReturn, planReturn(p) - TAX_DRAG);
  assert.equal(inputsOf(withInputs({ price: 500000, investReturn: 0.04, itemize: true, years: 99 })).price, 500000);
  assert.equal(inputsOf(withInputs({ investReturn: 0.04 })).investReturn, 0.04);
  assert.equal(inputsOf(withInputs({ years: 99 })).years, 40);
  assert.equal(inputsOf(emptyPlan()).rentMonthly, DEFAULTS.rentMonthly);
});

test("one year by hand: the mortgage, the costs, both pots, the buyer's money if sold", () => {
  const x = { ...inputsOf(familyPlan("2026-10-30")), investReturn: 0.05 };
  const { rows, monthlyPI, loan } = simulate(x, 1);
  assert.equal(loan, 320000); near(monthlyPI, pmt(0.065 / 12, 360, 320000));
  const r = rows[0];
  near(r.interest + r.principal, monthlyPI * 12, 1e-6);
  near(r.buyCost, monthlyPI * 12 + 400000 * (0.011 + 0.0035 + 0.01));
  near(r.rentCost, 2200 * 12 + 180);
  near(r.renterWealth, (80000 + 12000) * 1.05 + (r.buyCost - r.rentCost));
  near(r.value, 400000 * 1.03); near(r.buyerWealth, r.value * 0.94 - r.balance);
  near(r.ahead, r.buyerWealth - r.renterWealth);
});

test("itemizing saves tax at the marginal rate on interest and property tax", () => {
  const x = { ...inputsOf(familyPlan("2026-10-30")), itemize: true, marginalRate: 0.24 };
  const r = simulate(x, 1).rows[0];
  near(r.taxSaving, (r.interest + r.propertyTax) * 0.24);
});

test("the defaults: buying pulls ahead around year nine; the rent that makes them even", () => {
  const d = compute(familyPlan("2026-10-30"));
  assert.equal(d.atEnd.year, 10); assert.equal(d.atEnd.winner, d.atEnd.ahead >= 0 ? "buy" : "rent");
  assert.ok(d.breakevenYear >= 1 && d.breakevenYear <= 40);
  const even = compute(withInputs({ rentMonthly: d.rentEven }));
  assert.ok(Math.abs(even.atEnd.ahead) < 50, String(even.atEnd.ahead));
  assert.ok(compute(withInputs({ rentMonthly: 1200 })).atEnd.winner === "rent");
  assert.ok(compute(withInputs({ rentMonthly: 4000 })).atEnd.winner === "buy");
});

// ---- our guesses in the boxes (smart guesses C9, spec 12.1 K3): gray figures counted while a box is empty, never saved
import { estimators, PREVIEWED, PREVIEW_KEYS, typicalRent, rentOnFile } from "./compute.js";
import { estimators as houseEstimators } from "../../goals/house/compute.js";
import { estimate, checkEstimators } from "../../../core/estimate/index.js";
import { TABLES } from "../../overview/guesses/compute.js";
import { T as SPEND_T, DERIVED as D_SPEND } from "../../overview/guesses/data/spend.js";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
import { migrate } from "../../../core/schema/migrate.js";

const T13 = "2026-11-13";
const ALL = { ...houseEstimators, ...estimators };
const OPTS = { estimators: ALL, tables: TABLES, today: T13 };

test("C9 property/rent-vs-buy:rent: the contract holds; every previewed box has its estimator", () => {
  assert.deepEqual(checkEstimators([houseEstimators, estimators]), []);
  for (const k of PREVIEWED) assert.ok(ALL[PREVIEW_KEYS[k]], k);
});
test("C9 the rent: what a renter pays now (Expenses), else the state's median rent before utilities (ACS 2025 x 0.897)", () => {
  const gross = (st) => SPEND_T.acs2025_median_gross_rent_by_state.rows.grossRent[SPEND_T.acs2025_median_gross_rent_by_state.cols.indexOf(st)];
  assert.deepEqual([gross("OH"), gross("US"), D_SPEND.contractShare.value], [1155, 1557, 0.897]);
  near(typicalRent("OH"), 1155 * 0.897); near(typicalRent(null), 1557 * 0.897);
  // Riley rents in Ohio and typed $950 on Expenses: that, to the cent, and said as theirs
  const r = estimate(renterDebtPlan(), "property/rent-vs-buy:rent", OPTS);
  assert.deepEqual([r.value, r.why, r.basis], [950, "what you pay now, as on your Expenses page", "yours"]);
  assert.deepEqual(rentOnFile(renterDebtPlan(), T13), { monthly: 950, guessed: false });
  // the same rent as our own guess on Expenses (Get started left it blank)
  const g = renterDebtPlan();
  g.guesses = { "expenses[setup-x-housing].amount": { k: "spend.housing", v: 950, u: "month", s: 0.25, at: T13, d: "2026-11-02" } };
  assert.equal(estimate(g, "property/rent-vs-buy:rent", OPTS).why, "our guess of your rent, as on your Expenses page");
  // an owner (the family, Texas): the state's typical rent, rounded to $50 (R11): 1,036 -> $1,050 for Ohio; Texas from its own cell
  const fam = familyPlan(T13);
  assert.equal(rentOnFile(fam, T13), null, "owners pay a mortgage, not rent");
  const t = estimate(fam, "property/rent-vs-buy:rent", OPTS);
  assert.equal(t.why, "typical rent before utilities in Texas");
  assert.equal(t.value, Math.round(gross("TX") * 0.897 / 50) * 50);
  const n = estimate(migrate(emptyPlan()), "property/rent-vs-buy:rent", OPTS);
  assert.deepEqual([n.value, n.why], [1400, "typical rent before utilities in the U.S."]);
  const eur = renterDebtPlan(); eur.meta.currency = "EUR";
  assert.equal(estimate(eur, "property/rent-vs-buy:rent", OPTS), null, "no U.S. figure outside the U.S.");
});
test("C9 (critic e9 F3) a mortgage's payment on Expenses is never taken for rent, whatever Accounts holds", () => {
  // no home and no mortgage on file (so the guesses read a renter), but the housing row is the mortgage's payment
  const p = migrate(emptyPlan()); p.household.state = "OH";
  p.expenses = [{ id: "m", name: "Mortgage payment", category: "housing", amount: 2400, period: "monthly" }];
  assert.equal(rentOnFile(p, T13), null);
  const e = estimate(p, "property/rent-vs-buy:rent", OPTS);
  assert.deepEqual([e.value, e.why], [Math.round(typicalRent("OH") / 50) * 50, "typical rent before utilities in Ohio"]);
  for (const name of ["MORTGAGE", "Home mtg", "Rent and mortgage"]) { const q = structuredClone(p); q.expenses[0].name = name; assert.equal(rentOnFile(q, T13), null, name); }
  // a renter's own rent row still counts, with any other housing row beside it
  const r = structuredClone(p); r.expenses = [{ id: "r", name: "Rent", category: "housing", amount: 1200, period: "monthly" }, { id: "k", name: "Parking", category: "housing", amount: 50, period: "monthly" }];
  assert.deepEqual(rentOnFile(r, T13), { monthly: 1250, guessed: false });
});
test("C9 invariance: without previews the answer is exactly as before; previews count only in empty boxes", () => {
  for (const p of [familyPlan(T13), renterDebtPlan(), retiredCouplePlan(T13), migrate(emptyPlan()), withInputs({ price: 300000, rentMonthly: null })]) {
    const a = compute(p);
    assert.equal("previewed" in a, false);
    assert.deepEqual(compute(p, {}), a); assert.deepEqual(compute(p, { previews: null }), a);
    const { previewed, ...b } = compute(p, { previews: {} });
    assert.deepEqual(previewed, []); assert.deepEqual(b, a);
    assert.deepEqual(inputsOf(p, null), inputsOf(p));
  }
  const pv = { price: 250000, rentMonthly: 950, rate: 0.065, taxRate: 0.012, insuranceRate: 0.0046 };
  const d = compute(renterDebtPlan(), { previews: pv });
  assert.deepEqual(d.previewed, PREVIEWED);
  assert.deepEqual([d.inputs.price, d.inputs.rentMonthly, d.inputs.rate, d.inputs.taxRate, d.inputs.insuranceRate], [250000, 950, 0.065, 0.012, 0.0046]);
  near(d.firstYear.rentMonthly, 950 + 180 / 12);
  near(d.monthlyPI, pmt(0.065 / 12, 360, 200000));
  near(d.upfront, 250000 * (0.2 + 0.03));
  const typed = compute(withInputs({ price: 300000, rentMonthly: 1800, rate: null }), { previews: pv });
  assert.deepEqual(typed.previewed, ["rate", "taxRate", "insuranceRate"], "the price and rent the person typed win");
  assert.deepEqual([typed.inputs.price, typed.inputs.rentMonthly, typed.inputs.rate], [300000, 1800, 0.065]);
});

async function drawRvb(plan0, { guess = true } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const p = migrate(structuredClone(plan0)); const saved = []; const root = new FakeElement("main");
  render(root, { ui, fmt: { ...fmt, today: () => T13 }, plan: p, route: { rest: [], query: {} }, module: { group: "property", id: "rent-vs-buy" }, computeOf: () => null,
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } },
    ...(guess ? { guess: (k, o = {}) => estimate(p, k, { ...OPTS, ...o }) } : {}) });
  return { root, saved, textOf };
}
const boxOf = (root, name) => root.querySelector(`[name="${name}"]`);
const openParts = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));

test("C9 the page: gray figures in the empty boxes, the answer and the line count them, and opening writes nothing", async () => {
  const { root, saved, textOf } = await drawRvb(renterDebtPlan());
  assert.equal(saved.length, 0, "opening the page writes nothing");
  assert.deepEqual(["price", "rentMonthly", "rate", "taxRate", "insuranceRate"].map((k) => boxOf(root, k).getAttribute("placeholder")), ["250,000", "950", "6.5", "1.22", "0.46"]);
  assert.equal(boxOf(root, "sellCosts").getAttribute("placeholder"), "", "no example in a box");
  const t = textOf(root);
  assert.match(t, /An example: a typical Ohio home of \$250,000, 20% down, against renting a similar one for \$950 a month/);
  assert.match(t, /Put in yours below: an empty box counts the gray figure\./);
  assert.doesNotMatch(t, /Our guesses for now/, "while nothing is saved the sentence above says it");
  const p = renterDebtPlan(); p.whatIfs = { ...(p.whatIfs ?? {}), rentVsBuy: { downShare: 0.2, years: 10 } };
  await drawRvb(p);
  const s2 = await drawRvb(p);
  assert.match(s2.textOf(s2.root), /Our guesses for now: the price, the rent, the rate, property tax and insurance\./);
  assert.match(t, /Our guess: what you pay now, as on your Expenses page\./);
  assert.match(t, /Left empty, we count 6%: agent and fees\./);
});
test("C9 S11 (R17): Compare with the boxes left empty saves no guess, and only The figures stays open", async () => {
  const a = await drawRvb(renterDebtPlan());
  assert.deepEqual(openParts(a.root), { figures: true });
  boxOf(a.root, "price").closest("form").dispatch("submit");
  assert.equal(a.saved.length, 1);
  const w = a.saved[0].whatIfs.rentVsBuy;
  assert.deepEqual([w.price, w.rentMonthly, w.rate, w.taxRate, w.insuranceRate, w.sellCosts], [null, null, null, null, null, null], "an empty box saves nothing");
  assert.deepEqual([w.downShare, w.years, w.itemize], [0.2, 10, false]);
  assert.equal(a.saved[0].guesses, undefined);
  const b = await drawRvb(a.saved[0]);
  assert.deepEqual(openParts(b.root), { figures: true }, "the part just saved stays open");
  assert.equal(boxOf(b.root, "rentMonthly").getAttribute("placeholder"), "950");
  const c = await drawRvb(a.saved[0]);
  assert.deepEqual(openParts(c.root), { figures: false }, "the next visit opens on the answer");
  boxOf(c.root, "rentMonthly").value = "1,100";
  boxOf(c.root, "price").closest("form").dispatch("submit");
  assert.equal(c.saved[0].whatIfs.rentVsBuy.rentMonthly, 1100, "typed is the person's");
  const e = await drawRvb(c.saved[0]);
  assert.match(e.textOf(e.root), /Our guesses for now: the price, the rate, property tax and insurance\./);
});
test("C9 (critic e9 P1) with nothing of the person's own, the answer says it is an example, first", async () => {
  const { root, textOf } = await drawRvb(migrate(emptyPlan()));
  const t = textOf(root).replace(/\u200b/g, "").replace(/\s+/g, " ");
  const lede = textOf(root.querySelector(".lede"));
  assert.match(lede, /^An example: a typical U\.S\. home of \$370,000, 20% down, against renting a similar one for \$1,400 a month/);
  assert.match(t, /Example: (renting|buying) ahead by/);
  assert.match(t, /this rent is (lower|higher)/, "our typical rent is not \"your rent\"");
  assert.doesNotMatch(t, /your rent is/);
  // Riley's rent is his own (Expenses): "your rent", the home still an example
  const r = await drawRvb(renterDebtPlan());
  const rt = r.textOf(r.root).replace(/\u200b/g, "").replace(/\s+/g, " ");
  assert.match(rt, /Example: (renting|buying) ahead by/);
  assert.match(rt, /your rent is (lower|higher)/);
  // once saved, the answer is theirs: no "Example"
  const p = renterDebtPlan(); p.whatIfs = { rentVsBuy: { price: 240000, rentMonthly: 1100, downShare: 0.1, years: 8 } };
  const s2 = await drawRvb(p);
  const st = s2.textOf(s2.root).replace(/\u200b/g, "").replace(/\s+/g, " ");
  assert.match(st, /(Renting|Buying) ahead by/);
  assert.doesNotMatch(st, /Example|An example/);
});
test("C9 (critic e9 P2, P8) a figure nobody typed says where it comes from; help lines start as sentences", async () => {
  const { root, textOf } = await drawRvb(renterDebtPlan());
  const helpOf = (name) => textOf(boxOf(root, name).closest("label").querySelector(".help"));
  assert.deepEqual([boxOf(root, "downShare").value, boxOf(root, "years").value], ["20", "10"]);
  assert.equal(helpOf("downShare"), "We start at 20%, which avoids mortgage insurance.");
  assert.equal(helpOf("years"), "We start at 10 years.");
  for (const h of root.querySelectorAll(".help")) assert.match(textOf(h), /^[A-Z0-9]/, `"${textOf(h)}" starts in lower case`);
  const p = renterDebtPlan(); p.whatIfs = { rentVsBuy: { downShare: 0.1, years: 7 } };
  const s2 = await drawRvb(p);
  assert.equal(s2.root.querySelector('[name="years"]').closest("label").querySelector(".help"), null, "a saved figure is the person's: no line");
});
test("C9 no guesses (another country, or no ctx.guess): the example figures as before", async () => {
  const eur = renterDebtPlan(); eur.meta.currency = "EUR";
  for (const { root, textOf } of [await drawRvb(eur), await drawRvb(renterDebtPlan(), { guess: false })]) {
    assert.equal(boxOf(root, "price").value, "400,000");
    assert.match(textOf(root), /These are example figures/);
    assert.doesNotMatch(textOf(root), /Our guess/);
  }
});
