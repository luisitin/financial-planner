import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "beneficiaries",
  group: "estate",
  title: "Beneficiary audit",
  icon: "📜",
  order: 20,
  version: 1,
  status: "usable",
  phase: 8,
  enabledByDefault: true,
  needs: ["household", "accounts", "insurance", "estate"],
  writes: ["estate"],
  heavy: false,
  purpose: "Who is named on every retirement account, life policy and payable-on-death account, and what to fix: no one named, no backup, a child named directly.",
  compute,
  render,
};
