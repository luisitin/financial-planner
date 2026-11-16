// modules/property/home/compute.js -- PURE. Your home: what it is worth and what you own of it, how it has grown
// since you bought it, what it costs a year to keep (tax, insurance, dues, upkeep, the mortgage's interest), what
// you would walk away with if you sold today (selling costs, and the federal tax on the gain: the $250,000 or $500,000
// that is tax-free once you have owned and lived in it two of the last five years, a short-term gain taxed like pay,
// the rest at 0/15/20% and the 3.8%, worked through the federal estimate), and the value and equity in 5, 10 and 20
// years as it grows and the mortgage shrinks.
import { homeEntryFor } from "../../overview/guesses/estimators/loanhome.js";
import { compute as computeMortgage } from "../../debt/mortgage/compute.js";
import { todaysReturn, addIncome } from "../../taxes/federal/compute.js";
import { taxView } from "../../taxes/federal/known.js";
import { longOn } from "../../investments/tax-lots/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";
import { monthsBetween, daysBetween, isoOf, isValidDate } from "../../../core/math/dates.js";

// the usual figures, the tax-free gain and the lines of a year of keeping the home live in a file of their own with no page
// behind it (keeping.js), so the retirement projection can read them too; they are still this module's exports
import { DEFAULTS, EXCLUSION, keepingLines } from "./keeping.js";
export { DEFAULTS, EXCLUSION, keepingLines };
/** Owned and lived in for 730 days or 24 full months of the five years before the sale (121(a); 26 CFR 1.121-1(c)(1): "24 full months or for 730 days (365 x 2)"). */
export const USE = { days: 730, months: 24 };

/**
 * The purchase date to keep after the Home page's form (or the mortgage page's one box) is saved: the exact date when it was
 * changed or agrees with the year; the middle of the year (July 1) when only the year was typed or changed; nothing
 * ("") when both are blank. `was` is what the form opened with. Years outside 1950 to this year count as blank.
 */
export function purchaseDateFrom({ year = null, date = "" } = {}, was = {}, thisYear = new Date().getFullYear()) {
  const good = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1950 && n <= thisYear ? n : null; };
  const y = good(year), wasY = good(was.year);
  const d = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  const wasD = typeof was.date === "string" ? was.date : "";
  if (d && d !== wasD) return d;                    // the exact date was typed: it wins
  if (y !== wasY) return y ? `${y}-07-01` : "";     // the year was typed, changed or cleared
  return d || (y ? `${y}-07-01` : "");
}

const lastDay = (y, m) => Number(isoOf(y, m + 1, 0).slice(8, 10));
/** The date k calendar months after `iso`: a purchase on a month's last day gives the target month's last day, and a day the target month lacks falls back to its last day. */
export function addMonthsEnd(iso, k) {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)), d = Number(iso.slice(8, 10));
  const n = y * 12 + (m - 1) + k, ty = Math.floor(n / 12), tm = (n % 12) + 1, last = lastDay(ty, tm);
  return isoOf(ty, tm, d === lastDay(y, m) ? last : Math.min(d, last));
}
/** Full calendar months from `from` to `to` (1.121-1(c)(1)): the largest k with addMonthsEnd(from, k) on or before `to`. */
export function fullMonths(from, to) {
  let k = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7))) + 1;
  while (k > 0 && addMonthsEnd(from, k) > to) k--;
  return Math.max(0, k);
}
/**
 * The two-year test of 121(a) on a purchase date, sold today (owned and lived in since the purchase): days counted from the
 * day after the purchase, the sale day included (Pub. 550, Holding Period; 1.121-1(c)(4) Example 3), so the plain difference;
 * met at 730 days or 24 full months, whichever comes first. -> { days, months, meets, from (the first day it is met) }
 */
export function twoYearTest(date, today) {
  const days = daysBetween(date, today), months = fullMonths(date, today);
  const byDays = isoOf(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)) + USE.days), byMonths = addMonthsEnd(date, USE.months);
  return { days, months, meets: days >= USE.days || months >= USE.months, from: byDays < byMonths ? byDays : byMonths };
}

/** Yearly growth between two values over `months`. */
export function growthRate(from, to, months) {
  if (!(from > 0) || !(to > 0) || !(months >= 12)) return null;
  return Math.pow(to / from, 12 / months) - 1;
}

/**
 * compute(plan, { today }) -> {
 *   ready, name, value, owed, equity, equityShare, ltv, details, bought: { price, date, years, growth } | null,
 *   history: [{ date, value }], costs: { lines, total, monthly }, sale: { costs, basis, gain, cap, exclusion (the most that can be tax-free), excluded (the part of the gain that is), taxable, term, longOn,
 *   capEach (one return's most), owners (returns the gain is on: 2 filing separately for a home in neither name),
 *   test: { days, months, meets, from } | null, reduced, dateMissing, rate (tax / taxable), tax, niit, niitLine, incomeTax, year, otherYear, filingStatus, net },
 *   ahead: [{ years, year, value, owed, equity }], appreciation, pmi, yearUsed (the year bought is what the mortgage's years left are
 *   worked from)
 * }
 * costs.lines: property tax and home insurance typed here, else the part of the mortgage payment that holds them (`inPayment`), once.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const homes = (plan.accounts ?? []).filter((a) => a.type === "property");
  const entries = (plan.property ?? []).filter((x) => x.kind === "home");
  const acct = homes.find((a) => entries.some((e) => e.accountId === a.id)) ?? homes.sort((a, b) => countedBalance(b) - countedBalance(a))[0] ?? null;
  if (!acct) return { ready: false };
  const e = homeEntryFor(plan, acct.id) ?? {};   // the one entry for this home: the page's and Get started's share it (review D5)
  const n = (v, d) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
  const value = countedBalance(acct);
  const mort = computeMortgage(plan, { today });
  const m = mort.hasData ? mort.mortgage : null;
  const owed = m?.balance ?? 0;
  const equity = value - owed;

  // since it was bought
  const price = n(e.purchasePrice, null), date = e.purchaseDate || null;
  const months = date && today ? monthsBetween(date, today) : null;
  const bought = price ? { price, date, years: months !== null ? months / 12 : null, growth: months !== null ? growthRate(price, value, months) : null, gain: value - price } : null;
  const history = [...(acct.history ?? []).map((h) => ({ date: h.date, value: Number(h.balance) || 0 })).filter((h) => h.date), ...(acct.asOf ? [{ date: acct.asOf, value }] : [])]
    .sort((a, b) => a.date.localeCompare(b.date)).filter((h, i, arr) => i === arr.length - 1 || h.date !== arr[i + 1].date);

  // a year of keeping it
  const pay = m ? yearOfPayments(m.balance, m.rate ?? 0, (m.toLoan ?? m.payment) + (m.extra || 0)) : { interest: 0, principal: 0 };
  const lines = [...keepingLines(plan, e, m, value, today), { key: "interest", label: "Mortgage interest", amount: pay.interest }].filter((l) => l.amount > 0.5);
  const total = lines.reduce((s, l) => s + l.amount, 0);

  // selling today: the federal tax on the gain, worked through the federal estimate in today's tax year
  const yr = todaysReturn(plan, today);
  const ti = taxView(yr.plan, { today });
  const status = ti.filingStatus;
  // filing separately (two returns), the gain is on the return of the spouse whose name the home is in, with their own
  // $250,000; in neither name, half on each return, each half with its own $250,000 (26 CFR 1.121-2(a)(2), Joint owners: "each
  // taxpayer may exclude from gross income up to $250,000 of gain that is attributable to each taxpayer's interest")
  const parts = Array.isArray(ti.inputs.separate) ? ti.inputs.separate : null;
  const owner = parts && parts.some((x) => x.personId === acct.ownerId) ? acct.ownerId : null;
  const shares = !parts ? [[null, 1]] : owner ? [[owner, 1]] : parts.map((x) => [x.personId, 1 / parts.length]);
  const capEach = status === "married_joint" ? EXCLUSION.married_joint : EXCLUSION.single;
  const cap = capEach * shares.length;
  const sellCosts = value * n(e.sellCosts, DEFAULTS.sellCosts);
  const basis = price !== null ? price + n(e.improvements, 0) : null;
  const gain = basis !== null ? value - sellCosts - basis : null;
  // the two-year test (121(a)); without a purchase date it is taken as met. Not met: no exclusion, unless the sale is for a
  // new job, health or an event you could not foresee (121(c)): then the cap times the share of the two years, by days or by
  // full months, whichever is larger (26 CFR 1.121-3(g)(1): "expressed in days or months")
  const test = date && today ? twoYearTest(date, today) : null;
  const reduced = test && !test.meets && e.reducedReason === true ? Math.min(1, Math.max(test.days / USE.days, test.months / USE.months)) : null;
  const exclusionEach = !test || test.meets ? capEach : reduced !== null ? capEach * reduced : 0;
  const exclusion = exclusionEach * shares.length;
  const pieces = shares.map(([id, k]) => ({ id, gain: gain !== null ? gain * k : 0 })).map((x) => ({ ...x, taxable: Math.max(0, x.gain - exclusionEach), excluded: Math.min(exclusionEach, Math.max(0, x.gain)) }));
  const taxable = pieces.reduce((t, x) => t + x.taxable, 0);
  // held more than a year (from the day after the purchase) is long-term (IRC 1222(3); Tax lots' longOn); a year or less is
  // short-term and taxed like pay. The gain is investment income for the 3.8% tax (1411(c)(1)(A)(iii)); the excluded part is not
  // (1.1411-4(d)(3)(ii) Example 3). The engine stacks a long-term gain through the year's 0/15/20% bands and charges the 3.8% on
  // the lesser of the investment income and the income over the line (1(h), 1411(a)(1))
  const longFrom = date ? longOn(date) : null;
  const term = longFrom && today && today < longFrom ? "short" : "long";
  const r0 = ti.result;
  const withGain = pieces.reduce((inp, x) => x.taxable > 0 ? addIncome(inp, x.id, { [term === "short" ? "otherOrdinary" : "qualifiedIncome"]: x.taxable, investmentIncome: x.taxable }) : inp, ti.inputs);
  const r1 = taxable > 0 ? federalTax(withGain, ti.params) : r0;
  const tax = Math.max(0, r1.totalTax - r0.totalTax), niit = Math.max(0, (r1.niit || 0) - (r0.niit || 0));
  const sale = { costs: sellCosts, basis, gain, cap, capEach, owners: shares.length, exclusion, excluded: pieces.reduce((t, x) => t + x.excluded, 0), taxable, term, longOn: longFrom, test, reduced, dateMissing: price !== null && !date, rate: taxable > 0 ? tax / taxable : 0, tax, niit, niitLine: ti.params.niitThreshold?.[status] ?? 200000, incomeTax: tax - niit, year: yr.year, otherYear: yr.other, filingStatus: status, net: value - sellCosts - owed - tax };

  // ahead: the value growing, the mortgage on its schedule
  const appreciation = n(e.appreciation, DEFAULTS.appreciation);
  const y0 = today ? Number(String(today).slice(0, 4)) : 2026;
  // the mortgage page's schedule: one row per year from now ({ year: 1, 2, ..., endBalance }), ending when it is paid off
  const owedIn = (years) => { if (!m) return 0; const sch = mort.schedule ?? []; const row = sch.find((r) => r.year === years); return row ? row.endBalance : sch.length && years > sch[sch.length - 1].year ? 0 : owed; };
  const ahead = [5, 10, 20].map((years) => { const v = value * Math.pow(1 + appreciation, years), o = owedIn(years); return { years, year: y0 + years, value: v, owed: o, equity: v - o }; });
  return {
    ready: true, accountId: acct.id, name: e.name || acct.name, value, owed, mortgageName: m?.name ?? null, equity, equityShare: value > 0 ? equity / value : null, ltv: value > 0 ? owed / value : null,
    details: e, bought, history, costs: { lines, total, monthly: total / 12, principal: pay.principal, inPayment: lines.some((l) => l.inPayment), guessed: lines.some((l) => l.guessed) }, sale, ahead, appreciation, pmi: mort.pmi ?? null,
    // the year bought is what the mortgage's years left are worked from (its balance or payment is our guess, counted from that year)
    yearUsed: !!(m && mort.start && mort.start.via === "typed" && mort.start.worked),
  };
}

// ---------------------------------------------------------------- "Work done on the home": a dated list of jobs (gap list, next 60, item 56)
// The home's entry may hold `jobs: [{ id, date, what, cost?, note?, improvement? }]` (optional; docs/DATA_MODEL.md). Nothing
// here is read by compute() above, so its output is the same with or without a list. upkeepLog() reads compute()'s result.
// A job added with "Also count this as an improvement" ticked adds its cost to the home's `improvements` in the same save
// (improvementsWith), and its Remove takes that off again (improvementOff): the one figure every page reads stays the one.

/** The fields of one job as the page saves it. */
export const JOB_KEYS = Object.freeze(["id", "date", "what", "cost", "note", "improvement"]);
/** Two figures within this share of the upkeep the page counts read as "about the same". */
export const CLOSE = 0.10;
/** The largest share of the value "Use $X a year" may set: the details form's "Upkeep a year, as a share of the value" box allows 10%. */
export const USE_MAX = 0.10;
/** "Use $X a year" needs at least this many jobs with a cost in the last 12 months: one roof or furnace is not a year's upkeep. */
export const USE_MIN_JOBS = 2;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar day written YYYY-MM-DD: "2026-02-30" is not one (a hand-edited or imported job with such a day is not listed, as one with no day). */
export const isDay = (s) => typeof s === "string" && ISO.test(s) && isValidDate(s);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
/** The day 12 calendar months before `today` (a month's last day goes to that month's last day): the last 12 months are the days after it, up to today. */
export const yearAgo = (today) => addMonthsEnd(today, -12);
const cost = (j) => { const v = Number(j?.cost); return j?.cost !== null && j?.cost !== undefined && j?.cost !== "" && Number.isFinite(v) && v > 0 ? v : 0; };

/**
 * upkeepLog(d, today) -> the list and its comparison with the upkeep the page counts, from d = compute(plan, { today }) (ready).
 * { jobs: newest first (by date; on the same date the one added later first), count, year: { from, to, total, count } (the
 * last 12 months: from < date <= to), upkeep (the "Upkeep and repairs" line counted, 0 when it is not), rate (the share it is
 * counted at), value, case, gap (|year.total - upkeep|), use: { yearly, rate, total } | null }.
 * start: the list's first day (its oldest job), null while it is empty.
 * case: "empty" (no job) | "none" (none in the last 12 months) | "none-no-upkeep" | "no-cost" (some, none with a cost: nothing
 * to compare) | "no-cost-no-upkeep" | "new" (costs, but the list starts inside the last 12 months: it cannot show a year yet)
 * | "no-upkeep" (some, and no upkeep counted) | "equal" (within $1 of the upkeep: just after "Use $X a year") | "close"
 * (within 10% of it) | "less" | "more".
 * use: "Use $X a year" (X = the last 12 months), offered when the list reaches back 12 months (start on or before the day a
 * year ago), the last 12 months hold two or more jobs with a cost (`USE_MIN_JOBS`; year.costed), X >= $1, the value > 0, X
 * differs from the upkeep by $1 or more and X / value <= 10%; rate = X / value to 7 decimals (so value x rate rounds back to
 * X), total = the year of owning it then.
 */
export function upkeepLog(d, today) {
  const list = Array.isArray(d?.details?.jobs) ? d.details.jobs : [];
  const jobs = list.map((j, i) => [j, i]).filter(([j]) => j && typeof j === "object" && isDay(j.date))
    .sort((a, b) => (a[0].date < b[0].date ? 1 : a[0].date > b[0].date ? -1 : b[1] - a[1])).map(([j]) => j);
  const from = yearAgo(today);
  const inYear = jobs.filter((j) => j.date > from && j.date <= today);
  const total = inYear.reduce((s, j) => s + cost(j), 0);
  const costed = inYear.filter((j) => cost(j) > 0).length;
  const line = (d?.costs?.lines ?? []).find((l) => l.key === "maintenance");
  const upkeep = line ? line.amount : 0;
  const value = Number(d?.value) || 0;
  const share = d?.details?.maintenance;
  const rate = share === null || share === undefined || share === "" || !Number.isFinite(Number(share)) ? DEFAULTS.maintenance : Number(share);
  const gap = Math.abs(total - upkeep);
  // the list's first day (its oldest job): a list that starts inside the last 12 months cannot show a year yet
  const start = jobs.length ? jobs[jobs.length - 1].date : null;
  const young = start !== null && start > from;
  const kase = !jobs.length ? "empty"
    : !inYear.length ? (upkeep >= 0.5 ? "none" : "none-no-upkeep")
    : total < 0.5 ? (upkeep >= 0.5 ? "no-cost" : "no-cost-no-upkeep")
    : young ? "new"
    : upkeep < 0.5 ? "no-upkeep"
    : gap < 1 ? "equal" : gap <= CLOSE * upkeep ? "close" : total < upkeep ? "less" : "more";
  const useRate = value > 0 ? Number((total / value).toFixed(7)) : null;
  const use = !young && costed >= USE_MIN_JOBS && total >= 1 && value > 0 && gap >= 1 && useRate <= USE_MAX
    ? { yearly: total, rate: useRate, total: (d?.costs?.total ?? 0) - upkeep + value * useRate } : null;
  return { jobs, count: jobs.length, start, year: { from, to: today, total, count: inYear.length, costed }, upkeep, rate, value, case: kase, gap, use };
}

// the page's sentences, one per case (docs/OPTIONAL.md R5); `money` writes an amount ("$2,150")
/** A share of the value as the page writes it: one decimal from 1% ("1.0%"), two under it ("0.57%"), so the share "Use $X a year" sets reads as the figure it gives. */
export const sharePct = (x) => { const p = x * 100; return `${p >= 1 || p === 0 ? p.toFixed(1) : p.toFixed(2)}%`; };
const pctOf = sharePct;
/** The comparison under the list: one written sentence per case, null for an empty list (the intro says what to do). */
export function logLine(log, money) {
  const L = money(log.year.total), U = money(log.upkeep), G = money(log.gap);
  const N = `${log.year.count} job${log.year.count === 1 ? "" : "s"}`;
  const starts = log.start === log.year.to ? "today" : log.start ? `in ${monthOf(log.start)}` : "";
  switch (log.case) {
    case "none": return `Nothing logged in the last 12 months. This page counts ${U} a year of upkeep.`;
    case "none-no-upkeep": return "Nothing logged in the last 12 months, and this page counts no upkeep.";
    case "no-cost": return `In the last 12 months you logged ${N}, none with a cost, so there is nothing to compare with the ${U} a year of upkeep this page counts.`;
    case "no-cost-no-upkeep": return `In the last 12 months you logged ${N}, none with a cost, and this page counts no upkeep.`;
    case "new": return `Your list starts ${starts}, so it cannot show a whole year yet. So far it holds ${L} of work. Add older jobs with their dates to compare a whole year.`;
    case "no-upkeep": return `In the last 12 months you logged ${L} of work. This page counts no upkeep.`;
    case "equal": return `In the last 12 months you logged ${L} of work, the same as the yearly upkeep this page counts.`;
    case "close": return `In the last 12 months you logged ${L} of work, about the ${U} a year of upkeep this page counts.`;
    case "less": return `In the last 12 months you logged ${L} of work, ${G} less than the ${U} a year of upkeep this page counts.`;
    case "more": return `In the last 12 months you logged ${L} of work, ${G} more than the ${U} a year of upkeep this page counts.`;
    default: return null;
  }
}
/** Said under a comparison of a year's jobs with the yearly upkeep (cases close, less, more). */
export const UNEVEN = "One year can be uneven: a roof or a furnace comes once in many years.";
/** Under a list: how a job that improves the home is counted there too (the job form's tick under "More details (optional)"). */
export const IMPROVE_HINT = "A new roof or an addition also lowers the tax when you sell: when you add one, tick \"Also count this as an improvement\" under More details (optional).";
/** The intro of an empty list. */
export const LOG_INTRO = "Keep a dated list of work on the home: handy when you sell, and a check on the upkeep this page counts.";
/** "Use $X a year": the question asked first. */
export const useConfirmWords = (log, money) => `Count upkeep at ${money(log.use.yearly)} a year from now on? That is ${pctOf(log.use.rate)} of the home's ${money(log.value)} value; a year of owning it changes with it.`;
/** The green line after it: the new answer (R7). */
export const useSavedWords = (log, money) => `Saved. Upkeep is now counted at ${money(log.use.yearly)} a year (${pctOf(log.use.rate)} of the value): a year of owning it comes to ${money(log.use.total)}.`;
/** After its Undo. */
export const useUndoneWords = (log, money) => `Upkeep is back at ${money(log.upkeep)} a year (${pctOf(log.rate)} of the value).`;
const named = (job) => `"${String(job?.what ?? "").trim() || "This job"}"`;
const num0 = (v) => { const n = Number(v); return v !== null && v !== "" && Number.isFinite(n) && n > 0 ? n : 0; };
/** What a job counted as an improvement adds to the home's Improvements: its cost; 0 without the tick or a cost. */
export const improvementOf = (job) => (job?.improvement === true ? cost(job) : 0);
/** The home's Improvements after adding a job: the figure there (blank = $0) plus what the job adds. */
export const improvementsWith = (improvements, job) => num0(improvements) + improvementOf(job);
/** What Remove takes off Improvements for a job counted as one: its cost, never more than Improvements holds now. */
export const improvementOff = (improvements, job) => Math.min(num0(improvements), improvementOf(job));
/** Remove's question; `off` (what comes off Improvements with it, improvementOff) is said when there is any. */
export const removeConfirmWords = (job, money, off = 0) => (off > 0 ? `Remove ${named(job)} from the list? Its ${money(off)} also comes off Improvements.` : `Remove ${named(job)} from the list?`);
export const removedWords = (job, money, off = 0) => (off > 0 ? `Removed ${named(job)} from the list, and its ${money(off)} from Improvements.` : `Removed ${named(job)} from the list.`);
export const restoredWords = (job, money, off = 0) => (off > 0 ? `${named(job)} is back on the list, and its ${money(off)} under Improvements.` : `${named(job)} is back on the list.`);
/**
 * The list without the one job a Remove was tapped on: the one at `at` (its place when the page was drawn) when it is that
 * job, else the first with the same day, words, cost and id; the list as it was when there is none. Never by id alone: a
 * job saved by hand or imported may have no id, or share one, and a filter on it removed every such job.
 */
export function withoutJob(list, job, at) {
  const arr = Array.isArray(list) ? list : [];
  const key = (y) => (y && typeof y === "object" ? [y.date, y.what, y.cost ?? null, y.id ?? null] : null);
  const k = key(job);
  const is = (y) => { const a = key(y); return !!a && !!k && a.every((v, i) => v === k[i]); };
  const i = Number.isInteger(at) && is(arr[at]) ? at : arr.findIndex(is);
  return i < 0 ? arr : [...arr.slice(0, i), ...arr.slice(i + 1)];
}
/** The green line after an add; `now` = Improvements after it, said for a job counted as an improvement (R7: the new figure). */
export const addedWords = (job, money, now = null) => (improvementOf(job) > 0 && now !== null
  ? `Added ${named(job)}, ${money(cost(job))}, to the list and to Improvements, now ${money(now)}: that lowers the tax when you sell.`
  : cost(job) > 0 ? `Added ${named(job)}, ${money(cost(job))}, to the list.` : `Added ${named(job)} to the list.`);
/**
 * A job as the add form gives it, or a reason it cannot be saved: { job } | { error: "what" | "date" | "cost", words }.
 * `improvement` ("Also count this as an improvement") is kept only with a cost: with none there is nothing to add.
 */
export function jobFrom(v, { id, today }) {
  const what = String(v?.what ?? "").trim().replace(/\s+/g, " ");
  const date = String(v?.date ?? "").trim();
  if (!what) return { error: "what", words: "Say what was done, like \"New water heater\"." };
  if (!isDay(date)) return { error: "date", words: "Pick the day it was done." };
  if (today && date > today) return { error: "date", words: "That day is still ahead: pick the day it was done." };
  const c = Number(v?.cost);
  const note = String(v?.note ?? "").trim();
  const amount = v?.cost === null || v?.cost === undefined || v?.cost === "" || !Number.isFinite(c) ? null : Math.max(0, c);
  if (v?.improvement === true && !(amount > 0)) return { error: "cost", words: "Type what it cost to count it as an improvement, or uncheck that box." };
  return { job: { id, date, what: what.slice(0, 120), cost: amount, ...(note ? { note: note.slice(0, 300) } : {}), ...(v?.improvement === true ? { improvement: true } : {}) } };
}
