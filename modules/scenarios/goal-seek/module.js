// modules/scenarios/goal-seek/module.js -- set the goal, and every lever is solved for it on its own.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "goal-seek",
  group: "scenarios",
  title: "Goal seek",
  icon: "🎯",
  order: 40,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement", "assumptions", "income", "expenses"],
  writes: [],
  heavy: true,
  purpose: "Set the goal (the money lasts and leaves what you want to leave) and see what each lever would have to be: what you can spend, when you can retire, what to save, the return it needs, when to claim Social Security.",
  compute,
  render,
};
