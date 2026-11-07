// qa/fixtures/retiree-cases.mjs -- the households round 8's Batch 5 reviews (2026-11-06) used to test How much to take out,
// Required withdrawals and Roth conversions, as plans for Node tests. All invented, as every qa household: each is retired (Get
// started's answers say so), lives in Florida unless said, and spends one "Everything" line a month; the projection runs on its
// quick flat 15% setting and the same spending every year unless said.
import { emptyPlan } from "../../core/schema/migrate.js";

function household({ people, status, accounts, income, spendMonthly, taxMode = "flat", strategy = "fixed-real", state = "FL" }) {
  const p = emptyPlan();
  for (const x of people) p.household.people.push({ lifeExpectancy: null, ...x });
  p.household.filingStatus = status; p.household.state = state;
  p.accounts.push(...accounts.map((a) => ({ asOf: "2026-11-06", ownerId: "", ...a })));
  p.income.push(...income.map((i) => ({ period: "monthly", growth: 0, taxable: true, ...i })));
  p.expenses.push({ id: "x1", name: "Everything", category: "groceries", essential: true, period: "monthly", inflates: true, amount: spendMonthly });
  Object.assign(p.retirement, { taxMode, taxRate: 0.15, strategy, withdrawalRate: 0.04, socialSecurity: {} });
  const status_ = {}, ss = {};
  for (const x of people) { status_[x.id] = "retired"; ss[x.id] = "getting"; }
  p.guide = { ...(p.guide ?? {}), setup: { status: status_, ss, at: "done" } };
  return p;
}

/**
 * Al and Bea, both born in 1951 (75 in 2026), each with a $400,000 IRA, a $20,000 pension and $30,000 of Social Security a
 * year; $6,000 a month of spending. Filing separately by default (each 2026 required withdrawal 400,000 / 24.6 = $16,260.16,
 * priced on its owner's own return), or `status` "married_joint".
 */
export function separateCouple(status = "married_separate") {
  return household({ status, spendMonthly: 6000,
    people: [{ id: "a", name: "Al", role: "self", birthDate: "1951-02-01", retirementAge: 70 }, { id: "b", name: "Bea", role: "partner", relation: "spouse", birthDate: "1951-06-01", retirementAge: 70 }],
    accounts: [{ id: "c", name: "Checking", type: "checking", balance: 20000 }, { id: "ia", name: "Al's IRA", type: "ira", balance: 400000, ownerId: "a" }, { id: "ib", name: "Bea's IRA", type: "ira", balance: 400000, ownerId: "b" }],
    income: [
      { id: "pa", name: "Al's pension", type: "pension", personId: "a", amount: 20000 / 12 }, { id: "pb", name: "Bea's pension", type: "pension", personId: "b", amount: 20000 / 12 },
      { id: "sa", name: "Al's Social Security", type: "social", personId: "a", amount: 2500 }, { id: "sb", name: "Bea's Social Security", type: "social", personId: "b", amount: 2500 },
    ] });
}

/**
 * Al (born 1951, 75 in 2026) with no pre-tax money, and Bea (born 1960-06-01, 66) with a $600,000 IRA: her required withdrawals
 * start at 75, in 2035, so she can convert any part of it each year before then. Filing jointly, $2,500 and $2,000 a month of
 * Social Security, $5,000 a month of spending.
 */
export function youngerOwnerCouple() {
  return household({ status: "married_joint", spendMonthly: 5000,
    people: [{ id: "a", name: "Al", role: "self", birthDate: "1951-02-01", retirementAge: 66 }, { id: "b", name: "Bea", role: "partner", relation: "spouse", birthDate: "1960-06-01", retirementAge: 66 }],
    accounts: [{ id: "c", name: "Checking", type: "checking", balance: 20000 }, { id: "ib", name: "Bea's IRA", type: "ira", balance: 600000, ownerId: "b" }],
    income: [{ id: "sa", name: "Al's Social Security", type: "social", personId: "a", amount: 2500 }, { id: "sb", name: "Bea's Social Security", type: "social", personId: "b", amount: 2000 }] });
}

/**
 * Rae, born 1958-03-15, single, retired at 68: a $15,000 pension and $30,000 of Social Security ($45,000 a year), $10,000 in
 * checking and a $500,000 IRA, $50,000 a year of spending. Her savings pay about $5,000 a year; the guardrails way, worked out
 * on all $50,000, cuts her spending from 2027 below her income while her savings grow.
 */
export function guardRetiree() {
  return household({ status: "single", spendMonthly: 50000 / 12,
    people: [{ id: "r", name: "Rae", role: "self", birthDate: "1958-03-15", retirementAge: 68 }],
    accounts: [{ id: "c", name: "Checking", type: "checking", balance: 10000 }, { id: "i", name: "IRA", type: "ira", balance: 500000, ownerId: "r" }],
    income: [{ id: "p", name: "Pension", type: "pension", personId: "r", amount: 15000 / 12 }, { id: "s", name: "Social Security", type: "social", personId: "r", amount: 30000 / 12 }] });
}

/** Rae again with only $24,000 of Social Security and a $900,000 IRA, spending $60,000: her savings pay the year's tax too. */
export function taxedDrawRetiree() {
  return household({ status: "single", spendMonthly: 5000,
    people: [{ id: "r", name: "Rae", role: "self", birthDate: "1958-03-15", retirementAge: 68 }],
    accounts: [{ id: "i", name: "IRA", type: "ira", balance: 900000, ownerId: "r" }],
    income: [{ id: "s", name: "Social Security", type: "social", personId: "r", amount: 2000 }] });
}

/**
 * Cy, born 1966-05-01, single, stops work at 62 (2028) with $20,000 of savings, $3,500 a month of spending and Social Security
 * of $1,800 a month from 67: in the first year of retirement savings run out before the year's spending and health cover are paid.
 */
export function shortSavingsRetiree() {
  return household({ status: "single", spendMonthly: 3500,
    people: [{ id: "y", name: "Cy", role: "self", birthDate: "1966-05-01", retirementAge: 62 }],
    accounts: [{ id: "c", name: "Checking", type: "checking", balance: 8000 }, { id: "i", name: "IRA", type: "ira", balance: 12000, ownerId: "y" }],
    income: [{ id: "s", name: "Social Security", type: "social", personId: "y", amount: 1800, startDate: "2033-05-01" }] });
}

/**
 * Di, born 1962-04-01, single, retired at 64 with a $60,000 pension and a $300,000 IRA, $2,500 a month of spending, on the
 * federal brackets: the pension alone fills the 10% bracket every year, so "fill the 10% bracket" converts nothing.
 */
export function fullBracketRetiree() {
  return household({ status: "single", spendMonthly: 2500, taxMode: "brackets",
    people: [{ id: "d", name: "Di", role: "self", birthDate: "1962-04-01", retirementAge: 64 }],
    accounts: [{ id: "c", name: "Checking", type: "checking", balance: 30000 }, { id: "i", name: "IRA", type: "ira", balance: 300000, ownerId: "d" }],
    income: [{ id: "p", name: "Pension", type: "pension", personId: "d", amount: 5000 }] });
}

/**
 * Pat and Jo, both 60 in 2026 (born 1966), stop work at 62 (2028) and take Social Security at 67 (2033): $2,600 and $1,900 a
 * month at full retirement age. Nothing comes in between: $15,000 in checking, Pat's $560,000 401(k) and Jo's $200,000 IRA pay
 * for everything. $5,000 a month of spending, filing jointly, the quick flat 15% (round 8,
 * Batch 5b: the couple who retire before any income starts).
 */
export function bridgeCouple() {
  const p = emptyPlan();
  p.household.people.push(
    { id: "pat", name: "Pat", role: "self", birthDate: "1966-03-01", retirementAge: 62, lifeExpectancy: null },
    { id: "jo", name: "Jo", role: "partner", relation: "spouse", birthDate: "1966-09-15", retirementAge: 62, lifeExpectancy: null },
  );
  p.household.filingStatus = "married_joint"; p.household.state = "OH";
  p.accounts.push(
    { id: "chk", name: "Checking", type: "checking", balance: 15000, asOf: "2026-11-06", ownerId: "" },
    { id: "k", name: "Pat's 401(k)", type: "401k", balance: 560000, asOf: "2026-11-06", ownerId: "pat" },
    { id: "ira", name: "Jo's IRA", type: "ira", balance: 200000, asOf: "2026-11-06", ownerId: "jo" },
  );
  p.income.push(
    { id: "s1", name: "Pat's pay", type: "salary", personId: "pat", amount: 7000, period: "monthly", growth: 0.03, taxable: true },
    { id: "s2", name: "Jo's pay", type: "salary", personId: "jo", amount: 4500, period: "monthly", growth: 0.03, taxable: true },
  );
  p.expenses.push({ id: "x1", name: "Everything", category: "groceries", essential: true, period: "monthly", inflates: true, amount: 5000 });
  Object.assign(p.retirement, { spendingMonthly: 5000, taxMode: "flat", taxRate: 0.15, strategy: "fixed-real", withdrawalRate: 0.04,
    socialSecurity: { pat: { claimAge: 67, monthlyAtFRA: 2600 }, jo: { claimAge: 67, monthlyAtFRA: 1900 } } });
  p.retirement.contributions.push({ id: "c1", accountId: "k", personId: "pat", amount: 1000, period: "monthly", employerMatch: 0 });
  return p;
}

/**
 * Kim, 45 (born 1981-05-20), single, stopped work this year with only savings: $20,000 in checking, a $950,000 brokerage
 * account, a $380,000 401(k) and a $70,000 Roth; $3,300 a month of spending and no Social Security or pension on file.
 */
export function earlyRetiree() {
  const p = emptyPlan();
  p.household.people.push({ id: "kim", name: "Kim", role: "self", birthDate: "1981-05-20", retirementAge: 45, lifeExpectancy: null });
  p.household.filingStatus = "single"; p.household.state = "CO";
  p.accounts.push(
    { id: "chk", name: "Checking", type: "checking", balance: 20000, asOf: "2026-11-06", ownerId: "" },
    { id: "brk", name: "Brokerage", type: "brokerage", balance: 950000, asOf: "2026-11-06", ownerId: "kim" },
    { id: "k", name: "Old 401(k)", type: "401k", balance: 380000, asOf: "2026-11-06", ownerId: "kim" },
    { id: "r", name: "Roth IRA", type: "roth", balance: 70000, asOf: "2026-11-06", ownerId: "kim" },
  );
  p.expenses.push({ id: "x1", name: "Everything", category: "groceries", essential: true, period: "monthly", inflates: true, amount: 3300 });
  Object.assign(p.retirement, { spendingMonthly: 3300, taxMode: "flat", taxRate: 0.15, strategy: "fixed-real", withdrawalRate: 0.04, socialSecurity: {} });
  p.guide = { ...(p.guide ?? {}), setup: { status: { kim: "retired" }, ss: { kim: "later" }, at: "done" } };
  return p;
}
