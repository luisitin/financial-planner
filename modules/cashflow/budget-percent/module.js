// modules/cashflow/budget-percent/module.js -- income after tax split into needs, wants and savings (50/30/20).
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "budget-percent",
  group: "cashflow",
  title: "Budget (50/30/20)",
  icon: "💵",
  order: 50,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["income", "expenses", "debts", "taxes", "retirement", "goals", "household", "whatIfs"],
  writes: ["whatIfs", "expenses"],
  heavy: false,
  purpose: "Splits what you take home after tax into needs, wants and savings, against the 50/30/20 rule or your own split.",
  compute,
  render,
};
