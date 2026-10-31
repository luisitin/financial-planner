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
  purpose: "Lists the backups on your server, shows what changed between them and lets you restore any of them.",
  compute,
  render,
};
