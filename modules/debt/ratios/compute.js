// modules/debt/ratios/compute.js -- PURE. The numbers a lender looks at: how much of your
// monthly income goes to debt payments (debt-to-income), how much goes to housing, how much
// of your card limits you use, and how many months of income you owe in total. Each with
// the usual line a lender draws.
import { compute as computeDebts } from "../../balance/liabilities/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeCards } from "../credit-cards/compute.js";

export const LINES = {
  dti: [{ max: 0.36, label: "comfortable", level: "ok" }, { max: 0.43, label: "on the high side", level: "warn" }, { max: Infinity, label: "stretched", level: "bad" }],
  housing: [{ max: 0.28, label: "comfortable", level: "ok" }, { max: 0.35, label: "on the high side", level: "warn" }, { max: Infinity, label: "stretched", level: "bad" }],
  utilisation: [{ max: 0.1, label: "excellent", level: "ok" }, { max: 0.3, label: "fine", level: "ok" }, { max: 0.5, label: "hurts your score", level: "warn" }, { max: Infinity, label: "hurts a lot", level: "bad" }],
};
const grade = (kind, x) => x === null ? null : LINES[kind].find((l) => x <= l.max);

/**
 * compute(plan, { today }) -> {
 *   incomeMonthly | null, payments, housingPayment, dti, housingRatio, utilisation, monthsOfIncomeOwed,
 *   grades: { dti, housing, utilisation }, owed, hasIncome, hasDebts, rows: [{ key, label, value, text, grade, why }]
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const debts = computeDebts(plan, { today });
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  const incomeMonthly = inc && inc.monthly > 0 ? inc.monthly : null;
  const housingPayment = debts.rows.filter((r) => r.type === "mortgage").reduce((s, r) => s + r.payment, 0) + (plan.expenses ?? []).filter((e) => e.category === "housing" && e.period !== "once" && !debts.rows.some((r) => r.type === "mortgage" && r.payment > 0)).reduce((s, e) => s + (Number(e.amount) || 0) * ({ weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, annual: 1 }[e.period] ?? 12) / 12, 0);
  const cards = computeCards(plan, { today });
  const dti = incomeMonthly ? debts.payments / incomeMonthly : null;
  const housingRatio = incomeMonthly ? housingPayment / incomeMonthly : null;
  const utilisation = cards.utilisation;
  const monthsOfIncomeOwed = incomeMonthly ? debts.owed / incomeMonthly : null;
  const grades = { dti: grade("dti", dti), housing: grade("housing", housingRatio), utilisation: grade("utilisation", utilisation) };
  const rows = [
    { key: "dti", label: "Debt payments out of income", value: dti, kind: "pct", grade: grades.dti, why: "all required debt payments a month, divided by gross monthly income. Lenders like it under 36% and rarely go past 43%." },
    { key: "housing", label: "Housing out of income", value: housingRatio, kind: "pct", grade: grades.housing, why: "the mortgage payment (or rent) divided by gross monthly income. The old rule is 28%." },
    { key: "utilisation", label: "Card limits in use", value: utilisation, kind: "pct", grade: grades.utilisation, why: "card balances divided by card limits. Under 30% keeps your credit score healthy; under 10% is best." },
    { key: "months", label: "Months of income owed", value: monthsOfIncomeOwed, kind: "months", grade: null, why: "everything you owe divided by one month's income: how long it would take to pay it all with every dollar." },
  ];
  return { incomeMonthly, payments: debts.payments, housingPayment, dti, housingRatio, utilisation, monthsOfIncomeOwed, grades, owed: debts.owed, hasIncome: !!incomeMonthly, hasDebts: debts.count > 0, rows };
}
