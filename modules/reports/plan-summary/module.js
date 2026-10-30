// modules/reports/plan-summary/module.js -- the whole plan as one printable document.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "plan-summary",
  group: "reports",
  title: "Plan summary",
  icon: "📑",
  order: 10,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "debts", "debtPlan", "goals", "retirement", "taxes", "assumptions", "insurance"],
  writes: [],
  heavy: true,
  purpose: "Gives you a printable overview in the style of an advisor's plan: where you stand, goals, protection and next steps.",
  compute,
  render,
};
