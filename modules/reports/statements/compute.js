// modules/reports/statements/compute.js -- PURE. The household's three financial statements, the way a
// business keeps them: a balance sheet (what you own and owe today, by kind and by owner), an income
// statement (a year of income, tax, spending and saving from the plan's figures, and the last twelve
// months from the bank files when there are any), and a cash-flow statement (where a year's money goes:
// living, saving, and how much of the loan payments is interest and how much pays down what you owe).
import { compute as computeNetWorth, ACCOUNT_TYPES, countedBalance } from "../../balance/net-worth/compute.js";
import { compute as computeIncome, INCOME_TYPES } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { compute as computeIncomeStatement } from "../../cashflow/income-statement/compute.js";

/** Balance-sheet groups for assets, in the order a statement lists them (most liquid first). */
export const ASSET_GROUPS = [
  { id: "cash", label: "Cash", types: ["checking", "savings", "cash"] },
  { id: "investments", label: "Investments", types: ["brokerage", "crypto"] },
  { id: "retirement", label: "Retirement accounts", types: ["401k", "ira", "roth"] },
  { id: "health-education", label: "Health and education accounts", types: ["hsa", "529"] },
  { id: "property", label: "Home, property and vehicles", types: ["property", "vehicle"] },
  { id: "other", label: "Other", types: null },
];
export const SHORT_TERM_DEBT = ["credit"];

/**
 * compute(plan, { today }) -> {
 *   ready, missing, today,
 *   balance: { groups: [{ id, label, accounts: [{ name, type, owner, balance }], total }], assets, short: { accounts, total }, long: { accounts, total }, liabilities, netWorth, byOwner: [{ name, assets, liabilities, netWorth }] },
 *   income: { lines: [{ label, yearly }], total, federalTax, payrollTax, expenses: [{ label, yearly }], expensesTotal, retirementSaving, goalSaving, net } | null,
 *   actual: { months, in, out, net, rate, from, to } | null,
 *   cashflow: { income, taxes, living, fromLiving, retirement, goals, saving, net, debt: { payments, interest, principal }, netWorthGrowth } | null
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const accounts = plan.accounts ?? [];
  if (!accounts.length && !(plan.income ?? []).length) return { ready: false, missing: ["your accounts (Net worth) or what comes in (Income)"] };
  const people = plan.household?.people ?? [];
  const ownerName = (id) => people.find((p) => p.id === id)?.name ?? "Joint";
  const nw = computeNetWorth(plan, { today });

  // balance sheet
  const assets = accounts.filter((a) => (ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset).side !== "liability");
  const debts = accounts.filter((a) => (ACCOUNT_TYPES[a.type] ?? {}).side === "liability");
  const row = (a) => ({ name: a.name, type: (ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset).label, owner: ownerName(a.ownerId), balance: (ACCOUNT_TYPES[a.type] ?? {}).side === "liability" ? Math.abs(Number(a.balance) || 0) : countedBalance(a) });
  const known = new Set(ASSET_GROUPS.flatMap((g) => g.types ?? []));
  const groups = ASSET_GROUPS.map((g) => { const list = assets.filter((a) => (g.types ? g.types.includes(a.type) : !known.has(a.type))).map(row).sort((x, y) => y.balance - x.balance); return { id: g.id, label: g.label, accounts: list, total: list.reduce((s, a) => s + a.balance, 0) }; }).filter((g) => g.accounts.length);
  const shortList = debts.filter((a) => SHORT_TERM_DEBT.includes(a.type)).map(row), longList = debts.filter((a) => !SHORT_TERM_DEBT.includes(a.type)).map(row);
  const sum = (l) => l.reduce((s, a) => s + a.balance, 0);
  const owners = [...new Set(accounts.map((a) => ownerName(a.ownerId)))];
  const byOwner = owners.map((name) => { const own = accounts.filter((a) => ownerName(a.ownerId) === name).map((a) => ({ ...row(a), liability: (ACCOUNT_TYPES[a.type] ?? {}).side === "liability" })); const as = own.filter((x) => !x.liability).reduce((s, x) => s + x.balance, 0), li = own.filter((x) => x.liability).reduce((s, x) => s + x.balance, 0); return { name, assets: as, liabilities: li, netWorth: as - li }; }).sort((a, b) => (a.name === "Joint") - (b.name === "Joint") || b.netWorth - a.netWorth);
  const balance = { groups, assets: nw.assets, short: { accounts: shortList, total: sum(shortList) }, long: { accounts: longList, total: sum(longList) }, liabilities: nw.liabilities, netWorth: nw.netWorth, byOwner };

  // income statement and cash-flow statement, a year, from the plan's figures
  const nb = computeNext(plan, { today });
  let income = null, cashflow = null;
  if (nb.ready) {
    const inc = computeIncome(plan, { today }), exp = computeExpenses(plan, { today });
    const s = nb.spare;
    income = {
      lines: Object.entries(inc.byType).map(([t, y]) => ({ label: INCOME_TYPES[t]?.label ?? t, yearly: y })).sort((a, b) => b.yearly - a.yearly), total: s.gross * 12,
      federalTax: s.federalTax * 12, payrollTax: s.payrollTax * 12,
      expenses: exp.byCategory.map((c) => ({ label: c.label, yearly: c.monthly * 12 })), expensesTotal: s.spending * 12,
      retirementSaving: s.retirementSaving * 12, goalSaving: s.goalSaving * 12, net: s.monthly * 12,
    };
    const li = computeLiabilities(plan, { today });
    const payments = li.payments * 12, interest = li.interestMonthly * 12;
    const living = s.spending * 12, taxes = (s.federalTax + s.payrollTax) * 12;
    cashflow = {
      income: s.gross * 12, taxes, living, fromLiving: s.gross * 12 - taxes - living,
      retirement: s.retirementSaving * 12, goals: s.goalSaving * 12, saving: (s.retirementSaving + s.goalSaving) * 12, net: s.monthly * 12,
      debt: { payments, interest: Math.min(interest, payments), principal: Math.max(0, payments - interest) },
      netWorthGrowth: (s.retirementSaving + s.goalSaving + Math.max(0, s.monthly)) * 12 + Math.max(0, payments - interest),
    };
  }

  // the last twelve complete months from the bank files
  let actual = null;
  if ((plan.transactions ?? []).length) {
    const is = computeIncomeStatement(plan, { today, months: 13 });
    const full = is.rows.filter((r) => r.complete).slice(0, 12);
    if (full.length) {
      const tin = full.reduce((t, r) => t + r.in, 0), tout = full.reduce((t, r) => t + r.out, 0);
      actual = { months: full.length, in: tin, out: tout, net: tin - tout, rate: tin > 0 ? (tin - tout) / tin : null, from: full[full.length - 1].ym, to: full[0].ym };
    }
  }
  return { ready: true, missing: [], today, balance, income, actual, cashflow };
}
