// modules/overview/setup/module.js -- Set up my plan: a conversation, one question per screen, that puts the household,
// pay, accounts, debts, spending, goals and retirement ages in the plan, then shows where you stand and three first moves.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "setup",
  group: "overview",
  title: "Set up my plan",
  icon: "🌱",
  order: 3.5,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "income", "accounts", "debts", "expenses", "goals", "assumptions", "retirement", "guide"],
  writes: ["household", "income", "accounts", "debts", "expenses", "goals", "assumptions", "guide"],
  heavy: false,
  purpose: "A few friendly questions, one per screen, that put your household, pay, accounts, debts, spending and goals in the plan, then show where you stand and your first three moves.",
  aliases: ["set up", "setup", "onboarding", "start my plan", "questions", "interview", "where do I stand", "build my plan"],
  compute,
  render,
};
