import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "purchase",
  group: "property",
  title: "Big purchase planner",
  icon: "🏡",
  order: 50,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["income", "expenses", "goals", "accounts", "assumptions"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "Any big purchase: save up by the date you want it, finance it now or pay cash, and which goals would give way.",
  compute,
  render,
};
