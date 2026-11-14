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
  // the one muted row "Some of this uses our guesses: ..." when a big guess in these sections is in use (smart guesses C6, spec 9.5)
  restsOn: ["expenses", "accounts", "debts", "income"],
  // our guesses' cards (overview/guesses fillCard, missingCard, upgradeCard): each writes only on its tap
  writes: ["guesses", "accounts", "debts", "expenses", "retirement", "guide"],
  heavy: false,
  purpose: "Where you stand today and what to do next.",
  aliases: ["home", "overview", "summary", "start"],
  compute,
  render,
};
