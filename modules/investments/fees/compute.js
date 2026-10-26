// modules/investments/fees/compute.js -- PURE. What your funds and any advisor charge each year,
// the weighted average, and what that costs over a lifetime: the same money grown at the
// plan's return with and without the fees (contributions from the Contributions page added
// each year until retirement), plus what switching to cheap index funds would keep.
import { compute as computeHoldings } from "../holdings/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";

export const CHEAP_ER = 0.0005;   // what a broad index fund costs today (0.05% or less)

/** Grow `start` for `years` at `rate` less `fee` each year, adding `yearly` (growing with `growth`) at the end of each of the first `contribYears` years. */
export function growWithFees(start, years, rate, fee, yearly = 0, contribYears = 0, growth = 0) {
  let v = start;
  for (let y = 0; y < years; y++) { v *= 1 + rate - fee; if (y < contribYears) v += yearly * Math.pow(1 + growth, y); }
  return v;
}

/**
 * compute(plan, { today }) -> {
 *   ready, total, items: [{ symbol, name, account, value, er, feeYearly, known }], fundFees (yearly), advisoryFee (fraction), advisoryYearly, feesYearly,
 *   weightedEr, allIn (fraction of the portfolio a year), years, rate, contributions: { yearly, years },
 *   withFees, withoutFees, lifetimeCost, withCheap, cheapSaves, priciest[], unknownCount, notes
 * }
 */
export function compute(plan, params = {}) {
  const h = computeHoldings(plan, params);
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const items = h.items.map((x) => ({ symbol: x.symbol, name: x.name, account: x.accountName, value: x.value, er: x.er, feeYearly: x.feeYearly, known: x.er !== null })).sort((a, b) => b.feeYearly - a.feeYearly);
  const priced = items.filter((x) => x.er !== null);
  const pricedValue = priced.reduce((s, x) => s + x.value, 0);
  const fundFees = priced.reduce((s, x) => s + x.feeYearly, 0);
  const weightedEr = pricedValue > 0 ? fundFees / pricedValue : 0;
  const advisoryFee = Math.max(0, Number(plan.investments?.advisoryFee) || 0);
  const advisoryYearly = h.total * advisoryFee;
  const feesYearly = fundFees + advisoryYearly;
  const allIn = h.total > 0 ? feesYearly / h.total : 0;
  const a = plan.assumptions ?? {}, rt = plan.retirement ?? {};
  const stocks = Number(rt.stocksNow ?? 0.7);
  const rate = stocks * Number(a.returnStocks ?? 0.07) + (1 - stocks) * Number(a.returnBonds ?? 0.04);
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const self = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  const age = self ? year - Number(String(self.birthDate).slice(0, 4)) : null;
  const retireAge = Number(self?.retirementAge ?? a.retirementAge ?? 65), endAge = Number(self?.lifeExpectancy ?? a.planEndAge ?? 95);
  const years = age !== null ? Math.max(10, endAge - age) : 30;
  const contribYears = age !== null ? Math.max(0, retireAge - age) : 0;
  const c = (plan.retirement?.contributions ?? []).length ? computeContributions(plan, { today }) : null;
  const yearly = c?.totalYearly ?? 0;
  const growth = Number(a.salaryGrowth ?? 0.03);
  const withoutFees = growWithFees(h.total, years, rate, 0, yearly, contribYears, growth);
  const withFees = growWithFees(h.total, years, rate, allIn, yearly, contribYears, growth);
  const withCheap = growWithFees(h.total, years, rate, CHEAP_ER, yearly, contribYears, growth);
  const notes = [];
  const unknownCount = items.length - priced.length;
  if (unknownCount) notes.push(`${unknownCount} holding${unknownCount === 1 ? " has" : "s have"} no expense ratio on file (not a common fund); type it on the Holdings page. Individual stocks cost nothing to hold: enter 0.`);
  return {
    ready: h.hasData, total: h.total, items, fundFees, advisoryFee, advisoryYearly, feesYearly, weightedEr, allIn, years, rate, contributions: { yearly, years: contribYears },
    withFees, withoutFees, lifetimeCost: withoutFees - withFees, withCheap, cheapSaves: withCheap - withFees, priciest: items.filter((x) => x.er !== null && x.er > 0.002).slice(0, 5), unknownCount, notes, endAge,
  };
}
