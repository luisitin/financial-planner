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

/** Paychecks a year assumed for pay typed as a yearly or quarterly figure (the Paycheck page's default: every two weeks). */
export const ASSUMED_PAYCHECKS = 26;
const PAY_PERIOD = { 52: "weekly", 26: "biweekly", 24: "semimonthly", 12: "monthly" };
/**
 * payRhythm(item, plan) -> { period, perPay, count, words } | null. A salary typed as a yearly (or quarterly) figure is
 * paid in paychecks, not once a year: the count the Paycheck page has for that person (`whatIfs.paycheck[personId]
 * .paychecks`), else ASSUMED_PAYCHECKS. Forecast puts the paydays in, Income and Bills say "a year, paid every two weeks".
 * Anything else (a bonus, rent, a weekly salary) is null: it lands as typed.
 */
export function payRhythm(item, plan) {
  if (!item || item.type !== "salary" || (item.period !== "annual" && item.period !== "quarterly")) return null;
  const typed = Number(plan?.whatIfs?.paycheck?.[item.personId]?.paychecks);
  const count = PAY_PERIOD[typed] ? typed : ASSUMED_PAYCHECKS;
  const period = PAY_PERIOD[count];
  return { period, count, perPay: perYear(item.amount, item.period) / count, words: `paid ${PERIODS[period].label.toLowerCase()}` };
}
