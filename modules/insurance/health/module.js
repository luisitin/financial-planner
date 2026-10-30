import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "health",
  group: "insurance",
  title: "Health plan compare",
  icon: "🛡️",
  order: 60,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["insurance", "household", "income", "taxes"],
  writes: ["insurance"],
  heavy: false,
  purpose: "The health plans you can choose from, on what each really costs a year: premiums plus your share of the bills, less HSA money and tax savings, in a quiet, usual and bad year.",
  compute,
  render,
};
