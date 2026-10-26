// core/math/finance.js -- time-value-of-money and loan math. PURE functions, no
// DOM, no plan access, importable by the browser, the server and the tests.
//
// Sign convention (simpler than Excel's): amounts you put in and the result are
// both positive. `rate` is per period as a fraction (0.05 = 5%), `n` is periods.
// Every formula below has a test in tests/finance.test.mjs -- add one when you add
// a function.

/** Future value of a lump sum plus a level payment each period. */
export function fv(rate, n, pmt = 0, pv = 0, due = false) {
  if (rate === 0) return pv + pmt * n;
  const g = Math.pow(1 + rate, n);
  return pv * g + pmt * ((g - 1) / rate) * (due ? 1 + rate : 1);
}
/** Present value of a future lump sum plus a level payment each period. */
export function pv(rate, n, pmt = 0, fvAmount = 0, due = false) {
  if (rate === 0) return fvAmount + pmt * n;
  const g = Math.pow(1 + rate, n);
  return fvAmount / g + pmt * ((1 - 1 / g) / rate) * (due ? 1 + rate : 1);
}
/** Level payment that amortises `principal` over `n` periods at `rate` per period. */
export function pmt(rate, n, principal, fvAmount = 0, due = false) {
  if (n <= 0) return 0;
  if (rate === 0) return (principal + fvAmount) / n;
  const g = Math.pow(1 + rate, n);
  const p = (principal * g + fvAmount) * rate / (g - 1);
  return due ? p / (1 + rate) : p;
}
/** Payment needed each period to reach `target` in `n` periods starting from `start`. */
export function pmtToReach(rate, n, target, start = 0) {
  if (n <= 0) return Math.max(0, target - start);
  if (rate === 0) return (target - start) / n;
  const g = Math.pow(1 + rate, n);
  return (target - start * g) * rate / (g - 1);
}
/** Number of periods to pay `principal` down to zero at `payment` per period. Infinity if it never does. */
export function nper(rate, payment, principal) {
  if (payment <= 0) return Infinity;
  if (rate === 0) return principal / payment;
  const x = 1 - (principal * rate) / payment;
  if (x <= 0) return Infinity;
  return -Math.log(x) / Math.log(1 + rate);
}
/**
 * Full amortisation schedule.
 * { principal, annualRate, years, paymentsPerYear = 12, extraPayment = 0, payment? }
 * -> { payment, periods, totalInterest, totalPaid, payoffYears, schedule: [{ period, payment, interest, principal, balance }] }
 */
export function amortization({ principal, annualRate, years, paymentsPerYear = 12, extraPayment = 0, payment }) {
  const r = annualRate / paymentsPerYear;
  const n = Math.round(years * paymentsPerYear);
  const base = payment ?? pmt(r, n, principal);
  const schedule = [];
  let balance = principal, totalInterest = 0, totalPaid = 0, period = 0;
  while (balance > 0.005 && period < n * 4) {
    period++;
    const interest = balance * r;
    let pay = Math.min(base + extraPayment, balance + interest);
    const princ = pay - interest;
    balance -= princ;
    totalInterest += interest; totalPaid += pay;
    schedule.push({ period, payment: round2(pay), interest: round2(interest), principal: round2(princ), balance: round2(Math.max(0, balance)) });
  }
  return { payment: round2(base), periods: period, totalInterest: round2(totalInterest), totalPaid: round2(totalPaid), payoffYears: round2(period / paymentsPerYear), schedule };
}
export const cagr = (start, end, years) => (start > 0 && years > 0) ? Math.pow(end / start, 1 / years) - 1 : 0;
/** Real (inflation-adjusted) rate from a nominal rate. */
export const realRate = (nominal, inflation) => (1 + nominal) / (1 + inflation) - 1;
/** What `amount` today costs in `years` at `rate` inflation. */
export const inflate = (amount, rate, years) => amount * Math.pow(1 + rate, years);
/** Today's purchasing power of a future `amount`. */
export const deflate = (amount, rate, years) => amount / Math.pow(1 + rate, years);
export const round2 = (x) => Math.round(x * 100) / 100;
