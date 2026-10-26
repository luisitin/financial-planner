import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "refinance",
  group: "debt",
  title: "Refinance",
  icon: "🔄",
  order: 50,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["accounts", "debts", "debtPlan"],
  writes: ["debtPlan"],
  heavy: false,
  purpose: "Whether a refinance offer pays: the new payment, when the closing costs are earned back, and the interest either way.",
  aliases: ["refinance", "refi", "new rate", "closing costs", "break even"],
  compute,
  render,
};
