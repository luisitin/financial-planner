import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "contributions",
  group: "retirement",
  title: "Retirement contributions",
  icon: "🏦",
  order: 20,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement"],
  writes: ["retirement"],
  heavy: false,
  purpose: "What goes into 401(k)s, IRAs, Roths and HSAs each year, with the employer match and this year's limits.",
  aliases: ["401k", "ira", "roth", "hsa", "employer match", "contribution limit", "how much can I put in"],
  compute,
  render,
};
