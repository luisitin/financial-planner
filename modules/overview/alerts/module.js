import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "alerts",
  group: "overview",
  title: "Needs attention",
  icon: "🔔",
  order: 30,
  version: 1,
  status: "usable",
  phase: 2,
  enabledByDefault: true,
  needs: ["household", "accounts", "netWorthHistory", "income", "expenses", "debts", "goals", "assumptions"],
  writes: [],
  heavy: false,
  purpose: "One list of what needs your attention, worst first, each opening the page where it is fixed.",
  aliases: ["alerts", "warnings", "problems", "what should I fix", "to do", "reminders"],
  compute,
  render,
};
