// modules/career/business/data/business.js -- the figures a small business's owner runs into, each checked 2026-10-30.
// Home office, simplified method: $5 a square foot, at most 300 square feet (Rev. Proc. 2013-13; IRS "Simplified option
// for home office deduction", reviewed March 2026). SIMPLE IRA: IRS Notice 2025-67 (2026). The 20% business deduction's
// income line where its limits begin, and the width over which they phase in: Rev. Proc. 2025-32 section 4.26 (2026),
// Rev. Proc. 2024-40 section 2.27 (2025) and IRC 199A as amended by P.L. 119-21 section 70105 (permanent; $75,000 /
// $150,000 wide from 2026).
export const HOME_OFFICE = { perSqft: 5, maxSqft: 300 };
// small: the higher limits of IRC 408(p)(2)(E)(i)(I) for an employer with no more than 25 employees paid $5,000 or more
// the year before (a one-person business); general: the others (Notice 2025-67; Notice 2024-80 for 2025). Catch-up:
// small 110% of 2024's $3,500 (IRC 414(v)(2)(B)(iii)), general the indexed $2,500 ((B)(ii)); 60 to 63, the same in
// both: the greater of $5,000 or 150% of 2025's general one ((E)(ii)). Match: the deferral up to 3% of pay (IRC
// 408(p)(2)(A)(iii), (C)(ii)(I)).
export const SIMPLE = {
  2026: { small: { limit: 18100, catchUp: 3850 }, general: { limit: 17000, catchUp: 4000 }, superCatchUp: { from: 60, to: 63, amount: 5250 }, match: 0.03 },
  2025: { small: { limit: 17600, catchUp: 3850 }, general: { limit: 16500, catchUp: 3500 }, superCatchUp: { from: 60, to: 63, amount: 5250 }, match: 0.03 },
};
/**
 * A new SIMPLE IRA for a year must be set up by October 1 of that year when the employer never had one (IRS "SIMPLE IRA
 * plan", reviewed 2 Apr 2026; IRS Publication 560); one that had one can start only on January 1, and a business that
 * begins after October 1 sets one up as soon as it can. Month-day.
 */
export const SIMPLE_DEADLINE = "10-01";
/** The smallest 20% business deduction from 2026 for an active business with at least $1,000 of it (IRC 199A(i), P.L. 119-21 section 70105). */
export const QBI_MINIMUM = { 2025: { amount: 0, from: Infinity }, 2026: { amount: 400, from: 1000 } };
export const QBI_LINE = {
  2025: { single: 197300, head_of_household: 197300, married_joint: 394600, qualifying_surviving: 197300, married_separate: 197300, width: { married_joint: 100000, other: 50000 } },
  2026: { single: 201750, head_of_household: 201750, married_joint: 403500, qualifying_surviving: 201750, married_separate: 201775, width: { married_joint: 150000, other: 75000 } },
};
/** What running an S corporation adds a year (payroll service, the corporate return, state fees): an example to replace with real quotes. */
export const SCORP_COSTS_EXAMPLE = 2000;
export const forYear = (T, year) => T[year] ?? T[Math.max(...Object.keys(T).map(Number).filter((y) => y <= year))] ?? T[Math.min(...Object.keys(T).map(Number))];
