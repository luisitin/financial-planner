import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "dashboard",
  group: "overview",
  title: "Dashboard",
  icon: "🏠",
  order: 1,
  version: 1,
  status: "usable",
  phase: 0,
  enabledByDefault: true,
  needs: ["accounts", "goals", "household", "income", "expenses", "transactions"],
  writes: [],
  heavy: false,
  purpose: "Where you stand today, what to do next, and what the app will do soon.",
  aliases: ["home", "overview", "summary", "start"],
  compute,
  render,
};
