import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "side-income",
  group: "career",
  title: "Side income",
  icon: "💼",
  order: 30,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["income", "household", "taxes", "whatIfs"],
  writes: ["whatIfs", "income"],
  heavy: false,
  purpose: "Models irregular income from gigs, freelance work and a small business so your plan can count on it sensibly.",
  aliases: ["gig", "freelance", "irregular income", "variable income", "side hustle", "1099", "quarterly taxes"],
  compute,
  render,
};
