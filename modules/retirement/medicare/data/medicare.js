// modules/retirement/medicare/data/medicare.js -- Medicare premiums and the income-related monthly adjustment
// amounts (IRMAA) for 2026. Sources (read 2026-10-31): CMS fact sheet "2026 Medicare Parts B Premiums and
// Deductibles" (November 14, 2025; Part B, the deductible, the IRMAA tiers and the Part D add-ons),
// https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles ; CMS fact sheet
// "Medicare Part D 2026 National Average Monthly Bid Amount Information" (July 28, 2025; the $38.99 base premium);
// for 2027 the CMS fact sheet of July 28, 2026 (base premium $41.33, the 6% yearly cap of the 2022 Inflation
// Reduction Act), https://www.cms.gov/newsroom/fact-sheets/medicare-part-d-2027-national-average-monthly-bid-amount-information .
// The tiers use the tax return from two years before (2026 premiums: 2024 income). Update each November,
// when CMS publishes the next year's Part B figures; the page keeps every figure of one year together. The supplement's
// default (MEDIGAP_G) is a 2025 figure: update it when KFF publishes the next year's Medigap premiums (October).

export const YEAR = 2026;
/** The standard Part B premium a month, and the yearly Part B deductible. */
export const PART_B = 202.90, PART_B_DEDUCTIBLE = 283;
/** The national base beneficiary premium for a drug plan (Part D), a month; real plans vary around it. */
export const PART_D_BASE = 38.99;
/** The next year's base premium, published before its Part B figures (CMS, July 28, 2026): shown, not yet used. */
export const PART_D_BASE_NEXT = { year: 2027, amount: 41.33 };
/**
 * A supplement's premium when none is entered (review 2026-11-06, seventh pass: the plan counted $0 beyond Part B and the
 * drug plan, so swapping a health premium for Medicare looked too good): the national average monthly premium among people
 * with Medigap Plan G, the most common supplement (46% of Medigap policyholders), in 2025: $194 ($2,323 a year). Source: KFF,
 * "Key Facts About Medigap Enrollment and Premiums for Medicare Beneficiaries" (Freed, Ochieng and Cubanski, October 13,
 * 2026), from the insurers' filings with state regulators (NAIC data, Mark Farrah Associates), read 2026-11-06,
 * https://www.kff.org/medicare/key-facts-about-medigap-enrollment-and-premiums-for-medicare-beneficiaries/ . The same series
 * is the one MedPAC uses (June 2026 Report to the Congress, chapter 2: $217 for all Medigap policies and $164 for Plan G in
 * 2023). Premiums vary by state ($164 in New Mexico to $257 in New York for Plan G), age and insurer; the page asks for your own.
 */
export const MEDIGAP_G = { monthly: 194, year: 2025, read: "2026-11-06" };
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
