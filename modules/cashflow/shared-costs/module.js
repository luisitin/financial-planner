// modules/cashflow/shared-costs/module.js -- how two people who share costs split them: by what each takes home, half
// each or their own split, and what each keeps for themselves (gap design #22).
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "shared-costs",
  group: "cashflow",
  title: "Sharing costs as a couple",
  icon: "💵",
  order: 60,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["household", "income", "expenses", "debts", "retirement", "taxes", "accounts", "whatIfs"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "How two people who share costs split them: by what each takes home, half each or your own split, and what each keeps for themselves.",
  compute,
  render,
};
