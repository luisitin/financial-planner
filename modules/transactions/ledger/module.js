import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "ledger",
  group: "transactions",
  title: "Ledger",
  icon: "📒",
  order: 10,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["transactions", "accounts", "categories"],
  writes: ["transactions"],
  heavy: false,
  purpose: "Every transaction in one list you can filter, search and correct.",
  aliases: ["transactions", "bank activity", "history", "what did I buy", "statement"],
  compute,
  render,
};
