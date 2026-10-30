import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "estate-tax",
  group: "estate",
  title: "Estate tax",
  icon: "📜",
  order: 40,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "accounts", "insurance", "estate", "retirement"],
  writes: ["estate"],
  heavy: false,
  purpose: "Whether your estate could owe federal or state estate tax, at each death for a couple and at the end of the plan, and how much of the exemption is left.",
  compute,
  render,
};
