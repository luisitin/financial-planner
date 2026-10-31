// modules/ai/notes/module.js -- say or type a note; the AI helper (or plain rules) proposes entries to check and add.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "notes",
  group: "ai",
  title: "Voice notes",
  icon: "🤖",
  order: 70,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "transactions", "household", "reminders", "notes"],
  writes: ["transactions", "reminders", "accounts", "notes"],
  heavy: false,
  purpose: "Say or type a note and the app turns it into entries for you to check: money spent or received, a reminder, an account balance or a note.",
  compute,
  render,
};
