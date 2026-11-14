import { compute, estimators } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "rent-vs-buy",
  group: "property",
  title: "Rent vs buy",
  icon: "🏡",
  order: 20,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["whatIfs", "assumptions", "retirement"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "Renting against buying the same home: who comes out ahead after the years you stay, the year buying pulls ahead, and the rent at which they are even.",
  compute,
  estimators,   // the gray rent figure in its empty box (docs/CONVENTIONS.md "Guesses"); the other four are House down payment's
  render,
};
