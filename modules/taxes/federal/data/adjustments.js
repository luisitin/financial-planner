// modules/taxes/federal/data/adjustments.js -- the dollar figures of the adjustments the Federal estimate works out from the
// plan (taxes/federal known.js), kept apart from federal.js so the engine's yearly table (and every page that reads it) is
// unchanged by them.
//
// Student loan interest (IRC 221): at most $2,500 a year (221(b)(1), not indexed), less as modified AGI rises through the
// range (221(b)(2)(B), indexed); none on a separate return (221(e)(2)). Rev. Proc. 2023-34 sec. 3.30 (2024), Rev. Proc.
// 2024-40 sec. 2.30 (2025) and Rev. Proc. 2025-32 sec. 4.29 (2026): "for taxpayers with modified adjusted gross income in
// excess of $85,000 ($175,000 for joint returns), and is completely phased out for taxpayers with modified adjusted gross
// income of $100,000 or more ($205,000 or more for joint returns)" (2026; read 2026-11-06 at
// https://www.irs.gov/pub/irs-drop/rp-25-32.pdf). A year past the last one uses the last one's figures.
export const STUDENT_LOAN_INTEREST = {
  2024: { max: 2500, single: [80000, 95000], married_joint: [165000, 195000] },
  2025: { max: 2500, single: [85000, 100000], married_joint: [170000, 200000] },
  2026: { max: 2500, single: [85000, 100000], married_joint: [175000, 205000] },
};
/** The student loan interest figures for `year`: its own, else the nearest year before it (the first table before that). -> { year, max, single, married_joint } */
export function studentLoanFor(year) {
  const ys = Object.keys(STUDENT_LOAN_INTEREST).map(Number).sort((a, b) => a - b);
  const y = ys.filter((x) => x <= Number(year)).pop() ?? ys[0];
  return { year: y, ...STUDENT_LOAN_INTEREST[y] };
}
