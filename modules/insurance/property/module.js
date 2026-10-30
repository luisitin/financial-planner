import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "property",
  group: "insurance",
  title: "Auto, home, umbrella",
  icon: "🛡️",
  order: 80,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["accounts", "insurance"],
  writes: ["insurance"],
  heavy: false,
  purpose: "Whether your home, car and umbrella cover is enough for what you own: the cost to rebuild, the liability limits against your net worth, and the deductibles against your cash.",
  compute,
  render,
};
