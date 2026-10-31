// modules/insurance/life-needs/compute.js -- PURE and heavy. How much life insurance each adult needs,
// three ways, against the cover on the Policies page:
//   1. the plan's own answer (couples): the smallest lump sum that keeps the survivor's plan on track,
//      their living costs before retirement included, with Social Security for the children and for
//      the parent caring for them;
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
import { survivorInputs, FUNERAL, TAKE_HOME, SURVIVOR_SPENDING } from "../../scenarios/stress-tests/compute.js";
export { FUNERAL, TAKE_HOME, SURVIVOR_SPENDING };
import { smallestWhere } from "../../scenarios/goal-seek/compute.js";
import { WAGE_INDICES } from "../../retirement/social-security/data/ssa.js";
import { ageOn } from "../../../core/math/dates.js";

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
const EDUCATION = /college|university|school|tuition|education|degree/i;
const MORTGAGE_TYPES = ["mortgage", "heloc"];

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
 * -> { children (yearly, all), parent (yearly, after the test), familyMaxMonthly }
 */
export function familyBenefits({ pia, year, deathYear, children, parentPay }) {
  const fm = familyMaximum(pia, deathYear);
  const kids = children.map((c) => CHILD_SHARE * pia * shareUnder(c.birthDate, CHILD_UNTIL, year));
  const care = Math.max(0, ...children.map((c) => shareUnder(c.birthDate, CARE_UNTIL, year)));
  const parent = PARENT_SHARE * pia * care;
  const total = kids.reduce((s, x) => s + x, 0) + parent;
  const cut = total > fm ? fm / total : 1;
  const kidsYearly = kids.reduce((s, x) => s + x, 0) * cut * 12;
  const parentYearly = Math.max(0, parent * cut * 12 - Math.max(0, parentPay - earningsTestExempt(deathYear)) / 2);
  return { children: kidsYearly, parent: parentYearly, familyMaxMonthly: fm };
}

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
 *     dime: { debts, finalExpenses, income, incomeYears, mortgage, education, total },
 *     lifetime: { yearly, years, total },
 *     need, method: "plan"|"dime", gap, spare, gapIfJobEnds, termUntil: { year, why } | null
 *   }], children: [{ name, age }], startYear
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
  const education = (plan.goals ?? []).filter((g) => EDUCATION.test(g.name ?? "")).reduce((s, g) => s + Math.max(0, (Number(g.target) || 0) - (Number(g.saved) || 0)), 0);
  const con = computeContributions(plan, { today });
  const ownSaving = (id) => con.byPerson?.find((p) => p.personId === id)?.yearly ?? 0;
  const pol = computePolicies(plan, { today });
  const ss = computeSocialSecurity(plan, { today });
  const realGrowth = (1 + I.rates.salaryGrowth) / (1 + I.rates.inflation) - 1;
  const realDiscount = (1 + I.returns.bonds) / (1 + I.rates.inflation) - 1;

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
      termUntil = youngest ? { year: Number(youngest.birthDate.slice(0, 4)) + SCHOOL_DONE, why: `${youngest.name} turns ${SCHOOL_DONE}` } : sRetire ? { year: sRetire, why: `${sv.survivor.name} retires` } : null;
    } else if (youngest) termUntil = { year: Number(youngest.birthDate.slice(0, 4)) + SCHOOL_DONE, why: `${youngest.name} turns ${SCHOOL_DONE}` };

    const method = planAnswer && planAnswer.need !== null ? "plan" : "dime";
    const need = method === "plan" ? planAnswer.need : dime.total;
    return {
      id: d.id, name: d.name, age, pay, cover, coverWork, survivorName,
      plan: planAnswer, dime, lifetime, need, method,
      gap: Math.max(0, need - cover), spare: Math.max(0, cover - need), gapIfJobEnds: Math.max(0, need - (cover - coverWork)),
      dependants: !!survivorName || children.length > 0, termUntil,
    };
  });
  return { ready: true, missing: [], people: out, children: children.map((c) => ({ name: c.name, age: c.age })), startYear, spendingYearly };
}

/** Whole years (with the fraction) from today until a birthday age. */
function shareUnderYears(birthDate, age, today) {
  const [by, bm, bd] = String(birthDate).split("-").map(Number);
  const [ty, tm, td] = String(today).split("-").map(Number);
  return (by + age - ty) + ((bm - tm) + ((bd || 1) - (td || 1)) / 31) / 12;
}
