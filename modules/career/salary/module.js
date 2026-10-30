import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "salary",
  group: "career",
  title: "Salary and raises",
  icon: "💼",
  order: 10,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["income", "household", "assumptions", "taxes", "retirement", "whatIfs"],
  writes: ["whatIfs", "income"],
  heavy: false,
  purpose: "Maps out how your salary could grow with raises and promotions, shown in today's dollars.",
  aliases: ["raise", "pay rise", "promotion", "salary growth", "career earnings", "lifetime earnings"],
  compute,
  render,
};
