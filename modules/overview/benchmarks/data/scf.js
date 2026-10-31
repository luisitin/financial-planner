// modules/overview/benchmarks/data/scf.js -- median family net worth by the age of the family's head,
// from the Federal Reserve's Survey of Consumer Finances 2025 ("Changes in U.S. Family Finances from
// 2022 to 2025", published October 2026), in 2025 dollars: Table 2 (thousands of 2025 dollars), p. 12 of the
// report on federalreserve.gov, checked against every value here on 2026-10-31 (first typed on 2026-10-30
// from news reports of the release).
// The survey is every three years; the next (2028) comes out in 2029. Check this file then.
export const SCF_YEAR = 2025;
export const MEDIAN_NET_WORTH_BY_AGE = [
  { from: 0, to: 34, label: "under 35", median: 33000 },
  { from: 35, to: 44, label: "35 to 44", median: 155600 },
  { from: 45, to: 54, label: "45 to 54", median: 253700 },
  { from: 55, to: 64, label: "55 to 64", median: 411900 },
  { from: 65, to: 74, label: "65 to 74", median: 431300 },
  { from: 75, to: 200, label: "75 and over", median: 504900 },
];
export const MEDIAN_NET_WORTH_ALL = 215900;

// Fidelity's savings guideline (Fidelity Viewpoints, "How much do I need to save for retirement?"):
// retirement savings as a multiple of salary by each age, aiming to retire at 67.
export const SAVINGS_MULTIPLE_BY_AGE = [[30, 1], [35, 2], [40, 3], [45, 4], [50, 6], [55, 7], [60, 8], [67, 10]];
