// modules/reports/tax/compute.js -- PURE. The tax pages in one report: this year's federal estimate
// step by step, the rates (effective, the next dollar, the bracket and the room left in it), how
// the tax gets paid (withholding, estimated payments), gains and the 0% room, the HSA's saving, and
// the tax the retirement plan pays year by year.
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { compute as computeBrackets } from "../../taxes/brackets/compute.js";
import { compute as computeWithholding } from "../../taxes/withholding/compute.js";
import { compute as computeEstimated } from "../../taxes/estimated/compute.js";
import { compute as computeGains } from "../../taxes/capital-gains/compute.js";
import { compute as computeHsa } from "../../taxes/hsa-fsa/compute.js";
import { compute as computeTaxProjection } from "../../taxes/projection/compute.js";

/**
 * compute(plan, { today }) -> {
 *   ready, missing, today, year, filing, isIndexed,
 *   thisYear: { steps: [{ label, amount, sub }], totalTax, agi, taxableIncome, effectiveRate, marginal, bracketRate, roomInBracket, nextRate },
 *   ladder: [{ rate, from, to, filled, tax, current }],
 *   paying: { verdict, balance, withheld, estimatesPaid, needsEstimates, nextDue (the next quarter not yet past), overdue (past quarters not paid), penaltyRisk } ,
 *   gains: { hasSales, taxOnGains, zeroRoom, netLoss, carryForward } , hsa: { taxSaved, room, limit } | null,
 *   retirement: { ready, years, total, average, peak, byBracket, firstZero, flatTaxes, bracketsOn } 
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const fed = computeFederal(plan, { today });
  if (!fed.hasIncome) return { ready: false, missing: ["what comes in, on the Income page (or the figures on the Federal estimate page)"] };
  const br = computeBrackets(plan, { today });
  const wh = computeWithholding(plan, { today });
  const es = computeEstimated(plan, { today });
  const cg = computeGains(plan, { today });
  const hs = computeHsa(plan, { today });
  const tp = computeTaxProjection(plan, { today });
  const r = fed.result;
  return {
    ready: true, missing: [], today, year: fed.year, filing: fed.filingStatus, isIndexed: fed.isIndexed,
    thisYear: { steps: fed.steps, totalTax: r.totalTax, agi: r.agi, taxableIncome: r.taxableIncome, effectiveRate: r.effectiveRate, marginal: fed.marginal, bracketRate: r.bracketRate, roomInBracket: r.roomInBracket, nextRate: r.nextRate },
    ladder: br.ladder.map((l) => ({ rate: l.rate, from: l.from, to: l.to, filled: l.filled, tax: l.tax, current: l.current })),
    paying: { verdict: wh.verdict, balance: wh.balance, withheld: wh.withholding?.projected ?? 0, estimatesPaid: wh.estimatedPaid ?? 0, needsEstimates: es.needsEstimates, nextDue: es.nextDue, overdue: es.overdue, penaltyRisk: wh.penaltyRisk || es.penaltyRisk },
    gains: { hasSales: cg.hasSales, taxOnGains: cg.taxOnGains, zeroRoom: cg.zeroRoom, netLoss: cg.gains?.netLoss ?? 0, carryForward: cg.gains?.carryForward ?? 0 },
    hsa: hs.hasHsa ? { taxSaved: hs.hsa.savedTotal, room: hs.hsa.room, limit: hs.hsa.limit } : null,
    retirement: tp.ready ? { ready: true, years: tp.rows.length, total: tp.totals.taxes, average: tp.average, peak: tp.peak, byBracket: tp.byBracket, firstZero: tp.firstZero, flatTaxes: tp.flatTaxes, bracketsOn: tp.bracketsOn } : { ready: false },
  };
}
