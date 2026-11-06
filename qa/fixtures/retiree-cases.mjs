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
