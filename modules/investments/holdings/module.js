import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "holdings",
  group: "investments",
  title: "Holdings",
  icon: "📈",
  order: 10,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["accounts", "holdings"],
  writes: ["holdings"],
  heavy: false,
  purpose: "What you hold in each investment account, what it is worth and what you paid; type it in or import the brokerage's positions file.",
  aliases: ["holdings", "positions", "portfolio", "funds", "stocks", "shares", "etf", "brokerage import", "what I own"],
  seeds: "Ghostfolio, Maybe",
  compute,
  render,
};
