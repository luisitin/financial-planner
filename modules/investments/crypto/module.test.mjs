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
  near(d.harvestSaved, 750 * 0.22);
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
