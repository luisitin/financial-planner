// modules/investments/crypto/compute.js -- PURE. The crypto you hold, wherever it is: coins in a crypto
// account or wallet, and the funds that hold bitcoin or ether in a brokerage or retirement account. What it is
// worth against what you paid, how big a slice of your net worth it is, what a fall like 2018's or 2022's would
// take, the tax if you sold today (short- or long-term, lot by lot), losses that could be banked, gains that turn
// long-term soon, and prices that are out of date.
import { compute as computeHoldings } from "../holdings/compute.js";
import { lotsOf, washSales, todaysReturn } from "../tax-lots/compute.js";
import { compute as computeNetWorth, countedBalance } from "../../balance/net-worth/compute.js";
import { taxInputs, lossCarryover } from "../../taxes/federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
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
  if (FUNDS[sym]) return "fund";   // a bitcoin fund is a fund wherever it is held
  if (h.accountType === "crypto") return STABLE.includes(sym) ? "stable" : "coin";
  return null;
}

/**
 * compute(plan, { today }) -> {
 *   ready, items: [{ id, symbol, name, kind, account, bucket, value, cost, gain, gainPct, price, priceAsOf, stale, lots }],
 *   total, cost, gain, volatile (all but stablecoins), share (of net worth), level: "small" | "medium" | "large", netWorth,
 *   stress: { drop, loss, share }, tax: { shortGain, longGain (the lots' own sums), net (after wash sales), addShort, addLong (what
 *   the sale adds to this year's net short and long gains, after netting), total (the change in this year's federal tax if every
 *   taxable lot were sold today; below 0 a saving), carry (loss the sale adds to next year's carryover), disallowed (wash sales),
 *   lossLimit (3,000; 1,500 filing separately), why (when total is 0: "none" | "even" | "zero" | "carry" | "limit" | "under"),
 *   year (the tax year worked), otherYear (the Federal estimate's year when it is not today's), marginal, gainsRate },
 *   harvest: [{ symbol, kind, account, personId, date, lot, loss, allowed, disallowed, washedBy, saved (that lot sold on its own) }], harvestSaved (all of them
 *   together), harvestCarry, harvestDisallowed, waitLong: [{ symbol, date, longOn, gain, saved }], staleCount
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

  // tax if sold today, taxable accounts only: the federal total with the lots sold (each lot's gain or loss added to the
  // year's sales, short or long by its term) less the total without. The engine nets them with the year's other sales
  // (short against short, long against long, then across), stacks long-term gains at 0/15/20%, adds the 3.8% on investment
  // income and lets a net loss take at most 3,000 (1,500 filing separately) off other income (IRC 1(h), 1211(b), 1222, 1411).
  // A sale today is in today's tax year (todaysReturn); filing separately, a lot is on the return of its account's owner.
  const yr = todaysReturn(plan, today);
  const P0 = yr.plan;
  const ownerOf = new Map((plan.accounts ?? []).map((a) => [a.id, a.ownerId || null]));
  const ti = taxInputs(P0, { today });
  const r0 = federalTax(ti.inputs, ti.params);
  const base = r0.totalTax;
  const withSales = (sales) => {
    const extra = sales.filter((x) => Math.abs(x.gain) > 0.005).map((x, n) => ({ id: `crypto-${n}`, name: "crypto", proceeds: Math.max(0, x.gain), basis: Math.max(0, -x.gain), held: x.held, ...(x.personId ? { personId: x.personId } : {}) }));
    const t2 = taxInputs({ ...P0, taxes: { ...(P0.taxes ?? {}), gains: [...(P0.taxes?.gains ?? []), ...extra] } }, { today });
    const r2 = federalTax(t2.inputs, t2.params);
    return { change: r2.totalTax - base, carry: lossCarryover(t2, r2), short: t2.gains.netShort - ti.gains.netShort, long: t2.gains.netLong - ti.gains.netLong };
  };
  // the rates shown: the tax on $1,000 more pay-like income or long-term gain, the 3.8% included (as Tax lots)
  const invested = (Number(ti.inputs.investmentIncome ?? ti.inputs.qualifiedIncome) || 0) + 1000;
  const rateOn = (more) => Math.max(0, (federalTax({ ...ti.inputs, ...more, investmentIncome: invested }, ti.params).totalTax - base) / 1000);
  const marginal = rateOn({ otherOrdinary: (Number(ti.inputs.otherOrdinary) || 0) + 1000 });
  const gainsRate = rateOn({ qualifiedIncome: (Number(ti.inputs.qualifiedIncome) || 0) + 1000 });
  const baseCarry = lossCarryover(ti, r0);
  const lossLimit = ti.filingStatus === "married_separate" ? 1500 : 3000;
  const taxable = items.filter((x) => x.bucket === "taxable" && x.kind !== "account");
  let shortGain = 0, longGain = 0;
  const all = [], harvest = [], waitLong = [];
  for (const i of taxable) {
    const personId = ownerOf.get(i.accountId) ?? null;
    for (const l of i.lots) {
      if (l.term === "short") shortGain += l.gain; else longGain += l.gain;
      all.push({ gain: l.gain, held: l.term, personId, lot: l });
      if (l.gain < -1) harvest.push({ symbol: i.symbol, kind: i.kind, account: i.account, personId, date: l.date, lot: l, loss: -l.gain });
      if (l.term === "short" && l.gain > 1 && l.daysToLong > 0 && l.daysToLong <= 90 && today) waitLong.push({ symbol: i.symbol, date: l.date, longOn: addDays(today, l.daysToLong), gain: l.gain, saved: Math.max(0, withSales([{ gain: l.gain, held: "short", personId }]).change - withSales([{ gain: l.gain, held: "long", personId }]).change) });
    }
  }
  // a fund is a security, so the same fund bought in the 30 days before today, in any account, cancels the loss on that
  // many shares (IRC 1091; Tax lots' washSales); coins are property, not securities, so the rule does not reach them as of 2026
  const funds = items.filter((x) => x.kind === "fund").map((x) => ({ symbol: x.symbol, account: x.account, bucket: x.bucket, lots: x.lots }));
  const fundLoss = (h) => h.kind === "fund";
  // selling everything: every taxable lot is sold, so only a fund's lots outside taxable accounts (an IRA's) can replace a loss
  const lossLots = new Set(harvest.map((h) => h.lot));
  const soldFunds = harvest.filter(fundLoss).map((h) => ({ lot: h.lot, loss: h.loss }));
  washSales(soldFunds, funds.map((x) => ({ ...x, lots: x.lots.filter((l) => x.bucket !== "taxable" || lossLots.has(l)) })), today);
  const allowedIn = new Map(soldFunds.map((c) => [c.lot, c.allowed]));
  const allSales = all.map((x) => allowedIn.has(x.lot) ? { ...x, gain: -allowedIn.get(x.lot) } : x);
  const sold = allSales.length ? withSales(allSales) : { change: 0, carry: baseCarry, short: 0, long: 0 };
  // losses to bank: only the losing lots are sold, so a fund's other lots anywhere can replace them
  washSales(harvest.filter(fundLoss), funds, today);
  for (const h of harvest) {
    if (h.allowed === undefined) { h.allowed = h.loss; h.disallowed = 0; h.washedBy = []; }
    // that lot sold on its own: its own wash match (it may take purchases another lot takes when all are sold)
    const solo = fundLoss(h) ? washSales([{ lot: h.lot, loss: h.loss }], funds, today)[0].allowed : h.loss;
    h.saved = Math.max(0, -withSales([{ gain: -solo, held: h.lot.term, personId: h.personId }]).change);
  }
  const banked = harvest.length ? withSales(harvest.map((h) => ({ gain: -h.allowed, held: h.lot.term, personId: h.personId }))) : { change: 0, carry: baseCarry };
  // the loss the sale adds to next year's carryover (the whole carryover against the one without: a gain can use up some of it)
  const carryOf = (c) => Math.max(0, c.total - baseCarry.total);
  // why selling everything would not change this year's tax
  const net = allSales.reduce((s, x) => s + x.gain, 0);
  // filing separately, judged on the returns the sold lots land on (a lot in neither spouse's name is half on each)
  const parts = r0.separate ?? null;
  const onReturn = (x) => !parts || !parts.some((p) => p.personId === x.personId);
  const touched = parts ? parts.filter((p) => allSales.some((x) => Math.abs(x.gain) > 0.5 && (onReturn(x) || x.personId === p.personId))) : [r0];
  const limitUsed = touched.length > 0 && touched.every((x) => -(Number(x.income?.capitalLoss) || 0) >= lossLimit - 0.005);
  const under = touched.length > 0 && touched.every((x) => x.taxableIncome <= 0);
  let why = null;
  if (Math.abs(sold.change) <= 0.5) {
    if (!allSales.some((x) => Math.abs(x.gain) > 0.5)) why = "none";
    else if (Math.abs(net) <= 0.5) why = "even";
    else if (net > 0) why = sold.carry.total < baseCarry.total - 0.5 ? "carry" : "zero";
    else why = limitUsed ? "limit" : under ? "under" : "zero";
  }
  return {
    ready: true, items, total, cost, gain, volatile: vol, share, level, netWorth: nw.netWorth,
    stress: { drop: STRESS_DROP, loss, share: nw.netWorth > 0 ? loss / nw.netWorth : null },
    tax: { shortGain, longGain, net, addShort: sold.short, addLong: sold.long, total: sold.change, carry: carryOf(sold.carry), disallowed: soldFunds.reduce((s, c) => s + c.disallowed, 0), lossLimit, returns: parts?.length || 1, why, year: yr.year, otherYear: yr.other, marginal, gainsRate },
    harvest: harvest.sort((a, b) => b.saved - a.saved), harvestSaved: Math.max(0, -banked.change), harvestCarry: carryOf(banked.carry), harvestDisallowed: harvest.reduce((s, x) => s + x.disallowed, 0),
    waitLong: waitLong.sort((a, b) => a.longOn.localeCompare(b.longOn)), staleCount: items.filter((i) => i.stale).length,
  };
}
