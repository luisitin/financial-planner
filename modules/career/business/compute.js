// modules/career/business/compute.js -- PURE. A small business from its owner's side: revenue less expenses (typed by
// kind, the home office and business miles) is the profit and the margin; the tax it brings as a sole proprietor
// (self-employment tax, income tax with half of it off and the 20% business deduction after it, the extra Medicare tax,
// the state's rate) against an S corporation paying the owner a reasonable salary; what the owner can safely take out
// each month; and the self-employed retirement plans (SEP-IRA, solo 401(k), SIMPLE IRA) with the tax each would save.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { compute as computeSelfEmployment, seTax, SE, QBI, TOTAL_ADDITIONS } from "../../taxes/self-employment/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { LIMITS } from "../../retirement/contributions/data/limits.js";
import { federalTax } from "../../../core/math/tax.js";
import { perYear } from "../../../core/math/periods.js";
import { daysBetween } from "../../../core/math/dates.js";
import { rulesFor } from "../side-income/data/rules.js";
import { HOME_OFFICE, SIMPLE, QBI_LINE, QBI_MINIMUM, SIMPLE_DEADLINE, SCORP_COSTS_EXAMPLE, forYear } from "./data/business.js";

export const PAYROLL = { ss: 0.062, medicare: 0.0145 };
export const CATEGORIES = { supplies: "Supplies and materials", software: "Software and subscriptions", phone: "Phone and internet", marketing: "Advertising", travel: "Travel (fares, hotels)", meals: "Business meals", equipment: "Equipment", insurance: "Business insurance", contractors: "Help you paid", fees: "Fees and licences", other: "Other" };
/** The share of a kind of expense the tax law lets you deduct: business meals half (IRC 274(n)(1)); everything else in full. */
export const DEDUCTIBLE = { meals: 0.5 };

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const pos = (v) => Math.max(0, num(v) ?? 0);

/** The home office, simplified: $5 a square foot used regularly and only for the business, at most 300 square feet, at most the profit before it. */
export const homeOffice = (sqft, profitBefore = Infinity) => Math.max(0, Math.min(Math.min(pos(sqft), HOME_OFFICE.maxSqft) * HOME_OFFICE.perSqft, Math.max(0, profitBefore)));

/** The business mileage rate for a whole year, in dollars a mile: each rate the IRS set that year weighted by the days it was in force (miles taken as spread evenly). */
export function mileageYear(year) {
  const steps = rulesFor(year).mileage.filter((m) => Number(m.from.slice(0, 4)) === year);
  if (!steps.length) return rulesFor(year).mileage.at(-1).cents / 100;
  const end = `${year + 1}-01-01`, days = daysBetween(`${year}-01-01`, end);
  // before the first step of the year (none in practice): the first rate
  return steps.reduce((t, m, i) => t + (m.cents / 100) * daysBetween(i === 0 ? `${year}-01-01` : m.from, steps[i + 1]?.from ?? end), 0) / days;
}

/** The SIMPLE IRA catch-up for an age at the end of the year: none under 50, the 60-to-63 amount, else the usual one. */
const catchFor = (age, L) => (age === null || age < (L.catchUpAge ?? 50) ? 0 : L.superCatchUp && age >= L.superCatchUp.from && age <= L.superCatchUp.to ? L.superCatchUp.amount : L.catchUp);

/**
 * The household's federal tax with the business's profit as a sole proprietor, and what it adds: self-employment tax on
 * 92.35% of profit (Social Security to the wage base after the owner's wages, Medicare); half of it, the self-employed
 * health insurance (up to the profit less half the tax and the retirement contribution, IRC 162(l)) and the retirement
 * contribution (`retirement`) come off income; the 20% business deduction on profit less those, taken after AGI (the
 * federal engine limits it to 20% of taxable income less net capital gain), at least $400 from 2026 when that profit is
 * $1,000 or more (IRC 199A(i)); a loss comes off other income; the 0.9% extra Medicare tax on wages + earnings above
 * the line. `inputs` is the household without this business; `otherSE` its other self-employment earnings (for the
 * refundable child tax credit's earned income).
 */
export function soleTax(profit, { inputs, params, otherOrdinary = inputs.otherOrdinary, otherSE = 0, wages = 0, medicareWages = 0, wageBase, health = 0, retirement = 0, qbiMinimum = null }) {
  const P = Number(profit) || 0;
  const se = seTax(Math.max(0, P), { wages, wageBase });
  const healthOff = Math.min(pos(health), Math.max(0, P - se.half - retirement));
  const adj = (Number(inputs.adjustments) || 0) + se.half + healthOff + retirement + Math.max(0, -P);
  const qbiBase = Math.max(0, P - se.half - healthOff - retirement);
  const M = qbiMinimum ?? { amount: 0, from: Infinity };
  const r = federalTax({
    ...inputs, otherOrdinary: Math.max(0, (Number(otherOrdinary) || 0) + Math.max(0, P)), adjustments: adj,
    selfEmployment: Math.max(0, otherSE + P - se.half),
    qbiDeduction: QBI.rate * qbiBase, qbiMinimum: qbiBase >= M.from ? M.amount : 0,
  }, params);
  const th = params.additionalMedicareThreshold?.[inputs.filingStatus] ?? 200000;
  const extra = SE.addlMedicare * (Math.max(0, medicareWages + se.base - th) - Math.max(0, medicareWages - th));
  return { se, healthOff, qbi: r.deduction.qbi, income: r.totalTax - r.additionalMedicare, extra, taxable: r.taxableIncome + r.deduction.qbi };
}
/**
 * The same profit through an S corporation paying the owner `salary`: the corporation pays the employer's Social
 * Security and Medicare on it, `costs` a year and the owner's health insurance (in the owner's pay for income tax, not
 * for Social Security and Medicare, and taken off again as self-employed health insurance up to the salary, the
 * owner's Medicare wages from it: Notice 2008-1, IRC 162(l)(2)(A)); the owner
 * pays the employee's share and income tax on the salary plus what is left (passed through, no self-employment tax),
 * with the 20% deduction on what is left; a loss passed through comes off other income.
 */
export function scorpTax(profit, salary, costs, { inputs, params, otherOrdinary = inputs.otherOrdinary, otherSE = 0, wages = 0, medicareWages = 0, wageBase, health = 0, retirement = 0, qbiMinimum = null }) {
  const W = Math.max(0, Math.min(salary, profit));
  const ssRoom = Math.max(0, wageBase - wages);
  const employer = Math.min(W, wageBase) * PAYROLL.ss + W * PAYROLL.medicare;   // each employer pays to the full wage base
  const premiums = pos(health), healthOff = Math.min(premiums, W);
  const passed = profit - W - employer - costs - premiums;
  const adj = (Number(inputs.adjustments) || 0) + healthOff + retirement + Math.max(0, -passed);
  const qbiBase = Math.max(0, passed);
  const M = qbiMinimum ?? { amount: 0, from: Infinity };
  const r = federalTax({
    ...inputs, wages: (Number(inputs.wages) || 0) + W + premiums, otherOrdinary: Math.max(0, (Number(otherOrdinary) || 0) + qbiBase), adjustments: adj,
    selfEmployment: otherSE, qbiDeduction: QBI.rate * qbiBase, qbiMinimum: qbiBase >= M.from ? M.amount : 0,
  }, params);
  // the owner's share: Social Security only to the wage base after other wages (the excess comes back on the return), Medicare, the 0.9%
  const th = params.additionalMedicareThreshold?.[inputs.filingStatus] ?? 200000;
  const extra = SE.addlMedicare * (Math.max(0, medicareWages + W - th) - Math.max(0, medicareWages - th));
  const employee = Math.min(W, ssRoom) * PAYROLL.ss + W * PAYROLL.medicare + extra;
  return { salary: W, employer, employee, passed, premiums, healthOff, qbi: r.deduction.qbi, income: r.totalTax - r.additionalMedicare, costs };
}

/**
 * compute(plan, { today }) -> {
 *   ready, year, incomeId, name, person, revenue, revenueFrom ("typed"|"income"), expenses: [{ id, name, category, label, yearly, deductible }],
 *   typedTotal (spent), notDeducted, homeOffice, miles: { miles, rate, amount }, expensesTotal (deducted), profit, loss, margin, breakEvenMonthly,
 *   tax: { se, qbi, income, extra, state, total, rate, health } (sole proprietor), keepMonthly, drawMonthly, draw ("ok"|"over"|null),
 *   scorp: { salary, salaryFrom, costs, costsFrom, employer, employee, passed, qbi, income, federal (what it adds), state, total (taxes), saving } | null,
 *   plans: [{ key, label, room, saved, late }], best (the key with the most room, or null on a tie), earned, simpleComp, simpleLate, simpleLimit,
 *   job401k: { used, limit } | null, qbiLimited, qbiLine, stateRate, notes, seExpenses, typedHere, singleBusiness
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const s = plan.whatIfs?.business ?? {};
  const inc = computeIncome(plan, { today });
  const biz = inc.active.filter((x) => x.type === "business" && x.period !== "once");
  const item = biz.find((x) => x.id === s.incomeId) ?? [...biz].sort((a, b) => b.yearly - a.yearly)[0] ?? null;
  const typedRevenue = num(s.revenue);
  // expenses typed here, else the one figure typed on the Self-employment page (so the two pages agree)
  const seExpenses = pos(plan.whatIfs?.selfEmployment?.expenses);
  const typed = (s.expenses ?? []).map((e) => {
    const category = CATEGORIES[e.category] ? e.category : "other";
    const yearly = perYear(pos(e.amount), e.period ?? "monthly");
    return { id: e.id, name: e.name || CATEGORIES[category], category, label: CATEGORIES[category], yearly, deductible: yearly * (DEDUCTIBLE[category] ?? 1) };
  });
  const expenses = typed.length || !seExpenses ? typed : [{ id: null, name: "Expenses from the Self-employment page", category: "other", label: "typed there as one figure", yearly: seExpenses, deductible: seExpenses, fromSelfEmployment: true }];
  const typedTotal = expenses.reduce((t, e) => t + e.yearly, 0);
  if (!item && typedRevenue === null) return { ready: false, year: Number(today.slice(0, 4)), expenses, typedTotal };

  const ti = taxInputs(plan, { today });
  const year = ti.year;   // every figure from the tax year the Federal tax page works on
  const people = plan.household?.people ?? [];
  const person = people.find((p) => p.id === item?.personId) ?? people.find((p) => p.role === "self") ?? null;
  const notes = [];
  const revenue = typedRevenue ?? item.yearly;
  const deductibleTotal = expenses.reduce((t, e) => t + e.deductible, 0);
  const notDeducted = typedTotal - deductibleTotal;
  const rate = mileageYear(year);
  const miles = { miles: pos(s.miles), rate, amount: pos(s.miles) * rate };
  const office = homeOffice(s.homeOfficeSqft, revenue - deductibleTotal - miles.amount);
  const expensesTotal = deductibleTotal + miles.amount + office;
  const profit = revenue - expensesTotal;
  if (!expenses.length && !miles.amount && !office) notes.push("No expenses typed yet: the profit below is all of the revenue.");

  // the tax, as a sole proprietor: the household's tax without this business, then with its profit
  const st = computeState(plan, { today });
  const stateRate = st.rate ?? 0;
  if (st.rate === null) notes.push("Your state's income tax is not counted: set its rate on the State tax page.");
  const wageBase = maximumEarnings(year);
  const ownerWages = inc.active.filter((x) => x.personId === (person?.id ?? "") && ["salary", "bonus"].includes(x.type) && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
  const medicareWages = Number(ti.inputs.medicareWages ?? ti.inputs.wages) || 0;
  const inputs = { ...ti.inputs, otherOrdinary: Math.max(0, (Number(ti.inputs.otherOrdinary) || 0) - (item ? item.yearly : 0)) };
  const otherSE = Math.max(0, (Number(ti.inputs.selfEmployment) || 0) - (item ? item.yearly : 0));
  const health = pos(s.healthPremiums);
  const T = { inputs, params: ti.params, otherSE, wages: ownerWages, medicareWages, wageBase, health, qbiMinimum: forYear(QBI_MINIMUM, year) };
  const none = federalTax({ ...inputs, selfEmployment: otherSE }, ti.params);
  const noneIncome = none.totalTax - none.additionalMedicare;
  const sole = soleTax(profit, T);
  const stateOf = (w, retirement = 0) => (Math.max(0, profit) - w.se.half - w.healthOff - retirement - Math.max(0, -profit)) * stateRate;   // a loss saves state tax too
  const stateSole = stateOf(sole);
  const soleTotal = sole.income - noneIncome + sole.se.total + sole.extra + stateSole;
  const tax = { se: sole.se.total, qbi: sole.qbi, income: sole.income - noneIncome, extra: sole.extra, state: stateSole, total: soleTotal, rate: profit > 0 ? soleTotal / profit : null, health: sole.healthOff };
  // what is left a month: the profit, less the half of meals the tax law does not count, less the tax
  const keepMonthly = (profit - notDeducted - soleTotal) / 12;
  const drawMonthly = num(s.drawMonthly);
  const draw = drawMonthly === null ? null : drawMonthly > keepMonthly + 0.5 ? "over" : "ok";

  // an S corporation: worth a look once profit is well above a reasonable salary
  let scorp = null;
  if (profit > 0) {
    const salary = num(s.salary) ?? Math.round(profit * 0.6 / 100) * 100;
    const costs = num(s.scorpCosts) ?? SCORP_COSTS_EXAMPLE;
    const c = scorpTax(profit, salary, costs, T);
    const stateC = (c.salary + c.premiums - c.healthOff + c.passed) * stateRate;   // a loss passed through comes off
    const total = c.income - noneIncome + c.employee + c.employer + stateC;
    scorp = { ...c, federal: c.income - noneIncome, salaryFrom: num(s.salary) === null ? "example" : "typed", costsFrom: num(s.scorpCosts) === null ? "example" : "typed", state: stateC, total, saving: soleTotal - (total + costs) };
  }

  // the retirement plans for the self-employed (IRS Publication 560)
  const se = computeSelfEmployment(plan, { today });
  const row = se.ready ? se.people.find((p) => p.id === (person?.id ?? se.people[0]?.id)) ?? se.people[0] : null;
  const earned = Math.max(0, profit - sole.se.half);
  const age = person?.birthDate ? year - Number(String(person.birthDate).slice(0, 4)) : null;   // catch-ups go by the age reached by December 31
  const L401 = forYear(LIMITS, year).kinds["401k"];
  const total415 = TOTAL_ADDITIONS[year] ?? (se.ready ? se.total415 : TOTAL_ADDITIONS[2026]);
  const deferralLeft = row ? row.deferralLeft : L401.limit;
  const sepRoom = Math.min(total415, 0.2 * earned);
  // solo 401(k): the employer's 20%, and the employee's deferral out of what is left of the earnings, together at most the
  // 415(c) limit; the catch-up from 50 sits on top of that limit, also out of the earnings left
  const soloEmployer = 0.2 * earned;
  const soloDeferral = Math.min(deferralLeft, Math.max(0, earned - soloEmployer));
  const soloBase = Math.min(total415, soloEmployer + soloDeferral);
  const soloRoom = soloBase + Math.min(catchFor(age, L401), Math.max(0, earned - soloBase));
  // SIMPLE IRA: pay = 92.35% of profit before any contribution (Schedule SE line 4); the deferral shares the yearly limit
  // on what a person puts in across plans (IRC 402(g)) with a 401(k) at a job; the match is dollar for dollar, up to 3% of pay
  const S = forYear(SIMPLE, year).small;
  const simpleComp = SE.base * Math.max(0, profit);
  const simpleCatch = catchFor(age, { catchUpAge: 50, catchUp: S.catchUp, superCatchUp: forYear(SIMPLE, year).superCatchUp });
  const simpleDeferral = Math.min(simpleComp, S.limit + simpleCatch, deferralLeft + simpleCatch);
  const simpleRoom = simpleDeferral + Math.min(simpleDeferral, forYear(SIMPLE, year).match * simpleComp);
  // a new SIMPLE IRA for a year must be set up by October 1 of it (a business that starts later: as soon as it can)
  const simpleLate = today > `${year}-${SIMPLE_DEADLINE}`;
  const savedBy = (room) => { if (!(room > 0)) return 0; const w = soleTax(profit, { ...T, retirement: room }); return soleTotal - (w.income - noneIncome + w.se.total + w.extra + stateOf(w, room)); };
  const plans = [
    { key: "sep", label: "SEP-IRA", room: sepRoom },
    { key: "solo", label: "Solo 401(k)", room: soloRoom },
    { key: "simple", label: "SIMPLE IRA", room: simpleRoom, late: simpleLate },
  ].map((p) => ({ ...p, saved: p.late ? 0 : savedBy(p.room) }));
  const open = plans.filter((p) => !p.late && p.room > 0.5).sort((a, b) => b.room - a.room);
  const best = open.length && (open.length === 1 || open[0].room > open[1].room + 0.5) ? open[0].key : null;
  const job401k = row && row.deferralLeft < L401.limit ? { used: L401.limit - row.deferralLeft, limit: L401.limit } : null;

  const Q = forYear(QBI_LINE, year);
  const line = Q[ti.filingStatus] ?? Q.single;
  const qbiLimited = sole.taxable > line;
  return {
    ready: true, year, incomeId: item?.id ?? null, name: s.name || item?.name || "Your business", person: person ? { id: person.id, name: person.name } : null,
    revenue, revenueFrom: typedRevenue !== null ? "typed" : "income", incomeYearly: item?.yearly ?? null, expenses, typedTotal, notDeducted, homeOffice: office, miles, expensesTotal,
    profit, loss: profit < 0, margin: revenue > 0 ? profit / revenue : null, breakEvenMonthly: (expensesTotal + notDeducted) / 12,
    tax, keepMonthly, drawMonthly, draw, scorp, plans, best, earned, simpleComp, simpleLate, simpleLimit: S.limit, job401k, qbiLimited, qbiLine: line, stateRate, notes,
    seExpenses, typedHere: typedRevenue !== null || typed.length > 0, singleBusiness: biz.length <= 1,
  };
}
