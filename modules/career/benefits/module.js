import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "benefits",
  group: "career",
  title: "Benefits elections",
  icon: "💼",
  order: 60,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["income", "household", "accounts", "retirement", "taxes", "whatIfs"],
  writes: ["whatIfs", "retirement", "taxes"],
  heavy: false,
  purpose: "Helps you choose at open enrollment: your 401k percentage, health savings account, employer stock plan and insurance picks.",
  aliases: ["open enrollment", "open enrolment", "401k percent", "employer match", "FSA", "dependent care", "ESPP", "commuter benefits"],
  compute,
  render,
};
