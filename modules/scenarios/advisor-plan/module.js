import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "advisor-plan",
  group: "scenarios",
  title: "Advisor's plan",
  icon: "🔀",
  order: 30,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "retirement", "assumptions", "advisor"],
  writes: ["advisor"],
  heavy: true,
  purpose: "Your advisor's assumptions and fee run through the same engine as your plan: which assumption makes the difference, and what the fee costs.",
  compute,
  render,
};
