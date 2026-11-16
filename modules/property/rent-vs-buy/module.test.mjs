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
test("C9 a why that already ends with a stop gets no second one (no state: \"in the U.S.\")", async () => {
  const { root, textOf } = await drawRvb(migrate(emptyPlan()));
  const help = textOf(root.querySelector('[name="rentMonthly"]').closest("label"));
  assert.match(help, /Our guess: typical rent before utilities in the U\.S\.$/);
  assert.doesNotMatch(textOf(root), /U\.S\.\./);
});

// ---------------------------------------------------------------- share a link (gap list, next 60, item 33)
// "Share these figures" builds a link with the home's and the rent's own figures only; opened on another phone it fills
// this page for the visit, and only "Keep these" (asked first, with Undo) writes the plan. The helper: tests/share-link.test.mjs.
import { parse } from "../../../core/router.js";
import { SHARE_SPEC, shareWords } from "./view.js";
import { readShare, shareText, withShared, planWith, UNREAD, OWN_AGAIN, keepAsk } from "../../../core/share-link.js";

const WEIGH = { price: 450000, rentMonthly: 2400, downShare: 0.15, rate: 0.0599, years: 8, termYears: 30, taxRate: 0.011, insuranceRate: 0.0035, maintenanceRate: 0.01, hoaMonthly: 0, buyCosts: 0.03, sellCosts: 0.06, appreciation: 0.035, rentGrowth: 0.03, rentersInsurance: 180, investReturn: 0.05 };
function busySender() {
  const p = familyPlan(T13);
  p.household = { ...(p.household ?? {}), name: "Quillfeather household", city: "Marrowdale", employer: "Brightnook Widgets" };
  p.household.people = (p.household.people ?? []).map((x, i) => ({ ...x, name: ["Ottoline Quill", "Barnaby Quill", "Cressida Quill"][i] ?? x.name }));
  p.accounts = p.accounts.map((a, i) => ({ ...a, name: `Thornbury account ${i}`, institution: "Larkspur Credit Union", balance: 52345.67 + i }));
  p.pageNotes = { "property/rent-vs-buy": "the flat over the bakery, ask Aunt Philippa" };
  p.whatIfs = { rentVsBuy: { ...WEIGH, itemize: true, marginalRate: 0.37 } };
  return p;
}
const PLANTED = ["Quillfeather", "Marrowdale", "Brightnook", "Ottoline", "Barnaby", "Cressida", "Thornbury", "Larkspur", "52345", "bakery", "Philippa", "itemize", "marginal", "37", "Ana", "Chase"];

async function sharePage(plan0, { query = {}, confirm = true } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  let cur = migrate(structuredClone(plan0));
  const pg = { saves: [], replaced: [], asked: [], root: null, route: { group: "property", id: "rent-vs-buy", rest: [], query }, textOf };
  const store = { get: () => cur, update: (fn) => { const d = structuredClone(cur); fn(d); cur = d; pg.saves.push(d); } };
  pg.draw = () => {
    pg.root = new FakeElement("main");
    render(pg.root, { ui: { ...ui, confirm: (q) => { pg.asked.push(q); return confirm; } }, fmt: { ...fmt, today: () => T13 }, plan: cur, route: pg.route, module: { group: "property", id: "rent-vs-buy" }, computeOf: () => null, store,
      redraw: () => pg.draw(), replace: (href) => { pg.replaced.push(href); pg.route = parse(href); pg.draw(); },
      guess: (k, o = {}) => estimate(cur, k, { ...OPTS, ...o }) });
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
const money = (n) => `$${(Math.round(n / 10) * 10).toLocaleString("en-US")}`;

test("share: the page's list carries the home's and the rent's figures, every one round-trips, never the household's tax choices", () => {
  assert.deepEqual(SHARE_SPEC.fields.map((f) => f.key), Object.keys(WEIGH));
  assert.deepEqual(SHARE_SPEC.path, ["whatIfs", "rentVsBuy"]);
  for (const k of ["itemize", "marginalRate"]) assert.ok(!SHARE_SPEC.fields.some((f) => f.key === k), k);
  assert.deepEqual(readShare(SHARE_SPEC, shareText(SHARE_SPEC, WEIGH)), { figures: WEIGH, used: 16, refused: 0 });
});

test("share: the round trip; the link holds the page's figures only, and the other phone's answer is this page's compute() on them", async () => {
  const a = await sharePage(busySender());
  assert.ok(a.part("figures") && !a.part("figures").hasAttribute("open"), "the share sits inside the shut figures");
  const link = await a.share();
  assert.equal(link, "#/property/rent-vs-buy?share=price:450000,rent:2400,down:15,rate:5.99,stay:8,term:30,tax:1.1,insurance:0.35,upkeep:1,hoa:0,buying:3,selling:6,growth:3.5,rentup:3,renters:180,invest:5");
  assert.equal(a.saves.length, 0);
  for (const w of PLANTED) assert.ok(!link.includes(w), `the link holds ${w}`);
  const route = parse(link);
  const other = migrate(renterDebtPlan()); other.whatIfs = { ...(other.whatIfs ?? {}), rentVsBuy: { itemize: false, marginalRate: 0.12, price: 199000 } };
  const b = await sharePage(other, { query: route.query });
  assert.equal(b.saves.length, 0, "opening a link writes nothing");
  assert.match(b.textOf(b.banner()), /^Figures from a shared link: nothing in your plan has changed\. The link filled in 16 figures on this page\. The rest are your own figures\. Keep these Back to my own figures$/, "the 12% tax rate is this phone's own (critic F2)");
  assert.ok(b.part("figures").hasAttribute("open"), "The figures is open while a link shows: the visitor sees where to change one (critic P5)");
  // the link's 16 figures with this household's own tax choices: the page's compute() on them
  const typed = structuredClone(other); typed.whatIfs.rentVsBuy = { ...WEIGH, itemize: false, marginalRate: 0.12 };
  const want = compute(typed, { previews: { price: null, rentMonthly: null, rate: null, taxRate: null, insuranceRate: null } });
  const got = compute(planWith(other, SHARE_SPEC, withShared(other.whatIfs.rentVsBuy, readShare(SHARE_SPEC, route.query.share).figures, SHARE_SPEC)), { previews: { price: null, rentMonthly: null, rate: null, taxRate: null, insuranceRate: null } });
  assert.equal(JSON.stringify(got), JSON.stringify(want));
  assert.ok(b.text().includes(`A ${money(450000)} home with 15% down`));
  assert.ok(b.text().replace(/\u200b/g, "").includes(money(Math.abs(want.atEnd.ahead))), "the answer of the link's figures");
  assert.equal(b.root.querySelector('[name="itemize"]'), null, "the household's own tax choices are not boxes while the link shows");
  assert.equal(b.root.querySelector('[name="marginalRate"]'), null);
});

test("share: unknown and malicious keys are ignored and counted; nothing readable shows the person's own page", async () => {
  const b = await sharePage(renterDebtPlan(), { query: { share: "rent:1900,evil:1,__proto__:1,stay:99,price:-1" } });
  assert.match(b.textOf(b.banner()), /The link filled in 1 figure on this page; 4 could not be read and were left out\./);
  assert.ok(!/evil|__proto__/.test(b.text()));
  assert.equal(b.saves.length, 0);
  const c = await sharePage(renterDebtPlan(), { query: { share: "rent:abc" } });
  assert.equal(c.banner(), null);
  assert.ok(c.text().includes(UNREAD));
});

test("share: nothing is saved without Keep; Keep asks, writes the page's own keys once, names the answer, and Undo puts it all back", async () => {
  const mine = migrate(renterDebtPlan()); mine.whatIfs = { ...(mine.whatIfs ?? {}), rentVsBuy: { price: 199000, rentMonthly: 1500, years: 5, itemize: true, marginalRate: 0.22 } };
  const before = JSON.stringify(mine);
  const query = { share: shareText(SHARE_SPEC, WEIGH) };
  const a = await sharePage(mine, { query });
  a.button("Back to my own figures").click();
  assert.equal(a.saves.length, 0);
  assert.equal(a.banner(), null);
  assert.ok(a.text().includes(OWN_AGAIN));
  assert.ok(a.text().includes(`A ${money(199000)} home`));
  // Compare while the link shows: for this visit, in the address
  const b = await sharePage(mine, { query });
  b.root.querySelector('[name="rentMonthly"]').value = "2600";
  b.root.querySelector('[name="price"]').closest("form").dispatch("submit");
  assert.equal(b.saves.length, 0);
  assert.equal(b.replaced.length, 1);
  assert.match(b.replaced[0], /^#\/property\/rent-vs-buy\?share=price:450000,rent:2600,/);
  const said = b.root.querySelectorAll(".notice").map((n) => b.textOf(n)).find((t) => t.startsWith("Compared for this visit"));
  assert.match(said, /^Compared for this visit: after 8 years, (buying|renting) comes out ahead by \$[\d,]+\. Nothing in your plan has changed\.$/);
  assert.ok(b.part("figures").hasAttribute("open"), "The figures stays open for the next try");
  const c = await sharePage(mine, { query, confirm: false });
  c.button("Keep these").click();
  assert.deepEqual(c.asked, [keepAsk(SHARE_SPEC, readShare(SHARE_SPEC, query.share))]);
  assert.deepEqual(c.asked, ["Keep these 16 figures in your plan? They take the place of yours on this page; your other figures stay as they are. Undo puts yours back."]);
  assert.equal(c.saves.length, 0);
  const d = await sharePage(mine, { query });
  d.button("Keep these").click();
  assert.equal(d.saves.length, 1);
  assert.deepEqual(d.plan().whatIfs.rentVsBuy, { ...WEIGH, itemize: true, marginalRate: 0.22 }, "the link's 16 figures; the household's own tax choices stay");
  const rest = (p) => { const q = structuredClone(p); delete q.whatIfs.rentVsBuy; delete q.meta; return JSON.stringify(q); };
  assert.equal(rest(d.plan()), rest(JSON.parse(before)));
  d.draw();
  assert.equal(d.banner(), null);
  const kept = d.root.querySelectorAll(".notice").map((n) => d.textOf(n)).find((t) => t.startsWith("Kept."));
  assert.match(kept, /^Kept\. After 8 years, (buying|renting) comes out ahead by \$[\d,]+\. Undo$/);
  d.root.all().find((e) => e.tagName === "BUTTON" && d.textOf(e) === "Undo").click();
  const back = structuredClone(d.plan()); const was = JSON.parse(before); delete back.meta; delete was.meta;
  assert.equal(JSON.stringify(back), JSON.stringify(was));
  d.draw();
  assert.ok(d.text().includes("Back to your own figures, as before."));
  d.draw();
  assert.ok(!d.text().includes("Back to your own figures, as before."), "said once");
});

test("share (critic F1): Keep keeps the figures the link carried and nothing else; the visit showed exactly what it keeps", async () => {
  const mine = familyPlan(T13); mine.whatIfs = { rentVsBuy: { price: 300000, rentMonthly: 1800, rate: 0.07, itemize: true } };
  const query = { share: "price:500000,rent:2400" };
  const a = await sharePage(mine, { query });
  // the visit counts this phone's own 7% (in its box, black), and says the rest are this phone's own and our guesses
  assert.equal(a.root.querySelector('[name="rate"]').value, "7");
  assert.match(a.textOf(a.banner()), /The link filled in 2 figures on this page\. The rest are your own figures and our guesses\./);
  const ahead = (p) => p.text().replace(/​/g, "").match(/After \d+ years\s*\$[\d,]+\s*(?:Buying|Renting) ahead by/)?.[0];
  const seen = ahead(a);
  assert.ok(seen, "the answer is on the page");
  a.button("Keep these").click();
  assert.deepEqual(a.asked, ["Keep the price and the rent in your plan? They take the place of yours on this page; your other figures stay as they are. Undo puts yours back."]);
  assert.deepEqual(a.plan().whatIfs.rentVsBuy, { price: 500000, rentMonthly: 2400, rate: 0.07, itemize: true }, "the 7% rate and the tax choice stay");
  a.draw();
  assert.equal(ahead(a), seen, "the kept page answers as the visit did");
});

test("share (critic F2, P1, P2): one link on two phones: each says whose the boxes the link left out are", async () => {
  const query = { share: "price:500000,rent:2400" };
  const empty = await sharePage(emptyPlan(), { query });
  assert.match(empty.textOf(empty.banner()), /The link filled in 2 figures on this page\. The rest are our guesses for you\. Keep these/);
  const tax = familyPlan(T13); tax.whatIfs = { rentVsBuy: { itemize: true, marginalRate: 0.24 } };
  const own = await sharePage(tax, { query });
  assert.match(own.textOf(own.banner()), /The link filled in 2 figures on this page\. The rest are your own figures and our guesses\. Keep these/, "this phone's own tax choices count, and it says so");
  // the sender's side says it before the link leaves (critic P1), and never "on any phone" (P2)
  const sender = familyPlan(T13); sender.whatIfs = { rentVsBuy: { price: 500000, rentMonthly: 2400, itemize: false } };
  const s = await sharePage(sender);
  await s.share();
  const said = s.textOf(s.root.all().find((e) => e.dataset?.shareOut !== undefined));
  assert.match(said, /^Copy this link and paste it into a message\. It carries the price and the rent, nothing else\. The other phone fills in the rest with its own figures, so its answer can differ\./);
  assert.ok(!said.includes("any phone"));
});

test("share: the sentences of each case", () => {
  const m = (n) => `$${n.toLocaleString("en-US")}`;
  assert.deepEqual(shareWords({ atEnd: { year: 10, winner: "buy", ahead: 41230 } }, m), { kept: "Kept. After 10 years, buying comes out ahead by $41,230.", worked: "Compared for this visit: after 10 years, buying comes out ahead by $41,230." });
  assert.deepEqual(shareWords({ atEnd: { year: 1, winner: "rent", ahead: -12300 } }, m), { kept: "Kept. After 1 year, renting comes out ahead by $12,300.", worked: "Compared for this visit: after 1 year, renting comes out ahead by $12,300." });
});

test("share invariance: with no link the page is as before for every invented household: no banner, nothing written, nothing to share", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  for (const p0 of [familyPlan(T13), renterDebtPlan(), retiredCouplePlan(T13), emptyPlan(), ...ARCHETYPES.map((x) => x.build())]) {
    const p = migrate(structuredClone(p0));
    assert.equal(planWith(p, SHARE_SPEC, null), p);
    const a = await sharePage(p);
    assert.equal(a.banner(), null);
    assert.equal(a.saves.length, 0);
    assert.ok(!a.text().includes("Share these figures"));
    const b = await sharePage(p, { query: { from: "plan" } });
    assert.equal(b.text(), a.text());
  }
});
