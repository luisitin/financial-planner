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
  writes: ["holdings", "whatIfs"],
  heavy: false,
  purpose: "The gain or loss on each batch of shares you bought, the losses worth selling for a tax break in taxable accounts, and the order to sell in when you need cash.",
  aliases: ["tax lots", "lots", "harvest", "tax-loss harvesting", "wash sale", "cost basis", "which shares to sell", "which shares to sell first", "first in first out", "fifo", "highest cost first", "specific shares", "sales for the tax preparer", "form 8949"],
  seeds: "-",
  compute,
  render,
};
