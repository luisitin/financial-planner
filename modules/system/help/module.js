import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "help",
  group: "system",
  title: "Help",
  icon: "⚙️",
  order: 80,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "debts", "goals", "retirement"],
  writes: ["-"],
  heavy: false,
  purpose: "How the app works, the first steps and which are done, every page with what it is for, and the questions people ask.",
  compute,
  render,
};
