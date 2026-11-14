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
  // the one muted row "Some of this uses our guesses: ..." when a big guess in these sections is in use (smart guesses C6, spec 9.5)
  restsOn: ["expenses", "accounts", "debts", "income", "retirement"],
  writes: [],
  heavy: false,
  purpose: "Tells you what to do with your next spare dollar, following the well-known order: employer match, high-interest debt, emergency fund, retirement, then the rest.",
  compute,
  render,
};
