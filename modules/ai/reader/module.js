import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "reader",
  group: "ai",
  title: "Document reader",
  icon: "🤖",
  order: 40,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "taxes", "retirement", "advisor"],
  writes: ["income", "taxes", "retirement", "accounts", "advisor"],
  heavy: false,
  purpose: "Paste a pay stub, a statement, a Social Security statement or an advisor's plan: the figures it holds and what each would change, accepted one by one.",
  compute,
  render,
};
