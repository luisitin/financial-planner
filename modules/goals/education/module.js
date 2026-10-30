import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "education",
  group: "goals",
  title: "Education (529)",
  icon: "🎯",
  order: 40,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["household", "accounts", "goals", "assumptions", "retirement", "whatIfs"],
  writes: ["whatIfs", "goals"],
  heavy: false,
  purpose: "College for each child: what it would cost when they get there, the monthly saving that covers it, and how much today's saving covers.",
  compute,
  render,
};
