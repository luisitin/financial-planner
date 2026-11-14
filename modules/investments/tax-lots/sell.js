// modules/investments/tax-lots/sell.js -- PURE. Two answers the Tax lots page keeps one tap away (gap list items 54 and 7):
//   - which shares to sell first ("Compare ways to sell part of a fund"): a sale of part of one fund worked two ways (the
//     oldest shares first, what the IRS uses when you do not name the shares; the shares that cost the most first) and a
//     third once the person checks purchases (the ones you pick), each with its gain, its short- and long-term parts and
//     what it does to this year's federal tax, worked by the Federal estimate's own engine on today's return;
//   - this year's sales for the tax return: the sales the plan records (taxes.gains, typed on Capital gains), their
//     short- and long-term totals as Capital gains and the Federal estimate count them, and the list as a CSV for a tax
//     preparer (Form 8949's columns that the plan holds, in plain words).
// compute() in compute.js is not changed by any of this: the page calls these beside it.
import { compute as computeHoldings } from "../holdings/compute.js";
import { compute as capitalGains } from "../../taxes/capital-gains/compute.js";
import { lossCarryover, todaysReturn } from "../../taxes/federal/compute.js";
import { taxView } from "../../taxes/federal/known.js";
import { lotsOf, washSales, shareText } from "./compute.js";
import { toCsv } from "../../../core/csv.js";

/** The three ways, in the order the page shows them (and the order that wins a tie: the default needs no word to the broker). */
export const ORDERS = Object.freeze(["oldest", "cost", "picked"]);
export const ORDER_TITLES = Object.freeze({ oldest: "Oldest first", cost: "Highest cost first", picked: "The ones you pick" });
const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dollars = (n) => `$${Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-US")}`;

/** The key a lot is picked by: its id, or "rest:<holding id>" for the shares no typed lot covers. */
export const lotKey = (lot, holdingId) => lot.id ?? `rest:${holdingId}`;

/**
 * The lots of one fund in the order a sale takes them.
 *   oldest: what the IRS uses when you cannot name the shares (Pub. 550, "the basis of the securities you acquired first");
 *           a lot without a date (the shares no lot covers too) counts as bought first, as the page counts it long-term;
 *           then by date; the same date keeps the order typed
 *   cost:   the most paid per share first (the smallest gain or the biggest loss on each share sold); the same cost per
 *           share, the oldest first
 *   picked: the ticked lots only (keys), the oldest first
 */
export function orderLots(lots, order, picked = []) {
  const at = new Map(lots.map((l, i) => [l, i]));
  const byAge = (a, b) => (a.date ? 1 : 0) - (b.date ? 1 : 0) || (a.date && b.date && a.date !== b.date ? (a.date < b.date ? -1 : 1) : 0) || at.get(a) - at.get(b);
  const live = lots.filter((l) => (Number(l.shares) || 0) > 1e-12);
  if (order === "cost") return [...live].sort((a, b) => (Math.abs(b.costPerShare - a.costPerShare) > 1e-9 ? b.costPerShare - a.costPerShare : byAge(a, b)));
  if (order === "picked") { const set = new Set(picked); return live.filter((l) => set.has(l.key)).sort(byAge); }
  return [...live].sort(byAge);
}

/** `shares` taken from lots in the order given -> { pieces: [{ key, lot, date, term, shares, cost, proceeds, gain }], left }.
 *  A piece's cost is its lot's cost per share x the shares taken (the whole lot's cost when all of it goes); proceeds are
 *  the price x the shares; both in cents. `left` is what the lots could not cover. */
export function takeShares(lots, shares, price) {
  const pieces = [];
  let need = Math.max(0, Number(shares) || 0);
  for (const l of lots) {
    if (need <= 1e-9) break;
    const n = Math.min(need, l.shares);
    if (n <= 0) continue;
    const whole = n >= l.shares - 1e-12;
    const cost = cents(whole ? l.cost : l.costPerShare * n), proceeds = cents(price * n);
    pieces.push({ key: l.key, lot: l, date: l.date ?? null, term: l.term, shares: n, cost, proceeds, gain: cents(proceeds - cost), disallowed: 0, washedBy: [] });
    need -= n;
  }
  return { pieces, left: need > 1e-9 ? need : 0 };
}

/**
 * Wash sales on the pieces of one sale (the page's washSales, IRC 1091(a)): each piece sold at a loss is a sold lot; the
 * replacements are the same fund's other purchases dated in the 30 days before today, in any account, an IRA too. Every
 * lot this sale touches is left out of the replacements: a piece sold at a gain is sold, not bought, and the rest of a
 * purchase partly sold is not counted as a replacement for the part sold (the page's convention; no source read says).
 * Sets `disallowed` and `washedBy` on each loss piece; returns the disallowed total.
 */
export function washPieces(pieces, holdingId, holdings, today) {
  const loss = pieces.filter((p) => p.gain < -0.005);
  if (!loss.length || !today) return 0;
  const touched = new Set(pieces.map((p) => p.lot));
  const sold = loss.map((p) => ({ date: p.date, shares: p.shares }));
  const world = holdings.map((y) => ({ symbol: y.symbol, account: y.account, bucket: y.bucket, lots: [...y.lots.filter((l) => !touched.has(l)), ...(y.id === holdingId ? sold : [])] }));
  const cands = loss.map((p, i) => ({ lot: sold[i], loss: -p.gain }));
  washSales(cands, world, today);
  loss.forEach((p, i) => { p.disallowed = cents(cands[i].disallowed); p.washedBy = cands[i].washedBy.map(({ lot: _l, ...m }) => m); });
  return cents(loss.reduce((s, p) => s + p.disallowed, 0));
}

/** The sale rows a set of pieces adds to the year's return: one per term, the allowed loss only (a disallowed loss is not
 *  a loss this year), on the account owner's return when filing separately. */
export function saleRows(pieces, personId = null) {
  const rows = [];
  for (const held of ["short", "long"]) {
    const mine = pieces.filter((p) => p.term === held);
    if (!mine.length) continue;
    const proceeds = cents(mine.reduce((s, p) => s + p.proceeds, 0)), basis = cents(mine.reduce((s, p) => s + p.cost - p.disallowed, 0));
    rows.push({ id: `sell-${held}`, name: "this sale", proceeds, basis, held, ...(personId ? { personId } : {}) });
  }
  return rows;
}

/** What `rows` do to this year's federal tax: the Federal estimate's return for today's tax year (todaysReturn: the year a
 *  sale today falls in, with that year's other sales) with the rows added, less without; and the loss they add to next
 *  year's carryover. `base` (the return without them, from taxView) can be passed to save working it again. */
export function saleTax(plan, rows, params = {}, base = null) {
  const yr = todaysReturn(plan, params.today ?? null);
  const t0 = base ?? taxView(yr.plan, params);
  const c0 = lossCarryover(t0, t0.result);
  if (!rows.length) return { tax: 0, carry: 0, year: yr.year, otherYear: yr.other };
  const p2 = { ...yr.plan, taxes: { ...(yr.plan.taxes ?? {}), gains: [...(yr.plan.taxes?.gains ?? []), ...rows] } };
  const t1 = taxView(p2, params), c1 = lossCarryover(t1, t1.result);
  return { tax: cents(t1.result.totalTax - t0.result.totalTax), carry: cents(Math.max(0, c1.total - c0.total)), year: yr.year, otherYear: yr.other };
}

/** A fund with two or more purchases (lots with shares; the shares no typed lot covers count as one): the ways to sell part
 *  of it can differ. A fund of one purchase sells the same shares every way. */
export const hasChoice = (x) => (x?.lots ?? []).filter((l) => (Number(l.shares) || 0) > 1e-12).length > 1;

/** The funds a sale can be worked for: in a taxable account, with a price above 0 (a price of 0 gives no dollar amount to
 *  work from), shares and not cash. Each with its lots (keyed). */
export function sellable(plan, params = {}) {
  const today = params.today ?? null;
  const h = computeHoldings(plan, params);
  const ownerOf = new Map((plan.accounts ?? []).map((a) => [a.id, a.ownerId || null]));
  const all = h.items.map((x) => ({ id: x.id, symbol: x.symbol, name: x.name, account: x.accountName, accountId: x.accountId, bucket: x.bucket, cls: x.cls, priced: x.priced, price: x.price, shares: x.shares, personId: ownerOf.get(x.accountId) ?? null,
    lots: lotsOf(x, today).map((l) => ({ ...l, key: lotKey(l, x.id) })) }));
  const eligible = all.filter((x) => x.bucket === "taxable" && x.priced && x.price > 0 && x.shares > 1e-9 && x.cls !== "cash").map((x) => ({ ...x, value: cents(x.shares * x.price) }));
  return { all, eligible };
}

/**
 * sellOrders(plan, { today, ask? }) -> {
 *   eligible: [{ id, symbol, account, price, shares, value, lots }], holding (the fund asked about, else the first with two
 *   or more purchases, else the first), ask (the
 *   saved or given question, null when none), shares (to sell), proceeds, tooMany, year, otherYear,
 *   orders: [{ key, state: "ok" | "none" (nothing ticked) | "short" (the ticked lots hold too few: `has`), pieces, gain,
 *              shortGain, longGain, disallowed, washedBy, tax (the change in this year's federal tax), carry }],
 *   least (the key of the way that costs least; ties to the oldest first, then the highest cost), saving (oldest's tax less the least)
 * }
 * ask = { holdingId, by: "shares" | "dollars", amount, picked: [lot keys] }, read from plan.whatIfs.taxLots when not given.
 */
export function sellOrders(plan, params = {}) {
  const today = params.today ?? null, tp = { today };
  const { all, eligible } = sellable(plan, tp);
  const raw = params.ask ?? plan.whatIfs?.taxLots ?? null;
  // a question about a fund no longer on the plan (sold, moved to a retirement account) is not answered for another fund
  const found = raw ? eligible.find((x) => x.id === raw.holdingId) ?? null : null;
  const holding = found ?? eligible.find(hasChoice) ?? eligible[0] ?? null;
  const amount = Number(raw?.amount);
  const ask = found && amount > 0 ? { holdingId: found.id, by: raw.by === "dollars" ? "dollars" : "shares", amount, picked: Array.isArray(raw.picked) ? raw.picked.map(String) : [] } : null;
  const out = { eligible, holding, ask, shares: 0, proceeds: 0, tooMany: false, year: null, otherYear: null, orders: [], least: null, saving: 0 };
  if (!ask) return out;
  const shares = ask.by === "dollars" ? ask.amount / holding.price : ask.amount;
  out.shares = shares; out.proceeds = cents(shares * holding.price);
  if (shares > holding.shares + 1e-9) { out.tooMany = true; return out; }
  const yr = todaysReturn(plan, today);
  const base = taxView(yr.plan, tp);
  out.year = yr.year; out.otherYear = yr.other;
  for (const key of ORDERS) {
    const lots = orderLots(holding.lots, key, ask.picked);
    if (key === "picked" && !lots.length) { out.orders.push({ key, state: "none", pieces: [], has: 0 }); continue; }
    const { pieces, left } = takeShares(lots, shares, holding.price);
    if (left > 1e-9) { out.orders.push({ key, state: "short", pieces: [], has: lots.reduce((s, l) => s + l.shares, 0) }); continue; }
    const disallowed = washPieces(pieces, holding.id, all, today);
    const sum = (term) => cents(pieces.filter((p) => !term || p.term === term).reduce((s, p) => s + p.gain, 0));
    const t = saleTax(plan, saleRows(pieces, holding.personId), tp, base);
    out.orders.push({ key, state: "ok", pieces, gain: sum(), shortGain: sum("short"), longGain: sum("long"), disallowed, washedBy: pieces.flatMap((p) => p.washedBy), tax: t.tax, carry: t.carry });
  }
  const ok = out.orders.filter((o) => o.state === "ok");
  const least = ok.reduce((a, o) => (!a || o.tax < a.tax - 0.5 ? o : a), null);
  out.least = least?.key ?? null;
  out.saving = least ? cents(out.orders.find((o) => o.key === "oldest").tax - least.tax) : 0;
  return out;
}

// ---------------------------------------------------------------- the words (one written sentence per case, each tested)
/** Which way costs least, and by how much (R5: eight cases, each tested). */
export function leastSentence(r, money = dollars) {
  if (!r?.holding || !r.ask) return "";
  if (r.tooMany) return `${r.holding.symbol} has ${shareText(r.holding.shares)} shares (worth ${money(r.holding.value)}): sell at most that.`;
  const ok = r.orders.filter((o) => o.state === "ok");
  if (!ok.length) return "";
  const lo = Math.min(...ok.map((o) => o.tax)), hi = Math.max(...ok.map((o) => o.tax));
  if (hi - lo < 0.5) {
    if (lo >= 0.5) return `Whichever way you sell, it adds about ${money(lo)} to your federal tax: here the order makes no difference.`;
    if (lo <= -0.5) return `Whichever way you sell, it takes about ${money(-lo)} off your federal tax: here the order makes no difference.`;
    return "There is no federal tax to pay whichever way you sell: here the order makes no difference.";
  }
  const win = ok.find((o) => o.key === r.least);
  if (win.key === "oldest") {
    const next = Math.min(...ok.filter((o) => o.key !== "oldest").map((o) => o.tax));
    if (next - win.tax < 0.5) return "Selling the oldest shares first costs least, as little as another way, and it is what counts as sold unless you tell the broker otherwise.";
    return `Selling the oldest shares first costs least, about ${money(next - win.tax)} less federal tax than the next best way, and it is what counts as sold unless you tell the broker otherwise.`;
  }
  if (win.key === "cost") return `Selling the shares that cost the most first costs least: about ${money(r.saving)} less federal tax than the oldest first.`;
  return `Selling the purchases you picked costs least: about ${money(r.saving)} less federal tax than the oldest first.`;
}

/** The figure beside a way: what the sale does to this year's federal tax, against not selling ("$1,500 of tax", "saves $450
 *  of tax", "no tax"). */
export function orderValue(o, money = dollars) {
  if (o.state !== "ok") return "";
  if (o.tax >= 0.5) return `${money(o.tax)} of tax`;
  if (o.tax <= -0.5) return `saves ${money(-o.tax)} of tax`;
  return "no tax";
}

const signed = (n, money) => (n < 0 ? `−${money(-n)}` : `+${money(n)}`);
/** The line under a way: its gain or loss and the short- and long-term parts, or why it cannot be worked. */
export function orderLine(o, money = dollars) {
  if (o.state === "none") return "Check the purchases to sell under “Pick the purchases yourself” to see this way too.";
  if (o.state === "short") return `The ones you checked hold ${shareText(o.has)} shares: check more, or sell fewer.`;
  const n = o.pieces.length, from = n === 1 ? "from one purchase" : `from ${n} purchases`;
  const carry = o.carry > 0.5 ? `; ${money(o.carry)} of the loss carries to next year` : "";
  if (Math.abs(o.gain) < 0.005 && Math.abs(o.shortGain) < 0.005) return `No gain or loss, ${from}.`;
  const what = o.gain >= 0 ? `A gain of ${money(o.gain)}` : `A loss of ${money(-o.gain)}`;
  const shorts = o.pieces.some((p) => p.term === "short"), longs = o.pieces.some((p) => p.term === "long");
  if (shorts && longs) return `${what} (${signed(o.shortGain, money)} short-term, ${signed(o.longGain, money)} long-term), ${from}${carry}.`;
  return `${what}, all ${shorts ? "short-term" : "long-term"}, ${from}${carry}.`;
}

/** What a recent purchase does to a way's loss (the wash-sale rule): put off and added to the new shares' cost, or, when the
 *  purchase is in a retirement account, lost for good (Rev. Rul. 2008-5). Empty when nothing is disallowed. */
export function washLine(o, symbol, money = dollars) {
  if (!(o.disallowed > 0.5)) return "";
  const ira = (o.washedBy ?? []).some((m) => m.bucket !== "taxable"), taxable = (o.washedBy ?? []).some((m) => m.bucket === "taxable");
  if (ira && !taxable) return `${money(o.disallowed)} of this loss is lost for good: you bought more ${symbol} in a retirement account in the last 30 days (the wash-sale rule).`;
  if (ira) return `${money(o.disallowed)} of this loss does not count: you bought more ${symbol} in the last 30 days (the wash-sale rule); the part matched by a retirement account's purchase is lost for good.`;
  return `${money(o.disallowed)} of this loss does not count yet: you bought more ${symbol} in the last 30 days (the wash-sale rule). It is added to the cost of those shares.`;
}

// ---------------------------------------------------------------- this year's sales
/**
 * yearSales(plan, { today }) -> { year, rows: [{ id, name, proceeds, basis, held, gain, personId? }], hasSales, shortTotal,
 *   longTotal (each kind's total before netting), netShort, netLong, netLoss, lossAllowed (after netting: what the Federal
 *   estimate counts), carry (the loss carried to next year, Pub. 550 Worksheet 4-1), separate }
 * Read from Capital gains' own compute, so the two pages and the Federal estimate count the same sales the same way.
 */
export function yearSales(plan, params = {}) {
  const c = capitalGains(plan, { today: params.today ?? null });
  const g = c.gains;
  return { year: c.year, rows: c.rows, hasSales: c.hasSales, shortTotal: cents(g.shortTotal), longTotal: cents(g.longTotal), netShort: cents(g.netShort), netLong: cents(g.netLong),
    netLoss: cents(g.netLoss), lossAllowed: cents(g.lossAllowed), carry: g.netLoss < 0 ? cents(g.carryover?.total ?? -(g.carryForward ?? 0)) : 0, separate: c.filingStatus === "married_separate" };
}

/** The tax year the year's sales are for: the Federal estimate's (taxes.year), else today's (as taxInputs reads it). */
export const salesYear = (plan, today) => Number(plan.taxes?.year) || (today ? Number(String(today).slice(0, 4)) : new Date().getFullYear());

/** What the year's sales count for (R5: seven cases, the first the empty one). */
export function salesSentence(s, money = dollars) {
  if (!s.hasSales) return `No sales are recorded for ${s.year} yet. When you sell, add the sale on Capital gains: what it sold for, what it cost and how long you held it. It then shows here with the year's short-term and long-term totals, as a list for your tax preparer that you can save or print.`;
  if (s.netLoss < -0.5) {
    if (s.carry > 0.5) return `A net loss of ${money(-s.netLoss)} for ${s.year}: ${money(-s.lossAllowed)} comes off your other income and ${money(s.carry)} carries to next year.`;
    return `A net loss of ${money(-s.netLoss)} for ${s.year}: all of it comes off your other income.`;
  }
  const st = s.netShort > 0.5, lt = s.netLong > 0.5;
  if (st && lt) return `After losses cancel gains, the Federal estimate counts ${money(s.netShort)} of short-term gain and ${money(s.netLong)} of long-term gain for ${s.year}.`;
  if (st) return `After losses cancel gains, the Federal estimate counts ${money(s.netShort)} of short-term gain for ${s.year}, taxed like pay.`;
  if (lt) return `After losses cancel gains, the Federal estimate counts ${money(s.netLong)} of long-term gain for ${s.year}, at the lower rates for gains.`;
  return `Your ${s.year} sales break even: no gain or loss to count.`;
}

/** The line under one sale in the list. */
export const saleLine = (r, money = dollars) => `sold for ${money(r.proceeds)}, cost ${money(r.basis)} · ${r.held === "long" ? "long-term" : "short-term"}`;

/** The columns of the file for the tax preparer, in Form 8949's order (Instructions for Form 8949, 2025: (a) description, (d)
 *  proceeds, (e) cost, (h) gain or loss; short-term on Part I, long-term on Part II) and in plain words, without the form's
 *  letters. The plan keeps no dates bought and sold (columns (b) and (c)), so the file has no date columns rather than two
 *  empty ones; the list on screen and the printout say the dates are on the broker's Form 1099-B. */
export const CSV_HEADERS = Object.freeze(["What was sold", "Sold for", "Cost", "Gain or loss", "Short or long term"]);
/** A name typed or imported that a spreadsheet would run as a formula (it starts with = + - @, a tab or a return) gets an
 *  apostrophe in front, so Excel and Google Sheets show it as text (the usual guard against "CSV injection", as OWASP's page
 *  of that name describes it; a convention, not re-read for this change). Only the text columns: the money is numbers. */
export const csvText = (v) => { const t = v === null || v === undefined ? "" : String(v); return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; };
/** The year's sales as CSV text (core/csv.js): one row per sale, money with two decimals and no $ sign; "Whose" is added
 *  when filing separately and a sale names its owner. */
export function salesCsv(s, plan = null) {
  const people = new Map((plan?.household?.people ?? []).map((p) => [p.id, p.name]));
  const whose = s.separate && s.rows.some((r) => r.personId);
  const headers = whose ? [...CSV_HEADERS, "Whose"] : [...CSV_HEADERS];
  const n2 = (v) => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
  const rows = s.rows.map((r) => [csvText(r.name), n2(r.proceeds), n2(r.basis), n2(r.gain), r.held === "long" ? "long-term" : "short-term", ...(whose ? [csvText(r.personId ? people.get(r.personId) ?? "" : "both")] : [])]);
  return toCsv(headers, rows);
}
