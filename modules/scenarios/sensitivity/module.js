// modules/scenarios/sensitivity/module.js -- which of the plan's numbers move the answer most: the tornado.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "sensitivity",
  group: "scenarios",
  title: "What matters most",
  // its old names, and what people ask (owner's request 2026-11-11, L1: "Sensitivity" was jargon; fix round 1, 2026-11-12, P5:
  // "What changes your answer" was cut in the top bar at 390 px)
  aliases: ["sensitivity", "what changes your answer", "which numbers matter most", "tornado chart"],
  icon: "🌪️",
  order: 50,
  version: 1,
  status: "usable",
  phase: 9,
  enabledByDefault: true,
  needs: ["household", "accounts", "retirement", "assumptions", "income", "expenses"],
  writes: [],
  heavy: true,
  purpose: "Which of your numbers matter most: returns, inflation, when you retire, how much you save, Social Security, each nudged down and up, ranked by how much it moves the answer.",
  compute,
  render,
};
