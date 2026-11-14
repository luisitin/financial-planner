import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "assistant",
  group: "ai",
  title: "Ask the plan",
  icon: "💬",
  order: 1,
  version: 1,
  status: "usable",
  requires: "ai",   // needs the AI helper (through your computer): offered only while it answers (core/view.js)
  phase: 0,
  enabledByDefault: true,
  needs: ["household", "accounts", "goals", "assumptions"],
  writes: ["household", "retirement", "assumptions", "guide"],   // only by Apply on a change the helper named (gap #39), through Scenario compare's carry
  heavy: false,
  purpose: "Ask questions about your plan in plain words. The model runs on your computer and only sees a summary.",
  aliases: ["chat", "ask", "question", "assistant", "AI"],
  compute,
  render,
};
