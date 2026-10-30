// modules/retirement/social-security/compute.js -- PURE. The retirement benefit from a pasted
// ssa.gov earnings record, the way the Social Security Administration works it out: index each
// year's earnings to the wage level of the year you turn 60, average the best 35 years, apply
// the bend-point formula for the year you turn 62, then adjust for the age you claim. Tables
// come from ssa.tools (data/ssa.js). A typed "monthly at full retirement age" from a Social
// Security statement works instead of a record.
import { WAGE_INDICES, COLA, MAXIMUM_EARNINGS, EARNINGS_PER_CREDIT, EARNINGS_PER_CREDIT_BEFORE_1978, MAX_CREDITS, SSA_EARNINGS_YEARS, FULL_RETIREMENT_AGE, BENDPOINT1_IN_1977, BENDPOINT2_IN_1977, BEFORE_BENDPOINT1_MULTIPLIER, BEFORE_BENDPOINT2_MULTIPLIER, AFTER_BENDPOINT2_MULTIPLIER } from "./data/ssa.js";

const awiYears = Object.keys(WAGE_INDICES).map(Number);
export const LAST_AWI_YEAR = Math.max(...awiYears);
const awi = (year) => WAGE_INDICES[Math.min(year, LAST_AWI_YEAR)] ?? WAGE_INDICES[Math.max(Math.min(...awiYears), year)];
const LAST_MAX_YEAR = Math.max(...Object.keys(MAXIMUM_EARNINGS).map(Number));
/** The taxable maximum for a year; a year past the last published one keeps the last (wages are not projected either: the wage index is frozen too). */
export const maximumEarnings = (year) => MAXIMUM_EARNINGS[Math.min(year, LAST_MAX_YEAR)] ?? Infinity;
/** Round down to the dime, the way SSA does, without binary floating point flooring an exact $x.x0 a dime low ($2,315.50 is stored as 2315.4999...). */
export const floorDime = (x) => Math.floor(x * 10 + 1e-8) / 10;

/** Full retirement age for a birth year: { years, months, delayedIncreaseAnnual }. Born on Jan 1 counts as the year before (SSA rule). */
export function fullRetirementAge(birthYear) {
  const row = FULL_RETIREMENT_AGE.find((r) => birthYear >= r.minYear && birthYear <= r.maxYear) ?? FULL_RETIREMENT_AGE[FULL_RETIREMENT_AGE.length - 1];
  return { years: row.ageYears, months: row.ageMonths, delayedIncreaseAnnual: row.delayedIncreaseAnnual, asYears: row.ageYears + row.ageMonths / 12 };
}
/** Benefit as a share of the primary insurance amount when claiming at `claimAge` (62 to 70, fractional years allowed). */
export function claimFactor(birthYear, claimAge) {
  const fra = fullRetirementAge(birthYear);
  const claimMonths = Math.round(Math.min(70, Math.max(62, claimAge)) * 12);
  const fraMonths = Math.round(fra.asYears * 12);
  if (claimMonths < fraMonths) {
    const early = fraMonths - claimMonths;
    const first = Math.min(36, early), rest = Math.max(0, early - 36);
    return 1 - first * (5 / 9) / 100 - rest * (5 / 12) / 100;
  }
  const late = Math.min(claimMonths - fraMonths, Math.max(0, 70 * 12 - fraMonths));
  return 1 + late * (fra.delayedIncreaseAnnual / 12);
}
/**
 * A spouse's benefit as a share of the worker's primary insurance amount, claimed at `claimAge` against the spouse's
 * own full retirement age (from their birth year): half, less 25/36 of 1% a month for the first 36 months early and
 * 5/12 of 1% for each month beyond; no credits for waiting past full retirement age (SSA, benefits for a spouse).
 */
export function spousalFactor(birthYear, claimAge) {
  const fraMonths = Math.round(fullRetirementAge(birthYear).asYears * 12);
  const early = Math.max(0, fraMonths - Math.round(Math.min(70, Math.max(62, claimAge)) * 12));
  return Math.max(0, 0.5 - Math.min(36, early) * (25 / 36) / 100 - Math.max(0, early - 36) * (5 / 12) / 100);
}
/**
 * What a surviving spouse at their own full retirement age receives on a worker's record: the worker's benefit
 * (with any credits for waiting), but when the worker claimed early, never less than 82.5% of the worker's primary
 * insurance amount (the widow(er)'s limit, SSA POMS RS 00615.320).
 */
export function survivorAmount(pia, workerMonthly, claimedEarly) {
  return claimedEarly ? Math.max(workerMonthly, floorDime(pia * 0.825)) : workerMonthly;
}
/** Parse text pasted from ssa.gov's earnings table: lines with a year and a dollar amount. */
export function parseRecord(text) {
  const out = new Map();
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const m = /(19\d{2}|20\d{2})\D+\$?\s*([\d,]+)(?:\.\d+)?/.exec(line);
    if (!m) continue;
    const year = Number(m[1]), earnings = Number(m[2].replace(/,/g, ""));
    if (Number.isFinite(earnings)) out.set(year, Math.max(out.get(year) ?? 0, earnings));
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([year, earnings]) => ({ year, earnings }));
}
/** Credits earned from a record (4 a year at most; 40 needed). */
export function credits(record) {
  let n = 0;
  for (const r of record ?? []) { const per = r.year < 1978 ? EARNINGS_PER_CREDIT_BEFORE_1978 : (EARNINGS_PER_CREDIT[r.year] ?? EARNINGS_PER_CREDIT[Math.max(...Object.keys(EARNINGS_PER_CREDIT).map(Number))]); n += Math.min(4, Math.floor((Number(r.earnings) || 0) / per)); }
  return Math.min(n, MAX_CREDITS);
}
/**
 * estimateBenefit(record, { birthYear, claimAge = FRA, futureEarnings = "same", stopYear, today }) -> {
 *   eligible, credits, indexingYear, aime, bendPoints: [bp1, bp2], pia (monthly, in the dollars of the year you turn 62, then COLA'd to today when past 62),
 *   fra: { years, months }, claimFactor, monthly (at claimAge), yearly, top35: [{ year, earnings, indexed }], projectedYears: n
 * }
 * A year past the last published taxable maximum is capped at that last maximum.
 * futureEarnings "same": the last year's earnings repeat every year until `stopYear` (the year before claiming, or before retiring); "none": nothing more.
 */
export function estimateBenefit(record, { birthYear, claimAge = null, futureEarnings = "same", stopYear = null, today = null } = {}) {
  const fra = fullRetirementAge(birthYear);
  const claim = claimAge ?? fra.asYears;
  const rec = [...(record ?? [])].filter((r) => r.year && Number(r.earnings) >= 0).map((r) => ({ year: Number(r.year), earnings: Math.min(Number(r.earnings) || 0, maximumEarnings(Number(r.year))) }));
  const thisYear = today ? Number(String(today).slice(0, 4)) : (rec.length ? Math.max(...rec.map((r) => r.year)) : birthYear + 62);
  const lastYear = rec.length ? Math.max(...rec.map((r) => r.year)) : null;
  const last = rec.find((r) => r.year === lastYear);
  let projectedYears = 0;
  if (futureEarnings === "same" && last && last.earnings > 0) {
    const until = stopYear ?? (birthYear + Math.floor(claim) - 1);
    for (let y = lastYear + 1; y <= until; y++) { rec.push({ year: y, earnings: Math.min(last.earnings, maximumEarnings(y)) }); projectedYears++; }
  }
  const year62 = birthYear + 62, indexingYear = year62 - 2;
  const indexed = rec.map((r) => ({ ...r, indexed: r.year < indexingYear ? r.earnings * awi(indexingYear) / awi(r.year) : r.earnings }));
  const top35 = [...indexed].sort((a, b) => b.indexed - a.indexed).slice(0, SSA_EARNINGS_YEARS);
  const aime = Math.floor(top35.reduce((s, r) => s + r.indexed, 0) / (SSA_EARNINGS_YEARS * 12));
  const scale = awi(indexingYear) / awi(1977);
  const bp1 = Math.round(BENDPOINT1_IN_1977 * scale), bp2 = Math.round(BENDPOINT2_IN_1977 * scale);
  let pia = BEFORE_BENDPOINT1_MULTIPLIER * Math.min(aime, bp1) + BEFORE_BENDPOINT2_MULTIPLIER * Math.max(0, Math.min(aime, bp2) - bp1) + AFTER_BENDPOINT2_MULTIPLIER * Math.max(0, aime - bp2);
  pia = floorDime(pia);
  // cost-of-living increases apply from the year you turn 62 (published COLAs only; each one is paid from January of the next year)
  for (let y = year62; y < thisYear; y++) if (COLA[y] !== undefined) pia = floorDime(pia * (1 + COLA[y]));
  const factor = claimFactor(birthYear, claim);
  const monthly = floorDime(pia * factor);
  const cr = credits(rec);
  return { eligible: cr >= MAX_CREDITS, credits: cr, indexingYear, aime, bendPoints: [bp1, bp2], pia, fra: { years: fra.years, months: fra.months }, claimAge: claim, claimFactor: factor, monthly, yearly: monthly * 12, top35: top35.sort((a, b) => a.year - b.year), projectedYears, yearsInRecord: rec.length };
}

/**
 * compute(plan, { today }) -> {
 *   people: [{ id, name, birthYear, age, fra, claimAge, source: "record"|"typed"|"none", estimate, pia, monthly, options: [{ claimAge, monthly, factor }],
 *     spousalAtSameAge (a spouse with no benefit of their own, the same age, claiming at the same age, on this record),
 *     survivor (what a surviving spouse at their full retirement age would get on this record) }],
 *   couple: null | { spousal: { [personId]: monthly top-up on the partner's record at their own claim age }, survivorMonthly: { [personId who survives]: monthly },
 *     bothMonthly, survivorYearly (the larger benefit, kept by whoever outlives the other) },
 *   householdYearly, hasData
 * }
 * plan.retirement.socialSecurity[personId] = { claimAge, record: [{ year, earnings }], monthlyAtFRA, futureEarnings }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const ss = plan.retirement?.socialSecurity ?? {};
  const year = today ? Number(String(today).slice(0, 4)) : null;
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent").map((p) => {
    const birthYear = p.birthDate ? Number(String(p.birthDate).slice(0, 4)) : null;
    const s = ss[p.id] ?? {};
    const fra = birthYear ? fullRetirementAge(birthYear) : null;
    const claimAge = Number(s.claimAge) || (fra ? fra.asYears : 67);
    let estimate = null, source = "none", monthly = 0;
    if (birthYear && Array.isArray(s.record) && s.record.length) {
      const retireYear = birthYear + (Number(p.retirementAge) || Number(plan.assumptions?.retirementAge) || 65) - 1;
      estimate = estimateBenefit(s.record, { birthYear, claimAge, futureEarnings: s.futureEarnings ?? "same", stopYear: Math.min(retireYear, birthYear + Math.floor(claimAge) - 1), today });
      source = "record"; monthly = estimate.eligible ? estimate.monthly : 0;
    } else if (birthYear && Number(s.monthlyAtFRA) > 0) {
      source = "typed"; monthly = floorDime(Number(s.monthlyAtFRA) * claimFactor(birthYear, claimAge));
    }
    const eligible = source === "typed" || (source === "record" && estimate.eligible);
    const baseAtFra = !eligible ? 0 : source === "record" ? estimate.pia : Number(s.monthlyAtFRA);
    const options = birthYear ? [62, 64, fra.asYears, 68, 70].filter((a, i, arr) => arr.indexOf(a) === i).sort((a, b) => a - b).map((a) => ({ claimAge: a, factor: claimFactor(birthYear, a), monthly: floorDime(baseAtFra * claimFactor(birthYear, a)) })) : [];
    const spousalAtSameAge = birthYear ? floorDime(baseAtFra * spousalFactor(birthYear, claimAge)) : 0;
    const survivor = birthYear ? survivorAmount(baseAtFra, monthly, Math.round(claimAge * 12) < Math.round(fra.asYears * 12)) : 0;
    return { id: p.id, name: p.name, birthYear, age: birthYear && year ? year - birthYear : null, fra: fra ? { years: fra.years, months: fra.months } : null, claimAge, source, estimate, pia: baseAtFra, monthly, yearly: monthly * 12, options, spousalAtSameAge, survivor, futureEarnings: s.futureEarnings ?? "same", record: s.record ?? [], monthlyAtFRA: s.monthlyAtFRA ?? null };
  });
  return { people, couple: couple(people), householdYearly: people.reduce((s, p) => s + p.yearly, 0), hasData: people.some((p) => p.source !== "none") };
}

/**
 * A couple's two records together: each one's spousal top-up (half the partner's primary insurance amount less their
 * own, reduced for their own claiming age; paid once the partner has claimed) and what the one who outlives the other
 * keeps: the larger of their own benefit and the survivor amount on the partner's record. `survivorYearly` is the
 * larger of the two outcomes: the household's Social Security after the first death, at best.
 */
export function couple(people) {
  const adults = people.filter((p) => p.birthYear);
  if (adults.length < 2 || adults.every((p) => p.source === "none")) return null;
  const [a, b] = adults;
  const topUp = (me, other) => floorDime(Math.max(0, other.pia / 2 - me.pia) * (spousalFactor(me.birthYear, me.claimAge) / 0.5));
  const spousal = { [a.id]: topUp(a, b), [b.id]: topUp(b, a) };
  // the spousal top-up stops when the partner dies; the survivor amount on their record takes its place when it is larger
  const survivorMonthly = { [a.id]: Math.max(a.monthly, b.survivor), [b.id]: Math.max(b.monthly, a.survivor) };
  const bothMonthly = a.monthly + b.monthly + spousal[a.id] + spousal[b.id];
  return { spousal, survivorMonthly, bothMonthly, survivorYearly: Math.max(survivorMonthly[a.id], survivorMonthly[b.id]) * 12 };
}
