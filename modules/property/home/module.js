import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "home",
  group: "property",
  title: "Home",
  icon: "🏡",
  order: 10,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "debts", "property", "taxes"],
  writes: ["property", "accounts"],
  heavy: false,
  purpose: "Your home: what it is worth and what you own of it, what it costs a year to keep, what selling would leave, and value and equity ahead.",
  compute,
  render,
};
