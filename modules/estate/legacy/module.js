import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "legacy",
  group: "estate",
  title: "Legacy goals",
  icon: "📜",
  order: 30,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "accounts", "estate", "retirement", "assumptions"],
  writes: ["estate"],
  heavy: true,
  purpose: "What you want to leave and to whom, the amount your plan should keep for it, and what would get it there.",
  compute,
  render,
};
