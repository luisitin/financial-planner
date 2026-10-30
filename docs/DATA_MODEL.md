# Data model: the plan object

One JSON object. The executable definition is `core/schema/migrate.js` (`emptyPlan()`);
this page explains each section and who owns it. "Owner" is the module that defines the
shape and is the first place to look for its fields.

Common conventions: every list item has an `id` (uid), dates are `YYYY-MM-DD`, money is a
number in `meta.currency`, rates are fractions (0.07), people are referenced by `personId`.

| section | shape | owner |
|---|---|---|
| `schemaVersion` | integer, see migrate.js | core |
| `meta` | `{ name, currency, locale, createdAt, updatedAt }` | system/settings |
| `household` | `{ people: [{ id, name, birthDate, role: "self"\|"partner"\|"dependent", retirementAge?, lifeExpectancy? }], filingStatus: single\|married_joint\|married_separate\|head_of_household\|qualifying_surviving, state: two letters or "" }`; ages are computed, never stored | household/people |
| `accounts` | `[{ id, name, type, institution, balance, asOf, ownerId, history: [{ date, balance }], notes }]`; `type` from `ACCOUNT_TYPES` | balance/net-worth |
| `netWorthHistory` | `[{ date, assets, liabilities, netWorth }]` one per day | balance/net-worth |
| `transactions` | `[{ id, date, amount (+in/-out), payee, rawPayee (the bank's text), accountId, category ("" = none), tags[], note, transferId?, importId?, key }]`; `key` = account+date+amount+normalised payee, the duplicate check | transactions/ledger |
| `categories` | the owner's changes to the built-in list: `[{ id, label?, icon?, kind: expense\|income\|transfer, essential?, hidden? }]`; built-ins come from Expenses/Income | transactions/categories |
| `rules` | `[{ id, contains, accountId?, direction: any\|in\|out, category, payee?, hits, createdAt }]` | transactions/rules |
| `imports` | `[{ id, at, accountId, fileName, rows, added, skipped, bad }]` one per bank file; undo removes by `importId` | transactions/import |
| `importProfiles` | `{ [header fingerprint]: { accountId, mapping, flipSign } }` so the same bank's next file maps itself | transactions/import |
| `income` | `[{ id, name, type (INCOME_TYPES: salary, bonus, business, rental, pension, social, investment, support, other), personId ("" = household), amount, period (core/math/periods.js: weekly, biweekly, semimonthly, monthly, quarterly, annual, once), growth (fraction), startDate, endDate, taxable }]` | cashflow/income |
| `expenses` | `[{ id, name, category (CATEGORIES in the module), amount, period, inflates: bool, essential: bool, startDate?, endDate? }]` | cashflow/expenses |
| `budgets` | `[{ id, category, amount, period: "monthly", rollover }]` -- envelopes | cashflow/budget |
| `recurringIgnored` | `[key]` -- found recurring payments the owner said are not bills (`accountId|normalised payee`) | cashflow/recurring |
| `debtPlan` | `{ extra, order: avalanche\|snowball\|custom, customOrder: [accountId], mortgageAccountId?, transfer: { months, feePct }, refinance: { rate, termYears, closingCosts, yearsStaying } }` | debt/* |
| `debts` | `[{ id, accountId, rate (fraction), minPayment, extra, termMonths?, startDate?, securedBy?, creditLimit? }]` -- loan detail, one per liability account; the balance stays on the account | balance/liabilities |
| `goals` | `[{ id, name, icon, target (today's money), targetDate, priority: 1\|2\|3, saved, fundedBy: [accountId], monthly, rate (fraction or null = plan default), inflates }]` | goals/goals |
| `holdings` | `[{ id, accountId, symbol, name, shares, price, priceAsOf, costBasis (total paid), assetClass ("" = worked out from the symbol; else ASSET_CLASSES in investments/holdings), expenseRatio, yield, lots: [{ id, date, shares, cost }] }]` | investments/holdings |
| `investments` | `{ target: { us_stocks, intl_stocks, bonds, cash, real_estate, other } fractions or null (= from retirement.stocksNow), band (0.05), advisoryFee (fraction), newMoney, glide: "plan"\|"age"\|"target-date" }` | investments/* |
| `insurance` | `{ policies: [{ id, name, kind: "term"\|"whole"\|"disability"\|"ltc"\|"health"\|"home"\|"auto"\|"umbrella"\|"other", personId ("" = the household), insurer, benefit (life: death benefit; disability, care: monthly; health: out-of-pocket maximum; home: dwelling cover; auto, umbrella: liability limit), premium, period, endDate?, renewalDate?, cashValue? (whole only), throughWork?, notes?, waitDays?, untilAge?, paidBy?: "employer"\|"me", offset? (disability: the terms, set on insurance/disability), benefitYears?, inflationProtected? (ltc, with waitDays: set on insurance/ltc), rebuildCost?, liability?, deductible?, accountId? (home; auto: deductible; set on insurance/property), yearsPaid?, surrenderValue?, basis?, laterYears?, cashValueLater?, termQuote? (whole: set on insurance/cash-value) }], health?: { tier: "self"\|"family", expected, plans: [{ id, name, premium, deductible, coinsurance, oopMax, hsa, employerHsa }] } (insurance/health), compare?: { deathBenefit, wholePremium, termPremium, termYears, cashValue, cashValueGuaranteed, taxed, returnRate } (insurance/term-vs-permanent), ltc?: { care: "nursing"\|"semi"\|"assisted"\|"home"\|"day", startAge, years, costFactor } (the care to plan for, insurance/ltc) }` | insurance/policies |
| `taxes` | `{ year (null = this year), thisYear: { wages (null = from Income), otherOrdinary, qualifiedIncome, taxExemptInterest, adjustments, socialSecurity (null = from Income), withheld, paid }, itemized: { mortgageInterest, propertyTax, stateTax, charitable, medical, other }, dependentsUnder17, otherDependents (null = counted from People), blind, priorYear: { tax, agi }, estimated: { paid: [q1, q2, q3, q4] }, gains: [{ id, name, proceeds, basis, held: "short"\|"long" }], withholding: { self: { perPaycheck, period }, partner: {...} }, hsa: { coverage: "self"\|"family", contribution, employer, fsa, fsaSpent } }` | taxes/federal (and the page named) |
| `estate` | `{ documents: [{ id, kind: will\|guardian\|poaFinance\|poaHealth\|livingWill\|hipaa\|trust\|letter, personId ("" = household), status: done\|started\|none, done, updatedAt, where, notes }], beneficiaries: [{ key: "account:<id>"\|"policy:<id>", accountId \| policyId, primary: [{ name, share, personId }], contingent: [same], reviewedAt }] (estate/beneficiaries; a plain-name primary from older rows is read as one name at 100%) }` | estate/documents |
| `property` | `[{ id, kind: "home"\|"rental"\|"vehicle"\|"purchase", accountId?, value, purchasePrice, purchaseDate, ... }]` | property/* |
| `assumptions` | `{ inflation, returnStocks, returnBonds, returnCash, stdevStocks, stdevBonds, salaryGrowth, retirementAge, planEndAge, emergencyMonths, reviewedAt? }` -- rates are fractions; sources in the module README | system/assumptions |
| `retirement` | `{ spendingMonthly, stocksNow, stocksRetired, taxRate, strategy: fixed-real\|percent\|guardrails\|vpw, withdrawalRate, contributions: [{ id, accountId, personId, amount, period, employerMatch }], socialSecurity: { [personId]: { claimAge, record: [{ year, earnings }], monthlyAtFRA, futureEarnings } }, pensions: [{ id, personId, name, monthly, startAge, endAge?, cola }], longevity: { [personId]: { sex, health } }, taxMode: "flat"\|"brackets", withdrawalOrder: ["taxable", "deferred", "free"] (after cash), rothConversion: { on, fillRate, untilAge }, gainShare, dividendYield }` | retirement/* |
| `scenarios` | `[{ id, name, overrides: partial plan, createdAt }]` -- applied on top of the plan by scenarios/compare | scenarios/compare |
| `pageNotes` | `{ "group/id": "text" }` -- what the owner wants a not-yet-built page to do, typed on its placeholder | core/ui/placeholder |
| `reviews` | `[{ month: "YYYY-MM", at: "YYYY-MM-DD", note }]` -- one per month the owner marked reviewed, with what they noted | overview/monthly-review |
| `notes` | free text | - |

## Rules for changing it
* New optional field on an existing item: just read it with a default. No version bump.
* New section: add to `emptyPlan()`; `migrate()` back-fills missing sections automatically.
* Renamed / re-shaped field: bump `SCHEMA_VERSION`, add `migrations[n]`, never edit an old migration.
* Document here in the same change.

## Where it is stored
* PC server: `data/plan.json` (+ `data/backups/plan-<timestamp>.json`, last 50 by default).
* Each browser: `localStorage["planner.plan"]` as an offline copy / the only copy when no server.
* Sandbox: `localStorage["planner.plan.sandbox"]` when the app is opened with `?sandbox=1`; a
  pretend plan that is never sent to the server (testers and demos; `docs/TEAM.md` rule 6).
* Export / import: System > Settings, plain JSON.

## Not in the plan (device or server side)
* `localStorage["planner.connection"]` -- server URL, token, this device's AI settings.
* `localStorage["planner.features"]` -- this device's page toggles.
* `planner.properties` -- the server's settings (never inside the plan, never served).
