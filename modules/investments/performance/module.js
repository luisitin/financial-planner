import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "performance",
  group: "investments",
  title: "Performance",
  icon: "📊",
  order: 50,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["accounts"],
  writes: [],
  heavy: false,
  purpose: "Your true return from the balance points you save: what the investments earned and what you earned, against the plan and an index mix.",
  aliases: ["performance", "return", "how have my investments done", "irr", "time-weighted", "money-weighted", "benchmark"],
  seeds: "Portfolio Performance",
  compute,
  render,
};
