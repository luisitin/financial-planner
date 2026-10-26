import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "assumptions",
  group: "system",
  title: "Assumptions",
  icon: "🎛️",
  order: 30,
  version: 1,
  status: "usable",
  phase: 2,
  enabledByDefault: true,
  needs: ["assumptions"],
  writes: ["assumptions"],
  heavy: false,
  purpose: "The ten numbers behind every projection: inflation, growth, retirement age, how long the money must last.",
  aliases: ["inflation", "returns", "growth rate", "retirement age", "life expectancy", "settings for the math"],
  compute,
  render,
};
