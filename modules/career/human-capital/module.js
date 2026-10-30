import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "human-capital",
  group: "career",
  title: "Human capital",
  icon: "💼",
  order: 70,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "income", "accounts", "insurance", "retirement", "assumptions"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "What all the pay you are still going to earn is worth today, against your savings over the years, and what it means for insurance and investing.",
  compute,
  render,
};
