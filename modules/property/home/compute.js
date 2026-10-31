// modules/property/home/compute.js -- PURE. Your home: what it is worth and what you own of it, how it has grown
// since you bought it, what it costs a year to keep (tax, insurance, dues, upkeep, the mortgage's interest), what
// you would walk away with if you sold today (selling costs, and the federal tax on the gain: the $250,000 or $500,000
// that is tax-free once you have owned and lived in it two of the last five years, a short-term gain taxed like pay,
// the rest at 0/15/20% and the 3.8%, worked through the federal estimate), and the value and equity in 5, 10 and 20
// years as it grows and the mortgage shrinks.
import { compute as computeMortgage } from "../../debt/mortgage/compute.js";
import { taxInputs, todaysReturn } from "../../taxes/federal/compute.js";
import { longOn } from "../../investments/tax-lots/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";
import { monthsBetween, daysBetween, isoOf } from "../../../core/math/dates.js";

/** Upkeep is often put at 1% of the value a year (more for older homes); selling costs about 6% (agent and closing); values about 3.5% a year over the long run. */
export const DEFAULTS = { maintenance: 0.01, sellCosts: 0.06, appreciation: 0.035 };
/** Gain on a main home that is tax-free when sold (IRC 121(b)(1)-(2)): $250,000, $500,000 on a joint return. */
export const EXCLUSION = { single: 250000, married_joint: 500000 };
/** Owned and lived in for 730 days or 24 full months of the five years before the sale (121(a); 26 CFR 1.121-1(c)(1): "24 full months or for 730 days (365 x 2)"). */
export const USE = { days: 730, months: 24 };

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
 *   test: { days, months, meets, from } | null, reduced, rate (tax / taxable), tax, niit, incomeTax, year, otherYear, filingStatus, net },
 *   ahead: [{ years, year, value, owed, equity }], appreciation
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const homes = (plan.accounts ?? []).filter((a) => a.type === "property");
  const entries = (plan.property ?? []).filter((x) => x.kind === "home");
  const acct = homes.find((a) => entries.some((e) => e.accountId === a.id)) ?? homes.sort((a, b) => countedBalance(b) - countedBalance(a))[0] ?? null;
  if (!acct) return { ready: false };
  const e = entries.find((x) => x.accountId === acct.id) ?? {};
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
  const pay = m ? yearOfPayments(m.balance, m.rate ?? 0, m.payment + (m.extra || 0)) : { interest: 0, principal: 0 };
  const itemized = plan.taxes?.itemized ?? {};
  const lines = [
    { key: "tax", label: "Property tax", amount: n(e.propertyTax, n(itemized.propertyTax, 0)) },
    { key: "insurance", label: "Home insurance", amount: n(e.insurance, 0) },
    { key: "hoa", label: "Association dues", amount: n(e.hoaMonthly, 0) * 12 },
    { key: "maintenance", label: "Upkeep and repairs", amount: value * n(e.maintenance, DEFAULTS.maintenance) },
    { key: "interest", label: "Mortgage interest", amount: pay.interest },
  ].filter((l) => l.amount > 0.5);
  const total = lines.reduce((s, l) => s + l.amount, 0);

  // selling today: the federal tax on the gain, worked through the federal estimate in today's tax year
  const yr = todaysReturn(plan, today);
  const ti = taxInputs(yr.plan, { today });
  const status = ti.filingStatus;
  const cap = status === "married_joint" ? EXCLUSION.married_joint : EXCLUSION.single;
  const sellCosts = value * n(e.sellCosts, DEFAULTS.sellCosts);
  const basis = price !== null ? price + n(e.improvements, 0) : null;
  const gain = basis !== null ? value - sellCosts - basis : null;
  // the two-year test (121(a)); without a purchase date it is taken as met. Not met: no exclusion, unless the sale is for a
  // new job, health or an event you could not foresee (121(c)): then the cap times the share of the two years, by days or by
  // full months, whichever is larger (26 CFR 1.121-3(g)(1): "expressed in days or months")
  const test = date && today ? twoYearTest(date, today) : null;
  const reduced = test && !test.meets && e.reducedReason === true ? Math.min(1, Math.max(test.days / USE.days, test.months / USE.months)) : null;
  const exclusion = !test || test.meets ? cap : reduced !== null ? cap * reduced : 0;
  const taxable = gain !== null ? Math.max(0, gain - exclusion) : 0;
  // held more than a year (from the day after the purchase) is long-term (IRC 1222(3); Tax lots' longOn); a year or less is
  // short-term and taxed like pay. The gain is investment income for the 3.8% tax (1411(c)(1)(A)(iii)); the excluded part is not
  // (1.1411-4(d)(3)(ii) Example 3). The engine stacks a long-term gain through the year's 0/15/20% bands and charges the 3.8% on
  // the lesser of the investment income and the income over the line (1(h), 1411(a)(1))
  const longFrom = date ? longOn(date) : null;
  const term = longFrom && today && today < longFrom ? "short" : "long";
  const r0 = federalTax(ti.inputs, ti.params);
  const r1 = taxable > 0 ? federalTax({ ...ti.inputs, ...(term === "short" ? { otherOrdinary: (Number(ti.inputs.otherOrdinary) || 0) + taxable } : { qualifiedIncome: (Number(ti.inputs.qualifiedIncome) || 0) + taxable }), investmentIncome: (Number(ti.inputs.investmentIncome) || 0) + taxable }, ti.params) : r0;
  const tax = Math.max(0, r1.totalTax - r0.totalTax), niit = Math.max(0, (r1.niit || 0) - (r0.niit || 0));
  const sale = { costs: sellCosts, basis, gain, cap, exclusion, excluded: gain !== null ? Math.min(exclusion, Math.max(0, gain)) : 0, taxable, term, longOn: longFrom, test, reduced, rate: taxable > 0 ? tax / taxable : 0, tax, niit, incomeTax: tax - niit, year: yr.year, otherYear: yr.other, filingStatus: status, net: value - sellCosts - owed - tax };

  // ahead: the value growing, the mortgage on its schedule
  const appreciation = n(e.appreciation, DEFAULTS.appreciation);
  const y0 = today ? Number(String(today).slice(0, 4)) : 2026;
  // the mortgage page's schedule: one row per year from now ({ year: 1, 2, ..., endBalance }), ending when it is paid off
  const owedIn = (years) => { if (!m) return 0; const sch = mort.schedule ?? []; const row = sch.find((r) => r.year === years); return row ? row.endBalance : sch.length && years > sch[sch.length - 1].year ? 0 : owed; };
  const ahead = [5, 10, 20].map((years) => { const v = value * Math.pow(1 + appreciation, years), o = owedIn(years); return { years, year: y0 + years, value: v, owed: o, equity: v - o }; });
  return {
    ready: true, accountId: acct.id, name: e.name || acct.name, value, owed, mortgageName: m?.name ?? null, equity, equityShare: value > 0 ? equity / value : null, ltv: value > 0 ? owed / value : null,
    details: e, bought, history, costs: { lines, total, monthly: total / 12, principal: pay.principal }, sale, ahead, appreciation, pmi: mort.pmi ?? null,
  };
}
