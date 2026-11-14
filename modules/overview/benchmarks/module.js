// modules/overview/benchmarks/module.js -- how the household compares with families its age and the usual rules of thumb.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "benchmarks",
  group: "overview",
  title: "How am I doing",
  icon: "📏",
  order: 50,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "debts", "retirement"],
  // the one muted row "Some of this uses our guesses: ..." when a big guess in these sections is in use (smart guesses C6, spec 9.5)
  restsOn: ["accounts", "debts", "expenses", "income", "retirement"],
  writes: [],
  heavy: false,
  purpose: "Your net worth against families of your age, your retirement savings against the usual guideline for your age, and the rules of thumb for saving, cash, housing and debt.",
  compute,
  render,
};
