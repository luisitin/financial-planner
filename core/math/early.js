// core/math/early.js -- money taken out of a pre-tax retirement account before 59½. PURE.
//
// The extra 10% (IRC 72(t)(1)), the two ways around it the plan can count (leaving a job in or after the year you turn 55,
// IRC 72(t)(2)(A)(v); a series of substantially equal periodic payments, IRC 72(t)(2)(A)(iv), "72(t) payments") and the sums of
// the equal payments (IRS Notice 2022-6). The year-by-year engine (core/math/retirement.js) charges the 10% from the `early`
// input that modules/retirement/projection/compute.js builds with these helpers; Money before 59½
// (modules/retirement/early-access) shows it. Sources and read dates: that page's README.
//
// The two date rules below are the Federal estimate's own (modules/taxes/federal/known.js shareBefore59Half and
// leftWorkAt55), written again here because that file imports the projection and core/ imports no module; the page's
// module test holds the two pairs to the same answer over a grid of birth dates, ages and years.
import { singleLife } from "./rmd.js";

/** The extra tax on a withdrawal before 59½: 10% of the taxable part (IRC 72(t)(1); Form 5329 Part I). */
export const EARLY_RATE = 0.1;
/** The most interest the equal payments may be worked out at, whatever the federal rates are: 5% (Notice 2022-6 section
 * 3.02(c): "not more than the greater of 5% or 120% of the federal mid-term rate" for either of the two months before the
 * first payment). The 120% figure changes every month and is not in the app: a person types it. */
export const SEPP_RATE_FLOOR = 0.05;
export const SEPP_METHODS = Object.freeze(["amortization", "rmd"]);
/** A first year before the owner's 25th birthday year is a slip (a stored 1900): such a series is not counted. Our own line,
 * not the law's (the rule has no youngest age); it keeps a mistyped year from running a series for decades. */
export const SEPP_MIN_AGE = 25;
/** A typed yearly amount above this share of what the account holds today is worth a second look: at the most interest the
 * page takes (10%) a new series for someone of 59 is under 11% of the account, so a fifth leaves room for an account that has
 * shrunk since the amount was set. Our own line. */
export const SEPP_YEARLY_CHECK = 0.2;
/** The equal payments run at least this many years from the first one (IRC 72(t)(4)(A)(ii)(I)). */
export const SEPP_MIN_YEARS = 5;

const dateOf = (birth) => {
  if (typeof birth === "number") return Number.isFinite(birth) && birth > 0 ? [birth, 1, 1] : null;   // a year alone counts as January 1
  const s = String(birth ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return [Number(s.slice(0, 4)), Number(s.slice(5, 7)), Number(s.slice(8, 10))];
  return /^\d{4}$/.test(s) ? [Number(s), 1, 1] : null;
};
const halfOf = (birth) => {
  const d = dateOf(birth);
  if (!d) return null;
  // six months on, the same day; a month too short for it (August 31 -> February) gives its last day
  const m = d[1] + 6, y = d[0] + 59 + (m > 12 ? 1 : 0), mo = m > 12 ? m - 12 : m;
  return Date.UTC(y, mo - 1, Math.min(d[2], new Date(Date.UTC(y, mo, 0)).getUTCDate()));
};
/**
 * The share of calendar year `year` before the person reaches 59½ (IRC 72(t)(2)(A)(i): a distribution "made on or after the
 * date on which the employee attains age 59½" owes no extra 10%): 1 when the half-birthday is after December 31, 0 when it is
 * on or before January 1, else the share of the year's days before it. `birth`: "YYYY-MM-DD", or a year (January 1). null
 * without one.
 */
export function shareBefore59Half(birth, year) {
  const half = halfOf(birth);
  if (half === null) return null;
  const start = Date.UTC(year, 0, 1), end = Date.UTC(year + 1, 0, 1);
  if (half >= end) return 1;
  if (half <= start) return 0;
  return (half - start) / (end - start);
}
/**
 * halfYear(birth) -> { year, share } | null: the last calendar year with any day before 59½, and the share of that year
 * before it (0 < share <= 1). Every earlier year is wholly before 59½, every later year wholly after.
 */
export function halfYear(birth) {
  const half = halfOf(birth);
  if (half === null) return null;
  const y = new Date(half).getUTCFullYear();
  const share = shareBefore59Half(birth, y);
  return share > 0 ? { year: y, share } : { year: y - 1, share: 1 };   // 59½ on January 1: the year before is the last one
}
/**
 * The year a person left work, when that was in or after the year they turned 55 and the plan holds their own retirement
 * age (`retirementAge` typed, 55 or more): from that year on, money paid out of that job's 401(k) owes no extra 10% (IRC
 * 72(t)(2)(A)(v); workplace plans only, never an IRA). The year, not the birthday, as the IRS reads it in Publication 575
 * (2025): "after your separation from service in or after the year you reached age 55", and in the Form 5329 instructions
 * (2025), exception 01 (both read at irs.gov 2026-11-14). null otherwise.
 */
export function leftAt55Year(person) {
  const ra = Number(person?.retirementAge), by = Number(String(person?.birthDate ?? "").slice(0, 4));
  return person?.retirementAge != null && person?.retirementAge !== "" && Number.isFinite(ra) && ra >= 55 && by > 0 ? by + ra : null;
}

/**
 * Equal payments, the same each year (Notice 2022-6 section 3.01(b), the fixed amortization method): the balance paid off in
 * level yearly amounts over the life expectancy at the starting age, at a chosen interest rate.
 *   P = B x r / (1 - (1 + r)^-n),  n = the Single Life Table's figure at the age reached in the first year  (r = 0: B / n)
 * Worked once, in the first year, and never again.
 */
export function seppAmortized(balance, rate, age) {
  const B = Number(balance) || 0, r = Number(rate) || 0, n = singleLife(age);
  if (!(B > 0) || !(n > 0)) return 0;
  return r > 0 ? (B * r) / (1 - Math.pow(1 + r, -n)) : B / n;
}
/**
 * Equal payments, recalculated each year (section 3.01(a), the required minimum distribution method): each year's balance
 * divided by the Single Life Table's figure at the age reached that year. It moves with the account.
 */
export function seppRecalculated(balance, age) {
  const B = Number(balance) || 0, n = singleLife(age);
  return B > 0 && n > 0 ? B / n : 0;
}
/** One year's payment by either way (`fixed`: the amount worked out in the first year, for "amortization"). */
export const seppPayment = (method, { balance, rate, age, fixed = null }) => (method === "rmd" ? seppRecalculated(balance, age) : fixed ?? seppAmortized(balance, rate, age));
/** The most interest allowed: the greater of 5% and 120% of the federal mid-term rate (typed; none typed: 5%). */
export const seppRateCap = (midTerm120 = null) => Math.max(SEPP_RATE_FLOOR, Number(midTerm120) > 0 && Number(midTerm120) < 1 ? Number(midTerm120) : 0);
/**
 * The last calendar year a payment is counted: they run to the later of five years from the first payment and the day the
 * person reaches 59½ (IRC 72(t)(4)(A)(ii)). With one payment a year from `startYear`: five payments at least, and one in
 * every year that still has days before 59½ (`half`: halfYear(birth)). The rule itself holds a little longer when the five
 * years are the later end: to the first payment's fifth anniversary, in startYear + 5 (seppEnd below).
 */
export const seppLastYear = (startYear, half) => Math.max(startYear + SEPP_MIN_YEARS - 1, half?.year ?? -Infinity);
/**
 * When the rule lets go of the account: the later of the fifth anniversary of the first payment and the day the owner reaches
 * 59½. Until then nothing but the payments may come out of it and nothing may go in (IRC 72(t)(4)(A)(ii); Notice 2022-6
 * section 3.02(e); IRS "Substantially equal periodic payments", Q&A 2 and 13, read at irs.gov 2026-11-14). The anniversary
 * falls in startYear + 5, a year after the fifth yearly payment: Q&A 13's owner, born August 15, 1968, first paid on
 * December 1, 2024, "may not take a distribution that is not part of the SoSEPP or modify the annual amount until December 1,
 * 2029". The day in that year is not on file, so a 59½ that falls in the same calendar year cannot be ordered against it.
 * -> { year, by: "five" (the anniversary is later) | "half" (59½ is later) | "either" (both fall in `year`) } | null
 */
export function seppEnd(startYear, birth) {
  const half = halfOf(birth), s = Math.round(Number(startYear));
  if (half === null || !Number.isFinite(s)) return null;
  const five = s + SEPP_MIN_YEARS, hy = new Date(half).getUTCFullYear();
  return { year: Math.max(five, hy), by: hy > five ? "half" : hy < five ? "five" : "either" };
}

/**
 * The share of the year's other pre-tax withdrawals that owes the extra 10%, from the engine's `early.owners`
 * ([{ personIndex, halfYear, halfShare, leftYear, at55Part, freePart?, share? }]): each adult's part of the pre-tax money that year
 * (`shareOf(owner)`: the engine follows each owner's 401(k)s and IRAs in dollars; without it the owner's own `share`), for the
 * share of the year they are under 59½ (`halfYear`, `halfShare`: halfYear()), less the part of it in the 401(k) of a job they
 * left at 55 or later (`at55Part` of their money, from `leftYear` on). Money in the bucket that is nobody's 401(k) or IRA
 * (life-insurance cash value) owes none.
 * -> { owes, at55 }: the share that owes it, and the share spared by the age-55 rule (each 0 to 1).
 */
export function earlyShares(owners, year, shareOf = (o) => Number(o.share) || 0) {
  let owes = 0, at55 = 0;
  for (const o of owners ?? []) {
    const before = year < o.halfYear ? 1 : year === o.halfYear ? Number(o.halfShare) || 0 : 0;
    if (!(before > 0)) continue;
    // money that came from someone who died owes none at any age (IRC 72(t)(2)(A)(ii)): `freePart` of this owner's money
    const dead = Math.min(1, Math.max(0, Number(o.freePart) || 0));
    const free = Math.min(1 - dead, o.leftYear !== null && o.leftYear !== undefined && year >= o.leftYear ? Math.max(0, Number(o.at55Part) || 0) : 0);
    const part = before * Math.max(0, Number(shareOf(o)) || 0);
    owes += part * (1 - free - dead); at55 += part * free;
  }
  const clamp = (x) => Math.min(1, Math.max(0, x));
  return { owes: clamp(owes), at55: clamp(at55) };
}
/** The share that owes the 10% alone (earlyShares().owes). */
export const earlyShare = (owners, year, shareOf) => earlyShares(owners, year, shareOf).owes;
