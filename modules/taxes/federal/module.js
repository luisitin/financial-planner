import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "federal",
  group: "taxes",
  title: "Federal estimate",
  icon: "🧮",
  order: 10,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "income", "taxes"],
  writes: ["taxes"],
  heavy: false,
  purpose: "This year's federal income tax from what the plan knows and what you type: the bill or refund, your effective and marginal rates.",
  aliases: ["tax", "taxes", "1040", "refund", "owe", "effective rate", "marginal rate", "standard deduction", "itemized", "withheld"],
  seeds: "UsTaxes, PolicyEngine",
  compute,
  render,
};
