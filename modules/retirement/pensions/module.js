import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "pensions",
  group: "retirement",
  title: "Pensions",
  icon: "🌴",
  order: 40,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "retirement", "assumptions", "income"],
  writes: ["retirement"],
  heavy: false,
  purpose: "Your pension: what it pays and what inflation does to it, a lump sum against monthly payments, and the survivor option, with your own life expectancy.",
  compute,
  render,
};
