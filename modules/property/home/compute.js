// modules/property/home/compute.js -- PURE. Your home: what it is worth and what you own of it, how it has grown
// since you bought it, what it costs a year to keep (tax, insurance, dues, upkeep, the mortgage's interest), what
// you would walk away with if you sold today (selling costs, and tax only on a gain above the $250,000 or
// $500,000 that is tax-free), and the value and equity in 5, 10 and 20 years as it grows and the mortgage shrinks.
import { compute as computeMortgage } from "../../debt/mortgage/compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";
import { monthsBetween } from "../../../core/math/dates.js";

/** Upkeep is often put at 1% of the value a year (more for older homes); selling costs about 6% (agent and closing); values about 3.5% a year over the long run. */
export const DEFAULTS = { maintenance: 0.01, sellCosts: 0.06, appreciation: 0.035 };
/** Gain on a main home that is tax-free when sold (IRC §121): owned and lived in two of the last five years. */
export const EXCLUSION = { single: 250000, married_joint: 500000 };

/** Yearly growth between two values over `months`. */
export function growthRate(from, to, months) {
  if (!(from > 0) || !(to > 0) || !(months >= 12)) return null;
  return Math.pow(to / from, 12 / months) - 1;
}

/**
 * compute(plan, { today }) -> {
 *   ready, name, value, owed, equity, equityShare, ltv, details, bought: { price, date, years, growth } | null,
 *   history: [{ date, value }], costs: { lines, total, monthly }, sale: { costs, gain, exclusion, taxable, tax, net },
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

  // selling today
  const fed = computeFederal(plan, { today });
  const status = fed.filingStatus;
  const exclusion = status === "married_joint" ? EXCLUSION.married_joint : EXCLUSION.single;
  const sellCosts = value * n(e.sellCosts, DEFAULTS.sellCosts);
  const basis = price !== null ? price + n(e.improvements, 0) : null;
  const gain = basis !== null ? value - sellCosts - basis : null;
  const taxable = gain !== null ? Math.max(0, gain - exclusion) : 0;
  // the gains rate on the next dollars of long-term gain: 15% for most, 20% at the top; 3.8% more above $200,000 / $250,000 of income
  const gainsRate = taxable > 0 ? (fed.result.taxableIncome + taxable > (status === "married_joint" ? 600050 : 533400) ? 0.20 : 0.15) + (fed.result.agi + taxable > (status === "married_joint" ? 250000 : 200000) ? 0.038 : 0) : 0;
  const sale = { costs: sellCosts, basis, gain, exclusion, taxable, rate: gainsRate, tax: taxable * gainsRate, net: value - sellCosts - owed - taxable * gainsRate };

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
