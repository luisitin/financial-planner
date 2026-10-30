import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "buckets",
  group: "retirement",
  title: "Bucket strategy",
  icon: "🌴",
  order: 180,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "retirement", "assumptions"],
  writes: ["retirement"],
  heavy: false,
  purpose: "Cash, bond and stock buckets sized in years of your plan's own withdrawals, and the stock share they leave against your plan's.",
  compute,
  render,
};
