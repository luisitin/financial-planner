// modules/system/assumptions/compute.js -- PURE. The plan-wide assumptions: what each one
// means, where its default comes from, what it is set to now, and whether the owner has
// reviewed them recently. Every projection page reads plan.assumptions directly; this page
// is where a person sees and changes them.
import { realRate } from "../../../core/math/finance.js";
import { daysBetween } from "../../../core/math/dates.js";

// kind: "percent" is stored as a fraction (0.07) and typed as 7; "years" and "months" are whole numbers.
export const ASSUMPTIONS = [
  { key: "inflation", label: "Inflation each year", kind: "percent", def: 0.03, min: 0, max: 0.2,
    source: "US consumer prices rose about 3% a year on average over the last century (Bureau of Labor Statistics, CPI-U). The Federal Reserve aims for 2%." },
  { key: "returnStocks", label: "Stocks grow each year", kind: "percent", def: 0.07, min: -0.1, max: 0.3,
    source: "US large stocks returned roughly 10% a year before inflation over the long run (Damodaran's yearly returns table from 1928, Shiller's data from 1871). Planners often use 7% to leave room for fees and bad decades." },
  { key: "returnBonds", label: "Bonds grow each year", kind: "percent", def: 0.04, min: -0.1, max: 0.2,
    source: "US 10-year Treasury bonds returned about 4.5-5% a year over the long run (Damodaran); investment-grade bond funds yielded 4-5% in the mid-2020s." },
  { key: "returnCash", label: "Cash and savings earn each year", kind: "percent", def: 0.02, min: -0.05, max: 0.15,
    source: "Savings and money-market rates were 4-5% in 2023-2025 and near zero in 2010-2021. Over long periods cash roughly keeps pace with inflation, so 2% is a middle guess." },
  { key: "stdevStocks", label: "How much stocks swing (a typical year)", kind: "percent", def: 0.15, min: 0, max: 0.6,
    source: "One standard deviation of yearly US stock returns is about 15-20% historically (Damodaran). Used by the Monte Carlo pages." },
  { key: "stdevBonds", label: "How much bonds swing (a typical year)", kind: "percent", def: 0.05, min: 0, max: 0.3,
    source: "About 5-8% for 10-year Treasuries historically (Damodaran). Used by the Monte Carlo pages." },
  { key: "salaryGrowth", label: "Pay rises each year", kind: "percent", def: 0.03, min: 0, max: 0.2,
    source: "Wages grew roughly 3-4% a year through the 2010s and 2020s (Bureau of Labor Statistics, employment cost index): about inflation plus a little." },
  { key: "retirementAge", label: "Retirement age", kind: "years", def: 65, min: 30, max: 100,
    source: "The usual planning age. Medicare starts at 65; full Social Security retirement age is 67 for people born in 1960 or later. Each person can override it on the People page." },
  { key: "planEndAge", label: "Plan the money to last to age", kind: "years", def: 95, min: 60, max: 120,
    source: "About one in five 65-year-olds today will live past 90 (Social Security Administration life tables), so planning to 95 leaves a margin. Each person can override it." },
  { key: "emergencyMonths", label: "Emergency fund, in months of must-pay bills", kind: "months", def: 6, min: 0, max: 24,
    source: "The usual advice is three to six months of essential expenses; six or more if income is irregular or there is one earner." },
];

/**
 * compute(plan, { today }) -> {
 *   rows: [{ key, label, kind, def, value, changed, source }],
 *   reviewedAt, daysSinceReview, stale (no review, or more than a year ago), changedCount,
 *   realStocks, realBonds, realCash (returns after inflation), warnings: [text]
 * }
 */
export function compute(plan, params = {}) {
  const a = plan.assumptions ?? {};
  const rows = ASSUMPTIONS.map((x) => { const value = a[x.key] === undefined || a[x.key] === null ? x.def : Number(a[x.key]); return { ...x, value, changed: Math.abs(value - x.def) > 1e-9 }; });
  const reviewedAt = a.reviewedAt ?? null;
  const daysSinceReview = reviewedAt && params.today ? daysBetween(reviewedAt, params.today) : null;
  const val = (k) => rows.find((r) => r.key === k).value;
  const warnings = [];
  if (val("returnStocks") < val("returnBonds")) warnings.push("Stocks are set to grow less than bonds. Unusual, but allowed.");
  if (val("returnStocks") - val("inflation") > 0.08) warnings.push("Stocks are set to beat inflation by more than 8% a year. History says that is optimistic.");
  if (val("retirementAge") >= val("planEndAge")) warnings.push("The retirement age is at or past the plan's end age.");
  return {
    rows, reviewedAt, daysSinceReview, stale: !reviewedAt || (daysSinceReview !== null && daysSinceReview > 365),
    changedCount: rows.filter((r) => r.changed).length,
    realStocks: realRate(val("returnStocks"), val("inflation")), realBonds: realRate(val("returnBonds"), val("inflation")), realCash: realRate(val("returnCash"), val("inflation")),
    warnings,
  };
}
