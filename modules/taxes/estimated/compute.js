// modules/taxes/estimated/compute.js -- PURE. Quarterly estimated payments: what the year's
// tax comes to, how much of it withholding will cover, the safe-harbour amount that keeps you
// clear of the underpayment penalty, what is due each quarter, and where you stand today.
import { compute as computeFederal } from "../federal/compute.js";
import { projectedWithholding, safeHarbour } from "../withholding/compute.js";

/** The IRS quarters of a tax year: the income period each covers and the day the payment is due. */
export const QUARTERS = (year) => [
  { n: 1, label: "1st quarter", covers: `Jan to Mar ${year}`, due: `${year}-04-15` },
  { n: 2, label: "2nd quarter", covers: `Apr and May ${year}`, due: `${year}-06-15` },
  { n: 3, label: "3rd quarter", covers: `Jun to Aug ${year}`, due: `${year}-09-15` },
  { n: 4, label: "4th quarter", covers: `Sep to Dec ${year}`, due: `${year + 1}-01-15` },
];

/**
 * compute(plan, { today }) -> {
 *   year, totalTax, withholding (projected for the year), harbour: safeHarbour, toPayByEstimates (required - withholding, floor 0),
 *   perQuarter, quarters: [{ n, label, covers, due, paid, share (cumulative required), status: "paid" | "due" | "short" | "upcoming" }],
 *   paid (total so far), remaining (still to pay for the year), nextDue: { due, amount } | null, balanceAtFiling (total tax - withholding - paid),
 *   penaltyRisk: bool, needsEstimates: bool, hasPrior, priorTax, priorAgi, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const fed = computeFederal(plan, params);
  const wh = projectedWithholding(plan, params);
  const t = plan.taxes ?? {};
  const totalTax = Math.max(0, fed.result.totalTax);
  const harbour = safeHarbour(totalTax, t.priorYear?.tax, t.priorYear?.agi, fed.filingStatus);
  const paidList = (t.estimated?.paid ?? [0, 0, 0, 0]).map((x) => Math.max(0, Number(x) || 0));
  const paid = paidList.reduce((s, x) => s + x, 0);
  const toPayByEstimates = Math.max(0, harbour.required - wh.projected);
  const balanceAfterWithholding = totalTax - wh.projected;
  const needsEstimates = balanceAfterWithholding >= 1000 && toPayByEstimates > 0;
  const perQuarter = needsEstimates ? toPayByEstimates / 4 : 0;
  let cum = 0, cumPaid = 0;
  const quarters = QUARTERS(fed.year).map((q, i) => {
    cum += perQuarter; cumPaid += paidList[i];
    const past = today ? today > q.due : false;
    const status = !needsEstimates ? "none" : cumPaid >= cum - 1 ? "paid" : past ? "short" : today && today >= q.due.slice(0, 8) + "01" ? "due" : "upcoming";
    return { ...q, paid: paidList[i], share: perQuarter, cumulative: cum, status };
  });
  const remaining = Math.max(0, toPayByEstimates - paid);
  const next = quarters.find((q) => q.status === "due" || q.status === "upcoming" || q.status === "short");
  const nextDue = needsEstimates && next ? { due: next.due, label: next.label, amount: Math.max(0, Math.min(remaining, next.cumulative - paid)) } : null;
  const balanceAtFiling = totalTax - wh.projected - paid;
  const notes = [];
  if (!fed.hasIncome) notes.push("No income on file yet: add it on the Income page or type it on the Federal estimate page.");
  if (harbour.prior === null) notes.push("Type last year's total tax and income below: paying 100% of last year's tax is often the smaller safe amount, and it is certain.");
  return { year: fed.year, totalTax, withholding: wh.projected, withholdingDetail: wh, harbour, toPayByEstimates, perQuarter, quarters, paid, remaining, nextDue, balanceAtFiling, penaltyRisk: needsEstimates && paid + 1 < toPayByEstimates && quarters.some((q) => q.status === "short"), needsEstimates, hasPrior: harbour.prior !== null, priorTax: t.priorYear?.tax ?? null, priorAgi: t.priorYear?.agi ?? null, notes, hasIncome: fed.hasIncome, balanceAfterWithholding };
}
