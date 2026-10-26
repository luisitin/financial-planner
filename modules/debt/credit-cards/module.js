import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "credit-cards",
  group: "debt",
  title: "Credit cards",
  icon: "💳",
  order: 30,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["accounts", "debts", "debtPlan"],
  writes: ["debtPlan"],
  heavy: false,
  purpose: "How much of your card limits you use, what paying the minimum really costs, and whether a balance transfer helps.",
  aliases: ["credit cards", "utilization", "minimum payment", "balance transfer", "card limit"],
  compute,
  render,
};
