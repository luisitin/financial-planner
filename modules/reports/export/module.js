// modules/reports/export/module.js -- every table in the app as a file a spreadsheet opens.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "export",
  group: "reports",
  title: "Export",
  icon: "📤",
  order: 60,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["accounts", "transactions", "income", "expenses", "debts", "goals", "holdings", "netWorthHistory", "retirement", "household", "assumptions", "taxes"],
  writes: [],
  heavy: false,
  purpose: "Any table in the app as a file a spreadsheet opens: accounts, transactions, income, expenses, debts, goals, holdings, the retirement plan and tax year by year, the life timeline.",
  compute,
  render,
};
