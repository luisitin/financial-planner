import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "early-access",
  group: "retirement",
  title: "Money before 59½",
  icon: "🌴",
  order: 200,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement", "assumptions"],
  writes: ["retirement"],
  heavy: false,
  purpose: "What taking money out of a 401(k) or IRA early costs in your plan, and three ways around the extra tax.",
  aliases: ["early withdrawal", "10% penalty", "72(t)", "rule of 55", "equal payments", "retire early", "59 and a half"],
  compute,
  render,
};
