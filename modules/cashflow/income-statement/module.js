import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "income-statement",
  group: "cashflow",
  title: "Income statement",
  icon: "📊",
  order: 30,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["transactions", "categories", "income", "expenses"],
  writes: [],
  heavy: false,
  purpose: "What came in, what went out and what you kept, month by month, from your real transactions.",
  aliases: ["profit and loss", "monthly summary", "cash flow report", "how much did I save", "savings rate"],
  compute,
  render,
};
