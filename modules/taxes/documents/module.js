import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "documents",
  group: "taxes",
  title: "Tax documents checklist",
  icon: "🧮",
  order: 100,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "income", "accounts", "taxes", "insurance", "retirement"],
  writes: ["taxes"],
  heavy: false,
  purpose: "The forms to gather for your tax return, worked out from your plan, when each arrives, and a tick as each comes.",
  compute,
  render,
};
