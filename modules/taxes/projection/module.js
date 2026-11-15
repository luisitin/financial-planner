import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "projection",
  group: "taxes",
  title: "Tax, year by year",
  icon: "📆",
  order: 80,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement", "taxes"],
  writes: [],
  heavy: false,
  purpose: "Federal tax, and the state's where the app has its rules, in every year of the retirement plan: the totals, the worst years, and how the flat rate compares.",
  aliases: ["tax projection", "lifetime tax", "tax each year", "retirement taxes", "tax torpedo", "state tax in retirement", "gain harvesting", "tax-free gains", "0% capital gains"],
  compute,
  render,
};
