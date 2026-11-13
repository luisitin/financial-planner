// modules/taxes/estimated/data/rates.js -- PURE DATA. The IRS underpayment rate for individuals, by calendar quarter: the
// rate the penalty for paying estimated tax late runs at (IRC 6654(a) applies "the underpayment rate established under
// section 6621"; IRC 6621(a)(2): the federal short-term rate plus 3 percentage points, set for each calendar quarter).
//
// Source, read 2026-11-13: IRS, "Quarterly interest rates" (irs.gov/payments/quarterly-interest-rates), the row
// "Underpayment (corporate and non-corporate)": 2024 8% in every quarter (IRB 2023-49, 2024-10, 2024-24, 2024-37); 2025
// 7% in every quarter (IRB 2024-49, 2025-13, 2025-23, 2025-37); 2026 7%, 6%, 7%, 7% (IRB 2025-48, 2026-08, 2026-22,
// 2026-36). The fourth quarter of 2026: IRS newsroom IR-2026-98 (August 21, 2026), "Interest rates remain the same for
// the fourth quarter of 2026": "For individuals, the rate for overpayments and underpayments will be 7% per year",
// Rev. Rul. 2026-15. The first quarter of 2027 was not published on 2026-11-13: a date after the newest quarter here
// takes the newest rate, and the page says it is "the rate through" that quarter's last day (estimated/compute.js rateOn).
//
// Add a quarter when the IRS announces it (about six weeks before it starts), with its bulletin in the line above.
export const UNDERPAYMENT_RATES = Object.freeze({
  "2024Q1": 0.08, "2024Q2": 0.08, "2024Q3": 0.08, "2024Q4": 0.08,
  "2025Q1": 0.07, "2025Q2": 0.07, "2025Q3": 0.07, "2025Q4": 0.07,
  "2026Q1": 0.07, "2026Q2": 0.06, "2026Q3": 0.07, "2026Q4": 0.07,
});
/** The day the table was last checked against the IRS page. */
export const RATES_READ = "2026-11-13";
