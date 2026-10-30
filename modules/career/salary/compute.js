// modules/career/salary/compute.js -- PURE. Each job's pay from now until its holder retires: a raise every year, a
// promotion every few years, and (if set) the age after which pay only keeps up with prices; in dollars of each year
// and in today's money. With it: what the next raise keeps after tax, the pay still to come before retiring, what one
// more percent a year or a raise won now is worth over the career, and the average growth to put on the Income page.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { ageOn } from "../../../core/math/dates.js";
import { BENCHMARKS } from "./data/benchmarks.js";

/** The settings of one job (`whatIfs.salary[incomeId]`); raise null = the Income page's raise, else Assumptions'. */
export const DEFAULTS = { raise: null, promoEvery: 0, promoBump: BENCHMARKS.promotion.value, levelAge: null };
/** The employee's Social Security (up to the year's wage base) and Medicare tax on pay (IRC 3101). */
export const PAYROLL = { ss: 0.062, medicare: 0.0145 };
/** The extra Medicare tax on wages above $200,000 ($250,000 married filing jointly, $125,000 separately), IRC 3101(b)(2). */
export const ADDITIONAL_MEDICARE = 0.009;
/** Years shown for someone with no birth date (so no retirement year). */
export const HORIZON = 25;
/** The raise used to show what winning a raise now is worth. */
export const RAISE_NOW = 0.05;

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const parts = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "")); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
/** Where a date falls in its year, 0 (1 January) to just under 1. */
export function yearFraction(iso) {
  const p = parts(iso); if (!p) return 0;
  const dim = new Date(p.y, p.m, 0).getDate();
  return (p.m - 1 + (p.d - 1) / dim) / 12;
}

/**
 * The pay year by year. `from` and `to` are positions on the calendar (year + fraction of it): from = today, to = the
 * retirement birthday. Each calendar year after this one starts with a raise (`raise`; from the year the holder reaches
 * `levelAge`, the smaller of it and `inflation`), and every `promoEvery` years a promotion adds `promoBump` on top while
 * raises still run.
 * Row: { year, age (reached that year), pay (the yearly rate), real (in today's money), weight (share of the year still
 * worked), growth (that year's raise), promoted }.
 */
export function payPath({ pay, from, to, raise, inflation, promoEvery = 0, promoBump = 0, levelAge = null, birthYear = null }) {
  const rows = [];
  const first = Math.floor(from);
  let p = pay;
  for (let year = first; year < to && year < first + 80; year++) {
    const t = year - first;
    const age = birthYear === null ? null : year - birthYear;
    const growing = levelAge === null || age === null || age < levelAge;
    let growth = 0, promoted = false;
    if (t > 0) {
      growth = growing ? raise : Math.min(raise, inflation);
      promoted = growing && promoEvery > 0 && t % promoEvery === 0;
      p = p * (1 + growth) * (promoted ? 1 + promoBump : 1);
    }
    const weight = Math.max(0, Math.min(year + 1, to) - Math.max(year, from));
    if (weight <= 0) continue;
    rows.push({ year, age, pay: p, real: p / Math.pow(1 + inflation, t), weight, growth, promoted });
  }
  return rows;
}
/** The pay still to come along a path: each year's pay times the share of it still worked, in dollars of each year and in today's money. */
export const lifetime = (rows) => ({ nominal: rows.reduce((s, r) => s + r.pay * r.weight, 0), real: rows.reduce((s, r) => s + r.real * r.weight, 0) });

/**
 * What a raise of `amount` a year keeps after tax: the household's federal income tax with the higher wages less the
 * tax without (the engine's own 0.9% extra Medicare tax is taken out of it, because the engine sees wages after pre-tax
 * 401(k) saving); Social Security on the part still under the wage base after the holder's other pay; Medicare 1.45%,
 * plus 0.9% on the part of the household's Medicare wages (pay before 401(k) saving, IRC 3121(v)(1)(A)) above the
 * filing status's threshold (IRC 3101(b)(2)); and the state's rate when one is known.
 */
export function keepOfRaise(amount, { inputs, params, personWages = 0, wageBase = Infinity, stateRate = 0, medicareWages = null }) {
  if (!(amount > 0)) return { amount: 0, federal: 0, payroll: 0, extraMedicare: 0, state: 0, keep: 0, share: null };
  const before = federalTax(inputs, params), after = federalTax({ ...inputs, wages: (Number(inputs.wages) || 0) + amount }, params);
  const federal = (after.totalTax - after.additionalMedicare) - (before.totalTax - before.additionalMedicare);
  const med = medicareWages ?? (Number(inputs.wages) || 0);
  const th = params.additionalMedicareThreshold?.[inputs.filingStatus] ?? 200000;
  const extraMedicare = ADDITIONAL_MEDICARE * (Math.max(0, med + amount - th) - Math.max(0, med - th));
  const ssPart = Math.max(0, Math.min(personWages + amount, wageBase) - Math.min(personWages, wageBase));
  const payroll = ssPart * PAYROLL.ss + amount * PAYROLL.medicare + extraMedicare;
  const state = amount * (stateRate || 0);
  const keep = amount - federal - payroll - state;
  return { amount, federal, payroll, extraMedicare, state, keep, share: keep / amount };
}

/** "Use it on the Income page": that income rises at the path's average from now on, and this page keeps its own raise
 * (typed in), so the promotions are not counted a second time on top of the new figure. Changes `draft` in place. */
export function useAverage(draft, job) {
  const x = (draft.income ?? []).find((y) => y.id === job.incomeId);
  if (!x) return false;
  x.growth = Math.round(job.avgGrowth * 1000) / 1000;
  draft.whatIfs = draft.whatIfs ?? {}; draft.whatIfs.salary = draft.whatIfs.salary ?? {};
  draft.whatIfs.salary[job.incomeId] = { ...DEFAULTS, ...(draft.whatIfs.salary[job.incomeId] ?? {}), raise: job.settings.raise, promoEvery: job.settings.promoEvery, promoBump: job.settings.promoBump, levelAge: job.settings.levelAge };
  return true;
}

/**
 * compute(plan, { today }) -> {
 *   ready, year, inflation, jobs: [{ incomeId, name, personId, personName, pay, ageNow, retireAge, retireYear, knownAge,
 *     settings: { raise, promoEvery, promoBump, levelAge }, raiseFrom ("typed"|"income"|"assumptions"), incomeGrowth,
 *     rows, atEnd: { year, age, pay, real }, lifetime: { nominal, real }, avgGrowth, realGrowth, realRaise,
 *     endsEarly (the income's end date, when before retirement), extraPercent (lifetime in today's money from one more percent
 *     a year), raiseNowWorth, nextRaise (keepOfRaise of next year's rise along the path, with its rate and promoted) }],
 *   total: { pay, lifetimeReal, lifetimeNominal }, state: { rate, method, name }, benchmarks, warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const year = Number(today.slice(0, 4));
  const a = plan.assumptions ?? {};
  const inflation = num(a.inflation) ?? 0.03;
  const assumedRaise = num(a.salaryGrowth) ?? 0.03;
  const people = plan.household?.people ?? [];
  const inc = computeIncome(plan, { today });
  const salaries = inc.active.filter((x) => x.type === "salary" && x.period !== "once" && x.yearly > 0);
  const warnings = [];
  if (!salaries.length) return { ready: false, year, inflation, jobs: [], total: { pay: 0, lifetimeReal: 0, lifetimeNominal: 0 }, state: null, benchmarks: BENCHMARKS, warnings };
  const tax = taxInputs(plan, { today });
  const st = computeState(plan, { today });
  const stateRate = st.rate ?? 0;
  const wageBase = maximumEarnings(year);
  const saved = plan.whatIfs?.salary ?? {};
  const from = year + yearFraction(today);
  const jobs = salaries.map((x) => {
    const person = people.find((p) => p.id === x.personId) ?? (people.length === 1 ? people[0] : null);
    const birth = parts(person?.birthDate);
    const knownAge = !!birth;
    const retireAge = num(person?.retirementAge) ?? num(a.retirementAge) ?? 65;
    const ageNow = knownAge ? ageOn(person.birthDate, today) : null;
    const retireYear = knownAge ? birth.y + retireAge : null;
    const retireAt = knownAge ? retireYear + yearFraction(person.birthDate) : from + HORIZON;
    const ends = parts(x.endDate);
    const endAt = ends ? ends.y + yearFraction(x.endDate) : null;
    const to = endAt !== null && endAt < retireAt ? endAt : retireAt;
    const s = saved[x.id] ?? {};
    const incomeGrowth = Number(x.growth) || 0;
    const typedRaise = num(s.raise);
    const raise = typedRaise ?? (incomeGrowth > 0 ? incomeGrowth : assumedRaise);
    const raiseFrom = typedRaise !== null ? "typed" : incomeGrowth > 0 ? "income" : "assumptions";
    const settings = { raise, promoEvery: Math.max(0, Math.round(num(s.promoEvery) ?? DEFAULTS.promoEvery)), promoBump: num(s.promoBump) ?? DEFAULTS.promoBump, levelAge: num(s.levelAge) };
    const base = { pay: x.yearly, from, to, inflation, birthYear: knownAge ? birth.y : null, ...settings };
    const rows = payPath(base);
    const life = lifetime(rows);
    const last = rows.at(-1) ?? null;
    const n = last ? last.year - year : 0;
    const avgGrowth = n > 0 ? Math.pow(last.pay / x.yearly, 1 / n) - 1 : raise;
    const extraPercent = lifetime(payPath({ ...base, raise: raise + 0.01 })).real - life.real;
    const personWages = inc.active.filter((y) => y.personId === x.personId && ["salary", "bonus"].includes(y.type)).reduce((t, y) => t + y.yearly, 0);
    const medicareWages = inc.active.filter((y) => ["salary", "bonus"].includes(y.type) && y.taxable !== false).reduce((t, y) => t + y.yearly, 0);
    // the next raise as the path has it (a promotion next year, or a level-off age already reached, changes it)
    const nextAmount = rows.length > 1 ? rows[1].pay - rows[0].pay : 0;
    const nextRaise = { ...keepOfRaise(nextAmount, { inputs: tax.inputs, params: tax.params, personWages, wageBase, stateRate, medicareWages }), rate: rows.length > 1 ? rows[1].pay / rows[0].pay - 1 : null, promoted: !!rows[1]?.promoted };
    const name = person?.name ?? "";
    const realGrowth = (1 + avgGrowth) / (1 + inflation) - 1;
    if (realGrowth < -1e-9) warnings.push(`${x.name || "A salary"} rises less than prices (${(inflation * 100).toFixed(1)}% a year): in today's money it shrinks over the years.`);
    if (!person) warnings.push(`${x.name || "A salary"} is not linked to anyone on the Income page, so it is shown for ${HORIZON} years instead of to a retirement birthday.`);
    else if (!knownAge) warnings.push(`${name || "Someone"} has no birth date on People, so ${x.name || "this pay"} is shown for ${HORIZON} years instead of to retirement${settings.levelAge ? ", and the age pay stops growing cannot be used" : ""}.`);
    return {
      incomeId: x.id, name: x.name || "Pay", personId: x.personId ?? "", personName: name || "", pay: x.yearly, ageNow, retireAge, retireYear, knownAge,
      settings, raiseFrom, incomeGrowth, rows,
      atEnd: last ? { year: last.year, age: last.age, pay: last.pay, real: last.real } : null,
      endsEarly: endAt !== null && endAt < retireAt ? x.endDate : null,
      lifetime: life, avgGrowth, realGrowth, realRaise: (1 + raise) / (1 + inflation) - 1,
      extraPercent, raiseNowWorth: life.real * RAISE_NOW, nextRaise,
    };
  });
  return {
    ready: true, year, inflation, jobs,
    total: { pay: jobs.reduce((t, j) => t + j.pay, 0), lifetimeReal: jobs.reduce((t, j) => t + j.lifetime.real, 0), lifetimeNominal: jobs.reduce((t, j) => t + j.lifetime.nominal, 0) },
    state: { rate: st.rate, method: st.method, name: st.name },
    benchmarks: BENCHMARKS, warnings,
  };
}
