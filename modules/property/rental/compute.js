// modules/property/rental/compute.js -- PURE. Each rental property, the way a lender or an investor reads it:
// rent less a vacancy allowance, less the running costs, is the net operating income; against the value that
// is the cap rate; less the loan payments it is the cash flow, and against the cash put in the cash-on-cash
// return; the debt-service coverage a lender wants; the occupancy that breaks even. Then tax: depreciation over
// 27.5 years, the year's taxable result, the losses netted across rentals and the $25,000 allowance (what is used this
// year and what waits), and what the rentals add to this year's federal tax, worked through the federal estimate.
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { federalTax, marginalRate } from "../../../core/math/tax.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { yearOfPayments } from "../../../core/math/finance.js";
import { withoutIncomeRent, known, knownWithout } from "../../taxes/federal/known.js";

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
 * rentalsFor(plan, { today, year }) -> each rental on the property list worked by `analyse` for tax year `year`: its rent less
 * the empty months, its costs, the year's loan interest and depreciation, its taxable result (`taxable`). The loan and the
 * value as compute() takes them. The Federal estimate's figures (taxes/federal known.js) net these with passiveLosses
 * against the allowance at their own modified AGI. [] without a rental.
 */
export function rentalsFor(plan, { today = null, year } = {}) {
  const list = (plan.property ?? []).filter((x) => x.kind === "rental");
  if (!list.length) return [];
  const li = computeLiabilities(plan, { today });
  const accounts = plan.accounts ?? [];
  return list.map((r) => {
    const acct = r.accountId ? accounts.find((a) => a.id === r.accountId) : null;
    const row = r.loanAccountId ? li.rows.find((x) => x.id === r.loanAccountId) : null;
    const loan = row ? { name: row.name, balance: row.owed, rate: row.rate ?? 0, payment: row.payment || 0 }
      : Number(r.loanBalance) > 0 ? { name: "Loan", balance: Number(r.loanBalance), rate: Number(r.loanRate) || 0, payment: Number(r.loanPayment) || 0 } : null;
    return analyse({ ...r, value: acct ? countedBalance(acct) : r.value }, loan, { marginal: 0, state: 0, allowance: 0, year });
  });
}

/**
 * compute(plan, { today }) -> { ready, year, rentals: [analyse(...)], totals: { rent, noi, cashFlow, afterTax, equity, value }, rates (with magi,
 *   niitLine, onReturn), rule ({ max, from, to }: the allowance's figures for the filing status), lossRoom,
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
  // the allowance, its modified AGI and the netting are the Federal estimate's own (taxes/federal known.js rentalStep), so
  // the two pages say the same (round 8 review: Rental analysis worked MAGI on the business at its gross, 170,000, while the
  // Federal estimate had 140,000): modified AGI is AGI without the taxable Social Security, the IRA deduction, the deductible
  // half of self-employment tax, the student loan interest and the passive losses (469(i)(3)(E); Form 8582 instructions
  // (2025) line 6), worked after the plan's withdrawals, stock pay and business at its profit, the Income page's rent for
  // these rentals taken out (it is counted once, after costs: round 8, landlord-1). Filing separately, on the return the
  // estimate puts added income on (the adult marked Me), each return its own Form 8582 (469(i)(5)(A)).
  let k = null;
  try { k = known(plan, { today }, fed); } catch { k = null; }
  const kr = k?.rental ?? null;
  const noRent = kr ? { inputs: kr.before, removed: kr.removed } : withoutIncomeRent(plan, fed, { today });
  const baseResult = noRent.inputs === fed.inputs ? fed.result : federalTax(noRent.inputs, fed.params);
  const parts = baseResult.separate ?? null;
  const on = parts ? parts.find((x) => x.personId === noRent.inputs.separateTo) ?? parts[0] : null;
  const ret = on ?? baseResult;
  const iraOn = on ? (fed.ira?.people ?? []).find((x) => x.id === on.personId)?.deductible || 0 : fed.ira?.deductible || 0;
  const magi = kr ? kr.magi : Math.max(0, ret.agi - (ret.income?.taxableSocialSecurity || 0) + iraOn);
  const separate = fed.filingStatus === "married_separate", separateTogether = separate && fed.livedApart !== true;
  const status = fed.filingStatus;
  // the next dollar's cost before the rentals, on the same figures (the keys' return when no step moved it)
  const marginal = noRent.inputs === fed.inputs ? fed.marginal : marginalRate(noRent.inputs, fed.params);
  const rates = { marginal: marginal ?? 0.22, state: st.effective ?? 0, magi, separate, year: fed.year, niitLine: fed.params?.niitThreshold?.[status] ?? 200000, onReturn: on?.name ?? null };
  // the allowance's figures as they apply (for the page's sentences): $25,000 from $100,000 to $150,000, or half of each filing separately
  const rule = separate ? { max: ALLOWANCE.max / 2, from: ALLOWANCE.from / 2, to: ALLOWANCE.to / 2 } : { ...ALLOWANCE };
  const li = computeLiabilities(plan, { today });
  const accounts = plan.accounts ?? [];
  // filing separately while living together at any time in the year: no allowance at all (469(i)(5)(B))
  const room = kr ? kr.allowance : separateTogether ? 0 : lossAllowance(magi, { separate });
  const rentals = list.map((r) => {
    const acct = r.accountId ? accounts.find((a) => a.id === r.accountId) : null;
    const row = r.loanAccountId ? li.rows.find((x) => x.id === r.loanAccountId) : null;
    const loan = row ? { name: row.name, balance: row.owed, rate: row.rate ?? 0, payment: row.payment || 0 }
      : Number(r.loanBalance) > 0 ? { name: "Loan", balance: Number(r.loanBalance), rate: Number(r.loanRate) || 0, payment: Number(r.loanPayment) || 0 } : null;
    return analyse({ ...r, value: acct ? countedBalance(acct) : r.value }, loan, { ...rates, allowance: room });
  });
  // the losses netted across the rentals, then the allowance, spread pro rata
  const passive = kr ? kr.passive : passiveLosses(rentals.map((x) => x.taxable), room);
  // what the rentals add to this year's federal tax: the estimate with their allowed net result added (a profit as
  // ordinary income and as investment income for the 3.8% tax, IRC 1411(c)(1)(A)(i); a loss off income) less without,
  // so it crosses brackets and the standard deduction; the state's share at its effective rate on top
  // the Federal estimate's year's tax with the rentals less the same without their result (knownWithout: the later steps,
  // the IRA and student loan limits, move with it), so "what the rentals add" is the difference on that page
  const base = baseResult.totalTax, inp = noRent.inputs;
  let federal, niit;
  if (kr) {
    const w = knownWithout(plan, { today }, fed, "rental");
    federal = k.total - w.total; niit = (k.result.niit || 0) - (w.result.niit || 0);
  } else {
    const withNet = passive.net >= 0
      ? federalTax({ ...inp, otherOrdinary: (Number(inp.otherOrdinary) || 0) + passive.net, investmentIncome: (Number(inp.investmentIncome) || 0) + passive.net }, fed.params)
      : federalTax({ ...inp, adjustments: (Number(inp.adjustments) || 0) - passive.net }, fed.params);
    federal = withNet.totalTax - base; niit = (withNet.niit || 0) - (baseResult.niit || 0);
  }
  const state = passive.net * rates.state;
  // each rental's line: the profits' side is the tax with the profits alone added (shared by the size of each profit); the
  // losses' side is the rest of the household's change (shared by each rental's allowed loss). The two add up to the change
  // and stay steady when the profits and losses nearly cancel (dividing the change by a net result near 0 would not)
  const P = passive.profits, A = passive.allowed;
  const profitsAlone = P > 0.005 && A > 0.005 ? federalTax({ ...inp, otherOrdinary: (Number(inp.otherOrdinary) || 0) + P, investmentIncome: (Number(inp.investmentIncome) || 0) + P }, fed.params).totalTax - base : null;
  const profitSide = A > 0.005 ? profitsAlone ?? 0 : federal, lossSide = federal - profitSide;
  rentals.forEach((a, i) => {
    a.lossUsable = passive.shares[i].allowed; a.lossCarried = passive.shares[i].suspended;
    a.tax = a.taxable >= 0 ? (P > 0.005 ? (profitSide + P * rates.state) * a.taxable / P : 0)
      : (A > 0.005 ? (lossSide - A * rates.state) * passive.shares[i].allowed / A : 0);
    a.afterTax = a.cashFlow - a.tax;
  });
  const sum = (k) => rentals.reduce((s, x) => s + (x[k] ?? 0), 0);
  return { ready: true, year: rates.year, ...(noRent.removed > 0 ? { incomeRent: noRent.removed } : {}), rentals, totals: { rent: sum("rent"), noi: sum("noi"), cashFlow: sum("cashFlow"), afterTax: sum("afterTax"), equity: sum("equity"), value: sum("value") }, rates, rule, lossRoom: room, passive, separateTogether, tax: { federal, niit, state, total: federal + state } };
}
