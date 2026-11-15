// modules/investments/dividends/compute.js -- PURE. The income your holdings throw off each
// year (value x yield, from the fund table or what you typed), by holding, by account and by
// tax bucket, what it covers of your spending, and how much of it is taxed this year.
// With { calendar: true } (the page's "Month by month" row, gap next-60 #8) also: the year spread over the next twelve
// months by how often each holding pays, what came in by the ledger over the last twelve, and the yield on what you
// paid beside the yield on today's value. Without it the output is what it always was (README "Invariance").
import { compute as computeHoldings } from "../holdings/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { allLines, isTransfer, tagsOf } from "../../transactions/ledger/compute.js";
import { categoriesOf } from "../../transactions/categories/compute.js";
import { money } from "../../../core/format.js";

/**
 * compute(plan, { today, calendar }) -> {
 *   ready, total (a year), monthly, yieldOverall, items: [{ symbol, name, account, bucket, value, yield, income, known }],
 *   byAccount: [{ name, income }], taxable (income in taxable accounts), sheltered, coversShare (of monthly expenses), expensesMonthly,
 *   qualifiedGuess (the part likely qualified: stock funds in taxable accounts), unknownCount, notes,
 *   calendar (only with calendar: true; null without a today): see calendarOf
 * }
 */
export function compute(plan, params = {}) {
  const h = computeHoldings(plan, params);
  const items = h.items.map((x) => ({ symbol: x.symbol, name: x.name, account: x.accountName, bucket: x.bucket, cls: x.cls, value: x.value, yield: x.yield, income: x.incomeYearly, known: x.yield !== null })).sort((a, b) => b.income - a.income);
  const total = items.reduce((s, x) => s + x.income, 0);
  const byAccountMap = new Map();
  for (const x of items) byAccountMap.set(x.account, (byAccountMap.get(x.account) ?? 0) + x.income);
  const byAccount = [...byAccountMap.entries()].map(([name, income]) => ({ name, income })).sort((a, b) => b.income - a.income);
  const taxable = items.filter((x) => x.bucket === "taxable").reduce((s, x) => s + x.income, 0);
  const qualifiedGuess = items.filter((x) => x.bucket === "taxable" && (x.cls === "us_stocks" || x.cls === "intl_stocks" || x.cls === "balanced")).reduce((s, x) => s + x.income, 0);
  const ex = (plan.expenses ?? []).length ? computeExpenses(plan, { today: params.today ?? null }) : null;
  const expensesMonthly = ex?.monthly ?? 0;
  const notes = [];
  const unknownCount = items.filter((x) => !x.known).length;
  if (unknownCount) notes.push(`${unknownCount} holding${unknownCount === 1 ? " has" : "s have"} no yield on file; type one on the Holdings page (the fund page or the last year's distributions divided by the price).`);
  // under 50 cents rounds to $0 in the money format: no note (a critic's M4: "$0 of it lands in taxable accounts")
  if (taxable >= 0.5) notes.push(taxNote(taxable, qualifiedGuess, plan.meta?.currency ?? "USD"));
  const out = { ready: h.hasData, total, monthly: total / 12, yieldOverall: h.total > 0 ? total / h.total : 0, items, byAccount, taxable, sheltered: total - taxable, coversShare: expensesMonthly > 0 ? total / 12 / expensesMonthly : null, expensesMonthly, qualifiedGuess, unknownCount, notes, portfolio: h.total };
  // (one key more, only when asked: every other page that reads this compute gets the same bytes as before)
  if (params.calendar) out.calendar = calendarOf(plan, h, out, params.today ?? null);
  return out;
}

/**
 * The tax note (one sentence per case, each with a test), in the app's own money format (fix round r2: it printed "3,604" and
 * "about 0", with no currency sign, so Hide amounts could not cover them either), and in plain words (a person critic: "the
 * qualified part" was jargon; the kind is said, and the Federal estimate page's two boxes are named as it labels them):
 *   some taxed lower -> "$3,604 of it lands in taxable accounts and is taxed every year, even when reinvested. About $1,044 looks like the kind taxed at a lower rate: on the Federal estimate page, type that under “Qualified dividends” and the rest under “Other income taxed at regular rates”."
 *   none (under $0.50) -> "$346 of it lands in taxable accounts and is taxed every year, even when reinvested. None of it looks like the kind taxed at a lower rate: on the Federal estimate page, type it under “Other income taxed at regular rates”."
 * Called only for a taxable amount of 50 cents or more.
 */
export function taxNote(taxable, qualified, currency = "USD") {
  const lands = `${money(taxable, currency)} of it lands in taxable accounts and is taxed every year, even when reinvested.`;
  return qualified >= 0.5
    ? `${lands} About ${money(qualified, currency)} looks like the kind taxed at a lower rate: on the Federal estimate page, type that under \u201cQualified dividends\u201d and the rest under \u201cOther income taxed at regular rates\u201d.`
    : `${lands} None of it looks like the kind taxed at a lower rate: on the Federal estimate page, type it under \u201cOther income taxed at regular rates\u201d.`;
}

// ---------------------------------------------------------------- month by month (gap next-60 #8; README "Month by month")
/** How often a holding pays, as typed on Holdings (`paysEvery`): payments a year. */
export const PAYS = Object.freeze({ month: 12, quarter: 4, half: 2, year: 1 });
/** The calendar months (1 to 12) a holding paying n times a year pays in: the app's assumption, said on the page. A fund's
 * own months may differ (no table of payout dates is bundled: README). */
export const PAY_MONTHS = Object.freeze({ 12: Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 4: Object.freeze([3, 6, 9, 12]), 2: Object.freeze([6, 12]), 1: Object.freeze([12]) });
/** The kinds counted as paying every month when the holding does not say: bond funds and cash. Every other kind: every three months. */
export const MONTHLY_KINDS = Object.freeze(["bonds", "cash"]);
/** paysPerYear(holding) -> 12, 4, 2 or 1: its own `paysEvery` when that is one of PAYS, else by its kind (`cls`). */
export function paysPerYear(h) {
  const own = Object.prototype.hasOwnProperty.call(PAYS, h?.paysEvery ?? "") ? PAYS[h.paysEvery] : null;
  if (own) return own;
  return MONTHLY_KINDS.includes(h?.cls) ? 12 : 4;
}
const YM = /^(\d{4})-(\d{2})$/;
/** ymAdd("2026-11", 2) -> "2027-01"; ymAdd("2026-01", -1) -> "2025-12". */
export function ymAdd(ym, k) {
  const m = YM.exec(String(ym ?? ""));
  if (!m) return null;
  const t = Number(m[1]) * 12 + (Number(m[2]) - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
const monthOf = (ym) => Number(String(ym).slice(5, 7));
/**
 * spreadMonths(items, today) -> [{ ym, amount }] x 12, this month first: each holding's yearly income (incomeYearly, or
 * income) cut into paysPerYear equal payments, one in each of its pay months (PAY_MONTHS). The twelve add up to the
 * holdings' yearly total. Amounts are not rounded (the page rounds what it shows).
 */
export function spreadMonths(items, today) {
  const start = String(today ?? "").slice(0, 7);
  if (!YM.test(start)) return [];
  const months = Array.from({ length: 12 }, (_, k) => ({ ym: ymAdd(start, k), amount: 0 }));
  for (const h of items ?? []) {
    const income = Number(h?.incomeYearly ?? h?.income) || 0;
    if (!(income > 0)) continue;
    const n = paysPerYear(h), at = PAY_MONTHS[n];
    for (const m of months) if (at.includes(monthOf(m.ym))) m.amount += income / n;
  }
  return months;
}
const cents = (x) => Math.round((Number(x) || 0) * 100);
/**
 * shapeOf(months) -> { shape, peak, low, every?, quarter?, other?, zeroAt }: the pattern the page's sentence names.
 *   "none"      nothing in any month
 *   "even"      the same in every month (`every`)
 *   "quarters"  one amount in March, June, September and December (`quarter`), a smaller one (or nothing) in the other eight (`other`)
 *   "other"     any other pattern
 * peak: the first month with the most, low: the first with the least, zeroAt: the first with nothing (or null). Compared in cents.
 */
export function shapeOf(months) {
  const list = months ?? [];
  const c = list.map((m) => cents(m.amount));
  if (!list.length || Math.max(...c) <= 0) return { shape: "none", peak: null, low: null, zeroAt: null };
  const max = Math.max(...c), min = Math.min(...c);
  const peak = list[c.indexOf(max)], low = list[c.indexOf(min)];
  const zero = list.find((m, i) => c[i] <= 0) ?? null;
  const base = { peak: { ym: peak.ym, amount: peak.amount }, low: { ym: low.ym, amount: low.amount }, zeroAt: zero?.ym ?? null };
  if (max === min) return { shape: "even", every: peak.amount, ...base };
  const q = list.filter((m) => monthOf(m.ym) % 3 === 0), o = list.filter((m) => monthOf(m.ym) % 3 !== 0);
  const one = (xs) => xs.length > 0 && xs.every((m) => cents(m.amount) === cents(xs[0].amount));
  if (q.length === 4 && one(q) && one(o) && cents(q[0].amount) > cents(o[0].amount)) return { shape: "quarters", quarter: q[0].amount, other: o[0].amount, ...base };
  return { shape: "other", ...base };
}

/** The ledger's words for a dividend: the tags a line may carry instead of the category. */
export const DIVIDEND_TAGS = Object.freeze(["dividend", "dividends"]);
/** The categories that hold dividends: the built-in "Dividends and interest" (income-investment) and any income category of
 * the person's own whose name says "dividend". */
export function dividendCategories(plan) {
  const ids = new Set(["income-investment"]);
  for (const c of categoriesOf(plan, { all: true })) if (c.kind === "income" && /dividend/i.test(String(c.label ?? ""))) ids.add(c.id);
  return ids;
}
/**
 * receivedOf(plan, today) -> null (no dividend line in those twelve months) | { total, months: [{ ym, amount }] x 12 (oldest first,
 * this month last), lines, since, peak: { ym, amount } }.
 * A line counts when it is money in (amount above 0), in this month or the eleven before it, not a transfer, not left out
 * of the totals (ledger allLines: a split purchase's parts, never a line marked to leave out or paid back), and its
 * category is one of dividendCategories or it carries a DIVIDEND_TAGS tag. since: the month of the ledger's first line
 * (any line) when that is after the first of those months, else null (a full year of transactions).
 */
export function receivedOf(plan, today) {
  const end = String(today ?? "").slice(0, 7);
  if (!YM.test(end)) return null;
  const start = ymAdd(end, -11);
  const months = Array.from({ length: 12 }, (_, k) => ({ ym: ymAdd(start, k), amount: 0 }));
  const cats = dividendCategories(plan);
  let lines = 0, first = null;
  for (const t of plan?.transactions ?? []) { const d = String(t?.date ?? "").slice(0, 7); if (YM.test(d) && (first === null || d < first)) first = d; }
  for (const t of allLines(plan)) {
    const amount = Number(t?.amount);
    if (!(amount > 0)) continue;
    const d = String(t?.date ?? "").slice(0, 7);
    if (!YM.test(d) || d < start || d > end) continue;
    if (!(cats.has(t.category) || tagsOf(t).some((g) => DIVIDEND_TAGS.includes(g)))) continue;
    if (isTransfer(t, plan)) continue;
    months[(Number(d.slice(0, 4)) * 12 + monthOf(d)) - (Number(start.slice(0, 4)) * 12 + monthOf(start))].amount += amount;
    lines++;
  }
  if (!lines) return null;
  const total = months.reduce((s, m) => s + m.amount, 0);
  const c = months.map((m) => cents(m.amount)), peak = months[c.indexOf(Math.max(...c))];
  return { total, months, lines, since: first !== null && first > start ? first : null, peak: { ym: peak.ym, amount: peak.amount } };
}

/**
 * yieldsOf(items, { total, portfolio }) -> { onCost, onValue, income, cost, value, counted, all, case }
 *   over the holdings with what was paid on file (costBasis above 0), `counted` of `all`:
 *   onCost = their yearly income / what was paid for them; onValue = the same income / what they are worth today.
 *   With no cost on file anywhere: onCost null and onValue = total / portfolio (the page's own "yield on" figure).
 *   case: "noCost"; "same" when the two differ by less than 0.05 points; "grown" when onCost is the higher (paid less than
 *   they are worth now); "fallen" otherwise. `items` are Holdings' enriched holdings (incomeYearly, costBasis, value).
 */
export function yieldsOf(items, { total = 0, portfolio = 0 } = {}) {
  const all = (items ?? []).length;
  const paid = (items ?? []).filter((h) => (Number(h?.costBasis) || 0) > 0);
  if (!paid.length) return { onCost: null, onValue: portfolio > 0 ? total / portfolio : 0, income: total, cost: 0, value: portfolio, counted: 0, all, case: "noCost" };
  const income = paid.reduce((s, h) => s + (Number(h.incomeYearly ?? h.income) || 0), 0);
  const cost = paid.reduce((s, h) => s + (Number(h.costBasis) || 0), 0);
  const value = paid.reduce((s, h) => s + (Number(h.value) || 0), 0);
  const onCost = income / cost, onValue = value > 0 ? income / value : 0;
  return { onCost, onValue, income, cost, value, counted: paid.length, all, case: Math.abs(onCost - onValue) < 0.0005 ? "same" : onCost > onValue ? "grown" : "fallen" };
}

/**
 * calendarOf(plan, holdingsResult, dividendsResult, today) -> null without a today, else
 * { months, shape, peak, low, every?, quarter?, other?, zeroAt, received, yields }: spreadMonths of the holdings, shapeOf
 * those months, receivedOf the ledger, yieldsOf the holdings.
 */
export function calendarOf(plan, h, d, today) {
  if (!YM.test(String(today ?? "").slice(0, 7))) return null;
  const months = spreadMonths(h.items, today);
  return { months, ...shapeOf(months), received: receivedOf(plan, today), yields: yieldsOf(h.items, { total: d.total, portfolio: d.portfolio }) };
}
