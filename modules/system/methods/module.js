// modules/system/methods/module.js -- "How we work out the answers": for each topic, the method in plain words, the
// main sources with the day each was read, and the pages that use it. Reads nothing from the plan and writes nothing.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "methods",
  group: "system",
  title: "How we work out the answers",
  icon: "🧾",
  order: 81,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: [],
  writes: [],
  heavy: false,
  purpose: "How each kind of answer is worked out, in plain words, with its sources and the day each was read.",
  aliases: ["methods", "sources", "where the numbers come from", "how it is calculated", "formulas", "can I trust the numbers"],
  compute,
  render,
};
