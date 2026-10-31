// modules/ai/explain/module.js -- pick a page and the AI helper explains its numbers in plain words (names hidden first).
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "explain",
  group: "ai",
  title: "Explain this page",
  icon: "🤖",
  order: 20,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["*"],
  writes: [],
  heavy: false,
  purpose: "Pick a page and the AI helper explains its numbers in plain words, with people's names hidden before anything is sent.",
  compute,
  render,
};
