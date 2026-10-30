import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "consolidation",
  group: "debt",
  title: "Consolidation",
  icon: "💳",
  order: 70,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["accounts", "debts", "whatIfs"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "Your high-rate debts rolled into one: a personal loan, a 0% balance-transfer card or a home-equity line against paying as now.",
  compute,
  render,
};
