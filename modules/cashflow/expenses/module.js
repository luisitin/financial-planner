import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "expenses",
  group: "cashflow",
  title: "Expenses",
  icon: "🧾",
  order: 20,
  version: 1,
  status: "usable",
  phase: 2,
  enabledByDefault: true,
  needs: ["expenses", "income", "household"],
  writes: ["expenses"],
  heavy: false,
  purpose: "Your regular spending by category, split into what you must pay and what is nice to have.",
  aliases: ["spending", "bills", "what I spend", "where my money goes", "budget", "rent", "groceries", "subscriptions"],
  compute,
  render,
};
