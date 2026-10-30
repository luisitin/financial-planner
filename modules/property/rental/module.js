import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "rental",
  group: "property",
  title: "Rental analysis",
  icon: "🏡",
  order: 30,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["property", "accounts", "debts", "income", "taxes"],
  writes: ["property"],
  heavy: false,
  purpose: "What a rental really earns: rent less empty months and costs, the loan and tax, the checks a lender makes, and what it adds to your wealth.",
  compute,
  render,
};
