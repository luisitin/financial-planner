// modules/insurance/policies/module.js -- every insurance policy the household holds, on one footing.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "policies",
  group: "insurance",
  title: "Policies",
  icon: "📋",
  order: 10,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["insurance", "household"],
  writes: ["insurance"],
  heavy: false,
  purpose: "Every policy you hold (life, disability, care, health, home, car, umbrella) with what it pays, what it costs a year, whom it covers and when it ends or renews.",
  compute,
  render,
};
