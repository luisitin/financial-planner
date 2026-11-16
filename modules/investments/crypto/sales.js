// modules/investments/crypto/sales.js -- PURE. The answers Crypto keeps one tap away (gap list, next 60, item 46):
//   - which coins count as sold ("Which coins count as sold"): a sale of some of one coin worked three ways (the oldest
//     purchases first, what counts when you name none; the purchases that cost the most first; the purchases you pick),
//     each with its gain, its short- and long-term parts and what it does to this year's federal tax, by the Federal
//     estimate's own engine on today's return (Tax lots' helpers, imported, never copied); and the way the person's
//     exchange counts, saved as `investments.cryptoMethod`;
//   - "Sales for your tax return": recording a coin sale (the purchases it takes, by that way or the ones checked; the coins
//     come off the list and the sale goes on Capital gains as one row per purchase, each with a `coin` object holding what
//     Form 8949 needs), taking one back, and the year's coin sales laid out as Form 8949 lines, a CSV and the words.
// compute() in compute.js is not changed by any of this: the page calls these beside it.
import { compute as computeHoldings } from "../holdings/compute.js";
import { lotsOf } from "../tax-lots/compute.js";
import { ORDERS, ORDER_TITLES, orderLots, takeShares, saleRows, saleTax, lotKey, orderLine, salesYear, csvText } from "../tax-lots/sell.js";
import { todaysReturn } from "../../taxes/federal/compute.js";
import { taxView } from "../../taxes/federal/known.js";
import { toCsv } from "../../../core/csv.js";
import { cryptoKind, COINS } from "./compute.js";

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
  return walletCoins(plan, params.today ?? null).filter((x) => x.priced && x.price > 0)
    .map((x) => withNoCost({ ...base(plan, x), price: x.price, units: x.shares, value: cents(x.shares * x.price), lots: keyed(x, params.today ?? null) }));
}
/** Every coin or stablecoin in a crypto account (always a taxable account) with coins in it, priced or not (enriched). */
function walletCoins(plan, today) {
  const raw = new Map((plan.holdings ?? []).map((h) => [h.id, h]));
  return computeHoldings(plan, { today }).items.filter((x) => ["coin", "stable"].includes(cryptoKind(x)) && x.bucket === "taxable" && x.shares > 1e-12)
    .map((x) => ({ ...x, typedCost: raw.get(x.id)?.costBasis }));   // Holdings reads a blank cost as 0; this page says it is not on file
}
/** A cost typed (0 included), as against one left blank: null, undefined, "" or not a number. */
export const onFile = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const base = (plan, x) => ({ id: x.id, symbol: x.symbol, name: x.name, account: x.accountName, accountId: x.accountId, personId: (plan.accounts ?? []).find((a) => a.id === x.accountId)?.ownerId || null });
/** A holding's lots as Tax lots draws them on `day` (short or long as that day stands), keyed; `noCost` on a purchase whose
 *  cost was left blank (a typed lot's own cost; for the coins no lot covers, the holding's cost), counted at $0 as Tax lots does. */
const keyed = (x, day) => lotsOf(x, day).map((l, i) => ({ ...l, key: lotKey(l, x.id), noCost: l.assigned ? !onFile(x.lots?.[i]?.cost) : !onFile(x.typedCost) }));
/** The coins of a holding whose cost is not on file (0 when every purchase has one). */
const withNoCost = (c) => ({ ...c, noCost: fix(c.lots.filter((l) => l.noCost).reduce((s, l) => s + l.shares, 0)) });

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
  return "Coins are property, not securities: as of 2026 the wash-sale rule does not stop you buying the same coin back at once, so a loss counts in full.";
}

// =============================================================================================================================
// Sales for your tax return: recording a coin sale, taking it back, and the year's coin sales as Form 8949 lines
// =============================================================================================================================
const fix = (n) => Number((Number(n) || 0).toFixed(10));   // coins without float dust (0.1 + 0.2 - 0.3)
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** A day as the page says it: "Oct 3, 2026". */
export const dayText = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
/** A day as Form 8949 writes it: 10/03/2026. */
export const formDay = (iso) => (ISO.test(String(iso ?? "")) ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : "");
/** The coins a sale can be recorded for (a price on file is not needed: the sale says what was got). */
export const recordable = (plan, today) => walletCoins(plan, today).map((x) => withNoCost({ ...base(plan, x), units: x.shares, lots: keyed(x, today) }));

/** One satoshi: a sale of fewer coins than this is refused (the pieces stop at a billionth of a coin, so nothing would be
 *  recorded while the coins came off the list). */
export const MIN_UNITS = 1e-8;
/** A day that is on the calendar (2026-02-31 is not). */
export const realDay = (iso) => { const t = ISO.test(iso) ? new Date(`${iso}T00:00:00Z`) : null; return !!t && !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso; };

/**
 * planSale(plan, { holdingId, units, proceeds, sold, picked? }, { today }) -> the sale worked out, nothing written:
 *   { ok: true, coin, method ("oldest" | "cost" | "picked": the purchases checked, else the saved way), units, proceeds, sold,
 *     pieces: [{ lotId, acquired, units, cost, proceeds, gain, term, noCost }], gain, shortGain, longGain, noCost (the coins
 *     whose cost is not on file, counted at $0),
 *     rows: [taxes.gains rows without ids: { name, proceeds, basis, held, personId?, coin: { holding, account, symbol, units,
 *            acquired, sold, lot, noCost? } }] }
 *   or { ok: false, field, error } (one sentence per refusal).
 * The purchases a sale can take are those of that coin in that account bought on or before the sale day (undated ones count as
 * bought first, as both pages count them); short or long is as of the sale day (`lotsOf` on that day: long-term when held
 * more than a year, from the day after the purchase). Proceeds are shared out by coins, in cents, the last piece taking the
 * remainder so the pieces add up to what was got; a piece's cost is its purchase's cost per coin x its coins (Tax lots'
 * `takeShares`).
 */
export function planSale(plan, input = {}, params = {}) {
  const today = params.today ?? null;
  const year = salesYear(plan, today);
  const all = walletCoins(plan, today);
  const x = all.find((c) => c.id === input.holdingId) ?? null;
  if (!x) return { ok: false, field: "coin", error: "Choose the coin you sold." };
  const units = Number(input.units);
  if (!(units > 0)) return { ok: false, field: "units", error: "Type how many coins you sold." };
  if (units < MIN_UNITS) return { ok: false, field: "units", error: "Type at least 0.00000001 of a coin, the smallest amount this list keeps." };
  const sold = String(input.sold ?? "");
  if (!ISO.test(sold)) return { ok: false, field: "sold", error: "Type the day you sold them." };
  if (!realDay(sold)) return { ok: false, field: "sold", error: "That day is not on the calendar: check the day and the month." };
  if (today && sold > today) return { ok: false, field: "sold", error: "A sale date cannot be in the future." };
  if (Number(sold.slice(0, 4)) !== year) return { ok: false, field: "sold", error: `A sale on ${dayText(sold)} belongs on the ${sold.slice(0, 4)} return, and the Federal estimate works out ${year}: record ${year}'s sales here, or set the year on the Federal estimate.` };
  const got = input.proceeds === null || input.proceeds === undefined || input.proceeds === "" ? NaN : Number(input.proceeds);
  if (!(got >= 0)) return { ok: false, field: "proceeds", error: "Type what you got for them, in dollars." };
  const lots = keyed(x, sold).filter((l) => l.shares > 1e-12 && (!l.date || l.date <= sold));
  const held = lots.reduce((s, l) => s + l.shares, 0);
  const coin = { ...base(plan, x), units: x.shares };
  if (units > held + 1e-9) return { ok: false, field: "units", error: `${x.symbol} in ${coin.account} held ${coinsText(held)} on ${dayText(sold)}${held < x.shares - 1e-9 ? " (the rest was bought after that day)" : ""}: type at most that.` };
  let picked = Array.isArray(input.picked) ? input.picked.map(String).filter((k) => lots.some((l) => l.key === k)) : [];
  const method = picked.length ? "picked" : methodOf(plan).key;
  if (method === "picked" && !picked.length && lots.length === 1) picked = [lots[0].key];   // one purchase: nothing to check
  if (method === "picked" && !picked.length) return { ok: false, field: "picked", error: "Check the purchases you sold, under “Pick the purchases yourself”." };
  const order = orderLots(lots, method, picked);
  const { pieces: taken, left } = takeShares(order, units, got / units);
  if (left > 1e-9) return { ok: false, field: "picked", error: `The purchases you checked held ${coinsText(order.reduce((s, l) => s + l.shares, 0))}: check more, or type fewer.` };
  if (!taken.length) return { ok: false, field: "units", error: "Type how many coins you sold." };
  const total = cents(got);
  let shared = 0;
  const pieces = taken.map((p, i) => {
    const proceeds = i === taken.length - 1 ? cents(total - shared) : p.proceeds;
    shared = cents(shared + proceeds);
    return { lotId: p.lot.id ?? null, acquired: p.lot.date ?? null, units: fix(p.shares), cost: p.cost, proceeds, gain: cents(proceeds - p.cost), term: p.term, noCost: !!p.lot.noCost };
  });
  const coinsOut = (list) => fix(list.reduce((s, p) => s + p.units, 0));
  const sum = (term) => cents(pieces.filter((p) => !term || p.term === term).reduce((s, p) => s + p.gain, 0));
  const rows = pieces.map((p) => ({ name: `${unitsText(p.units)} ${x.symbol}`, proceeds: p.proceeds, basis: p.cost, held: p.term, ...(coin.personId ? { personId: coin.personId } : {}),
    coin: { holding: x.id, account: x.accountId, symbol: x.symbol, units: p.units, acquired: p.acquired, sold, lot: p.lotId, ...(p.noCost ? { noCost: true } : {}) } }));
  // the coins sold are the pieces' (what applySale takes off and removeSale puts back, to the last of the ten places)
  return { ok: true, coin, method, units: coinsOut(pieces), proceeds: total, sold, pieces, gain: sum(), shortGain: sum("short"), longGain: sum("long"), noCost: coinsOut(pieces.filter((p) => p.noCost)), rows };
}

/** A crypto account's balance follows its coins (shares x price) once a sale or a sale taken back changes them. */
export function syncWallets(draft, today, ids = null) {
  for (const a of (draft.accounts ?? []).filter((x) => x.type === "crypto" && (!ids || ids.includes(x.id)))) {
    const mine = (draft.holdings ?? []).filter((h) => h.accountId === a.id);
    a.balance = cents(mine.reduce((s, h) => s + (Number(h.shares) || 0) * (Number(h.price) || 0), 0));
    if (today) a.asOf = today;
  }
}

/**
 * applySale(draft, sale, saleId, today): writes a sale planSale worked out. Each purchase taken loses its coins and their
 * cost (a purchase emptied goes); the holding loses the coins and their cost (a holding sold out goes); the rows go on the
 * year's sales (taxes.gains) with ids `<saleId>-1`, `-2` ... and `coin.sale` = saleId; the account's balance follows its coins.
 */
export function applySale(draft, sale, saleId, today = null) {
  const h = (draft.holdings ?? []).find((y) => y.id === sale?.coin?.id);
  if (!h || !sale.rows?.length) return false;   // a sale with no rows would take coins off with nothing to put them back from
  for (const p of sale.pieces) {
    if (!p.lotId) continue;
    const l = (h.lots ?? []).find((y) => y.id === p.lotId);
    if (!l) continue;
    l.shares = fix(l.shares - p.units);
    if (onFile(l.cost)) l.cost = cents(Number(l.cost) - p.cost);   // a cost left blank stays blank
  }
  h.lots = (h.lots ?? []).filter((l) => !(fix(l.shares) <= 1e-12 && sale.pieces.some((p) => p.lotId === l.id)));
  h.shares = fix((Number(h.shares) || 0) - sale.units);
  if (onFile(h.costBasis)) h.costBasis = cents(Math.max(0, Number(h.costBasis) - sale.pieces.reduce((s, p) => s + p.cost, 0)));
  if (h.shares <= 1e-12) draft.holdings = draft.holdings.filter((y) => y !== h);
  draft.taxes = draft.taxes ?? {};
  draft.taxes.gains = [...(draft.taxes.gains ?? []), ...sale.rows.map((r, i) => ({ id: `${saleId}-${i + 1}`, ...r, coin: { sale: saleId, ...r.coin } }))];
  syncWallets(draft, today, [sale.coin.accountId]);
  return true;
}

/**
 * removeSale(draft, saleId, today): takes a recorded sale back (Undo, and "Remove this sale"): its rows leave the year's
 * sales and their coins and cost go back to their purchase (put back in date order when it had gone) and holding (made
 * again, at the sale's price on its day, when it had gone). Returns false when there is no such sale.
 */
export function removeSale(draft, saleId, today = null) {
  const rows = (draft.taxes?.gains ?? []).filter((g) => g?.coin?.sale === saleId);
  if (!rows.length) return false;
  const accounts = new Set();
  for (const r of rows) {
    const c = r.coin, units = Number(c.units) || 0, cost = Number(r.basis) || 0;
    draft.holdings = draft.holdings ?? [];
    let h = draft.holdings.find((y) => y.id === c.holding);
    // made again: its cost blank when the coins no purchase covered had none on file
    if (!h) { h = { id: c.holding, accountId: c.account, symbol: c.symbol, name: COINS[c.symbol] ?? "", shares: 0, price: units > 0 ? cents((Number(r.proceeds) || 0) / units) : 0, priceAsOf: c.sold, costBasis: rows.some((y) => y.coin.holding === c.holding && y.coin.noCost && !y.coin.lot) ? null : 0, assetClass: "other", expenseRatio: null, yield: null, lots: [] }; draft.holdings.push(h); }
    h.shares = fix((Number(h.shares) || 0) + units);
    if (onFile(h.costBasis)) h.costBasis = cents(Number(h.costBasis) + cost);
    if (c.lot) {
      h.lots = h.lots ?? [];
      const l = h.lots.find((y) => y.id === c.lot);
      if (l) { l.shares = fix(l.shares + units); if (onFile(l.cost)) l.cost = cents(Number(l.cost) + cost); }
      else {
        const back = { id: c.lot, date: c.acquired ?? null, shares: units, cost: c.noCost ? null : cost };
        const at = h.lots.findIndex((y) => back.date && (!y.date ? false : y.date > back.date));
        if (!back.date) h.lots.unshift(back); else if (at < 0) h.lots.push(back); else h.lots.splice(at, 0, back);
      }
    }
    accounts.add(h.accountId);
  }
  draft.taxes.gains = draft.taxes.gains.filter((g) => g?.coin?.sale !== saleId);
  syncWallets(draft, today, [...accounts]);
  return true;
}

/**
 * coinSales(plan, { today }) -> the year's coin sales recorded here (taxes.gains rows with a `coin`, sold in the Federal
 * estimate's year), as Form 8949 lines (Instructions for Form 8949 (2025): (a) the units and the symbol, (b) the date
 * acquired, (c) the date sold, (d) proceeds, (e) cost, (h) gain or loss; short-term on Part I, long-term on Part II):
 *   { year, separate, lines: [{ id, sale, description, symbol, units, acquired, sold, proceeds, cost, gain, term, personId, noCost }],
 *     sales: [{ id, symbol, units, sold, proceeds, cost, gain, lines }] (newest first), count, shortTotal, longTotal,
 *     elsewhere (coin sales on Capital gains dated in another year) }
 * The figures are each row's as it stands on Capital gains (an edit there shows here).
 */
export function coinSales(plan, params = {}) {
  const year = salesYear(plan, params.today ?? null);
  const all = (plan.taxes?.gains ?? []).filter((g) => g && g.coin && typeof g.coin === "object" && ISO.test(String(g.coin.sold ?? "")));
  const mine = all.filter((g) => Number(g.coin.sold.slice(0, 4)) === year);
  const lines = mine.map((g) => {
    const proceeds = cents(g.proceeds), cost = cents(g.basis), units = Number(g.coin.units) || 0;
    // a hand-edited row: a coin with no symbol reads "coin" (never "undefined"); a day bought that is not on the calendar
    // (2026-13-45) is a day not on file, as the screen, the spreadsheet and the file for tax software then say
    const symbol = typeof g.coin.symbol === "string" && g.coin.symbol.trim() ? g.coin.symbol : "coin";
    return { id: g.id, sale: g.coin.sale ?? g.id, description: `${unitsText(units)} ${symbol}`, symbol, units, acquired: realDay(g.coin.acquired) ? g.coin.acquired : null, sold: g.coin.sold, proceeds, cost, gain: cents(proceeds - cost), term: g.held === "long" ? "long" : "short", personId: g.personId ?? null, noCost: g.coin.noCost === true };
  }).sort((a, b) => (a.sold < b.sold ? -1 : a.sold > b.sold ? 1 : 0));
  const bySale = new Map();
  for (const l of lines) { if (!bySale.has(l.sale)) bySale.set(l.sale, []); bySale.get(l.sale).push(l); }
  const sales = [...bySale.entries()].map(([id, ls]) => ({ id, symbol: ls[0].symbol, units: fix(ls.reduce((s, l) => s + l.units, 0)), sold: ls[0].sold, proceeds: cents(ls.reduce((s, l) => s + l.proceeds, 0)), cost: cents(ls.reduce((s, l) => s + l.cost, 0)), gain: cents(ls.reduce((s, l) => s + l.gain, 0)), lines: ls })).reverse();
  const total = (term) => cents(lines.filter((l) => l.term === term).reduce((s, l) => s + l.gain, 0));
  return { year, separate: (plan.household?.filingStatus ?? "") === "married_separate", lines, sales, count: sales.length, shortTotal: total("short"), longTotal: total("long"), elsewhere: all.length - mine.length };
}

/** What the year's coin sales come to (R5: five cases, the first the empty one). */
export function coinSalesSentence(s, money = dollars) {
  if (!s.count) return `No coin sales recorded for ${s.year} yet. When you sell, record it here: the coins come off your list, the sale counts in your tax estimate, and the list is ready for your tax preparer.`;
  const kind = (n, term) => (n >= 0 ? `a ${term} gain of ${money(n)}` : `a ${term} loss of ${money(-n)}`);
  const st = Math.abs(s.shortTotal) > 0.5, lt = Math.abs(s.longTotal) > 0.5;
  if (st && lt) return `Your ${s.year} coin sales: ${kind(s.shortTotal, "short-term")} and ${kind(s.longTotal, "long-term")}.`;
  if (st) return `Your ${s.year} coin sales: ${kind(s.shortTotal, "short-term")}.`;
  if (lt) return `Your ${s.year} coin sales: ${kind(s.longTotal, "long-term")}.`;
  return `Your ${s.year} coin sales come out even: no gain or loss.`;
}

/** Coin sales dated in another year, still on Capital gains (empty when there are none). */
export function elsewhereSentence(s) {
  if (!s.elsewhere) return "";
  return `${s.elsewhere === 1 ? "One coin sale" : `${s.elsewhere} coin sales`} dated outside ${s.year} ${s.elsewhere === 1 ? "is" : "are"} still on Capital gains, where the Federal estimate counts ${s.elsewhere === 1 ? "it" : "them"} as ${s.year}'s: remove ${s.elsewhere === 1 ? "it" : "them"} there once that year's return is done.`;
}

const signed = (n, money) => (n < 0 ? `−${money(-n)}` : `+${money(n)}`);
const zero = (n) => Math.abs(Number(n) || 0) < 0.5;   // a part that shows as $0 is not named ("+$0 short-term")
/** The green line after a sale is recorded (R7: it names the answer). */
export function recordedSentence(sale, money = dollars) {
  const way = { oldest: "oldest first", cost: "highest cost first", picked: "the purchases you checked" }[sale.method];
  const shorts = sale.pieces.some((p) => p.term === "short"), longs = sale.pieces.some((p) => p.term === "long");
  const gl = sale.gain >= 0 ? `a gain of ${money(sale.gain)}` : `a loss of ${money(-sale.gain)}`;
  const what = Math.abs(sale.gain) < 0.005 && Math.abs(sale.shortGain) < 0.005 ? "no gain or loss"
    : shorts && longs && !zero(sale.shortGain) && !zero(sale.longGain) ? `${gl} (${signed(sale.shortGain, money)} short-term, ${signed(sale.longGain, money)} long-term)`
    : shorts && longs ? `${gl}, all of it ${zero(sale.shortGain) ? "long-term" : "short-term"}`
    : `${gl}, ${shorts ? "short-term" : "long-term"}`;
  return `Recorded: ${unitsText(sale.units)} ${sale.coin.symbol} sold ${dayText(sale.sold)} for ${money(sale.proceeds)}, ${way}: ${what}. It is now in this year's gains for your tax estimate.`;
}
/** Under the green line when what was paid for some of the coins sold is not on file (counted as $0; empty otherwise). */
export function costNote(sale, money = dollars) {
  if (!(sale.noCost > 0)) return "";
  const which = sale.noCost >= sale.units - 1e-9 ? `the ${unitsText(sale.units)} ${sale.coin.symbol} is not on file, so the whole ${money(sale.proceeds)} counts as gain`
    : `${unitsText(sale.noCost)} of the ${unitsText(sale.units)} ${sale.coin.symbol} is not on file, so it counts as $0`;
  return `What you paid for ${which}. If you know it, tap Undo, add it on Holdings, then record the sale again.`;
}
/** Above a sale's form, and under the ways, when what was paid for some of a coin is not on file (empty otherwise). */
export function costMissing(c) {
  if (!(c?.noCost > 0)) return "";
  if (c.noCost >= c.units - 1e-9) return `What you paid for this ${c.symbol} is not on file, so a sale of it counts as all gain: add it on Holdings first, if you know it.`;
  return `What you paid for ${coinsText(c.noCost)} of this ${c.symbol} is not on file, so selling those counts as all gain: add it on Holdings first, if you know it.`;
}
/** Where the money from a sale is: not in the plan until the person adds it. */
export const moneyNote = (sale, money = dollars) => `The ${money(sale.proceeds)} you got is not added to any account here: add it to the account it went to.`;
/** The line under one Form 8949 line on screen. */
export const lineText = (l, money = dollars) => `${unitsText(l.units)} bought ${l.acquired ? dayText(l.acquired) : "on a day not on file"}: sold for ${money(l.proceeds)}, cost ${l.noCost ? "not on file (counted as $0)" : money(l.cost)}, ${zero(l.gain) ? "no gain or loss," : signed(l.gain, money)} ${l.term === "long" ? "long-term" : "short-term"}`;
/** On screen, above the file and the printout: plain words; the form's details are on the printout, for the preparer. */
export const FORM_SCREEN = "For your tax preparer: print this list (the printout also says where each line goes on the form) or save it as a spreadsheet. It is not a filing.";
/** The printout's note for the preparer: fees, proceeds and the form's boxes (Instructions for Form 8949 (2025), column (d)
 *  and code E, boxes G to L; Instructions for Form 1099-DA (2026), box 1f and the "Applicable checkbox on Form 8949"; read 2026-11-16). */
export const FORM_NOTE = "“Sold for” is what was got after the exchange's fee. A Form 1099-DA shows proceeds with the fee already taken out: use its amount, and adjust (code E) only for a fee it leaves out. Short-term lines go on Part I of Form 8949 and long-term lines on Part II, in the digital-asset boxes: the one the 1099-DA names in its “Applicable checkbox on Form 8949” (G, H, J or K), or I or L for a sale with no 1099-DA. This list is information for the preparer, not a filing.";

/** The columns of the file, in Form 8949's order (Instructions for Form 8949 (2025): (a), (b), (c), (d), (e), (h)) and in plain words. */
export const FORM_HEADERS = Object.freeze(["What was sold", "Date bought", "Date sold", "Sold for", "Cost", "Gain or loss", "Short or long term"]);
/** The year's coin sales as CSV text (core/csv.js; Tax lots' `csvText` guards a typed symbol a spreadsheet would run as a
 *  formula): one row per Form 8949 line, dates as the form writes them (MM/DD/YYYY; "unknown" when the purchase has no date),
 *  money with two decimals and no $ sign; "Whose" is added when filing separately and a line names its owner, and "Note"
 *  when a line's cost is not on file (that line: "cost not on file, counted as 0"). */
export const NO_COST_NOTE = "cost not on file, counted as 0";
export function form8949Csv(s, plan = null) {
  const people = new Map((plan?.household?.people ?? []).map((p) => [p.id, p.name]));
  const whose = s.separate && s.lines.some((l) => l.personId);
  const note = s.lines.some((l) => l.noCost);
  const n2 = (v) => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
  const rows = s.lines.map((l) => [csvText(l.description), l.acquired ? formDay(l.acquired) : "unknown", formDay(l.sold), n2(l.proceeds), n2(l.cost), n2(l.gain), l.term === "long" ? "long-term" : "short-term",
    ...(whose ? [csvText(l.personId ? people.get(l.personId) ?? "" : "both")] : []), ...(note ? [l.noCost ? NO_COST_NOTE : ""] : [])]);
  return toCsv([...FORM_HEADERS, ...(whose ? ["Whose"] : []), ...(note ? ["Note"] : [])], rows);
}

/** The line above "Record the sale": which purchases the sale will take. */
export function recordWay(m) {
  if (m.key === "cost") return "Counted highest cost first, the way you chose, unless you check the purchases you sold.";
  if (m.key === "picked") return "Check the purchases you sold under “Pick the purchases yourself”, the way you chose.";
  return "Counted oldest first (first in, first out), unless you check the purchases you sold.";
}
/** What the page asks before it takes a recorded sale back, and what it says after (and after Undo). */
export const removeAsk = (s) => `Remove the sale of ${unitsText(s.units)} ${s.symbol} on ${dayText(s.sold)}? It comes off Capital gains and its coins go back on your list.`;
export const removedSaid = (s) => `Sale removed: ${unitsText(s.units)} ${s.symbol} back on your list and off Capital gains.`;
export const UNDONE_SALE = "Undone: the sale is off Capital gains and its coins are back on your list.";
