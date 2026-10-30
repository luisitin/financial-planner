import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "prioritizer",
  group: "goals",
  title: "Goal prioritiser",
  icon: "🎯",
  order: 80,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["goals", "income", "expenses", "retirement", "taxes", "whatIfs"],
  writes: ["goals", "whatIfs"],
  heavy: false,
  purpose: "The money left each month shared across your goals by priority and date: which arrive on time and how late the rest would be.",
  compute,
  render,
};
