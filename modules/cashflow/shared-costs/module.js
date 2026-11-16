// modules/cashflow/shared-costs/module.js -- how two people who share costs split them: by what each takes home, half
// each or their own split, and what each keeps for themselves (gap design #22); and bills split with others (roommates,
// friends, a trip) with who owes whom (gap list next 60, item 17; split.js).
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
  needs: ["household", "income", "expenses", "debts", "retirement", "taxes", "accounts", "whatIfs", "splitBills"],
  writes: ["whatIfs", "splitBills"],
  heavy: false,
  purpose: "How two people who share costs split them: by what each takes home, half each or your own split, and what each keeps for themselves.",
  // the bills row (gap list next 60, item 17): a person with roommates looks for these words, not "as a couple"
  aliases: ["split a bill", "split the bill", "who owes whom", "who owes me", "roommates", "settle up", "split with friends"],
  compute,
  render,
};
