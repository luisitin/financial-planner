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
  writes: ["transactions", "imports", "importProfiles", "rules", "accounts"],
  heavy: false,
  purpose: "Bring in the file your bank or card lets you download (CSV, or the Quicken or QuickBooks file); the app works out the columns, skips duplicates and applies your rules.",
  aliases: ["upload", "csv", "bank file", "bank statement", "statement", "card statement", "download from the bank", "add transactions", "ofx", "qfx", "qbo", "quicken", "quickbooks"],
  compute,
  render,
};
