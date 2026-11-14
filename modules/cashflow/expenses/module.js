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
  // the one muted row "Some of this uses our guesses: ..." when a big guess in these sections is in use (smart guesses C6, spec 9.5)
  restsOn: ["expenses"],
  // (and "Is something missing?": our guesses for the rest, or guide.spendComplete)
  writes: ["expenses", "guesses", "guide"],
  heavy: false,
  purpose: "Your regular spending by category, split into what you must pay and what could be cut.",
  aliases: ["spending", "bills", "what I spend", "where my money goes", "budget", "rent", "groceries", "subscriptions"],
  compute,
  render,
};
