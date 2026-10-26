// modules/investments/tax-lots/compute.js -- PURE. Each lot you bought (date, shares, cost)
// against today's price: the gain or loss, whether a sale would be short- or long-term, the
// lots in taxable accounts that could be sold to harvest a loss (and the tax that saves), and
// the order to sell in when you need cash (highest cost first: the least gain).
import { compute as computeHoldings } from "../holdings/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { marginalRate, federalTax } from "../../../core/math/tax.js";
import { daysBetween } from "../../../core/math/dates.js";

/** The lots of one enriched holding, with an "unassigned" lot for shares no lot covers. */
export function lotsOf(h, today) {
  const price = h.price;
  const rows = (h.lots ?? []).map((l) => {
    const shares = Number(l.shares) || 0, cost = Number(l.cost) || 0;
    const value = price !== null ? shares * price : cost;
    const days = l.date && today ? daysBetween(String(l.date).slice(0, 10), today) : null;
    return { id: l.id, date: l.date ?? null, shares, cost, costPerShare: shares > 0 ? cost / shares : 0, value, gain: value - cost, term: days === null ? "long" : days > 365 ? "long" : "short", daysToLong: days === null ? 0 : Math.max(0, 366 - days), assigned: true };
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
 *   harvest: [{ symbol, account, lot, loss, taxSaved }], harvestTotal, taxSavedTotal, sellFirst: [{ symbol, account, lot }] (taxable, lowest gain first),
 *   shortLosses, longLosses, marginal, gainsRate, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const h = computeHoldings(plan, params);
  const ti = taxInputs(plan, params);
  const marginal = Math.max(0.1, marginalRate(ti.inputs, ti.params) || 0.22);
  const base = federalTax(ti.inputs, ti.params).totalTax;
  const gainsRate = Math.max(0, (federalTax({ ...ti.inputs, qualifiedIncome: ti.inputs.qualifiedIncome + 1000 }, ti.params).totalTax - base) / 1000);
  const holdings = h.items.map((x) => {
    const lots = lotsOf(x, today);
    return { id: x.id, symbol: x.symbol, name: x.name, account: x.accountName, bucket: x.bucket, priced: x.priced, price: x.price, shares: x.shares, lots, gain: lots.reduce((s, l) => s + l.gain, 0), unassignedShares: lots.find((l) => !l.assigned)?.shares ?? 0, cls: x.cls };
  });
  const harvest = [];
  for (const x of holdings.filter((y) => y.bucket === "taxable" && y.priced)) for (const l of x.lots) if (l.gain < -1) harvest.push({ symbol: x.symbol, account: x.account, lot: l, loss: -l.gain, taxSaved: -l.gain * (l.term === "short" ? marginal : gainsRate) });
  harvest.sort((a, b) => b.taxSaved - a.taxSaved);
  const sellFirst = [];
  for (const x of holdings.filter((y) => y.bucket === "taxable" && y.priced)) for (const l of x.lots) sellFirst.push({ symbol: x.symbol, account: x.account, lot: l, gainPerShare: l.shares > 0 ? l.gain / l.shares : 0 });
  sellFirst.sort((a, b) => a.gainPerShare - b.gainPerShare);
  const shortLosses = harvest.filter((x) => x.lot.term === "short").reduce((s, x) => s + x.loss, 0), longLosses = harvest.filter((x) => x.lot.term === "long").reduce((s, x) => s + x.loss, 0);
  const notes = [];
  const unassigned = holdings.filter((x) => x.unassignedShares > 1e-6 && x.bucket === "taxable").length;
  if (h.hasData && unassigned) notes.push(`${unassigned} taxable holding${unassigned === 1 ? " has" : "s have"} shares not split into lots: they are treated as one long-term lot at the average cost. Type the lots (date, shares, cost) from the brokerage's cost-basis page for the real picture.`);
  if (harvest.length) notes.push("Harvesting: sell the losing lot and buy something similar but not identical (a different total-market fund), or wait 31 days before buying the same one back, or the wash-sale rule cancels the loss.");
  return { ready: h.hasData, holdings, harvest, harvestTotal: harvest.reduce((s, x) => s + x.loss, 0), taxSavedTotal: harvest.reduce((s, x) => s + x.taxSaved, 0), sellFirst: sellFirst.slice(0, 8), shortLosses, longLosses, marginal, gainsRate, notes, taxableCount: holdings.filter((x) => x.bucket === "taxable").length };
}
