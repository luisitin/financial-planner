// core/math/returns.js -- investment returns done properly. PURE.
//   xirr:        the money-weighted return (IRR with real dates), what YOU earned given when the money went in and out
//   twr:         the time-weighted return, what the INVESTMENTS earned regardless of your deposit timing (chain-linked between flows)
//   cagr, growth, maxDrawdown, seriesStats, mixReturns: the helpers behind the risk and backtest pages
// Conventions: dates are ISO "YYYY-MM-DD"; a year is 365.25 days; rates are fractions.
const DAY = 86400000;
const toDate = (d) => d instanceof Date ? d : new Date(`${String(d).slice(0, 10)}T00:00:00`);
const yearsBetween = (a, b) => (toDate(b) - toDate(a)) / DAY / 365.25;

/**
 * xirr(flows) -> yearly rate or null. flows: [{ date, amount }] with money you put in NEGATIVE and money you took
 * out (and the ending value) POSITIVE, the way a bank would see it. Newton's method from a guess, bisection when it wanders.
 */
export function xirr(flows, guess = 0.07) {
  const f = (flows ?? []).filter((x) => Number.isFinite(Number(x.amount)) && x.date).map((x) => ({ t: 0, d: toDate(x.date), a: Number(x.amount) })).sort((a, b) => a.d - b.d);
  if (f.length < 2 || !f.some((x) => x.a < 0) || !f.some((x) => x.a > 0)) return null;
  const t0 = f[0].d;
  for (const x of f) x.t = (x.d - t0) / DAY / 365.25;
  const npv = (r) => f.reduce((s, x) => s + x.a / Math.pow(1 + r, x.t), 0);
  const dnpv = (r) => f.reduce((s, x) => s - x.t * x.a / Math.pow(1 + r, x.t + 1), 0);
  let r = guess;
  for (let i = 0; i < 50; i++) {
    const v = npv(r), dv = dnpv(r);
    if (!Number.isFinite(v) || !Number.isFinite(dv) || dv === 0) break;
    const next = r - v / dv;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }
  // bisection between -99% and +1000%
  let lo = -0.9999, hi = 10, vlo = npv(lo), vhi = npv(hi);
  if (!Number.isFinite(vlo) || !Number.isFinite(vhi) || vlo * vhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, vm = npv(mid);
    if (Math.abs(vm) < 1e-8 || hi - lo < 1e-10) return mid;
    if (vm * vlo < 0) { hi = mid; vhi = vm; } else { lo = mid; vlo = vm; }
  }
  return (lo + hi) / 2;
}

/**
 * twr(points) -> { total, annualised, years, periods: [{ from, to, rate }] } or null.
 * points: [{ date, value, flow }] valuations in date order; `flow` is the net money that went IN just before that
 * valuation (deposits positive, withdrawals negative; 0 or missing on plain valuation dates). Each sub-period's return
 * is (value - flow) / previous value - 1; the total chain-links them.
 */
export function twr(points) {
  const p = (points ?? []).filter((x) => x.date && Number.isFinite(Number(x.value))).map((x) => ({ date: String(x.date).slice(0, 10), value: Number(x.value), flow: Number(x.flow) || 0 })).sort((a, b) => a.date < b.date ? -1 : 1);
  if (p.length < 2) return null;
  const periods = [];
  let total = 1;
  for (let i = 1; i < p.length; i++) {
    const prev = p[i - 1].value;
    if (prev <= 0) continue;
    const rate = (p[i].value - p[i].flow) / prev - 1;
    periods.push({ from: p[i - 1].date, to: p[i].date, rate });
    total *= 1 + rate;
  }
  if (!periods.length) return null;
  const years = yearsBetween(p[0].date, p[p.length - 1].date);
  return { total: total - 1, annualised: years > 0 ? Math.pow(total, 1 / years) - 1 : total - 1, years, periods };
}

/** Compound yearly growth rate from a start value to an end value over `years`. */
export const cagr = (start, end, years) => start > 0 && years > 0 ? Math.pow(end / start, 1 / years) - 1 : null;

/** Cumulative values from a list of yearly returns, starting at `start`. */
export const growth = (returns, start = 1) => { const out = [start]; for (const r of returns) out.push(out[out.length - 1] * (1 + r)); return out; };

/** The biggest peak-to-trough fall in a series of values: { depth (fraction, positive), peakIndex, troughIndex, recoveryIndex (null if never) }. */
export function maxDrawdown(values) {
  let peak = -Infinity, peakI = 0, best = { depth: 0, peakIndex: 0, troughIndex: 0, recoveryIndex: 0 };
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v > peak) { peak = v; peakI = i; }
    const depth = peak > 0 ? 1 - v / peak : 0;
    if (depth > best.depth) best = { depth, peakIndex: peakI, troughIndex: i, recoveryIndex: null };
  }
  if (best.depth > 0 && best.recoveryIndex === null) {
    const peakValue = values[best.peakIndex];
    for (let i = best.troughIndex + 1; i < values.length; i++) if (values[i] >= peakValue) { best.recoveryIndex = i; break; }
  }
  return best;
}

/** Plain statistics of a list of yearly returns. */
export function seriesStats(returns) {
  const r = (returns ?? []).filter((x) => Number.isFinite(x));
  const n = r.length;
  if (!n) return { n: 0, mean: null, stdev: null, geometric: null, best: null, worst: null, lossYears: 0, lossShare: 0 };
  const mean = r.reduce((s, x) => s + x, 0) / n;
  const stdev = n > 1 ? Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const geometric = Math.pow(r.reduce((p, x) => p * (1 + x), 1), 1 / n) - 1;
  const lossYears = r.filter((x) => x < 0).length;
  return { n, mean, stdev, geometric, best: Math.max(...r), worst: Math.min(...r), lossYears, lossShare: lossYears / n };
}

/** Yearly returns of a mix rebalanced every year: weights { stocks, bonds, bills } (fractions) over history rows { stocks, bonds, bills }. */
export const mixReturns = (history, weights) => history.map((y) => (weights.stocks ?? 0) * y.stocks + (weights.bonds ?? 0) * y.bonds + (weights.bills ?? 0) * (y.bills ?? 0));
