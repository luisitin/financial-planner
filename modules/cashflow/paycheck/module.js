// modules/cashflow/paycheck/module.js -- each earner's paycheck from pay to take-home.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "paycheck",
  group: "cashflow",
  title: "Paycheck",
  icon: "💵",
  order: 90,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["income", "household", "retirement", "accounts", "taxes"],
  writes: ["whatIfs", "taxes"],
  heavy: false,
  purpose: "Follows your paycheck from pay to take-home: what comes out before tax, the taxes withheld, Social Security and Medicare, and what your employer adds.",
  compute,
  render,
};
