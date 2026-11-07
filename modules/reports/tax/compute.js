// modules/reports/tax/compute.js -- PURE. The tax pages in one report: this year's federal estimate
// step by step, the rates (effective, the next dollar, the bracket and the room left in it), how
// the tax gets paid (withholding, estimated payments), gains and the 0% room, the HSA's saving, and
// the tax the retirement plan pays year by year.
import { compute as computeFederal, nextDollarOf } from "../../taxes/federal/compute.js";
import { known as knownFigures } from "../../taxes/federal/known.js";
import { bracketsFor } from "../../../core/math/tax.js";
import { compute as computeBrackets } from "../../taxes/brackets/compute.js";
import { compute as computeWithholding, fullSteps } from "../../taxes/withholding/compute.js";
import { compute as computeEstimated } from "../../taxes/estimated/compute.js";
import { compute as computeGains } from "../../taxes/capital-gains/compute.js";
import { compute as computeHsa } from "../../taxes/hsa-fsa/compute.js";
import { compute as computeTaxProjection } from "../../taxes/projection/compute.js";

/**
 * compute(plan, { today }) -> {
 *   ready, missing, today, year, filing, isIndexed,
 *   thisYear: { steps: [{ label, amount, sub }], totalTax, agi, taxableIncome, effectiveRate, marginal (= nextDollar, the Federal estimate's next dollar), nextDollar, bracketRate, roomInBracket, nextRate,
 *     returns: null | [{ personId, name, taxableIncome, ordinaryTaxable, bracketRate, roomInBracket, nextRate, nextDollar, totalTax, ladder, shown }] (filing
 *     separately: each return's own figures and ladder; the household's bracket figures above are the shown one's, the
 *     return more income lands on) },
 *   ladder: [{ rate, from, to, filled, tax, current }],
 *   paying: { verdict, balance, withheld, estimatesPaid, needsEstimates, nextDue (the next quarter not yet past), overdue (past quarters not paid), penaltyRisk } ,
 *   gains: { hasSales, taxOnGains, zeroRoom, netLoss, carryForward } , hsa: { taxSaved, room, limit } | null,
 *   retirement: { ready, years, total, average, peak (null with no retirement year), byBracket, firstZero, flatTaxes, bracketsOn, noYears (why there is no retirement year, or null) }
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const fed = computeFederal(plan, { today });
  // the Federal estimate's own figures (known.js: the answer keys' return with what the plan knows put in), so the walk, the
  // rates, the bracket, the room left and the ladder all describe the one return the total is worked on (round 8 review:
  // the walk said 35,104 taxable and 22 cents while "The rates" said the 10% bracket and 19%, from the keys' return)
  const k = knownFigures(plan, { today }, fed);
  if (!k.hasIncome) return { ready: false, missing: ["what comes in, on the Income page (or the figures on the Federal estimate page)"] };
  const br = computeBrackets(plan, { today });
  const wh = computeWithholding(plan, { today });
  const es = computeEstimated(plan, { today });
  const cg = computeGains(plan, { today });
  const hs = computeHsa(plan, { today, iraAsAssumed: false });
  const tp = computeTaxProjection(plan, { today });
  const r = k.result;
  // the whole year's federal tax (self-employment tax included) and its walk, as the Federal estimate shows them
  const full = fullSteps(plan, fed, { today }, k);
  // paying it: the same answer as Withholding check (typed figures, else withholding estimated from pay; a household
  // with no pay has nothing withheld), not "not known" for everyone without a typed pay stub
  const est = wh.estimate ?? {};
  const noPay = !(r.income.wages > 0);
  const known = est.from && (est.from !== "none" || noPay);
  // filing separately, each return settles on its own (withholding byReturn), as Withholding check, the Federal estimate,
  // Quick answers and Needs attention say it (Review 2026-11-06, verifier: the report said "a refund of about $540" while Bo's
  // return owed 1,660 and Ana's got 2,200 back). A return with no paycheck figure ("unknown") is known here only with no pay
  // at all, where nothing is withheld: its balance says it. Its own estimated payments are Estimated payments' `returns`.
  const verdictOf = (x) => (x.verdict !== "unknown" ? x.verdict : Math.abs(x.balance) < 500 ? "about right" : x.balance > 0 ? "owe" : "refund");
  const retEst = (name) => (es.returns ?? []).find((y) => y.name === name) ?? null;
  const returns = known && Array.isArray(est.returns) && est.returns.length > 1
    ? est.returns.map((x) => { const e = retEst(x.name); return { name: x.name, owed: x.owed, back: x.back, withheld: x.withheld, paid: x.paid, balance: x.balance, verdict: verdictOf(x), penaltyRisk: !!x.penaltyRisk || !!e?.penaltyRisk, needsEstimates: !!e?.needsEstimates, nextDue: e?.nextDue ?? null, overdue: e?.overdue ?? null }; })
    : null;
  // filing separately, each return has its own ladder: the bracket, the room and the next dollar are said per return, not
  // the household's combined taxable income laid on one return's ladder (Review 2026-11-06, verifier: the family filing
  // separately read "$36,370 more taxable income fits in the 22% bracket" beside 119,080 of taxable income; 36,370 is the
  // room on Ana's 69,330, and Bo's 49,750 has 650 left in the 12% bracket). Each one's next dollar is nextDollarOf with that
  // return as the one more income lands on (separateTo), the Federal estimate's figure for the shown one.
  const rungs = r.separate ? bracketsFor(fed.filingStatus, fed.params) : [];
  const ladderOf = (ordinary) => rungs.map((x) => { const filled = Math.max(0, Math.min(ordinary, Number.isFinite(x.to) ? x.to : Infinity) - x.from); return { rate: x.rate, from: x.from, to: x.to, filled, tax: filled * x.rate, current: ordinary >= x.from && (ordinary < x.to || !Number.isFinite(x.to)) }; });
  const sepReturns = r.separate ? r.separate.map((x) => ({
    personId: x.personId, name: x.name, taxableIncome: x.taxableIncome, ordinaryTaxable: x.ordinaryTaxable, bracketRate: x.bracketRate, roomInBracket: x.roomInBracket, nextRate: x.nextRate, totalTax: x.totalTax,
    nextDollar: x.personId === r.separateTo ? k.nextDollar : nextDollarOf({ ...k.inputs, separateTo: x.personId }, fed.params),
    ladder: ladderOf(x.ordinaryTaxable), shown: x.personId === r.separateTo,
  })) : null;
  return {
    ready: true, missing: [], today, year: fed.year, filing: fed.filingStatus, isIndexed: fed.isIndexed,
    // the next dollar is the Federal estimate's own (nextDollar: over whole steps of the child care credit), the figure its
    // walk says, not the 1,000 probe (care fourth pass: the report said 12% where its walk said 14 cents)
    thisYear: { steps: full.steps, totalTax: full.total, seTax: full.se?.tax ?? 0, incomeTax: r.totalTax, agi: r.agi, taxableIncome: r.taxableIncome, effectiveRate: full.rate, marginal: k.nextDollar, nextDollar: k.nextDollar, bracketRate: r.bracketRate, roomInBracket: r.roomInBracket, nextRate: r.nextRate, returns: sepReturns },
    ladder: br.ladder.map((l) => ({ rate: l.rate, from: l.from, to: l.to, filled: l.filled, tax: l.tax, current: l.current })),
    paying: { verdict: known ? (Math.abs(est.balance) < 500 ? "about right" : est.balance > 0 ? "owe" : "refund") : "unknown", balance: known ? est.balance : wh.balance, withheld: known ? est.projected : (wh.withholding?.projected ?? 0), from: est.from ?? "none", noPay, estimatesPaid: (wh.estimatedPaid ?? 0) + (est.otherPaid ?? 0), totalTax: wh.totalTax, needsEstimates: es.needsEstimates, nextDue: es.nextDue, overdue: es.overdue, penaltyRisk: wh.penaltyRisk || es.penaltyRisk, returns,
      // a retiree's tax on this year's IRA withdrawals: tax held back from a withdrawal counts as paid through the whole year
      // (IRC 6654(g)), the cheaper route the report leads with (Estimated payments' holdBack; round 8 review)
      holdBack: es.holdBack ?? null },
    gains: { hasSales: cg.hasSales, taxOnGains: cg.taxOnGains, zeroRoom: cg.zeroRoom, netLoss: cg.gains?.netLoss ?? 0, carryForward: cg.gains?.carryForward ?? 0 },
    hsa: hs.hasHsa ? { taxSaved: hs.hsa.savedTotal, room: hs.hsa.room, limit: hs.hsa.limit } : null,
    // no retirement year inside the plan: peak is null and `noYears` says why (Review 2026-11-06: the view read r.peak.year
    // and never finished for 17 qa households)
    retirement: tp.ready ? { ready: true, years: tp.rows.length, total: tp.totals.taxes, average: tp.average, peak: tp.peak, byBracket: tp.byBracket, firstZero: tp.firstZero, flatTaxes: tp.flatTaxes, bracketsOn: tp.bracketsOn, noYears: tp.noYears ?? null }
      // everyone past the plan's end age: the projection has no year to run (round 7), and the report still says why
      : tp.noYears ? { ready: true, years: 0, total: 0, average: 0, peak: null, byBracket: [], firstZero: null, flatTaxes: 0, bracketsOn: (plan.retirement?.taxMode ?? "flat") === "brackets", noYears: tp.noYears } : { ready: false },
  };
}
