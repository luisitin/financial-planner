import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "statement",
  group: "balance",
  title: "Balance sheet",
  icon: "⚖️",
  order: 70,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "debts", "expenses", "taxes"],
  writes: ["-"],
  heavy: false,
  purpose: "Everything you own and owe on one printable page, by how fast it turns into cash and by owner, with the ratios.",
  compute,
  render,
};
