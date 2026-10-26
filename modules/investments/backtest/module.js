import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "backtest",
  group: "investments",
  title: "Backtest",
  icon: "⏪",
  order: 100,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["investments"],
  writes: [],
  heavy: false,
  purpose: "Any stocks-and-bonds mix run through the years since 1871, side by side with another: growth, the worst years, the deepest fall.",
  aliases: ["backtest", "history", "1929", "2008", "60/40", "what would have happened", "since 1871"],
  seeds: "Simba, Shiller",
  compute,
  render,
};
