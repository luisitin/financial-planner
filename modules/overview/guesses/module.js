// modules/overview/guesses/module.js -- "Our guesses for you": every figure the plan filled in where a box was left
// empty, the ones that change your answers most first, with a box to type the real figure. It also carries the core
// estimators and the sourced tables (guessTables) that core/app.js merges with every module's own (docs/CONVENTIONS.md
// "Guesses").
import { compute, estimators, TABLES } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "guesses",
  group: "overview",
  title: "Our guesses for you",
  icon: "🧮",
  order: 3.6,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["*"],
  writes: ["guesses", "accounts", "debts", "expenses", "income", "retirement", "goals", "guide"],
  heavy: true,
  purpose: "The figures the plan guessed for you, the ones that matter most first. Type the real ones when you have them.",
  aliases: ["guesses", "estimates", "typical figures", "our guess", "placeholders", "what you filled in for me"],
  estimators,
  guessTables: TABLES,
  compute,
  render,
};
