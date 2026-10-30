// modules/investments/crypto/compute.js -- PURE. The crypto you hold, wherever it is: coins in a crypto
// account or wallet, and the funds that hold bitcoin or ether in a brokerage or retirement account. What it is
// worth against what you paid, how big a slice of your net worth it is, what a fall like 2018's or 2022's would
// take, the tax if you sold today (short- or long-term, lot by lot), losses that could be banked, gains that turn
// long-term soon, and prices that are out of date.
import { compute as computeHoldings } from "../holdings/compute.js";
import { lotsOf } from "../tax-lots/compute.js";
import { compute as computeNetWorth, countedBalance } from "../../balance/net-worth/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { marginalRate, federalTax } from "../../../core/math/tax.js";
import { daysBetween, isoOf } from "../../../core/math/dates.js";

const addDays = (iso, n) => isoOf(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)) + n);

/** Common coins (symbol -> name). Stablecoins are meant to stay at one dollar. */
export const COINS = { BTC: "Bitcoin", ETH: "Ether", SOL: "Solana", XRP: "XRP", ADA: "Cardano", DOGE: "Dogecoin", LTC: "Litecoin", AVAX: "Avalanche", DOT: "Polkadot", LINK: "Chainlink", POL: "Polygon", BNB: "BNB", XLM: "Stellar", BCH: "Bitcoin Cash", USDC: "USD Coin", USDT: "Tether", DAI: "Dai", PYUSD: "PayPal USD" };
export const STABLE = ["USDC", "USDT", "DAI", "PYUSD"];
/** Exchange-traded funds that hold bitcoin or ether (spot funds from 2024; BITO holds futures). */
export const FUNDS = { IBIT: "iShares Bitcoin Trust", FBTC: "Fidelity Wise Origin Bitcoin Fund", BITB: "Bitwise Bitcoin ETF", ARKB: "ARK 21Shares Bitcoin ETF", GBTC: "Grayscale Bitcoin Trust", HODL: "VanEck Bitcoin ETF", BRRR: "CoinShares Bitcoin ETF", EZBC: "Franklin Bitcoin ETF", BTCO: "Invesco Galaxy Bitcoin ETF", ETHA: "iShares Ethereum Trust", FETH: "Fidelity Ethereum Fund", ETHE: "Grayscale Ethereum Trust", ETHW: "Bitwise Ethereum ETF", BITO: "ProShares Bitcoin Strategy ETF (futures)" };
/** Bitcoin's two deepest recent falls, peak to low: December 2017 to December 2018 (about 84%), November 2021 to November 2022 (about 77%). */
export const FALLS = [{ from: "Dec 2017", to: "Dec 2018", drop: 0.84 }, { from: "Nov 2021", to: "Nov 2022", drop: 0.77 }];
export const STRESS_DROP = 0.75;
/** Share of net worth: up to 5% is a small slice; above 20% a large bet. */
export const SHARE = { small: 0.05, large: 0.20 };
export const STALE_DAYS = 7;

/** Is this enriched holding crypto, and of which kind: "coin" (held directly), "stable", "fund" (an exchange-traded fund), or null. */
export function cryptoKind(h) {
  const sym = String(h.symbol ?? "").toUpperCase();
  if (h.accountType === "crypto") return STABLE.includes(sym) ? "stable" : "coin";
  if (FUNDS[sym]) return "fund";
  return null;
}

/**
 * compute(plan, { today }) -> {
 *   ready, items: [{ id, symbol, name, kind, account, bucket, value, cost, gain, gainPct, price, priceAsOf, stale, lots }],
 *   total, cost, gain, volatile (all but stablecoins), share (of net worth), level: "small" | "medium" | "large", netWorth,
 *   stress: { drop, loss, share }, tax: { short, long, shortGain, longGain, total, marginal, gainsRate },
 *   harvest: [{ symbol, date, loss, saved }], harvestSaved, waitLong: [{ symbol, date, longOn, gain, saved }], staleCount
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const ho = computeHoldings(plan, { today });
  const items = [];
  for (const h of ho.items) {
    const kind = cryptoKind(h);
    if (!kind) continue;
    const age = h.priceAsOf && today ? daysBetween(String(h.priceAsOf).slice(0, 10), today) : null;
    items.push({ id: h.id, symbol: h.symbol, name: COINS[h.symbol] && kind !== "fund" ? COINS[h.symbol] : FUNDS[h.symbol] ?? h.name, kind, account: h.accountName, accountId: h.accountId, bucket: h.bucket, shares: h.shares, value: h.value, cost: h.costBasis, gain: h.gain, gainPct: h.gainPct, price: h.price, priceAsOf: h.priceAsOf ?? null, stale: kind !== "stable" && (age === null || age > STALE_DAYS), lots: lotsOf(h, today) });
  }
  // crypto accounts with a balance but no coins listed
  for (const a of (plan.accounts ?? []).filter((x) => x.type === "crypto")) {
    const listed = items.filter((i) => i.accountId === a.id).reduce((s, i) => s + i.value, 0);
    const rest = countedBalance(a) - listed;
    if (rest > 0.5) items.push({ id: `acct:${a.id}`, symbol: "", name: listed ? `${a.name}: the rest of the balance` : a.name, kind: "account", account: a.name, accountId: a.id, bucket: "taxable", shares: null, value: rest, cost: null, gain: null, gainPct: null, price: null, priceAsOf: null, stale: false, lots: [] });
  }
  if (!items.length) return { ready: false, items: [] };
  items.sort((a, b) => b.value - a.value);
  const total = items.reduce((s, i) => s + i.value, 0);
  const known = items.filter((i) => i.cost !== null);
  const cost = known.reduce((s, i) => s + i.cost, 0), gain = known.reduce((s, i) => s + i.gain, 0);
  const vol = items.filter((i) => i.kind !== "stable").reduce((s, i) => s + i.value, 0);
  const nw = computeNetWorth(plan, { today });
  const share = nw.netWorth > 0 ? total / nw.netWorth : null;
  const level = share === null ? "large" : share <= SHARE.small ? "small" : share <= SHARE.large ? "medium" : "large";
  const loss = vol * STRESS_DROP;

  // tax if sold today: taxable accounts only, lot by lot
  const ti = taxInputs(plan, { today });
  const marginal = Math.max(0.1, marginalRate(ti.inputs, ti.params) || 0.22);
  const base = federalTax(ti.inputs, ti.params).totalTax;
  const gainsRate = Math.max(0, (federalTax({ ...ti.inputs, qualifiedIncome: (ti.inputs.qualifiedIncome ?? 0) + 1000 }, ti.params).totalTax - base) / 1000);
  let shortGain = 0, longGain = 0;
  const harvest = [], waitLong = [];
  for (const i of items.filter((x) => x.bucket === "taxable" && x.kind !== "account")) {
    for (const l of i.lots) {
      if (l.term === "short") shortGain += l.gain; else longGain += l.gain;
      if (l.gain < -1) harvest.push({ symbol: i.symbol, kind: i.kind, date: l.date, loss: -l.gain, saved: -l.gain * (l.term === "short" ? marginal : gainsRate) });
      if (l.term === "short" && l.gain > 1 && l.daysToLong > 0 && l.daysToLong <= 90 && today) waitLong.push({ symbol: i.symbol, date: l.date, longOn: addDays(today, l.daysToLong), gain: l.gain, saved: l.gain * (marginal - gainsRate) });
    }
  }
  const tShort = Math.max(0, shortGain) * marginal, tLong = Math.max(0, longGain) * gainsRate;
  return {
    ready: true, items, total, cost, gain, volatile: vol, share, level, netWorth: nw.netWorth,
    stress: { drop: STRESS_DROP, loss, share: nw.netWorth > 0 ? loss / nw.netWorth : null },
    tax: { shortGain, longGain, short: tShort, long: tLong, total: tShort + tLong, marginal, gainsRate },
    harvest: harvest.sort((a, b) => b.saved - a.saved), harvestSaved: harvest.reduce((s, x) => s + x.saved, 0),
    waitLong: waitLong.sort((a, b) => a.longOn.localeCompare(b.longOn)), staleCount: items.filter((i) => i.stale).length,
  };
}
