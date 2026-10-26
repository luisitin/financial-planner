import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "capital-gains",
  group: "taxes",
  title: "Capital gains",
  icon: "📈",
  order: 40,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "income", "taxes"],
  writes: ["taxes"],
  heavy: false,
  purpose: "Tax on what you sell this year: short against long, the 0/15/20% bands, the loss allowance, and how much gain still fits at 0%.",
  aliases: ["capital gains", "sold shares", "sell stock", "long-term", "short-term", "tax-loss", "harvest", "0% gains", "NIIT"],
  compute,
  render,
};
