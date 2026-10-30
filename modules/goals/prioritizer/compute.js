// modules/goals/prioritizer/compute.js -- PURE. The money left each month for goals (what is left after tax,
// spending and retirement saving, plus what already goes to goals), shared out: must-haves first, then
// wants, then nice-to-haves, the nearest date first within each; each goal gets what it needs to arrive on
// time while the money lasts. Which goals arrive on time, how late the others would be, and what is left over.
import { compute as computeGoals } from "../goals/compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { solveMonths } from "../house/compute.js";

/**
 * compute(plan, { today }) -> {
 *   ready, available (a month), fromPlan (the plan's own figure) | null, override (set by you) | null,
 *   rows: [{ id, name, icon, priority, targetDate, needed (to arrive on time), current (the goal's monthly now), allocated, onTime, finishMonths, slipMonths, noDate }],
 *   neededTotal, allocatedTotal, leftover, short (needed beyond what is available)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const g = computeGoals(plan, { today });
  const nb = today ? computeNext(plan, { today }) : { ready: false };
  const fromPlan = nb.ready ? Math.max(0, nb.spare.monthly + nb.spare.goalSaving) : null;
  const o = plan.whatIfs?.prioritizer?.available;
  const override = o !== null && o !== undefined && o !== "" && Number.isFinite(Number(o)) ? Math.max(0, Number(o)) : null;
  const available = override ?? fromPlan ?? 0;
  const open = g.goals.filter((x) => x.status !== "done" && (Number(x.remaining) || 0) > 0);
  const order = [...open].sort((a, b) => (Number(a.priority) || 2) - (Number(b.priority) || 2) || String(a.targetDate || "9999").localeCompare(String(b.targetDate || "9999")));
  let money = available;
  const rows = order.map((x) => {
    const dated = x.neededMonthly !== null && x.neededMonthly !== undefined && Number.isFinite(x.neededMonthly);
    const needed = dated ? Math.max(0, x.neededMonthly) : null;
    const allocated = dated ? Math.min(money, needed) : 0;
    money -= allocated;
    return { id: x.id, name: x.name, icon: x.icon, priority: Number(x.priority) || 2, targetDate: x.targetDate || "", needed, current: Number(x.monthly) || 0, allocated, rate: x.rate, funded: x.funded, targetThen: x.targetThen, monthsLeft: x.monthsLeft, noDate: !dated };
  });
  // what is left goes to the goals without a date, in order, each up to what finishes it in a year
  for (const r of rows.filter((y) => y.noDate)) { if (money <= 0) break; const give = Math.min(money, Math.max(0, (r.targetThen - r.funded) / 12)); r.allocated = give; money -= give; }
  for (const r of rows) {
    r.onTime = r.noDate ? null : r.allocated >= (r.needed ?? 0) - 0.5;
    r.finishMonths = solveMonths((r.rate ?? 0) / 12, r.funded ?? 0, r.allocated, r.targetThen ?? 0);
    r.slipMonths = r.noDate || r.onTime || !Number.isFinite(r.finishMonths) || r.monthsLeft === null ? (r.onTime ? 0 : null) : Math.max(0, r.finishMonths - r.monthsLeft);
  }
  const neededTotal = rows.reduce((t, r) => t + (r.needed ?? 0), 0);
  const allocatedTotal = rows.reduce((t, r) => t + r.allocated, 0);
  return { ready: true, available, fromPlan, override, rows, neededTotal, allocatedTotal, leftover: Math.max(0, available - allocatedTotal), short: Math.max(0, neededTotal - available), count: rows.length };
}
