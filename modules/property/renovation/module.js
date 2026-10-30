import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "renovation",
  group: "property",
  title: "Renovation",
  icon: "🏡",
  order: 60,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "debts", "expenses", "taxes", "assumptions"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "A home project against what it adds to the home's value, and the cheapest way to pay: cash, a home-equity line, a cash-out refinance or a loan.",
  compute,
  render,
};
