import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "term-vs-permanent",
  group: "insurance",
  title: "Term vs permanent",
  icon: "🛡️",
  order: 30,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["insurance", "assumptions", "retirement"],
  writes: ["insurance"],
  heavy: false,
  purpose: "Whole life against buying term and investing the difference, with the illustration's own numbers: which is ahead, and the return that decides it.",
  compute,
  render,
};
