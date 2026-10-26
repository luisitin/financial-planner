import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "spending",
  group: "cashflow",
  title: "Where the money goes",
  icon: "🥧",
  order: 40,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["transactions", "categories"],
  writes: [],
  heavy: false,
  purpose: "Spending by category and by payee for a month, against the month before.",
  aliases: ["spending", "where my money goes", "what I spend on", "biggest expenses", "merchants"],
  compute,
  render,
};
