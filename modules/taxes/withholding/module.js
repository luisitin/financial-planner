import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "withholding",
  group: "taxes",
  title: "Withholding check",
  icon: "🧾",
  order: 30,
  version: 1,
  status: "usable",
  phase: 6,
  enabledByDefault: true,
  needs: ["household", "income", "taxes"],
  writes: ["taxes"],
  heavy: false,
  purpose: "Whether your paychecks are taking out enough federal tax: the refund or bill in April, and the W-4 change that fixes it.",
  aliases: ["withholding", "w-4", "w4", "paycheck tax", "refund", "owe in april", "underpayment"],
  compute,
  render,
};
