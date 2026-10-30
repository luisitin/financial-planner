// modules/reports/tax/module.js -- the tax pages in one printable report.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "tax",
  group: "reports",
  title: "Tax report",
  icon: "🧾",
  order: 40,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "income", "taxes", "retirement", "accounts", "assumptions"],
  writes: [],
  heavy: true,
  purpose: "Reports your tax picture for this year alongside the multi-year projection.",
  compute,
  render,
};
