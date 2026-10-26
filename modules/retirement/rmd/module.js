import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "rmd",
  group: "retirement",
  title: "Required withdrawals",
  icon: "📤",
  order: 90,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement"],
  writes: [],
  heavy: false,
  purpose: "When the tax rules make you take money out of pre-tax accounts, and how big those withdrawals look.",
  aliases: ["rmd", "required minimum distribution", "age 73", "age 75", "forced withdrawals"],
  compute,
  render,
};
