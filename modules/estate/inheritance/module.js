import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "inheritance",
  group: "estate",
  title: "Expected inheritance",
  icon: "📜",
  order: 60,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement", "assumptions", "estate"],
  writes: ["estate"],
  heavy: true,
  purpose: "An inheritance you might receive, as a what-if beside your plan: what it would change if it came, and if it came smaller or later.",
  compute,
  render,
};
