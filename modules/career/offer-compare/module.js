import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "offer-compare",
  group: "career",
  title: "Job offer compare",
  icon: "💼",
  order: 50,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["income", "household", "retirement", "taxes", "equity", "holdings", "accounts", "assumptions", "whatIfs"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "Compares job offers on total compensation, including benefits and equity, not just salary.",
  aliases: ["job offer", "new job", "total compensation", "should I take the job", "compare jobs"],
  compute,
  render,
};
