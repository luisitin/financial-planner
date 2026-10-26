import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "people",
  group: "household",
  title: "People",
  icon: "👪",
  order: 10,
  version: 1,
  status: "usable",
  phase: 2,
  enabledByDefault: true,
  needs: ["household", "assumptions"],
  writes: ["household"],
  heavy: false,
  purpose: "You, your partner and anyone who depends on you, with the ages the whole plan is built on.",
  aliases: ["family", "partner", "spouse", "kids", "children", "birthdays", "ages", "filing status", "state"],
  compute,
  render,
};
