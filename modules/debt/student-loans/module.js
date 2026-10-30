import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "student-loans",
  group: "debt",
  title: "Student loans",
  icon: "💳",
  order: 40,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["accounts", "debts", "household", "income", "taxes", "assumptions", "whatIfs"],
  writes: ["whatIfs"],
  heavy: false,
  purpose: "Your federal student loans under each way to repay them: the payment, how long, what is forgiven and what each costs on your own income.",
  compute,
  render,
};
