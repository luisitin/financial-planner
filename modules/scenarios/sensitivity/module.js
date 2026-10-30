// modules/scenarios/sensitivity/module.js -- which of the plan's numbers move the answer most: the tornado.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "sensitivity",
  group: "scenarios",
  title: "Sensitivity",
  icon: "🌪️",
  order: 50,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement", "assumptions", "income", "expenses"],
  writes: [],
  heavy: true,
  purpose: "Which of your numbers matter most: returns, inflation, when you retire, how much you save, Social Security, each nudged down and up, ranked by how much it moves what you can spend.",
  compute,
  render,
};
