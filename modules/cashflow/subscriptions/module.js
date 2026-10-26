import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "subscriptions",
  group: "cashflow",
  title: "Subscriptions",
  icon: "📺",
  order: 90,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["transactions", "expenses", "recurringIgnored"],
  writes: ["recurringIgnored"],
  heavy: false,
  purpose: "Every charge that renews by itself, what it costs you a year, and the ones to question.",
  aliases: ["subscriptions", "streaming", "memberships", "netflix", "recurring charges", "cancel"],
  compute,
  render,
};
