// modules/retirement/healthcare/data/aca.js -- marketplace (ACA) premium tax credit figures for 2026 coverage.
// Sources: IRS Rev. Proc. 2025-25 (the 2026 applicable percentage table, as reported by several sources that
// agree on it; irs.gov was not reachable from the build session); HHS 2025 poverty guidelines (used for 2026
// coverage); the federal default age curve for premiums (CMS). The larger credits of 2021-2025 (American Rescue
// Plan Act, Inflation Reduction Act) ended on December 31, 2025; the House passed a three-year extension in
// January 2026 but no enactment was found. Both schedules are here; the page lets you choose. Update each year.

/** The poverty line for a household of one and each person more (48 states and DC; Alaska and Hawaii are higher). 2025 guidelines, used for 2026 coverage. */
export const FPL = { base: 15650, each: 5500, year: 2025 };
/** The share of income a household is expected to pay for the benchmark plan, by income as a multiple of the poverty line: [from, to, start %, end %], straight-line inside each band. */
export const SCHEDULES = {
  law: { label: "As the law stands for 2026", cliff: 4, bands: [[0, 1.33, 0.021, 0.021], [1.33, 1.5, 0.0314, 0.0419], [1.5, 2, 0.0419, 0.066], [2, 2.5, 0.066, 0.0844], [2.5, 3, 0.0844, 0.0996], [3, 4, 0.0996, 0.0996]] },
  enhanced: { label: "If the larger 2021-2025 credits come back", cliff: Infinity, bands: [[0, 1.5, 0, 0], [1.5, 2, 0, 0.02], [2, 2.5, 0.02, 0.04], [2.5, 3, 0.04, 0.06], [3, 4, 0.06, 0.085], [4, Infinity, 0.085, 0.085]] },
};
/** The federal default age curve: a premium relative to a 21-year-old's. */
export const AGE_CURVE = [[0, 0.765], [15, 0.833], [21, 1.0], [25, 1.004], [30, 1.135], [35, 1.222], [40, 1.278], [45, 1.429], [50, 1.786], [55, 2.23], [60, 2.714], [64, 3.0]];
/** A rough national benchmark (second-cheapest silver plan) for a 40-year-old, a month, 2026: about $497 in 2025 plus the 26% average rise reported for 2026 (KFF). Enter your own from healthcare.gov. */
export const BENCHMARK_40 = 625;
