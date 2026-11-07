// qa/fixtures/round8-rental.mjs -- round 8's landlord household for Batch 6 (a rental is entered once and counted once),
// invented: a couple, their home with its mortgage, a car, two 401(k)s and a rented-out condo, as Get started leaves it plus
// what the tester then added. Two ways the condo was entered:
// - condoOnNetWorthPlan(): on Rental analysis (no "Its value" link, its mortgage picked) and again on Net worth as "Condo" and
//   "Condo mortgage" (with Debts details): Assets listed it twice and paired the policies by list order;
// - condoOnlyRentalPlan(): only on Rental analysis, its loan typed there: net worth left it out ($508,000, not $618,000).
// Both policies are "home" kind, as the Policies form had no landlord kind. Not named "-plan.mjs", so the qa sweeps that walk
// every fixture plan are not changed by it. Hand-worked figures: modules/property/rental/README.md ("Entered once").
import { emptyPlan } from "../../core/schema/migrate.js";

const person = (id, name, role, birthDate, extra = {}) => ({ id, name, role, birthDate, retirementAge: null, lifeExpectancy: null, ...extra });
const account = (id, name, type, balance, ownerId = "", asOf = "2026-11-06") => ({ id, name, type, institution: "", balance, asOf, ownerId, history: [] });
const debt = (id, accountId, rate, minPayment) => ({ id, accountId, rate, minPayment, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null });
const spend = (row, name, category, amount, essential = true) => ({ id: `setup-x-${row}`, name, category, essential, period: "monthly", inflates: true, startDate: "", endDate: "", amount });
const policy = (id, name, kind, benefit, premium, period, personId = "", endDate = "") => ({ id, name, kind, personId, insurer: "", benefit, premium, period, endDate, renewalDate: "", cashValue: null, throughWork: false, notes: "" });

/** The condo on Rental analysis and on Net worth (the tester's plan). */
export function condoOnNetWorthPlan() {
  const p = emptyPlan();
  p.household = { people: [person("setup-self", "Sam", "self", "1980-03-15"), person("setup-partner", "Alex", "partner", "1982-06-15", { relation: "spouse" }), person("setup-kid-1", "Child 1", "dependent", "2011-07-15")], filingStatus: "married_joint", state: "TX" };
  p.accounts = [
    account("setup-have-checking", "Checking", "checking", 8000), account("setup-have-savings", "Savings", "savings", 25000),
    account("setup-have-retire-setup-self", "Sam's retirement", "401k", 180000, "setup-self"), account("setup-have-retire-setup-partner", "Alex's retirement", "401k", 120000, "setup-partner"),
    account("setup-have-home", "Home", "property", 410000), account("setup-have-car", "Car", "vehicle", 15000), account("setup-owe-mortgage", "Mortgage", "mortgage", 250000),
    account("condo", "Condo", "property", 260000), account("condo-loan", "Condo mortgage", "mortgage", 150000),
  ];
  p.debts = [debt("setup-debt-mortgage", "setup-owe-mortgage", 0.035, 2350), debt("d-condo", "condo-loan", 0.045, 851)];
  p.income = [
    { id: "setup-pay-setup-self", name: "Sam's pay", personId: "setup-self", type: "salary", amount: 95000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true },
    { id: "setup-pay-setup-partner", name: "Alex's pay", personId: "setup-partner", type: "salary", amount: 72000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true },
    { id: "setup-other", name: "Rent coming in", personId: "", type: "rental", amount: 2100, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true },
  ];
  p.expenses = [spend("utilities", "Utilities and phone", "utilities", 450), spend("groceries", "Groceries", "groceries", 1200), spend("transport", "Car, gas and transit", "transport", 600),
    spend("insurance", "Insurance and health", "insurance", 700), spend("childcare", "Childcare and school", "childcare", 300), spend("dining", "Eating out and fun", "dining", 600, false), spend("shopping", "Shopping and everything else", "shopping", 800, false)];
  p.insurance = { policies: [policy("pol-home", "Home policy", "home", 300000, 3000, "annual"), policy("pol-condo", "Condo landlord policy", "home", 300000, 900, "annual"),
    policy("pol-car", "Car policy", "auto", 250000, 150, "monthly"), policy("pol-life", "Sam term life", "term", 500000, 45, "monthly", "setup-self", "2040-03-01")] };
  p.property = [{ id: "r-condo", kind: "rental", name: "Condo", value: 260000, purchasePrice: 210000, purchaseDate: "2019-08-01", rentMonthly: 2100, vacancy: 0.05, propertyTax: 4700, insurance: 1200, hoaMonthly: 350, maintenance: 0.01, management: null, utilitiesMonthly: null, otherMonthly: null, cashIn: 45000, loanAccountId: "condo-loan", loanBalance: 150000, loanRate: 0.045, loanPayment: 851, landShare: 0.2, appreciation: 0.035 }];
  Object.assign(p.retirement, { spendingMonthly: 4350, stocksNow: 0.7, stocksRetired: 0.5, taxRate: 0.15, strategy: "fixed-real", withdrawalRate: 0.04, taxMode: "flat",
    contributions: [{ id: "setup-contrib-setup-self", accountId: "setup-have-retire-setup-self", personId: "setup-self", period: "monthly", amount: 600, employerMatch: 3600 }, { id: "setup-contrib-setup-partner", accountId: "setup-have-retire-setup-partner", personId: "setup-partner", period: "monthly", amount: 450, employerMatch: 2400 }],
    socialSecurity: { "setup-self": { monthlyAtFRA: 3310 }, "setup-partner": { monthlyAtFRA: 2697 } } });
  p.guide = { setup: { status: { "setup-self": "work", "setup-partner": "work" }, retireAuto: true, ss: { "setup-self": "estimate", "setup-partner": "estimate" } } };
  return p;
}

/** The condo only on Rental analysis, its loan typed there (the verifier's plan): net worth leaves it out. */
export function condoOnlyRentalPlan() {
  const p = condoOnNetWorthPlan();
  p.accounts = p.accounts.filter((a) => a.id !== "condo" && a.id !== "condo-loan");
  p.debts = p.debts.filter((d) => d.accountId !== "condo-loan");
  p.property[0].loanAccountId = null;
  return p;
}
