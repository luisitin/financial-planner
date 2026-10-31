import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "hsa-fsa",
  group: "taxes",
  title: "HSA and FSA",
  icon: "🩺",
  order: 110,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement", "income", "taxes"],
  writes: ["taxes"],
  heavy: false,
  purpose: "The health savings account: its limit, the room left, the tax it saves, what it grows into; and the FSA use-it-or-lose-it deadline.",
  aliases: ["hsa", "fsa", "health savings", "flexible spending", "high deductible", "medical"],
  compute,
  render,
};
