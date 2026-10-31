// modules/taxes/estimated/compute.js -- PURE. Quarterly estimated payments: what the year's
// tax comes to, how much of it withholding will cover, the safe-harbour amount that keeps you
// clear of the underpayment penalty, what is due each quarter, and where you stand today.
import { compute as computeFederal } from "../federal/compute.js";
import { projectedWithholding, safeHarbour } from "../withholding/compute.js";
import { dueDay } from "../../household/calendar/compute.js";
import { compute as computePaycheck } from "../../cashflow/paycheck/compute.js";

/**
 * The IRS quarters of a tax year: the income period each covers and the day the payment is due (IRC 6654(c)(2):
 * April 15, June 15, September 15 and January 15 of the next year), moved to the next business day when that falls on
 * a Saturday, Sunday or legal holiday (IRC 7503; the Money calendar's dueDay with the District of Columbia's holidays).
 * A state's own holiday does not move them: Patriots' Day moves a Maine or Massachusetts resident's return, not an
 * estimated payment (Rev. Rul. 2015-13; Form 1040-ES (2024) printed April 15, 2024 for everyone). The second argument is
 * accepted and ignored.
 */
export const QUARTERS = (year) => [
  { n: 1, label: "1st quarter", covers: `Jan to Mar ${year}`, due: dueDay(`${year}-04-15`) },
  { n: 2, label: "2nd quarter", covers: `Apr and May ${year}`, due: dueDay(`${year}-06-15`) },
  { n: 3, label: "3rd quarter", covers: `Jun to Aug ${year}`, due: dueDay(`${year}-09-15`) },
  { n: 4, label: "4th quarter", covers: `Sep to Dec ${year}`, due: dueDay(`${year + 1}-01-15`) },
];

/**
 * compute(plan, { today }) -> {
 *   year, totalTax, withholding (projected for the year), withholdingFrom ("typed": the Withholding check page or the year so far; "paycheck": estimated
 *   from pay on the Paycheck page; "none"), harbour: safeHarbour, toPayByEstimates (required - withholding, floor 0),
 *   perQuarter, quarters: [{ n, label, covers, due, paid, share, cumulative (required by its due date), status: "paid" | "due" | "short" | "upcoming"
 *   (from everything paid so far), late (its own and earlier boxes were short on its due date) }],
 *   paid (total so far), remaining (still to pay for the year), behind (the share of quarters already past due that is not paid),
 *   overdue: { due (the first quarter not covered), amount: behind } | null, nextDue: { due, label, amount (that quarter's share on top of what is behind) } | null
 *   (the next quarter not yet past), balanceAtFiling (total tax - withholding - paid), lateQuarter: the first late quarter | null,
 *   penaltyRisk: bool, needsEstimates: bool, hasPrior, priorTax, priorAgi, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const fed = computeFederal(plan, params);
  // withholding: the figures typed on the Withholding check page; with none, the Paycheck page's estimate from pay
  let wh = projectedWithholding(plan, params), withholdingFrom = wh.hasSetup ? "typed" : "none";
  if (!wh.hasSetup) {
    const pc = computePaycheck(plan, params);
    const yearly = pc.ready ? pc.people.reduce((s, p) => s + (Number(p.yearly?.federal) || 0), 0) : 0;
    if (yearly > 0) { wh = { ...wh, projected: yearly }; withholdingFrom = "paycheck"; }
  }
  const t = plan.taxes ?? {};
  const totalTax = Math.max(0, fed.result.totalTax);
  const harbour = safeHarbour(totalTax, t.priorYear?.tax, t.priorYear?.agi, fed.filingStatus);
  const paidList = (t.estimated?.paid ?? [0, 0, 0, 0]).map((x) => Math.max(0, Number(x) || 0));
  const paid = paidList.reduce((s, x) => s + x, 0);
  const toPayByEstimates = Math.max(0, harbour.required - wh.projected);
  const balanceAfterWithholding = totalTax - wh.projected;
  const needsEstimates = balanceAfterWithholding >= 1000 && toPayByEstimates > 0;
  const perQuarter = needsEstimates ? toPayByEstimates / 4 : 0;
  // a quarter is covered when everything paid so far reaches its cumulative share (a payment counts against the earliest
  // unpaid quarter, IRC 6654(b)(3)); it was late when its own and the earlier boxes fell short on its due date (6654(b))
  let cum = 0, cumBoxes = 0;
  const quarters = QUARTERS(fed.year).map((q, i) => {
    cum += perQuarter; cumBoxes += paidList[i];
    const past = today ? today > q.due : false;
    const status = !needsEstimates ? "none" : paid >= cum - 1 ? "paid" : past ? "short" : today && today >= q.due.slice(0, 8) + "01" ? "due" : "upcoming";
    return { ...q, paid: paidList[i], share: perQuarter, cumulative: cum, status, late: needsEstimates && past && cumBoxes < cum - 1 };
  });
  const remaining = Math.max(0, toPayByEstimates - paid);
  // behind: what the quarters already past due required and was not paid; the next payment is the first quarter not yet past
  const past = quarters.filter((q) => today && today > q.due);
  const behind = needsEstimates && past.length ? Math.max(0, Math.min(remaining, past[past.length - 1].cumulative - paid)) : 0;
  const firstShort = past.find((q) => q.status === "short");
  const overdue = behind > 0 && firstShort ? { due: firstShort.due, label: firstShort.label, amount: behind } : null;
  const next = quarters.find((q) => !(today && today > q.due) && q.status !== "paid");
  const nextDue = needsEstimates && next ? { due: next.due, label: next.label, amount: Math.max(0, Math.min(remaining, next.cumulative - paid) - behind) } : null;
  const balanceAtFiling = totalTax - wh.projected - paid;
  const notes = [];
  if (!fed.hasIncome) notes.push("No income on file yet: add it on the Income page or type it on the Federal estimate page.");
  if (withholdingFrom === "paycheck") notes.push("Withholding is estimated from your pay on the Paycheck page. Type what your pay stubs withhold on the Withholding check page for a firmer figure.");
  if (harbour.prior === null) notes.push("Type last year's total tax and income below: paying 100% of last year's tax is often the smaller safe amount, and it is certain.");
  // the penalty is figured for each due date on its own (Form 2210 instructions): a quarter paid late counts even once caught up
  const lateQuarter = quarters.find((q) => q.late) ?? null;
  return { year: fed.year, totalTax, withholding: wh.projected, withholdingFrom, withholdingDetail: wh, harbour, toPayByEstimates, perQuarter, quarters, paid, remaining, behind, overdue, nextDue, balanceAtFiling, lateQuarter, penaltyRisk: needsEstimates && paid + 1 < toPayByEstimates && !!lateQuarter, needsEstimates, hasPrior: harbour.prior !== null, priorTax: t.priorYear?.tax ?? null, priorAgi: t.priorYear?.agi ?? null, notes, hasIncome: fed.hasIncome, balanceAfterWithholding };
}
