import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "employer-stock",
  group: "investments",
  title: "Employer stock",
  icon: "📈",
  order: 120,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["holdings", "accounts", "income", "household", "taxes"],
  writes: ["equity"],
  heavy: false,
  purpose: "How much of your wealth rides on the company you work for, when its grants vest and the tax they bring, and how to bring the stake down.",
  compute,
  render,
};
