// modules/cashflow/paycheck/data/withholding.js -- the IRS percentage method for automated payroll, for a W-4 from 2020
// or later: IRS Publication 15-T (2026), "Federal Income Tax Withholding Methods", dated Dec 3, 2025, page 12 (the annual
// tables) and Worksheet 1A (page 10); https://www.irs.gov/pub/irs-pdf/p15t.pdf, checked 2026-10-30. Each row: if the
// adjusted annual wage amount is at least `from`, withhold `base` plus `rate` of the amount over `from`. The published
// bases are kept as printed (two in the single Step 2 table differ by cents from recomputing them: the IRS rounded the
// half-dollar thresholds). Add each year from the December edition.
const rows = (list) => list.map(([from, base, rate]) => ({ from, base, rate }));
export const PCT_METHOD = {
  2026: {
    year: 2026,
    // Worksheet 1A line 1g, when the box in Step 2 is not ticked
    step1g: { married_joint: 12900, other: 8600 },
    standard: {
      married_joint: rows([[0, 0, 0], [19300, 0, 0.10], [44100, 2480, 0.12], [120100, 11600, 0.22], [230700, 35932, 0.24], [422850, 82048, 0.32], [531750, 116896, 0.35], [788000, 206583.5, 0.37]]),
      single: rows([[0, 0, 0], [7500, 0, 0.10], [19900, 1240, 0.12], [57900, 5800, 0.22], [113200, 17966, 0.24], [209275, 41024, 0.32], [263725, 58448, 0.35], [648100, 192979.25, 0.37]]),
      head_of_household: rows([[0, 0, 0], [15550, 0, 0.10], [33250, 1770, 0.12], [83000, 7740, 0.22], [121250, 16155, 0.24], [217300, 39207, 0.32], [271750, 56631, 0.35], [656150, 191171, 0.37]]),
    },
    // the "Form W-4, Step 2, Checkbox" schedules
    checkbox: {
      married_joint: rows([[0, 0, 0], [16100, 0, 0.10], [28500, 1240, 0.12], [66500, 5800, 0.22], [121800, 17966, 0.24], [217875, 41024, 0.32], [272325, 58448, 0.35], [400450, 103291.75, 0.37]]),
      single: rows([[0, 0, 0], [8050, 0, 0.10], [14250, 620, 0.12], [33250, 2900, 0.22], [60900, 8983, 0.24], [108938, 20512, 0.32], [136163, 29224, 0.35], [328350, 96489.63, 0.37]]),
      head_of_household: rows([[0, 0, 0], [12075, 0, 0.10], [20925, 885, 0.12], [45800, 3870, 0.22], [64925, 8077.5, 0.24], [112950, 19603.5, 0.32], [140175, 28315.5, 0.35], [332375, 95585.5, 0.37]]),
    },
  },
};
export const forYear = (T, year) => T[year] ?? T[Math.max(...Object.keys(T).map(Number).filter((y) => y <= year))] ?? T[Math.min(...Object.keys(T).map(Number))];
