import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "medicare",
  group: "retirement",
  title: "Medicare and IRMAA",
  icon: "🌴",
  order: 150,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "income", "retirement", "assumptions"],
  writes: ["retirement"],
  heavy: false,
  purpose: "When to sign up for Medicare, what it costs over retirement, and the income surcharge (IRMAA) year by year from your plan's own income.",
  compute,
  render,
};
