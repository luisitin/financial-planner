// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, paysPerYear, PAYS, PAY_MONTHS, spreadMonths, shapeOf, receivedOf, yieldsOf, dividendCategories, ymAdd } from "./compute.js";
import { monthsFor, receivedFor, yieldsFor, statusFor, priceFirst, cellName, MONTHS_TITLE, SPREAD_WORDS, AHEAD_TITLE, YIELD_WORDS } from "./view.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { compute as holdingsOf } from "../holdings/compute.js";

const T = "2026-11-15";
const money = (n) => `$${Math.round(Number(n)).toLocaleString("en-US")}`;
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} is not ${b}`);
const view = new URL("./view.js", import.meta.url);

test("dividends: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// ---------------------------------------------------------------- how often a holding pays
test("paysPerYear: bond funds and cash every month, every other kind every three months; the holding's own paysEvery wins", () => {
  assert.equal(paysPerYear({ cls: "bonds" }), 12);
  assert.equal(paysPerYear({ cls: "cash" }), 12);
  for (const cls of ["us_stocks", "intl_stocks", "real_estate", "balanced", "other", "unknown", undefined]) assert.equal(paysPerYear({ cls }), 4, String(cls));
  assert.equal(paysPerYear({ cls: "bonds", paysEvery: "year" }), 1);
  assert.equal(paysPerYear({ cls: "us_stocks", paysEvery: "month" }), 12);
  assert.equal(paysPerYear({ cls: "us_stocks", paysEvery: "half" }), 2);
  assert.equal(paysPerYear({ cls: "cash", paysEvery: "quarter" }), 4);
  // anything else reads as not said
  for (const odd of ["", "weekly", "constructor", "toString", 4, null]) assert.equal(paysPerYear({ cls: "bonds", paysEvery: odd }), 12, String(odd));
  assert.deepEqual(Object.keys(PAYS), ["month", "quarter", "half", "year"]);
  assert.deepEqual([...PAY_MONTHS[4]], [3, 6, 9, 12]);
  assert.deepEqual([...PAY_MONTHS[2]], [6, 12]);
  assert.deepEqual([...PAY_MONTHS[1]], [12]);
  assert.equal(ymAdd("2026-11", 2), "2027-01");
  assert.equal(ymAdd("2026-01", -1), "2025-12");
  assert.equal(ymAdd("2026-12", -11), "2026-01");
  assert.equal(ymAdd("nope", 1), null);
});

// ---------------------------------------------------------------- the spread over the next twelve months
test("the spread: Sam and Lee's $14,267 a year comes as $3,140.08 in each quarter's last month and $213.33 in the others, adding up to the year", () => {
  const d = compute(investmentsPlan(), { today: T, calendar: true });
  const m = d.calendar.months;
  assert.equal(m.length, 12);
  assert.deepEqual(m.map((x) => x.ym), ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09", "2027-10"]);
  // BND $2,044 and SPAXX $516 pay monthly (2,560 / 12); VTIAX $4,320, FXAIX $3,816, VNQ $2,527, VTI $1,044 quarterly (11,707 / 4)
  near(m[0].amount, 2560 / 12); near(m[1].amount, 2560 / 12 + 11707 / 4);
  for (const x of m) near(x.amount, [3, 6, 9, 12].includes(Number(x.ym.slice(5))) ? 2560 / 12 + 11707 / 4 : 2560 / 12);
  near(m.reduce((s, x) => s + x.amount, 0), d.total);
  assert.equal(d.total, 14267);
  assert.equal(d.calendar.shape, "quarters");
  near(d.calendar.quarter, 3140.0833333); near(d.calendar.other, 213.3333333, 1e-6);
  assert.deepEqual(d.calendar.peak.ym, "2026-12");
  assert.equal(d.calendar.zeroAt, null);
});

test("the spread follows a holding's own paysEvery: VTI once a year puts its $1,044 in December; the year still adds up", () => {
  const p = investmentsPlan(); p.holdings.find((x) => x.symbol === "VTI").paysEvery = "year";
  const d = compute(p, { today: T, calendar: true });
  const m = d.calendar.months, dec = m.find((x) => x.ym === "2026-12"), mar = m.find((x) => x.ym === "2027-03");
  near(dec.amount, 2560 / 12 + (11707 - 1044) / 4 + 1044);
  near(mar.amount, 2560 / 12 + (11707 - 1044) / 4);
  near(m.reduce((s, x) => s + x.amount, 0), 14267);
  assert.equal(d.calendar.shape, "other");
  assert.equal(d.calendar.peak.ym, "2026-12");
  assert.equal(d.calendar.low.ym, "2026-11");
});

test("shapeOf: even, quarters, quarters with nothing between, other with and without a month of nothing, none", () => {
  const at = (items) => shapeOf(spreadMonths(items, T));
  assert.equal(at([{ cls: "bonds", incomeYearly: 1200 }]).shape, "even");
  near(at([{ cls: "bonds", incomeYearly: 1200 }]).every, 100);
  const q = at([{ cls: "us_stocks", incomeYearly: 4000 }]);
  assert.equal(q.shape, "quarters"); near(q.quarter, 1000); near(q.other, 0); assert.equal(q.zeroAt, "2026-11");
  const mix = at([{ cls: "us_stocks", incomeYearly: 4000 }, { cls: "cash", incomeYearly: 1200 }]);
  assert.equal(mix.shape, "quarters"); near(mix.quarter, 1100); near(mix.other, 100);
  const gaps = at([{ cls: "us_stocks", paysEvery: "half", incomeYearly: 600 }]);
  assert.equal(gaps.shape, "other"); assert.equal(gaps.peak.ym, "2026-12"); assert.equal(gaps.zeroAt, "2026-11");
  const full = at([{ cls: "cash", incomeYearly: 1200 }, { cls: "us_stocks", paysEvery: "year", incomeYearly: 500 }]);
  assert.equal(full.shape, "other"); near(full.peak.amount, 600); assert.equal(full.low.ym, "2026-11"); assert.equal(full.zeroAt, null);
  assert.equal(at([]).shape, "none");
  assert.equal(at([{ cls: "bonds", incomeYearly: 0 }]).shape, "none");
  assert.deepEqual(spreadMonths([{ cls: "bonds", incomeYearly: 10 }], "not a day"), []);
});

// ---------------------------------------------------------------- what came in, by the ledger
const line = (id, date, amount, extra = {}) => ({ id, date, amount, payee: "Broker", accountId: "chk", category: "income-investment", tags: [], note: "", ...extra });
test("what came in: money in filed as Dividends and interest, an own Dividends category or a dividend tag, in this month and the eleven before", () => {
  const p = investmentsPlan();
  p.categories = [{ id: "my-divs", label: "Dividends from the fund", kind: "income" }];
  p.transactions = [
    line("a", "2026-06-30", 410),
    line("b", "2026-09-30", 300, { category: "my-divs" }),
    line("c", "2026-10-15", 25, { category: "income-other", tags: ["dividends"] }),
    line("d", "2026-11-02", 15),
    line("e", "2025-11-30", 999),                                   // the twelfth month back: outside the window
    line("f", "2026-08-01", -50),                                   // money out: never
    line("g", "2026-08-03", 700, { category: "transfer" }),         // a transfer: never
    line("h", "2026-08-04", 600, { transferId: "x" }),              // a transfer by its pair: never
    line("i", "2026-08-05", 80, { exclude: true }),                 // left out of the totals: never
    line("j", "2026-08-06", 90, { category: "income-salary" }),     // pay: never
  ];
  assert.ok(dividendCategories(p).has("my-divs") && dividendCategories(p).has("income-investment") && !dividendCategories(p).has("income-salary"));
  const r = receivedOf(p, T);
  assert.equal(r.total, 410 + 300 + 25 + 15);
  assert.equal(r.lines, 4);
  assert.equal(r.months.length, 12);
  assert.equal(r.months[0].ym, "2025-12"); assert.equal(r.months[11].ym, "2026-11");
  assert.equal(r.months.find((x) => x.ym === "2026-06").amount, 410);
  assert.deepEqual(r.peak, { ym: "2026-06", amount: 410 });
  assert.equal(r.since, null, "the ledger starts before the window: a full year");
  // the ledger starts in August 2026: "since"
  const q = investmentsPlan(); q.transactions = [line("x", "2026-08-12", 0.5, { category: "income-salary" }), line("y", "2026-10-30", 120), line("z", "2026-11-01", 30)];
  assert.equal(receivedOf(q, T).since, "2026-08");
  assert.equal(receivedOf(investmentsPlan(), T), null, "no dividend line: nothing came in");
  assert.equal(receivedOf(p, null), null);
});

// ---------------------------------------------------------------- the two yields
test("yields: on what you paid 1.93% beside 1.47% on today's value for Sam and Lee (paid $738,900, worth $969,500, $14,267 a year)", () => {
  const d = compute(investmentsPlan(), { today: T, calendar: true });
  const y = d.calendar.yields;
  assert.equal(y.cost, 738900); assert.equal(y.value, 969500); assert.equal(y.income, 14267);
  near(y.onCost, 14267 / 738900); near(y.onValue, 14267 / 969500);
  near(y.onValue, d.yieldOverall, 1e-12);   // every cost on file: the same figure the page's lede says
  assert.equal(y.case, "grown"); assert.equal(y.counted, 8); assert.equal(y.all, 8);
});

test("yields: fallen, same, no cost, and only the holdings with what you paid counted", () => {
  const h = (value, costBasis, incomeYearly) => ({ value, costBasis, incomeYearly });
  const fallen = yieldsOf([h(9000, 10000, 360)]);
  assert.equal(fallen.case, "fallen"); near(fallen.onCost, 0.036); near(fallen.onValue, 0.04);
  assert.equal(yieldsOf([h(10000, 10010, 300)]).case, "same", "0.003 points apart: about the same");
  assert.equal(yieldsOf([h(10000, 9000, 300)]).case, "grown");
  const none = yieldsOf([h(5000, 0, 100), h(5000, null, 100)], { total: 200, portfolio: 10000 });
  assert.equal(none.case, "noCost"); assert.equal(none.onCost, null); near(none.onValue, 0.02); assert.equal(none.counted, 0); assert.equal(none.all, 2);
  const some = yieldsOf([h(5000, 4000, 200), h(5000, 0, 100)], { total: 300, portfolio: 10000 });
  assert.equal(some.counted, 1); assert.equal(some.all, 2); near(some.onCost, 0.05); near(some.onValue, 0.04);
  assert.equal(yieldsOf([], { total: 0, portfolio: 0 }).onValue, 0);
});

// ---------------------------------------------------------------- one written sentence per case
test("R5: the months sentence for each shape", () => {
  const cal = (o) => ({ shape: "other", zeroAt: null, ...o });
  assert.deepEqual(monthsFor(cal({ shape: "even", every: 213.33 }), money), { key: "even", sentence: "About $213 comes in every month." });
  assert.deepEqual(monthsFor(cal({ shape: "quarters", quarter: 3140.08, other: 213.33 }), money), { key: "quarters", sentence: "About $3,140 comes in each of March, June, September and December, and about $213 in each of the other months." });
  assert.deepEqual(monthsFor(cal({ shape: "quarters", quarter: 2926.75, other: 0 }), money), { key: "quartersOnly", sentence: "About $2,927 comes in each of March, June, September and December, and nothing in the other months." });
  assert.deepEqual(monthsFor(cal({ peak: { ym: "2026-12", amount: 3500 }, low: { ym: "2027-01", amount: 213 } }), money), { key: "other", sentence: "The most comes in December, about $3,500, and the least in January, about $213." });
  assert.deepEqual(monthsFor(cal({ peak: { ym: "2026-12", amount: 3500 }, low: { ym: "2027-01", amount: 0 }, zeroAt: "2027-01" }), money), { key: "otherGaps", sentence: "The most comes in December, about $3,500, and nothing in some months, such as January." });
  assert.equal(monthsFor({ shape: "none" }, money), null);
  assert.equal(monthsFor(null, money), null);
  // the real case of Sam and Lee
  assert.equal(monthsFor(compute(investmentsPlan(), { today: T, calendar: true }).calendar, money).sentence, "About $3,140 comes in each of March, June, September and December, and about $213 in each of the other months.");
});

test("R5: what came in, a full year or fewer months; the yields, four cases; the row's status", () => {
  assert.deepEqual(receivedFor({ total: 1240, since: null, peak: { ym: "2026-06", amount: 410 } }, money), { key: "year", sentence: "Your transactions show $1,240 of dividends and interest in the last 12 months; the most, $410, came in June." });
  assert.deepEqual(receivedFor({ total: 1240, since: "2026-08", peak: { ym: "2026-10", amount: 410 } }, money), { key: "since", sentence: "Your transactions show $1,240 of dividends and interest since August 2026; the most, $410, came in October." });
  assert.equal(receivedFor(null, money), null);
  // (critic P3: a whole sentence with both figures, never a fragment under the two rows)
  assert.equal(yieldsFor({ case: "grown", onCost: 0.0193, onValue: 0.0147 }).sentence, "You get 1.93% a year on what you paid, but only 1.47% on what the holdings are worth today, because they have grown since you bought them.");
  assert.equal(yieldsFor({ case: "fallen", onCost: 0.012, onValue: 0.015 }).sentence, "You get 1.20% a year on what you paid, and 1.50% on what the holdings are worth today, because they are worth less now than you paid.");
  assert.equal(yieldsFor({ case: "same", onCost: 0.0150, onValue: 0.0151 }).sentence, "You get about 1.51% a year both on what you paid and on what the holdings are worth today, because they are worth about what you paid.");
  assert.equal(yieldsFor({ case: "noCost", onCost: null, onValue: 0.02 }).sentence, "Type what you paid for each holding on Holdings to see the yield on what you paid.");
  assert.equal(yieldsFor({ case: "grown", onCost: 0.0193, onValue: 0.0147 }, (x) => `${(x * 100).toFixed(1)} pct`).sentence.slice(0, 22), "You get 1.9 pct a year", "the page's own percent format");
  assert.equal(YIELD_WORDS, "The yield is what the holdings pay in a year, as a share of the money in them.");
  assert.equal(statusFor({ shape: "even" }, money), "the same each month");
  assert.equal(statusFor({ shape: "quarters", peak: { ym: "2026-12" } }, money), "most in December");
  assert.equal(statusFor({ shape: "other", peak: { ym: "2027-09" } }, money), "most in September");
  assert.equal(statusFor({ shape: "none", received: { total: 1240 } }, money), "$1,240 came in");
  for (const s of ["the same each month", "most in September", "$12,345,678 came in"]) assert.ok(s.length <= 20, s);
  assert.match(SPREAD_WORDS, /every month for bond funds and cash, every three months for the rest, in March, June, September and December/);
});

test("R5: holdings worth $0 (no price, no cost): one next step naming them, one, two or more (critic P4)", () => {
  assert.equal(priceFirst(["VTI"]), "Add the price of VTI (or what you paid for it) on Holdings, and this page works out what it pays each year.");
  assert.equal(priceFirst(["VTI", "BND"]), "Add the prices of VTI and BND (or what you paid for them) on Holdings, and this page works out what they pay each year.");
  assert.equal(priceFirst(["VTI", "BND", "VXUS"]), "Add the prices of your 3 holdings (or what you paid for them) on Holdings, and this page works out what they pay each year.");
  assert.equal(priceFirst([""]), "Add the price of a holding (or what you paid for it) on Holdings, and this page works out what it pays each year.");
});

test("the calendar's cells name the year on the first month and where it turns (critic P2, finding 1)", () => {
  assert.equal(cellName("2026-11", true), "Nov 2026");
  assert.equal(cellName("2026-12"), "Dec");
  assert.equal(cellName("2027-01"), "Jan 2027");
  assert.equal(cellName("2027-03"), "Mar");
  assert.equal(AHEAD_TITLE, "This month and the next 11");
});

// ---------------------------------------------------------------- invariance: nothing asked, nothing moves
const KEYS_154A597 = ["ready", "total", "monthly", "yieldOverall", "items", "byAccount", "taxable", "sheltered", "coversShare", "expensesMonthly", "qualifiedGuess", "unknownCount", "notes", "portfolio"];
async function everyPlan() {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { heldPlan } = await import("../../../qa/fixtures/held-plan.mjs").catch(() => ({}));
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  return [investmentsPlan(), familyPlan(T), renterDebtPlan(), retiredCouplePlan(T), emptyPlan(), ...(heldPlan ? [heldPlan()] : []), ...ARCHETYPES.map((a) => a.build())].map((p) => migrate(structuredClone(p)));
}
test("invariance: without calendar the output has 154a597's keys only; with it, one key more and every other byte the same, over every household", async () => {
  let drawn = 0;
  for (const p of await everyPlan()) {
    for (const today of [T, "2026-09-16"]) {
      const a = compute(p, { today });
      assert.deepEqual(Object.keys(a), KEYS_154A597);
      const b = compute(p, { today, calendar: true });
      assert.deepEqual(Object.keys(b), [...KEYS_154A597, "calendar"]);
      const { calendar, ...rest } = b;
      assert.equal(JSON.stringify(rest), JSON.stringify(a));
      if (calendar.shape !== "none") { drawn++; near(calendar.months.reduce((s, m) => s + m.amount, 0), a.total, 1e-6); }
    }
  }
  assert.ok(drawn >= 2, `households with dividends: ${drawn}`);
  // a holding's paysEvery moves only the months, never the year
  const p = investmentsPlan(); for (const x of p.holdings) x.paysEvery = "half";
  const { calendar, ...rest } = compute(p, { today: T, calendar: true });
  assert.equal(JSON.stringify(rest), JSON.stringify(compute(investmentsPlan(), { today: T })));
  assert.equal(calendar.months.filter((m) => m.amount > 0).length, 2);
});

// ---------------------------------------------------------------- the page
async function draw(plan, today = T, route = { rest: [], query: {} }) {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(view, plan, today, { route });
  const partsOf = () => r.root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => ({ id: x.dataset.part, open: x.hasAttribute("open"), title: x.querySelector(".fold-title")?.textContent, status: x.querySelector(".fold-status")?.textContent ?? "" }));
  return { ...r, partsOf };
}
test("the page: one quiet row, Month by month, shut, after the four tiles; its words, the bars and both yields inside", async () => {
  const r = await draw(investmentsPlan());
  assert.deepEqual(r.partsOf(), [{ id: "months", open: false, title: MONTHS_TITLE, status: "most in December" }]);
  const sections = r.root.children.filter((x) => x.tagName === "SECTION");
  const at = sections.findIndex((s) => s.dataset.parts !== undefined);
  assert.ok(at > 0 && sections[at - 1].querySelectorAll(".stat").length === 4, "the parts card follows the tiles");
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const body = textOf(r.root.querySelector(".fold-body"));
  // every month's amount is written in its cell, the year where it starts and where it turns (critic P2): no hover needed
  assert.match(body, /^This month and the next 11 About \$3,140 comes in each of March, June, September and December, and about \$213 in each of the other months\. Nov 2026 \$213 Dec \$3,140 Jan 2027 \$213 Feb \$213 Mar \$3,140 Apr \$213 May \$213 Jun \$3,140 Jul \$213 Aug \$213 Sep \$3,140 Oct \$213 Each holding's yearly amount/);
  assert.match(body, /Yield The yield is what the holdings pay in a year, as a share of the money in them\. On what you paid 1\.93% \$14,267 a year on \$738,900 paid On today's value 1\.47% \$14,267 a year on \$969,500 today You get 1\.93% a year on what you paid, but only 1\.47% on what the holdings are worth today, because they have grown since you bought them\./);
  assert.doesNotMatch(body, /What came in|Counted:/);
  const grid = r.root.all().find((e) => e.dataset?.months !== undefined);
  assert.ok(grid, "the months");
  assert.equal(grid.tagName, "UL");
  assert.equal(grid.children.length, 12);
  assert.equal(grid.getAttribute("aria-label"), "Dividends and interest expected each month");
  // the first view outside the row is what it was
  const shut = r.text().replace(/Month by month most in December › .*?(?= By holding)/, "");
  assert.doesNotMatch(shut, /next 11|Yield The yield/);
});

test("the page: what came in shows beside the months when the ledger has dividends; a holding with no cost is said", async () => {
  const p = investmentsPlan(); p.transactions = [line("a", "2026-06-30", 410), line("b", "2026-09-30", 300), line("c", "2025-10-02", 1, { category: "income-salary" })];
  p.holdings.find((x) => x.symbol === "ACME").costBasis = null;
  const r = await draw(p);
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const body = textOf(r.root.querySelector(".fold-body"));
  assert.match(body, /What came in Your transactions show \$710 of dividends and interest in the last 12 months; the most, \$410, came in June\./);
  assert.match(body, /Counted: the 7 of 8 holdings with what you paid on file\./);
  assert.equal(r.root.all().filter((e) => e.dataset?.months !== undefined).length, 2);
  // what came in covers other months than the months ahead: its cells say so (critic P2)
  assert.match(body, /What came in .*? Dec 2025 nothing Jan 2026 nothing Feb nothing Mar nothing Apr nothing May nothing Jun \$410 Jul nothing Aug nothing Sep \$300 Oct nothing Nov nothing/);
  // transactions only since June: the months since then, the first with its year (no "nothing" before the records start)
  const q = investmentsPlan(); q.transactions = [line("a", "2026-06-30", 410), line("b", "2026-09-30", 300)];
  const since = textOf((await draw(q)).root.querySelector(".fold-body"));
  assert.match(since, /since June 2026; the most, \$410, came in June\. Jun 2026 \$410 Jul nothing Aug nothing Sep \$300 Oct nothing Nov nothing Yield/);
});

test("the page: no holdings, nothing came in: the page as it was, no row; transactions only: the row says what came in", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  for (const p of [emptyPlan(), familyPlan(T)]) {
    const r = await draw(p);
    assert.equal(r.partsOf().length, 0);
    assert.equal(r.text(), "Dividends and interest What your holdings pay out each year, by fund and by account, and how much of your spending it covers. It needs your holdings first. Add holdings");
  }
  const p = familyPlan(T); p.transactions = [...(p.transactions ?? []), line("a", "2026-06-30", 410), line("b", "2026-09-30", 300)];
  const r = await draw(p);
  assert.deepEqual(r.partsOf().map((x) => [x.title, x.status]), [[MONTHS_TITLE, "$710 came in"]]);
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  assert.doesNotMatch(textOf(r.root.querySelector(".fold-body")), /Yield|next 11/);
});

test("holdings worth $0: the next step instead of a page of zeros; one filled button; what came in still one tap away (critic P4)", async () => {
  const tiny = () => { const p = migrate(emptyPlan()); p.accounts.push({ id: "b1", type: "investment", name: "My brokerage", balance: 1000, history: [] }); p.holdings = [{ id: "x", accountId: "b1", symbol: "VTI", name: "", shares: 3, price: null, costBasis: null, assetClass: "", expenseRatio: null, yield: null, lots: [] }]; return p; };
  const r = await draw(tiny());
  assert.equal(r.text(), "Dividends and interest Add the price of VTI (or what you paid for it) on Holdings, and this page works out what it pays each year. Open Holdings");
  assert.doesNotMatch(r.text(), /\$0/);
  const filled = r.root.all().filter((e) => e.tagName === "A" && /\bbtn\b/.test(e.getAttribute("class") ?? "") && !/\bsecondary\b/.test(e.getAttribute("class") ?? ""));
  assert.equal(filled.length, 1);
  assert.equal(filled[0].getAttribute("href"), "#/investments/holdings");
  const p = tiny(); p.holdings.push({ id: "y", accountId: "b1", symbol: "BND", name: "", shares: 2, price: null, costBasis: null, assetClass: "", expenseRatio: null, yield: null, lots: [] }); p.transactions = [line("a", "2026-06-30", 410)];
  const two = await draw(p);
  assert.match(two.text(), /^Dividends and interest Add the prices of VTI and BND \(or what you paid for them\) on Holdings/);
  assert.deepEqual(two.partsOf().map((x) => [x.title, x.status]), [[MONTHS_TITLE, "$410 came in"]]);
  // a price typed: the page as before
  const priced = tiny(); priced.holdings[0].price = 300;
  assert.match((await draw(priced)).text(), /^About \$11 a year in dividends and interest/);
});

test("S11: the page saves nothing (no box, no form, no store.update); opening the row writes nothing and moves no other part", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(view, "utf8");
  assert.ok(!/\bstore\b|\.update\(/.test(src), "the view never writes the plan");
  const r = await draw(investmentsPlan());
  assert.equal(r.root.querySelectorAll("input").length + r.root.querySelectorAll("select").length + r.root.querySelectorAll("form").length, 0);
  const row = r.root.querySelector("details");
  row.querySelector("summary").dispatch("click", { isTrusted: false });
  row.setAttribute("open", "");
  row.dispatch("toggle");
  assert.equal(r.saved.length, 0);
  assert.deepEqual(r.partsOf().map((x) => x.id), ["months"]);
});

test("a holding's own Yield and paysEvery reach the row; holdings compute is not asked anything new", () => {
  const p = investmentsPlan();
  const before = JSON.stringify(holdingsOf(p, { today: T }));
  assert.equal(JSON.stringify(holdingsOf(p, { today: T, calendar: true })), before);
  p.holdings.find((x) => x.symbol === "ACME").yield = 0.01;   // $900 a year, quarterly
  const c = compute(p, { today: T, calendar: true }).calendar;
  near(c.months.reduce((s, m) => s + m.amount, 0), 14267 + 900);
  near(c.quarter, 3140.0833333 + 225);
});

// ---------------------------------------------------------------- fix round r2: the tax note in the app's money format
// The note printed "3,604 of it lands in taxable accounts ... (about 1,044 looks qualified)" and, with nothing qualified,
// "(about 0 looks qualified)": no currency sign, so it read as a count and Hide amounts (core/format.js maskAmounts, which
// needs the sign) could not cover it.
test("r2: the tax note, one sentence per case, in the app's money format and the plan's currency", async () => {
  const { taxNote } = await import("./compute.js");
  const { money, maskAmounts } = await import("../../../core/format.js");
  assert.equal(taxNote(3604.3, 1044.4), "$3,604 of it lands in taxable accounts and is taxed every year, even when reinvested. About $1,044 looks like the kind taxed at a lower rate: on the Federal estimate page, type that under \u201cQualified dividends\u201d and the rest under \u201cOther income taxed at regular rates\u201d.");
  assert.equal(taxNote(346.2, 0), "$346 of it lands in taxable accounts and is taxed every year, even when reinvested. None of it looks like the kind taxed at a lower rate: on the Federal estimate page, type it under \u201cOther income taxed at regular rates\u201d.");
  assert.equal(taxNote(346.2, 0.49), taxNote(346.2, 0), "under 50 cents is none");
  assert.match(taxNote(1200, 500, "EUR"), new RegExp(`^${money(1200, "EUR").replace(/[.$]/g, "\\$&")} of it lands .*About ${money(500, "EUR").replace(/[.$]/g, "\\$&")} looks like the kind`));
  // plain words (a person critic's P2): "qualified" only as the Federal estimate page's own box name, in quotes
  for (const n of [taxNote(3604.3, 1044.4), taxNote(346.2, 0)]) assert.doesNotMatch(n.replace(/\u201cQualified dividends\u201d/, ""), /qualified/i);
  // the boxes named are the Federal estimate page's own labels
  const fed = await import("node:fs").then((fs) => fs.readFileSync(new URL("../../taxes/federal/view.js", import.meta.url), "utf8"));
  assert.ok(fed.includes('label: "Qualified dividends"') && fed.includes('label: "Other income taxed at regular rates"'));
  assert.doesNotMatch(maskAmounts(taxNote(3604.3, 1044.4)), /\d,\d{3}/, "Hide amounts covers both figures now");
  // the page's own figures: Sam and Lee (qa/fixtures/investments-plan.mjs), $3,604 in the brokerage, $1,044 of it from VTI
  const d = compute(investmentsPlan(), { today: T });
  assert.equal(d.notes.at(-1), taxNote(d.taxable, d.qualifiedGuess));
  assert.match(d.notes.at(-1), /^\$3,604 of it lands .*About \$1,044 looks like the kind taxed at a lower rate/);
  const { heldPlan } = await import("../../../qa/fixtures/held-plan.mjs");
  assert.match(compute(migrate(heldPlan()), { today: T }).notes.at(-1), /^\$346 of it lands .*None of it looks like the kind/);
  // under 50 cents in taxable accounts rounds to $0: no note (a critic's M4)
  const tiny = investmentsPlan(); const hd = compute(tiny, { today: T });
  assert.ok(hd.taxable >= 0.5);
  for (const x of tiny.holdings) x.shares = x.shares * (0.3 / hd.taxable);
  const t3 = compute(tiny, { today: T });
  assert.ok(t3.taxable > 0 && t3.taxable < 0.5, String(t3.taxable));
  assert.ok(!t3.notes.some((n) => /lands in taxable/.test(n)), "no \"$0 of it lands\"");
  const p = investmentsPlan(); p.meta = { ...(p.meta ?? {}), currency: "EUR" };
  assert.equal(compute(p, { today: T }).notes.at(-1), taxNote(d.taxable, d.qualifiedGuess, "EUR"));
});

test("r2: no amount on the page without its currency sign, the note, the tiles, the rows and Month by month open", async () => {
  const { heldPlan } = await import("../../../qa/fixtures/held-plan.mjs");
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  for (const plan of [investmentsPlan(), migrate(heldPlan())]) {
    const r = await draw(plan);
    for (const x of r.root.querySelectorAll("details")) x.setAttribute("open", "");
    const text = textOf(r.root).replace(/​/g, "");
    // a figure of four digits or more with a thousands comma, not after a currency sign (counts and years have no comma)
    const bare = [...text.matchAll(/(?<![$\d,.€])\d{1,3}(?:,\d{3})+/g)].map((m) => m[0]);
    assert.deepEqual(bare, [], `bare amounts: ${bare.join(", ")}`);
    assert.ok(!/about 0 looks/.test(text));
  }
});

test("r2 invariance: every key but notes is what it was; the note says the same two figures, now with their sign", async () => {
  const { money } = await import("../../../core/format.js");
  let noted = 0;
  for (const p of await everyPlan()) {
    const d = compute(p, { today: T });
    assert.deepEqual(Object.keys(d), KEYS_154A597);
    const before = d.notes.slice(0, d.taxable >= 0.5 ? -1 : undefined);
    if (d.taxable >= 0.5) {
      noted++;
      const now = d.notes.at(-1), cur = p.meta?.currency ?? "USD";
      // the figures of before (Math.round of each), now with their sign; nothing taxed lower is said in words
      assert.ok(now.startsWith(`${money(d.taxable, cur)} of it lands in taxable accounts`), now);
      assert.equal(money(d.taxable, cur).replace(/\D/g, ""), String(Math.round(d.taxable)));
      if (d.qualifiedGuess >= 0.5) { assert.ok(now.includes(`About ${money(d.qualifiedGuess, cur)} looks like`), now); assert.equal(money(d.qualifiedGuess, cur).replace(/\D/g, ""), String(Math.round(d.qualifiedGuess))); }
      else assert.match(now, /None of it looks like the kind/);
    }
    assert.ok(before.every((n) => !/lands in taxable/.test(n)), "the other notes are as they were");
  }
  assert.ok(noted >= 2, `${noted} households with a taxable note`);
});
