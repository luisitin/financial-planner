// modules/reports/if-something-happens/module.js -- one packet the family can use if something happens: who to call, where
// the papers are, the accounts and who gets them, online accounts, bills that pay themselves, final wishes, first steps.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "if-something-happens",
  group: "reports",
  title: "If something happens to us",
  icon: "🗂️",
  order: 70,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "contacts", "papers", "accounts", "debts", "insurance", "estate", "transactions", "recurringIgnored"],
  writes: ["estate"],
  heavy: false,
  purpose: "One packet your family can use if something happens to you: who to call, where the papers are, the accounts and who gets them, online accounts, bills that pay themselves, final wishes and the first steps.",
  compute,
  render,
};
