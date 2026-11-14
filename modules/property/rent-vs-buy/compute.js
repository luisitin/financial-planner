// modules/property/rent-vs-buy/compute.js -- PURE. Renting against buying the same home, as two households
// that start with the same money: the buyer puts down the deposit and the closing costs and pays the mortgage,
// tax, insurance, upkeep and any HOA; the renter invests that money instead and pays rent. Each year whoever
// pays less invests the difference. After each year: what each would have if the buyer sold (less the selling
// costs and what is still owed). The year buying pulls ahead, and the rent at which the two come out even.
import { pmt } from "../../../core/math/finance.js";
import { planReturn, TAX_DRAG } from "../../insurance/term-vs-permanent/compute.js";
import { perMonth, activeOn } from "../../../core/math/periods.js";
import { isGuess } from "../../../core/estimate/index.js";
// the sourced tables behind the rent guess (data only) and the guesses module's profile, so a gray figure here is worked out
// as the same figure is elsewhere (README "Our guesses in the boxes"); the price, rate, tax and insurance are House down
// payment's estimators (goals/house:price, :rate, :taxRate, :insuranceRate)
import { T as SPEND, DERIVED as D_SPEND } from "../../overview/guesses/data/spend.js";
import { STATE_NAME, NEWEST_READ } from "../../overview/guesses/data/index.js";
import { stateOf, profileOf, YOUR_STATE } from "../../overview/guesses/estimators/common.js";

export const DEFAULTS = {
  price: 400000, downShare: 0.2, rate: 0.065, termYears: 30, taxRate: 0.011, insuranceRate: 0.0035, maintenanceRate: 0.01, hoaMonthly: 0,
  buyCosts: 0.03, sellCosts: 0.06, appreciation: 0.03, rentMonthly: 2200, rentGrowth: 0.03, rentersInsurance: 180, years: 10, itemize: false, marginalRate: 0.22,
};

/**
 * The boxes that can show our guess in gray while they are empty (smart guesses C9, spec 12.1 "K3 previews"): counted in this
 * page's answer only while the box stays empty, never saved. The page asks for them (ctx.guess) and passes the values in
 * `params.previews`; without them the page works exactly as before (DEFAULTS).
 */
export const PREVIEWED = ["price", "rentMonthly", "rate", "taxRate", "insuranceRate"];
/** The estimator behind each previewed box. */
export const PREVIEW_KEYS = { price: "goals/house:price", rentMonthly: "property/rent-vs-buy:rent", rate: "goals/house:rate", taxRate: "goals/house:taxRate", insuranceRate: "goals/house:insuranceRate" };

/**
 * The inputs with defaults; the return on invested money is the plan's own mix less the tax drag unless set. previews: our
 * guesses (numbers) for PREVIEWED boxes left empty (a saved figure always wins).
 */
export function inputsOf(plan, previews = null) { return readInputs(plan, previews).x; }
/** inputsOf, with the PREVIEWED keys whose gray figure was counted. */
function readInputs(plan, previews) {
  const s = plan.whatIfs?.rentVsBuy ?? {};
  const pv = previews && typeof previews === "object" ? previews : null;
  const out = {}, previewed = [];
  for (const [k, v] of Object.entries(DEFAULTS)) {
    const x = s[k];
    if (typeof v === "boolean") { out[k] = x === undefined || x === null ? v : !!x; continue; }
    if (!(x === null || x === undefined || x === "" || !Number.isFinite(Number(x)))) { out[k] = Number(x); continue; }
    if (pv && PREVIEWED.includes(k) && typeof pv[k] === "number" && Number.isFinite(pv[k])) { out[k] = pv[k]; previewed.push(k); continue; }
    out[k] = v;
  }
  out.investReturn = s.investReturn !== null && s.investReturn !== undefined && s.investReturn !== "" && Number.isFinite(Number(s.investReturn)) ? Number(s.investReturn) : planReturn(plan) - TAX_DRAG;
  out.years = Math.max(1, Math.min(40, Math.round(out.years)));
  return { x: out, previewed: previewed.sort((a, b) => PREVIEWED.indexOf(a) - PREVIEWED.indexOf(b)) };
}

/** Year by year for `years`: the buyer's and the renter's yearly costs and what each would have (the buyer after selling). */
export function simulate(x, years = x.years) {
  const loan = x.price * (1 - x.downShare);
  const monthlyPI = loan > 0 ? pmt(x.rate / 12, x.termYears * 12, loan) : 0;
  let balance = loan, value = x.price, rent = x.rentMonthly * 12, renterPot = x.price * x.downShare + x.price * x.buyCosts, buyerPot = 0;
  const rows = [];
  for (let y = 1; y <= years; y++) {
    // the mortgage month by month: interest and principal
    let interest = 0, principal = 0;
    for (let m = 0; m < 12 && balance > 0.005; m++) { const i = balance * x.rate / 12; const p = Math.min(balance, monthlyPI - i); interest += i; principal += p; balance -= p; }
    const propertyTax = value * x.taxRate, insurance = value * x.insuranceRate, upkeep = value * x.maintenanceRate, hoa = x.hoaMonthly * 12 * Math.pow(1 + x.rentGrowth, y - 1);
    const taxSaving = x.itemize ? (interest + Math.min(propertyTax, 40000)) * x.marginalRate : 0;
    const buyCost = interest + principal + propertyTax + insurance + upkeep + hoa - taxSaving;
    const rentCost = rent + x.rentersInsurance * Math.pow(1 + x.rentGrowth, y - 1);
    // whoever paid less this year invests the difference; both pots grow
    renterPot = renterPot * (1 + x.investReturn) + Math.max(0, buyCost - rentCost);
    buyerPot = buyerPot * (1 + x.investReturn) + Math.max(0, rentCost - buyCost);
    value *= 1 + x.appreciation;
    const buyerWealth = value * (1 - x.sellCosts) - balance + buyerPot;
    rows.push({ year: y, buyCost, rentCost, interest, principal, propertyTax, insurance, upkeep, hoa, taxSaving, value, balance, equity: value - balance, buyerWealth, renterWealth: renterPot, ahead: buyerWealth - renterPot });
    rent *= 1 + x.rentGrowth;
  }
  return { rows, monthlyPI, loan };
}

/**
 * compute(plan) -> {
 *   inputs, monthlyPI, loan, upfront (deposit + closing), firstYear: { buyMonthly, rentMonthly }, rows,
 *   atEnd: { year, buyerWealth, renterWealth, ahead, winner: "buy"|"rent" }, breakevenYear (first year buying is ahead; null within 40 years),
 *   rentEven (the starting rent at which the two are even after the chosen years),
 *   previewed (the PREVIEWED keys whose gray figure is counted; only with params.previews)
 * }
 * params.previews: { price?, rentMonthly?, rate?, taxRate?, insuranceRate? } our guesses (numbers) for boxes left empty
 */
export function compute(plan, params = {}) {
  const pv = params?.previews && typeof params.previews === "object" ? params.previews : null;
  const { x, previewed } = readInputs(plan, pv);
  const s = simulate(x);
  const last = s.rows[s.rows.length - 1];
  const long = simulate(x, 40);
  const be = long.rows.find((r) => r.ahead >= 0);
  // the starting rent that makes the two even at the end of the chosen years: more rent favours buying
  const at = (rent) => simulate({ ...x, rentMonthly: rent }).rows.at(-1).ahead;
  let lo = 0, hi = Math.max(1000, x.rentMonthly * 4);
  for (let k = 0; k < 20 && at(hi) < 0; k++) hi *= 2;
  let rentEven = null;
  if (at(lo) <= 0 && at(hi) >= 0) { for (let k = 0; k < 60 && hi - lo > 0.5; k++) { const mid = (lo + hi) / 2; if (at(mid) >= 0) hi = mid; else lo = mid; } rentEven = hi; }
  return {
    inputs: x, monthlyPI: s.monthlyPI, loan: s.loan, upfront: x.price * (x.downShare + x.buyCosts),
    firstYear: { buyMonthly: s.rows[0].buyCost / 12, rentMonthly: s.rows[0].rentCost / 12 }, rows: s.rows,
    atEnd: { year: last.year, buyerWealth: last.buyerWealth, renterWealth: last.renterWealth, ahead: last.ahead, winner: last.ahead >= 0 ? "buy" : "rent" },
    breakevenYear: be ? be.year : null, rentEven,
    // the boxes whose gray figure the answer counts (only when the page passed its previews: without them, nothing new)
    ...(pv ? { previewed } : {}),
  };
}

// ---------------------------------------------------------------- the rent guess (smart guesses C9, spec 12.1 K3)
const RENT = "acs2025_median_gross_rent_by_state";
const cellOf = (t, row, c) => { const i = Array.isArray(t?.cols) ? t.cols.indexOf(c) : -1; const v = i >= 0 ? t.rows?.[row]?.[i] : null; return typeof v === "number" && Number.isFinite(v) ? v : null; };
/** A typical rent before utilities in the state (the U.S. with no state): the ACS 2025 median gross rent x the contract share (0.897, CE 2025). */
export function typicalRent(st) {
  const gross = cellOf(SPEND[RENT], "grossRent", st ?? "US") ?? cellOf(SPEND[RENT], "grossRent", "US");
  const share = D_SPEND?.contractShare?.value;
  return gross === null || !(share > 0) ? null : gross * share;
}
/** A housing row that is a mortgage's payment by its name (as cashflow/expenses reads one: "mortgage", "mtg"). */
const MORTGAGE_ROW = /mortgage|\bmtg\b/i;
/**
 * The rent a household that rents has on Expenses (every housing row running today, a month), or null: an owner, or no such row.
 * A household with no home or mortgage on file but a housing row named for a mortgage ("Mortgage payment") owns: no rent on
 * file (critic e9 F3: its $2,400 mortgage was taken for the rent of a home like the one it would buy).
 * -> { monthly, guessed: every row is our guess }
 */
export function rentOnFile(plan, today) {
  if (profileOf(plan, today).tenure !== "renter") return null;
  const rows = (Array.isArray(plan.expenses) ? plan.expenses : []).filter((x) => x?.category === "housing" && Number(x.amount) > 0 && (!today || activeOn(x, today)));
  if (rows.some((x) => MORTGAGE_ROW.test(String(x.name ?? "")))) return null;
  const monthly = rows.reduce((t, x) => t + perMonth(Number(x.amount), x.period ?? "monthly"), 0);
  if (!(monthly > 0)) return null;
  return { monthly: Math.round(monthly * 100) / 100, guessed: rows.every((x) => typeof x.id === "string" && isGuess(plan, `expenses[${x.id}].amount`)) };
}

export const estimators = {
  "property/rent-vs-buy:rent": {
    tier: 4, order: 24, label: "Rent for a home like the one you would buy, a month", unit: "month", weight: "big", page: () => "#/property/rent-vs-buy", reads: [],
    fn(plan, { today }) {
      // someone who rents and has the rent on Expenses: that figure, to the cent (what they pay now, or our guess there)
      const own = rentOnFile(plan, today);
      if (own) return { value: own.monthly, rounded: true, sigma: null, measured: false, basis: "yours", dataAsOf: today ?? NEWEST_READ,
        why: own.guessed ? "our guess of your rent, as on your Expenses page" : "what you pay now, as on your Expenses page", uses: { rent: own.guessed ? "guess" : "typed" }, sharperWith: [], tables: [] };
      const st = stateOf(plan), v = typicalRent(st);
      if (v === null) return null;
      return { value: v, sigma: null, measured: false, why: `typical rent before utilities in ${st ? STATE_NAME[st] : "the U.S."}`, uses: { state: st ? "typed" : null },
        sharperWith: st ? [] : [YOUR_STATE], tables: [RENT, "ce2025_spend_by_housingTenure"] };
    },
  },
};
