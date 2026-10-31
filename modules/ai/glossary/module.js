// modules/ai/glossary/module.js -- every money word the app uses, in plain words, with a search and the words for your plan.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "glossary",
  group: "ai",
  title: "Glossary",
  icon: "🤖",
  order: 60,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "income", "equity", "household"],
  writes: [],
  heavy: false,
  purpose: "Explains every money word used in the app in plain words, with an example and the pages that use it, and lets you search for any of them.",
  compute,
  render,
};
