import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "rebalance",
  group: "investments",
  title: "Rebalance",
  icon: "⚖️",
  order: 30,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["accounts", "holdings", "investments"],
  writes: ["investments"],
  heavy: false,
  purpose: "The trades that bring your mix back to its target: new money first, then sells where they cost no tax and buys with the cash freed.",
  aliases: ["rebalance", "rebalancing", "trades", "what to buy", "what to sell", "new money"],
  seeds: "-",
  compute,
  render,
};
