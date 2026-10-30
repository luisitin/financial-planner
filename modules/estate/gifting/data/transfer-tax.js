// modules/estate/gifting/data/transfer-tax.js -- the federal gift and estate tax figures. Shared by
// estate/gifting and estate/estate-tax. Update each November when the IRS publishes the next year's
// inflation adjustments (Rev. Proc.), and check for law changes.

/** The basic exclusion amount (the lifetime gift and estate exemption) per person: Rev. Proc. 2023-34 (2024), 2024-40 (2025); $15,000,000 for 2026 under the One Big Beautiful Bill Act (Pub. L. 119-21), indexed from 2027. */
export const BASIC_EXCLUSION = { 2024: 13610000, 2025: 13990000, 2026: 15000000 };
/** The gift tax annual exclusion per donor per recipient: Rev. Proc. 2023-34 (2024), 2024-40 (2025), 2025-32 (2026). */
export const ANNUAL_EXCLUSION = { 2024: 18000, 2025: 19000, 2026: 19000 };
/** The unified rate schedule, IRC 2001(c): [over, base tax, rate on the excess]. */
export const RATE_SCHEDULE = [
  [0, 0, 0.18], [10000, 1800, 0.20], [20000, 3800, 0.22], [40000, 8200, 0.24], [60000, 13000, 0.26], [80000, 18200, 0.28],
  [100000, 23800, 0.30], [150000, 38800, 0.32], [250000, 70800, 0.34], [500000, 155800, 0.37], [750000, 248300, 0.39], [1000000, 345800, 0.40],
];
/** A 529 gift can be spread over five years for the annual exclusion (IRC 529(c)(2)(B), elected on Form 709). */
export const SUPERFUND_YEARS = 5;
/** States with their own estate tax (and a lower exemption than the federal one), and with an inheritance tax, as of 2026. */
export const STATE_ESTATE_TAX = ["CT", "DC", "HI", "IL", "MA", "MD", "ME", "MN", "NY", "OR", "RI", "VT", "WA"];
export const STATE_INHERITANCE_TAX = ["KY", "MD", "NE", "NJ", "PA"];

const latest = (table, year) => table[year] ?? table[Math.max(...Object.keys(table).map(Number).filter((y) => y <= year), Math.min(...Object.keys(table).map(Number)))];
export const exclusionFor = (year) => latest(BASIC_EXCLUSION, year);
export const annualExclusionFor = (year) => latest(ANNUAL_EXCLUSION, year);

/** The tentative tax on an amount, from the unified rate schedule. */
export function tentativeTax(amount) {
  if (!(amount > 0)) return 0;
  let row = RATE_SCHEDULE[0];
  for (const r of RATE_SCHEDULE) if (amount > r[0]) row = r;
  return row[1] + (amount - row[0]) * row[2];
}
