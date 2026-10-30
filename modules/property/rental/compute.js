// modules/property/rental/compute.js -- PURE. Each rental property, the way a lender or an investor reads it:
// rent less a vacancy allowance, less the running costs, is the net operating income; against the value that
// is the cap rate; less the loan payments it is the cash flow, and against the cash put in the cash-on-cash
// return; the debt-service coverage a lender wants; the occupancy that breaks even. Then tax: depreciation over
// 27.5 years, the year's taxable result, and whether a loss can be used now (the $25,000 allowance) or waits.
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";

/** Defaults for what is not typed: vacancy 5% of rent, maintenance 1% of the value a year, land 20% of the price (not depreciated), appreciation 3.5%. */
export const DEFAULTS = { vacancy: 0.05, maintenance: 0.01, management: 0, landShare: 0.2, appreciation: 0.035 };
/** Residential rental buildings are depreciated straight-line over 27.5 years, mid-month in the first year (IRS Publication 527). */
export const RECOVERY_YEARS = 27.5;
/** The special allowance for rental losses with active participation: $25,000, less half of modified AGI above $100,000, gone at $150,000 (IRC §469(i)); $12,500 and $50,000 married filing separately (living apart). */
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
  // a loss: usable now up to the allowance (active participation), the rest carried forward
  const usable = taxable < 0 ? Math.min(-taxable, Math.max(0, rates.allowance ?? 0)) : 0;
  const rate = rates.marginal + rates.state;
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
 * compute(plan, { today }) -> { ready, year, rentals: [analyse(...)], totals: { rent, noi, cashFlow, afterTax, equity, value }, rates, lossRoom }
 * A rental's loan: the mortgage account it names (`loanAccountId`, with its rate and payment from Debts), else the typed
 * `loanBalance`, `loanRate`, `loanPayment`. Its value: the property account it names (`accountId`), else `value`.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const list = (plan.property ?? []).filter((x) => x.kind === "rental");
  if (!list.length) return { ready: false, rentals: [] };
  const fed = computeFederal(plan, { today });
  const st = computeState(plan, { today });
  const rates = { marginal: fed.marginal ?? 0.22, state: st.effective ?? 0, magi: Math.max(0, fed.result.agi), separate: fed.filingStatus === "married_separate", year: fed.year };
  const li = computeLiabilities(plan, { today });
  const accounts = plan.accounts ?? [];
  let room = lossAllowance(rates.magi, { separate: rates.separate });
  const rentals = list.map((r) => {
    const acct = r.accountId ? accounts.find((a) => a.id === r.accountId) : null;
    const row = r.loanAccountId ? li.rows.find((x) => x.id === r.loanAccountId) : null;
    const loan = row ? { name: row.name, balance: row.owed, rate: row.rate ?? 0, payment: row.payment || 0 }
      : Number(r.loanBalance) > 0 ? { name: "Loan", balance: Number(r.loanBalance), rate: Number(r.loanRate) || 0, payment: Number(r.loanPayment) || 0 } : null;
    // the allowance is shared by every rental: each uses what the ones before it left
    const a = analyse({ ...r, value: acct ? countedBalance(acct) : r.value }, loan, { ...rates, allowance: room });
    room -= a.lossUsable;
    return a;
  });
  const sum = (k) => rentals.reduce((s, x) => s + (x[k] ?? 0), 0);
  return { ready: true, year: rates.year, rentals, totals: { rent: sum("rent"), noi: sum("noi"), cashFlow: sum("cashFlow"), afterTax: sum("afterTax"), equity: sum("equity"), value: sum("value") }, rates, lossRoom: lossAllowance(rates.magi, { separate: rates.separate }) };
}
