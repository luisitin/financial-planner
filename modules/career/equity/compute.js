// modules/career/equity/compute.js -- PURE. Stock from work, in detail: restricted stock units by the calendar year
// they vest in, with the tax they bring against what is withheld; stock options and what exercising the vested ones
// costs in tax now (nonqualified: as pay; incentive: the alternative minimum tax, the room before it shared across the
// grants, and the $100,000-a-year rule that makes the rest nonqualified); shares bought through the purchase plan and
// the tax of selling them now against waiting for a qualifying sale; and the stake against everything invested.
// The grants are the Employer stock page's (`equity.grants`, `vestSchedule`); this page adds `optionType` and `equity.espp`.
import { compute as computeEmployerStock, vestSchedule, SUPPLEMENTAL, DEFAULT_GRANT } from "../../investments/employer-stock/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { taxView, known, knownWithout } from "../../taxes/federal/known.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { federalTax, largestAtOrUnder, minimumTax } from "../../../core/math/tax.js";
import { addMonths, isoOf } from "../../../core/math/dates.js";
import { amtFor } from "./data/amt.js";
import { deferredPlans, adultsOf, DEFERRED_MAX_YEARS, DEFERRED_GROWTH } from "./deferred.js";
import { nameIn, nameOf, verbFor } from "../../../core/words.js";

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
 * The alternative minimum tax (Form 6251, simplified): core/math/tax.js minimumTax, the one arithmetic the Federal estimate
 * uses too (gap list, next 60, item 29, moved there 2026-11-16). AMT income = AGI less the deduction taken (line 1b, which
 * may be below zero) + the standard deduction (not allowed for AMT, IRC 56(b)(1)(E)) or, for an itemizer, the state and
 * local taxes deducted (56(b)(1)(A)(ii)) less the 2026 limit on itemized deductions, which does not apply to the AMT
 * (56(b)(1)(F)), + the deduction for people 65 and over (line 1a), + the incentive-option spread (56(b)(3)): `preference`
 * here, on top of a spread already exercised this year and typed on the Federal estimate (the return's `amt`). Exemption
 * less `phaseOutRate` of AMT income above the start; 26% on the rest up to the 28% line, 28% above; qualified dividends and
 * long-term gains keep their own rates, all of them (line 13 takes them from the gains worksheet's line 4, not limited to
 * regular taxable income), stacked on the regular ordinary taxable income (Part III). AMT = the tentative tax less the
 * regular income tax.
 */
export function amt(inputs, params, A, opts = {}) {
  return minimumTax(inputs, params, A, opts);
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
export function stockPayTax(value, { inputs, params, personWages = 0, medicareWages = 0, wageBase = Infinity, stateRate = 0, federalIs = null, selfEmployment = 0 }) {
  if (!(value > 0)) return { value: 0, federal: 0, payroll: 0, state: 0, owed: 0, withheldFederal: 0, withheld: 0, gap: 0, extraMedicare: 0, extraWithheld: 0, selfEmployment: 0 };
  // `federalIs` and `selfEmployment` (a business: the units fill the Social Security base and push taxable income past the 20% deduction's
  // line, which a fixed return cannot show) are the Federal estimate's return with the units less without them, when it has them
  const federal = federalIs !== null ? federalIs : fedOnly(federalTax({ ...inputs, wages: (Number(inputs.wages) || 0) + value }, params)) - fedOnly(federalTax(inputs, params));
  const ss = PAYROLL.ss * Math.max(0, Math.min(personWages + value, wageBase) - Math.min(personWages, wageBase));
  const th = params.additionalMedicareThreshold?.[inputs.filingStatus] ?? 200000;
  const extra = PAYROLL.extraMedicare * (Math.max(0, medicareWages + value - th) - Math.max(0, medicareWages - th));
  const extraWithheld = PAYROLL.extraMedicare * (Math.max(0, personWages + value - PAYROLL.extraWithheldOver) - Math.max(0, personWages - PAYROLL.extraWithheldOver));
  const payroll = ss + value * PAYROLL.medicare + extra + selfEmployment;
  const state = value * (stateRate || 0);
  const withheldFederal = SUPPLEMENTAL.rate * Math.min(value, SUPPLEMENTAL.over) + SUPPLEMENTAL.high * Math.max(0, value - SUPPLEMENTAL.over);
  const withheld = withheldFederal + ss + value * PAYROLL.medicare + extraWithheld + state;
  const owed = federal + payroll + state;
  // extraMedicare (owed, inside `payroll`) and extraWithheld (held back, inside `withheld`) are the 0.9% Medicare tax: owed on the
  // household's wages past the line, held back on this person's pay past 200,000; their difference is part of `gap`, so a page
  // can show the rows adding up (federal - withheldFederal + extraMedicare - extraWithheld = gap while Social Security and 1.45% match)
  return { value, federal, payroll, state, owed, withheldFederal, withheld, gap: owed - withheld, extraMedicare: extra, extraWithheld, selfEmployment };
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
 *   grants, rsuYears: [{ year, value, vests: [{ date, grant, shares, value, past }], estimated (worked on tables raised for
 *   inflation), tax }],
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
  // pay held for later (deferred pay plans): only when the plan holds one, so with none every output is as before, key for key
  const held = deferredPlans(plan, { year }).length > 0;
  const withDeferred = (out, ti = null) => (held ? { ...out, deferred: deferredPay(plan, { today, ti }) } : out);
  if (!es.ready && !allLots.length) return withDeferred({ ready: false, year });
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
  if (!(price > 0)) return withDeferred({ ...base, needsPrice: true, rsuYears: [], options: [], isoRoom: null, isoOver: [], espp: [] });

  const personWages = inc.active.filter((x) => (!whoId || x.personId === whoId) && ["salary", "bonus"].includes(x.type) && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
  const medicareWages = inc.active.filter((x) => ["salary", "bonus"].includes(x.type) && x.taxable !== false && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
  const ti = taxView(plan, { today }, { without: "stock" });   // the Federal estimate's return without the units vesting this year: this page adds them
  const st = computeState(plan, { today });
  const stateRate = st.rate ?? 0;
  const A = amtFor(year);
  const salt = ti.itemized?.lines?.find((l) => l.key === "salt")?.amount ?? 0;
  if (st.rate === null) notes.push("Your state's income tax is not counted: set its rate on the State tax page.");

  // restricted stock units by the calendar year they vest in (this year's earlier vests too), at today's price; each year's wage base
  // each year on its own tax tables, as Employer stock works it (round 8 review: 2027's units were worked on 2026's tables, so
  // this page said 498 to set aside for 2027 where Employer stock said 352): this year on the plan's return, a later year on
  // that year's figures (the latest tables raised for inflation until the IRS publishes them; `estimated` says so)
  const setYear = Number(plan.taxes?.year) || null;
  const tiOf = (y) => (y === year ? ti : y === setYear ? taxView(plan, { today }, { without: "stock" }) : taxView({ ...plan, taxes: { ...(plan.taxes ?? {}), year: y, gains: [] } }, { today }, { without: "stock" }));
  const rsuYears = [year, year + 1].map((y) => {
    const vests = [];
    for (const g of grants.filter((x) => x.kind === "rsu")) for (const e of g.schedule) if (Number(e.date.slice(0, 4)) === y) vests.push({ date: e.date, grant: g.name, shares: e.shares, value: e.shares * price, past: e.date <= today });
    vests.sort((a, b) => a.date.localeCompare(b.date));
    const value = vests.reduce((t, v) => t + v.value, 0);
    const t = value > 0 ? tiOf(y) : ti;
    // the units against none on the Federal estimate's own return for that year (known() with them and without), so a business's
    // 20% deduction and self-employment tax are worked again with them in
    let federalIs = null, selfEmployment = 0;
    if (value > 0) {
      const planY = y === year || y === setYear ? plan : { ...plan, taxes: { ...(plan.taxes ?? {}), year: y, gains: [] } };
      const w = known(planY, { today }), o = knownWithout(planY, { today }, null, "stock");
      if (w.stock && Math.abs(w.stock.value - value) < 0.01) {
        federalIs = (w.result.totalTax - w.result.additionalMedicare) - (o.result.totalTax - o.result.additionalMedicare);
        selfEmployment = (w.total - w.result.totalTax) - (o.total - o.result.totalTax);
      }
    }
    return { year: y, value, vests, estimated: !!t.params.indexed, tax: stockPayTax(value, { inputs: t.inputs, params: t.params, personWages, medicareWages, wageBase: maximumEarnings(y), stateRate, federalIs, selfEmployment }) };
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

  return withDeferred({ ...base, needsPrice: false, personWages, rsuYears, options, isoRoom, isoOver: split.over, espp, amtNow, stateRate }, ti);
}
export { vestSchedule, DEFAULT_GRANT };

// ---------------------------------------------------------------- pay held for later (deferred pay plans; README "Pay held for later")
/** The federal income tax a payout adds (taxed as pay when paid: ordinary income; no Social Security or Medicare, taken when it went in). */
export function payoutTax(amount, inputs, params) {
  if (!(amount > 0)) return 0;
  return fedOnly(federalTax({ ...inputs, otherOrdinary: (Number(inputs.otherOrdinary) || 0) + amount }, params)) - fedOnly(federalTax(inputs, params));
}

/**
 * deferredPay(plan, { today, ti }) -> { plans, years: [{ year, amount, tax, stopped }], total, tax } | null (no plan)
 * Each plan's payouts (deferred.js `payouts`, today's dollars) with the federal tax on each year's payout: this year's return
 * (the Federal estimate's, without this year's vesting units: `ti`), its wages times the share of the household's pay still
 * earned that year (an adult's pay ends in their stop year), then T_y = F(base_y with every payout of y) - F(base_y) at this
 * year's tables, each plan's share T_y x its payout / all of y.
 *   plans: [{ id, name, personId, owner: { id, name, stopYear }, placed, atStop, late, startYear, years, growth, contributions,
 *            value, part, rows: [{ year, amount, tax }], total, tax, runs: [{ from, to, amount, tax }], case }]
 *   case: "once" (one year) | "even" (every year the same payout and tax) | "runs" (the tax differs by year) | "unplaced"
 */
export function deferredPay(plan, { today, ti = null } = {}) {
  const year = Number(String(today).slice(0, 4));
  const list = deferredPlans(plan, { year });
  if (!list.length) return null;
  const t = ti ?? taxView(plan, { today }, { without: "stock" });
  const inc = computeIncome(plan, { today });
  const adults = adultsOf(plan);
  const selfId = (adults.find((p) => p.role === "self") ?? adults[0])?.id ?? null;
  const payBy = new Map();
  for (const x of inc.active) if (["salary", "bonus"].includes(x.type) && x.period !== "once" && x.taxable !== false) { const id = x.personId || selfId; payBy.set(id, (payBy.get(id) ?? 0) + x.yearly); }
  const payAll = [...payBy.values()].reduce((s, v) => s + v, 0);
  const wages = Number(t.inputs.wages) || 0;
  // the children: the child tax credit counts a child only while under 17 at the end of the year, the care credit only while a
  // child is under 13 (IRC 24(c)(1), 21(b)(1)(A), as the Federal estimate applies them): a child grown by the payout year adds
  // neither (a $40,000 payout in 2055 read "no federal tax" for a family whose child is 6 today)
  const kidYears = (plan.household?.people ?? []).filter((x) => x?.role === "dependent").map((x) => (x.birthDate ? Number(String(x.birthDate).slice(0, 4)) : null));
  const under = (y, age) => kidYears.filter((b) => b === null || !Number.isFinite(b) || y - b < age).length;
  const baseOf = (y) => {
    let left = 0; const stopped = [];
    for (const [id, v] of payBy) { const p = adults.find((a) => a.id === id); if (p && p.stopYear !== null && p.stopYear <= y) stopped.push(id); else left += v; }
    let inputs = stopped.length && payAll > 0 ? { ...t.inputs, wages: (wages * left) / payAll } : t.inputs;
    const kids = Number(inputs.dependentsUnder17) || 0;
    if (kids > 0 && under(y, 17) < kids) inputs = { ...inputs, dependentsUnder17: Math.max(0, under(y, 17)) };
    if (inputs.care && under(y, 13) === 0) inputs = { ...inputs, care: undefined };
    return { inputs, stopped };
  };
  const byYear = new Map();
  for (const d of list) for (const r of d.rows) byYear.set(r.year, (byYear.get(r.year) ?? 0) + r.amount);
  const years = [...byYear].sort((a, b) => a[0] - b[0]).map(([y, amount]) => { const b = baseOf(y); return { year: y, amount, tax: payoutTax(amount, b.inputs, t.params), stopped: b.stopped }; });
  const yearOf = new Map(years.map((y) => [y.year, y]));
  const plans = list.map((d) => {
    const rows = d.rows.map((r) => { const y = yearOf.get(r.year); return { year: r.year, amount: r.amount, tax: y.amount > 0 ? (y.tax * r.amount) / y.amount : 0 }; });
    const runs = [];
    for (const r of rows) {
      const last = runs.at(-1);
      if (last && last.to === r.year - 1 && Math.round(last.amount) === Math.round(r.amount) && Math.round(last.tax) === Math.round(r.tax)) last.to = r.year;
      else runs.push({ from: r.year, to: r.year, amount: r.amount, tax: r.tax });
    }
    const kind = !d.placed ? "unplaced" : rows.length === 1 ? "once" : runs.length === 1 ? "even" : "runs";
    const { entry: _e, owner, ...rest } = d;
    return { ...rest, owner: owner ? { id: owner.id, name: owner.name, stopYear: owner.stopYear } : null, rows, total: rows.reduce((s, r) => s + r.amount, 0), tax: rows.reduce((s, r) => s + r.tax, 0), runs, case: kind };
  });
  return { plans, years, total: years.reduce((s, y) => s + y.amount, 0), tax: years.reduce((s, y) => s + y.tax, 0) };
}

/** The words of "Pay held for later" (one sentence per case, docs/OPTIONAL.md R5; tested one by one). */
export const DEFERRED = Object.freeze({
  title: "Pay held for later",
  intro: "Pay your employer keeps back now and pays you later, in one year or in yearly parts (a deferred pay plan). Add each plan to see the years it pays out and the federal tax on each payout.",
  how: "In today's dollars. Federal tax only, at this year's tables, on top of your household's other income now (less the pay of anyone who has stopped work by then). Social Security and Medicare tax was taken when the pay went in.",
  risk: "Until it is paid, this money is the company's: if the company fails, you wait in line with everyone else it owes.",
  retirement: "The Will the money last? page counts each payout as income in the year it is paid.",
});
const taxSaid = (tax, money, each = false) => (tax >= 0.5 ? `with about ${money(tax)} of federal tax${each ? " each year" : ""}` : "with no federal tax");
/** One plan's lines: the case's sentence (one per run for "runs"), and a line when its first year was moved to this year. */
export function deferredLines(p, money, year = null) {
  const out = [];
  // not counted: nothing says when it pays (the page adds the way to the People page under it)
  if (p.case === "unplaced") {
    const who = p.owner?.name;
    out.push(`Not counted yet: it pays from the year ${nameIn(who)} ${verbFor(who, "stops", "stop")} work, and that needs ${nameOf(who)} birth date.`);
    return out;
  }
  if (p.case === "once") out.push(`All of it in ${p.startYear}: about ${money(p.part)}, ${taxSaid(p.rows[0].tax, money)}.`);
  else if (p.case === "even") out.push(`${money(p.part)} a year from ${p.startYear} to ${p.startYear + p.years - 1}, ${taxSaid(p.rows[0].tax, money, true)}.`);
  else for (const r of p.runs) out.push(r.from === r.to ? `${r.from}: ${money(r.amount)}, ${taxSaid(r.tax, money)}.` : `${r.from} to ${r.to}: ${money(r.amount)} a year, ${taxSaid(r.tax, money, true)}.`);
  if (p.late) out.push(`It would have started before ${year ?? p.startYear}, so it is counted from ${p.startYear}.`);
  return out;
}
/** The one sentence a save names (R7): the case's sentence, or for "runs" the whole: what it pays, when, and the tax in all. */
export function deferredSummary(p, money) {
  if (p.case === "runs") return `It pays ${money(p.total)} from ${p.startYear} to ${p.startYear + p.years - 1}, ${taxSaid(p.tax, money)} in all.`;
  return deferredLines(p, money)[0];
}
/** The row's status: the years of one plan ("2031 to 2035", "in 2031"), or how many plans; nothing while there is none. */
export function deferredStatus(d) {
  const ps = d?.plans ?? [];
  if (!ps.length) return "";
  if (ps.length > 1) return `${ps.length} plans`;
  const p = ps[0];
  if (!p.placed) return "";
  return p.years === 1 ? `in ${p.startYear}` : `${p.startYear} to ${p.startYear + p.years - 1}`;
}
const quoted = (name) => (name ? `"${name}"` : "The plan");
export const deferredSaid = {
  added: (p, money) => `Added. ${deferredSummary(p, money)}`,
  saved: (p, money) => `Saved. ${deferredSummary(p, money)}`,
  removed: (name) => `Removed ${name ? `"${name}"` : "the plan"}.`,
  addUndone: (name) => `${quoted(name)} is off the list again.`,
  saveUndone: (name) => `${quoted(name)} is back as it was.`,
  removeUndone: (name) => `${quoted(name)} is back on the list.`,
  askRemove: (name) => `Remove ${name ? `"${name}"` : "this plan"}?`,
};

/**
 * What the form saves, or why not: deferredFrom(values, { year, kept }) -> { entry } | { error: box, words }.
 * Nothing in it and nothing going in is refused at "What is in it now"; a last year before this one at its box, unless it is
 * the one saved before (`kept`: a plan saved in 2026 with 2026 as its last year saves again in 2027 as it is); the parts
 * between 1 and 30 (the box's own limits); growth between -10% and 15%.
 */
export function deferredFrom(v, { year, kept = null }) {
  const balance = num(v.balance), yearly = num(v.yearly);
  if (!((balance ?? 0) > 0) && !((yearly ?? 0) > 0)) return { error: "balance", words: "Type what is in it now, or what you put in each year." };
  const untilYear = num(v.untilYear);
  if (untilYear !== null && (!Number.isInteger(untilYear) || (untilYear < year && untilYear !== num(kept)))) return { error: "untilYear", words: `Type ${year} or later, or leave it empty.` };
  const years = num(v.years);
  if (years !== null && (!Number.isInteger(years) || years < 1 || years > DEFERRED_MAX_YEARS)) return { error: "years", words: `Type a whole number of years from 1 to ${DEFERRED_MAX_YEARS}.` };
  const growth = num(v.growth);
  if (growth !== null && (growth < DEFERRED_GROWTH.min || growth > DEFERRED_GROWTH.max)) return { error: "growth", words: "Type a rate from -10% to 15%, or leave it empty." };
  const start = String(v.startYear ?? "");
  const entry = { name: String(v.name ?? "").trim(), balance: balance ?? 0, yearly: yearly ?? 0, untilYear, years: years ?? 1, startYear: start === "" || start === "leave" ? null : Number(start), growth };
  if (v.personId) entry.personId = v.personId;
  return { entry };
}
