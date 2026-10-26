import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "rules",
  group: "transactions",
  title: "Rules",
  icon: "🪄",
  order: 40,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["rules", "transactions", "accounts", "categories"],
  writes: ["rules", "transactions"],
  heavy: false,
  purpose: "The rules that file transactions for you: when the description contains this, give it that category.",
  aliases: ["automatic categories", "auto file", "payee rules"],
  compute,
  render,
};
