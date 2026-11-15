// modules/investments/performance/compute.js -- PURE. What each investment account really
// earned between the balance points saved on the Net worth page: the time-weighted return
// (what the investments did, deposits stripped out, Modified Dietz within each period and
// chain-linked) and the money-weighted return (what YOU earned given when the money went in),
// against what the plan assumes and what a plain index mix did over the same calendar years.
//
// Gap list, next 60, item 48 (2026-11-15): `params.period` measures a shorter stretch (this year so far, 1, 3 or 5 years,
// or two dates of the person's own), each account from its saved point nearest the start to its point nearest the end;
// `investments.benchmark` (optional) is the person's own mix of the bundled classes to compare with; `params.parts` adds
// what the page's three quiet rows read (`period`, `drivers`: each holding's gain since bought, `compare`). With none of
// them the output is byte for byte what it was (module.test.mjs "invariance").
import { xirr, cagr } from "../../../core/math/returns.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { perYear } from "../../../core/math/periods.js";
import { RETURNS } from "../../retirement/historical/data/returns.js";
import { compute as computeHoldings } from "../holdings/compute.js";

const DAY = 86400000;
const days = (a, b) => (new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / DAY;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** An account's saved balance points, oldest first. */
const pointsOf = (account) => [...(account.history ?? [])].filter((h) => h.date && Number.isFinite(Number(h.balance))).map((h) => ({ date: String(h.date).slice(0, 10), value: Number(h.balance) })).sort((a, b) => a.date < b.date ? -1 : 1);

// ---------------------------------------------------------------- the period picked (nothing saved: the page's memory for the visit)
/** The quick periods, in the order of their chips. `ask`: how the asked start is said ("the saved points nearest to a year ago"). */
export const PERIODS = Object.freeze([
  { key: "ytd", label: "This year so far", status: "this year so far", ask: "the start of the year" },
  { key: "1y", label: "1 year", years: 1, status: "1 year", ask: "a year ago" },
  { key: "3y", label: "3 years", years: 3, status: "3 years", ask: "3 years ago" },
  { key: "5y", label: "5 years", years: 5, status: "5 years", ask: "5 years ago" },
  { key: "all", label: "Since the first saved point", status: "every saved point" },
]);
/** A saved point counts as "the date asked" when it is at most this many days away (else the sentence says it was moved). */
export const NEAR_DAYS = 3;
/** "This year so far" starts at a point no earlier than this many days before 1 January (a balance saved in December
 *  counts as the start of the year; one from the autumn before would make the figure mostly last year's). */
export const YTD_SLACK_DAYS = 31;
/** The date a quick period starts on: 1 January of today's year; the same day N years back (29 February -> 28 February); the first saved point. */
export function askedStart(key, today, first = null) {
  const t = String(today ?? "").slice(0, 10);
  if (key === "ytd") return `${t.slice(0, 4)}-01-01`;
  const p = PERIODS.find((x) => x.key === key);
  if (p?.years) { const md = t.slice(5); return `${Number(t.slice(0, 4)) - p.years}-${md === "02-29" ? "02-28" : md}`; }
  return first;
}
/** The index of the point nearest a date (the fewest days either way); on a tie the earlier point. -1 with no points. */
export function nearestIndex(points, date) {
  let at = -1, gap = Infinity;
  for (let i = 0; i < points.length; i++) { const g = Math.abs(days(points[i].date, date)); if (g < gap) { gap = g; at = i; } }
  return at;
}
/** The points from the one nearest `from` to the one nearest `to` (fewer than two: nothing to measure there). With `floor`,
 *  the start is the point nearest `from` among those on or after `floor` ("this year so far": never last autumn's). */
export function windowOf(points, from, to, floor = null) {
  const lo = floor ? points.findIndex((p) => p.date >= floor) : 0;
  if (lo < 0 || !points.length) return [];
  const i = lo + nearestIndex(points.slice(lo), from), j = nearestIndex(points, to);
  return j > i ? points.slice(i, j + 1) : [points[i]];
}
const minusDays = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() - n * DAY).toISOString().slice(0, 10);
/** What a period asks for: { key, asked: { from, to }, floor? } (null asked for every point), or null for no period. Own
 * dates come as { from, to } (swapped when the first is later). floor: "this year so far" starts no earlier than this. */
function askOf(plan, invested, period, today) {
  if (!period) return null;
  const last = invested.flatMap((a) => pointsOf(a).map((p) => p.date)).sort();
  const t = ISO.test(String(today ?? "")) ? today : last.at(-1) ?? null;
  if (typeof period === "object") {
    let from = String(period.from ?? "").slice(0, 10), to = String(period.to ?? "").slice(0, 10);
    if (!ISO.test(from) || !ISO.test(to)) return null;
    if (from > to) [from, to] = [to, from];
    return { key: "own", asked: { from, to } };
  }
  if (period === "all") return { key: "all", asked: null };
  if (!PERIODS.some((p) => p.key === period) || !t) return null;
  const from = askedStart(period, t, last[0] ?? null);
  return { key: period, asked: { from, to: t }, floor: period === "ytd" ? minusDays(from, YTD_SLACK_DAYS) : null };
}

/** The deposits into one account between two dates: the ledger's transactions for it when there are any, else the contribution rate on the Contributions page. */
export function flowsBetween(plan, accountId, from, to, yearlyRate) {
  const tx = (plan.transactions ?? []).filter((t) => t.accountId === accountId && t.date > from && t.date <= to);
  if (tx.length) return tx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  return yearlyRate * Math.max(0, days(from, to)) / 365.25;
}

/** One account's returns from its history points; with `win` ({ from, to, floor? }), only from its point nearest `from`
 *  (on or after `floor`) to its point nearest `to`. */
export function accountPerformance(plan, account, win = null) {
  const pts = win ? windowOf(pointsOf(account), win.from, win.to, win.floor ?? null) : pointsOf(account);
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

// ---------------------------------------------------------------- your own mix to compare with (investments.benchmark)
/** The ready-made mixes "Compare with" offers, low to high: the stock share, the rest in bonds. */
export const COMPARE_PRESETS = Object.freeze([0.4, 0.6, 0.8, 1]);
/** The person's own mix of the bundled classes, { stocks, bonds, bills } adding to 1, or null (absent, or not adding to 100%). */
export function ownBenchmark(plan) {
  const b = plan.investments?.benchmark;
  if (!b || typeof b !== "object") return null;
  const v = [b.stocks, b.bonds, b.bills].map((x) => (x === undefined || x === null || x === "" ? 0 : Number(x)));
  if (!v.every((x) => Number.isFinite(x) && x >= 0)) return null;
  const sum = v[0] + v[1] + v[2];
  if (Math.abs(sum - 1) > 0.005) return null;
  return { stocks: v[0] / sum, bonds: v[1] / sum, bills: v[2] / sum };
}
/** The mix the page compares with: the person's own, else the plan's stock share against bonds. */
export function benchmarkMix(plan) {
  const own = ownBenchmark(plan);
  if (own) return { ...own, source: "own" };
  const s = Number(plan.retirement?.stocksNow ?? 0.7);
  return { stocks: s, bonds: 1 - s, bills: 0, source: "plan" };
}
/** What a mix of the bundled classes (stocks, bonds, bills) returned over the whole calendar years inside [from, to], or null. */
export function mixOver(from, to, mix) {
  const y0 = Number(from.slice(0, 4)) + (from.slice(5) === "01-01" ? 0 : 1), y1 = Number(to.slice(0, 4)) - (to.slice(5) === "12-31" ? 0 : 1);
  const rows = RETURNS.filter((r) => r.year >= y0 && r.year <= y1);
  if (!rows.length) return null;
  const s = Number(mix.stocks) || 0, b = Number(mix.bonds) || 0, c = Number(mix.bills) || 0;
  const chain = rows.reduce((p, r) => p * (1 + s * r.stocks + b * r.bonds + c * r.bills), 1);
  return { years: rows.length, from: rows[0].year, to: rows[rows.length - 1].year, total: chain - 1, annual: Math.pow(chain, 1 / rows.length) - 1 };
}

/** The last calendar year of the bundled yearly returns (2025). */
export const LAST_RETURN_YEAR = RETURNS[RETURNS.length - 1].year;
/** Why "Compare with" has no figure, one case each: "picked" (no whole calendar year in the stretch picked, but one in
 *  every saved point), "late" (the stretch starts after 1 January of the last year of the yearly returns, so no whole year
 *  of them can fit in it), "short" (no whole calendar year fits yet). */
function noFigureWhy(overall, period, plan) {
  if (period?.key && period.key !== "all") {
    const every = compute(plan, {});
    if (every.overall && mixOver(every.overall.from, every.overall.to, benchmarkMix(plan))) return "picked";
  }
  return overall.from > `${LAST_RETURN_YEAR}-01-01` ? "late" : "short";
}

// ---------------------------------------------------------------- which holdings drove it (since each was bought)
/** Above this many holdings the list shows the best and the worst DRIVER_ENDS each and says how many are in between. */
export const DRIVER_ROWS = 10, DRIVER_ENDS = 5;
const monthOf = (iso) => (ISO.test(String(iso ?? "")) ? String(iso).slice(0, 7) : null);
/**
 * drivers(plan, { today }) -> { rows (best first), shown, between, total: { value, paid, gain, ret }, left: [{ symbol, why: "price" | "cost" }] }
 * Each holding with a price and a cost: gain = value - cost, ret = gain / cost, share = gain / the whole gain (they add to
 * 1; null when the whole gain is 0), contribution = gain / everything paid (they add to the whole return). With lots that
 * cover the shares (within 0.5%): since = the first lot's date; when their cost is the holding's (within 1%) and the first
 * is a year or more before the price date, yearly = the internal rate of return of each lot's cost on its date and the
 * value on the price date. The app keeps no value of a holding over time, so this is since each was bought, never a period.
 */
export function drivers(plan, { today = null } = {}) {
  const h = computeHoldings(plan, { today });
  const rows = [], left = [];
  for (const x of h.items) {
    if (!(x.value > 0) && !(x.costBasis > 0)) continue;   // nothing in it
    const symbol = x.symbol || x.name || "A holding";
    if (!x.priced) { left.push({ id: x.id, symbol, why: "price" }); continue; }
    if (!(x.costBasis > 0)) { left.push({ id: x.id, symbol, why: "cost" }); continue; }
    // only records count as purchases: a null or a stray value in an imported or hand-edited file is left out (as Tax lots does)
    const records = (Array.isArray(x.lots) ? x.lots : []).filter((l) => l && typeof l === "object" && !Array.isArray(l));
    const lots = records.filter((l) => ISO.test(String(l.date ?? "")) && Number(l.shares) > 0);
    const lotShares = lots.reduce((s, l) => s + Number(l.shares), 0), lotCost = lots.reduce((s, l) => s + (Number(l.cost) || 0), 0);
    const asOf = ISO.test(String(x.priceAsOf ?? "")) ? String(x.priceAsOf) : ISO.test(String(today ?? "")) ? today : null;
    // a purchase dated after the price (a typing slip: "2030") gives no "since" and no yearly rate
    const covers = lots.length > 0 && lots.length === records.length && x.shares > 0 && Math.abs(lotShares - x.shares) <= 0.005 * x.shares && (!asOf || lots.every((l) => l.date <= asOf));
    const since = covers ? lots.map((l) => l.date).sort()[0] : null;
    const yearly = since && asOf && days(since, asOf) >= 365 && Math.abs(lotCost - x.costBasis) <= 0.01 * x.costBasis
      ? xirr([...lots.map((l) => ({ date: l.date, amount: -(Number(l.cost) || 0) })), { date: asOf, amount: x.value }]) : null;
    rows.push({ id: x.id, symbol, name: x.name, account: x.accountName, value: x.value, paid: x.costBasis, gain: x.value - x.costBasis, ret: (x.value - x.costBasis) / x.costBasis, since: monthOf(since), yearly: Number.isFinite(yearly) ? yearly : null });
  }
  const value = rows.reduce((s, r) => s + r.value, 0), paid = rows.reduce((s, r) => s + r.paid, 0), gain = rows.reduce((s, r) => s + r.gain, 0);
  for (const r of rows) { r.share = gain !== 0 ? r.gain / gain : null; r.contribution = paid > 0 ? r.gain / paid : 0; }
  rows.sort((a, b) => b.gain - a.gain || (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));
  const cut = rows.length > DRIVER_ROWS;
  return { rows, shown: cut ? [...rows.slice(0, DRIVER_ENDS), ...rows.slice(-DRIVER_ENDS)] : rows, between: cut ? rows.length - 2 * DRIVER_ENDS : 0, total: { value, paid, gain, ret: paid > 0 ? gain / paid : 0 }, left };
}

/**
 * compute(plan, { today }) -> {
 *   ready, accounts: [accountPerformance], overall: { start, end, deposits, gain, twrAnnual (value-weighted), years, from, to } | null,
 *   expected (the plan's blended return), benchmark, stockShare, notes, pointsNeeded: accounts with fewer than two points
 * }
 */
export function compute(plan, params = {}) {
  const invested = (plan.accounts ?? []).filter((a) => ACCOUNT_TYPES[a.type]?.invested);
  const ask = askOf(plan, invested, params.period, params.today);
  const win = ask?.asked ? { ...ask.asked, floor: ask.floor ?? null } : null;
  let accounts = invested.map((a) => accountPerformance(plan, a, win));
  let ready = accounts.filter((a) => a.ready);
  // a stretch with fewer than two saved points in every account: the page shows every point, and says so
  const fellBack = !!ask?.asked && !ready.length && invested.some((a) => pointsOf(a).length >= 2);
  if (fellBack) { accounts = invested.map((a) => accountPerformance(plan, a)); ready = accounts.filter((a) => a.ready); }
  const windowed = !!ask?.asked && !fellBack;
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
    const own = ownBenchmark(plan);
    benchmark = own ? mixOver(from, to, own) : benchmarkOver(from, to, stockShare);
  }
  const notes = [];
  // in a stretch, an account with saved points elsewhere but fewer than two inside it is said apart (no "save today's totals")
  const shortOf = (x) => windowed && pointsOf(invested.find((a) => a.id === x.accountId) ?? {}).length >= 2;
  const pointsNeeded = accounts.filter((x) => !x.ready && !shortOf(x));
  const outOfStretch = accounts.filter((x) => !x.ready && shortOf(x));
  if (!invested.length) notes.push("No investment accounts yet: add them on the Net worth page.");
  else if (!ready.length) notes.push("Returns need at least two saved balance points per account. Tap \"Save today's totals\" on the Net worth page now and again next month; a year of points makes this page worth reading.");
  else if (pointsNeeded.length) notes.push(`${pointsNeeded.length === 1 ? `${pointsNeeded[0].name} is` : `${pointsNeeded.map((x) => x.name).join(", ")} are`} left out: ${pointsNeeded.length === 1 ? "it has" : "they have"} only one saved balance. Save today's totals on the Net worth page now and again next month.`);
  if (outOfStretch.length) notes.push(`${outOfStretch.length === 1 ? `${outOfStretch[0].name} is` : `${outOfStretch.map((x) => x.name).join(", ")} are`} left out of this stretch: just one of ${outOfStretch.length === 1 ? "its" : "their"} saved balances falls in it.`);
  if (ready.some((x) => x.years < 0.5)) notes.push("Less than half a year of points: the yearly figures are extrapolated and jumpy. They settle down with time.");
  const out = { ready: ready.length > 0, accounts, overall, expected, benchmark, stockShare, notes, pointsNeeded, hasAccounts: invested.length > 0 };
  if (params.parts) {
    const asked = ask?.asked && !fellBack ? ask.asked : null;
    const moved = !!asked && !!overall && (Math.abs(days(asked.from, overall.from)) > NEAR_DAYS || Math.abs(days(asked.to, overall.to)) > NEAR_DAYS);
    const dates = invested.flatMap((a) => pointsOf(a).map((p) => p.date)).sort();
    out.period = { key: ask && !fellBack ? ask.key : "all", asked: ask?.asked ?? null, from: overall?.from ?? null, to: overall?.to ?? null, first: dates[0] ?? null, last: dates.at(-1) ?? null, moved, fellBack };
    out.drivers = drivers(plan, params);
    out.compare = { mix: benchmarkMix(plan), benchmark, why: benchmark || !overall ? null : noFigureWhy(overall, out.period, plan) };
  }
  return out;
}
