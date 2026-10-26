import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "sequence-risk",
  group: "retirement",
  title: "Order of returns",
  icon: "🎢",
  order: 80,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "expenses", "retirement", "assumptions"],
  writes: [],
  heavy: false,
  purpose: "Why bad years early in retirement hurt most: the same years of returns in three orders, on your plan.",
  aliases: ["sequence risk", "bad years early", "order of returns", "first years of retirement"],
  compute,
  render,
};
