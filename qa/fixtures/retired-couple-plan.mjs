// qa/fixtures/retired-couple-plan.mjs -- the people, accounts and income of the retired couple of
// qa/flows/seed-retired-couple.js as a plan for Node tests: Ruth (72, retired at 62, plan to 100) and Sam (69, retirement
// age 70, plan to 90, his salary ended 2025-12-31). Social Security typed on the Income page, a pension paid twice a month,
// quarterly dividends, rent with a 2% raise, a one-off inheritance, one ended income and one not started yet. No
// contributions. Not the whole seed: it leaves out the seed's Gifts ($100 a month), roof repair (once), ended mortgage, car,
// credit card (its $75 a month minimum) and goals, so it spends $33,360 a year (the seed $35,460) and Will the money last?
// reads "Paid by income" 201% for it (the seed 190%).
import { emptyPlan } from "../../core/schema/migrate.js";

export function retiredCouplePlan() {
  const p = emptyPlan();
  p.household.people.push(
    { id: "p-ruth", name: "Ruth", role: "self", birthDate: "1954-03-10", retirementAge: 62, lifeExpectancy: 100 },
    { id: "p-sam", name: "Sam", role: "partner", birthDate: "1957-06-20", retirementAge: 70, lifeExpectancy: 90 },
  );
  p.household.filingStatus = "married_joint"; p.household.state = "AZ";
  p.accounts.push(
    { id: "a-chk", name: "Joint checking", type: "checking", balance: 8000, asOf: "2026-09-15", ownerId: "" },
    { id: "a-sav", name: "Joint savings", type: "savings", balance: 45000, asOf: "2026-09-15", ownerId: "" },
    { id: "a-brk", name: "Brokerage", type: "brokerage", balance: 120000, asOf: "2026-09-15", ownerId: "" },
    { id: "a-ira", name: "Ruth's IRA", type: "ira", balance: 310000, asOf: "2026-09-15", ownerId: "Ruth" },
    { id: "a-roth", name: "Sam's Roth", type: "roth", balance: 60000, asOf: "2026-09-15", ownerId: "Sam" },
    { id: "a-home", name: "House", type: "property", balance: 520000, asOf: "2026-09-15", ownerId: "" },
  );
  p.income.push(
    { id: "i-ss", name: "Ruth's Social Security", type: "social", personId: "p-ruth", amount: 2100, period: "monthly", growth: 0, taxable: true },
    { id: "i-pen", name: "Sam's pension", type: "pension", personId: "p-sam", amount: 750, period: "semimonthly", growth: 0, taxable: true },
    { id: "i-div", name: "Dividends", type: "investment", personId: "", amount: 1200, period: "quarterly", growth: 0, taxable: true },
    { id: "i-rent", name: "Rental duplex", type: "rental", personId: "p-sam", amount: 2000, period: "monthly", growth: 0.02, taxable: true },
    { id: "i-inh", name: "Inheritance", type: "other", personId: "p-ruth", amount: 15000, period: "once", growth: 0, taxable: false },
    { id: "i-old", name: "Sam's old salary", type: "salary", personId: "p-sam", amount: 6000, period: "monthly", growth: 0, taxable: true, endDate: "2025-12-31" },
    { id: "i-next", name: "Consulting (starts next year)", type: "business", personId: "p-ruth", amount: 900, period: "monthly", growth: 0, taxable: true, startDate: "2027-01-01" },
  );
  p.expenses.push(
    { id: "e-tax", name: "Property tax", category: "taxes", amount: 4800, period: "annual", essential: true, inflates: true },
    { id: "e-groc", name: "Groceries", category: "groceries", amount: 150, period: "weekly", essential: true, inflates: true },
    { id: "e-med", name: "Medicare premiums", category: "health", amount: 370, period: "monthly", essential: true, inflates: true },
    { id: "e-util", name: "Utilities", category: "utilities", amount: 210, period: "monthly", essential: true, inflates: true },
    { id: "e-ins", name: "Home and car insurance", category: "insurance", amount: 1200, period: "quarterly", essential: true, inflates: true },
    { id: "e-trav", name: "Travel", category: "travel", amount: 6000, period: "annual", essential: false, inflates: true },
    { id: "e-din", name: "Eating out", category: "dining", amount: 250, period: "monthly", essential: false, inflates: true },
  );
  return p;
}
