// modules/cashflow/budget-percent/compute.js -- PURE. The 50/30/20 rule (or the household's own split) on income after
// tax: what goes to needs (the bills you must pay), wants (the rest of the spending) and savings (retirement, goals and
// what is left over), each against its target share, with the largest items in each and how far each is off.
import { compute as computeIncome } from "../income/compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { seTax } from "../../taxes/self-employment/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";

/** The rule's split of income after tax (Elizabeth Warren and Amelia Warren Tyagi, "All Your Worth", 2005): needs 50%, wants 30%, savings 20%. */
export const RULE = { needs: 0.5, wants: 0.3, savings: 0.2 };
/** Other splits people use when costs are high or saving matters more. */
export const PRESETS = { "50-30-20": RULE, "60-20-20": { needs: 0.6, wants: 0.2, savings: 0.2 }, "70-20-10": { needs: 0.7, wants: 0.2, savings: 0.1 } };
/** An employee's Social Security and Medicare (IRC 3101). */
export const FICA = { ss: 0.062, medicare: 0.0145 };
/** Within this many points of the target counts as on target. */
export const SLACK = 0.02;

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const pos = (v) => Math.max(0, num(v) ?? 0);

/**
 * The split to aim for: a preset, or the household's own shares (needs, wants, savings as fractions). Own shares that do
 * not add up to 100% are scaled so they do; none typed gives the rule.
 */
export function targetsFor(s = {}) {
  if (s.preset && PRESETS[s.preset]) return { ...PRESETS[s.preset], from: s.preset };
  const own = ["needs", "wants", "savings"].map((k) => pos(s[k]));
  const sum = own.reduce((a, b) => a + b, 0);
  if (s.preset === "own" && sum > 0) return { needs: own[0] / sum, wants: own[1] / sum, savings: own[2] / sum, from: "own", scaled: Math.abs(sum - 1) > 1e-6 };
  return { ...RULE, from: "50-30-20" };
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, month: { gross, federal, payroll, state, stateKnown, afterTax },
 *   targets: { needs, wants, savings, from, scaled },
 *   buckets: [{ key, label, monthly, share, target, targetMonthly, gap (monthly - target amount), status: "over"|"under"|"on" }],
 *   needs: [{ id, name, category, monthly }], wants: [...],
 *   saving: { retirement, goals, leftover, short (spending above income), unlisted (left over above 10% of income after tax) }, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const inc = computeIncome(plan, { today }), exp = computeExpenses(plan, { today });
  const missing = [];
  if (!inc.count || !(inc.monthly > 0)) missing.push("income");
  if (!exp.count) missing.push("expenses");
  if (missing.length) return { ready: false, missing };
  const notes = [];

  // income after tax, a month: federal income tax (the Federal estimate), Social Security and Medicare on pay (each
  // person's wages to the wage base), self-employment tax on business income, the state's tax
  const fed = computeFederal(plan, { today });
  const year = fed.year ?? Number(today.slice(0, 4));
  const base = maximumEarnings(year);
  let payroll = 0;
  for (const id of new Set(inc.active.map((x) => x.personId ?? ""))) {
    const mine = inc.active.filter((x) => (x.personId ?? "") === id && x.taxable !== false);
    const wages = mine.filter((x) => x.type === "salary" || x.type === "bonus").reduce((t, x) => t + x.yearly, 0);
    const business = mine.filter((x) => x.type === "business").reduce((t, x) => t + x.yearly, 0);
    payroll += FICA.ss * Math.min(wages, base) + FICA.medicare * wages + seTax(business, { wages, wageBase: base }).total;
  }
  const st = computeState(plan, { today });
  const stateKnown = st.method === "none" || (st.rate !== null && st.rate !== undefined);
  if (!stateKnown) notes.push("Your state's income tax is not taken off: set it on the State page under Taxes.");
  const month = { gross: inc.monthly, federal: Math.max(0, fed.result?.totalTax ?? 0) / 12, payroll: payroll / 12, state: stateKnown ? Math.max(0, st.tax ?? 0) / 12 : 0, stateKnown };
  month.afterTax = month.gross - month.federal - month.payroll - month.state;

  // needs: the bills marked "I must pay this" on Expenses; wants: the rest; savings: what goes to retirement accounts
  // (your own money, not the employer's), to goals each month, and what is left over
  const items = exp.items.filter((x) => x.active && x.monthly > 0);
  const needs = items.filter((x) => x.essential).map((x) => ({ id: x.id, name: x.name || x.categoryLabel, category: x.categoryLabel, monthly: x.monthly })).sort((a, b) => b.monthly - a.monthly);
  const wants = items.filter((x) => !x.essential).map((x) => ({ id: x.id, name: x.name || x.categoryLabel, category: x.categoryLabel, monthly: x.monthly })).sort((a, b) => b.monthly - a.monthly);
  const needsMonthly = needs.reduce((t, x) => t + x.monthly, 0), wantsMonthly = wants.reduce((t, x) => t + x.monthly, 0);
  const con = computeContributions(plan, { today });
  const gl = computeGoals(plan, { today });
  const retirement = con.yearly / 12;
  const goals = (gl.goals ?? []).filter((g) => g.status !== "done").reduce((t, g) => t + pos(g.monthly), 0);
  const rest = month.afterTax - needsMonthly - wantsMonthly - retirement - goals;
  const saving = { retirement, goals, leftover: Math.max(0, rest), short: Math.max(0, -rest) };
  const savingsMonthly = retirement + goals + saving.leftover;
  if (saving.short > 0.5) notes.push("More goes out each month than comes in after tax: the shares below add up to more than 100%.");
  // money neither listed as spending nor sent to savings is counted as saved; much of it usually means spending is missing
  const unlisted = month.afterTax > 0 && saving.leftover > 0.1 * month.afterTax;

  const targets = targetsFor(plan.whatIfs?.budgetPercent ?? {});
  const A = month.afterTax;
  const bucket = (key, label, monthly) => {
    const share = A > 0 ? monthly / A : null;
    const target = targets[key];
    const status = share === null ? null : key === "savings" ? (share < target - SLACK ? "under" : "on") : share > target + SLACK ? "over" : "on";
    return { key, label, monthly, share, target, targetMonthly: Math.max(0, A) * target, gap: monthly - Math.max(0, A) * target, status };
  };
  const buckets = [bucket("needs", "Needs", needsMonthly), bucket("wants", "Wants", wantsMonthly), bucket("savings", "Savings", savingsMonthly)];
  if (!(A > 0)) notes.push("Taxes take all of the income typed, so there is nothing to split: check the Income page.");
  if (!needs.length && wants.length) notes.push("No expense is marked \"I must pay this\" yet, so everything counts as a want: mark the bills you must pay below or on the Expenses page.");
  return { ready: true, missing: [], year, month, targets, buckets, needs, wants, saving: { ...saving, unlisted }, notes };
}
