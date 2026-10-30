import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "healthcare",
  group: "retirement",
  title: "Healthcare before 65",
  icon: "🌴",
  order: 140,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "income", "retirement", "assumptions"],
  writes: ["retirement"],
  heavy: false,
  purpose: "Health cover between retiring and Medicare: the marketplace credit on your plan's own income, what is left to pay, and the cliff where the credit stops.",
  compute,
  render,
};
