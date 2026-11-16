import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, monthlyCost, priceFor, priceForCash, solveMonths, DEFAULTS, FRONT, BACK, isHouseGoal, houseGoalRank, findHouseGoal } from "./compute.js";
import { pmt, pmtToReach } from "../../../core/math/finance.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withHouse = (h, goals) => { const p = familyPlan(TODAY); p.whatIfs = { house: h }; if (goals) p.goals = goals; return p; };

test("the monthly cost and the price a budget buys are inverses", () => {
  const x = { ...DEFAULTS };
  near(monthlyCost(400000, x), pmt(0.065 / 12, 360, 320000) + 400000 * (0.011 + 0.0035) / 12);
  near(monthlyCost(priceFor(3000, x), x), 3000, 1e-6);
  near(monthlyCost(priceFor(3000, { ...x, hoaMonthly: 200 }), { ...x, hoaMonthly: 200 }), 3000, 1e-6);
});

test("months to save: deposits plus growth, none needed when already there, never without saving", () => {
  assert.equal(solveMonths(0, 0, 100, 1000), 10); assert.equal(solveMonths(0.01, 5000, 0, 1000), 0); assert.equal(solveMonths(0, 0, 0, 1000), Infinity);
});

test("the family: the lenders' limits on their income and other debts, the cash needed, the monthly to buy by a date", () => {
  const d = compute(withHouse({ price: 450000, targetDate: "2029-06-01" }), { today: TODAY });
  assert.equal(d.grossMonthly, 14250); near(d.maxFront, 14250 * FRONT);
  assert.equal(d.otherDebtMonthly, 400 + 410, "the card and the car, not the mortgage");
  near(d.maxBack, 14250 * BACK - 810); assert.equal(d.rule, "front");
  near(monthlyCost(d.maxPrice, d.inputs), d.maxFront, 1e-6);
  near(d.cash.down, 90000); near(d.cash.closing, 13500); near(d.cash.reserves, d.monthly * 2);
  near(d.neededMonthly, pmtToReach(0.02 / 12, 31, d.cash.total, 0), 1e-6);
  assert.equal(d.monthsToGo, null);
});

test("the house goal is a down payment or a home, never work on a home you have (Make it a goal must not overwrite it)", () => {
  for (const n of ["House down payment", "Down-payment fund", "New home fund", "Saving for a house", "Home", "Down payment", "Townhouse fund", "Townhome savings", "Homebuying fund", "Homeownership fund", "Farmhouse", "Condo fund", "Buy a house"]) assert.equal(isHouseGoal({ name: n }), true, n);
  for (const n of ["Home repairs", "Home-repairs", "Repairs on the house", "Home office", "Homeschool", "Home insurance", "House renovation", "Home remodel", "Paint the house", "Pay off the house early", "Mortgage-free home", "Trip home for Christmas", "Home for the holidays", "Home gym", "Beach house rental", "Housewarming party", "Warehouse", "Greenhouse", "Homecoming", "Car down payment", "Car", ""]) assert.equal(isHouseGoal({ name: n }), false, n);
  assert.equal(isHouseGoal({ name: "Nest", icon: "🏠" }), true, "the icon Make it a goal uses");
  assert.equal(isHouseGoal({ name: "Home repairs", icon: "🏠" }), false, "the icon does not rescue a repairs goal");
  const d = compute(withHouse({ price: 400000 }, [{ id: "r", name: "Home repairs", target: 5000, targetDate: "2027-01-01", saved: 1000, monthly: 100, priority: 2, fundedBy: [] }]), { today: TODAY });
  assert.equal(d.goal, null, "a repairs goal is not offered for update");
});
test("with several house goals the clearest wins: a down payment, then the icon or buying, then a name", () => {
  assert.deepEqual(["House down payment", "Homebuying fund", "Our home", "Pay off the house"].map((name) => houseGoalRank({ name })), [3, 2, 1, 0]);
  assert.equal(findHouseGoal([{ name: "Our home" }, { name: "House down payment" }]).name, "House down payment");
  assert.equal(findHouseGoal([{ name: "Our home" }, { name: "Townhouse fund" }]).name, "Our home", "the first of equals");
  assert.equal(findHouseGoal([{ name: "Home remodel" }, { name: "Car" }]), null);
  const g = (id, name, saved) => ({ id, name, target: 100000, targetDate: "2030-01-01", saved, monthly: 100, priority: 2, fundedBy: [] });
  const d = compute(withHouse({ price: 400000 }, [g("a", "Home remodel", 2000), g("b", "Our home", 9000), g("c", "House down payment", 30000)]), { today: TODAY });
  assert.equal(d.goal.id, "c", "the down payment, not the remodel listed first");
});
test("a house goal on Goals supplies what is set aside and saved; entered figures win; warnings", () => {
  const goals = [{ id: "g", name: "New home fund", target: 100000, targetDate: "2030-01-01", saved: 20000, monthly: 2000, priority: 2, fundedBy: [] }];
  const d = compute(withHouse({ price: 400000 }, goals), { today: TODAY });
  assert.equal(d.goal.id, "g"); assert.equal(d.saved, 20000); assert.equal(d.monthlySaving, 2000); assert.equal(d.target, "2030-01-01");
  assert.equal(d.monthsToGo, solveMonths(0.02 / 12, 20000, 2000, d.cash.total));
  assert.ok(/^\d{4}-\d{2}$/.test(d.readyDate));
  const e = compute(withHouse({ price: 400000, saved: 200000 }, goals), { today: TODAY });
  assert.equal(e.monthsToGo, 0);
  const w = compute(withHouse({ price: 2000000, downShare: 0.1 }), { today: TODAY });
  assert.equal(w.warnings.length, 2);
  assert.equal(compute(emptyPlan(), { today: TODAY }).maxPrice, null);
});
test("priceForCash: the price whose down payment, closing costs and reserves add up to the cash", () => {
  const x = { ...DEFAULTS, hoaMonthly: 150 };
  const price = priceForCash(60000, x);
  const cash = price * x.downShare + price * x.closingShare + monthlyCost(price, x) * x.reserveMonths;
  assert.ok(Math.abs(cash - 60000) < 0.01, `${cash}`);
  assert.equal(priceForCash(0, { ...DEFAULTS }), 0);
});
test("never saved here, with a house goal: the page opens on the home the goal buys, and quotes the Goals page's monthly figure", async () => {
  const { compute: goals } = await import("../goals/compute.js");
  const p = familyPlan(TODAY);
  p.goals.push({ id: "gh", name: "House down payment", icon: "🏠", target: 50000, targetDate: "2029-11-01", saved: 0, monthly: 0, fundedBy: [], priority: 2 });
  delete p.whatIfs?.house;
  const d = compute(p, { today: TODAY });
  assert.equal(d.fromGoal, true); assert.equal(d.goalTarget, 50000);
  assert.equal(d.inputs.price, Math.round(priceForCash(50000, d.inputs) / 1000) * 1000);
  assert.ok(Math.abs(d.cash.total - 50000) < 500, "about the goal's amount (the price is rounded to $1,000)");
  assert.equal(d.neededMonthly, goals(p, { today: TODAY }).goals.find((g) => g.id === "gh").neededMonthly);
  p.whatIfs = { ...(p.whatIfs ?? {}), house: { price: 300000 } };
  const own = compute(p, { today: TODAY });
  assert.equal(own.fromGoal, false); assert.equal(own.inputs.price, 300000, "the person's own figures win once saved");
});
test("a house goal with no date: no monthly figure (not $0 a month)", () => {
  const p = familyPlan(TODAY);
  p.goals.push({ id: "gh", name: "House down payment", icon: "🏠", target: 50000, targetDate: "", saved: 0, monthly: 0, fundedBy: [], priority: 2 });
  delete p.whatIfs?.house;
  const d = compute(p, { today: TODAY });
  assert.equal(d.fromGoal, true);
  assert.equal(d.neededMonthly, null);
});

// ---- our guesses in the boxes (smart guesses C9, spec 12.1 K3): gray figures counted while a box is empty, never saved
import { estimators, PREVIEWED, guessedWords, previewText, typicalPrice, newLoanRate, taxShare, insuranceShare, placeOf, previewsOf } from "./compute.js";
import { estimate, checkEstimators } from "../../../core/estimate/index.js";
import { TABLES } from "../../overview/guesses/compute.js";
import { T as HOME_T } from "../../overview/guesses/data/home.js";
import { T as SPEND_T } from "../../overview/guesses/data/spend.js";
import { T as PURCHASE_T } from "../../overview/guesses/data/purchase.js";
import { STATES as STATES_ALL } from "../../overview/guesses/data/index.js";
import { compute as planOf } from "../../overview/plan/compute.js";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
import { migrate } from "../../../core/schema/migrate.js";

const T13 = "2026-11-13";
const OPTS = { estimators, tables: TABLES, today: T13 };
const tcell = (t, row, c) => t.rows[row][t.cols.indexOf(c)];
const ohio = () => { const p = renterDebtPlan(); assert.equal(p.household.state, "OH"); return p; };
const noState = () => { const p = migrate(emptyPlan()); return p; };

test("C9 estimators: the contract holds, and every key reads only tables the guesses module bundles", () => {
  assert.deepEqual(checkEstimators(estimators), []);
  assert.deepEqual(Object.keys(estimators).sort(), PREVIEWED.map((k) => `goals/house:${k}`).sort());
  for (const k of Object.keys(estimators)) {
    const e = estimate(ohio(), k, { ...OPTS, args: { price: 250000 } });
    assert.ok(e, k);
    for (const id of e.tables) assert.ok(TABLES[id], `${k}: ${id}`);
    assert.ok(e.why.length <= 70, `${k}: "${e.why}" is ${e.why.length} characters`);
  }
});
test("C9 goals/house:price: the state's median home value (ACS 2025), in 2025 prices, to two figures (R11)", () => {
  const oh = tcell(HOME_T.acs2025_median_home_value_by_state, "value", "OH"), us = tcell(HOME_T.acs2025_median_home_value_by_state, "value", "US");
  assert.equal(oh, 254100); assert.equal(us, 371100);
  assert.equal(typicalPrice("OH"), 254100, "2025 dollars: aged by nothing (the CPI table ends in 2025)");
  const e = estimate(ohio(), "goals/house:price", OPTS);
  assert.deepEqual([e.value, e.why, e.unit], [250000, "a typical Ohio home", "total"]);
  const n = estimate(noState(), "goals/house:price", OPTS);
  assert.deepEqual([n.value, n.why, n.sharperWith.map((x) => x.label)], [370000, "a typical U.S. home", ["your state"]]);
  assert.equal(placeOf(ohio()), "Ohio"); assert.equal(placeOf(noState()), "the U.S.");
});
test("C9 goals/house:rate: Freddie Mac's average 30-year rate of the newest year in the table, to a tenth of a point", () => {
  const row = PURCHASE_T.pmms30_annual_average_by_year;
  assert.equal(row.cols.at(-1), "2026"); assert.equal(row.rows["30-year fixed"].at(-1), 6.53);
  assert.deepEqual(newLoanRate(), { rate: 0.0653, year: 2026 });
  const e = estimate(ohio(), "goals/house:rate", OPTS);
  assert.deepEqual([e.value, e.why], [0.065, "the average new 30-year rate so far this year"]);
  assert.equal(estimate(ohio(), "goals/house:rate", { ...OPTS, today: "2027-02-01" }).why, "the average new 30-year rate in 2026", "a later year names the table's year");
});
test("C9 goals/house:taxRate: the state's median property tax over its median value (ACS 2025), to a hundredth of a point", () => {
  const t = HOME_T.acs2025_effective_property_tax_rate_by_state;
  assert.equal(tcell(t, "median taxes / median value", "OH"), 1.223);
  near(taxShare("OH"), 0.01223, 1e-12);
  const e = estimate(ohio(), "goals/house:taxRate", OPTS);
  assert.deepEqual([e.value, e.why], [0.0122, "Ohio homes pay about 1.22% of their value a year"]);
  const n = estimate(noState(), "goals/house:taxRate", OPTS);
  assert.deepEqual([n.value, n.why], [0.009, "U.S. homes pay about 0.9% of their value a year"]);
  // critic e9 F5: a tenth of a point was up to 13% off in low-tax states (Hawaii 0.265% read 0.3%, West Virginia 0.513% read
  // 0.5%, Texas 1.322% read 1.3%); a hundredth keeps every state within 2% of its table
  for (const [st, table] of [["HI", 0.265], ["WV", 0.513], ["TX", 1.322]]) {
    assert.equal(tcell(t, "median taxes / median value", st), table);
    const p = ohio(); p.household.state = st;
    const v = estimate(p, "goals/house:taxRate", OPTS).value;
    assert.ok(Math.abs(v * 100 - table) / table < 0.02, `${st}: ${v} against ${table}%`);
  }
  for (const k of STATES_ALL) { const p = ohio(); p.household.state = k; const v = estimate(p, "goals/house:taxRate", OPTS)?.value; const tv = tcell(t, "median taxes / median value", k); if (v !== undefined && tv > 0) assert.ok(Math.abs(v * 100 - tv) <= 0.005 + 1e-9, `${k}: ${v} against ${tv}%`); }
});
test("C9 goals/house:insuranceRate: the guesses module's home insurance for a home at this price, over the price, to a hundredth of a point", () => {
  const prem = tcell(SPEND_T.naic2023_homeowners_premium_by_state, "HO-3", "OH"), typ = tcell(HOME_T.acs2025_median_home_value_by_state_and_mortgage_status, "all owners", "OH");
  assert.deepEqual([prem, typ], [1116, 254100]);
  // NAIC 2023 HO-3 average x CPI 2023->2025, scaled by the price over the state's typical home: a share of value that does not
  // depend on the price (until the $350 floor)
  const cpi = 1.057021924231;
  near(insuranceShare("OH", 250000), prem * cpi / typ, 1e-9);
  near(insuranceShare("OH", null), prem * cpi / typ, 1e-9);
  const e = estimate(ohio(), "goals/house:insuranceRate", { ...OPTS, args: { price: 250000 } });
  assert.deepEqual([e.value, e.why], [0.0046, "typical home insurance in Ohio, as a share of the price"]);
  assert.equal(estimate(noState(), "goals/house:insuranceRate", OPTS).value, 0.0049);
  // a cheap home reaches the $350 floor: a bigger share of its value
  near(insuranceShare("OH", 20000), 350 / 20000, 1e-9);
});
test("C9 the gate: no U.S. figure for a plan in another currency or outside the U.S.", () => {
  const eur = ohio(); eur.meta.currency = "EUR";
  for (const k of Object.keys(estimators)) assert.equal(estimate(eur, k, OPTS), null, k);
  const away = ohio(); away.guide = { ...(away.guide ?? {}), setup: { ...(away.guide?.setup ?? {}), outsideUS: true } };
  for (const k of Object.keys(estimators)) assert.equal(estimate(away, k, OPTS), null, k);
});
test("C9 invariance: with previews: null the answer is exactly as before (no new key; empty boxes count DEFAULTS)", () => {
  for (const p of [familyPlan(T13), renterDebtPlan(), retiredCouplePlan(T13), migrate(emptyPlan()), withHouse({ price: 300000, rate: null, taxRate: null })]) {
    const a = compute(p, { today: T13, previews: null });
    assert.equal("previewed" in a, false, "no new key without previews");
    assert.deepEqual(compute(p, { today: T13, previews: false }), a);
    const { previewed, ...b } = compute(p, { today: T13, previews: {} });
    assert.deepEqual(previewed, []); assert.deepEqual(b, a, "previews with no figures change nothing");
  }
  const d = compute(withHouse({ price: 300000, rate: null, taxRate: null }), { today: T13, previews: null });
  assert.deepEqual([d.inputs.price, d.inputs.rate, d.inputs.taxRate, d.inputs.insuranceRate], [300000, DEFAULTS.rate, DEFAULTS.taxRate, DEFAULTS.insuranceRate]);
});
test("C9 (critic e9 F1) compute() counts our guesses itself, as ctx.guess gives them, so every page that quotes it agrees", async () => {
  const OWN = (p, today = T13) => { const est = (k, o = {}) => estimate(p, k, { ...OPTS, today, ...o })?.value ?? null; const price = est("goals/house:price"); return { price, rate: est("goals/house:rate"), taxRate: est("goals/house:taxRate"), insuranceRate: est("goals/house:insuranceRate", { args: { price } }) }; };
  for (const p of [familyPlan(T13), renterDebtPlan(), retiredCouplePlan(T13), migrate(emptyPlan())]) {
    delete p.whatIfs;
    // left out, the previews are our own: exactly what the shell's ctx.guess gives the page (the merged registry and tables)
    assert.deepEqual(compute(p, { today: T13 }), compute(p, { today: T13, previews: OWN(p) }));
    assert.deepEqual(Object.fromEntries(Object.entries(previewsOf(p, { today: T13 })).map(([k, e]) => [k, e.value])), OWN(p));
  }
  // another currency or outside the U.S.: no guess, the example figures (as before C9)
  const eur = ohio(); eur.meta.currency = "EUR"; delete eur.whatIfs;
  assert.deepEqual(previewsOf(eur, { today: T13 }), {});
  assert.deepEqual(compute(eur, { today: T13 }), { ...compute(eur, { today: T13, previews: null }), previewed: [] });
  // Your plan's "home" row quotes the figure the House page shows (it said $636,884 against the page's $575,629 for the family)
  for (const p0 of [familyPlan(T13), renterDebtPlan(), retiredCouplePlan(T13)]) {
    const p = structuredClone(p0); delete p.whatIfs;
    p.goals = [...(p.goals ?? []), { id: "gh", name: "Our first home", icon: "🏠", target: null, targetDate: "", saved: 0, monthly: 0, fundedBy: [], priority: 2 }];
    const row = planOf(p, { today: T13 }).groups.flatMap((g) => g.rows).find((r) => r.key === "home");
    assert.ok(row && row.status !== "open", `${p.household.state}: a home row`);
    const d = compute(p, { today: T13 });
    assert.equal(row.figure, d.maxPrice);
    assert.notEqual(Math.round(d.maxPrice), Math.round(compute(p, { today: T13, previews: null }).maxPrice), "the example figures give another answer: the test can tell");
    const { root, textOf } = await drawHouse(p);
    const want = "$" + (Math.round(d.maxPrice / 10) * 10).toLocaleString("en-US"), t = textOf(root).replace(/​/g, "").replace(/\s+/g, " ");
    assert.ok(t.includes(`${want} Up to about`), `the page draws the same answer: ${want} in ${t.slice(t.indexOf("Up to") - 20, t.indexOf("Up to") + 20)}`);
  }
});
test("C9 (critic e9 F4) opened from the house goal: our insurance is a share of the goal's price, the one it is counted on", () => {
  // West Virginia, a goal of $8,000: the cash buys a $33,000 home, where the $350 floor makes insurance a bigger share than at
  // our typical West Virginia price (it was worked at the typical price and counted on the goal's)
  const p = familyPlan(T13); p.household.state = "WV"; delete p.whatIfs;
  p.goals.push({ id: "gh", name: "House down payment", icon: "🏠", target: 8000, targetDate: "2029-11-01", saved: 0, monthly: 0, fundedBy: [], priority: 2 });
  const d = compute(p, { today: T13 });
  assert.equal(d.fromGoal, true);
  assert.deepEqual(d.previewed, ["rate", "taxRate", "insuranceRate"]);
  const atGoal = previewsOf(p, { today: T13, price: d.inputs.price }).insuranceRate.value, atTypical = previewsOf(p, { today: T13 }).insuranceRate.value;
  assert.notEqual(atGoal, atTypical, "the floor bites at this price");
  assert.equal(d.inputs.insuranceRate, atGoal);
  assert.equal(d.inputs.price, Math.round(priceForCash(8000, d.inputs) / 1000) * 1000, "the price is the one the goal buys with that share");
  // a usual goal: the share is the same at both prices, nothing moves
  const q = familyPlan(T13); q.household.state = "WV"; delete q.whatIfs;
  q.goals.push({ id: "gh", name: "House down payment", icon: "🏠", target: 80000, targetDate: "2029-11-01", saved: 0, monthly: 0, fundedBy: [], priority: 2 });
  assert.equal(compute(q, { today: T13 }).inputs.insuranceRate, previewsOf(q, { today: T13 }).insuranceRate.value);
});
test("C9 previews count only in empty boxes: a figure the person typed wins; the goal's price wins over ours", () => {
  const pv = { price: 250000, rate: 0.065, taxRate: 0.0122, insuranceRate: 0.0046 };
  const blank = compute(ohio(), { today: T13, previews: pv });
  assert.deepEqual(blank.previewed, ["price", "rate", "taxRate", "insuranceRate"]);
  assert.deepEqual([blank.inputs.price, blank.inputs.rate, blank.inputs.taxRate, blank.inputs.insuranceRate], [250000, 0.065, 0.0122, 0.0046]);
  // the answer is worked out with them: 20% down on $250,000 at 6.5% for 30 years, plus 1.22% and 0.46% of the value a year
  near(blank.monthly, pmt(0.065 / 12, 360, 200000) + 250000 * (0.0122 + 0.0046) / 12, 1e-9);
  near(blank.cash.total, 50000 + 7500 + 2 * blank.monthly, 1e-9);
  const typed = compute(withHouse({ price: 300000, rate: 0.07, taxRate: null, insuranceRate: "" }), { today: T13, previews: pv });
  assert.deepEqual(typed.previewed, ["taxRate", "insuranceRate"], "typed price and rate are the person's");
  assert.deepEqual([typed.inputs.price, typed.inputs.rate, typed.inputs.taxRate], [300000, 0.07, 0.0122]);
  // never saved here, with a house goal: the price is the one the goal buys, worked out with our rate, tax and insurance
  const p = familyPlan(T13);
  p.goals.push({ id: "gh", name: "House down payment", icon: "🏠", target: 50000, targetDate: "2029-11-01", saved: 0, monthly: 0, fundedBy: [], priority: 2 });
  delete p.whatIfs?.house;
  const fg = compute(p, { today: T13, previews: pv });
  assert.equal(fg.fromGoal, true);
  assert.deepEqual(fg.previewed, ["rate", "taxRate", "insuranceRate"], "the price is the goal's, not ours");
  assert.equal(fg.inputs.price, Math.round(priceForCash(50000, fg.inputs) / 1000) * 1000);
  // a preview that is not a finite number is no preview
  assert.deepEqual(compute(ohio(), { today: T13, previews: { price: NaN, rate: "0.06", taxRate: null } }).previewed, []);
});
test("C9 the sentence that says which figures are our guesses, for one, two and four of them; none says nothing", () => {
  assert.equal(guessedWords([]), "");
  assert.equal(guessedWords(undefined), "");
  assert.equal(guessedWords(["price"]), "Our guess for now: the price.");
  assert.equal(guessedWords(["price", "rate"]), "Our guesses for now: the price and the rate.");
  assert.equal(guessedWords(["price", "rate", "taxRate", "insuranceRate"]), "Our guesses for now: the price, the rate, property tax and insurance.");
  assert.equal(guessedWords(["rate", "rentMonthly", "price"]), "Our guesses for now: the price, the rent and the rate.", "always in the order of the boxes");
});
test("C9 a gray figure is written as the person would type it", () => {
  assert.equal(previewText(250000, "money"), "250,000");
  assert.equal(previewText(0.065, "percent"), "6.5");
  assert.equal(previewText(0.0046, "percent"), "0.46");
  assert.equal(previewText(0.012, "percent"), "1.2");
  assert.equal(previewText(null, "money"), "");
});

// ---- the page (drawn on the stand-in DOM, with ctx.guess as the shell gives it)
async function drawHouse(plan0, { guess = true } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const p = migrate(structuredClone(plan0)); const saved = []; const root = new FakeElement("main");
  const ctx = { ui, fmt: { ...fmt, today: () => T13 }, plan: p, route: { rest: [], query: {} }, module: { group: "goals", id: "house" }, computeOf: () => null,
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } },
    ...(guess ? { guess: (k, o = {}) => estimate(p, k, { ...OPTS, ...o }) } : {}) };
  render(root, ctx);
  return { root, saved, textOf, plan: p };
}
const boxOf = (root, name) => root.querySelector(`[name="${name}"]`);
const openParts = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));
const outsideShut = (el) => { for (let a = el.parentNode; a; a = a.parentNode) if (a.tagName === "DETAILS" && !a.hasAttribute("open") && !(el.closest?.("summary"))) return false; return true; };

test("C9 the page: empty boxes show our gray figures, the answer counts them, the line says so, and opening writes nothing", async () => {
  const { root, saved, textOf } = await drawHouse(ohio());
  assert.equal(saved.length, 0, "opening the page writes nothing");
  assert.equal(boxOf(root, "price").value ?? "", "");
  assert.equal(boxOf(root, "price").getAttribute("placeholder"), "250,000");
  assert.equal(boxOf(root, "rate").getAttribute("placeholder"), "6.5");
  assert.equal(boxOf(root, "taxRate").getAttribute("placeholder"), "1.22");
  assert.equal(boxOf(root, "insuranceRate").getAttribute("placeholder"), "0.46");
  assert.equal(boxOf(root, "closingShare").getAttribute("placeholder"), "", "no example in a box: its help says what empty counts");
  const t = textOf(root);
  assert.match(t, /A \$250,000 home/);
  assert.match(t, /Our guess: a typical Ohio home\./);
  assert.match(t, /Our guess: the average new 30-year rate so far this year\./);
  assert.match(t, /Leave a box empty and we count the gray figure, what is typical for Ohio\./);
  const hero = root.querySelectorAll("p").find((x) => /^How much home your income supports/.test(textOf(x)));
  assert.ok(hero && outsideShut(hero), "while nothing is saved, the hero says the gray figures count, outside any fold");
  assert.doesNotMatch(t, /Our guesses for now/, "the line waits for a save (the hero says it)");
  // once saved with the boxes left empty: the line under the answer names them, outside the shut figures
  const p = ohio(); p.whatIfs = { ...(p.whatIfs ?? {}), house: { price: null, rate: null, taxRate: null, insuranceRate: null, downShare: 0.2 } };
  const sv = await drawHouse(p);
  await drawHouse(p);
  const s2 = await drawHouse(p);
  const line = s2.root.querySelectorAll("p").find((x) => s2.textOf(x) === "Our guesses for now: the price, the rate, property tax and insurance.");
  assert.ok(line && outsideShut(line), "the line naming our guesses is never folded away");
  assert.equal(sv.saved.length, 0);
  assert.match(textOf(root), /Left empty, we count 3% of the price/);
});
test("C9 S11 (R17): Work it out with the boxes left empty saves no guess, and only The figures stays open", async () => {
  const a = await drawHouse(ohio());
  assert.deepEqual(openParts(a.root), { figures: true }, "asks first: The figures is open until the page has an answer");
  boxOf(a.root, "rate").value = "";
  boxOf(a.root, "price").closest("form").dispatch("submit");
  assert.equal(a.saved.length, 1);
  const h = a.saved[0].whatIfs.house;
  assert.deepEqual([h.price, h.rate, h.taxRate, h.insuranceRate, h.closingShare, h.termYears], [null, null, null, null, null, null], "an empty box saves nothing: our figure is never written");
  assert.equal(h.downShare, 0.2, "a box that showed a figure saves it");
  assert.equal(a.saved[0].guesses, undefined, "no guess entry either");
  const b = await drawHouse(a.saved[0]);
  assert.deepEqual(openParts(b.root), { figures: true }, "the part just saved stays open, no other moves");
  assert.equal(boxOf(b.root, "price").getAttribute("placeholder"), "250,000", "reopened: still empty and gray");
  assert.match(b.textOf(b.root), /Saved\. A \$250,000 home: about \$\d/);
  const c = await drawHouse(a.saved[0]);
  assert.deepEqual(openParts(c.root), { figures: false }, "the next visit opens on the answer, the figures folded");
  // the person types a price: it is theirs, and the gray figure for it is gone
  boxOf(c.root, "price").value = "300000";
  boxOf(c.root, "price").closest("form").dispatch("submit");
  assert.equal(c.saved[0].whatIfs.house.price, 300000);
  const e = await drawHouse(c.saved[0]);
  assert.equal(boxOf(e.root, "price").value, "300,000");
  assert.equal(boxOf(e.root, "price").getAttribute("placeholder") ?? "", "");
  assert.match(e.textOf(e.root), /Our guesses for now: the rate, property tax and insurance\./);
});
test("C9 no guesses (another country, or outside the U.S.): the page is as before, the example figures in the boxes", async () => {
  const eur = ohio(); eur.meta.currency = "EUR";
  const away = ohio(); away.guide = { ...(away.guide ?? {}), setup: { ...(away.guide?.setup ?? {}), outsideUS: true } };
  for (const { root, textOf } of [await drawHouse(eur), await drawHouse(away)]) {
    assert.equal(boxOf(root, "price").value, "400,000");
    assert.match(textOf(root), /The figures below are an example: put in the home you have in mind\./);
    assert.doesNotMatch(textOf(root), /Our guess/);
  }
  // the page no longer leans on ctx.guess for its figures (compute counts them): a shell without it draws the same page
  const a = await drawHouse(ohio()), b = await drawHouse(ohio(), { guess: false });
  assert.equal(b.textOf(b.root), a.textOf(a.root));
});
test("C9 (critic e9 P2, P8) a figure nobody typed says where it comes from, and every help line starts as a sentence", async () => {
  const { root, textOf } = await drawHouse(ohio());
  const helpOf = (name) => textOf(boxOf(root, name).closest("label").querySelector(".help"));
  assert.equal(boxOf(root, "downShare").value, "20");
  assert.equal(helpOf("downShare"), "We start at 20%, which avoids mortgage insurance.");
  assert.equal(helpOf("saved"), "Left empty, we use the Goals page's house goal.");
  assert.equal(helpOf("monthly"), "Left empty, we use the house goal's monthly amount.");
  for (const h of root.querySelectorAll(".help")) assert.match(textOf(h), /^[A-Z0-9]/, `"${textOf(h)}" starts in lower case`);
  // once saved, the box holds the person's figure: the help no longer says we started it
  const p = ohio(); p.whatIfs = { house: { downShare: 0.1 } };
  const s = await drawHouse(p);
  assert.equal(s.textOf(boxOf(s.root, "downShare").closest("label").querySelector(".help")), "20% avoids mortgage insurance.");
});

// ---------------------------------------------------------------- share a link (gap list, next 60, item 33)
// "Share these figures" builds a link with the home's own figures only; opened on another phone it fills this page for the
// visit, and only "Keep these" (asked first, with Undo) writes the plan. The helper's own rules: tests/share-link.test.mjs.
import { parse } from "../../../core/router.js";
import { SHARE_SPEC, shareWords } from "./view.js";
import { readShare, shareText, withShared, planWith, BANNER, UNREAD, OWN_AGAIN, VISIT_TAIL, NO_LINK, filledWords, keepAsk } from "../../../core/share-link.js";

const HOME = { price: 420000, downShare: 0.1, rate: 0.0625, closingShare: 0.03, termYears: 30, taxRate: 0.012, insuranceRate: 0.004, hoaMonthly: 150, reserveMonths: 3 };
/** A sender's plan full of invented names, places, an employer, notes and odd balances, with a home typed on this page. */
function busySender() {
  const p = familyPlan(T13);
  p.household = { ...(p.household ?? {}), name: "Quillfeather household", state: "OR", city: "Marrowdale", employer: "Brightnook Widgets" };
  p.household.people = (p.household.people ?? []).map((x, i) => ({ ...x, name: ["Ottoline Quill", "Barnaby Quill", "Cressida Quill"][i] ?? x.name, email: "quill@example.org" }));
  p.accounts = p.accounts.map((a, i) => ({ ...a, name: `Thornbury account ${i}`, institution: "Larkspur Credit Union", number: "4417", balance: 52345.67 + i }));
  p.pageNotes = { "goals/house": "the cottage on Wren Lane, ask Aunt Philippa" };
  p.whatIfs = { house: { ...HOME, saved: 47321, monthly: 1733, targetDate: "2028-06-01" } };
  return p;
}
const PLANTED = ["Quillfeather", "Marrowdale", "Brightnook", "Ottoline", "Barnaby", "Cressida", "quill@", "Thornbury", "Larkspur", "4417", "52345", "Wren", "Philippa", "47321", "1733", "2028", "Ana", "Chase", "Fidelity"];

async function sharePage(plan0, { query = {}, confirm = true, guess = true } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  let cur = migrate(structuredClone(plan0));
  const pg = { saves: [], replaced: [], asked: [], errors: [], root: null, route: { group: "goals", id: "house", rest: [], query }, textOf };
  const store = { get: () => cur, update: (fn) => { const d = structuredClone(cur); fn(d); cur = d; pg.saves.push(d); } };
  pg.draw = () => {
    pg.root = new FakeElement("main");
    render(pg.root, { ui: { ...ui, confirm: (q) => { pg.asked.push(q); return confirm; }, fieldError: (el, t) => { pg.errors.push([el?.getAttribute?.("name"), t]); return false; } }, fmt: { ...fmt, today: () => T13 }, plan: cur, route: pg.route, module: { group: "goals", id: "house" }, computeOf: () => null, store,
      redraw: () => pg.draw(), replace: (href) => { pg.replaced.push(href); pg.route = parse(href); pg.draw(); },
      ...(guess ? { guess: (k, o = {}) => estimate(cur, k, { ...OPTS, ...o }) } : {}) });
    return pg;
  };
  pg.plan = () => cur;
  pg.text = () => textOf(pg.root);
  pg.button = (label) => pg.root.all().find((e) => e.tagName === "BUTTON" && textOf(e) === label);
  pg.banner = () => pg.root.all().find((e) => e.dataset?.shared !== undefined) ?? null;
  pg.part = (id) => pg.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  pg.share = async () => { pg.button("Share these figures").click(); await new Promise((r) => setTimeout(r, 0)); return textOf(pg.root.all().find((e) => e.dataset?.shareLink !== undefined)); };
  return pg.draw();
}
const houseOf = (p) => p.whatIfs?.house;

test("share: the round trip; the link holds the home's figures only, and the other phone's answer is this page's compute() on them", async () => {
  const a = await sharePage(busySender());
  assert.ok(a.part("figures") && !a.part("figures").hasAttribute("open"), "the share sits inside the shut figures");
  assert.match(a.textOf(a.part("figures")), /Work it out Only these figures go in the link; nothing is sent until you send it\. Share these figures$/, "one short line before the tap (critic P4)");
  const link = await a.share();
  assert.equal(link, "#/goals/house?share=price:420000,down:10,rate:6.25,closing:3,term:30,tax:1.2,insurance:0.4,hoa:150,reserve:3");
  // no share menu and no clipboard in a test: to be copied by hand; every box goes, but the household's own savings and
  // date stay on this phone, so the other phone's "when" is its own (critic P1)
  assert.match(a.text(), /Copy this link and paste it into a message\. It carries the price, the down payment and 7 more figures, nothing else\. The other phone fills in the rest with its own figures, so its answer can differ\. #\/goals/);
  assert.equal(a.saves.length, 0, "sharing writes nothing");
  for (const w of PLANTED) assert.ok(!link.includes(w), `the link holds ${w}`);
  const route = parse(link);
  assert.deepEqual(Object.keys(route.query), ["share"]);
  // another household opens it: the page is the link's home, with that household's own income, debts and savings
  const other = renterDebtPlan();
  const b = await sharePage(other, { query: route.query });
  assert.equal(b.saves.length, 0, "opening a link writes nothing");
  assert.ok(b.banner(), "the banner shows");
  assert.match(b.textOf(b.banner()), /^Figures from a shared link: nothing in your plan has changed\. The link filled in 9 figures on this page\. Keep these Back to my own figures$/, "every box filled, nothing of this phone's own: no line about the rest");
  assert.ok(b.part("figures").hasAttribute("open"), "The figures is open while a link shows (critic P5)");
  const figs = readShare(SHARE_SPEC, route.query.share).figures;
  assert.deepEqual(figs, HOME);
  const typed = migrate(structuredClone(other)); typed.whatIfs = { ...(typed.whatIfs ?? {}), house: { ...HOME } };
  const want = compute(typed, { today: T13 });
  assert.equal(JSON.stringify(compute(planWith(migrate(structuredClone(other)), SHARE_SPEC, withShared(houseOf(migrate(structuredClone(other))), figs, SHARE_SPEC)), { today: T13 })), JSON.stringify(want));
  const money = (n) => `$${(Math.round(n / 10) * 10).toLocaleString("en-US")}`;
  assert.match(b.text(), new RegExp(`A \\${money(420000)} home`));
  assert.ok(b.text().includes(`${money(want.monthly)}`), "the monthly cost of the link's home");
  // the household's own savings, monthly saving and date are not boxes while the link shows (a link never carries them)
  assert.equal(b.root.querySelector('[name="saved"]'), null);
  assert.equal(b.root.querySelector('[name="targetDate"]'), null);
  assert.ok(b.text().includes("Your savings stay your own: the link does not carry them."), "no line pointing at a box that is not drawn");
  assert.ok(!b.text().includes("enter what you save a month below"));
  assert.equal(b.button(`Make it a goal (${money(Math.round(want.cash.total / 100) * 100)})`), undefined, "no goal button while a link shows");
});

test("share: unknown and malicious keys are ignored and counted; the page never prints them", async () => {
  const ten = "9" + "0".repeat(9);
  const b = await sharePage(renterDebtPlan(), { query: { share: `price:400000,evil:1,__proto__:5,rate:<script>,down:500,constructor:1,price:${ten}` } });
  assert.equal(b.saves.length, 0);
  assert.match(b.textOf(b.banner()), /The link filled in 1 figure on this page; 6 could not be read and were left out\./);
  assert.ok(!/evil|script|__proto__|constructor/.test(b.text()));
  assert.match(b.text(), /A \$400,000 home/);
  assert.equal(({}).evil, undefined);
  // nothing readable: the person's own page, said once in blue
  for (const share of ["evil:1", "price:abc", "price:5,000", "", "x".repeat(500)]) {
    const c = await sharePage(renterDebtPlan(), { query: { share } });
    assert.equal(c.banner(), null, JSON.stringify(share));
    assert.ok(c.text().includes(UNREAD));
    assert.equal(c.saves.length, 0);
  }
});

test("share: nothing is saved without Keep; Keep asks, writes the page's own keys once, names the answer, and Undo puts it all back", async () => {
  const mine = renterDebtPlan(); mine.whatIfs = { house: { price: 250000, downShare: 0.2, rate: 0.07, saved: 9000, monthly: 400, targetDate: "2029-01-01", taxRate: 0.015 } };
  const before = JSON.stringify(migrate(structuredClone(mine)));
  const query = { share: "price:420000,down:10,rate:6.25" };
  // Back to my own figures: nothing saved, the page is the plan's again
  const a = await sharePage(mine, { query });
  a.button("Back to my own figures").click();
  assert.equal(a.saves.length, 0);
  assert.equal(a.banner(), null);
  assert.ok(a.text().includes(OWN_AGAIN));
  assert.match(a.text(), /A \$250,000 home/);
  // the page's own button while a link shows: worked out for this visit, in the address, nothing saved
  const b = await sharePage(mine, { query });
  b.root.querySelector('[name="price"]').value = "430000";
  b.root.querySelector('[name="price"]').closest("form").dispatch("submit");
  assert.equal(b.saves.length, 0, "Work it out on a shared link writes nothing");
  assert.equal(b.replaced.length, 1);
  // the household's own 1.5% property tax stood in its box (the link left it out) and goes on with the visit
  assert.match(b.replaced[0], /^#\/goals\/house\?share=price:430000,down:10,rate:6\.25,tax:1\.5$/);
  assert.ok(b.banner(), "still a shared link");
  const worked = b.root.querySelectorAll(".notice").map((n) => b.textOf(n)).find((t) => t.startsWith("Worked out for this visit"));
  assert.match(worked, /^Worked out for this visit: a \$430,000 home, about \$[\d,]+ a month\. Nothing in your plan has changed\.$/);
  assert.ok(b.part("figures").hasAttribute("open"), "The figures stays open for the next try");
  // Keep, refused at the question: nothing
  const c = await sharePage(mine, { query, confirm: false });
  c.button("Keep these").click();
  assert.deepEqual(c.asked, [keepAsk(SHARE_SPEC, readShare(SHARE_SPEC, query.share))]);
  assert.deepEqual(c.asked, ["Keep the price, the down payment and the mortgage rate in your plan? They take the place of yours on this page; your other figures stay as they are. Undo puts yours back."]);
  assert.equal(c.saves.length, 0);
  // Keep, accepted: one change, the three figures the link carried; the household's own tax, savings and date stay
  const d = await sharePage(mine, { query });
  const shown = d.text().match(/A \$420,000 home[^$]*\$[\d,]+/);
  d.button("Keep these").click();
  assert.equal(d.saves.length, 1);
  const h = houseOf(d.plan());
  assert.deepEqual(h, { price: 420000, downShare: 0.1, rate: 0.0625, saved: 9000, monthly: 400, targetDate: "2029-01-01", taxRate: 0.015 });
  const rest = (p) => { const q = structuredClone(p); delete q.whatIfs.house; delete q.meta; return JSON.stringify(q); };
  assert.equal(rest(d.plan()), rest(JSON.parse(before)), "nothing else in the plan moved");
  d.draw();
  assert.equal(d.banner(), null, "kept: the page is the plan's again");
  const kept = d.root.querySelectorAll(".notice").find((n) => /^Kept\./.test(d.textOf(n)));
  assert.match(d.textOf(kept), /^Kept\. A \$420,000 home: about \$[\d,]+ a month\. Undo$/);
  assert.ok(shown, "the shared answer was on the page");
  // Undo: the plan as it was
  d.root.all().find((e) => e.tagName === "BUTTON" && d.textOf(e) === "Undo").click();
  assert.equal(d.saves.length, 2);
  const back = structuredClone(d.plan()); const was = JSON.parse(before); delete back.meta; delete was.meta;
  assert.equal(JSON.stringify(back), JSON.stringify(was));
  d.draw();
  assert.ok(d.text().includes("Back to your own figures, as before."));
  // the plan already holds the link's figures: Keep says so and writes nothing
  const same = renterDebtPlan(); same.whatIfs = { house: withShared({}, { price: 420000, downShare: 0.1, rate: 0.0625 }, SHARE_SPEC) };
  const e = await sharePage(same, { query });
  e.button("Keep these").click();
  assert.equal(e.saves.length, 0);
  assert.ok(e.text().includes("Your plan already has these figures."));
});

test("share (critic F1): Keep keeps what the link carried; the visitor's own HOA and mortgage length stay, as the visit showed them", async () => {
  const mine = familyPlan(T13); mine.whatIfs = { house: { price: 300000, hoaMonthly: 50, termYears: 15 } };
  const a = await sharePage(mine, { query: { share: "price:500000,down:20" } });
  assert.equal(a.root.querySelector('[name="hoaMonthly"]').value, "50", "this phone's own HOA in its box during the visit");
  assert.match(a.textOf(a.banner()), /The link filled in 2 figures on this page\. The rest are your own figures and our guesses\./);
  const month = (p) => p.text().replace(/​/g, "").match(/A month\s*\$[\d,]+/)?.[0];
  const seen = month(a);
  a.button("Keep these").click();
  assert.deepEqual(houseOf(a.plan()), { price: 500000, hoaMonthly: 50, termYears: 15, downShare: 0.2 });
  a.draw();
  assert.equal(month(a), seen, "the kept page's monthly cost is the visit's");
});

test("share: a box emptied during the visit stays empty (not this phone's own figure again); a figure no link can hold is said at its box", async () => {
  const mine = renterDebtPlan(); mine.whatIfs = { house: { price: 250000, rate: 0.07 } };
  const a = await sharePage(mine, { query: { share: "price:420000" } });
  assert.equal(a.root.querySelector('[name="rate"]').value, "7");
  a.root.querySelector('[name="rate"]').value = "";
  a.root.querySelector('[name="price"]').closest("form").dispatch("submit");
  assert.equal(a.saves.length, 0);
  assert.match(a.replaced[0], /^#\/goals\/house\?share=price:420000,down:20,rate:$/, "the emptied rate goes as \"rate:\"");
  assert.equal(a.root.querySelector('[name="rate"]').value, "", "the box stays empty: our guess counts");
  assert.match(a.textOf(a.banner()), /The link filled in 2 figures on this page\. The rest are our guesses for you\./);
  a.button("Keep these").click();
  assert.equal(houseOf(a.plan()).rate, null, "kept as the visit showed it");
  // a price over the link's top: the page says so at the price box and the address is not touched
  const b = await sharePage(renterDebtPlan(), { query: { share: "price:420000" } });
  b.root.querySelector('[name="price"]').value = "200000000";
  b.root.querySelector('[name="price"]').closest("form").dispatch("submit");
  assert.equal(b.replaced.length, 0);
  assert.equal(b.saves.length, 0);
  assert.deepEqual(b.errors, [["price", NO_LINK]]);
  // nothing typed at all: "Type a figure first." at the price
  const c = await sharePage(renterDebtPlan(), { query: { share: "price:420000" } });
  for (const k of ["price", "downShare", "rate"]) c.root.querySelector(`[name="${k}"]`).value = "";
  c.root.querySelector('[name="price"]').closest("form").dispatch("submit");
  assert.equal(c.replaced.length, 0);
  assert.deepEqual(c.errors, [["price", "Type a figure first."]]);
});

test("share (critic F3): a saved figure a link cannot hold is named after the tap, never dropped in silence", async () => {
  const p = renterDebtPlan(); p.whatIfs = { house: { price: 2e8, downShare: 0.2 } };
  const a = await sharePage(p);
  const link = await a.share();
  assert.equal(link, "#/goals/house?share=down:20");
  assert.match(a.text(), /It carries the down payment, nothing else\. The price could not go in the link\. The other phone fills in the rest/);
});

test("share: the page's list carries the home's own figures, every one round-trips, never the household's savings or date", () => {
  assert.deepEqual(SHARE_SPEC.fields.map((f) => f.key), ["price", "downShare", "rate", "closingShare", "termYears", "taxRate", "insuranceRate", "hoaMonthly", "reserveMonths"]);
  assert.deepEqual(SHARE_SPEC.path, ["whatIfs", "house"]);
  for (const k of ["saved", "monthly", "targetDate"]) assert.ok(!SHARE_SPEC.fields.some((f) => f.key === k), k);
  assert.deepEqual(SHARE_SPEC.stays, ["saved", "monthly", "targetDate"], "the household's own, said as its own under the banner");
  assert.deepEqual(SHARE_SPEC.fields.map((f) => f.name), ["the price", "the down payment", "the mortgage rate", "the closing costs", "the mortgage length", "the property tax", "the home insurance", "the HOA fee", "the months kept in reserve"]);
  const all = Object.fromEntries(SHARE_SPEC.fields.map((f) => [f.key, f.unit === "percent" ? 0.0465 : f.unit === "whole" ? f.max : 1234.56]));
  assert.deepEqual(readShare(SHARE_SPEC, shareText(SHARE_SPEC, all)), { figures: all, used: 9, refused: 0 });
});
test("share: the sentences of each case", () => {
  const money = (n) => `$${n.toLocaleString("en-US")}`;
  assert.deepEqual(shareWords({ inputs: { price: 420000 }, monthly: 2890 }, money), { kept: "Kept. A $420,000 home: about $2,890 a month.", worked: "Worked out for this visit: a $420,000 home, about $2,890 a month." });
  assert.deepEqual(shareWords({ inputs: { price: 420000 }, monthly: null }, money), { kept: "Kept. A $420,000 home.", worked: "Worked out for this visit: a $420,000 home." });
  assert.equal(BANNER, "Figures from a shared link: nothing in your plan has changed.");
  assert.equal(filledWords(9), "The link filled in 9 figures on this page.");
  assert.equal(VISIT_TAIL, "Nothing in your plan has changed.");
});

test("share invariance: with no link the page is as before for every invented household: no banner, nothing written, the same answer", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const plans = [familyPlan(T13), renterDebtPlan(), retiredCouplePlan(T13), emptyPlan(), ...ARCHETYPES.map((x) => x.build())];
  for (const p0 of plans) {
    const p = migrate(structuredClone(p0));
    assert.equal(planWith(p, SHARE_SPEC, null), p, "no link: the plan itself");
    const a = await sharePage(p);
    assert.equal(a.banner(), null);
    assert.equal(a.saves.length, 0);
    assert.ok(!a.text().includes("Share these figures"), "nothing typed here: nothing to share");
    assert.ok(!a.text().includes(UNREAD));
    // another page's own query keys change nothing
    const b = await sharePage(p, { query: { from: "plan", show: "figures" } });
    assert.equal(b.text(), a.text());
  }
  // a typed home: the share is drawn, inside the shut figures only
  const t = await sharePage(busySender());
  const btn = t.button("Share these figures");
  let inShut = false; for (let x = btn.parentNode; x; x = x.parentNode) if (x.tagName === "DETAILS" && !x.hasAttribute("open")) inShut = true;
  assert.ok(inShut, "never on the first view");
});
