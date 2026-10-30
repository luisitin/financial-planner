// core/math/tax.js -- US federal income tax. PURE and parameter-driven: every function takes the
// year's `params` (one entry of FEDERAL in modules/taxes/federal/data/federal.js, or an indexed
// copy from paramsFor) so the same code serves this year's estimate, the bracket explorer and
// the year-by-year retirement projection.
//
// What is modelled: ordinary brackets, standard deduction with the age/blindness allowance or
// itemized deductions (from 2026 with the limit in the 37% bracket and the charity deduction for
// people who do not itemize), the 2025-2028 senior deduction, long-term gains and qualified
// dividends stacked on ordinary income at 0/15/20% (the worksheet's last step included), a net
// capital loss of up to 3,000 against any income, the taxation of Social Security benefits (the IRS
// worksheet), the net investment income tax, the additional Medicare tax on wages, the child tax
// credit with its phase-out and refundable part. Not modelled: AMT, the qualified business income
// deduction, the earned income credit, education credits, self-employment tax.

export const FILING_STATUSES = [
  { id: "single", label: "Single" },
  { id: "married_joint", label: "Married filing jointly" },
  { id: "married_separate", label: "Married filing separately" },
  { id: "head_of_household", label: "Head of household" },
  { id: "qualifying_surviving", label: "Qualifying surviving spouse" },
];
export const statusLabel = (id) => FILING_STATUSES.find((s) => s.id === id)?.label ?? "Single";

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pos = (n) => Math.max(0, Number(n) || 0);

/** The year's parameters: the table for that year, or the latest earlier year indexed for inflation (the thresholds the law does not index stay put). */
export function paramsFor(tables, year, { inflation = 0.025 } = {}) {
  const years = Object.keys(tables).map(Number).sort((a, b) => a - b);
  if (!years.length) throw new Error("no tax tables");
  const base = years.filter((y) => y <= year).pop() ?? years[0];
  const factor = year > base ? Math.pow(1 + inflation, year - base) : 1;
  const p = indexParams(tables[base], factor, year);
  return p;
}

/** A copy of `params` with the indexed figures scaled by `factor` (brackets, deductions, gains thresholds, the wage base); Social Security thresholds, NIIT/Medicare thresholds and the credit phase-outs are fixed in law. */
export function indexParams(params, factor, year = null) {
  const round = (n, to) => factor === 1 ? n : Math.round((n * factor) / to) * to;   // a table's own year keeps its published figures exactly
  const status = {};
  for (const [k, s] of Object.entries(params.status)) {
    status[k] = { ...s, brackets: s.brackets.map((b) => round(b, 25)), standardDeduction: round(s.standardDeduction, 50), extraAllowance: round(s.extraAllowance, 50), ltcgBrackets: s.ltcgBrackets ? s.ltcgBrackets.map((b) => round(b, 50)) : null };
  }
  const out = { ...params, year: year ?? params.year, indexed: factor !== 1, status, ssWageBase: params.ssWageBase ? round(params.ssWageBase, 300) : null };
  if (year !== null && (year < 2025 || year > 2028)) delete out.seniorDeduction;   // the OBBB senior deduction runs 2025-2028
  return out;
}

/** The standard deduction for a status, with the extra allowance for each person 65 or older and for blindness. */
export function standardDeduction(status, params, { ages65plus = 0, blind = 0 } = {}) {
  const s = params.status[status] ?? params.status.single;
  return s.standardDeduction + (ages65plus + blind) * s.extraAllowance;
}

/** The ordinary brackets for a status as rows { rate, from, to } (to = Infinity for the top one). */
export function bracketsFor(status, params) {
  const s = params.status[status] ?? params.status.single;
  const rows = [];
  let from = 0;
  params.rates.forEach((rate, i) => { const to = s.brackets[i] ?? Infinity; rows.push({ rate, from, to }); from = to; });
  return rows;
}

/**
 * Tax on ordinary taxable income through the brackets.
 * -> { tax, layers: [{ rate, from, to, amount, tax }], bracketRate, roomInBracket, nextRate }
 */
export function taxOnOrdinary(taxable, status, params) {
  const t = pos(taxable);
  const rows = bracketsFor(status, params);
  let tax = 0, bracketRate = rows[0].rate, roomInBracket = rows[0].to, nextRate = rows[1]?.rate ?? rows[0].rate;
  const layers = [];
  for (let i = 0; i < rows.length; i++) {
    const b = rows[i];
    if (t <= b.from && i > 0) break;
    const amount = Math.min(t, b.to) - b.from;
    if (amount <= 0 && i > 0) break;
    const lt = amount * b.rate; tax += lt;
    layers.push({ rate: b.rate, from: b.from, to: b.to, amount, tax: lt });
    bracketRate = b.rate; roomInBracket = b.to - t; nextRate = rows[i + 1]?.rate ?? b.rate;
  }
  return { tax, layers, bracketRate, roomInBracket: Number.isFinite(roomInBracket) ? roomInBracket : Infinity, nextRate };
}

/**
 * Tax on qualified dividends and long-term gains, stacked on top of ordinary taxable income:
 * 0% while total taxable income sits under the first threshold, 15% to the second, 20% above.
 * -> { tax, layers: [{ rate, amount, tax }] }
 */
export function taxOnQualified(ordinaryTaxable, qualifiedTaxable, status, params) {
  const s = params.status[status] ?? params.status.single;
  const q = pos(qualifiedTaxable), o = pos(ordinaryTaxable);
  const tops = [...(s.ltcgBrackets ?? [0, 0]), Infinity];
  const rates = params.ltcgRates ?? [0, 0.15, 0.2];
  const layers = [];
  let tax = 0, from = o, left = q;
  for (let i = 0; i < rates.length && left > 0; i++) {
    const top = tops[i];
    if (from >= top) continue;
    const amount = Math.min(left, top - from);
    const lt = amount * rates[i]; tax += lt; layers.push({ rate: rates[i], amount, tax: lt });
    from += amount; left -= amount;
  }
  return { tax, layers };
}

/**
 * The taxable part of Social Security benefits (the IRS Social Security Benefits Worksheet):
 * provisional income = other income + tax-exempt interest + half the benefits; nothing below the
 * base, up to half between the base and the second threshold, up to 85% above it.
 */
export function taxableSocialSecurity(benefits, otherIncome, taxExemptInterest, status, params) {
  const b = pos(benefits);
  if (b <= 0) return 0;
  const th = params.ssTaxation?.[status] ?? params.ssTaxation?.single ?? { base: 25000, extra: 9000 };
  const provisional = (Number(otherIncome) || 0) + pos(taxExemptInterest) + b / 2;   // a capital loss can take "other income" below zero (worksheet line 3)
  const over = provisional - th.base;
  if (over <= 0) return 0;
  const over2 = Math.max(0, over - th.extra);
  const half = Math.min(b / 2, Math.min(over, th.extra) / 2);
  return Math.min(0.85 * b, half + 0.85 * over2);
}

/**
 * federalTax(inputs, params) -> the year's federal income tax.
 * inputs: {
 *   filingStatus, wages, otherOrdinary (interest, pensions, IRA withdrawals, Roth conversions, short-term gains, business),
 *   qualifiedIncome (qualified dividends + net long-term gains), socialSecurity (gross benefits), taxExemptInterest,
 *   capitalLoss (the allowed net capital loss, 0 to -3,000 or -1,500 separately: Schedule D line 21, taken off any income),
 *   adjustments (above the line: HSA, deductible IRA, ...), itemized (total itemized deductions after their caps, or 0),
 *   charitableCash (cash gifts to charity: from 2026 deductible up to 1,000 / 2,000 joint by people who do not itemize),
 *   ages65plus (you and a spouse), blind, dependentsUnder17, otherDependents, investmentIncome (for NIIT; default qualified income),
 *   withheld, paid (estimated payments)
 * }
 */
export function federalTax(inputs, params) {
  const status = params.status[inputs.filingStatus] ? inputs.filingStatus : "single";
  const wages = pos(inputs.wages), otherOrdinary = pos(inputs.otherOrdinary), qualified = pos(inputs.qualifiedIncome), ss = pos(inputs.socialSecurity);
  const exempt = pos(inputs.taxExemptInterest), adjustments = pos(inputs.adjustments), itemized = pos(inputs.itemized);
  const ages65plus = Math.min(2, Math.max(0, Math.round(Number(inputs.ages65plus) || 0))), blind = Math.min(2, Math.max(0, Math.round(Number(inputs.blind) || 0)));
  const capitalLoss = Math.min(0, Number(inputs.capitalLoss) || 0), charitableCash = pos(inputs.charitableCash);
  const ordinary = wages + otherOrdinary;
  const otherIncome = ordinary + qualified + capitalLoss - adjustments;
  const taxableSS = taxableSocialSecurity(ss, otherIncome, exempt, status, params);
  const gross = ordinary + qualified + ss;
  const agi = ordinary + qualified + capitalLoss + taxableSS - adjustments;   // Form 1040 line 11; a capital loss can take it below zero
  const std = standardDeduction(status, params, { ages65plus, blind });
  // the senior deduction (2025-2028): 6,000 a person 65 or older, each person's amount cut by 6% of the income over the threshold; married people only on a joint return
  let senior = 0;
  if (params.seniorDeduction && ages65plus > 0 && status !== "married_separate") {
    const sd = params.seniorDeduction;
    const th = sd.phaseOutThreshold[status] ?? sd.phaseOutThreshold.single;
    senior = Math.max(0, sd.perPerson - Math.max(0, agi - th) * sd.phaseOutRate) * ages65plus;
  }
  // from 2026: itemized deductions lose 2/37 of the smaller of themselves and the income over the 37% bracket's start (IRC §68)
  let itemizedLimit = 0;
  if (params.itemizedLimit && itemized > 0) {
    const [num, den] = params.itemizedLimit.fraction ?? [2, 37];
    const top = bracketsFor(status, params).at(-1).from;
    itemizedLimit = (num / den) * Math.min(itemized, Math.max(0, agi - senior - top));
  }
  const itemizedAfter = itemized - itemizedLimit;
  // from 2026: people who take the standard deduction also deduct cash gifts to charity, up to 1,000 (2,000 joint) (IRC §170(p))
  const charityCap = params.charity?.nonItemizerCap?.[status] ?? params.charity?.nonItemizerCap?.single ?? 0;
  const nonItemizerCharity = Math.min(charitableCash, charityCap);
  const useItemized = itemizedAfter > std + nonItemizerCharity;
  const deduction = (useItemized ? itemizedAfter : std + nonItemizerCharity) + senior;
  const taxableIncome = Math.max(0, agi - deduction);
  const qualifiedTaxable = Math.min(qualified, taxableIncome);
  const ordinaryTaxable = taxableIncome - qualifiedTaxable;
  const ord = taxOnOrdinary(ordinaryTaxable, status, params);
  const qual = taxOnQualified(ordinaryTaxable, qualifiedTaxable, status, params);
  // the gains worksheet's last line: never more than the regular tax on all of taxable income
  const incomeTax = qualifiedTaxable > 0 ? Math.min(ord.tax + qual.tax, taxOnOrdinary(taxableIncome, status, params).tax) : ord.tax;
  const qualifiedTax = incomeTax - ord.tax;
  // credits: child tax credit, phased out $50 per $1,000 (or part) of income over the threshold; the refundable part needs earned income
  let childTaxCredit = 0, refundable = 0;
  const kids = Math.max(0, Math.round(Number(inputs.dependentsUnder17) || 0)), others = Math.max(0, Math.round(Number(inputs.otherDependents) || 0));
  if (kids + others > 0) {
    const full = kids * (params.childTaxCredit ?? 2000) + others * 500;
    const th = params.childTaxCreditPhaseOut?.[status] ?? 200000;
    const reduced = Math.max(0, full - Math.ceil(Math.max(0, agi - th) / 1000) * 50);
    childTaxCredit = Math.min(reduced, incomeTax);
    const earned = wages + pos(inputs.selfEmployment);
    refundable = Math.min(reduced - childTaxCredit, kids * (params.additionalChildTaxCredit ?? 1700), 0.15 * Math.max(0, earned - 2500));
  }
  // the extra taxes: net investment income tax and the additional Medicare tax on wages
  const investment = inputs.investmentIncome === undefined || inputs.investmentIncome === null ? qualified : pos(inputs.investmentIncome);
  const niitTh = params.niitThreshold?.[status] ?? 200000;
  const niit = 0.038 * Math.min(investment, Math.max(0, agi - niitTh));
  const medTh = params.additionalMedicareThreshold?.[status] ?? 200000;
  const additionalMedicare = 0.009 * Math.max(0, wages - medTh);
  const totalTax = Math.max(0, incomeTax - childTaxCredit) + niit + additionalMedicare - refundable;
  const withheld = pos(inputs.withheld), paid = pos(inputs.paid);
  const out = {
    year: params.year ?? null, filingStatus: status,
    income: { wages, ordinary, qualified, capitalLoss, socialSecurity: ss, taxableSocialSecurity: taxableSS, taxExemptInterest: exempt, gross },
    agi, adjustments,
    deduction: { standard: std, itemized: itemizedAfter, itemizedBeforeLimit: itemized, itemizedLimit, charity: useItemized ? 0 : nonItemizerCharity, used: useItemized ? "itemized" : "standard", senior, amount: deduction },
    taxableIncome, ordinaryTaxable, qualifiedTaxable,
    ordinaryTax: ord.tax, qualifiedTax, incomeTax, layers: ord.layers, qualifiedLayers: qual.layers,
    credits: { childTaxCredit, refundable },
    niit, additionalMedicare, totalTax: money(totalTax),
    effectiveRate: gross > 0 ? totalTax / gross : 0,
    bracketRate: ord.bracketRate, roomInBracket: ord.roomInBracket, nextRate: ord.nextRate,
    withheld, paid, balance: money(totalTax - withheld - paid),
  };
  return out;
}

/** What the next `delta` dollars of ordinary income really cost, as a rate (the bracket, plus Social Security and gains bumped along, plus phase-outs). */
export function marginalRate(inputs, params, delta = 1000) {
  const a = federalTax(inputs, params).totalTax;
  const b = federalTax({ ...inputs, otherOrdinary: pos(inputs.otherOrdinary) + delta }, params).totalTax;
  return Math.max(0, (b - a) / delta);
}

/**
 * The largest x in [lo, hi] with f(x) <= 0, for f non-decreasing with f(lo) <= 0 < f(hi) (f may return Infinity
 * for "not allowed"). Secant steps inside the bracket, a bisection every third step so a stuck end cannot stall
 * it; stops when the bracket is under `tol` wide or f is within `ftol` of zero (either side).
 */
export function largestAtOrUnder(f, lo, flo, hi, fhi, tol = 1e-6, ftol = 1e-9) {
  for (let k = 0; k < 200 && hi - lo > tol; k++) {
    let x = Number.isFinite(fhi) && Number.isFinite(flo) && fhi !== flo ? lo - flo * (hi - lo) / (fhi - flo) : (lo + hi) / 2;
    if (!(x > lo && x < hi) || k % 3 === 2) x = (lo + hi) / 2;
    const fx = f(x);
    if (Math.abs(fx) <= ftol) return x;   // on the line, within the tolerance either side
    if (fx < 0) { lo = x; flo = fx; } else { hi = x; fhi = fx; }
  }
  return lo;
}

/** The largest extra ordinary income (a Roth conversion, say) that keeps taxable income at or under `taxableTop`, to a fraction of a cent; 0 if already at or over. */
export function roomUnder(inputs, params, taxableTop) {
  const base = pos(inputs.otherOrdinary);
  const over = (c) => federalTax({ ...inputs, otherOrdinary: base + c }, params).taxableIncome - taxableTop;
  const f0 = over(0);
  if (f0 >= 0) return 0;
  let lo = 0, flo = f0, hi = -f0, fhi = over(hi);
  while (fhi <= 0 && hi < 1e15) { lo = hi; flo = fhi; hi = hi * 2 + 1; fhi = over(hi); }   // deductions still unused: reach further
  if (fhi <= 0) return hi;
  return largestAtOrUnder(over, lo, flo, hi, fhi);
}

/** The taxable-income top of the bracket with `rate` for a status (Infinity for the top rate). */
export function bracketTop(rate, status, params) {
  const row = bracketsFor(status, params).find((b) => Math.abs(b.rate - rate) < 1e-9);
  return row ? row.to : Infinity;
}
