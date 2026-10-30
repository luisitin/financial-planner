// modules/cashflow/budget-percent/compute.js -- PURE. The 50/30/20 rule (or the household's own split) on income after
// tax: what goes to needs (the bills you must pay), wants (the rest of the spending) and savings (retirement, goals and
// what is left over), each against its target share, with the largest items in each and how far each is off.
import { compute as computeIncome } from "../income/compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { compute as computePaycheck } from "../paycheck/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { seTax, SE, QBI } from "../../taxes/self-employment/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { QBI_MINIMUM, forYear } from "../../career/business/data/business.js";
import { federalTax } from "../../../core/math/tax.js";

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
 * not add up to 100% are scaled so they do; until all three are typed, the rule.
 */
export function targetsFor(s = {}) {
  if (s.preset && PRESETS[s.preset]) return { ...PRESETS[s.preset], from: s.preset };
  const typed = ["needs", "wants", "savings"].map((k) => num(s[k]));
  const own = typed.map((v) => Math.max(0, v ?? 0));
  const sum = own.reduce((a, b) => a + b, 0);
  if (s.preset === "own" && typed.every((v) => v !== null) && sum > 0) return { needs: own[0] / sum, wants: own[1] / sum, savings: own[2] / sum, from: "own", scaled: Math.abs(sum - 1) > 1e-6 };
  return { ...RULE, from: "50-30-20" };
}

/**
 * The year's taxes on the Income page's money only (not one-off sales or amounts typed on the Federal tax page): federal
 * income tax after credits (negative when the refundable child tax credit is more than the tax), Social Security and
 * Medicare on each earner's pay (less the pre-tax benefits the Paycheck page takes out) to the wage base, self-employment
 * tax on each owner's business profit after the Self-employment page's expenses, the 0.9% extra Medicare tax on pay and
 * self-employment earnings above the line, and the state's share. -> { gross, federal, ss, medicare, se, extraMedicare,
 * payroll, state, stateKnown, afterTax, business: { gross, expenses, profit }, agi, otherIncomeOnFederal } (all a year)
 */
export function yearTaxes(plan, { today, inc = computeIncome(plan, { today }) }) {
  const ti = taxInputs(plan, { today });
  const year = ti.year, status = ti.filingStatus;
  const wageBase = maximumEarnings(year);
  const people = plan.household?.people ?? [];
  const known = new Set(people.map((p) => p.id));
  const self = people.find((p) => p.role === "self")?.id ?? people.find((p) => p.role !== "dependent")?.id ?? "";
  const taxed = inc.active.filter((x) => x.taxable !== false);
  const sum = (...types) => taxed.filter((x) => types.includes(x.type)).reduce((t, x) => t + x.yearly, 0);

  // each earner's pay for Social Security and Medicare; pay linked to no one counts as its own earner (its employer
  // withholds to the wage base); the Paycheck page's pre-tax benefits (HSA, FSA, commuter, health) come off first
  const earners = new Map();
  for (const x of taxed.filter((y) => y.type === "salary" || y.type === "bonus")) {
    const id = known.has(x.personId) ? x.personId : `item:${x.id}`;
    earners.set(id, (earners.get(id) ?? 0) + x.yearly);
  }
  const pc = computePaycheck(plan, { today });
  for (const p of pc.ready ? pc.people : []) if (earners.has(p.id)) earners.set(p.id, Math.max(0, earners.get(p.id) - Math.max(0, p.gross - p.wages.fica) * p.paychecks));
  let ss = 0, medicare = 0, ficaWages = 0;
  for (const w of earners.values()) { ss += FICA.ss * Math.min(w, wageBase); medicare += FICA.medicare * w; ficaWages += w; }

  // the business: profit after the Self-employment page's expenses (shared by gross, as that page does); an owner's
  // self-employment tax after their own pay (the wage base is shared); business with no one is the first adult's
  const biz = taxed.filter((x) => x.type === "business");
  const bizGross = biz.reduce((t, x) => t + x.yearly, 0);
  const bizExpenses = biz.length ? pos(plan.whatIfs?.selfEmployment?.expenses) : 0;
  const owners = new Map();
  for (const x of biz) { const id = known.has(x.personId) ? x.personId : self; owners.set(id, (owners.get(id) ?? 0) + x.yearly); }
  let profit = 0, se = 0, seHalf = 0, seBase = 0;
  for (const [id, g] of owners) {
    const net = Math.max(0, g - (bizGross > 0 ? bizExpenses * g / bizGross : 0));
    const t = seTax(net, { wages: earners.get(id) ?? 0, wageBase });
    profit += net; se += t.total; seHalf += t.half; seBase += t.base;
  }
  // the 0.9% on pay plus self-employment earnings above the filing status's line (Form 8959 Parts I and II)
  const th = ti.params.additionalMedicareThreshold?.[status] ?? 200000;
  const extraMedicare = SE.addlMedicare * Math.max(0, ficaWages + seBase - th);

  // federal income tax: the Federal estimate's household (filing status, people, deductions, contributions) with the
  // Income page's income; half the self-employment tax off income, the 20% business deduction after AGI
  const qbiBase = Math.max(0, profit - seHalf);
  const M = forYear(QBI_MINIMUM, year);
  const r = federalTax({
    ...ti.inputs,
    wages: Math.max(0, sum("salary", "bonus") - ti.pretax401k), medicareWages: ficaWages,
    otherOrdinary: sum("rental", "pension", "investment", "other") + profit, qualifiedIncome: 0, capitalLoss: 0,
    socialSecurity: sum("social"), investmentIncome: sum("investment"),
    selfEmployment: profit - seHalf, adjustments: (Number(ti.inputs.adjustments) || 0) + seHalf,
    qbiDeduction: QBI.rate * qbiBase, qbiMinimum: qbiBase >= M.from ? M.amount : 0,
  }, ti.params);
  const federal = r.totalTax - r.additionalMedicare;

  // the state: the State page's tax as a share of its income, on this income (as the Paycheck page does)
  const st = computeState(plan, { today });
  const rate = st.method === "none" ? 0 : st.rate === null || st.rate === undefined ? null : st.agi > 0 ? Math.max(0, st.tax) / st.agi : st.rate;
  const state = rate === null ? 0 : rate * Math.max(0, r.agi);
  const gross = inc.yearly - bizExpenses;
  const payroll = ss + medicare + se + extraMedicare;
  const otherIncomeOnFederal = ti.sources.some((x) => ["shortGains", "longGains", "loss"].includes(x.key) || (x.from === "typed" && ["wages", "otherTyped", "qualified", "social"].includes(x.key)));
  return { year, gross, federal, ss, medicare, se, extraMedicare, payroll, state, stateKnown: rate !== null, afterTax: gross - federal - payroll - state, business: { gross: bizGross, expenses: bizExpenses, profit }, agi: r.agi, otherIncomeOnFederal };
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, year, month: { gross, federal (negative: a credit), payroll, state, stateKnown, afterTax, bizExpenses },
 *   targets: { needs, wants, savings, from, scaled },
 *   buckets: [{ key, label, monthly, share, target, targetMonthly, gap (monthly - target amount), status: "over"|"under"|"on"|null }],
 *   needs: [{ id (null for the Debts page's payments), name, category, monthly }], wants: [...],
 *   saving: { retirement, goals, leftover, short (spending above income), unlisted (left over above 10% of income after tax) },
 *   taxesListed (a month, on Expenses, left out), notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const inc = computeIncome(plan, { today }), exp = computeExpenses(plan, { today });
  // the month's spending: Expenses' items going now, and the Debts page's payments when Expenses has none of its own;
  // taxes listed there are left out, as they come off income already
  const going = exp.items.filter((x) => x.active && x.monthly > 0);
  const items = going.filter((x) => x.category !== "taxes");
  const taxesListed = going.filter((x) => x.category === "taxes").reduce((t, x) => t + x.monthly, 0);
  const fromDebts = pos(exp.debtFromDebts);
  const missing = [];
  if (!inc.count || !(inc.monthly > 0)) missing.push("income");
  if (!items.length && !(fromDebts > 0)) missing.push("expenses");
  if (missing.length) return { ready: false, missing };
  const notes = [];

  const T = yearTaxes(plan, { today, inc });
  const year = T.year;
  if (!T.stateKnown) notes.push("Your state's income tax is not taken off: set it on the State page under Taxes.");
  if (T.otherIncomeOnFederal) notes.push("The Federal tax page also counts income that is not on the Income page (investments sold, amounts typed there). Its tax is left out here, as that money is not part of the month.");
  const month = { gross: T.gross / 12, federal: T.federal / 12, payroll: T.payroll / 12, state: T.state / 12, stateKnown: T.stateKnown, bizExpenses: T.business.expenses / 12 };
  month.afterTax = T.afterTax / 12;

  // needs: the bills marked "I must pay this" on Expenses (and the Debts page's payments); wants: the rest; savings: what
  // goes to retirement accounts (your own money, not the employer's), to goals each month, and what is left over
  const row = (x) => ({ id: x.id, name: x.name || x.categoryLabel, category: x.categoryLabel, monthly: x.monthly });
  const needs = items.filter((x) => x.essential).map(row);
  if (fromDebts > 0) needs.push({ id: null, name: "Loan and card payments (from Debts)", category: "Loan and card payments", monthly: fromDebts });
  needs.sort((a, b) => b.monthly - a.monthly);
  const wants = items.filter((x) => !x.essential).map(row).sort((a, b) => b.monthly - a.monthly);
  const needsMonthly = needs.reduce((t, x) => t + x.monthly, 0), wantsMonthly = wants.reduce((t, x) => t + x.monthly, 0);
  const con = computeContributions(plan, { today });
  const gl = computeGoals(plan, { today });
  const retirement = con.yearly / 12;
  const goals = (gl.goals ?? []).filter((g) => g.status !== "done").reduce((t, g) => t + pos(g.monthly), 0);
  const rest = month.afterTax - needsMonthly - wantsMonthly - retirement - goals;
  const saving = { retirement, goals, leftover: Math.max(0, rest), short: Math.max(0, -rest) };
  const savingsMonthly = retirement + goals + saving.leftover;
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
  if (!(A > 0)) notes.push("Taxes (and business expenses) take all of the income on the Income page, so there is nothing to split: check the amounts there.");
  if (!items.some((x) => x.essential) && wants.length) notes.push("No expense is marked \"I must pay this\" yet, so everything counts as a want: mark the bills you must pay below or on the Expenses page.");
  return { ready: true, missing: [], year, month, targets, buckets, needs, wants, saving: { ...saving, unlisted }, taxesListed, notes };
}
