// core/math/periods.js -- how often money comes in or goes out, and how to put amounts
// with different periods on the same footing (per month, per year). PURE. Used by income,
// expenses, liquidity, goals and every cash-flow page, so the list of periods lives here.
//
// PERIODS[key].perYear is how many times a year the amount happens. "once" is a one-off:
// it counts in a yearly total only when it falls inside the year in question, so the
// helpers here treat it as 0 per year and pages decide what to do with it.
export const PERIODS = {
  weekly:      { label: "Every week",        perYear: 52 },
  biweekly:    { label: "Every two weeks",   perYear: 26 },
  semimonthly: { label: "Twice a month",     perYear: 24 },
  monthly:     { label: "Every month",       perYear: 12 },
  quarterly:   { label: "Every three months", perYear: 4 },
  annual:      { label: "Once a year",       perYear: 1 },
  once:        { label: "One time only",     perYear: 0 },
};
export const PERIOD_OPTIONS = Object.entries(PERIODS).map(([value, p]) => ({ value, label: p.label }));

const times = (period) => (PERIODS[period] ?? PERIODS.monthly).perYear;
/** Amount per year for `amount` every `period`. A one-off counts as 0 per year. */
export const perYear = (amount, period) => (Number(amount) || 0) * times(period);
/** Amount per month: the yearly amount divided by 12 (so "every two weeks" is 26/12 of the amount). */
export const perMonth = (amount, period) => perYear(amount, period) / 12;
/** The label for a period key, for screens. */
export const periodLabel = (period) => (PERIODS[period] ?? PERIODS.monthly).label;
/**
 * Whether something with optional startDate / endDate (ISO "YYYY-MM-DD") is active on `today`.
 * Missing start means "already started"; missing end means "no end".
 */
export function activeOn(item, today) {
  const t = String(today ?? "");
  if (item?.startDate && String(item.startDate) > t) return false;
  if (item?.endDate && String(item.endDate) < t) return false;
  return true;
}
