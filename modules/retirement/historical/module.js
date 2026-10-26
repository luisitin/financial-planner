import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "historical",
  group: "retirement",
  title: "If history repeated",
  icon: "📜",
  order: 70,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "expenses", "retirement", "assumptions"],
  writes: [],
  heavy: true,
  purpose: "Your plan replayed from every start year since 1928 with the real returns and inflation of those years.",
  aliases: ["history", "backtest", "1929", "1966", "2000", "worst case", "depression"],
  compute,
  render,
};
