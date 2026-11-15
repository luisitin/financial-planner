import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "limits",
  group: "investments",
  title: "Contribution limits",
  icon: "🚧",
  order: 110,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement", "income", "taxes"],
  writes: ["retirement"],   // only retirement.workPlans[person].afterTax / .afterTaxToRoth, the two answers of "After-tax money into Roth"
  heavy: false,
  purpose: "This year’s limits for 401(k)s, IRAs, HSAs, FSAs and 529 gifts against what is going in, the room left, the Roth income check and the deadlines.",
  aliases: ["contribution limits", "401k limit", "ira limit", "hsa limit", "room left", "catch-up", "roth income limit", "backdoor", "mega backdoor", "after-tax 401k", "after-tax money into roth"],
  seeds: "-",
  compute,
  render,
};
