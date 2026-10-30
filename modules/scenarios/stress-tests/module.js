// modules/scenarios/stress-tests/module.js -- the plan run through real market crises and life's shocks, one at a time.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "stress-tests",
  group: "scenarios",
  title: "Stress tests",
  icon: "⛈️",
  order: 20,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "retirement", "assumptions", "insurance"],
  writes: [],
  heavy: true,
  purpose: "Your plan run through a crash the year you retire, a decade of high prices, a job loss, an illness, losing a partner and a long life: which ones it survives and what would fix the rest.",
  compute,
  render,
};
