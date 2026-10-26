import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "mortgage",
  group: "debt",
  title: "Mortgage",
  icon: "🏠",
  order: 20,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["accounts", "debts", "debtPlan"],
  writes: [],
  heavy: false,
  purpose: "Your mortgage's schedule, and what extra payments, paying every two weeks or a recast would save.",
  aliases: ["mortgage", "house payment", "pay off the house", "biweekly", "recast", "pmi", "mortgage insurance"],
  compute,
  render,
};
