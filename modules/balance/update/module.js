import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "update",
  group: "balance",
  title: "Update my balances",
  icon: "🔄",
  order: 15,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "netWorthHistory"],
  writes: ["accounts", "netWorthHistory"],
  heavy: false,
  purpose: "Every account on one screen: type today's balances, save once, and they are dated today with your net worth saved.",
  aliases: ["update balances", "refresh balances", "new balances", "monthly balances", "balances out of date", "update accounts"],
  compute,
  render,
};
