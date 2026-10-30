import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "charitable",
  group: "goals",
  title: "Giving",
  icon: "🎯",
  order: 70,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["household", "income", "taxes", "accounts", "whatIfs"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "What your giving saves in tax and really costs, and how to give the same for less: bunching, shares that have grown, gifts from an IRA.",
  compute,
  render,
};
