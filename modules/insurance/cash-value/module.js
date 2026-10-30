import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "cash-value",
  group: "insurance",
  title: "Cash-value model",
  icon: "🛡️",
  order: 40,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["insurance", "assumptions", "retirement"],
  writes: ["insurance"],
  heavy: false,
  purpose: "A whole or universal life policy you own, as an investment: what it has really earned, what cashing in leaves after tax, and whether to keep it.",
  compute,
  render,
};
