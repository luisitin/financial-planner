// modules/debt/credit-score/module.js -- "Your credit score": the score you saw and when, what it means on its scale, the
// one thing that would lift it most, and how to freeze your credit or fix a mistake on your report. A typed score only:
// nothing is fetched from a bureau.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "credit-score",
  group: "debt",
  title: "Your credit score",
  icon: "⭐",
  order: 45,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["credit", "household", "accounts", "debts"],
  writes: ["credit"],
  heavy: false,
  purpose: "Keep the score you saw and when, what it means on its scale, the one thing that would lift it most, and how to freeze your credit or fix a mistake on your report.",
  aliases: ["credit score", "fico", "vantagescore", "credit freeze", "fraud alert", "credit report", "dispute"],
  compute,
  render,
};
