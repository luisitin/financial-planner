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
  phase: 0,
  enabledByDefault: true,
  needs: ["household", "accounts", "goals", "assumptions"],
  writes: [],
  heavy: false,
  purpose: "Ask questions about your plan in plain words. The model runs on your PC and only sees a summary.",
  aliases: ["chat", "ask", "question", "assistant", "AI"],
  compute,
  render,
};
