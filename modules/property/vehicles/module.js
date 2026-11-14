import { compute, estimators } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "vehicles",
  group: "property",
  title: "Vehicles",
  icon: "🏡",
  order: 40,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "debts", "property"],
  writes: ["property", "whatIfs"],
  heavy: false,
  purpose: "What each car really costs a year and per mile, and keeping it against buying new or leasing over the same years.",
  compute,
  estimators,   // the gray figure this page shows in an empty rate box (docs/CONVENTIONS.md "Guesses"); core/app.js merges them
  render,
};
