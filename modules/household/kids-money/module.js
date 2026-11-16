// modules/household/kids-money/module.js -- Children's money (gap list, next 60, item 57): each child's allowance and what
// it is meant to cover, the money they hold of their own, and what that could grow to by 18. README.md has the formulas.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "kids-money",
  group: "household",
  title: "Children's money",
  icon: "👪",
  order: 60,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "expenses", "assumptions", "whatIfs"],
  writes: ["household", "expenses", "whatIfs"],
  heavy: false,
  purpose: "Each child's allowance, their own money, and what it could grow to by 18.",
  aliases: ["allowance", "pocket money", "kids money", "piggy bank", "custodial account", "UTMA", "kiddie tax", "childrens savings"],
  compute,
  render,
};
