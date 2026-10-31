// modules/career/equity/data/amt.js -- the alternative minimum tax figures by year (IRC 55). Exemption, the income
// where the exemption starts to shrink and how fast (25 cents a dollar to 2025, IRC 55(d)(2); 50 cents from 2026, IRC
// 55(d)(4)(A)(ii)(IV), added by P.L. 119-21 section 70107(c)), and where the 28% rate starts (26% below). Sources: IRS Rev. Proc. 2024-40 section 2.11 (2025) and Rev. Proc.
// 2025-32 section 4.10 (2026), both checked 2026-10-30. Add each year from the autumn revenue procedure.
export const AMT = {
  2025: {
    exemption: { single: 88100, head_of_household: 88100, married_joint: 137000, qualifying_surviving: 137000, married_separate: 68500 },
    phaseOutStart: { single: 626350, head_of_household: 626350, married_joint: 1252700, qualifying_surviving: 1252700, married_separate: 626350 },
    phaseOutRate: 0.25,
    rate28From: { all: 239100, married_separate: 119550 },
  },
  2026: {
    exemption: { single: 90100, head_of_household: 90100, married_joint: 140200, qualifying_surviving: 140200, married_separate: 70100 },
    phaseOutStart: { single: 500000, head_of_household: 500000, married_joint: 1000000, qualifying_surviving: 1000000, married_separate: 500000 },
    phaseOutRate: 0.5,
    rate28From: { all: 244500, married_separate: 122250 },
  },
};
export const amtFor = (year) => AMT[year] ?? AMT[Math.max(...Object.keys(AMT).map(Number).filter((y) => y <= year))] ?? AMT[Math.min(...Object.keys(AMT).map(Number))];
