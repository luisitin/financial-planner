import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "house",
  group: "goals",
  title: "House down payment",
  icon: "🎯",
  order: 30,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["income", "accounts", "debts", "goals", "assumptions", "whatIfs"],
  writes: ["whatIfs", "goals"],
  heavy: false,
  purpose: "How much home your income supports, what it costs a month, the cash you need on the day and when you will have it.",
  compute,
  render,
};
