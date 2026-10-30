import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "filing-status",
  group: "taxes",
  title: "Filing status compare",
  icon: "🧮",
  order: 90,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "income", "retirement", "taxes"],
  writes: [],
  heavy: false,
  purpose: "Which way to file: a couple jointly or separately, a single parent as head of household, with this year's federal tax each way.",
  compute,
  render,
};
