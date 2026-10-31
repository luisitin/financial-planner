// modules/property/rental/compute.js -- PURE. Each rental property, the way a lender or an investor reads it:
// rent less a vacancy allowance, less the running costs, is the net operating income; against the value that
// is the cap rate; less the loan payments it is the cash flow, and against the cash put in the cash-on-cash
// return; the debt-service coverage a lender wants; the occupancy that breaks even. Then tax: depreciation over
// 27.5 years, the year's taxable result, the losses netted across rentals and the $25,000 allowance (what is used this
// year and what waits), and what the rentals add to this year's federal tax, worked through the federal estimate.
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";

/** Defaults for what is not typed: vacancy 5% of rent, maintenance 1% of the value a year, land 20% of the price (not depreciated), appreciation 3.5%. */
export const DEFAULTS = { vacancy: 0.05, maintenance: 0.01, management: 0, landShare: 0.2, appreciation: 0.035 };
/** Residential rental buildings are depreciated straight-line over 27.5 years, mid-month in the first year (IRS Publication 527). */
export const RECOVERY_YEARS = 27.5;
/** The special allowance for rental losses with active participation: $25,000, less half of modified AGI above $100,000, gone at $150,000 (IRC 469(i)(2), (3)(A)); $12,500 and $50,000 married filing separately and living apart all year, none filing separately otherwise (469(i)(5)). */
export const ALLOWANCE = { max: 25000, from: 100000, to: 150000 };
/** Lenders' usual minimum debt-service coverage for a rental loan. */
export const DSCR_MIN = 1.25;

/** Depreciation for a tax year: basis / 27.5, the first year by the mid-month rule, nothing past the end. */
export function depreciation(basis, placedInService, year) {
  if (!(basis > 0) || !placedInService) return 0;
  const y0 = Number(placedInService.slice(0, 4)), m0 = Number(placedInService.slice(5, 7));
  const full = basis / RECOVERY_YEARS;
  if (year < y0) return 0;
  const firstYear = full * (12 - m0 + 0.5) / 12;
  if (year === y0) return firstYear;
  const before = firstYear + full * (year - y0 - 1);
  return Math.max(0, Math.min(full, basis - before));
}

/** The loss allowance at a modified adjusted gross income. */
export function lossAllowance(magi, { separate = false } = {}) {
  const k = separate ? 0.5 : 1;
  return Math.max(0, ALLOWANCE.max * k - Math.max(0, magi - ALLOWANCE.from * k) / 2);
}

/** One property, a year: every line from rent to after-tax cash. `rates` = { marginal, state, allowance (the loss allowance still unused), year }. */
export function analyse(r, loan, rates) {
  const n = (v, d = 0) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
  const value = n(r.value), price = n(r.purchasePrice, value);
  const rent = n(r.rentMonthly) * 12;
  const vacancy = rent * n(r.vacancy, DEFAULTS.vacancy);
  const income = rent - vacancy;
  const costs = [
    { key: "tax", label: "Property tax", amount: n(r.propertyTax) },
    { key: "insurance", label: "Insurance", amount: n(r.insurance) },
    { key: "hoa", label: "Association dues", amount: n(r.hoaMonthly) * 12 },
    { key: "maintenance", label: "Repairs and upkeep", amount: value * n(r.maintenance, DEFAULTS.maintenance) },
    { key: "management", label: "Property manager", amount: income * n(r.management, DEFAULTS.management) },
    { key: "utilities", label: "Utilities you pay", amount: n(r.utilitiesMonthly) * 12 },
    { key: "other", label: "Other costs", amount: n(r.otherMonthly) * 12 },
  ].filter((c) => c.amount > 0);
  const opex = costs.reduce((s, c) => s + c.amount, 0);
  const noi = income - opex;
  const pay = loan ? yearOfPayments(loan.balance, loan.rate, loan.payment) : { paid: 0, interest: 0, principal: 0 };
  const debtService = pay.paid;
  const cashFlow = noi - debtService;
  const cashIn = n(r.cashIn, null);
  const basis = price * (1 - n(r.landShare, DEFAULTS.landShare)) + n(r.improvements);
  const dep = depreciation(basis, r.purchaseDate, rates.year);
  const taxable = income - opex - pay.interest - dep;
  // on its own (compute() replaces these with the household's netting, pro-rata shares and the federal engine's tax):
  // a loss usable up to the allowance, the rest waits; the tax at one rate
  const usable = taxable < 0 ? Math.min(-taxable, Math.max(0, rates.allowance ?? 0)) : 0;
  const rate = (rates.marginal ?? 0) + (rates.state ?? 0);
  const tax = taxable >= 0 ? taxable * rate : -usable * rate;
  const equity = value - (loan?.balance ?? 0);
  const growth = value * n(r.appreciation, DEFAULTS.appreciation);
  return {
    id: r.id, name: r.name || "Rental", value, price, rent, vacancy, income, costs, opex, noi,
    capRate: value > 0 ? noi / value : null, debtService, interest: pay.interest, principal: pay.principal, cashFlow,
    cashIn, cashOnCash: cashIn > 0 ? cashFlow / cashIn : null,
    dscr: debtService > 0 ? noi / debtService : null, breakEven: rent > 0 ? (opex + debtService) / rent : null,
    onePercent: price > 0 ? n(r.rentMonthly) / price : null,
    basis, depreciation: dep, taxable, lossUsable: usable, lossCarried: taxable < 0 ? -taxable - usable : 0, tax, afterTax: cashFlow - tax,
    loan: loan ? { name: loan.name, balance: loan.balance, rate: loan.rate, payment: loan.payment } : null,
    equity, growth, totalReturn: cashFlow + pay.principal + growth, returnOnEquity: equity > 0 ? (cashFlow + pay.principal + growth) / equity : null,
  };
}

/**
 * The passive-loss rules for one year's rentals (IRC 469; Form 8582), each rental its own activity with active participation
 * and nothing carried in. `taxables`: each rental's taxable result; `allowance`: the special allowance at the income.
 * Rentals with a profit absorb the others' losses first (469(d)(1): the passive activity loss is the losses less the
 * passive income); the allowance takes at most the net loss off other income (469(i)(1)); what is allowed and what waits
 * are spread over the losing rentals by the size of each loss (469(j)(4); 1.469-1T(f)(2); Form 8582 Parts VI-VII).
 * -> { profits, losses, netLoss, againstOther, allowed, suspended, net (the allowed net result), shares: [{ allowed, suspended }] }
 */
export function passiveLosses(taxables, allowance) {
  const profits = taxables.reduce((s, t) => s + Math.max(0, t), 0), losses = taxables.reduce((s, t) => s + Math.max(0, -t), 0);
  const netLoss = Math.max(0, losses - profits);
  const againstOther = Math.min(netLoss, Math.max(0, allowance));
  const allowed = losses - (netLoss - againstOther), suspended = losses - allowed;
  const shares = taxables.map((t) => t < 0 && losses > 0 ? { allowed: allowed * -t / losses, suspended: suspended * -t / losses } : { allowed: 0, suspended: 0 });
  return { profits, losses, netLoss, againstOther, allowed, suspended, net: profits - allowed, shares };
}

/**
 * compute(plan, { today }) -> { ready, year, rentals: [analyse(...)], totals: { rent, noi, cashFlow, afterTax, equity, value }, rates, lossRoom,
 *   passive (passiveLosses), separateTogether, tax: { federal, niit, state, total } (what the rentals add to this year's tax) }
 * A rental's loan: the mortgage account it names (`loanAccountId`, with its rate and payment from Debts), else the typed
 * `loanBalance`, `loanRate`, `loanPayment`. Its value: the property account it names (`accountId`), else `value`.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const list = (plan.property ?? []).filter((x) => x.kind === "rental");
  if (!list.length) return { ready: false, rentals: [] };
  const fed = computeFederal(plan, { today });
  const st = computeState(plan, { today });
  // modified AGI for the allowance: AGI without the taxable Social Security and the IRA deduction (469(i)(3)(E): "without
  // regard to (i) any amount includible in gross income under section 86, ... (iii) the amounts allowable as a deduction
  // under sections 219, 221, and 250, and (iv) any passive activity loss"), never below 0 (Form 8582 line 6)
  const magi = Math.max(0, fed.result.agi - (fed.result.income?.taxableSocialSecurity || 0) + (fed.ira?.deductible || 0));
  const separate = fed.filingStatus === "married_separate", separateTogether = separate && fed.livedApart !== true;
  const rates = { marginal: fed.marginal ?? 0.22, state: st.effective ?? 0, magi, separate, year: fed.year };
  const li = computeLiabilities(plan, { today });
  const accounts = plan.accounts ?? [];
  // filing separately while living together at any time in the year: no allowance at all (469(i)(5)(B))
  const room = separateTogether ? 0 : lossAllowance(magi, { separate });
  const rentals = list.map((r) => {
    const acct = r.accountId ? accounts.find((a) => a.id === r.accountId) : null;
    const row = r.loanAccountId ? li.rows.find((x) => x.id === r.loanAccountId) : null;
    const loan = row ? { name: row.name, balance: row.owed, rate: row.rate ?? 0, payment: row.payment || 0 }
      : Number(r.loanBalance) > 0 ? { name: "Loan", balance: Number(r.loanBalance), rate: Number(r.loanRate) || 0, payment: Number(r.loanPayment) || 0 } : null;
    return analyse({ ...r, value: acct ? countedBalance(acct) : r.value }, loan, { ...rates, allowance: room });
  });
  // the losses netted across the rentals, then the allowance, spread pro rata
  const passive = passiveLosses(rentals.map((x) => x.taxable), room);
  // what the rentals add to this year's federal tax: the estimate with their allowed net result added (a profit as
  // ordinary income and as investment income for the 3.8% tax, IRC 1411(c)(1)(A)(i); a loss off income) less without,
  // so it crosses brackets and the standard deduction; the state's share at its effective rate on top
  const base = fed.result.totalTax, inp = fed.inputs;
  const withNet = passive.net >= 0
    ? federalTax({ ...inp, otherOrdinary: (Number(inp.otherOrdinary) || 0) + passive.net, investmentIncome: (Number(inp.investmentIncome) || 0) + passive.net }, fed.params)
    : federalTax({ ...inp, adjustments: (Number(inp.adjustments) || 0) - passive.net }, fed.params);
  const federal = withNet.totalTax - base, niit = (withNet.niit || 0) - (fed.result.niit || 0), state = passive.net * rates.state;
  // each rental's line: its part of the allowed net result (a profit, or its allowed loss) times the household's change
  rentals.forEach((a, i) => {
    const part = a.taxable >= 0 ? a.taxable : -passive.shares[i].allowed;
    a.lossUsable = passive.shares[i].allowed; a.lossCarried = passive.shares[i].suspended;
    a.tax = Math.abs(passive.net) > 0.005 ? (federal + state) * part / passive.net : 0;
    a.afterTax = a.cashFlow - a.tax;
  });
  const sum = (k) => rentals.reduce((s, x) => s + (x[k] ?? 0), 0);
  return { ready: true, year: rates.year, rentals, totals: { rent: sum("rent"), noi: sum("noi"), cashFlow: sum("cashFlow"), afterTax: sum("afterTax"), equity: sum("equity"), value: sum("value") }, rates, lossRoom: room, passive, separateTogether, tax: { federal, niit, state, total: federal + state } };
}
