// modules/investments/asset-location/compute.js -- PURE. Which kinds of investments sit in
// which kind of account. Bonds, REITs and cash throw off income taxed as wages every year, so
// they belong in 401(k)s and IRAs; stock index funds pay little, mostly qualified dividends,
// and belong in taxable accounts (and, with the highest growth, in Roths). The page measures
// the yearly tax drag of the current placement, works out the ideal placement with the same
// overall mix and the same account sizes, and lists the swaps that get there.
import { compute as computeHoldings, ASSET_CLASSES } from "../holdings/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { marginalRate, federalTax } from "../../../core/math/tax.js";

export const BUCKETS = { taxable: "Taxable (brokerage)", deferred: "Pre-tax (401(k), IRA)", free: "Roth and HSA" };
// how much of a class's income is taxed as ordinary income in a taxable account (the rest at the gains rate); "other" is gold (collectibles) or crypto, taxed like ordinary on sale
const INEFFICIENCY = { bonds: 1, cash: 1, real_estate: 0.8, other: 0.6, intl_stocks: 0.15, us_stocks: 0.1, balanced: 0.5, unknown: 0.3 };
const ORDER_FOR_DEFERRED = ["bonds", "cash", "real_estate", "other", "balanced", "intl_stocks", "us_stocks"];

/**
 * compute(plan, { today }) -> {
 *   ready, marginal, gainsRate, buckets: [{ key, label, value, classes: { cls: value } }], byClass: { cls: total },
 *   dragNow, dragIdeal, saving, ideal: { bucket: { cls: value } }, swaps: [{ bucket, sell: cls, buy: cls, amount, accounts }], score: "good"|"fair"|"poor", notes
 * }
 */
export function compute(plan, params = {}) {
  const h = computeHoldings(plan, params);
  const ti = taxInputs(plan, params);
  const marginal = Math.max(0.10, marginalRate(ti.inputs, ti.params) || 0.22);
  const base = federalTax(ti.inputs, ti.params).totalTax;
  const gainsRate = Math.max(0, (federalTax({ ...ti.inputs, qualifiedIncome: ti.inputs.qualifiedIncome + 1000 }, ti.params).totalTax - base) / 1000);   // what the next 1,000 of qualified dividends costs you
  const buckets = Object.keys(BUCKETS).map((key) => ({ key, label: BUCKETS[key], value: 0, classes: {} }));
  const byClass = {};
  const yieldOf = {};
  for (const x of h.items) {
    const b = buckets.find((z) => z.key === x.bucket); if (!b) continue;
    for (const [cls, w] of Object.entries(x.mix)) {
      const v = x.value * w; b.classes[cls] = (b.classes[cls] ?? 0) + v; b.value += v; byClass[cls] = (byClass[cls] ?? 0) + v;
      if (x.yield !== null) { yieldOf[cls] = yieldOf[cls] ?? { v: 0, inc: 0 }; yieldOf[cls].v += v; yieldOf[cls].inc += v * x.yield; }
    }
  }
  const classYield = (cls) => yieldOf[cls] && yieldOf[cls].v > 0 ? yieldOf[cls].inc / yieldOf[cls].v : ({ bonds: 0.04, cash: 0.04, real_estate: 0.038, other: 0, us_stocks: 0.012, intl_stocks: 0.03, balanced: 0.025, unknown: 0.02 })[cls] ?? 0.02;
  const dragOf = (placement) => { let d = 0; for (const [cls, v] of Object.entries(placement.taxable ?? {})) { const y = classYield(cls), ineff = INEFFICIENCY[cls] ?? 0.3; d += v * y * (ineff * marginal + (1 - ineff) * gainsRate); } return d; };
  const now = Object.fromEntries(buckets.map((b) => [b.key, { ...b.classes }]));
  // ideal: fill pre-tax with the least efficient classes first, then Roth with the fastest growers (stocks), taxable gets what is left;
  // cash (a settlement or money-market balance) and unclassified holdings stay where they are
  const FIXED = ["cash", "unknown"];
  const remaining = Object.fromEntries(Object.entries(byClass).filter(([cls]) => !FIXED.includes(cls)));
  const ideal = { taxable: {}, deferred: {}, free: {} };
  for (const b of buckets) for (const cls of FIXED) if ((now[b.key][cls] ?? 0) > 0) ideal[b.key][cls] = now[b.key][cls];
  const fill = (bucket, order) => { let room = buckets.find((b) => b.key === bucket).value - FIXED.reduce((s, cls) => s + (now[bucket][cls] ?? 0), 0); for (const cls of order) { const take = Math.min(room, remaining[cls] ?? 0); if (take > 0) { ideal[bucket][cls] = take; remaining[cls] -= take; room -= take; } if (room <= 0.5) break; } };
  fill("deferred", ORDER_FOR_DEFERRED.filter((c) => !FIXED.includes(c)));
  fill("free", ["us_stocks", "intl_stocks", "real_estate", "balanced", "other", "bonds"]);
  fill("taxable", ["us_stocks", "intl_stocks", "balanced", "other", "real_estate", "bonds"]);
  for (const [cls, v] of Object.entries(remaining)) if (v > 0.5) ideal.taxable[cls] = (ideal.taxable[cls] ?? 0) + v;   // anything unplaced (accounts of no bucket)
  const dragNow = dragOf(now), dragIdeal = dragOf(ideal);
  const swaps = [];
  for (const b of buckets) {
    const sells = [], buys = [];
    for (const cls of new Set([...Object.keys(now[b.key]), ...Object.keys(ideal[b.key])])) {
      const diff = (ideal[b.key][cls] ?? 0) - (now[b.key][cls] ?? 0);
      if (diff < -1) sells.push({ cls, amount: -diff }); else if (diff > 1) buys.push({ cls, amount: diff });
    }
    const accounts = [...new Set(h.items.filter((x) => x.bucket === b.key).map((x) => x.accountName))];
    let i = 0, j = 0;
    while (i < sells.length && j < buys.length) {
      const amount = Math.min(sells[i].amount, buys[j].amount);
      swaps.push({ bucket: b.key, bucketLabel: b.label, sell: sells[i].cls, buy: buys[j].cls, sellLabel: ASSET_CLASSES[sells[i].cls].label, buyLabel: ASSET_CLASSES[buys[j].cls].label, amount, accounts });
      sells[i].amount -= amount; buys[j].amount -= amount;
      if (sells[i].amount < 1) i++; if (buys[j].amount < 1) j++;
    }
  }
  const saving = Math.max(0, dragNow - dragIdeal);
  const score = !h.hasData ? "none" : saving < 50 ? "good" : saving < 500 ? "fair" : "poor";
  const notes = [];
  if (buckets.filter((b) => b.value > 0).length < 2) notes.push("All the holdings sit in one kind of account, so there is nothing to place; the question only arises with both taxable and retirement accounts.");
  return { ready: h.hasData, marginal, gainsRate, buckets, byClass, dragNow, dragIdeal, saving, ideal, now, swaps: swaps.filter((s) => s.amount >= 100), score, notes, total: h.total };
}
