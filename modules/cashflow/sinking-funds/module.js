import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "sinking-funds",
  group: "cashflow",
  title: "Irregular expenses",
  icon: "🗓️",
  order: 80,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["expenses", "transactions", "recurringIgnored"],
  writes: [],
  heavy: false,
  purpose: "Yearly and one-time costs turned into a monthly amount to set aside so the money is there when the bill lands.",
  aliases: ["sinking funds", "yearly bills", "set aside", "irregular", "annual costs", "save for"],
  compute,
  render,
};
