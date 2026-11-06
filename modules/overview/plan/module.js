// modules/overview/plan/module.js -- Your plan: the end of the path (overview/guide's "plan" journey). Your whole plan on one
// page: each answer in one plain sentence, which figures are our guesses, and what to do next.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "plan",
  group: "overview",
  title: "Your plan",
  icon: "🧭",
  order: 1.5,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "household", "income", "expenses", "debts", "debtPlan", "goals", "retirement", "taxes", "insurance", "whatIfs", "assumptions", "guesses", "guide", "reviews"],
  writes: ["assumptions", "guide"],
  heavy: false,
  purpose: "Your whole plan on one page: each answer in one plain sentence, which figures are our guesses, and what to do next.",
  aliases: ["my plan", "whole plan", "final plan", "the plan", "everything"],
  compute,
  render,
};
