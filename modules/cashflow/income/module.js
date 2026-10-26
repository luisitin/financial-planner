import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "income",
  group: "cashflow",
  title: "Income",
  icon: "💵",
  order: 10,
  version: 1,
  status: "usable",
  phase: 2,
  enabledByDefault: true,
  needs: ["income", "household"],
  writes: ["income"],
  heavy: false,
  purpose: "Every source of money coming in, on a monthly footing whatever the pay schedule.",
  aliases: ["salary", "paycheck", "what I earn", "how much do I make", "raise", "pay"],
  compute,
  render,
};
