// modules/investments/rebalance/trade.js -- PURE. "Try a trade" (gap list, next 60, item 50; map O22): sell an amount of
// one holding (or all of it) and buy another in the same account, and see the new mix by class beside the target, and
// the gain or loss the sale would bring, short- and long-term when the purchases (lots) are on file. Nothing is saved:
// the trade is the page's for the visit, and compute() in compute.js is not changed by any of this.
// Reads (never writes) Allocation's classes and target, Holdings' mixes, and Tax lots' own lot arithmetic.
import { compute as computeAllocation, TARGET_CLASSES } from "../allocation/compute.js";
import { ASSET_CLASSES } from "../holdings/compute.js";
import { orderLots, takeShares, washPieces, sellable, washLine } from "../tax-lots/sell.js";

const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dollars = (n) => `$${Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-US")}`;
const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
/** What a class is called when it is bought as something new ("A bond fund"), and what a sale into it says. */
export const NEW_FUND = Object.freeze({ us_stocks: "A US stocks fund", intl_stocks: "An international stocks fund", bonds: "A bond fund", cash: "Keep it as cash", real_estate: "A real estate fund (REITs)", other: "Gold, commodities or crypto" });
const NEW_WORDS = { us_stocks: "buy a US stocks fund with it", intl_stocks: "buy an international stocks fund with it", bonds: "buy a bond fund with it", cash: "keep it as cash", real_estate: "buy a real estate fund with it", other: "buy gold, commodities or crypto with it" };

/** A class in a drop-down's line, short enough not to be cut at 390 px ("FFFHX · Stocks and bonds"). */
const SHORT_CLASS = { balanced: "Stocks and bonds", real_estate: "Real estate", other: "Gold, commodities or crypto" };
const nameOf = (h) => h.symbol || h.name || "this holding";
/** An amount asked for: what shows as $0 on screen (under 50 cents, the page's money is whole dollars) is nothing asked. */
export const nothingAsked = (amount) => !(Math.round((Number(amount) || 0) * 100) / 100 >= 0.5);
/** A holding's purchases as Tax lots can read them: only records (a null or a stray value in an imported or hand-edited
 *  file is left out, as if it were not there). Anything but a list reads as none. */
const lotRecords = (lots) => (Array.isArray(lots) ? lots.filter((l) => l && typeof l === "object" && !Array.isArray(l)) : []);
const shape = (h) => ({ id: h.id, symbol: h.symbol, name: h.name, label: nameOf(h), account: h.accountName, accountId: h.accountId, bucket: h.bucket, cls: h.cls, mix: h.mix, value: h.value, price: h.price, priced: h.priced, shares: h.shares, costBasis: h.costBasis, lots: h.lots });

/** Under "Sell", for the holding picked: its name and kind in plain words ("Vanguard Total Stock Market ETF: US stocks"),
 *  or that it has no kind (so it is not in the mix). Only the kind when the name is the ticker or missing. */
export function sellNote(c) {
  if (!c) return "";
  const kind = c.cls === "unknown" ? "no kind set on Holdings, so it is not in your mix" : (SHORT_CLASS[c.cls] ?? ASSET_CLASSES[c.cls]?.label ?? "");
  const name = c.name && c.name !== c.symbol ? c.name : "";
  if (!kind) return name ? `${name}.` : "";
  return name ? `${name}: ${/^US\b/.test(kind) ? kind : kind[0].toLowerCase() + kind.slice(1)}.` : `${kind[0].toUpperCase()}${kind.slice(1)}.`;
}

/** The holdings a trade can sell: every one worth more than nothing, account by account (as Net worth lists them), the largest first. */
export function sellChoices(plan, params = {}) {
  const a = computeAllocation(plan, params);
  const order = new Map((plan.accounts ?? []).map((x, i) => [x.id, i]));
  return a.holdings.items.filter((h) => h.value > 0.005)
    .sort((x, y) => ((order.get(x.accountId) ?? 1e9) - (order.get(y.accountId) ?? 1e9)) || (y.value - x.value))
    .map(shape);
}

/** What a sale of `sellId` can buy: the same account's other holdings, then something new of each class. The money from a
 *  sale stays in its account (a sale inside a 401(k) cannot buy in a brokerage account, and the other way round). */
export function buyChoices(plan, sellId, params = {}) {
  const a = computeAllocation(plan, params);
  const s = a.holdings.items.find((h) => h.id === sellId);
  if (!s) return [];
  const same = a.holdings.items.filter((h) => h.id !== s.id && h.accountId === s.accountId && h.cls !== "unknown");
  return [
    ...same.map((h) => ({ value: h.id, label: `${nameOf(h)} · ${SHORT_CLASS[h.cls] ?? h.clsLabel}`, mix: h.mix, holding: h.id, symbol: nameOf(h) })),
    ...TARGET_CLASSES.map((c) => ({ value: `cls:${c}`, label: NEW_FUND[c], mix: { [c]: 1 }, cls: c })),
  ];
}

/** Of the money in the six classes, the share that sits in the wrong class: half the sum of each class's distance from its
 *  target (a dollar too many in one class is a dollar too few in another, counted once). */
export function offTarget(shares, target) {
  return TARGET_CLASSES.reduce((s, c) => s + Math.abs((shares[c] ?? 0) - (target[c] ?? 0)), 0) / 2;
}

const sameMix = (m1, m2) => TARGET_CLASSES.every((c) => Math.abs((m1[c] ?? 0) - (m2[c] ?? 0)) < 1e-9) && Object.keys({ ...m1, ...m2 }).every((c) => TARGET_CLASSES.includes(c));

/**
 * tryTrade(plan, { sell, amount, all, buy }, { today }) -> null when nothing is asked (no amount, or one that shows as $0:
 * `nothingAsked`), or the holding is gone, or what to buy is not in its account, else {
 *   sell: { id, label, account, bucket, value, ... }, buy: { value, label, mix, holding?, cls? }, all, asked, amount,
 *   tooMuch (more than the holding is worth: nothing else is worked out),
 *   rows: [{ cls, label, before, after, target }] (shares of the money in the six classes; target null without one of your own),
 *   hasTarget, offBefore, offAfter, mixCase: "none" | "same" | "closer" | "further" | "about",
 *   outside (the holding sold has no kind, so it is not in the mix: the sale adds its money to the mix),
 *   gain: { kind: "sheltered" | "noaccount" | "cash" | "noprice" | "lots" | "average" | "nocost", gain?, shortGain?, longGain?,
 *           pieces?, disallowed?, washedBy?, undated? }
 * }
 */
export function tryTrade(plan, trade, params = {}) {
  if (!trade || !trade.sell || !trade.buy) return null;
  const today = params.today ?? null;
  const a = computeAllocation(plan, params);
  if (!a.ready) return null;
  const h = a.holdings.items.find((x) => x.id === trade.sell && x.value > 0.005);
  if (!h) return null;
  const buy = buyChoices(plan, h.id, params).find((b) => b.value === trade.buy) ?? null;
  if (!buy) return null;
  const all = trade.all === true;
  if (!all && nothingAsked(trade.amount)) return null;
  const asked = all ? h.value : cents(trade.amount);
  const sell = shape(h);
  if (!all && asked > h.value + 0.5) return { sell, buy, all, asked, amount: 0, tooMuch: true };
  const amount = Math.min(asked, h.value);

  // the new mix: the six classes' values, less the sale by the sold holding's mix, plus the buy by what is bought's mix
  const before = Object.fromEntries(TARGET_CLASSES.map((c) => [c, a.rows.find((r) => r.cls === c)?.value ?? 0]));
  const after = { ...before };
  for (const [c, w] of Object.entries(h.mix)) if (c in after) after[c] -= amount * w;
  for (const [c, w] of Object.entries(buy.mix)) if (c in after) after[c] += amount * w;
  for (const c of TARGET_CLASSES) after[c] = Math.max(0, after[c]);
  const sum = (m) => TARGET_CLASSES.reduce((s, c) => s + m[c], 0);
  const tb = sum(before), ta = sum(after);
  const shareB = Object.fromEntries(TARGET_CLASSES.map((c) => [c, tb > 0 ? before[c] / tb : 0]));
  const shareA = Object.fromEntries(TARGET_CLASSES.map((c) => [c, ta > 0 ? after[c] / ta : 0]));
  const hasTarget = a.targetSource === "own";
  const target = hasTarget ? a.target : null;
  const rows = TARGET_CLASSES.map((c) => ({ cls: c, label: ASSET_CLASSES[c].label, before: shareB[c], after: shareA[c], target: target ? target[c] ?? 0 : null }))
    .filter((r) => r.before > 0.0005 || r.after > 0.0005 || (r.target ?? 0) > 0.0005);
  const offBefore = target ? offTarget(shareB, target) : null, offAfter = target ? offTarget(shareA, target) : null;
  const mixCase = sameMix(h.mix, buy.mix) ? "same" : !target ? "none"
    : Math.round(offAfter * 100) === Math.round(offBefore * 100) ? "about" : offAfter < offBefore ? "closer" : "further";

  const outside = !Object.keys(h.mix ?? {}).some((c) => TARGET_CLASSES.includes(c));
  return { sell, buy, all, asked, amount: cents(amount), tooMuch: false, rows, hasTarget, offBefore, offAfter, mixCase, outside, gain: gainOf(plan, h, amount, all, today) };
}

/** The gain or loss the sale brings. Inside a 401(k), IRA, Roth or HSA there is none to count (IRS Pub. 550: "The rules in
 *  this publication do not apply to investments held in individual retirement arrangements (IRAs), section 401(k) plans,
 *  and other qualified retirement plans"). In a taxable account with purchases on file, the oldest shares go first (Pub.
 *  550, "Identification not possible"), each with its own term (Tax lots' longOn) and the wash-sale rule (Tax lots'
 *  washPieces); without purchases, the whole holding's gain per dollar. */
function gainOf(plan, h, amount, all, today) {
  if (h.bucket === "none") return { kind: "noaccount" };
  if (h.bucket !== "taxable") return { kind: "sheltered" };
  if (h.cls === "cash") return { kind: "cash" };
  if (!h.priced || !(h.price > 0)) return { kind: "noprice" };
  if (lotRecords(h.lots).some((l) => (Number(l.shares) || 0) > 0)) {
    // Tax lots' own copies of every holding's lots (keyed), so the wash-sale rule leaves this sale's own lots out; read
    // from the plan with only records in each list of purchases (Tax lots reads l.shares off every entry)
    const clean = { ...plan, holdings: (plan.holdings ?? []).map((x) => (x && typeof x === "object" && "lots" in x ? { ...x, lots: lotRecords(x.lots) } : x)) };
    try {
      const world = sellable(clean, { today }).all;
      const mine = world.find((x) => x.id === h.id);
      const shares = all ? h.shares : amount / h.price;
      const { pieces } = takeShares(orderLots(mine.lots, "oldest"), shares, h.price);
      const disallowed = washPieces(pieces, h.id, world, today);
      const part = (term) => cents(pieces.filter((p) => !term || p.term === term).reduce((s, p) => s + p.gain, 0));
      return { kind: "lots", pieces, gain: part(), shortGain: part("short"), longGain: part("long"), disallowed, washedBy: pieces.flatMap((p) => p.washedBy), undated: pieces.some((p) => !p.date) };
    } catch { /* purchases this page cannot read: worked out from the whole holding's cost below, as without them */ }
  }
  if (h.costBasis > 0) return { kind: "average", gain: cents(amount * (h.value - h.costBasis) / h.value) };
  return { kind: "nocost" };
}

/** A row's two shares as the page shows them: whole percents, or one decimal when the trade moves a class by less than the
 *  rounding shows ("24.6% → 25.1%", not "25% → 25%"); the same figure twice when it does not move. */
export function shareTexts(before, after) {
  const w = (x) => `${Math.round(x * 100)}%`, d1 = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
  if (w(before) === w(after) && Math.abs(after - before) >= 0.0005) return [d1(before), d1(after)];
  return [w(before), w(after)];
}

// ---------------------------------------------------------------- the words (one written sentence per case, each tested)
/** The line over the new mix: what is tried. */
export function tradeLead(r, money = dollars) {
  if (!r || r.tooMuch) return "";
  const what = r.buy.holding ? `buy ${r.buy.symbol} with it` : NEW_WORDS[r.buy.cls];
  return r.all ? `If you sell all of ${r.sell.label} (${money(r.amount)}) and ${what}:` : `If you sell ${money(r.amount)} of ${r.sell.label} and ${what}:`;
}
/** Too much typed: what the holding is worth. */
export const tooMuchSentence = (r, money = dollars) => `${r.sell.label} is worth ${money(r.sell.value)}: type at most that, or tick “Sell all of it”.`;

/** The new mix against the target (R5: none, same, closer, further, about the same). */
export function mixSentence(r) {
  if (!r || r.tooMuch) return "";
  if (r.mixCase === "same") {
    const one = Object.keys(r.sell.mix).length === 1 ? Object.keys(r.sell.mix)[0] : null;
    const word = one ? ASSET_CLASSES[one].label.replace(/ \(.*\)$/, "") : "";
    return one ? `Both are ${/^US/.test(word) ? word : word[0].toLowerCase() + word.slice(1)}, so your mix stays the same.` : "Both hold the same mix, so yours stays the same.";
  }
  if (r.mixCase === "none") return "No target is chosen yet, so this shows your mix only: pick one on Allocation to compare.";
  if (r.mixCase === "closer") return `This trade brings your mix closer to your target: ${pct(r.offBefore)} of the money is off target now, ${pct(r.offAfter)} after.`;
  if (r.mixCase === "further") return `This trade moves your mix away from your target: ${pct(r.offBefore)} of the money is off target now, ${pct(r.offAfter)} after.`;
  return `This trade leaves your mix about as far from your target as it is now: ${pct(r.offBefore)} of the money is off target.`;
}

/** A holding with no kind sold (R5): it was not in the mix, so its money joins the mix rather than moving inside it. */
export function outsideSentence(r, money = dollars) {
  if (!r || r.tooMuch || !r.outside) return "";
  return `${r.sell.label} is not in your mix (no kind is set for it on Holdings), so selling it adds ${money(r.amount)} to the mix.`;
}

const signed = (n, money) => (n < 0 ? `−${money(-n)}` : `+${money(n)}`);
const LONG = "held over a year, so it is taxed at the lower long-term rate", SHORT = "held a year or less, so it is taxed like your pay";
/** The gain or loss from the purchases on file, in plain words (IRS Topic 409: long-term means held more than one year; "a
 *  lower tax rate may apply" to it; "net short-term capital gains are subject to taxation as ordinary income"; a loss can
 *  "lower your income"). R5: none; a gain or a loss, all long-term or all short-term; both kinds. */
function lotsSentence(g, money) {
  // a kind with no gain or loss (shares sold at what they cost) is not named: "+$0 on shares held over a year" says nothing
  const shorts = Math.abs(g.shortGain) >= 0.5, longs = Math.abs(g.longGain) >= 0.5;
  if (!shorts && !longs) return "No gain or loss on this sale.";
  const head = Math.abs(g.gain) < 0.5 ? "Selling this makes no gain or loss overall" : g.gain > 0 ? `Selling this makes a taxable gain of ${money(g.gain)}` : `Selling this makes a loss of ${money(-g.gain)}, which can lower your tax`;
  if (shorts && longs) return `${head}: ${signed(g.longGain, money)} on shares held over a year (taxed at the lower long-term rate) and ${signed(g.shortGain, money)} on shares held a year or less.`;
  if (g.gain > 0) return `${head} (${longs ? LONG : SHORT}).`;
  return `${head} (${longs ? "held over a year: a long-term loss" : "held a year or less: a short-term loss"}).`;
}

/** The gain or loss the sale brings (R5: inside a retirement account, in no investment account, cash, no price, the
 *  purchases on file (lotsSentence), the whole holding's gain, loss or neither, no cost on file). */
export function gainSentence(r, money = dollars) {
  if (!r || r.tooMuch) return "";
  const g = r.gain, sym = r.sell.label;
  if (g.kind === "sheltered") return `No tax on this sale: it is inside ${r.sell.account}, where selling costs nothing.`;
  if (g.kind === "noaccount") return `${sym} is not in an investment account on Net worth, so the tax on a sale is not known.`;
  if (g.kind === "cash") return "Cash: there is no gain or loss on spending it.";
  if (g.kind === "noprice") return `${sym} has no price on file, so the gain is not known: add one on Holdings.`;
  if (g.kind === "lots") return lotsSentence(g, money);
  if (g.kind === "average") {
    const tail = "from what the whole holding cost; when you bought these shares is not on file, so whether it counts as long- or short-term is not known.";
    if (g.gain >= 0.5) return `Selling this makes a taxable gain of about ${money(g.gain)}, ${tail}`;
    if (g.gain <= -0.5) return `Selling this makes a loss of about ${money(-g.gain)}, ${tail}`;
    return "No gain or loss on this sale, from what the whole holding cost.";
  }
  return `What ${sym} cost is not on file, so the gain is not known: add it on Holdings.`;
}
/** The lines under a gain worked from the purchases: the order, the wash-sale rule, shares without a date. */
export function gainNotes(r, money = dollars) {
  if (!r || r.tooMuch || r.gain.kind !== "lots") return [];
  const g = r.gain;
  return [
    "Worked out with the oldest shares first, which is what counts as sold unless you tell the broker otherwise.",
    washLine({ disallowed: g.disallowed, washedBy: g.washedBy }, r.sell.label, money),
    g.undated ? "Shares without a purchase date count as long-term, as on Tax lots." : "",
  ].filter(Boolean);
}
