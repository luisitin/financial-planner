import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "disability",
  group: "insurance",
  title: "Disability",
  icon: "🛡️",
  order: 50,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "income", "expenses", "accounts", "retirement", "insurance"],
  writes: ["insurance"],
  heavy: false,
  purpose: "If you could not work: what your cover would pay against your pay, whether the bills would still get paid, and whether your cash lasts until the money starts.",
  compute,
  render,
};
