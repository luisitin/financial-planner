// modules/career/equity/compute.js -- PURE. Stock from work, in detail: restricted stock units by the calendar year
// they vest in, with the tax they bring against what is withheld; stock options and what exercising the vested ones
// costs in tax now (nonqualified: as pay; incentive: the alternative minimum tax, the room before it shared across the
// grants, and the $100,000-a-year rule that makes the rest nonqualified); shares bought through the purchase plan and
// the tax of selling them now against waiting for a qualifying sale; and the stake against everything invested.
// The grants are the Employer stock page's (`equity.grants`, `vestSchedule`); this page adds `optionType` and `equity.espp`.
import { compute as computeEmployerStock, vestSchedule, SUPPLEMENTAL, DEFAULT_GRANT } from "../../investments/employer-stock/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { federalTax, taxOnQualified, largestAtOrUnder } from "../../../core/math/tax.js";
import { addMonths, isoOf } from "../../../core/math/dates.js";
import { amtFor } from "./data/amt.js";

/** Incentive options: at most $100,000 of stock (strike x shares) may first become exercisable in a year (IRC 422(d)); the rest are nonqualified. */
export const ISO_LIMIT = 100000;
/** A qualifying sale of option or purchase-plan shares: more than two years after the grant (offering) and more than one after the exercise (purchase), IRC 422(a)(1), 423(a)(1). */
export const HOLD = { fromGrant: 24, fromExercise: 12 };
/** An incentive option must be exercised within 3 months of leaving the job to stay one (IRC 422(a)(2)); options usually last 10 years. */
export const ISO_AFTER_LEAVING = 3;
export const ESPP_DISCOUNT = 0.15;
/** Payroll tax on pay from stock (RSUs, nonqualified options): Social Security to the wage base, Medicare, and the 0.9% (withheld only above $200,000 from one employer). */
export const PAYROLL = { ss: 0.062, medicare: 0.0145, extraMedicare: 0.009, extraWithheldOver: 200000 };

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const pos = (v) => Math.max(0, num(v) ?? 0);
const later = (a, b) => (a > b ? a : b);
const fedOnly = (r) => r.totalTax - r.additionalMedicare;
/** The day after a date: a holding period of "more than" a year or two is met from the day after the anniversary. */
export const dayAfter = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return isoOf(y, m, d + 1); };

/**
 * The alternative minimum tax (Form 6251, simplified). AMT income = AGI less the deduction taken (line 1, which may be
 * below zero) + the standard deduction (not allowed for AMT, IRC 56(b)(1)(E)) or, for an itemizer, the state and local
 * taxes deducted (56(b)(1)(A)(ii)) less the 2026 limit on itemized deductions, which does not apply to the AMT
 * (56(b)(1)(F)), + the incentive-option spread (56(b)(3)). Exemption less `phaseOutRate` of AMT income above the
 * start; 26% on the rest up to the 28% line, 28% above; qualified dividends and long-term gains keep their own rates,
 * stacked on the regular ordinary taxable income (Part III). AMT = the tentative tax less the regular income tax.
 */
export function amt(inputs, params, A, { preference = 0, salt = 0 } = {}) {
  const r = federalTax(inputs, params);
  const status = A.exemption[r.filingStatus] !== undefined ? r.filingStatus : "single";
  const addBack = r.deduction.used === "standard" ? r.deduction.standard : salt - (r.deduction.itemizedLimit ?? 0);
  const amti = Math.max(0, r.agi - r.deduction.amount + addBack + preference);
  const exemption = Math.max(0, A.exemption[status] - A.phaseOutRate * Math.max(0, amti - A.phaseOutStart[status]));
  const excess = Math.max(0, amti - exemption);
  const line = status === "married_separate" ? A.rate28From.married_separate : A.rate28From.all;
  const flat = (x) => 0.26 * Math.min(x, line) + 0.28 * Math.max(0, x - line);
  const q = Math.min(r.qualifiedTaxable, excess);
  const tentative = q > 0 ? Math.min(flat(excess), flat(excess - q) + taxOnQualified(r.ordinaryTaxable, q, status, params).tax) : flat(excess);
  return { amti, exemption, excess, tentative, regular: r.incomeTax, amt: Math.max(0, tentative - r.incomeTax) };
}
/** The largest incentive-option spread that adds no AMT this year (within $1), or Infinity above $100 million. */
export function amtRoom(inputs, params, A, opts = {}) {
  const base = amt(inputs, params, A, opts).amt;
  const f = (p) => amt(inputs, params, A, { ...opts, preference: p }).amt - base - 0.5;
  let hi = 10000;
  while (f(hi) <= 0) { hi *= 2; if (hi > 1e8) return Infinity; }
  return largestAtOrUnder(f, 0, f(0), hi, f(hi), 1);
}

/**
 * The tax on `value` of pay from stock (RSUs vesting, a nonqualified option's spread) and what the employer withholds:
 * federal income tax by the engine on wages + value; Social Security on the part under the wage base after the
 * person's other pay; Medicare 1.45%; 0.9% on the household's Medicare wages above the filing status's threshold;
 * the state's rate. Withheld: 22% of the value for federal tax (37% above $1 million), Social Security and Medicare in
 * full, the 0.9% only on this person's pay above $200,000, the state's rate (assumed).
 */
export function stockPayTax(value, { inputs, params, personWages = 0, medicareWages = 0, wageBase = Infinity, stateRate = 0 }) {
  if (!(value > 0)) return { value: 0, federal: 0, payroll: 0, state: 0, owed: 0, withheldFederal: 0, withheld: 0, gap: 0 };
  const federal = fedOnly(federalTax({ ...inputs, wages: (Number(inputs.wages) || 0) + value }, params)) - fedOnly(federalTax(inputs, params));
  const ss = PAYROLL.ss * Math.max(0, Math.min(personWages + value, wageBase) - Math.min(personWages, wageBase));
  const th = params.additionalMedicareThreshold?.[inputs.filingStatus] ?? 200000;
  const extra = PAYROLL.extraMedicare * (Math.max(0, medicareWages + value - th) - Math.max(0, medicareWages - th));
  const extraWithheld = PAYROLL.extraMedicare * (Math.max(0, personWages + value - PAYROLL.extraWithheldOver) - Math.max(0, personWages - PAYROLL.extraWithheldOver));
  const payroll = ss + value * PAYROLL.medicare + extra;
  const state = value * (stateRate || 0);
  const withheldFederal = SUPPLEMENTAL.rate * Math.min(value, SUPPLEMENTAL.over) + SUPPLEMENTAL.high * Math.max(0, value - SUPPLEMENTAL.over);
  const withheld = withheldFederal + ss + value * PAYROLL.medicare + extraWithheld + state;
  const owed = federal + payroll + state;
  return { value, federal, payroll, state, owed, withheldFederal, withheld, gap: owed - withheld };
}

/**
 * A purchase-plan lot sold at `price` on `on` (IRC 423, IRS Publication 525). Qualifying from the day after the later
 * of the offering start + 2 years and the purchase + 1 year: pay = the smaller of the gain and the discount on the
 * offering-day price (`discount` x that price), at least 0; the rest a long-term gain or loss. Otherwise: pay = the
 * purchase-day value less the price paid, the rest a gain or loss, long-term from the day after the purchase's
 * anniversary (IRS Publication 544: a sale on the anniversary is short-term).
 */
export function esppSale(lot, price, on) {
  const shares = pos(lot.shares), paid = pos(lot.price), fmvO = pos(lot.fmvOffering), fmvP = pos(lot.fmvPurchase), d = num(lot.discount) ?? ESPP_DISCOUNT;
  const qualifiesOn = dayAfter(later(addMonths(lot.offeringDate, HOLD.fromGrant), addMonths(lot.purchaseDate, HOLD.fromExercise)));
  const longOn = dayAfter(addMonths(lot.purchaseDate, HOLD.fromExercise));
  const proceeds = shares * price;
  const qualifying = on >= qualifiesOn;
  if (qualifying) {
    const ordinary = shares * Math.max(0, Math.min(price - paid, d * fmvO));
    return { shares, proceeds, qualifiesOn, longOn, qualifying, ordinary, shortGain: 0, longGain: proceeds - shares * paid - ordinary };
  }
  const ordinary = shares * Math.max(0, fmvP - paid);
  const gain = proceeds - shares * fmvP;
  const long = on >= longOn;
  return { shares, proceeds, qualifiesOn, longOn, qualifying, ordinary, shortGain: long ? 0 : gain, longGain: long ? gain : 0 };
}
/**
 * The tax a sale adds: pay taxed as income (no Social Security or Medicare for purchase-plan or incentive shares),
 * short-term gains as income, long-term at their rates, the gains also in the 3.8% net investment income tax; a net
 * loss off income together with the household's own allowed loss, at most $3,000 ($1,500 separately) in all; the
 * state's rate on the total.
 */
export function saleTax({ ordinary = 0, shortGain = 0, longGain = 0 }, { inputs, params, stateRate = 0 }) {
  const base = fedOnly(federalTax(inputs, params));
  const net = shortGain + longGain;
  const short = net < 0 ? 0 : longGain < 0 ? shortGain + longGain : shortGain;
  const long = net < 0 ? 0 : longGain < 0 ? 0 : shortGain < 0 ? longGain + shortGain : longGain;
  const limit = inputs.filingStatus === "married_separate" ? -1500 : -3000;
  const had = Number(inputs.capitalLoss) || 0;
  const loss = net < 0 ? Math.max(limit, had + net) - had : 0;
  const after = fedOnly(federalTax({
    ...inputs, wages: (Number(inputs.wages) || 0) + ordinary, otherOrdinary: (Number(inputs.otherOrdinary) || 0) + Math.max(0, short),
    qualifiedIncome: (Number(inputs.qualifiedIncome) || 0) + Math.max(0, long), capitalLoss: had + loss,
    investmentIncome: Math.max(0, (Number(inputs.investmentIncome) || 0) + Math.max(0, short) + Math.max(0, long) + loss),
  }, params));
  const federal = after - base;
  const state = Math.max(0, ordinary + net) * (stateRate || 0);
  return { federal, state, total: federal + state };
}

/**
 * Splits incentive options by the $100,000 rule: for each calendar year, the grants' options first exercisable that
 * year are counted in grant order at the strike; what passes $100,000 is nonqualified. Returns per grant its vests with
 * the incentive and nonqualified parts, and the years over the limit with their value and the part over.
 */
export function isoSplit(grants) {
  const isos = grants.filter((g) => g.optionType === "iso").sort((a, b) => String(a.granted ?? "").localeCompare(String(b.granted ?? "")));
  const used = new Map(), over = new Map(), byGrant = new Map();
  for (const g of isos) {
    const vests = [];
    for (const e of g.schedule) {
      const y = Number(e.date.slice(0, 4)), strike = g.strike ?? 0;
      const room = Math.max(0, ISO_LIMIT - (used.get(y) ?? 0));
      const isoShares = strike > 0 ? Math.min(e.shares, Math.floor(room / strike + 1e-9)) : e.shares;
      used.set(y, (used.get(y) ?? 0) + e.shares * strike);
      if (isoShares < e.shares) over.set(y, (over.get(y) ?? 0) + (e.shares - isoShares) * strike);
      vests.push({ ...e, iso: isoShares, nso: e.shares - isoShares });
    }
    byGrant.set(g.id, vests);
  }
  return { byGrant, over: [...over].sort((a, b) => a[0] - b[0]).map(([year, value]) => ({ year, value: used.get(year) ?? 0, over: value })) };
}

/**
 * compute(plan, { today }) -> {
 *   ready, needsPrice, year, symbol, price, priceAsOf, person, personWages, stake: { share, level, exposure, invested, owned, unvested, vestedUnits },
 *   grants, rsuYears: [{ year, value, vests: [{ date, grant, shares, value, past }], tax }],
 *   options: [{ id, name, type, vested, unvested, next, strike, spreadEach, spread, cost, expires,
 *     nsoShares, nso: stockPayTax | null (nonqualified options, and incentive options over the $100,000 rule),
 *     iso: { shares, spread, amtAll, room, roomShares, unlimited, holdUntil, sameYearTax } | null }],
 *   isoRoom (the year's, shared in grant order), isoOver: [{ year, value, over }], espp: [...], esppSkipped, amtNow, stateRate, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const year = Number(today.slice(0, 4));
  const eq = plan.equity ?? {};
  const allLots = (eq.espp ?? []).filter((l) => pos(l.shares) > 0 && l.purchaseDate && l.offeringDate);
  const lots = allLots.filter((l) => num(l.price) !== null && num(l.fmvOffering) !== null && num(l.fmvPurchase) !== null);
  const es = computeEmployerStock(plan, { today });
  if (!es.ready && !allLots.length) return { ready: false, year };
  const price = es.ready ? es.price : pos(eq.price);
  const notes = [];
  const people = plan.household?.people ?? [];
  const inc = computeIncome(plan, { today });
  const whoId = eq.personId || inc.active.find((x) => x.type === "salary")?.personId || "";
  const person = people.find((p) => p.id === whoId) ?? null;
  const grants = (es.grants ?? []).map((g) => { const r = (eq.grants ?? []).find((x) => x.id === g.id) ?? {}; return { ...g, optionType: g.kind === "option" ? (r.optionType === "iso" ? "iso" : "nso") : null, granted: r.granted || r.vestStart || null, vestStart: r.vestStart || r.granted || null }; });
  const stake = es.ready ? { share: es.share, level: es.level, exposure: es.exposure, invested: es.invested, owned: es.owned, unvested: es.unvested, vestedUnits: grants.filter((g) => g.kind === "rsu").reduce((t, g) => t + g.vested, 0) } : null;
  const esppSkipped = allLots.length - lots.length;
  const base = { ready: true, year, symbol: es.symbol ?? String(eq.symbol ?? "").toUpperCase(), price, priceAsOf: es.priceAsOf ?? eq.priceAsOf ?? null, person: person ? { id: person.id, name: person.name } : null, grants, stake, esppSkipped, notes };
  if (!(price > 0)) return { ...base, needsPrice: true, rsuYears: [], options: [], isoRoom: null, isoOver: [], espp: [] };

  const personWages = inc.active.filter((x) => (!whoId || x.personId === whoId) && ["salary", "bonus"].includes(x.type) && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
  const medicareWages = inc.active.filter((x) => ["salary", "bonus"].includes(x.type) && x.taxable !== false && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
  const ti = taxInputs(plan, { today });
  const st = computeState(plan, { today });
  const stateRate = st.rate ?? 0;
  const A = amtFor(year);
  const salt = ti.itemized?.lines?.find((l) => l.key === "salt")?.amount ?? 0;
  if (st.rate === null) notes.push("Your state's income tax is not counted: set its rate on the State tax page.");

  // restricted stock units by the calendar year they vest in (this year's earlier vests too), at today's price; each year's wage base
  const rsuYears = [year, year + 1].map((y) => {
    const vests = [];
    for (const g of grants.filter((x) => x.kind === "rsu")) for (const e of g.schedule) if (Number(e.date.slice(0, 4)) === y) vests.push({ date: e.date, grant: g.name, shares: e.shares, value: e.shares * price, past: e.date <= today });
    vests.sort((a, b) => a.date.localeCompare(b.date));
    const value = vests.reduce((t, v) => t + v.value, 0);
    return { year: y, value, vests, tax: stockPayTax(value, { inputs: ti.inputs, params: ti.params, personWages, medicareWages, wageBase: maximumEarnings(y), stateRate }) };
  });
  // this year's other figures stand on this year's pay with the units vesting this year in it
  const rsuNow = rsuYears[0].value;
  const inputsNow = { ...ti.inputs, wages: (Number(ti.inputs.wages) || 0) + rsuNow };
  const T = { inputs: inputsNow, params: ti.params, personWages: personWages + rsuNow, medicareWages: medicareWages + rsuNow, wageBase: maximumEarnings(year), stateRate };

  // options: exercising every vested one now; incentive options share the year's room before the AMT, in grant order
  const amtNow = amt(inputsNow, ti.params, A, { salt });
  const isoRoom = grants.some((g) => g.optionType === "iso") ? amtRoom(inputsNow, ti.params, A, { salt }) : null;
  const split = isoSplit(grants);
  let roomLeft = isoRoom ?? 0, isoSpreadSoFar = 0;
  const options = grants.filter((g) => g.kind === "option").sort((a, b) => String(a.granted ?? "").localeCompare(String(b.granted ?? ""))).map((g) => {
    const spreadEach = Math.max(0, price - (g.strike ?? 0));
    const vestedVests = g.optionType === "iso" ? (split.byGrant.get(g.id) ?? []).filter((e) => e.date <= today) : [];
    const nsoShares = g.optionType === "iso" ? vestedVests.reduce((t, e) => t + e.nso, 0) : g.vested;
    const isoShares = g.vested - nsoShares;
    const out = { id: g.id, name: g.name, type: g.optionType, vested: g.vested, unvested: g.unvested, next: g.next, strike: g.strike ?? 0, spreadEach, spread: g.vested * spreadEach, cost: g.vested * (g.strike ?? 0), expires: g.expires, nsoShares, nso: null, iso: null };
    if (nsoShares > 0 && spreadEach > 0) out.nso = stockPayTax(nsoShares * spreadEach, T);
    if (g.optionType === "iso") {
      const spread = isoShares * spreadEach;
      const amtAll = amt(inputsNow, ti.params, A, { salt, preference: isoSpreadSoFar + spread }).amt - amt(inputsNow, ti.params, A, { salt, preference: isoSpreadSoFar }).amt;
      const unlimited = !Number.isFinite(isoRoom);
      const roomShares = spreadEach <= 0 ? isoShares : unlimited ? isoShares : Math.min(isoShares, Math.floor(Math.max(0, roomLeft) / spreadEach + 1e-9));
      if (!unlimited) roomLeft = Math.max(0, roomLeft - roomShares * spreadEach);
      isoSpreadSoFar += spread;
      const holdUntil = dayAfter(later(g.granted ? addMonths(g.granted, HOLD.fromGrant) : today, addMonths(today, HOLD.fromExercise)));
      // sold the same year (a disqualifying sale): the spread is pay for income tax, without Social Security or Medicare
      const sameYearTax = saleTax({ ordinary: spread }, { inputs: inputsNow, params: ti.params, stateRate });
      out.iso = { shares: isoShares, spread, amtAll, room: roomShares * spreadEach, roomShares, unlimited, holdUntil, sameYearTax };
    }
    return out;
  });

  // purchase-plan lots: sell now, or on the first qualifying day at today's price
  const T2 = { inputs: inputsNow, params: ti.params, stateRate };
  const espp = lots.map((l) => {
    const now = esppSale(l, price, today);
    const atQualifying = now.qualifying ? now : esppSale(l, price, now.qualifiesOn);
    const taxNow = saleTax(now, T2), taxAtQualifying = saleTax(atQualifying, T2);
    return { ...l, now, atQualifying, taxNow, taxAtQualifying, wait: now.qualifying ? 0 : taxNow.total - taxAtQualifying.total };
  });

  return { ...base, needsPrice: false, personWages, rsuYears, options, isoRoom, isoOver: split.over, espp, amtNow, stateRate };
}
export { vestSchedule, DEFAULT_GRANT };
