// modules/retirement/medicare/data/medicare.js -- Medicare premiums and the income-related monthly adjustment
// amounts (IRMAA) for 2026. Sources (read 2026-10-31): CMS fact sheet "2026 Medicare Parts B Premiums and
// Deductibles" (November 14, 2025; Part B, the deductible, the IRMAA tiers and the Part D add-ons),
// https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles ; CMS fact sheet
// "Medicare Part D 2026 National Average Monthly Bid Amount Information" (July 28, 2025; the $38.99 base premium);
// for 2027 the CMS fact sheet of July 28, 2026 (base premium $41.33, the 6% yearly cap of the 2022 Inflation
// Reduction Act), https://www.cms.gov/newsroom/fact-sheets/medicare-part-d-2027-national-average-monthly-bid-amount-information .
// The tiers use the tax return from two years before (2026 premiums: 2024 income). Update each November,
// when CMS publishes the next year's Part B figures; the page keeps every figure of one year together.

export const YEAR = 2026;
/** The standard Part B premium a month, and the yearly Part B deductible. */
export const PART_B = 202.90, PART_B_DEDUCTIBLE = 283;
/** The national base beneficiary premium for a drug plan (Part D), a month; real plans vary around it. */
export const PART_D_BASE = 38.99;
/** The next year's base premium, published before its Part B figures (CMS, July 28, 2026): shown, not yet used. */
export const PART_D_BASE_NEXT = { year: 2027, amount: 41.33 };
/** IRMAA tiers by filing status: modified AGI up to (inclusive), the total Part B premium, the Part D add-on (a month). */
export const TIERS = {
  single: [[109000, 202.90, 0], [137000, 284.10, 14.50], [171000, 405.80, 37.50], [205000, 527.50, 60.40], [499999.99, 649.20, 83.30], [Infinity, 689.90, 91.00]],
  married_joint: [[218000, 202.90, 0], [274000, 284.10, 14.50], [342000, 405.80, 37.50], [410000, 527.50, 60.40], [749999.99, 649.20, 83.30], [Infinity, 689.90, 91.00]],
  married_separate: [[109000, 202.90, 0], [390999.99, 649.20, 83.30], [Infinity, 689.90, 91.00]],
};
/** Head of household and a qualifying surviving spouse use the single tiers. */
export const tiersFor = (status) => TIERS[status] ?? (status === "qualifying_surviving" ? TIERS.single : TIERS.single);
/** Part B's late-enrollment penalty: 10% for each full 12 months you could have had it and did not, for as long as you have Part B. */
export const LATE_PENALTY = 0.10;
