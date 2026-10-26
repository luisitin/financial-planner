# H-0445  One earner, stay-at-home parent, twins · One account of every type
- type: 05-stay-at-home-parent   pack: accounts   case: every-account-type
- status: pass 2026-09-15   (untested | pass YYYY-MM-DD | fail F-0xx | skip: why)
- today: 2026-09-15   run: `node qa/households/run.mjs 05-stay-at-home-parent/accounts/H-0445-every-account-type.md`

**Household.** Marcus, 37, earns; Elena, 35, at home with twins Ivy and Ike (4). Spousal Roth for Elena.

**The twist.** 19 accounts, one per type.

**Why it matters.** All 19 types aggregate into the right tiles and buckets.

## People (4: 2 adults, 2 dependents)
| name | role | born | age | retires at | plan to | retired | years to retire | years left |
|---|---|---|---|---|---|---|---|---|
| Marcus | Me | 1989-03-03 | 37 | 65 | 95 | no | 28 | 58 |
| Elena | Partner | 1991-09-01 | 35 | 65 | 95 | no | 30 | 60 |
| Ivy | Dependent | 2022-02-14 | 4 | - | 95 | - | - | 91 |
| Ike | Dependent | 2022-02-14 | 4 | - | 95 | - | - | 91 |
- filing: married_joint   state: OH   plan horizon: 60 years

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

## Income (1)
| name | type | who | amount | how often | raise | taxed | starts | ends |
|---|---|---|---|---|---|---|---|---|
| Marcus's salary | salary | Marcus | $6,800 | every month | 3% | yes | - | - |

## Expenses (12)
| name | category | amount | how often | must-pay | inflates | starts | ends |
|---|---|---|---|---|---|---|---|
| Mortgage payment | housing | $1,700 | every month | yes (default) | no | - | - |
| Utilities | utilities | $240 | every month | yes (default) | yes | - | - |
| Groceries | groceries | $230 | every week | yes (default) | yes | - | - |
| Car payment | debt | $360 | every month | yes (default) | no | - | - |
| Gas | transport | $260 | every month | yes (default) | yes | - | - |
| Insurance | insurance | $480 | every three months | yes (default) | yes | - | - |
| Health | health | $420 | every month | yes (default) | yes | - | - |
| Phones | phone | $120 | every month | yes (default) | yes | - | - |
| Subscriptions | subscriptions | $50 | every month | no (default) | yes | - | - |
| Eating out | dining | $200 | every month | no (default) | yes | - | - |
| Kids' stuff | fun | $150 | every month | no (default) | yes | - | - |
| Giving | giving | $200 | every month | no (default) | yes | - | - |

## Debts (0 with details)
(none)

## Goals (2)
| name | amount | by | priority | set aside | saved in | per month | rate | inflates |
|---|---|---|---|---|---|---|---|---|
| Emergency fund | $20,000 | 2027-12-31 | 1 | $0 | - | $350 | plan default | no |
| Elena's certification | $4,000 | 2027-06-01 | 2 | $1,000 | - | $150 | plan default | no |

## Expected (tester's own math, today 2026-09-15)
- **People**: 4 (2 adults, 2 dependents); 28 years until Marcus retires (2054); plan must last 60 years
- **Income**: $6,800/mo, $81,600/yr, next year $84,048; by person: Marcus $6,800/mo (100%)
- **Expenses**: $4,857/mo, $58,280/yr; must-pay $4,257, nice-to-have $600; left over $1,943 (29% of income)
- **Net worth**: $63,400 = own $244,600 - owe $181,200; liquid $8,400; cash $3,300; invested $24,800 ($11,000 pre-tax, $8,700 tax-free, $5,100 taxable)
- **Emergency fund**: usable today $3,300, within a week $5,100, locked up $236,200; 0.8 months of must-pay (0.7 of all spending); target $25,540 (6 months), gap $22,240, status bad
- **Debts**: 5 debts, owed $181,200, paying $0/mo (required $0), interest $0/mo, avg rate -, DTI 0%, 5 without details
  - Card: owed $2,500 (needs details)
  - Loan: owed $8,000 (needs details)
  - Mortgage: owed $150,000 (needs details)
  - Student loan: owed $20,000 (needs details)
  - Other liability: owed $700 (needs details)
- **Goals**: 2 goals, 0 reached; saved $1,000 of $24,000; needed $1,689/mo vs $500/mo going in
  - Emergency fund: behind; $0 of $20,000, 15 months left, needs $1,318/mo, putting in $350/mo (rate 2%)
  - Elena's certification: behind; $1,000 of $4,000, 8 months left, needs $371/mo, putting in $150/mo (rate 2%)

## Also check
- [ ] own 244,600 / owe 181,200 / net 63,400
- [ ] liquid 8,400; cash 3,300; invested 24,800 = 5,100 taxable + 11,000 pre-tax + 8,700 tax-free
- [ ] Emergency fund tiers: now 3,300 / week 5,100 / later 236,200
- [ ] no console errors; nothing wider than the phone; Needs attention lists the warnings above

## Plan JSON
```json
{"schemaVersion":1,"meta":{"name":"Test plan","currency":"USD","locale":"en-US"},"household":{"people":[{"id":"p-marcus","name":"Marcus","role":"self","birthDate":"1989-03-03"},{"id":"p-elena","name":"Elena","role":"partner","birthDate":"1991-09-01"},{"id":"p-ivy","name":"Ivy","role":"dependent","birthDate":"2022-02-14"},{"id":"p-ike","name":"Ike","role":"dependent","birthDate":"2022-02-14"}],"filingStatus":"married_joint","state":"OH"},"accounts":[{"id":"t-chk","name":"Checking","type":"checking","balance":1000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-sav","name":"Savings","type":"savings","balance":2000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cash","name":"Cash","type":"cash","balance":300,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-brk","name":"Brokerage","type":"brokerage","balance":4000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-401k","name":"401(k)","type":"401k","balance":5000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ira","name":"IRA","type":"ira","balance":6000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-roth","name":"Roth","type":"roth","balance":7000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-hsa","name":"HSA","type":"hsa","balance":800,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-529","name":"529","type":"529","balance":900,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-crypto","name":"Crypto","type":"crypto","balance":1100,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-prop","name":"Property","type":"property","balance":200000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-veh","name":"Vehicle","type":"vehicle","balance":12000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-life","name":"Life cash value","type":"cash_value_life","balance":3000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-oa","name":"Other asset","type":"other_asset","balance":1500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-cc","name":"Card","type":"credit","balance":2500,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-loan","name":"Loan","type":"loan","balance":8000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-mort","name":"Mortgage","type":"mortgage","balance":150000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-stu","name":"Student loan","type":"student_loan","balance":20000,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]},{"id":"t-ol","name":"Other liability","type":"other_liability","balance":700,"asOf":"2026-09-15","ownerId":"","institution":"","history":[]}],"income":[{"id":"i-marcus","name":"Marcus's salary","type":"salary","personId":"p-marcus","amount":6800,"period":"monthly","growth":0.03,"taxable":true}],"expenses":[{"id":"e-mort","name":"Mortgage payment","category":"housing","amount":1700,"period":"monthly","inflates":false},{"id":"e-util","name":"Utilities","category":"utilities","amount":240,"period":"monthly","inflates":true},{"id":"e-groc","name":"Groceries","category":"groceries","amount":230,"period":"weekly","inflates":true},{"id":"e-car","name":"Car payment","category":"debt","amount":360,"period":"monthly","inflates":false},{"id":"e-gas","name":"Gas","category":"transport","amount":260,"period":"monthly","inflates":true},{"id":"e-ins","name":"Insurance","category":"insurance","amount":480,"period":"quarterly","inflates":true},{"id":"e-health","name":"Health","category":"health","amount":420,"period":"monthly","inflates":true},{"id":"e-phone","name":"Phones","category":"phone","amount":120,"period":"monthly","inflates":true},{"id":"e-sub","name":"Subscriptions","category":"subscriptions","amount":50,"period":"monthly","inflates":true},{"id":"e-din","name":"Eating out","category":"dining","amount":200,"period":"monthly","inflates":true},{"id":"e-fun","name":"Kids' stuff","category":"fun","amount":150,"period":"monthly","inflates":true},{"id":"e-give","name":"Giving","category":"giving","amount":200,"period":"monthly","inflates":true}],"debts":[],"goals":[{"id":"g-ef","name":"Emergency fund","icon":"🛟","target":20000,"targetDate":"2027-12-31","priority":1,"saved":0,"fundedBy":[],"monthly":350,"rate":null,"inflates":false},{"id":"g-cert","name":"Elena's certification","icon":"💼","target":4000,"targetDate":"2027-06-01","priority":2,"saved":1000,"fundedBy":[],"monthly":150,"rate":null,"inflates":false}],"assumptions":{},"netWorthHistory":[]}
```
