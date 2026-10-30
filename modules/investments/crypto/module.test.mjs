import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, cryptoKind, STRESS_DROP, SHARE } from "./compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { marginalRate, federalTax } from "../../../core/math/tax.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

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

test("tax if sold: lot by lot, short against long; the loss to bank and the gain to wait on", () => {
  const p = withCoins();
  const d = compute(p, { today: TODAY });
  const ti = taxInputs(p, { today: TODAY });
  const marginal = Math.max(0.1, marginalRate(ti.inputs, ti.params));
  const base = federalTax(ti.inputs, ti.params).totalTax;
  const gainsRate = (federalTax({ ...ti.inputs, qualifiedIncome: ti.inputs.qualifiedIncome + 1000 }, ti.params).totalTax - base) / 1000;
  // BTC: 0.08 long (+5,740), 0.04 short (+1,820); ETH short (-1,500); IBIT long (+600); USDC long (0)
  near(d.tax.longGain, 0.08 * 98000 - 2100 + 600); near(d.tax.shortGain, 0.04 * 98000 - 2100 - 1500);
  near(d.tax.total, d.tax.shortGain * marginal + d.tax.longGain * gainsRate);
  assert.deepEqual(d.harvest.map((h) => h.symbol), ["ETH"]); near(d.harvest[0].saved, 1500 * marginal);
  assert.equal(d.waitLong.length, 1); assert.equal(d.waitLong[0].symbol, "BTC");
  assert.equal(d.waitLong[0].longOn, "2026-12-05", "the day after a year is up");
  near(d.waitLong[0].saved, 1820 * (marginal - gainsRate));
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
