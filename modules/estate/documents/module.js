import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "documents",
  group: "estate",
  title: "Documents checklist",
  icon: "📜",
  order: 10,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "estate"],
  writes: ["estate"],
  heavy: false,
  purpose: "Your will, powers of attorney and health papers: which are signed, where they are kept, and which to look at again.",
  compute,
  render,
};
