// modules/overview/monthly-review/module.js -- the month in ten minutes, and the months reviewed.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "monthly-review",
  group: "overview",
  title: "Monthly review",
  icon: "🗓️",
  order: 80,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["accounts", "netWorthHistory", "transactions", "budgets", "goals", "income", "expenses", "reviews"],
  writes: ["reviews"],
  heavy: false,
  purpose: "Walks you through the month in ten minutes: fresh balances, the bank files, spending against the budget, the change in net worth, goals and what needs attention, then marks it reviewed with a note.",
  compute,
  render,
};
