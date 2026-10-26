import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "fees",
  group: "investments",
  title: "Fees",
  icon: "💸",
  order: 40,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["holdings", "investments"],
  writes: ["investments"],
  heavy: false,
  purpose: "What your funds and any advisor charge each year and what that costs over a lifetime.",
  aliases: ["fees", "expense ratio", "advisor fee", "fund costs", "what my funds cost", "index funds"],
  seeds: "-",
  compute,
  render,
};
