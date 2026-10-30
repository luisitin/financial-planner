// modules/property/rent-vs-buy/compute.js -- PURE. Renting against buying the same home, as two households
// that start with the same money: the buyer puts down the deposit and the closing costs and pays the mortgage,
// tax, insurance, upkeep and any HOA; the renter invests that money instead and pays rent. Each year whoever
// pays less invests the difference. After each year: what each would have if the buyer sold (less the selling
// costs and what is still owed). The year buying pulls ahead, and the rent at which the two come out even.
import { pmt } from "../../../core/math/finance.js";
import { planReturn, TAX_DRAG } from "../../insurance/term-vs-permanent/compute.js";

export const DEFAULTS = {
  price: 400000, downShare: 0.2, rate: 0.065, termYears: 30, taxRate: 0.011, insuranceRate: 0.0035, maintenanceRate: 0.01, hoaMonthly: 0,
  buyCosts: 0.03, sellCosts: 0.06, appreciation: 0.03, rentMonthly: 2200, rentGrowth: 0.03, rentersInsurance: 180, years: 10, itemize: false, marginalRate: 0.22,
};

/** The inputs with defaults; the return on invested money is the plan's own mix less the tax drag unless set. */
export function inputsOf(plan) {
  const s = plan.whatIfs?.rentVsBuy ?? {};
  const out = {};
  for (const [k, v] of Object.entries(DEFAULTS)) { const x = s[k]; out[k] = typeof v === "boolean" ? (x === undefined || x === null ? v : !!x) : (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? v : Number(x)); }
  out.investReturn = s.investReturn !== null && s.investReturn !== undefined && s.investReturn !== "" && Number.isFinite(Number(s.investReturn)) ? Number(s.investReturn) : planReturn(plan) - TAX_DRAG;
  out.years = Math.max(1, Math.min(40, Math.round(out.years)));
  return out;
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
 *   rentEven (the starting rent at which the two are even after the chosen years)
 * }
 */
export function compute(plan) {
  const x = inputsOf(plan);
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
  };
}
