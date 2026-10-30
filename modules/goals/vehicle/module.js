import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "vehicle",
  group: "goals",
  title: "Vehicle",
  icon: "🎯",
  order: 50,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["goals", "income", "expenses", "assumptions", "whatIfs"],
  writes: ["goals", "whatIfs"],
  heavy: false,
  purpose: "Your next car paid in cash or financed: the saving a month for cash, the loan for the rest, and the 20/4/10 rule.",
  compute,
  render,
};
