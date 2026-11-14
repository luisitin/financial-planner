// modules/goals/house/compute.js -- PURE. Buying a home: the most the household's income supports by the
// lenders' rules (housing costs up to 28% of gross income; all debt payments up to 36%), the monthly cost of
// the home you have in mind, the cash it takes (the down payment, closing costs and the reserves lenders like
// to see), and when you get there at what you save now, or what a month gets you there by a date.
import { pmt, pmtToReach } from "../../../core/math/finance.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeGoals } from "../goals/compute.js";
import { monthsBetween } from "../../../core/math/dates.js";
// the sourced tables behind our guesses (data only) and two small helpers of the guesses module, so a gray figure here is
// worked out exactly as the same figure is elsewhere (docs/CONVENTIONS.md "Guesses"; README "Our guesses in the boxes")
import { T as HOME } from "../../overview/guesses/data/home.js";
import { T as PURCHASE } from "../../overview/guesses/data/purchase.js";
import { STATE_NAME } from "../../overview/guesses/data/index.js";
import { cpiSince, stateOf, fit, YOUR_STATE } from "../../overview/guesses/estimators/common.js";
import { insuranceYear } from "../../overview/guesses/estimators/home.js";
import { T as SPEND } from "../../overview/guesses/data/spend.js";
import { estimate } from "../../../core/estimate/engine.js";

export const DEFAULTS = { price: 400000, downShare: 0.2, closingShare: 0.03, rate: 0.065, termYears: 30, taxRate: 0.011, insuranceRate: 0.0035, hoaMonthly: 0, reserveMonths: 2, saved: null, monthly: null, targetDate: "" };
/**
 * The boxes that can show our guess in gray while they are empty (smart guesses C9, spec 12.1 "K3 previews"): counted in
 * this page's answer only while the box stays empty, never saved (an empty box saves null, as before), and gone the moment
 * the person types. Each is the estimator `goals/house:<key>` below. compute() asks for them itself (previewsOf, through
 * core/estimate as the shell's ctx.guess does), so this page and every other page that quotes it (Your plan's "home" row)
 * count the same figures (critic e9 F1: the House page said up to $575,629 and Your plan $636,884 for one household).
 * `params.previews: null` works exactly as before (DEFAULTS); an object of numbers is used as given (tests).
 */
export const PREVIEWED = ["price", "rate", "taxRate", "insuranceRate"];
/** What each previewed box is called in the line that says which figures are our guesses. */
const GUESS_NAMES = { price: "the price", rentMonthly: "the rent", rate: "the rate", taxRate: "property tax", insuranceRate: "insurance" };
const NAME_ORDER = Object.keys(GUESS_NAMES);
/**
 * The one line under the answer that says which figures are our guesses (docs/OPTIONAL.md R9 #5: a reason to doubt a figure is
 * never folded away): "Our guess for now: the price." / "Our guesses for now: the price and the rate." / "Our guesses for now:
 * the price, the rate, property tax and insurance." "" for none. Rent vs buy says it the same way.
 */
export function guessedWords(keys) {
  const names = [...new Set((Array.isArray(keys) ? keys : []).filter((k) => GUESS_NAMES[k]))].sort((a, b) => NAME_ORDER.indexOf(a) - NAME_ORDER.indexOf(b)).map((k) => GUESS_NAMES[k]);
  if (!names.length) return "";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `Our ${names.length === 1 ? "guess" : "guesses"} for now: ${list}.`;
}
/** A box's gray figure, written as the person would type it: money "250,000", a share of value "1.2" or "0.46" (the "%" is the box's own). */
export function previewText(value, type) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  if (type === "percent") return String(Number((value * 100).toFixed(2)));
  return Math.round(value).toLocaleString("en-US");
}
const blankOf = (y) => y === null || y === undefined || y === "" || !Number.isFinite(Number(y));
/**
 * Our guesses for the empty PREVIEWED boxes, worked out exactly as the shell's ctx.guess works them (core/estimate's
 * estimate(): U.S. figures only, applies(); the same rounding; the estimators below with the tables they name). A box with a
 * saved figure is never asked about. Insurance is a share of `price` when given (the price the answer counts: the house goal's
 * price, critic e9 F4), else of the typed price, else of our price guess. PURE.
 * -> { price?, rate?, taxRate?, insuranceRate? } Estimates ({ value, why, ... })
 */
export function previewsOf(plan, { today = null, price = null } = {}) {
  const s = plan?.whatIfs?.house ?? {};
  const tables = Object.fromEntries([VALUE_ST, PTAX, PMMS, HO3, VALUE_MS].map((id) => [id, HOME[id] ?? PURCHASE[id] ?? SPEND[id]]).filter(([, t]) => t));
  const ask = (k, args) => { try { const e = estimate(plan, `goals/house:${k}`, { estimators, tables, today, args }); return e && typeof e.value === "number" && Number.isFinite(e.value) ? e : null; } catch { return null; } };
  const out = {};
  for (const k of ["price", "rate", "taxRate"]) if (blankOf(s[k])) { const e = ask(k); if (e) out[k] = e; }
  if (blankOf(s.insuranceRate)) {
    const at = typeof price === "number" && price > 0 ? price : blankOf(s.price) ? out.price?.value ?? null : Number(s.price);
    const e = ask("insuranceRate", { price: at });
    if (e) out.insuranceRate = e;
  }
  return out;
}
const valuesOf = (est) => Object.fromEntries(Object.entries(est).map(([k, e]) => [k, e.value]));

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
 *   fromGoal: true when the page has never been saved and opens on the price the house goal's target buys (goalTarget),
 *   previewed: the PREVIEWED keys whose gray figure is counted (absent with params.previews: null)
 * }
 * params.previews: left out, our own guesses for the boxes the person left empty (previewsOf: what the page shows in gray);
 *   null, none (the DEFAULTS example, as before C9); { price?, rate?, taxRate?, insuranceRate? } numbers, used as given
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.whatIfs?.house ?? {};
  const x = {};
  // our gray figures: only for a box left empty; our own unless the caller passes its own (or null for none)
  const own = params.previews === undefined;
  const pv = own ? valuesOf(previewsOf(plan, { today })) : params.previews && typeof params.previews === "object" ? params.previews : null;
  const previewed = [];
  for (const [k, v] of Object.entries(DEFAULTS)) {
    const y = s[k];
    const blank = blankOf(y);
    if (typeof v === "string") x[k] = y ?? v;
    else if (!blank) x[k] = Number(y);
    else if (pv && PREVIEWED.includes(k) && typeof pv[k] === "number" && Number.isFinite(pv[k])) { x[k] = pv[k]; previewed.push(k); }
    else x[k] = v;
  }
  // never saved here, and a house goal with an amount: open on the home that amount buys, not on the $400,000 example
  const g = computeGoals(plan, { today });
  const goal = findHouseGoal(g.goals);
  const goalTarget = goal && Number(goal.target) > 0 ? Number(goal.target) : null;
  const fromGoal = !plan.whatIfs?.house && goalTarget !== null;
  if (fromGoal) {
    x.price = Math.round(priceForCash(goalTarget, x) / 1000) * 1000;
    if (previewed.includes("price")) previewed.splice(previewed.indexOf("price"), 1);
    // our insurance guess as a share of the price it is counted on, the goal's (critic e9 F4: it was worked at our typical
    // price): asked again at that price, and the price worked out again with it (the share moves only near the $350 floor)
    if (own && previewed.includes("insuranceRate")) for (let i = 0; i < 3; i++) {
      const v = previewsOf(plan, { today, price: x.price }).insuranceRate?.value;
      if (typeof v !== "number" || v === x.insuranceRate) break;
      x.insuranceRate = v;
      x.price = Math.round(priceForCash(goalTarget, x) / 1000) * 1000;
    }
  }
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
    // the boxes whose gray figure the answer counts (none with params.previews: null, as before C9)
    ...(pv ? { previewed } : {}),
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

// ---------------------------------------------------------------- our guesses for the boxes (smart guesses C9, spec 12.1 K3)
// Each is a population figure from a bundled, sourced table (modules/overview/guesses/data/, with its publisher and read
// date); the formulas and sources are in this module's README, "Our guesses in the boxes". They are previews only: the page
// shows them gray and counts them while a box is empty; nothing here writes the plan or makes a guess entry.
const VALUE_ST = "acs2025_median_home_value_by_state", PTAX = "acs2025_effective_property_tax_rate_by_state", PMMS = "pmms30_annual_average_by_year";
const HO3 = "naic2023_homeowners_premium_by_state", VALUE_MS = "acs2025_median_home_value_by_state_and_mortgage_status";
const cellOf = (t, row, c) => { const i = Array.isArray(t?.cols) ? t.cols.indexOf(c) : -1; const v = i >= 0 ? t.rows?.[row]?.[i] : null; return typeof v === "number" && Number.isFinite(v) ? v : null; };
const where = (st) => (st ? STATE_NAME[st] : "U.S.");
/** Where our gray figures are typical, in words: "Texas", or "the U.S." with no state. */
export const placeOf = (plan) => { const st = stateOf(plan); return st ? STATE_NAME[st] : "the U.S."; };
const HOUSE_PAGE = () => "#/goals/house";

/** A typical home's price in the state (the U.S. with no state): the ACS 2025 median value of owner-occupied homes, in 2025 prices. */
export function typicalPrice(st) {
  const t = HOME[VALUE_ST];
  const v = cellOf(t, "value", st ?? "US") ?? cellOf(t, "value", "US");
  return v === null ? null : v * cpiSince(t.dollarsOf ?? 2025);
}
/** The rate on a new 30-year fixed mortgage: Freddie Mac's average of the newest year in the table (the year so far). -> { rate, year } | null */
export function newLoanRate() {
  const t = PURCHASE[PMMS];
  const row = t?.rows?.["30-year fixed"], year = Array.isArray(t?.cols) ? t.cols.at(-1) : null;
  const v = Array.isArray(row) ? row.at(-1) : null;
  return typeof v === "number" && Number.isFinite(v) && year ? { rate: v / 100, year: Number(year) } : null;
}
/** Property tax a year as a share of the home's value: the state's median tax over its median value (ACS 2025), the U.S.'s with no state. */
export function taxShare(st) {
  const v = cellOf(HOME[PTAX], "median taxes / median value", st ?? "US") ?? cellOf(HOME[PTAX], "median taxes / median value", "US");
  return v === null ? null : v / 100;
}
/** Home insurance a year as a share of the price: the guesses module's own figure for a home at that price (insuranceYear) over the price. */
export function insuranceShare(st, price) {
  const p = typeof price === "number" && price > 0 ? price : cellOf(HOME[VALUE_MS], "all owners", st ?? "US");
  if (!(p > 0)) return null;
  const y = insuranceYear(st, p);
  return typeof y === "number" && Number.isFinite(y) && y > 0 ? y / p : null;
}

export const estimators = {
  "goals/house:price": {
    tier: 4, order: 20, label: "Price of a home to buy", unit: "total", weight: "big", page: HOUSE_PAGE, reads: [],
    fn(plan) {
      const st = stateOf(plan), v = typicalPrice(st);
      if (v === null) return null;
      return { value: v, sigma: null, measured: false, why: `a typical ${where(st)} home`, uses: { state: st ? "typed" : null }, sharperWith: st ? [] : [YOUR_STATE], tables: [VALUE_ST] };
    },
  },
  "goals/house:rate": {
    tier: 4, order: 21, label: "Rate on a new 30-year mortgage", unit: "rate", weight: "big", page: HOUSE_PAGE, reads: [],
    fn(plan, { today }) {
      const r = newLoanRate();
      if (!r) return null;
      const now = today ? Number(String(today).slice(0, 4)) : null;
      return { value: r.rate, sigma: null, measured: false, why: now === r.year ? "the average new 30-year rate so far this year" : `the average new 30-year rate in ${r.year}`, uses: {}, sharperWith: [], tables: [PMMS] };
    },
  },
  "goals/house:taxRate": {
    tier: 4, order: 22, label: "Property tax a year, as a share of the value", unit: "rate", weight: "big", page: HOUSE_PAGE, reads: [],
    // kept to a hundredth of a point (1.32%), as insurance: R11's tenth was up to 13% off in low-tax states (Hawaii's 0.265%
    // read 0.3%; critic e9 F5)
    fn(plan) {
      const st = stateOf(plan), v = taxShare(st);
      if (v === null) return null;
      const r = Math.round(v * 10000) / 10000;
      return { value: r, rounded: true, sigma: null, measured: false, why: `${where(st)} homes pay about ${Number((r * 100).toFixed(2))}% of their value a year`, uses: { state: st ? "typed" : null }, sharperWith: st ? [] : [YOUR_STATE], tables: [PTAX] };
    },
  },
  "goals/house:insuranceRate": {
    // a share of value under 1% is kept to a hundredth of a point (0.46%), not R11's tenth: a tenth would move it by a fifth
    tier: 4, order: 23, label: "Home insurance a year, as a share of the price", unit: "rate", weight: "big", page: HOUSE_PAGE, reads: [],
    fn(plan, { args } = {}) {
      const st = stateOf(plan), price = typeof args?.price === "number" && args.price > 0 ? args.price : null;
      const v = insuranceShare(st, price);
      if (v === null) return null;
      return { value: Math.round(v * 10000) / 10000, rounded: true, sigma: null, measured: false,
        why: fit(`typical home insurance in ${where(st)}, as a share of the price`, `typical home insurance in ${where(st)}`),
        uses: { state: st ? "typed" : null, price: price ? "worked out" : null }, sharperWith: st ? [] : [YOUR_STATE], tables: [HO3, VALUE_MS] };
    },
  },
};
