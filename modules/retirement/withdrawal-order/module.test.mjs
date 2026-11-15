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
  assert.deepEqual(s.parts(), ["orders", "how"]);
  const first = s.outside();
  assert.ok(first.includes("The five orders") && first.includes("3 more orders") && first.includes("How this is worked out"), first);
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

test("S11: after a save only the saved part changes: the two parts keep their state, the green line and its way back are outside them", async () => {
  const s = await drawOrder(familyPlan(T22));
  const state = () => s.root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.dataset.kind, e.hasAttribute("open")]);
  assert.deepEqual(state(), [["orders", "more", false], ["how", "how", false]], "two parts, shut; no fold by hand");
  // "Use this order" on a row inside "3 more orders" (pre-tax first): the plan takes it, the parts are as they were
  const inside = s.root.all().find((e) => e.dataset?.part === "orders").all().find((e) => e.tagName === "BUTTON" && e.textContent === "Use this order");
  inside.click();
  assert.deepEqual(s.p.retirement.withdrawalOrder, ["deferred", "taxable", "free"]);
  assert.deepEqual(state(), [["orders", "more", false], ["how", "how", false]]);
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
  // every order runs out
  assert.equal(heroWords({ best: { ...share, success: false, failYear: 2064 }, current: tx, five, bracketsOn: true }, money).lede, 'The money runs out under every order; "A share from every account" lasts longest, to 2064. Will the money last? is the place to fix that first.');
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
