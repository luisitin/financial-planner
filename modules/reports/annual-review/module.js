// modules/reports/annual-review/module.js -- the year in review as one printable pack.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "annual-review",
  group: "reports",
  title: "Annual review pack",
  icon: "📚",
  order: 50,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["reviews", "netWorthHistory", "transactions", "goals", "household", "accounts", "income", "expenses", "retirement"],
  writes: [],
  heavy: true,
  purpose: "The year in one pack: net worth from start to end, the money in and out, where it went, the months you reviewed and their notes, the goals, and what next year holds.",
  compute,
  render,
};
