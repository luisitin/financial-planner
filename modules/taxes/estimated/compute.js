// modules/taxes/estimated/compute.js -- PURE. Quarterly estimated payments: what the year's
// tax comes to, how much of it withholding will cover, the safe-harbour amount that keeps you
// clear of the underpayment penalty, what is due each quarter, and where you stand today.
import { compute as computeFederal } from "../federal/compute.js";
import { withholdingEstimate, safeHarbour, yearTax, byReturn } from "../withholding/compute.js";
import { dueDay } from "../../household/calendar/compute.js";

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
 * schedule({ year, today, needsEstimates, toPayByEstimates, paidList }) -> { perQuarter, quarters, remaining, behind, overdue,
 * nextDue, lateQuarter }: the four payments of `toPayByEstimates` against the payments in `paidList` (one box a quarter),
 * as compute() describes them. compute() works the household's with it, and each separate return's (`returns`).
 */
export function schedule({ year, today = null, needsEstimates, toPayByEstimates, paidList }) {
  const paid = paidList.reduce((s, x) => s + x, 0);
  const perQuarter = needsEstimates ? toPayByEstimates / 4 : 0;
  // a quarter is covered when everything paid so far reaches its cumulative share (a payment counts against the earliest
  // unpaid quarter, IRC 6654(b)(3)); it was late when its own and the earlier boxes fell short on its due date (6654(b))
  let cum = 0, cumBoxes = 0;
  const quarters = QUARTERS(year).map((q, i) => {
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
  // the penalty is figured for each due date on its own (Form 2210 instructions): a quarter paid late counts even once caught up
  const lateQuarter = quarters.find((q) => q.late) ?? null;
  return { perQuarter, quarters, remaining, behind, overdue, nextDue, lateQuarter };
}

/**
 * compute(plan, { today }) -> {
 *   year, filingStatus, totalTax, creditsBack (refundable credits past the tax: yearTax back), withholding (projected for the year), withholdingFrom ("typed": the Withholding check page or the year so far; "mixed": typed for some earners, estimated from pay for the rest; "paycheck": estimated
 *   from pay on the Paycheck page; "none"), harbour: safeHarbour, toPayByEstimates (required - withholding, floor 0),
 *   perQuarter, quarters: [{ n, label, covers, due, paid, share, cumulative (required by its due date), status: "paid" | "due" | "short" | "upcoming"
 *   (from everything paid so far), late (its own and earlier boxes were short on its due date) }],
 *   paid (total so far), remaining (still to pay for the year), behind (the share of quarters already past due that is not paid),
 *   overdue: { due (the first quarter not covered), amount: behind } | null, nextDue: { due, label, amount (that quarter's share on top of what is behind) } | null
 *   (the next quarter not yet past), balanceAtFiling (total tax - withholding - paid), lateQuarter: the first late quarter | null,
 *   penaltyRisk: bool, needsEstimates: bool, hasPrior, priorTax, priorAgi, notes,
 *   paidTyped: the payments were saved on this page (taxes.estimated.typedAt) or some are on file; else `paid` is 0 because
 *   nothing was typed, not because nothing was paid, and the pages ask instead of saying "$0 paid",
 *   returns: filing separately, each return's own (withholding byReturn, with `paid` its share of the payments, its own
 *   schedule's perQuarter, quarters, remaining, behind, overdue, nextDue, lateQuarter, balanceAtFiling and penaltyRisk); else null
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const fed = computeFederal(plan, params);
  // withholding: the figures typed on the Withholding check page; with none, the Paycheck page's estimate from pay
  // (withholdingEstimate, the one figure every tax page reads)
  const est = withholdingEstimate(plan, params);
  const wh = est.detail, withholdingFrom = est.from;
  const t = plan.taxes ?? {};
  // the year's tax with self-employment tax (the Form 1040-ES worksheet and Form 2210 count it), as Withholding check counts it
  const yt = yearTax(plan, fed, params);
  // the balances count refundable credits past the tax (yt.total below 0); `totalTax` is the tax said in words, at least 0
  const signedTax = yt.total, totalTax = yt.owed;
  const harbour = safeHarbour(totalTax, t.priorYear?.tax, t.priorYear?.agi, fed.filingStatus);
  const paidList = (t.estimated?.paid ?? [0, 0, 0, 0]).map((x) => Math.max(0, Number(x) || 0));
  const paid = paidList.reduce((s, x) => s + x, 0);
  const toPayByEstimates = Math.max(0, harbour.required - wh.projected);
  const balanceAfterWithholding = signedTax - wh.projected;
  const needsEstimates = balanceAfterWithholding >= 1000 && toPayByEstimates > 0;
  const { perQuarter, quarters, remaining, behind, overdue, nextDue, lateQuarter } = schedule({ year: fed.year, today, needsEstimates, toPayByEstimates, paidList });
  const balanceAtFiling = signedTax - wh.projected - paid;
  const notes = [];
  if (!fed.hasIncome) notes.push("No income on file yet: add it on the Income page or type it on the Federal estimate page.");
  if (withholdingFrom === "paycheck") notes.push("Withholding is estimated from your pay on the Paycheck page. Type what your pay stubs withhold on the Withholding check page for a firmer figure.");
  else if (withholdingFrom === "mixed") notes.push(`Withholding for ${est.people.filter((x) => x.estimated).map((x) => x.name).join(" and ")} is estimated from pay on the Paycheck page. Type it from a pay stub on the Withholding check page for a firmer figure.`);
  if (harbour.prior === null) notes.push("Type last year's total tax and income below: paying 100% of last year's tax is often the smaller safe amount, and it is certain.");
  // filing separately, each return on its own (withholding byReturn: its own tax, withholding, safe amount and $1,000 test),
  // with its own four payments: the payments typed here are divided between the returns as the couple may agree (Pub. 505),
  // box by box in the same shares (Review 2026-11-06: the household's figures said "no estimated payments needed" while Bo's
  // own return was 1,660 short). The household's figures above stay as the answer key has them.
  const returns = byReturn(plan, fed, est, { paid, priorTax: t.priorYear?.tax ?? null, priorAgi: t.priorYear?.agi ?? null, params })?.map((r) => {
    const share = paid > 0 ? r.paid / paid : 0;
    const sch = schedule({ year: fed.year, today, needsEstimates: r.needsEstimates, toPayByEstimates: r.toPayByEstimates, paidList: paidList.map((x) => x * share) });
    return { ...r, ...sch, balanceAtFiling: r.balance, penaltyRisk: r.needsEstimates && r.paid + 1 < r.toPayByEstimates && !!sch.lateQuarter };
  }) ?? null;
  return { year: fed.year, filingStatus: fed.filingStatus, totalTax, creditsBack: yt.back, seTax: yt.se, withholding: wh.projected, withholdingFrom, withholdingDetail: wh, harbour, toPayByEstimates, perQuarter, quarters, paid, remaining, behind, overdue, nextDue, balanceAtFiling, lateQuarter, penaltyRisk: needsEstimates && paid + 1 < toPayByEstimates && !!lateQuarter, needsEstimates, paidTyped: !!t.estimated?.typedAt || paid > 0, hasPrior: harbour.prior !== null, priorTax: t.priorYear?.tax ?? null, priorAgi: t.priorYear?.agi ?? null, notes, hasIncome: fed.hasIncome, balanceAfterWithholding, returns };
}

/**
 * taxOwedNow(plan, { today }) -> null | { year, owedNow, earnedShare, monthly, totalTax, withholding, paid, overdue, nextDue, atFiling }:
 * this year's federal tax (self-employment tax included) on what has already been earned and is not yet paid: cash in the
 * bank that belongs to the IRS, so the cushion and the next move leave it out (round 4, 2026-11-02: a freelancer's $16,900
 * was counted as five months of cushion while about $6,500 of it was tax on the year's earnings so far).
 *   earnedShare = whole months gone this year / 12 (November 2 -> 10/12); owedNow = (year's tax - withholding) x earnedShare
 *   - estimated payments made, floor 0. The months still to come carry their own tax, which every monthly figure already
 *   takes off (Next best action, Budget, Income statement), so only the part already earned is spoken for.
 *   monthly = (year's tax - withholding) / 12: what to put aside a month.
 * Only for a household whose tax is mostly not taken from pay (my choice, noted in the README): there is income from its own
 * business or freelance work, and withholding covers under half of the year's tax. Someone with a paycheck that withholds
 * most of it is left alone: their withholding is often estimated from pay, and the Withholding check page is the place for it.
 * State tax is not in it (the State page has a rate, not payments). Null when estimates are not needed.
 */
export function taxOwedNow(plan, params = {}) {
  const today = params.today ?? null;
  if (!today || !/^\d{4}-\d{2}/.test(today)) return null;
  const business = (plan.income ?? []).some((x) => x.type === "business" && Number(x.amount) > 0 && (!x.endDate || String(x.endDate) >= today) && (!x.startDate || String(x.startDate) <= today));
  if (!business) return null;
  let e;
  try { e = compute(plan, params); } catch { return null; }
  if (!e.needsEstimates || !(e.totalTax > 0) || e.withholding >= e.totalTax / 2) return null;
  const [y, m] = today.split("-").map(Number);
  if (y !== e.year) return null;
  const earnedShare = (m - 1) / 12;
  const unwithheld = e.totalTax - e.withholding;
  const owedNow = Math.max(0, unwithheld * earnedShare - e.paid);
  return { year: e.year, owedNow, earnedShare, monthly: unwithheld / 12, totalTax: e.totalTax, withholding: e.withholding, paid: e.paid, paidTyped: e.paidTyped, overdue: e.overdue, nextDue: e.nextDue, atFiling: Math.max(0, e.balanceAtFiling) };
}
