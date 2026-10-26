import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "fire",
  group: "retirement",
  title: "Financial independence",
  icon: "🔥",
  order: 110,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "expenses", "income", "retirement", "assumptions"],
  writes: [],
  heavy: false,
  purpose: "The pot that could pay for your life without a paycheck, how far you are, and the years to get there at your pace.",
  aliases: ["fire", "financial independence", "fi number", "coast fire", "retire early", "savings rate"],
  compute,
  render,
};
