# H-1345  Widowed, one adult child at home, small business sold · One account of every type
- type: 14-unusual-structures   pack: accounts   case: every-account-type
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 14-unusual-structures/accounts/H-1345-every-account-type.md`

**Household.** Grace, 58, widowed last year (qualifying surviving spouse); son Eli (24) lives at home and pays board; life-insurance payout invested; a pension from her late husband.

**The twist.** 19 accounts, one per type.

**Why it matters.** All 19 types aggregate into the right tiles and buckets.

## People (2: 1 adults, 1 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Grace | Me | 1967-12-12 | 58 | 64 | 95 | no | 6 | 37 |
| Eli (adult son at home) | Dependent | 2002-05-15 | 24 | - | 95 | - | - | 71 |
- filing: qualifying_surviving   state: MN   plan horizon: 37 years

## Accounts (19)
| name | type | balance | as of | owner |
|---|---|---|---|---|
| Checking | checking | $1,000 | 2026-09-15 | joint |
| Savings | savings | $2,000 | 2026-09-15 | joint |
| Cash | cash | $300 | 2026-09-15 | joint |
| Brokerage | brokerage | $4,000 | 2026-09-15 | joint |
| 401(k) | 401k | $5,000 | 2026-09-15 | joint |
| IRA | ira | $6,000 | 2026-09-15 | joint |
| Roth | roth | $7,000 | 2026-09-15 | joint |
| HSA | hsa | $800 | 2026-09-15 | joint |
| 529 | 529 | $900 | 2026-09-15 | joint |
| Crypto | crypto | $1,100 | 2026-09-15 | joint |
| Property | property | $200,000 | 2026-09-15 | joint |
| Vehicle | vehicle | $12,000 | 2026-09-15 | joint |
| Life cash value | cash_value_life | $3,000 | 2026-09-15 | joint |
| Other asset | other_asset | $1,500 | 2026-09-15 | joint |
| Card | credit | $2,500 | 2026-09-15 | joint |
| Loan | loan | $8,000 | 2026-09-15 | joint |
| Mortgage | mortgage | $150,000 | 2026-09-15 | joint |
| Student loan | student_loan | $20,000 | 2026-09-15 | joint |
| Other liability | other_liability | $700 | 2026-09-15 | joint |

## Income (3)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Grace's salary | salary | Grace | $5,600 | every month | 2% | yes | - | - |
| Survivor pension | pension | Grace | $1,900 | every month | - | yes | - | - |
| Eli's board | support | Eli (adult son at home) | $500 | every month | - | no | - | - |

## Expenses (11)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Property tax | taxes | $5,400 | once a year | yes (default) | yes | - | - |
| Utilities | utilities | $230 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $170 | every week | yes (default) | yes | - | - |
| Gas | transport | $190 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $1,100 | every three months | yes (default) | yes | - | - |
| Health | health | $480 | every month | yes (default) | yes | - | - |
| Phones | phone | $110 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $50 | every month | no (default) | yes | - | - |
| Eating out | dining | $240 | every month | no (default) | yes | - | - |
| Travel | travel | $4,000 | once a year | no (default) | yes | - | - |
| Giving | giving | $300 | every month | no (default) | yes | - | - |

## Debts (0 with details)
(none)

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Retire at 64: bridge fund | $150,000 | 2032-12-12 | 1 | $0 | - | $1,200 | 4% | no |
| Help Eli with a down payment | $30,000 | 2029-06-01 | 2 | $5,000 | - | $400 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 2 (1 adults, 1 dependents); 6 years until Grace retires (2031); plan must last 37 years
- **Income**: $8,000/mo, $96,000/yr, next year $97,344; by person: Grace $7,500/mo (94%), Eli (adult son at home) $500/mo (6%)
- **Expenses**: $3,487/mo, $41,840/yr; must-pay $2,563, nice-to-have $923; left over $4,513 (56% of income)
- **Net worth**: $63,400 = own $244,600 - owe $181,200; liquid $8,400; cash $3,300; invested $24,800 ($11,000 pre-tax, $8,700 tax-free, $5,100 taxable)
- **Emergency fund**: usable today $3,300, within a week $5,100, locked up $236,200; 1.3 months of must-pay (0.9 of all spending); target $15,380 (6 months), gap $12,080, status bad
- **Debts**: 5 debts, owed $181,200, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 5 without details
  - Card: owed $2,500 (needs details)
  - Loan: owed $8,000 (needs details)
  - Mortgage: owed $150,000 (needs details)
  - Student loan: owed $20,000 (needs details)
  - Other liability: owed $700 (needs details)
- **Goals**: 2 goals, 0 reached; saved $5,000 of $180,000; needed $2,544/mo vs $1,600/mo going in
  - Retire at 64: bridge fund: behind; $0 of $150,000, 74 months left, needs $1,791/mo, putting in $1,200/mo (rate 4%)
  - Help Eli with a down payment: behind; $5,000 of $30,000, 32 months left, needs $753/mo, putting in $400/mo (rate 2%)

## Also check
- [ ] own 244,600 / owe 181,200 / net 63,400
- [ ] liquid 8,400; cash 3,300; invested 24,800 = 5,100 taxable + 11,000 pre-tax + 8,700 tax-free
- [ ] Emergency fund tiers: now 3,300 / week 5,100 / later 236,200
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-grace","name":"Grace","role":"self","birthDate":"1967-12-12","retirementAge":64},{"id":"p-eli","name":"Eli (adult son at home)","role":"dependent","birthDate":"2002-05-15"}],"filingStatus":"qualifying_surviving","state":"MN"},"accounts":[{"id":"t-chk","name":"Checking","type":"checking","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-sav","name":"Savings","type":"savings","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cash","name":"Cash","type":"cash","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-brk","name":"Brokerage","type":"brokerage","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-401k","name":"401(k)","type":"401k","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ira","name":"IRA","type":"ira","balance":6000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-roth","name":"Roth","type":"roth","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-hsa","name":"HSA","type":"hsa","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-529","name":"529","type":"529","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-crypto","name":"Crypto","type":"crypto","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-prop","name":"Property","type":"property","balance":200000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-veh","name":"Vehicle","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-life","name":"Life cash value","type":"cash_value_life","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-oa","name":"Other asset","type":"other_asset","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cc","name":"Card","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-loan","name":"Loan","type":"loan","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-mort","name":"Mortgage","type":"mortgage","balance":150000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-stu","name":"Student loan","type":"student_loan","balance":20000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ol","name":"Other liability","type":"other_liability","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-grace","name":"Grace's salary","type":"salary","personId":"p-grace","amount":5600,"period":"monthly","growth":0.02,"taxable":true},{"id":"i-surv","name":"Survivor pension","type":"pension","personId":"p-grace","amount":1900,"period":"monthly","growth":0,"taxable":true},{"id":"i-board","name":"Eli's board","type":"support","personId":"p-eli","amount":500,"period":"monthly","growth":0,"taxable":false}],"expenses":[{"id":"e-tax","name":"Property tax","category":"taxes","amount":5400,"period":"annual","inflates":true},{"id":"e-util","name":"Utilities","category":"utilities","amount":230,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":170,"period":"weekly","inflates":true},{"id":"e-gas","name":"Gas","category":"transport","amount":190,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":1100,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":480,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":110,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":50,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":240,"period":"monthly","inflates":true},{"id":"e-trav","name":"Travel","category":"travel","amount":4000,"period":"annual","inflates":true},{"id":"e-give","name":"Giving","category":"giving","amount":300,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-retire","name":"Retire at 64: bridge fund","icon":"🛟","target":150000,"targetDate":"2032-12-12","priority":1,"saved":0,"fundedBy":[],"monthly":1200,"rate":0.04,"inflates":false},{"id":"g-eli","name":"Help Eli with a down payment","icon":"🏠","target":30000,"targetDate":"2029-06-01","priority":2,"saved":5000,"fundedBy":[],"monthly":400,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
