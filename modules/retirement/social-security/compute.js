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
 * futureEarnings "same": the last year's earnings repeat every year until `stopYear` (the year before claiming, or before retiring); "none": nothing more.
 */
export function estimateBenefit(record, { birthYear, claimAge = null, futureEarnings = "same", stopYear = null, today = null } = {}) {
  const fra = fullRetirementAge(birthYear);
  const claim = claimAge ?? fra.asYears;
  const rec = [...(record ?? [])].filter((r) => r.year && Number(r.earnings) >= 0).map((r) => ({ year: Number(r.year), earnings: Math.min(Number(r.earnings) || 0, MAXIMUM_EARNINGS[r.year] ?? Infinity) }));
  const thisYear = today ? Number(String(today).slice(0, 4)) : (rec.length ? Math.max(...rec.map((r) => r.year)) : birthYear + 62);
  const lastYear = rec.length ? Math.max(...rec.map((r) => r.year)) : null;
  const last = rec.find((r) => r.year === lastYear);
  let projectedYears = 0;
  if (futureEarnings === "same" && last && last.earnings > 0) {
    const until = stopYear ?? (birthYear + Math.floor(claim) - 1);
    for (let y = lastYear + 1; y <= until; y++) { rec.push({ year: y, earnings: Math.min(last.earnings, MAXIMUM_EARNINGS[y] ?? Infinity) }); projectedYears++; }
  }
  const year62 = birthYear + 62, indexingYear = year62 - 2;
  const indexed = rec.map((r) => ({ ...r, indexed: r.year < indexingYear ? r.earnings * awi(indexingYear) / awi(r.year) : r.earnings }));
  const top35 = [...indexed].sort((a, b) => b.indexed - a.indexed).slice(0, SSA_EARNINGS_YEARS);
  const aime = Math.floor(top35.reduce((s, r) => s + r.indexed, 0) / (SSA_EARNINGS_YEARS * 12));
  const scale = awi(indexingYear) / awi(1977);
  const bp1 = Math.round(BENDPOINT1_IN_1977 * scale), bp2 = Math.round(BENDPOINT2_IN_1977 * scale);
  let pia = BEFORE_BENDPOINT1_MULTIPLIER * Math.min(aime, bp1) + BEFORE_BENDPOINT2_MULTIPLIER * Math.max(0, Math.min(aime, bp2) - bp1) + AFTER_BENDPOINT2_MULTIPLIER * Math.max(0, aime - bp2);
  pia = Math.floor(pia * 10) / 10;
  // cost-of-living increases apply from the year you turn 62 (published COLAs only)
  for (let y = year62; y < thisYear; y++) if (COLA[y] !== undefined) pia = Math.floor(pia * (1 + COLA[y]) * 10) / 10;
  const factor = claimFactor(birthYear, claim);
  const monthly = Math.floor(pia * factor * 10) / 10;
  const cr = credits(rec);
  return { eligible: cr >= MAX_CREDITS, credits: cr, indexingYear, aime, bendPoints: [bp1, bp2], pia, fra: { years: fra.years, months: fra.months }, claimAge: claim, claimFactor: factor, monthly, yearly: monthly * 12, top35: top35.sort((a, b) => a.year - b.year), projectedYears, yearsInRecord: rec.length };
}

/**
 * compute(plan, { today }) -> { people: [{ id, name, birthYear, age, fra, claimAge, source: "record"|"typed"|"none", estimate, monthly, options: [{ claimAge, monthly, factor }] }], householdYearly, hasData }
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
      source = "typed"; monthly = Math.floor(Number(s.monthlyAtFRA) * claimFactor(birthYear, claimAge) * 10) / 10;
    }
    const baseAtFra = source === "record" ? estimate.pia : source === "typed" ? Number(s.monthlyAtFRA) : 0;
    const options = birthYear ? [62, 64, fra.asYears, 68, 70].filter((a, i, arr) => arr.indexOf(a) === i).sort((a, b) => a - b).map((a) => ({ claimAge: a, factor: claimFactor(birthYear, a), monthly: Math.floor(baseAtFra * claimFactor(birthYear, a) * 10) / 10 })) : [];
    return { id: p.id, name: p.name, birthYear, age: birthYear && year ? year - birthYear : null, fra: fra ? { years: fra.years, months: fra.months } : null, claimAge, source, estimate, monthly, yearly: monthly * 12, options, futureEarnings: s.futureEarnings ?? "same", record: s.record ?? [], monthlyAtFRA: s.monthlyAtFRA ?? null };
  });
  return { people, householdYearly: people.reduce((s, p) => s + p.yearly, 0), hasData: people.some((p) => p.source !== "none") };
}
