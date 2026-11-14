import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "compare",
  group: "scenarios",
  title: "Scenario compare",
  icon: "🔀",
  order: 10,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "retirement", "assumptions", "scenarios"],
  writes: ["scenarios", "household", "retirement", "assumptions", "guide"],   // the last four only by "Make this my plan" and its way back
  heavy: true,
  purpose: "Copies of your plan with a few things changed, side by side: does the money last, the chance it lasts, what you could spend.",
  compute,
  render,
};
