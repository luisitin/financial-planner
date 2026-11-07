// modules/debt/ratios/compute.js -- PURE. The numbers a lender looks at: how much of your
// monthly income goes to debt payments (debt-to-income), how much goes to housing, how much
// of your card limits you use, and how many months of income you owe in total. Each with
// the usual line a lender draws.
import { compute as computeDebts, rentsHome, lenderWithHousing, DTI_LINES, shownShare } from "../../balance/liabilities/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeCards } from "../credit-cards/compute.js";
import { isGuess } from "../../../core/estimate/index.js";

export const LINES = {
  dti: [{ max: 0.36, label: "comfortable", level: "ok" }, { max: 0.43, label: "on the high side", level: "warn" }, { max: Infinity, label: "stretched", level: "bad" }],
  // a renter's payments, rent not counted (round 8, 2026-11-06; CFPB: 15 to 20% or less; liabilities DTI_LINES.renter)
  dtiRenter: [{ max: DTI_LINES.renter.good, label: "within the guideline for renters", level: "ok" }, { max: DTI_LINES.renter.high, label: "over the guideline for renters", level: "warn" }, { max: Infinity, label: "stretched", level: "bad" }],
  housing: [{ max: 0.28, label: "comfortable", level: "ok" }, { max: 0.35, label: "on the high side", level: "warn" }, { max: Infinity, label: "stretched", level: "bad" }],
  utilisation: [{ max: 0.1, label: "excellent", level: "ok" }, { max: 0.3, label: "fine", level: "ok" }, { max: 0.5, label: "hurts your score", level: "warn" }, { max: Infinity, label: "hurts a lot", level: "bad" }],
};
// debt-to-income and housing are graded at the whole percent the page shows (round 8 review, 2026-11-06: 20.3% read "20%" and
// "over the 20% guideline"); card use keeps its exact share, as Credit cards' "how much less gets you under 30%" does
const grade = (kind, x) => x === null ? null : LINES[kind].find((l) => (kind === "utilisation" ? x : shownShare(x)) <= l.max + 1e-9);

/**
 * compute(plan, { today }) -> {
 *   incomeMonthly | null, payments, housingPayment, dti, housingRatio, utilisation, monthsOfIncomeOwed,
 *   grades: { dti, housing, utilisation }, owed, hasIncome, hasDebts, rows: [{ key, label, value, text, grade, why, note? }],
 *   renter?, withHousing?
 * }
 * A renter (no mortgage owed, no home on file: liabilities `rentsHome`) has `renter: true`, `dtiRequired` (required payments /
 * gross income: the debt row's value, graded on the renters' line LINES.dtiRenter) and, with a rent, `withHousing` = (required
 * payments + rent) / gross income, said in the row's `note` against what home lenders accept (liabilities `lenderWithHousing`).
 * `dti` stays payments (with any extra) / income. Housing with no mortgage payment is the housing expenses running today
 * (Expenses' active list). Debt-to-income and housing are graded at the whole percent shown (liabilities `shownShare`).
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const debts = computeDebts(plan, { today });
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  const incomeMonthly = inc && inc.monthly > 0 ? inc.monthly : null;
  // with no mortgage payment, the housing expenses running today (round 8 review, D6: a rent that ended in 2025 was still "your
  // $1,450 rent"; Expenses' own active list, as How am I doing reads it)
  const mortgagePaid = debts.rows.some((r) => r.type === "mortgage" && r.payment > 0);
  const rentRows = mortgagePaid ? [] : computeExpenses(plan, { today }).active.filter((e) => e.category === "housing");
  const housingPayment = debts.rows.filter((r) => r.type === "mortgage").reduce((s, r) => s + r.payment, 0) + rentRows.reduce((s, e) => s + e.monthly, 0);
  // some of the rent still our guess (verify, 2026-11-06): the home-lender sentence says so
  const rentGuessed = rentRows.some((e) => typeof e.id === "string" && isGuess(plan, `expenses[${e.id}].amount`));
  const cards = computeCards(plan, { today });
  const dti = incomeMonthly ? debts.payments / incomeMonthly : null;
  const housingRatio = incomeMonthly ? housingPayment / incomeMonthly : null;
  const utilisation = cards.utilisation;
  const monthsOfIncomeOwed = incomeMonthly ? debts.owed / incomeMonthly : null;
  // a renter: the required payments only, as a lender counts them (review D3, 2026-11-06: $400 a month chosen on top of $320
  // required read 22%, "over"), on the renters' line
  const renter = rentsHome(plan, debts.rows);
  const required = renter && incomeMonthly ? debts.minimums / incomeMonthly : null;
  const grades = { dti: grade(renter ? "dtiRenter" : "dti", renter ? required : dti), housing: grade("housing", housingRatio), utilisation: grade("utilisation", utilisation) };
  const withHousing = renter && incomeMonthly && housingPayment > 0 ? (debts.minimums + housingPayment) / incomeMonthly : null;
  const rows = [
    renter
      ? { key: "dti", label: "Debt payments out of income", value: required, kind: "pct", grade: grades.dti, why: "all required debt payments a month (not the rent, nor any extra you choose to pay), divided by monthly income before tax. For renters the usual guideline is 15 to 20% or less (Consumer Financial Protection Bureau).", ...(withHousing !== null ? { note: lenderWithHousing(withHousing, housingPayment, plan.meta?.currency ?? "USD", { guessed: rentGuessed }) } : {}) }
      : { key: "dti", label: "Debt payments out of income", value: dti, kind: "pct", grade: grades.dti, why: "all required debt payments a month, divided by monthly income before tax. Lenders like it under 36%. Many approve up to 43 to 50% (with a good credit score and savings), but above 43% the payments get tight." },
    { key: "housing", label: "Housing out of income", value: housingRatio, kind: "pct", grade: grades.housing, why: "the mortgage payment (or rent) divided by monthly income before tax. The old rule is 28%." },
    { key: "utilisation", label: "Card limits in use", value: utilisation, kind: "pct", grade: grades.utilisation, why: "card balances divided by card limits. Under 30% keeps your credit score healthy; under 10% is best." },
    { key: "months", label: "Months of income owed", value: monthsOfIncomeOwed, kind: "months", grade: null, why: "everything you owe divided by one month's income: how long it would take to pay it all with every dollar." },
  ];
  return { ...(renter ? { renter, withHousing, dtiRequired: required } : {}), incomeMonthly, payments: debts.payments, minimums: debts.minimums ?? null, under: cards.under ?? null, housingPayment, dti, housingRatio, utilisation, monthsOfIncomeOwed, grades, owed: debts.owed, hasIncome: !!incomeMonthly, hasDebts: debts.count > 0, rows };
}
