import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "social-security",
  group: "retirement",
  title: "Social Security",
  icon: "🇺🇸",
  order: 30,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "retirement"],
  writes: ["retirement"],
  heavy: false,
  purpose: "Your benefit from your ssa.gov earnings record or your statement, and what claiming at each age pays.",
  aliases: ["social security", "ssa", "claiming age", "when to claim", "benefit at 62", "benefit at 70"],
  compute,
  render,
};
