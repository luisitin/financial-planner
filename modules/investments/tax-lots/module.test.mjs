// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("tax-lots: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

import { lotsOf, longOn, carryover, washSales } from "./compute.js";

const oneLot = (date) => ({ price: 10, shares: 1, costBasis: 5, lots: [{ id: "l1", date, shares: 1, cost: 5 }] });

test("tax-lots: long-term means held more than one year by the calendar (IRS Pub 550), leap years included", () => {
  // counting starts the day after the buy, so the first long-term day is the day after the first anniversary
  assert.equal(longOn("2026-03-15"), "2027-03-16");
  assert.equal(longOn("2027-03-15"), "2028-03-16");   // a February 29 in between: day 366 is still short-term
  assert.equal(longOn("2024-02-29"), "2025-03-01");   // no February 29 next year: the anniversary is February 28
  assert.equal(longOn("2025-12-31"), "2027-01-01");
  // bought February 28 before a leap year: the holding period starts March 1, its year ends February 29, so long-term from
  // March 1 (Rev. Rul. 66-7; the answer key's term-0014 and term-0288)
  assert.equal(longOn("2023-02-28"), "2024-03-01"); assert.equal(longOn("2027-02-28"), "2028-03-01");
  assert.deepEqual([lotsOf(oneLot("2023-02-28"), "2024-02-29")[0].term, lotsOf(oneLot("2023-02-28"), "2024-02-29")[0].daysToLong], ["short", 1]);
  const at = (date, today) => { const l = lotsOf(oneLot(date), today)[0]; return [l.term, l.daysToLong]; };
  assert.deepEqual(at("2027-03-15", "2028-03-15"), ["short", 1]);   // the anniversary itself (366 days held)
  assert.deepEqual(at("2027-03-15", "2028-03-16"), ["long", 0]);
  assert.deepEqual(at("2026-03-15", "2027-03-15"), ["short", 1]);   // 365 days held
  assert.deepEqual(at("2026-03-15", "2027-03-16"), ["long", 0]);
  assert.deepEqual(at("2024-02-29", "2025-02-28"), ["short", 1]);
  assert.deepEqual(at("2024-02-29", "2025-03-01"), ["long", 0]);
  assert.deepEqual(at("2026-10-31", "2026-10-31"), ["short", 366]);  // bought today: 2027-11-01 is 366 days away
  assert.equal(lotsOf(oneLot(null), "2026-10-31")[0].term, "long");  // no date: counted as long-term
});

test("tax-lots: the rates on a gain include the 3.8% on investment income, and a true 0% stays 0%", () => {
  const nothing = compute(emptyPlan(), { today: "2026-10-31" });
  assert.equal(nothing.marginal, 0);   // no income: a short-term gain is under the standard deduction
  assert.equal(nothing.gainsRate, 0);
  const p = emptyPlan();
  p.household.people = [{ id: "p1", name: "Adult A", birthDate: "1980-01-01", role: "self" }];
  p.income = [{ id: "i1", name: "Pay", type: "salary", personId: "p1", amount: 400000, period: "annual", taxable: true }];
  // single, $400,000 of pay: taxable income $383,900 is in the 35% bracket and under the 20% gains line; over the
  // $200,000 line for the 3.8% on investment income (IRC 1411)
  const d = compute(p, { today: "2026-10-31" });
  assert.ok(Math.abs(d.marginal - (0.35 + 0.038)) < 1e-9, String(d.marginal));
  assert.ok(Math.abs(d.gainsRate - (0.15 + 0.038)) < 1e-9, String(d.gainsRate));
});

// a household for the harvest examples of the answer key (tests/golden/tax-lots/RULES.md section 10), worked by hand there
function household({ status, today, interest, dividends = 0, longRealized = 0, holdings }) {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult A", role: "self", birthDate: "1980-01-01" }];
  p.household.filingStatus = status; p.taxes.year = Number(today.slice(0, 4));
  p.income = [{ id: "int", name: "Interest", type: "investment", amount: interest, period: "annual", taxable: true }];
  p.taxes.thisYear.qualifiedIncome = dividends;
  p.taxes.gains = longRealized ? [{ id: "lt", name: "sales", proceeds: longRealized, basis: 0, held: "long" }] : [];
  p.accounts = [{ id: "brk", name: "Brokerage", type: "brokerage", balance: 0 }, { id: "ira", name: "IRA", type: "ira", balance: 0 }];
  p.holdings = holdings.map((h, i) => ({ id: `h${i}`, accountId: h.ira ? "ira" : "brk", symbol: h.symbol, name: "", shares: h.lots.reduce((s, l) => s + l.shares, 0), price: h.price, priceAsOf: today, costBasis: h.lots.reduce((s, l) => s + l.cost, 0), lots: h.lots.map((l, j) => ({ id: `h${i}l${j}`, ...l })) }));
  return p;
}

test("tax-lots: what a harvest saves this year: a net loss takes at most $3,000 off other income, the rest carries (IRC 1211(b), 1212(b))", () => {
  // RULES.md 10.1: single, $240,000 of interest, a $40,000 long-term loss and no gains: $3,000 at 32% + 3.8% saves $1,074
  // (not 40,000 x the 18.8% gains rate = $7,520), and $37,000 carries to next year as long-term
  const d = compute(household({ status: "single", today: "2026-11-16", interest: 240000, holdings: [{ symbol: "ZZTOT", price: 60, lots: [{ date: "2022-03-14", shares: 1000, cost: 100000 }] }] }), { today: "2026-11-16" });
  assert.equal(d.harvestTotal, 40000); assert.ok(Math.abs(d.taxSavedTotal - 1074) < 0.01, String(d.taxSavedTotal));
  assert.deepEqual([d.carry.short, d.carry.long, d.carryAdded.long], [0, 37000, 37000]);
  assert.equal(d.capLimit, 3000);
  // RULES.md 10.2: married jointly, $25,000 of long-term gains: the $8,000 short-term loss cancels long-term gain taxed at
  // 15%, not pay at the 27% the page's rate shows: $3,000 saved in all, nothing carried
  const j = compute(household({ status: "married_joint", today: "2025-12-15", interest: 120000, dividends: 5000, longRealized: 25000, holdings: [{ symbol: "ZZTEC", price: 40, lots: [{ date: "2025-06-02", shares: 400, cost: 24000 }, { date: "2021-09-20", shares: 300, cost: 24000 }] }] }), { today: "2025-12-15" });
  assert.ok(Math.abs(j.taxSavedTotal - 3000) < 0.01, String(j.taxSavedTotal)); assert.equal(j.carry.total, 0);
  assert.ok(Math.abs(j.marginal - 0.27) < 1e-9);
});

test("tax-lots: the carryover worksheet (Pub. 550 Worksheet 4-1), with taxable income below zero carrying more", () => {
  // Pub. 550's example: a $7,000 loss, $26,000 of taxable income: $3,000 deducted, $4,000 carried
  assert.deepEqual(carryover({ taxableIncome: 26000, allowed: 3000, shortNet: 0, longNet: -7000 }), { short: 0, long: 4000, total: 4000 });
  // short-term loss is used first: -5,000 short and -4,000 long carry 2,000 short and 4,000 long
  assert.deepEqual(carryover({ taxableIncome: 50000, allowed: 3000, shortNet: -5000, longNet: -4000 }), { short: 2000, long: 4000, total: 6000 });
  // RULES.md K1: single 2026, $5,000 of interest and a $10,000 long-term loss: taxable income -14,100, so all $10,000 carries
  assert.deepEqual(carryover({ taxableIncome: 5000 - 3000 - 16100, allowed: 3000, shortNet: 0, longNet: -10000 }), { short: 0, long: 10000, total: 10000 });
  // a long-term gain absorbs short-term loss first
  assert.deepEqual(carryover({ taxableIncome: 40000, allowed: 3000, shortNet: -10000, longNet: 4000 }), { short: 3000, long: 0, total: 3000 });
});

test("tax-lots: wash sales: the same fund bought in the 30 days before today cancels the loss on as many shares, an IRA's for good (IRC 1091(a); Rev. Rul. 2008-5)", () => {
  // RULES.md 10.4: 200 shares at a $4,000 loss, 50 bought 12 days ago in the IRA: $1,000 disallowed, $520 saved, not $740
  const p = household({ status: "head_of_household", today: "2026-11-20", interest: 95000, dividends: 1500, longRealized: 2000, holdings: [
    { symbol: "ZZTOT", price: 100, lots: [{ date: "2023-05-10", shares: 200, cost: 24000 }] },
    { symbol: "ZZTOT", price: 100, ira: true, lots: [{ date: "2026-11-08", shares: 50, cost: 5100 }] }] });
  const d = compute(p, { today: "2026-11-20" });
  const c = d.harvest[0];
  assert.equal(c.disallowed, 1000); assert.equal(c.allowed, 3000); assert.equal(c.washedBy.length, 1);
  assert.equal(c.washedBy[0].bucket, "deferred"); assert.equal(c.washedBy[0].shares, 50); assert.equal(c.washedBy[0].date, "2026-11-08");
  assert.ok(Math.abs(d.taxSavedTotal - 520) < 0.01, String(d.taxSavedTotal));
  // 31 days ago is outside the window: the whole loss counts
  p.holdings[1].lots[0].date = "2026-10-20";
  assert.equal(compute(p, { today: "2026-11-20" }).harvest[0].disallowed, 0);
  // a lot sold in the same harvest is never a replacement; an undated lot never is either (the key's W3, W4)
  const two = [{ loss: 100, lot: { shares: 10, date: "2026-11-10" } }, { loss: 100, lot: { shares: 10, date: null } }];
  const hs = [{ symbol: "X", account: "B", bucket: "taxable", lots: [two[0].lot, two[1].lot, { shares: 4, date: "2026-11-15" }] }];
  washSales(two, hs, "2026-11-20");
  assert.equal(two[1].disallowed, 40); assert.equal(two[0].disallowed, 0);   // the undated lot counts as sold first and takes the 4 shares
});

test("tax-lots: a sale today is in today's tax year, and filing separately a loss is on its owner's return", async () => {
  // set to 2025 while today is in 2026: the harvest works 2026's tax, without 2025's sales
  const h = { symbol: "ZZTOT", price: 60, lots: [{ date: "2022-03-14", shares: 100, cost: 10000 }] };   // a 4,000 long-term loss
  const p = household({ status: "single", today: "2026-11-16", interest: 90000, longRealized: 20000, holdings: [h] });
  const now = compute({ ...p, taxes: { ...p.taxes, gains: [] } }, { today: "2026-11-16" });
  p.taxes.year = 2025;
  const last = compute(p, { today: "2026-11-16" });
  assert.equal(last.year, 2026); assert.equal(last.otherYear, 2025);
  assert.equal(last.taxSavedTotal, now.taxSavedTotal); assert.deepEqual(last.carryAdded, now.carryAdded);
  assert.ok(last.notes.some((n) => /set to 2025, but a sale today falls in 2026/.test(n)));
  // filing separately: the loss in Bo's brokerage is all on Bo's return (1,500 off, 2,500 carries); a joint account splits it (each 2,000: 1,500 off, 500 carries)
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const f = familyPlan("2026-10-30");
  f.household.filingStatus = "married_separate";
  f.accounts.push({ id: "a-bob", name: "Bo's brokerage", type: "brokerage", balance: 6000, ownerId: "p-bo", history: [] });
  f.holdings = [{ id: "x1", accountId: "a-bob", symbol: "ZZTOT", shares: 100, price: 60, priceAsOf: "2026-10-30", costBasis: 10000, lots: [{ id: "x1l", date: "2022-03-14", shares: 100, cost: 10000 }] }];
  assert.equal(compute(f, { today: "2026-10-30" }).carryAdded.total, 2500);
  f.holdings[0].accountId = "a-brk";
  assert.equal(compute(f, { today: "2026-10-30" }).carryAdded.total, 1000);
});

test("costAfterLot: a lot for shares outside every lot raises the holding's cost when the lots now cost more (review N6)", async () => {
  const { costAfterLot } = await import("./compute.js");
  // 0.8 BTC, "paid 3,000" for the 0.5 in its one lot; the other 0.3 bought for 18,000: one cost for the holding, 21,000
  assert.equal(costAfterLot({ shares: 0.8, costBasis: 3000, lots: [{ shares: 0.5, cost: 3000 }] }, { shares: 0.3, cost: 18000 }), 21000);
  // a holding typed as one total (300 VTI for 30,000) split into lots: a lot carved out of it leaves the total alone
  assert.equal(costAfterLot({ shares: 300, costBasis: 30000, lots: [] }, { shares: 100, cost: 8000 }), 30000);
  // the lots now hold every share: the holding's cost is the lots' cost
  assert.equal(costAfterLot({ shares: 300, costBasis: 30000, lots: [{ shares: 200, cost: 19000 }] }, { shares: 100, cost: 10500 }), 29500);
  // no cost typed yet: the lots' cost
  assert.equal(costAfterLot({ shares: 10, costBasis: null, lots: [] }, { shares: 4, cost: 400 }), 400);
});

test("shareText: share counts read as people write them (review N7)", async () => {
  const { shareText } = await import("./compute.js");
  assert.equal(shareText(0.1 + 0.2), "0.3");
  assert.equal(shareText(1200), "1,200");
  assert.equal(shareText(0.12345678), "0.123457");
});

test("costFromLots: every share in two or more lots fixes the holding's cost to theirs (review N9)", async () => {
  const { costFromLots } = await import("./compute.js");
  // 0.8 BTC in two purchases, 3,000 and 18,000: the cost is 21,000 and comes from them
  assert.deepEqual(costFromLots({ shares: 0.8, lots: [{ shares: 0.5, cost: 3000 }, { shares: 0.3, cost: 18000 }] }), { count: 2, total: 21000 });
  // one lot (Holdings follows it instead), or shares outside the lots (the typed total covers the rest): not fixed
  assert.equal(costFromLots({ shares: 0.5, lots: [{ shares: 0.5, cost: 3000 }] }), null);
  assert.equal(costFromLots({ shares: 120, lots: [{ shares: 40, cost: 2800 }, { shares: 40, cost: 3500 }] }), null);
  assert.equal(costFromLots({ shares: 10, lots: [] }), null);
});

// ---- simple first (docs/OPTIONAL.md): "How this is worked out" is a part drawn by core/ui/more.js, title unchanged --------------
test("S11: adding a lot saves it and says so; How this is worked out (the helper's part, outside the add form) stays as it was", async () => {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  // the page brings the lot just added into view by measuring it: the stand-in has no layout, so the row is said to be in view
  FakeElement.prototype.getBoundingClientRect ??= () => ({ top: 100, bottom: 140 });
  let p = migrate(investmentsPlan());
  const saved = [];
  let root;
  const draw = () => { root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => "2026-09-16" }, plan: p, route: { group: "investments", id: "tax-lots", rest: [], query: {} }, module: { group: "investments", id: "tax-lots" },
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); p = d; draw(); } }, redraw: draw }); };
  draw();
  const states = () => root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.dataset.kind, e.hasAttribute("open")]);
  const before = states();
  assert.deepEqual(before, [["how", "how", false], ["sell", "item", false], ["sales", "item", false]], "how (Settings' switch opens it) and the two new rows, shut, in one card; no fold by hand");
  assert.ok(root.all().filter((e) => e.tagName === "DETAILS").every((e) => e.dataset.part || String(e.className).includes("form-more")), "every other fold is a form's own line");
  assert.equal(root.all().find((e) => e.dataset.part === "how").querySelector(".fold-title").textContent, "How this is worked out");
  // the note's button opens BND's "+ Add a lot" (a redraw of the page's own, no save)
  root.all().find((e) => e.tagName === "BUTTON" && /^Add the lots for BND$/.test(e.textContent)).click();
  assert.equal(saved.length, 0);
  assert.deepEqual(states(), before, "opening the add form moves no part");
  const form = root.all().find((e) => e.tagName === "FORM");
  form.querySelector('[name="shares"]').value = "1";
  form.querySelector('[name="cost"]').value = "70";
  form.dispatch("submit");
  assert.equal(saved.length, 1, "the lot is saved");
  assert.ok(p.holdings.some((h) => (h.lots ?? []).some((l) => l.shares === 1 && l.cost === 70)));
  assert.match(textOf(root), /Lot added to BND/, "the green line (never folded)");
  assert.deepEqual(states(), before, "after the save no part opened or shut");
});

// =============================================================================================================================
// Which shares to sell first, this year's sales, the list for the tax preparer (gap list items 54 and 7; sell.js)
// =============================================================================================================================
const S = await import("./sell.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const T4 = "2026-11-14";
const money0 = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
/** A holding as lotsOf sees it, its lots keyed as the page keys them. */
const keyed = (h, today = T4) => lotsOf(h, today).map((l) => ({ ...l, key: S.lotKey(l, h.id ?? "h") }));

test("which shares: oldest first is IRS Publication 550's own example (130 shares sold, a basis of $1,380)", () => {
  // Pub. 550 (2025), "Identification not possible": 100 shares in 2010 at $10 (50 since given away), 200 in January 2011 at
  // $11, 100 in December 2013 at $9; 130 sold in April 2025 "You cannot identify the shares ... so you must use the stock you
  // acquired first": 50 x $10 + 80 x $11 = $1,380
  const h = { id: "xyz", price: 12, shares: 350, costBasis: 500 + 2200 + 900, lots: [{ id: "a", date: "2010-06-01", shares: 50, cost: 500 }, { id: "b", date: "2011-01-14", shares: 200, cost: 2200 }, { id: "c", date: "2013-12-02", shares: 100, cost: 900 }] };
  const lots = keyed(h, "2025-04-15");
  const fifo = S.takeShares(S.orderLots(lots, "oldest"), 130, 12);
  assert.deepEqual(fifo.pieces.map((p) => [p.key, p.shares, p.cost]), [["a", 50, 500], ["b", 80, 880]]);
  assert.equal(fifo.pieces.reduce((s, p) => s + p.cost, 0), 1380); assert.equal(fifo.left, 0);
  // the most paid per share first: all 130 from the $11 purchase
  const hifo = S.takeShares(S.orderLots(lots, "cost"), 130, 12);
  assert.deepEqual(hifo.pieces.map((p) => [p.key, p.shares, p.cost]), [["b", 130, 1430]]);
  // the purchases picked, oldest first among them; too few shares in them is said, not stretched
  assert.deepEqual(S.takeShares(S.orderLots(lots, "picked", ["c", "a"]), 130, 12).pieces.map((p) => [p.key, p.shares]), [["a", 50], ["c", 80]]);
  assert.equal(S.takeShares(S.orderLots(lots, "picked", ["c"]), 130, 12).left, 30);
});

test("which shares: the order of the lots (undated first, ties as typed; the same cost per share oldest first)", () => {
  // 30 shares in no lot (no date) count as bought first, like a lot typed without a date
  const h = { id: "h9", price: 10, shares: 100, costBasis: 900, lots: [{ id: "n", date: "2024-02-01", shares: 20, cost: 200 }, { id: "m", date: "2022-05-05", shares: 20, cost: 200 }, { id: "u", date: null, shares: 10, cost: 50 }, { id: "o", date: "2022-05-05", shares: 20, cost: 300 }] };
  const lots = keyed(h);
  assert.deepEqual(S.orderLots(lots, "oldest").map((l) => l.key), ["u", "rest:h9", "m", "o", "n"]);
  // cost per share: o $15, rest:h9 (150 / 30) $5... the rest's cost is what the lots leave of 900: 900 - 750 = 150
  assert.deepEqual(S.orderLots(lots, "cost").map((l) => [l.key, l.costPerShare]), [["o", 15], ["m", 10], ["n", 10], ["u", 5], ["rest:h9", 5]]);
  assert.deepEqual(S.orderLots(lots, "picked", ["n", "rest:h9"]).map((l) => l.key), ["rest:h9", "n"]);
  assert.deepEqual(S.orderLots(lots, "picked", []), []);
});

test("which shares: the three ways on the investments plan, the tax from the Federal estimate's own engine", async () => {
  // Sam and Lee, married filing jointly, VTI at $290: 200 bought March 10, 2021 for $38,000 ($190 a share) and 100 bought May 2,
  // 2026 for $32,000 ($320 a share); the year already has $8,000 of long-term gain and a $5,000 short-term loss (net $3,000 long)
  const p = migrate(investmentsPlan());
  const r = S.sellOrders(p, { today: T4, ask: { holdingId: "h1", by: "shares", amount: 100, picked: [] } });
  const [o, c, k] = r.orders;
  // oldest first: 100 of the 2021 shares, a $10,000 long-term gain, all of it in the 15% band: $1,500
  assert.deepEqual([o.key, o.gain, o.shortGain, o.longGain, o.tax], ["oldest", 10000, 0, 10000, 1500]);
  // the same as Capital gains' "one more sale" of a $10,000 long-term gain (the same return, worked another way)
  const { compute: cg } = await import("../../taxes/capital-gains/compute.js");
  assert.ok(Math.abs(cg(p, { today: T4, extra: { amount: 10000, held: "long" } }).extra.tax - o.tax) < 0.01);
  // highest cost first: the 2026 shares, a $3,000 short-term loss; it cancels $3,000 of the year's long-term gain taxed at 15%
  // (short against long once each kind is netted, Schedule D): $450 less, not 22% of $3,000
  assert.deepEqual([c.key, c.gain, c.shortGain, c.longGain, c.tax], ["cost", -3000, -3000, 0, -450]);
  assert.equal(k.state, "none");
  assert.equal(r.least, "cost"); assert.equal(r.saving, 1950); assert.equal(r.proceeds, 29000); assert.equal(r.year, 2026);
  assert.equal(S.leastSentence(r, money0), "Selling the shares that cost the most first costs least: about $1,950 less federal tax than the oldest first.");
  // $10,000 of VTI is 34.48 shares; the 2021 purchase picked gives the oldest first's answer
  const d = S.sellOrders(p, { today: T4, ask: { holdingId: "h1", by: "dollars", amount: 10000, picked: ["l1"] } });
  assert.ok(Math.abs(d.shares - 10000 / 290) < 1e-12); assert.equal(d.proceeds, 10000);
  assert.equal(d.orders[2].state, "ok"); assert.equal(d.orders[2].tax, d.orders[0].tax); assert.equal(d.orders[0].gain, 3448.28);
  // 250 shares, the most paid first: all 100 of 2026 (-$3,000 short) and 150 of 2021 (+$15,000 long), from two purchases
  const m = S.sellOrders(p, { today: T4, ask: { holdingId: "h1", by: "shares", amount: 250 } }).orders[1];
  assert.deepEqual([m.gain, m.shortGain, m.longGain, m.pieces.length], [12000, -3000, 15000, 2]);
  assert.equal(S.orderLine(m, money0), "A gain of $12,000 (−$3,000 short-term, +$15,000 long-term), from 2 purchases.");
  // the ticked purchases hold too few; more than the fund holds; a question about a fund no longer on the plan
  const few = S.sellOrders(p, { today: T4, ask: { holdingId: "h1", by: "shares", amount: 150, picked: ["l2"] } }).orders[2];
  assert.deepEqual([few.state, few.has], ["short", 100]);
  assert.equal(S.orderLine(few, money0), "The ones you checked hold 100 shares: check more, or sell fewer.");
  const many = S.sellOrders(p, { today: T4, ask: { holdingId: "h1", by: "shares", amount: 301 } });
  assert.equal(many.tooMany, true); assert.equal(many.orders.length, 0);
  assert.equal(S.leastSentence(many, money0), "VTI has 300 shares (worth $87,000): sell at most that.");
  assert.equal(S.sellOrders(p, { today: T4, ask: { holdingId: "gone", by: "shares", amount: 5 } }).ask, null);
  // the funds offered: taxable, priced and not cash (the money market fund is left out; the IRA, 401(k) and Roth too)
  assert.deepEqual(S.sellable(p, { today: T4 }).eligible.map((x) => x.symbol), ["VTI", "BND"]);
  // the saved question is read from whatIfs.taxLots
  p.whatIfs = { ...(p.whatIfs ?? {}), taxLots: { holdingId: "h1", by: "shares", amount: 100, picked: [] } };
  assert.equal(S.sellOrders(p, { today: T4 }).saving, 1950);
});

test("which shares: a recent purchase cancels the loss on as many shares (the page's wash-sale rule); the rest of a purchase partly sold is not one", () => {
  // RULES.md 10.4's household: 200 ZZTOT at a $4,000 loss, 50 bought 12 days ago in the IRA: $1,000 disallowed, $520 saved,
  // the same as the harvest of that lot works out
  const p = household({ status: "head_of_household", today: "2026-11-20", interest: 95000, dividends: 1500, longRealized: 2000, holdings: [
    { symbol: "ZZTOT", price: 100, lots: [{ date: "2023-05-10", shares: 200, cost: 24000 }] },
    { symbol: "ZZTOT", price: 100, ira: true, lots: [{ date: "2026-11-08", shares: 50, cost: 5100 }] }] });
  const r = S.sellOrders(p, { today: "2026-11-20", ask: { holdingId: "h0", by: "shares", amount: 200 } });
  const o = r.orders[0];
  assert.deepEqual([o.gain, o.disallowed, o.tax], [-4000, 1000, -520]);
  assert.equal(o.tax, -compute(p, { today: "2026-11-20" }).taxSavedTotal);
  assert.equal(S.washLine(o, "ZZTOT", money0), "$1,000 of this loss is lost for good: you bought more ZZTOT in a retirement account in the last 30 days (the wash-sale rule).");
  // the recent purchase in the same taxable fund: put off, added to those shares' cost
  const q = household({ status: "single", today: "2026-11-20", interest: 60000, holdings: [{ symbol: "ZZTOT", price: 100, lots: [{ date: "2023-05-10", shares: 200, cost: 24000 }, { date: "2026-11-08", shares: 50, cost: 5100 }] }] });
  const w = S.sellOrders(q, { today: "2026-11-20", ask: { holdingId: "h0", by: "shares", amount: 200 } }).orders[0];
  assert.equal(w.disallowed, 1000);
  assert.equal(S.washLine(w, "ZZTOT", money0), "$1,000 of this loss does not count yet: you bought more ZZTOT in the last 30 days (the wash-sale rule). It is added to the cost of those shares.");
  // 220 sold: the recent purchase is partly sold itself, and its other 30 shares are not counted as a replacement (convention)
  assert.equal(S.sellOrders(q, { today: "2026-11-20", ask: { holdingId: "h0", by: "shares", amount: 220 } }).orders[0].disallowed, 0);
  // replacements in both kinds of account
  assert.equal(S.washLine({ disallowed: 500, washedBy: [{ bucket: "taxable" }, { bucket: "deferred" }] }, "ZZTOT", money0), "$500 of this loss does not count: you bought more ZZTOT in the last 30 days (the wash-sale rule); the part matched by a retirement account's purchase is lost for good.");
  assert.equal(S.washLine({ disallowed: 0, washedBy: [] }, "ZZTOT", money0), "");
});

test("which shares: a loss over the year's limit carries, and the line says so", () => {
  // single, $60,000 of interest, no other sale: a $10,000 long-term loss takes $3,000 off this year and carries $7,000
  const p = household({ status: "single", today: T4, interest: 60000, holdings: [{ symbol: "ZZTOT", price: 50, lots: [{ date: "2022-03-14", shares: 400, cost: 30000 }] }] });
  const o = S.sellOrders(p, { today: T4, ask: { holdingId: "h0", by: "shares", amount: 400 } }).orders[0];
  assert.deepEqual([o.gain, o.carry], [-10000, 7000]);
  assert.equal(S.orderLine(o, money0), "A loss of $10,000, all long-term, from one purchase; $7,000 of the loss carries to next year.");
});

test("which shares: every sentence, one per case", () => {
  const r = (taxes, { least = "oldest", saving = 0, picked = true } = {}) => ({ holding: { symbol: "VTI", shares: 300, value: 87000 }, ask: { amount: 1 }, tooMany: false, least, saving,
    orders: [{ key: "oldest", state: "ok", tax: taxes[0] }, { key: "cost", state: "ok", tax: taxes[1] }, picked ? { key: "picked", state: "ok", tax: taxes[2] } : { key: "picked", state: "none" }] });
  const L = (x) => S.leastSentence(x, money0);
  assert.equal(L(r([1200, 1200.3, 1200])), "Whichever way you sell, it adds about $1,200 to your federal tax: here the order makes no difference.");
  assert.equal(L(r([-300, -300, 0], { picked: false })), "Whichever way you sell, it takes about $300 off your federal tax: here the order makes no difference.");
  assert.equal(L(r([0, 0.2, 0])), "There is no federal tax to pay whichever way you sell: here the order makes no difference.");
  assert.equal(L(r([1500, -450, 900], { least: "cost", saving: 1950 })), "Selling the shares that cost the most first costs least: about $1,950 less federal tax than the oldest first.");
  assert.equal(L(r([1500, 600, -100], { least: "picked", saving: 1600 })), "Selling the purchases you picked costs least: about $1,600 less federal tax than the oldest first.");
  assert.equal(L(r([200, 650, 900])), "Selling the oldest shares first costs least, about $450 less federal tax than the next best way, and it is what counts as sold unless you tell the broker otherwise.");
  assert.equal(L(r([200, 200, 900])), "Selling the oldest shares first costs least, as little as another way, and it is what counts as sold unless you tell the broker otherwise.");
  assert.equal(L({ ...r([0, 0, 0]), tooMany: true }), "VTI has 300 shares (worth $87,000): sell at most that.");
  assert.equal(L({ ...r([0, 0, 0]), ask: null }), "");
  // the figure beside each way, and the line under it
  // against not selling, said as such (critic P4: "$450 more tax" did not say more than what)
  assert.deepEqual([1500, -450, 0.3].map((t) => S.orderValue({ state: "ok", tax: t }, money0)), ["$1,500 of tax", "saves $450 of tax", "no tax"]);
  assert.equal(S.orderValue({ state: "none" }), "");
  assert.equal(S.orderLine({ state: "none" }), "Check the purchases to sell under “Pick the purchases yourself” to see this way too.");
  const piece = (term) => ({ term });
  assert.equal(S.orderLine({ state: "ok", gain: 0, shortGain: 0, longGain: 0, carry: 0, pieces: [piece("long")] }, money0), "No gain or loss, from one purchase.");
  assert.equal(S.orderLine({ state: "ok", gain: 800, shortGain: 800, longGain: 0, carry: 0, pieces: [piece("short"), piece("short"), piece("short")] }, money0), "A gain of $800, all short-term, from 3 purchases.");
});

test("this year's sales: the totals are Capital gains' and the Federal estimate's, over every invented household", async () => {
  const { compute: cg } = await import("../../taxes/capital-gains/compute.js");
  const { compute: fed } = await import("../../taxes/federal/compute.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const two = (p) => { const q = structuredClone(p); q.taxes = q.taxes ?? {}; q.taxes.gains = [...(q.taxes.gains ?? []), { id: "z1", name: "40 ZZTOT", proceeds: 9000, basis: 4000, held: "long" }, { id: "z2", name: "10 ZZNEW", proceeds: 1200, basis: 2000, held: "short" }]; return q; };
  const plans = [investmentsPlan(), familyPlan(T4), renterDebtPlan(), retiredCouplePlan(), emptyPlan(), ...ARCHETYPES.map((a) => a.build())].map((p) => migrate(structuredClone(p)));
  let n = 0;
  for (const p of [...plans, ...plans.map(two)]) {
    const s = S.yearSales(p, { today: T4 }), c = cg(p, { today: T4 }), f = fed(p, { today: T4 });
    assert.equal(s.year, c.year); assert.equal(s.year, f.year); assert.equal(s.year, S.salesYear(p, T4));
    assert.equal(s.rows.length, (p.taxes?.gains ?? []).length);
    for (const k of ["shortTotal", "longTotal", "netShort", "netLong", "netLoss", "lossAllowed"]) { assert.ok(Math.abs(s[k] - c.gains[k]) < 0.005, k); assert.ok(Math.abs(s[k] - f.gains[k]) < 0.005, `federal ${k}`); }
    // what the Federal estimate lists among its sources
    const src = (key) => f.sources.find((x) => x.key === key)?.amount ?? 0;
    assert.ok(Math.abs(src("shortGains") - s.netShort) < 0.005 && Math.abs(src("longGains") - s.netLong) < 0.005 && Math.abs(src("loss") - (s.netLoss < 0 ? s.lossAllowed : 0)) < 0.005);
    if (s.hasSales) n++;
  }
  assert.ok(n >= plans.length, `${n} plans with sales`);
  // the investments plan: $8,000 long and a $5,000 short-term loss, netted to $3,000 of long-term gain
  const s = S.yearSales(plans[0], { today: T4 });
  assert.deepEqual([s.shortTotal, s.longTotal, s.netShort, s.netLong], [-5000, 8000, 0, 3000]);
});

test("this year's sales: every sentence, one per case", () => {
  const sales = (rows, status = "single", interest = 60000) => { const p = household({ status, today: T4, interest, holdings: [] }); p.taxes.gains = rows; return S.yearSales(p, { today: T4 }); };
  const Y = (rows, status, interest) => S.salesSentence(sales(rows, status, interest), money0);
  const row = (name, proceeds, basis, held) => ({ id: name, name, proceeds, basis, held });
  assert.equal(Y([]), "No sales are recorded for 2026 yet. When you sell, add the sale on Capital gains: what it sold for, what it cost and how long you held it. It then shows here with the year's short-term and long-term totals, as a list for your tax preparer that you can save or print.");
  assert.equal(Y([row("a", 5000, 5000, "long")]), "Your 2026 sales break even: no gain or loss to count.");
  assert.equal(Y([row("a", 9000, 4000, "long"), row("b", 3000, 1000, "short")]), "After losses cancel gains, the Federal estimate counts $2,000 of short-term gain and $5,000 of long-term gain for 2026.");
  assert.equal(Y([row("b", 3000, 1000, "short")]), "After losses cancel gains, the Federal estimate counts $2,000 of short-term gain for 2026, taxed like pay.");
  assert.equal(Y([row("a", 9000, 4000, "long"), row("b", 1000, 3000, "short")]), "After losses cancel gains, the Federal estimate counts $3,000 of long-term gain for 2026, at the lower rates for gains.");
  assert.equal(Y([row("a", 1000, 3000, "long")]), "A net loss of $2,000 for 2026: all of it comes off your other income.");
  // over the limit: $3,000 off this year (IRC 1211(b)), the other $7,000 carried (Pub. 550 Worksheet 4-1)
  assert.equal(Y([row("a", 20000, 30000, "long")]), "A net loss of $10,000 for 2026: $3,000 comes off your other income and $7,000 carries to next year.");
  // married filing separately (one return here): at most $1,500 comes off (IRC 1211(b)), so $8,500 carries
  assert.equal(Y([row("a", 20000, 30000, "long")], "married_separate"), "A net loss of $10,000 for 2026: $1,500 comes off your other income and $8,500 carries to next year.");
});

test("this year's sales: the file for the tax preparer has Form 8949's columns in plain words, money with two decimals, names quoted", () => {
  const p = household({ status: "single", today: T4, interest: 60000, holdings: [] });
  p.taxes.gains = [{ id: "g1", name: "40 ZZTOT, sold in March", proceeds: 9000, basis: 4000.5, held: "long" }, { id: "g2", name: "10 ZZNEW", proceeds: 1200, basis: 2000, held: "short" }];
  const csv = S.salesCsv(S.yearSales(p, { today: T4 }), p);
  // no form letters in the headers and no empty date columns (critic P3: the plan keeps no dates; the list says where they are)
  assert.equal(csv, "What was sold,Sold for,Cost,Gain or loss,Short or long term\r\n\"40 ZZTOT, sold in March\",9000.00,4000.50,4999.50,long-term\r\n10 ZZNEW,1200.00,2000.00,-800.00,short-term\r\n");
  assert.ok(!/\([a-h]\)|Date/.test(csv.split("\r\n")[0]));
  // filing separately with a sale in one spouse's name: whose it is, the other "both" (split in half on the two returns)
  p.household.filingStatus = "married_separate";
  p.household.people.push({ id: "b1", name: "Adult B", role: "partner", birthDate: "1981-01-01" });
  p.taxes.gains[0].personId = "a1";
  const lines = S.salesCsv(S.yearSales(p, { today: T4 }), p).split("\r\n");
  assert.ok(lines[0].endsWith(",Whose")); assert.ok(lines[1].endsWith(",Adult A")); assert.ok(lines[2].endsWith(",both"));
});

test("this year's sales: a name a spreadsheet would run as a formula is written as text (critic F1)", async () => {
  const p = household({ status: "married_separate", today: T4, interest: 60000, holdings: [] });
  p.household.people.push({ id: "b1", name: "=Adult B", role: "partner", birthDate: "1981-01-01" });
  const g = (id, name) => ({ id, name, proceeds: 100, basis: 50, held: "long", personId: "b1" });
  p.taxes.gains = [g("1", '=HYPERLINK("x")'), g("2", "+cmd"), g("3", "-5 shares"), g("4", "@SUM(1)"), g("5", "\tTAB"), g("6", "\rCR"), g("7", "40 ZZTOT")];
  const { splitCsv } = await import("../../../core/csv.js");
  const rows = splitCsv(S.salesCsv(S.yearSales(p, { today: T4 }), p), ",").slice(1);
  assert.deepEqual(rows.map((r) => r[0]), ["'=HYPERLINK(\"x\")", "'+cmd", "'-5 shares", "'@SUM(1)", "'\tTAB", "'\rCR", "40 ZZTOT"].map((x) => x.trim()));
  assert.ok(rows.every((r) => r[5] === "'=Adult B"), "the owner's name too");
  // the money stays numbers: a loss is -50.00, not '-50.00
  p.taxes.gains = [{ id: "8", name: "loss", proceeds: 50, basis: 100, held: "short" }];
  assert.equal(splitCsv(S.salesCsv(S.yearSales(p, { today: T4 }), p), ",")[1][3], "-50.00");
  assert.deepEqual(["=1", "", null, "a=b"].map(S.csvText), ["'=1", "", "", "a=b"]);
});

// ---- the page: the two new rows on the fake DOM -----------------------------------------------------------------------------
async function page(plan, today = T4) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  FakeElement.prototype.getBoundingClientRect ??= () => ({ top: 100, bottom: 140 });
  const P = { plan: migrate(structuredClone(plan)), saved: [], root: null };
  P.draw = () => { P.root = new FakeElement("main"); render(P.root, { ui, fmt: { ...fmt, today: () => today }, plan: P.plan, route: { group: "investments", id: "tax-lots", rest: [], query: {} }, module: { group: "investments", id: "tax-lots" },
    store: { get: () => P.plan, update: (fn) => { const d = structuredClone(P.plan); fn(d); P.saved.push(d); P.plan = d; P.draw(); } }, redraw: P.draw }); return P; };
  P.text = () => textOf(P.root);
  P.part = (id) => P.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  P.open = (id) => { const d = P.part(id); d.open = true; d.setAttribute?.("open", ""); d.dispatch("toggle"); return d; };
  P.states = () => P.root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open"), e.querySelector(".fold-status")?.textContent ?? ""]);
  P.textOf = textOf;
  return P.draw();
}

test("S11: Compare ways to sell part of a fund: Work it out saves the question, names the answer in green, keeps its part open and moves no other part", async () => {
  const P = await page(investmentsPlan());
  // two ways until purchases are checked (critic P1: "3 ways" promised a third answer that was only an instruction); its own
  // name, apart from the card "If you need cash, sell these first"
  assert.deepEqual(P.states(), [["how", false, ""], ["sell", false, "2 ways"], ["sales", false, "2 in 2026"]]);
  assert.equal(P.textOf(P.part("sell").querySelector(".fold-title")), "Compare ways to sell part of a fund");
  const sell = P.open("sell");
  const t = P.textOf(sell);
  assert.match(t, /See what it does to your federal tax two ways: .* You can also pick the purchases yourself\./);
  assert.match(t, /Before you sell, tell the broker which shares/); assert.match(t, /“average cost”/);
  // the boxes: the fund, shares or dollars, the amount; the purchases to tick are folded under their own line
  const form = sell.all().find((e) => e.tagName === "FORM");
  assert.deepEqual(form.all().filter((e) => ["INPUT", "SELECT"].includes(e.tagName) && !e.closest(".form-more")).map((e) => e.getAttribute("name")), ["fund", "by", "amount"]);
  assert.ok(form.all().some((e) => e.tagName === "DETAILS" && /Pick the purchases yourself \(optional\)/.test(P.textOf(e))));
  // choosing another fund draws its purchases and keeps what was typed; nothing is saved
  form.querySelector('[name="amount"]').value = "40";
  form.querySelector('[name="fund"]').value = "h2";
  form.querySelector('[name="fund"]').dispatch("change");
  const form2 = P.part("sell").all().find((e) => e.tagName === "FORM");
  assert.equal(form2.querySelector('[name="amount"]').value, "40"); assert.equal(P.saved.length, 0);
  assert.match(P.textOf(form2), /BND has 700 shares/);
  form2.querySelector('[name="fund"]').value = "h1"; form2.querySelector('[name="fund"]').dispatch("change");
  const form3 = P.part("sell").all().find((e) => e.tagName === "FORM");
  form3.querySelector('[name="amount"]').value = "100";
  form3.dispatch("submit");
  assert.equal(P.saved.length, 1);
  assert.deepEqual(P.plan.whatIfs.taxLots, { holdingId: "h1", by: "shares", amount: 100, picked: [] });
  assert.deepEqual(P.states(), [["how", false, ""], ["sell", true, "set by you · 2 ways"], ["sales", false, "2 in 2026"]], "the saved part stays open, the others as they were");
  const notice = P.part("sell").all().find((e) => String(e.className).includes("notice"));
  assert.match(P.textOf(notice), /^Worked out for 100 shares of VTI\. Selling the shares that cost the most first costs least: about \$1,950 less federal tax than the oldest first\.$/);
  assert.match(P.textOf(P.part("sell")), /Oldest first \$1,500 of tax A gain of \$10,000, all long-term, from one purchase\. Highest cost first saves \$450 of tax A loss of \$3,000, all short-term, from one purchase\./);
  // nothing checked: no third row that is only an instruction (critic P1)
  assert.ok(!/The ones you pick|Check the purchases to sell/.test(P.textOf(P.part("sell"))));
  // the next draw (a reload, Back): shut, the question kept, the answer a plain sentence
  P.draw();
  assert.deepEqual(P.states()[1], ["sell", false, "set by you · 2 ways"]);
  const again = P.open("sell");
  assert.ok(!again.all().some((e) => String(e.className).includes("notice")));
  assert.match(P.textOf(again), /Selling the shares that cost the most first costs least/);
  assert.equal(again.all().find((e) => e.tagName === "FORM").querySelector('[name="amount"]').value, "100");
  // a purchase checked: the third way is an answer, and the row counts it
  const fp = again.all().find((e) => e.tagName === "FORM");
  fp.querySelector('[name="pick-l2"]').checked = true; fp.dispatch("submit");
  assert.deepEqual(P.plan.whatIfs.taxLots.picked, ["l2"]);
  assert.deepEqual(P.states()[1], ["sell", true, "set by you · 3 ways"]);
  assert.match(P.textOf(P.part("sell")), /The ones you pick saves \$450 of tax A loss of \$3,000, all short-term, from one purchase\./);
  // a fund of one purchase (offered beside one with two): every way is the same, and the page says how to compare
  const fb = P.part("sell").all().find((e) => e.tagName === "FORM");
  fb.querySelector('[name="fund"]').value = "h2";
  fb.querySelector('[name="fund"]').dispatch("change");
  const f4 = P.part("sell").all().find((e) => e.tagName === "FORM");
  f4.querySelector('[name="amount"]').value = "100"; f4.dispatch("submit");
  // BND's 700 shares in no lot cost $56,000 ($80 a share): 100 sold at $73 is a $700 long-term loss, cancelling $700 of the year's
  // long-term gain at 15%
  assert.match(P.textOf(P.part("sell")), /Worked out for 100 shares of BND\. Whichever way you sell, it takes about \$105 off your federal tax: here the order makes no difference\./);
  assert.match(P.textOf(P.part("sell")), /All of BND's shares are one purchase on this page/);
  assert.ok(!/The ones you pick/.test(P.textOf(P.part("sell"))));
});

test("Compare ways to sell part of a fund: only offered when a fund has two or more purchases; a price of 0 is no fund to work", async () => {
  // critic P2: one fund, every share in no lot: each way sells the same shares, so no row (the note above already carries
  // "Add the lots for ZZONE"); critic F3: a price of 0 counted as priced and a dollar amount divided by it
  const one = household({ status: "single", today: T4, interest: 60000, holdings: [{ symbol: "ZZONE", price: 50, lots: [] }] });
  one.holdings[0].shares = 100; one.holdings[0].costBasis = 4000; delete one.holdings[0].lots;
  assert.equal(S.hasChoice(S.sellable(one, { today: T4 }).eligible[0]), false);
  const P = await page(one);
  assert.deepEqual(P.states().map((x) => x[0]), ["how", "sales"]);
  assert.ok(!/Compare ways to sell/.test(P.text()));
  assert.match(P.text(), /Add the lots for ZZONE/);
  // a typed lot for part of the shares: two purchases (the lot and the shares in no lot), so the row is there
  one.holdings[0].lots = [{ id: "z1", date: "2025-01-02", shares: 40, cost: 2400 }];
  assert.deepEqual((await page(one)).states().map((x) => x[0]), ["how", "sell", "sales"]);
  // a fund of one purchase listed first: the question starts on the fund that has a choice
  const two = household({ status: "single", today: T4, interest: 60000, holdings: [{ symbol: "ZZBND", price: 40, lots: [{ date: "2023-01-10", shares: 300, cost: 13000 }] },
    { symbol: "ZZTOT", price: 60, lots: [{ date: "2022-03-14", shares: 400, cost: 20000 }, { date: "2026-06-01", shares: 100, cost: 7000 }] }] });
  assert.equal(S.sellOrders(two, { today: T4 }).holding.symbol, "ZZTOT");
  // price 0: not offered, so a dollar amount never divides by it
  const zero = household({ status: "single", today: T4, interest: 60000, holdings: [{ symbol: "ZZZERO", price: 0, lots: [{ date: "2022-01-01", shares: 50, cost: 2000 }, { date: "2025-01-01", shares: 50, cost: 2000 }] }] });
  assert.deepEqual(S.sellable(zero, { today: T4 }).eligible, []);
  const r = S.sellOrders(zero, { today: T4, ask: { holdingId: "h0", by: "dollars", amount: 500 } });
  assert.equal(r.ask, null); assert.equal(r.holding, null); assert.equal(S.leastSentence(r), "");
  assert.deepEqual((await page(zero)).states().map((x) => x[0]), ["how", "sales"]);
});

test("Sales for your tax return: the list, the CSV's green line and the printout; with no sale, how to add one", async () => {
  const P = await page(investmentsPlan());
  const sales = P.open("sales");
  const t = P.textOf(sales);
  assert.match(t, /After losses cancel gains, the Federal estimate counts \$3,000 of long-term gain for 2026, at the lower rates for gains\./);
  assert.match(t, /100 VTI \+\$8,000 sold for \$30,000, cost \$22,000 · long-term/);
  assert.match(t, /Meme stock −\$5,000 sold for \$4,000, cost \$9,000 · short-term/);
  assert.match(t, /The dates bought and sold are on the broker's Form 1099-B/);
  const buttons = sales.all().filter((e) => e.tagName === "BUTTON");
  assert.deepEqual(buttons.map((b) => [P.textOf(b), String(b.className)]), [["Save as a spreadsheet (CSV)", "secondary"], ["Print this list", "secondary"]], "both outlined: the page keeps its one filled button");
  buttons[0].click();
  assert.match(P.textOf(sales), /sales-2026\.csv is downloading\. Open it with Excel, Numbers or Google Sheets, or send it to your tax preparer\./);
  buttons[1].click();
  const sheet = sales.all().find((e) => String(e.className).includes("rp-sheet"));
  assert.ok(sheet && sales.all().some((e) => String(e.className).includes("tl-print")), "the sheet is drawn, for the printer only");
  assert.match(P.textOf(sheet), /^Sales in 2026, for your tax preparer From the plan on .*: the sales typed on Capital gains\. Short-term: −\$5,000\. Long-term: \$8,000\./);
  // each sale signed as on the screen (critic P4: the printout showed $8,000 where the screen showed +$8,000)
  assert.match(P.textOf(sheet), /100 VTI long-term \$30,000 \$22,000 \+\$8,000/); assert.match(P.textOf(sheet), /Meme stock short-term \$4,000 \$9,000 −\$5,000/);
  assert.equal(sheet.all().filter((e) => e.tagName === "TR").length, 3, "a header and the two sales");
  assert.equal(P.saved.length, 0, "neither the file nor the printout changes the plan");
  // no sale yet: the words and the way to add one
  const p = investmentsPlan(); p.taxes.gains = [];
  const Q = await page(p);
  assert.equal(Q.states()[2][2], "none in 2026");
  const empty = Q.open("sales");
  assert.match(Q.textOf(empty), /^Sales for your tax return none in 2026 › No sales are recorded for 2026 yet\./);
  assert.ok(empty.all().some((e) => e.tagName === "A" && e.getAttribute("href") === "#/taxes/capital-gains" && /Add a sale on Capital gains/.test(Q.textOf(e))));
  // no holdings but a sale typed: the hero asks for holdings, and the sale's row is there
  const f = emptyPlan(); f.taxes.gains = [{ id: "g", name: "50 ZZTOT", proceeds: 6000, basis: 4000, held: "long" }];
  const R = await page(f);
  assert.deepEqual(R.states().map((x) => x[0]), ["sales"]);
  // no holdings and no sale: the page as before
  assert.deepEqual((await page(emptyPlan())).states(), []);
});

// ---- invariance (gap spec 3.5): the saved question changes no page's figures; compute() is the same as before -------------
test("invariance: with whatIfs.taxLots saved, every page's compute gives byte-identical output over the fixtures and every household", async () => {
  const { default: REGISTRY } = await import("../../registry.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const mods = (await Promise.all(REGISTRY.map(async (e) => (await e.load()).default))).filter((m) => !m.placeholder && !m.heavy);
  const withAsk = (plan) => { const b = structuredClone(plan); b.whatIfs = { ...(b.whatIfs ?? {}), taxLots: { holdingId: b.holdings?.[0]?.id ?? "h1", by: "shares", amount: 10, picked: ["l1"] } }; return b; };
  // Diagnostics and Settings measure the plan file's size, and Export writes the plan out: a longer plan is a bigger file
  const out = (m, q) => { try { const r = m.compute(q, { today: T4 }); if (["diagnostics", "settings"].includes(m.id) && r) { delete r.size; delete r.sizeKB; } return JSON.stringify(r); } catch (e) { return `THROW ${e.message}`; } };
  const fixtures = [investmentsPlan(), familyPlan(T4), renterDebtPlan(), retiredCouplePlan(), emptyPlan()];
  const near = mods.filter((m) => m.group === "investments" || m.group === "taxes");
  for (const plan of [...fixtures, ...ARCHETYPES.map((a) => a.build())]) {
    const a = migrate(structuredClone(plan));
    for (const m of near) assert.equal(out(m, withAsk(a)), out(m, a), `${m.group}/${m.id}`);
  }
  for (const plan of fixtures) {
    const a = migrate(structuredClone(plan));
    for (const m of mods.filter((x) => !near.includes(x) && !(x.group === "reports" && x.id === "export"))) assert.equal(out(m, withAsk(a)), out(m, a), `${m.group}/${m.id}`);
  }
  // and no code outside this page reads the new field
  const fs = await import("node:fs"); const path = await import("node:path"); const { fileURLToPath } = await import("node:url");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".js") ? [path.join(d, e.name)] : []));
  const readers = [...walk(path.join(ROOT, "modules")), ...walk(path.join(ROOT, "core"))].filter((f) => !f.includes(`${path.sep}tax-lots${path.sep}`) && /taxLots\b/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(readers, []);
});

test("Sales for your tax return: no word of a file for tax software without a coin sale (P3); a coin sale recorded on Crypto gets one link there", async () => {
  // gap list, next 60, item 51: the file for tax software (TXF) carries the dates bought and sold, which typed sales do not keep
  assert.equal(S.NO_TXF, undefined, "no sentence about a file this page does not make");
  assert.equal(S.COIN_TXF, "Save your coin sales for tax software on Crypto ›");
  const P = await page(investmentsPlan());
  const sales = P.open("sales");
  assert.match(P.textOf(sales), /The dates bought and sold are on the broker's Form 1099-B \(boxes 1b and 1c\): this list does not keep them\. Save as a spreadsheet/);
  assert.ok(!/tax software|TXF/.test(P.textOf(sales)), "sales with no coin sale: nothing about a file for tax software");
  assert.ok(!sales.all().some((e) => e.tagName === "A" && e.getAttribute("href") === "#/investments/crypto"), "no coin sale: no link");
  assert.equal(S.hasCoinSale(S.yearSales(investmentsPlan(), { today: T4 })), false);
  // a coin sale recorded on Crypto (a Capital gains row with its `coin`): the link to Crypto's file
  const p = investmentsPlan();
  p.taxes.gains.push({ id: "s1-1", name: "0.1 BTC", proceeds: 9400, basis: 2500, held: "long", coin: { sale: "s1", holding: "c1", account: "w", symbol: "BTC", units: 0.1, acquired: "2023-03-01", sold: "2026-10-03", lot: "l1" } });
  assert.equal(S.hasCoinSale(S.yearSales(p, { today: T4 })), true);
  const Q = await page(p);
  const link = Q.open("sales").all().find((e) => e.tagName === "A" && e.getAttribute("href") === "#/investments/crypto");
  assert.equal(Q.textOf(link), "Save your coin sales for tax software on Crypto ›");
  assert.equal((Q.textOf(Q.part("sales")).match(/tax software/g) ?? []).length, 1, "one line about it: the link");
  // the spreadsheet and the printout are as they were (the sentence is on the screen only)
  assert.equal(S.salesCsv(S.yearSales(investmentsPlan(), { today: T4 }), investmentsPlan()).includes("tax software"), false);
  assert.equal(P.saved.length + Q.saved.length, 0);
});
