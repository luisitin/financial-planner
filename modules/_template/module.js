// modules/_template/module.js -- COPY THIS FOLDER to modules/<group>/<id>/ to add a page.
// Then: rename id/group below to match the folder, fill README.md, run `npm run registry`,
// add a row to docs/MODULE_CATALOG.md, run `npm run check` and `npm test`.
//
// Every field explained:
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "template",              // MUST equal the folder name (kebab-case)
  group: "system",             // MUST equal the parent folder and exist in core/groups.js
  title: "Template page",      // sidebar + page title
  icon: "🧩",                  // one emoji
  order: 999,                  // position inside its group (lower = higher)
  version: 1,                  // bump when compute() output shape changes
  enabledByDefault: false,     // false = hidden until a device or planner.properties turns it on
  needs: [],                   // plan sections this page reads, e.g. ["accounts", "assumptions"]
  writes: [],                  // plan sections this page changes through store.update()
  heavy: false,                // true = compute() is expensive; the PC server runs it when connected
  compute,                     // (plan, params) => derived   PURE. Same code runs on the server.
  render,                      // (root, ctx) => cleanup?     DOM only. ctx documented in docs/CONVENTIONS.md
};
