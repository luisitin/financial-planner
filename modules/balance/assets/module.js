// modules/balance/assets/module.js -- what you own outside your money accounts: homes, cars, other things, and a home inventory of belongings.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "assets",
  group: "balance",
  title: "Asset register",
  icon: "⚖️",
  order: 40,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "property", "insurance", "belongings"],
  writes: ["belongings"],
  heavy: false,
  purpose: "Lists your home, cars and belongings with what you paid, what each is worth now and which policy covers it.",
  compute,
  render,
};
