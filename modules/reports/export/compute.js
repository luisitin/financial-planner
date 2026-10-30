// modules/reports/export/compute.js -- PURE. Every table the app keeps or works out, as plain rows a
// spreadsheet opens: what is typed in (accounts, transactions, income, expenses, debts, goals,
// holdings, the net-worth history) and what the pages work out (the retirement plan year by year,
// tax year by year, the life timeline). `datasetCsv` builds one file; `compute` lists them with
// their sizes.
import { toCsv } from "../../../core/csv.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeCashFlow } from "../../retirement/cash-flow/compute.js";
import { compute as computeTaxProjection } from "../../taxes/projection/compute.js";
import { compute as computeTimeline } from "../../overview/timeline/compute.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";

const r2 = (n) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? "" : Math.round(Number(n) * 100) / 100);
const pct = (n) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? "" : Math.round(Number(n) * 10000) / 100);

/** The datasets: id, title, what is in it, and a function from (plan, today) to { headers, rows }. */
export const DATASETS = [
  { id: "accounts", title: "Accounts", what: "Every account with its balance and the date of that balance.", kind: "typed",
    build: (plan) => { const who = names(plan); return { headers: ["name", "type", "institution", "owner", "balance", "as_of"], rows: (plan.accounts ?? []).map((a) => [a.name, ACCOUNT_TYPES[a.type]?.label ?? a.type, a.institution ?? "", who(a.ownerId), r2(a.balance), a.asOf ?? ""]) }; } },
  { id: "transactions", title: "Transactions", what: "Every transaction imported or typed, newest first.", kind: "typed",
    build: (plan) => { const acct = (id) => (plan.accounts ?? []).find((a) => a.id === id)?.name ?? ""; return { headers: ["date", "account", "payee", "amount", "category", "tags", "note"], rows: [...(plan.transactions ?? [])].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((t) => [t.date, acct(t.accountId), t.payee ?? "", r2(t.amount), t.category ?? "", (t.tags ?? []).join(" "), t.note ?? ""]) }; } },
  { id: "income", title: "Income", what: "What comes in, with the monthly and yearly amounts worked out.", kind: "typed",
    build: (plan, today) => ({ headers: ["name", "type", "person", "amount", "period", "monthly", "yearly", "growth_pct", "start", "end", "taxable", "counts_today"], rows: computeIncome(plan, { today }).items.map((x) => [x.name, x.typeLabel, x.personName, r2(x.amount), x.periodLabel, r2(x.monthly), r2(x.yearly), pct(x.growth), x.startDate ?? "", x.endDate ?? "", x.taxable === false ? "no" : "yes", x.active ? "yes" : "no"]) }) },
  { id: "expenses", title: "Expenses", what: "What goes out, with the monthly and yearly amounts worked out.", kind: "typed",
    build: (plan, today) => ({ headers: ["name", "category", "amount", "period", "monthly", "yearly", "must_pay", "rises_with_inflation", "start", "end", "counts_today"], rows: computeExpenses(plan, { today }).items.map((x) => [x.name, x.categoryLabel, r2(x.amount), x.periodLabel, r2(x.monthly), r2(x.yearly), x.essential ? "yes" : "no", x.inflates ? "yes" : "no", x.startDate ?? "", x.endDate ?? "", x.active ? "yes" : "no"]) }) },
  { id: "debts", title: "Debts", what: "Every loan and card with its rate, payment and payoff date at that payment.", kind: "typed",
    build: (plan, today) => ({ headers: ["name", "type", "owed", "rate_pct", "payment", "interest_a_month", "months_to_go", "paid_off"], rows: computeLiabilities(plan, { today }).rows.map((r) => [r.name, r.typeLabel, r2(r.owed), pct(r.rate), r2(r.payment), r2(r.interestMonthly), Number.isFinite(r.months) ? r.months : r.months === Infinity ? "never" : "", r.payoffDate ?? ""]) }) },
  { id: "goals", title: "Goals", what: "What you are saving for, by when, and whether it is on track.", kind: "typed",
    build: (plan, today) => ({ headers: ["name", "priority", "target_today", "target_then", "by", "set_aside", "monthly", "needed_monthly", "status"], rows: computeGoals(plan, { today }).goals.map((g) => [g.name, g.priorityLabel, r2(g.target), r2(g.targetThen), g.targetDate ?? "", r2(g.funded), r2(g.monthly), r2(g.neededMonthly), g.status]) }) },
  { id: "holdings", title: "Holdings", what: "What each investment account holds, its value and what you paid.", kind: "typed",
    build: (plan) => { const acct = (id) => (plan.accounts ?? []).find((a) => a.id === id)?.name ?? ""; return { headers: ["account", "symbol", "name", "shares", "price", "value", "cost_basis", "asset_class", "expense_ratio_pct", "price_as_of"], rows: (plan.holdings ?? []).map((x) => [acct(x.accountId), x.symbol ?? "", x.name ?? "", r2(x.shares), r2(x.price), r2((Number(x.shares) || 0) * (Number(x.price) || 0)), r2(x.costBasis), x.assetClass ?? "", pct(x.expenseRatio), x.priceAsOf ?? ""]) }; } },
  { id: "net-worth-history", title: "Net worth history", what: "Every saved point: what you owned, owed and were worth.", kind: "typed",
    build: (plan) => ({ headers: ["date", "assets", "liabilities", "net_worth"], rows: (plan.netWorthHistory ?? []).map((h) => [h.date, r2(h.assets), r2(h.liabilities), r2(h.netWorth)]) }) },
  { id: "retirement-years", title: "Retirement plan, year by year", what: "Every year of the plan in today's dollars: ages, what goes in, what comes out and from where, what is left.", kind: "worked",
    build: (plan, today) => { const d = computeCashFlow(plan, { today, real: true }); return { headers: ["year", "ages", "retired", "contributions", "income", "spending", "taxes", "from_cash", "from_taxable", "from_pre_tax", "from_tax_free", "required_withdrawal", "end_cash", "end_taxable", "end_pre_tax", "end_tax_free", "end_total", "short"], rows: d.ready ? d.rows.map((r) => [r.year, r.ages.join(" / "), r.retired ? "yes" : "no", r2(r.in.contributions), r2(r.in.income), r2(r.out.spending), r2(r.out.taxes), r2(r.from.cash), r2(r.from.taxable), r2(r.from.deferred), r2(r.from.free), r2(r.rmd), r2(r.end.cash), r2(r.end.taxable), r2(r.end.deferred), r2(r.end.free), r2(r.end.total), r2(r.shortfall)]) : [] }; } },
  { id: "tax-years", title: "Tax, year by year", what: "Federal tax in every retirement year through the brackets, in today's dollars.", kind: "worked",
    build: (plan, today) => { const d = computeTaxProjection(plan, { today }); return { headers: ["year", "ages", "ordinary_income", "qualified_income", "social_security", "taxable_social_security", "deduction", "taxable_income", "bracket_pct", "tax", "effective_pct", "roth_conversion", "required_withdrawal"], rows: d.ready ? d.rows.map((r) => [r.year, (r.ages ?? []).join(" / "), r2(r.ordinary), r2(r.qualified), r2(r.socialSecurity), r2(r.taxableSocialSecurity), r2(r.deduction), r2(r.taxableIncome), pct(r.bracketRate), r2(r.taxes), pct(r.effectiveRate), r2(r.conversion), r2(r.rmd)]) : [] }; } },
  { id: "timeline", title: "Life timeline", what: "Every moment from today to the end of the plan that changes your money.", kind: "worked",
    build: (plan, today) => { const d = computeTimeline(plan, { today }); return { headers: ["date", "year", "what", "detail"], rows: d.ready ? d.events.map((e) => [e.date ?? "", e.year, e.title, e.detail]) : [] }; } },
];

function names(plan) { const people = plan.household?.people ?? []; return (id) => people.find((p) => p.id === id)?.name ?? (id ? "" : "household"); }

/** One dataset as CSV text (a header line, then one line per row, CRLF line ends, quoted where needed). */
export function datasetCsv(plan, id, today) {
  const ds = DATASETS.find((d) => d.id === id);
  if (!ds) throw new Error(`no dataset ${id}`);
  const { headers, rows } = ds.build(plan, today);
  return toCsv(headers, rows);
}

/** compute(plan, { today }) -> { datasets: [{ id, title, what, kind: "typed"|"worked", rows (count), columns }], total (rows in all) } */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const datasets = DATASETS.map((d) => { const t = today || d.kind === "typed" ? d.build(plan, today) : { headers: [], rows: [] }; return { id: d.id, title: d.title, what: d.what, kind: d.kind, rows: t.rows.length, columns: t.headers.length }; });
  return { datasets, total: datasets.reduce((s, d) => s + d.rows, 0) };
}
