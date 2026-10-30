import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "gifting",
  group: "estate",
  title: "Gifting",
  icon: "📜",
  order: 50,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "estate"],
  writes: ["estate"],
  heavy: false,
  purpose: "Gifts within the yearly tax-free amount, what needs a gift tax return, and front-loading a 529 college plan with five years of gifts at once.",
  compute,
  render,
};
