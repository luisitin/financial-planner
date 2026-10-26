import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "liabilities",
  group: "balance",
  title: "Debts",
  icon: "💳",
  order: 50,
  version: 1,
  status: "usable",
  phase: 2,
  enabledByDefault: true,
  needs: ["accounts", "debts", "income"],
  writes: ["debts"],
  heavy: false,
  purpose: "Every loan and card with its rate and payment: what interest costs you and when each one is gone.",
  aliases: ["what I owe", "loans", "credit cards", "mortgage", "how much debt do I have", "pay off debt", "interest"],
  compute,
  render,
};
