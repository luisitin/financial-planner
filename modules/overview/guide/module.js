// modules/overview/guide/module.js -- Step by step: short guides through the real pages for one goal, in order,
// remembering where you stopped. `frame` is the shell hook that draws the guide bar above a step's page and the
// next-step card below it (docs/CONVENTIONS.md "Shell hook: frame").
import { compute } from "./compute.js";
import { render } from "./view.js";
import { frame } from "./frame.js";

export default {
  id: "guide",
  group: "overview",
  title: "Step by step",
  icon: "👣",
  order: 5,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "household", "income", "expenses", "debts", "debtPlan", "goals", "budgets", "transactions", "retirement", "taxes", "insurance", "estate", "contacts", "whatIfs", "assumptions", "guide"],
  writes: ["guide"],
  heavy: false,
  purpose: "Short guides that take you through the pages for one goal, in order, and remember where you stopped.",
  aliases: ["guide me", "guided", "walk me through", "journey"],
  compute,
  render,
  frame,
};
