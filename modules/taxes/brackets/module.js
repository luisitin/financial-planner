import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "brackets",
  group: "taxes",
  title: "Bracket explorer",
  icon: "🪜",
  order: 20,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "income", "taxes"],
  writes: [],
  heavy: false,
  purpose: "Which bracket your next dollar lands in, how much room is left before the next rate, and what a raise, bonus or conversion would really cost.",
  aliases: ["tax bracket", "marginal", "next dollar", "room in bracket", "22%", "24%", "raise", "bonus tax"],
  compute,
  render,
};
