# H-0545  Blended family: support paid and received · One account of every type
- type: 06-blended-family   pack: accounts   case: every-account-type
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 06-blended-family/accounts/H-0545-every-account-type.md`

**Household.** Rob, 44, pays $800/mo support for Ava (14, lives with her mom); Kim, 42, receives $650/mo for Zoe (9); baby Max (1) is theirs.

**The twist.** 19 accounts, one per type.

**Why it matters.** All 19 types aggregate into the right tiles and buckets.

## People (5: 2 adults, 3 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Rob | Me | 1982-06-18 | 44 | 65 | 95 | no | 21 | 51 |
| Kim | Partner | 1983-12-02 | 42 | 65 | 95 | no | 23 | 53 |
| Zoe | Dependent | 2017-08-09 | 9 | - | 95 | - | - | 86 |
| Max | Dependent | 2025-04-20 | 1 | - | 95 | - | - | 94 |
| Ava (with her mom) | Dependent | 2012-01-15 | 14 | - | 95 | - | - | 81 |
- filing: married_joint   state: FL   plan horizon: 53 years

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
| Rob's salary | salary | Rob | $5,400 | twice a month | 2% | yes | - | - |
| Kim's salary | salary | Kim | $3,100 | every two weeks | 3% | yes | - | - |
| Child support for Zoe | support | Kim | $650 | every month | - | no | - | - |

## Expenses (13)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Child support for Ava | other | $800 | every month | yes | no | - | - |
| Mortgage payment | housing | $1,900 | every month | yes (default) | no | - | - |
| Utilities | utilities | $260 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $240 | every week | yes (default) | yes | - | - |
| Daycare (Max) | childcare | $1,100 | every month | yes (default) | yes | - | - |
| Student loan payment | debt | $310 | every month | yes (default) | no | - | - |
| Gas | transport | $280 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $620 | every three months | yes (default) | yes | - | - |
| Health | health | $350 | every month | yes (default) | yes | - | - |
| Phones | phone | $140 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $60 | every month | no (default) | yes | - | - |
| Eating out | dining | $300 | every month | no (default) | yes | - | - |
| Fun | fun | $150 | every month | no (default) | yes | - | - |

## Debts (0 with details)
(none)

## Goals (1)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $18,000 | 2028-03-01 | 1 | $0 | - | $250 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 5 (2 adults, 3 dependents); 21 years until Rob retires (2047); plan must last 53 years
- **Income**: $18,167/mo, $218,000/yr, next year $223,010; by person: Rob $10,800/mo (59%), Kim $7,367/mo (41%)
- **Expenses**: $6,897/mo, $82,760/yr; must-pay $6,387, nice-to-have $510; left over $11,270 (62% of income)
- **Net worth**: $63,400 = own $244,600 - owe $181,200; liquid $8,400; cash $3,300; invested $24,800 ($11,000 pre-tax, $8,700 tax-free, $5,100 taxable)
- **Emergency fund**: usable today $3,300, within a week $5,100, locked up $236,200; 0.5 months of must-pay (0.5 of all spending); target $38,320 (6 months), gap $35,020, status bad
- **Debts**: 5 debts, owed $181,200, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 5 without details
  - Card: owed $2,500 (needs details)
  - Loan: owed $8,000 (needs details)
  - Mortgage: owed $150,000 (needs details)
  - Student loan: owed $20,000 (needs details)
  - Other liability: owed $700 (needs details)
- **Goals**: 1 goals, 0 reached; saved $0 of $18,000; needed $1,045/mo vs $250/mo going in
  - Emergency fund: behind; $0 of $18,000, 17 months left, needs $1,045/mo, putting in $250/mo (rate 2%)

## Also check
- [ ] own 244,600 / owe 181,200 / net 63,400
- [ ] liquid 8,400; cash 3,300; invested 24,800 = 5,100 taxable + 11,000 pre-tax + 8,700 tax-free
- [ ] Emergency fund tiers: now 3,300 / week 5,100 / later 236,200
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-rob","name":"Rob","role":"self","birthDate":"1982-06-18"},{"id":"p-kim","name":"Kim","role":"partner","birthDate":"1983-12-02"},{"id":"p-zoe","name":"Zoe","role":"dependent","birthDate":"2017-08-09"},{"id":"p-max","name":"Max","role":"dependent","birthDate":"2025-04-20"},{"id":"p-ava","name":"Ava (with her mom)","role":"dependent","birthDate":"2012-01-15"}],"filingStatus":"married_joint","state":"FL"},"accounts":[{"id":"t-chk","name":"Checking","type":"checking","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-sav","name":"Savings","type":"savings","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cash","name":"Cash","type":"cash","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-brk","name":"Brokerage","type":"brokerage","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-401k","name":"401(k)","type":"401k","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ira","name":"IRA","type":"ira","balance":6000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-roth","name":"Roth","type":"roth","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-hsa","name":"HSA","type":"hsa","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-529","name":"529","type":"529","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-crypto","name":"Crypto","type":"crypto","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-prop","name":"Property","type":"property","balance":200000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-veh","name":"Vehicle","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-life","name":"Life cash value","type":"cash_value_life","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-oa","name":"Other asset","type":"other_asset","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cc","name":"Card","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-loan","name":"Loan","type":"loan","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-mort","name":"Mortgage","type":"mortgage","balance":150000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-stu","name":"Student loan","type":"student_loan","balance":20000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ol","name":"Other liability","type":"other_liability","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-rob","name":"Rob's salary","type":"salary","personId":"p-rob","amount":5400,"period":"semimonthly","growth":0.02,"taxable":true},{"id":"i-kim","name":"Kim's salary","type":"salary","personId":"p-kim","amount":3100,"period":"biweekly","growth":0.03,"taxable":true},{"id":"i-cs","name":"Child support for Zoe","type":"support","personId":"p-kim","amount":650,"period":"monthly","growth":0,"taxable":false}],"expenses":[{"id":"e-cs","name":"Child support for Ava","category":"other","amount":800,"period":"monthly","inflates":false,"essential":true},{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":1900,"period":"monthly","inflates":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":260,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":240,"period":"weekly","inflates":true},{"id":"e-day","name":"Daycare (Max)","category":"childcare","amount":1100,"period":"monthly","inflates":true},{"id":"e-stu","name":"Student loan payment","category":"debt","amount":310,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":280,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":620,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":350,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":140,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":60,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":300,"period":"monthly","inflates":true},{"id":"e-fun","name":"Fun","category":"fun","amount":150,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":18000,"targetDate":"2028-03-01","priority":1,"saved":0,"fundedBy":[],"monthly":250,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
