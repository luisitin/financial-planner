// modules/estate/gifting/data/transfer-tax.js -- the federal gift and estate tax figures. Shared by
// estate/gifting and estate/estate-tax. Update each November when the IRS publishes the next year's
// inflation adjustments (Rev. Proc.), and check for law changes.

/**
 * The basic exclusion amount (the lifetime gift and estate exemption) per person, from 2011 (when the unified $5,000,000
 * and portability began): the Instructions for Form 706 (Rev. July 2026) "Table of Basic Exclusion Amounts" and the
 * Instructions for Form 709 (2025) table, each year's revenue procedure (2012 Rev. Proc. 2011-52, 2013 2013-15, 2014
 * 2013-35, 2015 2014-61, 2016 2015-53, 2017 2016-55, 2018 2018-18 (replacing 2017-58's $5,600,000 after Pub. L. 115-97),
 * 2019 2018-57, 2020 2019-44, 2021 2020-45, 2022 2021-45, 2023 2022-38, 2024 2023-34, 2025 2024-40); $15,000,000 for 2026
 * under the One Big Beautiful Bill Act (Pub. L. 119-21; Rev. Proc. 2025-32), indexed from 2027 (not published by
 * 2026-10-31: the newest carries forward). All read 2026-10-31.
 */
export const BASIC_EXCLUSION = {
  2011: 5000000, 2012: 5120000, 2013: 5250000, 2014: 5340000, 2015: 5430000, 2016: 5450000, 2017: 5490000,
  2018: 11180000, 2019: 11400000, 2020: 11580000, 2021: 11700000, 2022: 12060000, 2023: 12920000,
  2024: 13610000, 2025: 13990000, 2026: 15000000,
};
/** The gift tax annual exclusion per donor per recipient: Rev. Proc. 2010-40 (2011), 2011-52 (2012), 2012-41 (2013), 2013-35, 2014-61, 2015-53, 2016-55 (2014-2017), 2017-58 (2018), 2018-57, 2019-44, 2020-45, 2021-45, 2022-38, 2023-34, 2024-40, 2025-32 (2026). Read 2026-10-31. */
export const ANNUAL_EXCLUSION = {
  2011: 13000, 2012: 13000, 2013: 14000, 2014: 14000, 2015: 14000, 2016: 14000, 2017: 14000,
  2018: 15000, 2019: 15000, 2020: 15000, 2021: 15000, 2022: 16000, 2023: 17000,
  2024: 18000, 2025: 19000, 2026: 19000,
};
/** The first year the tables hold (gifts are entered from it). */
export const FIRST_YEAR = 2011;
/** The unified rate schedule, IRC 2001(c): [over, base tax, rate on the excess]. */
export const RATE_SCHEDULE = [
  [0, 0, 0.18], [10000, 1800, 0.20], [20000, 3800, 0.22], [40000, 8200, 0.24], [60000, 13000, 0.26], [80000, 18200, 0.28],
  [100000, 23800, 0.30], [150000, 38800, 0.32], [250000, 70800, 0.34], [500000, 155800, 0.37], [750000, 248300, 0.39], [1000000, 345800, 0.40],
];
/** A 529 gift can be spread over five years for the annual exclusion (IRC 529(c)(2)(B), elected on Form 709). */
export const SUPERFUND_YEARS = 5;
/** States with their own estate tax (most with a lower exemption than the federal one; Connecticut's matches it), and with an inheritance tax, as of 2026. */
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
