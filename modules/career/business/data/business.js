// modules/career/business/data/business.js -- the figures a small business's owner runs into, each checked 2026-10-30.
// Home office, simplified method: $5 a square foot, at most 300 square feet (Rev. Proc. 2013-13; IRS "Simplified option
// for home office deduction", reviewed March 2026). SIMPLE IRA: IRS Notice 2025-67 (2026). The 20% business deduction's
// income line where its limits begin, and the width over which they phase in: Rev. Proc. 2025-32 section 4.26 and IRC
// 199A as amended by P.L. 119-21 section 70105 (permanent; $75,000 / $150,000 wide from 2026).
export const HOME_OFFICE = { perSqft: 5, maxSqft: 300 };
export const SIMPLE = {
  2026: { limit: 17000, catchUp: 4000, superCatchUp: { from: 60, to: 63, amount: 5250 }, match: 0.03 },
  2025: { limit: 16500, catchUp: 3500, superCatchUp: { from: 60, to: 63, amount: 5250 }, match: 0.03 },
};
export const QBI_LINE = {
  2026: { single: 201750, head_of_household: 201750, married_joint: 403500, qualifying_surviving: 201750, married_separate: 201775, width: { married_joint: 150000, other: 75000 } },
};
/** What running an S corporation adds a year (payroll service, the corporate return, state fees): an example to replace with real quotes. */
export const SCORP_COSTS_EXAMPLE = 2000;
export const forYear = (T, year) => T[year] ?? T[Math.max(...Object.keys(T).map(Number).filter((y) => y <= year))] ?? T[Math.min(...Object.keys(T).map(Number))];
