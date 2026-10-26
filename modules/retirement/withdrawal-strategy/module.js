import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "withdrawal-strategy",
  group: "retirement",
  title: "How much to take out",
  icon: "🚰",
  order: 50,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "expenses", "retirement", "assumptions"],
  writes: ["retirement"],
  heavy: false,
  purpose: "Four ways of deciding what to withdraw each year, compared on your numbers and through the worst stretch of history.",
  aliases: ["4% rule", "withdrawal rate", "guardrails", "safe withdrawal", "how much can I spend in retirement"],
  compute,
  render,
};
