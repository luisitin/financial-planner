// core/math/rmd.js -- required minimum distributions from pre-tax retirement accounts. PURE.
// Source: IRS Publication 590-B, Table III (Uniform Lifetime Table), the version in effect from
// 2022 (vendor/data/irs-p590b.pdf). Start age: 73 for people born 1951-1959, 75 for people born
// 1960 or later (SECURE 2.0 Act); 72 for people born in 1950 or earlier who had not started.
// Roth IRAs have no lifetime RMD; Roth 401(k)s stopped having one in 2024.
export const UNIFORM_LIFETIME = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8,
  85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8,
  98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5,
  111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
};
/** The distribution period for an age (ages past 120 use 2.0; ages below 72 have no RMD, factor Infinity). */
export const rmdFactor = (age) => age < 72 ? Infinity : UNIFORM_LIFETIME[Math.min(120, Math.floor(age))];
/** The age RMDs begin, from the year of birth. */
export const rmdStartAge = (birthYear) => birthYear >= 1960 ? 75 : birthYear >= 1951 ? 73 : 72;
/** The required withdrawal for a year: the prior year-end balance divided by the factor for the age reached that year. */
export const rmdAmount = (balance, age) => { const f = rmdFactor(age); return Number.isFinite(f) ? (Number(balance) || 0) / f : 0; };
