import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "goals",
  group: "goals",
  title: "Goals",
  icon: "🎯",
  order: 10,
  version: 1,
  status: "usable",
  phase: 2,
  enabledByDefault: true,
  needs: ["goals", "accounts", "assumptions"],
  writes: ["goals"],
  heavy: false,
  purpose: "What you are saving for, by when, and what to put aside each month to get there.",
  aliases: ["saving for", "targets", "down payment", "college fund", "vacation", "what I am saving for"],
  compute,
  render,
};
