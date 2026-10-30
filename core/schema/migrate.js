// core/schema/migrate.js -- the plan's shape, its version, and how old plans are
// upgraded. docs/DATA_MODEL.md describes every section in prose; this file is the
// executable truth.
//
// RULES
//  * Bump SCHEMA_VERSION whenever a saved plan would need changing to stay valid.
//  * Add migrations[newVersion] = (plan) => plan. Never edit an old migration.
//  * Adding an optional field does NOT need a version bump: read it with a default.
export const SCHEMA_VERSION = 1;

export function emptyPlan() {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { name: "My plan", currency: "USD", locale: "en-US", createdAt: now, updatedAt: now },
    household: { people: [], filingStatus: "single", state: "" },
    accounts: [],            // see modules/balance/net-worth/compute.js ACCOUNT_TYPES
    netWorthHistory: [],     // [{ date, assets, liabilities, netWorth }]
    transactions: [],        // [{ id, date, amount (+in/-out), payee, rawPayee, accountId, category ("" = none), tags, note, transferId?, importId?, key }]
    categories: [],          // the owner's changes to the built-in list: [{ id, label?, icon?, kind?, essential?, hidden? }] (modules/transactions/categories)
    rules: [],               // [{ id, contains, accountId?, direction, category, payee?, hits, createdAt }] (modules/transactions/rules)
    imports: [],             // [{ id, at, accountId, fileName, rows, added, skipped, bad }] one per bank file imported
    importProfiles: {},      // { [header fingerprint]: { accountId, mapping, flipSign } } so next month's file maps itself
    recurringIgnored: [],    // keys of detected recurring payments the owner said are not bills (modules/cashflow/recurring)
    debtPlan: {},            // { extra, order, customOrder, transfer: { months, feePct }, refinance: { rate, termYears, closingCosts } } (debt pages)
    income: [],              // [{ id, name, type, personId, amount, period, growth, startDate, endDate, taxable }]  (periods: core/math/periods.js)
    expenses: [],            // [{ id, name, category, amount, period, inflates, essential, startDate?, endDate? }]
    budgets: [],             // [{ id, category, amount, period, rollover }]
    debts: [],               // loan detail per liability account: [{ id, accountId, rate, minPayment, extra, termMonths?, startDate?, securedBy? }]
    goals: [],               // [{ id, name, target, targetDate, fundedBy: [accountId], saved, monthly, rate, priority, inflates }]
    holdings: [],            // [{ id, accountId, symbol, name, shares, price, priceAsOf, costBasis (total paid), assetClass (ASSET_CLASSES in investments/holdings), expenseRatio, yield, lots: [{ id, date, shares, cost }] }]
    investments: {           // modules/investments/*
      target: null,          // { [assetClass]: fraction } the mix you aim for; null = derived from the retirement stock share
      band: 0.05,            // rebalance when a class drifts more than this (absolute) from its target
      advisoryFee: 0,        // yearly fee on the whole portfolio, a fraction (0.01 = 1%)
      newMoney: 0,           // cash to invest on the Rebalance page
      glide: "plan",         // "plan" (the retirement settings), "age" (110 minus age), "target-date" (a target-date fund's path)
    },
    insurance: { policies: [] },
    taxes: {                 // modules/taxes/*: what the plan cannot see on its own (all optional)
      year: null,              // tax year of the estimate; null = the current year
      thisYear: { wages: null, otherOrdinary: 0, qualifiedIncome: 0, taxExemptInterest: 0, adjustments: 0, socialSecurity: null, withheld: 0, paid: 0 },   // null = taken from the plan
      itemized: { mortgageInterest: 0, propertyTax: 0, stateTax: 0, charitable: 0, medical: 0, other: 0 },
      dependentsUnder17: null, otherDependents: null, blind: 0,   // null = counted from the People page
      priorYear: { tax: null, agi: null },   // last year's return, for the safe harbour on estimated payments
      estimated: { paid: [0, 0, 0, 0] },     // the four quarterly payments made so far this year
      gains: [],                             // [{ id, name, proceeds, basis, held: "short"|"long" }] sales this year (taxes/capital-gains)
      withholding: {},                       // { perPaycheck, paychecksLeft, spouse... } (taxes/withholding)
      hsa: { coverage: "self", contribution: 0, employer: 0, fsa: 0, fsaSpent: 0 },
    },
    estate: { documents: [], beneficiaries: [] },
    property: [],            // homes, vehicles, big purchases with their own detail
    assumptions: {
      inflation: 0.03, returnStocks: 0.07, returnBonds: 0.04, returnCash: 0.02,
      salaryGrowth: 0.03, retirementAge: 65, planEndAge: 95, stdevStocks: 0.15, stdevBonds: 0.05,
      emergencyMonths: 6,    // months of essential expenses the emergency fund should cover
      // reviewedAt: "YYYY-MM-DD" is set by system/assumptions when the owner confirms these
    },
    retirement: {            // modules/retirement/*: settings and inputs the projection needs
      spendingMonthly: null,   // in retirement, today's dollars; null = today's expenses
      stocksNow: 0.7, stocksRetired: 0.5, taxRate: 0.15, strategy: "fixed-real", withdrawalRate: 0.04,
      contributions: [],       // [{ id, accountId, personId, amount, period, employerMatch (yearly) }]
      socialSecurity: {},      // { [personId]: { claimAge, record: [{ year, earnings }], monthlyAtFRA, futureEarnings } }
      pensions: [],            // [{ id, personId, name, monthly, startAge, endAge?, cola }]
      longevity: {},           // { [personId]: { sex: "m"|"f"|"", health: "average"|"better"|"worse" } }
      taxMode: "flat",         // "flat": taxRate on pre-tax withdrawals; "brackets": the federal engine on each year's income (core/math/tax.js)
      withdrawalOrder: ["taxable", "deferred", "free"],   // after cash; retirement/withdrawal-order
      rothConversion: { on: false, fillRate: 0.22, untilAge: null },   // brackets mode: fill that bracket with conversions before RMDs
      gainShare: 0.5, dividendYield: 0.02,   // how much of a taxable-account withdrawal is gain; yearly dividends on the taxable bucket
    },
    scenarios: [],           // [{ id, name, changes: { lever or lever:personId: value }, createdAt }] (scenarios/compare)
    pageNotes: {},           // { "group/id": "what the owner wants this page to do" } -- typed on placeholder pages
    reviews: [],             // [{ month: "YYYY-MM", at: "YYYY-MM-DD", note }] one per month marked reviewed (overview/monthly-review)
    notes: "",
  };
}

// migrations[v] upgrades a plan from v-1 to v.
const migrations = {
  // 2: (plan) => { ...plan, schemaVersion: 2, newSection: [] },
};

export function migrate(input) {
  if (!input || typeof input !== "object") return emptyPlan();
  let plan = input;
  let v = Number(plan.schemaVersion) || 0;
  if (v === 0) { plan = { ...emptyPlan(), ...plan, schemaVersion: 1 }; v = 1; }
  while (v < SCHEMA_VERSION) { v++; plan = migrations[v](plan); plan.schemaVersion = v; }
  // fill any section a hand-edited or older file may lack
  const base = emptyPlan();
  for (const k of Object.keys(base)) if (plan[k] === undefined) plan[k] = base[k];
  plan.assumptions = { ...base.assumptions, ...(plan.assumptions ?? {}) };
  plan.retirement = { ...base.retirement, ...(plan.retirement ?? {}) };
  plan.taxes = { ...base.taxes, ...(plan.taxes ?? {}) };
  plan.investments = { ...base.investments, ...(plan.investments ?? {}) };
  for (const k of ["thisYear", "itemized", "priorYear", "estimated", "hsa"]) plan.taxes[k] = { ...base.taxes[k], ...(plan.taxes[k] ?? {}) };
  plan.retirement.rothConversion = { ...base.retirement.rothConversion, ...(plan.retirement.rothConversion ?? {}) };
  plan.meta = { ...base.meta, ...(plan.meta ?? {}) };
  return plan;
}
