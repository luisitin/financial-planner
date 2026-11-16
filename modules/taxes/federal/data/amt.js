// modules/taxes/federal/data/amt.js -- the alternative minimum tax figures the Federal estimate uses, by tax year. 2025 and
// 2026 are Equity compensation's table (one source for both pages: modules/career/equity/data/amt.js, from Rev. Proc.
// 2024-40 section 3.11 and Rev. Proc. 2025-32 section 4.10, both read again at irs.gov on 2026-11-16 and matching); 2024 is
// added here for the Federal estimate's earlier year, from Rev. Proc. 2023-34 section 3.11 (read at irs.gov 2026-11-16):
// exemption $85,700 unmarried, $133,300 joint or surviving spouse, $66,650 separate; the phase-out from $609,350 /
// $1,218,700 / $609,350 at 25 cents a dollar (complete at $952,150 / $1,751,900 / $875,950); 28% above $232,600 of the
// excess ($116,300 separate). Add each year to Equity compensation's table from the autumn revenue procedure.
import { AMT as EQUITY } from "../../../career/equity/data/amt.js";

export const AMT = {
  2024: {
    exemption: { single: 85700, head_of_household: 85700, married_joint: 133300, qualifying_surviving: 133300, married_separate: 66650 },
    phaseOutStart: { single: 609350, head_of_household: 609350, married_joint: 1218700, qualifying_surviving: 1218700, married_separate: 609350 },
    phaseOutRate: 0.25,
    rate28From: { all: 232600, married_separate: 116300 },
  },
  ...EQUITY,
};

/** The figures for tax year `year`: its own, else the latest year before it (a year past the table: the last one, not raised for inflation), else the first. */
export function amtTableFor(year) {
  const years = Object.keys(AMT).map(Number).sort((a, b) => a - b);
  const y = Number(year);
  if (AMT[y]) return AMT[y];
  const before = years.filter((x) => x <= y).pop();
  return AMT[before ?? years[0]];
}
