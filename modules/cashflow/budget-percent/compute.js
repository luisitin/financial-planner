// modules/cashflow/budget-percent/compute.js -- PURE. The 50/30/20 rule (or the household's own split) on income after
// tax: what goes to needs (the bills you must pay), wants (the rest of the spending) and savings (retirement, goals and
// what is left over), each against its target share, with the largest items in each and how far each is off.
import { compute as computeIncome, countedOn, rentAfterCostsOf } from "../income/compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { compute as computePaycheck, PAYROLL } from "../paycheck/compute.js";
import { taxInputs, withReturns } from "../../taxes/federal/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { seTax, SE, QBI } from "../../taxes/self-employment/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { QBI_MINIMUM, forYear } from "../../career/business/data/business.js";
import { savedPlan } from "../../debt/payoff/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { rentalStep, iraStep, loanStep, qbiStep } from "../../taxes/federal/known.js";

/** The rule's split of income after tax (Elizabeth Warren and Amelia Warren Tyagi, "All Your Worth", 2005): needs 50%, wants 30%, savings 20%. */
export const RULE = { needs: 0.5, wants: 0.3, savings: 0.2 };
/** The app's own example splits for when costs are high or money is tight (not from the book). */
export const PRESETS = { "50-30-20": RULE, "60-20-20": { needs: 0.6, wants: 0.2, savings: 0.2 }, "70-20-10": { needs: 0.7, wants: 0.2, savings: 0.1 } };
/** An employee's Social Security and Medicare (IRC 3101), the Paycheck page's rates. */
export const FICA = { ss: PAYROLL.ss, medicare: PAYROLL.medicare };
/** Where the 0.9% extra Medicare tax starts, by filing status (IRC 3101(b)(2)): a fallback when the year's tax figures lack it. */
const EXTRA_MEDICARE_LINE = { married_joint: 250000, married_separate: 125000, other: 200000 };
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
 * self-employment earnings above the line (each return's own, filing separately), and the state's share; and the child
 * care account's money that would be lost (`careLost`: no care to pay back), which never reaches the bank. -> { gross,
 * federal, ss, medicare, se, extraMedicare, payroll, state, stateKnown, careLost, rentCosts (a rental's running costs a year, not in afterTax), afterTax, business: { gross, expenses,
 * profit }, agi, otherIncomeOnFederal } (all a year)
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
  const owners0 = new Map();
  for (const x of biz) { const id = known.has(x.personId) ? x.personId : self; owners0.set(id, (owners0.get(id) ?? 0) + x.yearly); }
  let profit = 0, se = 0, seHalf = 0, seBase = 0;
  for (const [id, g] of owners0) {
    const net = Math.max(0, g - (bizGross > 0 ? bizExpenses * g / bizGross : 0));
    const t = seTax(net, { wages: earners.get(id) ?? 0, wageBase });
    profit += net; se += t.total; seHalf += t.half; seBase += t.base;
  }
  // the 0.9% on pay plus self-employment earnings above the filing status's line (Form 8959 Parts I and II); filing
  // separately, each return's own (the line is each return's, 125,000: care fourth pass, 2026-11-02)
  const th = ti.params.additionalMedicareThreshold?.[status] ?? EXTRA_MEDICARE_LINE[status] ?? EXTRA_MEDICARE_LINE.other;
  const parts = status === "married_separate" && Array.isArray(ti.inputs.separate) && ti.inputs.separate.length ? ti.inputs.separate : null;
  // an earner or owner on no return of their own (pay linked to no one) is on the adult marked "Me"'s, as the Federal estimate has it
  const meAt = parts ? Math.max(0, parts.findIndex((x) => x.personId != null && x.personId === ti.inputs.separateTo)) : 0;
  const returnOf = (id) => (parts ? (parts.findIndex((x) => x.personId === id) >= 0 ? parts.findIndex((x) => x.personId === id) : meAt) : 0);
  const byReturn = (parts ?? [null]).map(() => ({ fica: 0, seBase: 0, profit: 0, half: 0 }));
  for (const [id, w] of earners) byReturn[returnOf(id)].fica += w;
  for (const [id, g] of owners0) {
    const net = Math.max(0, g - (bizGross > 0 ? bizExpenses * g / bizGross : 0));
    const t = seTax(net, { wages: earners.get(id) ?? 0, wageBase });
    const R = byReturn[returnOf(id)]; R.seBase += t.base; R.profit += net; R.half += t.half;
  }
  const extraMedicare = byReturn.reduce((t, R) => t + SE.addlMedicare * Math.max(0, R.fica + R.seBase - th), 0);

  // federal income tax: the Federal estimate's household (filing status, people, deductions, contributions) with the
  // Income page's income; half the self-employment tax off income, the 20% business deduction after AGI. The wages are the
  // Federal estimate's own from the Income page (`wagesPlan`: pay less pre-tax 401(k) money, the health FSA and the child
  // care account by its one rule), never rebuilt here, so the account is not taxed as pay and does not cancel the credit
  // twice (review 2026-11-02: Budget said 1,988 a year where the Federal estimate said 1,388)
  const qbiBase = Math.max(0, profit - seHalf);
  const M = forYear(QBI_MINIMUM, year);
  // filing separately: two returns, each with its own Income-page money (the Federal estimate's part `fromIncome`) and its
  // owner's business, half its self-employment tax and its 20% deduction (IRS Pub. 501; IRC 164(f), 199A), not the
  // household's on the return of the adult marked "Me" (care fourth pass: the family with 3,750 each paid 14,439.15 here,
  // 14,282.30 by the law)
  const inputs = parts ? withReturns(ti.inputs, parts.map((x, i) => {
    const F = x.fromIncome ?? {}, R = byReturn[i], qb = Math.max(0, R.profit - R.half);
    return {
      ...x, wages: F.wages ?? x.wages, medicareWages: R.fica, otherOrdinary: (F.otherOrdinary ?? 0) + R.profit, qualifiedIncome: 0, capitalLoss: 0,
      socialSecurity: F.socialSecurity ?? 0, investmentIncome: F.investmentIncome ?? 0, selfEmployment: R.profit - R.half,
      adjustments: (Number(x.adjustments) || 0) + R.half, qbiDeduction: QBI.rate * qb, qbiMinimum: qb >= M.from ? M.amount : 0,
    };
  })) : {
    ...ti.inputs,
    wages: ti.wagesPlan, medicareWages: ficaWages,
    otherOrdinary: sum("rental", "pension", "investment", "other") + profit, qualifiedIncome: 0, capitalLoss: 0,
    socialSecurity: sum("social"), investmentIncome: sum("investment"),
    selfEmployment: profit - seHalf, adjustments: (Number(ti.inputs.adjustments) || 0) + seHalf,
    qbiDeduction: QBI.rate * qbiBase, qbiMinimum: qbiBase >= M.from ? M.amount : 0,
  };
  // what the Federal estimate knows about this money (taxes/federal known.js), so the month's tax is that page's on the same
  // income (round 8 review: the landlord's month took 1,640 of federal tax where the Federal estimate's year is 14,108): the
  // Income page's rent for a property on Rental analysis counted after its costs, interest and depreciation (rentalStep), the
  // traditional IRA deduction as the income limits allow it (iraStep), student loan interest (loanStep), and the 20% business
  // deduction cut by its income limits (qbiStep). This year's IRA withdrawals and stock pay are left out: they are not in the
  // month's money (the tax on a withdrawal is held back from it; the tax on stock is held back in shares).
  const owners = [...owners0.entries()].map(([id, g]) => {
    const net = Math.max(0, g - (bizGross > 0 ? bizExpenses * g / bizGross : 0));
    const t = seTax(net, { wages: earners.get(id) ?? 0, wageBase }), qb = Math.max(0, net - t.half);
    return { personId: id, tentative: QBI.rate * qb, qbiMinimum: qb >= M.from ? M.amount : 0 };
  });
  const sepHalves = parts ? parts.map((x, i) => ({ personId: x.personId, half: byReturn[i].half })) : null;
  const ctx = { plan, fed: ti, inputs, params: { today }, out: { se: owners.length ? { owners, half: seHalf, returns: sepHalves } : null } };
  for (const step of [rentalStep, iraStep, loanStep, qbiStep]) {
    let res = null;
    try { res = step(ctx); } catch { res = null; }
    if (res?.inputs) ctx.inputs = res.inputs;
  }
  const r = federalTax(ctx.inputs, ti.params);
  const federal = r.totalTax - r.additionalMedicare;

  // the state: the State page's tax as a share of its income, on this income (as the Paycheck page does)
  const st = computeState(plan, { today });
  const rate = st.method === "none" ? 0 : st.rate === null || st.rate === undefined ? null : st.agi > 0 ? Math.max(0, st.tax) / st.agi : st.rate;
  const state = rate === null ? 0 : rate * Math.max(0, r.agi);
  const gross = inc.yearly - bizExpenses;
  const payroll = ss + medicare + se + extraMedicare;
  const otherIncomeOnFederal = ti.sources.some((x) => ["shortGains", "longGains", "loss"].includes(x.key) || (x.from === "typed" && ["wages", "otherTyped", "qualified", "social"].includes(x.key)));
  // the child care account's money it would lose (elected beyond the care it pays back: Form 2441 line 14) leaves the pay and
  // never comes back, so it comes off the month like a tax (care fourth pass: Jo with a 5,000 account and no care had 93 a
  // month MORE spare; she has 323 less). The care it does pay back is on Expenses already.
  const careLost = ti.care?.account?.forfeited ?? 0;
  // a rental's running costs (property tax, insurance, dues, upkeep, empty months): cash out of the month that no Expenses row holds, since a
  // rental is entered once (Rental analysis). The Income page shows each rent line after them (rentAfterCostsOf); the month takes the
  // same, so Income, Next best action, the Dashboard, Expenses and this page say one figure (follow-up 2026-11-07). The rent stays
  // whole in `gross` (the tax reads it); the loan payment is a Debts payment in the spending already.
  let rentCosts = 0;
  try { for (const r of rentAfterCostsOf(plan, { today }).values()) if (r.afterCosts !== null) rentCosts += Math.max(0, r.monthly - r.afterCosts) * 12; } catch { rentCosts = 0; }
  return { year, gross, federal, ss, medicare, se, extraMedicare, payroll, state, stateKnown: rate !== null, careLost, rentCosts, afterTax: gross - federal - payroll - state - careLost, business: { gross: bizGross, expenses: bizExpenses, profit }, agi: r.agi, otherIncomeOnFederal };
}

/**
 * A figure said with "about", to the nearest $10: what a month that brings the Income page's amount leaves (here
 * `saving.fullAbout`, Next best action's `spare.fullAbout`), so every page says the one number (review 2026-11-02, round 5:
 * some said "$1,197", others "about $1,200").
 */
export const aboutTen = (n) => Math.round((Number(n) || 0) / 10) * 10 || 0;
/** Within this many dollars of $0, a full month "just about breaks even" (no page says "about $0"). My choice. */
export const EVEN_WITHIN = 5;
/**
 * fullKind(full) -> "ahead" | "even" | "short": what a month that brings the Income page's amount does, as every page says
 * it (`saving.fullKind` here, Next best action's `spare.fullKind`). "ahead": it leaves $5 or more, so the month is short
 * only in a lean month and good months make up for it; "even": within $5 of $0, said "just about breaks even" instead of
 * "leaves about $0" or "about $0 short", and, as good months then do not make up for lean ones, counted with "short"; "short":
 * it is still about $X short (review 2026-11-02, round 5).
 */
export const fullKind = (full) => { const n = Number(full) || 0; return Math.abs(n) < EVEN_WITHIN ? "even" : n > 0 ? "ahead" : "short"; };

/**
 * The careful month's part held back (Side income's "count on", income[].countOn): uneven pay the plan does not count on,
 * a month, and that less the tax on it. The tax on it is the year's taxes (yearTaxes) less the same taxes worked again
 * with each counted-on line at its careful figure a month, over 12. Next best action's spare and this page both take
 * `held` off the month, so they leave the same money (review 2026-11-02). -> { gross (income's heldMonthly), tax, held }
 * (all a month); without the year's taxes `T`, or when they cannot be worked again, nothing is taken off for tax.
 */
export function heldAfterTax(plan, { today, inc = computeIncome(plan, { today }), T = null } = {}) {
  const gross = inc.heldMonthly ?? 0;
  if (!(gross > 0.005) || !T) return { gross, tax: 0, held: gross };
  try {
    const careful = { ...plan, income: (plan.income ?? []).map((x) => (countedOn(x) !== null ? { ...x, amount: countedOn(x), period: "monthly" } : x)) };
    const TC = yearTaxes(careful, { today, inc: computeIncome(careful, { today }) });
    const tax = Math.max(0, ((T.federal + T.payroll + T.state) - (TC.federal + TC.payroll + TC.state)) / 12);
    return { gross, tax, held: Math.max(0, gross - tax) };
  } catch { return { gross, tax: 0, held: gross }; }
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, year, month: { gross, federal (negative: a credit), payroll, state, stateKnown, afterTax (the careful month: less `held`), bizExpenses,
 *     held, heldGross (heldAfterTax: side income above what you count on, after its tax, and before it) },
 *   targets: { needs, wants, savings, from, scaled },
 *   buckets: [{ key, label, monthly, share, target, targetMonthly, gap (monthly - target amount), status: "over"|"under"|"on"|null }],
 *   needs: [{ id (null for the Debts page's payments), name, category, monthly }], wants: [...],
 *   saving: { retirement, goals, debts (extra on debts: set on each debt, and the saved debt plan's extra), debtPlan (that
 *     saved extra: Pay off debts' savedPlan, the one Next best action takes), leftover, short (spending above income),
 *     unlisted (left over above 10% of income after tax),
 *     full (leftover - short + month.held: what a month that brings the Income page's amount leaves), fullAbout (to the nearest $10),
 *     fullKind ("ahead" | "even" | "short", fullKind) },
 *   taxesListed (a month, on Expenses, left out), notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const inc = computeIncome(plan, { today }), exp = computeExpenses(plan, { today });
  // the month's spending: Expenses' items going now, and the Debts page's payments Expenses has no expense for;
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
  const month = { gross: T.gross / 12, federal: T.federal / 12, payroll: T.payroll / 12, state: T.state / 12, stateKnown: T.stateKnown, bizExpenses: T.business.expenses / 12, careLost: (T.careLost ?? 0) / 12 };
  // the careful month, as the app's left-over figure (Next best action) has it: side income above what you count on is
  // not planned with, and neither is the tax on it; the taxes stay the whole year's (review 2026-11-02)
  const H = heldAfterTax(plan, { today, inc, T });
  month.held = H.held; month.heldGross = H.gross;
  month.rentCosts = (T.rentCosts ?? 0) / 12;
  month.afterTax = T.afterTax / 12 - month.held - month.rentCosts;

  // needs: the bills marked "I must pay this" on Expenses (and the Debts page's payments); wants: the rest; savings: what
  // goes to retirement accounts (your own money, not the employer's), to goals each month, and what is left over
  const row = (x) => ({ id: x.id, name: x.name || x.categoryLabel, category: x.categoryLabel, monthly: x.monthly });
  const needs = items.filter((x) => x.essential).map(row);
  // each debt Expenses found no expense for, by name (one line for all when filed payments cover part of them): its
  // required payment is a need; an extra set on Debts pays the debt down faster, so it is saving, as 50/30/20 counts it
  const debtRequired = Math.min(fromDebts, pos(exp.debtRequired ?? fromDebts));
  if (fromDebts > 0) {
    if ((exp.fromDebts ?? []).length) for (const x of exp.fromDebts) needs.push({ id: null, name: `${x.name} payment (from Debts)`, category: "Loan and card payments", monthly: x.required ?? x.monthly });
    else if (debtRequired > 0) needs.push({ id: null, name: "Loan and card payments (from Debts)", category: "Loan and card payments", monthly: debtRequired });
  }
  // the saved debt plan's extra a month (Pay off debts, `debtPlan.extra`) pays debts down faster too: saving, and money
  // already spoken for, read with the helper Next best action uses, so the left over and the full month here are the
  // app's figures (review 2026-11-02, round 5: with a $150 extra this page said "about $1,200", every other "about $1,050")
  const debtPlan = savedPlan(plan, { today })?.extra ?? 0;
  const debts = Math.max(0, fromDebts - debtRequired) + debtPlan;
  needs.sort((a, b) => b.monthly - a.monthly);
  const wants = items.filter((x) => !x.essential).map(row).sort((a, b) => b.monthly - a.monthly);
  const needsMonthly = needs.reduce((t, x) => t + x.monthly, 0), wantsMonthly = wants.reduce((t, x) => t + x.monthly, 0);
  const con = computeContributions(plan, { today });
  const gl = computeGoals(plan, { today });
  const retirement = con.yearly / 12;
  const goals = (gl.goals ?? []).filter((g) => g.status !== "done").reduce((t, g) => t + pos(g.monthly), 0);
  const rest = month.afterTax - needsMonthly - wantsMonthly - retirement - goals - debts;
  const saving = { retirement, goals, debts, debtPlan, leftover: Math.max(0, rest), short: Math.max(0, -rest), full: rest + month.held, fullAbout: aboutTen(rest + month.held), fullKind: fullKind(rest + month.held) };
  const savingsMonthly = retirement + goals + debts + saving.leftover;
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
