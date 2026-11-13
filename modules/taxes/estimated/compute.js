// modules/taxes/estimated/compute.js -- PURE. Quarterly estimated payments: what the year's
// tax comes to, how much of it withholding will cover, the safe-harbour amount that keeps you
// clear of the underpayment penalty, what is due each quarter, and where you stand today.
import { compute as computeFederal } from "../federal/compute.js";
import { withholdingEstimate, safeHarbour, yearTax, byReturn } from "../withholding/compute.js";
import { dueDay } from "../../household/calendar/compute.js";
import { addMonths, daysBetween } from "../../../core/math/dates.js";
import { UNDERPAYMENT_RATES } from "./data/rates.js";

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
 *   schedule's perQuarter, quarters, remaining, behind, overdue, nextDue, lateQuarter, balanceAtFiling and penaltyRisk); else null,
 *   holdBack: { amount (what is still short, rounded up to 100, at most the withdrawal), short, withdrawal, required, people
 *   ([{ name, amount }] withdrawals not marked taken) } | null: with this year's IRA or 401(k) withdrawals in the tax and
 *   estimates needed, the tax to have held back from a withdrawal before December 31 instead (IRC 6654(g))
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const fed = computeFederal(plan, params);
  // withholding: the figures typed on the Withholding check page; with none, the Paycheck page's estimate from pay
  // (withholdingEstimate, the one figure every tax page reads)
  // the year's tax with self-employment tax (the Form 1040-ES worksheet and Form 2210 count it), as Withholding check counts
  // it: the Federal estimate's figures with what the plan knows (taxes/federal known.js)
  const yt = yearTax(plan, fed, params);
  const est = withholdingEstimate(plan, params, yt.known);
  const wh = est.detail, withholdingFrom = est.from;
  const t = plan.taxes ?? {};
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
  // a retiree whose tax comes from this year's withdrawals from an IRA or 401(k): tax held back from a withdrawal counts as
  // paid evenly through the year (IRC 6654(g)(1); Pub. 505, "withholding is considered paid ... in four equal amounts"), so
  // asking the firm to hold back what is still short from a withdrawal before December 31 covers the quarters already past
  // without a penalty. Rounded up to 100. (Round 8, widow-2: "No estimated payments needed" on an RMD of 16,078.)
  const wd = yt.known?.withdrawal ?? null;
  const thisYearNow = today ? Number(String(today).slice(0, 4)) === fed.year : false;
  // a withdrawal already taken cannot hold anything back: the cap is what is still to come (money review note: $3,900 was shown against $1,369 to come)
  const toCome = wd ? Math.max(0, wd.total - wd.people.filter((x) => x.taken).reduce((t, x) => t + (Number(x.amount) || 0), 0)) : 0;
  const holdBack = needsEstimates && remaining > 0 && wd && !wd.typed && toCome >= 1 && thisYearNow && (wd.spending > 0 || wd.people.some((x) => !x.taken))
    ? { amount: Math.min(Math.ceil(remaining / 100) * 100, Math.ceil(toCome)), short: remaining, withdrawal: wd.total, required: wd.required, people: wd.people.filter((x) => !x.taken).map((x) => ({ name: x.name, amount: x.amount })),
      // what to hold back to owe nothing in April (the whole balance), beside what keeps the penalty away (`amount`)
      whole: Math.min(Math.ceil(Math.max(0, balanceAtFiling) / 100) * 100, Math.ceil(toCome)) } : null;
  // any income counted, this year's withdrawals from the plan included (known.js), not the Income page alone (round 8 review)
  const hasIncome = !!yt.known?.hasIncome || fed.hasIncome;
  const notes = [];
  if (!hasIncome) notes.push("No income on file yet: add it on the Income page or type it on the Federal estimate page.");
  if (withholdingFrom === "paycheck") notes.push("The app estimates your withholding from your pay on the Paycheck page. Type what your pay stubs withhold on the Withholding check page for a firmer figure.");
  else if (withholdingFrom === "mixed") notes.push(`Withholding for ${est.people.filter((x) => x.estimated).map((x) => x.name).join(" and ")} is estimated from pay on the Paycheck page. Type it from a pay stub on the Withholding check page for a firmer figure.`);
  if (harbour.prior === null) notes.push("Type last year's total tax and income below: paying 100% of last year's tax is often the smaller amount that avoids a penalty, and you know it for sure.");
  // filing separately, each return on its own (withholding byReturn: its own tax, withholding, safe amount and $1,000 test),
  // with its own four payments: the payments typed here are divided between the returns as the couple may agree (Pub. 505),
  // box by box in the same shares (Review 2026-11-06: the household's figures said "no estimated payments needed" while Bo's
  // own return was 1,660 short). The household's figures above stay as the answer key has them.
  const returns = byReturn(plan, fed, est, { paid, priorTax: t.priorYear?.tax ?? null, priorAgi: t.priorYear?.agi ?? null, params, k: yt.known })?.map((r) => {
    const share = paid > 0 ? r.paid / paid : 0;
    const sch = schedule({ year: fed.year, today, needsEstimates: r.needsEstimates, toPayByEstimates: r.toPayByEstimates, paidList: paidList.map((x) => x * share) });
    return { ...r, ...sch, balanceAtFiling: r.balance, penaltyRisk: r.needsEstimates && r.paid + 1 < r.toPayByEstimates && !!sch.lateQuarter };
  }) ?? null;
  return { year: fed.year, filingStatus: fed.filingStatus, totalTax, creditsBack: yt.back, seTax: yt.se, withholding: wh.projected, withholdingFrom, withholdingDetail: wh, harbour, toPayByEstimates, perQuarter, quarters, paid, remaining, behind, overdue, nextDue, balanceAtFiling, lateQuarter, penaltyRisk: needsEstimates && paid + 1 < toPayByEstimates && !!lateQuarter, needsEstimates, paidTyped: !!t.estimated?.typedAt || paid > 0, hasPrior: harbour.prior !== null, priorTax: t.priorYear?.tax ?? null, priorAgi: t.priorYear?.agi ?? null, notes, hasIncome, balanceAfterWithholding, returns, ...(holdBack ? { holdBack } : {}) };
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

// ---- what paying late costs (gap #15, 2026-11-13) ------------------------------------------------------------------------
// The penalty for paying estimated tax late runs like simple interest on the amount late: IRC 6654(a) applies "the
// underpayment rate established under section 6621 ... to the amount of the underpayment ... for the period of the
// underpayment"; the period runs from the installment's due date to the earlier of the day it is paid and "the 15th day of
// the 4th month following the close of the taxable year" (6654(b)(2)). The rate is the federal short-term rate plus 3
// points, set for each calendar quarter (6621(a)(2); data/rates.js). The Form 2210 instructions' penalty worksheet (2025)
// works it day by day per rate period: "Underpayment ... x Number of days ... / 365 x 0.07"; a leap year's days are over 366
// (Form 2210 instructions for 2024: "$2,000 x (61 / 366) x 0.08"). Payments go first to the earliest underpayment
// ("Your payments are applied first to any underpayment balance on an earlier installment"). Read 2026-11-13.

const quarterOf = (iso) => `${String(iso).slice(0, 4)}Q${Math.ceil(Number(String(iso).slice(5, 7)) / 3)}`;
const quarterEnd = (key) => `${key.slice(0, 4)}-${["03-31", "06-30", "09-30", "12-31"][Number(key.slice(5)) - 1]}`;
const nextQuarterStart = (iso) => { const y = Number(iso.slice(0, 4)), q = Math.ceil(Number(iso.slice(5, 7)) / 3); return q === 4 ? `${y + 1}-01-01` : `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`; };
const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * rateOn(iso, rates) -> { rate, quarter, known, through }: the underpayment rate on a day, from the newest quarter in the
 * table on or before the day's own quarter. `known`: the day's own quarter is in the table (else the newest earlier rate is
 * used: the IRS sets each quarter's rate a few weeks before it starts; before the table, its first rate). `through`: the
 * last day of the newest quarter in the table, for "7%, the rate through December 31, 2026".
 */
export function rateOn(iso, rates = UNDERPAYMENT_RATES) {
  const keys = Object.keys(rates).sort();
  const q = quarterOf(iso);
  const at = keys.filter((k) => k <= q).pop() ?? keys[0];
  return { rate: rates[at], quarter: at, known: at === q, through: quarterEnd(keys[keys.length - 1]) };
}

/**
 * lateCharge(amount, from, to, rates) -> { cost, days, parts: [{ from, to, days, rate, yearDays, cost }] }: the charge on
 * `amount` paid late from `from` (the due date) to `to` (the day paid; days counted from the due date, the day paid not
 * counted, as Form 2210 counts them), split where the quarter's rate or the year changes: each part amount x rate x days /
 * days in that year (365, or 366 in a leap year).
 */
export function lateCharge(amount, from, to, rates = UNDERPAYMENT_RATES) {
  const parts = [];
  if (!(amount > 0) || !from || !to || to <= from) return { cost: 0, days: 0, parts };
  for (let a = from; a < to;) {
    const b = nextQuarterStart(a) < to ? nextQuarterStart(a) : to;
    const days = daysBetween(a, b), rate = rateOn(a, rates).rate, yearDays = leap(Number(a.slice(0, 4))) ? 366 : 365;
    parts.push({ from: a, to: b, days, rate, yearDays, cost: amount * rate * days / yearDays });
    a = b;
  }
  // parts at the same rate and in the same year are one line on the worksheet: joined, so the sum shown is short
  const joined = [];
  for (const x of parts) {
    const last = joined[joined.length - 1];
    if (last && last.rate === x.rate && last.yearDays === x.yearDays && last.from.slice(0, 4) === x.from.slice(0, 4)) { last.to = x.to; last.days += x.days; last.cost += x.cost; } else joined.push({ ...x });
  }
  return { cost: joined.reduce((s, x) => s + x.cost, 0), days: daysBetween(from, to), parts: joined };
}

/**
 * The charge so far on the payments behind, to `until`: each quarter's share comes due on its date, each box typed counts
 * as paid on its quarter's due date (or `until`, for a box whose date has not come: paid by now, day unknown), and the
 * amount late on each day is what is due so far less what is paid so far (payments go to the earliest first; a payment
 * ahead counts against the next ones). The boxes hold no dates: this is the closest the plan can say, and the page says so.
 */
function chargeSoFar(quarters, until, rates) {
  const ev = [];
  for (const q of quarters) {
    if (q.due < until) ev.push({ at: q.due, add: q.share });
    if (q.paid > 0) ev.push({ at: q.due < until ? q.due : until, add: -q.paid });
  }
  ev.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  let late = 0, cost = 0;
  ev.forEach((x, i) => {
    late += x.add;
    const end = i + 1 < ev.length ? ev[i + 1].at : until;
    if (late > 0.005 && end > x.at) cost += lateCharge(late, x.at, end, rates).cost;
  });
  return cost;
}

/** What quarter `n` was short on its own due date: its cumulative share less the boxes up to it (0 when they reached it). */
function shortOn(quarters, n) {
  const i = quarters.findIndex((q) => q.n === n);
  const boxes = quarters.slice(0, i + 1).reduce((s, q) => s + (Number(q.paid) || 0), 0);
  return Math.max(0, quarters[i].cumulative - boxes);
}

/**
 * lateCosts(e, { today, via, rates }) -> null | { case, rate, stops, next, behind, late, basis, priorShare, via }: what
 * paying late costs, for this page's figures `e` (compute()'s, or one separate return's from `returns`). Null when no
 * estimated payment is needed this year. The case, first that applies:
 *   "withheld" (via "pay" | "withdrawal": the page's own fix is more tax withheld before December 31, which counts as paid
 *     evenly through the year, IRC 6654(g)(1): no penalty that way);
 *   "after" (a payment is behind and the return's due date, April 15 of the next year, has passed: the charge stopped then);
 *   "behind" ({ amount, since (the first quarter not covered), from (the day the charge began: the first quarter short on
 *     its own due date, `since` or earlier), earlier ([{ label, due, short }]: quarters short on their due dates and paid
 *     since, before `since`; their days are in soFar), soFar (to today), perMonth: lateCharge of the amount behind for the
 *     month from today });
 *   "late" (a quarter was short on its due date and is covered since: { label, due, short (what was missing on that date),
 *     perMonth: lateCharge of it for a month from its due date });
 *   "next" (nothing late: { due, label, amount, ...lateCharge of the next payment for one month from its due date });
 *   "met" (the year's payments are all in, none late: the safe amount reached in time; `basis` "last year" | "this year").
 * `next` is there whenever a next payment is, so "behind" and "late" can say it too. `rate` is rateOn the case's day.
 */
export function lateCosts(e, { today = null, via = null, rates = UNDERPAYMENT_RATES } = {}) {
  if (!e?.needsEstimates || !Array.isArray(e.quarters) || !e.quarters.length) return null;
  const year = Number(String(e.quarters[0].due).slice(0, 4));
  const stops = `${year + 1}-04-15`;
  const next = e.nextDue && e.nextDue.amount >= 0.5 ? { ...e.nextDue, ...lateCharge(e.nextDue.amount, e.nextDue.due, addMonths(e.nextDue.due, 1), rates) } : null;
  const base = { stops, next, behind: null, late: null, basis: e.harbour?.basis ?? null, priorShare: e.harbour?.priorShare ?? 1, via: null };
  const now = today ?? e.nextDue?.due ?? e.quarters[0].due;
  if (via === "pay" || via === "withdrawal") return { ...base, case: "withheld", via, rate: rateOn(now, rates) };
  if (today && e.behind >= 0.5 && e.overdue) {
    const after = today >= stops;
    const soFar = chargeSoFar(e.quarters, after ? stops : today, rates);
    // "so far" runs from the first quarter short on its own due date, which can be one paid since (critic F1, 2026-11-13:
    // the freelancer's $176 counted the 1st quarter's $2,244 short from April 15 while the words said "since June 15")
    const earlier = e.quarters.filter((q) => q.late && q.status === "paid" && q.due < e.overdue.due).map((q) => ({ label: q.label, due: q.due, short: shortOn(e.quarters, q.n) }));
    return { ...base, case: after ? "after" : "behind", rate: rateOn(after ? stops : today, rates),
      behind: { amount: e.behind, since: e.overdue.due, from: e.lateQuarter?.due ?? e.overdue.due, earlier, soFar, perMonth: after ? null : lateCharge(e.behind, today, addMonths(today, 1), rates) } };
  }
  if (e.lateQuarter) {
    const short = shortOn(e.quarters, e.lateQuarter.n);
    return { ...base, case: "late", rate: rateOn(e.lateQuarter.due, rates),
      late: { label: e.lateQuarter.label, due: e.lateQuarter.due, short, perMonth: lateCharge(short, e.lateQuarter.due, addMonths(e.lateQuarter.due, 1), rates) } };
  }
  if (next) return { ...base, case: "next", rate: rateOn(next.due, rates) };
  if (e.remaining < 1) return { ...base, case: "met", rate: rateOn(now, rates) };
  return null;
}
