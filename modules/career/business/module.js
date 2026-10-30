import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "business",
  group: "career",
  title: "Small business",
  icon: "💼",
  order: 40,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["income", "household", "taxes", "retirement", "accounts", "whatIfs"],
  writes: ["whatIfs", "income"],
  heavy: false,
  purpose: "Tracks your small business's profit and loss, what you pay yourself and your self-employed retirement plans.",
  aliases: ["profit and loss", "P&L", "sole proprietor", "S corporation", "S corp", "SEP-IRA", "solo 401k", "SIMPLE IRA", "home office", "owner pay"],
  compute,
  render,
};
