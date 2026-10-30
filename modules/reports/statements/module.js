// modules/reports/statements/module.js -- the balance sheet, income statement and cash-flow statement as one printable pack.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "statements",
  group: "reports",
  title: "Financial statements",
  icon: "🗂️",
  order: 20,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["accounts", "household", "income", "expenses", "debts", "retirement", "goals", "transactions", "taxes"],
  writes: [],
  heavy: false,
  purpose: "Bundles your balance sheet, income statement and cash-flow statement into one printable pack.",
  compute,
  render,
};
