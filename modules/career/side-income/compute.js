// modules/career/side-income/compute.js -- PURE. Money that comes in unevenly (gigs, freelance work, a small business on
// the side), counted the careful way: from the last twelve months as typed, the amount reached in at least three
// months out of four (what the plan should count on), the average, the spread, the cushion that paying yourself the
// average would have needed, the share of each payment to set aside for tax (self-employment tax, federal and state at
// the margin), the next quarterly payment, and the forms and mileage rate that come with it.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeSelfEmployment } from "../../taxes/self-employment/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { compute as computeEstimated } from "../../taxes/estimated/compute.js";
import { RULES, rulesFor, mileageOn, THRESHOLDS } from "./data/rules.js";

/** Count on what came in in at least this share of months (3 in 4). */
export const RELIABLE = 0.75;
export const MONTHS = 12;
/** Fewer typed months than this and the page shows no figures from them. */
export const MIN_MONTHS = 3;

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** The last `n` whole months before `today`, oldest first, as "YYYY-MM". */
export function lastMonths(today, n = MONTHS) {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  return Array.from({ length: n }, (_, i) => { const t = y * 12 + (m - 1) - (n - i); return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; });
}

/**
 * Figures from typed months (blanks left out): average, median, lowest, highest; the reliable amount = the largest
 * figure reached in at least 75% of the months (sorted rising, the one at n - ceil(0.75 n)); the spread = standard
 * deviation / average; the cushion = the deepest the running total of (average - month) went, the money needed to pay
 * yourself the average every month through those months, and the month it was deepest.
 */
export function monthStats(values, labels = []) {
  const typed = values.map((v, i) => ({ v: num(v), label: labels[i] ?? String(i) })).filter((x) => x.v !== null);
  const n = typed.length;
  if (!n) return { n: 0 };
  const xs = typed.map((x) => x.v);
  const sorted = [...xs].sort((a, b) => a - b);
  const average = xs.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const reliable = sorted[n - Math.ceil(RELIABLE * n)];
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - average) ** 2, 0) / n);
  let run = 0, cushion = 0, deepest = null;
  typed.forEach((x) => { run += average - x.v; if (run > cushion + 1e-9) { cushion = run; deepest = x.label; } });
  const zeros = xs.filter((x) => x <= 0).length;
  return { n, average, median, low: sorted[0], high: sorted[n - 1], reliable, reached: xs.filter((x) => x >= reliable).length, spread: average > 0 ? sd / average : null, cushion, deepest, zeros };
}

/**
 * compute(plan, { today }) -> {
 *   ready, year, months (labels), items: [{ id, name, personName, monthly (Income page), period, typedMonths, stats, enough, countOn, gap, below }],
 *   setAside: { rate (of each payment received), yearly (the tax this income adds), quarter, state, stateKnown, stateAverage, onAverage } | null,
 *   estimates: { needed, nextDue: { due, label, amount } | null (the next quarter not yet past), overdue: { due, label, amount } | null (past quarters not paid) } (the whole return, from the Estimated payments page),
 *   rules: { year (of the table used), stale, form1099NEC, form1099K: { apps: { amount, payments }, cards }, mileage, mileageSteps }, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const year = Number(today.slice(0, 4));
  const inc = computeIncome(plan, { today });
  const side = inc.active.filter((x) => x.type === "business" && x.period !== "once");
  const R = rulesFor(year);
  const rulesYear = RULES[year] ? year : Math.max(...Object.keys(RULES).map(Number).filter((y) => y <= year));
  const rules = { year: rulesYear, stale: rulesYear !== year, form1099NEC: R.form1099NEC, form1099K: R.form1099K, mileage: mileageOn(today), mileageSteps: R.mileage };
  const months = lastMonths(today);
  if (!side.length) return { ready: false, year, months, items: [], rules, notes: [] };
  const saved = plan.whatIfs?.sideIncome ?? {};
  const notes = [];
  const items = side.map((x) => {
    const typedMonths = months.map((m) => num(saved[x.id]?.months?.[m]));
    const stats = monthStats(typedMonths, months);
    const enough = stats.n >= MIN_MONTHS;
    return {
      id: x.id, name: x.name || "Side income", personName: x.personName, monthly: x.monthly, period: x.period, typedMonths, stats, enough,
      countOn: enough ? stats.reliable : null,
      gap: enough ? x.monthly - stats.reliable : null,   // how far the Income page's figure is above the reliable one
      below: enough ? typedMonths.filter((v) => v !== null && v < x.monthly - 0.5).length : null,
    };
  });

  // the tax: worked on what comes in on average (the months typed), not on the careful figure the plan counts on
  const onAverage = items.some((it) => it.enough);
  const taxPlan = onAverage ? { ...plan, income: (plan.income ?? []).map((x) => { const it = items.find((y) => y.id === x.id && y.enough); return it ? { ...x, amount: it.stats.average, period: "monthly" } : x; }) } : plan;
  const se = computeSelfEmployment(taxPlan, { today });
  const st = computeState(taxPlan, { today });
  let setAside = null;
  if (se.ready && se.net > 0) {
    // the share of each payment received: the year's tax this income adds (self-employment, federal income and the
    // 0.9% Medicare tax, from the Self-employment page; the state's rate on the profit) over what comes in before expenses
    const gross = computeIncome(taxPlan, { today }).active.filter((x) => x.type === "business" && x.taxable !== false && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
    const state = (st.rate ?? 0) * se.net;
    const yearly = se.businessTax + state;
    setAside = { rate: gross > 0 ? yearly / gross : 0, yearly, quarter: yearly / 4, federal: se.businessTax, state, stateKnown: st.rate !== null, stateAverage: st.method === "prior", onAverage };
    if (st.rate === null) notes.push("Your state's income tax is not in the share to set aside: set its rate on the State tax page.");
    else if (st.method === "prior") notes.push("The state part uses last year's average state rate; the tax on extra income is often higher.");
  }
  // whether the whole return needs quarterly payments, and the next one (the Estimated payments page)
  const est = computeEstimated(taxPlan, { today });
  const estimates = { needed: !!est.needsEstimates, nextDue: est.nextDue ?? null, overdue: est.overdue ?? null };
  return { ready: true, year, months, items, setAside, estimates, rules, notes };
}
