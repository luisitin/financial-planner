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
  needs: ["transactions", "categories", "spendingWatch"],
  writes: ["spendingWatch"],
  heavy: false,
  purpose: "Spending by category and payee for a month, against the month before and over a year, and what you watch.",
  aliases: ["spending", "where my money goes", "what I spend on", "biggest expenses", "merchants", "spending trend", "watch a shop", "watchlist"],
  compute,
  render,
};
