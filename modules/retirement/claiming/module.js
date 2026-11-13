import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "claiming",
  group: "retirement",
  title: "When to start Social Security",
  icon: "⏳",
  order: 31,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "retirement"],
  writes: ["retirement"],
  heavy: false,
  purpose: "The ages to start Social Security that pay the most over your lives, for a couple or for one, with what the one left keeps, the chance of living each year and how much later years count.",
  aliases: ["best age to start social security", "claiming strategy", "when should we claim", "survivor benefit", "spousal benefit", "62 or 70"],
  compute,
  render,
};
