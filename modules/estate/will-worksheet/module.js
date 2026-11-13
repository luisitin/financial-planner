import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "will-worksheet",
  group: "estate",
  title: "Choices to take to a lawyer",
  icon: "📜",
  order: 15,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "estate", "contacts"],
  writes: ["estate"],
  heavy: false,
  purpose: "Write down who would raise the children, who carries out your wishes and who gets what, then print one sheet to take to a lawyer.",
  compute,
  render,
};
