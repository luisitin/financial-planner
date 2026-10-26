// core/math/dates.js -- calendar arithmetic on plan dates ("YYYY-MM-DD", no time zone).
// PURE. Days are counted on the local calendar; nothing here looks at the clock, so pass
// `today` in from the caller (views use ctx.fmt.today(); tests pass a fixed day).
const parse = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim()); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
const pad = (n) => String(n).padStart(2, "0");
/** Build "YYYY-MM-DD" from parts; overflowing months/days roll over like Date does. */
export function isoOf(y, m, d) { const dt = new Date(y, m - 1, d); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`; }
export const isValidDate = (iso) => { const p = parse(iso); return !!p && isoOf(p.y, p.m, p.d) === String(iso).trim(); };
/** Whole years between two dates, birthday-aware: ageOn("2000-06-15", "2026-06-14") is 25, on "2026-06-15" it is 26. */
export function ageOn(birth, today) {
  const b = parse(birth), t = parse(today);
  if (!b || !t) return null;
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age--;
  return age;
}
/** Whole months from `from` to `to` (negative if `to` is earlier); the day of month must be reached to count the month. */
export function monthsBetween(from, to) {
  const a = parse(from), b = parse(to);
  if (!a || !b) return null;
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months--;
  return months;
}
/** Fractional years from `from` to `to` (months / 12), for growth and discounting. */
export const yearsBetween = (from, to) => { const m = monthsBetween(from, to); return m === null ? null : m / 12; };
/** `iso` plus `n` months (clamped to the last day of the target month). */
export function addMonths(iso, n) {
  const p = parse(iso); if (!p) return null;
  const first = new Date(p.y, p.m - 1 + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return isoOf(first.getFullYear(), first.getMonth() + 1, Math.min(p.d, last));
}
/** The date on which someone born `birth` turns `age`. */
export function dateAtAge(birth, age) { const p = parse(birth); return p ? isoOf(p.y + Number(age), p.m, p.d) : null; }
/** Days from `from` to `to` (negative if earlier). */
export function daysBetween(from, to) {
  const a = parse(from), b = parse(to);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}
