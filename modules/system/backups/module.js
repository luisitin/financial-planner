// modules/system/backups/module.js -- the copies of the plan the PC keeps before every save: what changed since each, and a restore.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "backups",
  group: "system",
  title: "Backups",
  icon: "⚙️",
  order: 40,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["*"],
  writes: ["*"],
  heavy: false,
  purpose: "Earlier copies your PC keeps of your plan: see what changed since one and put it back if something went wrong.",
  aliases: ["undo", "earlier copies", "restore", "go back"],
  compute,
  render,
};
