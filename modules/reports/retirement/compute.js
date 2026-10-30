// modules/reports/retirement/compute.js -- PURE and heavy. The retirement pages in one report: the plan
// at expected returns, the chance the money lasts (Monte Carlo) and what history says, Social
// Security, how the money comes out (the order, Roth conversions, required withdrawals), the plan
// year by year at five-year steps, and the market stress tests.
import { compute as computeProjection } from "../../retirement/projection/compute.js";
import { compute as computeMonteCarlo } from "../../retirement/monte-carlo/compute.js";
import { compute as computeHistorical } from "../../retirement/historical/compute.js";
import { compute as computeSocialSecurity } from "../../retirement/social-security/compute.js";
import { compute as computeOrder } from "../../retirement/withdrawal-order/compute.js";
import { compute as computeRoth } from "../../retirement/roth-conversions/compute.js";
import { compute as computeRmd } from "../../retirement/rmd/compute.js";
import { compute as computeCashFlow } from "../../retirement/cash-flow/compute.js";
import { compute as computeStress } from "../../scenarios/stress-tests/compute.js";
import { STRATEGIES } from "../../../core/math/retirement.js";

export const REPORT_PATHS = 1000;
/** The years shown in the table: the first, retirement, every STEP years, and the last. */
export const STEP = 5;

/**
 * compute(plan, { today, maxPaths }) -> {
 *   ready, missing, today, plan: { retireYear, spendingMonthly, affordableMonthly, success, lastsTo, shortYear, shortAge, atRetirementReal, endReal, coverage, strategy, orderLabel, taxMode },
 *   chance: { rate, paths, bands: [{ year, p10, p50, p90 }], failAges } | null, history: { rate, windows, from, to, worst: [{ startYear, failAge, endReal }] } | null,
 *   socialSecurity: { people: [{ name, claimAge, monthly, options }], survivorMonthly } , order: { best, current, gain } | null, roth: { on, best, gain, span } | null,
 *   rmd: [{ name, startYear, startAge, firstRmdReal }], years: [rows], market: [{ title, success, failAge, endReal }] | null, hitYear
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const pr = computeProjection(plan, { today });
  if (!today || !pr.ready) return { ready: false, missing: pr.missing ?? ["today's date"] };
  const paths = Math.min(REPORT_PATHS, params.maxPaths ?? REPORT_PATHS);
  const mc = computeMonteCarlo(plan, { today, paths, seed: 1 });
  const hi = computeHistorical(plan, { today, quick: true });
  const ss = computeSocialSecurity(plan, { today });
  const wo = computeOrder(plan, { today });
  const rc = pr.inputs.tax?.mode === "brackets" ? computeRoth(plan, { today }) : null;
  const rmd = computeRmd(plan, { today });
  const cf = computeCashFlow(plan, { today, real: true });
  const st = computeStress(plan, { today });
  const last = cf.rows[cf.rows.length - 1];
  const years = cf.rows.filter((r, i) => i === 0 || r.year === cf.retireYear || (r.year - cf.rows[0].year) % STEP === 0 || r === last);
  const opt = (list, pred) => (list ?? []).find(pred) ?? null;
  const bestOrder = wo.ready ? opt(wo.options, (o) => o.best) : null, curOrder = wo.ready ? opt(wo.options, (o) => o.current) : null;
  const bestRoth = rc?.ready ? opt(rc.options, (o) => o.best) : null, noRoth = rc?.ready ? rc.options[0] : null;
  return {
    ready: true, missing: [], today,
    plan: { retireYear: pr.atRetirement?.year ?? null, spendingMonthly: pr.spendingYearly / 12, affordableMonthly: pr.affordable / 12, success: pr.result.success, lastsTo: pr.result.success ? pr.atEnd.year : null, shortYear: pr.shortYear, shortAge: pr.shortAge, atRetirementReal: pr.atRetirement?.totalReal ?? null, endReal: pr.atEnd.totalReal, coverage: pr.coverage, strategy: STRATEGIES[pr.strategy] ?? pr.strategy, orderLabel: pr.orderLabel, taxMode: pr.inputs.tax?.mode ?? "flat" },
    chance: mc.ready ? { rate: mc.successRate, paths: mc.paths, bands: mc.bands.map((b) => ({ year: b.year, p10: b.p10, p50: b.p50, p90: b.p90 })), failAges: mc.failAges } : null,
    history: hi.ready ? { rate: hi.successRate, windows: hi.windows, from: hi.dataRange[0], to: hi.dataRange[1], worst: hi.worst.slice(0, 3).map((w) => ({ startYear: w.startYear, failAge: w.failAge, endReal: w.endReal })) } : null,
    socialSecurity: { people: ss.people.filter((p) => p.source !== "none").map((p) => ({ name: p.name, claimAge: p.claimAge, monthly: p.monthly, options: p.options.map((o) => ({ claimAge: o.claimAge, monthly: o.monthly })) })), survivorMonthly: ss.couple?.survivorMonthly ?? null, names: Object.fromEntries(ss.people.map((p) => [p.id, p.name])) },
    order: bestOrder ? { best: bestOrder.label, current: curOrder?.label ?? pr.orderLabel, gain: curOrder ? bestOrder.endAfterTaxReal - curOrder.endAfterTaxReal : 0 } : null,
    roth: bestRoth ? { on: rc.on, best: bestRoth.label, gain: noRoth ? bestRoth.endAfterTaxReal - noRoth.endAfterTaxReal : 0, span: rc.span } : null,
    rmd: rmd.people.filter((p) => p.deferredNow > 0).map((p) => ({ name: p.name, startYear: p.startYear, startAge: p.startAge, firstRmdReal: p.firstRmdReal })),
    years: years.map((r) => ({ year: r.year, ages: r.ages, retired: r.retired, contributions: r.in.contributions, income: r.in.income, spending: r.out.spending, taxes: r.out.taxes, withdrawn: r.from.cash + r.from.taxable + r.from.deferred + r.from.free, end: r.end.total, short: r.shortfall })),
    market: st.ready ? st.scenarios.filter((s) => s.group === "market").map((s) => ({ title: s.title, success: s.success, failAge: s.failAge, endReal: s.endReal })) : null,
    hitYear: st.ready ? st.hitYear : null,
  };
}
