// modules/overview/next-best-action/module.js -- where the next spare dollar goes, in the well-known order.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "next-best-action",
  group: "overview",
  title: "Next best action",
  icon: "🧭",
  order: 40,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "debts", "goals", "retirement", "taxes", "assumptions"],
  writes: [],
  heavy: false,
  purpose: "Tells you what to do with your next spare dollar, following the well-known order: employer match, high-interest debt, emergency fund, retirement, then the rest.",
  compute,
  render,
};
