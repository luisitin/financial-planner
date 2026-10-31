// modules/balance/accounts/module.js -- one account in detail: its balance over time, money in and out, its last checked statement, notes.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "accounts",
  group: "balance",
  title: "Account detail",
  icon: "⚖️",
  order: 20,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["accounts", "transactions", "reconciliations", "household"],
  writes: ["accounts"],
  heavy: false,
  purpose: "Shows each account's balance history, what goes in and out of it, whether its last statement was checked, and your notes on it.",
  compute,
  render,
};
