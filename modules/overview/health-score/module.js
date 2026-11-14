// modules/overview/health-score/module.js -- the whole plan as one score out of 100, and where the missing points are.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "health-score",
  group: "overview",
  title: "Plan health score",
  icon: "💯",
  order: 60,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "debts", "goals", "retirement", "taxes", "assumptions", "insurance"],
  // the one muted row "Some of this uses our guesses: ..." when a big guess in these sections is in use (smart guesses C6, spec 9.5)
  restsOn: ["accounts", "debts", "expenses", "income", "retirement"],
  writes: [],
  heavy: true,
  purpose: "Your whole plan as one score from 0 to 100: emergency fund, saving, debt, retirement, protection, goals and how complete it is, with where the missing points are.",
  compute,
  render,
};
