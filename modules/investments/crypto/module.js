import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "crypto",
  group: "investments",
  title: "Crypto",
  icon: "📈",
  order: 130,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["accounts", "holdings", "household", "income", "taxes"],
  writes: ["holdings", "accounts"],
  heavy: false,
  purpose: "Your crypto and the funds that hold it: value against what you paid, the share of net worth, how far it could fall, and the tax if sold.",
  compute,
  render,
};
