// modules/taxes/capital-gains/compute.js -- PURE. This year's sales: short against long, the
// loss allowance and carry-forward, the tax the gains add on top of the rest of your return
// (0/15/20% for long-term, ordinary rates for short-term, the 3.8% surtax), how much long-term
// gain still fits in the 0% band, and what one more sale would cost.
import { taxInputs, netGains } from "../federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";

/**
 * compute(plan, { today, extra: { amount, held } }) -> {
 *   year, filingStatus, rows: [{ id, name, proceeds, basis, held, gain }], gains (netGains), hasSales,
 *   taxWithout, taxWith, taxOnGains, rateOnGains, niit, qualifiedLayers: [{ rate, amount, tax }], shortTax,
 *   zeroRoom (long-term gain that would still be taxed at 0%), zeroTop, thresholds: { zero, fifteen }, taxableIncome,
 *   extra: { amount, held, tax, rate } | null, isIndexed
 * }
 */
export function compute(plan, params = {}) {
  const b = taxInputs(plan, params);
  const withGains = federalTax(b.inputs, b.params);
  const bare = taxInputs({ ...plan, taxes: { ...(plan.taxes ?? {}), gains: [] } }, params);
  const without = federalTax(bare.inputs, bare.params);
  const g = b.gains;
  const st = b.params.status[b.filingStatus] ?? b.params.status.single;
  const thresholds = { zero: st.ltcgBrackets?.[0] ?? 0, fifteen: st.ltcgBrackets?.[1] ?? 0 };
  // room in the 0% band: more long-term gain until taxable income reaches the first threshold (benefits taxation can move it, so iterate)
  let zeroRoom = Math.max(0, thresholds.zero - withGains.taxableIncome);
  for (let k = 0; k < 4 && zeroRoom > 0; k++) {
    const ti = federalTax({ ...b.inputs, qualifiedIncome: b.inputs.qualifiedIncome + zeroRoom }, b.params).taxableIncome;
    if (Math.abs(ti - thresholds.zero) < 1) break;
    zeroRoom = Math.max(0, zeroRoom - (ti - thresholds.zero));
  }
  zeroRoom = Math.round(zeroRoom);
  const short = g.netShort > 0 ? federalTax({ ...b.inputs, otherOrdinary: Math.max(0, b.inputs.otherOrdinary - g.netShort) }, b.params) : null;
  const shortTax = short ? withGains.totalTax - short.totalTax : 0;
  let extra = null;
  const ex = params.extra;
  if (ex && Number(ex.amount) > 0) {
    const amount = Number(ex.amount);
    const held = ex.held === "short" ? "short" : "long";
    const r2 = federalTax(held === "long" ? { ...b.inputs, qualifiedIncome: b.inputs.qualifiedIncome + amount } : { ...b.inputs, otherOrdinary: b.inputs.otherOrdinary + amount }, b.params);
    extra = { amount, held, tax: r2.totalTax - withGains.totalTax, rate: (r2.totalTax - withGains.totalTax) / amount };
  }
  const taxOnGains = withGains.totalTax - without.totalTax;
  const realised = g.netLong + g.netShort + Math.max(0, -g.netLoss);
  return {
    year: b.year, filingStatus: b.filingStatus, rows: g.rows, gains: g, hasSales: g.rows.length > 0,
    taxWithout: without.totalTax, taxWith: withGains.totalTax, taxOnGains, rateOnGains: g.netLong + g.netShort > 0 ? taxOnGains / (g.netLong + g.netShort) : 0,
    niit: withGains.niit, qualifiedLayers: withGains.qualifiedLayers, shortTax, zeroRoom, thresholds, taxableIncome: withGains.taxableIncome, ordinaryTaxable: withGains.ordinaryTaxable,
    extra, isIndexed: !!b.params.indexed, realised, lossSaves: g.lossAllowed < 0 ? without.totalTax - withGains.totalTax : 0,
  };
}
