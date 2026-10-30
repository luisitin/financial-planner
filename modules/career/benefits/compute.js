// modules/career/benefits/compute.js -- PURE. Open enrollment for one earner: the 401(k) percentage that gets the whole
// match and the one that reaches the year's limit, what each costs in take-home pay a paycheck, and the match left
// behind now; the health savings account's room after the employer's money; the health and child care flexible
// spending accounts and commuter benefits with the tax each saves; the employer stock purchase plan's discount after
// tax; and the tax on life cover through work above $50,000. The limits are the plan year's (next year from October).
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { LIMITS } from "../../retirement/contributions/data/limits.js";
import { BENEFITS, GROUP_LIFE, ESPP } from "./data/benefits.js";
import { federalTax } from "../../../core/math/tax.js";
import { perYear } from "../../../core/math/periods.js";
import { ageOn } from "../../../core/math/dates.js";

export const PAYROLL = { ss: 0.062, medicare: 0.0145 };
/** States whose income tax does not exempt HSA contributions (California, New Jersey). */
export const HSA_TAXED_STATES = ["CA", "NJ"];
/** States whose income tax does not exempt 401(k) deferrals (Pennsylvania taxes them as pay; PA Department of Revenue, Personal Income Tax Guide, Compensation). */
export const K401_TAXED_STATES = ["PA"];
/** The match the page assumes until you type yours: 50 cents a dollar on the first 6% of pay, the most common formula (Vanguard, How America Saves 2026). */
export const DEFAULT_TIERS = [{ rate: 0.5, upTo: 0.06 }];
/** Paychecks a year by pay period; anything else (a yearly or quarterly figure) assumes 26. */
export const PAYCHECKS = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };
export const DEFAULTS = { paychecks: 26, esppDiscount: 0.15, esppLookback: true, lifeAge: 40, enrollFromMonth: 10 };

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const pos = (v) => Math.max(0, num(v) ?? 0);
const yearTable = (T, year) => T[year] ?? T[Math.max(...Object.keys(T).map(Number).filter((y) => y <= year))] ?? T[Math.min(...Object.keys(T).map(Number))];
const latestYear = (T, year) => (T[year] ? year : Math.max(...Object.keys(T).map(Number).filter((y) => y <= year)));

/** The match as a share of pay for putting in `pct` of pay: tiers [{ rate, upTo }], each `upTo` the top of its band (cumulative share of pay). */
export function matchAt(pct, tiers) {
  let prev = 0, m = 0;
  for (const t of [...(tiers ?? [])].filter((x) => x.upTo > 0).sort((a, b) => a.upTo - b.upTo)) {
    m += Math.max(0, Math.min(pct, t.upTo) - prev) * (t.rate || 0);
    prev = Math.max(prev, t.upTo);
  }
  return m;
}
/** The least you put in (share of pay) to get the whole match; 0 when there is no match. */
export const fullMatchAt = (tiers) => Math.max(0, ...(tiers ?? []).filter((t) => t.rate > 0).map((t) => t.upTo || 0));
/**
 * The employer's match in dollars for putting in `yearly`: figured as a share of pay counted only up to the
 * compensation limit (IRC 401(a)(17)), what you put in being at most the deferral limit.
 */
export function matchDollars(yearly, pay, tiers, { compLimit = Infinity, limit = Infinity } = {}) {
  const payC = Math.min(pay, compLimit);
  if (!(payC > 0)) return 0;
  return matchAt(Math.min(yearly, limit) / payC, tiers) * payC;
}

/** The 401(k) limit for the age reached in the plan year: the base, plus the catch-up from 50, or the larger one from 60 to 63. */
export function limit401k(L, age) {
  const k = L["401k"];
  if (age === null || !Number.isFinite(age) || age < k.catchUpAge) return { limit: k.limit, catchUp: 0 };
  const catchUp = k.superCatchUp && age >= k.superCatchUp.from && age <= k.superCatchUp.to ? k.superCatchUp.amount : k.catchUp;
  return { limit: k.limit + catchUp, catchUp };
}
/** Group-term life: the yearly cost that is taxable pay for cover above $50,000 (Table I by age; 40 when unknown), less what the employee pays. */
export function groupLifeImputed(cover, age, paid = 0) {
  const a = Number.isFinite(age) ? age : DEFAULTS.lifeAge;
  const rate = GROUP_LIFE.table.find(([under]) => a < under)[1];
  return Math.max(0, Math.max(0, cover - GROUP_LIFE.free) / 1000 * rate * 12 - paid);
}

/**
 * The tax a pre-tax payroll deduction of `amount` saves. Federal: the household's income tax with wages lowered by it
 * (the 0.9% extra Medicare tax is not counted: it is worked on Medicare wages). Payroll (`fica`): Social Security on
 * the part under the wage base and Medicare 1.45%, when it comes out of the paycheck before payroll tax (not a
 * 401(k), IRC 3121(v)(1)(A)). State: its rate unless `state` is false (a state that taxes it).
 */
export function taxSaved(amount, { inputs, params, personPay, wageBase, stateRate, fica = true, state = true }) {
  if (!(amount > 0)) return { federal: 0, payroll: 0, state: 0, total: 0 };
  const a = federalTax(inputs, params), b = federalTax({ ...inputs, wages: Math.max(0, (Number(inputs.wages) || 0) - amount) }, params);
  const federal = (a.totalTax - a.additionalMedicare) - (b.totalTax - b.additionalMedicare);
  const ssPart = Math.max(0, Math.min(personPay, wageBase) - Math.min(Math.max(0, personPay - amount), wageBase));
  const payroll = fica ? ssPart * PAYROLL.ss + amount * PAYROLL.medicare : 0;
  const st = state ? amount * (stateRate || 0) : 0;
  return { federal, payroll, state: st, total: federal + payroll + st };
}

/**
 * compute(plan, { today }) -> {
 *   ready, why ("no-pay"|"no-person"), year, planYear, limitsYear, person: { id, name, age }, people (adults with pay), pay, paychecks, settings, notes,
 *   k401: { tiers, tiersAssumed, nowPct, nowYearly, nowMatch, nowMatchPlan, fullPct, fullMatch, leftBehind, limit, baseLimit, catchUp, maxPct, hasAccount,
 *     options: [{ key: "now"|"match"|"max", pct, yearly, perCheck, match, roth, cost, costPerCheck, saved }], rothCatchUp, rothCatchUpWages, stateTaxed },
 *   hsa: { eligible, coverage, limit, employer, room, typed, elect, saved, maxSaved, stateTaxed } | null,
 *   fsa: { limit, typed, elect, saved, carryover, withHsa }, dependentCare: { kids, limit, others, typed, elect, saved },
 *   commuter: { typed, transit, parking, limit, parkingLimit, saved },
 *   espp: { offered, pct, discount, lookback, yearly, perCheck, cap, capped, gain, taxOnGain, afterTax } | null,
 *   life: { cover, imputed, tax, ageKnown } | null,
 *   total: { pretaxYearly, savedYearly (worked together, the 401(k) first), perCheck (taken from each paycheck after the tax saved, with the stock plan's) }
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
  const all = plan.whatIfs?.benefits ?? {};
  const people = plan.household?.people ?? [];
  const adults = people.filter((p) => p.role !== "dependent");
  const inc = computeIncome(plan, { today });
  const salaryOf = (id) => inc.active.filter((x) => x.personId === id && x.type === "salary" && x.period !== "once");
  const withPay = adults.filter((p) => salaryOf(p.id).reduce((t, x) => t + x.yearly, 0) > 0);
  const chosen = adults.find((p) => p.id === all.personId);
  const person = (chosen && withPay.includes(chosen) ? chosen : null) ?? withPay.find((p) => p.role === "self") ?? withPay[0] ?? null;
  if (!person) {
    const unlinked = inc.active.some((x) => x.type === "salary" && !x.personId && x.yearly > 0);
    return { ready: false, why: unlinked ? "no-person" : "no-pay", year, person: null, people: [] };
  }
  const s = all[person.id] ?? {};
  // open enrollment in the autumn picks next year's benefits
  const planYear = num(s.planYear) ?? (month >= DEFAULTS.enrollFromMonth ? year + 1 : year);
  const limitsYear = latestYear(LIMITS, planYear);
  const birthYear = /^\d{4}-\d{2}-\d{2}$/.test(String(person.birthDate ?? "")) ? Number(person.birthDate.slice(0, 4)) : null;
  const age = birthYear !== null ? planYear - birthYear : null;   // the age reached in the plan year (the catch-up rules)
  const salaries = salaryOf(person.id);
  const bonus = inc.active.filter((x) => x.personId === person.id && x.type === "bonus" && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
  const pay = num(s.pay) ?? salaries.reduce((t, x) => t + x.yearly, 0) + bonus;
  const notes = [];
  const fromPeriod = PAYCHECKS[salaries[0].period];
  const paychecks = num(s.paychecks) ?? fromPeriod ?? DEFAULTS.paychecks;
  if (num(s.paychecks) === null && !fromPeriod) notes.push(`Your pay is entered as a ${salaries[0].period === "annual" ? "yearly" : "quarterly"} figure, so ${DEFAULTS.paychecks} paychecks a year are assumed: set yours under "Your employer's match".`);
  if (limitsYear !== planYear) notes.push(`The ${planYear} limits are not in the app yet, so ${limitsYear}'s are shown; the IRS publishes the next year's in the autumn.`);

  const ti = taxInputs(plan, { today });
  const st = computeState(plan, { today });
  const stateRate = st.rate ?? 0;
  const code = String(plan.household?.state ?? "").toUpperCase();
  if (st.rate === null) notes.push("Your state's income tax is not counted in the savings: set its rate on the State tax page.");
  const wageBase = maximumEarnings(year);
  const T = { inputs: ti.inputs, params: ti.params, personPay: pay, wageBase, stateRate };
  const L = yearTable(LIMITS, planYear).kinds;
  const B = yearTable(BENEFITS, planYear);

  // the 401(k)
  const accounts = plan.accounts ?? [];
  const mine = (plan.retirement?.contributions ?? []).filter((c) => c.personId === person.id && accounts.find((a) => a.id === c.accountId)?.type === "401k");
  const nowYearly = mine.reduce((t, c) => t + perYear(c.amount, c.period), 0);
  const nowMatchPlan = mine.reduce((t, c) => t + (Number(c.employerMatch) || 0), 0);
  const tiersAssumed = !Array.isArray(s.matchTiers);
  const tiers = tiersAssumed ? DEFAULT_TIERS : s.matchTiers.map((t) => ({ rate: pos(t.rate), upTo: pos(t.upTo) })).filter((t) => t.upTo > 0 && t.rate > 0);
  const lim = limit401k(L, age);
  const caps = { compLimit: B.compLimit, limit: lim.limit };
  const payC = Math.min(pay, B.compLimit);
  const nowPct = pay > 0 ? nowYearly / pay : 0;
  const fullYearly = Math.min(lim.limit, fullMatchAt(tiers) * payC);
  const fullPct = pay > 0 ? fullYearly / pay : 0;
  const maxPct = pay > 0 ? Math.min(1, lim.limit / pay) : 0;
  const stateTaxed401k = K401_TAXED_STATES.includes(code);
  const rothCatchUp = lim.catchUp > 0 && pay > B.rothCatchUpWages;
  // what a choice costs: the plan's wages already have today's 401(k) taken off; compare each choice with no 401(k)
  const base = { ...T, inputs: { ...ti.inputs, wages: (Number(ti.inputs.wages) || 0) + nowYearly } };
  const option = (key, pct) => {
    const yearly = Math.min(lim.limit, pct * pay);
    const roth = rothCatchUp ? Math.max(0, yearly - L["401k"].limit) : 0;   // the catch-up part goes in after tax
    const saved = taxSaved(yearly - roth, { ...base, fica: false, state: !stateTaxed401k });
    const cost = yearly - saved.total;
    return { key, pct, yearly, perCheck: yearly / paychecks, match: matchDollars(yearly, pay, tiers, caps), roth, cost, costPerCheck: cost / paychecks, saved: saved.total };
  };
  const options = [];
  if (nowYearly > 0) options.push(option("now", nowPct));
  if (fullYearly > 0 && Math.abs(fullYearly - nowYearly) > 0.5) options.push(option("match", fullPct));
  if (lim.limit - Math.max(nowYearly, fullYearly) > 0.5) options.push(option("max", maxPct));
  options.sort((a, b) => a.pct - b.pct);
  const nowMatch = matchDollars(nowYearly, pay, tiers, caps), fullMatch = matchDollars(fullYearly, pay, tiers, caps);
  const k401 = {
    tiers, tiersAssumed, nowPct, nowYearly, nowMatch, nowMatchPlan, fullPct, fullMatch, leftBehind: Math.max(0, fullMatch - nowMatch),
    limit: lim.limit, baseLimit: L["401k"].limit, catchUp: lim.catchUp, maxPct, options, hasAccount: mine.length > 0,
    // from 2026 the catch-up of someone paid over the line by the employer the year before goes in as Roth (IRC 414(v)(7); final rules from 2027)
    rothCatchUp, rothCatchUpWages: B.rothCatchUpWages, stateTaxed: stateTaxed401k, compLimit: B.compLimit, overCompLimit: pay > B.compLimit,
  };

  // the cafeteria-plan choices (through the paycheck: no income tax, no Social Security or Medicare)
  const hs = plan.taxes?.hsa ?? {};
  const eligible = s.hsaEligible ?? (Number(hs.contribution) > 0 || Number(hs.employer) > 0);
  const hsaBase = { ...T, inputs: { ...ti.inputs, adjustments: Math.max(0, (Number(ti.inputs.adjustments) || 0) - pos(hs.contribution)) } };
  let hsa = null;
  if (eligible) {
    const coverage = (s.hsaCoverage ?? hs.coverage) === "family" ? "family" : "self";
    const limit = (coverage === "family" ? L.hsa.family : L.hsa.limit) + (age !== null && age >= L.hsa.catchUpAge ? L.hsa.catchUp : 0);
    const employer = num(s.hsaEmployer) ?? pos(hs.employer);
    const room = Math.max(0, limit - employer);
    const typed = num(s.hsaElect) ?? pos(hs.contribution);
    const elect = Math.min(room, typed);
    const stateTaxed = HSA_TAXED_STATES.includes(code);
    hsa = { eligible: true, coverage, limit, employer, room, typed, elect, saved: taxSaved(elect, { ...hsaBase, state: !stateTaxed }).total, stateTaxed, maxSaved: taxSaved(room, { ...hsaBase, state: !stateTaxed }).total };
  }
  const fsaTyped = num(s.fsaElect) ?? pos(hs.fsa);
  const fsaElect = Math.min(L.fsa.limit, fsaTyped);
  const fsa = { limit: L.fsa.limit, typed: fsaTyped, carryover: L.fsa.carryover, elect: fsaElect, saved: taxSaved(fsaElect, T).total, withHsa: !!hsa && fsaElect > 0 };
  // child care: a household limit, shared with the other adults' elections
  const kids = people.filter((p) => p.role === "dependent" && p.birthDate && (ageOn(p.birthDate, today) ?? 99) < B.dependentCare.childUnder);
  const dcLimit = ti.filingStatus === "married_separate" ? B.dependentCare.separate : B.dependentCare.limit;
  const others = adults.filter((p) => p.id !== person.id).reduce((t, p) => t + pos(all[p.id]?.dcfsaElect), 0);
  const dcTyped = pos(s.dcfsaElect);
  const dcElect = Math.min(Math.max(0, dcLimit - others), dcTyped);
  const dependentCare = { kids: kids.map((k) => k.name), limit: dcLimit, others, typed: dcTyped, elect: dcElect, saved: taxSaved(dcElect, T).total };
  const transitTyped = pos(s.transitMonthly), parkingTyped = pos(s.parkingMonthly);
  const transit = Math.min(B.commuter.transitMonthly, transitTyped), parking = Math.min(B.commuter.parkingMonthly, parkingTyped);
  const commuter = { typed: { transit: transitTyped, parking: parkingTyped }, transit, parking, limit: B.commuter.transitMonthly, parkingLimit: B.commuter.parkingMonthly, saved: taxSaved((transit + parking) * 12, T).total };

  // the employer stock purchase plan: buying at a discount; sold at once, the discount is pay (no Social Security or Medicare)
  let espp = null;
  if (s.esppOffered) {
    const discount = Math.min(ESPP.maxDiscount, num(s.esppDiscount) ?? DEFAULTS.esppDiscount);
    const pct = pos(s.esppPct);
    const cap = ESPP.yearlyStock * (1 - discount);   // the most that buys $25,000 of stock at the offering price, prices flat
    const yearly = Math.min(pct * pay, cap);
    const gain = yearly * (1 / (1 - discount) - 1);
    const fed = federalTax({ ...ti.inputs, otherOrdinary: (Number(ti.inputs.otherOrdinary) || 0) + gain }, ti.params).totalTax - federalTax(ti.inputs, ti.params).totalTax;
    const taxOnGain = fed + gain * stateRate;
    espp = { offered: true, pct, discount, lookback: s.esppLookback ?? DEFAULTS.esppLookback, yearly, perCheck: yearly / paychecks, cap, capped: pct * pay > cap, gain, taxOnGain, afterTax: gain - taxOnGain };
  }

  // life cover through work above $50,000: taxable pay, with Social Security only under the wage base
  let life = null;
  const cover = pos(s.lifeCover);
  if (cover > GROUP_LIFE.free) {
    const imputed = groupLifeImputed(cover, age, pos(s.lifePaid));
    const a = federalTax(ti.inputs, ti.params), b = federalTax({ ...ti.inputs, wages: (Number(ti.inputs.wages) || 0) + imputed }, ti.params);
    const ss = PAYROLL.ss * Math.max(0, Math.min(pay + imputed, wageBase) - Math.min(pay, wageBase));
    life = { cover, imputed, tax: (b.totalTax - b.additionalMedicare) - (a.totalTax - a.additionalMedicare) + ss + imputed * (PAYROLL.medicare + stateRate), ageKnown: age !== null };
  }

  // the paycheck: the 401(k) now first, then the cafeteria-plan choices together on the wages it leaves
  const k = options.find((o) => o.key === "now");
  const cafeteria = (hsa?.elect ?? 0) + fsaElect + dcElect + (transit + parking) * 12;
  const afterK = { ...hsaBase, inputs: { ...hsaBase.inputs, wages: Math.max(0, (Number(ti.inputs.wages) || 0) + nowYearly - (k ? k.yearly - k.roth : 0)) } };
  const together = taxSaved(cafeteria, { ...afterK, state: false });
  const cafeteriaState = (cafeteria - (hsa?.stateTaxed ? hsa.elect : 0)) * stateRate;
  const pretaxYearly = (k?.yearly ?? 0) + cafeteria;
  const savedYearly = (k?.saved ?? 0) + together.total + cafeteriaState;
  return {
    ready: true, year, planYear, limitsYear, person: { id: person.id, name: person.name, age }, people: withPay.map((p) => ({ id: p.id, name: p.name })),
    pay, paychecks, settings: s, notes,
    k401, hsa, fsa, dependentCare, commuter, espp, life,
    total: { pretaxYearly, savedYearly, perCheck: (pretaxYearly - savedYearly + (espp?.yearly ?? 0)) / paychecks, any: pretaxYearly + (espp?.yearly ?? 0) > 0 },
  };
}
