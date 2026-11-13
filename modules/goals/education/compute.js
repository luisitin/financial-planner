// modules/goals/education/compute.js -- PURE. College for each child: the kind of college, what four
// years would cost when they get there (prices rising faster than inflation), what is already set aside
// (the child's college goal, or 529 accounts), the monthly saving that covers the share you choose by the
// first bill, and how much today's saving would cover.
import { pmtToReach, fv } from "../../../core/math/finance.js";
import { compute as computeGoals } from "../goals/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { planReturn } from "../../insurance/term-vs-permanent/compute.js";
import { monthsBetween } from "../../../core/math/dates.js";
import { taxView } from "../../taxes/federal/known.js";

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
/** A school year runs from its fall bill (August 15 of its first year) to its spring bill (January 15 of the next). */
export const BILLS = { fall: "08-15", spring: "01-15" };
/**
 * The American Opportunity tax credit (IRC 25A(b), (d), (i); IRS Publication 970, 2025, chapter 2, read 2026-11-06): up to
 * $2,500 a year for each student in the first four years of college, shrinking from $80,000 to $90,000 of modified AGI
 * ($160,000 to $180,000 on a joint return; the law's own figures, not indexed), none on a separate return.
 */
export const AOTC = { perStudent: 2500, years: 4, single: [80000, 90000], joint: [160000, 180000] };
/** The FAFSA for a school year must open by October 1 of the year before it (20 U.S.C. 1090(d)(4)(A), read 2026-11-06). */
export const FAFSA_OPENS = "10-01";
const label = (y) => `${y}-${String(y + 1).slice(2)}`;

/** A figure as this page shows it, to the $10: other pages quote it through this. */
export const shownAmount = (n) => Math.round(n / 10) * 10;

/**
 * compute(plan, { today }) -> {
 *   growth, returnRate, children: [{ id, name, age, startYear, type, typeLabel, yearlyNow, years, share, costs: [{ year, cost }], total (in the dollars of those years),
 *     totalToday (in today's money), atStart (what the four years cost, discounted to the first bill), goal, saved, monthly, monthsLeft,
 *     neededMonthly (to cover the share by the first bill), coveredShare (what today's saving covers),
 *     and once college has begun (round 8 item 18): left [{ year, label: "2026-27", cost }] (the school years still to pay: a
 *     year whose fall bill has come due has its spring half left, cost = half the year's and part: "spring", review D7;
 *     before, a year that had begun counted in full until its spring bill), stillToPay (their cost x share), nextBill
 *     ("YYYY-MM-DD": the spring bill of a year under way, else the next fall bill; null when none is left), nextYearCost
 *     (what is left of the first year x share: the next bill's amount), finished (no year left);
 *     fafsa? { year, label, opens, open } (the next school year still to begin, when its form opens within a year or is open) }],
 *   aotc? { status: "full"|"partial", students, perStudent, magi, range } (a child in the first four years of college this
 *     year or the next, and the household's income under the credit's limit; never on a separate return),
 *   generic? { id, name } (an education goal naming nobody in the household and no child's own, not reached: the page offers
 *     to make it a child's goal instead of adding a second one)
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
    const started = monthsLeft <= 0;
    // once college has begun, what is left of it (round 8 item 18: the page said "0% covered" for children already in
    // college and its goal button wrote the first bill's date, 2023)
    const inCollege = {};
    if (started && today) {
      // a school year whose fall bill has come due has its spring half left (the two-bill model above: half of the year on each
      // bill; review D7, 2026-11-06: it counted in full, so the goal for the January bill asked for the whole year)
      // each school year at its own price (round 8 verify, 2026-11-06): `costs` prices a year already begun at this calendar
      // year's price, so on January 1 the spring half of a year under way rose by the growth rate ($12,925 in December, $13,442
      // on January 14 for the same January 15 bill); a published price grows by school year, so the year is priced as its own
      // (a typed price is the one typed, as before)
      const own = (x) => (type === "custom" ? x.cost : COSTS[type].yearly * Math.pow(1 + growth, Math.max(0, x.year - COST_YEAR - 1)));
      const left = costs.filter((x) => today < `${x.year + 1}-${BILLS.spring}`).map((x) => (today >= `${x.year}-${BILLS.fall}` ? { year: x.year, label: label(x.year), cost: own(x) / 2, part: "spring" } : { year: x.year, label: label(x.year), cost: own(x) }));
      const first = left[0] ?? null;
      Object.assign(inCollege, { left, stillToPay: left.reduce((t, x) => t + x.cost, 0) * share, nextYearCost: first ? first.cost * share : 0, finished: !left.length,
        nextBill: !first ? null : today >= `${first.year}-${BILLS.fall}` ? `${first.year + 1}-${BILLS.spring}` : `${first.year}-${BILLS.fall}` });
    }
    // the FAFSA for the next school year still to begin: said once its form is open, or opens within a year
    const nextStart = costs.find((x) => !today || `${x.year}-${BILLS.fall}` > today);
    let fafsa = null;
    if (today && nextStart) {
      const opens = `${nextStart.year - 1}-${FAFSA_OPENS}`;
      if (monthsBetween(today, opens) <= 12) fafsa = { year: nextStart.year, label: label(nextStart.year), opens, open: today >= opens };
    }
    return { id: k.id, name: k.name, age: year - birthYear, startYear, type, typeLabel: COSTS[type].label, yearlyNow, years, share, costs, total, totalToday, atStart, goal: goal ? { id: goal.id, name: goal.name } : null, saved, monthly, monthsLeft, neededMonthly, coveredShare: atStart > 0 ? Math.min(1, reach / atStart) : 1, started,
      ...inCollege, ...(fafsa ? { fafsa } : {}) };
  });
  // the American Opportunity credit: students in their first four years of college this school year or the next, and the
  // household's income (AGI, the Federal estimate's) under the limit; worked only then (the Federal estimate is not cheap)
  let aotc = null;
  const students = today ? children.filter((c) => [year - 1, year].some((y) => y >= c.startYear && y < c.startYear + Math.min(c.years, AOTC.years) && `${y + 1}-${BILLS.spring}` > today)).length : 0;
  const status = plan.household?.filingStatus ?? "single";
  if (students && status !== "married_separate") {
    let magi = null;
    try { magi = taxView(plan, { today }).result.agi; } catch { magi = null; }
    const range = status === "married_joint" ? AOTC.joint : AOTC.single;
    if (magi !== null && magi < range[1]) aotc = { status: magi <= range[0] ? "full" : "partial", students, perStudent: AOTC.perStudent, magi, range };
  }
  // an education goal that names nobody in the household and is no child's own ("Education", from Get started): with several
  // children it is none of theirs, so a per-child goal beside it would count college twice; the page offers to turn it into a
  // child's goal (review UX 1, 2026-11-06)
  // Only while every child has begun college (round 8 verify, 2026-11-06): with a child still to start, a goal naming nobody
  // may well be that child's ("College fund", $150,000 by 2036 for a 8-year-old), and the filled button turned it into the
  // older child's spring bill, $12,930 by January, with its saving
  const claimed = new Set(children.map((c) => c.goal?.id).filter(Boolean));
  const g0 = children.every((c) => c.started) ? goals.find((g) => EDUCATION_GOAL.test(g.name ?? "") && !claimed.has(g.id) && !others.some((o) => namesPerson(g.name, o.name)) && g.status !== "done") : null;
  return { growth, returnRate, inflation, children, costYear: COST_YEAR, ...(aotc ? { aotc } : {}), ...(kids.length && g0 ? { generic: { id: g0.id, name: g0.name } } : {}) };
}

/**
 * The Education page's own figure as a goal amount (Get started's question 7b leaves the Education goal's "How much" blank:
 * smart guesses C5, spec 7.F `goals/education:target`): for each child with a birth year whose college has not begun, what
 * "Make it a goal" on this page writes for them, four years at the kind, share and start age set here (public in-state by
 * default) in today's money, to the $1,000 (`round(totalToday x share / 1000) x 1000`); and their sum. compute() is unchanged.
 * -> { total, children: [{ id, name, value, startYear, typeLabel }] } | null (no child with a birth year still to start)
 */
export function educationTarget(plan, { today = null } = {}) {
  const kids = compute(plan, { today }).children.filter((c) => !c.started);
  if (!kids.length) return null;
  const children = kids.map((c) => ({ id: c.id, name: c.name, value: Math.round((c.totalToday * c.share) / 1000) * 1000, startYear: c.startYear, type: c.type, typeLabel: c.typeLabel }));
  return { total: children.reduce((t, c) => t + c.value, 0), children };
}
