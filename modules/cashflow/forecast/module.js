import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "forecast",
  group: "cashflow",
  title: "Cash-flow forecast",
  icon: "📈",
  order: 60,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["accounts", "transactions", "expenses", "income", "recurringIgnored"],
  writes: [],
  heavy: false,
  purpose: "Where your everyday cash is heading over the next three months, day by day, and whether a shortfall is coming.",
  aliases: ["forecast", "will I run out", "balance next month", "cash flow", "projection", "shortfall"],
  compute,
  render,
};
