// modules/overview/health-score/compute.js -- PURE and heavy. One number from 0 to 100 for the whole
// plan, built from seven parts, each scored from the page that works it out: the cash cushion, how
// much of each month's money is saved, debt, whether retirement is on track, protection (the stress
// tests' life shocks), goals, and whether the plan knows enough and is up to date. Every part says
// what it would take to earn the points it is missing.
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeProjection } from "../../retirement/projection/compute.js";
import { compute as computeStress } from "../../scenarios/stress-tests/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeNext } from "../next-best-action/compute.js";
import { daysBetween } from "../../../core/math/dates.js";
import { money as fmtMoney } from "../../../core/format.js";

/** The parts and their weights (they add to 100). */
export const PARTS = { cushion: 15, saving: 15, debt: 15, retirement: 25, protection: 15, goals: 5, knows: 10 };
/** A healthy share of after-tax income saved (retirement, goals and what is left over): 20%, the "20" of the 50/30/20 rule. */
export const SAVING_TARGET = 0.2;
/** Lenders' line for total debt payments against gross income (the qualified-mortgage rule's 43%); 36% is the comfortable one. */
export const DTI = { good: 0.36, max: 0.43 };
export const BANDS = [{ min: 85, label: "Strong" }, { min: 70, label: "Good" }, { min: 50, label: "Fair" }, { min: 0, label: "Needs work" }];

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * compute(plan, { today }) -> {
 *   ready, missing, score (0-100, whole), band, parts: [{ id, title, points, max, share, status: "ok"|"warn"|"bad"|"unknown", detail, fix, go }],
 *   gains: parts sorted by points missing (largest first)
 * }
 * A part the plan cannot judge yet scores 0 with status "unknown" and a fix that says what to add.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(Math.round(n / 10) * 10, cur);
  const parts = [];
  const add = (id, title, share, detail, fix, go, status) => {
    const max = PARTS[id];
    const s = share === null ? 0 : clamp01(share);
    parts.push({ id, title, max, points: Math.round(s * max * 10) / 10, share: share === null ? null : s, status: status ?? (share === null ? "unknown" : s >= 0.9 ? "ok" : s >= 0.5 ? "warn" : "bad"), detail, fix: s >= 0.999 ? null : fix, go });
  };

  // 1. the cash cushion: months of must-pay bills in usable cash against the plan's target
  const liq = computeLiquidity(plan, { today });
  if (liq.runwayMonths === null) add("cushion", "Cash cushion", null, "No must-pay expenses yet, so the cushion cannot be measured.", "Add your expenses and mark the ones you cannot skip.", ["cashflow", "expenses"]);
  else add("cushion", "Cash cushion", liq.runwayMonths / liq.targetMonths, `Usable cash covers ${Math.round(liq.runwayMonths * 10) / 10} months of must-pay bills; the plan aims for ${liq.targetMonths}.`, `${money(liq.gap)} more in cash you can reach in a day fills it.`, ["balance", "liquidity"]);

  // 2. saving: retirement, goals and what is left over, as a share of income after tax
  const nb = computeNext(plan, { today });
  if (!nb.ready) add("saving", "Saving each month", null, "Income and expenses are needed to see how much of each month is saved.", "Fill in the Income and Expenses pages.", ["cashflow", "income"]);
  else {
    const s = nb.spare, afterTax = s.gross - s.federalTax - s.payrollTax;
    const saved = s.retirementSaving + s.goalSaving + s.monthly;
    const rate = afterTax > 0 ? saved / afterTax : 0;
    add("saving", "Saving each month", rate / SAVING_TARGET, rate >= 0 ? `About ${Math.round(rate * 100)}% of income after tax is saved or left over (retirement ${money(s.retirementSaving)}, goals ${money(s.goalSaving)}, spare ${money(Math.max(0, s.monthly))} a month).` : `About ${money(-s.monthly)} a month more goes out than comes in after tax.`, `Saving ${Math.round(SAVING_TARGET * 100)}% of income after tax earns full marks: about ${money(Math.max(0, SAVING_TARGET * afterTax - saved))} a month more.`, ["overview", "next-best-action"]);
  }

  // 3. debt: expensive balances against a year's income, and the share of income that goes to payments
  const li = computeLiabilities(plan, { today });
  const yearly = nb.ready ? nb.spare.gross * 12 : (li.income ?? 0) * 12;
  const expensive = li.rows.filter((r) => r.owed > 0 && r.rate !== null && r.rate >= 0.1 && r.type !== "mortgage");
  const expensiveOwed = expensive.reduce((s, r) => s + r.owed, 0);
  const highShare = yearly > 0 ? 1 - Math.min(1, expensiveOwed / (yearly * 0.25)) : expensiveOwed > 0 ? 0 : 1;
  const dtiShare = li.dti === null ? 1 : li.dti <= DTI.good ? 1 : li.dti <= DTI.max ? 0.5 : 0;
  add("debt", "Debt", (highShare * 2 + dtiShare) / 3, [expensiveOwed > 0 ? `${money(expensiveOwed)} of debt at 10% or more (${expensive.map((r) => r.name).join(", ")}).` : "No debt at 10% or more.", li.dti !== null ? `Payments take ${Math.round(li.dti * 100)}% of gross income${li.dti > DTI.good ? `; lenders like ${Math.round(DTI.good * 100)}% or less` : ""}.` : ""].join(" "), expensiveOwed > 0 ? `Paying off ${expensive.map((r) => r.name).join(" and ")} earns these points back fastest.` : `Bring debt payments under ${Math.round(DTI.good * 100)}% of gross income.`, ["debt", "payoff"]);

  // 4. retirement: the spending the plan can carry against the spending it plans
  const pr = computeProjection(plan, { today });
  if (!pr.ready) add("retirement", "Retirement on track", null, "The plan cannot be run yet.", `Add ${pr.missing.join(" and ")}.`, ["retirement", "projection"]);
  else {
    const ratio = pr.spendingYearly > 0 ? pr.affordable / pr.spendingYearly : 1;
    add("retirement", "Retirement on track", (ratio - 0.6) / 0.55, pr.result.success ? `The plan can carry about ${money(pr.affordable / 12)} a month against the ${money(pr.spendingYearly / 12)} it plans (${Math.round(ratio * 100)}%).` : `The money runs out in ${pr.shortYear}: it can carry about ${money(pr.affordable / 12)} a month against the ${money(pr.spendingYearly / 12)} planned.`, ratio < 1.15 ? `Full marks at 115% (room for bad luck): about ${money(Math.max(0, (1.15 * pr.spendingYearly - pr.affordable) / 12))} a month less spending, or the same in more saving or later retirement (Goal seek).` : null, ["scenarios", "goal-seek"]);
  }

  // 5. protection: the stress tests' life shocks (job loss, never working again, a death, a care home, a long life)
  const st = pr.ready ? computeStress(plan, { today }) : null;
  const life = st?.ready ? st.scenarios.filter((s) => s.group === "life") : [];
  if (!life.length) add("protection", "Protection", null, "The stress tests need the plan basics first.", "Fill in the basics on Will the money last?", ["scenarios", "stress-tests"]);
  else {
    const passed = life.filter((s) => s.success);
    const failed = life.filter((s) => !s.success);
    add("protection", "Protection", passed.length / life.length, failed.length ? `The money lasts through ${passed.length} of ${life.length} of life's shocks; not "${failed.map((s) => s.title).join('" or "')}".` : `The money lasts through all ${life.length} of life's shocks in the stress tests.`, failed.some((s) => s.id.startsWith("death-") || s.id === "disability") ? "Life and disability insurance are what close these gaps; the stress tests show how much each shock is short." : "The stress tests show what each shock is short.", ["scenarios", "stress-tests"]);
  }

  // 6. goals: dated goals on track or done
  const gl = computeGoals(plan, { today });
  const dated = gl.goals.filter((g) => g.targetDate && g.status !== "no amount");
  if (!dated.length) add("goals", "Goals", null, "No goals with a date yet.", "Add what you are saving for, with a date, on the Goals page.", ["goals", "goals"]);
  else {
    const good = dated.filter((g) => g.status === "done" || g.status === "on track");
    add("goals", "Goals", good.length / dated.length, `${good.length} of ${dated.length} goals with a date are done or on track.`, `${dated.filter((g) => !good.includes(g)).map((g) => g.name).join(", ")} ${dated.length - good.length === 1 ? "needs" : "need"} more each month (Goals).`, ["goals", "goals"]);
  }

  // 7. the plan knows enough, and it is current
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const ss = plan.retirement?.socialSecurity ?? {};
  const checks = [
    ["birth dates for every adult", people.length > 0 && people.every((p) => p.birthDate)],
    ["accounts", (plan.accounts ?? []).length > 0],
    ["balances updated in the last 90 days", (plan.accounts ?? []).length > 0 && (plan.accounts ?? []).every((a) => a.asOf && daysBetween(a.asOf, today) <= 90)],
    ["income and expenses", (plan.income ?? []).length > 0 && (plan.expenses ?? []).length > 0],
    ["a Social Security figure for every adult", people.length > 0 && people.every((p) => ss[p.id] && (Number(ss[p.id].monthlyAtFRA) > 0 || (ss[p.id].record ?? []).length))],
    ["what you will spend in retirement", Number(plan.retirement?.spendingMonthly) > 0],
    ["assumptions looked over in the last year", !!plan.assumptions?.reviewedAt && daysBetween(plan.assumptions.reviewedAt, today) <= 365],
  ];
  const have = checks.filter((c) => c[1]);
  add("knows", "The plan knows enough", have.length / checks.length, have.length === checks.length ? "Everything the score leans on is filled in and current." : `${have.length} of ${checks.length} things the score leans on are filled in and current.`, `Still to do: ${checks.filter((c) => !c[1]).map((c) => c[0]).join("; ")}.`, ["overview", "alerts"]);

  const score = Math.round(parts.reduce((s, p) => s + p.points, 0));
  const band = BANDS.find((b) => score >= b.min).label;
  const gains = [...parts].filter((p) => p.max - p.points >= 0.5).sort((a, b) => (b.max - b.points) - (a.max - a.points));
  return { ready: true, missing: [], score, band, parts, gains };
}
