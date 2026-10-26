// modules/retirement/fire/compute.js -- PURE. Financial independence: the pot that could pay
// for your spending for good, how far you are, how many years at the current saving pace, and
// the "coast" figure (what would be enough now if you stopped adding and let it grow to the
// retirement age). Everything in today's dollars.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeContributions } from "../contributions/compute.js";
import { buildInputs } from "../projection/compute.js";
import { realRate } from "../../../core/math/finance.js";

/**
 * compute(plan, { today, withdrawalRate = 0.04 }) -> {
 *   ready, spendingYearly, withdrawalRate, fiNumber, invested (retirement money today), progress, gap,
 *   savingYearly (contributions + what is left over each month), savingsRate (of income), realReturn,
 *   yearsToFi, fiAge, fiYear, coast: { number, reached }, retireAge, yearsToRetire, hasIncome
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const wr = Number(params.withdrawalRate ?? plan.retirement?.withdrawalRate ?? 0.04);
  const b = buildInputs(plan, params);
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  const ex = (plan.expenses ?? []).length ? computeExpenses(plan, { today }) : null;
  const spendingYearly = b.inputs ? b.inputs.spending.yearly : (ex ? ex.monthly * 12 : 0);
  if (!spendingYearly) return { ready: false, missing: ["what you spend (Expenses page, or the retirement spending figure on the Projection page)"] };
  const a = plan.assumptions ?? {}, rt = plan.retirement ?? {};
  const stocks = Number(rt.stocksNow ?? 0.7);
  const nominal = stocks * Number(a.returnStocks ?? 0.07) + (1 - stocks) * Number(a.returnBonds ?? 0.04);
  const realReturn = realRate(nominal, Number(a.inflation ?? 0.03));
  const invested = b.inputs ? b.inputs.balances.taxable + b.inputs.balances.deferred + b.inputs.balances.free : 0;
  const fiNumber = spendingYearly / wr;
  const contrib = computeContributions(plan, { today });
  const leftOver = ex && inc ? Math.max(0, (inc.monthly - ex.monthly) * 12) : 0;
  const savingYearly = contrib.totalYearly + Math.max(0, leftOver - contrib.yearly);   // what is left over already includes the contributions typed as expenses? no: contributions are not expenses, so count both but never twice
  const income = inc ? inc.yearly : 0;
  const savingsRate = income > 0 ? Math.min(1, savingYearly / income) : null;
  let yearsToFi = null, pot = invested;
  if (pot >= fiNumber) yearsToFi = 0;
  else if (savingYearly > 0 || realReturn > 0) { for (let y = 1; y <= 80; y++) { pot = pot * (1 + realReturn) + savingYearly; if (pot >= fiNumber) { yearsToFi = y; break; } } }
  const primary = b.people?.[0] ?? null;
  const age = primary ? year - primary.birthYear : null;
  const retireAge = primary ? primary.retireAge : Number(a.retirementAge ?? 65);
  const yearsToRetire = age !== null ? Math.max(0, retireAge - age) : null;
  const coastNumber = yearsToRetire !== null ? fiNumber / Math.pow(1 + realReturn, yearsToRetire) : null;
  return {
    ready: true, spendingYearly, withdrawalRate: wr, fiNumber, invested, progress: Math.min(1, invested / fiNumber), gap: Math.max(0, fiNumber - invested),
    savingYearly, savingsRate, realReturn, yearsToFi, fiAge: yearsToFi !== null && age !== null ? age + yearsToFi : null, fiYear: yearsToFi !== null ? year + yearsToFi : null,
    coast: coastNumber !== null ? { number: coastNumber, reached: invested >= coastNumber } : null, retireAge, yearsToRetire, age, hasIncome: !!income,
  };
}
