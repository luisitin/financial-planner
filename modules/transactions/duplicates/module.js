import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "duplicates",
  group: "transactions",
  title: "Duplicates",
  icon: "👯",
  order: 70,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["transactions", "accounts"],
  writes: ["transactions"],
  heavy: false,
  purpose: "Find lines that were imported twice and remove the copy.",
  aliases: ["imported twice", "double", "repeated transactions"],
  compute,
  render,
};
