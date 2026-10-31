// modules/retirement/healthcare/data/aca.js -- marketplace (ACA) premium tax credit figures, by coverage year.
// Sources (read 2026-10-31): IRS Rev. Proc. 2025-25 section 3.01 (the 2026 applicable percentage table) and Rev.
// Proc. 2026-26 section 3.01 (2027); HHS poverty guidelines, 90 FR 5917 (2025) and 91 FR 1797 (2026): coverage in a
// year uses the guidelines published by the first day of its open enrollment, so the year before (26 U.S.C.
// 36B(d)(3)(B)); the federal default standard age curve (CMS bulletin of December 16, 2016, Appendix I; 45 CFR
// 147.102). The larger credits of 2021-2025 (American Rescue Plan Act, Inflation Reduction Act) ended on December
// 31, 2025: 36B(b)(3)(A)(iii) and (c)(1)(E) still end "before January 1, 2026" in the Code current through Pub. L.
// 119-136, and the House's three-year extension (H.R. 1834) has sat on the Senate calendar since February 2026.
// Both schedules are here; the page lets you choose. Add each year when the IRS and HHS publish it.

/** The poverty line used for coverage in a year: a household of one and each person more (48 states and DC; Alaska and Hawaii are higher). */
export const FPL_BY_YEAR = {
  2026: { base: 15650, each: 5500, year: 2025 },   // HHS 2025 guidelines (90 FR 5917)
  2027: { base: 15960, each: 5680, year: 2026 },   // HHS 2026 guidelines (91 FR 1797, January 15, 2026)
};
/** The first coverage year here (the default when no year is given, as Student loans reads the 2025 guidelines). */
export const FIRST_YEAR = 2026;
/** The 2026 coverage figures, kept for older readers. */
export const FPL = FPL_BY_YEAR[FIRST_YEAR];
/**
 * The share of income a household is expected to pay for the benchmark plan, by income as a multiple of the poverty
 * line: [from, to, start, end], straight-line inside each band, "at least" from and "less than" to (the last law band
 * includes 4). Law bands by coverage year; the larger 2021-2025 credits as they were.
 */
export const LAW_BY_YEAR = {
  2026: [[1, 1.33, 0.021, 0.021], [1.33, 1.5, 0.0314, 0.0419], [1.5, 2, 0.0419, 0.066], [2, 2.5, 0.066, 0.0844], [2.5, 3, 0.0844, 0.0996], [3, 4, 0.0996, 0.0996]],
  2027: [[1, 1.33, 0.0215, 0.0215], [1.33, 1.5, 0.0323, 0.043], [1.5, 2, 0.043, 0.0678], [2, 2.5, 0.0678, 0.0866], [2.5, 3, 0.0866, 0.1022], [3, 4, 0.1022, 0.1022]],
};
export const SCHEDULES = {
  law: { label: "As the law stands", cliff: 4, bands: LAW_BY_YEAR[FIRST_YEAR] },
  enhanced: { label: "If the larger 2021-2025 credits come back", cliff: Infinity, bands: [[1, 1.5, 0, 0], [1.5, 2, 0, 0.02], [2, 2.5, 0.02, 0.04], [2.5, 3, 0.04, 0.06], [3, 4, 0.06, 0.085], [4, Infinity, 0.085, 0.085]] },
};
/** The federal default standard age curve: a premium relative to a 21-year-old's, one factor for each age (0-14 one rate, 64 and older 3.000). */
export const AGE_CURVE = {
  14: 0.765, 15: 0.833, 16: 0.859, 17: 0.885, 18: 0.913, 19: 0.941, 20: 0.970, 21: 1.000, 22: 1.000, 23: 1.000, 24: 1.000,
  25: 1.004, 26: 1.024, 27: 1.048, 28: 1.087, 29: 1.119, 30: 1.135, 31: 1.159, 32: 1.183, 33: 1.198, 34: 1.214, 35: 1.222,
  36: 1.230, 37: 1.238, 38: 1.246, 39: 1.262, 40: 1.278, 41: 1.302, 42: 1.325, 43: 1.357, 44: 1.397, 45: 1.444, 46: 1.500,
  47: 1.563, 48: 1.635, 49: 1.706, 50: 1.786, 51: 1.865, 52: 1.952, 53: 2.040, 54: 2.135, 55: 2.230, 56: 2.333, 57: 2.437,
  58: 2.548, 59: 2.603, 60: 2.714, 61: 2.810, 62: 2.873, 63: 2.952, 64: 3.000,
};
/** Children under 21 counted in a family's premium: the three oldest (45 CFR 147.102(c)(1)). */
export const CHILDREN_COUNTED = 3;
/** A rough national benchmark (second-cheapest silver plan) for a 40-year-old, a month, 2026: about $497 in 2025 plus the 26% average rise reported for 2026 (KFF). Enter your own from healthcare.gov. */
export const BENCHMARK_40 = 625;
