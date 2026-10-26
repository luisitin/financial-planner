import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "transfers",
  group: "transactions",
  title: "Transfers",
  icon: "🔁",
  order: 60,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["transactions", "accounts"],
  writes: ["transactions"],
  heavy: false,
  purpose: "Link money moved between your own accounts so it is not counted as spending or income.",
  aliases: ["moving money between accounts", "credit card payment", "internal transfer"],
  compute,
  render,
};
