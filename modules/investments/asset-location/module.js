import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "asset-location",
  group: "investments",
  title: "Asset location",
  icon: "🗂️",
  order: 70,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["accounts", "holdings", "taxes"],
  writes: [],
  heavy: false,
  purpose: "Which investments belong in which kind of account to keep the yearly tax bill down, the drag today, and the swaps that fix it.",
  aliases: ["asset location", "which account", "bonds in 401k", "tax efficient", "placement", "tax drag"],
  seeds: "Bogleheads wiki",
  compute,
  render,
};
