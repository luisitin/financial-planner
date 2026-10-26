// qa/fixtures/tax-plan.mjs -- the retirement couple (Sam and Lee) filing jointly, with the
// figures the tax pages read: a dependent, a withheld amount, a paycheck, sales, last year's
// return, an HSA. Built on qa/fixtures/retirement-plan.mjs so the retirement numbers match.
import { retirementPlan } from "./retirement-plan.mjs";

export function taxPlan() {
  const p = retirementPlan();
  p.household.filingStatus = "married_joint";
  p.household.people.push({ id: "kid", name: "Kim", role: "dependent", birthDate: "2015-03-02" });   // 11 in 2026
  p.taxes.thisYear.withheld = 8000;
  p.taxes.withholding = { self: { perPaycheck: 400, period: "biweekly" } };
  p.taxes.gains.push({ id: "g1", name: "100 VTI", proceeds: 30000, basis: 22000, held: "long" }, { id: "g2", name: "Meme stock", proceeds: 4000, basis: 9000, held: "short" });
  p.taxes.priorYear = { tax: 11000, agi: 140000 };
  p.taxes.estimated.paid = [150, 150, 0, 0];
  p.taxes.hsa = { coverage: "family", contribution: 5000, employer: 1000, fsa: 0, fsaSpent: 0 };
  return p;
}
