import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "net-worth",
  group: "balance",
  title: "Net worth",
  icon: "💰",
  order: 10,
  version: 1,
  status: "usable",
  phase: 0,
  enabledByDefault: true,
  needs: ["accounts", "netWorthHistory", "pathSnapshots"],
  // the one muted row "Some of this uses our guesses: ..." when a big guess in these sections is in use (smart guesses C6, spec 9.5)
  restsOn: ["accounts"],
  writes: ["accounts", "netWorthHistory", "pathSnapshots"],
  heavy: false,
  purpose: "Every account and balance in one list: what you own, what you owe, and the difference over time.",
  aliases: ["what I owe", "what I own", "how much am I worth", "assets and debts", "balance sheet", "accounts", "bank accounts"],
  compute,
  render,
};
