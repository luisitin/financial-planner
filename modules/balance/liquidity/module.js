import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "liquidity",
  group: "balance",
  title: "Emergency fund",
  icon: "🛟",
  order: 30,
  version: 1,
  status: "usable",
  phase: 2,
  enabledByDefault: true,
  needs: ["accounts", "expenses", "assumptions"],
  // the one muted row "Some of this uses our guesses: ..." when a big guess in these sections is in use (smart guesses C6, spec 9.5)
  restsOn: ["accounts", "expenses"],
  writes: [],
  heavy: false,
  purpose: "How many months of bills your cash covers, and whether your emergency fund is big enough.",
  aliases: ["emergency fund", "rainy day fund", "how long could I last", "months of expenses", "cash on hand", "runway"],
  compute,
  render,
};
