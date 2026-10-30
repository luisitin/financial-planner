// modules/career/business/compute.js -- PURE. A small business from its owner's side: revenue less expenses (typed by
// kind, the home office and business miles) is the profit and the margin; the tax it brings as a sole proprietor
// (self-employment tax, income tax with half of it and the 20% business deduction off, the extra Medicare tax, the
// state's rate) against an S corporation paying the owner a reasonable salary; what the owner can safely take out each
// month; and the self-employed retirement plans (SEP-IRA, solo 401(k), SIMPLE IRA) with the tax each would save.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { compute as computeSelfEmployment, seTax, SE, QBI } from "../../taxes/self-employment/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { LIMITS } from "../../retirement/contributions/data/limits.js";
import { federalTax } from "../../../core/math/tax.js";
import { perYear } from "../../../core/math/periods.js";
import { mileageOn } from "../side-income/data/rules.js";
import { HOME_OFFICE, SIMPLE, QBI_LINE, SCORP_COSTS_EXAMPLE, forYear } from "./data/business.js";

export const PAYROLL = { ss: 0.062, medicare: 0.0145 };
export const CATEGORIES = { supplies: "Supplies and materials", software: "Software and subscriptions", phone: "Phone and internet", marketing: "Advertising", travel: "Travel and meals", equipment: "Equipment", insurance: "Business insurance", contractors: "Help you paid", fees: "Fees and licences", other: "Other" };

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const pos = (v) => Math.max(0, num(v) ?? 0);

/** The home office, simplified: $5 a square foot used regularly and only for the business, at most 300 square feet, at most the profit before it. */
export const homeOffice = (sqft, profitBefore = Infinity) => Math.max(0, Math.min(Math.min(pos(sqft), HOME_OFFICE.maxSqft) * HOME_OFFICE.perSqft, Math.max(0, profitBefore)));

/**
 * The household's federal tax with the business's profit as a sole proprietor, and what it adds: self-employment tax
 * on 92.35% of profit (Social Security to the wage base after the owner's wages, Medicare), half of it, the
 * self-employed health insurance (limited to the profit less half the tax, IRC 162(l)) and retirement contributions
 * (`retirement`) off income; the 20% business deduction on profit less those (at most 20% of taxable income before it,
 * IRC 199A); the 0.9% extra Medicare tax on wages + earnings above the line.
 */
export function soleTax(profit, { inputs, params, otherOrdinary, wages = 0, medicareWages = 0, wageBase, health = 0, retirement = 0 }) {
  const P = Math.max(0, profit);
  const se = seTax(P, { wages, wageBase });
  const healthOff = Math.min(pos(health), Math.max(0, P - se.half));
  const adj = (Number(inputs.adjustments) || 0) + se.half + healthOff + retirement;
  const base = { ...inputs, otherOrdinary: Math.max(0, otherOrdinary + P), adjustments: adj };
  const pre = federalTax(base, params);
  const qbi = Math.max(0, Math.min(QBI.rate * Math.max(0, P - se.half - healthOff - retirement), QBI.rate * Math.max(0, pre.taxableIncome)));
  const after = federalTax({ ...base, adjustments: adj + qbi }, params);
  const th = params.additionalMedicareThreshold?.[inputs.filingStatus] ?? 200000;
  const extra = SE.addlMedicare * (Math.max(0, medicareWages + se.base - th) - Math.max(0, medicareWages - th));
  return { se, healthOff, qbi, income: after.totalTax - after.additionalMedicare, extra, taxable: pre.taxableIncome };
}
/**
 * The same profit through an S corporation paying the owner `salary`: the corporation pays the employer's Social
 * Security and Medicare on it (a cost) and `costs` a year; the owner pays the employee's share and income tax on the
 * salary plus what is left (passed through, no self-employment tax), with the 20% deduction on what is left.
 */
export function scorpTax(profit, salary, costs, { inputs, params, otherOrdinary, wages = 0, medicareWages = 0, wageBase, health = 0, retirement = 0 }) {
  const W = Math.max(0, Math.min(salary, profit));
  const ssRoom = Math.max(0, wageBase - wages);
  const employer = Math.min(W, wageBase) * PAYROLL.ss + W * PAYROLL.medicare;   // each employer pays to the full wage base
  const passed = profit - W - employer - costs;
  const healthOff = Math.min(pos(health), Math.max(0, W));
  // a small loss passed through (the salary, its tax and the costs above the profit) comes off other income
  const adj = (Number(inputs.adjustments) || 0) + healthOff + retirement + Math.max(0, -passed);
  const base = { ...inputs, wages: (Number(inputs.wages) || 0) + W, otherOrdinary: Math.max(0, otherOrdinary + Math.max(0, passed)), adjustments: adj };
  const pre = federalTax(base, params);
  const qbi = Math.max(0, Math.min(QBI.rate * Math.max(0, passed), QBI.rate * Math.max(0, pre.taxableIncome)));
  const after = federalTax({ ...base, adjustments: adj + qbi }, params);
  // the owner's share: Social Security only to the wage base after other wages (the excess comes back on the return), Medicare, the 0.9%
  const th = params.additionalMedicareThreshold?.[inputs.filingStatus] ?? 200000;
  const extra = SE.addlMedicare * (Math.max(0, medicareWages + W - th) - Math.max(0, medicareWages - th));
  const employee = Math.min(W, ssRoom) * PAYROLL.ss + W * PAYROLL.medicare + extra;
  return { salary: W, employer, employee, passed, qbi, income: after.totalTax - after.additionalMedicare, costs };
}

/**
 * compute(plan, { today }) -> {
 *   ready, year, incomeId, name, person, revenue, revenueFrom ("typed"|"income"), expenses: [{ id, name, category, label, yearly }],
 *   homeOffice, miles: { miles, rate, amount }, expensesTotal, profit, margin, breakEvenMonthly,
 *   tax: { se, qbi, income, extra, state, total, rate } (sole proprietor), keepMonthly, drawMonthly, draw ("ok"|"over"|null),
 *   scorp: { salary, salaryFrom, costs, costsFrom, employer, employee, passed, qbi, income, federal (what it adds), state, total (taxes), saving (sole total - total - costs) } | null,
 *   plans: { sep, solo, simple: [{ key, label, room, saved }] }, qbiLimited, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const year = Number(today.slice(0, 4));
  const s = plan.whatIfs?.business ?? {};
  const inc = computeIncome(plan, { today });
  const biz = inc.active.filter((x) => x.type === "business" && x.period !== "once");
  const item = biz.find((x) => x.id === s.incomeId) ?? [...biz].sort((a, b) => b.yearly - a.yearly)[0] ?? null;
  const typedRevenue = num(s.revenue);
  if (!item && typedRevenue === null) return { ready: false, year };
  const people = plan.household?.people ?? [];
  const person = people.find((p) => p.id === item?.personId) ?? people.find((p) => p.role === "self") ?? null;
  const notes = [];
  const revenue = typedRevenue ?? item.yearly;
  const expenses = (s.expenses ?? []).map((e) => ({ id: e.id, name: e.name || CATEGORIES[e.category] || "Expense", category: e.category ?? "other", label: CATEGORIES[e.category] ?? CATEGORIES.other, yearly: perYear(e.amount, e.period ?? "monthly") }));
  const typedTotal = expenses.reduce((t, e) => t + e.yearly, 0);
  const rate = mileageOn(today);
  const miles = { miles: pos(s.miles), rate, amount: pos(s.miles) * rate };
  const office = homeOffice(s.homeOfficeSqft, revenue - typedTotal - miles.amount);
  const expensesTotal = typedTotal + miles.amount + office;
  const profit = revenue - expensesTotal;
  if (!expenses.length && !miles.amount && !office) notes.push("No expenses typed yet: the profit below is all of the revenue.");

  // the tax, as a sole proprietor: the household's tax without this business, then with its profit
  const ti = taxInputs(plan, { today });
  const st = computeState(plan, { today });
  const stateRate = st.rate ?? 0;
  if (st.rate === null) notes.push("Your state's income tax is not counted: set its rate on the State tax page.");
  const wageBase = maximumEarnings(year);
  const ownerWages = inc.active.filter((x) => x.personId === (person?.id ?? "") && ["salary", "bonus"].includes(x.type) && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
  const medicareWages = inc.active.filter((x) => ["salary", "bonus"].includes(x.type) && x.taxable !== false && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
  const otherOrdinary = Math.max(0, (Number(ti.inputs.otherOrdinary) || 0) - (item ? item.yearly : 0));
  const health = pos(s.healthPremiums);
  const T = { inputs: ti.inputs, params: ti.params, otherOrdinary, wages: ownerWages, medicareWages, wageBase, health };
  const none = federalTax({ ...ti.inputs, otherOrdinary }, ti.params);
  const noneIncome = none.totalTax - none.additionalMedicare;
  const sole = soleTax(profit, T);
  const stateSole = Math.max(0, profit - sole.se.half - sole.healthOff) * stateRate;
  const soleTotal = sole.income - noneIncome + sole.se.total + sole.extra + stateSole;
  const tax = { se: sole.se.total, qbi: sole.qbi, income: sole.income - noneIncome, extra: sole.extra, state: stateSole, total: soleTotal, rate: profit > 0 ? soleTotal / profit : null, health: sole.healthOff };
  const keepMonthly = (profit - soleTotal) / 12;
  const drawMonthly = num(s.drawMonthly);
  const draw = drawMonthly === null ? null : drawMonthly > keepMonthly + 0.5 ? "over" : "ok";

  // an S corporation: worth a look once profit is well above a reasonable salary
  let scorp = null;
  if (profit > 0) {
    const salary = num(s.salary) ?? Math.round(profit * 0.6 / 100) * 100;
    const costs = num(s.scorpCosts) ?? SCORP_COSTS_EXAMPLE;
    const c = scorpTax(profit, salary, costs, T);
    const stateC = Math.max(0, c.salary + c.passed) * stateRate;
    const total = c.income - noneIncome + c.employee + c.employer + stateC;
    scorp = { ...c, federal: c.income - noneIncome, salaryFrom: num(s.salary) === null ? "example" : "typed", costsFrom: num(s.scorpCosts) === null ? "example" : "typed", state: stateC, total, saving: soleTotal - (total + costs) };
  }

  // the retirement plans for the self-employed: the Self-employment page's room for SEP and solo 401(k), and SIMPLE here
  const se = computeSelfEmployment(plan, { today });
  const row = se.ready ? se.people.find((p) => p.id === (person?.id ?? se.people[0]?.id)) ?? se.people[0] : null;
  const earned = Math.max(0, profit - sole.se.half);
  const age = person?.birthDate ? year - Number(String(person.birthDate).slice(0, 4)) : null;
  const S = forYear(SIMPLE, year);
  const simpleCatch = age === null || age < 50 ? 0 : age >= S.superCatchUp.from && age <= S.superCatchUp.to ? S.superCatchUp.amount : S.catchUp;
  const L401 = forYear(LIMITS, year).kinds["401k"];
  const total415 = se.ready ? se.total415 : 72000;
  const deferralLeft = row ? row.deferralLeft : L401.limit;
  const sepRoom = Math.min(total415, 0.2 * earned);
  const soloRoom = Math.min(total415, 0.2 * earned + Math.min(deferralLeft, earned));
  // SIMPLE deferrals share the yearly limit on what a person puts in across plans (IRC 402(g)) with a 401(k) at a job
  const simpleRoom = Math.min(earned, S.limit + simpleCatch, deferralLeft + simpleCatch) + S.match * earned;
  const savedBy = (room) => { if (!(room > 0)) return 0; const w = soleTax(profit, { ...T, retirement: room }); const stW = Math.max(0, profit - w.se.half - w.healthOff - room) * stateRate; return soleTotal - (w.income - noneIncome + w.se.total + w.extra + stW); };
  const plans = [
    { key: "sep", label: "SEP-IRA", room: sepRoom },
    { key: "solo", label: "Solo 401(k)", room: soloRoom },
    { key: "simple", label: "SIMPLE IRA", room: simpleRoom },
  ].map((p) => ({ ...p, saved: savedBy(p.room) }));
  if (row && row.deferralLeft < L401.limit) notes.push(`A 401(k) at a job already uses ${Math.round(L401.limit - row.deferralLeft).toLocaleString("en-US")} of the ${L401.limit.toLocaleString("en-US")} a person may put in, so the solo 401(k) has less room.`);

  const Q = forYear(QBI_LINE, year);
  const line = Q[ti.filingStatus] ?? Q.single;
  const qbiLimited = sole.taxable > line;
  return {
    ready: true, year, incomeId: item?.id ?? null, name: s.name || item?.name || "Your business", person: person ? { id: person.id, name: person.name } : null,
    revenue, revenueFrom: typedRevenue !== null ? "typed" : "income", incomeYearly: item?.yearly ?? null, expenses, typedTotal, homeOffice: office, miles, expensesTotal,
    profit, margin: revenue > 0 ? profit / revenue : null, breakEvenMonthly: expensesTotal / 12,
    tax, keepMonthly, drawMonthly, draw, scorp, plans, earned, qbiLimited, qbiLine: line, stateRate, notes,
    singleBusiness: biz.length <= 1,
  };
}
