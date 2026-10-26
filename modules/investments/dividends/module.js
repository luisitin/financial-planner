import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "dividends",
  group: "investments",
  title: "Dividends",
  icon: "💰",
  order: 60,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["holdings"],
  writes: [],
  heavy: false,
  purpose: "The dividends and interest your holdings pay each year, by fund and by account, and what they cover of your spending.",
  aliases: ["dividends", "interest", "yield", "income from investments", "passive income", "distributions"],
  seeds: "Ghostfolio",
  compute,
  render,
};
