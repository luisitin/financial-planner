// modules/overview/timeline/module.js -- the household's money life on one line, from today to the end of the plan.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "timeline",
  group: "overview",
  title: "Life timeline",
  icon: "🛤️",
  order: 70,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "debts", "debtPlan", "goals", "retirement", "assumptions"],
  writes: [],
  heavy: false,
  purpose: "Every moment from today to the end of your plan that changes your money: retiring, Social Security, Medicare, the last mortgage payment, children growing up, and whether the savings last.",
  compute,
  render,
};
