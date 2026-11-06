// modules/insurance/life-needs/compute.js -- PURE and heavy. How much life insurance each adult needs,
// three ways, against the cover on the Policies page:
//   1. the plan's own answer (couples): the smallest lump sum that keeps the survivor's plan on track,
//      their living costs before retirement included, with Social Security for the children and for
//      the parent caring for them;
//   1b. a single parent (no second adult, a child under 18): what each child would cost until 18 and their college,
//      less that child's own Social Security (their money: it never pays another child, the debts or the funeral),
//      plus debts and a funeral, less the savings that pass to them; worked for a death at the start of each year
//      until the children's needs end, the cover to buy the largest of those in that year's dollars (a level policy pays
//      the same dollars every year while prices rise);
//   2. the DIME rule: debts, income until the youngest child is 18, the mortgage, education;
//   3. lifetime earnings (human life value): the family's share of the pay still to come, in today's money.
import { project, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { compute as computeSocialSecurity, floorDime } from "../../retirement/social-security/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { compute as computePolicies } from "../policies/compute.js";
import { nameIn, nameOf } from "../../../core/words.js";
import { survivorInputs, FUNERAL, TAKE_HOME, SURVIVOR_SPENDING } from "../../scenarios/stress-tests/compute.js";
export { FUNERAL, TAKE_HOME, SURVIVOR_SPENDING };
import { smallestWhere } from "../../scenarios/goal-seek/compute.js";
import { WAGE_INDICES } from "../../retirement/social-security/data/ssa.js";
import { ageOn } from "../../../core/math/dates.js";
import { ACCOUNT_TYPES, countedBalance } from "../../balance/net-worth/compute.js";
import { compute as computeEducation, EDUCATION_GOAL, namesPerson, shownAmount } from "../../goals/education/compute.js";
import { compute as computePayoff } from "../../debt/payoff/compute.js";
import { payoffPlan } from "../../../core/math/payoff.js";
import { planReturn } from "../term-vs-permanent/compute.js";

/** Social Security on a worker who dies: each child under 18 gets 75% of the worker's full benefit (PIA); a parent caring for a child under 16 gets 75% too (SSA, "Survivors Benefits", publication 05-10084). */
export const CHILD_SHARE = 0.75, PARENT_SHARE = 0.75, CHILD_UNTIL = 18, CARE_UNTIL = 16;
/** The family maximum: 150% / 272% / 134% / 175% of the PIA across three bend points, 1979's $230, $332 and $433 scaled by the wage index (SSA POMS RS 00615.736 B.1 (TN 57, 12/14/2023); Social Security Act 203(a)(1); ssa.gov/oact/cola/familymax.html; read 2026-10-31). */
export const FAMILY_MAX_BENDS_1979 = [230, 332, 433], FAMILY_MAX_RATES = [1.5, 2.72, 1.34, 1.75];
/**
 * The earnings test under full retirement age: $1 withheld for every $2 earned over this a year (SSA, "Exempt Amounts Under
 * the Earnings Test", ssa.gov/oact/cola/rtea.html, read 2026-10-31): 2026 $24,480, 2027 $25,560. The plan's first year
 * picks its figure; a year after the newest holds the newest (the plan is in today's dollars).
 */
export const EARNINGS_TEST_BY_YEAR = { 2026: 24480, 2027: 25560 };
export const earningsTestExempt = (year) => { const ys = Object.keys(EARNINGS_TEST_BY_YEAR).map(Number).sort((a, b) => a - b); return EARNINGS_TEST_BY_YEAR[ys.filter((y) => y <= Number(year)).at(-1) ?? ys[0]]; };
/** The 2026 figure, kept for older readers. */
export const EARNINGS_TEST_EXEMPT = EARNINGS_TEST_BY_YEAR[2026];
/** What the one who dies spent on themself: the other side of SURVIVOR_SPENDING; the family keeps the rest of the take-home pay. */
export const OWN_SHARE = 1 - SURVIVOR_SPENDING;
/** Children are usually through school by 22: the end of the cover most families buy. */
export const SCHOOL_DONE = 22;
/**
 * Paid childcare stops at 13, each child's part of it on their own 13th birthday: the age of a qualifying child for the child
 * and dependent care credit (IRC 21(b)(1)(A)), the usual end of daycare and after-school care. A choice, said in the README.
 */
export const CHILDCARE_UNTIL = 13;
/** A childcare line: the Expenses category "childcare", or a name that says so. */
export const CHILDCARE = /day ?care|child ?care|nanny|after[- ]?school/i;
/** An education goal: the Education page's own pattern (college, university, school, tuition, education, 529) or the 🎓 icon. */
const isEducationGoal = (g) => EDUCATION_GOAL.test(g?.name ?? "") || g?.icon === "🎓";
const MORTGAGE_TYPES = ["mortgage", "heloc"];
/** The savings that pass to a child: cash and taxable investment accounts, and 529 plans (already the child's college money). Retirement accounts are left out. */
export const passesOn = (a) => { const t = ACCOUNT_TYPES[a.type]; return !!t && t.side === "asset" && (t.taxBucket === "taxable" || a.type === "529"); };

/** The family maximum on a worker's PIA, with the bend points for an eligibility year (the year of death): floored to the dime. */
export function familyMaximum(pia, year) {
  const yrs = Object.keys(WAGE_INDICES).map(Number);
  const awi = (y) => WAGE_INDICES[Math.min(Math.max(y, Math.min(...yrs)), Math.max(...yrs))];
  const scale = awi(year - 2) / awi(1977);
  const [b1, b2, b3] = FAMILY_MAX_BENDS_1979.map((b) => Math.round(b * scale));
  const [r1, r2, r3, r4] = FAMILY_MAX_RATES;
  return floorDime(r1 * Math.min(pia, b1) + r2 * Math.max(0, Math.min(pia, b2) - b1) + r3 * Math.max(0, Math.min(pia, b3) - b2) + r4 * Math.max(0, pia - b3));
}

/** The share of a calendar year someone is still under an age: 1 the years before the birthday year, the months before the birthday in it, 0 after. */
export function shareUnder(birthDate, age, year) {
  const [by, bm] = String(birthDate).split("-").map(Number);
  return Math.min(1, Math.max(0, (by + age + ((bm || 1) - 1) / 12) - year));
}

/**
 * Social Security a year for a family on a worker who has died, in today's dollars: the children's and the caring parent's,
 * the family maximum shared out pro rata, then the parent's cut by the earnings test.
 * `withParent: false` when no parent is left to care for them (a single parent died): no parent's benefit, the children's
 * alone under the family maximum.
 * -> { children (yearly, all), parent (yearly, after the test), familyMaxMonthly }
 */
export function familyBenefits({ pia, year, deathYear, children, parentPay, withParent = true }) {
  const fm = familyMaximum(pia, deathYear);
  const kids = children.map((c) => CHILD_SHARE * pia * shareUnder(c.birthDate, CHILD_UNTIL, year));
  const care = withParent ? Math.max(0, ...children.map((c) => shareUnder(c.birthDate, CARE_UNTIL, year))) : 0;
  const parent = PARENT_SHARE * pia * care;
  const total = kids.reduce((s, x) => s + x, 0) + parent;
  const cut = total > fm ? fm / total : 1;
  const kidsYearly = kids.reduce((s, x) => s + x, 0) * cut * 12;
  const parentYearly = Math.max(0, parent * cut * 12 - Math.max(0, parentPay - earningsTestExempt(deathYear)) / 2);
  return { children: kidsYearly, parent: parentYearly, familyMaxMonthly: fm };
}

/** A month as one number (year x 12 + month - 1), to count months across years. */
const monthIndex = (year, month) => year * 12 + (month - 1);
/** The month someone turns an age: they are under it in every month before (their birthday month is the first one at it). */
const turnsAt = (birthDate, age) => { const [by, bm] = String(birthDate).split("-").map(Number); return monthIndex(by + age, bm || 1); };
/** The first month after an end date ("YYYY-MM-DD", its own month still counted); Infinity with no end date. */
const endsAfter = (endDate) => { if (!endDate) return Infinity; const [ey, em] = String(endDate).split("-").map(Number); return monthIndex(ey, em || 12) + 1; };

/** A part of the single parent's answer as it is shown: to the nearest $100. */
const toHundred = (n) => Math.round((Number(n) || 0) / 100) * 100;

/**
 * The single parent's answer as the page and the Dashboard show it, every part to the nearest $100 and every sum or
 * difference worked from those shown parts (never rounded again on its own), so what is shown always adds up:
 *   each child: costs, college, benefits (to $100); counted = min(benefits, costs + college); short = costs + college -
 *   counted; spare = benefits - counted;
 *   the children together: the sums of those; debts, funeral, savings (to $100); rest = debts + funeral;
 *   net = short + rest - savings (the answer, before the floor at 0 and the rounding up to $1,000).
 * `c`: childNeed's result (its `perChild`), or for older callers the pooled parts (children, costs, college, benefits).
 */
export function shownChild(c) {
  const pooled = !Array.isArray(c?.perChild) || !c.perChild.length;
  const src = pooled ? [{ name: (c?.children ?? []).length === 1 ? c.children[0] : null, costs: c?.costs ?? 0, college: c?.college ?? 0, benefits: c?.benefits ?? 0 }] : c.perChild;
  const kids = src.map((k) => {
    const costs = toHundred(k.costs), college = toHundred(k.college), benefits = toHundred(k.benefits);
    const counted = Math.min(benefits, costs + college);
    return { name: k.name, costs, college, benefits, counted, short: costs + college - counted, spare: benefits - counted };
  });
  const sum = (key) => kids.reduce((s, k) => s + k[key], 0);
  const debts = toHundred(c?.debts), funeral = toHundred(c?.funeral), savings = toHundred(c?.savings);
  const short = sum("short");
  return { kids: pooled ? [] : kids, costs: sum("costs"), college: sum("college"), benefits: sum("benefits"), counted: sum("counted"), short, spare: sum("spare"), debts, funeral, savings, rest: debts + funeral, net: short + debts + funeral - savings };
}
/** The single parent's answer as a figure: the shown parts added up, floored at 0 and rounded up to $1,000 (like the plan's answer). */
export const childFigure = (c) => Math.ceil(Math.max(0, shownChild(c).net) / 1000) * 1000;

/**
 * A single parent's answer (method "child"): what the children would need if their one parent died now, all in today's
 * dollars, counted month by month from `fromMonth` of the plan's first year (today's month: the months already gone are
 * spent) and discounted a whole year at a time at the real bond return.
 *   costs    = childcare + share, each month until the youngest is 18:
 *              childcare: the childcare lines, split equally between the children under CHILDCARE_UNTIL (13) in the first
 *                month counted; each child's part stops the month they turn 13 (a line with an end date stops after its
 *                month). The lines always come out of the shared spending, so a child of 13 or over has no childcare;
 *              share: the children's part of the rest of the household's spending, (spending - childcare) x n/(n+1), n the
 *                children under 18 that month;
 *   benefits = Social Security for the children on the parent's record, each month min(75% of the PIA x n, the family maximum),
 *              no parent's benefit (no parent is left to care for them), discounted alike; 0 without a PIA;
 *   Each child's Social Security is that child's money: it pays only that child's own costs and college, never another
 *   child's, the parent's debts or the funeral (a representative payee must spend it on the child or save it for them).
 *   Child by child (`perChild`): costs (their childcare part and their 1/(n+1) of the rest), college, benefits (their 1/n of
 *   the month's benefit), counted = min(benefits, costs + college), short = costs + college - counted, spare = the rest;
 *   kidsShort = the sum of the shorts, benefitsCounted / benefitsSpare the sums of counted / spare;
 *   total    = max(0, net), net = kidsShort + debts + funeral - savings (college already discounted by the caller:
 *              `collegeValue`); need = the shown parts added up (`shownChild`), rounded up to $1,000 (`childFigure`).
 * children: the dependents under 18 [{ name, birthDate, college? (that child's own college, as counted) }]; a child who is 18
 * or over by `startYear` counts only with college still to come (the need in a later year: `childSeries`). A `college`
 * number with no child's own is shared equally between them (one child: theirs). spending: the household's yearly spending
 * (the payments on debts the cover pays off taken out); childcare: [{ name, yearly, endDate }].
 * benefitSteps: [{ monthly, until (the year it changes), who (the children who turn 18 then) }]: the benefit as it falls when
 * a child turns 18 (months of the same amount are one step: under the family maximum a child turning 18 can change nothing).
 * careSteps: [{ monthly, until (the year it changes), lastYear (the year of its last month), who (the children who turn 13
 * then), ended (the lines whose end date it passes) }]: the childcare counted, month by month as the total adds it up, as it
 * drops and stops.
 * shareSteps: [{ monthly, fraction (n/(n+1)), until (the year it changes), who (the children who turn 18 then) }]: the
 * children's share of the rest of the spending, as it falls when a child turns 18.
 */
export function childNeed({ children, startYear, fromMonth = 1, realDiscount = 0, spending = 0, childcare = [], pia = 0, college = 0, debts = 0, funeral = FUNERAL, savings = 0 }) {
  const first = monthIndex(startYear, Math.min(12, Math.max(1, Math.round(Number(fromMonth) || 1))));
  // the children counted: under 18 in some month of the first year, or grown by then with college still to come
  const minors = (children ?? []).filter((c) => c.birthDate && (shareUnder(c.birthDate, CHILD_UNTIL, startYear) > 0 || Number(c.college) > 0));
  const own = minors.some((c) => c.college !== undefined && c.college !== null);
  const collegeOf = minors.map((c) => (own ? Math.max(0, Number(c.college) || 0) : minors.length ? Math.max(0, Number(college) || 0) / minors.length : 0));
  const at18 = minors.map((c) => turnsAt(c.birthDate, CHILD_UNTIL));
  // the children the childcare is for: those under 13 in the first month counted (by their place among the children), each
  // with an equal part of every line; a child may carry its own part (`care`: the need in a later year keeps today's split)
  const u13 = minors.map((c, i) => i).filter((i) => turnsAt(minors[i].birthDate, CHILDCARE_UNTIL) > first && (minors[i].care === undefined || Number(minors[i].care) > 0));
  const under13 = u13.map((i) => minors[i]);
  const at13 = under13.map((c) => turnsAt(c.birthDate, CHILDCARE_UNTIL));
  const careOf = u13.map((i) => (minors[i].care !== undefined ? Number(minors[i].care) : 1 / u13.length));
  const per = minors.map((c, i) => ({ name: c.name, childcare: 0, share: 0, benefits: 0, college: collegeOf[i] }));
  const careLines = childcare.filter((x) => Number(x.yearly) > 0).map((x) => ({ name: x.name ?? "", monthly: Number(x.yearly) / 12, ends: endsAfter(x.endDate) }));
  const careYearly = careLines.reduce((s, x) => s + x.monthly * 12, 0);
  const rest = Math.max(0, spending - careYearly);
  const fm = pia > 0 ? familyMaximum(pia, startYear) : null;
  const last = at18.length ? Math.max(...at18) : first;
  const years = new Map(), steps = [], cares = [], shares = [];
  let care = 0, share = 0, benefits = 0, careLast = null;
  // the same amount month after month is one step (to the cent)
  const same = (a, b) => Math.abs(a - b) < 0.005;
  for (let t = first; t < last; t++) {
    const n = at18.filter((m) => m > t).length;
    if (!n) continue;
    const y = Math.floor(t / 12);
    // the part of each childcare line still counted: the parts of the children still under 13 (all of it while all are)
    const k = at13.reduce((s, m, j) => s + (m > t ? careOf[j] : 0), 0);
    const c = k > 0 ? careLines.reduce((s, x) => s + (t < x.ends ? x.monthly * k : 0), 0) : 0;
    const sh = (rest / 12) * n / (n + 1);
    const b = fm !== null ? Math.min(CHILD_SHARE * pia * n, fm) : 0;
    const v = Math.pow(1 + realDiscount, -(y - startYear));
    const row = years.get(y) ?? { year: y, months: 0, childcare: 0, share: 0, benefits: 0, discount: v };
    row.months += 1; row.childcare += c; row.share += sh; row.benefits += b;
    years.set(y, row);
    care += c * v; share += sh * v; benefits += b * v;
    // child by child: each one under 18 has 1/(n+1) of the rest and 1/n of the benefit; each one under 13 (of those under 13
    // in the first month) has their part of each childcare line until they turn 13
    for (let i = 0; i < minors.length; i++) if (at18[i] > t) { per[i].share += (sh / n) * v; per[i].benefits += (b / n) * v; }
    if (k > 0) {
      const lines = careLines.reduce((s, x) => s + (t < x.ends ? x.monthly : 0), 0);
      u13.forEach((i, j) => { if (at13[j] > t) per[i].childcare += lines * careOf[j] * v; });
    }
    if (c > 0) { careLast = y; const s = cares.at(-1); if (s && same(s.monthly, c) && s.end === t - 1) s.end = t; else cares.push({ monthly: c, end: t }); }
    if (fm !== null) { const s = steps.at(-1); if (s && same(s.monthly, b)) s.end = t; else steps.push({ monthly: b, end: t }); }
    if (sh > 0) { const s = shares.at(-1); if (s && s.n === n) s.end = t; else shares.push({ monthly: sh, n, end: t }); }
  }
  const byYear = [...years.values()];
  const benefitSteps = steps.map((s) => ({ monthly: s.monthly, until: Math.floor((s.end + 1) / 12), who: minors.filter((c, i) => at18[i] === s.end + 1).map((c) => c.name) }));
  // each drop in the childcare: the children who turn 13 that month, the lines whose end date it passes
  const careSteps = cares.map((s) => ({ monthly: s.monthly, until: Math.floor((s.end + 1) / 12), lastYear: Math.floor(s.end / 12), who: under13.filter((c, i) => at13[i] === s.end + 1).map((c) => c.name), ended: careLines.filter((x) => x.ends === s.end + 1).map((x) => x.name) }));
  // the share as it falls when a child turns 18: "two thirds, about $1,947 a month until Child 2 turns 18 in 2037, then half"
  const shareSteps = shares.map((s) => ({ monthly: s.monthly, fraction: s.n / (s.n + 1), until: Math.floor((s.end + 1) / 12), who: minors.filter((c, i) => at18[i] === s.end + 1).map((c) => c.name) }));
  const costs = care + share;
  // each child's Social Security pays that child's own costs and college only; what is over is kept for that child
  const perChild = per.map((x) => {
    const own = x.childcare + x.share, need = own + x.college, counted = Math.min(x.benefits, need);
    return { name: x.name, costs: own, childcare: x.childcare, share: x.share, college: x.college, benefits: x.benefits, counted, short: need - counted, spare: x.benefits - counted };
  });
  const benefitsCounted = perChild.reduce((s, x) => s + x.counted, 0);
  const kidsShort = perChild.reduce((s, x) => s + x.short, 0);
  const collegeAll = perChild.reduce((s, x) => s + x.college, 0);
  const net = kidsShort + debts + funeral - savings;
  const total = Math.max(0, net);
  const n0 = at18.filter((m) => m > first).length;
  const parts = { perChild, costs, college: collegeAll, benefits, debts, funeral, savings };
  return {
    children: minors.map((c) => c.name), costs, childcare: care, share, benefits, benefitsCounted, benefitsSpare: Math.max(0, benefits - benefitsCounted), kidsShort, perChild,
    shown: shownChild(parts), need: childFigure(parts),
    benefitMonthly: benefitSteps[0]?.monthly ?? 0, benefitUntil: minors.length ? Math.max(...minors.map((c) => Number(String(c.birthDate).slice(0, 4)) + CHILD_UNTIL)) : null, benefitSteps,
    familyMaxMonthly: fm, noRecord: !(pia > 0),
    college: collegeAll, debts, funeral, savings, net, total, years: byYear.length, byYear, fromMonth: (first % 12) + 1, realDiscount,
    childcareMonthly: careYearly / 12, childcareFor: under13.map((c) => c.name), childcareUntil: careLast, careSteps,
    restYearly: rest, shareNow: n0 / (n0 + 1), shareSteps,
  };
}

/**
 * A child's college as the answer counts it: an amount in today's money for college from the year they turn 18, discounted
 * whole years from the plan's first year at the real bond return, like the costs (a year already reached counts in full).
 */
export const collegeValue = (amount, birthDate, startYear, realDiscount) => amount * Math.pow(1 + realDiscount, -Math.max(0, Number(String(birthDate).slice(0, 4)) + CHILD_UNTIL - startYear));

/**
 * The share of a child's college still to come for a death at the start of a year: all of it until the year college
 * starts, then the years not yet begun (a year's bill is due in its first year), none once it has ended.
 * collegeLeft(2041, 2040, 4) = 3/4 (2041, 2042 and 2043 are still to come).
 */
export const collegeLeft = (year, start, years) => (year <= start ? 1 : Math.min(1, Math.max(0, (start + years - year) / Math.max(1, years))));

/**
 * The single parent's need over time (method "child"): the same answer worked as if the parent died at the start of each
 * year from now until the children's needs end (the youngest's college, or 18 for a child with no college counted), in
 * today's money. Year 0 is today's answer (from today's month); each later year counts from January of that year: the
 * children that much older (costs, childcare and Social Security only for the months still under 18 / 13 then, each
 * child's college discounted from their 18th year to then, and only the years of it not yet begun), the debts and the
 * savings as the plan projects them at the start of that year (`debtsAt`, `savingsAt`), everything else as today.
 * kids: [{ name, birthDate, start, years (college: its first year and how many years) }]; collegeAt(year) -> each child's
 * college counted for a death that year (before the share still to come); the rest as childNeed.
 * -> [{ year, need, net, total, kidsShort, costs, college, benefits, benefitsCounted, debts, savings, children }]
 */
export function childSeries({ kids, startYear, fromMonth = 1, lastYear, realDiscount = 0, spending = 0, childcare = [], pia = 0, collegeAt, debtsAt, savingsAt, funeral = FUNERAL }) {
  const out = [];
  for (let y = startYear; y <= Math.max(startYear, lastYear); y++) {
    const college = collegeAt(y);
    const children = kids.map((k, i) => ({ name: k.name, birthDate: k.birthDate, care: k.care, college: (college[i] ?? 0) * collegeLeft(y, k.start, k.years) }));
    const r = childNeed({ children, startYear: y, fromMonth: y === startYear ? fromMonth : 1, realDiscount, spending, childcare, pia, debts: debtsAt(y), funeral, savings: savingsAt(y) });
    out.push({ year: y, need: r.need, net: r.net, total: r.total, kidsShort: r.kidsShort, costs: r.costs, college: r.college, benefits: r.benefits, benefitsCounted: r.benefitsCounted, debts: r.debts, savings: r.savings, children: r.children });
  }
  return out;
}

/** The term lengths most companies sell, in years. */
export const TERM_LENGTHS = [10, 15, 20, 25, 30];
/** The shortest usual term that lasts until a year (the longest, 30, when none does): what to ask for on a quote. */
export const termYears = (untilYear, startYear) => TERM_LENGTHS.find((n) => startYear + n >= untilYear) ?? TERM_LENGTHS.at(-1);

/** Lifetime earnings: the family's share of the take-home pay for each year still to work, grown with pay and discounted, in today's dollars (paid at the start of each year). */
export function lifetimeEarnings({ pay, years, realGrowth, realDiscount }) {
  const yearly = pay * TAKE_HOME * (1 - OWN_SHARE);
  let total = 0;
  for (let t = 0; t < years; t++) total += yearly * Math.pow((1 + realGrowth) / (1 + realDiscount), t);
  return { yearly, total };
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, people: [{
 *     id, name, age, pay, cover, coverWork, survivorName,
 *     plan: { need, gapYears: [{ year, amount, benefits }], firstGap, benefits: { childMonthly, parentMonthly, familyMaxMonthly, childUntil }, withCover: { success, failAge, failYear } } | null,
 *     child: (a single parent: no second adult, a child under 18) { children: [names under 18], costs, childcare, share, benefits,
 *       benefitsCounted (what of each child's pays that child's costs and college), benefitsSpare (the rest, kept for each),
 *       kidsShort, perChild: [{ name, costs, childcare, share, college, benefits, counted, short, spare }], shown (`shownChild`),
 *       need / today (today's figure: the shown parts rounded up), needByYear: [{ year, need, ..., priceLevel, dollars (need x
 *       priceLevel: that year's dollars), coverInForce (the cover on file that still pays for a death at any time in that
 *       year: `coverIn`), coverWorth (coverInForce / priceLevel: in today's money), short (need - coverWorth, at least 0) }]
 *       (a death at the start of each year until the children's needs end, `childSeries`),
 *       peak: { year, need } (the largest in today's money), sized: { year, need, real, priceLevel } (the largest in that
 *       year's dollars, rounded up to $1,000: a level policy pays the same dollars every year, so this is the person's
 *       `need`), steady (never rises from one year to the next), rising (never dips by SHAPE_TOLERANCE of the peak or more
 *       before it), needEnds: { year, who, event } (also `termUntil`), with term cover that ends before the need does
 *       (`endsSoon`): afterEnd ({ year, need, real, priceLevel, cover, most }: the year after cover ends short the most in
 *       that year's dollars, its need rounded up to $1,000, the cover still paying then, and whether that need is also the
 *       largest of those years), coveredUntilEnd, coverStays (the cover with no end before the need's), endSteps: [{ endDate,
 *       benefit, policies }] (the policies not paying in afterEnd's year, by end date, those ending the same day added up),
 *       ifJobEnds ({ year, need, real, priceLevel, cover }: with cover through work, the year short the most without it, year
 *       by year like afterEnd; `gapIfJobEnds` = need - cover),
 *       benefitMonthly (the first month's), benefitUntil, benefitSteps: [{ monthly, until, who }], familyMaxMonthly,
 *       noRecord (no Social Security figure: nothing subtracted), college (discounted, less what is set aside),
 *       collegeParts: [{ id, name (null: no goal), from: "goal"|"planner", for: [child names], gross (today's money), saved,
 *         amount (as counted), tied, partial, figures: [{ name, amount, full (as the Education page shows it), share }] ("planner") }],
 *       collegeKids: [{ name, year (turns 18), gross, value }], collegeLeftOut: [{ name, why: "none"|"share" }],
 *       collegeOthers: [{ id, name, for: [names], why: "grown"|"nobirth" }] (goals for a dependent not under 18: not counted), untiedKids,
 *       debts, funeral, savings, net (before the floor at 0), total, years, byYear, fromMonth, realDiscount, childcareMonthly,
 *       childcareFor, childcareUntil, careSteps: [{ monthly, until, lastYear, who, ended }], childcareLines, restYearly, shareNow,
 *       shareSteps: [{ monthly, fraction, until, who }] } | null (see childNeed),
 *     survivorMissing: { id, name, birthDate (true: it is what is missing) } | null (a second adult whose plan cannot be built),
 *     dime: { debts, finalExpenses, income, incomeYears, mortgage, education, total },
 *     lifetime: { yearly, years, total },
 *     need, method: "plan"|"child"|"dime" ("dime" only when no answer of the first two can be built: one adult whose
 *       dependents are all 18 or over, or a second adult whose plan cannot be built), gap, spare, gapIfJobEnds (without the
 *       cover through work: a single parent's year by year, `child.ifJobEnds`; otherwise need - the cover not through work
 *       that does not end soon), jobEnding: { benefit, endDate (the last of them), policies } | null (a couple's or the rule
 *       of thumb's term cover not through work ending soon, which gapIfJobEnds leaves out), termUntil: { year, why, who, event } | null (never a year already past),
 *     endsSoon: [{ endDate, benefit }] (term cover ending before the need ends: by next year, or for a single parent at
 *       any time before the children's needs end), endSteps: [{ endDate, benefit, policies }] | null (a couple's or the
 *       rule of thumb's endsSoon by date, the same day added up; null for a single parent, whose are `child.endSteps`),
 *       gapAfterEnd, spare (a single parent's counts only the cover still
 *       paying in each year), raise (protectionGaps' rule)
 *   }], children: [{ name, age }] (everyone marked Dependent), startYear, unassignedCover (life cover on Policies naming nobody),
 *   unplanned: [{ id, name, pay, cover, coverWork, birthDate (true: it is what is missing) }] (adults the plan cannot run for)
 * }
 * All figures are in today's dollars.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const b = buildInputs(plan, { today });
  if (!today || !b.inputs) return { ready: false, missing: b.missing ?? ["today's date"] };
  const I = b.inputs;
  const startYear = I.startYear;
  const people = plan.household?.people ?? [];
  // everyone marked Dependent on People counts as living on the pay, a grown child or a parent too (the role says so)
  const children = people.filter((q) => q.role === "dependent" && q.birthDate).map((q) => ({ id: q.id, name: q.name, birthDate: q.birthDate, age: ageOn(q.birthDate, today) }));
  const youngest = children.length ? children.reduce((y, c) => (c.birthDate > y.birthDate ? c : y)) : null;
  const yearsTo18 = youngest ? Math.max(0, shareUnderYears(youngest.birthDate, CHILD_UNTIL, today)) : 0;

  const inc = computeIncome(plan, { today });
  const payOf = (id) => inc.active.filter((x) => x.personId === id && ["salary", "bonus", "business"].includes(x.type)).reduce((s, x) => s + x.yearly, 0);
  const exp = computeExpenses(plan, { today });
  const spendingYearly = exp.yearly;
  const li = computeLiabilities(plan, { today });
  const mortgage = li.rows.filter((r) => MORTGAGE_TYPES.includes(r.type)).reduce((s, r) => s + r.owed, 0);
  const debts = li.rows.filter((r) => !MORTGAGE_TYPES.includes(r.type)).reduce((s, r) => s + r.owed, 0);
  // the education goals: the Education page's pattern or the 🎓 icon, not one naming an adult (their own degree ends with them)
  const adultNames = people.filter((q) => q.role !== "dependent" && q.name).map((q) => q.name);
  const namesAdult = (g) => adultNames.some((a) => namesPerson(g.name, a));
  const eduGoals = (plan.goals ?? []).filter((g) => isEducationGoal(g) && !namesAdult(g));
  const education = eduGoals.reduce((s, g) => s + Math.max(0, (Number(g.target) || 0) - (Number(g.saved) || 0)), 0);
  const con = computeContributions(plan, { today });
  const ownSaving = (id) => con.byPerson?.find((p) => p.personId === id)?.yearly ?? 0;
  const pol = computePolicies(plan, { today });
  // a life policy saved for "Household / everyone" names nobody, so it counts for no one: said, not guessed
  const unassignedCover = pol.items.filter((x) => !x.ended && !x.personId && x.group === "life").reduce((s, x) => s + (Number(x.benefit) || 0), 0);
  const ss = computeSocialSecurity(plan, { today });
  const realGrowth = (1 + I.rates.salaryGrowth) / (1 + I.rates.inflation) - 1;
  const realDiscount = (1 + I.returns.bonds) / (1 + I.rates.inflation) - 1;
  // a single parent (method "child"): the children under 18 today, and what their answer adds up
  const minors = children.filter((c) => c.age < CHILD_UNTIL);
  // the months of this year already gone are spent: the single parent's answer counts from today's month
  const fromMonth = Number(String(today).slice(0, 4)) === startYear ? Number(String(today).slice(5, 7)) || 1 : 1;
  const childInputs = () => {
    // the payments on the debts the cover pays off stop with them: out of the spending (a mortgage is kept, it is the home)
    const debtPay = li.rows.filter((r) => !MORTGAGE_TYPES.includes(r.type)).reduce((s, r) => s + (Number(r.payment) || 0), 0) * 12;
    const childcare = exp.active.filter((x) => x.period !== "once" && (x.category === "childcare" || CHILDCARE.test(x.name ?? ""))).map((x) => ({ name: x.name, yearly: x.yearly, endDate: x.endDate || "" }));
    // college, once for each child under 18, whatever the order of the goals (the Education page's tie says whose a goal is:
    // the child's name in the goal's name, or for a lone child the first education goal naming nobody else):
    //  - a goal with an amount covers the child it is tied to; one tied to no one covers the children under 18 that no goal
    //    with an amount is tied to (all of them when each one is: a lone child), its amount shared equally between them;
    //  - every other child under 18 gets the Education page's figure (`totalToday`, today's money, to the $10 as that page
    //    shows it (`shownAmount`), x the share chosen there), less what a goal with no amount tied to them has set aside (one
    //    tied to no one, Get started's "Education", stands for all of them). With no education goal at all the figure still
    //    counts: a parent's death does not cancel college;
    //  - a child the Education page has no figure for (or none of whose college you chose to pay) is left out, by name.
    // Each child's part is discounted from the year they turn 18 at the real bond return, like the costs (`collegeValue`);
    // what is set aside comes off at face value, like savings. A goal naming an adult (their own degree) ends with them; a goal
    // for a dependent who is 18 or over (or has no birth date), tied or named, and for no child under 18, is not the minors'
    // and is not counted (`collegeOthers`, said by name).
    let edu = null;
    try { edu = computeEducation(plan, { today }); } catch { edu = null; }
    const eduOf = new Map((edu?.children ?? []).map((k) => [k.id, k]));
    const eduIds = new Set(eduGoals.map((g) => g.id));
    const tieOf = (id) => { const g = eduOf.get(id)?.goal; const gid = g?.id ?? g ?? null; return eduIds.has(gid) ? gid : null; };
    const minorIds = new Set(minors.map((k) => k.id));
    const others = people.filter((q) => q.role === "dependent" && q.name && !minorIds.has(q.id));
    const othersOf = (g) => others.filter((q) => tieOf(q.id) === g.id || namesPerson(g.name, q.name));
    const forOthers = (g) => othersOf(g).length > 0 && !minors.some((k) => tieOf(k.id) === g.id || namesPerson(g.name, k.name));
    const collegeOthers = eduGoals.filter(forOthers).map((g) => ({ id: g.id, name: g.name, for: othersOf(g).map((q) => q.name), why: othersOf(g).every((q) => !q.birthDate) ? "nobirth" : "grown" }));
    const goals = eduGoals.filter((g) => !forOthers(g));
    const figure = (k) => shownAmount(k.totalToday) * Math.min(1, Math.max(0, Number(k.share ?? 1)));
    const value = (amount, k) => collegeValue(amount, k.birthDate, startYear, realDiscount);
    const hasAmount = (g) => Number(g.target) > 0;
    const savedOf = (g) => Math.max(0, Number(g?.saved) || 0);
    // only the children under 18 are tied to a goal here (a grown dependent's own goal is theirs, above)
    const tiedTo = (g) => minors.filter((k) => tieOf(k.id) === g.id);
    const amountGoals = goals.filter(hasAmount);
    const tiedToAmount = new Set(amountGoals.flatMap((g) => tiedTo(g).map((k) => k.id)));
    const free = minors.filter((k) => !tiedToAmount.has(k.id));
    const covered = new Set(), collegeKids = [];
    // each part's children and what each one's share of it is in today's money (before discounting), for each child's own
    // college: the part's amount less what it has set aside, shared out in proportion to what each child's share is worth
    const pieces = [];
    const at = (k) => minors.findIndex((x) => x.id === k.id);
    const goalParts = amountGoals.map((g) => {
      const tied = tiedTo(g);
      const kids = tied.length ? tied : free.length ? free : minors;
      const target = Number(g.target), saved = savedOf(g);
      for (const k of kids) { covered.add(k.id); collegeKids.push({ name: k.name, year: Number(String(k.birthDate).slice(0, 4)) + CHILD_UNTIL, gross: target / kids.length, value: value(target / kids.length, k) }); }
      pieces.push({ saved, kids: kids.map((k) => ({ i: at(k), gross: target / kids.length })) });
      const worth = kids.reduce((t, k) => t + value(target / kids.length, k), 0);
      return { id: g.id, name: g.name, from: "goal", for: kids.map((k) => k.name), gross: target, saved, amount: Math.max(0, worth - saved), tied: tied.length > 0, partial: false, figures: [] };
    });
    const noAmount = goals.filter((g) => !hasAmount(g));
    const firstUntied = noAmount.find((g) => !minors.some((k) => tieOf(k.id) === g.id)) ?? null;
    const groups = new Map(), collegeLeftOut = [];
    for (const k of minors) {
      if (covered.has(k.id)) continue;
      const e = eduOf.get(k.id);
      const f = e && e.totalToday > 0 ? figure(e) : 0;
      if (!(f > 0)) { collegeLeftOut.push({ name: k.name, why: e && e.totalToday > 0 ? "share" : "none" }); continue; }
      const g = noAmount.find((x) => x.id === tieOf(k.id)) ?? firstUntied;
      const key = g?.id ?? "";
      if (!groups.has(key)) groups.set(key, { g, kids: [] });
      groups.get(key).kids.push({ ...k, figure: f, full: shownAmount(e.totalToday), share: Math.min(1, Math.max(0, Number(e.share ?? 1))) });
      collegeKids.push({ name: k.name, year: Number(String(k.birthDate).slice(0, 4)) + CHILD_UNTIL, gross: f, value: value(f, k) });
    }
    const plannerParts = [...groups.values()].map(({ g, kids }) => {
      const saved = savedOf(g);
      pieces.push({ saved, kids: kids.map((k) => ({ i: at(k), gross: k.figure })) });
      const worth = kids.reduce((t, k) => t + value(k.figure, k), 0);
      return { id: g?.id ?? null, name: g?.name ?? null, from: "planner", for: kids.map((k) => k.name), gross: kids.reduce((t, k) => t + k.figure, 0), saved, amount: Math.max(0, worth - saved), tied: !!g && kids.some((k) => tieOf(k.id) === g.id), partial: kids.some((k) => k.share < 1), figures: kids.map((k) => ({ name: k.name, amount: k.figure, full: k.full, share: k.share })) };
    });
    const collegeParts = [...goalParts, ...plannerParts];
    // each child's own college for a death in a year (discounted from their 18th year to then): a part's amount less what it
    // has set aside, shared out in proportion to what each child's share of it is worth (the parts' amounts add up as before)
    const collegeAt = (year) => {
      const own = minors.map(() => 0);
      for (const p of pieces) {
        const vals = p.kids.map((x) => collegeValue(x.gross, minors[x.i].birthDate, year, realDiscount));
        const worth = vals.reduce((s, v) => s + v, 0), amount = Math.max(0, worth - p.saved);
        p.kids.forEach((x, j) => { if (worth > 0) own[x.i] += amount * vals[j] / worth; });
      }
      return own;
    };
    // each child's college years, as the Education page has them (its first year and how many), else from 18 for 4 years
    // and each one's part of the childcare lines: split equally between the children under 13 in today's month, as today's
    // answer splits them (a later year keeps that split: one child's part never grows when another turns 13)
    const first = monthIndex(startYear, fromMonth);
    const young = minors.filter((k) => turnsAt(k.birthDate, CHILDCARE_UNTIL) > first).length;
    const kidsInfo = minors.map((k) => { const e = eduOf.get(k.id); const by = Number(String(k.birthDate).slice(0, 4)); return { id: k.id, name: k.name, birthDate: k.birthDate, start: e?.startYear ?? by + CHILD_UNTIL, years: e?.years ?? 4, care: turnsAt(k.birthDate, CHILDCARE_UNTIL) > first ? 1 / young : 0 }; });
    const savings = Math.max(0, (plan.accounts ?? []).filter(passesOn).reduce((s, a) => s + countedBalance(a), 0));
    // the rule of thumb's education: the same goals as this answer (a grown dependent's is theirs, not the children's)
    const dimeEducation = goals.reduce((s, g) => s + Math.max(0, (Number(g.target) || 0) - (Number(g.saved) || 0)), 0);
    return { spending: Math.max(0, spendingYearly - debtPay), childcare, collegeParts, collegeKids, collegeLeftOut, collegeOthers, college: collegeParts.reduce((s, x) => s + x.amount, 0), collegeAt, kidsInfo, savings, dimeEducation, untiedKids: minors.filter((k) => tieOf(k.id) === null).map((k) => k.name) };
  };
  let ci = null;

  // the single parent's need over time: the debts on the payoff plan's schedule and the savings that pass to the children
  // (cash and taxable accounts as the retirement projection grows them, 529 plans as Net worth over time grows them) at the
  // start of each year, in today's money (the plan's price level for the year before)
  const projected = () => {
    const pay = computePayoff(plan, { today });
    const sched = pay.hasData ? payoffPlan(pay.debts, { extra: pay.extra, order: pay.order, customOrder: pay.customOrder }) : null;
    const scheduled = new Set((pay.debts ?? []).map((x) => x.id));
    const own = li.rows.filter((r) => !MORTGAGE_TYPES.includes(r.type));
    const monthsLeft = 12 - (Number(String(today).slice(5, 7)) || 12);
    const rows = project(I).rows;
    const priceAt = (y) => rows[y - startYear - 1]?.priceLevel ?? Math.pow(1 + I.rates.inflation, Math.max(0, y - startYear - 1));
    const debtsAt = (y) => {
      if (y <= startYear) return debts;
      const m = monthsLeft + 12 * (y - startYear - 1);
      const bal = m <= 0 || !sched ? null : sched.timeline[Math.min(m, sched.timeline.length) - 1]?.balances ?? {};
      const nominal = own.reduce((s, r) => s + (!scheduled.has(r.id) || !bal ? r.owed : m > sched.timeline.length ? 0 : (bal[r.id] ?? 0)), 0);
      return nominal / priceAt(y);
    };
    const now529 = (plan.accounts ?? []).filter((a) => a.type === "529").reduce((s, a) => s + countedBalance(a), 0);
    const growth = planReturn(plan);
    const savingsAt = (y, today0) => {
      if (y <= startYear) return today0;
      const r = rows[y - startYear - 1];
      const t = (monthsLeft + 12 * (y - startYear - 1)) / 12;
      const cash = r ? (r.balances.cash ?? 0) + (r.balances.taxable ?? 0) : 0;
      return Math.max(0, (cash + now529 * Math.pow(1 + growth, t)) / priceAt(y));
    };
    return { debtsAt, savingsAt, priceAt };
  };

  const out = I.people.map((d) => {
    const person = people.find((q) => q.id === d.id);
    const age = person?.birthDate ? ageOn(person.birthDate, today) : startYear - d.birthYear;
    const pay = payOf(d.id);
    const mine = pol.items.filter((x) => !x.ended && x.personId === d.id && x.group === "life");
    const cover = mine.reduce((s, x) => s + (Number(x.benefit) || 0), 0);
    const coverWork = mine.filter((x) => x.throughWork).reduce((s, x) => s + (Number(x.benefit) || 0), 0);
    const workYears = pay > 0 ? Math.max(0, d.retireAge - age) : 0;

    // 2. DIME
    const income = children.length ? pay * yearsTo18 : 0;
    const dime = { debts, finalExpenses: FUNERAL, income, incomeYears: children.length ? yearsTo18 : 0, mortgage, education: children.length ? education : 0 };
    dime.total = dime.debts + dime.finalExpenses + dime.income + dime.mortgage + dime.education;
    // 3. lifetime earnings
    const lifetime = { ...lifetimeEarnings({ pay, years: workYears, realGrowth, realDiscount }), years: workYears };

    // 1. the plan's own answer: the survivor's plan, their living costs before they retire, the smallest lump sum that keeps it whole
    let planAnswer = null, survivorName = null, termUntil = null;
    const sv = survivorInputs(plan, d.id, { today, ss });
    if (sv) {
      survivorName = sv.survivor.name;
      const S = sv.inputs;
      S.strategy = "fixed-real";
      const sPerson = people.find((q) => q.id === sv.survivor.id);
      const sPay = payOf(sv.survivor.id);
      const takeHome = sPay * TAKE_HOME - ownSaving(sv.survivor.id);
      const pia = ss.people.find((q) => q.id === d.id)?.pia ?? 0;
      const gapYears = [];
      for (let y = startYear; y < S.retireYear && y <= S.endYear; y++) {
        const fb = pia > 0 && children.length ? familyBenefits({ pia, year: y, deathYear: startYear, children, parentPay: sPay }) : { children: 0, parent: 0 };
        const benefits = fb.children + fb.parent;
        const amount = Math.max(0, spendingYearly * SURVIVOR_SPENDING - takeHome - benefits);
        gapYears.push({ year: y, amount, benefits });
      }
      S.events = [...(S.events ?? []), { year: startYear, amount: FUNERAL, label: "funeral" }, ...gapYears.filter((g) => g.amount > 0).map((g) => ({ year: g.year, amount: g.amount, label: "living costs the pay does not cover" }))];
      // the plan with both alive: the survivor's plan should do as well (when it fails anyway, last at least as long)
      const base = project(I);
      const ok = (lump) => {
        const T = copyInputs(S);
        T.events.push({ year: startYear, amount: -lump, label: "life insurance" });
        const r = project(T);
        return base.success ? r.success : (r.success || (r.failYear ?? 0) >= (base.failYear ?? 0));
      };
      let hi = 1e6;
      while (!ok(hi) && hi < 1e9) hi *= 4;
      const need = smallestWhere(ok, 0, hi, 50);
      const withCover = (() => { const T = copyInputs(S); T.events.push({ year: startYear, amount: -cover, label: "life insurance" }); const r = project(T); return { success: r.success, failAge: r.failAge ?? null, failYear: r.failYear ?? null }; })();
      const fb0 = pia > 0 && children.length ? familyBenefits({ pia, year: startYear, deathYear: startYear, children, parentPay: sPay }) : null;
      const childUntil = children.length ? Math.max(...children.map((c) => Number(c.birthDate.slice(0, 4)) + CHILD_UNTIL)) : null;
      planAnswer = {
        need: need === null ? null : Math.ceil(need / 1000) * 1000,
        gapYears, firstGap: gapYears[0]?.amount ?? 0, withCover,
        benefits: fb0 ? { childMonthly: fb0.children / 12, parentMonthly: fb0.parent / 12, familyMaxMonthly: fb0.familyMaxMonthly, childUntil } : null,
        survivorRetireYear: S.retireYear, survivorPay: sPay,
      };
      const sRetire = sPerson?.birthDate ? Number(sPerson.birthDate.slice(0, 4)) + (S.people[0]?.retireAge ?? 65) : null;
      termUntil = youngest ? { year: Number(youngest.birthDate.slice(0, 4)) + SCHOOL_DONE, why: `${youngest.name} turns ${SCHOOL_DONE}`, who: youngest.name, event: `turns ${SCHOOL_DONE}` } : sRetire ? { year: sRetire, why: `${sv.survivor.name} retires`, who: sv.survivor.name, event: "retires" } : null;
    } else if (youngest) termUntil = { year: Number(youngest.birthDate.slice(0, 4)) + SCHOOL_DONE, why: `${youngest.name} turns ${SCHOOL_DONE}`, who: youngest.name, event: `turns ${SCHOOL_DONE}` };
    // a year already past (a survivor who has retired) is no horizon to buy cover to
    if (termUntil && termUntil.year <= startYear) termUntil = null;

    // 1b. a single parent: no second adult in the household, and a child under 18 who lives on the pay. A second adult whose
    // plan cannot be built (no birth date) keeps the rule of thumb, and the page says what to add: the children are not
    // left alone, so their answer would leave that adult out.
    let child = null, survivorMissing = null;
    const other = people.find((q) => q.role !== "dependent" && q.id !== d.id);
    if (!sv && other) survivorMissing = { id: other.id, name: other.name, birthDate: !other.birthDate };
    if (!sv && !other && pay > 0 && minors.length) {
      ci = ci ?? childInputs();
      const pia = ss.people.find((q) => q.id === d.id)?.pia ?? 0;
      // each child's own college today (their part of each college part), so their own Social Security nets against it
      const own = ci.collegeAt(startYear);
      const kidsNow = minors.map((k, i) => ({ name: k.name, birthDate: k.birthDate, college: own[i] }));
      const now = childNeed({ children: kidsNow, startYear, fromMonth, realDiscount, spending: ci.spending, childcare: ci.childcare, pia, debts, funeral: FUNERAL, savings: ci.savings });
      // the need over time: when each child's needs end (their college's last year, or 18 with no college counted)
      const ends = ci.kidsInfo.map((k, i) => {
        const [by, bm] = String(k.birthDate).split("-").map(Number);
        return own[i] >= 0.5 ? { last: k.start + k.years - 1, year: k.start + k.years, who: k.name, event: "college ends", birthDate: k.birthDate } : { last: (bm || 1) > 1 ? by + CHILD_UNTIL : by + CHILD_UNTIL - 1, year: by + CHILD_UNTIL, who: k.name, event: "turns 18", birthDate: k.birthDate };
      });
      // the last to end (twins ending together are named together: "Ed and Ann's college ends", "Ed and Ann turn 18")
      const latest = ends.reduce((a, x) => (x.year > a.year || (x.year === a.year && x.birthDate > a.birthDate) ? x : a));
      const tied = ends.filter((x) => x.year === latest.year && x.event === latest.event).map((x) => x.who);
      const end = tied.length > 1 ? { ...latest, who: listOf(tied), event: latest.event === "turns 18" ? "turn 18" : latest.event } : latest;
      const pr = projected();
      const later = childSeries({ kids: ci.kidsInfo, startYear: startYear + 1, lastYear: end.last, realDiscount, spending: ci.spending, childcare: ci.childcare, pia, collegeAt: ci.collegeAt, debtsAt: pr.debtsAt, savingsAt: (y) => pr.savingsAt(y, ci.savings), funeral: FUNERAL });
      const needByYear = [{ year: startYear, need: now.need, net: now.net, total: now.total, kidsShort: now.kidsShort, costs: now.costs, college: now.college, benefits: now.benefits, benefitsCounted: now.benefitsCounted, debts: now.debts, savings: now.savings, children: now.children }, ...(end.last > startYear ? later : [])];
      // the largest in today's money (the earliest year of it), and whether the need only ever goes down from now
      const peak = needByYear.reduce((a, x) => (x.need > a.need ? x : a));
      const steady = needByYear.every((x, i) => i === 0 || x.need <= needByYear[i - 1].need);
      // the shape up to the largest, read with a tolerance: a dip under SHAPE_TOLERANCE (2%) of the largest is not "going down"
      const tol = SHAPE_TOLERANCE * peak.need;
      let high = -Infinity;
      const rising = needByYear.filter((x) => x.year <= peak.year).every((x) => { const ok = x.need >= high - tol; high = Math.max(high, x.need); return ok; });
      // a level policy pays the same dollars every year while prices rise: each year's need in that year's dollars (x the
      // plan's price level for the year, the index the series divides by), and the cover worth in today's money then (the
      // cover still paying that year / the price level) against that year's need. A policy counts for a year only when it
      // pays for a death at any time in it (`lastsYear`: no end date, or ending on or after December 31 of that year): one
      // that ends in 2030 pays nothing for a death in 2031 or later, one ending 3/31/2028 nothing for a death later in 2028
      // (review 2026-11-06)
      for (const x of needByYear) {
        x.priceLevel = pr.priceAt(x.year); x.dollars = x.need * x.priceLevel;
        x.coverInForce = coverIn(mine, x.year);
        x.coverWorth = x.coverInForce / x.priceLevel; x.short = Math.max(0, x.need - x.coverWorth);
      }
      // the cover to buy: the largest of those, rounded up to $1,000 (`sizedOf`)
      const sized = sizedOf(needByYear);
      child = { ...now, collegeParts: ci.collegeParts, collegeKids: ci.collegeKids, collegeLeftOut: ci.collegeLeftOut, collegeOthers: ci.collegeOthers, childcareLines: ci.childcare.map((x) => x.name), untiedKids: ci.untiedKids,
        needByYear, peak: { year: peak.year, need: peak.need }, sized, today: now.need, steady, rising, needEnds: { year: end.year, who: end.who, event: end.event } };
      // the need ends when the children's do (the youngest's college): the cover lasts until then
      termUntil = { year: end.year, why: end.event === "college ends" ? `${end.who}'s college ends` : `${end.who} ${end.event}`, who: end.who, event: end.event };
      if (termUntil.year <= startYear) termUntil = null;
      // the rule of thumb counts the same goals as this answer (not a grown dependent's)
      dime.education = ci.dimeEducation;
      dime.total = dime.debts + dime.finalExpenses + dime.income + dime.mortgage + dime.education;
    }

    const method = planAnswer && planAnswer.need !== null ? "plan" : child ? "child" : "dime";
    // the single parent's answer and the rule of thumb rounded up to $1,000 like the plan's answer, so every page shows the same
    // figure; the single parent's is the cover a level policy needs: the largest of each year's need in that year's dollars,
    // from now until the children's needs end (`sized`, sixth pass)
    const need = method === "plan" ? planAnswer.need : method === "child" ? child.sized.need : Math.ceil(dime.total / 1000) * 1000;
    // term cover that ends before the need does: on file today and gone later. A couple: by next year. A single parent: every
    // policy that does not pay for a death at any time until the children's needs end (the last year of `needByYear`),
    // however far off (review 2026-11-06: cover ending in 2030 counted as paying for a death in 2037)
    const lastYear = method === "child" ? child.needByYear.at(-1).year : null;
    const endsBefore = (x) => (method === "child" ? !lastsYear(x, lastYear) : Number(String(x.endDate).slice(0, 4)) <= startYear + 1 && Number(String(x.endDate).slice(0, 4)) < termUntil.year);
    const endsSoon = termUntil ? mine.filter((x) => x.endDate && endsBefore(x)).map((x) => ({ endDate: x.endDate, benefit: Number(x.benefit) || 0 })) : [];
    const stays = cover - endsSoon.reduce((s2, x) => s2 + x.benefit, 0);
    // a couple's or the rule of thumb's cover that ends by next year, by date, those ending the same day added up (`endSteps`,
    // as a single parent's `child.endSteps`): the page names every date, never only the first policy to end with its own
    // amount (verification 8b, review 2026-11-06: $50,000 ending 3/31/2027 and $150,000 ending 12/31/2027 read "Covered
    // until 3/31/2027, when $50,000 of it ends; short by about $85,000 from then", though $300,000 still covers the
    // $235,000 needed until 12/31/2027)
    const endSteps = method === "child" ? null : [...new Set(endsSoon.map((x) => String(x.endDate)))].sort().map((e) => { const xs = endsSoon.filter((x) => String(x.endDate) === e); return { endDate: e, benefit: xs.reduce((s2, x) => s2 + x.benefit, 0), policies: xs.length }; });
    // a single parent's cover that ends: what is needed after it ends (`afterEnd`) is worked over the years it no longer pays
    // for (the cover still paying in a year, `coverInForce`, under what is on file today), the year short the most in that
    // year's dollars (the earliest of it), less only the cover still paying then (`afterEnd.cover`: what stays for good, or
    // also a later policy not yet ended); `most` says whether that year's need is also the largest of those years (several
    // policies ending at different times: 2037 can be paid by a later policy while 2041 is not). Never the whole series'
    // figure when that is earlier; covered until it ends only when the full cover pays each year's need until then
    // (`coveredUntilEnd`)
    if (method === "child" && endsSoon.length) {
      const endYear = Math.min(...endsSoon.map((x) => Number(String(x.endDate).slice(0, 4))));
      const after = child.needByYear.filter((x) => x.coverInForce < cover);
      const top = after.length ? after.reduce((a, x) => (x.dollars - x.coverInForce > a.dollars - a.coverInForce + 0.005 ? x : a)) : null;
      child.afterEnd = top ? { ...sizedOf([top]), cover: top.coverInForce, most: after.every((x) => x.dollars <= top.dollars + 0.005) } : { year: endYear, need: 0, real: 0, priceLevel: 1, cover: stays, most: true };
      child.coveredUntilEnd = child.needByYear.filter((x) => x.year <= endYear).every((x) => x.dollars <= cover + 0.005);
      child.coverStays = stays;
      // what the page names as ending: every policy not paying in afterEnd's year, by date, those ending the same day added
      // up ("$150,000 on 12/31/2031 and $150,000 on 12/31/2036"; "$250,000 ... on 12/31/2033" for $100,000 and $150,000
      // ending that day), never only the first to end (verification, review 2026-11-06)
      const gone = mine.filter((x) => x.endDate && !lastsYear(x, child.afterEnd.year));
      child.endSteps = [...new Set(gone.map((x) => String(x.endDate)))].sort().map((e) => { const xs = gone.filter((x) => String(x.endDate) === e); return { endDate: e, benefit: xs.reduce((s2, x) => s2 + (Number(x.benefit) || 0), 0), policies: xs.length }; });
    }
    // cover through work ends with the job: what would be short without it. A single parent's is worked year by year like
    // `afterEnd` (the cover still paying that year less the work cover still paying then), so a policy that ends before the
    // need does never counts for a later year (verification, review 2026-11-06: $150,000 ending 2029 beside $100,000
    // through work read "Without it ... short about $72,000" under a card short $122,000 with it; it is $222,000)
    // A couple's or the rule of thumb's ("ends soon" = by next year) leaves out the term cover not through work that ends by
    // next year too (`jobEnding`, review 2026-11-06 follow-up: $100,000 through work beside $200,000 ending 6/30/2027 read
    // need - $200,000, the ending policy counted, and the notice was hidden; with nothing left on file it is the need)
    const endingOther = method === "child" || !termUntil ? [] : mine.filter((x) => x.endDate && !x.throughWork && endsBefore(x));
    const jobEnding = coverWork > 0 && endingOther.length ? { benefit: endingOther.reduce((s2, x) => s2 + (Number(x.benefit) || 0), 0), endDate: endingOther.map((x) => String(x.endDate)).sort().at(-1), policies: endingOther.length } : null;
    let gapIfJobEnds = Math.max(0, need - (cover - coverWork - (jobEnding?.benefit ?? 0)));
    if (method === "child" && coverWork > 0) {
      const work = mine.filter((x) => x.throughWork);
      const left = (x) => x.coverInForce - coverIn(work, x.year);
      const top = child.needByYear.reduce((a, x) => (x.dollars - left(x) > a.dollars - left(a) + 0.005 ? x : a));
      child.ifJobEnds = { ...sizedOf([top]), cover: left(top) };
      gapIfJobEnds = Math.max(0, child.ifJobEnds.need - child.ifJobEnds.cover);
    }
    const gapAfterEnd = method === "child" && child.afterEnd ? Math.max(0, child.afterEnd.need - child.afterEnd.cover) : Math.max(0, need - stays);
    // to spare: a single parent's cover that ends keeps only what still pays in the year short the most after it ends
    const spare = method === "child" && child.afterEnd ? Math.max(0, Math.min(cover - need, child.afterEnd.cover - child.afterEnd.need)) : Math.max(0, cover - need);
    const dependants = !!survivorName || children.length > 0;
    return {
      id: d.id, name: d.name, age, pay, cover, coverWork, survivorName, survivorMissing,
      plan: planAnswer, child, dime, lifetime, need, method,
      gap: Math.max(0, need - cover), spare, gapIfJobEnds, jobEnding,
      dependants, termUntil, endsSoon, endSteps, gapAfterEnd,
      // the one rule for raising it outside this page (and for this page's headline): someone depends on the pay, and the
      // gap, today or once cover that ends soon is gone, is at least MIN_GAP
      raise: dependants && pay > 0 && Math.max(Math.max(0, need - cover), endsSoon.length ? gapAfterEnd : 0) >= MIN_GAP,
    };
  });
  // the adults the plan cannot run for (no birth date): what is known of them, so the page can still show it
  const inPlan = new Set(I.people.map((d) => d.id));
  const unplanned = people.filter((q) => q.role !== "dependent" && !inPlan.has(q.id)).map((q) => {
    const mine = pol.items.filter((x) => !x.ended && x.personId === q.id && x.group === "life");
    return { id: q.id, name: q.name, pay: payOf(q.id), cover: mine.reduce((s, x) => s + (Number(x.benefit) || 0), 0), coverWork: mine.filter((x) => x.throughWork).reduce((s, x) => s + (Number(x.benefit) || 0), 0), birthDate: !q.birthDate };
  });
  return { ready: true, missing: [], people: out, children: children.map((c) => ({ name: c.name, age: c.age })), startYear, spendingYearly, unassignedCover, unplanned };
}

/** Whole years (with the fraction) from today until a birthday age. */
function shareUnderYears(birthDate, age, today) {
  const [by, bm, bd] = String(birthDate).split("-").map(Number);
  const [ty, tm, td] = String(today).split("-").map(Number);
  return (by + age - ty) + ((bm - tm) + ((bd || 1) - (td || 1)) / 31) / 12;
}

/**
 * A life policy pays for a death at any time in a year when it has no end date or ends on or after December 31 of that year
 * (review 2026-11-06); `coverIn(policies, year)` adds up those that do.
 */
export const lastsYear = (x, year) => !x.endDate || String(x.endDate) >= `${year}-12-31`;
export const coverIn = (policies, year) => policies.filter((x) => lastsYear(x, year)).reduce((s, x) => s + (Number(x.benefit) || 0), 0);
/** A gap smaller than this is not raised outside this page (Needs attention, Next best action). */
export const MIN_GAP = 10000;
/** "For how long" reads the need's shape with this tolerance: a dip under 2% of the largest year is not "going down". */
export const SHAPE_TOLERANCE = 0.02;
/**
 * A level policy's size from a list of years (`needByYear` entries with `dollars` = that year's need x its price level):
 * the largest in that year's dollars (the earliest year of it), to the cent, rounded up to $1,000.
 * -> { year, need (that year's dollars, rounded up), real (that year's need in today's money), priceLevel }
 */
function sizedOf(ys) {
  const top = ys.reduce((a, x) => (x.dollars > a.dollars + 0.005 ? x : a));
  return { year: top.year, need: Math.ceil(Math.round(top.dollars * 100) / 100 / 1000) * 1000, real: top.need, priceLevel: top.priceLevel };
}

/** A name as it reads in a sentence: the setup's "Me" is "you", its "My spouse" is "your spouse" (core/words.js nameIn). */
export const sayName = nameIn;
/** The possessive: "your" for "Me", "your spouse's", else "Ana's" (core/words.js nameOf). */
export const sayWhose = nameOf;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const listOf = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a.at(-1)}` : a[0] ?? "the family");
const dollars = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
/** "Cy turns 22", "your spouse retires", "you retire": termUntil's reason with the setup's names said plainly. */
const whyWords = (t) => (t.who === undefined ? t.why : t.event === "retires" && sayName(t.who) === "you" ? "you retire" : t.event === "college ends" ? `${sayWhose(t.who)} college ends` : `${sayName(t.who)} ${t.event}`);
const usDate = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return `${m}/${d}/${y}`; };
/**
 * ", in that year's dollars" after a single parent's figure for a later year (`sized`, `afterEnd`): a level policy pays the
 * same dollars every year while prices rise, so the figure is in the dollars of its year; nothing when prices are as today.
 */
export const inDollars = (s) => (s && Number(s.priceLevel) > 1.0005 ? ", in that year's dollars" : "");
/** A part of the single parent's answer as it is said: to the nearest $100 (the answer itself is rounded up to $1,000). */
const part = (n) => dollars(Math.round(n / 100) * 100);
/**
 * Whose college a single parent's answer counts, as said: "college" when it counts every child's, else "Child 1's college"
 * (the children it counts it for: a child left out, or one whose goal is a grown dependent's, is never said as covered).
 */
export function collegeWords(c) {
  const counted = [...new Set((c.collegeKids ?? []).map((k) => k.name))];
  const all = (c.children ?? []).every((n) => counted.includes(n));
  return all || !counted.length ? "college" : `${listOf(counted.map(sayName))}'s college`;
}

/**
 * The single parent's answer in words, only the parts above zero, every amount as the page shows it (`shownChild`: to the
 * $100, sums worked from the shown parts): "their costs until 18 ($313,100) and college ($104,900) less Social Security for
 * Child 1 ($279,100), plus debts ($4,000) and a funeral ($8,300), less the $1,900 you have saved" (Social Security named as
 * the page names it: the child; for several children what each one's own Social Security pays of that child's costs and
 * college). When it covers them: "Social Security for the children covers their costs until 18 and college; that leaves
 * debts ($4,000) and a funeral ($8,300), less the $1,900 Jo has saved".
 */
export function childParts(c, who = "you") {
  const s = c.shown ?? shownChild(c);
  const one = (c.children?.length ?? 0) <= 1;
  const kids = one && c.children?.length ? sayName(c.children[0]) : "the children";
  // whose college is counted: "college" when every child's is, else "Child 1's college" (never a college left out)
  const col = collegeWords(c);
  const theirs = [s.costs > 0 ? `${one ? "their" : "the children's"} costs until 18 (${dollars(s.costs)})` : null, s.college > 0 ? `${col} (${dollars(s.college)})` : null].filter(Boolean);
  const rest = [s.debts > 0 ? `debts (${dollars(s.debts)})` : null, s.funeral > 0 ? `a funeral (${dollars(s.funeral)})` : null].filter(Boolean);
  const saved = s.savings > 0 ? `less the ${dollars(s.savings)} ${who === "you" ? "you have" : `${who} has`} saved` : "";
  if (s.counted > 0 && s.short === 0) {
    const what = listOf([s.costs > 0 ? "costs until 18" : null, s.college > 0 ? col : null].filter(Boolean));
    return `Social Security for ${kids} covers their ${what}${rest.length ? `; that leaves ${listOf(rest)}${saved ? `, ${saved}` : ""}` : saved ? `; ${saved}` : ""}`;
  }
  // several children: each one's own Social Security nets only against that child's costs and college
  const ss = one || !s.kids.length ? `Social Security for ${kids}` : "what each child's own Social Security pays for them";
  const head = theirs.length ? `${listOf(theirs)}${s.counted > 0 ? ` less ${ss} (${dollars(s.counted)})` : ""}` : "";
  return [head ? `${head}${rest.length ? `, plus ${listOf(rest)}` : ""}` : rest.length ? listOf(rest) : "", saved].filter(Boolean).join(", ");
}

/**
 * protectionGaps(plan, { today }) -> [{ id, personId, name, who, whose, need, cover, gap, depends: [names], dependsWords,
 *   termUntil, until, method, endsSoon, unassignedCover, title, sentence }]
 * The earners whose death would leave the people who depend on them short by MIN_GAP or more, today or once term cover
 * that ends is gone (within a year; for a single parent, any time before the children's needs end) (this page's own
 * answer: the plan's lump sum, the single parent's answer, else the rule of thumb, rounded to $1,000),
 * for Needs attention, Next best action and the setup's moves, with the words they all show (`title`, `sentence`).
 * Nothing is worked out unless someone has pay and there is a dependent or a second adult.
 */
export function protectionGaps(plan, params = {}) {
  const people = plan.household?.people ?? [];
  const kids = people.filter((q) => q.role === "dependent");
  const grown = people.filter((q) => q.role !== "dependent");
  const paid = (plan.income ?? []).some((x) => ["salary", "bonus", "business"].includes(x?.type) && Number(x.amount) > 0);
  if (!paid || !(kids.length || grown.length > 1)) return [];
  let d = null;
  try { d = compute(plan, params); } catch { d = null; }
  if (!d?.ready) return [];
  return d.people.filter((p) => p.raise).map((p) => {
    const ending = p.endsSoon.length > 0 && p.gapAfterEnd > p.gap;
    const gap = ending ? p.gapAfterEnd : p.gap;
    const depends = [p.survivorName ?? p.survivorMissing?.name, ...d.children.map((c) => c.name)].filter(Boolean);
    const who = sayName(p.name), whose = sayWhose(p.name), dw = listOf(depends.map(sayName));
    const term = p.termUntil ? ` until about ${p.termUntil.year} (${whyWords(p.termUntil)})` : "";
    const unassigned = d.unassignedCover > 0 ? ` A ${dollars(d.unassignedCover)} life policy on Policies names nobody: pick who it covers there and it counts.` : "";
    let title, sentence;
    if (ending && p.method === "child" && p.child?.afterEnd) {
      // a single parent's cover that ends soon: what is needed after it ends, with the year of that figure, never "less" a
      // policy that will be gone
      // the policies that end before that year, by date (`endSteps`): one, or several added up, or each with its date
      const steps = p.child.endSteps?.length ? p.child.endSteps : [p.endsSoon.reduce((a, x) => (x.endDate < a.endDate ? x : a))];
      const end = steps[0];
      const ends = steps.length > 1
        ? `term cover ends in steps, ${listOf(steps.map((s) => `${dollars(s.benefit)} on ${usDate(s.endDate)}`))}`
        : `${dollars(end.benefit)} ${(end.policies ?? 1) > 1 ? "of term cover" : "term policy"} ends on ${usDate(end.endDate)}`;
      const ae = p.child.afterEnd, stays = p.child.coverStays ?? 0;
      // the cover still paying in that year: what stays for good, or with a later policy not yet ended then (review
      // 2026-11-06); when the year short the most is not the year of the largest need, it is said as a shortfall
      const left = ae.cover ?? stays, leftWords = `the ${dollars(left)} ${left > stays ? "still on file then" : "that stays on file"}`;
      // the children under 18 the answer is for ("Child 1 counts on Jo", "Child 1 and Child 2 count on Jo")
      const kids = (p.child.children ?? []).map(sayName), kw = listOf(kids);
      const then = `the most, if ${who} died in ${ae.year}${inDollars(ae)}`;
      title = `${cap(whose)} term life cover ends ${listOf(steps.map((s) => usDate(s.endDate)))}: ${kw} would then ${left > 0 || ae.most === false ? `be up to about ${dollars(gap)} short` : `need up to about ${dollars(gap)}`} (if ${who} died in ${ae.year})`;
      const after = ae.most === false
        ? `After it ends they would be up to about ${dollars(gap)} short, if ${who} died in ${ae.year}${inDollars(ae)}${left > 0 ? `, with ${leftWords} against ${dollars(ae.need)} needed` : ""}`
        : `After it ends they would need up to about ${dollars(ae.need)}: ${then}${left > 0 ? `; with ${leftWords}, about ${dollars(gap)} short` : ""}`;
      sentence = `${cap(whose)} ${ends}, and ${kw} ${kids.length > 1 ? "count" : "counts"} on ${who}${p.termUntil ? ` until about ${p.termUntil.year}` : ""}. ${after}. New term cover on ${who} from then closes it.`;
    } else if (ending) {
      // a couple's or the rule of thumb's: every policy ending by next year, by date (`endSteps`, the same day added up),
      // never only the first with its own amount (verification 8b, review 2026-11-06)
      const steps = p.endSteps?.length ? p.endSteps : [p.endsSoon.reduce((a, x) => (x.endDate < a.endDate ? x : a))];
      const end = steps[0];
      const ends = steps.length > 1
        ? `term cover ends in steps, ${listOf(steps.map((s) => `${dollars(s.benefit)} on ${usDate(s.endDate)}`))}`
        : `${dollars(end.benefit)} ${(end.policies ?? 1) > 1 ? "of term cover" : "term policy"} ends on ${usDate(end.endDate)}`;
      title = `${cap(whose)} term life cover ends ${listOf(steps.map((s) => usDate(s.endDate)))}: ${dw} would then be about ${dollars(gap)} short`;
      sentence = `${cap(whose)} ${ends}, and ${dw} count on ${who}${p.termUntil ? ` until about ${p.termUntil.year}` : ""}: ${steps.length > 1 ? "once it has ended" : "without it"} they would be about ${dollars(gap)} short. New term cover on ${who} from then closes it.`;
    } else if (p.method === "child") {
      // a single parent: what the children would need, part by part (only the parts above zero), and the cover to buy
      const kw = listOf(p.child.children.map(sayName));
      // the cover is the largest of each year's need in that year's dollars (`sized`); when that year is later than today,
      // said once, with today's
      const sized = p.child.sized ?? { year: d.startYear, need: p.need, priceLevel: 1 };
      const later = sized.year > d.startYear;
      const today = p.child.today ?? p.need;
      title = p.cover > 0 ? `${cap(whose)} life cover is about ${dollars(gap)} short` : `No life insurance on ${who}: ${kw} would need ${later ? "up to " : ""}about ${dollars(p.need)}`;
      sentence = (later
        ? `If ${who} died in ${sized.year}, ${kw} would need about ${dollars(p.need)}${inDollars(sized)}, the most in any year; if ${who} died today, ${today > 0 ? `about ${dollars(today)}` : "nothing more"}: ${childParts(p.child, who)}.`
        : `If ${who} died, ${kw} would need about ${dollars(p.need)}: ${childParts(p.child, who)}.`)
        + `${p.cover > 0 ? ` With the ${dollars(p.cover)} of cover on file, that is about ${dollars(gap)} short.` : ""} ${p.cover > 0 ? "More term" : "Term"} life cover on ${who}${term} is the usual way to buy it.`;
    } else if (p.method === "dime") {
      // the rule of thumb's parts, only those above zero (no mortgage for a renter, no college with none planned)
      const di = p.dime;
      const parts = listOf([di.debts > 0 ? "debts" : null, di.income > 0 ? `${whose} pay until the youngest is 18` : null, di.mortgage > 0 ? "the mortgage" : null, di.education > 0 ? "college" : null, "a funeral"].filter(Boolean));
      title = p.cover > 0 ? `${cap(whose)} life cover is about ${dollars(gap)} under the rule of thumb` : `No life insurance on ${who}: ${dw} would need about ${dollars(p.need)} by a common rule of thumb`;
      sentence = `If ${who} died, a common rule of thumb (${parts} added up) puts what ${dw} would need at about ${dollars(p.need)}${p.cover > 0 ? `, ${dollars(gap)} more than the ${dollars(p.cover)} of cover on file` : ""}. Term life cover on ${who}${term} is the usual way to buy it.`;
    } else {
      title = p.cover > 0 ? `${cap(whose)} life cover is about ${dollars(gap)} short` : `No life insurance on ${who}: ${dw} would be about ${dollars(gap)} short`;
      sentence = `If ${who} died this year, ${dw} would be about ${dollars(gap)} short${p.cover > 0 ? ` even with the ${dollars(p.cover)} of cover on file` : ""}. ${p.cover > 0 ? "More" : "Term life"} cover on ${who}${term} closes it.`;
    }
    return {
      id: p.id, personId: p.id, name: p.name, who, whose, need: p.need, cover: p.cover, gap, depends, dependsWords: dw,
      termUntil: p.termUntil, until: p.termUntil?.year ?? null, method: p.method, endsSoon: p.endsSoon, unassignedCover: d.unassignedCover,
      title: title + (d.unassignedCover > 0 ? ` (a ${dollars(d.unassignedCover)} policy names nobody)` : ""), sentence: sentence + unassigned,
    };
  });
}
