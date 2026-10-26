import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "withdrawal-order",
  group: "retirement",
  title: "Withdrawal order",
  icon: "🔀",
  order: 80,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement"],
  writes: ["retirement"],
  heavy: false,
  purpose: "Which account to draw from first (taxable, pre-tax or Roth) and what each order costs in lifetime tax and spending.",
  aliases: ["withdrawal order", "which account first", "sequence of withdrawals", "drawdown order", "taxable first", "roth last"],
  compute,
  render,
};
