// modules/goals/house/compute.js -- PURE. Buying a home: the most the household's income supports by the
// lenders' rules (housing costs up to 28% of gross income; all debt payments up to 36%), the monthly cost of
// the home you have in mind, the cash it takes (the down payment, closing costs and the reserves lenders like
// to see), and when you get there at what you save now, or what a month gets you there by a date.
import { pmt, pmtToReach } from "../../../core/math/finance.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeGoals } from "../goals/compute.js";
import { monthsBetween } from "../../../core/math/dates.js";

export const DEFAULTS = { price: 400000, downShare: 0.2, closingShare: 0.03, rate: 0.065, termYears: 30, taxRate: 0.011, insuranceRate: 0.0035, hoaMonthly: 0, reserveMonths: 2, saved: null, monthly: null, targetDate: "" };
/** The lenders' ratios: housing up to 28% of gross monthly income (front end), all debt payments up to 36% (back end). */
export const FRONT = 0.28, BACK = 0.36;
/**
 * The house goal on Goals: saving to buy a home, never a goal for a home you already have or for a car. Each goal gets
 * a rank, and the highest wins (the first of equals), so a real down-payment goal beats "Our home" listed before it:
 *   3  a name with "down payment" (what "Make it a goal" saves), unless it names a car, boat or the like
 *   2  the 🏠 icon, or a name for buying a home ("home buying", "homeowner"), unless the name is turned away below
 *   1  a name with house, home or condo, also run into another word ("Townhouse", "Farmhouse"), unless turned away
 *   0  anything else, and any name about work on, paying for or a trip to a home you have: repairs, remodel, paint,
 *      pay off, mortgage, rent, insurance, office, gym, trip, visit, holiday... ("Pay off the house", "Trip home")
 * The step-by-step guide's "Set down payment goal" step uses the same test, so the page and the step always agree.
 */
const DOWN = /down[ -]?payment/i;
const VEHICLE = /\b(car|cars|auto|vehicle|truck|van|suv|boat|rv|motorcycle|bike|tractor)\b/i;
const BUYING = /\bhome[ -]?(buy|own|purchas)|\b(buy|buying|purchase)\b.*\b(house|home|condo)/i;
const HOUSE = /(\b|town|farm|row)(house|home)s?\b|\bcondo(minium)?s?\b/i;
const NOT_BUYING = /repair|remodel|renovat|improve|\breno\b|roof|paint|insur|warrant|mainten|upkeep|school|office|\bgym\b|pay ?-?off|payoff|mortgage|\bloans?\b|\btrips?\b|visit|holiday|vacation|flight|\brent(al|als|ing|s)?\b|\bhoa\b|\btax|furnish|furnitur|decor|garden|landscap|kitchen|bath|clean|equity|heloc|\bbills?\b|utilit|internet|security|alarm|solar|theat(er|re)|\btv\b|appliance|hvac|fence|\bpool\b|deck|patio|windows?|floor|carpet|nursing|\bcare\b|warming|party/i;
export function houseGoalRank(g) {
  const n = g?.name ?? "";
  if (DOWN.test(n)) return VEHICLE.test(n) ? 0 : 3;
  if (NOT_BUYING.test(n) || VEHICLE.test(n)) return 0;
  if (g?.icon === "🏠" || BUYING.test(n)) return 2;
  return HOUSE.test(n) ? 1 : 0;
}
export const isHouseGoal = (g) => houseGoalRank(g) > 0;
/** The best house goal in a list (highest rank, the first of equals), or null. */
export function findHouseGoal(goals) {
  let best = null, top = 0;
  for (const g of goals ?? []) { const r = houseGoalRank(g); if (r > top) { best = g; top = r; } }
  return best;
}

/** The monthly cost of a home at a price: principal and interest, property tax, insurance, HOA. */
export function monthlyCost(price, x) {
  const loan = price * (1 - x.downShare);
  return (loan > 0 ? pmt(x.rate / 12, x.termYears * 12, loan) : 0) + price * (x.taxRate + x.insuranceRate) / 12 + x.hoaMonthly;
}
/** The highest price whose monthly cost fits a budget (the cost rises in a straight line with the price). */
export function priceFor(budget, x) {
  const perDollar = monthlyCost(1, { ...x, hoaMonthly: 0 });
  return Math.max(0, (budget - x.hoaMonthly) / perDollar);
}

/**
 * The price whose cash on the day (down payment + closing costs + reserves of the monthly cost) is `cash`: the cash rises
 * in a straight line with the price, cash(price) = price x (down + closing + reserve months x cost per dollar) + HOA x reserve months.
 */
export function priceForCash(cash, x) {
  const perDollar = monthlyCost(1, { ...x, hoaMonthly: 0 });
  const share = x.downShare + x.closingShare + x.reserveMonths * perDollar;
  return share > 0 ? Math.max(0, (cash - x.hoaMonthly * x.reserveMonths) / share) : 0;
}

/**
 * compute(plan, { today }) -> {
 *   inputs, grossMonthly, otherDebtMonthly, maxFront, maxBack, maxPrice, rule ("front"|"back"),
 *   monthly (the chosen price), parts: { principalInterest, taxInsurance, hoa }, frontShare, backShare,
 *   cash: { down, closing, reserves, total }, saved, goal (the house goal on Goals, if any), monthlySaving,
 *   monthsToGo, readyDate, neededMonthly (to reach it by the target date), warnings,
 *   fromGoal: true when the page has never been saved and opens on the price the house goal's target buys (goalTarget)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.whatIfs?.house ?? {};
  const x = {};
  for (const [k, v] of Object.entries(DEFAULTS)) { const y = s[k]; x[k] = typeof v === "string" ? (y ?? v) : y === null || y === undefined || y === "" || !Number.isFinite(Number(y)) ? v : Number(y); }
  // never saved here, and a house goal with an amount: open on the home that amount buys, not on the $400,000 example
  const g = computeGoals(plan, { today });
  const goal = findHouseGoal(g.goals);
  const goalTarget = goal && Number(goal.target) > 0 ? Number(goal.target) : null;
  const fromGoal = !plan.whatIfs?.house && goalTarget !== null;
  if (fromGoal) x.price = Math.round(priceForCash(goalTarget, x) / 1000) * 1000;
  const inc = computeIncome(plan, { today });
  const grossMonthly = inc.monthly ?? 0;
  const li = computeLiabilities(plan, { today });
  // the debt payments that stay: everything but a mortgage (a new home replaces it)
  const otherDebtMonthly = li.rows.filter((r) => r.type !== "mortgage").reduce((t, r) => t + (r.payment || 0), 0);
  const maxFront = grossMonthly * FRONT, maxBack = Math.max(0, grossMonthly * BACK - otherDebtMonthly);
  const budget = Math.min(maxFront, maxBack);
  const maxPrice = grossMonthly > 0 ? priceFor(budget, x) : null;
  const loan = x.price * (1 - x.downShare);
  const pi = loan > 0 ? pmt(x.rate / 12, x.termYears * 12, loan) : 0;
  const monthly = monthlyCost(x.price, x);
  const cash = { down: x.price * x.downShare, closing: x.price * x.closingShare, reserves: monthly * x.reserveMonths };
  cash.total = cash.down + cash.closing + cash.reserves;
  // what is set aside: the figure entered, else the house goal on Goals
  const saved = x.saved !== null ? x.saved : goal ? goal.funded : 0;
  const monthlySaving = x.monthly !== null ? x.monthly : goal ? Number(goal.monthly) || 0 : 0;
  const rate = Number(plan.assumptions?.returnCash ?? 0.02) / 12;
  const left = Math.max(0, cash.total - saved);
  const monthsToGo = left <= 0 ? 0 : monthlySaving > 0 ? solveMonths(rate, saved, monthlySaving, cash.total) : null;
  const readyDate = today && monthsToGo !== null && Number.isFinite(monthsToGo) ? addMonthsIso(today, monthsToGo) : null;
  const target = x.targetDate || goal?.targetDate || "";
  const monthsToTarget = today && target ? monthsBetween(today, target) : null;
  // opened from the goal: the Goals page's own monthly figure, so the two pages agree
  const goalMonthly = goal?.neededMonthly === null || goal?.neededMonthly === undefined || goal?.neededMonthly === "" ? null : Number(goal.neededMonthly);
  const neededMonthly = fromGoal && Number.isFinite(goalMonthly) && !x.targetDate ? goalMonthly
    : monthsToTarget && monthsToTarget > 0 ? Math.max(0, pmtToReach(rate, monthsToTarget, cash.total, saved)) : null;
  const warnings = [];
  if (x.downShare < 0.2) warnings.push(`With under 20% down, most lenders add mortgage insurance (often 0.3% to 1.5% of the loan a year) until you reach 20%.`);
  if (maxPrice !== null && x.price > maxPrice) warnings.push(`At ${Math.round(monthly)} a month this home is over what the lenders' rules suggest for your income.`);
  return {
    inputs: x, grossMonthly, otherDebtMonthly, maxFront, maxBack, maxPrice, rule: maxFront <= maxBack ? "front" : "back",
    monthly, parts: { principalInterest: pi, taxInsurance: x.price * (x.taxRate + x.insuranceRate) / 12, hoa: x.hoaMonthly },
    frontShare: grossMonthly > 0 ? monthly / grossMonthly : null, backShare: grossMonthly > 0 ? (monthly + otherDebtMonthly) / grossMonthly : null,
    cash, saved, goal: goal ? { id: goal.id, name: goal.name, target: goalTarget } : null, monthlySaving, monthsToGo, readyDate, target, neededMonthly, warnings,
    fromGoal, goalTarget,
  };
}

/** Months to grow `start` plus `monthly` deposits to `goal` at a monthly rate (Infinity if never). */
export function solveMonths(rate, start, monthly, goal) {
  if (start >= goal) return 0;
  if (monthly <= 0 && rate <= 0) return Infinity;
  let bal = start;
  for (let m = 1; m <= 1200; m++) { bal = bal * (1 + rate) + monthly; if (bal >= goal - 1e-9) return m; }
  return Infinity;
}
function addMonthsIso(iso, n) {
  const [y, m] = String(iso).split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
