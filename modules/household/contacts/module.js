// modules/household/contacts/module.js -- the people and firms to call about your money, tied to the accounts and policies they handle.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "contacts",
  group: "household",
  title: "Contacts",
  icon: "👪",
  order: 40,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["accounts", "insurance", "contacts"],
  writes: ["contacts"],
  heavy: false,
  purpose: "Lists your advisor, accountant, attorney and insurers, plus the last four digits of each account number.",
  compute,
  render,
};
