// modules/household/calendar/module.js -- the household's money dates on one list: bills, paydays, tax dates, open enrollment, required withdrawals, renewals, goals, reminders.
import { compute } from "./compute.js";
import { render } from "./view.js";

export default {
  id: "calendar",
  group: "household",
  title: "Money calendar",
  icon: "👪",
  order: 50,
  version: 1,
  status: "usable",
  phase: 10,
  enabledByDefault: true,
  needs: ["household", "accounts", "transactions", "recurringIgnored", "income", "taxes", "insurance", "retirement", "goals", "reminders"],
  writes: ["reminders"],
  heavy: false,
  purpose: "Puts your bills, paydays, tax deadlines, open enrolment, required minimum distribution dates and policy renewals on one calendar.",
  compute,
  render,
};
