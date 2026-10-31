// modules/investments/tax-lots/compute.js -- PURE. Each lot you bought (date, shares, cost)
// against today's price: the gain or loss, whether a sale would be short- or long-term, the
// lots in taxable accounts that could be sold to harvest a loss (what that saves this year, what
// carries to next year, what a recent purchase cancels), and the order to sell in when you need
// cash (the smallest gain per share first).
import { compute as computeHoldings } from "../holdings/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { daysBetween, isoOf } from "../../../core/math/dates.js";

/** The first day a lot bought on `date` is long-term. The holding period starts the day after the buy and a lot is long-term
 *  when held more than one year (IRS Pub. 550: "begin counting on the date after the day you acquired the property"; IRC
 *  1222(3)), so it is long-term from one year after that first day: a buy on February 29, 2024 starts March 1 and is long-term
 *  on March 1, 2025; a buy on February 28, 2023 starts March 1, 2023, its year ends February 29, 2024, so March 1, 2024 too
 *  (Rev. Rul. 66-7: an asset bought on the last day of a month is long-term from the first day of the 13th month). */
export function longOn(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? "").slice(0, 10));
  if (!m) return null;
  const [y, mo, d] = isoOf(+m[1], +m[2], +m[3] + 1).split("-").map(Number);   // the first day of the holding period
  return isoOf(y + 1, mo, d);   // a year on (February 29 in a year without one rolls to March 1)
}

/**
 * The capital loss carried to next year (IRC 1212(b)), by the Capital Loss Carryover Worksheet (Pub. 550 Worksheet 4-1):
 * taxable income (negative when it would be), the loss allowed this year (at most 3,000, 1,500 filing separately), the
 * year's net short-term and long-term results (Schedule D lines 7 and 15). Line 3 = taxable income + the allowed loss (the
 * "adjusted taxable income" of 1212(b)(2)(B), floor 0); line 4 = the smaller of that and the allowed loss; the short-term
 * loss not used by line 4 and the long-term gain carries as short-term; the long-term loss not used by the short-term gain
 * and what line 4 has left carries as long-term. So with taxable income below zero more than the loss over 3,000 carries.
 */
export function carryover({ taxableIncome, allowed, shortNet, longNet }) {
  const l2 = Math.max(0, Number(allowed) || 0);
  const l4 = Math.min(l2, Math.max(0, (Number(taxableIncome) || 0) + l2));
  const stLoss = Math.max(0, -shortNet), ltGain = Math.max(0, longNet), ltLoss = Math.max(0, -longNet), stGain = Math.max(0, shortNet);
  const short = Math.max(0, stLoss - (l4 + ltGain));
  const long = Math.max(0, ltLoss - (stGain + Math.max(0, l4 - stLoss)));
  return { short, long, total: short + long };
}

/** The carryover of a plan's year as the Federal estimate works it (each spouse's return on its own when filing separately). */
function carryOf(ti, r) {
  const parts = r.separate ? r.separate.map((x) => ({ x, share: 1 / r.separate.length })) : [{ x: r, share: 1 }];
  return parts.reduce((acc, { x, share }) => {
    const c = carryover({ taxableIncome: x.agi - x.deduction.amount - (x.deduction.qbi || 0), allowed: -x.income.capitalLoss, shortNet: ti.gains.shortTotal * share, longNet: ti.gains.longTotal * share });
    return { short: acc.short + c.short, long: acc.long + c.long, total: acc.total + c.total };
  }, { short: 0, long: 0, total: 0 });
}

/**
 * Wash sales (IRC 1091(a)): a loss is not allowed on the shares matched by the same security bought in the 30 days before
 * the sale (or after it: the page cannot know that yet, so it says so). Every candidate is taken as sold today. Replacement
 * shares: lots of the same symbol, in any account of the household, an IRA too (Pub. 550 item 4; Rev. Rul. 2008-5), dated
 * from today - 30 days to today, not sold in this harvest, with a date. The sold lots of a symbol take them in order of
 * their own purchase, undated ones first (26 CFR 1.1091-1(b)); replacements are used in order of purchase, share for share,
 * each share once (1.1091-1(c)-(e)). Sets `allowed`, `disallowed` and `washedBy` [{ symbol, account, bucket, date, shares }]
 * (and each match's lot and disallowed loss) on each candidate. Conventions (answer key W1-W4): the same ticker is "substantially identical", another ticker is not.
 */
export function washSales(harvest, holdings, today) {
  const flat = holdings.flatMap((x) => x.lots.map((l) => ({ x, l })));
  const order = new Map(flat.map((e, n) => [e.l, n]));
  const sold = new Set(harvest.map((c) => c.lot));
  const acq = (e) => [e.l.date ? 1 : 0, e.l.date ?? "", order.get(e.l)];
  const cmp = (a, b) => { const p = acq(a), q = acq(b); return p[0] - q[0] || (p[1] < q[1] ? -1 : p[1] > q[1] ? 1 : 0) || p[2] - q[2]; };
  for (const c of harvest) { c.allowed = c.loss; c.disallowed = 0; c.washedBy = []; }
  if (!today) return harvest;
  for (const sym of new Set(flat.filter((e) => sold.has(e.l)).map((e) => e.x.symbol))) {
    const same = flat.filter((e) => e.x.symbol === sym);
    const pool = same.filter((e) => !sold.has(e.l) && e.l.date && daysBetween(e.l.date, today) >= 0 && daysBetween(e.l.date, today) <= 30).sort(cmp);
    const left = new Map(pool.map((e) => [e.l, e.l.shares]));
    for (const e of same.filter((y) => sold.has(y.l)).sort(cmp)) {
      const c = harvest.find((y) => y.lot === e.l);
      let need = e.l.shares;
      for (const r of pool) {
        if (need <= 1e-12) break;
        const take = Math.min(need, left.get(r.l));
        if (take > 0) { left.set(r.l, left.get(r.l) - take); need -= take; c.washedBy.push({ symbol: r.x.symbol, account: r.x.account, bucket: r.x.bucket, date: r.l.date, shares: take, lot: r.l, disallowed: e.l.shares > 0 ? c.loss * take / e.l.shares : 0 }); }
      }
      const matched = e.l.shares - Math.max(0, need);
      c.disallowed = e.l.shares > 0 ? c.loss * matched / e.l.shares : 0;
      c.allowed = c.loss - c.disallowed;
    }
  }
  return harvest;
}

/** The lots of one enriched holding, with an "unassigned" lot for shares no lot covers. */
export function lotsOf(h, today) {
  const price = h.price;
  const rows = (h.lots ?? []).map((l) => {
    const shares = Number(l.shares) || 0, cost = Number(l.cost) || 0;
    const value = price !== null ? shares * price : cost;
    const from = l.date && today ? longOn(l.date) : null;   // no date (or no today): counted as long-term
    const days = from ? daysBetween(today, from) : null;
    return { id: l.id, date: l.date ?? null, shares, cost, costPerShare: shares > 0 ? cost / shares : 0, value, gain: value - cost, term: days === null || days <= 0 ? "long" : "short", daysToLong: days === null ? 0 : Math.max(0, days), longOn: from, assigned: true };
  });
  const covered = rows.reduce((s, l) => s + l.shares, 0), coveredCost = rows.reduce((s, l) => s + l.cost, 0);
  const rest = h.shares - covered;
  if (rest > 1e-6) {
    const cost = Math.max(0, h.costBasis - coveredCost);
    const value = price !== null ? rest * price : cost;
    rows.push({ id: null, date: null, shares: rest, cost, costPerShare: rest > 0 ? cost / rest : 0, value, gain: value - cost, term: "long", daysToLong: 0, assigned: false });
  }
  return rows;
}

/**
 * compute(plan, { today }) -> {
 *   ready, holdings: [{ id, symbol, name, account, bucket, priced, price, lots: [lot], gain, unassignedShares }],
 *   harvest: [{ symbol, account, lot, loss, taxSaved (the loss at its rate, orders the list), allowed, disallowed, washedBy }], harvestTotal (every loss),
 *   taxSavedTotal (what selling them all today cuts this year's federal tax by), disallowedTotal / allowedTotal (wash sales),
 *   carry: { short, long, total } (the loss carried to next year if harvested), carryAdded (the part the harvest adds), capLimit,
 *   sellFirst: [{ symbol, account, lot }] (taxable, lowest gain per share first), shortLosses, longLosses, marginal, gainsRate, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const h = computeHoldings(plan, params);
  const ti = taxInputs(plan, params);
  // the tax on $1,000 more of short- or long-term gain, the 3.8% on investment income included (a true 0% stays 0%)
  const base = federalTax(ti.inputs, ti.params).totalTax;
  const invested = (Number(ti.inputs.investmentIncome ?? ti.inputs.qualifiedIncome) || 0) + 1000;
  const rateOn = (more) => Math.max(0, (federalTax({ ...ti.inputs, ...more, investmentIncome: invested }, ti.params).totalTax - base) / 1000);
  const marginal = rateOn({ otherOrdinary: (Number(ti.inputs.otherOrdinary) || 0) + 1000 });
  const gainsRate = rateOn({ qualifiedIncome: (Number(ti.inputs.qualifiedIncome) || 0) + 1000 });
  const holdings = h.items.map((x) => {
    const lots = lotsOf(x, today);
    return { id: x.id, symbol: x.symbol, name: x.name, account: x.accountName, bucket: x.bucket, priced: x.priced, price: x.price, shares: x.shares, lots, gain: lots.reduce((s, l) => s + l.gain, 0), unassignedShares: lots.find((l) => !l.assigned)?.shares ?? 0, cls: x.cls };
  });
  const harvest = [];
  for (const x of holdings.filter((y) => y.bucket === "taxable" && y.priced)) for (const l of x.lots) if (l.gain < -1) harvest.push({ symbol: x.symbol, account: x.account, lot: l, loss: -l.gain, taxSaved: -l.gain * (l.term === "short" ? marginal : gainsRate) });
  harvest.sort((a, b) => b.taxSaved - a.taxSaved);   // the loss at its rate orders the list (not shown: what a sale saves this year is the total below)
  washSales(harvest, holdings, today);
  // what the harvest saves this year: the federal total now less the total with every candidate sold today, its allowed
  // loss added to the year's sales, short or long by its term. The engine nets it against the year's gains (short against
  // short, long against long, then across) and lets a net loss take at most 3,000 (1,500 filing separately) off other income
  // (IRC 1211(b), 1222; Schedule D); the rest carries to next year (1212(b)) and saves nothing this year.
  const baseCarry = carryOf(ti, federalTax(ti.inputs, ti.params));
  let taxSavedTotal = 0, carry = baseCarry;
  const allowedOf = (held) => harvest.filter((x) => x.lot.term === held).reduce((s, x) => s + x.allowed, 0);
  if (harvest.length) {
    const p2 = structuredClone(plan);
    p2.taxes = { ...(p2.taxes ?? {}), gains: [...(p2.taxes?.gains ?? []), { id: "harvest-short", proceeds: 0, basis: allowedOf("short"), held: "short" }, { id: "harvest-long", proceeds: 0, basis: allowedOf("long"), held: "long" }] };
    const t2 = taxInputs(p2, params), r2 = federalTax(t2.inputs, t2.params);
    taxSavedTotal = Math.max(0, base - r2.totalTax);
    carry = carryOf(t2, r2);
  }
  const disallowedTotal = harvest.reduce((s, x) => s + x.disallowed, 0);
  const sellFirst = [];
  for (const x of holdings.filter((y) => y.bucket === "taxable" && y.priced)) for (const l of x.lots) sellFirst.push({ symbol: x.symbol, account: x.account, lot: l, gainPerShare: l.shares > 0 ? l.gain / l.shares : 0 });
  sellFirst.sort((a, b) => a.gainPerShare - b.gainPerShare);
  const shortLosses = harvest.filter((x) => x.lot.term === "short").reduce((s, x) => s + x.loss, 0), longLosses = harvest.filter((x) => x.lot.term === "long").reduce((s, x) => s + x.loss, 0);
  const notes = [];
  const unassigned = holdings.filter((x) => x.unassignedShares > 1e-6 && x.bucket === "taxable").length;
  if (h.hasData && unassigned) notes.push(`${unassigned} taxable holding${unassigned === 1 ? " has" : "s have"} shares not split into lots: they are treated as one long-term lot holding whatever cost your typed lots leave over. Type the lots (date, shares, cost) from the brokerage's cost-basis page for the real picture.`);
  if (harvest.length) notes.push("Buying the same fund within 30 days before or after you sell it at a loss, in any of your accounts (an IRA too) or your spouse's, cancels the loss on that many shares (the wash-sale rule). Buy something similar but not the same, such as another company's total-market fund, or wait 31 days.");
  const capLimit = ti.filingStatus === "married_separate" ? 1500 : 3000;
  return { ready: h.hasData, holdings, harvest, harvestTotal: harvest.reduce((s, x) => s + x.loss, 0), taxSavedTotal, disallowedTotal, allowedTotal: harvest.reduce((s, x) => s + x.allowed, 0), carry, carryAdded: { short: Math.max(0, carry.short - baseCarry.short), long: Math.max(0, carry.long - baseCarry.long), total: Math.max(0, carry.short - baseCarry.short) + Math.max(0, carry.long - baseCarry.long) }, capLimit, sellFirst: sellFirst.slice(0, 8), shortLosses, longLosses, marginal, gainsRate, notes, taxableCount: holdings.filter((x) => x.bucket === "taxable").length };
}
