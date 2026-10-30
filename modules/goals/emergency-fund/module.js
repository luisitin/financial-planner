import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "emergency-fund",
  group: "goals",
  title: "Emergency fund",
  icon: "🎯",
  order: 20,
  version: 1,
  status: "usable",
  phase: 2,
  enabledByDefault: true,
  needs: ["accounts", "expenses", "income", "goals", "assumptions"],
  writes: ["goals", "assumptions"],
  heavy: false,
  purpose: "How big your emergency fund should be for your household, how far along it is, when it is full and where to keep it.",
  compute,
  render,
};
