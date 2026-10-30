// modules/career/offer-compare/compute.js -- PURE. The job you have against up to three offers, on everything they pay:
// salary, bonus, a sign-on bonus, stock, the employer's retirement match and health-account money, other benefits, less
// the health premiums you pay; then after the household's tax (the job's pay swapped into the federal estimate, Social
// Security and Medicare, the state's rate), less commuting, per hour of your time, and over the years you compare.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { FEDERAL } from "../../taxes/federal/data/federal.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { compute as computeEquity } from "../../investments/employer-stock/compute.js";
import { LIMITS } from "../../retirement/contributions/data/limits.js";
import { benefitsFor } from "../benefits/data/benefits.js";
import { federalTax, paramsFor } from "../../../core/math/tax.js";
import { addMonths } from "../../../core/math/dates.js";

export const MAX_OFFERS = 3;
/** Employee Social Security (to the wage base) and Medicare on pay (IRC 3101); health premiums paid through a cafeteria plan are free of both (IRC 125, 3121(a)(5)(G)). */
export const PAYROLL = { ss: 0.062, medicare: 0.0145, extraMedicare: 0.009 };
/**
 * Starting values a blank field falls back to (offers take the job now's). Days off: the private-industry average after a
 * year of service, 11 paid vacation days (BLS National Compensation Survey, March 2026) and 8 paid holidays (2025);
 * hours and office days are plain examples, said so on the form.
 */
export const DEFAULTS = { years: 4, hoursWeek: 40, ptoDays: 19, officeDays: 5 };

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const pos = (v) => Math.max(0, num(v) ?? 0);
const latest = (T, year) => T[year] ?? T[Math.max(...Object.keys(T).map(Number).filter((y) => y <= year))] ?? T[Math.min(...Object.keys(T).map(Number))];

/**
 * The employer's retirement money a year: typed as an amount, else match rate x what you put in up to the cap, where
 * the cap is the share of pay counted only up to the compensation limit (IRC 401(a)(17)) and what you can put in at
 * most the year's deferral limit (IRC 402(g)). You are assumed to put in at least the cap.
 */
export function matchFor(o, { compLimit = Infinity, deferralLimit = Infinity } = {}) {
  if (num(o.matchYearly) !== null) return pos(o.matchYearly);
  return pos(o.matchRate) * Math.min(pos(o.matchUpTo) * Math.min(pos(o.salary), compLimit), deferralLimit);
}
/** The time a job takes a year: weeks worked = 52 - days off / 5; hours at work and on the road. */
export function timeFor(o) {
  const weeks = Math.max(0, 52 - pos(o.ptoDays) / 5);
  const work = pos(o.hoursWeek) * weeks;
  const days = Math.min(7, pos(o.officeDays)) * weeks;
  return { weeks, work, commuteHours: days * 2 * pos(o.commuteMinutes) / 60, commuteCost: days * pos(o.commuteCost), commuteDays: days };
}

/**
 * One year of the household's tax with this job's `pay` (salary, bonus, stock, sign-on, less premiums paid before tax)
 * in it. Federal: the household's income tax on `otherWages` + pay (`federalTax` without its own 0.9% extra Medicare
 * tax, which it works on wages after 401(k) saving). Payroll: Social Security to the wage base, Medicare 1.45%, and
 * the household's 0.9% on Medicare wages (pay before 401(k) saving: `otherMedicare` + pay) above the filing status's
 * threshold (IRC 3101(b)(2)). State: the job's state rate on its pay.
 */
export function taxYear(pay, { inputs, params, otherWages, otherMedicare = otherWages, wageBase, stateRate }) {
  const wages = Math.max(0, pay);
  const f = federalTax({ ...inputs, wages: Math.max(0, otherWages + wages) }, params);
  const th = params.additionalMedicareThreshold?.[inputs.filingStatus] ?? 200000;
  const extraMedicare = PAYROLL.extraMedicare * Math.max(0, otherMedicare + wages - th);
  const payroll = Math.min(wages, wageBase) * PAYROLL.ss + wages * PAYROLL.medicare + extraMedicare;
  const state = wages * (stateRate || 0);
  return { federal: f.totalTax - f.additionalMedicare, payroll, extraMedicare, state };
}

/**
 * compute(plan, { today }) -> {
 *   ready, person: { id, name }, years, hasJob, options: [job now, ...offers], each:
 *   { id, name, current, inputs, yearly: { salary, bonus, stock, match, hsa, other, premium, total }, signOn, moving,
 *     tax: { federal, payroll, state, total } (year one, with the sign-on), afterTax (year one, before the commute),
 *     steadyAfterTax (a year without the one-offs), time, perHour, overYears: { gross, afterTax, commute, net },
 *     stockYears, stockShare, ifStockHalves (net over the years with the share price halved), rows, rank, vsCurrent },
 *   best (id), runnerUp (id), forfeit (unvested stock at the current employer, today's price), stateNow, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const year = Number(today.slice(0, 4));
  const s = plan.whatIfs?.offers ?? {};
  const people = plan.household?.people ?? [];
  const adults = people.filter((p) => p.role !== "dependent");
  const inc = computeIncome(plan, { today });
  const jobOf = (id) => inc.active.filter((x) => x.personId === id && x.period !== "once");
  const withPay = adults.filter((p) => jobOf(p.id).some((x) => x.type === "salary"));
  const person = adults.find((p) => p.id === s.personId) ?? withPay.find((p) => p.role === "self") ?? withPay[0] ?? adults[0] ?? null;
  const pid = person?.id ?? "";
  const mine = person ? jobOf(pid) : inc.active.filter((x) => !x.personId);
  const planSalary = mine.filter((x) => x.type === "salary").reduce((t, x) => t + x.yearly, 0);
  const planBonus = mine.filter((x) => x.type === "bonus").reduce((t, x) => t + x.yearly, 0);
  const growth = mine.find((x) => x.type === "salary" && Number(x.growth) > 0)?.growth ?? num(plan.assumptions?.salaryGrowth) ?? 0.03;
  const years = Math.max(1, Math.min(10, Math.round(num(s.years) ?? DEFAULTS.years)));
  const inflation = num(plan.assumptions?.inflation) ?? 0.03;
  const notes = [];
  const cur = s.current ?? {};
  const hasJob = planSalary > 0 || pos(cur.salary) > 0;

  // the current employer's stock: what each grant vests in each 12-month stretch ahead at a price, and all still to vest
  const eq = plan.equity?.grants?.length && (!plan.equity.personId || plan.equity.personId === pid) ? computeEquity(plan, { today }) : null;
  const stockByYear = (factor) => {
    const out = Array.from({ length: years }, () => 0);
    if (!eq?.ready) return out;
    const price = eq.price * factor;
    for (const g of eq.grants) {
      const each = g.kind === "option" ? Math.max(0, price - (g.strike ?? 0)) : price;
      for (const e of g.schedule) for (let t = 0; t < years; t++) if (e.date > addMonths(today, 12 * t) && e.date <= addMonths(today, 12 * (t + 1))) out[t] += e.shares * each;
    }
    return out;
  };
  const forfeit = eq?.ready ? eq.grants.reduce((t, g) => t + g.unvested * (g.kind === "option" ? Math.max(0, eq.price - (g.strike ?? 0)) : eq.price), 0) : 0;
  const hasOptions = !!eq?.ready && eq.grants.some((g) => g.kind === "option");

  // the job now, from the plan where the plan knows it; without a job, nothing but what is typed
  const matchNow = (plan.retirement?.contributions ?? []).filter((c) => c.personId === pid).reduce((t, c) => t + (Number(c.employerMatch) || 0), 0);
  const hsaIsTheirs = person && (person.role === "self" || withPay.length <= 1);   // the plan's employer HSA money is one household figure
  const currentIn = {
    name: cur.name || (hasJob ? "Your job now" : "No job now"), salary: num(cur.salary) ?? planSalary, bonus: num(cur.bonus) ?? planBonus, signOn: 0,
    stockYearly: num(cur.stockYearly), matchRate: num(cur.matchRate), matchUpTo: num(cur.matchUpTo),
    matchYearly: num(cur.matchYearly) ?? (num(cur.matchRate) !== null ? null : hasJob ? matchNow : 0),
    hsaEmployer: num(cur.hsaEmployer) ?? (hasJob && hsaIsTheirs ? pos(plan.taxes?.hsa?.employer) : 0), premium: pos(cur.premium), otherYearly: pos(cur.otherYearly),
    ptoDays: num(cur.ptoDays) ?? DEFAULTS.ptoDays, hoursWeek: num(cur.hoursWeek) ?? (hasJob ? DEFAULTS.hoursWeek : 0),
    commuteMinutes: pos(cur.commuteMinutes), commuteCost: pos(cur.commuteCost), officeDays: num(cur.officeDays) ?? (hasJob ? DEFAULTS.officeDays : 0),
    raise: num(cur.raise) ?? growth, stateRate: num(cur.stateRate), movingCost: 0,
  };
  // an offer's blank days off, hours and raise are the job now's (or the examples, with no job now)
  const offersIn = (s.offers ?? []).slice(0, MAX_OFFERS).map((o, i) => ({
    id: o.id ?? `offer-${i}`, name: o.name || `Offer ${i + 1}`, salary: pos(o.salary), bonus: pos(o.bonus), signOn: pos(o.signOn),
    stockYearly: pos(o.stockYearly), matchRate: pos(o.matchRate), matchUpTo: pos(o.matchUpTo), matchYearly: num(o.matchYearly),
    hsaEmployer: pos(o.hsaEmployer), premium: pos(o.premium), otherYearly: pos(o.otherYearly),
    ptoDays: num(o.ptoDays) ?? currentIn.ptoDays, hoursWeek: num(o.hoursWeek) ?? (hasJob ? currentIn.hoursWeek : DEFAULTS.hoursWeek),
    commuteMinutes: pos(o.commuteMinutes), commuteCost: pos(o.commuteCost), officeDays: num(o.officeDays) ?? DEFAULTS.officeDays,
    raise: num(o.raise) ?? currentIn.raise, stateRate: num(o.stateRate), movingCost: pos(o.movingCost),
  }));
  if (!hasJob && !offersIn.length) return { ready: false, person: person ? { id: pid, name: person.name } : null, years, hasJob, options: [], notes };

  const ti = taxInputs(plan, { today });
  const st = computeState(plan, { today });
  const stateNow = st.rate ?? 0;
  if (st.rate === null) notes.push("Your state's income tax is not counted: set its rate on the State tax page, or type each job's state rate.");
  // the rest of the household's wages: the plan's wages (after everyone's pre-tax 401(k) saving, which stays as it is)
  // less this person's pay; and their Medicare wages (pay before 401(k) saving), for the 0.9% extra Medicare tax
  const otherWages = (Number(ti.inputs.wages) || 0) - planSalary - planBonus;
  const otherMedicare = inc.active.filter((x) => ["salary", "bonus"].includes(x.type) && x.taxable !== false && x.period !== "once").reduce((t, x) => t + x.yearly, 0) - planSalary - planBonus;
  // each year compared uses its own tax tables (indexed past the last published year) and wage base
  const yearTax = Array.from({ length: years }, (_, t) => {
    const P = t === 0 ? ti.params : paramsFor(FEDERAL, year + t, { inflation });
    const T = { inputs: ti.inputs, params: P, otherWages, otherMedicare, wageBase: maximumEarnings(year + t) };
    const base = taxYear(0, { ...T, stateRate: 0 });
    return { T, base, baseTotal: base.federal + base.extraMedicare };
  });
  const lim = latest(LIMITS, year).kinds["401k"].limit;
  const caps = { compLimit: benefitsFor(year).compLimit, deferralLimit: lim };

  const build = (o, current, factor = 1) => {
    const stateRate = o.stateRate ?? stateNow;
    const fromGrants = current && o.stockYearly === null;
    const grantYears = fromGrants ? stockByYear(factor) : null;
    const stockAt = (t) => (fromGrants ? grantYears[t] ?? 0 : factor * pos(o.stockYearly));
    const match = matchFor(o, caps);
    const yearly = { salary: o.salary, bonus: o.bonus, stock: stockAt(0), match, hsa: o.hsaEmployer, other: o.otherYearly, premium: o.premium };
    yearly.total = yearly.salary + yearly.bonus + yearly.stock + yearly.match + yearly.hsa + yearly.other - yearly.premium;
    const time = timeFor(o);
    // a year t (0 = the first): salary, bonus and match grow with the raise; the sign-on and the move land in year one
    const yearAt = (t, oneOffs = true) => {
      const g = Math.pow(1 + o.raise, t);
      const cash = (o.salary + o.bonus) * g, stock = stockAt(t), m = match * g;
      const signOn = oneOffs && t === 0 ? o.signOn : 0, moving = oneOffs && t === 0 ? o.movingCost : 0;
      const Y = yearTax[t];
      const tx = taxYear(cash + stock + signOn - o.premium, { ...Y.T, stateRate });
      const tax = tx.federal + tx.payroll + tx.state - Y.baseTotal;
      const gross = cash + stock + m + o.hsaEmployer + o.otherYearly - o.premium + signOn;
      return { gross, tax, tx, afterTax: gross - tax - moving };
    };
    const rows = Array.from({ length: years }, (_, t) => yearAt(t));
    const y1 = rows[0], steady = yearAt(0, false);
    const hours = time.work + time.commuteHours;
    const overYears = { gross: rows.reduce((t, r) => t + r.gross, 0), afterTax: rows.reduce((t, r) => t + r.afterTax, 0), commute: time.commuteCost * years };
    overYears.net = overYears.afterTax - overYears.commute;
    const stockYears = Array.from({ length: years }, (_, t) => stockAt(t)).reduce((a, b) => a + b, 0);
    const b0 = yearTax[0].base;
    return {
      id: current ? "current" : o.id, name: o.name, current, inputs: { ...o, stateRate }, yearly, signOn: o.signOn, moving: o.movingCost,
      tax: { federal: y1.tx.federal - b0.federal, payroll: y1.tx.payroll - b0.extraMedicare, state: y1.tx.state, total: y1.tax }, afterTax: y1.afterTax,
      steadyAfterTax: steady.afterTax, time, perHour: time.work > 0 ? (steady.afterTax - time.commuteCost) / hours : null,
      overYears, stockYears, stockShare: overYears.gross > 0 ? stockYears / overYears.gross : 0, rows,
    };
  };
  const options = [build(currentIn, true), ...offersIn.map((o) => build(o, false))];
  // if the stock halved: the same years at half the share price (options lose more than half: only the spread over the strike counts)
  options.forEach((o, i) => { o.ifStockHalves = build(i === 0 ? currentIn : offersIn[i - 1], i === 0, 0.5).overYears.net; });
  const ranked = [...options].sort((a, b) => b.overYears.net - a.overYears.net);
  ranked.forEach((o, i) => { o.rank = i + 1; o.vsCurrent = o.overYears.net - options[0].overYears.net; });
  if (hasOptions) notes.push("Stock options at your employer are counted at their value over the strike price as they vest, as if bought and taxed as pay then; incentive options are taxed differently (Equity compensation).");
  return { ready: true, person: person ? { id: pid, name: person.name } : null, years, hasJob, options, best: ranked[0].id, runnerUp: ranked[1]?.id ?? null, forfeit: offersIn.length ? forfeit : 0, stateNow, notes };
}
