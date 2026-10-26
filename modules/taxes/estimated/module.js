import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "estimated",
  group: "taxes",
  title: "Estimated payments",
  icon: "📅",
  order: 60,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "income", "taxes"],
  writes: ["taxes"],
  heavy: false,
  purpose: "Quarterly estimated payments: the safe-harbour amount, what is due each quarter and when, and where you stand today.",
  aliases: ["estimated tax", "quarterly", "1040-es", "safe harbor", "safe harbour", "penalty", "self-employed tax"],
  compute,
  render,
};
