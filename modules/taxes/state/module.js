import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "state",
  group: "taxes",
  title: "State",
  icon: "🧮",
  order: 20,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "income", "taxes"],
  writes: ["taxes", "household"],
  heavy: false,
  purpose: "This year's state income tax: from last year's return, your state's flat rate or your own; what it saves on the federal return, and the same income in other states.",
  compute,
  render,
};
