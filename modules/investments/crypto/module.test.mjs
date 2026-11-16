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
  assert.equal(S.washNote(S.coinOrders(p, { today: T2, ask: ask(0.1) })), "Coins are property, not securities: as of 2026 the wash-sale rule does not stop you buying the same coin back at once, so a loss counts in full.");
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
  assert.deepEqual(P.states(), [["ways", false, "oldest first"], ["sales", false, "none in 2026"], ["staking", false, "only if you stake"]], "three quiet rows, shut; the first says the way that counts now");
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
  assert.deepEqual(P.states(), [["ways", true, "oldest first"], ["sales", false, "none in 2026"], ["staking", false, "only if you stake"]], "the saved part stays open, the other as it was; a question is not a way chosen, so the row still says the way that counts (P1)");
  const green = P.part("ways").all().find((e) => String(e.className).includes("notice"));
  assert.equal(P.textOf(green), "Worked out for 0.1 BTC. Highest cost first costs least: about $1,125 less federal tax than oldest first.");
  assert.match(P.textOf(P.part("ways")), /Oldest first \$1,125 of tax A gain of \$7,500, all long-term, from one purchase\. Highest cost first no tax No gain or loss, from 2 purchases\. Coins are property, not securities/);
  assert.match(P.textOf(P.part("ways")), /Selling 0\.1 BTC at the price on file, \$100,000, brings in about \$10,000\. This is 2026's federal tax only; state tax is not counted\./);
  assert.ok(P.button("+ Add another coin"), "the add button as it was");
  // the next draw (a reload, Back): shut, the question kept, the answer a plain sentence
  P.draw();
  assert.deepEqual(P.states(), [["ways", false, "oldest first"], ["sales", false, "none in 2026"], ["staking", false, "only if you stake"]]);
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
    assert.deepEqual(P.states(), [["ways", true, "set by you"], ["sales", false, "none in 2026"], ["staking", false, "only if you stake"]]);
    const ways = P.part("ways");
    assert.match(P.textOf(ways), /Saved: the sales you record here now count the coins that cost the most first\. Set your exchange the same way before you sell\. Undo/);
    assert.equal(P.button("Highest cost first", ways).getAttribute("aria-pressed"), "true");
    assert.equal(String(P.button("Undo", ways).className), "secondary");
    P.button("Undo", ways).click();
    assert.equal(P.saved.length, 2); assert.ok(!("cryptoMethod" in P.plan.investments), "none saved again: the field goes");
    assert.match(P.textOf(P.part("ways")), /Undone: back to oldest first, as before\./);
    assert.deepEqual(P.states(), [["ways", true, "oldest first"], ["sales", false, "none in 2026"], ["staking", false, "only if you stake"]]);
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
  assert.deepEqual(P.states().map((x) => x[0]), ["sales", "staking"], "every way sells the same coins: no row for the ways (the sales row and the staking row stay)");
  assert.ok(!P.root.all().some((e) => /^H[23]$/.test(e.tagName) && /Add another coin/.test(P.textOf(e))), "the form waits behind its button");
  P.button("+ Add another coin").click();
  assert.ok(P.root.all().some((e) => e.tagName === "H3" && P.textOf(e) === "Add another coin"), "the form in place of the button, inside the list's card");
  assert.equal(P.saved.length, 0);
  P.button("Cancel").click();
  assert.ok(P.button("+ Add another coin")); assert.ok(!P.root.all().some((e) => e.tagName === "H3" && P.textOf(e) === "Add another coin"));
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

// =============================================================================================================================
// Sales for your tax return (gap list, next 60, item 46; sales.js): record a coin sale, take it back, the year's coin sales
// as Form 8949 lines, the CSV and the words
// =============================================================================================================================
const sell = (units, proceeds, sold, extra = {}) => ({ holdingId: "c1", units, proceeds, sold, ...extra });

test("Record a sale: the purchases it takes each way, short or long at the sale day, against a hand calculation", () => {
  // oldest first: 0.15 BTC sold Oct 3, 2026 for 14,100 (94,000 a coin) takes all of the 2023 purchase (0.1: 9,400 - 2,500 =
  // 6,900, long-term) and half the Dec 2025 one (0.05: 4,700 - 4,500 = 200, held under a year: short-term)
  const s = S.planSale(wallet(), sell(0.15, 14100, "2026-10-03"), { today: T2 });
  assert.equal(s.ok, true); assert.equal(s.method, "oldest");
  assert.deepEqual(s.pieces, [{ lotId: "l1", acquired: "2023-03-01", units: 0.1, cost: 2500, proceeds: 9400, gain: 6900, term: "long", noCost: false }, { lotId: "l2", acquired: "2025-12-01", units: 0.05, cost: 4500, proceeds: 4700, gain: 200, term: "short", noCost: false }]);
  near(s.gain, 7100); near(s.shortGain, 200); near(s.longGain, 6900);
  assert.deepEqual(s.rows.map((r) => [r.name, r.proceeds, r.basis, r.held, r.coin.acquired, r.coin.sold, r.coin.units, r.coin.lot]), [["0.1 BTC", 9400, 2500, "long", "2023-03-01", "2026-10-03", 0.1, "l1"], ["0.05 BTC", 4700, 4500, "short", "2025-12-01", "2026-10-03", 0.05, "l2"]]);
  assert.equal(S.recordedSentence(s, money0), "Recorded: 0.15 BTC sold Oct 3, 2026 for $14,100, oldest first: a gain of $7,100 (+$200 short-term, +$6,900 long-term). It is now in this year's gains for your tax estimate.");
  assert.equal(S.moneyNote(s, money0), "The $14,100 you got is not added to any account here: add it to the account it went to.");
  // highest cost first (the way saved): the 0.05 at 110,000 (4,700 - 5,500 = -800) then the 0.1 at 90,000 (9,400 - 9,000 = 400)
  const c = S.planSale(wallet({ investments: { cryptoMethod: "cost" } }), sell(0.15, 14100, "2026-10-03"), { today: T2 });
  assert.equal(c.method, "cost");
  assert.deepEqual(c.pieces.map((p) => [p.lotId, p.units, p.cost, p.proceeds, p.gain, p.term]), [["l3", 0.05, 5500, 4700, -800, "short"], ["l2", 0.1, 9000, 9400, 400, "short"]]);
  assert.equal(S.recordedSentence(c, money0), "Recorded: 0.15 BTC sold Oct 3, 2026 for $14,100, highest cost first: a loss of $400, short-term. It is now in this year's gains for your tax estimate.");
  // the purchases checked win over the way saved: the 2023 one and the Jun 2026 one, oldest first among them
  const k = S.planSale(wallet({ investments: { cryptoMethod: "cost" } }), sell(0.15, 14100, "2026-10-03", { picked: ["l1", "l3"] }), { today: T2 });
  assert.equal(k.method, "picked");
  assert.deepEqual(k.pieces.map((p) => [p.lotId, p.gain, p.term]), [["l1", 6900, "long"], ["l3", -800, "short"]]);
  assert.equal(S.recordedSentence(k, money0), "Recorded: 0.15 BTC sold Oct 3, 2026 for $14,100, the purchases you checked: a gain of $6,100 (−$800 short-term, +$6,900 long-term). It is now in this year's gains for your tax estimate.");
  // all long-term, and nothing gained
  const l = S.planSale(wallet(), sell(0.1, 9400, "2026-10-03"), { today: T2 });
  assert.equal(S.recordedSentence(l, money0), "Recorded: 0.1 BTC sold Oct 3, 2026 for $9,400, oldest first: a gain of $6,900, long-term. It is now in this year's gains for your tax estimate.");
  const z = S.planSale(wallet(), sell(0.1, 2500, "2026-10-03"), { today: T2 });
  assert.equal(S.recordedSentence(z, money0), "Recorded: 0.1 BTC sold Oct 3, 2026 for $2,500, oldest first: no gain or loss. It is now in this year's gains for your tax estimate.");
});

test("Record a sale: a purchase made after the sale day is not taken; a year and a day makes long-term; the money adds up in cents", () => {
  // sold May 15, 2026: the Jun 2026 purchase was not yet bought, so 0.2 coins were held and highest cost first takes the 90,000 one
  const p = wallet({ investments: { cryptoMethod: "cost" } });
  assert.deepEqual(S.planSale(p, sell(0.25, 20000, "2026-05-15"), { today: T2 }), { ok: false, field: "units", error: "BTC in Wallet held 0.2 coins on May 15, 2026 (the rest was bought after that day): type at most that." });
  assert.deepEqual(S.planSale(p, sell(0.1, 8000, "2026-05-15"), { today: T2 }).pieces.map((x) => x.lotId), ["l2"]);
  // bought Oct 3, 2025: sold Oct 3, 2026 is a year to the day, short-term; Oct 4 is more than a year, long-term (Pub. 550: from the day after)
  const q = wallet(); q.holdings[0].lots[1].date = "2025-10-03";
  const day = (d) => S.planSale(q, sell(0.1, 9000, d, { picked: ["l2"] }), { today: T2 }).pieces[0].term;
  assert.equal(day("2026-10-03"), "short"); assert.equal(day("2026-10-04"), "long");
  // three equal purchases sold for 100.00: 33.33, 33.33 and the last takes the rest, 33.34
  const r = wallet(); r.holdings[0].lots = [{ id: "a", date: "2024-01-01", shares: 0.1, cost: 10 }, { id: "b", date: "2024-02-01", shares: 0.1, cost: 10 }, { id: "c", date: "2024-03-01", shares: 0.1, cost: 10 }]; r.holdings[0].shares = 0.3; r.holdings[0].costBasis = 30;
  const t = S.planSale(r, sell(0.3, 100, "2026-10-03"), { today: T2 });
  assert.deepEqual(t.pieces.map((x) => x.proceeds), [33.33, 33.33, 33.34]); near(t.pieces.reduce((a, x) => a + x.proceeds, 0), 100, 1e-9);
  // "The ones you pick" saved and a coin of one purchase: nothing to check, it is that purchase
  const one = wallet({ investments: { cryptoMethod: "picked" } }); one.holdings[0].lots = [{ id: "only", date: "2024-01-01", shares: 0.25, cost: 17000 }];
  assert.deepEqual(S.planSale(one, sell(0.1, 10000, "2026-10-03"), { today: T2 }).pieces.map((x) => x.lotId), ["only"]);
});

test("Record a sale: one written sentence per refusal (R5)", () => {
  const p = wallet();
  const no = (input, more = {}) => S.planSale(more.plan ?? p, input, { today: T2 });
  assert.deepEqual(no({ holdingId: "nope", units: 1, proceeds: 1, sold: "2026-10-03" }), { ok: false, field: "coin", error: "Choose the coin you sold." });
  assert.deepEqual(no(sell(0, 100, "2026-10-03")), { ok: false, field: "units", error: "Type how many coins you sold." });
  assert.deepEqual(no(sell(0.1, 100, "")), { ok: false, field: "sold", error: "Type the day you sold them." });
  assert.deepEqual(no(sell(0.1, 100, "2026-12-01")), { ok: false, field: "sold", error: "A sale date cannot be in the future." });
  assert.deepEqual(no(sell(0.1, 100, "2025-12-30")), { ok: false, field: "sold", error: "A sale on Dec 30, 2025 belongs on the 2025 return, and the Federal estimate works out 2026: record 2026's sales here, or set the year on the Federal estimate." });
  assert.deepEqual(no(sell(0.1, null, "2026-10-03")), { ok: false, field: "proceeds", error: "Type what you got for them, in dollars." });
  assert.deepEqual(no(sell(0.1, -5, "2026-10-03")), { ok: false, field: "proceeds", error: "Type what you got for them, in dollars." });
  assert.deepEqual(no(sell(0.3, 100, "2026-10-03")), { ok: false, field: "units", error: "BTC in Wallet held 0.25 coins on Oct 3, 2026: type at most that." });
  assert.deepEqual(no(sell(0.1, 100, "2026-10-03"), { plan: wallet({ investments: { cryptoMethod: "picked" } }) }), { ok: false, field: "picked", error: "Check the purchases you sold, under “Pick the purchases yourself”." });
  assert.deepEqual(no(sell(0.1, 100, "2026-10-03", { picked: ["l3"] })), { ok: false, field: "picked", error: "The purchases you checked held 0.05 coins: check more, or type fewer." });
  assert.equal(no(sell(0.1, 0, "2026-10-03")).ok, true, "sold for nothing is a sale (a loss)");
  // the Federal estimate set to 2025: 2025's sales are recorded, a 2026 one is refused
  const last = wallet(); last.taxes.year = 2025;
  assert.equal(S.planSale(last, sell(0.1, 9000, "2025-12-30"), { today: T2 }).ok, true);
  assert.match(S.planSale(last, sell(0.1, 9000, "2026-10-03"), { today: T2 }).error, /^A sale on Oct 3, 2026 belongs on the 2026 return, and the Federal estimate works out 2025: record 2025's sales here/);
  assert.equal(S.recordWay({ key: "oldest" }), "Counted oldest first (first in, first out), unless you check the purchases you sold.");
  assert.equal(S.recordWay({ key: "cost" }), "Counted highest cost first, the way you chose, unless you check the purchases you sold.");
  assert.equal(S.recordWay({ key: "picked" }), "Check the purchases you sold under “Pick the purchases yourself”, the way you chose.");
});

test("Record a sale, then take it back: the coins, the costs, the account and the year's sales are as they were; a coin sold out goes and comes back", async () => {
  const p = wallet();
  const s = S.planSale(p, sell(0.15, 14100, "2026-10-03"), { today: T2 });
  const d = structuredClone(p);
  assert.equal(S.applySale(d, s, "s1", T2), true);
  const btc = d.holdings[0];
  near(btc.shares, 0.1); near(btc.costBasis, 10000);
  assert.deepEqual(btc.lots, [{ id: "l2", date: "2025-12-01", shares: 0.05, cost: 4500 }, { id: "l3", date: "2026-06-01", shares: 0.05, cost: 5500 }], "the 2023 purchase is gone, half the Dec 2025 one left");
  near(d.accounts[0].balance, 10000, 1e-9);
  assert.deepEqual(d.taxes.gains.map((g) => [g.id, g.coin.sale, g.proceeds, g.basis, g.held]), [["s1-1", "s1", 9400, 2500, "long"], ["s1-2", "s1", 4700, 4500, "short"]]);
  // the Federal estimate counts it: 6,900 long-term at 15% and 200 short-term at 22% = 1,079 more
  const { taxView } = await import("../../taxes/federal/known.js");
  const fed = (q) => taxView(q, { today: T2 }).result.totalTax;
  near(fed(d) - fed(p), 6900 * 0.15 + 200 * 0.22, 0.01);
  const back = structuredClone(d);
  assert.equal(S.removeSale(back, "s1", T2), true);
  assert.deepEqual(back.holdings, p.holdings); assert.deepEqual(back.taxes.gains, p.taxes.gains); near(back.accounts[0].balance, 25000);
  assert.equal(S.removeSale(back, "s1", T2), false, "nothing left to take back");
  // every coin sold: the holding goes, the wallet's balance is 0; taken back, it is made again at the sale's price on its day
  const all = S.planSale(p, sell(0.25, 24000, "2026-10-03"), { today: T2 });
  const e = structuredClone(p); S.applySale(e, all, "s2", T2);
  assert.deepEqual(e.holdings, []); assert.equal(e.accounts[0].balance, 0);
  S.removeSale(e, "s2", T2);
  assert.equal(e.holdings.length, 1);
  const h = e.holdings[0];
  assert.deepEqual([h.id, h.symbol, h.shares, h.costBasis, h.price, h.priceAsOf, h.name], ["c1", "BTC", 0.25, 17000, 96000, "2026-10-03", "Bitcoin"]);
  assert.deepEqual(h.lots, p.holdings[0].lots, "the purchases back in date order");
  near(e.accounts[0].balance, 24000);
});

test("Sales for your tax return: the year's coin sales as Form 8949 lines, grouped by sale, with one sentence per case", () => {
  const p = wallet();
  const a = S.planSale(p, sell(0.15, 14100, "2026-10-03"), { today: T2 });
  S.applySale(p, a, "s1", T2);
  const b = S.planSale(p, sell(0.05, 4000, "2026-11-02"), { today: T2 });
  S.applySale(p, b, "s2", T2);
  // a coin sale of another year on Capital gains, and a sale typed there by hand (no coin): neither is a line
  p.taxes.gains.push({ id: "old", name: "0.01 ETH", proceeds: 30, basis: 20, held: "short", coin: { sale: "old", holding: "x", account: "w", symbol: "ETH", units: 0.01, acquired: null, sold: "2025-06-01", lot: null } },
    { id: "g1", name: "100 VTI", proceeds: 30000, basis: 22000, held: "long" });
  const cs = S.coinSales(p, { today: T2 });
  assert.equal(cs.year, 2026); assert.equal(cs.count, 2); assert.equal(cs.elsewhere, 1);
  assert.deepEqual(cs.lines.map((l) => [l.description, l.acquired, l.sold, l.proceeds, l.cost, l.gain, l.term]), [
    ["0.1 BTC", "2023-03-01", "2026-10-03", 9400, 2500, 6900, "long"], ["0.05 BTC", "2025-12-01", "2026-10-03", 4700, 4500, 200, "short"],
    ["0.05 BTC", "2025-12-01", "2026-11-02", 4000, 4500, -500, "short"]]);
  assert.deepEqual(cs.sales.map((s) => [s.id, s.units, s.proceeds, s.cost, s.gain, s.lines.length]), [["s2", 0.05, 4000, 4500, -500, 1], ["s1", 0.15, 14100, 7000, 7100, 2]], "newest first");
  near(cs.shortTotal, -300); near(cs.longTotal, 6900);
  assert.equal(S.coinSalesSentence(cs, money0), "Your 2026 coin sales: a short-term loss of $300 and a long-term gain of $6,900.");
  assert.equal(S.elsewhereSentence(cs), "One coin sale dated outside 2026 is still on Capital gains, where the Federal estimate counts it as 2026's: remove it there once that year's return is done.");
  assert.equal(S.elsewhereSentence({ ...cs, elsewhere: 2 }), "2 coin sales dated outside 2026 are still on Capital gains, where the Federal estimate counts them as 2026's: remove them there once that year's return is done.");
  assert.equal(S.elsewhereSentence({ ...cs, elsewhere: 0 }), "");
  const of = (shortTotal, longTotal) => S.coinSalesSentence({ year: 2026, count: 1, shortTotal, longTotal }, money0);
  assert.equal(of(200, 0), "Your 2026 coin sales: a short-term gain of $200.");
  assert.equal(of(0, -700), "Your 2026 coin sales: a long-term loss of $700.");
  assert.equal(of(0.2, 0), "Your 2026 coin sales come out even: no gain or loss.");
  assert.equal(S.coinSalesSentence({ year: 2026, count: 0 }), "No coin sales recorded for 2026 yet. When you sell, record it here: the coins come off your list, the sale counts in your tax estimate, and the list is ready for your tax preparer.");
  assert.equal(S.lineText(cs.lines[0], money0), "0.1 bought Mar 1, 2023: sold for $9,400, cost $2,500, +$6,900 long-term");
  assert.equal(S.lineText({ ...cs.lines[2], acquired: null }, money0), "0.05 bought on a day not on file: sold for $4,000, cost $4,500, −$500 short-term");
  assert.equal(S.removeAsk(cs.sales[1]), "Remove the sale of 0.15 BTC on Oct 3, 2026? It comes off Capital gains and its coins go back on your list.");
  assert.equal(S.removedSaid(cs.sales[1]), "Sale removed: 0.15 BTC back on your list and off Capital gains.");
  // an edit on Capital gains shows here
  p.taxes.gains.find((g) => g.id === "s2-1").proceeds = 4600;
  assert.equal(S.coinSales(p, { today: T2 }).sales[0].gain, 100);
});

test("Record a sale: fewer coins than one satoshi is refused, and a sale with no rows writes nothing (F1)", () => {
  const p = wallet();
  for (const u of [1e-10, 1e-9, 5e-9]) assert.deepEqual(S.planSale(p, sell(u, 5, "2026-10-03"), { today: T2 }), { ok: false, field: "units", error: "Type at least 0.00000001 of a coin, the smallest amount this list keeps." }, String(u));
  // one satoshi is a sale: one row, and Undo puts the coin back to the last place
  const s = S.planSale(p, sell(1e-8, 5, "2026-10-03"), { today: T2 });
  assert.equal(s.ok, true); assert.equal(s.rows.length, 1); assert.equal(s.units, 1e-8);
  const d = structuredClone(p); S.applySale(d, s, "s1", T2);
  assert.equal(d.holdings[0].shares, 0.24999999); assert.equal(d.taxes.gains.length, 1);
  assert.equal(S.removeSale(d, "s1", T2), true); assert.deepEqual(d.holdings, p.holdings);
  // the coins sold are the pieces': what comes off is what Undo puts back
  near(S.planSale(p, sell(0.15, 14100, "2026-10-03"), { today: T2 }).units, 0.15, 0);
  // a sale with no rows (made by hand, or by a future change) changes nothing
  const e = structuredClone(p);
  assert.equal(S.applySale(e, { ...s, pieces: [], rows: [] }, "s2", T2), false);
  assert.deepEqual(e, p);
});

test("Record a sale: a day not on the calendar is refused with its own sentence (F3)", () => {
  const p = wallet();
  for (const d of ["2026-02-31", "2026-13-45", "2026-04-31", "2026-00-10"]) assert.deepEqual(S.planSale(p, sell(0.1, 100, d), { today: T2 }), { ok: false, field: "sold", error: "That day is not on the calendar: check the day and the month." }, d);
  assert.equal(S.planSale(p, sell(0.1, 100, "2026-02-28"), { today: T2 }).ok, true);
  const leap = wallet(); leap.taxes.year = 2024;
  assert.equal(S.planSale(leap, sell(0.1, 100, "2024-02-29"), { today: T2 }).ok, true, "a leap day is a day");
});

test("Record a sale: what was paid not on file is said before and after, on the list, the printout and the file; a blank cost stays blank (F2)", async () => {
  const { splitCsv } = await import("../../../core/csv.js");
  // ETH with no cost on file (left blank on Holdings) and no purchases typed: sold 0.5 for 1,000
  const p = wallet(); p.holdings.push({ id: "e1", accountId: "w", symbol: "ETH", shares: 1, price: 3000, priceAsOf: T2, costBasis: null, lots: [] });
  const eth = S.recordable(p, T2).find((c) => c.id === "e1");
  assert.equal(eth.noCost, 1); assert.equal(S.recordable(p, T2).find((c) => c.id === "c1").noCost, 0);
  assert.equal(S.costMissing(eth), "What you paid for this ETH is not on file, so a sale of it counts as all gain: add it on Holdings first, if you know it.");
  assert.equal(S.costMissing(S.recordable(p, T2)[0]), "", "every BTC purchase has its cost");
  const s = S.planSale(p, { holdingId: "e1", units: 0.5, proceeds: 1000, sold: "2026-11-02" }, { today: T2 });
  assert.equal(s.ok, true); assert.equal(s.noCost, 0.5); assert.deepEqual(s.pieces.map((x) => [x.cost, x.gain, x.noCost]), [[0, 1000, true]]);
  assert.equal(s.rows[0].coin.noCost, true);
  assert.equal(S.costNote(s, money0), "What you paid for the 0.5 ETH is not on file, so the whole $1,000 counts as gain. If you know it, tap Undo, add it on Holdings, then record the sale again.");
  assert.equal(S.costNote(S.planSale(p, sell(0.1, 9400, "2026-10-03"), { today: T2 }), money0), "", "a cost on file: no note");
  const d = structuredClone(p); S.applySale(d, s, "s1", T2);
  const left = d.holdings.find((h) => h.id === "e1");
  assert.equal(left.shares, 0.5); assert.equal(left.costBasis, null, "a blank cost is not made $0 by a sale");
  const cs = S.coinSales(d, { today: T2 });
  assert.equal(cs.lines[0].noCost, true);
  assert.equal(S.lineText(cs.lines[0], money0), "0.5 bought on a day not on file: sold for $1,000, cost not on file (counted as $0), +$1,000 long-term");
  const rows = splitCsv(S.form8949Csv(cs, d), ",").filter((r) => r.length > 1);
  assert.deepEqual(rows[0], ["What was sold", "Date bought", "Date sold", "Sold for", "Cost", "Gain or loss", "Short or long term", "Note"]);
  assert.deepEqual(rows[1], ["0.5 ETH", "unknown", "11/02/2026", "1000.00", "0.00", "1000.00", "long-term", "cost not on file, counted as 0"]);
  // Undo: back exactly, still blank; sold out and taken back, made again with a blank cost
  assert.equal(S.removeSale(d, "s1", T2), true); assert.deepEqual(d.holdings, p.holdings);
  const all = structuredClone(p); S.applySale(all, S.planSale(all, { holdingId: "e1", units: 1, proceeds: 2000, sold: "2026-11-02" }, { today: T2 }), "s2", T2);
  assert.ok(!all.holdings.some((h) => h.id === "e1")); S.removeSale(all, "s2", T2);
  assert.equal(all.holdings.find((h) => h.id === "e1").costBasis, null);
  // a cost left as "" reads the same; a cost of 0 typed is a cost on file
  const blank = structuredClone(p); blank.holdings[1].costBasis = "";
  assert.equal(S.recordable(blank, T2)[1].noCost, 1);
  const typed0 = structuredClone(p); typed0.holdings[1].costBasis = 0;
  assert.equal(S.recordable(typed0, T2)[1].noCost, 0);
  // some coins with a cost, some without: a purchase typed with its cost, the rest of the coins on a blank holding cost
  const part = structuredClone(p); part.holdings[1].lots = [{ id: "e-a", date: "2024-01-01", shares: 0.4, cost: 800 }];
  const pc = S.recordable(part, T2)[1];
  assert.equal(pc.noCost, 0.6);
  assert.equal(S.costMissing(pc), "What you paid for 0.6 coins of this ETH is not on file, so selling those counts as all gain: add it on Holdings first, if you know it.");
  const ps = S.planSale(part, { holdingId: "e1", units: 0.8, proceeds: 2400, sold: "2026-11-02" }, { today: T2 });
  assert.deepEqual(ps.pieces.map((x) => [x.lotId, x.units, x.cost, x.noCost]), [[null, 0.6, 0, true], ["e-a", 0.2, 400, false]], "the undated rest first, then the 2024 purchase");
  assert.equal(S.costNote(ps, money0), "What you paid for 0.6 of the 0.8 ETH is not on file, so it counts as $0. If you know it, tap Undo, add it on Holdings, then record the sale again.");
  // a purchase typed with a blank cost: not on file, and it stays blank after a part of it is sold and taken back
  const lot = structuredClone(p); lot.holdings[1].lots = [{ id: "e-b", date: "2024-01-01", shares: 1, cost: null }];
  const ls = S.planSale(lot, { holdingId: "e1", units: 0.25, proceeds: 750, sold: "2026-11-02" }, { today: T2 });
  assert.equal(ls.noCost, 0.25);
  const ld = structuredClone(lot); S.applySale(ld, ls, "s3", T2);
  assert.equal(ld.holdings[1].lots[0].cost, null); S.removeSale(ld, "s3", T2); assert.deepEqual(ld.holdings, lot.holdings);
  // the ways say it too
  const ways = S.coinOrders(part, { today: T2, ask: { holdingId: "e1", by: "coins", amount: 0.5, picked: [] } });
  assert.equal(S.costMissing(ways.coin), S.costMissing(pc));
});

test("Record a sale: a short- or long-term part that comes to $0 is not named, and a line with no gain says so (P5)", () => {
  // sold at 90,000 a coin: the 2023 purchase +6,500 long-term, half the Dec 2025 one (bought at 90,000) 0 short-term
  const s = S.planSale(wallet(), sell(0.15, 13500, "2026-10-03"), { today: T2 });
  assert.deepEqual(s.pieces.map((x) => [x.gain, x.term]), [[6500, "long"], [0, "short"]]);
  assert.equal(S.recordedSentence(s, money0), "Recorded: 0.15 BTC sold Oct 3, 2026 for $13,500, oldest first: a gain of $6,500, all of it long-term. It is now in this year's gains for your tax estimate.");
  const p = wallet(); S.applySale(p, s, "s1", T2);
  const lines = S.coinSales(p, { today: T2 }).lines;
  assert.equal(S.lineText(lines[1], money0), "0.05 bought Dec 1, 2025: sold for $4,500, cost $4,500, no gain or loss, short-term");
  assert.equal(S.recordedSentence({ ...s, gain: -800, shortGain: -800, longGain: 0 }, money0), "Recorded: 0.15 BTC sold Oct 3, 2026 for $13,500, oldest first: a loss of $800, all of it short-term. It is now in this year's gains for your tax estimate.");
});

test("Sales for your tax return: the preparer's note says what the IRS instructions say (F4; read 2026-11-16)", () => {
  // Instructions for Form 1099-DA (2026), box 1f: "You must reduce the proceeds by digital asset transaction costs"; its
  // "Applicable Checkbox on Form 8949": codes G, H, J, K. Instructions for Form 8949 (2025): column (d) the proceeds shown on
  // the form, code E in column (f) for transaction costs not reflected; "Use box I" / "Use box L" without a 1099-DA.
  assert.equal(S.FORM_NOTE, "“Sold for” is what was got after the exchange's fee. A Form 1099-DA shows proceeds with the fee already taken out: use its amount, and adjust (code E) only for a fee it leaves out. Short-term lines go on Part I of Form 8949 and long-term lines on Part II, in the digital-asset boxes: the one the 1099-DA names in its “Applicable checkbox on Form 8949” (G, H, J or K), or I or L for a sale with no 1099-DA. This list is information for the preparer, not a filing.");
  assert.ok(!/enters the form's amount and the fee as an adjustment/.test(S.FORM_NOTE), "no longer says the fee is always an adjustment");
  assert.equal(S.FORM_SCREEN, "For your tax preparer: print this list (the printout also says where each line goes on the form) or save it as a spreadsheet. It is not a filing.");
});

test("Sales for your tax return: the CSV in Form 8949's order, dates as the form writes them, coins to eight places, never a formula", async () => {
  const { splitCsv } = await import("../../../core/csv.js");
  const p = wallet();
  p.holdings[0].lots.unshift({ id: "l0", date: null, shares: 0.00012345, cost: 1 }); p.holdings[0].shares = 0.25012345; p.holdings[0].costBasis = 17001;
  S.applySale(p, S.planSale(p, sell(0.10012345, 9500, "2026-10-03"), { today: T2 }), "s1", T2);
  const cs = S.coinSales(p, { today: T2 });
  const rows = splitCsv(S.form8949Csv(cs, p), ",").filter((r) => r.length > 1);
  assert.deepEqual(rows[0], ["What was sold", "Date bought", "Date sold", "Sold for", "Cost", "Gain or loss", "Short or long term"]);
  assert.deepEqual(rows.slice(1), [["0.00012345 BTC", "unknown", "10/03/2026", "11.71", "1.00", "10.71", "long-term"], ["0.1 BTC", "03/01/2023", "10/03/2026", "9488.29", "2500.00", "6988.29", "long-term"]]);
  // a typed symbol a spreadsheet would run as a formula ("=SUM"): the description starts with the coins, so it never is one
  // (Tax lots' csvText still guards the column, and the owner's name when filing separately)
  const q = wallet(); q.holdings[0].symbol = "=SUM"; q.holdings[0].id = "c1";
  S.applySale(q, S.planSale(q, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  assert.equal(splitCsv(S.form8949Csv(S.coinSales(q, { today: T2 }), q), ",")[1][0], "0.1 =SUM", "the description starts with the units, so it is never a formula");
  // filing separately with an owner: "Whose"
  const r = wallet(); r.household.people.push({ id: "a2", name: "Adult 2", role: "partner", birthDate: "1981-01-01" }); r.household.filingStatus = "married_separate"; r.accounts[0].ownerId = "a1";
  S.applySale(r, S.planSale(r, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  const sep = splitCsv(S.form8949Csv(S.coinSales(r, { today: T2 }), r), ",");
  assert.equal(sep[0][7], "Whose"); assert.equal(sep[1][7], "Adult 1");
  assert.equal(S.formDay("2026-01-05"), "01/05/2026"); assert.equal(S.formDay(null), "");
});

test("S11: Sales for your tax return: Record the sale writes it, names it in green with Undo, keeps its part open and moves no other part", async () => {
  const had = globalThis.window.confirm;
  try {
    const P = await page(wallet());
    const sales = P.open("sales");
    assert.match(P.textOf(sales), /^Sales for your tax return none in 2026 › No coin sales recorded for 2026 yet\./);
    assert.match(P.textOf(sales), /Record a sale Counted oldest first \(first in, first out\), unless you check the purchases you sold\./);
    const form = sales.all().find((e) => e.tagName === "FORM");
    assert.deepEqual(form.all().filter((e) => ["INPUT", "SELECT"].includes(e.tagName) && !e.closest(".form-more")).map((e) => e.getAttribute("name")), ["units", "sold", "proceeds"], "three boxes; the purchases folded");
    assert.equal(P.textOf(form.all().find((e) => e.tagName === "BUTTON" && e.getAttribute("type") === "submit")), "Record the sale");
    assert.equal(form.querySelector('[name="sold"]').value, T2, "Sold on starts on today (P5)");
    form.querySelector('[name="units"]').value = "0.15"; form.querySelector('[name="sold"]').value = "2026-10-03"; form.querySelector('[name="proceeds"]').value = "14100";
    form.dispatch("submit");
    assert.equal(P.saved.length, 1);
    assert.equal(P.plan.taxes.gains.length, 2); near(P.plan.holdings[0].shares, 0.1);
    assert.deepEqual(P.states(), [["ways", false, "oldest first"], ["sales", true, "1 in 2026"], ["staking", false, "only if you stake"]], "the saved part open, the other shut as it was");
    const t = P.textOf(P.part("sales"));
    assert.match(t, /Recorded: 0\.15 BTC sold Oct 3, 2026 for \$14,100, oldest first: a gain of \$7,100 \(\+\$200 short-term, \+\$6,900 long-term\)\. It is now in this year's gains for your tax estimate\. The \$14,100 you got is not added to any account here: add it to the account it went to\. Undo/);
    assert.match(t, /Your 2026 coin sales: a short-term gain of \$200 and a long-term gain of \$6,900\. 0\.15 BTC · Oct 3, 2026 \+\$7,100 sold for \$14,100, cost \$7,000 0\.1 bought Mar 1, 2023: sold for \$9,400, cost \$2,500, \+\$6,900 long-term 0\.05 bought Dec 1, 2025: sold for \$4,700, cost \$4,500, \+\$200 short-term Remove this sale/);
    assert.match(t, /For your tax preparer or your tax program: print this list \(the printout also says where each line goes on the form\) or save it as a spreadsheet or as a file for tax software\. It is not a filing\. Save as a spreadsheet/);
    assert.ok(!/Part I|G to L|adjustment/.test(t), "the form's details are on the printout, not on the phone (P2)");
    const buttons = P.part("sales").all().filter((e) => e.tagName === "BUTTON" && e.getAttribute("type") !== "submit");
    assert.deepEqual(buttons.map((b) => [P.textOf(b), String(b.className)]), [["Undo", "secondary"], ["Remove this sale", "secondary small"], ["Save as a spreadsheet (CSV)", "secondary"], ["Print this list", "secondary"], ["Save for tax software", "secondary"], ["+ Record another sale", "secondary"]], "all outlined: the page keeps no second filled button");
    // the headline follows the coins left: 0.1 BTC at 100,000
    assert.match(P.text(), /\$10,​?000 Crypto/);
    // Undo takes it back
    P.button("Undo", P.part("sales")).click();
    assert.equal(P.saved.length, 2); assert.equal(P.plan.taxes.gains.length, 0); assert.deepEqual(P.plan.holdings, wallet().holdings);
    assert.match(P.textOf(P.part("sales")), /Undone: the sale is off Capital gains and its coins are back on your list\./);
    assert.deepEqual(P.states(), [["ways", false, "oldest first"], ["sales", true, "none in 2026"], ["staking", false, "only if you stake"]]);
    // a refusal is said at its box and nothing is saved
    const f2 = P.part("sales").all().find((e) => e.tagName === "FORM");
    f2.querySelector('[name="units"]').value = "0.3"; f2.querySelector('[name="sold"]').value = "2026-10-03"; f2.querySelector('[name="proceeds"]').value = "1";
    f2.dispatch("submit");
    assert.equal(P.saved.length, 2);
    // record again, then remove it later: asked first; No keeps it
    f2.querySelector('[name="units"]').value = "0.1"; f2.dispatch("submit");
    assert.equal(P.saved.length, 3);
    P.draw();
    assert.deepEqual(P.states(), [["ways", false, "oldest first"], ["sales", false, "1 in 2026"], ["staking", false, "only if you stake"]], "the next draw: shut, saying what it holds");
    const opened = P.open("sales");
    assert.ok(!opened.all().some((e) => String(e.className).includes("notice")), "the green line was for that draw only");
    const asked = [];
    globalThis.window.confirm = (text) => { asked.push(text); return false; };
    P.button("Remove this sale", opened).click();
    assert.equal(P.saved.length, 3); assert.equal(asked[0], "Remove the sale of 0.1 BTC on Oct 3, 2026? It comes off Capital gains and its coins go back on your list.");
    globalThis.window.confirm = () => true;
    P.button("Remove this sale", P.part("sales")).click();
    assert.equal(P.saved.length, 4); assert.equal(P.plan.taxes.gains.length, 0);
    assert.match(P.textOf(P.part("sales")), /Sale removed: 0\.1 BTC back on your list and off Capital gains\./);
  } finally { globalThis.window.confirm = had; }
});

test("Sales for your tax return: the CSV's green line, the printout, + Record another sale and Cancel; every coin sold still lists the sales", async () => {
  const p = wallet();
  S.applySale(p, S.planSale(p, sell(0.15, 14100, "2026-10-03"), { today: T2 }), "s1", T2);
  const P = await page(p);
  const sales = P.open("sales");
  globalThis.URL.createObjectURL ??= () => "blob:x"; globalThis.Blob ??= class { constructor(parts) { this.parts = parts; } };
  P.button("Save as a spreadsheet (CSV)", sales).click();
  assert.match(P.textOf(sales), /coin-sales-2026\.csv is downloading\. Open it with Excel, Numbers or Google Sheets, or send it to your tax preparer\./);
  P.button("Print this list", sales).click();
  const sheet = sales.all().find((e) => String(e.className).includes("rp-sheet"));
  assert.ok(sheet && sales.all().some((e) => String(e.className).includes("cr-print")), "the sheet is drawn, for the printer only");
  assert.match(P.textOf(sheet), /^Coin sales in 2026, for your tax preparer From the plan on Nov 16, 2026: the coin sales recorded on Crypto, one line per purchase sold\. Your 2026 coin sales: a short-term gain of \$200/);
  assert.match(P.textOf(sheet), /0\.1 BTC Mar 1, 2023 Oct 3, 2026 \$9,400 \$2,500 \+\$6,900 long-term/);
  assert.equal(sheet.all().filter((e) => e.tagName === "TR").length, 3, "a header and the two lines");
  assert.ok(P.textOf(sheet).endsWith(S.FORM_NOTE), "the preparer's note (fees, Parts, boxes) is on the printout");
  assert.equal(P.saved.length, 0, "neither the file nor the printout changes the plan");
  // with a sale on the list the form waits behind "+ Record another sale"; Cancel puts the button back
  assert.ok(!sales.all().some((e) => e.tagName === "FORM" && e.querySelector('[name="sold"]')));
  P.button("+ Record another sale", sales).click();
  assert.ok(sales.all().some((e) => e.tagName === "FORM" && e.querySelector('[name="sold"]')));
  P.button("Cancel", sales).click();
  assert.ok(P.button("+ Record another sale", sales)); assert.equal(P.saved.length, 0);
  // every coin sold: the hero and the add form, and the sales row still there
  const all = wallet();
  S.applySale(all, S.planSale(all, sell(0.25, 24000, "2026-10-03"), { today: T2 }), "s2", T2);
  const Q = await page(all);
  assert.deepEqual(Q.states(), [["sales", false, "1 in 2026"]]);
  assert.match(Q.textOf(Q.open("sales")), /0\.25 BTC · Oct 3, 2026 \+\$7,000/);
  // two coins: the coin box, and choosing another draws its purchases and keeps what was typed
  const two = wallet(); two.holdings.push({ id: "e1", accountId: "w", symbol: "ETH", shares: 2, price: 3000, priceAsOf: T2, costBasis: 5000, lots: [{ id: "e-a", date: "2024-01-01", shares: 1, cost: 2000 }, { id: "e-b", date: "2025-01-01", shares: 1, cost: 3000 }] });
  const R = await page(two);
  const f = R.open("sales").all().find((e) => e.tagName === "FORM");
  f.querySelector('[name="units"]').value = "1"; f.querySelector('[name="coin"]').value = "e1"; f.querySelector('[name="coin"]').dispatch("change");
  const f2 = R.part("sales").all().find((e) => e.tagName === "FORM");
  assert.equal(f2.querySelector('[name="units"]').value, "1"); assert.match(R.textOf(f2), /ETH in Wallet: 2 coins on your list/); assert.match(R.textOf(f2), /1 coin, bought Jan 1, 2024, \$2,000 a coin/);
  assert.equal(R.saved.length, 0);
});

test("The page, a coin with no cost on file: said above the form, under the ways and under the green line; the printout says not on file (F2, P4)", async () => {
  const p = wallet(); p.holdings[0].costBasis = null; p.holdings[0].lots = [];   // 0.25 BTC, nothing paid on file, one undated purchase
  p.holdings.push({ id: "e1", accountId: "w", symbol: "ETH", shares: 1, price: 3000, priceAsOf: T2, costBasis: 2000, lots: [] });
  const P = await page(p);
  P.open("sales");
  const pick = (id) => { const x = P.part("sales").all().find((e) => e.tagName === "FORM"); x.querySelector('[name="coin"]').value = id; x.querySelector('[name="coin"]').dispatch("change"); };
  pick("c1");   // (an earlier test may have left the form on another coin: typing is kept across draws)
  const sales = P.part("sales");
  const flag = (el) => el.all().filter((e) => String(e.className).includes("cr-flag")).map((e) => P.textOf(e));
  assert.deepEqual(flag(sales), ["What you paid for this BTC is not on file, so a sale of it counts as all gain: add it on Holdings first, if you know it."]);
  pick("e1");
  assert.deepEqual(flag(P.part("sales")), [], "ETH has its cost: no line");
  assert.match(P.textOf(P.part("sales")), /ETH in Wallet: 1 coin on your list/, "1 coin, not 1 coins (P4)");
  pick("c1");
  const h = P.part("sales").all().find((e) => e.tagName === "FORM");
  h.querySelector('[name="units"]').value = "0.05"; h.querySelector('[name="sold"]').value = "2026-10-03"; h.querySelector('[name="proceeds"]').value = "4700";
  h.dispatch("submit");
  assert.equal(P.saved.length, 1); assert.equal(P.plan.holdings[0].costBasis, null);
  assert.match(P.textOf(P.part("sales")), /Recorded: 0\.05 BTC sold Oct 3, 2026 for \$4,700, oldest first: a gain of \$4,700, long-term\./);
  assert.equal(flag(P.part("sales"))[0], "What you paid for the 0.05 BTC is not on file, so the whole $4,700 counts as gain. If you know it, tap Undo, add it on Holdings, then record the sale again.");
  assert.match(P.textOf(P.part("sales")), /0\.05 BTC · Oct 3, 2026 \+\$4,700 sold for \$4,700, cost not on file 0\.05 bought on a day not on file: sold for \$4,700, cost not on file \(counted as \$0\), \+\$4,700 long-term/);
  P.button("Print this list", P.part("sales")).click();
  const sheet = P.part("sales").all().find((e) => String(e.className).includes("rp-sheet"));
  assert.match(P.textOf(sheet), /0\.05 BTC not on file Oct 3, 2026 \$4,700 not on file \(\$0\) \+\$4,700 long-term/);
  // part of a sale without a cost on file: the sale's line says so
  const m = wallet(); m.holdings[0].shares = 0.3; m.holdings[0].costBasis = null;   // 0.05 BTC with no purchase and no cost
  S.applySale(m, S.planSale(m, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  const M = await page(m);
  assert.match(M.textOf(M.open("sales")), /0\.1 BTC · Oct 3, 2026 \+\$\d[\d,]* sold for \$9,400, cost \$1,250 \(part not on file\)/);
  // the ways: three purchases with their costs, and 0.05 more coins with none on file
  const w = wallet(); w.holdings[0].shares = 0.3; w.holdings[0].costBasis = null;
  const Q = await page({ ...w, whatIfs: { crypto: ask(0.1) } });
  const ways = Q.open("ways");
  assert.ok(ways.all().some((e) => String(e.className).includes("cr-flag") && Q.textOf(e) === "What you paid for 0.05 coins of this BTC is not on file, so selling those counts as all gain: add it on Holdings first, if you know it."));
});

// ---- invariance: a recorded sale's `coin` object is read by this page alone ----------------------------------------------------
test("invariance: the `coin` object on a recorded sale's rows changes no figure on any page: every page's compute is the same with and without it", async () => {
  const { default: REGISTRY } = await import("../../registry.js");
  const mods = (await Promise.all(REGISTRY.map(async (e) => (await e.load()).default))).filter((m) => !m.placeholder && !m.heavy && !(m.group === "reports" && m.id === "export"));
  // Capital gains and the Federal estimate hand the year's rows back as they are: a row's own `coin` is left out of the
  // comparison there, every figure is compared
  const drop = (k, v) => (k === "coin" && v && typeof v === "object" && "sale" in v ? undefined : v);
  const out = (m, q) => { try { const r = m.compute(q, { today: T2 }); if (["diagnostics", "settings"].includes(m.id) && r) { delete r.size; delete r.sizeKB; } return JSON.stringify(r, drop); } catch (e) { return `THROW ${e.message}`; } };
  const plans = [wallet(), withCoins()];
  plans[1].holdings.find((h) => h.symbol === "BTC").lots[0].date = "2024-05-30";
  S.applySale(plans[0], S.planSale(plans[0], sell(0.15, 14100, "2026-10-03"), { today: T2 }), "s1", T2);
  const s2 = S.planSale(plans[1], sell(0.05, 4800, "2026-10-03"), { today: T2 });
  assert.equal(s2.ok, true); S.applySale(plans[1], s2, "s2", T2);
  for (const plan of plans) {
    const bare = structuredClone(plan); for (const g of bare.taxes.gains) delete g.coin;
    for (const m of mods) {
      if (m.group === "investments" && m.id === "crypto") continue;   // this page reads it (its compute does not: checked next)
      assert.equal(out(m, plan), out(m, bare), `${m.group}/${m.id}`);
    }
    assert.equal(JSON.stringify(compute(plan, { today: T2 })), JSON.stringify(compute(bare, { today: T2 })), "Crypto's own compute() does not read it either");
  }
  // and no code outside this page reads it
  const fs = await import("node:fs"); const path = await import("node:path"); const { fileURLToPath } = await import("node:url");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".js") ? [path.join(dir, e.name)] : []));
  const readers = [...walk(path.join(ROOT, "modules")), ...walk(path.join(ROOT, "core"))].filter((f) => !f.includes(`${path.sep}crypto${path.sep}`) && /\.coin\??\.(sale|sold|acquired|units|holding|lot)\b/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(readers, []);
});

// =============================================================================================================================
// Invariance of the file for tax software (gap list, next 60, item 51): digests written at a491122, before the TXF existed
// (`PRINT=1 node --test modules/investments/crypto/module.test.mjs` writes them again; only do that on the old code). Over
// every qa fixture plan, every invented household, the phone households, the empty plan and four plans with coin sales
// recorded: Crypto's compute, the year's coin sales, the existing spreadsheet, the ways to count, Tax lots' compute, its
// year's sales and its spreadsheet; and both pages as drawn, for every plan with no coin sale recorded (nothing new shows).
// =============================================================================================================================
test("invariance: the file for tax software changes no figure, no spreadsheet and, with no coin sale, no page (digests from a491122)", async () => {
  const fs = await import("node:fs"); const path = await import("node:path"); const nodeCrypto = await import("node:crypto");
  const { fileURLToPath, pathToFileURL } = await import("node:url");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const TL = await import("../tax-lots/compute.js");
  const TS = await import("../tax-lots/sell.js");
  const { render: renderCrypto } = await import("./view.js");
  const { render: renderLots } = await import("../tax-lots/view.js");
  FakeElement.prototype.getBoundingClientRect ??= () => ({ top: 100, bottom: 140 });
  const file = new URL("./invariance.json", import.meta.url);
  const digest = (x) => nodeCrypto.createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x) ?? "undefined").digest("base64url").slice(0, 22);
  const plans = [];
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../qa/fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push([`fixture ${f}:${name}`, fn(T2)]);
  }
  for (const a of ARCHETYPES) plans.push([`${a.id}/base`, a.build()]);
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") plans.push([`phone ${name}`, fn()]);
  plans.push(["empty plan", emptyPlan()]);
  // four plans with coin sales recorded: two sales (short and long); a purchase with no date sold; a cost not on file; filing separately
  const two = wallet(); S.applySale(two, S.planSale(two, sell(0.15, 14100, "2026-10-03"), { today: T2 }), "s1", T2); S.applySale(two, S.planSale(two, sell(0.05, 4000, "2026-11-02"), { today: T2 }), "s2", T2);
  const undated = wallet(); undated.holdings[0].lots.unshift({ id: "l0", date: null, shares: 0.02, cost: 300 }); undated.holdings[0].shares = 0.27; undated.holdings[0].costBasis = 17300;
  S.applySale(undated, S.planSale(undated, sell(0.05, 5000, "2026-10-03"), { today: T2 }), "s1", T2);
  const noCost = wallet(); noCost.holdings[0].shares = 0.3; noCost.holdings[0].costBasis = null;
  S.applySale(noCost, S.planSale(noCost, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  const apart = wallet(); apart.household.people.push({ id: "a2", name: "Adult 2", role: "partner", birthDate: "1981-01-01" }); apart.household.filingStatus = "married_separate"; apart.accounts[0].ownerId = "a1";
  S.applySale(apart, S.planSale(apart, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  plans.push(["coins: two sales", two], ["coins: no date", undated], ["coins: no cost", noCost], ["coins: filing separately", apart], ["coins: none sold", wallet()]);
  const drawn = (render, p, group, id) => {
    const root = new FakeElement("main");
    try {
      render(root, { ui, fmt: { ...fmt, today: () => T2 }, plan: p, route: { group, id, rest: [], query: {} }, module: { group, id }, store: { get: () => p, update: () => {} }, redraw: () => {} });
      // a later quiet row, "Rewards from staking" (gap list, next 60, item 45), is left out: its own tests and digests read it
      for (const d of root.all().filter((e) => e.tagName === "DETAILS" && e.dataset?.part === "staking")) d.remove();
      return textOf(root);
    } catch (e) { return `THROW ${e.message}`; }
  };
  const safe = (f) => { try { return f(); } catch (e) { return `THROW ${e.message}`; } };
  const now = { today: T2, plans: {} };
  for (const [name, raw] of plans) {
    const p = migrate(structuredClone(raw));
    const cs = safe(() => S.coinSales(p, { today: T2 })), ys = safe(() => TS.yearSales(p, { today: T2 }));
    const row = {
      crypto: digest(safe(() => compute(p, { today: T2 }))), coinSales: digest(cs), csv: digest(safe(() => S.form8949Csv(cs, p))),
      coinOrders: digest(safe(() => S.coinOrders(p, { today: T2 }))), taxLots: digest(safe(() => TL.compute(p, { today: T2 }))),
      yearSales: digest(ys), salesCsv: digest(safe(() => TS.salesCsv(ys, p))),
    };
    if (!(cs?.count > 0)) { row.cryptoPage = digest(drawn(renderCrypto, structuredClone(p), "investments", "crypto")); row.taxLotsPage = digest(drawn(renderLots, structuredClone(p), "investments", "tax-lots")); }
    now.plans[name] = row;
  }
  if (process.env.PRINT) { fs.writeFileSync(file, `${JSON.stringify({ note: "digests at a491122, before the file for tax software (TXF); module.test.mjs says how to write them again", ...now }, null, 1)}\n`); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(Object.keys(now.plans), Object.keys(was.plans), "the same plans");
  for (const name of Object.keys(was.plans)) assert.deepEqual(now.plans[name], was.plans[name], name);
});

// =============================================================================================================================
// A file for tax software (gap list, next 60, item 51; txf.js): the year's coin sales in the Tax Exchange Format, version 042
// (README "A file for tax software (TXF)": GnuCash's txf.scm and taxtxf.scm, txf-generator 1.0.0, read 2026-11-16)
// =============================================================================================================================
const X = await import("./txf.js");
/** Two sales, one Form 8949 line each: 0.1 BTC (the 2023 purchase, held over a year) for 9,400 on Oct 3, a long-term gain;
 *  then 0.05 BTC (from the Dec 1, 2025 purchase at 90,000 a coin, cost 4,500) for 4,000 on Nov 2, a short-term loss. */
function twoSales() {
  const p = wallet();
  S.applySale(p, S.planSale(p, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  S.applySale(p, S.planSale(p, sell(0.05, 4000, "2026-11-02"), { today: T2 }), "s2", T2);
  return p;
}

test("TXF: the exact bytes of a two-sale file (a long-term gain, a short-term loss) against a hand-written one", () => {
  const cs = S.coinSales(twoSales(), { today: T2 });
  assert.deepEqual(cs.lines.map((l) => [l.description, l.term, l.cost, l.proceeds, l.gain]), [["0.1 BTC", "long", 2500, 9400, 6900], ["0.05 BTC", "short", 4500, 4000, -500]]);
  const want = "V042\r\nAPlanner\r\nD11/16/2026\r\n^\r\n"
    + "TD\r\nN714\r\nC1\r\nL1\r\nP0.1 BTC\r\nD03/01/2023\r\nD10/03/2026\r\n$2500.00\r\n$9400.00\r\n^\r\n"
    + "TD\r\nN712\r\nC1\r\nL1\r\nP0.05 BTC\r\nD12/01/2025\r\nD11/02/2026\r\n$4500.00\r\n$4000.00\r\n^\r\n";
  const got = X.txfFile(cs, { today: T2 });
  assert.equal(got, want);
  const bytes = Buffer.from(got, "latin1");
  assert.ok(bytes.every((b) => b < 0x80), "plain ASCII");
  assert.equal(got.split("\r\n").length - 1, 4 + 2 * 10, "a four-line header and ten lines a sale, each ended by CR LF");
  assert.ok(!/(^|[^\r])\n/.test(got), "no bare line feed");
  assert.equal(X.txfName(cs), "coin-sales-2026.txf");
});

test("TXF: a sale of each term gets its code (N712 short-term, Form 8949 box C; N714 long-term, box F); a loss is written as it is", () => {
  assert.deepEqual(X.TXF_CODES, { short: "N712", long: "N714" });
  const line = { description: "0.05 BTC", acquired: "2025-12-01", sold: "2026-11-02", cost: 4500, proceeds: 4000, gain: -500, term: "short" };
  assert.deepEqual(X.txfRecord(line), ["TD", "N712", "C1", "L1", "P0.05 BTC", "D12/01/2025", "D11/02/2026", "$4500.00", "$4000.00", "^"]);
  assert.deepEqual(X.txfRecord({ ...line, term: "long", acquired: "2023-03-01" }).slice(1, 7), ["N714", "C1", "L1", "P0.05 BTC", "D03/01/2023", "D11/02/2026"]);
  // the record carries the cost and what was got, never the gain: the program works the loss out (-500 here)
  assert.deepEqual(X.txfRecord(line).filter((x) => x.startsWith("$")), ["$4500.00", "$4000.00"], "the cost, then what was got; no sign and no gain");
  // the same day sold and bought: a short-term sale with no gain
  assert.deepEqual(X.txfRecord({ ...line, acquired: "2026-11-02", cost: 4000 }).slice(5, 9), ["D11/02/2026", "D11/02/2026", "$4000.00", "$4000.00"]);
});

test("TXF: a purchase with no date on file is a bare D; one with no cost on file comes in at $0; the green line says what to type (one sentence per case)", () => {
  const p = wallet(); p.holdings[0].lots.unshift({ id: "l0", date: null, shares: 0.02, cost: 300 }); p.holdings[0].shares = 0.27; p.holdings[0].costBasis = 17300;
  S.applySale(p, S.planSale(p, sell(0.05, 5000, "2026-10-03"), { today: T2 }), "s1", T2);
  const cs = S.coinSales(p, { today: T2 });
  assert.deepEqual(cs.lines.map((l) => [l.description, l.acquired, l.term, l.cost, l.proceeds]), [["0.02 BTC", null, "long", 300, 2000], ["0.03 BTC", "2023-03-01", "long", 750, 3000]]);
  const recs = cs.lines.map(X.txfRecord);
  assert.deepEqual(recs[0], ["TD", "N714", "C1", "L1", "P0.02 BTC", "D", "D10/03/2026", "$300.00", "$2000.00", "^"], "no date bought: a bare D (a purchase with no date counts long-term, as the page counts it)");
  assert.equal(recs[1][5], "D03/01/2023");
  assert.deepEqual(X.txfStats(cs), { lines: 2, noDate: 1, noSold: 0, noCost: 0 });
  assert.match(X.txfFile(cs, { today: T2 }), /\r\nP0\.02 BTC\r\nD\r\nD10\/03\/2026\r\n\$300\.00\r\n\$2000\.00\r\n\^\r\n/);
  // what was paid not on file: $0.00, as the spreadsheet counts it
  const q = wallet(); q.holdings[0].shares = 0.3; q.holdings[0].costBasis = null;   // 0.05 BTC with no purchase and no cost
  S.applySale(q, S.planSale(q, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  const cq = S.coinSales(q, { today: T2 });
  assert.deepEqual(cq.lines.map((l) => [l.description, l.acquired, l.noCost, X.txfRecord(l)[7]]), [["0.05 BTC", null, true, "$0.00"], ["0.05 BTC", "2023-03-01", false, "$1250.00"]]);
  assert.deepEqual(X.txfStats(cq), { lines: 2, noDate: 1, noSold: 0, noCost: 1 });
  // the green line: the file, then one sentence for each thing left to type
  const said = (st) => X.txfSaid("coin-sales-2026.txf", st);
  const BASE = "coin-sales-2026.txf is downloading. Import it into your tax program, then check that each sale is filed as crypto, not as stocks.";
  assert.equal(said({ lines: 2, noDate: 0, noCost: 0 }), BASE);
  assert.equal(said(X.txfStats(cs)), `${BASE} One line has no purchase date on file: type it there.`);
  assert.equal(said({ noDate: 3 }), `${BASE} 3 lines have no purchase date on file: type them there.`);
  assert.equal(said({ noCost: 1 }), `${BASE} One line has no cost on file and comes in at $0: type what you paid there.`);
  assert.equal(said({ noCost: 2 }), `${BASE} 2 lines have no cost on file and come in at $0: type what you paid there.`);
  assert.equal(said(X.txfStats(cq)), `${BASE} One line has no purchase date on file: type it there. One line has no cost on file and comes in at $0: type what you paid there.`);
  assert.equal(said({ noSold: 1 }), `${BASE} One line has a date sold that is not on the calendar: type the right one there.`);
  assert.equal(said({ noSold: 2 }), `${BASE} 2 lines have a date sold that is not on the calendar: type the right ones there.`);
  // P4: no format name in the instruction beyond what a program's menu may show
  assert.ok(!/importing a TXF file|\(TXF\)/.test(BASE));
  // round 2, P3: short (six lines at 390 px before): the part before what is left to type is at most 22 words
  assert.ok(BASE.split(/\s+/).length <= 22, `${BASE.split(/\s+/).length} words`);
  assert.equal(X.txfFailed("no room"), "The file could not be made: no room. Reload the page and try again.");
});

test("TXF: the text and the money as the format carries them (one plain line; dollars to the cent, no commas)", () => {
  assert.equal(X.txfText("0.1 BTC"), "0.1 BTC");
  assert.equal(X.txfText("1,234.5 ÉTH"), "1,234.5 ETH", "accents dropped; commas kept");
  assert.equal(X.txfText("0.1 X\r\nY\tZ\u0007"), "0.1 X Y Z", "a line break or a control character would end the line: a space");
  assert.equal(X.txfText("0.1 🚀COIN"), "0.1 COIN", "outside plain ASCII: dropped");
  assert.equal(X.txfText("  0.1   BTC  "), "0.1 BTC"); assert.equal(X.txfText(null), "");
  assert.equal(X.txfMoney(9400), "$9400.00"); assert.equal(X.txfMoney(1234567.891), "$1234567.89"); assert.equal(X.txfMoney(11.705), "$11.71");
  assert.equal(X.txfMoney(0), "$0.00"); assert.equal(X.txfMoney(-0.001), "$0.00"); assert.equal(X.txfMoney(null), "$0.00");
  // the header's day: today, as the form writes a day; no today, an empty D
  assert.ok(X.txfFile({ lines: [] }, { today: "2027-01-05" }).startsWith("V042\r\nAPlanner\r\nD01/05/2027\r\n^\r\n"));
  assert.equal(X.txfFile({ lines: [] }), "V042\r\nAPlanner\r\nD\r\n^\r\n");
});

test("TXF: offered with a line; filing separately only when every line is one person's (one sentence why not)", () => {
  const line = (personId) => ({ description: "0.1 BTC", acquired: "2023-03-01", sold: "2026-10-03", cost: 2500, proceeds: 9400, term: "long", personId });
  assert.deepEqual(X.txfOffer({ lines: [] }), { ok: false, why: "none" });
  assert.deepEqual(X.txfOffer(null), { ok: false, why: "none" });
  assert.deepEqual(X.txfOffer({ separate: false, lines: [line(null), line("a1"), line("a2")] }), { ok: true, why: null }, "one return: every line");
  assert.deepEqual(X.txfOffer({ separate: true, lines: [line("a1"), line("a1")] }), { ok: true, why: null }, "filing separately, all one person's");
  assert.deepEqual(X.txfOffer({ separate: true, lines: [line("a1"), line("a2")] }), { ok: false, why: "separate" });
  assert.deepEqual(X.txfOffer({ separate: true, lines: [line(null)] }), { ok: false, why: "separate" }, "a sale in neither name is split between the returns");
  assert.equal(X.TXF_SEPARATE, "Filing separately, each of you reports your own sales, and a file for tax software would put them all on one return: split them between you from the spreadsheet or the printout.");
});

test("TXF, filing separately (P1): the sentence promises nothing the spreadsheet lacks, in both cases it is shown (sales in two names; a sale in neither name)", () => {
  // a sale in neither name (a joint wallet): the spreadsheet has no "Whose" column, so the sentence may not say it has one
  const r = wallet(); r.household.people.push({ id: "a2", name: "Adult 2", role: "partner", birthDate: "1981-01-01" }); r.household.filingStatus = "married_separate";
  S.applySale(r, S.planSale(r, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  const neither = S.coinSales(r, { today: T2 });
  assert.deepEqual(neither.lines.map((l) => l.personId), [null]);
  assert.deepEqual(X.txfOffer(neither), { ok: false, why: "separate" });
  assert.equal(S.form8949Csv(neither, r).split("\r\n")[0], "What was sold,Date bought,Date sold,Sold for,Cost,Gain or loss,Short or long term", "no Whose column");
  assert.ok(!/whose|column/i.test(X.TXF_SEPARATE), "no promise of a column the spreadsheet may not have");
  // sales in two names: the spreadsheet says whose; the same sentence is still true
  const two = structuredClone(r); two.taxes.gains[0].personId = "a1";
  two.taxes.gains.push({ ...structuredClone(two.taxes.gains[0]), id: "s9-1", personId: "a2", coin: { ...two.taxes.gains[0].coin, sale: "s9" } });
  const named = S.coinSales(two, { today: T2 });
  assert.deepEqual(X.txfOffer(named), { ok: false, why: "separate" });
  assert.match(S.form8949Csv(named, two).split("\r\n")[0], /,Whose$/);
  assert.match(X.TXF_SEPARATE, /split them between you from the spreadsheet or the printout\.$/);
});

test("TXF, a hand-edited plan (F1, F3): a day not on the calendar is never written as a date; a coin with no symbol never reads undefined", async () => {
  const p = wallet();
  S.applySale(p, S.planSale(p, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  S.applySale(p, S.planSale(p, sell(0.05, 4000, "2026-11-02"), { today: T2 }), "s2", T2);
  // F1: a day bought of 2026-13-45 (it has the shape of a day, not a day) and a day sold of 2026-02-31
  p.taxes.gains[0].coin.acquired = "2026-13-45";
  p.taxes.gains[1].coin.sold = "2026-02-31";
  const cs = S.coinSales(p, { today: T2 });
  const bad = cs.lines.find((l) => l.id === p.taxes.gains[0].id), late = cs.lines.find((l) => l.id === p.taxes.gains[1].id);
  assert.equal(bad.acquired, null, "a day bought not on the calendar is a day not on file");
  assert.equal(X.txfRecord(bad)[5], "D", "a bare D, as for any purchase with no date");
  assert.equal(X.txfRecord(late)[6], "D", "a day sold not on the calendar: a bare D, never 02/31/2026");
  const file = X.txfFile(cs, { today: T2 });
  assert.ok(!/13\/45\/2026|02\/31\/2026/.test(file), "no impossible day in the file");
  for (const d of file.split("\r\n").filter((x) => /^D./.test(x))) assert.ok(X.txfDay(`${d.slice(7, 11)}-${d.slice(1, 3)}-${d.slice(4, 6)}`), `${d} is a day on the calendar`);
  assert.deepEqual(X.txfStats(cs), { lines: 2, noDate: 1, noSold: 1, noCost: 0 });
  assert.equal(X.txfSaid("f.txf", X.txfStats(cs)), "f.txf is downloading. Import it into your tax program, then check that each sale is filed as crypto, not as stocks. One line has no purchase date on file: type it there. One line has a date sold that is not on the calendar: type the right one there.");
  assert.match(S.form8949Csv(cs, p), /\r\n0\.1 BTC,unknown,10\/03\/2026,/, "the spreadsheet says unknown, as for any purchase with no date");
  assert.equal(X.txfDay("2026-13-45"), ""); assert.equal(X.txfDay("2026-02-31"), ""); assert.equal(X.txfDay(null), ""); assert.equal(X.txfDay("2028-02-29"), "02/29/2028");
  // F3: a coin row with no symbol (or a blank one): "coin", in the list, the spreadsheet and the file
  const q = structuredClone(p); q.taxes.gains[0].coin.acquired = "2023-03-01"; q.taxes.gains[1].coin.sold = "2026-11-02";
  delete q.taxes.gains[0].coin.symbol; q.taxes.gains[1].coin.symbol = "  ";
  const cq = S.coinSales(q, { today: T2 });
  assert.deepEqual(cq.lines.map((l) => [l.description, l.symbol]), [["0.1 coin", "coin"], ["0.05 coin", "coin"]]);
  const all = X.txfFile(cq, { today: T2 }) + S.form8949Csv(cq, q);
  assert.ok(!/undefined|null|NaN/.test(all), "never undefined in the file or the spreadsheet");
  assert.match(X.txfFile(cq, { today: T2 }), /\r\nP0\.1 coin\r\n/);
  const P = await page(q);
  assert.ok(!/undefined|NaN|Invalid Date/.test(P.textOf(P.open("sales"))), "nor on the screen");
});

test("TXF (F2): a purchase with no date stays in the file with every other field, so no sale can go missing from it: one record per spreadsheet row, in its order", () => {
  const p = wallet(); p.holdings[0].lots.unshift({ id: "l0", date: null, shares: 0.02, cost: 300 }); p.holdings[0].shares = 0.27; p.holdings[0].costBasis = 17300;
  S.applySale(p, S.planSale(p, sell(0.05, 5000, "2026-10-03"), { today: T2 }), "s1", T2);
  S.applySale(p, S.planSale(p, sell(0.05, 4000, "2026-11-02"), { today: T2 }), "s2", T2);
  const cs = S.coinSales(p, { today: T2 });
  const recs = X.txfFile(cs, { today: T2 }).split("\r\n^\r\n").slice(1).filter(Boolean).map((r) => r.split("\r\n"));
  const rows = S.form8949Csv(cs, p).trim().split("\r\n").slice(1).map((r) => r.split(","));
  assert.equal(recs.length, rows.length, "one record per line of the spreadsheet");
  assert.deepEqual(recs.map((r) => [r[4], r[6], r[7], r[8]]), rows.map((r) => [`P${r[0]}`, `D${r[2]}`, `$${r[4]}`, `$${r[3]}`]), "each with its day sold, cost and what was got");
  assert.deepEqual(recs.map((r) => r[5]), rows.map((r) => (r[1] === "unknown" ? "D" : `D${r[1]}`)), "the day bought, or a bare D where the spreadsheet says unknown");
  assert.ok(recs.some((r) => r[5] === "D"));
});

test("TXF: the words under the buttons, before a tap, are one short sentence: the double count first (P2); the rest is said after the tap", () => {
  // Instructions for Form 8949 (2025): "Do not use box C [F] to report digital asset transactions. Use box I [L]." -- the file
  // cannot say I or L, so the check that the program files them as crypto is in the green line, where it is done
  assert.equal(X.TXF_SCREEN, "If your tax program already has these sales from the yearly form your exchange sends (Form 1099-DA), skip the file for tax software: each sale would count twice.");
  assert.match(X.TXF_SCREEN, /the yearly form your exchange sends \(Form 1099-DA\)/, "round 2, P2: the form is placed in plain words before its number");
  assert.ok(X.TXF_SCREEN.split(/\s+/).length <= 30, "at most 30 words before a tap (it was about 70)");
  assert.ok(!/G to L|Part I|N71\d|V042|TXF|\.txf|TaxCut/.test(X.TXF_SCREEN), "the format's name and codes, and the form's letters, stay in the README");
  assert.match(X.txfSaid("f.txf"), /filed as crypto, not as stocks\./, "the check for coins is in the green line after the tap");
  // round 2, P1: above the buttons, the list's own sentence naming the third way too, and nothing else changed in it
  assert.equal(X.TXF_FORM_SCREEN, S.FORM_SCREEN.replace("For your tax preparer:", "For your tax preparer or your tax program:").replace("or save it as a spreadsheet.", "or save it as a spreadsheet or as a file for tax software."));
  assert.notEqual(X.TXF_FORM_SCREEN, S.FORM_SCREEN);
});

test("TXF, round 2 (F4): a coin symbol with nothing the format can carry reads \"coin\", never a bare number", () => {
  const p = wallet();
  S.applySale(p, S.planSale(p, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  const rec = (sym) => { const q = structuredClone(p); q.taxes.gains[0].coin.symbol = sym; const cs = S.coinSales(q, { today: T2 }); return [X.txfRecord(cs.lines[0])[4], S.form8949Csv(cs, q).split("\r\n")[1].split(",")[0]]; };
  assert.deepEqual(rec("\u20bf"), ["P0.1 coin", "0.1 \u20bf"], "only a sign outside ASCII: \"coin\" in the file; the spreadsheet keeps the sign");
  assert.deepEqual(rec("\u30d3\u30c3\u30c8"), ["P0.1 coin", "0.1 \u30d3\u30c3\u30c8"]);
  assert.deepEqual(rec("\u00c9TH"), ["P0.1 ETH", "0.1 \u00c9TH"], "a symbol with letters the format carries keeps them");
  assert.deepEqual(rec("BTC"), ["P0.1 BTC", "0.1 BTC"], "a plain symbol as it was");
  assert.equal(X.txfWhat({ description: "0.1 BTC" }), "0.1 BTC", "a line with no symbol field: its words as they are");
  for (const sym of ["\u20bf", "  ", "\u{1F680}"]) assert.doesNotMatch(X.txfWhat({ description: `0.1 ${sym}`, symbol: sym }), /^0\.1$/);
});

test("TXF on the page: beside the spreadsheet, outlined; the tap downloads the exact file, says the green line and saves nothing; filing separately with two owners, the sentence instead", async () => {
  const P = await page(twoSales());
  const sales = P.open("sales");
  // round 2, P1: the sentence above the buttons names all three (the third had no lead-in)
  assert.match(P.textOf(sales), /or save it as a spreadsheet or as a file for tax software\. It is not a filing\. Save as a spreadsheet \(CSV\) Print this list Save for tax software If your tax program already has these sales from the yearly form your exchange sends \(Form 1099-DA\), skip the file for tax software: each sale would count twice\./);
  const btn = P.button("Save for tax software", sales);
  assert.equal(String(btn.className), "secondary");
  const blobs = [], made = [];
  const hadUrl = globalThis.URL.createObjectURL, hadMake = globalThis.document.createElement;
  globalThis.URL.createObjectURL = (b) => { blobs.push(b); return "blob:x"; };
  globalThis.URL.revokeObjectURL ??= () => {};
  globalThis.document.createElement = function (tag) { const e = hadMake.call(this, tag); if (String(tag).toLowerCase() === "a") made.push(e); return e; };
  try { btn.click(); } finally { globalThis.URL.createObjectURL = hadUrl; globalThis.document.createElement = hadMake; }
  assert.equal(blobs.length, 1); assert.equal(made.at(-1).download, "coin-sales-2026.txf");
  assert.equal(await blobs[0].text(), X.txfFile(S.coinSales(twoSales(), { today: T2 }), { today: T2 }));
  // P5: the green line lands right under the buttons (the buttons do not move under the thumb), above the sentence
  assert.match(P.textOf(sales), /Print this list Save for tax software coin-sales-2026\.txf is downloading\. Import it into your tax program, then check that each sale is filed as crypto, not as stocks\. If your tax program already has/);
  const kids = [...btn.parentNode.parentNode.childNodes];
  assert.ok(kids.indexOf(kids.find((e) => e.all?.().some((x) => String(x.className).includes("notice")))) === kids.indexOf(btn.parentNode) + 1, "the green line's host follows the buttons' row");
  assert.equal(P.saved.length, 0, "the file changes nothing in the plan");
  // filing separately, sales in two names: no file, the sentence why
  const r = wallet(); r.household.people.push({ id: "a2", name: "Adult 2", role: "partner", birthDate: "1981-01-01" }); r.household.filingStatus = "married_separate"; r.accounts[0].ownerId = "a1";
  S.applySale(r, S.planSale(r, sell(0.1, 9400, "2026-10-03"), { today: T2 }), "s1", T2);
  const Q = await page(r);
  const one = Q.open("sales");
  assert.ok(Q.button("Save for tax software", one), "filing separately, every line one person's: the file is offered");
  const g = Q.plan.taxes.gains.find((x) => x.coin);
  const two = structuredClone(Q.plan); two.taxes.gains.push({ ...structuredClone(g), id: "s9-1", personId: "a2", coin: { ...g.coin, sale: "s9" } });
  const R = await page(two);
  const sep = R.open("sales");
  assert.ok(!R.button("Save for tax software", sep));
  assert.match(R.textOf(sep), /Print this list Filing separately, each of you reports your own sales, and a file for tax software would put them all on one return: split them between you from the spreadsheet or the printout\./);
  assert.ok(R.textOf(sep).includes(S.FORM_SCREEN) && !R.textOf(sep).includes(X.TXF_FORM_SCREEN), "no file offered: the list's own sentence, two ways");
  // no coin sale: no file, no words about it
  const N = await page(wallet());
  assert.ok(!/\.txf|TXF|tax software/.test(N.textOf(N.open("sales"))));
});

// =============================================================================================================================
// Invariance of "Rewards from staking" (gap list, next 60, item 45; staking.js): with no reward recorded, Crypto's compute, the
// Federal estimate as every tax page reads it (known(): the steps, the sources, the walk, the total) and the Crypto page's
// words (the new quiet row taken out) are what they were at dca545e, before the rewards existed. Over every qa fixture plan,
// every invented household, the phone, round 8 and persona households and the empty plan.
// `PRINT=1 node --test modules/investments/crypto/module.test.mjs` writes the digests again; only do that on the old code.
// =============================================================================================================================
test("invariance: with no staking reward, Crypto's figures, the Federal estimate's and the Crypto page's words are those of dca545e", async () => {
  const fs = await import("node:fs"); const path = await import("node:path"); const nodeCrypto = await import("node:crypto");
  const { fileURLToPath, pathToFileURL } = await import("node:url");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const round8 = await import("../../../qa/fixtures/round8-households.mjs");
  const personas = await import("../../../qa/fixtures/setup-personas.mjs");
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { known } = await import("../../taxes/federal/known.js");
  const { render: renderCrypto } = await import("./view.js");
  FakeElement.prototype.getBoundingClientRect ??= () => ({ top: 100, bottom: 140 });
  const file = new URL("./staking-invariance.json", import.meta.url);
  const digest = (x) => nodeCrypto.createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x, (k, v) => (v instanceof Map ? [...v] : v)) ?? "undefined").digest("base64url").slice(0, 22);
  const plans = [];
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../qa/fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push([`fixture ${f}:${name}`, fn(T2)]);
  }
  for (const a of ARCHETYPES) plans.push([`${a.id}/base`, a.build()]);
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") plans.push([`phone ${name}`, fn()]);
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push([`round8 ${name}`, fn()]);
  for (const n of ["sam", "jordan", "patLee", "ruth"]) plans.push([`persona ${n}`, personas.finishSetup(n, personas[n](T2), T2)]);
  plans.push(["empty plan", emptyPlan()], ["coins: wallet", wallet()], ["coins: with funds", withCoins()]);
  const drawn = (p) => {
    const root = new FakeElement("main");
    try {
      renderCrypto(root, { ui, fmt: { ...fmt, today: () => T2 }, plan: p, route: { group: "investments", id: "crypto", rest: [], query: {} }, module: { group: "investments", id: "crypto" }, store: { get: () => p, update: () => {} }, redraw: () => {} });
      // the one new quiet row, "Rewards from staking", is the only addition (its own tests read it)
      for (const d of root.all().filter((e) => e.tagName === "DETAILS" && e.dataset?.part === "staking")) d.remove();
      return textOf(root);
    } catch (e) { return `THROW ${e.message}`; }
  };
  const safe = (f) => { try { return f(); } catch (e) { return `THROW ${e.message}`; } };
  const now = { today: T2, plans: {} };
  for (const [name, raw] of plans) {
    const p = migrate(structuredClone(raw));
    now.plans[name] = { crypto: digest(safe(() => compute(structuredClone(p), { today: T2 }))), federal: digest(safe(() => known(structuredClone(p), { today: T2 }))), cryptoPage: digest(drawn(structuredClone(p))) };
  }
  if (process.env.PRINT) { fs.writeFileSync(file, `${JSON.stringify({ note: "digests at dca545e, before the rewards from staking; module.test.mjs says how to write them again", ...now }, null, 1)}\n`); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.ok(Object.keys(was.plans).length >= 45, `${Object.keys(was.plans).length} plans`);
  assert.deepEqual(Object.keys(now.plans), Object.keys(was.plans), "the same plans");
  for (const name of Object.keys(was.plans)) assert.deepEqual(now.plans[name], was.plans[name], name);
});

// =============================================================================================================================
// Rewards from staking (gap list, next 60, item 45; staking.js): income in the year received at the worth that day (Rev. Rul.
// 2023-14), each a purchase on the list at that cost (digital asset FAQs 59 and 107), counted by the Federal estimate through
// one step (known.js stakingStep, Schedule 1 line 8v)
// =============================================================================================================================
const K = await import("./staking.js");
const { known } = await import("../../taxes/federal/known.js");
const { lotsOf } = await import("../tax-lots/compute.js");
const reward = (units, day, value, extra = {}) => ({ holdingId: "c1", units, day, value, ...extra });
/** wallet() with the rewards given recorded, each through planReward and applyReward (which moves the wallet's balance with its
 *  coins), as the page does. */
function staked(list, base = wallet()) {
  const p = structuredClone(base);
  list.forEach(([id, r]) => { const w = K.planReward(p, r, { today: T2 }); assert.ok(w.ok, w.error); assert.ok(K.applyReward(p, w.reward, id, T2)); });
  return p;
}

test("staking: the year's rewards add up, other years stay apart, and each is a purchase at its worth that day (hand sums)", () => {
  const p = staked([["r1", reward(0.001, "2026-03-31", 85)], ["r2", reward(0.002, "2026-09-30", 220.5)], ["r0", reward(0.0015, "2025-12-31", 140)]]);
  const s = K.stakingIn(p, 2026);
  // 85 + 220.50 = 305.50 in 2026; the 140 of Dec 31, 2025 is 2025's
  assert.deepEqual([s.year, s.count, s.total, s.others, s.any], [2026, 2, 305.5, 1, 3]);
  assert.deepEqual(s.rewards.map((r) => [r.id, r.day, r.units, r.value, r.symbol, r.accountId]), [["r1", "2026-03-31", 0.001, 85, "BTC", "w"], ["r2", "2026-09-30", 0.002, 220.5, "BTC", "w"]], "oldest first");
  assert.deepEqual(s.byAccount, [["w", 305.5]]);
  assert.deepEqual(K.stakingIn(p, 2025).total, 140);
  // the coin: 0.25 + 0.001 + 0.002 + 0.0015 = 0.2545 coins; 17,000 + 85 + 220.50 + 140 = 17,445.50 on file
  const h = p.holdings[0];
  near(h.shares, 0.2545, 1e-12); assert.equal(h.costBasis, 17445.5);
  assert.deepEqual(h.lots.map((l) => [l.id, l.date, l.shares, l.cost]), [["l1", "2023-03-01", 0.1, 2500], ["l2", "2025-12-01", 0.1, 9000], ["r0", "2025-12-31", 0.0015, 140], ["r1", "2026-03-31", 0.001, 85], ["l3", "2026-06-01", 0.05, 5500], ["r2", "2026-09-30", 0.002, 220.5]], "each reward a purchase, in date order");
  // the wallet's balance follows its coins: 0.2545 x 100,000
  assert.equal(p.accounts[0].balance, 25450);
  // a reward is a purchase like any other: its cost per coin is its worth (220.50 / 0.002 = 110,250), short-term until a year
  // and a day has passed (FAQ 74: the holding period begins the day after)
  const lot = lotsOf({ ...h, price: 100000 }, T2).find((l) => l.id === "r2");
  near(lot.costPerShare, 110250, 1e-6); assert.equal(lot.term, "short"); near(lot.gain, 200 - 220.5, 1e-9);
  // Crypto's compute carries the year's figure, only when a reward is on file
  assert.equal(compute(p, { today: T2 }).staking.total, 305.5);
  assert.ok(!("staking" in compute(wallet(), { today: T2 })), "no reward: no new key");
});

test("staking: what is refused, one sentence each (no coin, no coins, too few, no day, not on the calendar, the future, no worth)", () => {
  const p = wallet();
  const no = (input, field, error) => assert.deepEqual(K.planReward(p, input, { today: T2 }), { ok: false, field, error });
  no(reward(0.01, "2026-10-01", 30, { holdingId: "zz" }), "coin", "Choose the coin you received.");
  no(reward("", "2026-10-01", 30), "units", "Type how many coins you received.");
  no(reward(0, "2026-10-01", 30), "units", "Type how many coins you received.");
  no(reward(0.000000001, "2026-10-01", 30), "units", "Type at least 0.00000001 of a coin, the smallest amount this list keeps.");
  no(reward(0.01, "", 30), "day", "Type the day you received them.");
  no(reward(0.01, "2026-02-31", 30), "day", "That day is not on the calendar: check the day and the month.");
  no(reward(0.01, "2026-11-17", 30), "day", "A reward cannot be dated in the future.");
  no(reward(0.01, "2026-10-01", ""), "value", "Type what they were worth that day, in dollars.");
  no(reward(0.01, "2026-10-01", -5), "value", "Type what they were worth that day, in dollars.");
  // $0 (or less than a cent) is a box left at nothing: no coins at no cost, no income of $0 (critic P1)
  no(reward(0.01, "2026-10-01", 0), "value", "Type what they were worth that day, more than $0.");
  no(reward(0.01, "2026-10-01", "0"), "value", "Type what they were worth that day, more than $0.");
  no(reward(0.01, "2026-10-01", 0.004), "value", "Type what they were worth that day, more than $0.");
  // a coin outside a crypto account (a fund in a brokerage account) is not one staking pays
  const q = withCoins();
  assert.equal(K.planReward(q, { holdingId: "c4", units: 1, day: "2026-10-01", value: 50 }, { today: TODAY }).field, "coin");
  // a cent is a worth
  assert.deepEqual(K.planReward(p, reward(0.01, "2026-10-01", 0.01), { today: T2 }), { ok: true, reward: { holdingId: "c1", accountId: "w", symbol: "BTC", units: 0.01, day: "2026-10-01", value: 0.01 } });
});

test("staking: the wallet's balance moves by the reward's coins at the coin's price, keeping a part that is not listed coins (critic F1)", () => {
  // a wallet whose balance (5,000) is more than its listed coins (1.5 ETH x 3,200 = 4,800): 200 of it is not listed coins
  const base = wallet();
  base.accounts = [{ id: "w", name: "Wallet", type: "crypto", balance: 5000, asOf: "2026-06-30", history: [] }];
  base.holdings = [{ id: "c1", accountId: "w", symbol: "ETH", shares: 1.5, price: 3200, priceAsOf: T2, costBasis: null, lots: [] }];
  const nw0 = compute(base, { today: T2 }).netWorth;
  const p = staked([["r1", reward(0.01, "2026-03-01", 31.5)]], base);
  // 0.01 ETH x 3,200 = 32 more: 5,032 (it was 4,832 when the balance was set to coins x price, and net worth fell 168)
  assert.equal(p.accounts[0].balance, 5032);
  assert.equal(p.accounts[0].asOf, "2026-06-30", "a balance with more than its coins keeps its own day");
  near(compute(p, { today: T2 }).netWorth - nw0, 32, 1e-9, "net worth rises by the new coins at today's price");
  assert.equal(compute(p, { today: T2 }).items.find((i) => i.kind === "account")?.value, 200, "the rest of the balance stays as it was");
  // removed: back to 5,000 (and Undo, which takes back the changes, the same)
  const q = structuredClone(p);
  assert.equal(K.removeReward(q, "r1", T2).ok, true);
  assert.equal(q.accounts[0].balance, 5000);
  // a balance below its coins (4,000 typed against 4,800 of coins) keeps its gap the same way: 4,032
  const low = structuredClone(base); low.accounts[0].balance = 4000;
  assert.equal(staked([["r1", reward(0.01, "2026-03-01", 31.5)]], low).accounts[0].balance, 4032);
  // a balance that is just its coins (within a cent) becomes their worth, as of today, as before: 4,832 on Nov 2
  const just = structuredClone(base); just.accounts[0].balance = 4800;
  const j = staked([["r1", reward(0.01, "2026-03-01", 31.5)]], just);
  assert.deepEqual([j.accounts[0].balance, j.accounts[0].asOf], [4832, T2]);
  // a refusal (sold since) moves nothing, not even the day
  const r = staked([["r1", reward(0.001, "2026-03-31", 85)]]);
  S.applySale(r, S.planSale(r, sell(0.2005, 20050, "2026-11-02"), { today: T2 }), "s1", T2);
  const was = structuredClone(r);
  assert.equal(K.removeReward(r, "r1", "2026-12-01").ok, false);
  assert.deepEqual(r, was);
});

test("staking: a reward taken back leaves the plan as it was, byte for byte; refused once a sale took some of its coins", () => {
  const before = wallet();
  const p = staked([["r1", reward(0.004, "2026-10-31", 412)]]);
  const res = K.removeReward(p, "r1", T2);
  assert.equal(res.ok, true);
  // (the wallet's day of balance is today's after any change)
  assert.deepEqual(p, { ...before, accounts: [{ ...before.accounts[0], asOf: T2 }] }, "coins, cost, purchases and the list as before; no empty list left behind");
  assert.ok(!("staking" in p.investments));
  assert.deepEqual(K.removeReward(p, "r1"), { ok: false, error: "That reward is no longer on file." });
  // sold since: the oldest first takes 0.1 + 0.1 and half of the reward of Mar 31, 2026 (0.0005 of its 0.001)
  const q = staked([["r1", reward(0.001, "2026-03-31", 85)]]);
  S.applySale(q, S.planSale(q, sell(0.2005, 20050, "2026-11-02"), { today: T2 }), "s1", T2);
  near(q.holdings[0].lots.find((l) => l.id === "r1").shares, 0.0005, 1e-12);
  const was = structuredClone(q);
  assert.deepEqual(K.removeReward(q, "r1"), { ok: false, error: K.SOLD_SINCE });
  assert.deepEqual(q, was, "a refusal changes nothing");
  assert.equal(K.SOLD_SINCE, "Some of these coins have been sold since, so the reward cannot come off on its own: remove that sale first, under Sales for your tax return, then this reward.");
});

test("staking on the Federal estimate: the year's rewards are other income, the tax rises by the 22% on them and by nothing else (hand calculation)", () => {
  // one adult filing single, pay 100,000: taxable income 83,900, inside the 22% bracket; 412 more income = 412 x 22% = 90.64
  const k0 = known(wallet(), { today: T2 });
  const k1 = known(staked([["r1", reward(0.004, "2026-10-31", 412)]]), { today: T2 });
  near(k1.total - k0.total, 90.64, 1e-6);
  near(k1.inputs.otherOrdinary - k0.inputs.otherOrdinary, 412, 1e-9);
  assert.equal(k1.inputs.investmentIncome ?? 0, k0.inputs.investmentIncome ?? 0, "not in the 3.8% tax's investment income (README)");
  assert.deepEqual(k1.staking, { total: 412, count: 1, year: 2026 });
  assert.ok(!("staking" in k0), "no reward: no new key");
  assert.deepEqual(k1.sources.at(-1), { key: "staking", label: "Crypto staking rewards", amount: 412, from: "plan", detail: "Crypto page: 1 reward received in 2026, at what it was worth the day you got it (Schedule 1, line 8v)" });
  assert.equal(k1.steps.find((x) => x.label === "Income").sub, "wages $100,000, crypto staking rewards $412");
  // two rewards: "rewards ... they were ... them"
  const two = known(staked([["r1", reward(0.004, "2026-10-31", 412)], ["r2", reward(0.001, "2026-11-01", 100)]]), { today: T2 });
  assert.equal(two.sources.at(-1).detail, "Crypto page: 2 rewards received in 2026, at what they were worth the day you got them (Schedule 1, line 8v)");
  near(two.total - k0.total, 512 * 0.22, 1e-6);
  // a reward of 2025 is 2025's income: 2026's estimate does not move, to the byte
  assert.equal(JSON.stringify(known(staked([["r0", reward(0.0015, "2025-12-31", 140)]]), { today: T2 })), JSON.stringify(k0));
  // the Federal estimate set to 2025 counts it
  const y25 = staked([["r0", reward(0.0015, "2025-12-31", 140)]]); y25.taxes.year = 2025;
  const b25 = wallet(); b25.taxes.year = 2025;
  near(known(y25, { today: T2 }).inputs.otherOrdinary - known(b25, { today: T2 }).inputs.otherOrdinary, 140, 1e-9);
});

test("staking on the Federal estimate, filing separately: on the account owner's return; an account in neither name, half on each", () => {
  const apart = (owner) => { const p = wallet(); p.household.people.push({ id: "a2", name: "Adult 2", role: "partner", birthDate: "1981-01-01" }); p.household.filingStatus = "married_separate"; p.accounts[0].ownerId = owner; return p; };
  const parts = (p) => known(p, { today: T2 }).inputs.separate.map((x) => [x.personId, x.otherOrdinary]);
  assert.deepEqual(parts(apart("a1")), [["a1", 0], ["a2", 0]]);
  assert.deepEqual(parts(staked([["r1", reward(0.004, "2026-10-31", 412)]], apart("a1"))), [["a1", 412], ["a2", 0]]);
  assert.deepEqual(parts(staked([["r1", reward(0.004, "2026-10-31", 412)]], apart("a2"))), [["a1", 0], ["a2", 412]]);
  assert.deepEqual(parts(staked([["r1", reward(0.004, "2026-10-31", 412)]], apart(""))), [["a1", 206], ["a2", 206]]);
  const k = known(staked([["r1", reward(0.004, "2026-10-31", 412)]], apart("a1")), { today: T2 });
  near(k.inputs.otherOrdinary, k.inputs.separate.reduce((t, x) => t + x.otherOrdinary, 0), 1e-9, "the total is the returns added up");
});

test("staking: one written sentence per case (R5), the row's status, and the green lines", () => {
  const money = (n) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
  const none = K.stakingIn(wallet(), 2026);
  assert.equal(K.stakingStatus(none, money), "only if you stake", "no reward on file at all: the row says it is only for people who stake (critic P5)");
  assert.equal(K.stakingSentence(none, money), "No staking rewards recorded yet. When coins you stake earn more coins, record each reward with what it was worth on the day you got it: that worth is income for that year, and the new coins join your list at that cost.");
  assert.equal(K.othersSentence(none), "");
  const last = K.stakingIn(staked([["r0", reward(0.0015, "2025-12-31", 140)]]), 2026);
  assert.equal(K.stakingSentence(last, money), "No staking rewards recorded for 2026 yet. The 1 reward from other years stays on your list at its cost; each is income in its own year.");
  assert.equal(K.stakingStatus(last, money), "none in 2026");
  const lasts = K.stakingIn(staked([["r0", reward(0.0015, "2025-12-31", 140)], ["r9", reward(0.001, "2024-06-30", 60)]]), 2026);
  assert.equal(K.stakingSentence(lasts, money), "No staking rewards recorded for 2026 yet. The 2 rewards from other years stay on your list at their cost; each is income in its own year.");
  const one = K.stakingIn(staked([["r1", reward(0.004, "2026-10-31", 412)]]), 2026);
  assert.equal(K.stakingStatus(one, money), "$412 in 2026");
  assert.equal(K.stakingSentence(one, money), "Your staking rewards in 2026 come to $412, from 1 reward: income for 2026, which the Federal estimate counts.");
  const both = K.stakingIn(staked([["r1", reward(0.004, "2026-10-31", 412)], ["r2", reward(0.001, "2026-11-01", 100)], ["r0", reward(0.0015, "2025-12-31", 140)]]), 2026);
  assert.equal(K.stakingSentence(both, money), "Your staking rewards in 2026 come to $512, from 2 rewards: income for 2026, which the Federal estimate counts.");
  assert.equal(K.othersSentence(both), "1 more reward from other years: each is income in its own year, not in 2026.");
  const r = { units: 0.004, symbol: "BTC", day: "2026-10-31", value: 412 };
  assert.equal(K.recordedSentence(r, one, money), "Recorded: 0.004 BTC received Oct 31, 2026, worth $412. Your 2026 staking rewards now come to $412, counted as income, and the coins are on your list at that cost.");
  assert.equal(K.recordedSentence({ ...r, day: "2025-12-31", value: 140 }, one, money), "Recorded: 0.004 BTC received Dec 31, 2025, worth $140, on your list at that cost. It is income for 2025, so the 2026 estimate does not change.");
  assert.equal(K.removeAsk(r, money), "Remove the reward of 0.004 BTC received Oct 31, 2026? Its coins come off your list and its $412 off your income.");
  assert.equal(K.removedSaid(r), "Reward removed: 0.004 BTC of Oct 31, 2026 is off your list and off your income.");
  assert.equal(K.rewardTitle(r), "0.004 BTC · Oct 31, 2026");
  assert.equal(K.rewardLine(r, money), "on your list at a cost of $412");
  assert.equal(K.earlierLine(1), "and 1 earlier one, counted in the total above.");
  assert.equal(K.earlierLine(3), "and 3 earlier ones, counted in the total above.");
  // the estimate the chip fills in (critic P2): coins x the price on the list, to the cent, as the box shows it
  assert.equal(K.estimateWorth("0.004", 100000), 400);
  assert.equal(K.estimateWorth("0.01", 3150), 31.5);
  assert.equal(K.estimateWorth("1,000", 0.153), 153);
  assert.equal(K.estimateWorth("0.0123", 2451.37), 30.15, "0.0123 x 2,451.37 = 30.151851, to the cent");
  for (const [u, pr] of [["", 100], [null, 100], ["abc", 100], ["0", 100], ["-1", 100], ["1", 0], ["1", null]]) assert.equal(K.estimateWorth(u, pr), null, `${u} x ${pr}`);
  assert.deepEqual([K.estimateText(400), K.estimateText(31.5), K.estimateText(1234.56), K.estimateText(25000)], ["400", "31.50", "1,234.56", "25,000"]);
  assert.equal(K.ESTIMATE_CHIP, "Estimate it at the price on your list");
  assert.equal(K.ESTIMATE_NEEDS, "Type how many coins you received first.");
});

test("staking, the page: one quiet row; inside, the sentence and the form; Record the reward names the new total in green with Undo, stays open, moves nothing else", async () => {
  const P = await page(wallet());
  assert.equal(P.textOf(P.part("staking").querySelector(".fold-title")), "Rewards from staking");
  const st = P.open("staking");
  assert.match(P.textOf(st), /No staking rewards recorded yet\. When coins you stake earn more coins/);
  const form = st.all().find((e) => e.tagName === "FORM");
  assert.deepEqual(form.all().filter((e) => ["INPUT", "SELECT"].includes(e.tagName)).map((e) => e.getAttribute("name")), ["staked", "received", "worth"], "one coin: no coin box; four boxes at most");
  assert.equal(form.querySelector('[name="received"]').value, T2, "the day starts on today");
  assert.match(P.textOf(st), /The IRS counts staking rewards as income in the year you can first sell or move them, at what they are worth then; that worth is also what the new coins cost you\./);
  assert.equal(st.all().filter((e) => e.tagName === "BUTTON" && !/secondary|chip/.test(String(e.className))).length, 1, "one filled button: the form's own (the estimate is a quiet chip)");
  // no statement at hand: the chip under the worth fills in the coins at the price on the list, an estimate; nothing is saved
  const chip = P.button("Estimate it at the price on your list", st);
  assert.ok(chip, "the chip is there"); assert.equal(chip.getAttribute("type"), "button", "it does not send the form");
  chip.click();
  assert.equal(form.querySelector('[name="worth"]').value, "", "no coins typed yet: nothing filled in");
  form.querySelector('[name="staked"]').value = "0.004";
  chip.click();
  assert.equal(form.querySelector('[name="worth"]').value, "400", "0.004 x $100,000 = $400");
  assert.equal(P.saved.length, 0, "the chip saves nothing");
  // a worth of $0 is refused at its box, nothing written (critic P1)
  form.querySelector('[name="worth"]').value = "0";
  form.dispatch("submit");
  assert.equal(P.saved.length, 0, "$0: not recorded");
  form.querySelector('[name="staked"]').value = "0.004"; form.querySelector('[name="received"]').value = "2026-10-31"; form.querySelector('[name="worth"]').value = "412";
  form.dispatch("submit");
  assert.equal(P.saved.length, 1);
  assert.deepEqual(P.plan.investments.staking.map((r) => [r.holdingId, r.accountId, r.symbol, r.units, r.day, r.value]), [["c1", "w", "BTC", 0.004, "2026-10-31", 412]]);
  assert.equal(P.plan.accounts[0].balance, 25400, "the wallet follows its coins");
  assert.deepEqual(P.states(), [["ways", false, "oldest first"], ["sales", false, "none in 2026"], ["staking", true, "$412 in 2026"]], "the saved part stays open (R17), the others as they were");
  const green = P.part("staking").all().find((e) => String(e.className).includes("notice"));
  assert.equal(P.textOf(green), "Recorded: 0.004 BTC received Oct 31, 2026, worth $412. Your 2026 staking rewards now come to $412, counted as income, and the coins are on your list at that cost.");
  assert.match(P.textOf(P.part("staking")), /Your staking rewards in 2026 come to \$412, from 1 reward: income for 2026, which the Federal estimate counts\. The Federal estimate adds them as other income\. If you typed them there yourself, under Other income, take them out there, so they are not counted twice\. 0\.004 BTC · Oct 31, 2026 \$412 on your list at a cost of \$412 Remove this reward \+ Record another reward/);
  // Undo: the plan as it was
  P.button("Undo", P.part("staking")).click();
  assert.deepEqual(P.plan.holdings, wallet().holdings);
  assert.ok(!("staking" in P.plan.investments));
  assert.equal(P.textOf(P.part("staking").all().find((e) => String(e.className).includes("notice"))), "Undone: the reward is off your list and off your income.");
  // the next draw (a reload): shut, saying what it holds
  P.draw();
  assert.deepEqual(P.states().at(-1), ["staking", false, "only if you stake"]);
});

test("staking, the page: Remove this reward asks first, says so with Undo; refused in red when a sale took some of its coins", async () => {
  const had = globalThis.window.confirm, asked = [];
  try {
    const P = await page(staked([["r1", reward(0.004, "2026-10-31", 412)]]));
    assert.deepEqual(P.states().at(-1), ["staking", false, "$412 in 2026"]);
    const st = P.open("staking");
    assert.ok(P.button("+ Record another reward", st), "a reward this year: the form waits behind an outlined button");
    globalThis.window.confirm = (text) => { asked.push(text); return false; };
    P.button("Remove this reward", st).click();
    assert.equal(P.saved.length, 0, "No: nothing changes");
    globalThis.window.confirm = (text) => { asked.push(text); return true; };
    P.button("Remove this reward", P.part("staking")).click();
    assert.deepEqual(asked, ["Remove the reward of 0.004 BTC received Oct 31, 2026? Its coins come off your list and its $412 off your income.", "Remove the reward of 0.004 BTC received Oct 31, 2026? Its coins come off your list and its $412 off your income."]);
    assert.equal(P.saved.length, 1);
    assert.deepEqual(P.plan.holdings, wallet().holdings);
    assert.equal(P.textOf(P.part("staking").all().find((e) => String(e.className).includes("notice"))), "Reward removed: 0.004 BTC of Oct 31, 2026 is off your list and off your income.");
    P.button("Undo", P.part("staking")).click();
    assert.deepEqual(P.plan.investments.staking.map((r) => r.id), ["r1"]);
    assert.equal(P.textOf(P.part("staking").all().find((e) => String(e.className).includes("notice"))), "Undone: the reward is back on your list and in your income.");
    // sold since: refused, said in red, nothing written
    const q = staked([["r1", reward(0.001, "2026-03-31", 85)]]);
    S.applySale(q, S.planSale(q, sell(0.2005, 20050, "2026-11-02"), { today: T2 }), "s1", T2);
    const Q = await page(q);
    Q.button("Remove this reward", Q.open("staking")).click();
    assert.equal(Q.saved.length, 0);
    const red = Q.part("staking").all().find((e) => String(e.className).includes("notice error"));
    assert.equal(Q.textOf(red), K.SOLD_SINCE);
  } finally { globalThis.window.confirm = had; }
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
/** wallet() with its balance left blank (null, "" or no balance at all) and 1.5 ETH at 3,200 listed. */
function blankWallet(blank) {
  const base = wallet();
  base.accounts = [{ id: "w", name: "Wallet", type: "crypto", balance: blank, asOf: "2026-06-30", history: [] }];
  if (blank === undefined) delete base.accounts[0].balance;
  base.holdings = [{ id: "c1", accountId: "w", symbol: "ETH", shares: 1.5, price: 3200, priceAsOf: T2, costBasis: null, lots: [] }];
  return base;
}
// (d) A crypto account whose balance was left blank read $32 after a staking reward was recorded and $0 after it was removed (the
// blank was read as $0, and the part "not listed coins" as minus the coins). A blank balance now stays blank, as a blank cost does.
test("y2 (d) staking: a wallet whose balance was left blank stays blank through record, remove and Undo; its day too", async () => {
  const { changesOf, takeBack } = await import("../../../core/ui/undo.js");
  const { compute: netWorth } = await import("../../balance/net-worth/compute.js");
  assert.deepEqual(["", null, undefined, "  ", 0, "0", 5000].map(K.blankBalance), [true, true, true, true, false, false, false]);
  for (const blank of [null, "", undefined]) {
    const base = blankWallet(blank);
    const nw0 = netWorth(base, { today: T2 }).netWorth;
    // recorded: the coins and the income move, the balance does not
    const p = staked([["r1", reward(0.01, "2026-03-01", 31.5, { holdingId: "c1" })]], base);
    assert.equal(p.accounts[0].balance, blank, `${JSON.stringify(blank)}: not made $32`);
    assert.equal("balance" in p.accounts[0], blank !== undefined);
    assert.equal(p.accounts[0].asOf, "2026-06-30", "its day stays");
    near(p.holdings[0].shares, 1.51, 1e-12);
    assert.equal(K.stakingIn(p, 2026).total, 31.5);
    assert.equal(netWorth(p, { today: T2 }).netWorth, nw0, "net worth counts a blank balance as before: not at all");
    // removed: blank, not $0
    const q = structuredClone(p);
    assert.equal(K.removeReward(q, "r1", T2).ok, true);
    assert.equal(q.accounts[0].balance, blank, `${JSON.stringify(blank)}: not made $0`);
    assert.deepEqual(q.accounts, base.accounts, "the account exactly as it was");
    // Undo of the record, and Undo of the removal (the page's undoable: changesOf, then takeBack)
    const undoRecord = structuredClone(p); takeBack(undoRecord, changesOf(base, p));
    assert.deepEqual(undoRecord.accounts, base.accounts);
    const undoRemove = structuredClone(q); takeBack(undoRemove, changesOf(p, q));
    assert.deepEqual(undoRemove.accounts, p.accounts);
  }
});
test("y2 (d) staking: a typed balance moves exactly as before ($0 typed is a balance, not a blank)", () => {
  // $0 typed against 4,800 of coins keeps its gap: 0 - 4,800, then 4,832 - 4,800 = 32
  const zero = blankWallet(0);
  const p = staked([["r1", reward(0.01, "2026-03-01", 31.5)]], zero);
  assert.equal(p.accounts[0].balance, 32);
  const q = structuredClone(p); K.removeReward(q, "r1", T2);
  assert.equal(q.accounts[0].balance, 0);
});

// (d) invariance: with nothing new typed (a balance on file), recording a reward and removing it write exactly what they wrote at
// 398a01e, for every household with a wallet added at four typed balances (above, at, below its coins, and $0). Written with
// PRINT_Y2=1 on 398a01e's code. (Crypto's figures, the Federal estimate's and the page's words with no reward are pinned by the
// staking invariance test above.)
test("y2 (d) invariance: a reward recorded and removed on a typed balance writes what it wrote at 398a01e, for every household", async () => {
  const fs = await import("node:fs");
  const file = new URL("./y2-invariance.json", import.meta.url);
  const now = {};
  for (const [name, plan] of await y2Plans(T2)) {
    const out = [];
    for (const bal of [5000, 4800, 4000, 0]) {
      const p = structuredClone(plan);
      p.accounts = [...(p.accounts ?? []), { id: "y2w", name: "Wallet", type: "crypto", balance: bal, asOf: "2026-06-30", history: [] }];
      p.holdings = [...(p.holdings ?? []), { id: "y2c", accountId: "y2w", symbol: "ETH", shares: 1.5, price: 3200, priceAsOf: T2, costBasis: 4000, lots: [] }];
      const w = K.planReward(p, { holdingId: "y2c", units: 0.01, day: "2026-03-01", value: 31.5 }, { today: T2 });
      K.applyReward(p, w.reward, "y2r", T2);
      const rec = structuredClone(p);
      K.removeReward(p, "y2r", T2);
      out.push([rec.accounts.at(-1), rec.holdings.at(-1), rec.investments?.staking ?? null, p.accounts.at(-1), p.holdings.at(-1), p.investments?.staking ?? null]);
    }
    now[name] = await y2Digest(out);
  }
  if (process.env.PRINT_Y2) { fs.writeFileSync(file, `${JSON.stringify({ note: "digests at 398a01e (y2 leftovers); PRINT_Y2=1 writes them again: only on that code", plans: now }, null, 1)}\n`); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8")).plans;
  assert.ok(Object.keys(was).length >= 45, `${Object.keys(was).length} households`);
  assert.deepEqual(now, was);
});
