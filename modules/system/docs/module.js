import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "docs",
  group: "system",
  title: "Docs",
  icon: "📚",
  order: 2,
  version: 1,
  status: "usable",
  builderOnly: true,   // a builder page: never in a household's menu (core/view.js)
  phase: 0,
  enabledByDefault: true,
  needs: [],
  writes: [],
  heavy: false,
  purpose: "Read the project documentation, including the plan and the page catalog, from any device.",
  aliases: ["help", "documentation", "how it works", "plan", "roadmap", "feedback"],
  compute,
  render,
};
