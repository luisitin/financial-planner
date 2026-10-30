import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "ltc",
  group: "insurance",
  title: "Long-term care",
  icon: "🛡️",
  order: 70,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "retirement", "assumptions", "insurance"],
  writes: ["insurance"],
  heavy: true,
  purpose: "The odds you will need care in later life, what it costs, and whether your plan could pay for it or a policy would help.",
  compute,
  render,
};
