// modules/ai/critic/module.js -- the AI lists the gaps and risks it sees in a summary of the plan, each linked to a page.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "critic",
  group: "ai",
  title: "Plan critic",
  icon: "🤖",
  order: 50,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "accounts", "income", "expenses", "goals", "retirement", "insurance", "estate", "assumptions"],
  writes: [],
  heavy: false,
  purpose: "Asks the AI to list the gaps and risks it sees in your plan, each linked to the page where you can fix it.",
  compute,
  render,
};
