// modules/debt/mortgage/compute.js -- PURE. The mortgage (the first liability account of type
// mortgage, or plan.debtPlan.mortgageAccountId) with its detail from the Debts page: the
// schedule from today, what extra payments or paying every two weeks would save, what a
// recast would do to the payment, and when mortgage insurance can go.
import { amortization, pmt, nper } from "../../../core/math/finance.js";
import { compute as computeDebts } from "../../balance/liabilities/compute.js";
import { addMonths } from "../../../core/math/dates.js";

/**
 * compute(plan, { today, extra = 0, lump = 0 }) -> {
 *   mortgage: { id, name, balance, rate, payment, extra, termMonths, startDate } | null, home: { value } | null,
 *   base: { months, endDate, totalInterest, payment }, withExtra: { months, endDate, totalInterest, monthsSaved, interestSaved },
 *   biweekly: { months, endDate, totalInterest, monthsSaved, interestSaved }, recast: { newPayment, monthlySaving } | null,
 *   pmi: { ltv, dropAtBalance, monthsUntilDrop, dateDrop } | null, schedule: [{ year, balance, interestPaid, principalPaid }], hasData
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const li = computeDebts(plan, { today });
  const wantId = plan.debtPlan?.mortgageAccountId;
  const row = li.rows.find((r) => r.id === wantId) ?? li.rows.find((r) => r.type === "mortgage" && r.owed > 0) ?? null;
  if (!row || !row.detail || !(row.payment > 0) || !(row.rate >= 0)) {
    return { mortgage: row ? { id: row.id, name: row.name, balance: row.owed, rate: row.rate, payment: row.payment } : null, hasData: false, missing: row ? "rate or payment" : "account" };
  }
  const extra = Math.max(0, Number(params.extra ?? row.extra ?? 0) || 0);
  const lump = Math.max(0, Number(params.lump ?? 0) || 0);
  const balance = row.owed, rate = row.rate, required = row.minPayment > 0 ? row.minPayment : row.payment;
  const r = rate / 12;
  const monthsOf = (payment, principal = balance) => { const n = nper(r, payment, principal); return Number.isFinite(n) ? Math.ceil(n - 1e-9) : Infinity; };
  const totalInterestOf = (payment, principal = balance) => { const n = monthsOf(payment, principal); return Number.isFinite(n) ? amortization({ principal, annualRate: rate, years: n / 12 + 1, payment }).totalInterest : Infinity; };
  const date = (m) => today && Number.isFinite(m) ? addMonths(today, m) : null;
  const baseMonths = monthsOf(required), baseInterest = totalInterestOf(required);
  const base = { months: baseMonths, endDate: date(baseMonths), totalInterest: baseInterest, payment: required };
  const exMonths = monthsOf(required + extra), exInterest = totalInterestOf(required + extra);
  const withExtra = { extra, months: exMonths, endDate: date(exMonths), totalInterest: exInterest, monthsSaved: Number.isFinite(exMonths) ? baseMonths - exMonths : 0, interestSaved: Number.isFinite(exInterest) ? Math.round((baseInterest - exInterest) * 100) / 100 : 0 };
  // every two weeks: half the payment 26 times a year = 13 monthly payments, so 1/12 of a payment extra per month
  const bwMonths = monthsOf(required * 13 / 12), bwInterest = totalInterestOf(required * 13 / 12);
  const biweekly = { months: bwMonths, endDate: date(bwMonths), totalInterest: bwInterest, monthsSaved: Number.isFinite(bwMonths) ? baseMonths - bwMonths : 0, interestSaved: Number.isFinite(bwInterest) ? Math.round((baseInterest - bwInterest) * 100) / 100 : 0 };
  // recast: pay a lump sum, keep the end date, the lender recalculates a lower payment
  const recast = lump > 0 && Number.isFinite(baseMonths) ? (() => { const np = pmt(r, baseMonths, Math.max(0, balance - lump)); return { lump, newPayment: Math.round(np * 100) / 100, monthlySaving: Math.round((required - np) * 100) / 100 }; })() : null;
  // mortgage insurance usually ends at 80% of the home's value
  const home = (plan.accounts ?? []).find((a) => a.type === "property" && Number(a.balance) > 0) ?? null;
  let pmi = null;
  if (home) {
    const value = Number(home.balance) || 0, ltv = value ? balance / value : null, dropAt = value * 0.8;
    let m = 0, b = balance;
    if (ltv !== null && balance > dropAt) { while (b > dropAt && m < 600) { b = b * (1 + r) - (required + extra); m++; } }
    pmi = { ltv, dropAtBalance: dropAt, monthsUntilDrop: balance > dropAt ? m : 0, dateDrop: date(balance > dropAt ? m : 0), homeValue: value };
  }
  // year-by-year balance at the required payment plus extra
  const sched = Number.isFinite(exMonths) ? amortization({ principal: balance, annualRate: rate, years: exMonths / 12 + 1, payment: required + extra }).schedule : [];
  const schedule = [];
  for (let y = 1; y * 12 <= sched.length + 11 && y <= 40; y++) { const rows = sched.slice((y - 1) * 12, y * 12); if (!rows.length) break; schedule.push({ year: y, endBalance: rows[rows.length - 1].balance, interestPaid: Math.round(rows.reduce((s, x) => s + x.interest, 0) * 100) / 100, principalPaid: Math.round(rows.reduce((s, x) => s + x.principal, 0) * 100) / 100 }); }
  return { mortgage: { id: row.id, name: row.name, balance, rate, payment: required, extra: row.extra, termMonths: row.detail.termMonths ?? null, startDate: row.detail.startDate ?? "" }, home: home ? { value: Number(home.balance) || 0, name: home.name } : null, base, withExtra, biweekly, recast, pmi, schedule, hasData: true };
}
