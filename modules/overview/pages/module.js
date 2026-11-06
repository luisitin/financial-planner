import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "pages",
  group: "overview",
  title: "All pages",
  icon: "🗂️",
  order: 2,
  version: 1,
  status: "usable",
  phase: 0,
  enabledByDefault: true,
  needs: ["pageNotes"],
  writes: [],
  heavy: false,
  purpose: "Search every page in the app.",
  aliases: ["all pages", "directory", "everything", "list of pages", "coming soon"],
  compute,
  render,
};
