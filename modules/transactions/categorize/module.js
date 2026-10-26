import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "categorize",
  group: "transactions",
  title: "Categorise",
  icon: "✅",
  order: 30,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["transactions", "rules", "categories"],
  writes: ["transactions", "rules"],
  heavy: false,
  purpose: "File the transactions that have no category yet, one payee at a time, with suggestions.",
  aliases: ["uncategorised", "file transactions", "sort transactions", "AI suggestions", "review"],
  compute,
  render,
};
