import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "dashboard",
  group: "overview",
  title: "Dashboard",
  icon: "🏠",
  order: 1,
  version: 1,
  status: "usable",
  phase: 0,
  enabledByDefault: true,
  needs: ["accounts", "goals", "household", "income", "expenses", "transactions"],
  // our guesses' cards (overview/guesses fillCard, missingCard, upgradeCard): each writes only on its tap
  writes: ["guesses", "accounts", "debts", "expenses", "retirement", "guide"],
  heavy: false,
  purpose: "Where you stand today and what to do next.",
  aliases: ["home", "overview", "summary", "start"],
  compute,
  render,
};
