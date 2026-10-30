// modules/system/diagnostics/module.js -- is everything working: a check of the plan, every page's sums, the PC and the AI.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "diagnostics",
  group: "system",
  title: "Diagnostics",
  icon: "⚙️",
  order: 70,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "goals", "debts", "retirement", "transactions", "holdings", "rules", "insurance", "estate", "events", "property", "assumptions"],
  writes: ["income", "accounts", "retirement", "goals", "rules", "insurance", "estate", "events", "property", "debts", "household", "expenses", "holdings", "transactions", "assumptions"],
  heavy: false,
  purpose: "Checks on one page that your plan holds together, that every page can work out its numbers, and whether the PC and the AI helper answer.",
  compute,
  render,
};
