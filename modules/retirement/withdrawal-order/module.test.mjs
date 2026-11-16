// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("withdrawal-order: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// round 8, Batch 5b (2026-11-06): the ways that set a withdrawal spend tax savings rather than keep them, so orders are compared
// on the plan's own spending, the same every year: a plan on another way ranks its orders exactly as on the same spending
test("5b: a plan on a share of what is left compares its orders at the same spending every year", async () => {
  const { bridgeCouple } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const today = "2026-11-06";
  // health cover is priced on the plan's own income, which moves with the way: left out here, so only the way differs
  const couple = () => { const p = migrate(bridgeCouple()); p.retirement.healthIncluded = true; return p; };
  const steady = compute(couple(), { today });
  for (const way of ["percent", "guardrails", "vpw"]) {
    const p = couple(); p.retirement.strategy = way;
    const d = compute(p, { today });
    assert.deepEqual(d.options.map((o) => [o.key, o.endAfterTaxReal, o.taxesReal]), steady.options.map((o) => [o.key, o.endAfterTaxReal, o.taxesReal]), way);
    assert.equal(d.best, steady.best);
  }
});

// stress test 2026-11-11, x-4: the flat-rate warning is the page's own notice with a button, not a line of builder words in `notes`
test("the flat rate is reported as bracketsOn, not as a note", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const p = retirementPlan("2026-11-11");
  p.retirement = { ...(p.retirement ?? {}), taxMode: "flat" };
  const d = compute(p, { today: "2026-11-11" });
  assert.equal(d.ready, true);
  assert.equal(d.bracketsOn, false);
  assert.ok(!d.notes.some((n) => /flat tax rate/.test(n)));
});

// stress test 2026-11-11, RB2 and R-A9: the retirement pages that cannot work yet send a newcomer straight to where each missing
// thing is typed (modules/retirement/needs.js), the first button filled, not to Will the money last? to read the same list again
test("stress test: needs.js turns the projection's missing list into buttons, first filled", async () => {
  const { needAct } = await import("../needs.js");
  assert.deepEqual(needAct("a person with a birth date on the People page"), { href: "#/household/people", label: "Add people ›" });
  assert.deepEqual(needAct("your accounts on the Net worth page"), { href: "#/balance/net-worth", label: "Add what you own ›" });
  assert.deepEqual(needAct("what you will spend in retirement (a figure here, or your expenses on the Expenses page)"), { href: "#/retirement/projection?type=spending", label: "Type what you'll spend ›" });
  assert.equal(needAct("Everyone is past the plan's end age: check the birth dates on the People page").href, "#/household/people");
  assert.equal(needAct("the plan is longer than the history on file"), null);
});
test("stress test: every empty retirement page shows the same buttons and no small link to Will the money last?", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const pages = ["withdrawal-order", "withdrawal-strategy", "roth-conversions", "cash-flow", "buckets", "sequence-risk"];
  for (const id of pages) {
    const r = await renderPage(new URL(`../${id}/view.js`, import.meta.url).href, emptyPlan(), "2026-11-11");
    const links = r.root.querySelectorAll("a");
    const hrefs = links.map((a) => [a.getAttribute("href"), a.className]);
    assert.deepEqual(hrefs.slice(0, 3), [["#/household/people", "btn"], ["#/balance/net-worth", "btn secondary"], ["#/retirement/projection?type=spending", "btn secondary"]], `${id}: ${JSON.stringify(hrefs)}`);
    assert.ok(!hrefs.some(([h]) => h === "#/retirement/projection"), `${id} still sends to the list page: ${JSON.stringify(hrefs)}`);
  }
  // the two odds pages ask the PC; their not-ready answer draws the same row
  for (const id of ["monte-carlo", "historical"]) {
    const { compute: c } = await import(`../${id}/compute.js`);
    // (these two read ctx.view and the store's backend, which renderPage leaves out: a ctx of their own)
    const ui = await import("../../../core/ui/dom.js"), fmt = await import("../../../core/format.js"), { render } = await import(`../${id}/view.js`);
    const root = document.createElement("main"), plan = emptyPlan();
    render(root, { ui, fmt: { ...fmt, today: () => "2026-11-11" }, plan, view: {}, route: { rest: [], query: {} }, store: { get: () => plan, update() {}, backend: () => "local" }, computeRemote: async (k, o) => c(plan, { today: "2026-11-11", ...o }) });
    await new Promise((r) => setTimeout(r, 0));
    const hrefs = root.querySelectorAll("a").map((a) => [a.getAttribute("href"), a.className]);
    assert.ok(hrefs.some(([h, c2]) => h === "#/household/people" && c2 === "btn"), `${id}: ${JSON.stringify(hrefs)}`);
    assert.ok(!root.querySelectorAll(".notice").some((n) => n.classList.contains("warn")), `${id}: no amber box for a first open`);
  }
});

// ---- A share from every account (gap list, next 60, item 22; 2026-11-15): the fifth order, beside the four -------------------
import { project } from "../../../core/math/retirement.js";
import { compute as projectionCompute } from "../projection/compute.js";
import { chooseOrder } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
const T22 = "2026-11-15";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
// one adult already retired, no growth, no inflation, no income: what comes out is what the year needs
const one = (more = {}) => ({
  startYear: 2026, endYear: 2027, people: [{ name: "Ana", birthYear: 1960, retireAge: 65, endAge: 95 }],
  balances: { cash: 0, taxable: 600000, deferred: 300000, free: 100000 }, contributions: [], incomes: [],
  spending: { yearly: 50000 }, retireYear: 2026,
  rates: { inflation: 0, cash: 0, salaryGrowth: 0, taxRate: 0, stocksNow: 0.5, stocksRetired: 0.5 },
  returns: { stocks: 0, bonds: 0 }, rmd: null, strategy: "fixed-real", withdrawalRate: 0.04, withdrawalSplit: "proportional", ...more,
});

test("share: each account pays its share by what it held at the start of the year (60/30/10 of $50,000)", () => {
  const r = project(one());
  const y = r.rows[0];
  near(y.withdrawn.taxable, 30000); near(y.withdrawn.deferred, 15000); near(y.withdrawn.free, 5000); near(y.withdrawn.cash, 0);
  assert.equal(r.withdrawalSplit, "proportional");
  // the next year's weights are the new balances (570/285/95 thousand): the same shares again
  const y2 = r.rows[1];
  near(y2.withdrawn.taxable, 30000); near(y2.withdrawn.deferred, 15000); near(y2.withdrawn.free, 5000);
  // without the field: the order, taxable first, as before
  const { withdrawalSplit, ...plain } = one();
  near(project(plain).rows[0].withdrawn.taxable, 50000);
  assert.equal("withdrawalSplit" in project(plain), false);
});
test("share: cash goes first; the flat tax on the pre-tax share is grossed up the same way as for an order", () => {
  const y = project(one({ balances: { cash: 10000, taxable: 600000, deferred: 300000, free: 100000 } })).rows[0];
  near(y.withdrawn.cash, 10000); near(y.withdrawn.taxable, 24000); near(y.withdrawn.deferred, 12000); near(y.withdrawn.free, 4000);
  // 20% on what comes out of pre-tax money: W = 50,000 + 0.2 x 0.3 x W, so W = 50,000 / 0.94 = $53,191.49, shared 60/30/10
  const t = project(one({ rates: { inflation: 0, cash: 0, salaryGrowth: 0, taxRate: 0.2, stocksNow: 0.5, stocksRetired: 0.5 } })).rows[0];
  const W = 50000 / 0.94;
  near(t.withdrawn.taxable, W * 0.6, 0.01); near(t.withdrawn.deferred, W * 0.3, 0.01); near(t.withdrawn.free, W * 0.1, 0.01); near(t.taxes, 0.2 * W * 0.3, 0.01);
});
test("share: an account that runs dry is shared on; one that held nothing at the start of the year pays last", () => {
  // $10,000 in each; at 100 the required withdrawal is $10,000 / 6.4 = $1,562.50, so pre-tax holds $8,437.50 when its third of the
  // $27,437.50 still needed ($9,145.83) comes due: it pays $8,437.50, and the $708.33 it could not pay is shared by the other two
  const y = project(one({ people: [{ name: "Ana", birthYear: 1926, retireAge: 65, endAge: 101 }], rmd: { birthYear: 1926, startAge: 73 }, balances: { cash: 0, taxable: 10000, deferred: 10000, free: 10000 }, spending: { yearly: 29000 } })).rows[0];
  const rmd = 10000 / 6.4, third = (29000 - rmd) / 3, short = third - (10000 - rmd);
  near(y.rmd, rmd); near(y.withdrawn.deferred, 10000);
  near(y.withdrawn.taxable, third + short / 2); near(y.withdrawn.free, third + short / 2);
  assert.equal(y.shortfall, 0);
  // money in this year to an empty taxable account ($30,000 from a sale) pays only once the others are empty
  const z = project(one({ balances: { cash: 0, taxable: 0, deferred: 20000, free: 10000 }, events: [{ year: 2026, amount: -30000, label: "sale" }] })).rows[0];
  near(z.withdrawn.deferred, 20000); near(z.withdrawn.free, 10000); near(z.withdrawn.taxable, 20000);
  assert.equal(z.shortfall, 0);
});
test("share: a required withdrawal comes out first; the rest is shared by the weights at the start of the year", () => {
  // born 1950, 76 in 2026: the factor at 76 is 23.7; $300,000 / 23.7 = $12,658.23 from pre-tax first
  const y = project(one({ people: [{ name: "Ana", birthYear: 1950, retireAge: 65, endAge: 95 }], rmd: { birthYear: 1950, startAge: 73 } })).rows[0];
  const rmd = 300000 / 23.7, left = 50000 - rmd;
  near(y.rmd, rmd); near(y.withdrawn.deferred, rmd + left * 0.3); near(y.withdrawn.taxable, left * 0.6); near(y.withdrawn.free, left * 0.1);
});

test("share: Withdrawal order shows it beside the four, ranked over five; the four's figures are as before", () => {
  const d = compute(familyPlan(T22), { today: T22 });
  assert.equal(d.options.length, 4);
  assert.equal(d.share.key, "proportional"); assert.equal(d.share.label, "A share from every account"); assert.equal(d.share.current, false);
  for (const k of ["success", "failYear", "endBalanceReal", "endAfterTaxReal", "endTaxRate", "taxesReal", "rmdReal"]) assert.ok(k in d.share, k);
  // the family: the share leaves $840,251 after tax, $1,203 more than pre-tax first ($839,048), the best of the four
  assert.equal(d.best, "deferred-first"); assert.equal(d.five.best, "proportional"); assert.equal(d.share.best, true);
  assert.equal(Math.round(d.share.endAfterTaxReal), 840251); assert.equal(Math.round(d.options.find((o) => o.key === "deferred-first").endAfterTaxReal), 839048);
  // the five's worst is still Roth first: $840,251 - $822,128
  assert.equal(Math.round(d.five.gainVsWorst), 18123);
  // a tie goes to the four: on a plan where every order leaves the same, the share is never "best"
  const { retiredCouplePlan } = await_retired;
  const r = compute(retiredCouplePlan(T22), { today: T22 });
  assert.equal(Math.round(r.share.endAfterTaxReal), Math.round(r.options[0].endAfterTaxReal));
  assert.equal(r.five.best, r.best); assert.equal(r.share.best, false);
});
const await_retired = await import("../../../qa/fixtures/retired-couple-plan.mjs");

test("share: the tap writes withdrawalSplit and keeps the order; another order takes it off; the plan reads it everywhere", () => {
  const p = familyPlan(T22);
  const d = compute(p, { today: T22 });
  chooseOrder(p, d.share);
  assert.equal(p.retirement.withdrawalSplit, "proportional"); assert.deepEqual(p.retirement.withdrawalOrder, ["taxable", "deferred", "free"]);
  const now = compute(p, { today: T22 });
  assert.equal(now.current, "proportional"); assert.equal(now.share.current, true); assert.ok(now.options.every((o) => !o.current));
  // the projection runs it, says it, and the share's figure here is the plan's own run once saved
  const pr = projectionCompute(p, { today: T22 });
  assert.equal(pr.inputs.withdrawalSplit, "proportional"); assert.equal(pr.orderLabel, "A share from every account");
  chooseOrder(p, d.options.find((o) => o.key === "deferred-first"));
  assert.equal("withdrawalSplit" in p.retirement, false); assert.deepEqual(p.retirement.withdrawalOrder, ["deferred", "taxable", "free"]);
  chooseOrder(p, d.share, { withRates: true });
  assert.equal(p.retirement.taxMode, "brackets"); assert.deepEqual(p.retirement.withdrawalOrder, ["deferred", "taxable", "free"], "the order is kept");
  // Cash flow in retirement says it too
  return import("../cash-flow/view.js").then(({ orderSaid }) => {
    assert.equal(orderSaid(["taxable", "deferred", "free"], "proportional"), "Money comes out of cash first, then a share from every account, by what each holds.");
    assert.equal(orderSaid(["taxable", "deferred", "free"]), "Money comes out of cash first, then taxable savings, then pre-tax accounts (taxed as it comes out), then Roth (tax-free).");
  });
});

test("share: the green line, one sentence per case, and the line after Put it back", async () => {
  const { choseWords, backWords } = await import("./view.js");
  const share = { label: "A share from every account" }, pre = { label: "Pre-tax, then taxable, then Roth" };
  assert.equal(choseWords(share, { bracketsOn: true }), "The plan now draws a share from every account.");
  assert.equal(choseWords(pre, { bracketsOn: false, withRates: true }), "The plan now draws pre-tax, then taxable, then Roth and works out tax at the real rates, so the order counts. Every retirement page's figures change with it; to go back, pick the flat rate under Retirement settings on Will the money last?");
  assert.equal(choseWords(share, { bracketsOn: false }), "The plan now draws a share from every account. It changes nothing until tax is worked out at the real rates (the button below).");
  assert.equal(backWords({ label: "Taxable, then pre-tax, then Roth" }), 'Back to "Taxable, then pre-tax, then Roth", as before.');
  assert.equal(backWords(null), "Back to the order you had, as before.");
  assert.equal(backWords({ label: "Taxable, then pre-tax, then Roth" }, { withRates: true }), 'Back to "Taxable, then pre-tax, then Roth" and the flat tax rate, as before.');
});

/** The page drawn on the fake DOM with a store that draws again after each change (as the shell does). */
async function drawOrder(plan0) {
  const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const s = { p: migrate(plan0), saved: [] };
  s.draw = () => { s.root = new FakeElement("main"); render(s.root, { ui, fmt: { ...fmt, today: () => T22 }, plan: s.p, route: { group: "retirement", id: "withdrawal-order", rest: [], query: {} }, module: { group: "retirement", id: "withdrawal-order" },
    store: { get: () => s.p, update: (fn) => { const d = structuredClone(s.p); fn(d); s.saved.push(d); s.p = d; s.draw(); } } }); };
  s.draw();
  s.text = () => s.root.textContent.replace(/\s+/g, " ");
  s.button = (t) => s.root.all().find((e) => e.tagName === "BUTTON" && e.textContent.includes(t));
  s.parts = () => s.root.all().filter((e) => e.dataset?.part).map((e) => e.dataset.part);
  // what shows before a tap: a shut part's summary (its title), not its body
  s.outside = () => { const walk = (n) => (n.tagName === "DETAILS" && !n.hasAttribute("open") ? n.children.filter((c) => c.tagName === "SUMMARY").map((c) => c.textContent).join(" ") : n.tagName ? n.childNodes.map(walk).join(" ") : String(n.textContent ?? "")); return walk(s.root).replace(/\s+/g, " "); };
  return s;
}
const { migrate } = await import("../../../core/schema/migrate.js");

test("share page: the family reads that a share from every account works best, uses it with one tap, and can put it back", async () => {
  const s = await drawOrder(familyPlan(T22));
  const t = s.text();
  assert.ok(t.startsWith('"A share from every account" works best for you'), t.slice(0, 200));
  // one sentence, the order's name once (in the headline); the tax over the plan is in the row (critic of 2026-11-15, P2)
  assert.ok(t.includes("This order leaves about $840,251 at the end, after tax and in today's dollars: $3,707 more than yours."), t.slice(0, 600));
  assert.ok(!t.includes("A share from every account: $840,251") && !t.includes("of federal tax paid over the plan"), t.slice(0, 600));
  // the best order is offered once, by the hero (P4): its row has no button of its own; the other rows keep theirs
  const bestRow = s.root.all().find((e) => e.tagName === "LI" && /^A share from every account ?best/.test(e.textContent.trim()));
  assert.ok(bestRow && !bestRow.all().some((e) => e.tagName === "BUTTON"), "no 'Use this order' on the best row");
  assert.equal(s.root.all().filter((e) => e.tagName === "BUTTON" && e.textContent === "Use this order").length, 3, "the three others, inside 3 more orders");
  // the best and yours in sight; the three others one quiet tap away; the method and why it matters in "How this is worked out"
  assert.deepEqual(s.parts(), ["orders", "mix", "how"]);
  const first = s.outside();
  assert.ok(first.includes("The five orders") && first.includes("3 more orders") && first.includes("Try Roth conversions too") && first.includes("How this is worked out"), first);
  assert.ok(!first.includes("Roth, then taxable, then pre-tax") && !first.includes("Pre-tax money is a tax bill waiting") && !first.includes("Everyday cash always goes first"), first);
  assert.ok(t.includes("Each account pays its share of what comes out, by what it holds at the start of the year, so pre-tax, taxable and Roth money go down together. Left at the end after tax; $880,072 before it. Tax over the plan $174,093; $851,841 of required withdrawals."), t);
  assert.ok(t.includes('"A share from every account": after everyday cash and any required withdrawal, each account pays its share of what the year needs, by what it held at the start of the year. One holding 60% of your savings pays 60%. Tax is worked out the same way as for the other orders.'));
  // one filled button: the hero's
  assert.equal(s.root.all().filter((e) => e.tagName === "BUTTON" && !/secondary|chip/.test(e.className)).length, 1);
  s.button('Use "A share from every account" with the real tax rates').click();
  assert.equal(s.p.retirement.withdrawalSplit, "proportional"); assert.equal(s.p.retirement.taxMode, "brackets");
  const a = s.text();
  assert.ok(a.startsWith("Your order is the best one for this plan"), a.slice(0, 200));
  assert.ok(a.includes("The plan now draws a share from every account and works out tax at the real rates, so the order counts."), a.slice(0, 900));
  assert.ok(s.outside().includes("4 more orders"));
  s.button("Put it back").click();
  assert.equal("withdrawalSplit" in s.p.retirement, false); assert.equal(s.p.retirement.taxMode ?? "flat", "flat");
  assert.ok(s.text().includes('Back to "Taxable, then pre-tax, then Roth" and the flat tax rate, as before.'), s.text().slice(0, 900));
  // on a plan already on the real rates the hero's button sets the order only, and back to the share
  s.p.retirement.taxMode = "brackets"; s.draw();
  assert.equal(s.button("with the real tax rates"), undefined);
  s.button('Use "A share from every account"').click();
  assert.equal(s.p.retirement.withdrawalSplit, "proportional");
  assert.ok(s.text().includes("The plan now draws a share from every account."));
  s.button("Put it back").click();
  assert.equal("withdrawalSplit" in s.p.retirement, false);
  assert.ok(s.text().includes('Back to "Taxable, then pre-tax, then Roth", as before.'));
});

test("S11: after a save only the saved part changes: the parts keep their state, the green line and its way back are outside them", async () => {
  const s = await drawOrder(familyPlan(T22));
  const state = () => s.root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.dataset.kind, e.hasAttribute("open")]);
  assert.deepEqual(state(), [["orders", "more", false], ["mix", "own", false], ["how", "how", false]], "three parts, shut; no fold by hand");
  // "Use this order" on a row inside "3 more orders" (pre-tax first): the plan takes it, the parts are as they were
  const inside = s.root.all().find((e) => e.dataset?.part === "orders").all().find((e) => e.tagName === "BUTTON" && e.textContent === "Use this order");
  inside.click();
  assert.deepEqual(s.p.retirement.withdrawalOrder, ["deferred", "taxable", "free"]);
  assert.deepEqual(state(), [["orders", "more", false], ["mix", "own", false], ["how", "how", false]]);
  const line = s.root.all().find((e) => /\bnotice\b/.test(e.className) && /\bok\b/.test(e.className));
  assert.ok(line && !s.root.all().filter((e) => e.tagName === "DETAILS").some((d) => d.all().includes(line)), "the green line is outside the parts");
  assert.equal(line.textContent.replace(/\s+/g, " "), "The plan now draws pre-tax, then taxable, then Roth. It changes nothing until tax is worked out at the real rates (the button below).Put it back");
});

test("the hero: one sentence per case, the order's name once (critic of 2026-11-15, P1 and P2)", async () => {
  const { heroWords } = await import("./view.js");
  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const o = (label, end, extra = {}) => ({ label, endAfterTaxReal: end, success: true, current: false, ...extra });
  const five = { gainVsWorst: 18123 }, flat = { gainVsWorst: 300 };
  const share = o("A share from every account", 840251), tx = o("Taxable, then pre-tax, then Roth", 836544, { current: true });
  // another order is best and yours lasts: how much more it leaves than yours
  assert.deepEqual(heroWords({ best: share, current: tx, five, bracketsOn: false }, money), { title: '"A share from every account" works best for you', lede: "This order leaves about $840,251 at the end, after tax and in today's dollars: $3,707 more than yours." });
  assert.equal(heroWords({ best: share, current: o("Roth first", 840000, { current: true }), five, bracketsOn: true }, money).lede, "This order leaves about $840,251 at the end, after tax and in today's dollars, about as much as yours: for this plan the order barely matters.");
  // yours runs out
  assert.equal(heroWords({ best: share, current: { ...tx, success: false, failYear: 2061 }, five, bracketsOn: true }, money).lede, "This order leaves about $840,251 at the end, after tax and in today's dollars; yours runs out in 2061.");
  // yours is the best: the worst order beside it, or that it barely matters; the headline says the real rates on a flat-rate plan
  const mine = { ...share, current: true };
  assert.deepEqual(heroWords({ best: mine, current: mine, five, bracketsOn: true }, money), { title: "Your order is the best one for this plan", lede: "Your order leaves about $840,251 at the end, after tax and in today's dollars. The worst order leaves $18,123 less." });
  assert.deepEqual(heroWords({ best: mine, current: mine, five: flat, bracketsOn: false }, money), { title: "Your order is the best one at the real tax rates", lede: "Your order leaves about $840,251 at the end, after tax and in today's dollars. For this plan the order barely matters." });
  // an order of the plan's own that is none of the five
  assert.equal(heroWords({ best: share, current: null, five, bracketsOn: true }, money).lede, "This order leaves about $840,251 at the end, after tax and in today's dollars. The worst order leaves $18,123 less.");
  // every order runs out (fix round r2: the alarm is the headline; the lede says which lasts longest, to when and what age)
  const runs = (x, failYear) => ({ ...x, success: false, failYear });
  const fiveFail = [runs(tx, 2061), runs(o("Pre-tax first", 0), 2062), runs(share, 2064)];
  assert.deepEqual(heroWords({ best: runs(share, 2064), current: runs(tx, 2061), five, bracketsOn: true, orders: fiveFail, people: [{ name: "Sam", birthYear: 1990 }] }, money),
    { title: "The money runs out under every order", lede: '"A share from every account" lasts longest: the money runs out in 2064, when you are 74; under yours it runs out in 2061. Fix that first on the page called Will the money last?' });
});

test("P1: the plan already on the best order with a flat rate keeps one filled button, the real rates, and says so in the headline", async () => {
  const p0 = familyPlan(T22); p0.retirement = { ...(p0.retirement ?? {}), withdrawalSplit: "proportional" };
  const s = await drawOrder(p0);
  const filled = (x) => x.root.all().filter((e) => e.tagName === "BUTTON" && !/secondary|chip/.test(e.className)).map((e) => e.textContent);
  assert.ok(s.text().startsWith("Your order is the best one at the real tax rates"), s.text().slice(0, 200));
  assert.deepEqual(filled(s), ["Work out tax at the real rates"]);
  s.button("Work out tax at the real rates").click();
  assert.equal(s.p.retirement.taxMode, "brackets");
  assert.ok(s.text().startsWith("Your order is the best one for this plan"), s.text().slice(0, 200));
  assert.deepEqual(filled(s), [], "nothing left to do: no filled button");
  // another order is best on a flat-rate plan: the hero's button is the filled one and the real rates' is outlined
  const t = await drawOrder(familyPlan(T22));
  assert.deepEqual(filled(t), ['Use "A share from every account" with the real tax rates']);
});

// ---------------------------------------------------------------- fix round r2: when every order runs out
// The invented renter (qa/fixtures/renter-debt-plan.mjs: Riley, born 2002, tax at one flat rate) runs out in 2067 under every
// one of the five orders; the page said "Your order is the best one at the real tax rates" above "The money runs out under
// every order". The invented couple of qa/households 02 (Priya, born 1992, and Tom, 1989) run out in 2064 under four orders
// and in 2065 taking a share from every account.
test("r2: when every order runs out, one sentence per case: the same year, yours longest, another longer, yours none of the five", async () => {
  const { allFailWords, whenWords, flatWords, allSameYear } = await import("./view.js");
  const { agesIn } = await import("./compute.js");
  // the age is the engine's: year less birth year (core/math/retirement.js, failAge = ages[0])
  assert.deepEqual(agesIn(2067, [{ name: "Riley", birthYear: 2002 }]), [{ name: "Riley", age: 65 }]);
  assert.deepEqual(agesIn(2065, [{ name: "Priya", birthYear: 1992 }, { name: "Tom", birthYear: 1989 }, { name: "Kid", birthYear: 2020 }]), [{ name: "Priya", age: 73 }, { name: "Tom", age: 76 }], "the first two people only");
  assert.deepEqual(agesIn(null, [{ birthYear: 2002 }]), []);
  assert.equal(whenWords(2067, [{ name: "Riley", birthYear: 2002 }]), "in 2067, when you are 65");
  assert.equal(whenWords(2065, [{ name: "Priya", birthYear: 1992 }, { name: "Tom", birthYear: 1989 }]), "in 2065, when Priya is 73 and Tom is 76");
  assert.equal(whenWords(2065, [{ name: "", birthYear: 1992 }, { name: "Tom", birthYear: 1989 }]), "in 2065, at age 73");
  assert.equal(whenWords(2065, []), "in 2065");
  const one = [{ name: "Riley", birthYear: 2002 }];
  const o = (label, failYear, current = false) => ({ label, success: false, failYear, current });
  const tie = [o("Taxable, then pre-tax, then Roth", 2067, true), o("Pre-tax, then taxable, then Roth", 2067), o("A share from every account", 2067)];
  assert.equal(allSameYear(tie), true);
  assert.equal(allFailWords({ best: tie[0], current: tie[0], orders: tie, people: one }), "All five orders run out in 2067, when you are 65. Fix that first on the page called Will the money last?");
  const longer = [o("Taxable, then pre-tax, then Roth", 2067, true), o("A share from every account", 2069)];
  assert.equal(allSameYear(longer), false);
  assert.equal(allFailWords({ best: longer[0], current: longer[0], orders: longer, people: one }), "Yours lasts longest: the money runs out in 2067, when you are 65. Fix that first on the page called Will the money last?");
  assert.equal(allFailWords({ best: longer[1], current: longer[0], orders: longer, people: one }), '"A share from every account" lasts longest: the money runs out in 2069, when you are 67; under yours it runs out in 2067. Fix that first on the page called Will the money last?');
  assert.equal(allFailWords({ best: longer[1], current: null, orders: longer, people: one }), '"A share from every account" lasts longest: the money runs out in 2069, when you are 67. Fix that first on the page called Will the money last?');
  // the flat-rate notice, one per case
  const head = "Your plan works out tax at one flat rate, so the order changes nothing yet.";
  assert.equal(flatWords({ yoursBest: true }), `${head} With the real rates, this order is the best one; they also change the figures on every retirement page.`);
  // every order runs out: the hero says which lasts longest and when, so the notice does not say it again (a person critic's P3)
  assert.equal(flatWords({ yoursBest: true, allFail: true }), `${head} Working tax out at the real rates makes it count, and changes the figures on every retirement page.`);
  assert.equal(flatWords({ yoursBest: true, allFail: true, sameYear: true }), `${head} Working tax out at the real rates changes the figures on every retirement page.`);
  for (const c of [{ yoursBest: true, allFail: true }, { yoursBest: true, allFail: true, sameYear: true }, { yoursBest: false, allFail: true }]) assert.ok(!/runs out|lasts longest/.test(flatWords(c)), JSON.stringify(c));
  assert.equal(flatWords({ yoursBest: false }), `${head} Working tax out at the real rates makes it count, and changes the figures on every retirement page.`);
  assert.equal(flatWords({ yoursBest: false, allFail: true }), flatWords({ yoursBest: false }));
  // the headline: the alarm, at the real rates on a flat-rate plan
  const { heroWords } = await import("./view.js");
  assert.equal(heroWords({ best: tie[0], current: tie[0], five: { gainVsWorst: 0 }, bracketsOn: true, orders: tie, people: one }, String).title, "The money runs out under every order");
  assert.equal(heroWords({ best: tie[0], current: tie[0], five: { gainVsWorst: 0 }, bracketsOn: false, orders: tie, people: one }, String).title, "At the real tax rates, the money runs out under every order");
});

test("r2 the page: the renter, every order to 2067: the alarm first, no order called best, no button that changes nothing", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const s = await drawOrder(renterDebtPlan());
  const first = s.outside();
  assert.ok(first.trim().startsWith("At the real tax rates, the money runs out under every order All five orders run out in 2067, when you are 65. Fix that first on the page called Will the money last?"), first.slice(0, 300));
  assert.ok(!/best one|works best|lasts longest/.test(first), "nothing reads as good news");
  // said once: the notice does not repeat that every order runs out the same year (a person critic's P3)
  assert.equal(first.match(/run(s)? out/g).length, 3, first);
  assert.match(first, /Your plan works out tax at one flat rate, so the order changes nothing yet\. Working tax out at the real rates changes the figures on every retirement page\./);
  assert.ok(!/same year/.test(first), first);
  // the page to fix it on is its link, at the end of the line under the headline
  const lede = s.root.all().find((e) => e.tagName === "P" && /\blede\b/.test(e.className ?? ""));
  const link = lede.all().find((e) => e.tagName === "A");
  assert.equal(link?.textContent, "Will the money last?"); assert.equal(link.getAttribute("href"), "#/retirement/projection");
  assert.ok(lede.textContent.replace(/\s+/g, " ").trim().endsWith("when you are 65. Fix that first on the page called Will the money last?"), lede.textContent);
  assert.equal(s.root.all().filter((e) => /\bpill\b/.test(e.className ?? "") && /best/.test(e.textContent)).length, 0, "no order is called best in a tie");
  assert.equal(s.root.all().filter((e) => e.tagName === "LI" && /accent-soft/.test(JSON.stringify(e.style ?? e.getAttribute?.("style") ?? ""))).length, 0, "nor drawn as the best");
  assert.ok(!s.button("Use \""), "no Use button");
  // the same plan on another order, tied: still no Use button (it would change nothing), and its row is the one in sight
  const p = renterDebtPlan(); p.retirement = { ...(p.retirement ?? {}), withdrawalOrder: ["deferred", "taxable", "free"] };
  const t = await drawOrder(p);
  assert.ok(t.outside().includes("All five orders run out in 2067, when you are 65."));
  assert.ok(!t.button("Use \""));
});

test("r2 the page: the couple of qa/households 02: a share from every account lasts a year longer, said with both ages", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const couple = () => ARCHETYPES.find((a) => a.id === "02-couple-no-kids").build();
  const s = await drawOrder(couple());
  assert.ok(s.outside().trim().startsWith('At the real tax rates, the money runs out under every order "A share from every account" lasts longest: the money runs out in 2065, when Priya is 73 and Tom is 76; under yours it runs out in 2064. Fix that first on the page called Will the money last?'), s.outside().slice(0, 300));
  assert.ok(s.button('Use "A share from every account" with the real tax rates'), "the one that lasts longer, one tap away");
  assert.match(s.outside(), /Working tax out at the real rates makes it count/);
  // once the plan takes a share from every account: yours lasts longest
  const p = couple(); p.retirement = { ...(p.retirement ?? {}), withdrawalSplit: "proportional", taxMode: "brackets" };
  const t = await drawOrder(p);
  assert.ok(t.outside().trim().startsWith("The money runs out under every order Yours lasts longest: the money runs out in 2065, when Priya is 73 and Tom is 76. Fix that first on the page called Will the money last?"), t.outside().slice(0, 300));
  assert.ok(!t.button("Use \""));
});

test("r2 invariance: the page's compute is untouched (agesIn is not called by it); a plan where an order lasts is drawn as before", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("./compute.js", import.meta.url), "utf8");
  const from = src.indexOf("export function compute("), body = src.slice(from, src.indexOf("\n}\n", from));
  assert.ok(!/agesIn/.test(body), "compute() does not call agesIn");
  const s = await drawOrder(familyPlan(T22));
  assert.ok(s.outside().trim().startsWith('"A share from every account" works best for you This order leaves about $840,251 at the end, after tax and in today\'s dollars: $3,707 more than yours.'), s.outside().slice(0, 200));
});

// ---------------------------------------------------------------- invariance (gap list, next 60, item 23: one search over the order
// and Roth conversions). compute.js is not edited, and neither are Roth conversions or the projection: over every qa/fixtures plan,
// the 14 households' base plans, the phone-built ones, the round 8 households and the empty plan, Withdrawal order's and Roth
// conversions' compute() give the very output the code before the search gave (ce79d70). Digests in invariance.json; to write them
// again after a deliberate change: PRINT=1 node --test --test-name-pattern "x2 invariance" modules/retirement/withdrawal-order/module.test.mjs
test("x2 invariance: Withdrawal order's and Roth conversions' compute() give the output of ce79d70 over every invented household", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const crypto = await import("node:crypto");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const INV_TODAY = "2026-11-16";
  const digest = (x) => crypto.createHash("sha256").update(JSON.stringify(x) ?? "undefined").digest("base64url").slice(0, 22);
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const round8 = await import("../../../qa/fixtures/round8-households.mjs");
  const plans = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push({ name: `fixture ${f}:${name}`, plan: fn(INV_TODAY) });
  }
  for (const a of ARCHETYPES) plans.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") plans.push({ name: `phone ${name}`, plan: fn() });
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push({ name: `round8 ${name}`, plan: fn() });
  plans.push({ name: "empty plan", plan: emptyPlan() });
  const { compute: roth } = await import("../roth-conversions/compute.js");
  const run = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };
  const now = { today: INV_TODAY, compute: {} };
  for (const { name, plan } of plans) {
    const p = () => migrate(structuredClone(plan));
    now.compute[name] = { order: digest(run(() => compute(p(), { today: INV_TODAY }))), roth: digest(run(() => roth(p(), { today: INV_TODAY }))) };
  }
  const file = new URL("./invariance.json", import.meta.url);
  if (process.env.PRINT) fs.writeFileSync(file, JSON.stringify(now, null, 1) + "\n");
  const was = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.ok(Object.keys(now.compute).length >= 40, `${Object.keys(now.compute).length} plans`);
  assert.deepEqual(now, was);
});

// ---------------------------------------------------------------- One search over the order and Roth conversions (gap list, next 60,
// item 23; mix.js). The invented family (qa/fixtures/family-plan.mjs: Ana, born 1990, retiring at 65, and Bo) and the invented retired
// couple (Ruth, born 1954, 72 this year, and Sam).
const MIX = await import("./mix.js");
const VIEW = await import("./view.js");
const { buildInputs: buildIn } = await import("../projection/compute.js");
const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
const fam = () => migrate(familyPlan(T22));
const ret = () => migrate(retiredCouplePlan(T22));
const usd = (n) => "$" + Math.round(n).toLocaleString("en-US");
const mixPartOf = (s) => s.root.all().find((e) => e.dataset?.part === "mix");
const openMix = (s) => { const d = mixPartOf(s); d.open = true; d.dispatch("toggle"); return d; };

test("x2 grid: 35 mixes for the family, 50 retiring at 62, 20 for the retired couple, the five orders alone with nothing to convert", () => {
  const g = MIX.mixGrid(fam(), { today: T22 });
  // Ana is 65 in the first retired year and her required withdrawals begin at 75 (born 1990): 63 changes no year, 70 does
  assert.equal(g.convert, true); assert.equal(g.startAge, 65); assert.equal(g.rmdStartAge, 75);
  assert.deepEqual(g.rates, [0.1, 0.12, 0.22]); assert.deepEqual(g.stops, [null, 70]);
  assert.equal(g.cells.length, 5 * (1 + 3 * 2)); assert.equal(g.tried, 35); assert.equal(new Set(g.cells.map((c) => c.key)).size, 35);
  assert.deepEqual(g.cells.slice(0, 7).map((c) => c.key), ["taxable-first|off", "taxable-first|0.1@rmd", "taxable-first|0.1@70", "taxable-first|0.12@rmd", "taxable-first|0.12@70", "taxable-first|0.22@rmd", "taxable-first|0.22@70"]);
  assert.deepEqual([...new Set(g.cells.map((c) => c.order.key))], ["taxable-first", "deferred-first", "roth-last-taxable", "roth-first", "proportional"]);
  assert.deepEqual(g.own, { key: "taxable-first|off", inGrid: true, mix: { order: { key: "taxable-first", label: "Taxable, then pre-tax, then Roth", order: ["taxable", "deferred", "free"] }, conv: null } });
  // retiring at 62: the stop at 63 now changes a year: 5 x (1 + 3 x 3)
  const p62 = fam(); p62.household.people[0].retirementAge = 62;
  const g62 = MIX.mixGrid(p62, { today: T22 });
  assert.deepEqual(g62.stops, [null, 63, 70]); assert.equal(g62.cells.length, 50); assert.equal(g62.tried, 50);
  // Ruth is 72 and her required withdrawals begin at 73: only "until required withdrawals begin" changes a year: 5 x (1 + 3)
  const gr = MIX.mixGrid(ret(), { today: T22 });
  assert.equal(gr.startAge, 72); assert.equal(gr.rmdStartAge, 73); assert.deepEqual(gr.stops, [null]); assert.equal(gr.tried, 20);
  // nothing to convert: no 401(k) or IRA money (the renter), or no retired year before required withdrawals (Ruth born 1950)
  const gn = MIX.mixGrid(migrate(renterDebtPlan()), { today: T22 });
  assert.equal(gn.convert, false); assert.equal(gn.why, "no-pretax"); assert.equal(gn.tried, 5); assert.ok(gn.cells.every((c) => c.conv === null));
  const old = ret(); old.household.people[0].birthDate = "1950-03-10";
  const go = MIX.mixGrid(old, { today: T22 });
  assert.equal(go.convert, false); assert.equal(go.why, "no-years"); assert.equal(go.tried, 5);
  // the plan's own setting is none of the cells (the 24% rate): one more run, and said
  const own = fam(); own.retirement.rothConversion = { on: true, fillRate: 0.24, untilAge: null };
  const go2 = MIX.mixGrid(own, { today: T22 });
  assert.equal(go2.own.inGrid, false); assert.equal(go2.tried, 36); assert.ok(MIX.triedWords(go2).includes("until age 75, when required withdrawals begin, and your plan as it is."));
  // a stop at or before the first retired year converts nothing (the same as off); one at or past required withdrawals is no stop
  const s60 = fam(); s60.retirement.rothConversion = { on: true, fillRate: 0.12, untilAge: 60 };
  assert.equal(MIX.mixGrid(s60, { today: T22 }).own.key, "taxable-first|off");
  const s80 = fam(); s80.retirement.rothConversion = { on: true, fillRate: 0.12, untilAge: 80 };
  assert.equal(MIX.mixGrid(s80, { today: T22 }).own.key, "taxable-first|0.12@rmd");
  // the empty plan: not ready, with what is missing
  assert.equal(MIX.mixGrid(emptyPlan(), { today: T22 }).ready, false);
});

test("x2 F3: a saved setting the engine cannot run is read as nothing moved, never 'the NaN% rate'; the plan as it is stays the engine's run", () => {
  // critic of x2, F3: { on: true, fillRate: "abc", untilAge: "x" } (hand-edited or damaged data) read "the NaN% rate" and counted one
  // more mix; the engine converts nothing on it (no bracket has that rate; a stop that is not a number is never reached)
  for (const [rc, key, conv] of [
    [{ on: true, fillRate: "abc", untilAge: "x" }, "taxable-first|off", null],
    [{ on: true, fillRate: 0.5, untilAge: null }, "taxable-first|off", null],          // no bracket's rate
    [{ on: true, fillRate: 0.12, untilAge: "x" }, "taxable-first|off", null],          // a stop that is not a number
    [{ on: true, fillRate: "0.12", untilAge: "70" }, "taxable-first|0.12@70", { fillRate: 0.12, untilAge: 70 }],   // numbers as text: as the engine reads them
    [{ on: true, fillRate: 0.32, untilAge: null }, "taxable-first|0.32@rmd", { fillRate: 0.32, untilAge: null }],   // a bracket's rate outside the grid: its own run
    ["yes", "taxable-first|off", null],
  ]) {
    for (const mode of ["flat", "brackets"]) {
      const p = fam(); p.retirement.rothConversion = rc; p.retirement.taxMode = mode;
      const r = MIX.mixes(p, { today: T22 });
      assert.equal(r.grid.own.key, key, JSON.stringify(rc)); assert.deepEqual(r.grid.own.mix.conv, conv, JSON.stringify(rc));
      // the plan as it is: the engine's run of the plan as saved (Will the money last? runs the same once the real rates are on)
      const raw = MIX.runMix(p, null, { today: T22 });
      near(r.asIs.endAfterTaxReal, raw.endAfterTaxReal, 1e-6); near(r.asIs.convertedReal, raw.convertedReal, 1e-6);
      for (const x of [r.asIs, ...r.shown]) assert.ok(!/NaN|undefined|Infinity/.test(MIX.rowWords(x, r.asIs, usd, 75) + MIX.valueWords(x, usd)), MIX.rowWords(x, r.asIs, usd, 75));
      assert.ok(!/NaN/.test(MIX.leadWords(r, usd) + MIX.triedWords(r.grid)));
    }
  }
  assert.equal(MIX.savedConv({ on: false, fillRate: 0.12 }), null); assert.equal(MIX.savedConv(null), null);
  assert.deepEqual(MIX.savedConv({ on: true }), { fillRate: 0.22, untilAge: null }, "no rate saved: the engine's 22%");
});

/** One mix run by hand: the plan with it saved, written out here (not through mix.js), on the engine at the same spending every year. */
function byHand(plan, order, conv) {
  const p = structuredClone(plan);
  p.retirement.taxMode = "brackets";
  if (order === "share") p.retirement.withdrawalSplit = "proportional"; else { p.retirement.withdrawalOrder = order; delete p.retirement.withdrawalSplit; }
  p.retirement.rothConversion = conv ? { ...p.retirement.rothConversion, on: true, fillRate: conv[0], untilAge: conv[1] } : { ...p.retirement.rothConversion, on: false };
  const r = project({ ...buildIn(p, { today: T22 }).inputs, strategy: "fixed-real" });
  return { ok: r.success, fail: r.failYear, E: r.endAfterTaxReal, T: r.rows.reduce((t, x) => t + x.taxes / x.priceLevel, 0), C: r.rows.reduce((t, x) => t + x.conversion / x.priceLevel, 0) };
}
const HAND_ORDERS = { "taxable-first": ["taxable", "deferred", "free"], "deferred-first": ["deferred", "taxable", "free"], "roth-last-taxable": ["deferred", "free", "taxable"], "roth-first": ["free", "taxable", "deferred"], proportional: "share" };
function handRanking(plan, g) {
  const rows = g.cells.map((c) => ({ key: c.key, ...byHand(plan, HAND_ORDERS[c.order.key], c.conv ? [c.conv.fillRate, c.conv.untilAge] : null) }));
  return rows.sort((a, b) => (b.ok - a.ok) || (a.ok ? Math.round(b.E) - Math.round(a.E) : b.fail - a.fail) || Math.round(a.T) - Math.round(b.T));
}

test("x2 ranking: the family's 35 runs and the retired couple's 20 are the engine's own, made by hand here, and rank the same", () => {
  for (const [name, plan, expect] of [["family", fam(), { top: "roth-first|0.12@rmd", E: 874277, asIs: 836544, gain: 37733, lead: "better" }], ["retired couple", ret(), { top: "taxable-first|0.22@rmd", E: 907032, asIs: 888771, gain: 18261, lead: "better" }]]) {
    const r = MIX.mixes(plan, { today: T22 });
    const hand = handRanking(plan, r.grid);
    // every run is the hand-made one, to a millionth of a dollar
    for (const h of hand) {
      const c = r.grid.cells.find((x) => x.key === h.key), f = r.runs.get(MIX.runKey(r.grid, c));
      near(f.endAfterTaxReal, h.E, 1e-6); near(f.taxesReal, h.T, 1e-6); near(f.convertedReal, h.C, 1e-6); assert.equal(f.success, h.ok, `${name} ${h.key}`);
    }
    // the best is the hand ranking's first (the five orders tie for the couple: the plan's own order stands for them)
    assert.equal(Math.round(r.top.endAfterTaxReal), Math.round(hand[0].E), name); assert.equal(Math.round(r.top.endAfterTaxReal), expect.E, name);
    assert.equal(r.top.key, expect.top, name); assert.equal(r.lead, expect.lead); assert.equal(r.gain, expect.gain);
    assert.equal(Math.round(r.asIs.endAfterTaxReal), expect.asIs, name);
    // the plan as it is is the Withdrawal order page's own row for its order, to the cent
    const d = compute(plan, { today: T22 });
    near(r.asIs.endAfterTaxReal, d.options.find((o) => o.current).endAfterTaxReal, 1e-6); near(r.asIs.taxesReal, d.options.find((o) => o.current).taxesReal, 1e-6);
  }
});

test("x2 ranking: the five orders against the Roth page and the order page, for both households", async () => {
  const { compute: roth } = await import("../roth-conversions/compute.js");
  for (const plan of [fam(), ret()]) {
    const r = MIX.mixes(plan, { today: T22 });
    const rc = roth(plan, { today: T22 });
    for (const o of rc.options.filter((x) => x.fillRate !== 0.24)) {
      const c = r.grid.cells.find((x) => x.key === `taxable-first|${MIX.convKey(o.fillRate ? { fillRate: o.fillRate, untilAge: null } : null)}`);
      near(r.runs.get(MIX.runKey(r.grid, c)).endAfterTaxReal, o.endAfterTaxReal, 1e-6);
    }
    // the orders with no conversions are the order page's rows: these plans' health cover does not move with the order
    const d = compute(plan, { today: T22 });
    for (const o of [...d.options, d.share]) near(r.runs.get(MIX.runKey(r.grid, r.grid.cells.find((x) => x.key === `${o.key}|off`))).endAfterTaxReal, o.endAfterTaxReal, 1e-6);
  }
});

test("x2 F1: health cover priced on income is priced on each mix's own income; the five orders above price it once, on the plan's own order", async () => {
  // critic of x2, F1: the README said each order with nothing moved equals the page's row; true only where health cover does not move
  // with the order. The stay-at-home parent of qa/households 05 (Medicare's surcharge and the marketplace): her own order (taxable
  // first) is the same; Roth first runs out in 2058 here, 2059 on the page, whose health line is priced once on the plan's own order
  // (compute.js, untouched)
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const plan = migrate(ARCHETYPES.find((a) => a.id === "05-stay-at-home-parent").build());
  const r = MIX.mixes(plan, { today: T22 }), d = compute(plan, { today: T22 });
  const cell = (k) => r.runs.get(MIX.runKey(r.grid, r.grid.cells.find((x) => x.key === k)));
  const page = (k) => d.options.find((o) => o.key === k);
  // the plan's own order is the page's row, to the cent
  near(cell("taxable-first|off").taxesReal, page("taxable-first").taxesReal, 1e-6); assert.equal(cell("taxable-first|off").failYear, page("taxable-first").failYear);
  // Roth first: the mix's run is the engine's on the plan with Roth first saved (health priced on that run's own income), made by hand
  const h = byHand(plan, ["free", "taxable", "deferred"], null);
  near(cell("roth-first|off").taxesReal, h.T, 1e-6); assert.equal(cell("roth-first|off").failYear, h.fail);
  assert.equal(h.fail, 2058); assert.equal(page("roth-first").failYear, 2059, "the page's row prices health on the plan's own order");
  // it is never one of the rows the part lists (every mix runs out: only those that last longer than the plan as it is)
  assert.ok(![r.asIs, ...r.shown].some((x) => x.key === "roth-first|off"));
  // and the method says so (under "How this is worked out")
  assert.ok(MIX.triedWords(r.grid).includes("with health insurance priced on that mix's own income"));
});

test("x2 ties: runs the same in effect are one row, the simplest; the plan as it is wins a tie and is never offered", () => {
  const g = MIX.mixGrid(fam(), { today: T22 });
  const f = (E, T, C = 0, ok = true, fail = null) => ({ success: ok, failYear: fail, endAfterTaxReal: E, endBalanceReal: E, taxesReal: T, convertedReal: C });
  // every mix leaves the same: one row, the plan as it is, and "None ... leaves more"
  const same = new Map(MIX.runsNeeded(g).map((x) => [x.rk, f(500000, 90000)]));
  const r1 = MIX.rankMixes(g, same);
  assert.equal(r1.ranked.length, 1); assert.equal(r1.top, r1.asIs); assert.equal(r1.lead, "yours"); assert.deepEqual(r1.others, []); assert.equal(r1.better.size, 0);
  assert.equal(MIX.leadWords(r1, usd), "None of the 35 mixes we tried leaves more than your plan as it is.");
  // two mixes tie for the best: the one with fewer changes (the plan's own order, conversions on) stands for both
  const two = new Map(same);
  two.set(MIX.runKey(g, g.cells.find((c) => c.key === "roth-first|0.12@rmd")), f(520000, 80000, 10000));
  two.set(MIX.runKey(g, g.cells.find((c) => c.key === "taxable-first|0.12@rmd")), f(520000.4, 80000.3, 10000.2));
  const r2 = MIX.rankMixes(g, two);
  assert.equal(r2.top.key, "taxable-first|0.12@rmd"); assert.equal(r2.top.changes, 1);
  assert.ok(!r2.ranked.some((x) => x.key === "roth-first|0.12@rmd"), "the twin is not shown again");
  assert.equal(r2.lead, "better"); assert.equal(r2.gain, 20000); assert.ok(r2.better.has("taxable-first|0.12@rmd"));
  // same left at the end, less tax: ranked above, but nothing that leaves more, so not offered
  const t = new Map(same);
  t.set(MIX.runKey(g, g.cells.find((c) => c.key === "deferred-first|off")), f(500000, 85000));
  const r3 = MIX.rankMixes(g, t);
  assert.equal(r3.top.key, "deferred-first|off"); assert.equal(r3.lead, "barely"); assert.equal(r3.better.size, 0);
  assert.equal(MIX.rowWords(r3.top, r3.asIs, usd), "Nothing moved to a Roth. The same left at the end; $5,000 less tax over the plan.");
  // the real retired couple: the five orders give the same with 22% conversions; the plan's own order stands for them, once
  const rc = MIX.mixes(ret(), { today: T22 });
  assert.equal(rc.top.key, "taxable-first|0.22@rmd");
  for (let i = 0; i < rc.ranked.length; i++) for (let j = i + 1; j < rc.ranked.length; j++) assert.ok(!MIX.sameInEffect(rc.ranked[i], rc.ranked[j]), `${rc.ranked[i].key} = ${rc.ranked[j].key}`);
  assert.ok(rc.ranked.length < 20, `${rc.ranked.length} distinct of 20`);
});

test("x2 nothing to convert: the renter and a couple past required withdrawals get no part; the search would be the five orders above", async () => {
  const s = await drawOrder(renterDebtPlan());
  assert.ok(!s.parts().includes("mix"), JSON.stringify(s.parts()));
  const old = retiredCouplePlan(T22); old.household.people[0].birthDate = "1950-03-10";
  const t = await drawOrder(old);
  assert.ok(!t.parts().includes("mix"), JSON.stringify(t.parts()));
  const r = MIX.mixes(migrate(renterDebtPlan()), { today: T22 });
  assert.equal(r.tried, 5); assert.equal(r.convert, false); assert.equal(MIX.moveWords(r), "", "no 'other income fills the room' when there is nothing to convert");
});

test("x2 the part: one quiet row before the method; nothing runs until it opens; then slices, the answer, Use this mix (asked first) and Undo", async () => {
  const p0 = familyPlan(T22);
  const s = await drawOrder(p0);
  const before = JSON.stringify(s.p);
  // the first view: the row's title only; nothing worked out yet
  const part = mixPartOf(s);
  assert.equal(part.dataset.kind, "own"); assert.equal(part.hasAttribute("open"), false);
  assert.equal(part.querySelector(".fold-title").textContent, "Try Roth conversions too");
  assert.ok(!part.all().some((e) => e.tagName === "INPUT" || e.tagName === "SELECT" || e.tagName === "TEXTAREA"), "no box: a pick from a list (R24 pin)");
  assert.equal(VIEW.searched(s.p, T22), null, "no run before the part is opened");
  // opened: the runs are worked out a slice at a time (SLICE_MS), the phone gets a turn between slices
  const real = globalThis.setTimeout; let slices = 0;
  globalThis.setTimeout = (fn, ms, ...a) => { slices++; return real(fn, ms, ...a); };
  try {
    openMix(s);
    assert.ok(s.text().includes("Trying 35 mixes of order and Roth conversions..."), "said while it works");
    await VIEW.searchDone();
  } finally { globalThis.setTimeout = real; }
  assert.ok(slices >= 2, `${slices} slices`); assert.equal(VIEW.SLICE_MS, 25);
  const t = s.text();
  // what a Roth conversion is, first (P3); the answer; the rows in plain words with the age required withdrawals begin at (P3); the
  // best row's pill says what it is best at (P1: the hero's "best" is the best order alone)
  const pt = part.textContent;
  assert.ok(pt.includes(`${MIX.ROTH_WORDS}The best of the 35 mixes we tried leaves about $874,277 at the end, after tax and in today's dollars: $37,733 more than your plan as it is.`), pt);
  assert.ok(t.includes("Taxable, then pre-tax, then Rothyour plan$836,544Nothing moved to a Roth. Tax over the plan $174,664."), t);
  assert.ok(t.includes("Roth, then taxable, then pre-taxbest with conversions$874,277Money moved to a Roth each year up to the 12% tax rate, until age 75, when required withdrawals begin. $37,733 more left at the end; $37,674 less tax over the plan.Use this mix"), t);
  // two rows of the same order say which stop each has, on its own line under the order's name (recheck leftover y2 (e); fix P3)
  assert.ok(t.includes("A share from every accountWith Roth conversions until age 70$863,788Money moved to a Roth each year up to the 12% tax rate, until age 70. $27,244 more left at the end; $25,566 less tax over the plan."), t);
  assert.equal(part.all().filter((e) => /\bpill\b/.test(e.className) && /^best/.test(e.textContent)).length, 1, "one best");
  // the method is under "How this is worked out", not between the rows and the next part (P5): what was tried, why gains at 0% are
  // not in it with its link, and on this flat-rate plan with nothing moved, that the figures use the real rates
  const gridNow = MIX.mixGrid(s.p, { today: T22 });
  for (const w of [MIX.triedWords(gridNow), MIX.GAINS_WORDS, MIX.FLAT_MIX_WORDS, MIX.FLAT_CONV_WORDS]) assert.ok(!pt.includes(w), w);
  assert.equal(part.all().filter((e) => e.tagName === "P").length, 2, "what a Roth conversion is and the answer; the rest is in the list");
  const how = s.root.all().find((e) => e.dataset?.part === "how");
  how.open = true; how.dispatch("toggle");
  const ht = how.textContent;
  assert.ok(ht.includes(MIX.triedWords(gridNow)) && ht.includes(MIX.GAINS_WORDS) && ht.includes(MIX.FLAT_MIX_WORDS), ht);
  const link = how.all().find((e) => e.tagName === "A" && /tax-free/.test(e.textContent));
  assert.equal(link.getAttribute("href"), "#/taxes/projection?show=gains");
  how.open = false; how.dispatch("toggle");
  const uses = () => s.root.all().filter((e) => e.tagName === "BUTTON" && e.textContent === "Use this mix");
  assert.equal(uses().length, 3); assert.ok(uses().every((b) => /secondary/.test(b.className)), "outlined: the hero's button stays the one filled");
  assert.equal(s.saved.length, 0, "opening and searching saved nothing");
  // asked first: "no" saves nothing
  const ask = window.confirm; let asked = "";
  window.confirm = (q) => { asked = q; return false; };
  try { uses()[0].click(); } finally { window.confirm = ask; }
  assert.equal(asked, 'Use this mix? Your plan will take money out in the order "Roth, then taxable, then pre-tax" and move money to a Roth each year up to the 12% tax rate, until age 75, when required withdrawals begin. It will also work out tax at the real rates, which changes the figures on every retirement page. You can undo it.');
  assert.equal(s.saved.length, 0);
  // "yes": one change, the order and the conversion and the real rates, nothing else
  uses()[0].click();
  assert.equal(s.saved.length, 1);
  assert.deepEqual(s.p.retirement.withdrawalOrder, ["free", "taxable", "deferred"]);
  assert.deepEqual(s.p.retirement.rothConversion, { on: true, fillRate: 0.12, untilAge: null });
  assert.equal(s.p.retirement.taxMode, "brackets");
  const strip = (p) => { const c = structuredClone(p); delete c.meta; for (const k of ["withdrawalOrder", "taxMode", "rothConversion", "withdrawalSplit"]) delete c.retirement[k]; return JSON.stringify(c); };
  assert.equal(strip(s.p), strip(JSON.parse(before)), "nothing else is saved");
  // the green line names the new answer, outside the parts; the part stays open, the others as they were (R17); the answer is there at once
  const line = s.root.all().find((e) => /\bnotice\b/.test(e.className) && /\bok\b/.test(e.className));
  assert.equal(line.firstChild.textContent, 'Saved: your plan now takes money out in the order "Roth, then taxable, then pre-tax" and moves money to a Roth each year up to the 12% tax rate, until age 75, when required withdrawals begin. It leaves about $874,277 at the end, after tax and in today\'s dollars. Tax is now worked out at the real rates, so every retirement page\'s figures change with it.');
  assert.ok(!s.root.all().filter((e) => e.tagName === "DETAILS").some((d) => d.all().includes(line)), "outside the parts");
  const state = () => s.root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.hasAttribute("open")]);
  assert.deepEqual(state(), [["orders", false], ["mix", true], ["how", false]]);
  // a share from every account pays from the plan's own order what comes in during a year: its seven runs are made again for the new
  // order (the other 28 are kept); then the answer
  assert.ok(s.text().includes("Trying 35 mixes of order and Roth conversions..."));
  await VIEW.searchDone();
  assert.ok(s.text().includes("None of the 35 mixes we tried leaves more than your plan as it is."), s.text());
  // a row of the same order with another stop is listed too, so the title says the stop (recheck leftover y2 (e); fix P3)
  assert.ok(s.text().includes("Roth, then taxable, then pre-taxWith Roth conversions until age 75your plan$874,277"), s.text());
  // the five orders: Roth first is now the best for this plan, and its row no longer says "the usual worst" beside "best" (P2); one
  // pill, "your plan, the best", not "best" and "your plan" side by side (y2 fix round, critic P4)
  const roRow = s.root.all().find((e) => e.tagName === "LI" && e.textContent.startsWith("Roth, then taxable, then pre-taxyour plan, the best$"));
  assert.ok(roRow, s.text().slice(0, 1200));
  assert.ok(roRow.textContent.includes("Spends the tax-free money first: usually the worst order, but the best for this plan. Left at the end after tax"), roRow.textContent);
  assert.ok(!/usual worst/.test(roRow.textContent));
  // Undo: the plan as it was, byte for byte; said; the part still open
  const undo = line.all().find((e) => e.tagName === "BUTTON" && e.textContent === "Undo");
  undo.click();
  assert.equal(JSON.stringify({ ...s.p, meta: null }), JSON.stringify({ ...JSON.parse(before), meta: null }));
  assert.ok(s.text().includes("Back to your plan as it was, with the flat tax rate."), s.text().slice(0, 900));
  assert.deepEqual(state(), [["orders", false], ["mix", true], ["how", false]]);
  assert.ok(s.text().includes("The best of the 35 mixes we tried leaves about $874,277"), "the first answer again, at once: every run of the plan as it was is kept");
});

test("x2 S11: Use this mix on a plan already on the real rates: only the order and conversions change, the saved part stays open", async () => {
  const p0 = familyPlan(T22); p0.retirement = { ...(p0.retirement ?? {}), taxMode: "brackets" };
  const s = await drawOrder(p0);
  openMix(s); await VIEW.searchDone();
  const share = s.root.all().filter((e) => e.tagName === "LI" && e.textContent.startsWith("A share from every accountWith Roth conversions until age 75$873,681"))[0];
  assert.ok(share, s.text());
  share.all().find((e) => e.tagName === "BUTTON" && e.textContent === "Use this mix").click();
  assert.equal(s.p.retirement.withdrawalSplit, "proportional"); assert.deepEqual(s.p.retirement.withdrawalOrder, ["taxable", "deferred", "free"], "the order is kept");
  assert.deepEqual(s.p.retirement.rothConversion, { on: true, fillRate: 0.12, untilAge: null });
  const line = s.root.all().find((e) => /\bnotice\b/.test(e.className) && /\bok\b/.test(e.className));
  assert.equal(line.firstChild.textContent, "Saved: your plan now takes a share from every account and moves money to a Roth each year up to the 12% tax rate, until age 75, when required withdrawals begin. It leaves about $873,681 at the end, after tax and in today's dollars.");
  assert.deepEqual(s.root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.hasAttribute("open")]), [["orders", false], ["mix", true], ["how", false]]);
  line.all().find((e) => e.tagName === "BUTTON" && e.textContent === "Undo").click();
  assert.equal("withdrawalSplit" in s.p.retirement, false); assert.equal(s.p.retirement.rothConversion.on, false); assert.equal(s.p.retirement.taxMode, "brackets");
  assert.ok(s.text().includes("Back to your plan as it was."));
});

test("x2 the part on three plans: the retired couple's best pays more tax and says why; a flat plan with conversions saved says why its own figure differs", async () => {
  // the retired couple (P4): the best moves money at the 22% rate and pays more tax over the plan; its row says it still leaves more
  const c = await drawOrder(retiredCouplePlan(T22));
  const cp = openMix(c); await VIEW.searchDone();
  assert.ok(cp.textContent.includes("best with conversions$907,032Money moved to a Roth each year up to the 22% tax rate, until age 73, when required withdrawals begin. Pays $7,790 more tax over the plan, yet leaves $18,261 more at the end, after tax."), cp.textContent);
  // a flat-rate plan with conversions saved (F2): the five orders above leave them out ($836,544 on the plan's own row), "your plan"
  // here has them ($842,697): said in the part, before the rows; not again under "How this is worked out"
  const p0 = familyPlan(T22); p0.retirement = { ...(p0.retirement ?? {}), rothConversion: { on: true, fillRate: 0.12, untilAge: null } };
  const f = await drawOrder(p0);
  const fp = openMix(f); await VIEW.searchDone();
  const ft = fp.textContent;
  assert.ok(ft.includes(`${MIX.FLAT_CONV_WORDS}Taxable, then pre-tax, then Rothyour plan$842,697Money moved to a Roth each year up to the 12% tax rate, until age 75, when required withdrawals begin. Tax over the plan`), ft);
  assert.ok(f.root.all().find((e) => e.dataset?.part === "orders").parentNode.textContent.includes("Taxable, then pre-tax, then Rothyour plan$836,544"), "the five orders' row, without the conversions");
  const how = f.root.all().find((e) => e.dataset?.part === "how"); how.open = true; how.dispatch("toggle");
  assert.ok(!how.textContent.includes(MIX.FLAT_MIX_WORDS) && !how.textContent.includes(MIX.FLAT_CONV_WORDS), how.textContent);
  // the same plan on the real rates: the two "your plan" figures are one, and nothing about the flat rate is said
  const b0 = structuredClone(p0); b0.retirement.taxMode = "brackets";
  const b = await drawOrder(b0);
  const bp = openMix(b); await VIEW.searchDone();
  assert.ok(!bp.textContent.includes(MIX.FLAT_CONV_WORDS) && bp.textContent.includes("your plan$842,697"), bp.textContent);
  assert.equal(f.saved.length + b.saved.length + c.saved.length, 0);
});

test("x2 P2: the order marked best never says it is the usual worst; every other note is as it was", () => {
  const rf = { key: "roth-first", note: "the usual worst: spends the tax-free money first" };
  assert.equal(VIEW.noteWords(rf, true), "Spends the tax-free money first: usually the worst order, but the best for this plan");
  assert.equal(VIEW.noteWords(rf, false), "The usual worst: spends the tax-free money first");
  const tf = { key: "taxable-first", note: "the textbook order: let tax-sheltered money grow longest" };
  assert.equal(VIEW.noteWords(tf, true), "The textbook order: let tax-sheltered money grow longest");
});

test("x2 chooseMix writes through the two pages' own paths: a stop, conversions off, and the share", () => {
  const g = MIX.mixGrid(fam(), { today: T22 });
  const cell = (k) => g.cells.find((c) => c.key === k);
  const a = fam(); MIX.chooseMix(a, cell("deferred-first|0.22@70"), { withRates: false });
  assert.deepEqual(a.retirement.withdrawalOrder, ["deferred", "taxable", "free"]); assert.deepEqual(a.retirement.rothConversion, { on: true, fillRate: 0.22, untilAge: 70 }); assert.equal(a.retirement.taxMode, "brackets");
  // conversions off: "Turn conversions off" ({ ...rc, on: false }) only when they were on; the order alone on a flat plan, with the rates when asked
  const b = fam(); b.retirement.rothConversion = { on: true, fillRate: 0.12, untilAge: 70 };
  MIX.chooseMix(b, cell("roth-last-taxable|off"), { withRates: true });
  assert.deepEqual(b.retirement.rothConversion, { on: false, fillRate: 0.12, untilAge: 70 }); assert.equal(b.retirement.taxMode, "brackets");
  const c = fam(); const rc0 = JSON.stringify(c.retirement.rothConversion);
  MIX.chooseMix(c, cell("deferred-first|off"), { withRates: false });
  assert.equal(JSON.stringify(c.retirement.rothConversion), rc0, "already off: not written"); assert.equal(c.retirement.taxMode ?? "flat", "flat");
  // the stop back to "until required withdrawals begin": the box's null
  const d = fam(); d.retirement.rothConversion = { on: true, fillRate: 0.12, untilAge: 70 };
  MIX.chooseMix(d, cell("taxable-first|0.12@rmd"));
  assert.deepEqual(d.retirement.rothConversion, { on: true, fillRate: 0.12, untilAge: null });
});

test("x2 words: one sentence per case", () => {
  const x = (E, T, extra = {}) => ({ success: true, failYear: null, endAfterTaxReal: E, taxesReal: T, convertedReal: 0, conv: null, order: { label: "Taxable, then pre-tax, then Roth" }, asIs: false, ...extra });
  const runs = (y, extra = {}) => x(0, 0, { success: false, failYear: y, ...extra });
  const base = { tried: 35, converts: true, convert: true };
  // the first sentence
  assert.equal(MIX.leadWords({ ...base, lead: "better", top: x(874277, 0), gain: 37733 }, usd), "The best of the 35 mixes we tried leaves about $874,277 at the end, after tax and in today's dollars: $37,733 more than your plan as it is.");
  assert.equal(MIX.leadWords({ ...base, lead: "barely", top: x(1, 0), gain: 300 }, usd), "The best of the 35 mixes we tried leaves about as much as your plan as it is: for this plan the mix barely matters.");
  assert.equal(MIX.leadWords({ ...base, lead: "yours" }, usd), "None of the 35 mixes we tried leaves more than your plan as it is.");
  assert.equal(MIX.leadWords({ ...base, lead: "rescues", top: x(612400, 0), asIs: runs(2061) }, usd), "The best of the 35 mixes we tried lasts to the end of your plan and leaves about $612,400, after tax and in today's dollars; your plan as it is runs out in 2061.");
  assert.equal(MIX.leadWords({ ...base, lead: "fails-longer", top: runs(2065), asIs: runs(2064) }, usd), "None of the 35 mixes we tried lasts to the end of your plan. With the best, the money runs out in 2065 instead of 2064.");
  assert.equal(MIX.leadWords({ ...base, lead: "fails-yours", top: runs(2059), asIs: runs(2059) }, usd), "None of the 35 mixes we tried lasts to the end of your plan, or longer than your plan as it is: the money runs out in 2059.");
  assert.equal(MIX.leadWords({ ...base, lead: "fails-same", top: runs(2051) }, usd), "Every one of the 35 mixes we tried runs out in 2051: the order and Roth conversions cannot change that.");
  assert.equal(MIX.moveWords({ converts: false, convert: true }), "At these rates your other income already fills the room, so no mix moves money to a Roth.");
  assert.equal(MIX.moveWords({ converts: true, convert: true }), "");
  // a row against the plan as it is (P3: plain words for a conversion, the age required withdrawals begin at; P4: more tax, yet more left)
  const mine = x(836544, 174664, { asIs: true });
  assert.equal(MIX.rowWords(mine, mine, usd), "Nothing moved to a Roth. Tax over the plan $174,664.");
  assert.equal(MIX.rowWords({ ...runs(2064), asIs: true }, mine, usd), "Nothing moved to a Roth.");
  assert.equal(MIX.rowWords(x(874277, 136990, { conv: { fillRate: 0.12, untilAge: null } }), mine, usd, 75), "Money moved to a Roth each year up to the 12% tax rate, until age 75, when required withdrawals begin. $37,733 more left at the end; $37,674 less tax over the plan.");
  assert.equal(MIX.rowWords(x(874277, 136990, { conv: { fillRate: 0.12, untilAge: null } }), mine, usd), "Money moved to a Roth each year up to the 12% tax rate, until required withdrawals begin. $37,733 more left at the end; $37,674 less tax over the plan.", "no age at hand");
  assert.equal(MIX.rowWords(x(835000, 180000, { conv: { fillRate: 0.1, untilAge: 70 } }), mine, usd, 75), "Money moved to a Roth each year up to the 10% tax rate, until age 70. $1,544 less left at the end; $5,336 more tax over the plan.");
  // the retired couple's best: $18,261 more left for $7,790 more tax (its tax here is a round stand-in; the difference is the couple's)
  assert.equal(MIX.rowWords(x(907032, 107790, { conv: { fillRate: 0.22, untilAge: null } }), x(888771, 100000, { asIs: true }), usd, 73), "Money moved to a Roth each year up to the 22% tax rate, until age 73, when required withdrawals begin. Pays $7,790 more tax over the plan, yet leaves $18,261 more at the end, after tax.");
  assert.equal(MIX.rowWords(x(836544, 174664), mine, usd), "Nothing moved to a Roth. The same left at the end; the same tax over the plan.");
  assert.equal(MIX.rowWords(x(500000, 1), { ...runs(2061), asIs: true }, usd), "Nothing moved to a Roth. Lasts to the end of your plan.");
  assert.equal(MIX.rowWords(runs(2061), mine, usd), "Nothing moved to a Roth. Runs out in 2061.");
  assert.equal(MIX.rowWords(runs(2066), { ...runs(2064), asIs: true }, usd), "Nothing moved to a Roth. Lasts 2 years longer.");
  assert.equal(MIX.rowWords(runs(2063), { ...runs(2064), asIs: true }, usd), "Nothing moved to a Roth. Runs out 1 year sooner.");
  assert.equal(MIX.rowWords(runs(2064), { ...runs(2064), asIs: true }, usd), "Nothing moved to a Roth. Runs out the same year.");
  // the best row's pill (P1): it never reads as a second answer to the hero's question about the order alone
  assert.equal(MIX.bestWords(x(1, 0, { conv: { fillRate: 0.12, untilAge: null } })), "best with conversions");
  assert.equal(MIX.bestWords(x(1, 0)), "best mix");
  assert.equal(MIX.ROTH_WORDS, "Moving money from your regular retirement account to a Roth account is a Roth conversion: you pay tax on it now, and later withdrawals are tax-free.");
  assert.equal(MIX.valueWords(x(874277, 0), usd), "$874,277"); assert.equal(MIX.valueWords(runs(2061), usd), "runs out 2061");
  assert.equal(MIX.orderTitle({ key: "custom", label: null }), "Your own order");
  // what was tried (under "How this is worked out", P5), with the health clause (F1)
  const g = MIX.mixGrid(fam(), { today: T22 });
  assert.equal(MIX.triedWords(g), "For \"Try Roth conversions too\" we tried 35 mixes: the five orders, each with nothing moved to a Roth or with money moved each year up to the 10%, 12% or 22% tax rate, until age 70 or until age 75, when required withdrawals begin. Each runs your whole plan year by year at the real tax rates and the same spending every year, with health insurance priced on that mix's own income; what is left is counted after tax, in today's dollars.");
  const p62 = fam(); p62.household.people[0].retirementAge = 62;
  assert.ok(MIX.triedWords(MIX.mixGrid(p62, { today: T22 })).startsWith("For \"Try Roth conversions too\" we tried 50 mixes: the five orders, each with nothing moved to a Roth or with money moved each year up to the 10%, 12% or 22% tax rate, until age 63, until age 70 or until age 75, when required withdrawals begin."));
  assert.ok(MIX.triedWords(MIX.mixGrid(ret(), { today: T22 })).startsWith("For \"Try Roth conversions too\" we tried 20 mixes: the five orders, each with nothing moved to a Roth or with money moved each year up to the 10%, 12% or 22% tax rate, until age 73, when required withdrawals begin. Each"));
  assert.ok(MIX.triedWords(MIX.mixGrid(migrate(renterDebtPlan()), { today: T22 })).startsWith("For \"Try Roth conversions too\" we tried 5 mixes: the five orders, with nothing moved to a Roth. Each"));
  assert.equal(MIX.busyWords(g), "Trying 35 mixes of order and Roth conversions...");
  // on a flat-rate plan (F2): with nothing moved, under "How this is worked out"; with conversions saved, in the part, beside "your plan"
  assert.equal(MIX.ownConverts(g), false);
  const fc = fam(); fc.retirement.rothConversion = { on: true, fillRate: 0.12, untilAge: null };
  assert.equal(MIX.ownConverts(MIX.mixGrid(fc, { today: T22 })), true);
  const f60 = fam(); f60.retirement.rothConversion = { on: true, fillRate: 0.12, untilAge: 60 };
  assert.equal(MIX.ownConverts(MIX.mixGrid(f60, { today: T22 })), false, "a stop before the first retired year moves nothing");
  assert.equal(MIX.FLAT_MIX_WORDS, "Your plan works out tax at one flat rate. These figures use the real rates, and \"Use this mix\" turns them on too.");
  assert.equal(MIX.FLAT_CONV_WORDS, "Your plan works out tax at one flat rate, so its Roth conversions do not run yet and the five orders above leave them out. Here they run, at the real rates; \"Use this mix\" turns those on too.");
  // asked first, the green line and after Undo
  const share = { order: { key: "proportional", label: "A share from every account", split: true }, conv: null, success: true, endAfterTaxReal: 840251 };
  assert.equal(MIX.confirmMixWords(share), "Use this mix? Your plan will take a share from every account and move nothing to a Roth. You can undo it.");
  assert.equal(MIX.confirmMixWords({ order: { label: "Pre-tax, then taxable, then Roth" }, conv: { fillRate: 0.22, untilAge: 70 } }, { withRates: true }), 'Use this mix? Your plan will take money out in the order "Pre-tax, then taxable, then Roth" and move money to a Roth each year up to the 22% tax rate, until age 70. It will also work out tax at the real rates, which changes the figures on every retirement page. You can undo it.');
  assert.equal(MIX.confirmMixWords({ order: { label: "Pre-tax, then taxable, then Roth" }, conv: { fillRate: 0.12, untilAge: null } }, { rmdAge: 75 }), 'Use this mix? Your plan will take money out in the order "Pre-tax, then taxable, then Roth" and move money to a Roth each year up to the 12% tax rate, until age 75, when required withdrawals begin. You can undo it.');
  assert.equal(MIX.savedMixWords(share, { money: usd }), "Saved: your plan now takes a share from every account and moves nothing to a Roth. It leaves about $840,251 at the end, after tax and in today's dollars.");
  assert.equal(MIX.savedMixWords({ ...share, success: false, failYear: 2069, conv: { fillRate: 0.1, untilAge: 63 } }, { money: usd, withRates: true }), "Saved: your plan now takes a share from every account and moves money to a Roth each year up to the 10% tax rate, until age 63. The money still runs out, in 2069. Tax is now worked out at the real rates, so every retirement page's figures change with it.");
  assert.equal(MIX.backMixWords(), "Back to your plan as it was.");
  assert.equal(MIX.backMixWords({ withRates: true }), "Back to your plan as it was, with the flat tax rate.");
  assert.equal(MIX.convWords(null), "Nothing moved to a Roth");
  assert.equal(MIX.MIX_TITLE.split(" ").length, 4, "two to four words (R24's pin)");
});

test("x2 the plans that run out: the rows that last no longer are left out; a mix that lasts a year longer is offered", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const couple = ARCHETYPES.find((a) => a.id === "02-couple-no-kids").build();
  const r = MIX.mixes(migrate(couple), { today: T22 });
  assert.equal(r.lead, "fails-longer"); assert.equal(r.shown.length, 1); assert.equal(r.shown[0].key, "proportional|off"); assert.ok(r.better.has("proportional|off"));
  assert.equal(MIX.leadWords(r, usd), "None of the 35 mixes we tried lasts to the end of your plan. With the best, the money runs out in 2065 instead of 2064.");
  const single = MIX.mixes(migrate(ARCHETYPES.find((a) => a.id === "03-single-parent").build()), { today: T22 });
  assert.equal(single.lead, "fails-same"); assert.equal(single.listed, false); assert.deepEqual(single.shown, []);
});

test("x2 invariance: drawing the page, opening the part and letting the search finish saves nothing; mixes() never changes the plan it reads", async () => {
  for (const p of [familyPlan(T22), retiredCouplePlan(T22)]) {
    const s = await drawOrder(p);
    const was = JSON.stringify(s.p);
    openMix(s); await VIEW.searchDone();
    const d = mixPartOf(s); d.open = false; d.dispatch("toggle"); d.open = true; d.dispatch("toggle");
    assert.equal(s.saved.length, 0); assert.equal(JSON.stringify(s.p), was);
    const copy = migrate(structuredClone(p)), before = JSON.stringify(copy);
    MIX.mixes(copy, { today: T22 });
    assert.equal(JSON.stringify(copy), before);
  }
  // the search's key leaves out only what every run sets itself, and the plan's stamp
  const a = fam(), b = fam();
  b.meta.updatedAt = "2030-01-01"; b.retirement.taxMode = "brackets"; b.retirement.withdrawalOrder = ["free", "taxable", "deferred"]; b.retirement.rothConversion = { on: true, fillRate: 0.12, untilAge: 70 };
  assert.equal(VIEW.searchKey(a, T22), VIEW.searchKey(b, T22));
  b.retirement.spendingMonthly = 4321;
  assert.notEqual(VIEW.searchKey(a, T22), VIEW.searchKey(b, T22));
  assert.notEqual(VIEW.searchKey(a, T22), VIEW.searchKey(a, "2027-01-02"));
});

test("x2 a change of order while the search runs: each run is made on the plan that asked for it", async () => {
  // the plan's own setting is none of the cells (conversions at the 24% rate), so the plan as it is is a run of its own, and the
  // order changed mid-search changes it
  const p0 = familyPlan(T22); p0.retirement = { ...(p0.retirement ?? {}), taxMode: "brackets", rothConversion: { on: true, fillRate: 0.24, untilAge: null } };
  const s = await drawOrder(p0);
  openMix(s);
  // before the runs are done, "Use this order" on pre-tax first (inside "3 more orders"): the page draws again, the part with it
  s.root.all().find((e) => e.dataset?.part === "orders").all().find((e) => e.tagName === "BUTTON" && e.textContent === "Use this order").click();
  assert.deepEqual(s.p.retirement.withdrawalOrder, ["deferred", "taxable", "free"]);
  openMix(s);
  await VIEW.searchDone();
  const fresh = MIX.mixes(migrate(structuredClone(s.p)), { today: T22 });
  const got = VIEW.searched(s.p, T22);
  assert.ok(got, "every run done");
  for (const c of fresh.grid.cells) { const k = MIX.runKey(fresh.grid, c); assert.deepEqual(got.runs.get(k), fresh.runs.get(k), k); }
  assert.equal(fresh.grid.own.inGrid, false);
  assert.equal(got.top.key, fresh.top.key); assert.equal(got.asIs.endAfterTaxReal, fresh.asIs.endAfterTaxReal);
});

// ---------------------------------------------------------------- leftovers of the rechecks (y2, 2026-11-16)
/** Every invented household (y2 invariance, against 398a01e): the qa fixture plans, the qa/households archetypes, the phone,
 *  round 8 and persona households, and the empty plan. */
async function y2Plans(today) {
  const fs = await import("node:fs"), path = await import("node:path"), { fileURLToPath, pathToFileURL } = await import("node:url");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const round8 = await import("../../../qa/fixtures/round8-households.mjs");
  const personas = await import("../../../qa/fixtures/setup-personas.mjs");
  const { migrate, emptyPlan: blank } = await import("../../../core/schema/migrate.js");
  const out = [];
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../qa/fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push([`fixture ${f}:${name}`, fn(today)]);
  }
  for (const a of ARCHETYPES) out.push([`${a.id}/base`, a.build()]);
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push([`phone ${name}`, fn()]);
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) out.push([`round8 ${name}`, fn()]);
  for (const n of ["sam", "jordan", "patLee", "ruth"]) out.push([`persona ${n}`, personas.finishSetup(n, personas[n](today), today)]);
  out.push(["empty plan", blank()]);
  return out.map(([name, p]) => [name, migrate(structuredClone(p))]);
}
const y2Digest = async (x) => (await import("node:crypto")).createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x) ?? "undefined").digest("base64url").slice(0, 22);
const TY2 = "2026-11-16";
/** The rows "Try Roth conversions too" lists, as the page draws them: the plan as it is, then the best ones shown. */
const listedRows = (r) => (r.ready && r.listed ? [r.asIs, ...r.shown] : []);
const titled = (r, rmdAge) => listedRows(r).map((x) => MIX.rowTitle(x, listedRows(r), rmdAge));

// (e) "Try Roth conversions too" listed two rows titled the same, "A share from every account", that differed only in the line
// under them (the family), and four "Taxable, then pre-tax, then Roth" (Ruth). A title says what differs, only where two rows
// share an order.
test("y2 (e) the rows' titles: the order alone, or the order with what differs (conversions or none, the rate, the stop)", () => {
  const order = (label) => ({ key: label, label });
  const row = (label, conv = null, asIs = false) => ({ order: order(label), conv, asIs });
  const A = "A share from every account", T = "Taxable, then pre-tax, then Roth", R = "Roth, then taxable, then pre-tax";
  // no twin: the order's own name, as before (and "Your own order" for an order that is none of the five)
  const single = [row(T, null, true), row(R, { fillRate: 0.12, untilAge: null })];
  assert.deepEqual(single.map((x) => MIX.rowTitle(x, single, 75)), [T, R]);
  const own = { order: { key: "own" }, conv: null };
  assert.equal(MIX.rowTitle(own, [own]), "Your own order");
  // the same rate, two stops (the family): the stop says it
  const fam = [row(T, null, true), row(R, { fillRate: 0.12, untilAge: null }), row(A, { fillRate: 0.12, untilAge: null }), row(A, { fillRate: 0.12, untilAge: 70 })];
  assert.deepEqual(fam.map((x) => MIX.rowTitle(x, fam, 75)), [T, R, `${A}, with Roth conversions until age 75`, `${A}, with Roth conversions until age 70`]);
  assert.equal(MIX.rowTitle(fam[2], fam), `${A}, with Roth conversions until required withdrawals begin`, "no age at hand");
  // three rates and none (Ruth): the rate says it, and the plan as it is says it has none
  const ruth = [row(T, null, true), row(T, { fillRate: 0.22, untilAge: null }), row(T, { fillRate: 0.12, untilAge: null }), row(T, { fillRate: 0.1, untilAge: null })];
  assert.deepEqual(ruth.map((x) => MIX.rowTitle(x, ruth, 73)), [`${T}, with no Roth conversions`, `${T}, with Roth conversions up to the 22% rate`, `${T}, with Roth conversions up to the 12% rate`, `${T}, with Roth conversions up to the 10% rate`]);
  // one with conversions beside one without (Pat and Lee): "with Roth conversions" is all that differs
  const pat = [row(T, null, true), row(T, { fillRate: 0.1, untilAge: null }), row(R, { fillRate: 0.1, untilAge: null })];
  assert.deepEqual(pat.map((x) => MIX.rowTitle(x, pat, 75)), [`${T}, with no Roth conversions`, `${T}, with Roth conversions`, R]);
  // two rates and two stops: each says what tells it from the others
  const both = [row(A, { fillRate: 0.12, untilAge: null }), row(A, { fillRate: 0.12, untilAge: 70 }), row(A, { fillRate: 0.22, untilAge: null })];
  assert.deepEqual(both.map((x) => MIX.rowTitle(x, both, 75)), [`${A}, with Roth conversions up to the 12% rate until age 75`, `${A}, with Roth conversions up to the 12% rate until age 70`, `${A}, with Roth conversions up to the 22% rate`]);
});
test("y2 (e) the family on the page: the two rows of a share from every account say which stop each has", async () => {
  const r = MIX.mixes(fam(), { today: T22 });
  const rows = listedRows(r);
  assert.deepEqual(rows.map((x) => MIX.orderTitle(x.order)), ["Taxable, then pre-tax, then Roth", "Roth, then taxable, then pre-tax", "A share from every account", "A share from every account"], "the case the recheck found");
  assert.deepEqual(titled(r, r.grid.rmdStartAge), ["Taxable, then pre-tax, then Roth", "Roth, then taxable, then pre-tax", "A share from every account, with Roth conversions until age 75", "A share from every account, with Roth conversions until age 70"]);
});

// (e) invariance: with nothing new typed, the mixes "Try Roth conversions too" works out are those of 398a01e for every household,
// and a row no other listed row shares an order with keeps its title. Written with PRINT_Y2=1 on 398a01e's code.
test("y2 (e) invariance: every household's mixes are those of 398a01e; titles change only where two listed rows share an order, and are then all different", async () => {
  const fs = await import("node:fs");
  const file = new URL("./y2-invariance.json", import.meta.url);
  const now = {};
  let twins = 0;
  for (const [name, plan] of await y2Plans(TY2)) {
    let r;
    try { r = MIX.mixes(plan, { today: TY2 }); } catch (e) { now[name] = { mixes: `THROW ${e.message}`, titles: [] }; continue; }
    const { grid, runs, ...rest } = r;
    now[name] = { mixes: await y2Digest(JSON.parse(JSON.stringify({ grid, runs: runs ? [...runs] : null, rest: { ...rest, better: rest.better ? [...rest.better] : null } }))), titles: listedRows(r).map((x) => MIX.orderTitle(x.order)) };
    if (process.env.PRINT_Y2) continue;
    const t = titled(r, grid?.rmdStartAge);
    assert.equal(new Set(t).size, t.length, `${name}: ${t.join(" | ")}`);
    now[name].titles.forEach((was, i) => { if (now[name].titles.filter((x) => x === was).length === 1) assert.equal(t[i], was, `${name}: a row with no twin keeps its title`); else twins++; });
  }
  if (process.env.PRINT_Y2) { fs.writeFileSync(file, `${JSON.stringify({ note: "digests at 398a01e (y2 leftovers); PRINT_Y2=1 writes them again: only on that code", plans: now }, null, 1)}\n`); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8")).plans;
  assert.ok(Object.keys(was).length >= 45, `${Object.keys(was).length} households`);
  assert.deepEqual(now, was);
  assert.ok(twins >= 6, `${twins} rows shared an order with another`);
});

// fix round, critic P3: "Taxable, then pre-tax, then Roth, with Roth conversions up to the 22% rate" wrapped to three lines beside its
// pill on a phone. The order's name stays short and what tells the row apart (tellWords) has its own line under it.
test("y2 (e) fix P3: tellWords is what rowTitle adds; the page shows the order's name, then that on its own line", async () => {
  const order = (label) => ({ key: label, label });
  const row = (label, conv = null, asIs = false) => ({ order: order(label), conv, asIs });
  const T = "Taxable, then pre-tax, then Roth", R = "Roth, then taxable, then pre-tax";
  const ruth = [row(T, null, true), row(T, { fillRate: 0.22, untilAge: null }), row(R, { fillRate: 0.12, untilAge: null })];
  assert.deepEqual(ruth.map((x) => MIX.tellWords(x, ruth, 73)), ["with no Roth conversions", "with Roth conversions", ""]);
  for (const x of ruth) {
    const tell = MIX.tellWords(x, ruth, 73);
    assert.equal(MIX.rowTitle(x, ruth, 73), tell ? `${MIX.orderTitle(x.order)}, ${tell}` : MIX.orderTitle(x.order), "rowTitle is the name and the tell");
  }
  // the family on the page: the two rows of a share from every account each show the name, then their own line
  const p0 = familyPlan(T22); p0.retirement = { ...(p0.retirement ?? {}), taxMode: "brackets" };
  const s = await drawOrder(p0);
  openMix(s); await VIEW.searchDone();
  const tells = s.root.all().filter((e) => e.className === "mix-tell");
  assert.deepEqual(tells.map((e) => e.textContent), ["With Roth conversions until age 75", "With Roth conversions until age 70"]);
  for (const e of tells) {
    assert.equal(e.style.display, "block", "its own line"); assert.equal(e.style.fontWeight, "400", "in the plain weight, under the bold name");
    const title = e.parentNode;
    assert.ok(/\brec-title\b/.test(title.className));
    assert.equal(title.childNodes[0].textContent ?? title.childNodes[0].nodeValue, "A share from every account", "the order's name first, alone");
  }
  // a row whose order is listed once has no such line
  const lis = mixPartOf(s).all().filter((e) => e.tagName === "LI" && /^Roth, then taxable, then pre-tax(best with conversions)?\$/.test(e.textContent));
  assert.equal(lis.length, 1, s.text().slice(0, 600));
  assert.equal(lis[0].all().filter((e) => e.className === "mix-tell").length, 0);
});

// fix round, critic P4: on a plan whose own order is the best, the row of the five orders showed "best" and "your plan" side by side.
test("y2 (e) fix P4: the five orders' pills: best, your plan, or one pill when they are the same row", async () => {
  const ui = await import("../../../core/ui/dom.js");
  const pills = (o, best) => VIEW.orderPills(ui, o, best).map((e) => [e.className, e.textContent]);
  assert.deepEqual(pills({ current: true }, true), [["pill ok", "your plan, the best"]]);
  assert.deepEqual(pills({ current: false }, true), [["pill accent", "best"]]);
  assert.deepEqual(pills({ current: true }, false), [["pill ok", "your plan"]]);
  assert.deepEqual(pills({ current: false }, false), []);
  // the retired couple (the critic's case): their order is the best one; its row has one pill, the hero says so
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const s = await drawOrder(retiredCouplePlan());
  assert.match(s.text(), /^Your order is the best one/);
  const row = s.root.all().find((e) => e.tagName === "LI" && e.textContent.startsWith("Taxable, then pre-tax, then Roth"));
  assert.deepEqual(row.all().filter((c) => /\bpill\b/.test(c.className)).map((c) => c.textContent), ["your plan, the best"]);
});
