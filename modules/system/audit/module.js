// modules/system/audit/module.js -- the change log: what each save changed, and when, from the copies the PC keeps.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "audit",
  group: "system",
  title: "Change log",
  icon: "⚙️",
  order: 50,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["*"],
  writes: [],
  heavy: false,
  purpose: "Shows what changed in your plan at each save, and when, from the copies your PC keeps.",
  compute,
  render,
};
