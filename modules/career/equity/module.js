import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "equity",
  group: "career",
  title: "Equity compensation",
  icon: "💼",
  order: 20,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["equity", "holdings", "accounts", "income", "household", "taxes"],
  writes: ["equity"],
  heavy: false,
  purpose: "Tracks your employer stock plans: vesting and purchase schedules, the taxes they trigger and how concentrated you are.",
  aliases: ["RSU", "restricted stock", "stock options", "ISO", "incentive stock options", "AMT", "alternative minimum tax", "ESPP", "vesting"],
  compute,
  render,
};
