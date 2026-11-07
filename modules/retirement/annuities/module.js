import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "annuities",
  group: "retirement",
  title: "Annuities",
  icon: "🌴",
  order: 50,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "retirement", "assumptions", "property", "debts"],
  writes: ["retirement"],
  heavy: true,
  purpose: "An annuity quote checked against your plan: the yearly return it works out to over your likely lifetime, what bonds paying the same would cost, and what buying it does to your plan.",
  compute,
  render,
};
