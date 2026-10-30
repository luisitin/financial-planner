import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "projection",
  group: "balance",
  title: "Net worth projection",
  icon: "⚖️",
  order: 60,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "debts", "income", "retirement", "assumptions"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "Net worth in the years ahead: savings growing and spent in retirement, the home's value, debts paid down, in today's money.",
  compute,
  render,
};
