// modules/household/life-events/module.js -- a step-by-step guide for marriage, a baby, a new job, a move, an inheritance or a divorce, with the deadlines and plan changes each brings.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "life-events",
  group: "household",
  title: "Life events",
  icon: "👪",
  order: 20,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "income", "accounts", "lifeEvents"],
  writes: ["lifeEvents", "household", "income", "accounts"],
  heavy: false,
  purpose: "Guides you through marriage, a baby, a job change, a move, an inheritance or divorce and proposes the plan changes each brings.",
  compute,
  render,
};
