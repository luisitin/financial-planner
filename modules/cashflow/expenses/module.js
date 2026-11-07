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
  // (and "Is something missing?": our guesses for the rest, or guide.spendComplete)
  writes: ["expenses", "guesses", "guide"],
  heavy: false,
  purpose: "Your regular spending by category, split into what you must pay and what could be cut.",
  aliases: ["spending", "bills", "what I spend", "where my money goes", "budget", "rent", "groceries", "subscriptions"],
  compute,
  render,
};
