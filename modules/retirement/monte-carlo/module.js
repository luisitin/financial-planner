import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "monte-carlo",
  group: "retirement",
  title: "Chance the money lasts",
  icon: "🎲",
  order: 60,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "expenses", "retirement", "assumptions"],
  writes: [],
  heavy: true,
  purpose: "The plan run thousands of times with returns drawn at random: the share of runs where the money lasts, and the range.",
  aliases: ["monte carlo", "probability of success", "odds", "simulation", "chance of running out"],
  compute,
  render,
};
