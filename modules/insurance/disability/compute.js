// modules/insurance/disability/compute.js -- PURE. If someone who earns could not work: what their
// disability policies would pay (after tax, once the waiting period is over), how that compares with
// their pay, whether the household could still pay its must-pay bills, whether the cash lasts through
// the waiting period, and what Social Security disability might add.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { compute as computeSocialSecurity } from "../../retirement/social-security/compute.js";
import { compute as computePolicies } from "../policies/compute.js";
import { TAKE_HOME } from "../../scenarios/stress-tests/compute.js";
import { ageOn } from "../../../core/math/dates.js";

/** What most planners aim for: a benefit of 60% of gross pay (the usual group long-term disability benefit; 60 to 70% for individual cover). */
export const TARGET_SHARE = 0.6;
/** Defaults when a policy does not say: a 90-day waiting period and benefits to 65, the most common long-term disability terms. */
export const DEFAULT_WAIT_DAYS = 90, DEFAULT_UNTIL_AGE = 65;
/** Social Security disability starts after five full months of disability (SSA, "Disability Benefits", publication 05-10029). */
export const SSDI_WAIT_MONTHS = 5;
/** About 1 in 4 of today's 20-year-olds will be disabled before full retirement age (SSA, "Disability Benefits" and its fact sheet). */
export const ODDS_TEXT = "about 1 in 4";
/** What an individual policy usually costs a year, as a share of the pay it covers (an industry rule of thumb). */
export const COST_RANGE = [0.01, 0.03];
const DAYS_PER_MONTH = 365.25 / 12;

/** A policy's benefit after tax: employer-paid premiums make the benefit taxable (IRS Publication 525, "Sickness and Injury Benefits"); premiums you pay with taxed pay make it tax-free. */
export const afterTax = (monthly, taxable) => (taxable ? monthly * TAKE_HOME : monthly);
/** Who pays the premium: the employer unless the policy says otherwise (only for cover through work). */
export const employerPaid = (x) => (x.paidBy ? x.paidBy === "employer" : !!x.throughWork);

/**
 * compute(plan, { today }) -> {
 *   earners: [{ id, name, age, retireAge, payYearly, grossMonthly, takeHomeMonthly,
 *     policies: [{ id, name, monthly, taxable, afterTax, waitDays, untilAge, offset, throughWork, insurer }],
 *     benefitMonthly (before tax), afterTaxMonthly, share (benefit / gross), target, extraNeeded (to the target, a month), costRange: [low, high] a year,
 *     ssdiMonthly (the PIA, if Social Security approves), withSsdiMonthly (after tax, group cover reduced by Social Security),
 *     household: { essentialMonthly, othersMonthly (the others' take-home), shortMonthly (> 0 = short), coveredShare },
 *     wait: { days (the shortest wait among the policies; null without: Social Security's five months), months, shortMonthly (the must-pay bills the others' pay leaves uncovered),
 *             needed (shortMonthly x months), cash (usable cash now), covered, lastsMonths (cash / shortMonthly) } }],
 *   essentialMonthly, cashMonths, count, warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const people = plan.household?.people ?? [];
  const inc = computeIncome(plan, { today });
  const payOf = (id) => inc.active.filter((x) => x.personId === id && ["salary", "bonus", "business"].includes(x.type)).reduce((s, x) => s + x.yearly, 0);
  const exp = computeExpenses(plan, { today });
  const essentialMonthly = exp.essentialMonthly;
  const liq = computeLiquidity(plan, { today });
  const cashMonths = liq.runwayMonths;
  const ss = computeSocialSecurity(plan, { today });
  const pol = computePolicies(plan, { today });
  const retireAgeOf = (p) => Number(p.retirementAge) || Number(plan.assumptions?.retirementAge) || 65;
  const adults = people.filter((p) => p.role !== "dependent");
  const warnings = [];

  const earners = adults.map((p) => ({ p, pay: payOf(p.id), age: p.birthDate && today ? ageOn(p.birthDate, today) : null })).filter((x) => x.pay > 0 && (x.age === null || x.age < retireAgeOf(x.p))).map(({ p, pay, age }) => {
    const grossMonthly = pay / 12, takeHomeMonthly = grossMonthly * TAKE_HOME;
    const policies = pol.items.filter((x) => !x.ended && x.kind === "disability" && x.personId === p.id).map((x) => {
      const monthly = Number(x.benefit) || 0, taxable = employerPaid(x);
      return { id: x.id, name: x.name, insurer: x.insurer, monthly, taxable, afterTax: afterTax(monthly, taxable), waitDays: Number.isFinite(Number(x.waitDays)) && x.waitDays !== null && x.waitDays !== "" ? Number(x.waitDays) : DEFAULT_WAIT_DAYS, untilAge: Number(x.untilAge) || DEFAULT_UNTIL_AGE, offset: x.offset ?? !!x.throughWork, throughWork: !!x.throughWork };
    });
    const benefitMonthly = policies.reduce((s, x) => s + x.monthly, 0);
    const afterTaxMonthly = policies.reduce((s, x) => s + x.afterTax, 0);
    const ssdiMonthly = ss.people.find((q) => q.id === p.id)?.pia ?? 0;
    // once Social Security pays, a policy with an offset pays only the part above it (the usual group contract)
    const withSsdiMonthly = ssdiMonthly + policies.reduce((s, x) => s + afterTax(x.offset ? Math.max(0, x.monthly - ssdiMonthly) : x.monthly, x.taxable), 0);
    const target = TARGET_SHARE * grossMonthly;
    const extraNeeded = Math.max(0, target - benefitMonthly);
    const othersMonthly = adults.filter((q) => q.id !== p.id).reduce((s, q) => s + payOf(q.id) / 12 * TAKE_HOME, 0);
    const shortMonthly = essentialMonthly - othersMonthly - afterTaxMonthly;
    const shortest = policies.length ? Math.min(...policies.map((x) => x.waitDays)) : null;
    const waitMonths = shortest === null ? SSDI_WAIT_MONTHS : shortest / DAYS_PER_MONTH;
    // during the wait only the others' pay comes in: the cash must carry the rest of the must-pay bills
    const waitShort = Math.max(0, essentialMonthly - othersMonthly);
    return {
      id: p.id, name: p.name, age, retireAge: retireAgeOf(p), payYearly: pay, grossMonthly, takeHomeMonthly,
      policies, benefitMonthly, afterTaxMonthly, share: grossMonthly > 0 ? benefitMonthly / grossMonthly : 0, target, extraNeeded,
      costRange: COST_RANGE.map((r) => r * extraNeeded * 12 / TARGET_SHARE),
      ssdiMonthly, withSsdiMonthly,
      household: { essentialMonthly, othersMonthly, shortMonthly, coveredShare: essentialMonthly > 0 ? Math.min(1, (othersMonthly + afterTaxMonthly) / essentialMonthly) : null },
      wait: { days: shortest, months: waitMonths, shortMonthly: waitShort, needed: waitShort * waitMonths, cash: liq.now, covered: essentialMonthly > 0 ? liq.now >= waitShort * waitMonths : null, lastsMonths: waitShort > 0 ? liq.now / waitShort : null },
    };
  });
  for (const e of earners) {
    for (const x of e.policies) if (x.untilAge < e.retireAge) warnings.push(`${x.name} stops paying at ${x.untilAge}, before ${e.name} plans to retire at ${e.retireAge}.`);
    if (e.policies.length && e.policies.every((x) => x.throughWork)) warnings.push(`All of ${e.name}'s disability cover comes with the job: a new job may not offer it, and it ends if the job does.`);
  }
  return { earners, essentialMonthly, cashMonths, count: earners.length, warnings };
}
