import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "longevity",
  group: "retirement",
  title: "How long to plan for",
  icon: "🕰️",
  order: 100,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "retirement"],
  writes: ["retirement"],
  heavy: false,
  purpose: "The chance of reaching each age, for each of you and for at least one of a couple, and the age the plan should run to.",
  aliases: ["life expectancy", "longevity", "how long will I live", "plan to age", "live to 95"],
  compute,
  render,
};
