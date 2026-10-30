import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "self-employment",
  group: "taxes",
  title: "Self-employment",
  icon: "🧮",
  order: 70,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "income", "retirement", "taxes", "whatIfs"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "What a business adds in tax (self-employment and income tax), what each extra $100 keeps, the retirement room and the quarterly payments.",
  compute,
  render,
};
