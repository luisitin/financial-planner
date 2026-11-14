import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "budget",
  group: "cashflow",
  title: "Budget",
  icon: "✉️",
  order: 70,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["budgets", "budgetPlan", "transactions", "categories", "expenses", "income"],
  writes: ["budgets", "budgetPlan", "whatIfs"],
  heavy: false,
  purpose: "An envelope for each kind of spending: what you have spent so far this month, what is left, whether you are on pace, and how much is safe to spend this week.",
  aliases: ["budget", "envelopes", "spending limit", "how much can I spend", "over budget", "safe to spend", "free to spend", "spending money this week"],
  compute,
  render,
};
