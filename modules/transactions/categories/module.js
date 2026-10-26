import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "categories",
  group: "transactions",
  title: "Categories",
  icon: "🏷️",
  order: 50,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["categories", "transactions"],
  writes: ["categories", "transactions"],
  heavy: false,
  purpose: "The categories transactions are filed under: rename, hide, or add your own.",
  aliases: ["tags", "labels", "kinds of spending", "category list"],
  compute,
  render,
};
