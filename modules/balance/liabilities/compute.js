// modules/balance/liabilities/compute.js -- PURE. Every debt with its rate and payment: what
// it costs each month, when it is gone at the current payment, and the household's
// debt-to-income ratio. Balances come from the accounts; the loan detail (rate, payments)
// lives in plan.debts, one entry per liability account.
import { ACCOUNT_TYPES, isLiability } from "../net-worth/compute.js";
import { nper, amortization } from "../../../core/math/finance.js";
import { addMonths } from "../../../core/math/dates.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { money } from "../../../core/format.js";

export const DEBT_ICONS = { credit: "💳", mortgage: "🏠", student_loan: "🎓", loan: "🚗", other_liability: "📄" };
export const HIGH_RATE = 0.15;   // above this a debt is flagged as expensive

/**
 * compute(plan, { today }) -> {
 *   rows: [{ account fields..., icon, typeLabel, owed, detail: debt | null, rate, minPayment, extra, payment,
 *            interestMonthly, months (to payoff at `payment`; null without a payment; Infinity if it never pays off),
 *            payoffDate, totalInterest, expensive, neverPaysOff }],
 *   count, withDetail, owed, minimums, payments, interestMonthly, avgRate (balance-weighted, over rows with a rate),
 *   income: monthly gross | null, dti (payments / income) | null, highest: row | null, warnings: [text]
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const debts = plan.debts ?? [];
  const rows = (plan.accounts ?? []).filter((a) => isLiability(a.type)).map((a) => {
    const detail = debts.find((x) => x.accountId === a.id) ?? null;
    const owed = Math.abs(Number(a.balance) || 0);
    const rate = detail ? Number(detail.rate) || 0 : null;
    const minPayment = detail ? Number(detail.minPayment) || 0 : 0;
    const extra = detail ? Number(detail.extra) || 0 : 0;
    const payment = minPayment + extra;
    const interestMonthly = rate !== null ? owed * rate / 12 : null;
    let months = null, totalInterest = null;
    if (detail && payment > 0 && owed > 0) {
      months = nper(rate / 12, payment, owed);
      if (Number.isFinite(months)) {
        months = Math.ceil(months - 1e-9);
        totalInterest = amortization({ principal: owed, annualRate: rate, years: months / 12 + 1, payment }).totalInterest;
      }
    } else if (detail && owed === 0) { months = 0; totalInterest = 0; }
    const t = ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_liability;
    return {
      ...a, icon: DEBT_ICONS[a.type] ?? "📄", typeLabel: t.label, owed, detail, rate, minPayment, extra, payment, interestMonthly, months,
      payoffDate: today && Number.isFinite(months) && months !== null ? addMonths(today, months) : null,
      totalInterest, expensive: rate !== null && rate >= HIGH_RATE && owed > 0, neverPaysOff: months === Infinity,
    };
  }).sort((x, y) => (y.rate ?? -1) - (x.rate ?? -1) || y.owed - x.owed);
  const sum = (k, filter = () => true) => rows.filter(filter).reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const rated = rows.filter((r) => r.rate !== null && r.owed > 0);
  const owed = sum("owed");
  const avgRate = rated.length ? rated.reduce((s, r) => s + r.rate * r.owed, 0) / rated.reduce((s, r) => s + r.owed, 0) : null;
  const inc = (plan.income ?? []).length ? computeIncome(plan, params) : null;
  const income = inc && inc.monthly > 0 ? inc.monthly : null;
  const payments = sum("payment");
  const cur = plan.meta?.currency ?? "USD";
  const warnings = [];
  for (const r of rows) {
    if (r.neverPaysOff) warnings.push(`${r.name}: the payment does not even cover the interest, so it never pays off. Raise the payment.`);
    if (r.expensive) warnings.push(`${r.name} costs about ${money(r.interestMonthly, cur)} a month in interest at ${Math.round(r.rate * 1000) / 10}%. Paying it down first saves the most.`);
  }
  return {
    rows, count: rows.length, withDetail: rows.filter((r) => r.detail).length, owed,
    minimums: sum("minPayment"), payments, interestMonthly: sum("interestMonthly"), avgRate,
    income, dti: income ? payments / income : null,
    highest: rated[0] ?? null, warnings,
  };
}
