// modules/system/assumptions/compute.js -- PURE. The plan-wide assumptions: what each one
// means, where its default comes from, what it is set to now, and whether the owner has
// reviewed them recently. Every projection page reads plan.assumptions directly; this page
// is where a person sees and changes them.
import { realRate } from "../../../core/math/finance.js";
import { daysBetween } from "../../../core/math/dates.js";

// kind: "percent" is stored as a fraction (0.07) and typed as 7; "years" and "months" are whole numbers.
// label: the words on the page only (plain words, spec 13.1, C10: "How bumpy stocks are, in a typical year" for the swing);
// the key is what the plan stores and every page reads.
export const ASSUMPTIONS = [
  { key: "inflation", label: "Inflation each year", kind: "percent", def: 0.03, min: 0, max: 0.2,
    source: "US consumer prices rose about 3% a year on average over the last century (Bureau of Labor Statistics, CPI-U). The Federal Reserve aims for 2%." },
  { key: "returnStocks", label: "Stocks grow each year", kind: "percent", def: 0.07, min: -0.1, max: 0.3,
    source: "US large stocks returned roughly 10% a year before inflation over the long run (Damodaran's yearly returns table from 1928, Shiller's data from 1871). Planners often use 7% to leave room for fees and bad decades." },
  { key: "returnBonds", label: "Bonds grow each year", kind: "percent", def: 0.04, min: -0.1, max: 0.2,
    source: "US 10-year Treasury bonds returned about 4.5-5% a year over the long run (Damodaran); investment-grade bond funds yielded 4-5% in the mid-2020s." },
  { key: "returnCash", label: "Cash and savings earn each year", kind: "percent", def: 0.02, min: -0.05, max: 0.15,
    source: "Savings and money-market rates were 4-5% in 2023-2025 and near zero in 2010-2021. Over long periods cash roughly keeps pace with inflation, so 2% is a middle guess." },
  { key: "stdevStocks", label: "How bumpy stocks are, in a typical year", kind: "percent", def: 0.15, min: 0, max: 0.6,
    source: "One standard deviation of yearly US stock returns is about 15-20% historically (Damodaran). Used by Chance the money lasts." },
  { key: "stdevBonds", label: "How bumpy bonds are, in a typical year", kind: "percent", def: 0.05, min: 0, max: 0.3,
    source: "About 5-8% for 10-year Treasuries historically (Damodaran). Used by Chance the money lasts." },
  { key: "salaryGrowth", label: "Pay raises each year", kind: "percent", def: 0.03, min: 0, max: 0.2,
    source: "Wages grew roughly 3-4% a year through the 2010s and 2020s (Bureau of Labor Statistics, employment cost index): about inflation plus a little." },
  { key: "retirementAge", label: "Retirement age", kind: "years", def: 65, min: 30, max: 100,
    source: "The usual planning age. Medicare starts at 65; full Social Security retirement age is 67 for people born in 1960 or later. Each person can override it on the People page." },
  { key: "planEndAge", label: "Plan the money to last to age", kind: "years", def: 95, min: 60, max: 120,
    source: "About one in five 65-year-olds today will live past 90 (Social Security Administration life tables), so planning to 95 leaves a margin. Each person can override it." },
  { key: "emergencyMonths", label: "Emergency fund, in months of must-pay bills", kind: "months", def: 6, min: 0, max: 24,
    source: "The usual advice is three to six months of essential expenses; six or more if income is irregular or there is one earner." },
];

// ---- careful, middle and hopeful (owner's request 2026-11-11, spec L5; sources in README "Careful, middle and hopeful") ----
/** How fast stocks grow: three figures to pick from above the box, each with why; the middle one is the default (ours). */
export const RETURN_PRESETS = [
  { name: "Careful", value: 0.06, why: "inside Vanguard's range for U.S. stocks over the next 10 years (4.8%-6.8%, as of 2026-09-30) and a little under FP Canada's 2026 planning guideline (6.4%)" },
  { name: "Middle", value: 0.07, ours: true, why: "what the plan uses unless you change it: a common planning figure that leaves room for fees and bad decades" },
  { name: "Hopeful", value: 0.08, why: "closer to the last hundred years (U.S. large stocks grew roughly 10% a year since 1928, Damodaran), which few forecasters expect again" },
];
/** How fast prices rise: a lower and a higher figure around ours. */
export const INFLATION_PRESETS = [
  { value: 0.025, why: "a little above the Federal Reserve's 2% aim (FP Canada's 2026 planning guidelines use 2.1%)" },
  { value: 0.03, ours: true, why: "about the U.S. average over the last century (Bureau of Labor Statistics, CPI-U)" },
  { value: 0.04, why: "room for years like 2021 to 2023, when prices rose faster (Bureau of Labor Statistics, CPI-U)" },
];
/** Above this, a stock return is higher than any forecast we know (the Hopeful preset). */
export const HOPEFUL_MAX = 0.08;
/**
 * The forecasts said beside the stock figures: each figure with the day it is as of, in one place, and the day we last opened
 * the two pages (`readOn`). When a forecaster publishes again this is the one edit (review 2026-11-12, M6: the line still said
 * J.P. Morgan's 6.7% three weeks after its 2027 edition put U.S. large companies at 7.5%, above this plan's middle figure).
 * Vanguard: its return forecasts page, 10-year annualized, U.S. equities. J.P. Morgan Asset Management: the press release
 * "J.P. Morgan releases 2027 Long-Term Capital Market Assumptions", U.S. large cap equities, a 10 to 15 year outlook.
 */
export const FORECASTS = {
  readOn: "2026-11-12",
  vanguard: { low: 0.048, high: 0.068, asOf: "2026-09-30" },
  jpMorgan: { value: 0.075, edition: 2027, released: "2026-10-19", before: 0.067 },
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pctOf = (x) => `${Number((x * 100).toFixed(2))}%`;
const monthYear = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
/** The one line under the stock figures: what the forecasters say, with their dates. They differ, and it says so. */
export const FORECAST_LINE = `Forecasts for the next 10 years or so differ: ${pctOf(FORECASTS.vanguard.low)}-${pctOf(FORECASTS.vanguard.high)} a year for U.S. stocks (Vanguard, as of ${FORECASTS.vanguard.asOf}); ${pctOf(FORECASTS.jpMorgan.value)} (J.P. Morgan, ${monthYear(FORECASTS.jpMorgan.released)}).`;
/** Where J.P. Morgan's figure comes from, for the sources fold. */
export const FORECAST_SOURCE = `J.P. Morgan's figure is for U.S. large companies, from its ${FORECASTS.jpMorgan.edition} long-term capital market assumptions (${FORECASTS.jpMorgan.released}; 10 to 15 years; the edition before said ${pctOf(FORECASTS.jpMorgan.before)}).`;
/** The amber words for a stock return above HOPEFUL_MAX. */
export const HOPEFUL_WORDS = "Higher than any forecast we know; plan on it only if you have a reason.";
/** The plan's stock return is above the hopeful preset (every page's answer then rests on it: the projection's tag). */
export const hopefulReturn = (plan) => { const v = plan?.assumptions?.returnStocks; return (v === undefined || v === null ? 0.07 : Number(v)) > HOPEFUL_MAX + 1e-9; };
// ---- health costs that rise faster than prices (gap design #10, 2026-11-13; README "Health costs that rise faster than prices") ----
/** The most the plan takes: 10 points a year above prices (a typed figure above it is held to it). */
export const HEALTH_GROWTH_MAX = 0.1;
/** The chips, low to high. "With prices" stores nothing: the plan is then exactly what it was before this choice existed. */
export const HEALTH_PRESETS = [
  { value: 0, label: "With prices" },
  { value: 0.01, label: "1 point faster" },
  { value: 0.02, label: "2 points faster" },
];
/**
 * What the choices are set beside. The one published figure is the country's health spending against its economy, not any one
 * household's premiums against prices, and the page says so: CMS Office of the Actuary, National Health Expenditure Projections
 * 2025-34 (Health Affairs, published online June 2026): spending grows 5.4% a year on average against 4.1% for the economy,
 * and goes from 18.0% of the economy in 2024 to 20.6% in 2034. `gap` is the published pair's difference, 5.4 - 4.1 = 1.3
 * points (the two shares give much the same: (20.6 / 18.0)^(1/10) - 1 = 1.36%). `readOn`: the day the figures were last read
 * (the paper's projection table and reports on it, through search summaries; README).
 */
export const HEALTH_SOURCE = { readOn: "2026-11-14", growth: 0.054, economy: 0.041, shareFrom: 0.18, shareFromYear: 2024, shareTo: 0.206, shareToYear: 2034, gap: Number((0.054 - 0.041).toFixed(4)) };
/** "1.3": the gap in points, as the page says it. */
export const healthGapPoints = () => Number((HEALTH_SOURCE.gap * 100).toFixed(1));
/** The sentence beside the chips: what the government's actuaries expect, and that the choice is the person's own. */
export const HEALTH_SOURCE_LINE = `The government's actuaries expect the country's health spending to grow about ${healthGapPoints()} points a year faster than the economy through ${HEALTH_SOURCE.shareToYear} (Centers for Medicare and Medicaid Services, June 2026). Nobody knows what your own premiums will do, so this is your choice, not a forecast.`;
/** Above this (5 points a year) the row adds an amber line: allowed, to try a bad case, but far above the published figure. */
export const HEALTH_GROWTH_HIGH = 0.05;
/** The amber line for a rate above HEALTH_GROWTH_HIGH; "" at or under it. */
export const healthHighWords = (h) => (h > HEALTH_GROWTH_HIGH + 1e-9 ? `${healthPoints(h)} a year is far above what the government's actuaries expect (about ${healthGapPoints()}). Kept up for decades it multiplies health costs many times over, so use it to try a bad case, not as your plan.` : "");
/**
 * healthGrowthOf(plan) -> how much faster than prices health costs rise each year, a fraction: `assumptions.healthGrowth`,
 * held between 0 and HEALTH_GROWTH_MAX. Absent, empty, negative or not a number (true, a list, words): 0, "with prices", and nothing changes.
 */
export function healthGrowthOf(plan) {
  const raw = plan?.assumptions?.healthGrowth;
  // a number, or a number typed as text; never true, an array or anything else Number() would turn into one
  const v = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
  return Number.isFinite(v) && v > 0 ? Math.min(v, HEALTH_GROWTH_MAX) : 0;
}
/**
 * healthFactor(h, year, nowYear) -> (1 + h)^(year - nowYear): what a health cost of today is multiplied by in `year`, in
 * today's dollars. Exactly 1 with h = 0, this year or an earlier one, so a plan without the choice is untouched to the cent.
 */
export function healthFactor(h, year, nowYear) {
  const n = Number(year) - Number(nowYear);
  return h > 0 && n > 0 ? Math.pow(1 + h, n) : 1;
}
/** "1 point" | "1.5 points" | "2 points": the rate in words (never a bare percent: it is on top of prices). */
export const healthPoints = (h) => { const n = Number((h * 100).toFixed(2)); return `${n} point${n === 1 ? "" : "s"}`; };
/** The part's status and the chip for a typed figure: "with prices" | "1 point faster" | "1.5 points faster". */
export const healthSays = (h) => (h > 0 ? `${healthPoints(h)} faster` : "with prices");
/** One sentence for the pages that price health costs (Before Medicare, Medicare at 65, Will the money last?); "" with prices. */
export const healthGrowthWords = (h) => (h > 0 ? `Health costs are set to rise ${healthPoints(h)} a year faster than prices (your choice on Assumptions), so later years cost more in today's dollars.` : "");
/** The same for Before Medicare, where the tax credit takes up the rise in the years it is paid; "" with prices. */
export const healthGrowthBridgeWords = (h) => (h > 0 ? `Premiums are set to rise ${healthPoints(h)} a year faster than prices (your choice on Assumptions). In a year with a tax credit, the credit takes up the rise; in a year without one, you pay it.` : "");
/** The page's save: a figure above zero is kept (held to the most); "with prices" removes the field, and the plan is as before. */
export function saveHealthGrowth(draft, value) {
  draft.assumptions = draft.assumptions ?? {};
  const v = healthGrowthOf({ assumptions: { healthGrowth: value } });
  if (v > 0) draft.assumptions.healthGrowth = v; else delete draft.assumptions.healthGrowth;
}

/**
 * saveAssumptions(draft, values, today) -- the page's Save: every figure typed (a blank keeps what is there) and the review date
 * (saving is reviewing, design log 2026-09-15). The same code the page runs, so a change tried elsewhere on a copy (Will the money
 * last?'s growth and prices rows) gives the answer this save gives.
 */
export function saveAssumptions(draft, values = {}, today = null) {
  draft.assumptions = draft.assumptions ?? {};
  for (const x of ASSUMPTIONS) { const v = values[x.key]; if (v !== null && v !== undefined && !Number.isNaN(v)) draft.assumptions[x.key] = v; }
  if (today) draft.assumptions.reviewedAt = today;
}

/**
 * compute(plan, { today }) -> {
 *   rows: [{ key, label, kind, def, value, changed, source }],
 *   reviewedAt, daysSinceReview, stale (no review, or more than a year ago), changedCount,
 *   realStocks, realBonds, realCash (returns after inflation), warnings: [text],
 *   hopeful (stocks above the Hopeful preset, 8%: the amber line and Will the money last?'s tag "on your hopeful return"),
 *   healthGrowth (only when above zero: how much faster than prices health costs rise, healthGrowthOf)
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
  // above the hopeful figure: one amber line (spec L5), with history's word too when it also beats prices by more than 8%
  const hopeful = val("returnStocks") > HOPEFUL_MAX + 1e-9;
  if (hopeful) warnings.push(`Stocks are set to grow ${Number((val("returnStocks") * 100).toFixed(2))}% a year. ${HOPEFUL_WORDS}${val("returnStocks") - val("inflation") > 0.08 ? " History says beating prices by more than 8% a year is optimistic." : ""}`);
  if (val("retirementAge") >= val("planEndAge")) warnings.push("The retirement age is at or past the plan's end age.");
  return {
    rows, reviewedAt, daysSinceReview, stale: !reviewedAt || (daysSinceReview !== null && daysSinceReview > 365),
    changedCount: rows.filter((r) => r.changed).length,
    realStocks: realRate(val("returnStocks"), val("inflation")), realBonds: realRate(val("returnBonds"), val("inflation")), realCash: realRate(val("returnCash"), val("inflation")),
    warnings, hopeful,
    // health costs rising faster than prices: only when chosen, so a plan without the choice reads exactly as before
    ...(healthGrowthOf(plan) > 0 ? { healthGrowth: healthGrowthOf(plan) } : {}),
  };
}
