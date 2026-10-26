import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "budget",
  group: "cashflow",
  title: "Budget",
  icon: "✉️",
  order: 70,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["budgets", "transactions", "categories"],
  writes: ["budgets"],
  heavy: false,
  purpose: "An envelope for each kind of spending: what is spent so far this month, what is left, and whether the pace is right.",
  aliases: ["budget", "envelopes", "spending limit", "how much can I spend", "over budget"],
  compute,
  render,
};
