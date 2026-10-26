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
  purpose: "Federal tax in every year of the retirement plan through the real brackets: the totals, the worst years, and how the flat setting compares.",
  aliases: ["tax projection", "lifetime tax", "tax each year", "retirement taxes", "tax torpedo"],
  compute,
  render,
};
