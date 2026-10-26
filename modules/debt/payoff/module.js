import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "payoff",
  group: "debt",
  title: "Pay off debts",
  icon: "🎯",
  order: 10,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["accounts", "debts", "debtPlan"],
  writes: ["debtPlan"],
  heavy: false,
  purpose: "One plan for every loan and card: the same money each month, highest rate or smallest balance first, and the date each one is gone.",
  aliases: ["payoff", "snowball", "avalanche", "get out of debt", "debt free", "extra payment"],
  compute,
  render,
};
