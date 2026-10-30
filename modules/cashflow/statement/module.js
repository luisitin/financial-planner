import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "statement",
  group: "cashflow",
  title: "Cash-flow statement",
  icon: "💵",
  order: 120,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["household", "income", "expenses", "accounts", "debts", "retirement", "transactions", "taxes"],
  writes: ["-"],
  heavy: false,
  purpose: "A year of your money the way a business reports it: living, investing and debts, adding up to what is left in cash.",
  compute,
  render,
};
