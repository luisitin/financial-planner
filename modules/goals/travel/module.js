import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "travel",
  group: "goals",
  title: "Travel and events",
  icon: "🎯",
  order: 60,
  version: 1,
  status: "usable",
  phase: 4,
  enabledByDefault: true,
  needs: ["events", "goals", "assumptions"],
  writes: ["events", "goals"],
  heavy: false,
  purpose: "Trips, a wedding and other big days priced from their parts, with what to put aside each month to pay in cash.",
  compute,
  render,
};
