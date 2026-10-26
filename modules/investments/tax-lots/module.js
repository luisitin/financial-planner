import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "tax-lots",
  group: "investments",
  title: "Tax lots and harvesting",
  icon: "🧾",
  order: 120,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["holdings", "taxes"],
  writes: ["holdings"],
  heavy: false,
  purpose: "The gain or loss on each lot you hold, the losses worth harvesting in taxable accounts, and the order to sell in when you need cash.",
  aliases: ["tax lots", "lots", "harvest", "tax-loss harvesting", "wash sale", "cost basis", "which shares to sell"],
  seeds: "-",
  compute,
  render,
};
