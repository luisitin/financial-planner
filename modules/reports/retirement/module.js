// modules/reports/retirement/module.js -- the retirement pages in one printable report.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "retirement",
  group: "reports",
  title: "Retirement report",
  icon: "📘",
  order: 30,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "retirement", "assumptions", "taxes"],
  writes: [],
  heavy: true,
  purpose: "Pulls your retirement projections, Social Security, withdrawal plan and chance of success into one report.",
  compute,
  render,
};
