import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "import",
  group: "transactions",
  title: "Import",
  icon: "📥",
  order: 20,
  version: 1,
  status: "usable",
  phase: 3,
  enabledByDefault: true,
  needs: ["accounts", "transactions", "rules", "importProfiles"],
  writes: ["transactions", "imports", "importProfiles", "rules"],
  heavy: false,
  purpose: "Bring in the file your bank or card lets you download (CSV); columns are worked out, duplicates skipped, rules applied.",
  aliases: ["upload", "csv", "bank file", "download from the bank", "add transactions"],
  compute,
  render,
};
