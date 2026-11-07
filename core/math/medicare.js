// core/math/medicare.js -- PURE. When a person is enrolled in Medicare Part A without choosing it: at 65 or older and
// receiving Social Security. Used to stop HSA saving (IRC 223(b)(7); Pub. 969: "Beginning with the first month you are
// enrolled in Medicare, your contribution limit is zero"; the limit is prorated by month, Pub. 969's example 5,300 x 6 / 12).
// Part A is automatic for people getting Social Security benefits (medicare.gov "How do I sign up", read 2026-11-06); it starts
// the month a person turns 65, or the month before when the birthday is the 1st (medicare.gov "When does coverage start",
// read 2026-11-06), or, when Social Security begins after 65, six months before the month it begins (medicare.gov "When does
// Medicare coverage start", read 2026-11-07: "Your Part A coverage starts 6 months back from when you sign up or when you
// apply for benefits from Social Security ... Coverage can't start earlier than the month you turned 65"; Pub. 969: HSA money
// in a period of retroactive coverage is excess). The page assumes the person applied in the month benefits begin.
// Someone 65+ with no Social Security received is NOT inferred to be on Medicare (they may be covered by work and have delayed signing up).

const ymd = (s) => { const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(s ?? "")); return m ? { y: +m[1], m: +m[2], d: m[3] ? +m[3] : 1 } : null; };

/**
 * medicareFrom(year, { birthDate, socialSecurityStart }) -> { firstMonth: 1..12 | null, months: 0..12 }
 * `socialSecurityStart`: "received already" (true / "" / a date on or before the start of `year`), a date inside or before the year,
 * or null / false when none is received by December of `year`. firstMonth is the first month of `year` on Medicare Part A.
 */
export function medicareFrom(year, { birthDate = null, socialSecurityStart = null } = {}) {
  const b = ymd(birthDate);
  if (!b || socialSecurityStart === null || socialSecurityStart === false) return { firstMonth: null, months: 0 };
  // the month Part A would start on turning 65 (the month before when born on the 1st)
  let sy = b.y + 65, sm = b.m;
  if (b.d === 1) { sm -= 1; if (sm === 0) { sm = 12; sy -= 1; } }
  let startIdx = sy * 12 + (sm - 1);
  const ss = socialSecurityStart === true || socialSecurityStart === "" ? null : ymd(socialSecurityStart);
  if (ss) startIdx = Math.max(startIdx, ss.y * 12 + (ss.m - 1) - 6);   // Part A goes back 6 months, not before the 65th-birthday month
  const first = startIdx - year * 12 + 1;   // month number in `year`; <= 0 means before the year
  if (first > 12) return { firstMonth: null, months: 0 };
  const fm = Math.max(1, first);
  return { firstMonth: fm, months: 13 - fm };
}
