// modules/overview/start/module.js -- Get started: "What would you like to do?" Pick a quick answer, one goal or the
// whole plan, then follow it step by step. Opens by itself the first time the app is opened on an empty plan.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "start",
  group: "overview",
  title: "Get started",
  icon: "🧭",
  order: 3,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "household", "income", "expenses", "goals", "transactions", "assumptions", "guide"],
  writes: ["guide"],
  heavy: false,
  purpose: "Pick what you came to do: a quick answer, one goal or the whole plan, then follow it step by step.",
  aliases: ["get started", "where do I start", "what can I do", "what should I do first", "help me start", "onboarding"],
  compute,
  render,
};
