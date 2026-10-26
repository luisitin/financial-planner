import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "recurring",
  group: "cashflow",
  title: "Bills and regular payments",
  icon: "🔁",
  order: 50,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["transactions", "expenses", "income", "recurringIgnored"],
  writes: ["recurringIgnored"],
  heavy: false,
  purpose: "The payments that come back every week, month or year, when the next one is due, and which look missed.",
  aliases: ["bills", "recurring", "due soon", "what is due", "missed payment", "regular payments"],
  compute,
  render,
};
