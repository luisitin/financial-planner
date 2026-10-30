// modules/reports/plan-summary/compute.js -- PURE and heavy. Everything an advisor's plan summary
// holds, gathered from the pages that work it out: who the plan is for, where you stand, each month's
// money, the plan's health, retirement (with the chance the money lasts), protection, goals, debts,
// the milestones ahead, the next steps and the assumptions behind it all. The view lays it out as a
// printable document.
import { compute as computePeople } from "../../household/people/compute.js";
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { compute as computeHealth } from "../../overview/health-score/compute.js";
import { compute as computeProjection } from "../../retirement/projection/compute.js";
import { compute as computeMonteCarlo } from "../../retirement/monte-carlo/compute.js";
import { compute as computeStress } from "../../scenarios/stress-tests/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeTimeline } from "../../overview/timeline/compute.js";
import { compute as computeSocialSecurity } from "../../retirement/social-security/compute.js";
import { compute as computePayoff } from "../../debt/payoff/compute.js";

/** Paths for the chance the money lasts in the summary (fewer than the Chance page's default; the PC caps it anyway). */
export const SUMMARY_PATHS = 1000;
/** How far ahead the summary's milestones reach. */
export const MILESTONE_YEARS = 10;

/**
 * compute(plan, { today }) -> {
 *   ready, missing, today, household: { name, people: [{ name, role, age }], filing, state },
 *   netWorth, cashflow (next-best-action's spare) | null, health: { score, band, gains } | null,
 *   retirement: { ready, verdict, retireYear, atRetirementReal, success, lastsTo, shortYear, shortAge, affordableMonthly, spendingMonthly, chance, medianEndReal, socialSecurityMonthly } ,
 *   protection: { passed, total, failing: [{ title, failAge, failYear }] } | null,
 *   goals: [...], debts: [...], milestones: [timeline events, next MILESTONE_YEARS], nextSteps: [{ title, detail }], assumptions
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const ppl = computePeople(plan, { today });
  if (!ppl.count) return { ready: false, missing: ["the people in your household"] };
  const year = Number(today.slice(0, 4));
  const nw = computeNetWorth(plan, { today });
  const nb = computeNext(plan, { today });
  const pr = computeProjection(plan, { today });
  const health = computeHealth(plan, { today });
  const mc = pr.ready ? computeMonteCarlo(plan, { today, paths: Math.min(SUMMARY_PATHS, params.maxPaths ?? SUMMARY_PATHS), seed: 1 }) : null;
  const st = pr.ready ? computeStress(plan, { today }) : null;
  const gl = computeGoals(plan, { today });
  const li = computeLiabilities(plan, { today });
  const tl = computeTimeline(plan, { today });
  const ss = computeSocialSecurity(plan, { today });
  const payoffPlan = computePayoff(plan, { today }).chosen;
  const a = plan.assumptions ?? {};

  const retirement = pr.ready ? {
    ready: true, verdict: pr.verdict, retireYear: pr.atRetirement?.year ?? null, atRetirementReal: pr.atRetirement?.totalReal ?? null,
    success: pr.result.success, lastsTo: pr.result.success ? pr.atEnd.year : null, shortYear: pr.shortYear, shortAge: pr.shortAge,
    endReal: pr.atEnd.totalReal, affordableMonthly: pr.affordable / 12, spendingMonthly: pr.spendingYearly / 12,
    chance: mc?.ready ? mc.successRate : null, medianEndReal: mc?.ready ? mc.medianEndReal : null, paths: mc?.paths ?? null,
    socialSecurityMonthly: ss.householdYearly / 12,
  } : { ready: false, missing: pr.missing };

  const nextSteps = [];
  if (nb.ready && nb.next) nextSteps.push({ title: nb.next.title, detail: nb.next.detail });
  for (const g of health.ready ? health.gains : []) if (g.fix && nextSteps.length < 4 && !nextSteps.some((s) => s.detail === g.fix)) nextSteps.push({ title: g.title, detail: g.fix });

  return {
    ready: true, missing: [], today,
    household: { name: plan.meta?.name || "", people: ppl.people.map((p) => ({ name: p.name, role: p.role, age: p.age, retirementAge: p.role === "dependent" ? null : p.retirementAge })), filing: ppl.filingLabel, state: ppl.state },
    netWorth: { assets: nw.assets, liabilities: nw.liabilities, netWorth: nw.netWorth, cash: nw.cash, investable: nw.investable, byTaxBucket: nw.byTaxBucket, change: nw.change },
    cashflow: nb.ready ? nb.spare : null,
    health: health.ready ? { score: health.score, band: health.band, parts: health.parts.map((p) => ({ title: p.title, points: p.points, max: p.max, status: p.status })) } : null,
    retirement,
    protection: st?.ready ? { passed: st.passed, total: st.total, failing: st.scenarios.filter((s) => !s.success).map((s) => ({ title: s.title, failAge: s.failAge, failYear: s.failYear, roomMonthly: s.roomMonthly })) } : null,
    goals: gl.goals.map((g) => ({ name: g.name, icon: g.icon, target: g.targetThen ?? g.target, targetDate: g.targetDate, status: g.status, progress: g.progress, monthly: g.monthly, neededMonthly: g.neededMonthly })),
    // payoff dates from the payoff plan (freed payments roll onto the next debt), as on the timeline; a debt outside the plan keeps its own date
    debts: li.rows.filter((r) => r.owed > 0).map((r) => ({ name: r.name, owed: r.owed, rate: r.rate, payment: r.payment, payoffDate: payoffPlan?.debts.find((x) => x.id === r.id)?.endDate ?? r.payoffDate })),
    milestones: tl.ready ? tl.events.filter((e) => e.kind !== "now" && e.year <= year + MILESTONE_YEARS).slice(0, 10).map((e) => ({ date: e.date, year: e.year, title: e.title, icon: e.icon })) : [],
    nextSteps,
    assumptions: { inflation: Number(a.inflation ?? 0.03), returnStocks: Number(a.returnStocks ?? 0.07), returnBonds: Number(a.returnBonds ?? 0.04), retirementAge: Number(a.retirementAge ?? 65), planEndAge: Number(a.planEndAge ?? 95), taxMode: plan.retirement?.taxMode ?? "flat" },
  };
}
