import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "glide-path",
  group: "investments",
  title: "Glide path",
  icon: "🛬",
  order: 80,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["household", "holdings", "retirement"],
  writes: ["investments"],
  heavy: false,
  purpose: "How much of your money should be in stocks at each age: the plan’s path, the rules of thumb, and where you stand today.",
  aliases: ["glide path", "stock share by age", "110 minus age", "age in bonds", "how much stock at my age"],
  seeds: "TPAW",
  compute,
  render,
};
