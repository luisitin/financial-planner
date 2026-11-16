import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, cryptoKind, STRESS_DROP, SHARE } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const ago = (n) => new Date(Date.UTC(2026, 9, 30) - n * 864e5).toISOString().slice(0, 10);

function withCoins() {
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "a-cx", name: "Coin wallet", type: "crypto", balance: 0.12 * 98000 + 1.5 * 3200 + 800, history: [] });
  p.holdings = [
    { id: "c1", accountId: "a-cx", symbol: "BTC", shares: 0.12, price: 98000, priceAsOf: ago(1), costBasis: 4200, lots: [{ id: "l1", date: ago(900), shares: 0.08, cost: 2100 }, { id: "l2", date: ago(330), shares: 0.04, cost: 2100 }] },
    { id: "c2", accountId: "a-cx", symbol: "ETH", shares: 1.5, price: 3200, priceAsOf: ago(12), costBasis: 6300, lots: [{ id: "l3", date: ago(120), shares: 1.5, cost: 6300 }] },
    { id: "c3", accountId: "a-cx", symbol: "USDC", shares: 800, price: 1, priceAsOf: ago(1), costBasis: 800, lots: [] },
    { id: "c4", accountId: "a-brk", symbol: "IBIT", shares: 40, price: 55, priceAsOf: ago(1), costBasis: 1600, lots: [{ id: "l4", date: ago(500), shares: 40, cost: 1600 }] },
    { id: "s1", accountId: "a-brk", symbol: "VTI", shares: 10, price: 290, priceAsOf: ago(1), costBasis: 2000, lots: [] },
  ];
  return p;
}

test("cryptoKind: coins by the account, funds by the symbol, stocks are not crypto", () => {
  assert.equal(cryptoKind({ symbol: "BTC", accountType: "crypto" }), "coin");
  assert.equal(cryptoKind({ symbol: "USDC", accountType: "crypto" }), "stable");
  assert.equal(cryptoKind({ symbol: "IBIT", accountType: "brokerage" }), "fund");
  assert.equal(cryptoKind({ symbol: "VTI", accountType: "brokerage" }), null);
});

test("no crypto: not ready", () => {
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).ready, false);
});

test("value, cost, gain and the share of net worth", () => {
  const d = compute(withCoins(), { today: TODAY });
  assert.deepEqual(d.items.map((i) => i.symbol), ["BTC", "ETH", "IBIT", "USDC"], "largest first; VTI is not crypto");
  near(d.total, 11760 + 4800 + 2200 + 800); near(d.cost, 4200 + 6300 + 1600 + 800); near(d.gain, d.total - d.cost);
  near(d.volatile, d.total - 800);
  near(d.share, d.total / d.netWorth);
  assert.equal(d.level, d.share <= SHARE.small ? "small" : d.share <= SHARE.large ? "medium" : "large");
  assert.equal(d.level, "medium");
  near(d.stress.loss, d.volatile * STRESS_DROP); near(d.stress.share, d.stress.loss / d.netWorth);
});

test("an old price is flagged, a stablecoin's is not", () => {
  const d = compute(withCoins(), { today: TODAY });
  assert.ok(d.items.find((i) => i.symbol === "ETH").stale);
  assert.ok(!d.items.find((i) => i.symbol === "BTC").stale);
  assert.equal(d.staleCount, 1);
});

test("tax if sold: the federal tax with the lots sold less without; the loss to bank and the gain to wait on", () => {
  // Ana and Bo file jointly in 2026: taxable income 126,580, in the 22% bracket and above the 98,900 top of the 0% band for
  // long-term gains, AGI under the 250,000 line of the 3.8% tax
  const d = compute(withCoins(), { today: TODAY });
  // BTC: 0.08 long (+5,740), 0.04 short (+1,820); ETH short (-1,500); IBIT long (+600); USDC long (0)
  near(d.tax.longGain, 0.08 * 98000 - 2100 + 600); near(d.tax.shortGain, 0.04 * 98000 - 2100 - 1500);
  near(d.tax.marginal, 0.22, 1e-9); near(d.tax.gainsRate, 0.15, 1e-9);
  // the short net 320 like pay, the long 6,340 at 15%: 1,021.40; and the 6,660 of gains take AGI from 158,780 to 165,440,
  // one 4,000 step of the child care credit's phase-down: 31% instead of 32% of 3,000, 30 more
  near(d.tax.total, 320 * 0.22 + 6340 * 0.15 + 30);
  // the 1,500 loss banked alone: 22%, and AGI 158,780 -> 157,280 crosses a 4,000 step of the care credit (+30)
  assert.deepEqual(d.harvest.map((h) => h.symbol), ["ETH"]); near(d.harvest[0].saved, 1500 * 0.22 + 30); near(d.harvestSaved, 360);
  assert.equal(d.waitLong.length, 1); assert.equal(d.waitLong[0].symbol, "BTC");
  assert.equal(d.waitLong[0].longOn, "2026-12-05", "the day after a year is up");
  near(d.waitLong[0].saved, 1820 * (0.22 - 0.15));
});

test("a big loss: only $3,000 of a net loss comes off pay this year, the rest carries (IRC 1211(b), 1212(b))", () => {
  const p = withCoins();
  p.holdings.find((h) => h.symbol === "ETH").lots[0].cost = 16300; p.holdings.find((h) => h.symbol === "ETH").costBasis = 16300;   // an 11,500 short-term loss
  const d = compute(p, { today: TODAY });
  // banked alone: 3,000 off pay at 22% = 660 this year, and AGI 158,780 -> 155,780 lifts the child care credit from 32% to
  // 33% of 3,000 (+30): 690; 8,500 carries to next year
  near(d.harvestSaved, 690); near(d.harvestCarry, 8500);
  // sold with everything: the short loss first cancels the short gain (1,820), then the long gains (6,340); 3,340 net loss: 3,000 off pay, 340 carries
  near(d.tax.total, -3000 * 0.22 - 30); near(d.tax.carry, 340);
});

test("a fund bought again within 30 days, an IRA included, cancels the loss on that many shares; a coin does not (IRC 1091; Rev. Rul. 2008-5)", () => {
  const p = withCoins();
  const ibit = p.holdings.find((h) => h.symbol === "IBIT"); ibit.costBasis = 3200; ibit.lots[0].cost = 3200;   // 40 shares at a 1,000 loss
  p.accounts.push({ id: "a-ira2", name: "IRA", type: "ira", balance: 550, history: [] });
  p.holdings.push({ id: "c5", accountId: "a-ira2", symbol: "IBIT", shares: 10, price: 55, priceAsOf: ago(1), costBasis: 560, lots: [{ id: "l5", date: ago(10), shares: 10, cost: 560 }] });
  const d = compute(p, { today: TODAY });
  const h = d.harvest.find((x) => x.symbol === "IBIT");
  near(h.disallowed, 250); near(h.allowed, 750); assert.equal(h.washedBy[0].shares, 10);   // 10 of the 40 shares
  assert.equal(d.harvest.find((x) => x.symbol === "ETH").disallowed, 0);
  near(d.harvestDisallowed, 250);
});

test("a fund in a retirement account is counted but never taxed", () => {
  const p = withCoins();
  p.accounts.push({ id: "a-ira", name: "IRA", type: "ira", balance: 5500, history: [] });
  p.holdings.push({ id: "c5", accountId: "a-ira", symbol: "FBTC", shares: 50, price: 110, priceAsOf: ago(1), costBasis: 1000, lots: [{ id: "l5", date: ago(30), shares: 50, cost: 1000 }] });
  const a = compute(withCoins(), { today: TODAY }), b = compute(p, { today: TODAY });
  near(b.total, a.total + 5500); near(b.tax.total, a.tax.total);
});

test("a crypto account with more than its coins shows the rest; one with none shows its balance", () => {
  const p = withCoins();
  p.accounts.find((a) => a.id === "a-cx").balance += 1000;
  p.accounts.push({ id: "a-cy", name: "Old exchange", type: "crypto", balance: 2500, history: [] });
  const d = compute(p, { today: TODAY });
  const rest = d.items.filter((i) => i.kind === "account");
  assert.deepEqual(rest.map((i) => Math.round(i.value)).sort(), [1000, 2500]);
  assert.ok(rest.every((i) => i.cost === null));
});

// one adult filing single, paid `pay` a year, with coins in a crypto wallet: [symbol, price, shares, cost, date]
function single(pay, coins, more = {}) {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult 1", role: "self", birthDate: "1980-01-01" }];
  p.household.filingStatus = "single";
  p.income = [{ id: "pay", name: "Pay", type: "salary", personId: "a1", amount: pay, period: "annual", taxable: true }];
  p.accounts = [{ id: "w", name: "Wallet", type: "crypto", balance: 0, history: [] }, { id: "brk", name: "Brokerage", type: "brokerage", balance: 0, history: [] }, { id: "ira", name: "IRA", type: "ira", balance: 0, history: [] }];
  p.holdings = coins.map(([symbol, price, shares, cost, date, accountId = "w"], i) => ({ id: `c${i}`, accountId, symbol, shares, price, priceAsOf: TODAY, costBasis: cost, lots: [{ id: `l${i}`, date, shares, cost }] }));
  Object.assign(p.taxes, more);
  return p;
}

test("the carryover the sale adds compares the whole carryover: a gain that uses up some of it counts (IRC 1212(b); Pub. 550 Worksheet 4-1)", () => {
  // single, pay 120,000; this year's other sales: a 10,000 short-term loss (3,000 off pay, 7,000 short-term carries)
  // coins: BTC short +5,000, ETH long -6,000 -> short -5,000, long -6,000: still 3,000 off pay; the worksheet carries 2,000
  // short and 6,000 long, 8,000 in all: 1,000 more than without (not the 6,000 rise in the long-term part alone)
  const p = single(120000, [["BTC", 10000, 1, 5000, ago(100)], ["ETH", 1000, 4, 10000, ago(800)]], { gains: [{ id: "g1", name: "Stock", proceeds: 0, basis: 10000, held: "short" }] });
  const d = compute(p, { today: TODAY });
  near(d.tax.total, 0); near(d.tax.carry, 1000); near(d.tax.net, -1000);
  assert.equal(d.tax.why, "limit", "the other sales already take the whole 3,000");
  assert.equal(d.tax.lossLimit, 3000);
});

test("selling everything: a fund bought in an IRA within 30 days cancels that part of the fund's loss (IRC 1091(a); Rev. Rul. 2008-5)", () => {
  // single, pay 230,000; IBIT 100 shares at a 2,000 long-term loss, 30 bought in the IRA 5 days ago: 600 disallowed, 1,400
  // allowed; BTC long +10,000, ETH short -1,000 -> net long 10,000 - 1,400 - 1,000 = 7,600 at 15% + 3.8% = 1,428.80
  const p = single(230000, [["IBIT", 50, 100, 7000, ago(600), "brk"], ["IBIT", 50, 30, 1500, ago(5), "ira"], ["BTC", 20000, 1, 10000, ago(700)], ["ETH", 1000, 1, 2000, ago(60)]]);
  const d = compute(p, { today: TODAY });
  near(d.tax.disallowed, 600); near(d.tax.net, 7600);
  near(d.tax.total, 1428.80); near(d.tax.addLong, 7600); near(d.tax.addShort, 0);
});

test("a bitcoin fund in a crypto account is a fund (the wash-sale rule reaches it)", () => {
  assert.equal(cryptoKind({ symbol: "IBIT", accountType: "crypto" }), "fund");
});

test("a gain taxed at 0% shows why the tax does not change; nothing gained says so", () => {
  // single, pay 30,000 in 2026: taxable income 13,900 + a 2,000 long-term gain stays under the 0% band's 49,450 top
  const d = compute(single(30000, [["BTC", 12000, 1, 10000, ago(700)]]), { today: TODAY });
  near(d.tax.total, 0); assert.equal(d.tax.why, "zero"); near(d.tax.net, 2000);
  const flat = compute(single(30000, [["BTC", 10000, 1, 10000, ago(700)]]), { today: TODAY });
  assert.equal(flat.tax.why, "none");
});

test("a sale today is in today's tax year: the Federal estimate set to last year works this year, without last year's sales", () => {
  const sale = [["BTC", 10000, 1, 5000, ago(100)], ["ETH", 1000, 4, 10000, ago(800)]];
  const last = compute(single(120000, sale, { year: 2025, gains: [{ id: "g1", name: "Stock", proceeds: 0, basis: 10000, held: "short" }] }), { today: TODAY });
  const now = compute(single(120000, sale), { today: TODAY });
  assert.equal(last.tax.year, 2026); assert.equal(last.tax.otherYear, 2025);
  near(last.tax.total, now.tax.total); near(last.tax.carry, now.tax.carry);
  assert.equal(now.tax.otherYear, null);
});

test("a lot sold on its own takes its own wash-sale match (not the one it gets when every lot is sold)", () => {
  // two IBIT lots, 20 shares each at a 500 long-term loss, and 10 bought in an IRA 10 days ago. Sold together the older lot
  // takes the 10 (26 CFR 1.1091-1(b)); sold alone either lot does: 250 of its 500 counts, and with no other sales this year
  // it comes off pay at 22% = 55
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "a-ira2", name: "IRA", type: "ira", balance: 550, history: [] });
  p.holdings = [
    { id: "f1", accountId: "a-brk", symbol: "IBIT", shares: 40, price: 55, priceAsOf: ago(1), costBasis: 3200, lots: [{ id: "la", date: ago(500), shares: 20, cost: 1600 }, { id: "lb", date: ago(400), shares: 20, cost: 1600 }] },
    { id: "f2", accountId: "a-ira2", symbol: "IBIT", shares: 10, price: 55, priceAsOf: ago(1), costBasis: 560, lots: [{ id: "lc", date: ago(10), shares: 10, cost: 560 }] },
  ];
  const d = compute(p, { today: TODAY });
  const [a, b] = ["la", "lb"].map((id) => d.harvest.find((h) => h.lot.id === id));
  near(a.disallowed, 250); near(b.disallowed, 0);   // together: the older lot is washed
  near(a.saved, 250 * 0.22); near(b.saved, 250 * 0.22);   // alone: each is
  // 750 off pay at 22%, and the child care credit 30 more: on the Federal estimate's return (the business at its profit) AGI is
  // 158,271 and 750 less crosses the 158,000 step (IRC 21(a)(2))
  near(d.harvestSaved, 750 * 0.22 + 30);
});

test("filing separately: a coin in one spouse's account is on that spouse's return, with its own $1,500 limit (Pub. 501; IRC 1211(b))", () => {
  const p = familyPlan(TODAY);
  p.household.filingStatus = "married_separate";
  p.accounts.push({ id: "a-bow", name: "Bo's wallet", type: "crypto", balance: 5000, ownerId: "p-bo", history: [] }, { id: "a-jw", name: "Our wallet", type: "crypto", balance: 5000, ownerId: "", history: [] });
  const eth = (accountId) => [{ id: "e1", accountId, symbol: "ETH", shares: 2, price: 2500, priceAsOf: ago(1), costBasis: 10000, lots: [{ id: "le", date: ago(100), shares: 2, cost: 10000 }] }];
  p.holdings = eth("a-bow");
  const own = compute(p, { today: TODAY });
  assert.equal(own.tax.lossLimit, 1500);
  // Bo's 5,000 short-term loss: 1,500 off Bo's pay, 3,500 carries
  near(own.tax.carry, 3500);
  p.holdings = eth("a-jw");
  const joint = compute(p, { today: TODAY });
  // a joint wallet: 2,500 on each return, 1,500 off each, 1,000 carries on each
  near(joint.tax.carry, 2000);
});

// =============================================================================================================================
// Which coins count as sold (gap list, next 60, item 46; sales.js): a sale of some of a coin worked three ways, the way
// the exchange counts saved at once, with Undo
// =============================================================================================================================
const S = await import("./sales.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const T2 = "2026-11-16";
const money0 = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
/** One adult filing single in 2026, pay 100,000 a year (taxable income 83,900 after the 16,100 standard deduction: the 22%
 *  bracket, and above the 49,450 top of the 0% band, so a long-term gain pays 15%; far under the 200,000 line of the 3.8%).
 *  BTC at 100,000 in a wallet, three purchases: 0.1 on Mar 1, 2023 for 2,500 (25,000 a coin, long-term); 0.1 on Dec 1,
 *  2025 for 9,000 (90,000 a coin, short-term); 0.05 on Jun 1, 2026 for 5,500 (110,000 a coin, short-term, at a loss). */
function wallet(more = {}) {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult 1", role: "self", birthDate: "1980-01-01" }];
  p.household.filingStatus = "single";
  p.income = [{ id: "pay", name: "Pay", type: "salary", personId: "a1", amount: 100000, period: "annual", taxable: true }];
  p.accounts = [{ id: "w", name: "Wallet", type: "crypto", balance: 25000, history: [] }];
  p.holdings = [{ id: "c1", accountId: "w", symbol: "BTC", shares: 0.25, price: 100000, priceAsOf: T2, costBasis: 17000, lots: [
    { id: "l1", date: "2023-03-01", shares: 0.1, cost: 2500 }, { id: "l2", date: "2025-12-01", shares: 0.1, cost: 9000 }, { id: "l3", date: "2026-06-01", shares: 0.05, cost: 5500 }] }];
  Object.assign(p, more);
  return migrate(p);
}
const ask = (amount, extra = {}) => ({ holdingId: "c1", by: "coins", amount, picked: [], ...extra });

test("Which coins count as sold: each way's purchases, gain and tax against a hand calculation", () => {
  const p = wallet();
  const d = compute(p, { today: T2 });
  near(d.tax.marginal, 0.22, 1e-9); near(d.tax.gainsRate, 0.15, 1e-9);
  const r = S.coinOrders(p, { today: T2, ask: ask(0.1, { picked: ["l2"] }) });
  assert.equal(r.coin.symbol, "BTC"); near(r.units, 0.1); near(r.proceeds, 10000);
  const [old, cost, pick] = r.orders;
  // oldest first: all of the 2023 purchase, 10,000 - 2,500 = 7,500 long-term, at 15% = 1,125
  assert.deepEqual(old.pieces.map((x) => [x.key, x.shares, x.cost, x.proceeds, x.gain, x.term]), [["l1", 0.1, 2500, 10000, 7500, "long"]]);
  near(old.gain, 7500); near(old.longGain, 7500); near(old.shortGain, 0); near(old.tax, 1125);
  // highest cost first: the 0.05 bought at 110,000 (5,000 - 5,500 = -500), then half the 90,000 purchase (5,000 - 4,500 = +500):
  // both short-term, they cancel, no tax
  assert.deepEqual(cost.pieces.map((x) => [x.key, x.shares, x.cost, x.proceeds, x.gain, x.term]), [["l3", 0.05, 5500, 5000, -500, "short"], ["l2", 0.05, 4500, 5000, 500, "short"]]);
  near(cost.gain, 0); near(cost.tax, 0); assert.equal(cost.loss, true);
  // the purchase picked: the 90,000 one, 10,000 - 9,000 = 1,000 short-term, like pay at 22% = 220
  assert.deepEqual(pick.pieces.map((x) => [x.key, x.gain, x.term]), [["l2", 1000, "short"]]); near(pick.tax, 220);
  assert.equal(r.least, "cost"); near(r.saving, 1125);
  assert.equal(S.waysSentence(r, money0), "Highest cost first costs least: about $1,125 less federal tax than oldest first.");
  assert.equal(S.wayLine(old, money0), "A gain of $7,500, all long-term, from one purchase.");
  assert.equal(S.wayLine(cost, money0), "No gain or loss, from 2 purchases.");
});

test("Which coins count as sold: a short- or long-term part that comes to $0 is not named (P5)", () => {
  // at 90,000 a coin, oldest first on 0.15: the 2023 purchase (9,000 - 2,500 = +6,500 long-term) and half the Dec 2025 one,
  // bought at 90,000 a coin (4,500 - 4,500 = 0 short-term): "all of it long-term", not "(+$0 short-term, +$6,500 long-term)"
  const p = wallet(); p.holdings[0].price = 90000;
  const old = S.coinOrders(p, { today: T2, ask: ask(0.15) }).orders[0];
  assert.deepEqual(old.pieces.map((x) => [x.key, x.gain, x.term]), [["l1", 6500, "long"], ["l2", 0, "short"]]);
  assert.equal(S.wayLine(old, money0), "A gain of $6,500, all of it long-term, from 2 purchases.");
  const two = [{ term: "long" }, { term: "short" }];
  assert.equal(S.wayLine({ state: "ok", pieces: two, gain: -800, shortGain: -800, longGain: 0.2, carry: 0 }, money0), "A loss of $800, all of it short-term, from 2 purchases.");
  assert.equal(S.wayLine({ state: "ok", pieces: two, gain: -4000, shortGain: -4000, longGain: 0, carry: 1000 }, money0), "A loss of $4,000, all of it short-term, from 2 purchases; $1,000 of the loss carries to next year.");
  // both parts real: Tax lots' line, as before
  assert.equal(S.wayLine({ state: "ok", pieces: two, gain: 6100, shortGain: -800, longGain: 6900, carry: 0 }, money0), "A gain of $6,100 (−$800 short-term, +$6,900 long-term), from 2 purchases.");
});

test("Which coins count as sold: dollars to coins, too many, nothing picked, too few picked, the question kept or dropped", () => {
  const p = wallet();
  // $5,000 at 100,000 a coin is 0.05 coins: oldest first takes half the 2023 purchase (1,250 of cost)
  const r = S.coinOrders(p, { today: T2, ask: { holdingId: "c1", by: "dollars", amount: 5000, picked: [] } });
  near(r.units, 0.05); near(r.orders[0].pieces[0].cost, 1250); near(r.orders[0].gain, 3750);
  assert.equal(r.orders[2].state, "none");
  assert.equal(S.wayLine(r.orders[2], money0), "Check the purchases to sell under “Pick the purchases yourself” to see this way too.");
  const few = S.coinOrders(p, { today: T2, ask: ask(0.1, { picked: ["l3"] }) });
  assert.equal(few.orders[2].state, "short"); near(few.orders[2].has, 0.05);
  assert.equal(S.wayLine(few.orders[2], money0), "The ones you checked hold 0.05 coins: check more, or sell fewer.");
  const many = S.coinOrders(p, { today: T2, ask: ask(0.3) });
  assert.equal(many.tooMany, true); assert.deepEqual(many.orders, []);
  assert.equal(S.waysSentence(many, money0), "BTC in Wallet holds 0.25 coins (worth $25,000): sell at most that.");
  // the question kept on the plan (whatIfs.crypto) is read when none is given; one about a coin no longer there is no question
  p.whatIfs = { ...(p.whatIfs ?? {}), crypto: ask(0.1) };
  assert.deepEqual(S.coinOrders(p, { today: T2 }).ask, ask(0.1));
  p.whatIfs.crypto = { holdingId: "gone", by: "coins", amount: 1, picked: [] };
  const gone = S.coinOrders(p, { today: T2 });
  assert.equal(gone.ask, null); assert.equal(gone.coin.id, "c1"); assert.equal(S.waysSentence(gone), "");
});

test("Which coins count as sold: one written sentence per case (R5)", () => {
  const coin = { symbol: "BTC", account: "Wallet", units: 0.25, value: 25000 };
  const of = (taxes, least, saving = 0) => ({ coin, ask: {}, orders: ["oldest", "cost", "picked"].slice(0, taxes.length).map((key, i) => ({ key, state: "ok", tax: taxes[i] })), least, saving });
  assert.equal(S.waysSentence(of([300, 300, 300], "oldest"), money0), "Whichever way you count, it adds about $300 to your federal tax: here the way makes no difference.");
  assert.equal(S.waysSentence(of([-200, -200], "oldest"), money0), "Whichever way you count, it takes about $200 off your federal tax: here the way makes no difference.");
  assert.equal(S.waysSentence(of([0, 0.2], "oldest"), money0), "There is no federal tax to pay whichever way you count: here the way makes no difference.");
  assert.equal(S.waysSentence(of([100, 600, 100], "oldest"), money0), "Oldest first costs least, as little as another way, and it is what counts unless you tell the exchange otherwise.");
  assert.equal(S.waysSentence(of([100, 600, 400], "oldest"), money0), "Oldest first costs least, about $300 less federal tax than the next best way, and it is what counts unless you tell the exchange otherwise.");
  assert.equal(S.waysSentence(of([900, 100], "cost", 800), money0), "Highest cost first costs least: about $800 less federal tax than oldest first.");
  assert.equal(S.waysSentence(of([900, 400, 100], "picked", 800), money0), "The purchases you picked cost least: about $800 less federal tax than oldest first.");
  assert.equal(S.waysSentence({ coin, ask: {}, tooMany: true, orders: [] }, money0), "BTC in Wallet holds 0.25 coins (worth $25,000): sell at most that.");
  assert.equal(S.waysSentence({ coin, ask: null, orders: [] }), "");
});

test("Which coins count as sold: the wash-sale note only where a way sells at a loss, and it says the rule does not reach coins", () => {
  const p = wallet();
  // highest cost first sells the 110,000 purchase at a loss: the note
  assert.equal(S.washNote(S.coinOrders(p, { today: T2, ask: ask(0.1) })), "Coins are property, not securities: as of 2026 the wash-sale rule does not stop you buying the same coin back at once, so the loss counts in full.");
  // a coin bought again 10 days ago does not cancel the loss (no match for coins), unlike a fund on Tax lots
  const q = wallet(); q.holdings[0].lots.push({ id: "l4", date: "2026-11-06", shares: 0.05, cost: 5000 }); q.holdings[0].shares = 0.3; q.holdings[0].costBasis = 22000;
  const lossy = S.coinOrders(q, { today: T2, ask: ask(0.05, { picked: ["l3"] }) });
  assert.deepEqual(lossy.orders[2].pieces.map((x) => [x.key, x.gain, x.disallowed]), [["l3", -500, 0]]);
  near(lossy.orders[2].tax, -500 * 0.22);
  // only gains (oldest first and the 90,000 purchase picked; highest cost not reached): no note
  const r = { orders: [{ state: "ok", loss: false }, { state: "none" }] };
  assert.equal(S.washNote(r), "");
});

test("Which coins count as sold: the coins offered (coins and stablecoins in a crypto account; never a fund, a price of 0 or none left)", () => {
  const p = wallet();
  p.accounts.push({ id: "b", name: "Brokerage", type: "brokerage", balance: 2200, history: [] });
  p.holdings.push({ id: "f1", accountId: "b", symbol: "IBIT", shares: 40, price: 55, priceAsOf: T2, costBasis: 1600, lots: [] },
    { id: "f2", accountId: "w", symbol: "FBTC", shares: 10, price: 90, priceAsOf: T2, costBasis: 800, lots: [] },
    { id: "s1", accountId: "w", symbol: "USDC", shares: 500, price: 1, priceAsOf: T2, costBasis: 500, lots: [] },
    { id: "z1", accountId: "w", symbol: "DOGE", shares: 100, price: 0, priceAsOf: T2, costBasis: 30, lots: [] },
    { id: "e1", accountId: "w", symbol: "ETH", shares: 0, price: 3000, priceAsOf: T2, costBasis: 0, lots: [] });
  assert.deepEqual(S.coinsOf(p, { today: T2 }).map((c) => c.symbol), ["BTC", "USDC"]);
  const btc = S.coinsOf(p, { today: T2 })[0];
  assert.deepEqual(btc.lots.map((l) => [l.key, l.term]), [["l1", "long"], ["l2", "short"], ["l3", "short"]]);
  assert.equal(S.hasWays(btc), true); assert.equal(S.hasWays(S.coinsOf(p, { today: T2 })[1]), false);
  // coins no purchase covers are one undated purchase of their own (keyed rest:<holding>), counted first by oldest first
  p.holdings[0].shares = 0.3; p.holdings[0].costBasis = 18000;
  const more = S.coinsOf(p, { today: T2 })[0];
  assert.deepEqual(more.lots.map((l) => l.key), ["l1", "l2", "l3", "rest:c1"]);
  assert.equal(S.coinOrders(p, { today: T2, ask: ask(0.05) }).orders[0].pieces[0].key, "rest:c1");
});

test("The way your exchange counts: read with a default, and the words to ask, save and undo", () => {
  assert.deepEqual(S.methodOf(wallet()), { key: "oldest", saved: false });
  assert.deepEqual(S.methodOf({ investments: { cryptoMethod: "cost" } }), { key: "cost", saved: true });
  assert.deepEqual(S.methodOf({ investments: { cryptoMethod: "lifo" } }), { key: "oldest", saved: false }, "an unknown way reads as none saved");
  assert.equal(S.methodAsk, undefined, "a chip saves at once: no question first (P6)");
  assert.equal(S.methodSaid("oldest"), "Saved: the sales you record here now count the oldest coins first (first in, first out).");
  assert.equal(S.methodSaid("cost"), "Saved: the sales you record here now count the coins that cost the most first. Set your exchange the same way before you sell.");
  assert.equal(S.methodSaid("picked"), "Saved: the sales you record here now count the purchases you check at each sale. Pick the same ones on the exchange when you sell.");
  assert.equal(S.methodUndone(undefined), "Undone: back to oldest first, as before.");
  assert.equal(S.methodUndone("cost"), "Undone: back to highest cost first.");
  assert.equal(S.unitsText(0.00012345), "0.00012345"); assert.equal(S.unitsText(1234.5), "1,234.5"); assert.equal(S.unitsText(0.1 + 0.2), "0.3");
  // "1 coin", never "1 coins" (P4); a part of a coin or several are coins
  assert.equal(S.coinsText(1), "1 coin"); assert.equal(S.coinsText(1.000000001), "1 coin"); assert.equal(S.coinsText(0.5), "0.5 coins"); assert.equal(S.coinsText(2), "2 coins");
  assert.equal(S.waysSentence({ coin: { symbol: "ETH", account: "Wallet", units: 1, value: 3000 }, ask: {}, tooMany: true, orders: [] }, money0), "ETH in Wallet holds 1 coin (worth $3,000): sell at most that.");
});

// ---- the page on the fake DOM ------------------------------------------------------------------------------------------------
async function page(plan, today = T2) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const P = { plan: migrate(structuredClone(plan)), saved: [], root: null, textOf };
  P.draw = () => { P.root = new FakeElement("main"); render(P.root, { ui, fmt: { ...fmt, today: () => today }, plan: P.plan, route: { group: "investments", id: "crypto", rest: [], query: {} }, module: { group: "investments", id: "crypto" },
    store: { get: () => P.plan, update: (fn) => { const d = structuredClone(P.plan); fn(d); P.saved.push(d); P.plan = d; P.draw(); } }, redraw: () => P.draw() }); return P; };
  P.text = () => textOf(P.root);
  P.part = (id) => P.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  P.open = (id) => { const d = P.part(id); d.open = true; d.dispatch("toggle"); return d; };
  P.states = () => P.root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open"), e.querySelector(".fold-status")?.textContent ?? ""]);
  P.button = (text, within = P.root) => within.all().find((e) => e.tagName === "BUTTON" && textOf(e) === text);
  return P.draw();
}

test("S11: Which coins count as sold: Work it out keeps the question, names the answer in green, keeps its part open and moves nothing else", async () => {
  const P = await page(wallet());
  assert.deepEqual(P.states(), [["ways", false, "oldest first"]], "one quiet row, shut, saying the way that counts now");
  assert.ok(P.root.all().filter((e) => e.tagName === "DETAILS").every((e) => e.dataset.part || String(e.className).includes("form-more")), "no fold by hand: the add form is a button now");
  assert.equal(P.textOf(P.part("ways").querySelector(".fold-title")), "Which coins count as sold");
  const ways = P.open("ways");
  assert.match(P.textOf(ways), /When you sell some of a coin, which purchases count as sold sets the gain and the tax\. Unless you name them, the oldest count first \(first in, first out\)\./);
  assert.match(P.textOf(ways), /Your exchange reports your sales to the IRS, so set the same way there before you sell \(its settings may call it the cost-basis method\) and keep the confirmation\. A sale only counts the purchases in the wallet or account it is sold from\./);
  const form = ways.all().find((e) => e.tagName === "FORM");
  assert.deepEqual(form.all().filter((e) => ["INPUT", "SELECT"].includes(e.tagName) && !e.closest(".form-more")).map((e) => e.getAttribute("name")), ["by", "amount"], "one coin: no coin box");
  assert.ok(form.all().some((e) => e.tagName === "DETAILS" && /Pick the purchases yourself \(optional\)/.test(P.textOf(e))));
  assert.match(P.textOf(form), /0\.1 coins, bought Mar 1, 2023, \$25,000 a coin/);
  const addBefore = P.button("+ Add another coin");
  assert.ok(addBefore && String(addBefore.className).includes("secondary"));
  form.querySelector('[name="amount"]').value = "0.1";
  form.dispatch("submit");
  assert.equal(P.saved.length, 1);
  assert.deepEqual(P.plan.whatIfs.crypto, ask(0.1));
  assert.deepEqual(P.states(), [["ways", true, "oldest first"]], "the saved part stays open; a question is not a way chosen, so the row still says the way that counts (P1)");
  const green = P.part("ways").all().find((e) => String(e.className).includes("notice"));
  assert.equal(P.textOf(green), "Worked out for 0.1 BTC. Highest cost first costs least: about $1,125 less federal tax than oldest first.");
  assert.match(P.textOf(P.part("ways")), /Oldest first \$1,125 of tax A gain of \$7,500, all long-term, from one purchase\. Highest cost first no tax No gain or loss, from 2 purchases\. Coins are property, not securities/);
  assert.match(P.textOf(P.part("ways")), /Selling 0\.1 BTC at the price on file, \$100,000, brings in about \$10,000\. This is 2026's federal tax only; state tax is not counted\./);
  assert.ok(P.button("+ Add another coin"), "the add button as it was");
  // the next draw (a reload, Back): shut, the question kept, the answer a plain sentence
  P.draw();
  assert.deepEqual(P.states(), [["ways", false, "oldest first"]]);
  const again = P.open("ways");
  assert.ok(!again.all().some((e) => String(e.className).includes("notice")));
  assert.match(P.textOf(again), /Highest cost first costs least/);
});

test("The way your exchange counts: a chip saves at once (no question), says so in green with Undo; Undo puts it back", async () => {
  const had = globalThis.window.confirm, asked = [];
  try {
    const P = await page(wallet());
    globalThis.window.confirm = (text) => { asked.push(text); return false; };
    P.button("Highest cost first", P.open("ways")).click();
    assert.deepEqual(asked, [], "no browser question for a choice Undo takes back (P6)");
    assert.equal(P.saved.length, 1); assert.equal(P.plan.investments.cryptoMethod, "cost");
    assert.deepEqual(P.states(), [["ways", true, "set by you"]]);
    const ways = P.part("ways");
    assert.match(P.textOf(ways), /Saved: the sales you record here now count the coins that cost the most first\. Set your exchange the same way before you sell\. Undo/);
    assert.equal(P.button("Highest cost first", ways).getAttribute("aria-pressed"), "true");
    assert.equal(String(P.button("Undo", ways).className), "secondary");
    P.button("Undo", ways).click();
    assert.equal(P.saved.length, 2); assert.ok(!("cryptoMethod" in P.plan.investments), "none saved again: the field goes");
    assert.match(P.textOf(P.part("ways")), /Undone: back to oldest first, as before\./);
    assert.deepEqual(P.states(), [["ways", true, "oldest first"]]);
    assert.ok(!P.button("Undo", P.part("ways")), "nothing more to undo");
    // a way already on does nothing (the chip is on)
    P.button("Oldest first", P.part("ways")).click();
    assert.equal(P.saved.length, 2);
    // with the question asked and a way saved, "yours" marks it
    const Q = await page({ ...wallet(), investments: { ...wallet().investments, cryptoMethod: "picked" }, whatIfs: { crypto: ask(0.1, { picked: ["l2"] }) } });
    assert.match(Q.textOf(Q.open("ways")), /The ones you pick yours \$220 of tax A gain of \$1,000, all short-term, from one purchase\./);
  } finally { globalThis.window.confirm = had; }
});

test("The page: no coins, the add form open in a card; one purchase per coin, no row; + Add another coin opens and cancels in place", async () => {
  const E = await page(emptyPlan());
  assert.deepEqual(E.states(), []);
  assert.ok(E.root.all().some((e) => e.tagName === "H2" && E.textOf(e) === "Add a coin"));
  assert.ok(!E.root.all().some((e) => e.tagName === "DETAILS" && !String(e.className).includes("form-more")), "no fold by hand");
  const one = wallet(); one.holdings[0].lots = [{ id: "l1", date: "2023-03-01", shares: 0.25, cost: 17000 }];
  const P = await page(one);
  assert.deepEqual(P.states(), [], "every way sells the same coins: no row");
  assert.ok(!P.root.all().some((e) => e.tagName === "H2" && /Add another coin/.test(P.textOf(e))), "the form waits behind its button");
  P.button("+ Add another coin").click();
  assert.ok(P.root.all().some((e) => e.tagName === "H2" && P.textOf(e) === "Add another coin"), "the form in place of the button");
  assert.equal(P.saved.length, 0);
  P.button("Cancel").click();
  assert.ok(P.button("+ Add another coin")); assert.ok(!P.root.all().some((e) => e.tagName === "H2" && P.textOf(e) === "Add another coin"));
  // add: saved, said in green, the button back
  P.button("+ Add another coin").click();
  const f = P.root.all().find((e) => e.tagName === "FORM" && e.querySelector('[name="symbol"]'));
  f.querySelector('[name="symbol"]').value = "ETH"; f.querySelector('[name="shares"]').value = "2"; f.querySelector('[name="price"]').value = "3000";
  f.dispatch("submit");
  assert.equal(P.saved.length, 1); assert.ok(P.plan.holdings.some((h) => h.symbol === "ETH" && h.shares === 2));
  assert.match(P.text(), /ETH added\./); assert.ok(P.button("+ Add another coin"));
  // More on this: the deeper pages as questions
  assert.match(P.text(), /More on this Where is everything I hold\? every account, coins and funds › Which shares of a fund should I sell\? Tax lots and harvesting › Could my family find my coins\? Digital assets ›/);
});

// ---- invariance (gap spec 3.5): the saved way and the question change no page's figures --------------------------------------
test("invariance: with investments.cryptoMethod and whatIfs.crypto saved, every page's compute gives byte-identical output over the fixtures and every household", async () => {
  const { default: REGISTRY } = await import("../../registry.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { investmentsPlan } = await import("../../../qa/fixtures/investments-plan.mjs");
  const mods = (await Promise.all(REGISTRY.map(async (e) => (await e.load()).default))).filter((m) => !m.placeholder && !m.heavy);
  const withWay = (plan) => { const b = structuredClone(plan); b.investments = { ...(b.investments ?? {}), cryptoMethod: "cost" }; b.whatIfs = { ...(b.whatIfs ?? {}), crypto: { holdingId: b.holdings?.[0]?.id ?? "c1", by: "coins", amount: 0.1, picked: ["l1"] } }; return b; };
  // Diagnostics and Settings measure the plan file's size, and Export writes the plan out: a longer plan is a bigger file
  const out = (m, q) => { try { const r = m.compute(q, { today: T2 }); if (["diagnostics", "settings"].includes(m.id) && r) { delete r.size; delete r.sizeKB; } return JSON.stringify(r); } catch (e) { return `THROW ${e.message}`; } };
  const fixtures = [wallet(), withCoins(), investmentsPlan(), familyPlan(T2), renterDebtPlan(), retiredCouplePlan(), emptyPlan()];
  const near2 = mods.filter((m) => m.group === "investments" || m.group === "taxes");
  for (const plan of [...fixtures, ...ARCHETYPES.map((a) => a.build())]) {
    const a = migrate(structuredClone(plan));
    for (const m of near2) assert.equal(out(m, withWay(a)), out(m, a), `${m.group}/${m.id}`);
  }
  for (const plan of fixtures) {
    const a = migrate(structuredClone(plan));
    for (const m of mods.filter((x) => !near2.includes(x) && !(x.group === "reports" && x.id === "export"))) assert.equal(out(m, withWay(a)), out(m, a), `${m.group}/${m.id}`);
  }
  // and no code outside this page reads the new fields
  const fs = await import("node:fs"); const path = await import("node:path"); const { fileURLToPath } = await import("node:url");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".js") ? [path.join(dir, e.name)] : []));
  const readers = [...walk(path.join(ROOT, "modules")), ...walk(path.join(ROOT, "core"))].filter((f) => !f.includes(`${path.sep}crypto${path.sep}`) && /cryptoMethod|whatIfs\??\.crypto\b/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(readers, []);
});
