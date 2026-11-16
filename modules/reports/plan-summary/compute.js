// modules/reports/plan-summary/compute.js -- PURE and heavy. Everything an advisor's plan summary
// holds, gathered from the pages that work it out: who the plan is for, where you stand, each month's
// money, the plan's health, retirement (with the chance the money lasts), protection, goals, debts,
// the milestones ahead, the next steps and the assumptions behind it all. The view lays it out as a
// printable sheet.
import { compute as computePeople } from "../../household/people/compute.js";
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";
import { compute as computeNext, monthWords } from "../../overview/next-best-action/compute.js";
import { goalsBehind } from "../../overview/alerts/compute.js";
import { compute as computeHealth } from "../../overview/health-score/compute.js";
import { compute as computeProjection, savingsUnknown, nothingSaved } from "../../retirement/projection/compute.js";
import { compute as computeMonteCarlo } from "../../retirement/monte-carlo/compute.js";
import { compute as computeStress } from "../../scenarios/stress-tests/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeTimeline } from "../../overview/timeline/compute.js";
import { compute as computeSocialSecurity } from "../../retirement/social-security/compute.js";
import { compute as computePayoff } from "../../debt/payoff/compute.js";
import { marksOf, sumMark, debtMarks, GUESS, PARTLY, ESTIMATE } from "../guess-marks.js";

/** Paths for the chance the money lasts in the summary (fewer than the Chance page's default; the PC caps it anyway). */
export const SUMMARY_PATHS = 1000;
/** How far ahead the summary's milestones reach. */
export const MILESTONE_YEARS = 10;
/**
 * Where the sheet's retirement answer is "not known yet" (Will the money last?'s own gate: savingsUnknown on the same run), the
 * Plan health score's retirement step and row follow that answer, not the score's "Retirement on track" (z2, 2026-11-16:
 * Riley's sheet said "Retirement: not known yet", then "Retirement on track. Once you start saving, add it and we can answer.").
 * The step is the sheet's own, one action sentence per case (z2 fix round, critic M1 and P1: "Retirement: not known yet" read as
 * a label, "add it" named nothing, and where the score waits for Social Security the step asked for Social Security under an
 * opening that says nothing is saved): told us nothing is saved, or told us nothing about retirement savings.
 */
export const UNKNOWN_STEPS = {
  nothingSaved: { title: "Start saving for retirement", detail: "Once you add what you have saved, we can say whether the money will last." },
  untold: { title: "Add your retirement savings", detail: "Once they are on the Net worth page, we can say whether the money will last." },
};
/** The sheet's retirement step for the gate's two cases. */
export const unknownStep = (nothingSavedToo) => UNKNOWN_STEPS[nothingSavedToo ? "nothingSaved" : "untold"];
export const UNKNOWN_PART = "Retirement";
/**
 * The score's parts that wait for the same answer (its retirement part, and protection: "the stress tests need what you own
 * first, like the retirement part"): under "not known yet" their row says so (`notKnown`), as the Plan health page does, not
 * "0 out of 25". A part the score could not judge for another reason (Goals with no dated goal) keeps its points, as on every
 * other sheet (critic M2, P4).
 */
export const NOT_KNOWN_PARTS = ["retirement", "protection"];

/**
 * compute(plan, { today }) -> {
 *   ready, missing, today, household: { name, people: [{ name, role, age }], filing, state },
 *   netWorth, cashflow (next-best-action's spare) | null, health: { score, band, parts: [{ title, points, max, status, notKnown? (under "not known yet": a part waiting for the same answer) }] } | null,
 *   retirement: { ready, unknown (Will the money last?'s "We don't know yet"), nothingSaved? (with unknown: told us nothing is saved), verdict, retireYear, atRetirementReal, success, lastsTo, shortYear, shortAge, affordableMonthly, spendingMonthly, chance, medianEndReal, socialSecurityMonthly, hint } ,
 *   protection: { passed, total, failing: [{ title, failAge, failYear }] } | null,
 *   goals: [...], debts: [...], milestones: [timeline events, next MILESTONE_YEARS], nextSteps: [{ title, detail }], assumptions,
 *   ours? (smart guesses C8: only while a figure printed rests on our guesses, or with params.estimates on one worked out
 *     where nothing was typed; ../guess-marks.js marks "guess" | "partly" | "estimate"): { netWorth, assets, liabilities, cash, investable, income, spending, retirementSaving, planned, socialSecurity,
 *     savedBy, goals: [mark per goal], debts: [{ owed, rate, payment } per debt] }
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
  const mc = pr.ready ? computeMonteCarlo(plan, { today, paths: Math.min(SUMMARY_PATHS, params.maxPaths ?? SUMMARY_PATHS), seed: 1, careful: false }) : null;
  const st = pr.ready ? computeStress(plan, { today }) : null;
  const gl = computeGoals(plan, { today });
  const gb = goalsBehind(gl, { nba: nb, today });
  const li = computeLiabilities(plan, { today });
  const tl = computeTimeline(plan, { today });
  const ss = computeSocialSecurity(plan, { today });
  const payoffPlan = computePayoff(plan, { today }).chosen;
  const a = plan.assumptions ?? {};

  const unknown = pr.ready && savingsUnknown(pr);
  const retirement = pr.ready ? {
    ready: true, unknown, ...(unknown ? { nothingSaved: nothingSaved(plan) } : {}), verdict: pr.verdict, retireYear: pr.atRetirement?.year ?? null, atRetirementReal: pr.atRetirement?.totalReal ?? null,
    success: pr.result.success, lastsTo: pr.result.success ? pr.atEnd.year : null, shortYear: pr.shortYear, shortAge: pr.shortAge,
    endReal: pr.atEnd.totalReal, affordableMonthly: pr.affordable / 12, spendingMonthly: pr.spendingYearly / 12,
    chance: mc?.ready ? mc.successRate : null, medianEndReal: mc?.ready ? mc.medianEndReal : null, paths: mc?.paths ?? null,
    socialSecurityMonthly: ss.householdYearly / 12,
    // what makes the money last, in Goal seek's answers (the Plan health score's retirement hint; round 8 review, 2026-11-06:
    // "spend about $2,040 a month less" was all of the planned spending, and did not make it last)
    hint: health.ready ? health.parts.find((p) => p.id === "retirement")?.hint ?? null : null,
  } : { ready: false, missing: pr.missing };

  const nextSteps = [];
  if (nb.ready && nb.next) nextSteps.push({ title: nb.next.title, detail: nb.next.detail });
  // (not known yet: the score's retirement step is the sheet's own, whatever the score waits for; every other step as the score words it)
  const stepOf = (p) => (unknown && p.id === "retirement" ? unknownStep(retirement.nothingSaved) : { title: p.title, detail: p.fix });
  for (const g of health.ready ? health.gains : []) {
    if (!g.fix || nextSteps.length >= 4) continue;
    const step = stepOf(g);
    if (!nextSteps.some((s) => s.detail === step.detail)) nextSteps.push({ title: step.title, detail: step.detail });
  }

  const ours = summaryMarks(plan, { nb, pr, gl, li, estimates: !!params.estimates });
  return {
    ...(ours ? { ours } : {}),
    ready: true, missing: [], today,
    household: { name: plan.meta?.name || "", people: ppl.people.map((p) => ({ name: p.name, role: p.role, age: p.age, retirementAge: p.role === "dependent" ? null : p.retirementAge })), filing: ppl.filingLabel, state: ppl.state },
    netWorth: { assets: nw.assets, liabilities: nw.liabilities, netWorth: nw.netWorth, cash: nw.cash, investable: nw.investable, byTaxBucket: nw.byTaxBucket, change: nw.change },
    cashflow: nb.ready ? nb.spare : null,
    health: health.ready ? { score: health.score, band: health.band, parts: health.parts.map((p) => ({ title: unknown && p.id === "retirement" ? UNKNOWN_PART : p.title, points: p.points, max: p.max, status: p.status, ...(unknown && p.status === "unknown" && NOT_KNOWN_PARTS.includes(p.id) ? { notKnown: true } : {}) })) } : null,
    retirement,
    protection: st?.ready ? { passed: st.passed, total: st.total, failing: st.scenarios.filter((s) => !s.success).map((s) => ({ title: s.title, failAge: s.failAge, failYear: s.failYear, roomMonthly: s.roomMonthly })) } : null,
    // a goal waiting its turn on Next best action reads "starts later", as on Goals and the Timeline (review 2026-11-02)
    goals: gl.goals.map((g) => ({ name: g.name, icon: g.icon, target: g.targetThen ?? g.target, targetDate: g.targetDate, status: gb.queued.some((q) => q.id === g.id) ? "starts later" : g.status, startsIn: gb.queued.some((q) => q.id === g.id) ? monthWords(gb.turn) : null, progress: g.progress, monthly: g.monthly, neededMonthly: g.neededMonthly })),
    // payoff dates from the payoff plan (freed payments roll onto the next debt), as on the timeline; a debt outside the plan keeps its own date
    debts: li.rows.filter((r) => r.owed > 0).map((r) => ({ name: r.name, owed: r.owed, rate: r.rate, payment: r.payment, payoffDate: payoffPlan?.debts.find((x) => x.id === r.id)?.endDate ?? r.payoffDate, ownPayoffDate: payoffPlan?.debts.find((x) => x.id === r.id)?.endDate && r.payoffDate && r.payoffDate.slice(0, 7) > payoffPlan.debts.find((x) => x.id === r.id).endDate.slice(0, 7) ? r.payoffDate : null })),
    milestones: tl.ready ? tl.events.filter((e) => e.kind !== "now" && e.year <= year + MILESTONE_YEARS).slice(0, 10).map((e) => ({ date: e.date, year: e.year, title: e.title, icon: e.icon })) : [],
    nextSteps,
    assumptions: { inflation: Number(a.inflation ?? 0.03), returnStocks: Number(a.returnStocks ?? 0.07), returnBonds: Number(a.returnBonds ?? 0.04), retirementAge: Number(a.retirementAge ?? 65), planEndAge: Number(a.planEndAge ?? 95), taxMode: plan.retirement?.taxMode ?? "flat" },
  };
}

/**
 * The summary's figures that rest on our guesses (smart guesses C8), or null: net worth and its parts when a balance in them is
 * ours; the month's income, spending and retirement saving by the rows in them; retirement's planned spending (our guess, or
 * our estimate when it is taken from today's expenses with no figure set) and Social Security; each goal's amount; each debt's
 * owed, rate and payment.
 */
export function summaryMarks(plan, { nb, pr, gl, li, estimates = false }) {
  const m = marksOf(plan);
  // (a figure worked out where nothing was typed is marked only when the page asks, `params.estimates`: so a plan with no
  // guess computes exactly as before; spec 8.4)
  const est = estimates && !!pr?.ready && pr.spendingSource === "expenses";
  if (!m && !est) return null;
  const acc = plan.accounts ?? [];
  const balOf = (types) => sumMark(acc.filter((a) => types.includes(a.type)).map((a) => ({ ours: !!m?.accounts.has(a.id), amount: a.balance })));
  const s = nb?.ready ? nb.spare : null;
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const ssOurs = m ? people.filter((p) => m.socialSecurity.has(p.id)).length : 0;
  const out = {
    netWorth: m && (m.assets || m.liabilities) ? PARTLY : null,
    assets: m?.assets ? PARTLY : null,
    liabilities: m?.liabilities ? PARTLY : null,
    cash: m ? balOf(["checking", "savings", "cash"]) : null,
    investable: m ? balOf(["brokerage", "401k", "ira", "roth", "hsa", "529", "crypto"]) : null,
    income: m ? sumMark((plan.income ?? []).map((x) => ({ ours: m.income.has(x.id), amount: x.amount }))) : null,
    spending: s && s.guessedMonthly > 0 ? (s.spending - s.guessedMonthly < 5 ? GUESS : PARTLY) : null,
    retirementSaving: m ? sumMark((plan.retirement?.contributions ?? []).map((c) => ({ ours: m.contributions.has(c.id), amount: c.amount }))) : null,
    planned: m?.retireSpend ? GUESS : est ? ESTIMATE : null,
    socialSecurity: ssOurs ? (ssOurs === people.length ? GUESS : PARTLY) : null,
    // (nothing saved for retirement on file, or nothing there by then: the figure is not one we filled in, so no mark; the
    // sheet says "Not entered yet"; critic F3)
    savedBy: m && !savingsUnknown(pr) && Math.abs(Number(pr?.atRetirement?.totalReal) || 0) >= 0.5 ? balOf(["brokerage", "401k", "ira", "roth", "hsa", "crypto", "checking", "savings", "cash"]) : null,
    goals: (gl?.goals ?? []).map((g) => (m?.goals.has(g.id) ? GUESS : null)),
    debts: (li?.rows ?? []).filter((r) => r.owed > 0).map((r) => debtMarks(m, r.id, r.detail?.id)),
  };
  // nothing it prints is ours after all (a guess on a figure the summary does not show): no key
  const any = Object.entries(out).some(([k, v]) => (Array.isArray(v) ? v.some((x) => x && (typeof x === "string" || Object.keys(x).length)) : !!v));
  return any ? out : null;
}

