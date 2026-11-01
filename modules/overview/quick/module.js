// modules/overview/quick/module.js -- Quick answers: questions that answer in a minute on their own page, nothing to set up.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "quick",
  group: "overview",
  title: "Quick answers",
  icon: "⚡",
  order: 4,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "debts", "assumptions", "taxes"],
  writes: [],
  heavy: false,
  purpose: "Questions you can answer in a minute with your own numbers, with nothing to set up first.",
  aliases: ["calculator", "calculators", "quick answer", "quick question"],
  compute,
  render,
};
