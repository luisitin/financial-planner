// core/math/rmd.js -- required minimum distributions from pre-tax retirement accounts. PURE.
// Source: IRS Publication 590-B, Table III (Uniform Lifetime Table), the version in effect from
// 2022 (vendor/data/irs-p590b.pdf). Start age: 73 for people born 1951-1959, 75 for people born
// 1960 or later (SECURE 2.0 Act); 72 for people born July 1949 to 1950; 70½ before July 1, 1949. The start ages by birth
// date: 26 CFR 1.401(a)(9)-2(b)(2)(ii)-(iv), (vi) (70½, 72, 73 for 1951-1958, 75 from 1960) and, for 1959, the proposed
// 1.401(a)(9)-2(b)(2)(v) (89 FR 58644, July 19, 2024: 73), which the final rule left open (read 2026-10-31).
// Each owner's withdrawal is worked on their own accounts at their own age; life-insurance cash
// value is not an IRA (IRC §408(a)(3)) and has none.
// Roth IRAs have no lifetime RMD; Roth 401(k)s stopped having one in 2024.
export const UNIFORM_LIFETIME = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8,
  85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8,
  98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5,
  111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
};
/** The distribution period for an age (ages past 120 use 2.0; ages below 72 have no RMD, factor Infinity). */
export const rmdFactor = (age) => age < 72 ? Infinity : UNIFORM_LIFETIME[Math.min(120, Math.floor(age))];
/**
 * The age RMDs begin, from the year of birth or the birth date ("YYYY-MM-DD"): 70½ for people born before
 * July 1, 1949 (a year alone counts as January 1), 72 for the rest born in 1949-1950, 73 for 1951-1959,
 * 75 from 1960 (SECURE 2.0 §107; 26 CFR 1.401(a)(9)-2(b)(2); 1959 under the proposed (b)(2)(v)).
 */
export function rmdStartAge(birth) {
  const s = String(birth ?? ""), year = Number(s.slice(0, 4)), month = Number(s.slice(5, 7)) || 1;
  if (year < 1949 || (year === 1949 && month < 7)) return 70.5;
  return year >= 1960 ? 75 : year >= 1951 ? 73 : 72;
}
/** The calendar year RMDs begin: the year the start age is reached (70½ falls in the next year for a birthday from July on). */
export function rmdStartYear(birth) {
  const s = String(birth ?? ""), year = Number(s.slice(0, 4)), month = Number(s.slice(5, 7)) || 1;
  const age = rmdStartAge(birth);
  return age === 70.5 ? year + 70 + (month >= 7 ? 1 : 0) : year + age;
}
/** Account types that have required withdrawals (traditional IRAs and workplace plans; Roth accounts, HSAs and life-insurance cash value do not). */
export const RMD_ACCOUNT_TYPES = ["401k", "ira"];
/** The required withdrawal for a year: the prior year-end balance divided by the factor for the age reached that year. */
export const rmdAmount = (balance, age) => { const f = rmdFactor(age); return Number.isFinite(f) ? (Number(balance) || 0) / f : 0; };

// ---- an inherited account: the Single Life Table ----------------------------------------------------------------------
// Source: 26 CFR 1.401(a)(9)-9(b) (T.D. 9930, 85 FR 72472, November 12, 2020; for distribution calendar years from 2022),
// the same figures as IRS Publication 590-B (2025), Appendix B, Table I (Single Life Expectancy, for use by beneficiaries).
// A US government work and a public fact; every age checked against the text of both on 2026-11-13. Index = age, 0 to 120
// (120 and over: 1.0).
export const SINGLE_LIFE = Object.freeze([
  84.6, 83.7, 82.8, 81.8, 80.8, 79.8, 78.8, 77.9, 76.9, 75.9, 74.9, 73.9, 72.9, 71.9, 70.9, 69.9, 69.0, 68.0, 67.0, 66.0,
  65.0, 64.1, 63.1, 62.1, 61.1, 60.2, 59.2, 58.2, 57.3, 56.3, 55.3, 54.4, 53.4, 52.5, 51.5, 50.5, 49.6, 48.6, 47.7, 46.7,
  45.7, 44.8, 43.8, 42.9, 41.9, 41.0, 40.0, 39.0, 38.1, 37.1, 36.2, 35.3, 34.3, 33.4, 32.5, 31.6, 30.6, 29.8, 28.9, 28.0,
  27.1, 26.2, 25.4, 24.5, 23.7, 22.9, 22.0, 21.2, 20.4, 19.6, 18.8, 18.0, 17.2, 16.4, 15.6, 14.8, 14.1, 13.3, 12.6, 11.9,
  11.2, 10.5, 9.9, 9.3, 8.7, 8.1, 7.6, 7.1, 6.6, 6.1, 5.7, 5.3, 4.9, 4.6, 4.3, 4.0, 3.7, 3.4, 3.2, 3.0,
  2.8, 2.6, 2.5, 2.3, 2.2, 2.1, 2.1, 2.1, 2.0, 2.0, 2.0, 2.0, 2.0, 1.9, 1.9, 1.8, 1.8, 1.6, 1.4, 1.1, 1.0,
]);
/** The life expectancy for an age from the Single Life Table (an age past 120 uses 1.0; an age that is not a number has none: null). */
export const singleLife = (age) => (Number.isFinite(Number(age)) && age !== null && age !== "" ? SINGLE_LIFE[Math.min(120, Math.max(0, Math.floor(Number(age))))] : null);
/**
 * The divisor for year k (1, 2, ...) after the year of death, for someone who inherits from an owner who had begun required
 * withdrawals: the longer of the heir's life expectancy (the table at the heir's age in the year after the death, less 1
 * each later year) and the owner's (the table at the owner's age in the year of death, less 1 each year after it), never
 * under 1 (Publication 590-B (2025), "Owner Died on or After Required Beginning Date"; 26 CFR 1.401(a)(9)-5(d)(1)).
 * heirAge: the heir's age in the year after the death; ownerAge: the owner's age in the year of death (null: not known,
 * the heir's alone). No heir's age: null.
 */
export function inheritedDivisor(k, heirAge, ownerAge = null) {
  const h = singleLife(heirAge);
  if (h === null) return null;
  const o = singleLife(ownerAge);
  return Math.max(1, h - (k - 1), o === null ? 0 : o - k);
}
