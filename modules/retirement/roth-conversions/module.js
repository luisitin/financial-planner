import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "roth-conversions",
  group: "retirement",
  title: "Roth conversions",
  icon: "🔄",
  order: 90,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement"],
  writes: ["retirement"],
  heavy: false,
  purpose: "Fills a bracket with Roth conversions in the years before required withdrawals and shows what that does to lifetime tax and spending.",
  aliases: ["roth conversion", "convert to roth", "fill the bracket", "irmaa", "backdoor", "conversion ladder"],
  compute,
  render,
};
