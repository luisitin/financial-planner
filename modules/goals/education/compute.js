// modules/goals/education/compute.js -- PURE. College for each child: the kind of college, what four
// years would cost when they get there (prices rising faster than inflation), what is already set aside
// (the child's college goal, or 529 accounts), the monthly saving that covers the share you choose by the
// first bill, and how much today's saving would cover.
import { pmtToReach, fv } from "../../../core/math/finance.js";
import { compute as computeGoals } from "../goals/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { planReturn } from "../../insurance/term-vs-permanent/compute.js";
import { monthsBetween } from "../../../core/math/dates.js";

/** A year of college in 2025-26, published prices: tuition and fees plus room and board (College Board, Trends in College Pricing and Student Aid 2025). */
export const COSTS = {
  public: { label: "Public, in-state", yearly: 11950 + 13900 },
  private: { label: "Private nonprofit", yearly: 45000 + 15920 },
  custom: { label: "A cost I enter", yearly: null },
};
export const COST_YEAR = 2025;
/** Published prices have risen faster than prices in general: about 4% a year is a common planning figure. */
export const DEFAULT_GROWTH = 0.04;
export const DEFAULTS = { type: "public", share: 1, years: 4, startAge: 18 };
/** An education goal's name: college, university, school, tuition, education or 529 (Life insurance needs reads the same one). */
export const EDUCATION_GOAL = /college|university|school|tuition|education|529/i;
/** A text as whole words: lower case, anything but letters and digits a space, one space at each end. */
const wordsOf = (t) => ` ${String(t ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
/**
 * Whether a text names a person: their name as a whole word (or words), case-insensitive. "Ed's college" and "COLLEGE FOR
 * ED" name Ed; "Education fund" does not ("ed" inside "education"), nor does "University fund" name Ty.
 */
export const namesPerson = (text, name) => { const n = wordsOf(name).trim(); return n !== "" && wordsOf(text).includes(` ${n} `); };
/** A figure as this page shows it, to the $10: other pages quote it through this. */
export const shownAmount = (n) => Math.round(n / 10) * 10;

/**
 * compute(plan, { today }) -> {
 *   growth, returnRate, children: [{ id, name, age, startYear, type, typeLabel, yearlyNow, years, share, costs: [{ year, cost }], total (in the dollars of those years),
 *     totalToday (in today's money), atStart (what the four years cost, discounted to the first bill), goal, saved, monthly, monthsLeft,
 *     neededMonthly (to cover the share by the first bill), coveredShare (what today's saving covers) }]
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : COST_YEAR + 1;
  const s = plan.whatIfs?.college ?? {};
  const growth = Number.isFinite(Number(s.growth)) && s.growth !== null && s.growth !== "" && s.growth !== undefined ? Number(s.growth) : DEFAULT_GROWTH;
  const inflation = Number(plan.assumptions?.inflation ?? 0.03);
  const returnRate = planReturn(plan);
  const kids = (plan.household?.people ?? []).filter((p) => p.role === "dependent" && p.birthDate);
  // everyone else in the household with a name, adults and dependents alike (with or without a birth date)
  const others = (plan.household?.people ?? []).filter((p) => p.name);
  const goals = computeGoals(plan, { today }).goals;
  const accounts529 = (plan.accounts ?? []).filter((a) => a.type === "529");
  const children = kids.map((k) => {
    const c = { ...DEFAULTS, ...(s[k.id] ?? {}) };
    const type = COSTS[c.type] ? c.type : "public";
    const yearlyNow = type === "custom" ? Math.max(0, Number(c.yearly) || 0) : COSTS[type].yearly * Math.pow(1 + growth, Math.max(0, year - COST_YEAR - 1));
    const birthYear = Number(k.birthDate.slice(0, 4));
    const startYear = birthYear + (Number(c.startAge) || 18);
    const years = Math.max(1, Math.round(Number(c.years) || 4));
    const share = Math.min(1, Math.max(0, Number(c.share ?? 1)));
    const costs = Array.from({ length: years }, (_, i) => ({ year: startYear + i, cost: yearlyNow * Math.pow(1 + growth, Math.max(0, startYear + i - year)) }));
    const total = costs.reduce((t, x) => t + x.cost, 0);
    const totalToday = costs.reduce((t, x) => t + x.cost / Math.pow(1 + inflation, Math.max(0, x.year - year)), 0);
    // what the bills are worth at the first one: later years discounted at the plan's return (money keeps growing meanwhile)
    const atStart = costs.reduce((t, x, i) => t + x.cost / Math.pow(1 + returnRate, i), 0);
    // set aside: the child's college goal, else the 529 accounts named for the child, else an equal share of them all
    // the child's name as a whole word ("Ed's college", never "Education fund" for Ed); with one child, the first education
    // goal that names nobody else in the household (an adult's "Jo's night school", or "Mia college" for a dependent with or
    // without a birth date, is never the child's)
    const namesOther = (g) => others.some((o) => o.id !== k.id && namesPerson(g.name, o.name));
    const goal = goals.find((g) => EDUCATION_GOAL.test(g.name ?? "") && namesPerson(g.name, k.name)) ?? (kids.length === 1 ? goals.find((g) => EDUCATION_GOAL.test(g.name ?? "") && !namesOther(g)) : null) ?? null;
    const named = accounts529.filter((a) => namesPerson(a.name, k.name));
    const saved = goal ? goal.funded : (named.length ? named : accounts529).reduce((t, a) => t + countedBalance(a), 0) / (named.length ? 1 : Math.max(1, kids.length));
    const monthly = goal ? Number(goal.monthly) || 0 : 0;
    const monthsLeft = today ? Math.max(0, monthsBetween(today, `${startYear}-08-15`)) : (startYear - year) * 12;
    const target = atStart * share;
    const r = returnRate / 12;
    const neededMonthly = monthsLeft > 0 ? Math.max(0, pmtToReach(r, monthsLeft, target, saved)) : null;
    const reach = fv(r, monthsLeft, monthly, saved);
    return { id: k.id, name: k.name, age: year - birthYear, startYear, type, typeLabel: COSTS[type].label, yearlyNow, years, share, costs, total, totalToday, atStart, goal: goal ? { id: goal.id, name: goal.name } : null, saved, monthly, monthsLeft, neededMonthly, coveredShare: atStart > 0 ? Math.min(1, reach / atStart) : 1, started: monthsLeft <= 0 };
  });
  return { growth, returnRate, inflation, children, costYear: COST_YEAR };
}
