import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "risk",
  group: "investments",
  title: "Risk",
  icon: "🎢",
  order: 90,
  version: 1,
  status: "usable",
  phase: 7,
  enabledByDefault: true,
  needs: ["holdings", "investments"],
  writes: [],
  heavy: false,
  purpose: "How rough the ride of your mix is: the worst year and deepest fall history has dealt a mix like yours, in your own dollars.",
  aliases: ["risk", "volatility", "worst year", "drawdown", "how much could I lose", "bear market", "crash"],
  seeds: "Simba data",
  compute,
  render,
};
