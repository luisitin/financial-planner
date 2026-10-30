// modules/debt/student-loans/compute.js -- PURE. Federal student loans under each way to repay them, month
// by month on the household's own income (growing with pay): the standard 10-year plan; income-based
// repayment (IBR: 10% of income over 150% of the poverty line, never more than the standard payment, the rest
// forgiven after 20 years); the Repayment Assistance Plan (RAP, from July 2026: 1% to 10% of income, less
// $50 a month per dependent, unpaid interest waived, the rest forgiven after 30 years); and Public Service
// Loan Forgiveness (PSLF: tax-free after 120 payments while working for government or a nonprofit). What each
// costs in all, counting the tax on forgiveness outside PSLF.
import { pmt } from "../../../core/math/finance.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { povertyLine } from "../../retirement/healthcare/compute.js";
import { planReturn } from "../../insurance/term-vs-permanent/compute.js";

/** RAP's share of income by adjusted gross income (One Big Beautiful Bill Act, 2025): $10 a month under $10,000, then 1% more per $10,000, 10% from $100,000. */
export function rapRate(agi) { if (agi <= 10000) return 0; return Math.min(0.10, Math.ceil((agi - 10000) / 10000) * 0.01); }
export const RAP = { minMonthly: 10, perDependent: 50, match: 50, years: 30 };
export const IBR = { share: 0.10, povertyMultiple: 1.5, years: 20 };
export const PSLF_PAYMENTS = 120;

/** One plan, month by month: { months, paid, pv (payments in today's money at `discount` a year), pvForgiven, forgiven, monthly (first), schedule: [{ year, balance, paid }] }. */
export function simulate({ balance, rate, plan, agi, growth, inflation, size, dependents, pslf, discount = 0 }) {
  const r = rate / 12;
  const standard = pmt(r, 120, balance);
  let bal = balance, paid = 0, pv = 0, unpaidInterest = 0, first = null, count = 0;
  const limit = plan === "standard" ? 120 : pslf ? PSLF_PAYMENTS : (plan === "rap" ? RAP.years : IBR.years) * 12;
  const schedule = [];
  for (let m = 0; m < limit && bal > 0.005; m++) {
    const y = Math.floor(m / 12);
    const income = agi * Math.pow(1 + growth, y);
    let pay;
    if (plan === "standard") pay = Math.min(standard, bal * (1 + r));
    else if (plan === "ibr") pay = Math.min(standard, Math.max(0, IBR.share * (income - IBR.povertyMultiple * povertyLine(size) * Math.pow(1 + inflation, y)) / 12));
    else pay = Math.max(RAP.minMonthly, income * rapRate(income) / 12 - RAP.perDependent * dependents);
    if (first === null) first = pay;
    const interest = bal * r;
    if (plan === "rap") {
      // RAP: interest the payment does not cover is waived; principal falls by at least the lesser of $50 and the payment
      const toPrincipal = Math.max(pay - interest, Math.min(RAP.match, pay));
      pay = Math.min(pay, bal + interest);
      bal = Math.max(0, bal - toPrincipal);
    } else if (pay >= interest + unpaidInterest) { bal -= pay - interest - unpaidInterest; unpaidInterest = 0; }
    else { unpaidInterest += interest - pay; }
    paid += pay; pv += pay / Math.pow(1 + discount / 12, m + 1); count = m + 1;
    if (m % 12 === 11) schedule.push({ year: y + 1, balance: bal + unpaidInterest, paid });
  }
  const forgiven = Math.max(0, bal + unpaidInterest);
  return { months: count, paid, pv, pvForgiven: forgiven / Math.pow(1 + discount / 12, count), forgiven, monthly: first ?? 0, schedule, standard };
}

/**
 * compute(plan, { today }) -> {
 *   ready, loans: [{ name, owed, rate }], balance, rate (weighted), agi, size, dependents, pslf, marginal,
 *   discount, plans: [{ id, label, monthly, years, paid, forgiven, taxOnForgiven, total (paid + tax on forgiveness), today (the same in today's money), note }], best (lowest in today's money)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.whatIfs?.studentLoans ?? {};
  const li = computeLiabilities(plan, { today });
  const loans = li.rows.filter((r) => r.type === "student_loan" && r.owed > 0).map((r) => ({ name: r.name, owed: r.owed, rate: r.rate ?? 0.06 }));
  if (!loans.length) return { ready: false, loans: [] };
  const balance = loans.reduce((t, l) => t + l.owed, 0);
  const rate = loans.reduce((t, l) => t + l.owed * l.rate, 0) / balance;
  const b = taxInputs(plan, { today });
  const tax = federalTax(b.inputs, b.params);
  const agi = Number(s.agi) > 0 ? Number(s.agi) : tax.agi;
  const people = plan.household?.people ?? [];
  const dependents = people.filter((p) => p.role === "dependent").length;
  const size = Math.max(1, people.length);
  const growth = Number(plan.assumptions?.salaryGrowth ?? 0.03), inflation = Number(plan.assumptions?.inflation ?? 0.03);
  const pslf = !!s.pslf;
  // the tax rate on forgiven debt outside PSLF (taxable again from 2026): the household's top rate now
  const marginal = tax.bracketRate ?? 0.22;
  const discount = planReturn(plan);
  const base = { balance, rate, agi, growth, inflation, size, dependents, pslf: false, discount };
  // cost = what you pay plus the tax on any forgiveness; ranked in today's money (each payment discounted at the plan's own return: money paid later could have earned that meanwhile)
  const row = (id, label, res, note, taxed) => ({ id, label, monthly: res.monthly, years: res.months / 12, paid: res.paid, forgiven: res.forgiven, taxOnForgiven: taxed ? res.forgiven * marginal : 0, total: res.paid + (taxed ? res.forgiven * marginal : 0), today: res.pv + (taxed ? res.pvForgiven * marginal : 0), note, schedule: res.schedule });
  const plans = [
    row("standard", "Standard, 10 years", simulate({ ...base, plan: "standard" }), "the same payment until it is paid off", false),
    row("ibr", "Income-based (IBR)", simulate({ ...base, plan: "ibr" }), "10% of income over 150% of the poverty line; the rest forgiven after 20 years", true),
    row("rap", "Repayment Assistance Plan (RAP)", simulate({ ...base, plan: "rap" }), "1% to 10% of income, less $50 a month per child; unpaid interest waived; the rest forgiven after 30 years", true),
  ];
  if (pslf) {
    const p1 = simulate({ ...base, plan: "rap", pslf: true }), p2 = simulate({ ...base, plan: "ibr", pslf: true });
    const better = p1.pv <= p2.pv ? p1 : p2;
    plans.push(row("pslf", "Public Service Loan Forgiveness", better, `income-driven payments for 10 years of public-service work, the rest forgiven tax-free (${p1.pv <= p2.pv ? "on RAP" : "on IBR"})`, false));
  }
  const best = plans.reduce((a, x) => (x.today < a.today - 1 ? x : a));
  return { ready: true, loans, balance, rate, agi, size, dependents, pslf, marginal, discount, plans, best: best.id };
}
