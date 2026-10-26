import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "ratios",
  group: "debt",
  title: "What lenders see",
  icon: "🏦",
  order: 40,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["accounts", "debts", "income", "expenses"],
  writes: [],
  heavy: false,
  purpose: "Debt-to-income, housing and card-use ratios with the lines lenders draw, so you know what an application looks like.",
  aliases: ["debt to income", "dti", "ratios", "can I get a mortgage", "lender", "qualify"],
  compute,
  render,
};
