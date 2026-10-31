// modules/career/benefits/data/benefits.js -- the yearly figures for workplace benefits that are not already in
// retirement/contributions/data/limits.js (401(k), IRA, HSA, health FSA). The IRS publishes most of a year's figures in
// October and November of the year before (the 401(k)'s in a notice, the commuter limits in a revenue procedure) and
// the HSA's in the spring: add the year when they come out.
// Sources: IRS Rev. Proc. 2025-32 section 4 (2026 commuter limits) and Rev. Proc. 2024-40 section 2.17 (2025's),
// IRC 129(a)(2)(A) as amended by P.L. 119-21 section 70404 (dependent care, from 2026), IRC 21(b)(1)(A) (a child under
// 13), IRS Publication 15-B (2026) and Treas. Reg. 1.79-3(d)(2) (group-term life, Table I),
// IRC 423 and IRS Publication 525 (employee stock purchase plans), IRS Notice 2025-67 (the Roth catch-up wage line and
// the 2026 compensation limit; Notice 2024-80 for 2025), IRS Notice 2023-62 (no Roth catch-up rule before 2026),
// Rev. Proc. 2026-24 (2027 HSA limits).
export const BENEFITS = {
  2026: {
    dependentCare: { limit: 7500, separate: 3750, childUnder: 13 },     // a household's limit; half on a separate return; was 5,000 to 2025
    commuter: { transitMonthly: 340, parkingMonthly: 340 },              // each its own monthly limit (2025: 325)
    rothCatchUpWages: 150000,                                            // FICA wages the year before above this: catch-ups go in as Roth (IRC 414(v)(7))
    compLimit: 360000,                                                   // the most pay a plan's match can be figured on (IRC 401(a)(17), Notice 2025-67)
  },
  2025: {
    dependentCare: { limit: 5000, separate: 2500, childUnder: 13 },
    commuter: { transitMonthly: 325, parkingMonthly: 325 },
    rothCatchUpWages: 145000,
    compLimit: 350000,                                                   // Notice 2024-80
  },
};
/** The first year the Roth catch-up rule applies: Notice 2023-62 gave plans an administrative transition through 2025. */
export const ROTH_CATCHUP_FROM = 2026;
/**
 * HSA limits published before the rest of a year's (limits.js has no row for the year yet): Rev. Proc. 2026-24
 * section 3.01(1), posted 2026-05-29: $4,500 self-only, $9,000 family for 2027 (IRC 223(b)(2)). The $1,000 catch-up
 * from 55 is in the law and not indexed (IRC 223(b)(3)(B)). Its section 3.01(3) also sets the 2027 high-deductible
 * plan: a deductible of at least $1,750 / $3,500 and out-of-pocket costs of at most $8,700 / $17,400.
 */
export const HSA_AHEAD = { 2027: { limit: 4500, family: 9000 } };
/** Group-term life insurance over $50,000: the monthly cost per $1,000 of cover that becomes taxable pay, by age at the year's end (Table I). */
export const GROUP_LIFE = {
  free: 50000,
  table: [[25, 0.05], [30, 0.06], [35, 0.08], [40, 0.09], [45, 0.10], [50, 0.15], [55, 0.23], [60, 0.43], [65, 0.66], [70, 1.27], [Infinity, 2.06]],   // [under this age, rate]
};
/** Employee stock purchase plans (IRC 423): at most 15% off; at most $25,000 of stock a year, valued at the offering's start. */
export const ESPP = { maxDiscount: 0.15, yearlyStock: 25000 };
/** A year's figures, or the latest year's for a year past the table. */
export const benefitsFor = (year) => BENEFITS[year] ?? BENEFITS[Math.max(...Object.keys(BENEFITS).map(Number).filter((y) => y <= year))] ?? BENEFITS[Math.min(...Object.keys(BENEFITS).map(Number))];
