// modules/transactions/reconcile/module.js -- check a bank or card statement against the ledger, and what explains a gap.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "reconcile",
  group: "transactions",
  title: "Reconcile",
  icon: "🧾",
  order: 60,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["accounts", "transactions", "reconciliations"],
  writes: ["reconciliations"],
  heavy: false,
  purpose: "Compares a statement's ending balance with your ledger and helps you find what explains any gap.",
  compute,
  render,
};
