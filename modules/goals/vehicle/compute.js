// modules/goals/vehicle/compute.js -- PURE. The next car, two ways: save up and pay cash (what to put
// aside a month to have it by the date), or finance it (what is saved by then goes down, the rest is a
// loan: the payment and the interest), and the common 20/4/10 rule: at least 20% down, a loan of at most
// four years, and car costs under 10% of gross income.
import { pmt, pmtToReach, fv } from "../../../core/math/finance.js";
import { compute as computeGoals } from "../goals/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { monthsBetween } from "../../../core/math/dates.js";

export const DEFAULTS = { price: 30000, salesTax: 0.06, tradeIn: 0, date: "", rate: 0.07, termMonths: 60, saved: null, monthly: null };
/** The 20/4/10 rule of thumb: 20% down, four years at most, car costs (payment, insurance, fuel, upkeep) under 10% of gross income. */
export const RULE = { down: 0.2, months: 48, share: 0.1 };
const CAR = /car|vehicle|truck|suv|van/i;

/**
 * compute(plan, { today }) -> {
 *   inputs, goal, net (price + sales tax - trade-in), monthsToDate, cashRate, saved, monthly, savedByDate,
 *   cash: { neededMonthly, interestEarned }, finance: { down, loan, payment, totalInterest, totalPaid, months },
 *   rule: { downShare, downOk, termOk, carCostsMonthly, share, shareOk }, verdict ("cash"|"finance"), warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.whatIfs?.vehicle ?? {};
  const g = computeGoals(plan, { today }).goals.find((x) => CAR.test(x.name ?? "")) ?? null;
  const x = {};
  for (const [k, v] of Object.entries(DEFAULTS)) { const y = s[k]; x[k] = typeof v === "string" ? (y || v) : y === null || y === undefined || y === "" || !Number.isFinite(Number(y)) ? v : Number(y); }
  if (!s.price && g) x.price = g.targetThen ?? Number(g.target) ?? x.price;
  if (!x.date && g?.targetDate) x.date = g.targetDate;
  const net = Math.max(0, x.price * (1 + x.salesTax) - x.tradeIn);
  const saved = x.saved !== null ? x.saved : g ? g.funded : 0;
  const monthly = x.monthly !== null ? x.monthly : g ? Number(g.monthly) || 0 : 0;
  const cashRate = Number(plan.assumptions?.returnCash ?? 0.02);
  const months = today && x.date ? Math.max(0, monthsBetween(today, x.date)) : 12;
  const r = cashRate / 12;
  const savedByDate = Math.min(net, fv(r, months, monthly, saved));
  const neededMonthly = Math.max(0, pmtToReach(r, months, net, saved));
  const interestEarned = Math.max(0, net - saved - neededMonthly * months);
  // financing: what is saved by the date goes down, the rest is borrowed
  const down = savedByDate, loan = Math.max(0, net - down);
  const payment = loan > 0 ? pmt(x.rate / 12, x.termMonths, loan) : 0;
  const totalPaid = payment * x.termMonths, totalInterest = Math.max(0, totalPaid - loan);
  // 20/4/10: the car's share of gross income, the payment plus the transport costs already on Expenses
  const inc = computeIncome(plan, { today });
  const ex = computeExpenses(plan, { today });
  const carNow = ex.active.filter((e) => e.category === "transport").reduce((t, e) => t + e.monthly, 0);
  const carCostsMonthly = payment + carNow;
  const share = inc.monthly > 0 ? carCostsMonthly / inc.monthly : null;
  const downShare = x.price > 0 ? down / (x.price * (1 + x.salesTax)) : 0;
  const rule = { downShare, downOk: downShare >= RULE.down - 1e-9, termOk: loan <= 0 || x.termMonths <= RULE.months, carCostsMonthly, share, shareOk: share === null ? null : share <= RULE.share };
  const warnings = [];
  if (loan > 0 && x.termMonths > 72) warnings.push("A loan over six years usually means owing more than the car is worth for most of it.");
  return { inputs: x, goal: g ? { id: g.id, name: g.name } : null, net, monthsToDate: months, cashRate, saved, monthly, savedByDate, cash: { neededMonthly, interestEarned }, finance: { down, loan, payment, totalInterest, totalPaid, months: x.termMonths }, rule, verdict: loan <= 0.5 ? "cash" : "finance", warnings };
}
