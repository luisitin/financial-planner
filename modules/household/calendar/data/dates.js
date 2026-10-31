// modules/household/calendar/data/dates.js -- the dated facts the money calendar uses, each with its source.
// Fixed in law or regulation unless a year is named; a year-specific window is listed only for the years checked.

/**
 * The Health Insurance Marketplace's open enrollment, by the plan year it buys: opens, the last day for coverage from
 * January 1, and closes. Only years checked are listed; add each new year from CMS's plan-year fact sheet.
 * 2027: CMS, "Plan Year 2027 Marketplace Plans and Prices Fact Sheet"
 * (https://www.cms.gov/newsroom/fact-sheets/plan-year-2027-marketplace-plans-prices-fact-sheet-0) and HealthCare.gov,
 * "When can you get health insurance?" (https://www.healthcare.gov/quick-guide/dates-and-deadlines/); read 2026-10-31.
 */
export const MARKETPLACE = {
  2027: { opens: "2026-11-01", forJanuary: "2026-12-15", closes: "2027-01-15" },
};

/** Medicare's open enrollment: October 15 to December 7 every year (42 CFR 422.62(a)(2); Medicare.gov, "Open Enrollment"). */
export const MEDICARE_OPEN = { from: [10, 15], to: [12, 7] };
