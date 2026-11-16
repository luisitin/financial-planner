// modules/investments/crypto/sales.js -- PURE. The answers Crypto keeps one tap away (gap list, next 60, item 46):
//   - which coins count as sold ("Which coins count as sold"): a sale of some of one coin worked three ways (the oldest
//     purchases first, what counts when you name none; the purchases that cost the most first; the purchases you pick),
//     each with its gain, its short- and long-term parts and what it does to this year's federal tax, by the Federal
//     estimate's own engine on today's return (Tax lots' helpers, imported, never copied); and the way the person's
//     exchange counts, saved as `investments.cryptoMethod`.
// compute() in compute.js is not changed by any of this: the page calls these beside it.
import { compute as computeHoldings } from "../holdings/compute.js";
import { lotsOf } from "../tax-lots/compute.js";
import { ORDERS, ORDER_TITLES, orderLots, takeShares, saleRows, saleTax, lotKey, orderLine } from "../tax-lots/sell.js";
import { todaysReturn } from "../../taxes/federal/compute.js";
import { taxView } from "../../taxes/federal/known.js";
import { cryptoKind } from "./compute.js";

/** The three ways, in the order the page shows them (Tax lots' order: a tie goes to the oldest first, which needs no word to the exchange). */
export const METHODS = ORDERS;
export const METHOD_TITLES = ORDER_TITLES;
/** The way in a few words: the row's status and the green line. */
export const METHOD_SHORT = Object.freeze({ oldest: "oldest first", cost: "highest cost first", picked: "the ones you pick" });
/** The chips' words (the person speaks: "The ones I pick"). */
export const METHOD_CHIPS = Object.freeze({ oldest: "Oldest first", cost: "Highest cost first", picked: "The ones I pick" });

const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dollars = (n) => `$${Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-US")}`;
/** Coins as an exchange shows them: up to eight decimals (a satoshi is 0.00000001 bitcoin), commas, trailing zeros dropped. */
export const unitsText = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(Number(n) || 0);
/** Coins with their word: "1 coin", "0.5 coins", "2 coins" (the number as unitsText writes it). */
export const coinsText = (n) => { const t = unitsText(n); return `${t} ${t === "1" ? "coin" : "coins"}`; };

/** The way the person's exchange counts their coin sales: the saved one, else the oldest first (IRS FAQ 86, 87 and 92: the
 *  units count in order of time from the earliest purchase in that wallet or account when none are named). */
export function methodOf(plan) {
  const v = plan?.investments?.cryptoMethod;
  return METHODS.includes(v) ? { key: v, saved: true } : { key: "oldest", saved: false };
}

/** What Undo says: the way before the save is back (none saved: oldest first, as before). */
export const methodUndone = (was) => `Undone: back to ${METHODS.includes(was) ? METHOD_SHORT[was] : "oldest first, as before"}.`;

/** The words of the green line after a way is saved (a chip saves at once: this line and Undo, no question first). Oldest
 *  first is what an exchange counts when told nothing (FAQ 92); another way is set on the exchange too. */
export function methodSaid(key) {
  if (key === "cost") return "Saved: the sales you record here now count the coins that cost the most first. Set your exchange the same way before you sell.";
  if (key === "picked") return "Saved: the sales you record here now count the purchases you check at each sale. Pick the same ones on the exchange when you sell.";
  return "Saved: the sales you record here now count the oldest coins first (first in, first out).";
}

/**
 * The coins a sale can be worked for: a holding in a crypto account (a coin or a stablecoin; a bitcoin fund is Tax lots'),
 * in a taxable account, with a price above 0 and coins in it. Each with its lots as Tax lots draws them (`lotsOf`: the
 * coins no typed lot covers are one undated lot), keyed (`lotKey`).
 */
export function coinsOf(plan, params = {}) {
  const today = params.today ?? null;
  const h = computeHoldings(plan, { today });
  const ownerOf = new Map((plan.accounts ?? []).map((a) => [a.id, a.ownerId || null]));
  return h.items
    .filter((x) => ["coin", "stable"].includes(cryptoKind(x)) && x.bucket === "taxable" && x.priced && x.price > 0 && x.shares > 1e-12)
    .map((x) => ({ id: x.id, symbol: x.symbol, name: x.name, account: x.accountName, accountId: x.accountId, personId: ownerOf.get(x.accountId) ?? null,
      price: x.price, units: x.shares, value: cents(x.shares * x.price), lots: lotsOf(x, today).map((l) => ({ ...l, key: lotKey(l, x.id) })) }));
}

/** Two or more purchases with coins in them: the ways can differ. */
export const hasWays = (c) => (c?.lots ?? []).filter((l) => l.shares > 1e-12).length > 1;

/**
 * coinOrders(plan, { today, ask? }) -> {
 *   coins, coin (asked about, else the first with two or more purchases, else the first), ask (null when none), units (to
 *   sell), proceeds, tooMany, year, otherYear, method ({ key, saved }),
 *   orders: [{ key, state: "ok" | "none" (nothing ticked) | "short" (the ticked lots hold too few: `has`), pieces, gain,
 *              shortGain, longGain, tax (the change in this year's federal tax), carry, loss (a piece sold at a loss) }],
 *   least (the cheapest way; ties to the oldest first, then the highest cost), saving (the oldest's tax less the least's)
 * }
 * ask = { holdingId, by: "coins" | "dollars", amount, picked: [lot keys] }, read from plan.whatIfs.crypto when not given.
 * Coins are property, not securities: no wash-sale match (IRC 1091 reaches stock or securities).
 */
export function coinOrders(plan, params = {}) {
  const today = params.today ?? null, tp = { today };
  const coins = coinsOf(plan, tp);
  const raw = params.ask ?? plan.whatIfs?.crypto ?? null;
  const found = raw ? coins.find((c) => c.id === raw.holdingId) ?? null : null;
  const coin = found ?? coins.find(hasWays) ?? coins[0] ?? null;
  const amount = Number(raw?.amount);
  const ask = found && amount > 0 ? { holdingId: found.id, by: raw.by === "dollars" ? "dollars" : "coins", amount, picked: Array.isArray(raw.picked) ? raw.picked.map(String) : [] } : null;
  const out = { coins, coin, ask, units: 0, proceeds: 0, tooMany: false, year: null, otherYear: null, method: methodOf(plan), orders: [], least: null, saving: 0 };
  if (!ask) return out;
  const units = ask.by === "dollars" ? ask.amount / coin.price : ask.amount;
  out.units = units; out.proceeds = cents(units * coin.price);
  if (units > coin.units + 1e-9) { out.tooMany = true; return out; }
  const yr = todaysReturn(plan, today);
  const base = taxView(yr.plan, tp);
  out.year = yr.year; out.otherYear = yr.other;
  for (const key of METHODS) {
    const lots = orderLots(coin.lots, key, ask.picked);
    if (key === "picked" && !lots.length) { out.orders.push({ key, state: "none", pieces: [], has: 0 }); continue; }
    const { pieces, left } = takeShares(lots, units, coin.price);
    if (left > 1e-9) { out.orders.push({ key, state: "short", pieces: [], has: lots.reduce((s, l) => s + l.shares, 0) }); continue; }
    const sum = (term) => cents(pieces.filter((p) => !term || p.term === term).reduce((s, p) => s + p.gain, 0));
    const t = saleTax(plan, saleRows(pieces, coin.personId), tp, base);
    out.orders.push({ key, state: "ok", pieces, gain: sum(), shortGain: sum("short"), longGain: sum("long"), tax: t.tax, carry: t.carry, loss: pieces.some((p) => p.gain < -0.005) });
  }
  const ok = out.orders.filter((o) => o.state === "ok");
  const least = ok.reduce((a, o) => (!a || o.tax < a.tax - 0.5 ? o : a), null);
  out.least = least?.key ?? null;
  out.saving = least ? cents(out.orders.find((o) => o.key === "oldest").tax - least.tax) : 0;
  return out;
}

// ---------------------------------------------------------------- the words (one written sentence per case, each tested)
/** Which way costs least, and by how much (R5: nine cases, each tested). */
export function waysSentence(r, money = dollars) {
  if (!r?.coin || !r.ask) return "";
  if (r.tooMany) return `${r.coin.symbol} in ${r.coin.account} holds ${coinsText(r.coin.units)} (worth ${money(r.coin.value)}): sell at most that.`;
  const ok = r.orders.filter((o) => o.state === "ok");
  if (!ok.length) return "";
  const lo = Math.min(...ok.map((o) => o.tax)), hi = Math.max(...ok.map((o) => o.tax));
  if (hi - lo < 0.5) {
    if (lo >= 0.5) return `Whichever way you count, it adds about ${money(lo)} to your federal tax: here the way makes no difference.`;
    if (lo <= -0.5) return `Whichever way you count, it takes about ${money(-lo)} off your federal tax: here the way makes no difference.`;
    return "There is no federal tax to pay whichever way you count: here the way makes no difference.";
  }
  const win = ok.find((o) => o.key === r.least);
  if (win.key === "oldest") {
    const next = Math.min(...ok.filter((o) => o.key !== "oldest").map((o) => o.tax));
    if (next - win.tax < 0.5) return "Oldest first costs least, as little as another way, and it is what counts unless you tell the exchange otherwise.";
    return `Oldest first costs least, about ${money(next - win.tax)} less federal tax than the next best way, and it is what counts unless you tell the exchange otherwise.`;
  }
  if (win.key === "cost") return `Highest cost first costs least: about ${money(r.saving)} less federal tax than oldest first.`;
  return `The purchases you picked cost least: about ${money(r.saving)} less federal tax than oldest first.`;
}

/** The line under a way: Tax lots' line (its gain or loss, the short- and long-term parts), in coins where it counts; a
 *  part that rounds to $0 is not named ("+$0 short-term"): the gain is then all of the other term. */
export function wayLine(o, money = dollars) {
  if (o.state === "short") return `The ones you checked hold ${coinsText(o.has)}: check more, or sell fewer.`;
  const zero = (n) => Math.abs(Number(n) || 0) < 0.5;
  const terms = new Set((o.pieces ?? []).map((p) => p.term));
  if (o.state === "ok" && terms.size > 1 && !zero(o.gain) && (zero(o.shortGain) || zero(o.longGain))) {
    const n = o.pieces.length, carry = o.carry > 0.5 ? `; ${money(o.carry)} of the loss carries to next year` : "";
    return `${o.gain >= 0 ? `A gain of ${money(o.gain)}` : `A loss of ${money(-o.gain)}`}, all of it ${zero(o.shortGain) ? "long-term" : "short-term"}, from ${n} purchases${carry}.`;
  }
  return orderLine(o, money);
}

/** Where a way sells at a loss: the wash-sale rule does not reach coins (IRC 1091 is about stock or securities; a digital
 *  asset is property, Instructions for Form 8949). Empty when no way sells at a loss. */
export function washNote(r) {
  if (!r?.orders?.some((o) => o.state === "ok" && o.loss)) return "";
  return "Coins are property, not securities: as of 2026 the wash-sale rule does not stop you buying the same coin back at once, so the loss counts in full.";
}
