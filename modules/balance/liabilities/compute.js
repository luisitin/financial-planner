// modules/balance/liabilities/compute.js -- PURE. Every debt with its rate and payment: what
// it costs each month, when it is gone at the current payment, and the household's
// debt-to-income ratio. Balances come from the accounts; the loan detail (rate, payments)
// lives in plan.debts, one entry per liability account.
import { ACCOUNT_TYPES, isLiability } from "../net-worth/compute.js";
import { nper, amortization } from "../../../core/math/finance.js";
import { addMonths } from "../../../core/math/dates.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { money } from "../../../core/format.js";
import { isGuess } from "../../../core/estimate/index.js";

export const DEBT_ICONS = { credit: "💳", mortgage: "🏠", student_loan: "🎓", loan: "🚗", other_liability: "📄" };
export const HIGH_RATE = 0.15;   // above this a debt is flagged as expensive

/**
 * The lines for debt payments against gross monthly income, which depend on whether the home is owned (round 8,
 * 2026-11-06). CFPB, Your Money, Your Goals, "Debt-to-income calculator tool" (2018-11,
 * https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_debt_income_calc_tool_2018-11_ADA.pdf, read
 * 2026-11-06): homeowners "Consider maintaining a debt-to-income ratio for all debts of 36 percent or less. Some lenders
 * will go up to 43 percent or higher. Your home mortgage is included in this ratio."; renters "15-20 percent or less. Your
 * rent is not included in this ratio." `high` for renters is the app's: above the homeowners' 36%, which counts a mortgage
 * too, debts alone are stretched. The pages graded a renter's 21% "comfortable" against the homeowners' 36%.
 */
export const DTI_LINES = { owner: { good: 0.36, high: 0.43 }, renter: { fine: 0.15, good: 0.2, high: 0.36 } };
/**
 * Fannie Mae's limits once a home lender adds the housing payment (Selling Guide B3-6-02, "Debt-to-Income Ratios", updated
 * 2025-04-02, https://selling-guide.fanniemae.com/sel/b3-6-02/debt-income-ratios, read 2026-11-06): 36% for loans checked
 * by hand, up to 45% with the credit score and savings its matrix asks for; 50% at most through its automated check (DU).
 */
export const LENDER_DTI = { usual: 0.36, stretch: 0.45, most: 0.5 };
/**
 * shownShare(x) -> the share at the whole percent a page shows it (0.203 -> 0.2), or null. Round 8 review (2026-11-06): the
 * pages graded the unrounded share and showed it rounded, so 20.3% read "20% ... the guideline is 20% or less: over". Every
 * debt-to-income and housing line on Debts, What lenders see, How am I doing and the Plan health score is graded on it. It
 * rounds as core/format.js pct prints (x * 100 to 12 significant digits, then to the whole percent; verify, 2026-11-06: 0.285 is
 * stored as 0.28499999999999998, so Math.round(x * 100) gave 28 where the page printed "29%").
 */
export const shownShare = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(Number((x * 100).toPrecision(12))) / 100);
/**
 * renterLevel(share) -> "fine" (15% or less) | "within" (to 20%) | "over" (to 36%) | "stretched" | null: a renter's required
 * debt payments against gross income (DTI_LINES.renter), at the percent shown. One answer for the four pages.
 */
export function renterLevel(share) {
  const x = shownShare(share), R = DTI_LINES.renter;
  return x === null ? null : x <= R.fine + 1e-9 ? "fine" : x <= R.good + 1e-9 ? "within" : x <= R.high + 1e-9 ? "over" : "stretched";
}
/**
 * lenderWithHousing(share, housingMonthly, currency) -> the sentence for a renter's required payments with a housing payment
 * like the rent added (share = (required debt payments + rent) / gross income), against LENDER_DTI, at the percent shown, with a
 * verdict (round 8 review: "50% ... 45 to 50% only with a strong credit score and savings" read as "within"): up to 36% within
 * what most lenders want, to 45% more than most like, above it more than most accept. `guessed`: some of the rent is still our
 * guess (a housing bill whose amount is in the guesses ledger): "the $1,200 rent we guessed for you (type yours on Expenses)".
 */
export function lenderWithHousing(share, housingMonthly, currency = "USD", { guessed = false } = {}) {
  const x = shownShare(share), pc = (v) => `${Math.round(v * 100)}%`;
  // a rent that is still our guess (core/estimate) is not "your rent" (verify, 2026-11-06)
  const rent = guessed ? `the ${money(housingMonthly, currency)} rent we guessed for you (type yours on Expenses)` : `your ${money(housingMonthly, currency)} rent`;
  const head = `Add a home payment like ${rent} and a lender would see ${pc(x)} of your income going to debts`;
  if (x <= LENDER_DTI.usual + 1e-9) return `${head}: within the ${pc(LENDER_DTI.usual)} most lenders want.`;
  if (x <= LENDER_DTI.stretch + 1e-9) return `${head}: more than the ${pc(LENDER_DTI.usual)} most lenders like; some go to ${pc(LENDER_DTI.stretch)} with a strong credit score and savings.`;
  return `${head}: more than most lenders accept (${pc(LENDER_DTI.usual)}, or up to ${Math.round(LENDER_DTI.stretch * 100)} to ${pc(LENDER_DTI.most)} only with a strong credit score and savings).`;
}
/**
 * rentsHome(plan, rows) -> true when the household has no mortgage owed and no home on file (no Real estate account): the
 * renters' line applies to its debt payments (DTI_LINES.renter). A home owned outright or a mortgage: the homeowners' line.
 */
export function rentsHome(plan, rows) {
  const mortgage = (rows ?? []).some((r) => r.type === "mortgage" && r.owed > 0);
  const home = (plan.accounts ?? []).some((a) => a.type === "property");
  return !mortgage && !home;
}

/**
 * compute(plan, { today }) -> {
 *   rows: [{ account fields..., icon, typeLabel, owed, detail: debt | null, rate, minPayment, extra, payment (0 once paid off),
 *            paidOff (a debt with detail and nothing owed), typedPayment (the payment typed, kept when paid off),
 *            interestMonthly, months (to payoff at `payment`; null without a payment; Infinity if it never pays off),
 *            payoffDate, totalInterest, expensive, neverPaysOff, byGuesses? }],
 *   count, withDetail, owed, minimums, payments, interestMonthly, avgRate (balance-weighted, over rows with a rate),
 *   income: monthly gross | null, dti (payments / income) | null, dtiRequired (minimums / income) | null, highest: row | null,
 *   warnings: [text]
 * }
 * dtiRequired (round 8 review, 2026-11-06): the required payments only, as a home lender counts them (Fannie Mae Selling Guide
 * B3-6-05, "Monthly Debt Obligations", dated 2026-08-05, read 2026-11-06: a revolving account at the minimum payment the credit
 * report shows, 5% of the balance when none is shown), not an extra the household chooses to pay. The renters' line is graded on
 * it; `dti` (with the extra) is kept for the homeowners' line, which has always used it.
 * byGuesses (only when true): both what is owed and the rate are our guesses (docs/CONVENTIONS.md "Guesses"). Such a debt
 * is not called expensive (no amber pill, warning or alert): a guess never turns a figure amber by itself (smart-guesses
 * spec P7). A typed balance or rate keeps the flag as before.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const debts = plan.debts ?? [];
  // a plan with no guesses is never looked at (older plans compute exactly as before)
  const led = plan.guesses && typeof plan.guesses === "object" && Object.keys(plan.guesses).length > 0;
  const rows = (plan.accounts ?? []).filter((a) => isLiability(a.type)).map((a) => {
    const detail = debts.find((x) => x.accountId === a.id) ?? null;
    const owed = Math.abs(Number(a.balance) || 0);
    const rate = detail ? Number(detail.rate) || 0 : null;
    // a debt with nothing owed is paid off: no payment is due, so it adds nothing to what is paid each month, the
    // debt-to-income share or what lenders see (round 4, 2026-11-02); `typedPayment` keeps what was typed, so Expenses
    // can still tell which expense was its payment
    const paidOff = !!detail && owed === 0;
    const typedPayment = detail ? (Number(detail.minPayment) || 0) + (Number(detail.extra) || 0) : 0;
    const minPayment = detail && !paidOff ? Number(detail.minPayment) || 0 : 0;
    const extra = detail && !paidOff ? Number(detail.extra) || 0 : 0;
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
    const byGuesses = led && !!detail && typeof a.id === "string" && typeof detail.id === "string" && isGuess(plan, `accounts[${a.id}].balance`) && isGuess(plan, `debts[${detail.id}].rate`);
    return {
      ...a, icon: DEBT_ICONS[a.type] ?? "📄", typeLabel: t.label, owed, detail, rate, minPayment, extra, payment, paidOff, typedPayment, interestMonthly, months,
      payoffDate: today && Number.isFinite(months) && months !== null ? addMonths(today, months) : null,
      totalInterest, expensive: !byGuesses && rate !== null && rate >= HIGH_RATE && owed > 0, neverPaysOff: months === Infinity,
      ...(byGuesses ? { byGuesses: true } : {}),
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
  // rows are highest rate first: only the first expensive debt is "first"; each later one says when (round 8 review, 2026-11-06:
  // three notices each said "first"). With a saved payoff order that is not highest-rate-first (smallest balance first, or the
  // person's own order) the notices follow that saved order instead (2026-11-07): the same order the Pay off debts page pays in
  const saved = ["snowball", "custom"].includes(plan.debtPlan?.order) ? plan.debtPlan.order : "avalanche";
  const customOrder = Array.isArray(plan.debtPlan?.customOrder) ? plan.debtPlan.customOrder : [];
  const rank = (r) => saved === "snowball" ? r.owed : customOrder.indexOf(r.id) >= 0 ? customOrder.indexOf(r.id) : 1e9;
  // every debt Pay off debts pays, not only the expensive ones: a cheaper debt the saved order pays in between two cards comes between them
  const planOrder = saved === "avalanche" ? rows.filter((r) => r.expensive) : rows.filter((r) => r.detail && r.owed > 0 && r.payment > 0).sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
  for (const r of rows) {
    if (r.neverPaysOff) warnings.push(`${r.name}: the payment does not even cover the interest, so it never pays off. Raise the payment.`);
    if (r.expensive) {
      const i = planOrder.indexOf(r), before = i > 0 ? planOrder[i - 1].name : null, inPlan = i >= 0;
      const costs = `${r.name} costs about ${money(r.interestMonthly, cur)} a month in interest at ${Math.round(r.rate * 1000) / 10}%.`;
      warnings.push(`${costs} ${before ? `Pay it down once the ${before} is paid off.` : saved === "avalanche" ? "Paying it down first saves the most." : inPlan ? "Your payoff plan pays it down first." : ""}`.trim());
    }
  }
  return {
    rows, count: rows.length, withDetail: rows.filter((r) => r.detail).length, owed,
    minimums: sum("minPayment"), payments, interestMonthly: sum("interestMonthly"), avgRate,
    income, dti: income ? payments / income : null, dtiRequired: income ? sum("minPayment") / income : null,
    highest: rated[0] ?? null, warnings, order: saved,
  };
}
