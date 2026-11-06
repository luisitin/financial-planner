// modules/ai/categorizer/module.js -- sort many transactions at once with the AI, then review and file them.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "categorizer",
  group: "ai",
  title: "Categoriser",
  icon: "🤖",
  order: 30,
  version: 1,
  status: "usable",
  requires: "ai",   // needs the AI helper (through the PC): offered only while it answers (core/view.js)
  phase: 3,
  enabledByDefault: true,
  needs: ["transactions", "rules", "categories"],
  writes: ["transactions", "rules"],
  heavy: false,
  purpose: "Categorises transactions in bulk with the AI, shows how confident it is about each and gives you a list to review before anything is filed.",
  compute,
  render,
};
