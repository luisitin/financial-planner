import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "projection",
  group: "retirement",
  title: "Will the money last?",
  icon: "🌅",
  order: 10,
  version: 1,
  status: "usable",
  phase: 5,
  enabledByDefault: true,
  needs: ["household", "accounts", "expenses", "income", "retirement", "assumptions"],
  writes: ["retirement"],
  heavy: false,
  purpose: "Your plan run year by year to the end: what you have, add, receive and spend, and whether the money lasts.",
  aliases: ["retirement", "retire", "projection", "will I have enough", "when can I retire", "nest egg"],
  compute,
  render,
};
