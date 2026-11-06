// qa/fixtures/round8-households.mjs -- the five households of round 8's Batch 1 (the federal estimate counts what the plan
// already knows), invented, each as Get started leaves it plus what the tester then added: their hand-worked 2026 figures
// are in modules/taxes/federal/README.md ("What the plan already knows (round 8)"). Not named "-plan.mjs", so the qa sweeps
// that walk every fixture plan are not changed by it.
import { emptyPlan } from "../../core/schema/migrate.js";

const self = (id, name, birthDate) => ({ id, name, role: "self", birthDate, retirementAge: null, lifeExpectancy: null });
const partner = (id, name, birthDate) => ({ id, name, role: "partner", relation: "spouse", birthDate, retirementAge: null, lifeExpectancy: null });
const kid = (id, birthDate) => ({ id, name: "Child", role: "dependent", birthDate });
const pay = (id, personId, amount, type = "salary") => ({ id, name: "Pay", personId, type, amount, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true });
const account = (id, name, type, balance, ownerId = "") => ({ id, name, type, balance, ownerId });

/** A self-employed designer in Colorado: 78,000 of business income, 250 a month into a traditional IRA, 4,000 paid in estimates. */
export function freelancerPlan() {
  const p = emptyPlan();
  p.household.people = [self("me", "Jo", "1995-03-15")];
  p.household.filingStatus = "single"; p.household.state = "CO";
  p.income = [pay("biz", "me", 78000, "business")];
  p.accounts = [account("chk", "Checking", "checking", 3500), account("ira", "IRA", "ira", 14000, "me")];
  p.retirement.contributions = [{ id: "c-ira", accountId: "ira", personId: "me", period: "monthly", amount: 250, employerMatch: 0 }];
  p.taxes.estimated = { paid: [1333.33, 1333.33, 1333.34, 0], typedAt: "2026-11-06" };
  return p;
}

/** A couple with a rented-out condo: 95,000 + 72,000 of pay, 600 and 450 a month into 401(k)s, a child of 15, and the condo's
 * 2,100 a month of rent both on Income (as Get started puts it) and on Rental analysis with its costs and loan. */
export function landlordPlan() {
  const p = emptyPlan();
  p.household.people = [self("sam", "Sam", "1980-03-15"), partner("lee", "Lee", "1982-06-15"), kid("kid", "2011-07-15")];
  p.household.filingStatus = "married_joint"; p.household.state = "TX";
  p.income = [pay("pay-sam", "sam", 95000), pay("pay-lee", "lee", 72000), { id: "rent", name: "Rent coming in", personId: "", type: "rental", amount: 2100, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true }];
  p.accounts = [account("chk", "Checking", "checking", 8000), account("k-sam", "Sam's 401(k)", "401k", 180000, "sam"), account("k-lee", "Lee's 401(k)", "401k", 120000, "lee"),
    account("condo", "Condo", "property", 260000), account("condo-loan", "Condo mortgage", "mortgage", 150000)];
  p.debts = [{ id: "d-condo", accountId: "condo-loan", rate: 0.045, minPayment: 851, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null }];
  p.retirement.contributions = [{ id: "c-sam", accountId: "k-sam", personId: "sam", period: "monthly", amount: 600, employerMatch: 3600 }, { id: "c-lee", accountId: "k-lee", personId: "lee", period: "monthly", amount: 450, employerMatch: 2400 }];
  p.property = [{ id: "r1", kind: "rental", name: "Condo", value: 260000, purchasePrice: 210000, purchaseDate: "2019-08-01", rentMonthly: 2100, vacancy: 0.05, propertyTax: 4700, insurance: 1200, hoaMonthly: 350, maintenance: 0.01, loanAccountId: "condo-loan", landShare: 0.2 }];
  return p;
}

/** A widow of 74 in Florida: a 1,900 a month pension, 2,300 a month of Social Security, 410,000 in a traditional IRA. */
export function widowPlan() {
  const p = emptyPlan();
  p.household.people = [{ ...self("me", "Ruth", "1952-03-15"), retirementAge: 74 }];
  p.household.filingStatus = "single"; p.household.state = "FL";
  p.income = [{ id: "pension", name: "Pension", personId: "me", type: "pension", amount: 1900, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true },
    { id: "ss", name: "Social Security", personId: "me", type: "social", amount: 2300, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true }];
  p.accounts = [account("chk", "Checking", "checking", 12000), account("ira", "IRA", "ira", 410000, "me")];
  p.retirement.spendingMonthly = 3000;
  return p;
}

/** A couple where one is paid partly in stock: 210,000 + 30,000 of pay, 2,000 and 250 a month into 401(k)s, two grown children,
 * 1,200 restricted stock units granted March 2025 (a year's cliff, then every three months over four years) at 200 a share. */
export function equityPlan() {
  const p = emptyPlan();
  p.household.people = [self("mo", "Mo", "1972-03-15"), partner("lin", "Lin", "1974-05-15"), kid("k1", "2007-07-15"), kid("k2", "2005-07-15")];
  p.household.filingStatus = "married_joint"; p.household.state = "WA";
  p.income = [pay("pay-mo", "mo", 210000), pay("pay-lin", "lin", 30000)];
  p.accounts = [account("chk", "Checking", "checking", 15000), account("k-mo", "Mo's 401(k)", "401k", 780000, "mo"), account("k-lin", "Lin's 401(k)", "401k", 120000, "lin"), account("brk", "Investments", "brokerage", 300000)];
  p.retirement.contributions = [{ id: "c-mo", accountId: "k-mo", personId: "mo", period: "monthly", amount: 2000, employerMatch: 8400 }, { id: "c-lin", accountId: "k-lin", personId: "lin", period: "monthly", amount: 250, employerMatch: 1200 }];
  p.equity = { symbol: "ACME", price: 200, priceAsOf: "2026-11-06", personId: "mo", grants: [{ id: "g1", kind: "rsu", name: "2025 grant", granted: "2025-03-01", vestStart: "2025-03-01", shares: 1200, vestMonths: 48, cliffMonths: 12, every: 3 }], espp: [] };
  return p;
}

/** A young couple paying off student loans: 58,000 + 64,000 of pay, 64,000 of loans at 6.5% with a 730 payment. */
export function studentLoanPlan() {
  const p = emptyPlan();
  p.household.people = [self("ana", "Ana", "1997-03-15"), partner("bo", "Bo", "1995-08-15")];
  p.household.filingStatus = "married_joint"; p.household.state = "NC";
  p.income = [pay("pay-ana", "ana", 58000), pay("pay-bo", "bo", 64000)];
  p.accounts = [account("chk", "Checking", "checking", 3000), account("loans", "Student loans", "student_loan", 64000)];
  p.debts = [{ id: "d-loans", accountId: "loans", rate: 0.065, minPayment: 730, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null }];
  return p;
}

// ---- the review's households (r8/b1/review-money.md): each one a case the first build got wrong --------------------------
const inc = (id, personId, amount, type = "salary", period = "annual", name = "Pay") => ({ id, name, personId, type, amount, period, growth: 0, startDate: "", endDate: "", taxable: true });

/** A single landlord with a business: 170,000 of business income less 30,000 of costs, a condo losing about 23,668, 14,400 of its rent on Income. */
export function landlordBusinessPlan() {
  const p = emptyPlan();
  p.household.people = [self("me", "Pat", "1980-01-10")]; p.household.filingStatus = "single"; p.household.state = "TX";
  p.income = [inc("biz", "me", 170000, "business"), inc("rent", "", 1200, "rental", "monthly", "Rent")];
  p.whatIfs = { ...(p.whatIfs ?? {}), selfEmployment: { expenses: 30000 } };
  p.property = [{ id: "r1", kind: "rental", name: "Condo", value: 300000, purchasePrice: 300000, purchaseDate: "2024-01-15", rentMonthly: 1200, vacancy: 0.05, propertyTax: 4700, insurance: 1200, hoaMonthly: 350, maintenance: 0.01, loanBalance: 240000, loanRate: 0.065, loanPayment: 1517 }];
  p.accounts = [account("chk", "Checking", "checking", 9000)];
  return p;
}

/** Retired at 48, now 50, no Income page lines: 900,000 in an IRA and 5,000 a month of spending. */
export function earlyRetireePlan() {
  const p = emptyPlan();
  p.household.people = [{ ...self("me", "Fi", "1976-04-04"), retirementAge: 48 }]; p.household.filingStatus = "single"; p.household.state = "TX";
  p.income = []; p.accounts = [account("chk", "Checking", "checking", 5000), account("i", "IRA", "ira", 900000, "me")];
  p.retirement.spendingMonthly = 5000;
  return p;
}

/** 150,000 of pay, 2,000 restricted stock units at 200 vesting quarterly from 2025 (100,000 in 2026), and 40,000 of business profit. */
export function stockAndBusinessPlan() {
  const p = emptyPlan();
  p.household.people = [self("me", "Ro", "1985-01-01")]; p.household.filingStatus = "single"; p.household.state = "WA";
  p.income = [inc("pay", "me", 150000), inc("biz", "me", 40000, "business")]; p.accounts = [account("chk", "Checking", "checking", 3000)];
  p.equity = { symbol: "X", price: 200, priceAsOf: "2026-11-06", personId: "me", grants: [{ id: "g1", kind: "rsu", name: "g", granted: "2025-01-01", vestStart: "2025-01-01", shares: 2000, vestMonths: 48, cliffMonths: 0, every: 3 }], espp: [] };
  return p;
}

/** A single freelancer with 400,000 of profit and no employees. */
export function highFreelancerPlan() {
  const p = emptyPlan();
  p.household.people = [self("me", "Hi", "1980-01-01")]; p.household.filingStatus = "single"; p.household.state = "TX";
  p.income = [inc("biz", "me", 400000, "business")]; p.accounts = [account("chk", "Checking", "checking", 30000)];
  return p;
}

/** 68, a 30,000 pension, 2,000 a month of Social Security and a parent loan for a child's college at 8%. */
export function parentLoanPlan() {
  const p = emptyPlan();
  p.household.people = [self("me", "Gran", "1958-01-01")]; p.household.filingStatus = "single"; p.household.state = "TX";
  p.income = [inc("pen", "me", 30000, "pension"), inc("ss", "me", 2000, "social", "monthly")];
  p.accounts = [account("chk", "Checking", "checking", 3000), account("loans", "Parent loan", "student_loan", 40000)];
  p.debts = [{ id: "d", accountId: "loans", rate: 0.08, minPayment: 500, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null }];
  return p;
}

/** Born June 1953, 73 this year: 500,000 in an IRA, nothing taken yet, Social Security 2,500 a month. */
export function firstRmdPlan() {
  const p = emptyPlan();
  p.household.people = [self("me", "New", "1953-06-02")]; p.household.filingStatus = "single"; p.household.state = "NY";
  p.income = [inc("ss", "me", 2500, "social", "monthly")]; p.accounts = [account("i", "IRA", "ira", 500000, "me")];
  p.retirement.spendingMonthly = 4000;
  return p;
}
