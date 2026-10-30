import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "life-needs",
  group: "insurance",
  title: "Life insurance needs",
  icon: "🛡️",
  order: 20,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "accounts", "debts", "income", "expenses", "goals", "retirement", "assumptions", "insurance"],
  writes: [],
  heavy: true,
  purpose: "How much life insurance each of you needs, from your own plan and by the two usual rules of thumb, against the cover you have.",
  compute,
  render,
};
