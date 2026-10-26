import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "cash-flow",
  group: "retirement",
  title: "Year by year",
  icon: "📅",
  order: 40,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "expenses", "income", "retirement", "assumptions"],
  writes: [],
  heavy: false,
  purpose: "Every year of the plan in one table: ages, what comes in, what goes out, what is taken from where, what is left.",
  aliases: ["cash flow table", "year by year", "ledger", "retirement table", "withdrawals by year"],
  compute,
  render,
};
