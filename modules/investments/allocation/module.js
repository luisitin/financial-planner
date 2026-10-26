import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "allocation",
  group: "investments",
  title: "Allocation",
  icon: "🥧",
  order: 20,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["accounts", "holdings", "investments"],
  writes: ["investments"],
  heavy: false,
  purpose: "Your mix by asset class across every account against the mix you aim for, and how far each class has drifted.",
  aliases: ["allocation", "asset mix", "asset allocation", "drift", "target mix", "stocks bonds split", "how much in stocks"],
  seeds: "Ghostfolio",
  compute,
  render,
};
