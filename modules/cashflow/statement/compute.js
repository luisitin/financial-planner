// modules/cashflow/statement/compute.js -- PURE. A year's money split the way a business's cash-flow
// statement splits it: living (operating: pay and other income in, tax and living costs out), investing
// (your own money into retirement and investment accounts) and financing (loan and card payments, split into
// interest and paying down what you owe). Together they are the year's change in cash. From the plan's figures,
// and the last twelve complete months from the bank files when there are any.
import { compute as computeIncome, INCOME_TYPES } from "../income/compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { isTransfer, monthOf } from "../../transactions/ledger/compute.js";
import { categoryById } from "../../transactions/categories/compute.js";
import { perYear } from "../../../core/math/periods.js";

/** A year of payments on one debt: what is paid, how much is interest and how much pays it down (it stops once paid off). */
export function yearOfPayments(balance, rate, payment, months = 12) {
  let b = balance, paid = 0, interest = 0;
  for (let m = 0; m < months && b > 0.005 && payment > 0; m++) {
    const i = b * (rate ?? 0) / 12, pay = Math.min(payment, b + i);
    interest += i; paid += pay; b = b + i - pay;
  }
  return { paid, interest: Math.min(interest, paid), principal: Math.max(0, paid - interest) };
}

/** Expenses that are a debt's payment (the same monthly amount, within a dollar, as its payment or its minimum): each matched once. */
export function matchPayments(expenses, debts) {
  const out = new Map(), used = new Set();
  for (const d of debts) {
    const e = expenses.find((x) => !used.has(x.id) && [d.payment, d.minPayment].some((p) => p > 0 && Math.abs(x.monthly - p) < 1));
    if (e) { used.add(e.id); out.set(d.id, e); }
  }
  return out;
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing,
 *   year: { operating: { lines: [{ label, amount }], total }, investing: { lines, total, match }, financing: { lines, total }, net, goals, matched: [expense names] },
 *   actual: { months, from, to, operating: { in, out, total }, financing: { total }, net } | null
 * }
 * Amounts in are positive, out negative.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!(plan.income ?? []).length && !(plan.expenses ?? []).length && !(plan.transactions ?? []).length) return { ready: false, missing: ["what comes in (Income) and what goes out (Expenses), or a bank file"] };
  let year = null;
  if ((plan.income ?? []).length || (plan.expenses ?? []).length) {
    const inc = computeIncome(plan, { today });
    const exp = computeExpenses(plan, { today });
    const nb = computeNext(plan, { today });
    const st = computeState(plan, { today });
    const li = computeLiabilities(plan, { today });
    const con = computeContributions(plan, { today });
    // which expenses are really loan payments
    const debts = li.rows.filter((r) => r.owed > 0 && r.payment > 0).map((r) => ({ id: r.id, name: r.name, owed: r.owed, rate: r.rate ?? 0, payment: r.payment, minPayment: r.minPayment }));
    const items = exp.items ?? (plan.expenses ?? []).map((e) => ({ ...e, monthly: perYear(e.amount, e.period) / 12 }));
    const active = items.filter((e) => e.active !== false && e.period !== "once");
    const matched = matchPayments(active, debts);
    const matchedIds = new Set([...matched.values()].map((e) => e.id));
    const otherDebt = active.filter((e) => !matchedIds.has(e.id) && e.category === "debt");
    const otherDebtYearly = otherDebt.reduce((s, e) => s + e.monthly * 12, 0);
    const living = exp.monthly * 12 - [...matched.values(), ...otherDebt].reduce((s, e) => s + e.monthly * 12, 0);
    const s = nb.ready ? nb.spare : { federalTax: 0, payrollTax: 0 };
    const opLines = [
      ...Object.entries(inc.byType ?? {}).filter(([, y]) => y > 0).map(([t, y]) => ({ label: INCOME_TYPES[t]?.label ?? t, amount: y })).sort((a, b) => b.amount - a.amount),
      { label: "Federal income tax", amount: -s.federalTax * 12 },
      { label: "Social Security and Medicare tax", amount: -s.payrollTax * 12 },
      st.tax > 0 ? { label: `${st.name} income tax`, amount: -st.tax } : null,
      { label: "Living costs", amount: -living },
    ].filter((l) => l && Math.abs(l.amount) >= 0.5);
    const taxable = (con.items ?? []).filter((c) => ["brokerage", "crypto"].includes(c.accountType)).reduce((t, c) => t + c.yearly, 0);
    const invLines = [
      { label: "Into retirement and health accounts (your own money)", amount: -(con.yearly - taxable) },
      { label: "Into investment accounts", amount: -taxable },
    ].filter((l) => Math.abs(l.amount) >= 0.5);
    const pays = debts.map((d) => ({ ...d, ...yearOfPayments(d.owed, d.rate, d.payment) }));
    const finLines = [
      { label: "Interest on loans and cards", amount: -pays.reduce((t, p) => t + p.interest, 0) },
      { label: "Paying down what you owe", amount: -pays.reduce((t, p) => t + p.principal, 0) },
      otherDebtYearly > 0 ? { label: "Other loan payments", amount: -otherDebtYearly } : null,
    ].filter((l) => l && Math.abs(l.amount) >= 0.5);
    const total = (l) => l.reduce((t, x) => t + x.amount, 0);
    const operating = { lines: opLines, total: total(opLines) }, investing = { lines: invLines, total: total(invLines), match: con.matchYearly ?? 0 }, financing = { lines: finLines, total: total(finLines) };
    year = { operating, investing, financing, net: operating.total + investing.total + financing.total, goals: s.goalSaving ? s.goalSaving * 12 : 0, matched: [...matched.values()].map((e) => e.name), principal: pays.reduce((t, p) => t + p.principal, 0) };
  }

  // the bank files: the last twelve complete months
  let actual = null;
  const txs = (plan.transactions ?? []).filter((t) => !isTransfer(t, plan));
  if (txs.length) {
    const thisMonth = today ? String(today).slice(0, 7) : "9999-12";
    const months = [...new Set(txs.map((t) => monthOf(t.date)).filter((m) => m && m < thisMonth))].sort().slice(-12);
    if (months.length) {
      const inWindow = new Set(months);
      let tin = 0, tout = 0, debt = 0;
      for (const t of txs) {
        if (!inWindow.has(monthOf(t.date))) continue;
        const amt = Number(t.amount) || 0;
        const kind = categoryById(plan, t.category)?.kind ?? (amt >= 0 ? "income" : "expense");
        if (kind === "income") tin += amt;
        else if (t.category === "debt") debt += -amt;
        else tout += -amt;
      }
      actual = { months: months.length, from: months[0], to: months[months.length - 1], operating: { in: tin, out: -tout, total: tin - tout }, financing: { total: -debt }, net: tin - tout - debt };
    }
  }
  if (!year && !actual) return { ready: false, missing: ["what comes in (Income) and what goes out (Expenses), or a full month of bank transactions"] };
  return { ready: true, missing: [], year, actual };
}
