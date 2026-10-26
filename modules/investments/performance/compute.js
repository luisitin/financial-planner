// modules/investments/performance/compute.js -- PURE. What each investment account really
// earned between the balance points saved on the Net worth page: the time-weighted return
// (what the investments did, deposits stripped out, Modified Dietz within each period and
// chain-linked) and the money-weighted return (what YOU earned given when the money went in),
// against what the plan assumes and what a plain index mix did over the same calendar years.
import { xirr, cagr } from "../../../core/math/returns.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { perYear } from "../../../core/math/periods.js";
import { RETURNS } from "../../retirement/historical/data/returns.js";

const DAY = 86400000;
const days = (a, b) => (new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / DAY;

/** The deposits into one account between two dates: the ledger's transactions for it when there are any, else the contribution rate on the Contributions page. */
export function flowsBetween(plan, accountId, from, to, yearlyRate) {
  const tx = (plan.transactions ?? []).filter((t) => t.accountId === accountId && t.date > from && t.date <= to);
  if (tx.length) return tx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  return yearlyRate * Math.max(0, days(from, to)) / 365.25;
}

/** One account's returns from its history points. */
export function accountPerformance(plan, account) {
  const pts = [...(account.history ?? [])].filter((h) => h.date && Number.isFinite(Number(h.balance))).map((h) => ({ date: String(h.date).slice(0, 10), value: Number(h.balance) })).sort((a, b) => a.date < b.date ? -1 : 1);
  if (pts.length < 2) return { accountId: account.id, name: account.name, points: pts.length, ready: false };
  const yearlyRate = (plan.retirement?.contributions ?? []).filter((c) => c.accountId === account.id).reduce((s, c) => s + perYear(c.amount, c.period) + (Number(c.employerMatch) || 0), 0);
  let chain = 1, deposits = 0;
  const flows = [{ date: pts[0].date, amount: -pts[0].value }];
  const periods = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const f = flowsBetween(plan, account.id, a.date, b.date, yearlyRate);
    const denom = a.value + f / 2;
    const rate = denom > 0 ? (b.value - a.value - f) / denom : 0;   // Modified Dietz: the deposit sits in the account half the period on average
    chain *= 1 + rate; deposits += f;
    periods.push({ from: a.date, to: b.date, rate, flow: f, start: a.value, end: b.value });
    if (Math.abs(f) > 0.005) { const mid = new Date(new Date(`${a.date}T00:00:00`).getTime() + days(a.date, b.date) / 2 * DAY); flows.push({ date: mid.toISOString().slice(0, 10), amount: -f }); }
  }
  const last = pts[pts.length - 1];
  flows.push({ date: last.date, amount: last.value });
  const years = days(pts[0].date, last.date) / 365.25;
  const twr = chain - 1;
  return { accountId: account.id, name: account.name, type: account.type, points: pts.length, ready: true, from: pts[0].date, to: last.date, years, start: pts[0].value, end: last.value, deposits, gain: last.value - pts[0].value - deposits, twr, twrAnnual: years > 0 ? Math.pow(chain, 1 / years) - 1 : twr, mwr: xirr(flows), periods };
}

/** What a stocks/bonds index mix returned over whole calendar years inside [from, to] (Damodaran's table), or null when no whole year fits. */
export function benchmarkOver(from, to, stockShare) {
  const y0 = Number(from.slice(0, 4)) + (from.slice(5) === "01-01" ? 0 : 1), y1 = Number(to.slice(0, 4)) - (to.slice(5) === "12-31" ? 0 : 1);
  const rows = RETURNS.filter((r) => r.year >= y0 && r.year <= y1);
  if (!rows.length) return null;
  const chain = rows.reduce((p, r) => p * (1 + stockShare * r.stocks + (1 - stockShare) * r.bonds), 1);
  return { years: rows.length, from: rows[0].year, to: rows[rows.length - 1].year, total: chain - 1, annual: Math.pow(chain, 1 / rows.length) - 1 };
}

/**
 * compute(plan, { today }) -> {
 *   ready, accounts: [accountPerformance], overall: { start, end, deposits, gain, twrAnnual (value-weighted), years, from, to } | null,
 *   expected (the plan's blended return), benchmark, stockShare, notes, pointsNeeded: accounts with fewer than two points
 * }
 */
export function compute(plan, params = {}) {
  const invested = (plan.accounts ?? []).filter((a) => ACCOUNT_TYPES[a.type]?.invested);
  const accounts = invested.map((a) => accountPerformance(plan, a));
  const ready = accounts.filter((a) => a.ready);
  const a = plan.assumptions ?? {}, rt = plan.retirement ?? {};
  const stockShare = Number(rt.stocksNow ?? 0.7);
  const expected = stockShare * Number(a.returnStocks ?? 0.07) + (1 - stockShare) * Number(a.returnBonds ?? 0.04);
  let overall = null, benchmark = null;
  if (ready.length) {
    const start = ready.reduce((s, x) => s + x.start, 0), end = ready.reduce((s, x) => s + x.end, 0), deposits = ready.reduce((s, x) => s + x.deposits, 0);
    const weight = ready.reduce((s, x) => s + x.end, 0) || 1;
    const twrAnnual = ready.reduce((s, x) => s + x.twrAnnual * x.end, 0) / weight;
    const from = ready.map((x) => x.from).sort()[0], to = ready.map((x) => x.to).sort().pop();
    overall = { start, end, deposits, gain: end - start - deposits, twrAnnual, years: days(from, to) / 365.25, from, to, mwr: ready.length === 1 ? ready[0].mwr : null };
    benchmark = benchmarkOver(from, to, stockShare);
  }
  const notes = [];
  const pointsNeeded = accounts.filter((x) => !x.ready);
  if (!invested.length) notes.push("No investment accounts yet: add them on the Net worth page.");
  else if (!ready.length) notes.push("Returns need at least two saved balance points per account. Tap \"Save today's totals\" on the Net worth page now and again next month; a year of points makes this page worth reading.");
  else if (pointsNeeded.length) notes.push(`${pointsNeeded.map((x) => x.name).join(", ")}: fewer than two balance points, left out.`);
  if (ready.some((x) => x.years < 0.5)) notes.push("Less than half a year of points: the yearly figures are extrapolated and jumpy. They settle down with time.");
  return { ready: ready.length > 0, accounts, overall, expected, benchmark, stockShare, notes, pointsNeeded, hasAccounts: invested.length > 0 };
}
